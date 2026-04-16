import React, { useEffect, useMemo, useState } from "react";
import { Send } from "lucide-react";
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

const normalizeConversationRelation = <T,>(relation: T | T[] | null | undefined): T | undefined => {
  if (Array.isArray(relation)) return relation[0];
  return relation || undefined;
};

type MessageRow = {
  id: string;
  direction: "inbound" | "outbound";
  sender_type: string;
  content: string | null;
  created_at: string;
  status: string;
};

const ConversationsPage: React.FC = () => {
  const toast = useToast();
  const { selectedStoreId } = useCRMStore();
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [conversations, setConversations] = useState<ConversationRow[]>([]);
  const [selectedConversationId, setSelectedConversationId] = useState<string>("");
  const [messages, setMessages] = useState<MessageRow[]>([]);
  const [draft, setDraft] = useState("");

  const selectedConversation = useMemo(
    () => conversations.find((item) => item.id === selectedConversationId) || null,
    [conversations, selectedConversationId],
  );

  const loadConversations = async () => {
    if (!selectedStoreId) return;
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("crm_conversations")
        .select(`
          id,
          lead_id,
          channel_id,
          status,
          unread_count,
          message_count,
          last_message_at,
          crm_leads(id,name,phone),
          crm_channels(id,name,provider)
        `)
        .eq("store_id", selectedStoreId)
        .order("last_message_at", { ascending: false })
        .limit(120);

      if (error) throw error;
      const rows: ConversationRow[] = ((data || []) as ConversationRawRow[]).map((row) => ({
        ...row,
        crm_leads: normalizeConversationRelation(row.crm_leads),
        crm_channels: normalizeConversationRelation(row.crm_channels),
      }));
      setConversations(rows);
      if (rows.length > 0 && !rows.some((row) => row.id === selectedConversationId)) {
        setSelectedConversationId(rows[0].id);
      }
    } catch (error: any) {
      toast.error(error?.message || "Falha ao carregar conversas.");
    } finally {
      setLoading(false);
    }
  };

  const loadMessages = async () => {
    if (!selectedConversationId) return;
    try {
      const { data, error } = await supabase
        .from("crm_messages")
        .select("id,direction,sender_type,content,created_at,status")
        .eq("conversation_id", selectedConversationId)
        .order("created_at", { ascending: true })
        .limit(300);

      if (error) throw error;
      setMessages((data || []) as MessageRow[]);
    } catch (error: any) {
      toast.error(error?.message || "Falha ao carregar mensagens.");
    }
  };

  useEffect(() => {
    void loadConversations();
  }, [selectedStoreId]);

  useEffect(() => {
    void loadMessages();
  }, [selectedConversationId]);

  const sendMessage = async () => {
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
      await loadConversations();
      await loadMessages();
      toast.success("Mensagem enviada.");
    } catch (error: any) {
      toast.error(error?.message || "Falha ao enviar mensagem.");
    } finally {
      setSending(false);
    }
  };

  return (
    <CRMPageFrame title="Conversas" description="Inbox unificado de atendimento manual e automações CRM Plus.">
      <div className="grid grid-cols-1 xl:grid-cols-5 gap-4">
        <div className="xl:col-span-2 crm-card p-0 overflow-hidden">
          <div className="max-h-[74vh] overflow-y-auto">
            {loading ? (
              <div className="p-4 text-sm text-slate-500">Carregando conversas...</div>
            ) : conversations.length === 0 ? (
              <div className="p-4 text-sm text-slate-500">Nenhuma conversa para a loja selecionada.</div>
            ) : (
              conversations.map((conversation) => (
                <button
                  key={conversation.id}
                  type="button"
                  onClick={() => setSelectedConversationId(conversation.id)}
                  className={`w-full px-4 py-3 text-left border-b border-slate-100 transition ${
                    conversation.id === selectedConversationId ? "bg-brand-50" : "hover:bg-slate-50"
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <p className="font-semibold text-slate-900 truncate">
                      {conversation.crm_leads?.name || conversation.crm_leads?.phone || conversation.lead_id}
                    </p>
                    <span className="text-[11px] px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">
                      {conversation.status}
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 truncate">
                    {conversation.crm_channels?.name || "Canal não definido"} · {conversation.crm_channels?.provider || "-"}
                  </p>
                  <p className="text-xs text-slate-500 mt-1">
                    Mensagens: {conversation.message_count} · Não lidas: {conversation.unread_count}
                  </p>
                </button>
              ))
            )}
          </div>
        </div>

        <div className="xl:col-span-3 crm-card p-4 flex flex-col gap-3 min-h-[520px]">
          {selectedConversation ? (
            <>
              <div className="border-b border-slate-200 pb-2">
                <p className="font-semibold text-slate-900">
                  {selectedConversation.crm_leads?.name || selectedConversation.crm_leads?.phone || selectedConversation.lead_id}
                </p>
                <p className="text-xs text-slate-500">
                  Canal: {selectedConversation.crm_channels?.name || "N/A"} ({selectedConversation.crm_channels?.provider || "-"})
                </p>
              </div>

              <div className="flex-1 overflow-y-auto space-y-2 pr-1 max-h-[50vh]">
                {messages.length === 0 ? (
                  <div className="text-sm text-slate-500">Nenhuma mensagem encontrada.</div>
                ) : (
                  messages.map((message) => (
                    <div
                      key={message.id}
                      className={`rounded-xl px-3 py-2 text-sm max-w-[85%] ${
                        message.direction === "outbound"
                          ? "ml-auto bg-brand-600 text-white"
                          : "bg-slate-100 text-slate-800"
                      }`}
                    >
                      <p>{message.content || "[mensagem sem conteúdo]"}</p>
                      <p className={`text-[11px] mt-1 ${message.direction === "outbound" ? "text-blue-100" : "text-slate-500"}`}>
                        {new Date(message.created_at).toLocaleString("pt-BR")} · {message.status}
                      </p>
                    </div>
                  ))
                )}
              </div>

              <div className="flex gap-2">
                <input
                  className="crm-input"
                  placeholder="Digite uma mensagem..."
                  value={draft}
                  onChange={(event) => setDraft(event.target.value)}
                />
                <button type="button" className="crm-btn crm-btn-primary" disabled={sending} onClick={() => void sendMessage()}>
                  <Send size={16} />
                  {sending ? "Enviando..." : "Enviar"}
                </button>
              </div>
            </>
          ) : (
            <div className="text-sm text-slate-500">Selecione uma conversa para visualizar mensagens.</div>
          )}
        </div>
      </div>
    </CRMPageFrame>
  );
};

export default ConversationsPage;
