/**
 * Motor de impressão do comprovante: PDF vetorial gerado por código.
 *
 * Substitui o motor antigo, que revelava um `<div>` do próprio app através de
 * `@media print` + `body[data-print-layout]` e desfazia essa preparação no
 * evento `afterprint`. No WebKit `window.print()` não bloqueia: o `afterprint`
 * dispara antes da rasterização e o recibo já estava escondido de novo quando a
 * folha era desenhada — o cliente recebia só o menu do app.
 *
 * Aqui não há CSS de impressão, `@page`, nem corrida de eventos: o documento é
 * construído em memória e sai idêntico em qualquer device. O conteúdo espelha
 * `buildSaleReceiptBuffer` (ESC/POS), para que térmica e PDF nunca divirjam.
 *
 * ## Desenho
 *
 * `composeSaleReceipt` monta o **conteúdo** como uma lista de blocos, sem saber
 * nada de jsPDF; o `Painter` desenha esses blocos com a **forma** de cada
 * layout. Separar as duas coisas é o que torna o comprovante testável em CI e
 * o que permite o A4 ganhar painéis e cor sem que a bobina de 80mm — onde a
 * térmica imprime em 1 bit — herde fundos que sairiam chapados de preto.
 */

import jsPDF from 'jspdf';
import { getCpfOrCnpjLabel } from './inputMasks';
import type { ThermalReceiptData } from './thermalPrinter';

export type ReceiptPrintLayout = '80mm' | 'a4';

/** Logo já resolvida em data URL, pronta para o jsPDF (ver `receiptLogo.ts`). */
export interface ReceiptLogo {
  dataUrl: string;
  format: 'PNG' | 'JPEG';
}

export interface BuildReceiptPdfOptions {
  logo?: ReceiptLogo | null;
}

// ── Conteúdo (puro, sem jsPDF) ────────────────────────────────────────────────

export type ReceiptTone = 'strong' | 'body' | 'muted';

export type ReceiptBlock =
  /** Título de seção: versalete discreto, não um segundo nível de corpo. */
  | { kind: 'section'; label: string }
  /** Rótulo curto + valor, lado a lado — o par identifica cliente/vendedor. */
  | { kind: 'fields'; entries: Array<{ label: string; value: string }> }
  /** Produto: nome e preço na mesma linha; especificações abaixo, em surdina. */
  | { kind: 'item'; title: string; price: string; details: string[] }
  | { kind: 'row'; left: string; right: string; tone?: ReceiptTone }
  /** O número que o cliente procura primeiro. Um por comprovante. */
  | { kind: 'total'; label: string; value: string }
  /** Saldo em aberto — a única informação que precisa interromper a leitura. */
  | { kind: 'alert'; label: string; value: string; note?: string }
  | { kind: 'text'; text: string; align?: 'left' | 'center'; tone?: ReceiptTone }
  | { kind: 'space'; mm: number };

export interface ReceiptHeader {
  businessName: string;
  businessLines: string[];
  documentLabel: string;
  documentNumber: string;
  documentDate: string;
  /** Iniciais para o monograma quando a loja não subiu logo. */
  monogram: string;
}

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

/** Endereços vêm do perfil com quebras livres; linhas vazias viram buraco. */
const toLines = (value?: string): string[] =>
  (value ?? '')
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);

const toMonogram = (name: string): string =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word[0]?.toUpperCase() ?? '')
    .join('') || 'IR';

export function composeSaleReceiptHeader(data: ThermalReceiptData): ReceiptHeader {
  const businessLines = [...toLines(data.businessAddress)];
  if (data.businessCnpj) businessLines.push(`CNPJ: ${data.businessCnpj}`);
  if (data.businessPhone) businessLines.push(`Tel: ${data.businessPhone}`);

  return {
    businessName: data.businessName,
    businessLines,
    documentLabel: 'Comprovante de venda',
    documentNumber: `Nº ${getReceiptSaleCode(data)}`,
    documentDate: formatDateTime(data.saleDate),
    monogram: toMonogram(data.businessName)
  };
}

