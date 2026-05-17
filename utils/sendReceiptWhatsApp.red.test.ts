/**
 * RED TESTS (TDD) — sendReceiptWhatsApp utility.
 *
 * These tests describe how the WhatsApp receipt sender should behave when
 * called with bad input, with a malformed phone number, when the PDF can't
 * be generated, when the network is flaky and when it has to surface a
 * specific server error. The current implementation passes the arguments
 * through to the edge function without validation/normalisation, so most of
 * these are expected to fail until the utility is hardened.
 *
 * Once they pass, sending a receipt by WhatsApp from PDV or PDVHistory will
 * be robust enough to fail loudly (and clearly) instead of swallowing
 * mistakes that confuse the seller.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { sendReceiptWhatsApp } from './sendReceiptWhatsApp';
import { supabase } from '../services/supabase';
import { generateReceiptPdfBase64 } from './generateReceiptPdf';

vi.mock('../services/supabase', () => ({
  supabase: { functions: { invoke: vi.fn() } }
}));

vi.mock('./generateReceiptPdf', () => ({
  generateReceiptPdfBase64: vi.fn()
}));

const invokeMock = vi.mocked(supabase.functions.invoke);
const generatePdfMock = vi.mocked(generateReceiptPdfBase64);

const VALID_PDF = 'data:application/pdf;base64,UEsDBBQA';

describe('sendReceiptWhatsApp — RED tests for input validation, normalisation and resilience', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    generatePdfMock.mockResolvedValue(VALID_PDF);
    invokeMock.mockResolvedValue({ data: { ok: true }, error: null });
  });

  // ---------- Input validation ------------------------------------------------

  it('throws a localized error and never calls the edge function when phone is empty', async () => {
    await expect(
      sendReceiptWhatsApp({ phone: '', storeId: 'store-1', saleId: 'sale-1' })
    ).rejects.toThrow(/telefone/i);
    expect(generatePdfMock).not.toHaveBeenCalled();
    expect(invokeMock).not.toHaveBeenCalled();
  });

  it('throws a localized error and never calls the edge function when storeId is empty', async () => {
    await expect(
      sendReceiptWhatsApp({ phone: '85999990000', storeId: '', saleId: 'sale-1' })
    ).rejects.toThrow(/loja/i);
    expect(invokeMock).not.toHaveBeenCalled();
  });

  it('throws a localized error and never calls the edge function when saleId is empty', async () => {
    await expect(
      sendReceiptWhatsApp({ phone: '85999990000', storeId: 'store-1', saleId: '' })
    ).rejects.toThrow(/venda/i);
    expect(invokeMock).not.toHaveBeenCalled();
  });

  // ---------- Phone normalisation --------------------------------------------

  it('normalises Brazilian phone with parens/spaces/dashes to digits only', async () => {
    await sendReceiptWhatsApp({
      phone: '(85) 99999-0000',
      storeId: 'store-1',
      saleId: 'sale-1'
    });

    expect(invokeMock).toHaveBeenCalledWith('send-receipt-whatsapp', {
      body: expect.objectContaining({ phone: '5585999990000' })
    });
  });

  it('keeps an already E.164-style phone untouched', async () => {
    await sendReceiptWhatsApp({
      phone: '+55 85 99999-0000',
      storeId: 'store-1',
      saleId: 'sale-1'
    });

    expect(invokeMock).toHaveBeenCalledWith('send-receipt-whatsapp', {
      body: expect.objectContaining({ phone: '5585999990000' })
    });
  });

  it('rejects phones that do not have at least DDD + 8 digits after normalisation', async () => {
    await expect(
      sendReceiptWhatsApp({ phone: '123', storeId: 'store-1', saleId: 'sale-1' })
    ).rejects.toThrow(/telefone/i);
    expect(invokeMock).not.toHaveBeenCalled();
  });

  // ---------- PDF generation failures -----------------------------------------

  it('surfaces a clear error when generateReceiptPdfBase64 resolves to an empty string', async () => {
    generatePdfMock.mockResolvedValue('');

    await expect(
      sendReceiptWhatsApp({ phone: '85999990000', storeId: 'store-1', saleId: 'sale-1' })
    ).rejects.toThrow(/comprovante|PDF/i);
    expect(invokeMock).not.toHaveBeenCalled();
  });

  it('surfaces a clear error when generateReceiptPdfBase64 throws', async () => {
    generatePdfMock.mockRejectedValue(new Error('canvas tainted'));

    await expect(
      sendReceiptWhatsApp({ phone: '85999990000', storeId: 'store-1', saleId: 'sale-1' })
    ).rejects.toThrow(/comprovante|PDF/i);
    expect(invokeMock).not.toHaveBeenCalled();
  });

  // ---------- Edge function failures ------------------------------------------

  it('uses the edge function error message verbatim when the response carries one', async () => {
    invokeMock.mockResolvedValue({ data: null, error: { message: 'Canal indisponível' } as any });

    await expect(
      sendReceiptWhatsApp({ phone: '85999990000', storeId: 'store-1', saleId: 'sale-1' })
    ).rejects.toThrow('Canal indisponível');
  });

  it('retries the edge function call once on a transient 5xx-style failure before throwing', async () => {
    invokeMock.mockResolvedValueOnce({ data: null, error: { message: 'fetch failed' } as any });
    invokeMock.mockResolvedValueOnce({ data: { ok: true }, error: null });

    await sendReceiptWhatsApp({ phone: '85999990000', storeId: 'store-1', saleId: 'sale-1' });

    expect(invokeMock).toHaveBeenCalledTimes(2);
  });

  // ---------- Telemetry -------------------------------------------------------

  it('records a telemetry event with the sale id when the receipt is sent', async () => {
    const telemetry = await import('../services/telemetry');
    const spy = vi.spyOn(telemetry, 'trackUxEvent');

    await sendReceiptWhatsApp({
      phone: '85999990000',
      storeId: 'store-1',
      saleId: 'sale-XYZ',
      customerName: 'Cliente Teste'
    });

    expect(spy).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'pdv_receipt_whatsapp_sent',
        metadata: expect.objectContaining({ saleId: 'sale-XYZ' })
      })
    );
  });
});
