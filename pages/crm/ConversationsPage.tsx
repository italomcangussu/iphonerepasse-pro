import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, MessageCircleMore, RefreshCw, Search, Send, UserRound } from "lucide-react";
import { supabase } from "../../services/supabase";
import { useToast } from "../../components/ui/ToastProvider";
import CRMPageFrame from "../../components/crm/CRMPageFrame";
import { useCRMStore } from "../../components/crm/useCRMStore";

type ConversationRow = {
  id: string;
  lead_id: string;
  channel_id: string | null;
  status: string;
  unread_count: number;
  message_count: number;
  last_message_at: string | null;
  store_id: string;
  crm_leads?: { id: string; name: string | null; phone: string | null };
  crm_channels?: { id: string; name: string | null; provider: string | null };
};

type ConversationRawRow = Omit<ConversationRow, "crm_leads" | "crm_channels"> & {
  crm_leads?:
    | ConversationRow["crm_leads"]
    | ConversationRow["crm_leads"][]
    | null;
  crm_channels?:
    | ConversationRow["crm_channels"]
    | ConversationRow["crm_channels"][]
    | null;
};

type MessageRow = {
  id: string;
  direction: "inbound" | "outbound";
  sender_type: string;
  content: string | null;
  created_at: string;
  status: string;
};

type LoadOptions = {
  showLoader?: boolean;
  silent?: boolean;
};

const POLL_INTERVAL_MS = 15_000;
const MOBILE_MEDIA_QUERY = "(max-width: 1023px)";

const normalizeConversationRelation = <T,>(relation: T | T[] | null | undefined): T | undefined => {
  if (Array.isArray(relation)) return relation[0];
  return relation || undefined;
};

const formatConversationDate = (value: string | null): string => {
  if (!value) return "Sem atividade";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Sem atividade";

  const now = new Date();
  const isSameDay = date.toDateString() === now.toDateString();

  return isSameDay
    ? date.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })
    : date.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
};

const formatMessageDateTime = (value: string): string => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Data inválida";
  return date.toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
};

const STATUS_META: Record<string, { label: string; className: string }> = {
  open: {
    label: "Aberta",
    className: "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-200",
  },
  ai_handling: {
    label: "IA",
    className: "bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-200",
  },
  human_handling: {
    label: "Humano",
    className: "bg-sky-100 text-sky-700 dark:bg-sky-500/20 dark:text-sky-200",
  },
  closed: {
    label: "Encerrada",
    className: "bg-slate-100 text-slate-700 dark:bg-slate-500/20 dark:text-slate-200",
  },
};

const getStatusMeta = (status: string | null | undefined) => {
  return STATUS_META[String(status || "").trim()] || {
    label: status || "-",
    className: "bg-slate-100 text-slate-700 dark:bg-slate-500/20 dark:text-slate-200",
  };
};

const getLeadDisplay = (conversation: ConversationRow) => {
  return conversation.crm_leads?.name
    || conversation.crm_leads?.phone
    || conversation.lead_id;
};

const getProviderLabel = (provider: string | null | undefined) => {
  if (provider === "uazapi") return "UAZAPI";
  if (provider === "instagram_official") return "Instagram Oficial";
  return provider || "-";
};

