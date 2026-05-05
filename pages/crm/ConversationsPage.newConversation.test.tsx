import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import ConversationsPage from "./ConversationsPage";

const toastErrorMock = vi.fn();
const toastSuccessMock = vi.fn();
const supabaseFromMock = vi.fn();
const supabaseRpcMock = vi.fn();
const conversationInsertMock = vi.fn();
const supabaseChannelMock = vi.fn();
const supabaseRemoveChannelMock = vi.fn();

vi.mock("../../components/ui/ToastProvider", () => ({
  useToast: () => ({
    success: toastSuccessMock,
    error: toastErrorMock,
    info: vi.fn(),
    confirm: vi.fn(),
  }),
}));

vi.mock("../../components/crm/CRMPageFrame", () => ({
  default: ({ title, actions, children }: { title: string; actions?: React.ReactNode; children: React.ReactNode }) => (
    <>
      <header>
        <h1>{title}</h1>
        {actions}
      </header>
      {children}
    </>
  ),
}));

vi.mock("../../services/supabase", () => ({
  supabase: {
    from: (...args: any[]) => supabaseFromMock(...args),
    rpc: (...args: any[]) => supabaseRpcMock(...args),
    channel: (...args: any[]) => supabaseChannelMock(...args),
    removeChannel: (...args: any[]) => supabaseRemoveChannelMock(...args),
    functions: {
      invoke: vi.fn(),
    },
    storage: {
      from: vi.fn(),
    },
  },
}));

const existingConversations = [
  {
    id: "conversation-1",
    store_id: "store-1",
    lead_id: "lead-1",
    channel_id: "channel-1",
    status: "open",
    unread_count: 0,
    message_count: 0,
    last_message_at: "2026-05-05T12:00:00.000Z",
    crm_leads: { id: "lead-1", name: "Maria Silva", phone: "+5585999990000", avatar_url: null },
    crm_channels: { id: "channel-1", name: "WhatsApp Geral", provider: "uazapi" },
  },
];
let conversationsData: typeof existingConversations = [];

const makeListChain = (data: any[]) => {
  const chain: any = {};
  chain.select = vi.fn().mockReturnValue(chain);
  chain.order = vi.fn().mockReturnValue(chain);
  chain.limit = vi.fn().mockResolvedValue({ data, error: null });
  chain.in = vi.fn().mockReturnValue(chain);
  chain.eq = vi.fn().mockReturnValue(chain);
  chain.gt = vi.fn().mockReturnValue(chain);
  chain.is = vi.fn().mockReturnValue(chain);
  chain.update = vi.fn().mockReturnValue(chain);
  chain.maybeSingle = vi.fn().mockResolvedValue({ data: null, error: null });
  chain.single = vi.fn().mockResolvedValue({ data: data[0] || null, error: null });
  return chain;
};

const makeOrderResultChain = (data: any[]) => {
  const chain: any = {};
  chain.select = vi.fn().mockReturnValue(chain);
  chain.order = vi.fn().mockResolvedValue({ data, error: null });
  return chain;
};

describe("ConversationsPage new conversation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    Object.defineProperty(window, "matchMedia", {
      writable: true,
      value: vi.fn().mockImplementation((query: string) => ({
        matches: false,
        media: query,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        addListener: vi.fn(),
        removeListener: vi.fn(),
      })),
    });
    Element.prototype.scrollIntoView = vi.fn();
    Element.prototype.scrollTo = vi.fn();
    conversationsData = [];
    supabaseChannelMock.mockReturnValue({
      on: vi.fn().mockReturnThis(),
      subscribe: vi.fn().mockReturnValue({ unsubscribe: vi.fn() }),
    });
    supabaseRemoveChannelMock.mockResolvedValue(undefined);
    supabaseRpcMock.mockResolvedValue({ data: "lead-1", error: null });
    supabaseFromMock.mockImplementation((table: string) => {
      if (table === "crm_channels") {
        return makeOrderResultChain([
          {
            id: "channel-1",
            store_id: "store-1",
            name: "WhatsApp Geral",
            provider: "uazapi",
            is_active: true,
          },
        ]);
      }
      if (table === "crm_conversations") {
        const chain = makeListChain(conversationsData);
        conversationInsertMock.mockReturnValue({
          select: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: {
                id: "conversation-1",
                store_id: "store-1",
                lead_id: "lead-1",
                channel_id: "channel-1",
              },
              error: null,
            }),
          }),
        });
        chain.insert = conversationInsertMock;
        return chain;
      }
      return makeListChain([]);
    });
  });

  it("enables native spelling and autocorrect on the conversation composer", async () => {
    conversationsData = existingConversations;
    render(<ConversationsPage />);

    const composer = await screen.findByPlaceholderText("Mensagem rápida...");

    expect(composer).toHaveAttribute("spellcheck", "true");
    expect(composer).toHaveAttribute("autocorrect", "on");
    expect(composer).toHaveAttribute("autocapitalize", "sentences");
  });

  it("creates a lead and conversation with phone normalized for UAZAPI", async () => {
    const user = userEvent.setup();
    render(<ConversationsPage />);

    await screen.findByRole("heading", { name: "Conversas" });
    await user.click(screen.getByRole("button", { name: "Nova conversa" }));
    await screen.findAllByRole("option", { name: "WhatsApp Geral · UAZAPI" });

    fireEvent.change(screen.getByLabelText("Nome do lead"), { target: { value: "Maria Silva" } });
    fireEvent.change(screen.getByLabelText("Telefone"), { target: { value: "(85) 99999-0000" } });
    await user.click(screen.getByRole("button", { name: "Criar conversa" }));

    await waitFor(() => {
      expect(supabaseRpcMock).toHaveBeenCalledWith("upsert_crm_lead", expect.objectContaining({
        p_store_id: "store-1",
        p_name: "Maria Silva",
        p_phone: "+5585999990000",
        p_utm_source: "manual_conversation",
        p_channel_id: "channel-1",
      }));
    });
    expect(toastSuccessMock).toHaveBeenCalledWith("Conversa criada.");
    expect(conversationInsertMock).toHaveBeenCalledWith(expect.objectContaining({
      talk_id: "5585999990000@s.whatsapp.net",
    }));
  });
});
