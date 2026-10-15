// PDF do contrato Repasse Care+ (pdf-lib: TS puro, sem DOM — confiável no edge runtime).
// O PDF emitido é o documento imutável que o cliente aceita; o PDF final assinado é esse
// mesmo documento com o certificado de assinatura anexado ao fim (os bytes originais são
// preservados no armazenamento e o hash de ambos fica registrado).

import { PDFDocument, PDFFont, PDFPage, rgb, StandardFonts } from "https://esm.sh/pdf-lib@1.17.1";
import {
  buildContractClauses,
  buildContractSummary,
  type CareContractTextData,
  formatPhoneBR,
} from "./contract_text.ts";

const A4: [number, number] = [595.28, 841.89];
const MARGIN = 50;
const NAVY = rgb(0.05, 0.13, 0.3);
const ORANGE = rgb(0.96, 0.45, 0.09);
const TEXT = rgb(0.12, 0.12, 0.14);
const MUTED = rgb(0.4, 0.42, 0.46);
const RULE = rgb(0.85, 0.87, 0.9);

// Fontes padrão do PDF usam WinAnsi (Latin-1): descarta o que estiver fora para não quebrar a renderização.
const safe = (text: unknown): string =>
  String(text ?? "").replace(/[–—]/g, "-").replace(/[“”]/g, '"').replace(/[^\x09\x0A\x0D\x20-\xFF]/g, "");

interface Writer {
  pdf: PDFDocument;
  page: PDFPage;
  font: PDFFont;
  bold: PDFFont;
  y: number;
}

const contentWidth = A4[0] - MARGIN * 2;

function newPage(w: Writer): void {
  w.page = w.pdf.addPage(A4);
  w.y = A4[1] - MARGIN;
}

function ensure(w: Writer, needed: number): void {
  if (w.y - needed < MARGIN + 20) newPage(w);
}

interface Measure {
  font: PDFFont;
  size: number;
  width: number;
}

function wrapLine(text: string, m: Measure): string[] {
  const lines: string[] = [];
  let current = "";
  for (const word of text.split(/\s+/).filter(Boolean)) {
    const candidate = current ? `${current} ${word}` : word;
    const fits = m.font.widthOfTextAtSize(candidate, m.size) <= m.width;
    if (!fits && current) lines.push(current);
    current = fits ? candidate : word;
  }
  lines.push(current);
  return lines;
}

const wrap = (text: string, m: Measure): string[] => safe(text).split("\n").flatMap((line) => wrapLine(line, m));

interface TextOptions {
  size?: number;
  bold?: boolean;
  color?: ReturnType<typeof rgb>;
  indent?: number;
  after?: number;
}

function paragraph(w: Writer, text: string, opts: TextOptions = {}): void {
  const size = opts.size ?? 9.5;
  const font = opts.bold ? w.bold : w.font;
  const indent = opts.indent ?? 0;
  const leading = size * 1.45;
  for (const lineText of wrap(text, { font, size, width: contentWidth - indent })) {
    ensure(w, leading);
    w.page.drawText(lineText, { x: MARGIN + indent, y: w.y, size, font, color: opts.color ?? TEXT });
    w.y -= leading;
  }
  w.y -= opts.after ?? 4;
}

function rule(w: Writer, color = RULE): void {
  ensure(w, 10);
  w.page.drawLine({ start: { x: MARGIN, y: w.y }, end: { x: A4[0] - MARGIN, y: w.y }, thickness: 0.8, color });
  w.y -= 10;
}

function keyValue(w: Writer, label: string, value: string): void {
  const size = 9;
  const labelWidth = 170;
  const valueLines = wrap(value, { font: w.font, size, width: contentWidth - labelWidth });
  const leading = size * 1.45;
  ensure(w, leading * valueLines.length);
  w.page.drawText(safe(label), { x: MARGIN, y: w.y, size, font: w.bold, color: MUTED });
  for (const lineText of valueLines) {
    w.page.drawText(lineText, { x: MARGIN + labelWidth, y: w.y, size, font: w.font, color: TEXT });
    w.y -= leading;
  }
  w.y -= 2;
}

function brandHeader(w: Writer, subtitle: string): void {
  w.page.drawText("REPASSE CARE+", { x: MARGIN, y: w.y, size: 20, font: w.bold, color: NAVY });
  const brandWidth = w.bold.widthOfTextAtSize("REPASSE CARE+", 20);
  w.page.drawText("by iPHONE REPASSE", { x: MARGIN + brandWidth + 10, y: w.y + 2, size: 8, font: w.bold, color: ORANGE });
  w.y -= 18;
  paragraph(w, subtitle, { size: 10.5, bold: true, color: NAVY, after: 2 });
  rule(w, ORANGE);
}

function stampFooters(pdf: PDFDocument, font: PDFFont, label: string): void {
  const pages = pdf.getPages();
  pages.forEach((page, index) => {
    const text = safe(`${label} · página ${index + 1} de ${pages.length}`);
    page.drawText(text, { x: MARGIN, y: 28, size: 7.5, font, color: MUTED });
  });
}

async function openWriter(): Promise<Writer> {
  const pdf = await PDFDocument.create();
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const w: Writer = { pdf, page: pdf.addPage(A4), font, bold, y: A4[1] - MARGIN };
  return w;
}

