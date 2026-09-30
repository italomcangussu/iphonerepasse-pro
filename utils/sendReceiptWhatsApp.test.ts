import { beforeEach, describe, expect, it, vi } from 'vitest';
import { sendReceiptWhatsApp } from './sendReceiptWhatsApp';
import { supabase } from '../services/supabase';
import { generateReceiptPdfBase64 } from './generateReceiptPdf';

vi.mock('../services/supabase', () => ({
  supabase: {
    functions: {
      invoke: vi.fn()
    }
  }
}));

vi.mock('./generateReceiptPdf', () => ({
  generateReceiptPdfBase64: vi.fn()
}));

const invokeMock = vi.mocked(supabase.functions.invoke);
const generateReceiptPdfBase64Mock = vi.mocked(generateReceiptPdfBase64);

describe('sendReceiptWhatsApp', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    generateReceiptPdfBase64Mock.mockResolvedValue('data:application/pdf;base64,PDF');
    invokeMock.mockResolvedValue({ data: { ok: true }, error: null });
  });

  it('generates the selected receipt and sends it to the receipt WhatsApp function', async () => {
    await sendReceiptWhatsApp({
      phone: '(85) 99999-0000',
      storeId: 'store-1',
      saleId: 'sale-1',
      sellerName: 'Vendedor Teste',
      saleNumber: 42,
      elementId: 'history-receipt-a4'
    });

    expect(generateReceiptPdfBase64Mock).toHaveBeenCalledWith('history-receipt-a4');
    expect(invokeMock).toHaveBeenCalledWith('send-receipt-whatsapp', {
      body: {
        phone: '5585999990000',
        pdfBase64: 'data:application/pdf;base64,PDF',
        storeId: 'store-1',
        saleId: 'sale-1',
        sellerName: 'Vendedor Teste',
        saleNumber: 42
      }
    });
  });

  it('throws the function error message when sending fails', async () => {
    invokeMock.mockResolvedValue({ data: { error: 'Falha UAZ' }, error: null });

    await expect(
      sendReceiptWhatsApp({
        phone: '85999990000',
        storeId: 'store-1',
        saleId: 'sale-1'
      })
    ).rejects.toThrow('Falha UAZ');
  });

  it('surfaces the real reason of a non-2xx response instead of the generic invoke message', async () => {
    const body = {
      error:
        'uaz_send_failed:500:provider_error:{"error":"the number 5585998739775@s.whatsapp.net is not on WhatsApp"}'
    };
    invokeMock.mockResolvedValue({
      data: null,
      error: Object.assign(new Error('Edge Function returned a non-2xx status code'), {
        name: 'FunctionsHttpError',
        context: new Response(JSON.stringify(body), { status: 502 })
      })
    } as never);

    await expect(
      sendReceiptWhatsApp({
        phone: '(85) 99873-9775',
        storeId: 'store-1',
        saleId: 'sale-1'
      })
    ).rejects.toThrow('não está no WhatsApp');
  });
});