/** Corpo do comprovante — o cabeçalho é montado por `composeSaleReceiptHeader`. */
export function composeSaleReceipt(data: ThermalReceiptData): ReceiptBlock[] {
  const blocks: ReceiptBlock[] = [];
  const push = (block: ReceiptBlock) => blocks.push(block);
  const pendingTotal = data.payments
    .filter((payment) => payment.isPending)
    .reduce((acc, payment) => acc + payment.customerAmount, 0);

  // Identificação — quem comprou, de quem.
  const fields: Array<{ label: string; value: string }> = [{ label: 'Cliente', value: data.customerName }];
  if (data.customerCpf) fields.push({ label: getCpfOrCnpjLabel(data.customerCpf), value: data.customerCpf });
  fields.push({ label: 'Vendedor', value: data.sellerName });
  push({ kind: 'fields', entries: fields });

  // Itens
  push({ kind: 'section', label: 'Itens' });
  for (const item of data.items) {
    const details = [`IMEI/Serial: ${item.imei || '-'}`, `Cor: ${item.color || 'Sem cor'}`];
    if (item.condition === 'Seminovo' && item.batteryHealth != null) {
      details.push(`Saúde da bateria: ${item.batteryHealth}%`);
    }
    if (item.condition === 'Novo') {
      details.push('Garantia Apple: 1 ano');
    } else if (item.warrantyExpiresAt) {
      details.push(`Garantia loja: até ${formatDate(item.warrantyExpiresAt)}`);
    }
    push({
      kind: 'item',
      title: [item.model, item.capacity].filter(Boolean).join(' '),
      price: formatReceiptCurrency(item.sellPrice),
      details
    });
  }

  // Aparelhos recebidos na troca
  if (data.tradeIns.length > 0) {
    push({ kind: 'section', label: 'Aparelhos recebidos na troca' });
    for (const tradeIn of data.tradeIns) {
      push({
        kind: 'item',
        title: [tradeIn.model, tradeIn.capacity, tradeIn.color].filter(Boolean).join(' · '),
        price: `-${formatReceiptCurrency(tradeIn.receivedValue)}`,
        details: tradeIn.imei ? [`IMEI/Serial: ${tradeIn.imei}`] : []
      });
    }
  }

  // Totais
  push({ kind: 'section', label: 'Totais' });
  push({ kind: 'row', left: 'Subtotal', right: formatReceiptCurrency(data.negotiatedSubtotal), tone: 'muted' });
  if (data.discountAmount > 0) {
    push({ kind: 'row', left: data.discountLabel, right: `-${formatReceiptCurrency(data.discountAmount)}`, tone: 'muted' });
  }
  push({ kind: 'row', left: 'Total da venda', right: formatReceiptCurrency(data.saleGrossTotal), tone: 'muted' });
  // Zero em acréscimo é ruído: só ocupa linha e não informa nada.
  if (data.cardFeeTotal > 0) {
    push({ kind: 'row', left: 'Acréscimo cartão', right: formatReceiptCurrency(data.cardFeeTotal), tone: 'muted' });
  }
  push({
    // "Total pago" com saldo em aberto seria mentira: o cliente ainda deve.
    kind: 'total',
    label: pendingTotal > 0 ? 'Total da compra' : 'Total pago',
    value: formatReceiptCurrency(data.totalCustomerWithTradeIn)
  });
  if (data.tradeInSubtotal > 0) {
    push({ kind: 'row', left: 'Trade-in pago', right: formatReceiptCurrency(data.tradeInSubtotal), tone: 'muted' });
    push({ kind: 'row', left: 'Líquido em contas', right: formatReceiptCurrency(data.saleNetTotal), tone: 'muted' });
  }

  // Pagamentos
  push({ kind: 'section', label: 'Pagamentos' });
  for (const payment of data.payments) {
    push({ kind: 'row', left: payment.label, right: formatReceiptCurrency(payment.customerAmount) });
    if (Math.abs(payment.customerAmount - payment.storeAmount) > 0.005) {
      push({ kind: 'row', left: 'Líquido loja', right: formatReceiptCurrency(payment.storeAmount), tone: 'muted' });
      push({ kind: 'row', left: 'Acréscimo', right: formatReceiptCurrency(payment.customerAmount - payment.storeAmount), tone: 'muted' });
    }
  }
  if (data.tradeInSubtotal > 0) {
    const count = data.tradeIns.length;
    push({
      kind: 'row',
      left: `Troca (${count} aparelho${count !== 1 ? 's' : ''})`,
      right: formatReceiptCurrency(data.tradeInSubtotal)
    });
  }

  // Saldo em aberto: o cliente precisa sair sabendo que ainda deve.
  if (pendingTotal > 0) {
    push({
      kind: 'alert',
      label: 'Saldo em aberto',
      value: formatReceiptCurrency(pendingTotal),
      // "Dívida ativa" é o nome do conceito no ERP; no comprovante do cliente
      // vale a palavra que ele entende sem tradução.
      note: 'Pagamento pendente registrado na loja.'
    });
  }

  // Rodapé
  push({ kind: 'space', mm: 2 });
  if (data.warrantyLine) {
    for (const warrantyLine of data.warrantyLine.split('\n')) {
      push({ kind: 'text', text: warrantyLine, align: 'center', tone: 'muted' });
    }
  }
  push({ kind: 'text', text: 'Obrigado pela preferência!', align: 'center', tone: 'muted' });

  return blocks;
}

