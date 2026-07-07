import { LazyMotion, domMax } from 'framer-motion';
import type { ComponentProps } from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import MessageBubble, { type MessageBubbleMessage } from './MessageBubble';

const { invokeMock } = vi.hoisted(() => ({
  invokeMock: vi.fn(),
}));

vi.mock('../../services/supabase', () => ({
  supabase: {
    functions: {
      invoke: invokeMock,
    },
  },
}));

const renderBubble = (
  message: MessageBubbleMessage,
  props: Omit<ComponentProps<typeof MessageBubble>, 'message'> = {},
) => {
  return render(
    <LazyMotion features={domMax}>
      <MessageBubble message={message} {...props} />
    </LazyMotion>,
  );
};

const baseInboundMessage: MessageBubbleMessage = {
  id: 'inbound-cluster',
  direction: 'inbound',
  sender_type: 'customer',
  content: 'Olá',
  created_at: '2026-07-07T10:00:00.000Z',
  status: 'read',
  webhook_payload: { chat: { name: 'Cliente' } },
};

const baseOutboundMessage: MessageBubbleMessage = {
  id: 'outbound-cluster',
  direction: 'outbound',
  sender_type: 'human',
  content: 'Olá',
  created_at: '2026-07-07T10:00:00.000Z',
  status: 'sent',
};

