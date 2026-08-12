/**
 * Motor de impressão do comprovante: PDF vetorial gerado por código.
 *
 * Substitui o motor antigo, que revelava um `<div>` do próprio app através de
 * `@media print` + `body[data-print-layout]` e desfazia essa preparação no
 * evento `afterprint`. No WebKit/iOS `window.print()` não bloqueia: o
 * `afterprint` dispara antes da rasterização e o recibo já estava escondido de
 * novo quando a folha era desenhada — o cliente recebia só o menu do app.
 *
 * Aqui não há CSS de impressão, `@page`, nem corrida de eventos: o documento é
 * construído em memória e sai idêntico em qualquer device. O conteúdo espelha
 * `buildSaleReceiptBuffer` (ESC/POS), para que térmica e PDF nunca divirjam.
 */

import jsPDF from 'jspdf';
import { getCpfOrCnpjLabel } from './inputMasks';
import type { ThermalReceiptData } from './thermalPrinter';

export type ReceiptPrintLayout = '80mm' | 'a4';

// ── Composição (pura, sem jsPDF) ──────────────────────────────────────────────

export type ReceiptBlock =
  | { kind: 'text'; text: string; align: 'left' | 'center'; bold?: boolean; scale?: number }
  | { kind: 'row'; left: string; right: string; bold?: boolean }
  | { kind: 'rule'; strong?: boolean }
  | { kind: 'space'; mm: number };

