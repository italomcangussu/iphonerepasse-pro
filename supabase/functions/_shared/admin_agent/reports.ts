// PDF report generation for the admin agent.
//
// A report tool fetches aggregated data through the existing read operations,
// renders a simple PDF with pdf-lib (pure TS, no DOM — reliable in Supabase edge
// functions), uploads it to the private `admin-agent-reports` bucket, signs a
// short-lived URL and sends it back to the admin as a WhatsApp document via the
// injected `deps.sendDocument`. Reports are read-only (no confirmation needed).

import { PDFDocument, PDFFont, PDFPage, rgb, StandardFonts } from "https://esm.sh/pdf-lib@1.17.1";
import {
  getFinancialSummary,
  getInventorySummary,
  getSalesSummary,
  listOverdueDebts,
  listPayableDebts,
  OpsDeps,
  resolvePeriod,
} from "./operations.ts";

export type ReportKind = "financeiro" | "vendas" | "estoque" | "dividas";

const REPORT_KINDS: ReportKind[] = ["financeiro", "vendas", "estoque", "dividas"];

export function resolveReportKind(value: unknown): ReportKind | null {
  const v = String(value ?? "").trim().toLowerCase();
  if (["financeiro", "financas", "finanças", "caixa", "finance"].includes(v)) return "financeiro";
  if (["vendas", "venda", "sales"].includes(v)) return "vendas";
  if (["estoque", "inventario", "inventário", "stock", "inventory"].includes(v)) return "estoque";
  if (["dividas", "dívidas", "dívida", "divida", "debts", "cobrancas", "cobranças"].includes(v)) return "dividas";
  return null;
}

// pdf-lib StandardFonts use WinAnsi (Latin-1); drop anything outside it so a
// stray emoji/character never throws mid-render.
function safe(text: unknown): string {
  return String(text ?? "").replace(/[^\x09\x0A\x0D\x20-\xFF]/g, "");
}

// --- Minimal top-down layout on A4 ------------------------------------------

interface Doc {
  pdf: PDFDocument;
  page: PDFPage;
  font: PDFFont;
  bold: PDFFont;
  y: number;
}

const A4: [number, number] = [595.28, 841.89];
const MARGIN = 48;
const GRAY = rgb(0.35, 0.35, 0.35);
const BLACK = rgb(0.1, 0.1, 0.1);

function ensureSpace(doc: Doc, needed: number): void {
  if (doc.y - needed < MARGIN) {
    doc.page = doc.pdf.addPage(A4);
    doc.y = A4[1] - MARGIN;
  }
}

function line(doc: Doc, text: string, opts: { size?: number; bold?: boolean; color?: ReturnType<typeof rgb>; gap?: number } = {}): void {
  const size = opts.size ?? 11;
  ensureSpace(doc, size + 6);
  doc.page.drawText(safe(text), {
    x: MARGIN,
    y: doc.y,
    size,
    font: opts.bold ? doc.bold : doc.font,
    color: opts.color ?? BLACK,
  });
  doc.y -= size + (opts.gap ?? 6);
}

function spacer(doc: Doc, h = 8): void {
  doc.y -= h;
}

function table(doc: Doc, headers: string[], rows: string[][], widths: number[]): void {
  const size = 10;
  const rowH = size + 8;
  ensureSpace(doc, rowH);
  let x = MARGIN;
  headers.forEach((h, i) => {
    doc.page.drawText(safe(h), { x, y: doc.y, size, font: doc.bold, color: BLACK });
    x += widths[i];
  });
  doc.y -= rowH;
  for (const row of rows) {
    ensureSpace(doc, rowH);
    x = MARGIN;
    row.forEach((cell, i) => {
      const maxChars = Math.max(4, Math.floor(widths[i] / (size * 0.55)));
      const text = cell.length > maxChars ? cell.slice(0, maxChars - 1) + "…" : cell;
      doc.page.drawText(safe(text), { x, y: doc.y, size, font: doc.font, color: BLACK });
      x += widths[i];
    });
    doc.y -= rowH;
  }
}

