/**
 * Documento do orçamento em HTML autocontido (CSS embutido, sem rede), pronto
 * para abrir, baixar, compartilhar e imprimir/salvar em PDF.
 *
 * As cores e a tipografia seguem os tokens do design system (`--ds-*`).
 * O documento é sempre claro: é papel, não tela do app.
 */
import type { BusinessProfile } from '../../../types';
import { formatCnpj, formatCurrencyBRL, formatPhone } from '../../../utils/inputMasks';
import type { CardChargeBreakdown } from '../../../utils/cardFees';
import {
  formatQuoteNumber,
  itemLineTotal,
  longestInstallment,
  type QuoteCardBrand,
  type QuoteItem,
  type QuotePaymentBreakdown,
  type QuotePresentation,
  type QuoteTotals,
} from './quoteModel';

export interface QuoteDocumentData {
  quoteNumber: number;
  createdAt: Date;
  expiresAt: Date;
  validityDays: number;
  business: Pick<BusinessProfile, 'name' | 'cnpj' | 'phone' | 'email' | 'address' | 'instagram'>;
  logoDataUrl?: string | null;
  customerName?: string | null;
  customerPhone?: string | null;
  sellerName?: string | null;
  items: QuoteItem[];
  presentation: QuotePresentation;
  cardBrand: QuoteCardBrand;
  totals: QuoteTotals;
  notes?: string | null;
}

const TIME_ZONE = 'America/Sao_Paulo';

const escapeHtml = (value: string) =>
  value.replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char] ?? char);

const money = (value: number) => escapeHtml(formatCurrencyBRL(value));

const formatDate = (date: Date) =>
  new Intl.DateTimeFormat('pt-BR', { timeZone: TIME_ZONE, weekday: 'short', day: '2-digit', month: '2-digit', year: 'numeric' }).format(date);

const formatTime = (date: Date) =>
  new Intl.DateTimeFormat('pt-BR', { timeZone: TIME_ZONE, hour: '2-digit', minute: '2-digit' }).format(date);

const formatDateTime = (date: Date) => `${formatDate(date)} às ${formatTime(date)}`;

const brandLabel = (brand: QuoteCardBrand) => (brand === 'visa_master' ? 'Visa / Mastercard' : 'Elo, Amex e outras');

const daysLabel = (days: number) => (days === 1 ? '1 dia' : `${days} dias`);

const initialsOf = (name: string) =>
  name.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]?.toUpperCase() ?? '').join('') || 'IR';

const renderLogo = (data: QuoteDocumentData) =>
  data.logoDataUrl
    ? `<img class="logo" src="${escapeHtml(data.logoDataUrl)}" alt="${escapeHtml(data.business.name)}" />`
    : `<div class="logo logo--mono" aria-hidden="true">${escapeHtml(initialsOf(data.business.name))}</div>`;

const renderBusinessLines = (business: QuoteDocumentData['business']) => {
  const lines = [
    business.cnpj ? `CNPJ ${formatCnpj(business.cnpj)}` : '',
    [business.phone ? formatPhone(business.phone) : '', business.instagram ? `@${business.instagram.replace(/^@/, '')}` : '']
      .filter(Boolean)
      .join(' · '),
    business.address,
  ].filter(Boolean);
  return lines.map((line) => `<p>${escapeHtml(line)}</p>`).join('');
};

const renderHeader = (data: QuoteDocumentData) => `
  <header class="head">
    <div class="brand">
      ${renderLogo(data)}
      <div>
        <h1>${escapeHtml(data.business.name || 'iPhoneRepasse')}</h1>
        ${renderBusinessLines(data.business)}
      </div>
    </div>
    <div class="meta">
      <span class="kicker">Orçamento</span>
      <strong class="number">${formatQuoteNumber(data.quoteNumber)}</strong>
      <p>Emitido ${escapeHtml(formatDateTime(data.createdAt))}</p>
    </div>
  </header>`;

const renderValidity = (data: QuoteDocumentData) => `
  <section class="validity" aria-label="Validade">
    <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" stroke-width="2"/><path d="M12 7v5l3 2" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>
    <p><strong>Válido até ${escapeHtml(formatDateTime(data.expiresAt))}</strong><span> · ${daysLabel(data.validityDays)} de validade</span></p>
  </section>`;

const renderParties = (data: QuoteDocumentData) => {
  const customer = data.customerName?.trim();
  const phone = data.customerPhone?.trim();
  const seller = data.sellerName?.trim();
  if (!customer && !phone && !seller) return '';
  const customerBlock = customer || phone
    ? `<div><span class="label">Preparado para</span><p class="strong">${escapeHtml(customer || 'Cliente')}</p>${phone ? `<p>${escapeHtml(formatPhone(phone))}</p>` : ''}</div>`
    : '';
  const sellerBlock = seller ? `<div><span class="label">Atendimento</span><p class="strong">${escapeHtml(seller)}</p></div>` : '';
  return `<section class="parties">${customerBlock}${sellerBlock}</section>`;
};

