import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  AlertTriangle,
  ArrowLeft,
  Bot,
  Check,
  CheckCheck,
  Clock,
  Download,
  ExternalLink,
  FileText,
  Image as ImageIcon,
  Info,
  MessageCircleMore,
  MessageSquareText,
  Mic,
  Paperclip,
  Plus,
  RefreshCw,
  Search,
  Send,
  Smartphone,
  Sparkles,
  UserRound,
  Video,
  X,
} from "lucide-react";
import { supabase } from "../../services/supabase";
import { useToast } from "../../components/ui/ToastProvider";
import CRMPageFrame from "../../components/crm/CRMPageFrame";
import Modal from "../../components/ui/Modal";
import { normalizePhone } from "../../lib/phone";
import {
  MAX_MEDIA_BATCH_ITEMS,
  buildBatchMessagePayloads,
  validateAttachmentSelection,
  type AttachmentPickerMode,
} from "./conversationMediaBatch";

type ConversationStatus = "all" | "open" | "ai_handling" | "human_handling" | "closed";
type ProviderFilter = "all" | "uazapi" | "instagram_official";

type CRMChannelRow = {
  id: string;
  store_id: string;
  name: string | null;
  provider: string | null;
  is_active: boolean | null;
};

type ConversationRow = {
  id: string;
  lead_id: string;
  channel_id: string | null;
  status: string;
  unread_count: number;
  message_count: number;
  last_message_at: string | null;
  store_id: string;
  crm_leads?: { id: string; name: string | null; phone: string | null; avatar_url?: string | null };
  crm_channels?: { id: string; name: string | null; provider: string | null };
  lastMessage?: MessagePreview | null;
};

type ConversationRawRow = Omit<ConversationRow, "crm_leads" | "crm_channels" | "lastMessage"> & {
  crm_leads?: ConversationRow["crm_leads"] | ConversationRow["crm_leads"][] | null;
  crm_channels?: ConversationRow["crm_channels"] | ConversationRow["crm_channels"][] | null;
};

type MessageRow = {
  id: string;
  conversation_id: string;
  direction: "inbound" | "outbound";
  sender_type: string;
  content: string | null;
  created_at: string;
  sent_at?: string | null;
  status: string;
  media_url?: string | null;
  media_type?: string | null;
  provider_message_id?: string | null;
  error_message?: string | null;
  reply_to_provider_message_id?: string | null;
  reply_preview_text?: string | null;
  reaction_target_provider_message_id?: string | null;
  reaction_emoji?: string | null;
};

type MessagePreview = Pick<MessageRow, "conversation_id" | "content" | "created_at" | "direction" | "media_url" | "media_type" | "status">;

type LoadOptions = {
  showLoader?: boolean;
  silent?: boolean;
};

type ComposerAttachment = {
  id: string;
  file: File;
  previewUrl: string | null;
};

type MediaViewerState = {
  url: string;
  type: "image" | "video" | "audio" | "document";
  fileName: string;
} | null;

type NewConversationForm = {
  name: string;
  phone: string;
  email: string;
  channelId: string;
};

const POLL_INTERVAL_MS = 15_000;
const MOBILE_MEDIA_QUERY = "(max-width: 1023px)";
const MESSAGE_FILE_ACCEPT_ALL = "image/*,video/*,audio/*,.pdf,.doc,.docx,.xls,.xlsx,.txt,.csv";

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

const STATUS_OPTIONS: Array<{ value: ConversationStatus; label: string }> = [
  { value: "all", label: "Todos os status" },
  { value: "open", label: "Abertas" },
  { value: "human_handling", label: "Humano" },
  { value: "ai_handling", label: "IA" },
  { value: "closed", label: "Encerradas" },
];

const toUazTalkId = (phone: string | null, provider: string | null | undefined) => {
  if (provider !== "uazapi" || !phone) return null;
  const digits = phone.replace(/\D/g, "");
  return digits ? `${digits}@s.whatsapp.net` : null;
};

const PROVIDER_OPTIONS: Array<{ value: ProviderFilter; label: string }> = [
  { value: "all", label: "Todos os provedores" },
  { value: "uazapi", label: "UAZAPI" },
  { value: "instagram_official", label: "Instagram" },
];

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

const getInitials = (value: string | null | undefined): string => {
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

const getAvatarTone = (seed: string | null | undefined): string => {
  const text = String(seed || "iphonerepasse");
  const score = Array.from(text).reduce((acc, char) => acc + char.charCodeAt(0), 0);
  return AVATAR_TONES[score % AVATAR_TONES.length];
};

const getProviderLabel = (provider: string | null | undefined) => {
  if (provider === "uazapi") return "UAZAPI";
  if (provider === "instagram_official") return "Instagram Oficial";
  return provider || "-";
};

const getProviderShortLabel = (provider: string | null | undefined) => {
  if (provider === "uazapi") return "WA";
  if (provider === "instagram_official") return "IG";
  return "CRM";
};

const getProviderDotClass = (provider: string | null | undefined) => {
  if (provider === "uazapi") return "bg-emerald-500 text-white";
  if (provider === "instagram_official") return "bg-gradient-to-br from-amber-400 via-pink-500 to-indigo-600 text-white";
  return "bg-brand-600 text-white";
};

const resolveMediaKind = (mediaType?: string | null, mediaUrl?: string | null): "image" | "video" | "audio" | "document" | null => {
  const normalized = String(mediaType || "").toLowerCase();
  const url = String(mediaUrl || "").split("?")[0].toLowerCase();
  if (!normalized && !url) return null;
  if (normalized.includes("image") || /\.(jpg|jpeg|png|webp|gif)$/i.test(url)) return "image";
  if (normalized.includes("video") || /\.(mp4|mov|webm|m4v)$/i.test(url)) return "video";
  if (normalized.includes("audio") || /\.(mp3|m4a|ogg|opus|wav|webm)$/i.test(url)) return "audio";
  return "document";
};

const getMediaLabel = (mediaType?: string | null, mediaUrl?: string | null): string => {
  const kind = resolveMediaKind(mediaType, mediaUrl);
  if (kind === "image") return "[Imagem]";
  if (kind === "video") return "[Vídeo]";
  if (kind === "audio") return "[Áudio]";
  if (kind === "document") return "[Documento]";
  return "[Mensagem]";
};

const getMediaKindLabel = (kind: ReturnType<typeof resolveMediaKind>): string => {
  if (kind === "image") return "Imagem";
  if (kind === "video") return "Vídeo";
  if (kind === "audio") return "Áudio";
  if (kind === "document") return "Documento";
  return "Mensagem";
};

const formatThreadDayLabel = (value: string): string => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Sem data";

  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);

  if (date.toDateString() === today.toDateString()) return "Hoje";
  if (date.toDateString() === yesterday.toDateString()) return "Ontem";
  return date.toLocaleDateString("pt-BR", {
    weekday: "short",
    day: "2-digit",
    month: "short",
  });
};

const getPreviewText = (message?: MessagePreview | null): string => {
  if (!message) return "Sem mensagens";
  const content = String(message.content || "").trim();
  if (content) return content;
  return getMediaLabel(message.media_type, message.media_url);
};

const getFileName = (url?: string | null, fallback = "arquivo") => {
  const clean = String(url || "").split("?")[0];
  const last = clean.split("/").filter(Boolean).pop();
  return decodeURIComponent(last || fallback);
};