// ── Forma ─────────────────────────────────────────────────────────────────────

interface Palette {
  ink: string;
  body: string;
  muted: string;
  accent: string;
  accentStrong: string;
  accentSoft: string;
  panel: string;
  hairline: string;
  alertInk: string;
  alertSoft: string;
}

/** Tokens de `tailwind.config.cjs` — slate/brand/amber do design system. */
const COLOR_PALETTE: Palette = {
  ink: '#0f172a',
  body: '#334155',
  muted: '#64748b',
  accent: '#2563eb',
  accentStrong: '#1d4ed8',
  accentSoft: '#eff6ff',
  panel: '#f8fafc',
  hairline: '#e2e8f0',
  alertInk: '#b45309',
  alertSoft: '#fffbeb'
};

/**
 * A térmica imprime em 1 bit: qualquer fundo colorido vira uma mancha chapada e
 * o texto por cima some. Na bobina a hierarquia é só peso e tamanho.
 */
const MONO_PALETTE: Palette = {
  ink: '#000000',
  body: '#000000',
  muted: '#3f3f3f',
  accent: '#000000',
  accentStrong: '#000000',
  accentSoft: '#ffffff',
  panel: '#ffffff',
  hairline: '#000000',
  alertInk: '#000000',
  alertSoft: '#ffffff'
};

interface Geometry {
  pageWidth: number;
  margin: number;
  /** Corpo em pt; os demais tamanhos derivam daqui. */
  body: number;
  lineHeight: number;
  palette: Palette;
  /** Sem fundos nem faixa de marca (bobina térmica). */
  monochrome: boolean;
  logoSize: number;
  /** Cabeçalho em duas colunas (A4) ou empilhado e centralizado (bobina). */
  stackedHeader: boolean;
}

const GEOMETRY: Record<ReceiptPrintLayout, Geometry> = {
  '80mm': {
    pageWidth: 80,
    margin: 5,
    body: 8,
    lineHeight: 3.4,
    palette: MONO_PALETTE,
    monochrome: true,
    logoSize: 14,
    stackedHeader: true
  },
  a4: {
    pageWidth: 210,
    margin: 16,
    body: 9.5,
    lineHeight: 4.6,
    palette: COLOR_PALETTE,
    monochrome: false,
    logoSize: 18,
    stackedHeader: false
  }
};

const A4_HEIGHT_MM = 297;
/** Altura de sobra do passe de medição da bobina — nenhum recibo real chega perto. */
const ROLL_MEASURE_HEIGHT_MM = 4000;
const ROLL_MIN_HEIGHT_MM = 60;
const BRAND_BAR_HEIGHT_MM = 2.5;

class Painter {
  private y: number;
  readonly contentWidth: number;
  readonly left: number;
  readonly right: number;

  /** Desenha o cabeçalho de continuação assim que uma folha nova é aberta. */
  onNewPage?: (painter: Painter) => void;

  constructor(
    private readonly doc: jsPDF,
    private readonly geo: Geometry,
    /** `null` desliga a paginação (bobina contínua). */
    private readonly pageHeight: number | null
  ) {
    this.contentWidth = geo.pageWidth - geo.margin * 2;
    this.left = geo.margin;
    this.right = geo.pageWidth - geo.margin;
    this.y = geo.margin;
  }

  get cursor(): number {
    return this.y;
  }

  set cursor(value: number) {
    this.y = value;
  }

