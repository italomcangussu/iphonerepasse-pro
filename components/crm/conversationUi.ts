import { getConversationAvatarUrl, getConversationDisplayName, isGroupConversation } from "../../lib/crm/conversationGroup";

export type ConversationStatus = "all" | "open" | "ai_handling" | "human_handling" | "closed";
export type ProviderFilter = "all" | "uazapi" | "instagram_official";

export type CRMChannelRow = { id: string; store_id: string; name: string | null; provider: string | null; is_active: boolean | null };

export type MessagePreview = {
  conversation_id: string;
  content: string | null;
  created_at: string;
  sent_at?: string | null;
  direction: string;
  media_url?: string | null;
  media_type?: string | null;
  status: string;
};

export type ConversationRow = {
  id: string;
  lead_id: string;
  channel_id: string | null;
  status: string;
  ai_enabled?: boolean | null;
  unread_count: number;
  message_count: number;
  last_message_at: string | null;
  store_id: string;
  is_group?: boolean | null;
  group_name?: string | null;
  group_avatar_url?: string | null;
  crm_leads?: {
    id: string;
    name: string | null;
    phone: string | null;
    avatar_url?: string | null;
    conversation_status?: string | null;
    attendance_owner?: string | null;
    human_started_at?: string | null;
    last_agent_type?: string | null;
  };
  crm_channels?: { id: string; name: string | null; provider: string | null; ai_resume_webhook_url?: string | null };
  lastMessage?: MessagePreview | null;
};

export type FilterView = {
  id: string;
  user_id: string;
  name: string;
  filters_json: Record<string, unknown>;
  is_shared: boolean;
  created_at: string;
};

export type FilterSnapshot = {
  statusFilter: ConversationStatus;
  providerFilter: ProviderFilter;
  channelFilter: string;
  showOnlyUnread: boolean;
};

export const formatConversationDate = (value: string | null): string => {
  if (!value) return "Sem atividade";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Sem atividade";
  const now = new Date();
  return date.toDateString() === now.toDateString()
    ? date.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })
    : date.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
};

export const resolveMediaKind = (mediaType?: string | null, mediaUrl?: string | null): "image" | "video" | "audio" | "document" | null => {
  const n = String(mediaType || "").toLowerCase();
  const u = String(mediaUrl || "").split("?")[0].toLowerCase();
  if (!n && !u) return null;
  if (n.includes("image") || /\.(jpg|jpeg|png|webp|gif)$/i.test(u)) return "image";
  if (n.includes("audio") || /\.(mp3|m4a|ogg|opus|wav)$/i.test(u)) return "audio";
  if (n.includes("video") || /\.(mp4|mov|webm|m4v)$/i.test(u)) return "video";
  return "document";
};

export const getMediaLabel = (mediaType?: string | null, mediaUrl?: string | null): string => {
  const kind = resolveMediaKind(mediaType, mediaUrl);
  if (kind === "image") return "[Imagem]";
  if (kind === "video") return "[Vídeo]";
  if (kind === "audio") return "[Áudio]";
  if (kind === "document") return "[Documento]";
  return "[Mensagem]";
};

export const getPreviewText = (msg?: MessagePreview | null): string => {
  if (!msg) return "Sem mensagens";
  const content = String(msg.content || "").trim();
  return content || getMediaLabel(msg.media_type, msg.media_url);
};

export const getLeadDisplay = (conv: ConversationRow) => getConversationDisplayName(conv);

export const applyLeadAvatarUpdate = (
  conversations: ConversationRow[],
  lead: { id: string; avatar_url?: string | null },
): ConversationRow[] => {
  let changed = false;
  const next = conversations.map((conversation) => {
    if (
      conversation.lead_id !== lead.id || !conversation.crm_leads ||
      conversation.crm_leads.avatar_url === lead.avatar_url
    ) {
      return conversation;
    }
    changed = true;
    return {
      ...conversation,
      crm_leads: {
        ...conversation.crm_leads,
        avatar_url: lead.avatar_url ?? null,
      },
    };
  });
  return changed ? next : conversations;
};

