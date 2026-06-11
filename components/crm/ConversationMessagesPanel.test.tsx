import { render, screen, fireEvent } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import ConversationMessagesPanel from "./ConversationMessagesPanel";

const baseProps = {
  clearNewMessageCount: vi.fn(),
  deleteMessageForEveryone: vi.fn(),
  handleScrollContainer: vi.fn(),
  loadingMessages: false,
  loadingOlder: false,
  messagesEndRef: { current: null },
  newMessageCount: 0,
  onOpenMedia: vi.fn(),
  openEditMessage: vi.fn(),
  openForwardMessage: vi.fn(),
  reactToMessage: vi.fn(),
  reactionsMap: new Map(),
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
  it("renders an empty state when the selected conversation has no messages", () => {
    render(<ConversationMessagesPanel {...baseProps} />);

    expect(screen.getByText("Nenhuma mensagem encontrada.")).toBeInTheDocument();
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
});
