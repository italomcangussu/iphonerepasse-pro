/**
 * Motor legado de impressão (`@media print` + `body[data-print-layout]`),
 * mantido apenas como rede de segurança caso a geração do PDF falhe.
 *
 * Correções em relação à versão anterior:
 *
 * 1. `window.print()` é chamado **de forma síncrona**, dentro do gesto do
 *    usuário. O `setTimeout` anterior quebrava a *user activation* e o Safari
 *    podia simplesmente ignorar a chamada.
 * 2. A preparação **não é mais desfeita em `afterprint`**. No WebKit
 *    `window.print()` não bloqueia — o `afterprint` dispara antes de a página
 *    ser rasterizada, e limpar ali fazia o recibo voltar a ficar oculto no
 *    exato momento em que a folha era desenhada (o app inteiro saía impresso no
 *    lugar do comprovante). A limpeza agora acontece ao sair da tela.
 * 3. Um único módulo para PDV e PDVHistory: antes eram duas implementações com
 *    constantes divergentes, e a mesma venda saía diferente conforme a tela.
 */

import type { ReceiptPrintLayout } from './receiptPdf';

export const PRINT_PAGE_STYLE_ID = 'receipt-print-page-style';
export const PRINT_LAYOUT_ATTRIBUTE = 'data-print-layout';

const A4_PRINT_MARGIN = '6mm';
const A4_PRINT_SCALE = 0.74;

export function applyReceiptPrintLayout(layout: ReceiptPrintLayout): void {
  if (typeof document === 'undefined') return;

  document.getElementById(PRINT_PAGE_STYLE_ID)?.remove();

  const pageStyle = document.createElement('style');
  pageStyle.id = PRINT_PAGE_STYLE_ID;
  pageStyle.media = 'print';
  pageStyle.textContent =
    layout === '80mm'
      ? '@page { size: 80mm auto; margin: 0; }'
      : `:root { --pdv-a4-print-scale: ${A4_PRINT_SCALE}; } @page { size: A4 portrait; margin: ${A4_PRINT_MARGIN}; }`;
  document.head.appendChild(pageStyle);
  document.body.setAttribute(PRINT_LAYOUT_ATTRIBUTE, layout);
}

export function clearReceiptPrintLayout(): void {
  if (typeof document === 'undefined') return;
  document.getElementById(PRINT_PAGE_STYLE_ID)?.remove();
  document.body.removeAttribute(PRINT_LAYOUT_ATTRIBUTE);
}

/** Prepara e imprime na mesma tarefa, preservando o gesto do usuário. */
export function printReceiptViaDom(layout: ReceiptPrintLayout): void {
  applyReceiptPrintLayout(layout);
  window.print();
}
