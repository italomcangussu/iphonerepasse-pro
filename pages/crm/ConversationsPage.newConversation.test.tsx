import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import ConversationsPage from "./ConversationsPage";

const toastErrorMock = vi.fn();
const toastSuccessMock = vi.fn();
const supabaseFromMock = vi.fn();
const supabaseRpcMock = vi.fn();
const conversationInsertMock = vi.fn();

vi.mock("../../components/ui/ToastProvider", () => ({
  useToast: () => ({
    success: toastSuccessMock,
    error: toastErrorMock,
    info: vi.fn(),
    confirm: vi.fn(),
  }),
}));

vi.mock("../../services/supabase", () => ({
  supabase: {
    from: (...args: any[]) => supabaseFromMock(...args),
    rpc: (...args: any[]) => supabaseRpcMock(...args),
    functions: {
      invoke: vi.fn(),
    },
    storage: {
      from: vi.fn(),
    },
  },
}));

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
        const chain = makeListChain([]);
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

  it("creates a lead and conversation with phone normalized for UAZAPI", async () => {
    const user = userEvent.setup();
    render(<ConversationsPage />);

    await screen.findByRole("heading", { name: "Conversas" });
    await user.click(screen.getByRole("button", { name: "Nova conversa" }));
    await screen.findByRole("option", { name: "WhatsApp Geral · UAZAPI" });

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