  private get palette(): Palette {
    return this.geo.palette;
  }

  font(size: number, bold = false, color = this.palette.ink): void {
    this.doc.setFont('helvetica', bold ? 'bold' : 'normal');
    this.doc.setFontSize(size);
    this.doc.setTextColor(color);
  }

  ensureSpace(needed: number): void {
    if (this.pageHeight == null) return;
    if (this.y + needed > this.pageHeight - this.geo.margin) {
      this.doc.addPage();
      this.y = this.geo.margin;
      this.onNewPage?.(this);
    }
  }

  space(mm: number): void {
    this.y += mm;
  }

  /** Fio de separação — um por seção, no lugar de uma régua por bloco. */
  hairline(width = this.contentWidth): void {
    this.doc.setLineWidth(0.2);
    this.doc.setDrawColor(this.palette.hairline);
    this.doc.line(this.left, this.y, this.left + width, this.y);
  }

  text(value: string, options: { size?: number; bold?: boolean; color?: string; align?: 'left' | 'center' | 'right'; x?: number; maxWidth?: number } = {}): void {
    const size = options.size ?? this.geo.body;
    const lineHeight = this.geo.lineHeight * (size / this.geo.body);
    this.font(size, options.bold, options.color);
    const lines = this.doc.splitTextToSize(value, options.maxWidth ?? this.contentWidth) as string[];
    for (const line of lines) {
      this.ensureSpace(lineHeight);
      this.y += lineHeight;
      const x = options.x ?? (options.align === 'center' ? this.geo.pageWidth / 2 : options.align === 'right' ? this.right : this.left);
      this.doc.text(line, x, this.y, { align: options.align ?? 'left', baseline: 'alphabetic' });
    }
  }

  /** Rótulo à esquerda, valor à direita. O valor nunca quebra; o rótulo sim. */
  pair(label: string, value: string, options: { size?: number; bold?: boolean; labelColor?: string; valueColor?: string } = {}): void {
    const size = options.size ?? this.geo.body;
    const lineHeight = this.geo.lineHeight * (size / this.geo.body);
    this.font(size, options.bold, options.valueColor ?? this.palette.ink);
    const valueWidth = this.doc.getTextWidth(value);
    const labelWidth = Math.max(this.contentWidth - valueWidth - 4, this.contentWidth * 0.3);
    this.font(size, options.bold, options.labelColor ?? this.palette.body);
    const labelLines = this.doc.splitTextToSize(label, labelWidth) as string[];

    labelLines.forEach((line, index) => {
      this.ensureSpace(lineHeight);
      this.y += lineHeight;
      this.font(size, options.bold, options.labelColor ?? this.palette.body);
      this.doc.text(line, this.left, this.y, { baseline: 'alphabetic' });
      if (index === labelLines.length - 1) {
        this.font(size, options.bold, options.valueColor ?? this.palette.ink);
        this.doc.text(value, this.right, this.y, { align: 'right', baseline: 'alphabetic' });
      }
    });
  }

  /** Quantas linhas um texto ocupa — usado para dimensionar painéis. */
  measureLines(value: string, size: number, maxWidth: number): number {
    this.font(size);
    return (this.doc.splitTextToSize(value, maxWidth) as string[]).length;
  }

  panel(height: number, fill: string, accentBar?: string): void {
    this.ensureSpace(height + 2);
    if (this.geo.monochrome) return;
    this.doc.setFillColor(fill);
    this.doc.roundedRect(this.left, this.y, this.contentWidth, height, 1.6, 1.6, 'F');
    if (accentBar) {
      this.doc.setFillColor(accentBar);
      this.doc.roundedRect(this.left, this.y, 1.4, height, 0.7, 0.7, 'F');
    }
  }

  /** Desenha a logo; devolve `false` se o arquivo não puder ser embutido. */
  image(dataUrl: string, format: 'PNG' | 'JPEG', x: number, y: number, box: number): boolean {
    try {
      // Encaixa a logo na caixa preservando a proporção — logo esticada é o tipo
      // de detalhe que faz um documento parecer amador.
      const props = this.doc.getImageProperties(dataUrl);
      const ratio = props.width / props.height;
      if (!Number.isFinite(ratio) || ratio <= 0) return false;
      const width = ratio >= 1 ? box : box * ratio;
      const height = ratio >= 1 ? box / ratio : box;
      this.doc.addImage(dataUrl, format, x + (box - width) / 2, y + (box - height) / 2, width, height);
      return true;
    } catch {
      // Logo corrompida não pode custar o comprovante inteiro.
      return false;
    }
  }

