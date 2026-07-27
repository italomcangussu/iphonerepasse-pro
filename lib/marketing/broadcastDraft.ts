export type BroadcastAudience = 'all' | 'customers';

export interface BroadcastDraftInput {
  storeId: string;
  name: string;
  messageTemplate: string;
  audience: BroadcastAudience;
}

export interface BroadcastDraft {
  store_id: string;
  name: string;
  message_template: string;
  recipient_filters: Record<string, never> | { is_customer: true };
  status: 'draft';
}

export function buildBroadcastDraft({
  storeId,
  name,
  messageTemplate,
  audience,
}: BroadcastDraftInput): BroadcastDraft {
  if (/\{[^}]+\}/.test(messageTemplate)) {
    throw new Error('Variáveis como {nome} ainda não são suportadas em broadcasts.');
  }

  return {
    store_id: storeId,
    name: name.trim(),
    message_template: messageTemplate.trim(),
    recipient_filters: audience === 'customers' ? { is_customer: true } : {},
    status: 'draft',
  };
}
