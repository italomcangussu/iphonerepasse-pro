import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import ConversationsListPanel from "./ConversationsListPanel";
import type { ConversationRow } from "./conversationUi";

const baseConversation: ConversationRow = {
  id: "conversation-1",
  lead_id: "lead-1",
  channel_id: "channel-1",
  status: "open",
  ai_enabled: false,
  unread_count: 2,
  message_count: 3,
  last_message_at: "2026-06-11T12:13:00.000Z",
  store_id: "store-1",
  crm_leads: { id: "lead-1", name: "Maria Silva", phone: "+5585999990000" },
  crm_channels: { id: "channel-1", name: "Repasse", provider: "uazapi" },
  lastMessage: {
    conversation_id: "conversation-1",
    content: "Pode simular esse iPhone?",
    created_at: "2026-06-11T12:13:00.000Z",
    direction: "inbound",
    status: "sent",
  },
};

const defaultProps = {
  activeFiltersCount: 0,
  applyFilterView: vi.fn(),
  channelFilter: "all",
  channels: [],
  clearConversationFilters: vi.fn(),
  closeMobileFilters: vi.fn(),
  conversationsById: new Map([["conversation-1", baseConversation]]),
  deleteFilterView: vi.fn(),
  filteredConversations: [baseConversation],
  filtersCollapsed: false,
  filterViews: [],
  hasActiveFilters: false,
  handleSelectConversation: vi.fn(),
  isMobileFiltersOpen: false,
  isMobileViewport: false,
  loadingConversations: false,
  messageSearchResults: [],
  openMessageSearchResult: vi.fn(),
  openMobileFilters: vi.fn(),
  openSaveView: vi.fn(),
  providerFilter: "all" as const,
  renderSearchSnippet: (snippet: string) => snippet,
  search: "",
  searchingMessages: false,
  searchMode: "leads" as const,
  selectedConversationId: "conversation-1",
  setChannelFilter: vi.fn(),
  setMessageSearchResults: vi.fn(),
  setProviderFilter: vi.fn(),
  setSaveViewName: vi.fn(),
  setSaveViewShared: vi.fn(),
  setSearch: vi.fn(),
  setSearchMode: vi.fn(),
  setShowOnlyUnread: vi.fn(),
  setStatusFilter: vi.fn(),
  showOnlyUnread: false,
  statusFilter: "all" as const,
  toggleFiltersCollapsed: vi.fn(),
  unreadTotal: 2,
};

describe("ConversationsListPanel", () => {
  it("renders conversation rows and delegates row selection", () => {
    const handleSelectConversation = vi.fn();

    render(<ConversationsListPanel {...defaultProps} handleSelectConversation={handleSelectConversation} />);

    expect(screen.getByText("1 leads ativos")).toBeInTheDocument();
    expect(screen.getByText("Maria Silva")).toBeInTheDocument();
    expect(screen.getByText("Pode simular esse iPhone?")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /Maria Silva/i }));

    expect(handleSelectConversation).toHaveBeenCalledWith("conversation-1");
  });
});