  monogramMark(text: string, x: number, y: number, box: number): void {
    if (this.geo.monochrome) {
      this.doc.setLineWidth(0.4);
      this.doc.setDrawColor(this.palette.ink);
      this.doc.roundedRect(x, y, box, box, 2.5, 2.5, 'S');
      this.font(box * 0.9, true, this.palette.ink);
    } else {
      this.doc.setFillColor(this.palette.accent);
      this.doc.roundedRect(x, y, box, box, 3, 3, 'F');
      this.font(box * 0.9, true, '#ffffff');
    }
    this.doc.text(text, x + box / 2, y + box / 2, { align: 'center', baseline: 'middle' });
  }
}

/** Logo quando existe e é válida; monograma da loja caso contrário. */
function drawMark(painter: Painter, header: ReceiptHeader, logo: ReceiptLogo | null | undefined, x: number, y: number, box: number): void {
  if (logo && painter.image(logo.dataUrl, logo.format, x, y, box)) return;
  painter.monogramMark(header.monogram, x, y, box);
}

function drawHeader(painter: Painter, geo: Geometry, header: ReceiptHeader, logo?: ReceiptLogo | null): void {
  const { palette } = geo;
  const box = geo.logoSize;

  if (geo.stackedHeader) {
    // Bobina: marca centralizada, tudo empilhado — 72mm não comportam colunas.
    const markX = geo.pageWidth / 2 - box / 2;
    drawMark(painter, header, logo, markX, painter.cursor, box);
    painter.cursor += box + 3;

    painter.text(header.businessName.toUpperCase(), { size: geo.body * 1.35, bold: true, align: 'center' });
    for (const line of header.businessLines) {
      painter.text(line, { size: geo.body * 0.9, color: palette.muted, align: 'center' });
    }
    painter.space(2);
    painter.hairline();
    painter.space(2.5);
    painter.text(header.documentLabel.toUpperCase(), { size: geo.body * 0.95, bold: true, align: 'center' });
    painter.text(`${header.documentNumber} · ${header.documentDate}`, {
      size: geo.body * 0.9,
      color: palette.muted,
      align: 'center'
    });
    painter.space(2);
    painter.hairline();
    painter.space(1);
    return;
  }

  // A4: marca à esquerda, identificação do documento à direita. Alinhar à
  // esquerda dá um ponto de entrada para a leitura — centralizar tudo não dá.
  const top = painter.cursor;
  drawMark(painter, header, logo, painter.left, top, box);

  const textX = painter.left + box + 5;
  const textWidth = painter.contentWidth * 0.55 - box;
  painter.cursor = top + 1;
  painter.text(header.businessName, { size: geo.body * 1.5, bold: true, x: textX, maxWidth: textWidth });
  for (const line of header.businessLines) {
    painter.text(line, { size: geo.body * 0.82, color: palette.muted, x: textX, maxWidth: textWidth });
  }
  const leftBottom = painter.cursor;

  painter.cursor = top + 1;
  painter.text(header.documentLabel.toUpperCase(), { size: geo.body * 0.78, bold: true, color: palette.accent, align: 'right' });
  painter.text(header.documentNumber, { size: geo.body * 1.9, bold: true, align: 'right' });
  painter.text(header.documentDate, { size: geo.body * 0.82, color: palette.muted, align: 'right' });

  painter.cursor = Math.max(leftBottom, painter.cursor, top + box) + 5;
  painter.hairline();
  painter.space(2);
}