const renderInstallmentHint = (payment: QuotePaymentBreakdown) => {
  const longest = longestInstallment(payment);
  if (!longest) return '<p class="hint">Pagamento à vista (Pix ou dinheiro)</p>';
  return `<p class="hint">ou até <strong>${longest.installments}x de ${money(longest.installmentAmount)}</strong> no cartão</p>`;
};

const renderHero = (data: QuoteDocumentData) => {
  if (data.presentation === 'compare') {
    return `<section class="hero hero--compare"><span class="label">${data.items.length} opções para você escolher</span><p class="hint">Cada opção abaixo tem o preço à vista e as condições no cartão.</p></section>`;
  }
  const savings = data.totals.discount > 0 ? `<span class="pill pill--success">Desconto de ${money(data.totals.discount)} aplicado</span>` : '';
  return `
  <section class="hero">
    <div>
      <span class="label">Total à vista</span>
      <p class="hero-value">${money(data.totals.total)}</p>
      ${renderInstallmentHint(data.totals.payment)}
    </div>
    ${savings}
  </section>`;
};

const renderItemDetails = (item: QuoteItem) => {
  const chips = item.details.map((detail) => `<span class="chip">${escapeHtml(detail)}</span>`).join('');
  const lead = item.leadTime?.trim() ? `<span class="chip chip--info">Entrega: ${escapeHtml(item.leadTime.trim())}</span>` : '';
  return chips || lead ? `<div class="chips">${chips}${lead}</div>` : '';
};

const renderItemRow = (item: QuoteItem) => `
  <tr>
    <td><p class="strong">${escapeHtml(item.name)}</p><p class="mobile-only muted">${item.quantity} × ${money(item.unitPrice)}</p>${renderItemDetails(item)}</td>
    <td class="num desktop-only">${item.quantity}</td>
    <td class="num desktop-only">${money(item.unitPrice)}</td>
    <td class="num strong">${money(itemLineTotal(item))}</td>
  </tr>`;

const renderSumItems = (data: QuoteDocumentData) => {
  const discountRow = data.totals.discount > 0
    ? `<tr class="foot"><td class="foot-label">Desconto</td><td class="desktop-only"></td><td class="desktop-only"></td><td class="num success">− ${money(data.totals.discount)}</td></tr>`
    : '';
  return `
  <section class="block">
    <h2>Produtos</h2>
    <table class="items">
      <thead><tr><th>Produto</th><th class="num desktop-only">Qtd.</th><th class="num desktop-only">Unitário</th><th class="num">Total</th></tr></thead>
      <tbody>${data.items.map(renderItemRow).join('')}</tbody>
      <tfoot>
        <tr class="foot"><td class="foot-label">Subtotal</td><td class="desktop-only"></td><td class="desktop-only"></td><td class="num">${money(data.totals.subtotal)}</td></tr>
        ${discountRow}
        <tr class="foot foot--total"><td class="foot-label">Total à vista</td><td class="desktop-only"></td><td class="desktop-only"></td><td class="num">${money(data.totals.total)}</td></tr>
      </tfoot>
    </table>
  </section>`;
};

const renderCardRow = (row: CardChargeBreakdown, label: string) => `
  <tr><td>${label}</td><td class="num strong">${money(row.installmentAmount)}</td><td class="num muted">${money(row.customerAmount)}</td></tr>`;

const renderPaymentTable = (payment: QuotePaymentBreakdown) => {
  const debit = payment.debit ? renderCardRow(payment.debit, 'Débito') : '';
  const rows = payment.installments
    .map((row) => renderCardRow(row, row.installments === 1 ? 'Crédito 1x' : `Crédito ${row.installments}x`))
    .join('');
  return `
    <table class="pay">
      <thead><tr><th>Forma</th><th class="num">Parcela</th><th class="num">Total</th></tr></thead>
      <tbody>
        <tr class="best"><td>À vista · Pix ou dinheiro <span class="pill pill--success">Melhor preço</span></td><td class="num strong">${money(payment.cash)}</td><td class="num">${money(payment.cash)}</td></tr>
        ${debit}${rows}
      </tbody>
    </table>`;
};

const renderSumPayment = (data: QuoteDocumentData) => `
  <section class="block">
    <h2>Formas de pagamento</h2>
    ${renderPaymentTable(data.totals.payment)}
    ${data.totals.payment.installments.length ? `<p class="footnote">Cartão ${escapeHtml(brandLabel(data.cardBrand))}. Valores no cartão já incluem as taxas da operadora.</p>` : ''}
  </section>`;