const ConversationsPage: React.FC = () => {
  const toast = useToast();
  const { selectedStoreId, stores } = useCRMStore();

  const [isCentralized, setIsCentralized] = useState<boolean>(false);
  const [loadingConversations, setLoadingConversations] = useState(true);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [sending, setSending] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const [conversations, setConversations] = useState<ConversationRow[]>([]);
  const [selectedConversationId, setSelectedConversationId] = useState<string | null>(null);
  const [messages, setMessages] = useState<MessageRow[]>([]);
  const [draft, setDraft] = useState("");
  const [search, setSearch] = useState("");

  const [isMobileViewport, setIsMobileViewport] = useState(() => {
    if (typeof window === "undefined") return false;
    return window.matchMedia(MOBILE_MEDIA_QUERY).matches;
  });

  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const isMobileViewportRef = useRef(isMobileViewport);

  useEffect(() => {
    isMobileViewportRef.current = isMobileViewport;
  }, [isMobileViewport]);

  const selectedConversation = useMemo(
    () => conversations.find((item) => item.id === selectedConversationId) || null,
    [conversations, selectedConversationId],
  );

  const filteredConversations = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();
    if (!normalizedSearch) return conversations;

    return conversations.filter((conversation) => {
      const haystack = [
        conversation.lead_id,
        conversation.crm_leads?.name,
        conversation.crm_leads?.phone,
        conversation.crm_channels?.name,
        conversation.crm_channels?.provider,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      return haystack.includes(normalizedSearch);
    });
  }, [conversations, search]);

  const loadConversations = useCallback(async (options: LoadOptions = {}) => {
    const { showLoader = true, silent = false } = options;

    if (!isCentralized && !selectedStoreId) {
      setConversations([]);
      setSelectedConversationId(null);
      setMessages([]);
      if (showLoader) setLoadingConversations(false);
      return;
    }

    if (showLoader) setLoadingConversations(true);

    try {
      let query = supabase
        .from("crm_conversations")
        .select(`
          id,
          lead_id,
          channel_id,
          status,
          unread_count,
          message_count,
          last_message_at,
          store_id,
          crm_leads(id,name,phone),
          crm_channels(id,name,provider)
        `);

      if (!isCentralized) {
        query = query.eq("store_id", selectedStoreId);
      }

      const { data, error } = await query
        .order("last_message_at", { ascending: false })
        .limit(120);

      if (error) throw error;

      const rows: ConversationRow[] = ((data || []) as ConversationRawRow[]).map((row) => ({
        ...row,
        crm_leads: normalizeConversationRelation(row.crm_leads),
        crm_channels: normalizeConversationRelation(row.crm_channels),
      }));

      setConversations(rows);
      setSelectedConversationId((previous) => {
        if (previous && rows.some((row) => row.id === previous)) {
          return previous;
        }
        if (isMobileViewportRef.current) return null;
        return rows[0]?.id || null;
      });
    } catch (error: any) {
      if (!silent) {
        toast.error(error?.message || "Falha ao carregar conversas.");
      }
    } finally {
      if (showLoader) setLoadingConversations(false);
    }
  }, [selectedStoreId, isCentralized, toast]);

  const loadMessages = useCallback(async (
    conversationId: string | null,
    options: LoadOptions = {},
  ) => {
    const { showLoader = true, silent = false } = options;

    if (!conversationId) {
      setMessages([]);
      if (showLoader) setLoadingMessages(false);
      return;
    }

    if (showLoader) setLoadingMessages(true);

    try {
      const { data, error } = await supabase
        .from("crm_messages")
        .select("id,direction,sender_type,content,created_at,status")
        .eq("conversation_id", conversationId)
        .order("created_at", { ascending: true })
        .limit(300);

      if (error) throw error;
      setMessages((data || []) as MessageRow[]);
    } catch (error: any) {
      if (!silent) {
        toast.error(error?.message || "Falha ao carregar mensagens.");
      }
    } finally {
      if (showLoader) setLoadingMessages(false);
    }
  }, [toast]);

  const refreshAll = useCallback(async () => {
    setIsRefreshing(true);
    await loadConversations({ showLoader: false });
    await loadMessages(selectedConversationId, { showLoader: false, silent: true });
    setIsRefreshing(false);
  }, [loadConversations, loadMessages, selectedConversationId]);

  const sendMessage = useCallback(async () => {
    if (!selectedConversation || !draft.trim()) return;

    setSending(true);
    try {
      const { data, error } = await supabase.functions.invoke("crm-send-message", {
        body: {
          conversationId: selectedConversation.id,
          leadId: selectedConversation.lead_id,
          channelId: selectedConversation.channel_id,
          content: draft.trim(),
        },
      });

      if (error) throw error;
      if (data?.error) throw new Error(String(data.error));

      setDraft("");
      await Promise.all([
        loadConversations({ showLoader: false, silent: true }),
        loadMessages(selectedConversation.id, { showLoader: false }),
      ]);
      toast.success("Mensagem enviada.");
    } catch (error: any) {
      toast.error(error?.message || "Falha ao enviar mensagem.");
    } finally {
      setSending(false);
    }
  }, [draft, loadConversations, loadMessages, selectedConversation, toast]);

  useEffect(() => {
    const mediaQuery = window.matchMedia(MOBILE_MEDIA_QUERY);
    const onMediaChange = (event: MediaQueryListEvent) => {
      setIsMobileViewport(event.matches);
    };

    setIsMobileViewport(mediaQuery.matches);

    if (typeof mediaQuery.addEventListener === "function") {
      mediaQuery.addEventListener("change", onMediaChange);
      return () => mediaQuery.removeEventListener("change", onMediaChange);
    }

    mediaQuery.addListener(onMediaChange);
    return () => mediaQuery.removeListener(onMediaChange);
  }, []);

  useEffect(() => {
    async function loadGlobalSettings() {
      try {
        const { data } = await supabase
          .from("crm_settings")
          .select("value_bool")
          .eq("id", "centralized_service")
          .maybeSingle();
        if (data) setIsCentralized(data.value_bool);
      } catch (err) {
        console.error("Erro ao carregar configurações de centralização:", err);
      }
    }
    void loadGlobalSettings();
  }, []);

  useEffect(() => {
    void loadConversations();
  }, [loadConversations]);

  useEffect(() => {
    void loadMessages(selectedConversationId);
  }, [selectedConversationId, loadMessages]);

  useEffect(() => {
    if (!isCentralized && !selectedStoreId) return;

    const intervalId = window.setInterval(() => {
      void loadConversations({ showLoader: false, silent: true });
      void loadMessages(selectedConversationId, { showLoader: false, silent: true });
    }, POLL_INTERVAL_MS);

    return () => window.clearInterval(intervalId);
  }, [loadConversations, loadMessages, selectedConversationId, selectedStoreId]);

  useEffect(() => {
    if (!isCentralized && !selectedStoreId) return;

    const handleFocus = () => {
      void loadConversations({ showLoader: false, silent: true });
      void loadMessages(selectedConversationId, { showLoader: false, silent: true });
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        handleFocus();
      }
    };

    window.addEventListener("focus", handleFocus);
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      window.removeEventListener("focus", handleFocus);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [loadConversations, loadMessages, selectedConversationId, selectedStoreId]);

  useEffect(() => {
    if (!isMobileViewport && !selectedConversationId && conversations.length > 0) {
      setSelectedConversationId(conversations[0].id);
    }
  }, [conversations, isMobileViewport, selectedConversationId]);

  useEffect(() => {
    if (!selectedConversationId) return;
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages.length, selectedConversationId]);

  const listVisible = !isMobileViewport || !selectedConversationId;
  const threadVisible = !isMobileViewport || Boolean(selectedConversationId);

  const actions = (
    <button
      type="button"
      className="crm-btn crm-btn-secondary"
      onClick={() => void refreshAll()}
      disabled={isRefreshing}
    >
      <RefreshCw size={16} className={isRefreshing ? "animate-spin" : ""} />
      {isRefreshing ? "Atualizando" : "Atualizar"}
    </button>
  );

  return (
    <CRMPageFrame
      title="Conversas"
      description="Inbox operacional com lista e thread em tempo real para atendimento CRM Plus."
      actions={actions}
    >
      <div className="crm-card overflow-hidden">
        <div className="flex h-[76vh] min-h-[560px]">
          <aside
            className={`border-r border-slate-200/70 dark:border-slate-700/70 bg-white/90 dark:bg-slate-900/80 backdrop-blur-lg w-full lg:w-[360px] lg:shrink-0 ${
              listVisible ? "flex" : "hidden"
            } flex-col`}
          >
            <div className="sticky top-0 z-10 border-b border-slate-200/70 dark:border-slate-700/70 bg-white/95 dark:bg-slate-900/95 px-4 py-3 space-y-3">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <p className="text-xs uppercase tracking-[0.14em] text-slate-500">Inbox</p>
                  <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                    {filteredConversations.length} conversa(s)
                  </h2>
                </div>
                <span className="inline-flex items-center rounded-full bg-brand-100 px-2.5 py-1 text-xs font-semibold text-brand-700 dark:bg-brand-500/20 dark:text-brand-200">
                  Não lidas: {filteredConversations.reduce((acc, item) => acc + Number(item.unread_count || 0), 0)}
                </span>
              </div>
              <label className="relative block">
                <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Buscar por nome, telefone ou lead"
                  className="crm-input w-full pl-9"
                />
              </label>
            </div>

            <div className="flex-1 overflow-y-auto">
              {loadingConversations ? (
                <div className="p-4 text-sm text-slate-500">Carregando conversas...</div>
              ) : filteredConversations.length === 0 ? (
                <div className="p-4 text-sm text-slate-500">
                  {search.trim() ? "Nenhuma conversa encontrada para o filtro." : "Nenhuma conversa para a loja selecionada."}
                </div>
              ) : (
                filteredConversations.map((conversation) => {
                  const isActive = conversation.id === selectedConversationId;
                  const statusMeta = getStatusMeta(conversation.status);
                  const storeName = isCentralized
                    ? stores.find((s) => s.id === conversation.store_id)?.name
                    : null;

                  return (
                    <button
                      key={conversation.id}
                      type="button"
                      onClick={() => setSelectedConversationId(conversation.id)}
                      className={`w-full border-b border-slate-100/90 dark:border-slate-800 px-4 py-3 text-left transition-colors ${
                        isActive
                          ? "bg-brand-50/90 dark:bg-brand-500/12"
                          : "hover:bg-slate-50 dark:hover:bg-slate-800/60"
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0 flex items-center gap-2">
                          <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-slate-200 text-slate-700 dark:bg-slate-700 dark:text-slate-200">
                            <UserRound size={14} />
                          </span>
                          <div className="min-w-0">
                            <p className="truncate font-semibold text-slate-900 dark:text-slate-100">
                              {getLeadDisplay(conversation)}
                            </p>
                            <p className="truncate text-xs text-slate-500 dark:text-slate-400">
                              {storeName ? <span className="font-bold text-brand-600 dark:text-brand-400">{storeName} · </span> : null}
                              {conversation.crm_channels?.name || "Canal não definido"} · {getProviderLabel(conversation.crm_channels?.provider)}
                            </p>
                          </div>
                        </div>
                        <p className="shrink-0 text-[11px] text-slate-500 dark:text-slate-400">
                          {formatConversationDate(conversation.last_message_at)}
                        </p>
                      </div>

                      <div className="mt-2 flex items-center justify-between gap-2">
                        <span className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-semibold ${statusMeta.className}`}>
                          {statusMeta.label}
                        </span>
                        <div className="flex items-center gap-2 text-[11px] text-slate-500 dark:text-slate-400">
                          <span>Msgs: {conversation.message_count}</span>
                          {conversation.unread_count > 0 ? (
                            <span className="inline-flex min-w-5 items-center justify-center rounded-full bg-emerald-600 px-1.5 py-0.5 font-bold text-white">
                              {conversation.unread_count}
                            </span>
                          ) : null}
                        </div>
                      </div>
                    </button>
                  );
                })
              )}
            </div>
          </aside>

          <section
            className={`flex-1 min-w-0 bg-slate-50/70 dark:bg-slate-950/70 ${threadVisible ? "flex" : "hidden"} flex-col`}
          >
            {selectedConversation ? (
              <>
                <header className="sticky top-0 z-10 flex items-center gap-3 border-b border-slate-200/70 dark:border-slate-700/70 bg-white/95 dark:bg-slate-900/95 px-4 py-3 backdrop-blur">
                  {isMobileViewport ? (
                    <button
                      type="button"
                      onClick={() => setSelectedConversationId(null)}
                      className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
                      aria-label="Voltar para lista"
                    >
                      <ArrowLeft size={16} />
                    </button>
                  ) : null}

                  <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand-100 text-brand-700 dark:bg-brand-500/20 dark:text-brand-200">
                    <MessageCircleMore size={16} />
                  </span>

                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-slate-900 dark:text-slate-100">
                      {getLeadDisplay(selectedConversation)}
                    </p>
                    <p className="truncate text-xs text-slate-500 dark:text-slate-400">
                      Canal: {selectedConversation.crm_channels?.name || "N/A"} ({getProviderLabel(selectedConversation.crm_channels?.provider)})
                    </p>
                  </div>

                  <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${getStatusMeta(selectedConversation.status).className}`}>
                    {getStatusMeta(selectedConversation.status).label}
                  </span>
                </header>

                <div className="flex-1 overflow-y-auto px-4 py-4 space-y-2 bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.85),rgba(248,250,252,0.4)_45%,rgba(248,250,252,0.75))] dark:bg-[radial-gradient(circle_at_top,rgba(30,41,59,0.4),rgba(2,6,23,0.85)_55%)]">
                  {loadingMessages ? (
                    <div className="text-sm text-slate-500">Carregando mensagens...</div>
                  ) : messages.length === 0 ? (
                    <div className="text-sm text-slate-500">Nenhuma mensagem encontrada.</div>
                  ) : (
                    messages.map((message) => (
                      <article
                        key={message.id}
                        className={`max-w-[86%] rounded-2xl px-3 py-2 text-sm shadow-sm ${
                          message.direction === "outbound"
                            ? "ml-auto bg-brand-600 text-white"
                            : "bg-white text-slate-800 dark:bg-slate-800 dark:text-slate-100"
                        }`}
                      >
                        <p className="whitespace-pre-wrap wrap-break-word">{message.content || "[mensagem sem conteúdo]"}</p>
                        <p
                          className={`mt-1 text-[11px] ${
                            message.direction === "outbound"
                              ? "text-brand-100"
                              : "text-slate-500 dark:text-slate-400"
                          }`}
                        >
                          {formatMessageDateTime(message.created_at)} · {message.status}
                        </p>
                      </article>
                    ))
                  )}
                  <div ref={messagesEndRef} />
                </div>

                <footer className="border-t border-slate-200/70 dark:border-slate-700/70 bg-white/95 dark:bg-slate-900/95 p-3">
                  <div className="flex items-end gap-2">
                    <textarea
                      className="crm-input min-h-[44px] max-h-28 resize-y"
                      placeholder="Digite uma mensagem..."
                      value={draft}
                      onChange={(event) => setDraft(event.target.value)}
                      onKeyDown={(event) => {
                        if (event.key === "Enter" && !event.shiftKey) {
                          event.preventDefault();
                          void sendMessage();
                        }
                      }}
                    />
                    <button
                      type="button"
                      className="crm-btn crm-btn-primary"
                      disabled={sending || !draft.trim()}
                      onClick={() => void sendMessage()}
                    >
                      <Send size={16} />
                      {sending ? "Enviando" : "Enviar"}
                    </button>
                  </div>
                  <p className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">
                    Enter envia · Shift+Enter quebra linha
                  </p>
                </footer>
              </>
            ) : (
              <div className="flex flex-1 items-center justify-center px-6 text-center">
                <div className="max-w-sm space-y-2">
                  <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">Selecione uma conversa</p>
                  <p className="text-sm text-slate-500 dark:text-slate-400">
                    Escolha um lead na lista para visualizar histórico e responder mensagens.
                  </p>
                </div>
              </div>
            )}
          </section>
        </div>
      </div>
    </CRMPageFrame>
  );
};

export default ConversationsPage;
