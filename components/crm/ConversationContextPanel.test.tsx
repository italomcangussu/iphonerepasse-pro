import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import ConversationContextPanel from './ConversationContextPanel';

describe('ConversationContextPanel', () => {
  it('presents decision context as one labelled region without nested card grids', () => {
    render(
      <ConversationContextPanel
        conversation={{
          id: 'conversation-1',
          lead_id: 'lead-1',
          channel_id: 'channel-1',
          status: 'open',
          ai_enabled: false,
          unread_count: 2,
          message_count: 3,
          last_message_at: '2026-06-28T10:00:00.000Z',
          store_id: 'store-1',
          crm_leads: { id: 'lead-1', name: 'Maria Silva', phone: '+5585999990000' },
          crm_channels: { id: 'channel-1', name: 'Repasse', provider: 'uazapi' },
          lastMessage: null,
        }}
        leadName="Maria Silva"
        avatarUrl={null}
        isGroup={false}
        ownershipLabel="Atendimento humano"
        messageCount={3}
        loadingCommerceSnapshot={false}
        commerceSnapshot={null}
      />,
    );

    expect(screen.getByRole('complementary', { name: 'Contexto da conversa' })).toBeInTheDocument();
    expect(screen.getByText('Estado do atendimento')).toBeInTheDocument();
    expect(screen.getByText('Atendimento humano')).toBeInTheDocument();
  });
});
