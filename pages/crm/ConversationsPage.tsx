import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import { useDisclosure } from '../../hooks/useDisclosure';
import { m, AnimatePresence } from "framer-motion";
import {
  ArrowDown,
  ArrowLeft,
  Bookmark,
  BookmarkCheck,
  Bot,
  EyeOff,
  Eye,
  FileText,
  Image as ImageIcon,
  Info,
  Mic,
  MoreVertical,
  Paperclip,
  Plus,
  RefreshCw,
  Reply,
  Search,
  Send,
  SlidersHorizontal,
  Trash2,
  UsersRound,
  Video,
  X,
} from "lucide-react";
import { supabase } from "../../services/supabase";
import { assertNoError } from "../../utils/supabase";
import { useToast } from "../../components/ui/ToastProvider";
import CRMPageFrame from "../../components/crm/CRMPageFrame";
import Modal from "../../components/ui/Modal";
import MessageBubble, { type MessageBubbleMessage } from "../../components/crm/MessageBubble";
import AudioRecorder from "../../components/crm/AudioRecorder";
import PermissionRequest from "../../components/pwa/PermissionRequest";
import { usePermissionState } from "../../hooks/usePermissionState";
import { normalizePhone } from "../../lib/phone";
import { groupReactions } from "../../lib/crm/groupReactions";
import { getConversationAvatarUrl, getConversationDisplayName, isGroupConversation } from "../../lib/crm/conversationGroup";
import { resolveMetaCampaignPreviewData } from "../../lib/crm/messageUtils";
import { useMessagesPagination } from "../../hooks/useMessagesPagination";
import { useAuth } from "../../contexts/AuthContext";
import {
  MAX_MEDIA_BATCH_ITEMS,
  buildBatchMessagePayloads,
  ensurePublicMediaUrlReady,
  validateAttachmentSelection,
  type AttachmentPickerMode,
} from "./conversationMediaBatch";

// ─── Types ─────────────────────────────────────────────────────────────────────

type ConversationStatus = "all" | "open" | "ai_handling" | "human_handling" | "closed";
type ProviderFilter = "all" | "uazapi" | "instagram_official";

type CRMChannelRow = { id: string; store_id: string; name: string | null; provider: string | null; is_active: boolean | null };

type ConversationRow = {
  id: string; lead_id: string; channel_id: string | null; status: string;
  ai_enabled?: boolean | null; unread_count: number; message_count: number; last_message_at: string | null; store_id: string;
  is_group?: boolean | null; group_name?: string | null; group_avatar_url?: string | null;
  crm_leads?: { id: string; name: string | null; phone: string | null; avatar_url?: string | null; conversation_status?: string | null; attendance_owner?: string | null; human_started_at?: string | null; last_agent_type?: string | null };
  crm_channels?: { id: string; name: string | null; provider: string | null; ai_resume_webhook_url?: string | null };
  lastMessage?: MessagePreview | null;
};

type ConversationRawRow = Omit<ConversationRow, "crm_leads" | "crm_channels" | "lastMessage"> & {
  crm_leads?: ConversationRow["crm_leads"] | ConversationRow["crm_leads"][] | null;
  crm_channels?: ConversationRow["crm_channels"] | ConversationRow["crm_channels"][] | null;
};

type MessagePreview = { conversation_id: string; content: string | null; created_at: string; direction: string; media_url?: string | null; media_type?: string | null; status: string };

type ComposerAttachment = { id: string; file: File; previewUrl: string | null };

type MediaViewerState = { url: string; type: "image" | "video" | "audio" | "document"; fileName: string } | null;

type NewConversationForm = { name: string; phone: string; email: string; channelId: string };

type ReplyingTo = { id: string; provider_message_id?: string | null; content: string | null; direction: string; sender_type: string } | null;

type MessageActionTarget = MessageBubbleMessage | null;

type FilterView = {
  id: string;
  user_id: string;
  name: string;
  filters_json: Record<string, unknown>;
  is_shared: boolean;
  created_at: string;
};

type FilterSnapshot = {
  statusFilter: ConversationStatus;
  providerFilter: ProviderFilter;
  channelFilter: string;
  showOnlyUnread: boolean;
};

// ─── Constants ─────────────────────────────────────────────────────────────────

const POLL_INTERVAL_MS = 15_000;
const MOBILE_MEDIA_QUERY = "(max-width: 1023px)";
const MESSAGE_FILE_ACCEPT_ALL = "image/*,video/*,audio/*,.pdf,.doc,.docx,.xls,.xlsx,.txt,.csv";
const FILTERS_COLLAPSED_KEY = "crmplus.filters.collapsed";

// ─── Small helpers ──────────────────────────────────────────────────────────────

const normalizeConversationRelation = <T,>(rel: T | T[] | null | undefined): T | undefined => Array.isArray(rel) ? rel[0] : rel || undefined;

const formatConversationDate = (value: string | null): string => {
  if (!value) return "Sem atividade";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Sem atividade";
  const now = new Date();
  return date.toDateString() === now.toDateString()
    ? date.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })
    : date.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
};

const formatThreadDayLabel = (value: string): string => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Sem data";
  const today = new Date();
  const yesterday = new Date(); yesterday.setDate(today.getDate() - 1);
  if (date.toDateString() === today.toDateString()) return "Hoje";
  if (date.toDateString() === yesterday.toDateString()) return "Ontem";
  return date.toLocaleDateString("pt-BR", { weekday: "short", day: "2-digit", month: "short" });
};

const resolveMediaKind = (mediaType?: string | null, mediaUrl?: string | null): "image" | "video" | "audio" | "document" | null => {
  const n = String(mediaType || "").toLowerCase();
  const u = String(mediaUrl || "").split("?")[0].toLowerCase();
  if (!n && !u) return null;
  if (n.includes("image") || /\.(jpg|jpeg|png|webp|gif)$/i.test(u)) return "image";
  if (n.includes("audio") || /\.(mp3|m4a|ogg|opus|wav)$/i.test(u)) return "audio";
  if (n.includes("video") || /\.(mp4|mov|webm|m4v)$/i.test(u)) return "video";
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

const getPreviewText = (msg?: MessagePreview | null): string => {
  if (!msg) return "Sem mensagens";
  const content = String(msg.content || "").trim();
  return content || getMediaLabel(msg.media_type, msg.media_url);
};

const getLeadDisplay = (conv: ConversationRow) => getConversationDisplayName(conv);

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
  const score = Array.from(text).reduce((acc, c) => acc + c.charCodeAt(0), 0);
  return AVATAR_TONES[score % AVATAR_TONES.length];
};

const getProviderLabel = (p: string | null | undefined) => p === "uazapi" ? "UAZAPI" : p === "instagram_official" ? "Instagram Oficial" : p || "-";
const getProviderShortLabel = (p: string | null | undefined) => p === "uazapi" ? "WA" : p === "instagram_official" ? "IG" : "CRM";
const getProviderDotClass = (p: string | null | undefined) => p === "uazapi" ? "bg-emerald-500 text-white" : p === "instagram_official" ? "bg-gradient-to-br from-amber-400 via-pink-500 to-indigo-600 text-white" : "bg-brand-600 text-white";
const isTransferPendingConversation = (conv: ConversationRow | null | undefined): boolean =>
  conv?.crm_leads?.conversation_status === "transferencia_pendente";
const isAIHandlingConversation = (conv: ConversationRow | null | undefined): boolean =>
  conv?.status === "ai_handling" || conv?.ai_enabled === true;
const hasAIResumeWebhook = (conv: ConversationRow | null | undefined): boolean =>
  Boolean(conv?.crm_channels?.ai_resume_webhook_url?.trim().startsWith("https://"));

const STATUS_META: Record<string, { label: string; className: string }> = {
  open: { label: "Aberta", className: "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-200" },
  ai_handling: { label: "IA", className: "bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-200" },
  human_handling: { label: "Humano", className: "bg-sky-100 text-sky-700 dark:bg-sky-500/20 dark:text-sky-200" },
  closed: { label: "Encerrada", className: "bg-slate-100 text-slate-700 dark:bg-slate-500/20 dark:text-slate-200" },
};

const getStatusMeta = (status: string | null | undefined) => STATUS_META[String(status || "").trim()] || { label: status || "-", className: "bg-slate-100 text-slate-700" };

const STATUS_OPTIONS: Array<{ value: ConversationStatus; label: string }> = [
  { value: "all", label: "Todos os status" }, { value: "open", label: "Abertas" },
  { value: "human_handling", label: "Humano" }, { value: "ai_handling", label: "IA" }, { value: "closed", label: "Encerradas" },
];

const PROVIDER_OPTIONS: Array<{ value: ProviderFilter; label: string }> = [
  { value: "all", label: "Todos os provedores" }, { value: "uazapi", label: "UAZAPI" }, { value: "instagram_official", label: "Instagram" },
];