export async function renderContractPdf(data: CareContractTextData): Promise<Uint8Array> {
  const w = await openWriter();
  w.pdf.setTitle(`Contrato Repasse Care+ nº ${data.contractNumber}`);
  w.pdf.setAuthor(data.contractor.legalName);
  w.pdf.setCreationDate(data.issuedAt);
  w.pdf.setModificationDate(data.issuedAt);
  w.pdf.setProducer("iPhoneRepasse Pro");
  w.pdf.setCreator("Repasse Care+");

  brandHeader(w, "CONTRATO DE PRESTAÇÃO DE SERVIÇOS DE ASSISTÊNCIA TÉCNICA CONTINUADA");
  paragraph(w, "Quadro-resumo", { size: 11, bold: true, color: NAVY, after: 6 });
  for (const group of buildContractSummary(data)) {
    paragraph(w, group.title.toUpperCase(), { size: 8, bold: true, color: ORANGE, after: 2 });
    for (const [label, value] of group.rows) keyValue(w, label, value);
    w.y -= 4;
  }
  rule(w);

  for (const section of buildContractClauses(data)) {
    ensure(w, 40);
    paragraph(w, section.title, { size: 10, bold: true, color: NAVY, after: 3 });
    for (const text of section.paragraphs) paragraph(w, text, { after: 5 });
    w.y -= 4;
  }

  ensure(w, 90);
  rule(w);
  paragraph(w, "Assinaturas", { size: 10, bold: true, color: NAVY });
  paragraph(
    w,
    `CONTRATANTE: ${data.customer.name} — assinatura eletrônica por código de 6 dígitos enviado ao WhatsApp ${formatPhoneBR(data.customer.phone)}, registrada no certificado anexo após a assinatura.`,
  );
  paragraph(w, `CONTRATADA: ${data.contractor.legalName} — emissora deste documento.`);

  stampFooters(w.pdf, w.font, `Contrato Repasse Care+ nº ${data.contractNumber} · documento v${data.documentVersion} · cláusulas ${data.clausesVersion}`);
  return await w.pdf.save({ useObjectStreams: false });
}

export interface CertificateEvent {
  occurredAt: string;
  type: string;
  source: string;
  ip: string | null;
  userAgent: string | null;
  whatsappMessageId: string | null;
  geo: string;
  hash: string;
}

export interface SignatureCertificateData {
  contractNumber: number;
  documentVersion: number;
  documentSha256: string;
  signerName: string;
  signerCpfMasked: string;
  signerPhoneMasked: string;
  signedAtUtc: string;
  method: string;
  events: CertificateEvent[];
  chainLastHash: string | null;
}

const EVENT_LABELS: Record<string, string> = {
  documento_emitido: "Documento emitido",
  sessao_criada: "Sessão de assinatura criada",
  link_enviado: "Link enviado pelo WhatsApp",
  link_envio_falhou: "Falha no envio do link",
  link_aberto: "Link aberto pelo assinante",
  documento_visualizado: "Documento integral visualizado",
  aceite_registrado: "Aceite expresso registrado",
  otp_enviado: "Código enviado pelo WhatsApp",
  otp_envio_falhou: "Falha no envio do código",
  otp_invalido: "Código inválido informado",
  otp_validado: "Código validado",
  contrato_assinado: "Contrato assinado",
};

export const eventLabel = (type: string): string => EVENT_LABELS[type] ?? type;

export const formatFortaleza = (iso: string): string =>
  new Date(iso).toLocaleString("pt-BR", { timeZone: "America/Fortaleza" });

// PDF final = bytes do documento aceito + páginas do certificado de assinatura.
export async function renderSignedPdf(originalPdf: Uint8Array, cert: SignatureCertificateData): Promise<Uint8Array> {
  const pdf = await PDFDocument.load(originalPdf);
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const w: Writer = { pdf, page: pdf.addPage(A4), font, bold, y: A4[1] - MARGIN };

  brandHeader(w, "CERTIFICADO DE ASSINATURA ELETRÔNICA");
  keyValue(w, "Contrato", `nº ${cert.contractNumber} · documento v${cert.documentVersion}`);
  keyValue(w, "SHA-256 do documento aceito", cert.documentSha256);
  keyValue(w, "Assinante", `${cert.signerName} · CPF ${cert.signerCpfMasked}`);
  keyValue(w, "WhatsApp verificado", cert.signerPhoneMasked);
  keyValue(w, "Assinado em (UTC)", cert.signedAtUtc);
  keyValue(w, "Assinado em (Fortaleza)", formatFortaleza(cert.signedAtUtc));
  keyValue(w, "Método", cert.method);
  keyValue(w, "Último elo da trilha", cert.chainLastHash ?? "—");
  paragraph(
    w,
    "Assinatura eletrônica nos termos do art. 10, § 2º, da MP nº 2.200-2/2001. Não é assinatura qualificada ICP-Brasil. Horários do servidor. A localização só aparece quando autorizada pelo assinante.",
    { size: 8, color: MUTED, after: 8 },
  );
  rule(w);
  paragraph(w, "Trilha de evidências", { size: 10, bold: true, color: NAVY });
  for (const event of cert.events) {
    ensure(w, 60);
    paragraph(w, `${formatFortaleza(event.occurredAt)} · ${eventLabel(event.type)}`, { size: 8.5, bold: true, after: 1 });
    const details = [
      `UTC ${event.occurredAt}`,
      `origem ${event.source}`,
      event.ip ? `IP ${event.ip}` : "IP não registrado",
      event.whatsappMessageId ? `mensagem WhatsApp ${event.whatsappMessageId}` : null,
      `localização: ${event.geo}`,
    ].filter(Boolean).join(" · ");
    paragraph(w, details, { size: 7.5, color: MUTED, after: 1 });
    if (event.userAgent) paragraph(w, `Navegador: ${event.userAgent}`, { size: 7, color: MUTED, after: 1 });
    paragraph(w, `hash ${event.hash}`, { size: 6.5, color: MUTED, after: 5 });
  }

  return await pdf.save({ useObjectStreams: false });
}
