export interface ConversationGroupFields {
  is_group?: boolean | null;
  group_name?: string | null;
  group_avatar_url?: string | null;
  lead_id: string;
  crm_leads?: {
    name?: string | null;
    phone?: string | null;
    avatar_url?: string | null;
  } | null;
}

const cleanText = (value: unknown): string | null => {
  if (value && typeof value === 'object') return null;
  const normalized = String(value ?? '').trim();
  return normalized || null;
};

export const isGroupConversation = (conversation: ConversationGroupFields): boolean =>
  Boolean(conversation.is_group);

export const getConversationDisplayName = (conversation: ConversationGroupFields): string => {
  if (isGroupConversation(conversation)) {
    return cleanText(conversation.group_name) || cleanText(conversation.crm_leads?.name) || cleanText(conversation.lead_id) || 'Grupo';
  }

  return cleanText(conversation.crm_leads?.name) || cleanText(conversation.crm_leads?.phone) || cleanText(conversation.lead_id) || 'Contato';
};

export const getConversationAvatarUrl = (conversation: ConversationGroupFields): string | null => {
  if (isGroupConversation(conversation)) {
    return cleanText(conversation.group_avatar_url);
  }

  return cleanText(conversation.crm_leads?.avatar_url);
};