export const getInitials = (value: string | null | undefined): string => {
  const text = String(value || "").trim();
  if (!text) return "IR";
  const parts = text.split(/\s+/).filter(Boolean);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0] || ""}${parts[parts.length - 1][0] || ""}`.toUpperCase();
};

const AVATAR_TONES = [
  "bg-gradient-to-br from-brand-100 to-brand-300 text-brand-800 ring-brand-200/70 dark:from-brand-500/25 dark:to-brand-700/40 dark:text-brand-100 dark:ring-brand-400/20",
  "bg-gradient-to-br from-sky-100 to-cyan-200 text-sky-800 ring-sky-200/70 dark:from-sky-500/20 dark:to-cyan-500/20 dark:text-sky-100 dark:ring-sky-400/20",
  "bg-gradient-to-br from-emerald-100 to-teal-200 text-emerald-800 ring-emerald-200/70 dark:from-emerald-500/20 dark:to-teal-500/20 dark:text-emerald-100 dark:ring-emerald-400/20",
  "bg-gradient-to-br from-orange-100 to-accent-200 text-accent-800 ring-accent-200/70 dark:from-accent-500/20 dark:to-orange-500/20 dark:text-accent-100 dark:ring-accent-400/20",
  "bg-gradient-to-br from-slate-100 to-slate-300 text-slate-800 ring-slate-200/70 dark:from-slate-700 dark:to-slate-800 dark:text-slate-100 dark:ring-slate-600/50",
];

export const getAvatarTone = (seed: string | null | undefined): string => {
  const text = String(seed || "iphonerepasse");
  const score = Array.from(text).reduce((acc, c) => acc + c.charCodeAt(0), 0);
  return AVATAR_TONES[score % AVATAR_TONES.length];
};

export const getProviderLabel = (p: string | null | undefined) => p === "uazapi" ? "UAZAPI" : p === "instagram_official" ? "Instagram Oficial" : p || "-";
export const getProviderShortLabel = (p: string | null | undefined) => p === "uazapi" ? "WA" : p === "instagram_official" ? "IG" : "CRM";
export const getProviderDotClass = (p: string | null | undefined) => p === "uazapi" ? "bg-emerald-500 text-white" : p === "instagram_official" ? "bg-gradient-to-br from-amber-400 via-pink-500 to-indigo-600 text-white" : "bg-brand-600 text-white";

export const isTransferPendingConversation = (conv: ConversationRow | null | undefined): boolean =>
  conv?.crm_leads?.conversation_status === "transferencia_pendente";

export const isAIHandlingConversation = (conv: ConversationRow | null | undefined): boolean =>
  conv?.status === "ai_handling" || conv?.ai_enabled === true;

export const hasAIResumeWebhook = (conv: ConversationRow | null | undefined): boolean =>
  Boolean(conv?.crm_channels?.ai_resume_webhook_url?.trim().startsWith("https://"));

const STATUS_META: Record<string, { label: string; className: string }> = {
  open: { label: "Aberta", className: "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-200" },
  ai_handling: { label: "IA", className: "bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-200" },
  human_handling: { label: "Humano", className: "bg-sky-100 text-sky-700 dark:bg-sky-500/20 dark:text-sky-200" },
  closed: { label: "Encerrada", className: "bg-slate-100 text-slate-700 dark:bg-slate-500/20 dark:text-slate-200" },
};

export const getStatusMeta = (status: string | null | undefined) =>
  STATUS_META[String(status || "").trim()] || { label: status || "-", className: "bg-slate-100 text-slate-700" };

export const STATUS_OPTIONS: Array<{ value: ConversationStatus; label: string }> = [
  { value: "all", label: "Todos os status" },
  { value: "open", label: "Abertas" },
  { value: "human_handling", label: "Humano" },
  { value: "ai_handling", label: "IA" },
  { value: "closed", label: "Encerradas" },
];

export const PROVIDER_OPTIONS: Array<{ value: ProviderFilter; label: string }> = [
  { value: "all", label: "Todos os provedores" },
  { value: "uazapi", label: "UAZAPI" },
  { value: "instagram_official", label: "Instagram" },
];

export { getConversationAvatarUrl, isGroupConversation };
