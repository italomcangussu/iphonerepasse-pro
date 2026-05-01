import { describe, expect, it } from 'vitest';
import {
  getConversationAvatarUrl,
  getConversationDisplayName,
  isGroupConversation,
  type ConversationGroupFields,
} from './conversationGroup';

describe('conversationGroup helpers', () => {
  it('uses group metadata for group conversations', () => {
    const conversation: ConversationGroupFields = {
      is_group: true,
      group_name: 'Grupo VIP iPhone Repasse',
      group_avatar_url: 'https://cdn.example.com/group.jpg',
      lead_id: '+558899990507-store',
      crm_leads: {
        name: 'Maria Cliente',
        phone: '+558899990507',
        avatar_url: 'https://cdn.example.com/maria.jpg',
      },
    };

    expect(isGroupConversation(conversation)).toBe(true);
    expect(getConversationDisplayName(conversation)).toBe('Grupo VIP iPhone Repasse');
    expect(getConversationAvatarUrl(conversation)).toBe('https://cdn.example.com/group.jpg');
  });

  it('keeps the lead identity for direct conversations', () => {
    const conversation: ConversationGroupFields = {
      is_group: false,
      group_name: null,
      group_avatar_url: null,
      lead_id: '+558899990507-store',
      crm_leads: {
        name: 'Maria Cliente',
        phone: '+558899990507',
        avatar_url: 'https://cdn.example.com/maria.jpg',
      },
    };

    expect(isGroupConversation(conversation)).toBe(false);
    expect(getConversationDisplayName(conversation)).toBe('Maria Cliente');
    expect(getConversationAvatarUrl(conversation)).toBe('https://cdn.example.com/maria.jpg');
  });
});
