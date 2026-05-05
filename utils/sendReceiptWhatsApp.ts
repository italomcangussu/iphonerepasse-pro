import { supabase } from '../services/supabase';
import { generateReceiptPdfBase64 } from './generateReceiptPdf';

type SendReceiptWhatsAppArgs = {
  phone: string;
  storeId: string;
  saleId: string;
  customerName?: string;
  elementId?: string;
};

export async function sendReceiptWhatsApp({
  phone,
  storeId,
  saleId,
  customerName,
  elementId = 'receipt-content-a4'
}: SendReceiptWhatsAppArgs): Promise<void> {
  const pdfBase64 = await generateReceiptPdfBase64(elementId);
  const { data, error } = await supabase.functions.invoke('send-receipt-whatsapp', {
    body: { phone, pdfBase64, storeId, saleId, ...(customerName ? { customerName } : {}) },
  });

  if (error) throw error;
  if (data?.error) throw new Error(data.error);
}
