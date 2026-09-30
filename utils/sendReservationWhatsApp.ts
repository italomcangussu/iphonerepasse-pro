import { supabase } from '../services/supabase';
import { normalizeWhatsAppPhone } from './sendReceiptWhatsApp';
import { toWhatsAppSendError } from './whatsappSendError';

export type SendReservationWhatsAppArgs = {
  phone: string;
  storeId: string;
  content: string;
  customerName?: string;
  reservationId?: string;
  stockItemId?: string;
};

/**
 * Envia a mensagem automática da reserva pelo CRM.
 *
 * O texto já chega resolvido (ver `lib/reservationMessage.ts`): aqui só validamos
 * o contato e delegamos para a edge function, que garante lead + conversa.
 */
export async function sendReservationWhatsApp({
  phone,
  storeId,
  content,
  customerName,
  reservationId,
  stockItemId
}: SendReservationWhatsAppArgs): Promise<void> {
  const message = String(content ?? '').trim();
  if (!message) {
    throw new Error('A mensagem da reserva está vazia.');
  }
  if (!storeId || !String(storeId).trim()) {
    throw new Error('Loja do aparelho é obrigatória para enviar a mensagem da reserva.');
  }

  const normalizedPhone = normalizeWhatsAppPhone(phone);
  if (!normalizedPhone) {
    throw new Error('Telefone inválido para envio via WhatsApp.');
  }

  const { data, error } = await supabase.functions.invoke('send-reservation-whatsapp', {
    body: {
      phone: normalizedPhone,
      storeId,
      content: message,
      ...(customerName ? { customerName } : {}),
      ...(reservationId ? { reservationId } : {}),
      ...(stockItemId ? { stockItemId } : {})
    }
  });

  if (error) throw await toWhatsAppSendError(error, normalizedPhone);
  if (data && (data as { error?: string }).error) {
    throw await toWhatsAppSendError((data as { error: string }).error, normalizedPhone);
  }
}
