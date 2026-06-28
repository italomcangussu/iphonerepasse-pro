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
});
