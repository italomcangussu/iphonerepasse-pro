import { render, screen, fireEvent } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import ConversationMessagesPanel from "./ConversationMessagesPanel";

const baseProps = {
  clearNewMessageCount: vi.fn(),
  deleteMessageForEveryone: vi.fn(),
  handleScrollContainer: vi.fn(),
  loadingMessages: false,
  loadingOlder: false,
  loadError: null,
  messagesEndRef: { current: null },
  newMessageCount: 0,
  onOpenMedia: vi.fn(),
  openEditMessage: vi.fn(),
  openForwardMessage: vi.fn(),
  reactToMessage: vi.fn(),
  reactionsMap: new Map(),
  retryLoadMessages: vi.fn(),
  scrollContainerRef: { current: null },
  scrollToBottom: vi.fn(),
  scrollToMessage: vi.fn(),
  selectedConversationId: "conversation-1",
  setReplyingTo: vi.fn(),
  threadGroups: [],
  topSentinelRef: { current: null },
  visibleMessages: [],
};

describe("ConversationMessagesPanel", () => {
  it("renders a helpful empty state when the selected conversation has no messages", () => {
    render(<ConversationMessagesPanel {...baseProps} />);

    expect(screen.getByText("Ainda não há mensagens nesta conversa")).toBeInTheDocument();
    expect(screen.getByText("Envie a primeira mensagem quando estiver pronto.")).toBeInTheDocument();
  });

  it("clears and scrolls when the new messages pill is clicked", () => {
    const clearNewMessageCount = vi.fn();
    const scrollToBottom = vi.fn();

    render(
      <ConversationMessagesPanel
        {...baseProps}
        clearNewMessageCount={clearNewMessageCount}
        newMessageCount={2}
        scrollToBottom={scrollToBottom}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /2 novas mensagens/i }));

    expect(clearNewMessageCount).toHaveBeenCalled();
    expect(scrollToBottom).toHaveBeenCalled();
  });

  it('announces new messages politely', () => {
    render(<ConversationMessagesPanel {...baseProps} newMessageCount={2} />);

    expect(screen.getByRole('status', { name: 'Novas mensagens' })).toHaveTextContent('2 novas mensagens');
  });

  it('renders a recoverable thread-load error', () => {
    const retryLoadMessages = vi.fn();
    render(
      <ConversationMessagesPanel
        {...baseProps}
        loadError="offline"
        retryLoadMessages={retryLoadMessages}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Tentar novamente' }));
    expect(retryLoadMessages).toHaveBeenCalledTimes(1);
  });

  it('renders sender and footer metadata once per message cluster', () => {
    const messages = [
      {
        id: 'inbound-1',
        direction: 'inbound' as const,
        sender_type: 'customer',
        content: 'Primeira',
        created_at: '2026-07-07T10:00:00.000Z',
        status: 'read',
        provider_message_id: 'provider-inbound-1',
      },
      {
        id: 'inbound-2',
        direction: 'inbound' as const,
        sender_type: 'customer',
        content: 'Segunda',
        created_at: '2026-07-07T10:04:00.000Z',
        status: 'read',
        provider_message_id: 'provider-inbound-2',
      },
      {
        id: 'outbound-1',
        direction: 'outbound' as const,
        sender_type: 'human',
        content: 'Resposta',
        created_at: '2026-07-07T10:05:00.000Z',
        status: 'sent',
        provider_message_id: 'provider-outbound-1',
      },
    ];

    const { container } = render(
      <ConversationMessagesPanel
        {...baseProps}
        visibleMessages={messages}
        threadGroups={[{ label: 'Hoje', messages }]}
      />,
    );

    const bubbles = container.querySelectorAll('.crm-message-bubble');
    expect(bubbles).toHaveLength(3);
    expect(bubbles[0]).toHaveAttribute('data-cluster-position', 'first');
    expect(bubbles[1]).toHaveAttribute('data-cluster-position', 'last');
    expect(bubbles[2]).toHaveAttribute('data-cluster-position', 'single');
    expect(screen.getAllByText('Cliente')).toHaveLength(1);
  });
});