const renderCompareOption = (item: QuoteItem, payment: QuotePaymentBreakdown, index: number) => `
  <article class="option">
    <div class="option-head">
      <span class="option-index">${index + 1}</span>
      <div><p class="strong">${escapeHtml(item.name)}${item.quantity > 1 ? ` · ${item.quantity} un.` : ''}</p>${renderItemDetails(item)}</div>
      <div class="option-price"><span class="label">À vista</span><p class="option-value">${money(payment.cash)}</p>${renderInstallmentHint(payment)}</div>
    </div>
    ${payment.installments.length || payment.debit ? renderPaymentTable(payment) : ''}
  </article>`;

const renderCompare = (data: QuoteDocumentData) => `
  <section class="block">
    <h2>Opções</h2>
    ${data.items.map((item, index) => renderCompareOption(item, data.totals.itemPayments[index], index)).join('')}
    ${data.totals.payment.installments.length ? `<p class="footnote">Cartão ${escapeHtml(brandLabel(data.cardBrand))}. Valores no cartão já incluem as taxas da operadora.</p>` : ''}
  </section>`;

const renderNotes = (notes?: string | null) =>
  notes?.trim()
    ? `<section class="block"><h2>Observações</h2><p class="notes">${escapeHtml(notes.trim()).replace(/\n/g, '<br />')}</p></section>`
    : '';

const renderFooter = (data: QuoteDocumentData) => `
  <footer class="foot-note">
    <p>Orçamento sem reserva do produto: a disponibilidade e os valores valem até ${escapeHtml(formatDateTime(data.expiresAt))}.</p>
    <p>${escapeHtml(data.business.name || 'iPhoneRepasse')} · ${formatQuoteNumber(data.quoteNumber)}</p>
  </footer>`;