describe('MessageBubble', () => {
  beforeEach(() => {
    invokeMock.mockReset();
    window.matchMedia = vi.fn().mockReturnValue({
      matches: true,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    });
  });

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

  it('shows the internal user name for outbound human messages without prefixing the message content', () => {
    renderBubble({
      id: 'msg-agent-1',
      direction: 'outbound',
      sender_type: 'human',
      content: 'Olá, tudo bem?',
      created_at: '2026-05-01T10:53:00.000Z',
      status: 'sent',
      webhook_payload: {
        sent_by_display_name: 'Victor',
      },
    });

    expect(screen.getByText('Victor')).toBeInTheDocument();
    expect(screen.getByText('Olá, tudo bem?')).toBeInTheDocument();
    expect(screen.queryByText('Victor: Olá, tudo bem?')).not.toBeInTheDocument();
    expect(screen.queryByText('Human Specialist')).not.toBeInTheDocument();
  });

  it('marks inbound bubbles with the neutral inbound tone class', () => {
    const { container } = renderBubble({
      id: 'msg-tone-inbound',
      direction: 'inbound',
      sender_type: 'customer',
      content: 'Oi',
      created_at: '2026-05-01T10:53:00.000Z',
      status: 'read',
    });

    expect(container.querySelector('.crm-message-bubble--inbound')).toBeInTheDocument();
  });

  it('marks outbound human and AI bubbles with distinct tone classes', () => {
    const { container, rerender } = render(
      <LazyMotion features={domMax}>
        <MessageBubble
          message={{
            id: 'msg-tone-human',
            direction: 'outbound',
            sender_type: 'human',
            content: 'Mensagem humana',
            created_at: '2026-05-01T10:53:00.000Z',
            status: 'sent',
          }}
        />
      </LazyMotion>,
    );

    expect(container.querySelector('.crm-message-bubble--outbound-human')).toBeInTheDocument();

    rerender(
      <LazyMotion features={domMax}>
        <MessageBubble
          message={{
            id: 'msg-tone-ai',
            direction: 'outbound',
            sender_type: 'ai',
            content: 'Mensagem IA',
            created_at: '2026-05-01T10:53:00.000Z',
            status: 'sent',
          }}
        />
      </LazyMotion>,
    );

    expect(container.querySelector('.crm-message-bubble--outbound-ai')).toBeInTheDocument();
  });

  it('hides repeated sender and footer inside a cluster', () => {
    renderBubble(baseInboundMessage, {
      clusterPosition: 'middle',
      showSender: false,
      showFooter: false,
    });

    expect(screen.queryByText('Cliente')).not.toBeInTheDocument();
    expect(screen.queryByText('Lida')).not.toBeInTheDocument();
  });

  it('does not expose outbound delivery labels on inbound messages', () => {
    renderBubble(baseInboundMessage);

    expect(screen.queryByText('Lida')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Status: Lida')).not.toBeInTheDocument();
  });

  it('keeps outbound delivery state accessible without repeating visible text', () => {
    renderBubble({ ...baseOutboundMessage, status: 'delivered' });

    expect(screen.getByLabelText('Status: Entregue')).toBeInTheDocument();
    expect(screen.queryByText('Entregue')).not.toBeInTheDocument();
  });

  it('gives the inbound actions trigger a visible neutral tone and 44px target', () => {
    renderBubble(baseInboundMessage);

    expect(screen.getByRole('button', { name: 'Mais ações da mensagem' }))
      .toHaveClass('min-h-11', 'min-w-11', 'text-slate-700');
  });

  it('offers retry for a failed outbound message', () => {
    const onRetry = vi.fn();
    const message: MessageBubbleMessage = {
      id: 'failed-1',
      direction: 'outbound',
      sender_type: 'human',
      content: 'Olá',
      created_at: '2026-06-28T10:00:00.000Z',
      status: 'failed',
      error_message: 'Sem conexão',
    };

    renderBubble(message, { onRetry });
    fireEvent.click(screen.getByRole('button', { name: 'Tentar enviar novamente' }));
    expect(onRetry).toHaveBeenCalledWith(message);
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

    expect(screen.getByText('Mensagem sem conteúdo disponível.')).toBeInTheDocument();
    expect(screen.queryByText(/system: empty payload/i)).not.toBeInTheDocument();

    rerender(
      <LazyMotion features={domMax}>
        <MessageBubble message={{ ...message, content: 'Mensagem recuperada' }} />
      </LazyMotion>,
    );

    expect(screen.getByText('Mensagem recuperada')).toBeInTheDocument();
    expect(screen.queryByText('Mensagem sem conteúdo disponível.')).not.toBeInTheDocument();
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

  it('recognizes UAZAPI reply metadata from the raw payload when normalized columns are empty', async () => {
    const user = userEvent.setup();
    const onScrollToReply = vi.fn();

    render(
      <LazyMotion features={domMax}>
        <MessageBubble
          message={{
            id: 'msg-reply-uaz',
            direction: 'inbound',
            sender_type: 'customer',
            content: null,
            created_at: '2026-05-02T13:08:08.000Z',
            status: 'read',
            webhook_payload: {
              owner: '558591546796',
              message: {
                quoted: '3A89B97A7FBFFB3681BA',
                messageType: 'AudioMessage',
                mediaType: 'ptt',
                content: {
                  PTT: true,
                  contextInfo: {
                    stanzaID: '3A89B97A7FBFFB3681BA',
                    quotedMessage: {
                      conversation: 'Certo',
                    },
                  },
                },
              },
            },
          }}
          onScrollToReply={onScrollToReply}
        />
      </LazyMotion>,
    );

    expect(screen.getByText('Certo')).toBeInTheDocument();
    expect(screen.getByText('[Áudio]')).toBeInTheDocument();
    expect(screen.queryByText('[system: empty payload]')).not.toBeInTheDocument();

    const replyPreview = screen.getByTitle('Ir para mensagem original');
    expect(replyPreview).toHaveClass('min-h-11');
    await user.click(replyPreview);
    expect(onScrollToReply).toHaveBeenCalledWith('558591546796:3A89B97A7FBFFB3681BA');
  });

  it('uses a media placeholder for quoted media replies without quoted text', () => {
    renderBubble({
      id: 'msg-reply-video',
      direction: 'inbound',
      sender_type: 'customer',
      content: 'Esse aqui',
      created_at: '2026-05-02T13:08:08.000Z',
      status: 'read',
      webhook_payload: {
        message: {
          content: {
            contextInfo: {
              stanzaID: 'video-1',
              quotedMessage: {
                videoMessage: {
                  mimetype: 'video/mp4',
                },
              },
            },
          },
        },
      },
    });

    expect(screen.getByText('[Vídeo]')).toBeInTheDocument();
  });

  it('renders ptt media as an audio message', async () => {
    invokeMock.mockResolvedValueOnce({
      data: { mediaUrl: 'https://cdn.uazapi.com/media/audio.mp3' },
      error: null,
    });

    renderBubble({
      id: 'msg-audio-ptt',
      direction: 'inbound',
      sender_type: 'customer',
      content: null,
      media_url: 'https://mmg.whatsapp.net/v/t62/audio.enc',
      media_type: 'ptt',
      created_at: '2026-05-05T20:13:29.000Z',
      status: 'read',
    });

    expect(screen.getByRole('button', { name: /reproduzir áudio/i })).toHaveClass('min-h-11', 'min-w-11');
    expect(screen.getByRole('button', { name: /transcrever áudio/i })).toHaveClass('min-h-11');
    expect(screen.queryByText('[system: empty payload]')).not.toBeInTheDocument();
    await waitFor(() => expect(invokeMock).toHaveBeenCalledWith('crm-uaz-media-download', {
      body: { messageId: 'msg-audio-ptt' },
    }));
  });

  it('keeps document actions at the minimum touch target', () => {
    renderBubble({
      ...baseOutboundMessage,
      id: 'document-message',
      media_url: 'https://cdn.example.com/arquivo.pdf',
      media_type: 'application/pdf',
    });

    expect(screen.getByRole('button', { name: /arquivo\.pdf/i })).toHaveClass('min-h-11');
    expect(screen.getByRole('link', { name: 'Baixar' })).toHaveClass('min-h-11');
  });

  it('downloads encrypted UAZAPI images before rendering the preview', async () => {
    invokeMock.mockResolvedValueOnce({
      data: { mediaUrl: 'https://cdn.uazapi.com/media/foto.jpg' },
      error: null,
    });

    renderBubble({
      id: 'msg-image-enc',
      direction: 'inbound',
      sender_type: 'customer',
      content: null,
      media_url: 'https://mmg.whatsapp.net/v/t62/foto.enc',
      media_type: 'image/jpeg',
      created_at: '2026-05-05T20:13:29.000Z',
      status: 'read',
    });

    expect(screen.getByText('Carregando imagem...')).toBeInTheDocument();
    const image = await screen.findByRole('img', { name: /foto\.jpg/i });
    expect(image).toHaveAttribute('src', 'https://cdn.uazapi.com/media/foto.jpg');
  });

  it('recovers UAZAPI undecryptable message content without rendering the raw placeholder', async () => {
    invokeMock.mockResolvedValueOnce({
      data: { content: 'Texto recuperado pela UAZAPI' },
      error: null,
    });

    renderBubble({
      id: 'msg-undecryptable-text',
      direction: 'inbound',
      sender_type: 'customer',
      content: '[Undecryptable] [text] Não foi possível descriptografar a mensagem. Abra o WhatsApp no seu celular para visualizá-la.',
      media_type: 'error',
      created_at: '2026-05-05T20:13:29.000Z',
      status: 'read',
      provider_message_id: 'provider-undecryptable',
    });

    expect(screen.queryByText(/\[Undecryptable\]/i)).not.toBeInTheDocument();
    await waitFor(() => expect(invokeMock).toHaveBeenCalledWith('crm-uaz-media-download', {
      body: { messageId: 'msg-undecryptable-text' },
    }));
    expect(await screen.findByText('Texto recuperado pela UAZAPI')).toBeInTheDocument();
  });

  it('shows a clean fallback when UAZAPI cannot recover an undecryptable message', async () => {
    invokeMock.mockResolvedValueOnce({
      data: { error: 'UAZAPI não retornou mídia ou texto recuperado.' },
      error: null,
    });

    renderBubble({
      id: 'msg-undecryptable-fallback',
      direction: 'inbound',
      sender_type: 'customer',
      content: '[Undecryptable] [text] Não foi possível descriptografar a mensagem.',
      media_type: 'error',
      created_at: '2026-05-05T20:13:29.000Z',
      status: 'read',
    });

    expect(screen.queryByText(/\[Undecryptable\]/i)).not.toBeInTheDocument();
    expect(await screen.findByText('Mensagem não descriptografada pela UAZAPI. Abra o WhatsApp no celular vinculado para visualizá-la.')).toBeInTheDocument();
  });

  it('resets inherited uppercase transforms so message text keeps its original casing', () => {
    renderBubble({
      id: 'msg-case',
      direction: 'inbound',
      sender_type: 'customer',
      content: 'Oi! Vi o anúncio e gostaria de mais informações',
      created_at: '2026-05-01T10:53:00.000Z',
      status: 'read',
    });

    expect(screen.getByText('Oi! Vi o anúncio e gostaria de mais informações').closest('article')).toHaveClass('normal-case');
  });

  it('opens a contextual action menu with reactions and inbound actions', async () => {
    const user = userEvent.setup();
    const message: MessageBubbleMessage = {
      id: 'msg-menu-in',
      direction: 'inbound',
      sender_type: 'customer',
      content: 'Pode me passar detalhes?',
      created_at: '2026-05-01T10:53:00.000Z',
      status: 'read',
      provider_message_id: 'provider-in-1',
    };
    const onReact = vi.fn();
    const onReply = vi.fn();
    const onForward = vi.fn();

    render(
      <LazyMotion features={domMax}>
        <MessageBubble message={message} onReact={onReact} onReply={onReply} onForward={onForward} />
      </LazyMotion>,
    );

    await user.click(screen.getByRole('button', { name: 'Mais ações da mensagem' }));
    await user.click(screen.getByRole('button', { name: 'Reagir com ❤️' }));
    expect(onReact).toHaveBeenCalledWith(message, '❤️');

    await user.click(screen.getByRole('button', { name: 'Mais ações da mensagem' }));
    await user.click(screen.getByRole('menuitem', { name: 'Responder' }));
    expect(onReply).toHaveBeenCalledWith(message);

    await user.click(screen.getByRole('button', { name: 'Mais ações da mensagem' }));
    await user.click(screen.getByRole('menuitem', { name: 'Encaminhar' }));
    expect(onForward).toHaveBeenCalledWith(message);
    expect(screen.queryByRole('menuitem', { name: 'Editar mensagem' })).not.toBeInTheDocument();
    expect(screen.queryByRole('menuitem', { name: 'Apagar para todos' })).not.toBeInTheDocument();
  });

  it('shows edit and delete actions only for outbound provider messages', async () => {
    const user = userEvent.setup();
    const message: MessageBubbleMessage = {
      id: 'msg-menu-out',
      direction: 'outbound',
      sender_type: 'human',
      content: 'Mensagem enviada',
      created_at: '2026-05-01T10:53:00.000Z',
      status: 'sent',
      provider_message_id: 'provider-out-1',
    };
    const onEdit = vi.fn();
    const onDelete = vi.fn();

    render(
      <LazyMotion features={domMax}>
        <MessageBubble message={message} onEdit={onEdit} onDelete={onDelete} />
      </LazyMotion>,
    );

    await user.click(screen.getByRole('button', { name: 'Mais ações da mensagem' }));
    await user.click(screen.getByRole('menuitem', { name: 'Editar mensagem' }));
    expect(onEdit).toHaveBeenCalledWith(message);

    await user.click(screen.getByRole('button', { name: 'Mais ações da mensagem' }));
    await user.click(screen.getByRole('menuitem', { name: 'Apagar para todos' }));
    expect(onDelete).toHaveBeenCalledWith(message);
  });

  it('opens message actions from desktop right-click', async () => {
    const user = userEvent.setup();
    const message: MessageBubbleMessage = {
      id: 'msg-menu-context',
      direction: 'outbound',
      sender_type: 'human',
      content: 'Mensagem enviada',
      created_at: '2026-05-01T10:53:00.000Z',
      status: 'sent',
      provider_message_id: 'provider-out-context',
    };
    const onReply = vi.fn();
    const onForward = vi.fn();
    const onEdit = vi.fn();
    const onDelete = vi.fn();

    render(
      <LazyMotion features={domMax}>
        <MessageBubble
          message={message}
          onReply={onReply}
          onForward={onForward}
          onEdit={onEdit}
          onDelete={onDelete}
        />
      </LazyMotion>,
    );

    const bubble = screen.getByText('Mensagem enviada').closest('article');
    expect(bubble).not.toBeNull();
    fireEvent.contextMenu(bubble!, { clientX: 180, clientY: 220 });

    expect(screen.getByRole('menu', { name: 'Ações da mensagem' })).toBeInTheDocument();
    await user.click(screen.getByRole('menuitem', { name: 'Responder' }));
    expect(onReply).toHaveBeenCalledWith(message);

    fireEvent.contextMenu(bubble!, { clientX: 180, clientY: 220 });
    await user.click(screen.getByRole('menuitem', { name: 'Editar mensagem' }));
    expect(onEdit).toHaveBeenCalledWith(message);

    fireEvent.contextMenu(bubble!, { clientX: 180, clientY: 220 });
    expect(screen.getByRole('menuitem', { name: 'Encaminhar' })).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: 'Apagar para todos' })).toBeInTheDocument();
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