const toUazTalkId = (phone: string | null, provider: string | null | undefined) => {
  if (provider !== "uazapi" || !phone) return null;
  const digits = phone.replace(/\D/g, "");
  return digits ? `${digits}@s.whatsapp.net` : null;
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

const formatBytes = (bytes: number): string => bytes < 1024 * 1024 ? `${(bytes / 1024).toFixed(1)} KB` : `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
const isPdfDocument = (state: NonNullable<MediaViewerState>) =>
  state.type === "document" && (
    state.fileName.toLowerCase().endsWith(".pdf") ||
    state.url.split("?")[0].toLowerCase().endsWith(".pdf")
  );

// ─── MediaViewer ───────────────────────────────────────────────────────────────

const MediaViewer: React.FC<{ state: MediaViewerState; onClose: () => void }> = ({ state, onClose }) => {
  if (!state) return null;
  return (
    <div className="fixed inset-0 z-80 flex items-center justify-center bg-black/80 p-4" role="dialog" aria-modal="true">
      <button type="button" className="absolute right-4 top-4 inline-flex h-10 w-10 items-center justify-center rounded-lg bg-white/10 text-white hover:bg-white/20" onClick={onClose} aria-label="Fechar mídia">
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
      ) : isPdfDocument(state) ? (
        <div className="flex h-[86vh] w-full max-w-5xl flex-col overflow-hidden rounded-lg bg-white shadow-2xl">
          <div className="flex items-center justify-between gap-3 border-b border-slate-200 px-4 py-3">
            <div className="flex min-w-0 items-center gap-2">
              <FileText size={18} className="shrink-0 text-brand-600" />
              <p className="truncate text-sm font-semibold text-slate-900">{state.fileName}</p>
            </div>
            <a className="crm-btn crm-btn-secondary shrink-0 text-xs" href={state.url} download>
              Baixar
            </a>
          </div>
          <iframe src={state.url} title={state.fileName} className="min-h-0 flex-1 bg-slate-100" />
        </div>
      ) : (
        <div className="w-full max-w-xl rounded-lg bg-white p-5 text-center shadow-2xl">
          <FileText size={38} className="mx-auto mb-3 text-brand-600" />
          <p className="mb-1 truncate text-sm font-semibold text-slate-900">{state.fileName}</p>
          <p className="mb-4 text-xs text-slate-500">Prévia indisponível para este formato.</p>
          <div className="flex flex-wrap justify-center gap-2">
            <a className="crm-btn crm-btn-secondary inline-flex" href={state.url} download>Baixar</a>
            <a className="crm-btn crm-btn-primary inline-flex" href={state.url} target="_blank" rel="noreferrer">Abrir em nova aba</a>
          </div>
        </div>
      )}
    </div>
  );
};

// ─── Main page ─────────────────────────────────────────────────────────────────

const ConversationsPage: React.FC = () => {
  const toast = useToast();
  const { user } = useAuth();
  const { conversationId: routeConversationId } = useParams<{ conversationId?: string }>();

  // ── layout & loading states
  const [loadingConversations, setLoadingConversations] = useState(true);
  const [sending, setSending] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const { isOpen: isNewConversationOpen, open: openNewConversation, close: closeNewConversation } = useDisclosure();
  const [isCreatingConversation, setIsCreatingConversation] = useState(false);
  const [isLeadInfoOpen, setIsLeadInfoOpen] = useState(false);
  const [isLeadOptionsOpen, setIsLeadOptionsOpen] = useState(false);
  const [isDeletingLead, setIsDeletingLead] = useState(false);
  const [isMobileViewport, setIsMobileViewport] = useState(() => typeof window !== "undefined" && window.matchMedia(MOBILE_MEDIA_QUERY).matches);
  const [filtersCollapsed, setFiltersCollapsed] = useState(() => {
    try { return localStorage.getItem(FILTERS_COLLAPSED_KEY) === "true"; } catch { return false; }
  });
  const { isOpen: isMobileFiltersOpen, open: openMobileFilters, close: closeMobileFilters } = useDisclosure();

  // ── data
  const [channels, setChannels] = useState<CRMChannelRow[]>([]);
  const [conversations, setConversations] = useState<ConversationRow[]>([]);
  const [selectedConversationId, setSelectedConversationId] = useState<string | null>(null);
  const [mediaViewer, setMediaViewer] = useState<MediaViewerState>(null);

  // ── composer
  const [draft, setDraft] = useState("");
  const [attachedMedia, setAttachedMedia] = useState<ComposerAttachment[]>([]);
  const [replyingTo, setReplyingTo] = useState<ReplyingTo>(null);
  const [pendingMessages, setPendingMessages] = useState<MessageBubbleMessage[]>([]);
  const [currentUserDisplayName, setCurrentUserDisplayName] = useState<string | null>(null);
  const [editingMessage, setEditingMessage] = useState<MessageActionTarget>(null);
  const [editingMessageText, setEditingMessageText] = useState("");
  const [forwardingMessage, setForwardingMessage] = useState<MessageActionTarget>(null);
  const [forwardTargetConversationId, setForwardTargetConversationId] = useState("");
  const [runningMessageAction, setRunningMessageAction] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [sendingAudio, setSendingAudio] = useState(false);
  const [handoffLoading, setHandoffLoading] = useState<"assume" | "ai" | null>(null);
  const { isOpen: showMicPermSheet, open: openMicPermSheet, close: closeMicPermSheet } = useDisclosure();
  const { isOpen: showPhotosPermSheet, open: openPhotosPermSheet, close: closePhotosPermSheet } = useDisclosure();
  const pendingFilePickerModeRef = useRef<AttachmentPickerMode>("single");
  const micPermission = usePermissionState('microphone');

  // ── filters
  const [search, setSearch] = useState("");
  const [showOnlyUnread, setShowOnlyUnread] = useState(false);
  const [statusFilter, setStatusFilter] = useState<ConversationStatus>("all");
  const [providerFilter, setProviderFilter] = useState<ProviderFilter>("all");
  const [channelFilter, setChannelFilter] = useState("all");

  // ── full-text search (US-010)
  const [searchMode, setSearchMode] = useState<"leads" | "messages">("leads");
  const [messageSearchResults, setMessageSearchResults] = useState<Array<{ conversation_id: string; message_id: string; snippet: string; rank: number }>>([]);
  const [searchingMessages, setSearchingMessages] = useState(false);
  const searchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── saved views (US-008)
  const [filterViews, setFilterViews] = useState<FilterView[]>([]);
  const { isOpen: isSaveViewOpen, open: openSaveView, close: closeSaveView } = useDisclosure();
  const [saveViewName, setSaveViewName] = useState("");
  const [saveViewShared, setSaveViewShared] = useState(false);
  const [savingView, setSavingView] = useState(false);

  // ── new conversation form
  const [newConversationForm, setNewConversationForm] = useState<NewConversationForm>({ name: "", phone: "", email: "", channelId: "" });

  // ── refs
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const filePickerModeRef = useRef<AttachmentPickerMode>("single");
  const isMobileViewportRef = useRef(isMobileViewport);
  const attachedMediaRef = useRef<ComposerAttachment[]>([]);
  const isAtBottomRef = useRef(true);
  const leadOptionsRef = useRef<HTMLDivElement | null>(null);
  const topSentinelRef = useRef<HTMLDivElement | null>(null);

  // ── pagination hook
  const {
    messages,
    loadingInitial: loadingMessages,
    loadingOlder,
    hasMore,
    newMessageCount,
    clearNewMessageCount,
    loadMore,
    reload: reloadMessages,
  } = useMessagesPagination(selectedConversationId, scrollContainerRef);

  // ── derived
  const selectedConversation = useMemo(() => conversations.find((c) => c.id === selectedConversationId) || null, [conversations, selectedConversationId]);
  const activeChannels = useMemo(() => channels.filter((c) => c.is_active !== false), [channels]);
  const normalizedNewConversationPhone = useMemo(() => normalizePhone(newConversationForm.phone), [newConversationForm.phone]);
  const forwardableConversations = useMemo(() => conversations.filter((c) => c.id !== forwardingMessage?.conversation_id), [conversations, forwardingMessage?.conversation_id]);

  // O(1) lookup por id — evita conversations.find() em O(n) dentro do .map() de busca.
  const conversationsById = useMemo(
    () => new Map(conversations.map((c) => [c.id, c])),
    [conversations]
  );

  // Stable callback para seleção — permite que ConversationListItem seja memoizado.
  const handleSelectConversation = useCallback((id: string) => setSelectedConversationId(id), []);

  const filteredConversations = useMemo(() => {
    const q = search.trim().toLowerCase();
    return conversations.filter((conv) => {
      if (showOnlyUnread && Number(conv.unread_count || 0) <= 0) return false;
      if (statusFilter !== "all" && conv.status !== statusFilter) return false;
      if (providerFilter !== "all" && conv.crm_channels?.provider !== providerFilter) return false;
      if (channelFilter !== "all" && conv.channel_id !== channelFilter) return false;
      if (!q) return true;
      const haystack = [conv.lead_id, conv.crm_leads?.name, conv.crm_leads?.phone, conv.crm_channels?.name, getPreviewText(conv.lastMessage)].filter(Boolean).join(" ").toLowerCase();
      return haystack.includes(q);
    }).sort((left, right) => {
      const leftPending = isTransferPendingConversation(left) ? 1 : 0;
      const rightPending = isTransferPendingConversation(right) ? 1 : 0;
      if (leftPending !== rightPending) return rightPending - leftPending;
      return new Date(right.last_message_at || right.lastMessage?.created_at || 0).getTime() - new Date(left.last_message_at || left.lastMessage?.created_at || 0).getTime();
    });
  }, [channelFilter, conversations, providerFilter, search, showOnlyUnread, statusFilter]);

  const unreadTotal = useMemo(() => filteredConversations.reduce((acc, c) => acc + Number(c.unread_count || 0), 0), [filteredConversations]);

  const visibleMessages = useMemo(() => {
    if (!selectedConversationId || pendingMessages.length === 0) return messages;
    const persistedIds = new Set(messages.map((message) => message.id));
    const pendingForConversation = pendingMessages.filter((message) => message.conversation_id === selectedConversationId && !persistedIds.has(message.id));
    return [...messages, ...pendingForConversation].sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
  }, [messages, pendingMessages, selectedConversationId]);

  const { reactionsMap, hiddenIds } = useMemo(() => groupReactions(visibleMessages), [visibleMessages]);

  const threadGroups = useMemo(() => {
    const groups: Array<{ label: string; messages: typeof visibleMessages }> = [];
    for (const msg of visibleMessages) {
      if (hiddenIds.has(msg.id)) continue;
      const label = formatThreadDayLabel(msg.sent_at || msg.created_at);
      const lastGroup = groups[groups.length - 1];
      if (lastGroup?.label === label) lastGroup.messages.push(msg);
      else groups.push({ label, messages: [msg] });
    }
    return groups;
  }, [visibleMessages, hiddenIds]);

  // ── data loaders
  const loadChannels = useCallback(async (silent = false) => {
    try {
      const { data, error } = await supabase.from("crm_channels").select("id,store_id,name,provider,is_active").order("name", { ascending: true });
      if (error) throw error;
      setChannels((data || []) as CRMChannelRow[]);
    } catch (error: unknown) {
      if (!silent) toast.error((error as Error)?.message || "Falha ao carregar canais.");
    }
  }, [toast]);

  useEffect(() => {
    let mounted = true;
    const fallbackName =
      String(user?.user_metadata?.display_name || user?.user_metadata?.name || "").trim() ||
      String(user?.email || "").split("@")[0].trim() ||
      null;

    setCurrentUserDisplayName(fallbackName);
    if (!user?.id) return undefined;

    void (async () => {
      const { data } = await supabase
        .from("user_access_roles")
        .select("display_name,email")
        .eq("user_id", user.id)
        .maybeSingle();
      if (!mounted) return;
      const displayName = String(data?.display_name || "").trim();
      const emailName = String(data?.email || user.email || "").split("@")[0].trim();
      setCurrentUserDisplayName(displayName || emailName || fallbackName);
    })();

    return () => { mounted = false; };
  }, [user?.email, user?.id, user?.user_metadata]);

  useEffect(() => {
    setPendingMessages((prev) => prev.filter((message) => message.conversation_id === selectedConversationId));
  }, [selectedConversationId]);

  const loadConversations = useCallback(async (options: { showLoader?: boolean; silent?: boolean } = {}) => {
    const { showLoader = true, silent = false } = options;
    if (showLoader) setLoadingConversations(true);
    try {
      const { data, error } = await supabase
        .from("crm_conversations")
        .select("id,lead_id,channel_id,status,ai_enabled,unread_count,message_count,last_message_at,store_id,is_group,group_name,group_avatar_url,crm_leads(id,name,phone,avatar_url,conversation_status,attendance_owner,human_started_at,last_agent_type),crm_channels(id,name,provider,ai_resume_webhook_url)")
        .order("last_message_at", { ascending: false, nullsFirst: false })
        .limit(160);
      if (error) throw error;

      const rows: ConversationRow[] = ((data || []) as ConversationRawRow[]).map((row) => ({
        ...row,
        crm_leads: normalizeConversationRelation(row.crm_leads),
        crm_channels: normalizeConversationRelation(row.crm_channels),
        lastMessage: null,
      }));

      const ids = rows.map((r) => r.id);
      if (ids.length > 0) {
        const { data: lastMessages } = await supabase
          .from("crm_messages")
          .select("conversation_id,content,created_at,direction,media_url,media_type,status")
          .in("conversation_id", ids)
          .order("created_at", { ascending: false })
          .limit(ids.length * 3);
        const previewMap = new Map<string, MessagePreview>();
        ((lastMessages || []) as MessagePreview[]).forEach((m) => { if (!previewMap.has(m.conversation_id)) previewMap.set(m.conversation_id, m); });
        rows.forEach((r) => { r.lastMessage = previewMap.get(r.id) || null; });
      }

      setConversations(rows);
      setSelectedConversationId((prev) => {
        if (routeConversationId && rows.some((r) => r.id === routeConversationId)) return routeConversationId;
        if (prev && rows.some((r) => r.id === prev)) return prev;
        if (isMobileViewportRef.current) return null;
        return rows[0]?.id || null;
      });
    } catch (error: unknown) {
      if (!silent) toast.error((error as Error)?.message || "Falha ao carregar conversas.");
    } finally {
      if (showLoader) setLoadingConversations(false);
    }
  }, [routeConversationId, toast]);

  const markSelectedAsRead = useCallback(async (conversationId: string) => {
    const readAt = new Date().toISOString();
    await Promise.all([
      supabase.from("crm_conversations").update({ unread_count: 0, updated_at: readAt }).eq("id", conversationId).gt("unread_count", 0),
      supabase.from("crm_messages").update({ status: "read", read_at: readAt }).eq("conversation_id", conversationId).eq("direction", "inbound").is("read_at", null),
    ]);
  }, []);

  const refreshAll = useCallback(async () => {
    setIsRefreshing(true);
    await Promise.all([loadChannels(true), loadConversations({ showLoader: false }), reloadMessages(true)]);
    setIsRefreshing(false);
  }, [loadChannels, loadConversations, reloadMessages]);

  const refreshSelectedLead = useCallback(async () => {
    if (!selectedConversation) return;
    setIsLeadOptionsOpen(false);
    setIsRefreshing(true);
    try {
      await Promise.all([
        loadConversations({ showLoader: false }),
        reloadMessages(true),
      ]);
      toast.success("Lead atualizado.");
    } catch (error: unknown) {
      toast.error((error as Error)?.message || "Falha ao atualizar lead.");
    } finally {
      setIsRefreshing(false);
    }
  }, [loadConversations, reloadMessages, selectedConversation, toast]);

  const deleteSelectedLead = useCallback(async () => {
    if (!selectedConversation) return;
    setIsLeadOptionsOpen(false);
    const leadName = getLeadDisplay(selectedConversation);
    const confirmed = await toast.confirm({
      title: "Excluir lead?",
      description: `Isso remove ${leadName}, as conversas e mensagens vinculadas. Clientes e vendas existentes não são apagados.`,
      confirmLabel: "Excluir lead",
      cancelLabel: "Cancelar",
      variant: "danger",
    });
    if (!confirmed) return;

    setIsDeletingLead(true);
    try {
      const removedId = selectedConversation.id;
      const removedLeadId = selectedConversation.lead_id;
      assertNoError(await supabase.from("crm_leads").delete().eq("id", removedLeadId));
      const nextConversations = conversations.filter((conversation) => conversation.lead_id !== removedLeadId);
      setPendingMessages((prev) => prev.filter((message) => message.conversation_id !== removedId));
      setConversations(nextConversations);
      setSelectedConversationId(isMobileViewportRef.current ? null : nextConversations[0]?.id || null);
      setIsLeadInfoOpen(false);
      await loadConversations({ showLoader: false, silent: true });
      toast.success("Lead excluído.");
    } catch (error: unknown) {
      toast.error((error as Error)?.message || "Falha ao excluir lead.");
    } finally {
      setIsDeletingLead(false);
    }
  }, [conversations, loadConversations, selectedConversation, toast]);

  // ── full-text search (US-010)
  const openMessageSearchResult = useCallback(async (conversationId: string) => {
    setSelectedConversationId(conversationId);
    setSearch("");
    setMessageSearchResults([]);
  }, []);

  // ── saved views CRUD
  const loadFilterViews = useCallback(async () => {
    try {
      const { data } = await supabase.from("crm_filter_views").select("id,user_id,name,filters_json,is_shared,created_at").order("created_at", { ascending: false });
      setFilterViews((data || []) as FilterView[]);
    } catch { /* silent */ }
  }, []);

  const applyFilterView = useCallback((view: FilterView) => {
    const f = view.filters_json as Partial<FilterSnapshot>;
    if (f.statusFilter) setStatusFilter(f.statusFilter as ConversationStatus);
    if (f.providerFilter) setProviderFilter(f.providerFilter as ProviderFilter);
    if (f.channelFilter) setChannelFilter(f.channelFilter as string);
    if (typeof f.showOnlyUnread === "boolean") setShowOnlyUnread(f.showOnlyUnread);
  }, []);

  const saveFilterView = useCallback(async () => {
    if (!saveViewName.trim()) return;
    setSavingView(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { toast.error("Usuário não autenticado."); return; }
      const snapshot: FilterSnapshot = { statusFilter, providerFilter, channelFilter, showOnlyUnread };
      assertNoError(await supabase.from("crm_filter_views").insert({ user_id: user.id, name: saveViewName.trim(), filters_json: snapshot, is_shared: saveViewShared }));
      closeSaveView();
      setSaveViewName("");
      setSaveViewShared(false);
      await loadFilterViews();
      toast.success("View salva.");
    } catch (e: unknown) {
      toast.error((e as Error)?.message || "Falha ao salvar view.");
    } finally {
      setSavingView(false);
    }
  }, [channelFilter, loadFilterViews, providerFilter, saveViewName, saveViewShared, showOnlyUnread, statusFilter, toast]);

  const deleteFilterView = useCallback(async (viewId: string) => {
    try {
      assertNoError(await supabase.from("crm_filter_views").delete().eq("id", viewId));
      setFilterViews((prev) => prev.filter((v) => v.id !== viewId));
    } catch (e: unknown) {
      toast.error((e as Error)?.message || "Falha ao excluir view.");
    }
  }, [toast]);

  // ── attachment helpers
  const revokeAttachmentPreview = useCallback((att: ComposerAttachment) => {
    if (att.previewUrl?.startsWith("blob:")) URL.revokeObjectURL(att.previewUrl);
  }, []);

  const clearAttachments = useCallback(() => {
    setAttachedMedia((prev) => { prev.forEach(revokeAttachmentPreview); return []; });
  }, [revokeAttachmentPreview]);

  const removeAttachment = useCallback((id: string) => {
    setAttachedMedia((prev) => {
      const next: ComposerAttachment[] = [];
      prev.forEach((a) => { if (a.id === id) revokeAttachmentPreview(a); else next.push(a); });
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

  const requestFilePicker = useCallback((mode: AttachmentPickerMode = "single") => {
    if (mode === "media-batch") {
      pendingFilePickerModeRef.current = mode;
      openPhotosPermSheet();
      return;
    }

    openFilePicker(mode);
  }, [openFilePicker, openPhotosPermSheet]);

  const handlePhotosAllow = useCallback(() => {
    const mode = pendingFilePickerModeRef.current;
    closePhotosPermSheet();
    openFilePicker(mode);
  }, [closePhotosPermSheet, openFilePicker]);

  const handleFileSelect = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const files: File[] = event.target.files ? Array.from(event.target.files) : [];
    const mode = filePickerModeRef.current;
    if (files.length === 0) return;
    const existing = attachedMedia.length;
    const selection = validateAttachmentSelection<File>({ files, mode, existingMediaCount: existing });
    if (selection.rejectedInvalidTypeFiles.length > 0) toast.info("Somente imagens e vídeos entram no envio em lote.");
    if (selection.rejectedOversizeFiles.length > 0) toast.info("Arquivos acima de 16 MB foram ignorados.");
    if (selection.rejectedOverflowFiles.length > 0) toast.info(mode === "media-batch" || existing >= MAX_MEDIA_BATCH_ITEMS ? `Limite de ${MAX_MEDIA_BATCH_ITEMS} anexos por envio.` : "Selecione apenas um arquivo por vez.");
    if (selection.acceptedFiles.length > 0) {
      setAttachedMedia((prev) => [...prev, ...selection.acceptedFiles.map((file) => ({ id: `att-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`, file, previewUrl: isPreviewableAttachment(file) ? URL.createObjectURL(file) : null }))]);
    }
    filePickerModeRef.current = "single";
    event.target.value = "";
  }, [attachedMedia, toast]);

  const uploadAttachment = useCallback(async (conversationId: string, att: ComposerAttachment) => {
    const fileExt = getFileExtension(att.file);
    const path = `${conversationId}/${Date.now()}_${Math.random().toString(36).slice(2, 10)}.${fileExt}`;
    const { data, error } = await supabase.storage.from("crm-media").upload(path, att.file, { cacheControl: "3600", upsert: false, contentType: att.file.type || undefined });
    if (error) throw new Error(error.message || "Falha ao enviar anexo.");
    const { data: urlData } = supabase.storage.from("crm-media").getPublicUrl(data.path);
    if (!urlData.publicUrl) throw new Error("URL pública não gerada.");
    await ensurePublicMediaUrlReady(urlData.publicUrl);
    return urlData.publicUrl;
  }, []);

  // ── scroll helpers
  const scrollToBottom = useCallback((smooth = true) => {
    const container = scrollContainerRef.current;
    if (!container) return;
    container.scrollTo({ top: container.scrollHeight, behavior: smooth ? "smooth" : "instant" });
  }, []);

  const scrollToMessage = useCallback((providerMessageId: string) => {
    const target = String(providerMessageId || "").trim();
    const msg = visibleMessages.find((m) => {
      const providerId = String(m.provider_message_id || "").trim();
      return providerId === target || Boolean(target && providerId.endsWith(`:${target}`));
    });
    if (!msg) return;
    const el = document.getElementById(`msg-${msg.id}`);
    if (!el) return;
    el.scrollIntoView({ behavior: "smooth", block: "center" });
    el.classList.add("bg-yellow-100/30");
    setTimeout(() => el.classList.remove("bg-yellow-100/30"), 1500);
  }, [visibleMessages]);

  const handleScrollContainer = useCallback(() => {
    const container = scrollContainerRef.current;
    if (!container) return;
    const distanceFromBottom = container.scrollHeight - container.scrollTop - container.clientHeight;
    isAtBottomRef.current = distanceFromBottom < 80;
  }, []);

  const sendMessage = useCallback(async () => {
    if (!selectedConversation) return;
    if (!draft.trim() && attachedMedia.length === 0) return;
    if (!selectedConversation.channel_id) { toast.error("Conversa sem canal configurado."); return; }
    if (isTransferPendingConversation(selectedConversation)) {
      toast.warning('Clique em "Assumir" para começar a responder este atendimento.');
      return;
    }
    if (isAIHandlingConversation(selectedConversation)) {
      toast.warning('A IA está respondendo. Clique em "Assumir" para enviar mensagens manualmente.');
      return;
    }

    const content = draft.trim();
    const queued = [...attachedMedia];
    const replyTarget = replyingTo;
    const optimisticId = `optimistic-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const optimisticCreatedAt = new Date().toISOString();
    const shouldShowOptimisticMessage = queued.length === 0;
    setSending(true);
    setDraft("");
    setReplyingTo(null);

    if (shouldShowOptimisticMessage) {
      setPendingMessages((prev) => [...prev, {
        id: optimisticId,
        conversation_id: selectedConversation.id,
        direction: "outbound",
        sender_type: "human",
        content,
        created_at: optimisticCreatedAt,
        sent_at: optimisticCreatedAt,
        status: "pending",
        sender_user_id: user?.id || null,
        sender_display_name: currentUserDisplayName,
        reply_to_provider_message_id: replyTarget?.provider_message_id || null,
        reply_preview_text: replyTarget ? String(replyTarget.content || "").slice(0, 120) || "[mídia]" : null,
        webhook_payload: {
          source: "optimistic-ui",
          ...(currentUserDisplayName ? { sent_by_display_name: currentUserDisplayName } : {}),
        },
      }]);
      requestAnimationFrame(() => scrollToBottom());
    }

    try {
      if (queued.length === 0) {
        const body: Record<string, unknown> = { conversationId: selectedConversation.id, leadId: selectedConversation.lead_id, channelId: selectedConversation.channel_id, content };
        if (replyTarget?.provider_message_id) {
          body.replyToProviderMessageId = replyTarget.provider_message_id;
          body.replyPreviewText = String(replyTarget.content || "").slice(0, 120) || "[mídia]";
        }
        const { data, error } = await supabase.functions.invoke("crm-send-message", { body });
        if (error) throw error;
        if (data?.error) throw new Error(String(data.error));
      } else {
        const uploadedPayloads = [];
        for (const att of queued) {
          const mediaUrl = await uploadAttachment(selectedConversation.id, att);
          uploadedPayloads.push({ mediaUrl, mediaType: att.file.type || "application/octet-stream", mediaFilename: att.file.name });
        }
        const batchPayloads = buildBatchMessagePayloads(uploadedPayloads, content);
        for (const payload of batchPayloads) {
          const { data, error } = await supabase.functions.invoke("crm-send-message", {
            body: { conversationId: selectedConversation.id, leadId: selectedConversation.lead_id, channelId: selectedConversation.channel_id, content: payload.content, mediaUrl: payload.mediaUrl, mediaType: payload.mediaType, mediaFilename: payload.mediaFilename },
          });
          if (error) throw error;
          if (data?.error) throw new Error(String(data.error));
        }
      }

      clearAttachments();
      await Promise.all([loadConversations({ showLoader: false, silent: true }), reloadMessages(true)]);
      if (shouldShowOptimisticMessage) {
        setPendingMessages((prev) => prev.filter((message) => message.id !== optimisticId));
      }
      toast.success(queued.length > 0 ? "Mídia enviada." : "Mensagem enviada.");
    } catch (error: unknown) {
      if (shouldShowOptimisticMessage) {
        setPendingMessages((prev) => prev.map((message) => message.id === optimisticId ? {
          ...message,
          status: "failed",
          error_message: (error as Error)?.message || "Falha ao enviar mensagem.",
        } : message));
      }
      toast.error((error as Error)?.message || "Falha ao enviar mensagem.");
    } finally {
      setSending(false);
    }
  }, [attachedMedia, clearAttachments, currentUserDisplayName, draft, loadConversations, reloadMessages, replyingTo, scrollToBottom, selectedConversation, toast, uploadAttachment, user?.id]);

  // ── audio recording / voice notes
  const handleMicAllow = useCallback(async () => {
    closeMicPermSheet();
    try {
      // Trigger the native iOS system permission dialog, then release the stream.
      // AudioRecorder will open its own stream on mount.
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.getTracks().forEach((t) => t.stop());
      setIsRecording(true);
    } catch {
      // Permission denied — usePermissionState updates automatically.
    }
  }, []);

  const sendAudioRecording = useCallback(async (blob: Blob, mimeType: string) => {
    if (!selectedConversation) return;
    if (!selectedConversation.channel_id) { toast.error("Conversa sem canal configurado."); return; }
    if (isTransferPendingConversation(selectedConversation)) {
      toast.warning('Clique em "Assumir" para começar a responder este atendimento.');
      return;
    }
    if (isAIHandlingConversation(selectedConversation)) {
      toast.warning('A IA está respondendo. Clique em "Assumir" para enviar mensagens manualmente.');
      return;
    }
    if (!blob || blob.size === 0) { toast.error("Gravação inválida."); return; }

    const normalized = String(mimeType || blob.type || "").toLowerCase();
    const resolved = (() => {
      if (normalized.includes("ogg")) return { ext: "ogg", contentType: "audio/ogg;codecs=opus", mediaType: "audio/ogg" };
      if (normalized.includes("webm")) return { ext: "webm", contentType: "audio/webm;codecs=opus", mediaType: "audio/webm" };
      if (normalized.includes("mp4")) return { ext: "m4a", contentType: "audio/mp4", mediaType: "audio/mp4" };
      if (normalized.includes("mpeg") || normalized.includes("mp3")) return { ext: "mp3", contentType: "audio/mpeg", mediaType: "audio/mpeg" };
      if (normalized.includes("wav")) return { ext: "wav", contentType: "audio/wav", mediaType: "audio/wav" };
      return { ext: "webm", contentType: "audio/webm;codecs=opus", mediaType: "audio/webm" };
    })();

    setSendingAudio(true);
    try {
      const file = new File([blob], `audio-${Date.now()}.${resolved.ext}`, { type: resolved.contentType });
      const path = `${selectedConversation.id}/${Date.now()}_${Math.random().toString(36).slice(2, 10)}.${resolved.ext}`;
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from("crm-media")
        .upload(path, file, { cacheControl: "3600", upsert: false, contentType: resolved.contentType });
      if (uploadError) throw new Error(uploadError.message || "Falha ao enviar áudio.");
      const { data: urlData } = supabase.storage.from("crm-media").getPublicUrl(uploadData.path);
      if (!urlData.publicUrl) throw new Error("URL pública não gerada.");
      await ensurePublicMediaUrlReady(urlData.publicUrl);

      const data = assertNoError(await supabase.functions.invoke("crm-send-message", {
        body: {
          conversationId: selectedConversation.id,
          leadId: selectedConversation.lead_id,
          channelId: selectedConversation.channel_id,
          mediaUrl: urlData.publicUrl,
          mediaType: resolved.mediaType,
          mediaFilename: file.name,
        },
      }));
      if (data?.error) throw new Error(String(data.error));

      setIsRecording(false);
      await Promise.all([loadConversations({ showLoader: false, silent: true }), reloadMessages(true)]);
      toast.success("Áudio enviado.");
    } catch (err: unknown) {
      toast.error((err as Error)?.message || "Falha ao enviar áudio.");
    } finally {
      setSendingAudio(false);
    }
  }, [loadConversations, reloadMessages, selectedConversation, toast]);

  const runUazMessageAction = useCallback(async (
    action: "react" | "edit" | "delete",
    message: MessageBubbleMessage,
    payload: Record<string, unknown> = {},
  ) => {
    const providerMessageId = String(message.provider_message_id || "").trim();
    if (!providerMessageId) {
      toast.error("Mensagem sem ID do provedor para executar esta ação.");
      return null;
    }

    const conversationId = message.conversation_id || selectedConversationId || "";
    const conversation = conversations.find((c) => c.id === conversationId) || selectedConversation;
    if (!conversation?.channel_id) {
      toast.error("Conversa sem canal configurado.");
      return null;
    }

    const data = assertNoError(await supabase.functions.invoke("crm-uaz-message-action", {
      body: {
        action,
        conversationId,
        channelId: conversation.channel_id,
        messageId: providerMessageId,
        payload,
      },
    }));
    if (data?.error) throw new Error(String(data.error));
    return data;
  }, [conversations, selectedConversation, selectedConversationId, toast]);

  const reactToMessage = useCallback(async (message: MessageBubbleMessage, emoji: string) => {
    setRunningMessageAction(true);
    try {
      await runUazMessageAction("react", message, { text: emoji });
      await reloadMessages(true);
    } catch (error: unknown) {
      toast.error((error as Error)?.message || "Falha ao reagir à mensagem.");
    } finally {
      setRunningMessageAction(false);
    }
  }, [reloadMessages, runUazMessageAction, toast]);

  const openEditMessage = useCallback((message: MessageBubbleMessage) => {
    setEditingMessage(message);
    setEditingMessageText(String(message.content || ""));
  }, []);

  const saveEditedMessage = useCallback(async () => {
    if (!editingMessage) return;
    const text = editingMessageText.trim();
    if (!text) {
      toast.error("Informe o novo texto da mensagem.");
      return;
    }
    setRunningMessageAction(true);
    try {
      await runUazMessageAction("edit", editingMessage, { text });
      await supabase.from("crm_messages").update({ content: text, updated_at: new Date().toISOString() }).eq("id", editingMessage.id);
      setEditingMessage(null);
      setEditingMessageText("");
      await Promise.all([reloadMessages(true), loadConversations({ showLoader: false, silent: true })]);
      toast.success("Mensagem editada.");
    } catch (error: unknown) {
      toast.error((error as Error)?.message || "Falha ao editar mensagem.");
    } finally {
      setRunningMessageAction(false);
    }
  }, [editingMessage, editingMessageText, loadConversations, reloadMessages, runUazMessageAction, toast]);

  const deleteMessageForEveryone = useCallback(async (message: MessageBubbleMessage) => {
    const confirmed = await toast.confirm({
      title: "Apagar mensagem para todos?",
      description: "A mensagem será removida no WhatsApp quando o provedor aceitar a ação.",
      confirmLabel: "Apagar",
      cancelLabel: "Cancelar",
      variant: "danger",
    });
    if (!confirmed) return;

    setRunningMessageAction(true);
    try {
      await runUazMessageAction("delete", message);
      await supabase
        .from("crm_messages")
        .update({ content: "[Mensagem apagada para todos]", media_url: null, media_type: null, updated_at: new Date().toISOString() })
        .eq("id", message.id);
      await Promise.all([reloadMessages(true), loadConversations({ showLoader: false, silent: true })]);
      toast.success("Mensagem apagada.");
    } catch (error: unknown) {
      toast.error((error as Error)?.message || "Falha ao apagar mensagem.");
    } finally {
      setRunningMessageAction(false);
    }
  }, [loadConversations, reloadMessages, runUazMessageAction, toast]);

  const openForwardMessage = useCallback((message: MessageBubbleMessage) => {
    setForwardingMessage(message);
    setForwardTargetConversationId("");
  }, []);

  const forwardMessage = useCallback(async () => {
    if (!forwardingMessage) return;
    const target = conversations.find((c) => c.id === forwardTargetConversationId);
    if (!target?.channel_id) {
      toast.error("Selecione uma conversa de destino com canal configurado.");
      return;
    }

    const content = String(forwardingMessage.content || "").trim();
    const mediaUrl = String(forwardingMessage.media_url || "").trim();
    if (!content && !mediaUrl) {
      toast.error("Esta mensagem não possui conteúdo encaminhável.");
      return;
    }

    setRunningMessageAction(true);
    try {
      const data = assertNoError(await supabase.functions.invoke("crm-send-message", {
        body: {
          conversationId: target.id,
          leadId: target.lead_id,
          channelId: target.channel_id,
          content,
          mediaUrl: mediaUrl || undefined,
          mediaType: forwardingMessage.media_type || undefined,
        },
      }));
      if (data?.error) throw new Error(String(data.error));

      setForwardingMessage(null);
      setForwardTargetConversationId("");
      await loadConversations({ showLoader: false, silent: true });
      if (target.id === selectedConversationId) await reloadMessages(true);
      toast.success("Mensagem encaminhada.");
    } catch (error: unknown) {
      toast.error((error as Error)?.message || "Falha ao encaminhar mensagem.");
    } finally {
      setRunningMessageAction(false);
    }
  }, [conversations, forwardTargetConversationId, forwardingMessage, loadConversations, reloadMessages, selectedConversationId, toast]);

  // ── new conversation
  const openNewConversationModal = useCallback(() => {
    const preferred = activeChannels.find((c) => c.provider === "uazapi") || activeChannels[0] || channels[0];
    setNewConversationForm({ name: "", phone: "", email: "", channelId: preferred?.id || "" });
    openNewConversation();
  }, [activeChannels, channels]);

  const createNewConversation = useCallback(async () => {
    const channel = channels.find((c) => c.id === newConversationForm.channelId);
    const normalizedPhone = normalizePhone(newConversationForm.phone);
    if (!channel) { toast.error("Selecione um canal."); return; }
    if (!normalizedPhone) { toast.error("Informe um telefone válido."); return; }
    setIsCreatingConversation(true);
    try {
      const leadId = assertNoError(await supabase.rpc("upsert_crm_lead", {
        p_store_id: channel.store_id, p_phone: normalizedPhone, p_name: newConversationForm.name.trim() || normalizedPhone,
        p_contact_id: null, p_entity_id: null, p_channel_id: channel.id, p_email: newConversationForm.email.trim() || null,
        p_utm_source: "manual_conversation", p_utm_campaign: null, p_utm_medium: null, p_utm_content: null, p_utm_term: null, p_first_message: null, p_intent: null,
      }));
      const resolvedLeadId = String(leadId || "").trim();
      if (!resolvedLeadId) throw new Error("Falha ao resolver o lead.");

      const existing = assertNoError(await supabase.from("crm_conversations").select("id,store_id,lead_id,channel_id").eq("store_id", channel.store_id).eq("lead_id", resolvedLeadId).maybeSingle());

      let conversationId = String(existing?.id || "");
      if (!conversationId) {
        const created = assertNoError(await supabase.from("crm_conversations").insert({ store_id: channel.store_id, lead_id: resolvedLeadId, channel_id: channel.id, talk_id: toUazTalkId(normalizedPhone, channel.provider), status: "open", ai_enabled: true }).select("id,store_id,lead_id,channel_id").single());
        conversationId = String(created?.id || "");
      }
      if (!conversationId) throw new Error("Falha ao criar a conversa.");

      await supabase.rpc("crm_apply_channel_to_conversation", { p_conversation_id: conversationId, p_channel_id: channel.id, p_changed_by: null, p_reason: "manual_conversation" });
      closeNewConversation();
      setNewConversationForm({ name: "", phone: "", email: "", channelId: "" });
      await loadConversations({ showLoader: false, silent: true });
      setSelectedConversationId(conversationId);
      toast.success(existing ? "Conversa localizada." : "Conversa criada.");
    } catch (error: unknown) {
      toast.error((error as Error)?.message || "Falha ao criar conversa.");
    } finally {
      setIsCreatingConversation(false);
    }
  }, [channels, loadConversations, newConversationForm, toast]);

  // ── filters collapse persist
  const toggleFiltersCollapsed = useCallback(() => {
    setFiltersCollapsed((prev) => {
      const next = !prev;
      try { localStorage.setItem(FILTERS_COLLAPSED_KEY, String(next)); } catch { /* ignore */ }
      return next;
    });
  }, []);

  const clearConversationFilters = useCallback(() => {
    setStatusFilter("all");
    setProviderFilter("all");
    setChannelFilter("all");
    setShowOnlyUnread(false);
  }, []);

  // ── effects
  useEffect(() => { isMobileViewportRef.current = isMobileViewport; }, [isMobileViewport]);
  useEffect(() => { attachedMediaRef.current = attachedMedia; }, [attachedMedia]);

  useEffect(() => {
    const mq = window.matchMedia(MOBILE_MEDIA_QUERY);
    const onChange = (e: MediaQueryListEvent) => setIsMobileViewport(e.matches);
    setIsMobileViewport(mq.matches);
    if (typeof mq.addEventListener === "function") { mq.addEventListener("change", onChange); return () => mq.removeEventListener("change", onChange); }
    mq.addListener(onChange); return () => mq.removeListener(onChange);
  }, []);

  useEffect(() => { void loadChannels(true); }, [loadChannels]);
  useEffect(() => { void loadConversations(); }, [loadConversations]);
  useEffect(() => { void loadFilterViews(); }, [loadFilterViews]);

  useEffect(() => {
    const channel = supabase
      .channel('crm-conversations-list')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'crm_conversations' }, () => {
        void loadConversations({ showLoader: false, silent: true });
      })
      .subscribe();
    return () => { void supabase.removeChannel(channel); };
  }, [loadConversations]);

  // Debounced full-text search
  useEffect(() => {
    if (searchMode !== "messages") { setMessageSearchResults([]); return; }
    if (search.trim().length < 3) { setMessageSearchResults([]); return; }
    if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
    searchTimerRef.current = setTimeout(async () => {
      setSearchingMessages(true);
      try {
        const { data } = await supabase.rpc("search_crm_messages", { p_store_id: null as unknown as string, p_query: search.trim(), p_limit: 20 });
        setMessageSearchResults((data || []) as Array<{ conversation_id: string; message_id: string; snippet: string; rank: number }>);
      } catch { setMessageSearchResults([]); }
      finally { setSearchingMessages(false); }
    }, 300);
    return () => { if (searchTimerRef.current) clearTimeout(searchTimerRef.current); };
  }, [search, searchMode]);

  useEffect(() => {
    if (!selectedConversationId) return;
    const current = conversations.find((c) => c.id === selectedConversationId);
    if (!current || Number(current.unread_count || 0) <= 0) return;
    void markSelectedAsRead(selectedConversationId).then(() => {
      setConversations((prev) => prev.map((c) => c.id === selectedConversationId ? { ...c, unread_count: 0 } : c));
    });
  }, [conversations, markSelectedAsRead, selectedConversationId]);

  useEffect(() => {
    if (!isLeadOptionsOpen) return undefined;
    const onPointerDown = (event: PointerEvent) => {
      if (leadOptionsRef.current?.contains(event.target as Node)) return;
      setIsLeadOptionsOpen(false);
    };
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [isLeadOptionsOpen]);

  useEffect(() => {
    setIsLeadOptionsOpen(false);
    setIsLeadInfoOpen(false);
  }, [selectedConversationId]);

  useEffect(() => {
    const id = window.setInterval(async () => {
      void loadConversations({ showLoader: false, silent: true });
      const wasAtBottom = isAtBottomRef.current;
      await reloadMessages(true);
      if (wasAtBottom) requestAnimationFrame(() => scrollToBottom(false));
    }, POLL_INTERVAL_MS);
    return () => window.clearInterval(id);
  }, [loadConversations, reloadMessages, scrollToBottom]);

  useEffect(() => {
    const onFocus = () => { void loadConversations({ showLoader: false, silent: true }); void reloadMessages(true); };
    const onVisibility = () => { if (document.visibilityState === "visible") onFocus(); };
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onVisibility);
    return () => { window.removeEventListener("focus", onFocus); document.removeEventListener("visibilitychange", onVisibility); };
  }, [loadConversations, reloadMessages]);

  useEffect(() => {
    if (!isMobileViewport && !selectedConversationId && filteredConversations.length > 0) {
      setSelectedConversationId(filteredConversations[0].id);
    }
  }, [filteredConversations, isMobileViewport, selectedConversationId]);

  // Scroll to bottom on conversation change + reset replyingTo
  useEffect(() => {
    setReplyingTo(null);
    if (selectedConversationId) requestAnimationFrame(() => scrollToBottom(false));
  }, [selectedConversationId, scrollToBottom]);

  // When messages first load, scroll to bottom
  useEffect(() => {
    if (!loadingMessages && messages.length > 0 && isAtBottomRef.current) {
      requestAnimationFrame(() => scrollToBottom(false));
    }
  }, [loadingMessages, scrollToBottom]);

  // IntersectionObserver for top sentinel (load older)
  useEffect(() => {
    const sentinel = topSentinelRef.current;
    if (!sentinel || !hasMore) return;
    const observer = new IntersectionObserver(
      (entries) => { if (entries[0]?.isIntersecting) void loadMore(); },
      { root: scrollContainerRef.current, threshold: 0.1 },
    );
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [hasMore, loadMore]);

  useEffect(() => () => { attachedMediaRef.current.forEach(revokeAttachmentPreview); }, [revokeAttachmentPreview]);

  const listVisible = !isMobileViewport || !selectedConversationId;
  const threadVisible = !isMobileViewport || Boolean(selectedConversationId);
  const hasActiveFilters = statusFilter !== "all" || providerFilter !== "all" || channelFilter !== "all" || showOnlyUnread;
  const activeFiltersCount = Number(statusFilter !== "all") + Number(providerFilter !== "all") + Number(channelFilter !== "all") + Number(showOnlyUnread);
  const selectedStatusMeta = getStatusMeta(selectedConversation?.status);
  const selectedLeadName = selectedConversation ? getLeadDisplay(selectedConversation) : "";
  const selectedIsGroup = selectedConversation ? isGroupConversation(selectedConversation) : false;
  const selectedAvatarUrl = selectedConversation ? getConversationAvatarUrl(selectedConversation) : null;
  const selectedIsAIHandling = isAIHandlingConversation(selectedConversation);
  const selectedTransferPending = isTransferPendingConversation(selectedConversation);
  // Composer stays locked both while the AI is responding AND while a transfer is pending a human
  // assuming it — only "Assumir" frees the input (see assumeConversation).
  const selectedComposerLocked = selectedIsAIHandling || selectedTransferPending;
  const selectedHasAIWebhook = hasAIResumeWebhook(selectedConversation);
  const ownershipLabel = selectedTransferPending
    ? "IA transferiu para humano"
    : selectedIsAIHandling
      ? "IA ativa"
      : selectedConversation?.status === "human_handling"
        ? "Atendimento humano"
        : "Aberta";

  const assumeConversation = useCallback(async () => {
    if (!selectedConversation) return;
    setHandoffLoading("assume");
    try {
      const now = new Date().toISOString();
      assertNoError(await supabase
        .from("crm_conversations")
        .update({ status: "human_handling", ai_enabled: false, updated_at: now })
        .eq("id", selectedConversation.id));
      assertNoError(await supabase
        .from("crm_leads")
        .update({
          conversation_status: "em_atendimento_humano",
          attendance_owner: "humano_loja",
          human_started_at: now,
          last_agent_type: "humano",
          updated_at: now,
        })
        .eq("id", selectedConversation.lead_id));
      await loadConversations({ showLoader: false, silent: true });
      toast.success("Atendimento assumido.");
    } catch (error) {
      toast.error((error as Error)?.message || "Erro ao assumir atendimento.");
    } finally {
      setHandoffLoading(null);
    }
  }, [loadConversations, selectedConversation, toast]);

  const transferConversationToAI = useCallback(async () => {
    if (!selectedConversation) return;
    if (!selectedHasAIWebhook) {
      toast.warning("Configure o webhook IA HTTPS no canal antes de transferir.");
      return;
    }
    setHandoffLoading("ai");
    try {
      const { data, error } = await supabase.functions.invoke("crm-conversation-handoff", {
        body: {
          conversation_id: selectedConversation.id,
          target: "ai",
          reason: "manual_handoff_to_ai",
        },
      });
      if (error) throw error;
      if (data?.error) throw new Error(String(data.error));
      await loadConversations({ showLoader: false, silent: true });
      toast.success(data?.triggerDispatched === false ? "Conversa transferida para IA; verifique o log do disparo." : "Conversa transferida para IA.");
    } catch (error) {
      toast.error((error as Error)?.message || "Erro ao transferir para IA.");
    } finally {
      setHandoffLoading(null);
    }
  }, [loadConversations, selectedConversation, selectedHasAIWebhook, toast]);

  const newConversationFooter = (
    <div className="flex justify-end gap-2">
      <button type="button" className="crm-btn crm-btn-secondary" onClick={() => closeNewConversation()} disabled={isCreatingConversation}>Cancelar</button>
      <button type="button" className="crm-btn crm-btn-primary" onClick={() => void createNewConversation()} disabled={isCreatingConversation || !newConversationForm.channelId || !normalizedNewConversationPhone}>
        <Plus size={16} />
        {isCreatingConversation ? "Criando" : "Criar conversa"}
      </button>
    </div>
  );

  const editMessageFooter = (
    <div className="flex justify-end gap-2">
      <button type="button" className="crm-btn crm-btn-secondary" onClick={() => { setEditingMessage(null); setEditingMessageText(""); }} disabled={runningMessageAction}>Cancelar</button>
      <button type="button" className="crm-btn crm-btn-primary" onClick={() => void saveEditedMessage()} disabled={runningMessageAction || !editingMessageText.trim()}>
        {runningMessageAction ? "Salvando..." : "Salvar edição"}
      </button>
    </div>
  );

  const forwardMessageFooter = (
    <div className="flex justify-end gap-2">
      <button type="button" className="crm-btn crm-btn-secondary" onClick={() => { setForwardingMessage(null); setForwardTargetConversationId(""); }} disabled={runningMessageAction}>Cancelar</button>
      <button type="button" className="crm-btn crm-btn-primary" onClick={() => void forwardMessage()} disabled={runningMessageAction || !forwardTargetConversationId}>
        <Send size={16} />
        {runningMessageAction ? "Encaminhando..." : "Encaminhar"}
      </button>
    </div>
  );

  const actions = (
    <div className="flex flex-wrap items-center gap-2">
      <button type="button" className="crm-btn crm-btn-primary" onClick={openNewConversationModal}><Plus size={16} /> Nova conversa</button>
      <button type="button" className="crm-btn crm-btn-secondary" onClick={() => void refreshAll()} disabled={isRefreshing}><RefreshCw size={16} className={isRefreshing ? "animate-spin" : ""} />{isRefreshing ? "Atualizando" : "Atualizar"}</button>
    </div>
  );

  return (
    <CRMPageFrame title="Conversas" description="Inbox operacional para triagem, leitura de mídia e atendimento por canal." actions={actions}>
      <div className="crm-conversation-shell border border-slate-200/50 bg-white shadow-ios26-lg dark:border-slate-800 dark:bg-slate-950">
        <div
          className="crm-conversation-panel flex bg-white dark:bg-slate-950"
          style={{ minHeight: isMobileViewport ? "0px" : "560px" }}
        >

          {/* ── Left sidebar */}
          <aside className={`crm-conversation-list crm-chat-list-panel w-full border-r border-slate-200/80 bg-white dark:border-slate-800 dark:bg-slate-950 lg:w-[340px] lg:shrink-0 ${listVisible ? "flex" : "hidden"} flex-col overflow-hidden`}>
            <div className="shrink-0 space-y-2.5 border-b border-slate-200/80 bg-white/95 px-3 py-3 backdrop-blur dark:border-slate-800 dark:bg-slate-950/95">
              <div className="flex items-center justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <p className="text-[9px] font-black uppercase tracking-[0.18em] text-brand-600 dark:text-brand-400">CRM Plus</p>
                  <h2 className="text-base font-bold tracking-tight text-slate-950 dark:text-slate-50">{filteredConversations.length} leads ativos</h2>
                </div>
                <div className="flex shrink-0 items-center gap-1.5">
                  {unreadTotal > 0 && (
                    <m.span
                      initial={{ scale: 0.8 }}
                      animate={{ scale: 1 }}
                      className="inline-flex min-w-[36px] items-center justify-center rounded-full bg-brand-600 px-2 py-1 text-[10px] font-black text-white shadow-md shadow-brand-600/25"
                    >
                      {unreadTotal}
                    </m.span>
                  )}
                  {!isMobileViewport && (
                    <button type="button" title={filtersCollapsed ? "Mostrar filtros" : "Ocultar filtros"} onClick={toggleFiltersCollapsed} className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200/60 bg-white text-slate-500 transition-all hover:bg-slate-50 hover:text-slate-900 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-400">
                      {filtersCollapsed ? <Eye size={14} /> : <EyeOff size={14} />}
                    </button>
                  )}
                </div>
              </div>

              <div className="flex gap-1 rounded-lg border border-slate-200 bg-slate-50 p-0.5 dark:border-slate-700 dark:bg-slate-900">
                <button type="button" onClick={() => { setSearchMode("leads"); setMessageSearchResults([]); }} className={`flex-1 rounded-md px-2 py-1 text-xs font-semibold transition-colors ${searchMode === "leads" ? "bg-white shadow-sm text-slate-900 dark:bg-slate-800 dark:text-white" : "text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"}`}>
                  Leads
                </button>
                <button type="button" onClick={() => setSearchMode("messages")} className={`flex-1 rounded-md px-2 py-1 text-xs font-semibold transition-colors ${searchMode === "messages" ? "bg-white shadow-sm text-slate-900 dark:bg-slate-800 dark:text-white" : "text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"}`}>
                  Mensagens
                </button>
              </div>

              <label className="relative block">
                <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input type="text" value={search} onChange={(e) => setSearch(e.target.value)} placeholder={searchMode === "messages" ? "Buscar conteúdo de mensagens..." : "Buscar nome, telefone ou mensagem"} className="crm-input w-full pl-9" />
              </label>

              {/* Saved views chips */}
              {filterViews.length > 0 && !isMobileViewport && (
                <div className="flex flex-wrap gap-2">
                  {filterViews.slice(0, 6).map((view) => (
                    <div key={view.id} className="group flex items-center gap-1 rounded-full border border-slate-200/60 bg-white pl-3 pr-1 py-1.5 text-[10px] font-black uppercase tracking-tight text-slate-600 shadow-sm transition-all hover:border-brand-200 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-400">
                      <button type="button" onClick={() => applyFilterView(view)} className="flex items-center gap-1.5">
                        <BookmarkCheck size={12} className="text-brand-500" />
                        {view.name}
                        {view.is_shared && <span className="opacity-50">· team</span>}
                      </button>
                      <button type="button" onClick={() => void deleteFilterView(view.id)} className="ml-1 hidden rounded-full p-0.5 text-slate-400 hover:bg-red-50 hover:text-red-500 group-hover:inline-flex" aria-label="Delete view">
                        <X size={10} />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {isMobileViewport ? (
                <div className="flex max-w-full flex-wrap gap-1.5 pb-1">
                  <button
                    type="button"
                    onClick={clearConversationFilters}
                    className={`shrink-0 rounded-full px-3 py-1.5 text-[11px] font-semibold ${!hasActiveFilters ? "bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900" : "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300"}`}
                  >
                    Todas
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowOnlyUnread((p) => !p)}
                    className={`shrink-0 rounded-full px-3 py-1.5 text-[11px] font-semibold ${showOnlyUnread ? "bg-emerald-600 text-white" : "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300"}`}
                  >
                    Não lidas
                  </button>
                  <button
                    type="button"
                    onClick={() => setStatusFilter(statusFilter === "open" ? "all" : "open")}
                    className={`shrink-0 rounded-full px-3 py-1.5 text-[11px] font-semibold ${statusFilter === "open" ? "bg-brand-600 text-white" : "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300"}`}
                  >
                    Abertas
                  </button>
                  <button
                    type="button"
                    onClick={() => setProviderFilter(providerFilter === "uazapi" ? "all" : "uazapi")}
                    className={`shrink-0 rounded-full px-3 py-1.5 text-[11px] font-semibold ${providerFilter === "uazapi" ? "bg-brand-600 text-white" : "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300"}`}
                  >
                    WhatsApp
                  </button>
                  <button
                    type="button"
                    onClick={() => openMobileFilters()}
                    className={`shrink-0 rounded-full border px-3 py-1.5 text-[11px] font-semibold ${activeFiltersCount > 0 ? "border-brand-200 bg-brand-50 text-brand-700 dark:border-brand-900/60 dark:bg-brand-950/40 dark:text-brand-200" : "border-slate-200 bg-white text-slate-600 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300"}`}
                    aria-label="Filtros"
                  >
                    <span className="inline-flex items-center gap-1.5">
                      <SlidersHorizontal size={12} />
                      Filtros{activeFiltersCount > 0 ? ` · ${activeFiltersCount}` : ""}
                    </span>
                  </button>
                </div>
              ) : !filtersCollapsed ? (
                <>
                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                    <select className="crm-input" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as ConversationStatus)}>
                      {STATUS_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                    </select>
                    <select className="crm-input" value={providerFilter} onChange={(e) => setProviderFilter(e.target.value as ProviderFilter)}>
                      {PROVIDER_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                    </select>
                    <select className="crm-input sm:col-span-2" value={channelFilter} onChange={(e) => setChannelFilter(e.target.value)}>
                      <option value="all">Todos os canais</option>
                      {channels.map((c) => <option key={c.id} value={c.id}>{c.name || c.id} · {getProviderLabel(c.provider)}</option>)}
                    </select>
                  </div>
                  <div className="flex items-center gap-2">
                    <button type="button" className={`inline-flex w-fit items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold transition-colors ${showOnlyUnread ? "bg-emerald-600 text-white shadow-sm shadow-emerald-600/20" : "bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"}`} onClick={() => setShowOnlyUnread((p) => !p)}>
                      Somente não lidas
                    </button>
                    <button type="button" onClick={() => { setSaveViewName(""); setSaveViewShared(false); openSaveView(); }} className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800" title="Salvar filtros como view">
                      <Bookmark size={11} /> Salvar view
                    </button>
                  </div>
                </>
              ) : null}

            </div>

            <AnimatePresence>
              {isMobileViewport && isMobileFiltersOpen && (
                <>
                  <m.button
                    type="button"
                    className="fixed inset-0 z-40 bg-slate-950/30 backdrop-blur-[1px] lg:hidden"
                    aria-label="Fechar filtros"
                    onClick={() => closeMobileFilters()}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                  />
                  <m.div
                    role="dialog"
                    aria-modal="true"
                    aria-labelledby="mobile-conversation-filters-title"
                    className="fixed inset-x-0 bottom-0 z-50 mx-auto max-h-[82dvh] max-w-lg overflow-y-auto rounded-t-2xl border border-slate-200 bg-white px-4 pb-4 pt-3 shadow-2xl dark:border-slate-800 dark:bg-slate-950 lg:hidden"
                    style={{ paddingBottom: "max(1rem, env(safe-area-inset-bottom))" }}
                    initial={{ y: 28, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    exit={{ y: 28, opacity: 0 }}
                    transition={{ duration: 0.18 }}
                  >
                    <div className="mb-3 flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <h3 id="mobile-conversation-filters-title" className="text-sm font-bold text-slate-950 dark:text-slate-50">Filtros avançados</h3>
                        <p className="text-xs text-slate-500 dark:text-slate-400">{activeFiltersCount > 0 ? `${activeFiltersCount} filtro${activeFiltersCount > 1 ? "s" : ""} ativo${activeFiltersCount > 1 ? "s" : ""}` : "Refine a lista sem perder espaço no inbox."}</p>
                      </div>
                      <button type="button" onClick={() => closeMobileFilters()} className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-slate-200 text-slate-500 dark:border-slate-700 dark:text-slate-300" aria-label="Fechar filtros">
                        <X size={16} />
                      </button>
                    </div>

                    <div className="space-y-3">
                      <label className="block space-y-1.5 text-xs font-semibold text-slate-600 dark:text-slate-300">
                        <span>Status</span>
                        <select className="crm-input w-full" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as ConversationStatus)}>
                          {STATUS_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                        </select>
                      </label>
                      <label className="block space-y-1.5 text-xs font-semibold text-slate-600 dark:text-slate-300">
                        <span>Provedor</span>
                        <select className="crm-input w-full" value={providerFilter} onChange={(e) => setProviderFilter(e.target.value as ProviderFilter)}>
                          {PROVIDER_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                        </select>
                      </label>
                      <label className="block space-y-1.5 text-xs font-semibold text-slate-600 dark:text-slate-300">
                        <span>Canal</span>
                        <select className="crm-input w-full" value={channelFilter} onChange={(e) => setChannelFilter(e.target.value)}>
                          <option value="all">Todos os canais</option>
                          {channels.map((c) => <option key={c.id} value={c.id}>{c.name || c.id} · {getProviderLabel(c.provider)}</option>)}
                        </select>
                      </label>

                      <button type="button" className={`inline-flex w-full items-center justify-center gap-1.5 rounded-full px-3 py-2 text-xs font-semibold transition-colors ${showOnlyUnread ? "bg-emerald-600 text-white shadow-sm shadow-emerald-600/20" : "bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"}`} onClick={() => setShowOnlyUnread((p) => !p)}>
                        Somente não lidas
                      </button>

                      {filterViews.length > 0 && (
                        <div className="space-y-2">
                          <p className="text-xs font-semibold text-slate-600 dark:text-slate-300">Views salvas</p>
                          <div className="flex flex-wrap gap-2">
                            {filterViews.slice(0, 6).map((view) => (
                              <button key={view.id} type="button" onClick={() => { applyFilterView(view); closeMobileFilters(); }} className="inline-flex items-center gap-1.5 rounded-full border border-slate-200/60 bg-white px-3 py-1.5 text-[10px] font-black uppercase tracking-tight text-slate-600 shadow-sm dark:border-slate-800 dark:bg-slate-900 dark:text-slate-400">
                                <BookmarkCheck size={12} className="text-brand-500" />
                                {view.name}
                              </button>
                            ))}
                          </div>
                        </div>
                      )}

                      <div className="flex items-center gap-2 pt-1">
                        <button type="button" onClick={clearConversationFilters} className="inline-flex flex-1 items-center justify-center rounded-full bg-slate-100 px-3 py-2 text-xs font-semibold text-slate-700 dark:bg-slate-900 dark:text-slate-200">
                          Limpar
                        </button>
                        <button type="button" onClick={() => closeMobileFilters()} className="inline-flex flex-1 items-center justify-center rounded-full bg-brand-600 px-3 py-2 text-xs font-semibold text-white shadow-sm shadow-brand-600/20">
                          Aplicar
                        </button>
                      </div>

                      <button type="button" onClick={() => { setSaveViewName(""); setSaveViewShared(false); openSaveView(); closeMobileFilters(); }} className="inline-flex w-full items-center justify-center gap-1 rounded-full border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-600 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300">
                        <Bookmark size={12} /> Salvar view
                      </button>
                    </div>
                  </m.div>
                </>
              )}
            </AnimatePresence>

            <div className="min-w-0 flex-1 overflow-x-hidden overflow-y-auto overscroll-contain p-1.5">
              {/* Message full-text search results */}
              {searchMode === "messages" && (
                <div>
                  {search.trim().length < 3 ? (
                    <p className="p-4 text-xs text-slate-400">Digite pelo menos 3 caracteres para buscar.</p>
                  ) : searchingMessages ? (
                    <p className="p-4 text-xs text-slate-400">Buscando...</p>
                  ) : messageSearchResults.length === 0 ? (
                    <p className="p-4 text-xs text-slate-400">Nenhuma mensagem encontrada.</p>
                  ) : (
                    messageSearchResults.map((result) => {
                      const conv = conversationsById.get(result.conversation_id);
                      return (
                        <button key={result.message_id} type="button" onClick={() => void openMessageSearchResult(result.conversation_id)} className="w-full rounded-xl px-3 py-2.5 text-left hover:bg-slate-50 dark:hover:bg-slate-900">
                          <p className="truncate text-xs font-semibold text-slate-800 dark:text-slate-100">{conv ? getLeadDisplay(conv) : result.conversation_id}</p>
                          <p className="mt-0.5 line-clamp-2 text-xs text-slate-500 dark:text-slate-400" dangerouslySetInnerHTML={{ __html: result.snippet }} />
                        </button>
                      );
                    })
                  )}
                </div>
              )}

              {searchMode === "leads" && loadingConversations ? (
                <div className="p-4 text-sm text-slate-500">Carregando conversas...</div>
              ) : searchMode === "leads" && filteredConversations.length === 0 ? (
                <div className="p-4 text-sm text-slate-500">{search.trim() || showOnlyUnread || statusFilter !== "all" || providerFilter !== "all" || channelFilter !== "all" ? "Nenhuma conversa encontrada para os filtros." : "Nenhuma conversa encontrada."}</div>
              ) : searchMode === "leads" ? (
                filteredConversations.map((conv) => {
                  const isActive = conv.id === selectedConversationId;
                  const statusMeta = getStatusMeta(conv.status);
                  const provider = conv.crm_channels?.provider;
                  const previewText = getPreviewText(conv.lastMessage);
                  const previewKind = resolveMediaKind(conv.lastMessage?.media_type, conv.lastMessage?.media_url);
                  const leadName = getLeadDisplay(conv);
                  const isGroup = isGroupConversation(conv);
                  const avatarUrl = getConversationAvatarUrl(conv);
                  const hasUnread = Number(conv.unread_count || 0) > 0;
                  const isTransferPending = isTransferPendingConversation(conv);
                  const isAIHandling = isAIHandlingConversation(conv);
                  const rowClass = isTransferPending
                    ? isActive
                      ? "is-active bg-red-100 ring-1 ring-red-300 pl-shadow-float pl-radius-container z-10 animate-pulse dark:bg-red-950/40 dark:ring-red-700"
                      : "rounded-xl mb-0.5 bg-red-50 hover:bg-red-100 animate-pulse dark:bg-red-950/25 dark:hover:bg-red-950/35"
                    : isActive
                      ? "is-active bg-white pl-shadow-float pl-radius-container z-10 dark:bg-slate-900"
                      : isAIHandling
                        ? "rounded-xl mb-0.5 bg-orange-50/80 hover:bg-orange-100 dark:bg-orange-950/20 dark:hover:bg-orange-950/30"
                        : "hover:bg-slate-100/60 rounded-xl mb-0.5 dark:hover:bg-slate-900/40";

                  return (
                    <m.button
                      key={conv.id}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      whileHover={{ scale: 1.01 }}
                      whileTap={{ scale: 0.99 }}
                      type="button"
                      onClick={() => handleSelectConversation(conv.id)}
                      className={`crm-chat-row w-full relative overflow-hidden px-3 py-3 text-left transition-all duration-300 ${rowClass}`}
                    >
                      {isActive && <m.div layoutId="active-pill" className="absolute left-0 top-1/4 bottom-1/4 w-1 bg-brand-600 rounded-r-full" />}
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0 flex items-center gap-3">
                          <span className={`relative inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-sm font-bold ring-2 ${getAvatarTone(conv.lead_id)}`}>
                            {avatarUrl ? (
                              <img src={avatarUrl} alt={leadName} className="h-full w-full rounded-full object-cover" loading="lazy" />
                            ) : isGroup ? (
                              <UsersRound size={18} />
                            ) : (
                              getInitials(leadName)
                            )}
                            <span className={`absolute -bottom-0.5 -right-0.5 inline-flex h-5 min-w-5 items-center justify-center rounded-full border-2 border-white px-1 text-[8px] font-black dark:border-slate-950 ${getProviderDotClass(provider)}`}>{getProviderShortLabel(provider)}</span>
                          </span>
                          <div className="min-w-0">
                            <p className={`flex items-center gap-1.5 truncate font-semibold ${hasUnread ? "text-slate-950 dark:text-white" : "text-slate-800 dark:text-slate-100"}`}>
                              {isGroup && <UsersRound size={12} className="shrink-0 text-brand-600 dark:text-brand-300" />}
                              <span className="truncate">{leadName}</span>
                            </p>
                            <p className="truncate text-[10px] text-slate-500 dark:text-slate-400">{conv.crm_channels?.name || "Canal"} · {getProviderShortLabel(provider)}</p>
                          </div>
                        </div>
                        <p className={`shrink-0 text-[11px] ${hasUnread ? "font-bold text-brand-700 dark:text-brand-200" : "text-slate-500 dark:text-slate-400"}`}>{formatConversationDate(conv.last_message_at || conv.lastMessage?.created_at || null)}</p>
                      </div>
                      <div className="mt-1.5 flex min-w-0 items-center gap-2">
                        {conv.lastMessage && (
                          <span
                            aria-label={conv.lastMessage.direction === "inbound" ? "Última mensagem recebida" : "Última mensagem enviada"}
                            className={`inline-block h-2 w-2 shrink-0 rounded-full ${conv.lastMessage.direction === "inbound" ? "bg-brand-600" : "bg-slate-300 dark:bg-slate-600"}`}
                          />
                        )}
                        {previewKind && (
                          <span className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded text-slate-400">
                            {previewKind === "image" ? <ImageIcon size={13} /> : previewKind === "video" ? <Video size={13} /> : previewKind === "audio" ? <Mic size={13} /> : <FileText size={13} />}
                          </span>
                        )}
                        <p className={`line-clamp-1 text-[12px] leading-5 ${hasUnread ? "font-semibold text-slate-700 dark:text-slate-200" : "text-slate-500 dark:text-slate-400"}`}>
                          {conv.lastMessage?.direction === "outbound" ? "Você: " : ""}{previewText}
                        </p>
                      </div>
                      <div className="mt-1.5 flex items-center justify-between gap-2">
                        <div className="flex flex-wrap items-center gap-1">
                          <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[9px] font-bold tracking-tight uppercase ${statusMeta.className}`}>{statusMeta.label}</span>
                          {isTransferPending && (
                            <span className="inline-flex items-center rounded-full border border-red-200 bg-red-100 px-2 py-0.5 text-[9px] font-black uppercase tracking-tight text-red-700 dark:border-red-700 dark:bg-red-950/50 dark:text-red-200">
                              Transferência pendente
                            </span>
                          )}
                          {!isTransferPending && isAIHandling && (
                            <span className="inline-flex items-center rounded-full border border-orange-200 bg-orange-100 px-2 py-0.5 text-[9px] font-black uppercase tracking-tight text-orange-700 dark:border-orange-700 dark:bg-orange-950/50 dark:text-orange-200">
                              IA ativa
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-1.5">
                          {hasUnread && <span className="inline-flex min-w-[18px] h-[18px] items-center justify-center rounded-full bg-brand-600 px-1 text-[9px] font-black text-white shadow-sm shadow-brand-600/30">{conv.unread_count}</span>}
                        </div>
                      </div>
                    </m.button>
                  );
                })
              ) : null}
            </div>
          </aside>

          {/* ── Right: thread */}
          <section className={`crm-conversation-thread min-w-0 flex-1 relative bg-white dark:bg-[#020617] ${threadVisible ? "flex" : "hidden"} flex-col overflow-hidden`}>
            {selectedConversation ? (
              <>
                {/* Header */}
                <header
                  data-testid="crm-conversation-compact-header"
                  className="crm-conversation-compact-header sticky top-0 z-20 flex items-center gap-2 border-b border-slate-200/50 liquid-glass-strong px-3 py-2 dark:border-slate-800 lg:gap-3 lg:px-5 lg:py-3"
                  style={isMobileViewport ? { paddingTop: "max(0.75rem, env(safe-area-inset-top))" } : undefined}
                >
                  {isMobileViewport && (
                    <button type="button" onClick={() => setSelectedConversationId(null)} className="inline-flex h-11 w-11 items-center justify-center rounded-xl border border-slate-200/60 text-slate-700 hover:bg-slate-100 dark:border-slate-700/60 dark:text-slate-200 dark:hover:bg-slate-800" aria-label="Voltar">
                      <ArrowLeft size={16} />
                    </button>
                  )}
                  <span className={`crm-conversation-header-avatar relative inline-flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-full text-sm font-black ring-2 ring-white dark:ring-slate-900 lg:h-11 lg:w-11 ${getAvatarTone(selectedConversation.lead_id)}`}>
                    {selectedAvatarUrl ? (
                      <img src={selectedAvatarUrl} alt={selectedLeadName} className="h-full w-full object-cover" loading="lazy" />
                    ) : selectedIsGroup ? (
                      <UsersRound size={20} />
                    ) : (
                      getInitials(selectedLeadName)
                    )}
                    <span className={`absolute -bottom-1 -right-1 inline-flex h-5 min-w-5 items-center justify-center rounded-full border-2 border-white px-1 text-[8px] font-black dark:border-slate-950 ${getProviderDotClass(selectedConversation.crm_channels?.provider)}`}>{getProviderShortLabel(selectedConversation.crm_channels?.provider)}</span>
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="flex items-center gap-2 truncate text-[15px] font-bold tracking-tight text-slate-950 dark:text-slate-50 lg:text-base">
                      {selectedIsGroup && <UsersRound size={15} className="shrink-0 text-brand-600 dark:text-brand-300" />}
                      <span className="truncate">{selectedLeadName}</span>
                    </p>
                    <p className="truncate text-[11px] font-medium text-slate-500 dark:text-slate-400 lg:text-xs">{selectedIsGroup ? "Conversa em grupo" : selectedConversation.crm_leads?.phone || "Sem telefone"} · {selectedConversation.crm_channels?.name || "N/A"} · {ownershipLabel}</p>
                  </div>
                  <div className="relative shrink-0" ref={leadOptionsRef}>
                    <button
                      type="button"
                      className="inline-flex h-11 w-11 items-center justify-center rounded-xl border border-slate-200/70 bg-white/80 text-slate-700 shadow-sm transition-colors hover:bg-slate-100 dark:border-slate-700/70 dark:bg-slate-900/70 dark:text-slate-200 dark:hover:bg-slate-800"
                      aria-label="Opções do lead"
                      aria-haspopup="menu"
                      aria-expanded={isLeadOptionsOpen}
                      onClick={() => setIsLeadOptionsOpen((prev) => !prev)}
                    >
                      <MoreVertical size={18} />
                    </button>
                    <AnimatePresence>
                      {isLeadOptionsOpen && (
                        <m.div
                          initial={{ opacity: 0, y: -6, scale: 0.98 }}
                          animate={{ opacity: 1, y: 0, scale: 1 }}
                          exit={{ opacity: 0, y: -6, scale: 0.98 }}
                          transition={{ duration: 0.14 }}
                          role="menu"
                          className="absolute right-0 top-full z-50 mt-2 w-56 overflow-hidden rounded-xl border border-slate-200 bg-white py-1 text-sm shadow-xl shadow-slate-900/10 dark:border-slate-700 dark:bg-slate-900 dark:shadow-black/30"
                        >
                          <button
                            type="button"
                            role="menuitem"
                            className="flex w-full items-center gap-3 px-4 py-2.5 text-left font-medium text-slate-700 hover:bg-slate-50 dark:text-slate-200 dark:hover:bg-slate-800"
                            onClick={() => { setIsLeadOptionsOpen(false); setIsLeadInfoOpen(true); }}
                          >
                            <Info size={17} /> Informações
                          </button>
                          <button
                            type="button"
                            role="menuitem"
                            className="flex w-full items-center gap-3 px-4 py-2.5 text-left font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-60 dark:text-slate-200 dark:hover:bg-slate-800"
                            disabled={isRefreshing}
                            onClick={() => void refreshSelectedLead()}
                          >
                            <RefreshCw size={17} className={isRefreshing ? "animate-spin" : ""} /> Atualizar
                          </button>
                          <button
                            type="button"
                            role="menuitem"
                            className="flex w-full items-center gap-3 px-4 py-2.5 text-left font-semibold text-red-700 hover:bg-red-50 disabled:opacity-60 dark:text-red-300 dark:hover:bg-red-950/30"
                            disabled={isDeletingLead}
                            onClick={() => void deleteSelectedLead()}
                          >
                            <Trash2 size={17} /> {isDeletingLead ? "Excluindo..." : "Excluir lead"}
                          </button>
                        </m.div>
                      )}
                    </AnimatePresence>
                  </div>
                  <div className="hidden shrink-0 items-center gap-2 sm:flex">
                    <span className={`rounded-full px-4 py-1.5 text-[10px] font-black uppercase tracking-widest pl-shadow-ao ${selectedTransferPending ? "bg-red-100 text-red-700 animate-pulse dark:bg-red-950/40 dark:text-red-200" : selectedStatusMeta.className}`}>{ownershipLabel}</span>
                    {selectedIsAIHandling || selectedTransferPending ? (
                      <button
                        type="button"
                        className="inline-flex items-center rounded-xl bg-red-600 px-3 py-2 text-xs font-bold text-white hover:bg-red-700 disabled:opacity-60"
                        disabled={handoffLoading === "assume"}
                        onClick={() => void assumeConversation()}
                      >
                        {handoffLoading === "assume" ? "Assumindo..." : "Assumir"}
                      </button>
                    ) : (
                      <button
                        type="button"
                        className={`inline-flex items-center rounded-xl px-3 py-2 text-xs font-bold ${selectedHasAIWebhook ? "bg-orange-600 text-white hover:bg-orange-700" : "border border-orange-200 bg-orange-50 text-orange-700"}`}
                        disabled={handoffLoading === "ai"}
                        onClick={() => void transferConversationToAI()}
                      >
                        {selectedHasAIWebhook ? (handoffLoading === "ai" ? "Transferindo..." : "Transferir para IA") : "Configurar webhook IA"}
                      </button>
                    )}
                  </div>
                </header>

                {/* Messages */}
                <div className="relative flex min-h-0 flex-1 flex-col overflow-hidden">
                  <div
                    ref={scrollContainerRef}
                    onScroll={handleScrollContainer}
                    className="crm-conversation-messages flex-1 overflow-y-auto overscroll-contain px-3 py-4 sm:px-6"
                  >
                    {/* Top sentinel for infinite scroll */}
                    <div ref={topSentinelRef} className="h-1" />

                    {loadingOlder && (
                      <div className="py-3 text-center text-xs text-slate-400">Carregando mensagens anteriores...</div>
                    )}

                    {loadingMessages ? (
                      <div className="rounded-xl bg-white/80 p-4 text-sm text-slate-500 shadow-sm dark:bg-slate-900/80">Carregando mensagens...</div>
                    ) : visibleMessages.length === 0 ? (
                      <div className="mx-auto mt-12 max-w-sm rounded-2xl border border-dashed border-slate-300 bg-white/70 p-6 text-center text-sm text-slate-500 dark:border-slate-700 dark:bg-slate-900/70 dark:text-slate-400">Nenhuma mensagem encontrada.</div>
                    ) : (
                      <div className="min-w-0 max-w-full space-y-4 overflow-x-hidden">
                        {threadGroups.map((group) => (
                          <div key={group.label} className="space-y-3">
                            <div className="flex items-center gap-3">
                              <span className="h-px flex-1 bg-linear-to-r from-transparent via-slate-300 to-slate-300 dark:via-slate-700 dark:to-slate-700" />
                              <span className="rounded-full border border-slate-200 bg-white/85 px-3 py-1 text-[11px] font-bold uppercase tracking-wide text-slate-500 shadow-sm dark:border-slate-700 dark:bg-slate-900/80 dark:text-slate-400">{group.label}</span>
                              <span className="h-px flex-1 bg-linear-to-l from-transparent via-slate-300 to-slate-300 dark:via-slate-700 dark:to-slate-700" />
                            </div>
                            <div className="flex min-w-0 max-w-full flex-col gap-1.5 overflow-x-hidden">
                            {group.messages.map((msg) => {
                              const reaction = reactionsMap.get(msg.provider_message_id || "");
                              const metaCampaign = resolveMetaCampaignPreviewData({ webhookPayload: msg.webhook_payload as Record<string, unknown> | null });
                              return (
                                <MessageBubble
                                  key={msg.id}
                                  message={msg}
                                  reactionSummary={reaction}
                                  metaCampaign={metaCampaign}
                                  onReply={setReplyingTo}
                                  onReact={(message, emoji) => void reactToMessage(message, emoji)}
                                  onForward={openForwardMessage}
                                  onEdit={openEditMessage}
                                  onDelete={(message) => void deleteMessageForEveryone(message)}
                                  onOpenMedia={(url, type, fileName) => setMediaViewer({ url, type, fileName })}
                                  onScrollToReply={scrollToMessage}
                                />
                              );
                            })}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                    <div ref={messagesEndRef} />
                  </div>

                  {/* New messages pill */}
                  {newMessageCount > 0 && (
                    <button
                      type="button"
                      onClick={() => { clearNewMessageCount(); scrollToBottom(); }}
                      className="absolute bottom-4 left-1/2 -translate-x-1/2 inline-flex items-center gap-1.5 rounded-full bg-emerald-600 px-4 py-1.5 text-xs font-semibold text-white shadow-lg hover:bg-emerald-500 transition-colors"
                    >
                      <ArrowDown size={13} />
                      {newMessageCount} nova{newMessageCount > 1 ? "s" : ""} mensagem{newMessageCount > 1 ? "s" : ""}
                    </button>
                  )}
                </div>

                {/* Composer */}
                <m.footer
                  initial={{ y: 20, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  className="crm-conversation-composer shrink-0 z-30 w-full border-t border-slate-200/60 bg-white/90 px-3 pt-2 backdrop-blur-xl dark:border-slate-800 dark:bg-slate-950/90"
                  data-testid="crm-conversation-composer"
                  style={isMobileViewport ? undefined : { paddingBottom: "0.75rem" }}
                >
                  <div className="min-w-0 max-w-full overflow-hidden rounded-2xl border border-slate-200/60 bg-white/95 p-2.5 pl-shadow-float backdrop-blur-xl dark:border-slate-800 dark:bg-slate-900/95">
                    <input ref={fileInputRef} type="file" className="hidden" onChange={handleFileSelect} />
                    {selectedComposerLocked && (
                      <div className={`mb-3 flex flex-col gap-2 rounded-2xl border px-3 py-2.5 text-sm sm:hidden ${selectedTransferPending ? "border-red-200 bg-red-50 text-red-800 dark:border-red-800 dark:bg-red-950/30 dark:text-red-100" : "border-orange-200 bg-orange-50 text-orange-800 dark:border-orange-800 dark:bg-orange-950/30 dark:text-orange-100"}`}>
                        <span className="font-semibold">{selectedTransferPending ? "IA transferiu este atendimento para você." : "A IA está respondendo."}</span>
                        <button
                          type="button"
                          className="inline-flex min-h-10 items-center justify-center rounded-xl bg-red-600 px-3 text-xs font-bold text-white"
                          disabled={handoffLoading === "assume"}
                          onClick={() => void assumeConversation()}
                        >
                          {handoffLoading === "assume" ? "Assumindo..." : "Assumir atendimento da IA"}
                        </button>
                      </div>
                    )}
  
                    {/* Reply preview strip */}
                    {replyingTo && (
                      <div className="mb-2 flex min-w-0 max-w-full items-start gap-2 overflow-hidden rounded-2xl border border-brand-200/50 bg-brand-50/50 px-3 py-2.5 dark:border-brand-500/20 dark:bg-brand-500/10">
                        <Reply size={14} className="mt-0.5 shrink-0 text-brand-600 dark:text-brand-300" />
                        <div className="min-w-0 flex-1">
                          <p className="text-[10px] font-black uppercase tracking-widest text-brand-700 dark:text-brand-200">{replyingTo.direction === "outbound" ? "Replying to support" : "Replying to client"}</p>
                          <p className="truncate text-xs text-slate-600 dark:text-slate-300">{replyingTo.content?.slice(0, 80) || "[mídia]"}</p>
                        </div>
                        <button type="button" onClick={() => setReplyingTo(null)} className="shrink-0 rounded-full p-1 text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-800" aria-label="Cancelar reply">
                          <X size={14} />
                        </button>
                      </div>
                    )}
  
                    {/* Attachment previews */}
                    {attachedMedia.length > 0 && (
                      <div className="mb-3 flex gap-2 overflow-x-auto pb-1">
                        {attachedMedia.map((att) => {
                          const kind = resolveMediaKind(att.file.type, att.file.name) || "document";
                          return (
                            <div key={att.id} className="relative flex min-w-[152px] max-w-[210px] items-center gap-2 rounded-2xl border border-slate-200/60 bg-slate-50/80 p-2 shadow-sm dark:border-slate-700/60 dark:bg-slate-800/80">
                              <button type="button" className="absolute -right-2 -top-2 inline-flex h-6 w-6 items-center justify-center rounded-full bg-slate-950 text-white shadow-md" onClick={() => removeAttachment(att.id)} aria-label={`Remover ${att.file.name}`}><X size={13} /></button>
                              {kind === "image" && att.previewUrl ? <img src={att.previewUrl} alt={att.file.name} className="h-12 w-12 rounded-lg object-cover pl-shadow-ao" /> : kind === "video" ? <Video size={22} className="shrink-0 text-brand-600" /> : kind === "audio" ? <Mic size={22} className="shrink-0 text-accent-600" /> : <FileText size={22} className="shrink-0 text-slate-500" />}
                              <div className="min-w-0">
                                <p className="truncate text-xs font-bold text-slate-800 dark:text-slate-100">{att.file.name}</p>
                                <p className="text-[10px] font-medium text-slate-500">{formatBytes(att.file.size)}</p>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
  
                    <div className="flex min-w-0 max-w-full items-end gap-2 overflow-hidden rounded-2xl border border-slate-100 bg-slate-50/50 p-2 focus-within:border-brand-300 focus-within:ring-4 focus-within:ring-brand-500/10 dark:border-slate-800 dark:bg-slate-950/50">
                      {isRecording ? (
                        <AudioRecorder
                          isSending={sendingAudio}
                          onCancel={() => { if (!sendingAudio) setIsRecording(false); }}
                          onError={(message) => { toast.error(message); setIsRecording(false); }}
                          onStop={(blob, mimeType) => { void sendAudioRecording(blob, mimeType); }}
                        />
                      ) : (
                        <>
                          <div className="flex shrink-0 gap-1">
                            <button type="button" className="inline-flex h-11 w-11 items-center justify-center rounded-xl text-slate-500 transition-all hover:bg-white hover:text-brand-700 hover:shadow-sm disabled:opacity-50 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-brand-200" onClick={() => requestFilePicker("single")} disabled={sending || selectedComposerLocked} title="Anexar arquivo"><Paperclip size={18} /></button>
                            <button type="button" className="inline-flex h-11 w-11 items-center justify-center rounded-xl text-slate-500 transition-all hover:bg-white hover:text-brand-700 hover:shadow-sm disabled:opacity-50 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-brand-200" onClick={() => requestFilePicker("media-batch")} disabled={sending || selectedComposerLocked} title="Lote de fotos/vídeos"><ImageIcon size={18} /></button>
                          </div>
                          <textarea
                            className="min-h-[44px] max-h-32 min-w-0 flex-1 resize-none overflow-y-auto border-0 bg-transparent px-3 py-2.5 text-[15px] text-slate-950 outline-none placeholder:text-slate-400 dark:text-slate-50"
                            placeholder={selectedTransferPending ? 'IA transferiu para humano. Clique em "Assumir" para responder.' : selectedIsAIHandling ? "A IA está respondendo. Assuma para enviar manualmente." : attachedMedia.length > 0 ? "Legenda opcional..." : "Mensagem rápida..."}
                            spellCheck={true}
                            autoCorrect="on"
                            autoCapitalize="sentences"
                            value={draft}
                            onChange={(e) => setDraft(e.target.value)}
                            onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); void sendMessage(); } }}
                            disabled={selectedComposerLocked}
                          />
                          {draft.trim() || attachedMedia.length > 0 ? (
                            <button type="button" className="inline-flex h-11 shrink-0 items-center gap-2 rounded-2xl bg-linear-to-br from-brand-600 to-brand-700 px-5 text-sm font-black text-white shadow-lg shadow-brand-600/30 transition-all hover:scale-[1.02] active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50" disabled={sending || selectedComposerLocked} onClick={() => void sendMessage()}>
                              <Send size={16} />
                              {sending ? "ENVIANDO" : "ENVIAR"}
                            </button>
                          ) : (
                            <button type="button" className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-linear-to-br from-brand-600 to-brand-700 text-white shadow-lg shadow-brand-600/30 transition-all hover:scale-[1.02] active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50" disabled={sending || selectedComposerLocked} onClick={() => { if (micPermission === 'granted') { setIsRecording(true); } else { openMicPermSheet(); } }} title="Gravar áudio" aria-label="Gravar áudio">
                              <Mic size={18} />
                            </button>
                          )}
                        </>
                      )}
                    </div>
                  </div>
                  <p className="mt-1.5 text-center text-[9px] font-semibold uppercase tracking-widest text-slate-400/60 dark:text-slate-500/60">Enter para enviar · Shift+Enter nova linha · 16MB máx</p>
                </m.footer>
              </>
            ) : (
              <div className="flex flex-1 flex-col items-center justify-center p-12 text-center">
                <m.div
                  initial={{ scale: 0.9, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ duration: 0.8, ease: "circOut" }}
                  className="relative mb-8"
                >
                  <div className="absolute inset-0 -m-8 scale-150 rounded-full bg-brand-500/5 blur-3xl dark:bg-brand-500/10" />
                  <div className="relative flex h-24 w-24 items-center justify-center rounded-[32px] border border-brand-200/30 bg-white pl-shadow-float dark:border-brand-500/20 dark:bg-slate-900">
                    <Bot size={42} className="text-brand-600 dark:text-brand-400" />
                  </div>
                  <m.div
                    animate={{ y: [0, -4, 0] }}
                    transition={{ repeat: Infinity, duration: 4, ease: "easeInOut" }}
                    className="absolute -right-4 -top-4 flex h-10 w-10 items-center justify-center rounded-full border border-slate-100 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900"
                  >
                    <div className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                  </m.div>
                </m.div>
                <div className="max-w-[280px] space-y-2">
                  <h3 className="text-xl font-black tracking-tight text-slate-950 dark:text-white">Precision Inbox</h3>
                  <p className="text-sm font-medium leading-relaxed text-slate-500 dark:text-slate-400">Select a lead from the fragments on the left to start a high-performance conversation.</p>
                </div>
                <div className="mt-8 flex gap-3">
                  <div className="h-1 w-8 rounded-full bg-brand-600" />
                  <div className="h-1 w-2 rounded-full bg-slate-200 dark:bg-slate-800" />
                  <div className="h-1 w-2 rounded-full bg-slate-200 dark:bg-slate-800" />
                </div>
              </div>
            )}
          </section>
        </div>
      </div>

      <MediaViewer state={mediaViewer} onClose={() => setMediaViewer(null)} />
      <Modal open={isLeadInfoOpen && Boolean(selectedConversation)} onClose={() => setIsLeadInfoOpen(false)} title="Informações do lead" size="md">
        {selectedConversation && (
          <div className="space-y-4">
            <div className="flex min-w-0 items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 p-3 dark:border-slate-700 dark:bg-slate-900/70">
              <span className={`relative inline-flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-full text-base font-black ring-2 ring-white dark:ring-slate-950 ${getAvatarTone(selectedConversation.lead_id)}`}>
                {selectedAvatarUrl ? (
                  <img src={selectedAvatarUrl} alt={selectedLeadName} className="h-full w-full object-cover" loading="lazy" />
                ) : selectedIsGroup ? (
                  <UsersRound size={20} />
                ) : (
                  getInitials(selectedLeadName)
                )}
              </span>
              <div className="min-w-0">
                <p className="truncate text-base font-bold text-slate-950 dark:text-slate-50">{selectedLeadName}</p>
                <p className="truncate text-sm text-slate-500 dark:text-slate-400">{selectedConversation.crm_leads?.phone || "Sem telefone"}</p>
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-xl border border-slate-200 p-3 dark:border-slate-700">
                <p className="text-[11px] font-black uppercase tracking-widest text-slate-400">Canal</p>
                <p className="mt-1 truncate text-sm font-semibold text-slate-800 dark:text-slate-100">{selectedConversation.crm_channels?.name || "N/A"}</p>
              </div>
              <div className="rounded-xl border border-slate-200 p-3 dark:border-slate-700">
                <p className="text-[11px] font-black uppercase tracking-widest text-slate-400">Status</p>
                <p className="mt-1 truncate text-sm font-semibold text-slate-800 dark:text-slate-100">{ownershipLabel}</p>
              </div>
              <div className="rounded-xl border border-slate-200 p-3 dark:border-slate-700">
                <p className="text-[11px] font-black uppercase tracking-widest text-slate-400">Mensagens</p>
                <p className="mt-1 text-sm font-semibold text-slate-800 dark:text-slate-100">{selectedConversation.message_count || visibleMessages.length}</p>
              </div>
              <div className="rounded-xl border border-slate-200 p-3 dark:border-slate-700">
                <p className="text-[11px] font-black uppercase tracking-widest text-slate-400">Última atividade</p>
                <p className="mt-1 truncate text-sm font-semibold text-slate-800 dark:text-slate-100">{formatConversationDate(selectedConversation.last_message_at || selectedConversation.lastMessage?.created_at || null)}</p>
              </div>
            </div>

            <div className="rounded-xl border border-slate-200 p-3 dark:border-slate-700">
              <p className="text-[11px] font-black uppercase tracking-widest text-slate-400">Identificadores</p>
              <div className="mt-2 space-y-1 text-sm text-slate-700 dark:text-slate-300">
                <p className="break-all">Lead ID: {selectedConversation.lead_id}</p>
                <p className="break-all">Conversa ID: {selectedConversation.id}</p>
              </div>
            </div>
          </div>
        )}
      </Modal>

      <Modal open={isNewConversationOpen} onClose={() => closeNewConversation()} title="Nova conversa" size="md" footer={newConversationFooter} initialFocusSelector="#new-conversation-lead-name">
        <div className="space-y-4">
          <label className="block">
            <span className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-200">Nome do lead</span>
            <input id="new-conversation-lead-name" className="crm-input w-full" value={newConversationForm.name} onChange={(e) => setNewConversationForm((p) => ({ ...p, name: e.target.value }))} placeholder="Nome do contato" />
          </label>
          <label className="block">
            <span className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-200">Telefone</span>
            <input className="crm-input w-full" value={newConversationForm.phone} onChange={(e) => setNewConversationForm((p) => ({ ...p, phone: e.target.value }))} placeholder="(85) 99999-0000" inputMode="tel" />
            {normalizedNewConversationPhone && <span className="mt-1 block text-xs text-slate-500 dark:text-slate-400">Envio UAZAPI: {normalizedNewConversationPhone}</span>}
          </label>
          <label className="block">
            <span className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-200">E-mail</span>
            <input className="crm-input w-full" value={newConversationForm.email} onChange={(e) => setNewConversationForm((p) => ({ ...p, email: e.target.value }))} placeholder="email@exemplo.com" type="email" />
          </label>
          <label className="block">
            <span className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-200">Canal</span>
            <select className="crm-input w-full" value={newConversationForm.channelId} onChange={(e) => setNewConversationForm((p) => ({ ...p, channelId: e.target.value }))}>
              <option value="">Selecione um canal</option>
              {activeChannels.map((c) => <option key={c.id} value={c.id}>{c.name || c.id} · {getProviderLabel(c.provider)}</option>)}
            </select>
          </label>
        </div>
      </Modal>

      <Modal open={Boolean(editingMessage)} onClose={() => { if (!runningMessageAction) { setEditingMessage(null); setEditingMessageText(""); } }} title="Editar mensagem" size="md" footer={editMessageFooter} initialFocusSelector="#crm-edit-message-text">
        <label className="block">
          <span className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-200">Novo texto</span>
          <textarea
            id="crm-edit-message-text"
            className="crm-input min-h-32 w-full resize-y"
            value={editingMessageText}
            onChange={(event) => setEditingMessageText(event.target.value)}
            disabled={runningMessageAction}
          />
        </label>
      </Modal>

      <Modal open={Boolean(forwardingMessage)} onClose={() => { if (!runningMessageAction) { setForwardingMessage(null); setForwardTargetConversationId(""); } }} title="Encaminhar mensagem" size="md" footer={forwardMessageFooter}>
        <div className="space-y-4">
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700 dark:border-slate-700 dark:bg-slate-900/70 dark:text-slate-200">
            <p className="line-clamp-3 whitespace-pre-wrap">{forwardingMessage?.content || (forwardingMessage?.media_url ? "[mídia]" : "Mensagem sem conteúdo")}</p>
          </div>
          <label className="block">
            <span className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-200">Conversa destino</span>
            <select className="crm-input w-full" value={forwardTargetConversationId} onChange={(event) => setForwardTargetConversationId(event.target.value)} disabled={runningMessageAction}>
              <option value="">Selecione uma conversa</option>
              {forwardableConversations.map((conv) => (
                <option key={conv.id} value={conv.id}>
                  {getLeadDisplay(conv)} · {conv.crm_channels?.name || "Canal indefinido"}
                </option>
              ))}
            </select>
          </label>
        </div>
      </Modal>

      <PermissionRequest
        permission="microphone"
        open={showMicPermSheet}
        status={micPermission === 'unsupported' ? 'prompt' : micPermission}
        onAllow={() => void handleMicAllow()}
        onDeny={() => closeMicPermSheet()}
      />

      <PermissionRequest
        permission="photos"
        open={showPhotosPermSheet}
        onAllow={handlePhotosAllow}
        onDeny={() => closePhotosPermSheet()}
      />

      {/* Save view modal */}
      <Modal
        open={isSaveViewOpen}
        onClose={() => closeSaveView()}
        title="Salvar view de filtros"
        size="sm"
        footer={
          <div className="flex justify-end gap-2">
            <button type="button" className="crm-btn crm-btn-secondary" onClick={() => closeSaveView()} disabled={savingView}>Cancelar</button>
            <button type="button" className="crm-btn crm-btn-primary" onClick={() => void saveFilterView()} disabled={savingView || !saveViewName.trim()}>
              <Bookmark size={14} />
              {savingView ? "Salvando..." : "Salvar"}
            </button>
          </div>
        }
      >
        <div className="space-y-4">
          <label className="block">
            <span className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-200">Nome da view</span>
            <input className="crm-input w-full" value={saveViewName} onChange={(e) => setSaveViewName(e.target.value)} placeholder="Ex: Meta hoje não respondidas" autoFocus />
          </label>
          <label className="flex cursor-pointer items-center gap-2 text-sm text-slate-700 dark:text-slate-200">
            <input type="checkbox" checked={saveViewShared} onChange={(e) => setSaveViewShared(e.target.checked)} className="h-4 w-4 rounded border-slate-300 accent-brand-600" />
            Compartilhar com toda a equipe
          </label>
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs text-slate-500 dark:border-slate-700 dark:bg-slate-800/50 dark:text-slate-400">
            <p className="font-semibold text-slate-700 dark:text-slate-200 mb-1">Filtros que serão salvos:</p>
            <ul className="space-y-0.5">
              <li>Status: {STATUS_OPTIONS.find((o) => o.value === statusFilter)?.label}</li>
              <li>Provider: {PROVIDER_OPTIONS.find((o) => o.value === providerFilter)?.label}</li>
              <li>Canal: {channelFilter === "all" ? "Todos" : channels.find((c) => c.id === channelFilter)?.name || channelFilter}</li>
              <li>Somente não lidas: {showOnlyUnread ? "Sim" : "Não"}</li>
            </ul>
          </div>
        </div>
      </Modal>
    </CRMPageFrame>
  );
};

export default ConversationsPage;