const STYLES = `
  :root { --primary:#2563eb; --primary-strong:#1d4ed8; --primary-soft:#eff6ff; --accent:#f97316; --accent-soft:#fff7ed; --accent-strong:#c2410c;
    --success:#16a34a; --success-soft:#f0fdf4; --text:#0f172a; --text-2:#334155; --muted:#64748b; --bg:#f1f5f9; --surface:#ffffff;
    --border:rgba(15,23,42,.10); --shadow:0 1px 2px rgba(15,23,42,.06), 0 12px 32px rgba(15,23,42,.08); }
  * { box-sizing:border-box; }
  html { -webkit-text-size-adjust:100%; }
  body { margin:0; background:var(--bg); color:var(--text); font:15px/1.55 -apple-system,BlinkMacSystemFont,"SF Pro Text","Manrope",system-ui,sans-serif;
    font-variant-numeric:tabular-nums; -webkit-print-color-adjust:exact; print-color-adjust:exact; }
  .page { max-width:820px; margin:24px auto; background:var(--surface); border-radius:24px; box-shadow:var(--shadow); padding:40px; }
  p { margin:0; } h1,h2 { margin:0; }
  .head { display:flex; justify-content:space-between; gap:24px; align-items:flex-start; padding-bottom:24px; border-bottom:1px solid var(--border); }
  .brand { display:flex; gap:16px; align-items:center; min-width:0; }
  .brand h1 { font-size:20px; line-height:1.2; font-weight:700; letter-spacing:-.01em; margin-bottom:4px; }
  .brand p { color:var(--muted); font-size:13px; line-height:1.45; }
  .logo { width:64px; height:64px; border-radius:16px; object-fit:contain; flex-shrink:0; background:var(--bg); }
  .logo--mono { display:grid; place-items:center; color:#fff; font-weight:700; font-size:22px; background:linear-gradient(135deg,var(--primary),var(--primary-strong)); }
  .meta { text-align:right; flex-shrink:0; }
  .kicker, .label { display:block; font-size:11px; font-weight:600; letter-spacing:.14em; text-transform:uppercase; color:var(--muted); }
  .number { display:block; font-size:22px; font-weight:700; letter-spacing:-.01em; margin:2px 0 4px; }
  .meta p { color:var(--muted); font-size:13px; }
  .validity { display:flex; gap:10px; align-items:center; margin-top:20px; padding:12px 16px; border-radius:14px; background:var(--accent-soft); color:var(--accent-strong); }
  .validity p { font-size:14px; } .validity span { color:var(--text-2); }
  .parties { display:grid; grid-template-columns:repeat(auto-fit,minmax(200px,1fr)); gap:16px; margin-top:24px; }
  .parties p { font-size:14px; color:var(--text-2); }
  .strong { font-weight:600; color:var(--text); }
  .hero { display:flex; justify-content:space-between; align-items:flex-end; gap:16px; margin-top:24px; padding:24px; border-radius:20px;
    background:linear-gradient(135deg,var(--primary-soft),#fff); border:1px solid rgba(37,99,235,.14); }
  .hero-value { font-size:40px; line-height:1.1; font-weight:700; letter-spacing:-.02em; margin:6px 0; }
  .hint { color:var(--text-2); font-size:15px; } .hint strong { color:var(--primary-strong); }
  .hero--compare { display:block; }
  .block { margin-top:32px; }
  .block h2 { font-size:13px; font-weight:600; letter-spacing:.14em; text-transform:uppercase; color:var(--muted); margin-bottom:12px; }
  table { width:100%; border-collapse:collapse; }
  th { text-align:left; font-size:12px; font-weight:600; color:var(--muted); padding:0 12px 8px; border-bottom:1px solid var(--border); }
  td { padding:14px 12px; border-bottom:1px solid var(--border); vertical-align:top; font-size:14px; }
  th:first-child, td:first-child { padding-left:0; } th:last-child, td:last-child { padding-right:0; }
  .num { text-align:right; white-space:nowrap; }
  .muted { color:var(--muted); } .success { color:var(--success); }
  .foot td { border-bottom:0; padding-top:8px; padding-bottom:4px; color:var(--text-2); }
  .foot td:first-child { text-align:right; }
  .foot .foot-label { text-align:right; }
  .foot--total td { font-size:17px; font-weight:700; color:var(--text); padding-top:12px; }
  .chips { display:flex; flex-wrap:wrap; gap:6px; margin-top:6px; }
  .mobile-only { display:none; font-size:13px; margin-top:2px; }
  .chip { white-space:nowrap; font-size:12px; line-height:1; padding:6px 8px; border-radius:999px; background:var(--bg); color:var(--text-2); }
  .chip--info { background:var(--primary-soft); color:var(--primary-strong); }
  .pill { display:inline-block; font-size:11px; font-weight:600; padding:4px 8px; border-radius:999px; margin-left:6px; vertical-align:1px; }
  .pill--success { background:var(--success-soft); color:var(--success); }
  .hero .pill { margin:0; white-space:nowrap; }
  .best td { background:var(--success-soft); }
  .best td:first-child { padding-left:12px; border-radius:12px 0 0 12px; } .best td:last-child { padding-right:12px; border-radius:0 12px 12px 0; }
  .pay td { padding-top:10px; padding-bottom:10px; }
  .footnote { margin-top:10px; font-size:12px; color:var(--muted); }
  .option { border:1px solid var(--border); border-radius:18px; padding:20px; margin-bottom:12px; break-inside:avoid; }
  .option-head { display:grid; grid-template-columns:auto 1fr auto; gap:14px; align-items:start; }
  .option-head + .pay { margin-top:16px; }
  .option-index { display:grid; place-items:center; width:28px; height:28px; border-radius:999px; background:var(--primary-soft); color:var(--primary-strong); font-weight:700; font-size:13px; }
  .option-price { text-align:right; } .option-value { font-size:24px; font-weight:700; letter-spacing:-.01em; margin:2px 0; }
  .option-price .hint { font-size:13px; }
  .notes { color:var(--text-2); font-size:14px; white-space:normal; }
  .foot-note { margin-top:40px; padding-top:20px; border-top:1px solid var(--border); display:flex; justify-content:space-between; gap:16px; flex-wrap:wrap; }
  .foot-note p { font-size:12px; color:var(--muted); }
  @media (max-width:640px) {
    .page { margin:0; border-radius:0; padding:24px 16px; box-shadow:none; }
    .head { flex-direction:column; } .meta { text-align:left; }
    .hero { flex-direction:column; align-items:flex-start; } .hero-value { font-size:32px; }
    .option-head { grid-template-columns:auto 1fr; } .option-price { grid-column:1 / -1; text-align:left; }
    th, td { padding-left:6px; padding-right:6px; }
    .desktop-only { display:none; } .mobile-only { display:block; }
    .foot-label { text-align:left !important; }
  }
  @page { size:A4; margin:12mm; }
  @media print { body { background:#fff; } .page { margin:0; max-width:none; box-shadow:none; border-radius:0; padding:0; } .block, .hero { break-inside:avoid; } }
`;

export const buildQuoteDocumentHtml = (data: QuoteDocumentData) => {
  const body = data.presentation === 'compare' ? renderCompare(data) : `${renderSumItems(data)}${renderSumPayment(data)}`;
  return `<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${formatQuoteNumber(data.quoteNumber)} · ${escapeHtml(data.business.name || 'Orçamento')}</title>
<style>${STYLES}</style>
</head>
<body>
<main class="page">
${renderHeader(data)}
${renderValidity(data)}
${renderParties(data)}
${renderHero(data)}
${body}
${renderNotes(data.notes)}
${renderFooter(data)}
</main>
</body>
</html>`;
};

export const quoteDocumentFileName = (quoteNumber: number) => `orcamento-${formatQuoteNumber(quoteNumber).toLowerCase()}.html`;