function drawBlocks(painter: Painter, geo: Geometry, blocks: ReceiptBlock[]): void {
  const { palette } = geo;
  const toneColor = (tone?: ReceiptTone) =>
    tone === 'muted' ? palette.muted : tone === 'strong' ? palette.ink : palette.body;

  for (const block of blocks) {
    switch (block.kind) {
      case 'space':
        painter.space(block.mm);
        break;

      case 'section':
        painter.space(geo.lineHeight * 0.9);
        painter.ensureSpace(geo.lineHeight * 2.4);
        painter.text(block.label.toUpperCase(), {
          size: geo.body * 0.76,
          bold: true,
          // Posição + peso + fio já tornam a seção escaneável; cor aqui só
          // competiria com o total, que é o que precisa saltar.
          color: geo.monochrome ? palette.ink : palette.muted
        });
        painter.space(1);
        painter.hairline();
        painter.space(1.6);
        break;

      case 'fields': {
        if (geo.stackedHeader) {
          // Bobina: 72mm não comportam colunas, então empilha.
          painter.space(1);
          for (const entry of block.entries) {
            painter.ensureSpace(geo.lineHeight * 1.6);
            painter.text(entry.label.toUpperCase(), { size: geo.body * 0.72, color: palette.muted });
            painter.text(entry.value, { size: geo.body, bold: true });
            painter.space(1.2);
          }
          break;
        }

        // A4: um painel só, em colunas. Agrupar por proximidade custa metade da
        // altura da lista empilhada e lê-se de uma varrida.
        const inset = 4;
        const columnWidth = (painter.contentWidth - inset * 2) / block.entries.length;
        // Goteira entre colunas: sem ela um nome longo encosta no campo vizinho
        // e os dois viram um bloco de texto só.
        const valueWidth = columnWidth - 6;
        const valueLines = Math.max(
          ...block.entries.map((entry) => painter.measureLines(entry.value, geo.body, valueWidth))
        );
        const height = geo.lineHeight * (2.4 + valueLines);

        painter.space(1);
        painter.panel(height, palette.panel);
        const top = painter.cursor;
        block.entries.forEach((entry, index) => {
          const x = painter.left + inset + columnWidth * index;
          painter.cursor = top + geo.lineHeight * 0.5;
          painter.text(entry.label.toUpperCase(), {
            size: geo.body * 0.7,
            color: palette.muted,
            x,
            maxWidth: valueWidth
          });
          painter.text(entry.value, { size: geo.body, bold: true, x, maxWidth: valueWidth });
        });
        painter.cursor = top + height;
        break;
      }

      case 'item':
        painter.space(1.4);
        painter.ensureSpace(geo.lineHeight * (2 + block.details.length));
        painter.pair(block.title, block.price, { size: geo.body * 1.05, bold: true, labelColor: palette.ink });
        for (const detail of block.details) {
          painter.text(detail, { size: geo.body * 0.84, color: palette.muted });
        }
        painter.space(1.2);
        break;

      case 'row':
        painter.pair(block.left, block.right, {
          labelColor: toneColor(block.tone),
          valueColor: block.tone === 'muted' ? palette.body : palette.ink
        });
        break;

      case 'total': {
        const height = geo.lineHeight * 3.2;
        painter.space(2);
        painter.panel(height, palette.accentSoft);
        const top = painter.cursor;
        painter.cursor = top + geo.lineHeight * 0.9;
        painter.text(block.label.toUpperCase(), {
          size: geo.body * 0.78,
          bold: true,
          color: geo.monochrome ? palette.ink : palette.accentStrong,
          x: painter.left + (geo.monochrome ? 0 : 4)
        });
        painter.cursor = top + geo.lineHeight * 0.6;
        painter.text(block.value, {
          size: geo.body * 1.75,
          bold: true,
          color: geo.monochrome ? palette.ink : palette.accentStrong,
          align: 'right',
          x: painter.right - (geo.monochrome ? 0 : 4)
        });
        painter.cursor = top + height;
        painter.space(2);
        break;
      }

      case 'alert': {
        const height = geo.lineHeight * (block.note ? 3.4 : 2.6);
        painter.space(2);
        painter.panel(height, palette.alertSoft, palette.alertInk);
        const top = painter.cursor;
        painter.cursor = top + geo.lineHeight * 0.6;
        const inset = geo.monochrome ? 0 : 4;
        painter.text(block.label.toUpperCase(), { size: geo.body * 0.78, bold: true, color: palette.alertInk, x: painter.left + inset });
        painter.cursor = top + geo.lineHeight * 0.35;
        painter.text(block.value, { size: geo.body * 1.3, bold: true, color: palette.alertInk, align: 'right', x: painter.right - inset });
        if (block.note) {
          painter.text(block.note, { size: geo.body * 0.8, color: palette.alertInk, x: painter.left + inset });
        }
        painter.cursor = top + height;
        painter.space(2);
        break;
      }

      case 'text':
        painter.text(block.text, { size: geo.body * 0.88, color: toneColor(block.tone), align: block.align ?? 'left' });
        break;
    }
  }
}

