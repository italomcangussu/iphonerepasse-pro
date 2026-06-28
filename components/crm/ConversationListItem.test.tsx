import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import ConversationListItem from './ConversationListItem';
import type { ConversationRow } from './conversationUi';

const conversation: ConversationRow = {
  id: 'conversation-1',
  lead_id: 'lead-1',
  channel_id: 'channel-1',
  status: 'open',
  ai_enabled: false,
  unread_count: 2,
  message_count: 3,
  last_message_at: '2026-06-11T12:13:00.000Z',
  store_id: 'store-1',
  crm_leads: { id: 'lead-1', name: 'Maria Silva', phone: '+5585999990000' },
  crm_channels: { id: 'channel-1', name: 'Repasse', provider: 'uazapi' },
  lastMessage: {
    conversation_id: 'conversation-1',
    content: 'Pode simular?',
    created_at: '2026-06-11T12:13:00.000Z',
    direction: 'inbound',
    status: 'sent',
  },
};

describe('ConversationListItem', () => {
  it('exposes selection, unread count and provider without color-only meaning', () => {
    const onSelect = vi.fn();
    render(<ConversationListItem conversation={conversation} selected onSelect={onSelect} />);

    const row = screen.getByRole('button', { name: /Maria Silva/i });
    expect(row).toHaveAttribute('aria-current', 'true');
    expect(screen.getByLabelText('2 mensagens não lidas')).toBeInTheDocument();
    expect(screen.getByText(/WhatsApp/)).toBeInTheDocument();

    fireEvent.click(row);
    expect(onSelect).toHaveBeenCalledWith('conversation-1');
  });
});
