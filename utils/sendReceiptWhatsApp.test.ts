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
      elementId: 'history-receipt-a4'
    });

    expect(generateReceiptPdfBase64Mock).toHaveBeenCalledWith('history-receipt-a4');
    expect(invokeMock).toHaveBeenCalledWith('send-receipt-whatsapp', {
      body: {
        phone: '5585999990000',
        pdfBase64: 'data:application/pdf;base64,PDF',
        storeId: 'store-1',
        saleId: 'sale-1'
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
});
