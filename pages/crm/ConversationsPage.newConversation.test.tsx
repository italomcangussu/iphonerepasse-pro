import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import ConversationsPage from "./ConversationsPage";

const toastErrorMock = vi.fn();
const toastSuccessMock = vi.fn();
const supabaseFromMock = vi.fn();
const supabaseRpcMock = vi.fn();
const supabaseInvokeMock = vi.fn();
const conversationInsertMock = vi.fn();
const supabaseChannelMock = vi.fn();
const supabaseRemoveChannelMock = vi.fn();
const routeParams = vi.hoisted(() => ({ conversationId: undefined as string | undefined }));

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

vi.mock("../../contexts/AuthContext", () => ({
  useAuth: () => ({
    user: {
      id: "user-1",
      email: "victor@example.com",
      user_metadata: { display_name: "Victor" },
    },
  }),
}));

vi.mock("../../services/supabase", () => ({
  supabase: {
    from: (...args: any[]) => supabaseFromMock(...args),
    rpc: (...args: any[]) => supabaseRpcMock(...args),
    channel: (...args: any[]) => supabaseChannelMock(...args),
    removeChannel: (...args: any[]) => supabaseRemoveChannelMock(...args),
    functions: {
      invoke: (...args: any[]) => supabaseInvokeMock(...args),
    },
    storage: {
      from: vi.fn(),
    },
  },
}));

