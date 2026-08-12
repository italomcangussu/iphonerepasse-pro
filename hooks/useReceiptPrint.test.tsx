import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useReceiptPrint } from './useReceiptPrint';
import type { ThermalReceiptData } from '../utils/thermalPrinter';

const { deliverReceiptPdfMock } = vi.hoisted(() => ({
  deliverReceiptPdfMock: vi.fn(async (_pdf: unknown, _options: { fileName: string; title?: string }) => 'print' as const)
}));

vi.mock('../utils/deliverReceiptPdf', () => ({
  deliverReceiptPdf: deliverReceiptPdfMock
}));

const receipt: ThermalReceiptData = {
  saleId: 'sale-000042',
  saleNumber: 42,
  saleDate: '2026-08-12T16:00:00.000Z',
  businessName: 'iPhoneRepasse',
  customerName: 'Maria Silva',
  sellerName: 'João Vendedor',
  items: [{ model: 'iPhone 15', capacity: '128GB', color: 'Preto', imei: '1', sellPrice: 5000 }],
  tradeIns: [],
  tradeInSubtotal: 0,
  payments: [{ label: 'Pix', customerAmount: 5000, storeAmount: 5000 }],
  negotiatedSubtotal: 5000,
  discountAmount: 0,
  discountLabel: 'Desconto',
  saleGrossTotal: 5000,
  cardFeeTotal: 0,
  totalCustomerWithTradeIn: 5000,
  saleNetTotal: 5000,
  warrantyLine: null
};

const printMock = vi.fn();

beforeEach(() => {
  deliverReceiptPdfMock.mockClear();
  printMock.mockClear();
  Object.defineProperty(window, 'print', { configurable: true, value: printMock });
});

afterEach(() => {
  document.body.removeAttribute('data-print-layout');
  document.getElementById('receipt-print-page-style')?.remove();
});

describe('useReceiptPrint — impressão iniciada pelo usuário', () => {
  it('prepara o comprovante no beforeprint quando armado (⌘P / Compartilhar → Imprimir)', () => {
    renderHook(() => useReceiptPrint({ armManualPrint: true, layout: 'a4' }));

    act(() => {
      window.dispatchEvent(new Event('beforeprint'));
    });

    expect(document.body).toHaveAttribute('data-print-layout', 'a4');
    expect(document.getElementById('receipt-print-page-style')).toHaveTextContent('size: A4 portrait');
  });

  it('não interfere na impressão da página quando não há comprovante em tela', () => {
    renderHook(() => useReceiptPrint({ armManualPrint: false, layout: 'a4' }));

    act(() => {
      window.dispatchEvent(new Event('beforeprint'));
    });

    expect(document.body).not.toHaveAttribute('data-print-layout');
  });

  it('mantém o comprovante preparado durante o afterprint', () => {
    // Este é o bug de origem: o motor antigo limpava tudo no `afterprint`, que no
    // WebKit dispara ANTES de a página ser rasterizada — o iPhone acabava
    // imprimindo o menu do app no lugar do recibo.
    renderHook(() => useReceiptPrint({ armManualPrint: true, layout: '80mm' }));

    act(() => {
      window.dispatchEvent(new Event('beforeprint'));
      window.dispatchEvent(new Event('afterprint'));
    });

    expect(document.body).toHaveAttribute('data-print-layout', '80mm');
    expect(document.getElementById('receipt-print-page-style')).toBeTruthy();
  });

  it('limpa a preparação ao sair da tela', () => {
    const { unmount } = renderHook(() => useReceiptPrint({ armManualPrint: true, layout: 'a4' }));

    act(() => {
      window.dispatchEvent(new Event('beforeprint'));
    });
    expect(document.body).toHaveAttribute('data-print-layout', 'a4');

    unmount();

    expect(document.body).not.toHaveAttribute('data-print-layout');
    expect(document.getElementById('receipt-print-page-style')).toBeNull();
  });
});

describe('useReceiptPrint — botão Imprimir', () => {
  it('gera o PDF e o entrega, sem imprimir o documento do app', async () => {
    const { result } = renderHook(() => useReceiptPrint());

    let mode: string | undefined;
    await act(async () => {
      mode = await result.current.printReceipt(receipt, 'a4');
    });

    expect(mode).toBe('print');
    expect(deliverReceiptPdfMock).toHaveBeenCalledTimes(1);
    expect(printMock).not.toHaveBeenCalled();
    const [, options] = deliverReceiptPdfMock.mock.calls[0];
    expect(options.fileName).toBe('comprovante-42.pdf');
    expect(options.title).toBe('Comprovante #42');
  });

  it('cai para o motor DOM corrigido se a entrega do PDF falhar', async () => {
    deliverReceiptPdfMock.mockRejectedValueOnce(new Error('sem suporte'));
    const { result } = renderHook(() => useReceiptPrint());

    let mode: string | undefined;
    await act(async () => {
      mode = await result.current.printReceipt(receipt, '80mm');
    });

    expect(mode).toBe('dom');
    // O recibo precisa estar revelado ANTES de imprimir, e a chamada acontece na
    // mesma tarefa — sem `setTimeout` quebrando o gesto do usuário.
    expect(document.body).toHaveAttribute('data-print-layout', '80mm');
    expect(printMock).toHaveBeenCalledTimes(1);
  });
});