function renderReceipt(
  doc: jsPDF,
  geo: Geometry,
  data: ThermalReceiptData,
  pageHeight: number | null,
  options: BuildReceiptPdfOptions
): number {
  const painter = new Painter(doc, geo, pageHeight);

  if (!geo.monochrome) {
    // Faixa de marca sangrando na borda superior — identidade antes do conteúdo.
    doc.setFillColor(geo.palette.accent);
    doc.rect(0, 0, geo.pageWidth, BRAND_BAR_HEIGHT_MM, 'F');
    painter.cursor = geo.margin;
  }

  const header = composeSaleReceiptHeader(data);

  if (pageHeight != null) {
    // Folha 2 em diante precisa se identificar sozinha: quem recebe uma página
    // solta tem que saber de que comprovante ela é.
    painter.onNewPage = (continuation) => {
      continuation.text(`${header.documentLabel} ${header.documentNumber} · ${header.businessName}`, {
        size: geo.body * 0.74,
        color: geo.palette.muted
      });
      continuation.space(1);
      continuation.hairline();
      continuation.space(3);
    };
  }

  drawHeader(painter, geo, header, options.logo);
  drawBlocks(painter, geo, composeSaleReceipt(data));

  if (!geo.monochrome) {
    // Fecha o documento: sem isto o conteúdo termina no ar no meio da folha.
    painter.space(3);
    painter.hairline();
    painter.space(1);
    painter.text([header.businessName, data.businessCnpj && `CNPJ: ${data.businessCnpj}`].filter(Boolean).join(' · '), {
      size: geo.body * 0.74,
      color: palette(geo).muted,
      align: 'center'
    });
    painter.text('Documento gerado eletronicamente pelo iPhoneRepasse Pro.', {
      size: geo.body * 0.74,
      color: palette(geo).muted,
      align: 'center'
    });
  }

  return painter.cursor + geo.margin;
}

const palette = (geo: Geometry): Palette => geo.palette;

/** Numera as folhas do A4 — um comprovante de 2 páginas precisa se anunciar. */
function stampPageNumbers(doc: jsPDF, geo: Geometry): void {
  const total = doc.getNumberOfPages();
  if (total < 2) return;
  for (let page = 1; page <= total; page += 1) {
    doc.setPage(page);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(geo.body * 0.78);
    doc.setTextColor(geo.palette.muted);
    doc.text(`Página ${page} de ${total}`, geo.pageWidth - geo.margin, A4_HEIGHT_MM - geo.margin / 2, {
      align: 'right',
      baseline: 'alphabetic'
    });
  }
}

/**
 * Gera o PDF do comprovante. Síncrono de propósito: chamado direto do handler
 * do clique, preserva a *user activation* que o Safari exige para compartilhar
 * ou imprimir — o `setTimeout` do motor antigo quebrava justamente essa cadeia.
 */
export function buildSaleReceiptPdf(
  data: ThermalReceiptData,
  layout: ReceiptPrintLayout,
  options: BuildReceiptPdfOptions = {}
): jsPDF {
  const geo = GEOMETRY[layout];

  if (layout === 'a4') {
    const doc = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait', compress: true });
    renderReceipt(doc, geo, data, A4_HEIGHT_MM, options);
    stampPageNumbers(doc, geo);
    return doc;
  }

  // Bobina contínua: mede numa página folgada e recria com a altura exata, para
  // a impressora térmica não avançar papel em branco no fim do cupom.
  const probe = new jsPDF({ unit: 'mm', format: [geo.pageWidth, ROLL_MEASURE_HEIGHT_MM] });
  const measuredHeight = renderReceipt(probe, geo, data, null, options);
  const height = Math.max(Math.ceil(measuredHeight), ROLL_MIN_HEIGHT_MM);

  const doc = new jsPDF({ unit: 'mm', format: [geo.pageWidth, height], compress: true });
  renderReceipt(doc, geo, data, null, options);
  return doc;
}

export function receiptPdfFileName(data: ThermalReceiptData): string {
  return `comprovante-${getReceiptSaleCode(data)}.pdf`;
}
