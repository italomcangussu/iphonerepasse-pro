import { LazyMotion, domMax } from 'framer-motion';
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import MessageBubble, { type MessageBubbleMessage } from './MessageBubble';

const renderBubble = (message: MessageBubbleMessage) => {
  return render(
    <LazyMotion features={domMax}>
      <MessageBubble message={message} />
    </LazyMotion>,
  );
};

describe('MessageBubble', () => {
  it('shows the inbound sender name from the webhook payload', () => {
    renderBubble({
      id: 'msg-1',
      direction: 'inbound',
      sender_type: 'customer',
      content: 'Oi',
      created_at: '2026-05-01T10:53:00.000Z',
      status: 'read',
      webhook_payload: {
        chat: {
          name: 'Italo Cangussu Blogueiro',
        },
      },
    });

    expect(screen.getByText('Italo Cangussu Blogueiro')).toBeInTheDocument();
    expect(screen.queryByText('Authorized Client')).not.toBeInTheDocument();
  });

  it('updates the rendered text when the same message receives content later', () => {
    const message: MessageBubbleMessage = {
      id: 'msg-2',
      direction: 'inbound',
      sender_type: 'customer',
      content: null,
      created_at: '2026-05-01T10:53:00.000Z',
      status: 'read',
    };

    const { rerender } = render(
      <LazyMotion features={domMax}>
        <MessageBubble message={message} />
      </LazyMotion>,
    );

    expect(screen.getByText('[system: empty payload]')).toBeInTheDocument();

    rerender(
      <LazyMotion features={domMax}>
        <MessageBubble message={{ ...message, content: 'Mensagem recuperada' }} />
      </LazyMotion>,
    );

    expect(screen.getByText('Mensagem recuperada')).toBeInTheDocument();
    expect(screen.queryByText('[system: empty payload]')).not.toBeInTheDocument();
  });

  it('falls back to webhook payload text when persisted content is empty', () => {
    renderBubble({
      id: 'msg-3',
      direction: 'inbound',
      sender_type: 'customer',
      content: null,
      created_at: '2026-05-01T10:53:00.000Z',
      status: 'read',
      webhook_payload: {
        message: {
          content: 'Texto recuperado do payload',
        },
      },
    });

    expect(screen.getByText('Texto recuperado do payload')).toBeInTheDocument();
    expect(screen.queryByText('[system: empty payload]')).not.toBeInTheDocument();
  });

  it('shows the participant name as sender for inbound group messages', () => {
    renderBubble({
      id: 'msg-4',
      direction: 'inbound',
      sender_type: 'customer',
      content: 'Mensagem no grupo',
      created_at: '2026-05-01T10:53:00.000Z',
      status: 'read',
      webhook_payload: {
        chat: {
          wa_chatid: '120363401234567890@g.us',
          name: 'Grupo VIP iPhone Repasse',
        },
        message: {
          senderName: 'Maria Cliente',
          sender_pn: '558899990507@s.whatsapp.net',
          chatid: '120363401234567890@g.us',
        },
      },
    });

    expect(screen.getByText('Maria Cliente')).toBeInTheDocument();
    expect(screen.queryByText('Grupo VIP iPhone Repasse')).not.toBeInTheDocument();
  });
});