function header(doc: Doc, title: string, subtitle: string): void {
  line(doc, "iPhoneRepasse Pro", { size: 16, bold: true, gap: 2 });
  line(doc, title, { size: 13, bold: true, gap: 2 });
  line(doc, subtitle, { size: 9, color: GRAY, gap: 10 });
}

// --- Report bodies ----------------------------------------------------------

async function buildFinanceReport(doc: Doc, deps: OpsDeps, period: string, label: string): Promise<void> {
  const fin = await getFinancialSummary(deps, { period });
  header(doc, "Relatório Financeiro", `Período: ${label} · gerado em ${new Date(deps.now?.() ?? Date.now()).toLocaleString("pt-BR")}`);
  if (!fin.ok) { line(doc, "Não foi possível carregar os dados financeiros."); return; }
  line(doc, `Receitas: ${fin.income}`, { bold: true });
  line(doc, `Despesas: ${fin.expense}`, { bold: true });
  line(doc, `Saldo do período: ${fin.net}`, { bold: true });
  line(doc, `Lançamentos: ${fin.transactions}`);
  spacer(doc);
  const cats = (fin.topExpenseCategories ?? []) as Array<{ category: string; total: string }>;
  if (cats.length > 0) {
    line(doc, "Maiores despesas por categoria", { bold: true });
    table(doc, ["Categoria", "Total"], cats.map((c) => [String(c.category ?? "—"), String(c.total)]), [340, 160]);
  }
}

async function buildSalesReport(doc: Doc, deps: OpsDeps, period: string, label: string): Promise<void> {
  const sales = await getSalesSummary(deps, { period });
  header(doc, "Relatório de Vendas", `Período: ${label} · gerado em ${new Date(deps.now?.() ?? Date.now()).toLocaleString("pt-BR")}`);
  if (!sales.ok) { line(doc, "Não foi possível carregar as vendas."); return; }
  line(doc, `Quantidade de vendas: ${sales.count}`, { bold: true });
  line(doc, `Faturamento: ${sales.revenue}`, { bold: true });
  line(doc, `Ticket médio: ${sales.avgTicket}`, { bold: true });
}

async function buildInventoryReport(doc: Doc, deps: OpsDeps, label: string): Promise<void> {
  const inv = await getInventorySummary(deps);
  header(doc, "Relatório de Estoque", `Snapshot atual · gerado em ${new Date(deps.now?.() ?? Date.now()).toLocaleString("pt-BR")}`);
  void label;
  if (!inv.ok) { line(doc, "Não foi possível carregar o estoque."); return; }
  line(doc, `Disponíveis: ${inv.available}`, { bold: true });
  line(doc, `Reservados: ${inv.reserved}`);
  line(doc, `Em preparação: ${inv.inPreparation}`);
  line(doc, `Total em estoque: ${inv.inStockCount}`);
  spacer(doc);
  line(doc, `Capital investido (compra): ${inv.totalPurchaseValue}`, { bold: true });
  line(doc, `Valor de venda em estoque: ${inv.totalSellValue}`, { bold: true });
}

