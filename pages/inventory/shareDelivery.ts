import type { ShareChannel } from './inventoryViewModel';

export type ShareDeliveryResult = 'sent' | 'copied' | 'cancelled';

const isAbortError = (error: unknown) => (error as { name?: string } | null)?.name === 'AbortError';

export const copyShareText = async (text: string): Promise<void> => {
  if (!navigator.clipboard?.writeText) throw new Error('clipboard_unavailable');
  await navigator.clipboard.writeText(text);
};

const shareViaSystemSheet = async (text: string): Promise<ShareDeliveryResult> => {
  try {
    await navigator.share({ text });
    return 'sent';
  } catch (error) {
    if (isAbortError(error)) return 'cancelled';
    throw error;
  }
};

// WhatsApp abre a conversa com o texto pronto; Instagram não aceita texto por link,
// então usa a folha de compartilhar do sistema ou, sem ela, copia o texto.
export const deliverShareText = async (channel: ShareChannel, text: string): Promise<ShareDeliveryResult> => {
  if (channel === 'whatsapp') {
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank', 'noopener,noreferrer');
    return 'sent';
  }

  if (typeof navigator.share !== 'function') {
    await copyShareText(text);
    return 'copied';
  }

  return shareViaSystemSheet(text);
};
