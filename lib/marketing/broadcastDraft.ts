import type { CampaignSegment } from './campaigns';

export type BroadcastAudience = 'all' | 'customers' | 'rfm';

export interface BroadcastDraftInput {
  storeId: string;
  name: string;
  messageTemplate: string;
  audience: BroadcastAudience;
  rfmSegment?: CampaignSegment;
  recipientLeadIds?: string[];
}

export interface BroadcastDraft {
  store_id: string;
  name: string;
  message_template: string;
  recipient_filters:
    | Record<string, never>
    | { is_customer: true }
    | { lead_ids: string[]; rfm_segment: CampaignSegment };
  status: 'draft';
}

export function buildBroadcastDraft({
  storeId,
  name,
  messageTemplate,
  audience,
  rfmSegment,
  recipientLeadIds,
}: BroadcastDraftInput): BroadcastDraft {
  if (/\{[^}]+\}/.test(messageTemplate)) {
    throw new Error('Variáveis como {nome} ainda não são suportadas em broadcasts.');
  }

  const leadIds = Array.from(new Set((recipientLeadIds || []).map((leadId) => leadId.trim()).filter(Boolean)));
  if (audience === 'rfm' && leadIds.length === 0) {
    throw new Error('Nenhum contato CRM foi vinculado ao segmento RFM selecionado.');
  }
  if (audience === 'rfm' && !rfmSegment) {
    throw new Error('Selecione o segmento RFM da campanha.');
  }

  let recipientFilters: BroadcastDraft['recipient_filters'] = {};
  if (audience === 'rfm') {
    recipientFilters = { lead_ids: leadIds, rfm_segment: rfmSegment! };
  } else if (audience === 'customers') {
    recipientFilters = { is_customer: true };
  }

  return {
    store_id: storeId,
    name: name.trim(),
    message_template: messageTemplate.trim(),
    recipient_filters: recipientFilters,
    status: 'draft',
  };
}
