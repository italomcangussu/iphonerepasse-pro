import { supabase } from '../services/supabase';
import { trackUxEvent } from '../services/telemetry';
import { generateReceiptPdfBase64 } from './generateReceiptPdf';

type SendReceiptWhatsAppArgs = {
  phone: string;
  storeId: string;
  saleId: string;
  customerName?: string;
  elementId?: string;
};

const normalizePhoneForWhatsApp = (raw: string): string | null => {
  const digits = String(raw ?? '').replace(/\D/g, '');
  if (!digits) return null;
  const withCountry = digits.startsWith('55') ? digits : `55${digits}`;
  // Brazilian phone needs country (55) + DDD (2) + 8 digits at minimum.
  if (withCountry.length < 12) return null;
  return withCountry;
};

export const normalizeWhatsAppPhone = normalizePhoneForWhatsApp;

const TRANSIENT_ERROR_PATTERN = /fetch failed|network|timeout|temporarily|5\d{2}/i;

const callEdgeFunction = async (body: Record<string, unknown>) => {
  const first = await supabase.functions.invoke('send-receipt-whatsapp', { body });
  const firstError = first.error || (first.data as { error?: string } | null)?.error;
  if (!firstError) return first;

  const message = typeof firstError === 'string' ? firstError : (firstError as Error).message || '';
  if (!TRANSIENT_ERROR_PATTERN.test(message)) return first;

  return supabase.functions.invoke('send-receipt-whatsapp', { body });
};

export async function sendReceiptWhatsApp({
  phone,
  storeId,
  saleId,
  customerName,
  elementId = 'receipt-content-a4'
}: SendReceiptWhatsAppArgs): Promise<void> {
  if (!phone || !String(phone).trim()) {
    throw new Error('Telefone do cliente é obrigatório para enviar o comprovante.');
  }
  if (!storeId || !String(storeId).trim()) {
    throw new Error('Loja da venda é obrigatória para enviar o comprovante.');
  }
  if (!saleId || !String(saleId).trim()) {
    throw new Error('Identificador da venda é obrigatório para enviar o comprovante.');
  }

  const normalizedPhone = normalizePhoneForWhatsApp(phone);
  if (!normalizedPhone) {
    throw new Error('Telefone inválido para envio via WhatsApp.');
  }

  let pdfBase64: string;
  try {
    pdfBase64 = await generateReceiptPdfBase64(elementId);
  } catch (err) {
    const detail = err instanceof Error ? err.message : String(err);
    throw new Error(`Não foi possível gerar o PDF do comprovante: ${detail}`);
  }
  if (!pdfBase64) {
    throw new Error('Não foi possível gerar o PDF do comprovante.');
  }

  const { data, error } = await callEdgeFunction({
    phone: normalizedPhone,
    pdfBase64,
    storeId,
    saleId,
    ...(customerName ? { customerName } : {})
  });

  if (error) throw error;
  if (data && (data as { error?: string }).error) {
    throw new Error((data as { error: string }).error);
  }

  trackUxEvent({
    name: 'pdv_receipt_whatsapp_sent',
    screen: 'PDV',
    metadata: { saleId, storeId },
    ts: new Date().toISOString()
  });
}