export function formatReceiptCurrency(value: number): string {
  const rounded = Math.round(value * 100) / 100;
  // `-0` sai como "R$ -0,00" no toLocaleString; normaliza para zero positivo.
  const safe = Object.is(rounded, -0) ? 0 : rounded;
  return `R$ ${safe.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

const formatDateTime = (iso: string): string => {
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? '-' : date.toLocaleString('pt-BR');
};

const formatDate = (iso: string): string => {
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? '-' : date.toLocaleDateString('pt-BR');
};

export function getReceiptSaleCode(data: ThermalReceiptData): string {
  return data.saleNumber != null ? String(data.saleNumber) : data.saleId.slice(-6).toUpperCase();
}

/**
 * Monta o comprovante como uma lista de blocos independente de layout. Manter a
 * composição separada do desenho é o que torna o recibo testável em CI — algo
 * impossível no motor `@media print`, onde só dava para verificar um atributo
 * no `<body>`.
 */
export function composeSaleReceipt(data: ThermalReceiptData): ReceiptBlock[] {
  const blocks: ReceiptBlock[] = [];
  const text = (
    value: string,
    opts: { align?: 'left' | 'center'; bold?: boolean; scale?: number } = {}
  ) => blocks.push({ kind: 'text', text: value, align: opts.align ?? 'left', bold: opts.bold, scale: opts.scale });
  const row = (left: string, right: string, bold?: boolean) => blocks.push({ kind: 'row', left, right, bold });
  const rule = (strong?: boolean) => blocks.push({ kind: 'rule', strong });
  const space = (mm: number) => blocks.push({ kind: 'space', mm });

  // Cabeçalho
  text(data.businessName.toUpperCase(), { align: 'center', bold: true, scale: 1.35 });
  if (data.businessAddress) text(data.businessAddress, { align: 'center' });
  if (data.businessCnpj) text(`CNPJ: ${data.businessCnpj}`, { align: 'center' });
  if (data.businessPhone) text(`Tel: ${data.businessPhone}`, { align: 'center' });
  space(1);
  rule(true);

  // Identificação da venda
  text('COMPROVANTE DE VENDA', { bold: true });
  space(0.5);
  row(`Nº #${getReceiptSaleCode(data)}`, formatDateTime(data.saleDate));
  text(`Cliente: ${data.customerName}`);
  if (data.customerCpf) text(`${getCpfOrCnpjLabel(data.customerCpf)}: ${data.customerCpf}`);
  text(`Vendedor: ${data.sellerName}`);

  // Itens
  rule();
  text('ITENS', { bold: true });
  rule();
  data.items.forEach((item, index) => {
    if (index > 0) space(1.5);
    text([item.model, item.capacity].filter(Boolean).join(' '), { bold: true });
    text(`IMEI/Serial: ${item.imei || '-'}`);
    text(`Cor: ${item.color || 'Sem cor'}`);
    if (item.condition === 'Seminovo' && item.batteryHealth != null) {
      text(`Saúde da bateria: ${item.batteryHealth}%`);
    }
    if (item.condition === 'Novo') {
      text('Garantia Apple: 1 ano');
    } else if (item.warrantyExpiresAt) {
      text(`Garantia loja: até ${formatDate(item.warrantyExpiresAt)}`);
    }
    row('1x', formatReceiptCurrency(item.sellPrice));
  });

  // Aparelhos recebidos na troca
  if (data.tradeIns.length > 0) {
    rule();
    text('APARELHOS RECEBIDOS NA TROCA', { bold: true });
    rule();
    data.tradeIns.forEach((tradeIn, index) => {
      if (index > 0) space(1.5);
      text([tradeIn.model, tradeIn.capacity, tradeIn.color].filter(Boolean).join(' - '), { bold: true });
      if (tradeIn.imei) text(`IMEI/Serial: ${tradeIn.imei}`);
      row('Entrada:', `-${formatReceiptCurrency(tradeIn.receivedValue)}`);
    });
  }

  // Totais
  rule();
  text('TOTAIS', { bold: true });
  rule();
  row('Subtotal', formatReceiptCurrency(data.negotiatedSubtotal));
  if (data.discountAmount > 0) row(data.discountLabel, `-${formatReceiptCurrency(data.discountAmount)}`);
  row('Total da venda', formatReceiptCurrency(data.saleGrossTotal));
  row('Acréscimo cartão', formatReceiptCurrency(data.cardFeeTotal));
  rule();
  row('TOTAL PAGO', formatReceiptCurrency(data.totalCustomerWithTradeIn), true);
  if (data.tradeInSubtotal > 0) {
    row('Trade-in pago', formatReceiptCurrency(data.tradeInSubtotal));
    row('Líquido em contas', formatReceiptCurrency(data.saleNetTotal));
  }

  // Pagamentos
  rule();
  text('PAGAMENTOS', { bold: true });
  rule();
  for (const payment of data.payments) {
    row(payment.label, formatReceiptCurrency(payment.customerAmount));
    if (Math.abs(payment.customerAmount - payment.storeAmount) > 0.005) {
      row('   Líquido loja', formatReceiptCurrency(payment.storeAmount));
      row('   Acréscimo', formatReceiptCurrency(payment.customerAmount - payment.storeAmount));
    }
  }
  if (data.tradeInSubtotal > 0) {
    const count = data.tradeIns.length;
    row(`Troca (${count} aparelho${count !== 1 ? 's' : ''})`, formatReceiptCurrency(data.tradeInSubtotal));
  }

  // Rodapé
  rule(true);
  if (data.warrantyLine) {
    for (const warrantyLine of data.warrantyLine.split('\n')) text(warrantyLine, { align: 'center' });
  }
  text('Obrigado pela preferência!', { align: 'center' });

  return blocks;
}

// ── Desenho ───────────────────────────────────────────────────────────────────

interface Geometry {
  pageWidth: number;
  margin: number;
  font: 'courier' | 'helvetica';
  fontSize: number;
  lineHeight: number;
  paragraphGap: number;
}

const GEOMETRY: Record<ReceiptPrintLayout, Geometry> = {
  // Bobina térmica de 80mm: 72mm de área imprimível é o padrão dos cabeçotes.
  '80mm': { pageWidth: 80, margin: 4, font: 'courier', fontSize: 8, lineHeight: 3.5, paragraphGap: 1 },
  a4: { pageWidth: 210, margin: 16, font: 'helvetica', fontSize: 10, lineHeight: 4.8, paragraphGap: 1.2 }
};

const A4_HEIGHT_MM = 297;
/** Altura de sobra do passe de medição da bobina — nenhum recibo real chega perto. */
const ROLL_MEASURE_HEIGHT_MM = 4000;
const ROLL_MIN_HEIGHT_MM = 60;

/** Converte pontos tipográficos em milímetros (unidade do documento). */
const ptToMm = (pt: number): number => (pt * 25.4) / 72;

interface DrawOptions {
  /** Altura útil da página; `null` desliga a paginação (bobina contínua). */
  pageHeight: number | null;
}