async function buildDebtsReport(doc: Doc, deps: OpsDeps, label: string): Promise<void> {
  header(doc, "Relatório de Dívidas", `Gerado em ${new Date(deps.now?.() ?? Date.now()).toLocaleString("pt-BR")}`);
  void label;
  const overdue = await listOverdueDebts(deps, { limit: 25 });
  line(doc, "A receber — vencidas", { bold: true });
  if (overdue.ok && (overdue.debts as unknown[]).length > 0) {
    const rows = (overdue.debts as Array<Record<string, unknown>>).map((d) => [
      String(d.customer ?? "—"), String(d.remaining ?? ""), String(d.dueDate ?? ""),
    ]);
    table(doc, ["Cliente", "Saldo", "Venc."], rows, [260, 130, 110]);
  } else {
    line(doc, "Nenhuma dívida de cliente vencida.", { color: GRAY });
  }
  spacer(doc);
  const payable = await listPayableDebts(deps, { limit: 25 });
  line(doc, "A pagar — em aberto", { bold: true });
  if (payable.ok && (payable.payableDebts as unknown[]).length > 0) {
    const rows = (payable.payableDebts as Array<Record<string, unknown>>).map((d) => [
      String(d.creditor ?? "—"), String(d.remaining ?? ""), String(d.dueDate ?? ""),
    ]);
    table(doc, ["Credor", "Saldo", "Venc."], rows, [260, 130, 110]);
  } else {
    line(doc, "Nenhuma conta a pagar em aberto.", { color: GRAY });
  }
}

// --- Orchestration ----------------------------------------------------------

/** Build the PDF bytes for a report kind. */
export async function buildReportPdf(
  deps: OpsDeps,
  kind: ReportKind,
  period: string,
): Promise<Uint8Array> {
  const range = resolvePeriod(period, deps.now?.() ?? Date.now());
  const pdf = await PDFDocument.create();
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const page = pdf.addPage(A4);
  const doc: Doc = { pdf, page, font, bold, y: A4[1] - MARGIN };

  if (kind === "financeiro") await buildFinanceReport(doc, deps, period, range.label);
  else if (kind === "vendas") await buildSalesReport(doc, deps, period, range.label);
  else if (kind === "estoque") await buildInventoryReport(doc, deps, range.label);
  else await buildDebtsReport(doc, deps, range.label);

  return await pdf.save();
}

/** Generate a report, upload it, and send it to the admin as a WhatsApp document. */
export async function generateReport(
  deps: OpsDeps,
  args: { kind?: unknown; period?: unknown },
): Promise<{ ok: boolean; message?: string; error?: string; kind?: string }> {
  const kind = resolveReportKind(args.kind);
  if (!kind) {
    return { ok: false, error: `Tipo de relatório inválido. Use: ${REPORT_KINDS.join(", ")}.` };
  }
  if (!deps.sendDocument) {
    return { ok: false, error: "Envio de documentos indisponível neste canal." };
  }
  const bucket = deps.supabase.storage?.from("admin-agent-reports");
  if (!bucket) {
    return { ok: false, error: "Armazenamento de relatórios indisponível." };
  }

  const period = String(args.period ?? "mes_atual");
  let bytes: Uint8Array;
  try {
    bytes = await buildReportPdf(deps, kind, period);
  } catch (err) {
    return { ok: false, error: `Falha ao gerar o PDF: ${(err as Error).message}` };
  }

  const stamp = new Date(deps.now?.() ?? Date.now()).toISOString().slice(0, 10);
  const path = `${deps.actor.userId ?? "admin"}/${kind}-${stamp}-${Date.now()}.pdf`;
  const up = await bucket.upload(path, bytes, { contentType: "application/pdf", upsert: true });
  if (up.error) {
    return { ok: false, error: `Falha ao salvar o relatório: ${up.error.message ?? "upload"}` };
  }
  const signed = await bucket.createSignedUrl(path, 3600);
  const url = signed.data?.signedUrl;
  if (!url) {
    return { ok: false, error: `Falha ao gerar o link do relatório: ${signed.error?.message ?? "sign"}` };
  }

  const filename = `relatorio-${kind}-${stamp}.pdf`;
  const sent = await deps.sendDocument({
    mediaUrl: url,
    mediaFilename: filename,
    mediaType: "document",
    caption: `Relatório ${kind}`,
  });
  if (!sent.ok) {
    return { ok: false, error: `Falha ao enviar o documento: ${sent.error ?? "envio"}` };
  }
  return { ok: true, kind, message: `Relatório ${kind} enviado em PDF.` };
}