vi.mock("react-router-dom", () => ({
  useParams: () => routeParams,
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
const multipleConversations = [
  ...existingConversations,
  {
    id: "conversation-2",
    store_id: "store-1",
    lead_id: "lead-2",
    channel_id: "channel-1",
    status: "open",
    unread_count: 0,
    message_count: 0,
    last_message_at: "2026-05-05T13:00:00.000Z",
    crm_leads: { id: "lead-2", name: "Joao Souza", phone: "+5585888880000", avatar_url: null },
    crm_channels: { id: "channel-1", name: "WhatsApp Geral", provider: "uazapi" },
  },
];
let conversationsData: typeof existingConversations = [];
let messagesData: any[] = [];

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
    messagesData = [];
    routeParams.conversationId = undefined;
    supabaseChannelMock.mockReturnValue({
      on: vi.fn().mockReturnThis(),
      subscribe: vi.fn().mockReturnValue({ unsubscribe: vi.fn() }),
    });
    supabaseRemoveChannelMock.mockResolvedValue(undefined);
    supabaseRpcMock.mockResolvedValue({ data: "lead-1", error: null });
    supabaseInvokeMock.mockResolvedValue({
      data: { success: true, messageId: "msg-sent", providerMessageId: "provider-sent" },
      error: null,
    });
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
      if (table === "crm_messages") {
        return makeListChain(messagesData);
      }
      if (table === "user_access_roles") {
        const chain = makeListChain([{ user_id: "user-1", display_name: "Victor", email: "victor@example.com" }]);
        chain.eq = vi.fn().mockReturnValue(chain);
        chain.maybeSingle = vi.fn().mockResolvedValue({ data: { display_name: "Victor", email: "victor@example.com" }, error: null });
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

  it("selects the conversation from the route param when opened from a notification", async () => {
    conversationsData = multipleConversations;
    routeParams.conversationId = "conversation-2";

    render(<ConversationsPage />);

    await waitFor(() => {
      expect(screen.getAllByText("Joao Souza").length).toBeGreaterThan(1);
    });
    expect(await screen.findByPlaceholderText("Mensagem rápida...")).toBeInTheDocument();
  });

  it("pins the thread to the newest message after the initial messages load", async () => {
    conversationsData = existingConversations;
    messagesData = [
      {
        id: "msg-latest",
        conversation_id: "conversation-1",
        direction: "outbound",
        sender_type: "human",
        content: "Mensagem mais recente",
        created_at: "2026-05-05T12:02:00.000Z",
        status: "sent",
      },
      {
        id: "msg-oldest",
        conversation_id: "conversation-1",
        direction: "inbound",
        sender_type: "customer",
        content: "Mensagem antiga",
        created_at: "2026-05-05T12:01:00.000Z",
        status: "read",
      },
    ];
    const scrollIntoViewMock = vi.fn();
    const scrollToMock = vi.fn();
    Element.prototype.scrollIntoView = scrollIntoViewMock;
    Element.prototype.scrollTo = scrollToMock;

    render(<ConversationsPage />);

    expect(await screen.findByText("Mensagem mais recente")).toBeInTheDocument();
    await waitFor(() => {
      expect(scrollToMock).toHaveBeenCalledWith(expect.objectContaining({
        behavior: "auto",
      }));
    });
    expect(scrollIntoViewMock).not.toHaveBeenCalled();
  });

  it("keeps advanced filters inside a compact mobile filter panel", async () => {
    const user = userEvent.setup();
    conversationsData = existingConversations;
    vi.mocked(window.matchMedia).mockImplementation((query: string) => ({
      matches: true,
      media: query,
      onchange: null,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }));

    render(<ConversationsPage />);

    await screen.findByText("Maria Silva");

    expect(screen.queryByText("Todos os status")).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Filtros" }));

    expect(screen.getByText("Filtros avançados")).toBeInTheDocument();
    expect(screen.getByText("Todos os status")).toBeInTheDocument();
  });

  it("uses a compact mobile conversation header when a chat is selected", async () => {
    conversationsData = existingConversations;
    vi.mocked(window.matchMedia).mockImplementation((query: string) => ({
      matches: true,
      media: query,
      onchange: null,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }));

    render(<ConversationsPage />);

    await userEvent.click(await screen.findByText("Maria Silva"));

    const header = await screen.findByTestId("crm-conversation-compact-header");
    expect(header).toHaveClass("crm-conversation-compact-header");
    expect(within(header).getByRole("button", { name: "Voltar" })).toBeInTheDocument();
  });

  it("opens a single mobile attach sheet from the composer and closes it with Escape", async () => {
    const user = userEvent.setup();
    conversationsData = existingConversations;
    vi.mocked(window.matchMedia).mockImplementation((query: string) => ({
      matches: true,
      media: query,
      onchange: null,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }));

    render(<ConversationsPage />);

    await user.click(await screen.findByText("Maria Silva"));
    const composer = await screen.findByTestId("crm-conversation-composer");

    expect(within(composer).getByRole("button", { name: "Anexar foto, vídeo ou arquivo" })).toBeInTheDocument();
    expect(within(composer).queryByRole("button", { name: "Anexar fotos ou vídeos" })).not.toBeInTheDocument();

    await user.click(within(composer).getByRole("button", { name: "Anexar foto, vídeo ou arquivo" }));

    expect(screen.getByRole("dialog", { name: "Anexar" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Foto / Vídeo" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Arquivo" })).toBeInTheDocument();

    fireEvent.keyDown(document, { key: "Escape" });

    await waitFor(() => {
      expect(screen.queryByRole("dialog", { name: "Anexar" })).not.toBeInTheDocument();
    });
  });

  it("renders conversation rows with the refined grouped-list class", async () => {
    conversationsData = existingConversations;
    render(<ConversationsPage />);

    const row = await screen.findByRole("button", { name: /Maria Silva/i });
    expect(row).toHaveClass("crm-chat-row");
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

  it("adds an optimistic pending message to the thread before send resolves", async () => {
    conversationsData = existingConversations;
    supabaseInvokeMock.mockReturnValue(new Promise(() => undefined));

    render(<ConversationsPage />);

    const composer = await screen.findByPlaceholderText("Mensagem rápida...");
    const user = userEvent.setup();
    await user.type(composer, "Olá, tudo bem?");
    await user.click(screen.getByRole("button", { name: /enviar/i }));

    await waitFor(() => expect(composer).toHaveValue(""));
    expect(await screen.findByText("Olá, tudo bem?")).toBeInTheDocument();
    expect(screen.getByText("Enviando")).toBeInTheDocument();
    expect(supabaseInvokeMock).toHaveBeenCalledWith("crm-send-message", expect.objectContaining({
      body: expect.objectContaining({ content: "Olá, tudo bem?" }),
    }));
  });
});