const formatBytes = (bytes: number): string => {
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

const getMessageStatusLabel = (status: string | null | undefined): string => {
  const normalized = String(status || "").toLowerCase();
  if (normalized === "pending") return "Pendente";
  if (normalized === "sent") return "Enviada";
  if (normalized === "delivered") return "Entregue";
  if (normalized === "read") return "Lida";
  if (normalized === "failed") return "Falhou";
  return status || "Registrada";
};

const MessageStatusIcon: React.FC<{ status: string | null | undefined; isOutbound: boolean }> = ({ status, isOutbound }) => {
  const normalized = String(status || "").toLowerCase();
  const className = isOutbound
    ? "h-3.5 w-3.5 text-white/75"
    : "h-3.5 w-3.5 text-slate-400 dark:text-slate-500";

  if (normalized === "pending") return <Clock className={className} />;
  if (normalized === "sent") return <Check className={className} />;
  if (normalized === "delivered") return <CheckCheck className={className} />;
  if (normalized === "read") return <CheckCheck className={isOutbound ? "h-3.5 w-3.5 text-sky-100" : "h-3.5 w-3.5 text-brand-500"} />;
  if (normalized === "failed") return <AlertTriangle className={isOutbound ? "h-3.5 w-3.5 text-amber-100" : "h-3.5 w-3.5 text-red-500"} />;
  return <Clock className={className} />;
};

const MediaKindIcon: React.FC<{ kind: ReturnType<typeof resolveMediaKind>; className?: string }> = ({ kind, className = "h-4 w-4" }) => {
  if (kind === "image") return <ImageIcon className={className} />;
  if (kind === "video") return <Video className={className} />;
  if (kind === "audio") return <Mic className={className} />;
  if (kind === "document") return <FileText className={className} />;
  return <MessageSquareText className={className} />;
};

const isPreviewableAttachment = (file: File) => file.type.startsWith("image/") || file.type.startsWith("video/") || file.type.startsWith("audio/");

const getFileExtension = (file: File) => {
  const fromName = file.name.split(".").pop()?.toLowerCase();
  if (fromName && /^[a-z0-9]{1,12}$/.test(fromName)) return fromName;
  if (file.type.includes("jpeg")) return "jpg";
  if (file.type.includes("png")) return "png";
  if (file.type.includes("webp")) return "webp";
  if (file.type.includes("mp4")) return "mp4";
  if (file.type.includes("pdf")) return "pdf";
  return "bin";
};

const MessageMedia: React.FC<{
  message: MessageRow;
  onOpenMedia: (state: MediaViewerState) => void;
}> = ({ message, onOpenMedia }) => {
  const url = String(message.media_url || "").trim();
  if (!url) return null;

  const kind = resolveMediaKind(message.media_type, message.media_url) || "document";
  const fileName = getFileName(url);
  const label = getMediaKindLabel(kind);

  if (kind === "image") {
    return (
      <button
        type="button"
        className="group relative block max-w-full overflow-hidden rounded-xl border border-white/20 bg-slate-950/5 shadow-sm"
        onClick={() => onOpenMedia({ url, type: "image", fileName })}
      >
        <img src={url} alt={fileName} className="max-h-72 max-w-full rounded-xl object-cover" loading="lazy" />
        <span className="absolute left-2 top-2 inline-flex items-center gap-1 rounded-full bg-slate-950/70 px-2 py-1 text-[10px] font-bold uppercase text-white opacity-95">
          <ImageIcon size={12} />
          {label}
        </span>
      </button>
    );
  }

  if (kind === "video") {
    return (
      <button
        type="button"
        className="group relative block max-w-full overflow-hidden rounded-xl border border-white/20 bg-slate-950/10 shadow-sm"
        onClick={() => onOpenMedia({ url, type: "video", fileName })}
      >
        <video src={url} className="max-h-72 max-w-full rounded-xl" preload="metadata" muted />
        <span className="absolute left-2 top-2 inline-flex items-center gap-1 rounded-full bg-slate-950/70 px-2 py-1 text-[10px] font-bold uppercase text-white">
          <Video size={12} />
          {label}
        </span>
      </button>
    );
  }

  if (kind === "audio") {
    return (
      <div className="rounded-xl border border-slate-200 bg-white/80 p-3 shadow-sm dark:border-slate-700 dark:bg-slate-900/70">
        <div className="mb-2 flex items-center gap-2 text-xs font-semibold text-slate-600 dark:text-slate-300">
          <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-accent-100 text-accent-700 dark:bg-accent-500/20 dark:text-accent-100">
            <Mic size={14} />
          </span>
          <span className="truncate">{fileName}</span>
        </div>
        <audio src={url} controls className="w-full max-w-[320px]" />
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={() => onOpenMedia({ url, type: "document", fileName })}
      className="inline-flex max-w-full items-center gap-3 rounded-xl border border-slate-200 bg-white/85 px-3 py-3 text-left text-sm text-slate-700 shadow-sm hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 dark:hover:bg-slate-700"
    >
      <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-brand-50 text-brand-700 dark:bg-brand-500/20 dark:text-brand-100">
        <FileText size={18} />
      </span>
      <span className="min-w-0">
        <span className="block truncate font-semibold">{fileName}</span>
        <span className="mt-0.5 inline-flex items-center gap-1 text-xs text-slate-500 dark:text-slate-400">
          <ExternalLink size={12} />
          Abrir documento
        </span>
      </span>
    </button>
  );
};

const MediaViewer: React.FC<{ state: MediaViewerState; onClose: () => void }> = ({ state, onClose }) => {
  if (!state) return null;
  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/80 p-4" role="dialog" aria-modal="true">
      <button
        type="button"
        className="absolute right-4 top-4 inline-flex h-10 w-10 items-center justify-center rounded-lg bg-white/10 text-white hover:bg-white/20"
        onClick={onClose}
        aria-label="Fechar mídia"
      >
        <X size={18} />
      </button>
      {state.type === "image" ? (
        <img src={state.url} alt={state.fileName} className="max-h-[86vh] max-w-[92vw] rounded-lg object-contain" />
      ) : state.type === "video" ? (
        <video src={state.url} className="max-h-[86vh] max-w-[92vw] rounded-lg" controls autoPlay />
      ) : state.type === "audio" ? (
        <div className="w-full max-w-xl rounded-lg bg-white p-4">
          <p className="mb-3 truncate text-sm font-semibold text-slate-900">{state.fileName}</p>
          <audio src={state.url} controls className="w-full" autoPlay />
        </div>
      ) : (
        <div className="w-full max-w-xl rounded-lg bg-white p-4 text-center">
          <FileText size={34} className="mx-auto mb-3 text-slate-500" />
          <p className="mb-4 truncate text-sm font-semibold text-slate-900">{state.fileName}</p>
          <a className="crm-btn crm-btn-primary inline-flex" href={state.url} target="_blank" rel="noreferrer">
            <Download size={16} />
            Abrir documento
          </a>
        </div>
      )}
    </div>
  );
};

const ConversationsPage: React.FC = () => {
  const toast = useToast();

  const [loadingConversations, setLoadingConversations] = useState(true);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [sending, setSending] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isNewConversationOpen, setIsNewConversationOpen] = useState(false);
  const [isCreatingConversation, setIsCreatingConversation] = useState(false);
  const [channels, setChannels] = useState<CRMChannelRow[]>([]);

  const [conversations, setConversations] = useState<ConversationRow[]>([]);
  const [selectedConversationId, setSelectedConversationId] = useState<string | null>(null);
  const [messages, setMessages] = useState<MessageRow[]>([]);
  const [draft, setDraft] = useState("");
  const [search, setSearch] = useState("");
  const [showOnlyUnread, setShowOnlyUnread] = useState(false);
  const [statusFilter, setStatusFilter] = useState<ConversationStatus>("all");
  const [providerFilter, setProviderFilter] = useState<ProviderFilter>("all");
  const [channelFilter, setChannelFilter] = useState("all");
  const [attachedMedia, setAttachedMedia] = useState<ComposerAttachment[]>([]);
  const [mediaViewer, setMediaViewer] = useState<MediaViewerState>(null);
  const [newConversationForm, setNewConversationForm] = useState<NewConversationForm>({
    name: "",
    phone: "",
    email: "",
    channelId: "",
  });

  const [isMobileViewport, setIsMobileViewport] = useState(() => {
    if (typeof window === "undefined") return false;
    return window.matchMedia(MOBILE_MEDIA_QUERY).matches;
  });

  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const filePickerModeRef = useRef<AttachmentPickerMode>("single");
  const isMobileViewportRef = useRef(isMobileViewport);
  const attachedMediaRef = useRef<ComposerAttachment[]>([]);

  useEffect(() => {
    isMobileViewportRef.current = isMobileViewport;
  }, [isMobileViewport]);

  useEffect(() => {
    attachedMediaRef.current = attachedMedia;
  }, [attachedMedia]);

  const selectedConversation = useMemo(
    () => conversations.find((item) => item.id === selectedConversationId) || null,
    [conversations, selectedConversationId],
  );

  const activeChannels = useMemo(
    () => channels.filter((channel) => channel.is_active !== false),
    [channels],
  );

  const normalizedNewConversationPhone = useMemo(
    () => normalizePhone(newConversationForm.phone),
    [newConversationForm.phone],
  );

  const filteredConversations = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();

    return conversations.filter((conversation) => {
      if (showOnlyUnread && Number(conversation.unread_count || 0) <= 0) return false;
      if (statusFilter !== "all" && conversation.status !== statusFilter) return false;
      if (providerFilter !== "all" && conversation.crm_channels?.provider !== providerFilter) return false;
      if (channelFilter !== "all" && conversation.channel_id !== channelFilter) return false;

      if (!normalizedSearch) return true;
      const haystack = [
        conversation.lead_id,
        conversation.crm_leads?.name,
        conversation.crm_leads?.phone,
        conversation.crm_channels?.name,
        conversation.crm_channels?.provider,
        getPreviewText(conversation.lastMessage),
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      return haystack.includes(normalizedSearch);
    });
  }, [channelFilter, conversations, providerFilter, search, showOnlyUnread, statusFilter]);

  const unreadTotal = useMemo(
    () => filteredConversations.reduce((acc, item) => acc + Number(item.unread_count || 0), 0),
    [filteredConversations],
  );

  const loadChannels = useCallback(async (silent = false) => {
    try {
      const { data, error } = await supabase
        .from("crm_channels")
        .select("id,store_id,name,provider,is_active")
        .order("name", { ascending: true });
      if (error) throw error;
      setChannels((data || []) as CRMChannelRow[]);
    } catch (error: any) {
      if (!silent) toast.error(error?.message || "Falha ao carregar canais.");
    }
  }, [toast]);

  const loadConversations = useCallback(async (options: LoadOptions = {}) => {
    const { showLoader = true, silent = false } = options;

    if (showLoader) setLoadingConversations(true);

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
          store_id,
          crm_leads(id,name,phone,avatar_url),
          crm_channels(id,name,provider)
        `)
        .order("last_message_at", { ascending: false, nullsFirst: false })
        .limit(160);

      if (error) throw error;

      const rows: ConversationRow[] = ((data || []) as ConversationRawRow[]).map((row) => ({
        ...row,
        crm_leads: normalizeConversationRelation(row.crm_leads),
        crm_channels: normalizeConversationRelation(row.crm_channels),
        lastMessage: null,
      }));

      const conversationIds = rows.map((row) => row.id);
      if (conversationIds.length > 0) {
        const { data: lastMessages, error: lastMessagesError } = await supabase
          .from("crm_messages")
          .select("conversation_id,content,created_at,direction,media_url,media_type,status")
          .in("conversation_id", conversationIds)
          .order("created_at", { ascending: false })
          .limit(conversationIds.length * 3);

        if (lastMessagesError) throw lastMessagesError;
        const previewByConversation = new Map<string, MessagePreview>();
        ((lastMessages || []) as MessagePreview[]).forEach((message) => {
          if (!previewByConversation.has(message.conversation_id)) {
            previewByConversation.set(message.conversation_id, message);
          }
        });

        rows.forEach((row) => {
          row.lastMessage = previewByConversation.get(row.id) || null;
        });
      }

      setConversations(rows);
      setSelectedConversationId((previous) => {
        if (previous && rows.some((row) => row.id === previous)) return previous;
        if (isMobileViewportRef.current) return null;
        return rows[0]?.id || null;
      });
    } catch (error: any) {
      if (!silent) toast.error(error?.message || "Falha ao carregar conversas.");
    } finally {
      if (showLoader) setLoadingConversations(false);
    }
  }, [toast]);

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
        .select(`
          id,
          conversation_id,
          direction,
          sender_type,
          content,
          created_at,
          sent_at,
          status,
          media_url,
          media_type,
          provider_message_id,
          error_message,
          reply_to_provider_message_id,
          reply_preview_text,
          reaction_target_provider_message_id,
          reaction_emoji
        `)
        .eq("conversation_id", conversationId)
        .order("created_at", { ascending: true })
        .limit(360);

      if (error) throw error;
      setMessages((data || []) as MessageRow[]);
    } catch (error: any) {
      if (!silent) toast.error(error?.message || "Falha ao carregar mensagens.");
    } finally {
      if (showLoader) setLoadingMessages(false);
    }
  }, [toast]);

  const markSelectedAsRead = useCallback(async (conversationId: string) => {
    const readAt = new Date().toISOString();
    await Promise.all([
      supabase
        .from("crm_conversations")
        .update({ unread_count: 0, updated_at: readAt })
        .eq("id", conversationId)
        .gt("unread_count", 0),
      supabase
        .from("crm_messages")
        .update({ status: "read", read_at: readAt })
        .eq("conversation_id", conversationId)
        .eq("direction", "inbound")
        .is("read_at", null),
    ]);
  }, []);

  const refreshAll = useCallback(async () => {
    setIsRefreshing(true);
    await Promise.all([
      loadChannels(true),
      loadConversations({ showLoader: false }),
      loadMessages(selectedConversationId, { showLoader: false, silent: true }),
    ]);
    setIsRefreshing(false);
  }, [loadChannels, loadConversations, loadMessages, selectedConversationId]);

  const openNewConversationModal = useCallback(() => {
    const preferredChannel = activeChannels.find((channel) => channel.provider === "uazapi") || activeChannels[0] || channels[0];
    setNewConversationForm({
      name: "",
      phone: "",
      email: "",
      channelId: preferredChannel?.id || "",
    });
    setIsNewConversationOpen(true);
  }, [activeChannels, channels]);

  const createNewConversation = useCallback(async () => {
    const channel = channels.find((item) => item.id === newConversationForm.channelId);
    const normalizedPhone = normalizePhone(newConversationForm.phone);
    const name = newConversationForm.name.trim();
    const email = newConversationForm.email.trim();

    if (!channel) {
      toast.error("Selecione um canal para iniciar a conversa.");
      return;
    }
    if (!normalizedPhone) {
      toast.error("Informe um telefone válido.");
      return;
    }

    setIsCreatingConversation(true);
    try {
      const { data: leadId, error: upsertLeadError } = await supabase.rpc("upsert_crm_lead", {
        p_store_id: channel.store_id,
        p_phone: normalizedPhone,
        p_name: name || normalizedPhone,
        p_contact_id: null,
        p_entity_id: null,
        p_channel_id: channel.id,
        p_email: email || null,
        p_utm_source: "manual_conversation",
        p_utm_campaign: null,
        p_utm_medium: null,
        p_utm_content: null,
        p_utm_term: null,
        p_first_message: null,
        p_intent: null,
      });
      if (upsertLeadError) throw upsertLeadError;

      const resolvedLeadId = String(leadId || "").trim();
      if (!resolvedLeadId) throw new Error("Falha ao resolver o lead.");

      const { data: existingConversation, error: existingConversationError } = await supabase
        .from("crm_conversations")
        .select("id, store_id, lead_id, channel_id")
        .eq("store_id", channel.store_id)
        .eq("lead_id", resolvedLeadId)
        .maybeSingle();
      if (existingConversationError) throw existingConversationError;

      let conversationId = String(existingConversation?.id || "");
      if (!conversationId) {
        const { data: createdConversation, error: createConversationError } = await supabase
          .from("crm_conversations")
          .insert({
            store_id: channel.store_id,
            lead_id: resolvedLeadId,
            channel_id: channel.id,
            talk_id: toUazTalkId(normalizedPhone, channel.provider),
            status: "open",
            ai_enabled: true,
          })
          .select("id, store_id, lead_id, channel_id")
          .single();
        if (createConversationError) throw createConversationError;
        conversationId = String(createdConversation?.id || "");
      }

      if (!conversationId) throw new Error("Falha ao criar a conversa.");

      await supabase.rpc("crm_apply_channel_to_conversation", {
        p_conversation_id: conversationId,
        p_channel_id: channel.id,
        p_changed_by: null,
        p_reason: "manual_conversation",
      });

      setIsNewConversationOpen(false);
      setNewConversationForm({ name: "", phone: "", email: "", channelId: "" });
      await loadConversations({ showLoader: false, silent: true });
      setSelectedConversationId(conversationId);
      toast.success(existingConversation ? "Conversa localizada." : "Conversa criada.");
    } catch (error: any) {
      toast.error(error?.message || "Falha ao criar conversa.");
    } finally {
      setIsCreatingConversation(false);
    }
  }, [channels, loadConversations, newConversationForm, toast]);

  const revokeAttachmentPreview = useCallback((attachment: ComposerAttachment) => {
    if (attachment.previewUrl?.startsWith("blob:")) URL.revokeObjectURL(attachment.previewUrl);
  }, []);

  const clearAttachments = useCallback(() => {
    setAttachedMedia((previous) => {
      previous.forEach(revokeAttachmentPreview);
      return [];
    });
  }, [revokeAttachmentPreview]);

  const removeAttachment = useCallback((attachmentId: string) => {
    setAttachedMedia((previous) => {
      const next: ComposerAttachment[] = [];
      previous.forEach((attachment) => {
        if (attachment.id === attachmentId) {
          revokeAttachmentPreview(attachment);
        } else {
          next.push(attachment);
        }
      });
      return next;
    });
  }, [revokeAttachmentPreview]);

  const openFilePicker = useCallback((mode: AttachmentPickerMode = "single") => {
    if (!fileInputRef.current) return;
    filePickerModeRef.current = mode;
    fileInputRef.current.accept = mode === "media-batch" ? "image/*,video/*" : MESSAGE_FILE_ACCEPT_ALL;
    fileInputRef.current.multiple = mode === "media-batch";
    fileInputRef.current.click();
  }, []);

  const handleFileSelect = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const files: File[] = event.target.files ? Array.from(event.target.files) : [];
    const mode = filePickerModeRef.current;
    if (files.length === 0) return;

    const existingAttachmentCount = attachedMedia.length;

    const selection = validateAttachmentSelection<File>({
      files,
      mode,
      existingMediaCount: existingAttachmentCount,
    });

    if (selection.rejectedInvalidTypeFiles.length > 0) {
      toast.info("Somente imagens e vídeos entram no envio em lote.");
    }
    if (selection.rejectedOversizeFiles.length > 0) {
      toast.info("Arquivos acima de 16 MB foram ignorados.");
    }
    if (selection.rejectedOverflowFiles.length > 0) {
      toast.info(
        mode === "media-batch" || existingAttachmentCount >= MAX_MEDIA_BATCH_ITEMS
          ? `Limite de ${MAX_MEDIA_BATCH_ITEMS} anexos por envio.`
          : "Selecione apenas um arquivo por vez.",
      );
    }

    if (selection.acceptedFiles.length > 0) {
      setAttachedMedia((previous) => [
        ...previous,
        ...selection.acceptedFiles.map((file) => ({
          id: `att-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
          file,
          previewUrl: isPreviewableAttachment(file) ? URL.createObjectURL(file) : null,
        })),
      ]);
    }

    filePickerModeRef.current = "single";
    event.target.value = "";
  }, [attachedMedia, toast]);

  const uploadAttachment = useCallback(async (conversationId: string, attachment: ComposerAttachment) => {
    const fileExt = getFileExtension(attachment.file);
    const path = `${conversationId}/${Date.now()}_${Math.random().toString(36).slice(2, 10)}.${fileExt}`;

    const { data, error } = await supabase.storage
      .from("crm-media")
      .upload(path, attachment.file, {
        cacheControl: "3600",
        upsert: false,
        contentType: attachment.file.type || undefined,
      });

    if (error) throw new Error(error.message || "Falha ao enviar anexo.");

    const { data: publicUrlData } = supabase.storage.from("crm-media").getPublicUrl(data.path);
    if (!publicUrlData.publicUrl) throw new Error("Upload concluído, mas a URL pública não foi gerada.");

    return publicUrlData.publicUrl;
  }, []);

  const sendMessage = useCallback(async () => {
    if (!selectedConversation) return;
    if (!draft.trim() && attachedMedia.length === 0) return;
    if (!selectedConversation.channel_id) {
      toast.error("Conversa sem canal configurado.");
      return;
    }

    const content = draft.trim();
    const queuedAttachments = [...attachedMedia];
    setSending(true);

    try {
      if (queuedAttachments.length === 0) {
        const { data, error } = await supabase.functions.invoke("crm-send-message", {
          body: {
            conversationId: selectedConversation.id,
            leadId: selectedConversation.lead_id,
            channelId: selectedConversation.channel_id,
            content,
          },
        });

        if (error) throw error;
        if (data?.error) throw new Error(String(data.error));
      } else {
        const uploadedPayloads = [];
        for (const attachment of queuedAttachments) {
          const mediaUrl = await uploadAttachment(selectedConversation.id, attachment);
          uploadedPayloads.push({
            mediaUrl,
            mediaType: attachment.file.type || "application/octet-stream",
            mediaFilename: attachment.file.name,
          });
        }

        const batchPayloads = buildBatchMessagePayloads(uploadedPayloads, content);
        for (const payload of batchPayloads) {
          const { data, error } = await supabase.functions.invoke("crm-send-message", {
            body: {
              conversationId: selectedConversation.id,
              leadId: selectedConversation.lead_id,
              channelId: selectedConversation.channel_id,
              content: payload.content,
              mediaUrl: payload.mediaUrl,
              mediaType: payload.mediaType,
              mediaFilename: payload.mediaFilename,
            },
          });

          if (error) throw error;
          if (data?.error) throw new Error(String(data.error));
        }
      }

      setDraft("");
      clearAttachments();
      await Promise.all([
        loadConversations({ showLoader: false, silent: true }),
        loadMessages(selectedConversation.id, { showLoader: false }),
      ]);
      toast.success(queuedAttachments.length > 0 ? "Mídia enviada." : "Mensagem enviada.");
    } catch (error: any) {
      toast.error(error?.message || "Falha ao enviar mensagem.");
    } finally {
      setSending(false);
    }
  }, [attachedMedia, clearAttachments, draft, loadConversations, loadMessages, selectedConversation, toast, uploadAttachment]);

  useEffect(() => {
    const mediaQuery = window.matchMedia(MOBILE_MEDIA_QUERY);
    const onMediaChange = (event: MediaQueryListEvent) => setIsMobileViewport(event.matches);

    setIsMobileViewport(mediaQuery.matches);
    if (typeof mediaQuery.addEventListener === "function") {
      mediaQuery.addEventListener("change", onMediaChange);
      return () => mediaQuery.removeEventListener("change", onMediaChange);
    }
    mediaQuery.addListener(onMediaChange);
    return () => mediaQuery.removeListener(onMediaChange);
  }, []);

  useEffect(() => {
    void loadChannels(true);
  }, [loadChannels]);

  useEffect(() => {
    void loadConversations();
  }, [loadConversations]);

  useEffect(() => {
    void loadMessages(selectedConversationId);
  }, [selectedConversationId, loadMessages]);

  useEffect(() => {
    if (!selectedConversationId) return;
    const current = conversations.find((conversation) => conversation.id === selectedConversationId);
    if (!current || Number(current.unread_count || 0) <= 0) return;
    void markSelectedAsRead(selectedConversationId).then(() => {
      setConversations((previous) => previous.map((conversation) => (
        conversation.id === selectedConversationId ? { ...conversation, unread_count: 0 } : conversation
      )));
    });
  }, [conversations, markSelectedAsRead, selectedConversationId]);

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      void loadConversations({ showLoader: false, silent: true });
      void loadMessages(selectedConversationId, { showLoader: false, silent: true });
    }, POLL_INTERVAL_MS);

    return () => window.clearInterval(intervalId);
  }, [loadConversations, loadMessages, selectedConversationId]);

  useEffect(() => {
    const handleFocus = () => {
      void loadConversations({ showLoader: false, silent: true });
      void loadMessages(selectedConversationId, { showLoader: false, silent: true });
    };
    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") handleFocus();
    };

    window.addEventListener("focus", handleFocus);
    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => {
      window.removeEventListener("focus", handleFocus);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [loadConversations, loadMessages, selectedConversationId]);

  useEffect(() => {
    if (!isMobileViewport && !selectedConversationId && filteredConversations.length > 0) {
      setSelectedConversationId(filteredConversations[0].id);
    }
  }, [filteredConversations, isMobileViewport, selectedConversationId]);

  useEffect(() => {
    if (!selectedConversationId) return;
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages.length, selectedConversationId]);

  useEffect(() => () => {
    attachedMediaRef.current.forEach(revokeAttachmentPreview);
  }, [revokeAttachmentPreview]);

  const listVisible = !isMobileViewport || !selectedConversationId;
  const threadVisible = !isMobileViewport || Boolean(selectedConversationId);
  const selectedStatusMeta = getStatusMeta(selectedConversation?.status);
  const selectedProviderLabel = getProviderLabel(selectedConversation?.crm_channels?.provider);
  const selectedLeadName = selectedConversation ? getLeadDisplay(selectedConversation) : "";
  const selectedMediaStats = useMemo(() => {
    return messages.reduce(
      (acc, message) => {
        const kind = resolveMediaKind(message.media_type, message.media_url);
        if (!kind) return acc;
        acc.total += 1;
        acc[kind] += 1;
        return acc;
      },
      { total: 0, image: 0, video: 0, audio: 0, document: 0 },
    );
  }, [messages]);
  const threadGroups = useMemo(() => {
    const groups: Array<{ label: string; messages: MessageRow[] }> = [];
    messages.forEach((message) => {
      const label = formatThreadDayLabel(message.sent_at || message.created_at);
      const lastGroup = groups[groups.length - 1];
      if (lastGroup?.label === label) {
        lastGroup.messages.push(message);
      } else {
        groups.push({ label, messages: [message] });
      }
    });
    return groups;
  }, [messages]);

  const newConversationFooter = (
    <div className="flex justify-end gap-2">
      <button
        type="button"
        className="crm-btn crm-btn-secondary"
        onClick={() => setIsNewConversationOpen(false)}
        disabled={isCreatingConversation}
      >
        Cancelar
      </button>
      <button
        type="button"
        className="crm-btn crm-btn-primary"
        onClick={() => void createNewConversation()}
        disabled={isCreatingConversation || !newConversationForm.channelId || !normalizedNewConversationPhone}
      >
        <Plus size={16} />
        {isCreatingConversation ? "Criando" : "Criar conversa"}
      </button>
    </div>
  );

  const actions = (
    <div className="flex flex-wrap items-center gap-2">
      <button
        type="button"
        className="crm-btn crm-btn-primary"
        onClick={openNewConversationModal}
      >
        <Plus size={16} />
        Nova conversa
      </button>
      <button
        type="button"
        className="crm-btn crm-btn-secondary"
        onClick={() => void refreshAll()}
        disabled={isRefreshing}
      >
        <RefreshCw size={16} className={isRefreshing ? "animate-spin" : ""} />
        {isRefreshing ? "Atualizando" : "Atualizar"}
      </button>
    </div>
  );

  return (
    <CRMPageFrame
      title="Conversas"
      description="Inbox operacional para triagem, leitura de mídia e atendimento por canal."
      actions={actions}
    >
      <div className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-ios26-md dark:border-slate-700/70 dark:bg-slate-950">
        <div className="flex h-[78vh] min-h-[620px] bg-slate-100/70 dark:bg-slate-950">
          <aside
            className={`w-full border-r border-slate-200/80 bg-white dark:border-slate-800 dark:bg-slate-950 lg:w-[410px] lg:shrink-0 ${
              listVisible ? "flex" : "hidden"
            } flex-col`}
          >
            <div className="sticky top-0 z-10 space-y-3 border-b border-slate-200/80 bg-white/95 px-4 py-4 backdrop-blur dark:border-slate-800 dark:bg-slate-950/95">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-brand-600 dark:text-brand-300">CRM Plus</p>
                  <h2 className="mt-0.5 text-base font-semibold text-slate-950 dark:text-slate-50">
                    {filteredConversations.length} conversa(s)
                  </h2>
                </div>
                <span className="inline-flex min-w-16 items-center justify-center rounded-full bg-brand-600 px-3 py-1.5 text-xs font-bold text-white shadow-sm shadow-brand-600/20">
                  {unreadTotal} novas
                </span>
              </div>

              <label className="relative block">
                <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Buscar nome, telefone, lead ou mensagem"
                  className="crm-input w-full pl-9"
                />
              </label>

              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                <select className="crm-input" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as ConversationStatus)}>
                  {STATUS_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                </select>
                <select className="crm-input" value={providerFilter} onChange={(event) => setProviderFilter(event.target.value as ProviderFilter)}>
                  {PROVIDER_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                </select>
                <select className="crm-input sm:col-span-2" value={channelFilter} onChange={(event) => setChannelFilter(event.target.value)}>
                  <option value="all">Todos os canais</option>
                  {channels.map((channel) => (
                    <option key={channel.id} value={channel.id}>
                      {channel.name || channel.id} · {getProviderLabel(channel.provider)}
                    </option>
                  ))}
                </select>
              </div>

              <button
                type="button"
                className={`inline-flex w-fit items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold transition-colors ${
                  showOnlyUnread
                    ? "bg-emerald-600 text-white shadow-sm shadow-emerald-600/20"
                    : "bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
                }`}
                onClick={() => setShowOnlyUnread((current) => !current)}
              >
                <CheckCheck size={13} />
                Somente não lidas
              </button>
            </div>

            <div className="flex-1 space-y-1 overflow-y-auto p-2">
              {loadingConversations ? (
                <div className="p-4 text-sm text-slate-500">Carregando conversas...</div>
              ) : filteredConversations.length === 0 ? (
                <div className="p-4 text-sm text-slate-500">
                  {search.trim() || showOnlyUnread || statusFilter !== "all" || providerFilter !== "all" || channelFilter !== "all"
                    ? "Nenhuma conversa encontrada para os filtros."
                    : "Nenhuma conversa encontrada."}
                </div>
              ) : (
                filteredConversations.map((conversation) => {
                  const isActive = conversation.id === selectedConversationId;
                  const statusMeta = getStatusMeta(conversation.status);
                  const provider = conversation.crm_channels?.provider;
                  const previewText = getPreviewText(conversation.lastMessage);
                  const previewKind = resolveMediaKind(conversation.lastMessage?.media_type, conversation.lastMessage?.media_url);
                  const leadName = getLeadDisplay(conversation);
                  const hasUnread = Number(conversation.unread_count || 0) > 0;

                  return (
                    <button
                      key={conversation.id}
                      type="button"
                      onClick={() => setSelectedConversationId(conversation.id)}
                      className={`w-full rounded-xl px-3 py-3 text-left transition-all ${
                        isActive
                          ? "bg-brand-50 shadow-sm ring-1 ring-brand-200/80 dark:bg-brand-500/10 dark:ring-brand-400/20"
                          : "hover:bg-slate-50 dark:hover:bg-slate-900"
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0 flex items-center gap-3">
                          <span className={`relative inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-sm font-bold ring-2 ${getAvatarTone(conversation.lead_id)}`}>
                            {getInitials(leadName)}
                            <span className={`absolute -bottom-0.5 -right-0.5 inline-flex h-5 min-w-5 items-center justify-center rounded-full border-2 border-white px-1 text-[8px] font-black dark:border-slate-950 ${getProviderDotClass(provider)}`}>
                              {getProviderShortLabel(provider)}
                            </span>
                          </span>
                          <div className="min-w-0">
                            <p className={`truncate font-semibold ${hasUnread ? "text-slate-950 dark:text-white" : "text-slate-800 dark:text-slate-100"}`}>{leadName}</p>
                            <p className="truncate text-[11px] font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">
                              {conversation.crm_channels?.name || "Canal não definido"} · {getProviderLabel(conversation.crm_channels?.provider)}
                            </p>
                          </div>
                        </div>
                        <p className={`shrink-0 text-[11px] ${hasUnread ? "font-bold text-brand-700 dark:text-brand-200" : "text-slate-500 dark:text-slate-400"}`}>
                          {formatConversationDate(conversation.last_message_at || conversation.lastMessage?.created_at || null)}
                        </p>
                      </div>

                      <div className="mt-3 flex min-w-0 items-start gap-2">
                        {previewKind ? (
                          <span className="mt-0.5 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-300">
                            <MediaKindIcon kind={previewKind} className="h-3.5 w-3.5" />
                          </span>
                        ) : null}
                        <p className={`line-clamp-2 text-xs leading-5 ${hasUnread ? "font-semibold text-slate-700 dark:text-slate-200" : "text-slate-600 dark:text-slate-300"}`}>
                          {conversation.lastMessage?.direction === "outbound" ? "Você: " : ""}
                          {previewText}
                        </p>
                      </div>

                      <div className="mt-3 flex items-center justify-between gap-2">
                        <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-bold ${statusMeta.className}`}>
                          {statusMeta.label}
                        </span>
                        <div className="flex items-center gap-2 text-[11px] text-slate-500 dark:text-slate-400">
                          <span>Msgs: {conversation.message_count}</span>
                          {hasUnread ? (
                            <span className="inline-flex min-w-5 items-center justify-center rounded-full bg-brand-600 px-1.5 py-0.5 font-bold text-white">
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

          <section className={`min-w-0 flex-1 bg-[radial-gradient(circle_at_top_left,rgba(37,99,235,0.08),transparent_32%),linear-gradient(180deg,#f8fafc_0%,#eef4ff_100%)] dark:bg-[radial-gradient(circle_at_top_left,rgba(37,99,235,0.18),transparent_30%),linear-gradient(180deg,#020617_0%,#0f172a_100%)] ${threadVisible ? "flex" : "hidden"} flex-col`}>
            {selectedConversation ? (
              <>
                <header className="sticky top-0 z-10 flex items-center gap-3 border-b border-slate-200/80 bg-white/90 px-4 py-3 backdrop-blur-xl dark:border-slate-800 dark:bg-slate-950/90">
                  {isMobileViewport ? (
                    <button
                      type="button"
                      onClick={() => setSelectedConversationId(null)}
                      className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
                      aria-label="Voltar para lista"
                    >
                      <ArrowLeft size={16} />
                    </button>
                  ) : null}

                  <span className={`relative inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-sm font-bold ring-2 ${getAvatarTone(selectedConversation.lead_id)}`}>
                    {getInitials(selectedLeadName)}
                    <span className={`absolute -bottom-0.5 -right-0.5 inline-flex h-5 min-w-5 items-center justify-center rounded-full border-2 border-white px-1 text-[8px] font-black dark:border-slate-950 ${getProviderDotClass(selectedConversation.crm_channels?.provider)}`}>
                      {getProviderShortLabel(selectedConversation.crm_channels?.provider)}
                    </span>
                  </span>

                  <div className="min-w-0 flex-1">
                    <p className="truncate text-base font-semibold text-slate-950 dark:text-slate-50">{selectedLeadName}</p>
                    <p className="truncate text-xs text-slate-500 dark:text-slate-400">
                      {selectedConversation.crm_leads?.phone || "Telefone não informado"} · {selectedConversation.crm_channels?.name || "N/A"} · {selectedProviderLabel}
                    </p>
                  </div>

                  <span className={`hidden rounded-full px-3 py-1.5 text-xs font-bold sm:inline-flex ${selectedStatusMeta.className}`}>
                    {selectedStatusMeta.label}
                  </span>
                </header>

                <div className="flex min-h-0 flex-1">
                  <div className="min-w-0 flex-1 overflow-y-auto px-3 py-5 sm:px-5">
                    {loadingMessages ? (
                      <div className="rounded-xl bg-white/80 p-4 text-sm text-slate-500 shadow-sm dark:bg-slate-900/80">Carregando mensagens...</div>
                    ) : messages.length === 0 ? (
                      <div className="mx-auto mt-12 max-w-sm rounded-2xl border border-dashed border-slate-300 bg-white/70 p-6 text-center text-sm text-slate-500 dark:border-slate-700 dark:bg-slate-900/70 dark:text-slate-400">
                        Nenhuma mensagem encontrada.
                      </div>
                    ) : (
                      <div className="space-y-5">
                        {threadGroups.map((group) => (
                          <div key={group.label} className="space-y-3">
                            <div className="flex items-center gap-3">
                              <span className="h-px flex-1 bg-gradient-to-r from-transparent via-slate-300 to-slate-300 dark:via-slate-700 dark:to-slate-700" />
                              <span className="rounded-full border border-slate-200 bg-white/85 px-3 py-1 text-[11px] font-bold uppercase tracking-wide text-slate-500 shadow-sm dark:border-slate-700 dark:bg-slate-900/80 dark:text-slate-400">
                                {group.label}
                              </span>
                              <span className="h-px flex-1 bg-gradient-to-l from-transparent via-slate-300 to-slate-300 dark:via-slate-700 dark:to-slate-700" />
                            </div>

                            {group.messages.map((message) => {
                              const isOutbound = message.direction === "outbound";
                              const isAi = String(message.sender_type || "").toLowerCase().includes("ai");
                              const bubbleClass = isOutbound
                                ? isAi
                                  ? "ml-auto rounded-br-md border border-indigo-400/20 bg-gradient-to-br from-indigo-600 to-brand-700 text-white shadow-ios26-md"
                                  : "ml-auto rounded-br-md bg-gradient-to-br from-brand-600 to-brand-700 text-white shadow-ios26-md"
                                : "rounded-bl-md border border-slate-200 bg-white text-slate-800 shadow-sm dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100";
                              const metaTextClass = isOutbound ? "text-white/70" : "text-slate-500 dark:text-slate-400";

                              return (
                                <article
                                  key={message.id}
                                  className={`group max-w-[92%] rounded-2xl px-3 py-2.5 text-sm sm:max-w-[74%] ${bubbleClass}`}
                                >
                                  <div className={`mb-1 flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wide ${metaTextClass}`}>
                                    {isOutbound ? (isAi ? <Bot size={12} /> : <Sparkles size={12} />) : <UserRound size={12} />}
                                    <span>{isOutbound ? (isAi ? "IA iPhone Repasse" : "Atendimento") : "Cliente"}</span>
                                  </div>

                                  {message.reply_preview_text ? (
                                    <div className={`mb-2 rounded-lg border-l-2 px-2.5 py-2 text-xs ${
                                      isOutbound ? "border-white/60 bg-white/10 text-brand-50" : "border-brand-400 bg-brand-50 text-slate-600 dark:bg-brand-500/10 dark:text-slate-300"
                                    }`}>
                                      {message.reply_preview_text}
                                    </div>
                                  ) : null}

                                  <MessageMedia message={message} onOpenMedia={setMediaViewer} />

                                  {message.content ? (
                                    <p className={`${message.media_url ? "mt-2.5" : ""} whitespace-pre-wrap break-words leading-6`}>{message.content}</p>
                                  ) : !message.media_url ? (
                                    <p className="whitespace-pre-wrap break-words leading-6">[mensagem sem conteúdo]</p>
                                  ) : null}

                                  {message.reaction_emoji ? (
                                    <p className={`mt-2 inline-flex rounded-full px-2 py-0.5 text-xs ${isOutbound ? "bg-white/15 text-white" : "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300"}`}>
                                      Reação: {message.reaction_emoji}
                                    </p>
                                  ) : null}

                                  <div className={`mt-2 flex flex-wrap items-center justify-end gap-1.5 text-[11px] ${metaTextClass}`}>
                                    <span>{formatMessageDateTime(message.sent_at || message.created_at)}</span>
                                    <span>·</span>
                                    <span className="inline-flex items-center gap-1">
                                      <MessageStatusIcon status={message.status} isOutbound={isOutbound} />
                                      {getMessageStatusLabel(message.status)}
                                    </span>
                                    {message.error_message ? (
                                      <span className="inline-flex items-center gap-1 text-amber-100">
                                        <AlertTriangle size={12} />
                                        {message.error_message}
                                      </span>
                                    ) : null}
                                  </div>
                                </article>
                              );
                            })}
                          </div>
                        ))}
                      </div>
                    )}
                    <div ref={messagesEndRef} />
                  </div>

                  <aside className="hidden w-[300px] shrink-0 border-l border-slate-200/80 bg-white/82 p-4 backdrop-blur-xl dark:border-slate-800 dark:bg-slate-950/82 xl:block">
                    <div className="space-y-4">
                      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
                        <div className="flex items-center gap-3">
                          <span className={`inline-flex h-12 w-12 items-center justify-center rounded-full text-base font-bold ring-2 ${getAvatarTone(selectedConversation.lead_id)}`}>
                            {getInitials(selectedLeadName)}
                          </span>
                          <div className="min-w-0">
                            <p className="truncate text-sm font-bold text-slate-950 dark:text-white">{selectedLeadName}</p>
                            <p className="truncate text-xs text-slate-500 dark:text-slate-400">{selectedConversation.crm_leads?.phone || "Sem telefone"}</p>
                          </div>
                        </div>
                        <div className="mt-4 grid grid-cols-2 gap-2">
                          <div className="rounded-xl bg-slate-50 p-3 dark:bg-slate-800/70">
                            <p className="text-[10px] font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">Mensagens</p>
                            <p className="mt-1 text-lg font-bold text-slate-950 dark:text-white">{selectedConversation.message_count}</p>
                          </div>
                          <div className="rounded-xl bg-brand-50 p-3 dark:bg-brand-500/10">
                            <p className="text-[10px] font-bold uppercase tracking-wide text-brand-700 dark:text-brand-200">Não lidas</p>
                            <p className="mt-1 text-lg font-bold text-brand-700 dark:text-brand-100">{selectedConversation.unread_count}</p>
                          </div>
                        </div>
                      </div>

                      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
                        <div className="mb-3 flex items-center gap-2">
                          <Info size={15} className="text-brand-600 dark:text-brand-300" />
                          <p className="text-sm font-bold text-slate-950 dark:text-white">Contexto do canal</p>
                        </div>
                        <dl className="space-y-3 text-sm">
                          <div>
                            <dt className="text-[10px] font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">Status</dt>
                            <dd className={`mt-1 inline-flex rounded-full px-2.5 py-1 text-xs font-bold ${selectedStatusMeta.className}`}>{selectedStatusMeta.label}</dd>
                          </div>
                          <div>
                            <dt className="text-[10px] font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">Canal</dt>
                            <dd className="mt-1 text-slate-700 dark:text-slate-200">{selectedConversation.crm_channels?.name || "N/A"}</dd>
                          </div>
                          <div>
                            <dt className="text-[10px] font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">Telefone</dt>
                            <dd className="mt-1 inline-flex items-center gap-1.5 text-slate-700 dark:text-slate-200">
                              <Smartphone size={13} />
                              {selectedConversation.crm_leads?.phone || "Não informado"}
                            </dd>
                          </div>
                          <div>
                            <dt className="text-[10px] font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">Provider</dt>
                            <dd className="mt-1 inline-flex items-center gap-2 text-slate-700 dark:text-slate-200">
                              <span className={`inline-flex h-5 min-w-5 items-center justify-center rounded-full px-1 text-[8px] font-black ${getProviderDotClass(selectedConversation.crm_channels?.provider)}`}>
                                {getProviderShortLabel(selectedConversation.crm_channels?.provider)}
                              </span>
                              {selectedProviderLabel}
                            </dd>
                          </div>
                        </dl>
                      </div>

                      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
                        <div className="mb-3 flex items-center gap-2">
                          <Paperclip size={15} className="text-accent-600 dark:text-accent-300" />
                          <p className="text-sm font-bold text-slate-950 dark:text-white">Mídias na conversa</p>
                        </div>
                        <div className="grid grid-cols-2 gap-2 text-xs">
                          {[
                            { label: "Imagens", value: selectedMediaStats.image, kind: "image" as const },
                            { label: "Vídeos", value: selectedMediaStats.video, kind: "video" as const },
                            { label: "Áudios", value: selectedMediaStats.audio, kind: "audio" as const },
                            { label: "Docs", value: selectedMediaStats.document, kind: "document" as const },
                          ].map((item) => (
                            <div key={item.label} className="rounded-xl bg-slate-50 p-3 dark:bg-slate-800/70">
                              <div className="flex items-center gap-1.5 text-slate-500 dark:text-slate-400">
                                <MediaKindIcon kind={item.kind} className="h-3.5 w-3.5" />
                                <span>{item.label}</span>
                              </div>
                              <p className="mt-1 text-base font-bold text-slate-950 dark:text-white">{item.value}</p>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  </aside>
                </div>

                <footer className="border-t border-slate-200/80 bg-white/92 p-3 backdrop-blur-xl dark:border-slate-800 dark:bg-slate-950/92">
                  <input ref={fileInputRef} type="file" className="hidden" onChange={handleFileSelect} />

                  {attachedMedia.length > 0 ? (
                    <div className="mb-3 flex gap-2 overflow-x-auto pb-1">
                      {attachedMedia.map((attachment) => {
                        const kind = resolveMediaKind(attachment.file.type, attachment.file.name) || "document";
                        return (
                          <div key={attachment.id} className="relative flex min-w-[152px] max-w-[210px] items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 p-2 shadow-sm dark:border-slate-700 dark:bg-slate-900">
                            <button
                              type="button"
                              className="absolute -right-2 -top-2 inline-flex h-6 w-6 items-center justify-center rounded-full bg-slate-900 text-white"
                              onClick={() => removeAttachment(attachment.id)}
                              aria-label={`Remover ${attachment.file.name}`}
                            >
                              <X size={13} />
                            </button>
                            {kind === "image" && attachment.previewUrl ? (
                              <img src={attachment.previewUrl} alt={attachment.file.name} className="h-12 w-12 rounded-md object-cover" />
                            ) : kind === "video" ? (
                              <Video size={22} className="shrink-0 text-brand-600" />
                            ) : kind === "audio" ? (
                              <Mic size={22} className="shrink-0 text-accent-600" />
                            ) : (
                              <FileText size={22} className="shrink-0 text-slate-500" />
                            )}
                            <div className="min-w-0">
                              <p className="truncate text-xs font-semibold text-slate-800 dark:text-slate-100">{attachment.file.name}</p>
                              <p className="text-[11px] text-slate-500">{formatBytes(attachment.file.size)}</p>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : null}

                  <div className="flex items-end gap-2 rounded-2xl border border-slate-200 bg-white p-2 shadow-sm focus-within:border-brand-300 focus-within:ring-4 focus-within:ring-brand-500/10 dark:border-slate-700 dark:bg-slate-900">
                    <div className="flex gap-1">
                      <button
                        type="button"
                        className="inline-flex h-10 w-10 items-center justify-center rounded-xl text-slate-500 transition-colors hover:bg-slate-100 hover:text-brand-700 disabled:opacity-50 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-brand-200"
                        onClick={() => openFilePicker("single")}
                        disabled={sending}
                        title="Anexar arquivo"
                      >
                        <Paperclip size={16} />
                      </button>
                      <button
                        type="button"
                        className="inline-flex h-10 w-10 items-center justify-center rounded-xl text-slate-500 transition-colors hover:bg-slate-100 hover:text-brand-700 disabled:opacity-50 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-brand-200"
                        onClick={() => openFilePicker("media-batch")}
                        disabled={sending}
                        title="Anexar lote de fotos/vídeos"
                      >
                        <ImageIcon size={16} />
                      </button>
                    </div>
                    <textarea
                      className="min-h-[42px] max-h-28 flex-1 resize-y border-0 bg-transparent px-2 py-2 text-sm text-slate-900 outline-none placeholder:text-slate-400 dark:text-slate-100"
                      placeholder={attachedMedia.length > 0 ? "Legenda opcional..." : "Digite uma mensagem..."}
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
                      className="inline-flex h-10 shrink-0 items-center gap-2 rounded-xl bg-gradient-to-br from-brand-600 to-brand-700 px-4 text-sm font-bold text-white shadow-sm shadow-brand-600/20 transition hover:from-brand-500 hover:to-brand-700 disabled:cursor-not-allowed disabled:opacity-50"
                      disabled={sending || (!draft.trim() && attachedMedia.length === 0)}
                      onClick={() => void sendMessage()}
                    >
                      <Send size={16} />
                      {sending ? "Enviando" : "Enviar"}
                    </button>
                  </div>
                  <p className="mt-2 text-[11px] text-slate-500 dark:text-slate-400">
                    Enter envia · Shift+Enter quebra linha · anexos até 16 MB
                  </p>
                </footer>
              </>
            ) : (
              <div className="flex flex-1 items-center justify-center px-6 text-center">
                <div className="max-w-sm space-y-3 rounded-2xl border border-dashed border-slate-300 bg-white/70 p-8 shadow-sm dark:border-slate-700 dark:bg-slate-900/70">
                  <span className="mx-auto inline-flex h-12 w-12 items-center justify-center rounded-full bg-brand-100 text-brand-700 dark:bg-brand-500/20 dark:text-brand-100">
                    <MessageCircleMore size={22} />
                  </span>
                  <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">Selecione uma conversa</p>
                  <p className="text-sm text-slate-500 dark:text-slate-400">
                    Escolha um lead na lista para visualizar histórico, mídias e responder mensagens.
                  </p>
                </div>
              </div>
            )}
          </section>
        </div>
      </div>

      <MediaViewer state={mediaViewer} onClose={() => setMediaViewer(null)} />
      <Modal
        open={isNewConversationOpen}
        onClose={() => setIsNewConversationOpen(false)}
        title="Nova conversa"
        size="md"
        footer={newConversationFooter}
        initialFocusSelector="#new-conversation-lead-name"
      >
        <div className="space-y-4">
          <label className="block">
            <span className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-200">Nome do lead</span>
            <input
              id="new-conversation-lead-name"
              className="crm-input w-full"
              value={newConversationForm.name}
              onChange={(event) => setNewConversationForm((current) => ({ ...current, name: event.target.value }))}
              placeholder="Nome do contato"
            />
          </label>

          <label className="block">
            <span className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-200">Telefone</span>
            <input
              className="crm-input w-full"
              value={newConversationForm.phone}
              onChange={(event) => setNewConversationForm((current) => ({ ...current, phone: event.target.value }))}
              placeholder="(85) 99999-0000"
              inputMode="tel"
            />
            {normalizedNewConversationPhone ? (
              <span className="mt-1 block text-xs text-slate-500 dark:text-slate-400">
                Envio UAZAPI: {normalizedNewConversationPhone}
              </span>
            ) : null}
          </label>

          <label className="block">
            <span className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-200">E-mail</span>
            <input
              className="crm-input w-full"
              value={newConversationForm.email}
              onChange={(event) => setNewConversationForm((current) => ({ ...current, email: event.target.value }))}
              placeholder="email@exemplo.com"
              type="email"
            />
          </label>

          <label className="block">
            <span className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-200">Canal</span>
            <select
              className="crm-input w-full"
              value={newConversationForm.channelId}
              onChange={(event) => setNewConversationForm((current) => ({ ...current, channelId: event.target.value }))}
            >
              <option value="">Selecione um canal</option>
              {activeChannels.map((channel) => (
                <option key={channel.id} value={channel.id}>
                  {channel.name || channel.id} · {getProviderLabel(channel.provider)}
                </option>
              ))}
            </select>
          </label>
        </div>
      </Modal>
    </CRMPageFrame>
  );
};

export default ConversationsPage;
