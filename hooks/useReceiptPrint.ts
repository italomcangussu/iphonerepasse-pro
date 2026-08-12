/**
 * Ponto único de impressão do comprovante para PDV e PDVHistory.
 *
 * Gera um PDF vetorial e o entrega ao sistema (compartilhar no iOS/Android,
 * imprimir via iframe no desktop). O motor DOM/`@media print` fica só como
 * rede de segurança se a geração falhar.
 */

import { useCallback, useEffect, useRef } from 'react';
import { applyReceiptPrintLayout, clearReceiptPrintLayout, printReceiptViaDom } from '../utils/domReceiptPrint';
import { deliverReceiptPdf, type ReceiptDeliveryMode } from '../utils/deliverReceiptPdf';
import {
  buildSaleReceiptPdf,
  getReceiptSaleCode,
  receiptPdfFileName,
  type ReceiptPrintLayout
} from '../utils/receiptPdf';
import type { ThermalReceiptData } from '../utils/thermalPrinter';

export type ReceiptPrintMode = ReceiptDeliveryMode | 'dom';

export interface UseReceiptPrintOptions {
  /**
   * Enquanto verdadeiro, uma impressão iniciada pelo próprio usuário (⌘P,
   * Compartilhar → Imprimir do iOS) também rende o comprovante. Esse caminho
   * nunca executa o handler do botão, então sem um `beforeprint` armado ele
   * imprimia o menu do app.
   */
  armManualPrint?: boolean;
  /** Layout usado pela impressão manual. */
  layout?: ReceiptPrintLayout;
}

export interface ReceiptPrintHook {
  printReceipt: (data: ThermalReceiptData, layout: ReceiptPrintLayout) => Promise<ReceiptPrintMode>;
  clearPrintLayout: () => void;
}

export function useReceiptPrint(options: UseReceiptPrintOptions = {}): ReceiptPrintHook {
  const { armManualPrint = false, layout = '80mm' } = options;
  const layoutRef = useRef<ReceiptPrintLayout>(layout);
  layoutRef.current = layout;

  useEffect(() => {
    if (!armManualPrint || typeof window === 'undefined') return;
    const handleBeforePrint = () => applyReceiptPrintLayout(layoutRef.current);
    window.addEventListener('beforeprint', handleBeforePrint);
    return () => {
      window.removeEventListener('beforeprint', handleBeforePrint);
      clearReceiptPrintLayout();
    };
  }, [armManualPrint]);

  useEffect(() => clearReceiptPrintLayout, []);

  const printReceipt = useCallback(
    async (data: ThermalReceiptData, printLayout: ReceiptPrintLayout): Promise<ReceiptPrintMode> => {
      try {
        const pdf = buildSaleReceiptPdf(data, printLayout);
        return await deliverReceiptPdf(pdf, {
          fileName: receiptPdfFileName(data),
          title: `Comprovante #${getReceiptSaleCode(data)}`
        });
      } catch {
        printReceiptViaDom(printLayout);
        return 'dom';
      }
    },
    []
  );

  return { printReceipt, clearPrintLayout: clearReceiptPrintLayout };
}