function drawBlocks(doc: jsPDF, geo: Geometry, blocks: ReceiptBlock[], options: DrawOptions): number {
  const contentWidth = geo.pageWidth - geo.margin * 2;
  const left = geo.margin;
  const right = geo.margin + contentWidth;
  const center = geo.margin + contentWidth / 2;
  let y = geo.margin;

  const useFont = (bold: boolean, scale = 1) => {
    doc.setFont(geo.font, bold ? 'bold' : 'normal');
    doc.setFontSize(geo.fontSize * scale);
  };

  const ensureSpace = (needed: number) => {
    if (options.pageHeight == null) return;
    if (y + needed > options.pageHeight - geo.margin) {
      doc.addPage();
      y = geo.margin;
    }
  };

  const widthOf = (value: string) => doc.getTextWidth(value);

  for (const block of blocks) {
    if (block.kind === 'space') {
      y += block.mm;
      continue;
    }

    if (block.kind === 'rule') {
      const lead = geo.paragraphGap + (block.strong ? 1 : 0.6);
      ensureSpace(lead + 1);
      y += geo.paragraphGap;
      doc.setLineWidth(block.strong ? 0.5 : 0.2);
      doc.setDrawColor(block.strong ? 20 : 130);
      doc.line(left, y, right, y);
      y += lead;
      continue;
    }

    if (block.kind === 'text') {
      const scale = block.scale ?? 1;
      useFont(Boolean(block.bold), scale);
      const lineHeight = geo.lineHeight * scale;
      const lines = doc.splitTextToSize(block.text, contentWidth) as string[];
      for (const line of lines) {
        ensureSpace(lineHeight);
        y += lineHeight;
        doc.text(line, block.align === 'center' ? center : left, y, {
          align: block.align === 'center' ? 'center' : 'left',
          baseline: 'alphabetic'
        });
      }
      continue;
    }

    // row: rótulo à esquerda, valor alinhado à direita. O valor é sagrado — quem
    // quebra em várias linhas é o rótulo.
    useFont(Boolean(block.bold));
    const valueWidth = widthOf(block.right);
    const labelWidth = Math.max(contentWidth - valueWidth - ptToMm(geo.fontSize) / 2, contentWidth * 0.3);
    const labelLines = doc.splitTextToSize(block.left, labelWidth) as string[];
    labelLines.forEach((line, index) => {
      ensureSpace(geo.lineHeight);
      y += geo.lineHeight;
      doc.text(line, left, y, { baseline: 'alphabetic' });
      if (index === labelLines.length - 1) {
        doc.text(block.right, right, y, { align: 'right', baseline: 'alphabetic' });
      }
    });
  }

  return y + geo.margin;
}

/**
 * Gera o PDF do comprovante. Síncrono de propósito: chamado direto do handler
 * do clique, preserva a *user activation* que o Safari exige para compartilhar
 * ou imprimir — o `setTimeout` do motor antigo quebrava justamente essa cadeia.
 */
export function buildSaleReceiptPdf(data: ThermalReceiptData, layout: ReceiptPrintLayout): jsPDF {
  const geo = GEOMETRY[layout];
  const blocks = composeSaleReceipt(data);

  if (layout === 'a4') {
    const doc = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait', compress: true });
    drawBlocks(doc, geo, blocks, { pageHeight: A4_HEIGHT_MM });
    return doc;
  }

  // Bobina contínua: mede numa página folgada e recria com a altura exata, para
  // a impressora térmica não avançar papel em branco no fim do cupom.
  const probe = new jsPDF({ unit: 'mm', format: [geo.pageWidth, ROLL_MEASURE_HEIGHT_MM] });
  const measuredHeight = drawBlocks(probe, geo, blocks, { pageHeight: null });
  const height = Math.max(Math.ceil(measuredHeight), ROLL_MIN_HEIGHT_MM);

  const doc = new jsPDF({ unit: 'mm', format: [geo.pageWidth, height], compress: true });
  drawBlocks(doc, geo, blocks, { pageHeight: null });
  return doc;
}

export function receiptPdfFileName(data: ThermalReceiptData): string {
  return `comprovante-${getReceiptSaleCode(data)}.pdf`;
}
