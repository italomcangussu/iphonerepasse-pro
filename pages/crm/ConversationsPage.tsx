import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useParams } from "react-router-dom";
import { useDisclosure } from '../../hooks/useDisclosure';
import { m, AnimatePresence } from "framer-motion";
import {
  AlertCircle,
  ArrowLeft,
  Bookmark,
  Bot,
  CheckCheck,
  FileText,
  Image as ImageIcon,
  Info,
  Mic,
  MoreVertical,
  Paperclip,
  Plus,
  RefreshCw,
  Reply,
  Send,
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
import type { MessageBubbleMessage } from "../../components/crm/MessageBubble";
import AudioRecorder from "../../components/crm/AudioRecorder";
import ConversationContextPanel from "../../components/crm/ConversationContextPanel";
import PermissionRequest from "../../components/pwa/PermissionRequest";
import { usePermissionState } from "../../hooks/usePermissionState";
import { normalizePhone } from "../../lib/phone";
import {
  normalizeAICommerceSnapshot,
  type AICommerceSnapshot,
  type AITurnEventRow,
  type LeadStateRow,
} from "../../lib/crm/aiCommerceSnapshot";
import { groupReactions } from "../../lib/crm/groupReactions";
import { useMessagesPagination } from "../../hooks/useMessagesPagination";
import { useAuth } from "../../contexts/AuthContext";
import ConversationsListPanel from "../../components/crm/ConversationsListPanel";
import ConversationMessagesPanel from "../../components/crm/ConversationMessagesPanel";
import { useConversationDrafts } from "../../components/crm/useConversationDrafts";
import {
  applyLeadAvatarUpdate,
  getAvatarTone,
  getConversationAvatarUrl,
  getInitials,
  getLeadDisplay,
  getPreviewText,
  getProviderDotClass,
  getProviderLabel,
  getProviderShortLabel,
  getStatusMeta,
  hasAIResumeWebhook,
  isAIHandlingConversation,
  isGroupConversation,
  isTransferPendingConversation,
  PROVIDER_OPTIONS,
  resolveMediaKind,
  STATUS_OPTIONS,
  type ConversationRow,
  type ConversationStatus,
  type CRMChannelRow,
  type FilterSnapshot,
  type FilterView,
  type MessagePreview,
  type ProviderFilter,
} from "../../components/crm/conversationUi";
import {
  MAX_MEDIA_BATCH_ITEMS,
  buildBatchMessagePayloads,
  ensurePublicMediaUrlReady,
  validateAttachmentSelection,
  type AttachmentPickerMode,
} from "./conversationMediaBatch";

type ConversationRawRow = Omit<ConversationRow, "crm_leads" | "crm_channels" | "lastMessage"> & {
  crm_leads?: ConversationRow["crm_leads"] | ConversationRow["crm_leads"][] | null;
  crm_channels?: ConversationRow["crm_channels"] | ConversationRow["crm_channels"][] | null;
};

type ComposerAttachment = { id: string; file: File; previewUrl: string | null };

type MediaViewerState = { url: string; type: "image" | "video" | "audio" | "document"; fileName: string } | null;

type NewConversationForm = { name: string; phone: string; email: string; channelId: string };

type ReplyingTo = { id: string; provider_message_id?: string | null; content: string | null; direction: string; sender_type: string } | null;

type MessageActionTarget = MessageBubbleMessage | null;

// ─── Constants ─────────────────────────────────────────────────────────────────

const POLL_INTERVAL_MS = 15_000;
// Distance from the bottom (px) under which the thread is considered "near the
// end": an incoming message auto-scrolls instead of showing the new-message
// pill. Mirrors the chat-room spec's NEAR_BOTTOM_THRESHOLD.
const NEAR_BOTTOM_THRESHOLD = 140;
// Single source of truth for "single-pane + back button" navigation. Only
// phones (< 768px) collapse to one panel at a time; from the iPad portrait
// width up the inbox stays a two-pane master-detail (HIG split view). This must
// match the list column's `md:` breakpoint in ConversationsListPanel and the
// phone-only slide transitions in index.css so the three never disagree on the
// boundary (the old 1023/1024/1025 split produced a broken hybrid at 1024px).
const MOBILE_MEDIA_QUERY = "(max-width: 767px)";
const MESSAGE_FILE_ACCEPT_ALL = "image/*,video/*,audio/*,.pdf,.doc,.docx,.xls,.xlsx,.txt,.csv";
const FILTERS_COLLAPSED_KEY = "crmplus.filters.collapsed";

// ─── Small helpers ──────────────────────────────────────────────────────────────

const normalizeConversationRelation = <T,>(rel: T | T[] | null | undefined): T | undefined => Array.isArray(rel) ? rel[0] : rel || undefined;

// A message's chronological position is its real send time ("hora"), not the
// DB insertion time — inbound webhooks can persist out of order, so sent_at is
// the source of truth, with created_at only as a fallback.
const messageTimeMs = (m: { sent_at?: string | null; created_at: string }): number => {
  const t = new Date(m.sent_at || m.created_at).getTime();
  return Number.isNaN(t) ? 0 : t;
};

// Recency of a conversation for the list ordering: the latest message's real
// send time, falling back to the conversation's stored last_message_at.
const conversationRecencyMs = (conv: { last_message_at: string | null; lastMessage?: MessagePreview | null }): number => {
  const previewMs = conv.lastMessage ? messageTimeMs(conv.lastMessage) : 0;
  const lastMs = conv.last_message_at ? new Date(conv.last_message_at).getTime() : 0;
  return Math.max(previewMs, Number.isNaN(lastMs) ? 0 : lastMs);
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
      <button type="button" className="absolute right-4 top-4 inline-flex h-11 w-11 items-center justify-center rounded-ios-lg bg-white/10 text-white hover:bg-white/20" onClick={onClose} aria-label="Fechar mídia">
        <X size={18} />
      </button>
      {state.type === "image" ? (
        <img src={state.url} alt={state.fileName} className="max-h-[86vh] max-w-[92vw] rounded-ios-lg object-contain" />
      ) : state.type === "video" ? (
        <video src={state.url} className="max-h-[86vh] max-w-[92vw] rounded-ios-lg" controls autoPlay />
      ) : state.type === "audio" ? (
        <div className="w-full max-w-xl rounded-ios-2xl bg-white p-4 shadow-ios26-lg">
          <p className="mb-3 truncate text-sm font-semibold text-slate-900">{state.fileName}</p>
          <audio src={state.url} controls className="w-full" autoPlay />
        </div>
      ) : isPdfDocument(state) ? (
        <div className="flex h-[86vh] w-full max-w-5xl flex-col overflow-hidden rounded-ios-2xl bg-white shadow-ios26-lg">
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
        <div className="w-full max-w-xl rounded-ios-2xl bg-white p-5 text-center shadow-ios26-lg">
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

/**
 * Safely render a ts_headline snippet (StartSel=<mark>, StopSel=</mark>) over a
 * raw message body. Text segments are rendered as escaped JSX children — so any
 * HTML in the message body is inert — while only the known marker delimiters
 * produce real <mark> highlights. Avoids XSS from dangerouslySetInnerHTML.
 */
const renderSearchSnippet = (snippet: string): React.ReactNode => {
  if (!snippet) return null;
  return snippet.split(/(<mark>|<\/mark>)/g).reduce<{ nodes: React.ReactNode[]; on: boolean }>(
    (acc, part, i) => {
      if (part === '<mark>') return { ...acc, on: true };
      if (part === '</mark>') return { ...acc, on: false };
      if (part === '') return acc;
      acc.nodes.push(
        acc.on ? (
          <mark key={i} className="rounded bg-amber-200 px-0.5 text-inherit dark:bg-amber-500/40">{part}</mark>
        ) : (
          <span key={i}>{part}</span>
        )
      );
      return acc;
    },
    { nodes: [], on: false }
  ).nodes;
};

const ConversationsPage: React.FC = () => {
  const toast = useToast();
  const { user } = useAuth();
  const { conversationId: routeConversationId } = useParams<{ conversationId?: string }>();

  // ── layout & loading states
  const [loadingConversations, setLoadingConversations] = useState(true);
  const [conversationLoadError, setConversationLoadError] = useState<string | null>(null);
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
  const { draft, setDraft, clearDraft, restoreAfterFailure } = useConversationDrafts(selectedConversationId);
  const [mediaViewer, setMediaViewer] = useState<MediaViewerState>(null);
  const [commerceSnapshot, setCommerceSnapshot] = useState<AICommerceSnapshot | null>(null);
  const [loadingCommerceSnapshot, setLoadingCommerceSnapshot] = useState(false);

  // ── composer
  const [composerError, setComposerError] = useState<string | null>(null);
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
  const [microphoneStream, setMicrophoneStream] = useState<MediaStream | null>(null);
  const [sendingAudio, setSendingAudio] = useState(false);
  const [handoffLoading, setHandoffLoading] = useState<"assume" | "ai" | null>(null);
  const { isOpen: showMicPermSheet, open: openMicPermSheet, close: closeMicPermSheet } = useDisclosure();
  const { isOpen: showPhotosPermSheet, open: openPhotosPermSheet, close: closePhotosPermSheet } = useDisclosure();
  // Mobile: a single "+" affordance opens this action sheet (Foto/Vídeo · Arquivo)
  // instead of two separate 48px buttons stealing width from the textarea.
  const { isOpen: isAttachSheetOpen, open: openAttachSheet, close: closeAttachSheet } = useDisclosure();
  const pendingFilePickerModeRef = useRef<AttachmentPickerMode>("single");
  const micPermission = usePermissionState('microphone');

  useEffect(() => {
    if (!isAttachSheetOpen) return undefined;

    const handleAttachSheetKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") closeAttachSheet();
    };

    document.addEventListener("keydown", handleAttachSheetKeyDown);
    return () => document.removeEventListener("keydown", handleAttachSheetKeyDown);
  }, [closeAttachSheet, isAttachSheetOpen]);

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
  const messagesCountRef = useRef(0);
  const composerRef = useRef<HTMLElement | null>(null);
  // Auto-growing composer textarea (grows up to COMPOSER_MAX_TEXTAREA_PX, then
  // scrolls internally).
  const composerTextareaRef = useRef<HTMLTextAreaElement | null>(null);
  const leadOptionsRef = useRef<HTMLDivElement | null>(null);
  const topSentinelRef = useRef<HTMLDivElement | null>(null);
  const initialPinSettleTimeoutRef = useRef<number | null>(null);
  // Gates "load older" so it can only fire after the conversation has settled
  // pinned to the newest message — otherwise the top sentinel is visible during
  // the first render frames (scrollTop 0) and would auto-load older history,
  // dragging the view to the top instead of showing the latest messages.
  const initialPinSettledRef = useRef(false);
  // Tracks the newest rendered message so we can tell an appended message
  // (realtime/poll/send) apart from a prepended older page when following.
  const lastVisibleIdRef = useRef<string | null>(null);
  const presenceLastSentRef = useRef<{ key: string; at: number } | null>(null);

  // ── pagination hook
  const {
    messages,
    loadingInitial: loadingMessages,
    loadingOlder,
    hasMore,
    newMessageCount,
    clearNewMessageCount,
    loadMore,
    loadError: messagesLoadError,
    reload: reloadMessages,
    retryInitial: retryInitialMessages,
  } = useMessagesPagination(selectedConversationId, scrollContainerRef);

  const retryLoadMessages = useCallback(() => {
    void retryInitialMessages();
  }, [retryInitialMessages]);

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
      // Most recent conversation on top — by the latest message's real send time
      // ("hora"), with the conversation's last_message_at as a fallback. This is
      // the inverse of the message thread (newest first instead of newest last).
      return conversationRecencyMs(right) - conversationRecencyMs(left);
    });
  }, [channelFilter, conversations, providerFilter, search, showOnlyUnread, statusFilter]);

  const unreadTotal = useMemo(() => filteredConversations.reduce((acc, c) => acc + Number(c.unread_count || 0), 0), [filteredConversations]);

  const visibleMessages = useMemo(() => {
    const persistedIds = new Set(messages.map((message) => message.id));
    const pendingForConversation = selectedConversationId
      ? pendingMessages.filter((message) => message.conversation_id === selectedConversationId && !persistedIds.has(message.id))
      : [];
    const merged = pendingForConversation.length > 0 ? [...messages, ...pendingForConversation] : [...messages];
    // Always order by real send time so the genuinely latest message ("hora")
    // ends up last/pinned to the bottom, regardless of DB insertion order.
    return merged.sort((a, b) => messageTimeMs(a) - messageTimeMs(b));
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
    setComposerError(null);
  }, [selectedConversationId]);

  // Auto-grow the composer textarea to fit its content up to 118px, then let it
  // scroll internally (matches the chat-room composer spec).
  const autoSizeComposer = useCallback(() => {
    const el = composerTextareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 118)}px`;
  }, []);

  // Resize the textarea whenever the draft changes (typing, draft restore, clear).
  useEffect(() => { autoSizeComposer(); }, [draft, autoSizeComposer]);

  const loadConversations = useCallback(async (options: { showLoader?: boolean; silent?: boolean } = {}) => {
    const { showLoader = true, silent = false } = options;
    if (showLoader) setLoadingConversations(true);
    setConversationLoadError(null);
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
          .select("conversation_id,content,created_at,sent_at,direction,media_url,media_type,status")
          .in("conversation_id", ids)
          .order("created_at", { ascending: false })
          .limit(ids.length * 3);
        const previewMap = new Map<string, MessagePreview>();
        // Keep the genuinely latest message per conversation by real send time
        // ("hora"), not DB insertion order — webhooks can persist out of order.
        ((lastMessages || []) as MessagePreview[]).forEach((m) => {
          const existing = previewMap.get(m.conversation_id);
          if (!existing || messageTimeMs(m) > messageTimeMs(existing)) previewMap.set(m.conversation_id, m);
        });
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
      setConversationLoadError("Verifique sua conexão e tente novamente.");
      if (!silent) toast.error((error as Error)?.message || "Falha ao carregar conversas.");
    } finally {
      if (showLoader) setLoadingConversations(false);
    }
  }, [routeConversationId, toast]);

  const retryLoadConversations = useCallback(() => {
    void loadConversations();
  }, [loadConversations]);

  const markSelectedAsRead = useCallback(async (conversationId: string, options: { silent?: boolean } = {}) => {
    const unreadResult = await supabase
      .from("crm_messages")
      .select("id, provider_message_id, channel_id")
      .eq("conversation_id", conversationId)
      .eq("direction", "inbound")
      .is("read_at", null);
    assertNoError(unreadResult);
    const unreadMessages = unreadResult.data;

    const providerIds = Array.from(new Set(
      ((unreadMessages || []) as Array<{ provider_message_id?: string | null }>)
        .map((message) => String(message.provider_message_id || "").trim())
        .filter(Boolean),
    ));

    const readAt = new Date().toISOString();
    const [conversationUpdate, messagesUpdate] = await Promise.all([
      supabase.from("crm_conversations").update({ unread_count: 0, updated_at: readAt }).eq("id", conversationId).gt("unread_count", 0),
      supabase.from("crm_messages").update({ status: "read", read_at: readAt }).eq("conversation_id", conversationId).eq("direction", "inbound").is("read_at", null),
    ]);
    assertNoError(conversationUpdate);
    assertNoError(messagesUpdate);

    const conversation = conversations.find((c) => c.id === conversationId);
    const channelId = conversation?.channel_id || ((unreadMessages || []) as Array<{ channel_id?: string | null }>).find((message) => message.channel_id)?.channel_id;
    if (channelId && providerIds.length > 0) {
      try {
        const { data, error } = await supabase.functions.invoke("crm-uaz-message-action", {
          body: {
            action: "mark_read",
            conversationId,
            channelId,
            messageId: providerIds[0],
            payload: { ids: providerIds },
          },
        });
        if (error || data?.error) throw error || new Error(String(data.error));
      } catch (error) {
        if (!options.silent) console.warn("Falha ao confirmar leitura na UAZAPI", error);
      }
    }
  }, [conversations]);

  const handleMarkSelectedAsRead = useCallback(async () => {
    if (!selectedConversation) return;
    try {
      await markSelectedAsRead(selectedConversation.id);
      setConversations((prev) => prev.map((c) => c.id === selectedConversation.id ? { ...c, unread_count: 0 } : c));
      toast.success("Conversa marcada como lida.");
    } catch (error) {
      toast.error((error as Error)?.message || "Falha ao marcar como lida.");
    }
  }, [markSelectedAsRead, selectedConversation, toast]);

  const sendConversationPresence = useCallback((presence: "composing" | "recording" | "paused") => {
    if (!selectedConversation?.channel_id) return;
    const now = Date.now();
    const key = `${selectedConversation.id}:${presence}`;
    const last = presenceLastSentRef.current;
    if (presence !== "paused" && last?.key === key && now - last.at < 7000) return;
    presenceLastSentRef.current = { key, at: now };

    void supabase.functions.invoke("crm-uaz-message-action", {
      body: {
        action: "presence",
        conversationId: selectedConversation.id,
        channelId: selectedConversation.channel_id,
        payload: { presence },
      },
    }).then(({ data, error }) => {
      if (error || data?.error) console.warn("Falha ao enviar presença UAZAPI", error || data.error);
    });
  }, [selectedConversation]);

  const loadCommerceSnapshot = useCallback(async (leadId: string, conversationId: string) => {
    setLoadingCommerceSnapshot(true);
    try {
      const [stateResult, eventResult] = await Promise.all([
        supabase
          .from("lead_state")
          .select("commerce_state,tradein_assessment,quote_versions,state_version")
          .eq("lead_id", leadId)
          .maybeSingle(),
        supabase
          .from("ai_turn_events")
          .select("action,outcome,created_at")
          .eq("conversation_id", conversationId)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle(),
      ]);
      if (stateResult.error) throw stateResult.error;
      if (eventResult.error) throw eventResult.error;
      setCommerceSnapshot(normalizeAICommerceSnapshot(
        stateResult.data as LeadStateRow | null,
        eventResult.data as AITurnEventRow | null,
      ));
    } catch {
      setCommerceSnapshot(null);
    } finally {
      setLoadingCommerceSnapshot(false);
    }
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
        loadCommerceSnapshot(selectedConversation.lead_id, selectedConversation.id),
      ]);
      toast.success("Lead atualizado.");
    } catch (error: unknown) {
      toast.error((error as Error)?.message || "Falha ao atualizar lead.");
    } finally {
      setIsRefreshing(false);
    }
  }, [loadCommerceSnapshot, loadConversations, reloadMessages, selectedConversation, toast]);

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
      assertNoError(await supabase.functions.invoke("crm-delete-conversation", {
        body: { conversationId: removedId },
      }));
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
  // Pin to the newest message by scrolling the messages container to its
  // maximum. The scroller has a bottom padding equal to the composer obstruction
  // gap (--crm-mobile-composer-obstruction-height), so scrolling fully to the end
  // leaves the last message just above the composer instead of behind it.
  const pinToBottom = useCallback((behavior: ScrollBehavior) => {
    const el = scrollContainerRef.current;
    if (el) {
      el.scrollTo({ top: el.scrollHeight, behavior });
    } else {
      messagesEndRef.current?.scrollIntoView({ block: "end", inline: "nearest", behavior });
    }
  }, []);

  const scrollToBottom = useCallback((smooth = true) => {
    pinToBottom(smooth ? "smooth" : "auto");
  }, [pinToBottom]);

  // Reliably pin to the newest message when a conversation opens. A single rAF
  // runs before late layout (media/images, font metrics) settles, so the thread
  // appeared scrolled up; re-pin across a few frames/timeouts until it sticks.
  const scrollToBottomSettled = useCallback(() => {
    const jump = () => pinToBottom("auto");
    requestAnimationFrame(() => { jump(); requestAnimationFrame(jump); });
    [80, 200, 400, 700].forEach((delay) => window.setTimeout(jump, delay));
    isAtBottomRef.current = true;
  }, [pinToBottom]);

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
    isAtBottomRef.current = distanceFromBottom < NEAR_BOTTOM_THRESHOLD;
  }, []);

  const openMediaViewer = useCallback((url: string, type: NonNullable<MediaViewerState>["type"], fileName: string) => {
    setMediaViewer({ url, type, fileName });
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
    setComposerError(null);
    setSending(true);
    clearDraft();
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
      // Permite que o React injete o nó e o browser calcule o layout
      requestAnimationFrame(() => {
        setTimeout(() => scrollToBottom(), 50);
      });
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
      setComposerError(null);
      if (Number(selectedConversation.unread_count || 0) > 0) {
        await markSelectedAsRead(selectedConversation.id, { silent: true });
      }
      await Promise.all([loadConversations({ showLoader: false, silent: true }), reloadMessages(true)]);
      if (shouldShowOptimisticMessage) {
        setPendingMessages((prev) => prev.filter((message) => message.id !== optimisticId));
      }
      toast.success(queued.length > 0 ? "Mídia enviada." : "Mensagem enviada.");
    } catch (error: unknown) {
      const failure = (error as Error)?.message || "Falha ao enviar mensagem.";
      restoreAfterFailure(content);
      setComposerError("Não foi possível enviar. Verifique sua conexão e tente novamente.");
      if (shouldShowOptimisticMessage) {
        setPendingMessages((prev) => prev.map((message) => message.id === optimisticId ? {
          ...message,
          status: "failed",
          error_message: failure,
        } : message));
      }
    } finally {
      sendConversationPresence("paused");
      setSending(false);
    }
  }, [attachedMedia, clearAttachments, clearDraft, currentUserDisplayName, draft, loadConversations, markSelectedAsRead, reloadMessages, replyingTo, restoreAfterFailure, scrollToBottom, selectedConversation, sendConversationPresence, toast, uploadAttachment, user?.id]);

  const retryFailedMessage = useCallback(async (message: MessageBubbleMessage) => {
    if (!selectedConversation?.channel_id || message.status !== "failed") return;

    setPendingMessages((previous) => previous.map((item) => (
      item.id === message.id ? { ...item, status: "pending", error_message: null } : item
    )));
    setComposerError(null);

    try {
      const { data, error } = await supabase.functions.invoke("crm-send-message", {
        body: {
          conversationId: selectedConversation.id,
          leadId: selectedConversation.lead_id,
          channelId: selectedConversation.channel_id,
          content: String(message.content || ""),
          ...(message.reply_to_provider_message_id ? {
            replyToProviderMessageId: message.reply_to_provider_message_id,
            replyPreviewText: message.reply_preview_text,
          } : {}),
        },
      });
      if (error) throw error;
      if (data?.error) throw new Error(String(data.error));

      setPendingMessages((previous) => previous.filter((item) => item.id !== message.id));
      if (draft === String(message.content || "")) clearDraft();
      await Promise.all([loadConversations({ showLoader: false, silent: true }), reloadMessages(true)]);
      toast.success("Mensagem enviada.");
    } catch (error: unknown) {
      setPendingMessages((previous) => previous.map((item) => (
        item.id === message.id
          ? { ...item, status: "failed", error_message: (error as Error)?.message || "Falha ao enviar mensagem." }
          : item
      )));
      setComposerError("Não foi possível enviar. Verifique sua conexão e tente novamente.");
    }
  }, [clearDraft, draft, loadConversations, reloadMessages, selectedConversation, toast]);

  // ── audio recording / voice notes
  const handleMicAllow = useCallback(async () => {
    closeMicPermSheet();
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      setMicrophoneStream(stream);
      setIsRecording(true);
      sendConversationPresence("recording");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Não foi possível acessar o microfone.";
      toast.error(message);
    }
  }, [closeMicPermSheet, sendConversationPresence, toast]);

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
          voiceNote: true,
        },
      }));
      if (data?.error) throw new Error(String(data.error));

      setIsRecording(false);
      setMicrophoneStream(null);
      if (Number(selectedConversation.unread_count || 0) > 0) {
        await markSelectedAsRead(selectedConversation.id, { silent: true });
      }
      await Promise.all([loadConversations({ showLoader: false, silent: true }), reloadMessages(true)]);
      toast.success("Áudio enviado.");
    } catch (err: unknown) {
      toast.error((err as Error)?.message || "Falha ao enviar áudio.");
    } finally {
      sendConversationPresence("paused");
      setSendingAudio(false);
    }
  }, [loadConversations, markSelectedAsRead, reloadMessages, selectedConversation, sendConversationPresence, toast]);

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

  useEffect(() => {
    if (typeof document === "undefined") return undefined;
    document.documentElement.classList.toggle("is-crm-thread-open", isMobileViewport && Boolean(selectedConversationId));
    return () => document.documentElement.classList.remove("is-crm-thread-open");
  }, [isMobileViewport, selectedConversationId]);
  useEffect(() => { attachedMediaRef.current = attachedMedia; }, [attachedMedia]);

  useEffect(() => {
    if (!isMobileViewport || !selectedConversationId || typeof window === "undefined") return undefined;
    const composer = composerRef.current;
    if (!composer) return undefined;

    let frame = 0;
    const setComposerVar = (value: string | null) => {
      [document.documentElement, document.querySelector<HTMLElement>(".crm-plus-theme")]
        .filter((target): target is HTMLElement => Boolean(target))
        .forEach((target) => {
          if (value === null) target.style.removeProperty("--crm-mobile-composer-height");
          else target.style.setProperty("--crm-mobile-composer-height", value);
        });
    };
    const updateComposerHeight = () => {
      window.cancelAnimationFrame(frame);
      frame = window.requestAnimationFrame(() => {
        const height = Math.ceil(composer.getBoundingClientRect().height);
        // The breathing gap above the composer lives in --crm-mobile-composer-gap
        // (added into --crm-mobile-composer-obstruction-height), not here.
        setComposerVar(`${Math.max(72, height)}px`);
      });
    };

    updateComposerHeight();
    const observer = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(updateComposerHeight);
    observer?.observe(composer);
    window.visualViewport?.addEventListener("resize", updateComposerHeight);
    window.addEventListener("resize", updateComposerHeight);
    window.addEventListener("orientationchange", updateComposerHeight);

    return () => {
      window.cancelAnimationFrame(frame);
      observer?.disconnect();
      window.visualViewport?.removeEventListener("resize", updateComposerHeight);
      window.removeEventListener("resize", updateComposerHeight);
      window.removeEventListener("orientationchange", updateComposerHeight);
      setComposerVar(null);
    };
  }, [isMobileViewport, selectedConversationId, attachedMedia.length, replyingTo, isRecording]);

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
    if (!selectedConversation) {
      setCommerceSnapshot(null);
      return;
    }
    void loadCommerceSnapshot(selectedConversation.lead_id, selectedConversation.id);
  }, [loadCommerceSnapshot, selectedConversation]);

  useEffect(() => {
    const channel = supabase
      .channel('crm-conversations-list')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'crm_conversations' }, () => {
        void loadConversations({ showLoader: false, silent: true });
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'crm_leads' }, (payload) => {
        const lead = payload.new as { id?: string; avatar_url?: string | null };
        if (!lead.id || !Object.prototype.hasOwnProperty.call(lead, 'avatar_url')) return;
        setConversations((current) => applyLeadAvatarUpdate(current, {
          id: lead.id as string,
          avatar_url: lead.avatar_url ?? null,
        }));
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
        const storeIds = Array.from(new Set(conversations.map((conversation) => String(conversation.store_id || "").trim()).filter(Boolean)));
        if (storeIds.length === 0) {
          setMessageSearchResults([]);
          return;
        }
        const results = await Promise.all(storeIds.map((storeId) =>
          supabase.rpc("search_crm_messages", { p_store_id: storeId, p_query: search.trim(), p_limit: 20 })
        ));
        const rows = results.flatMap(({ data }) => (data || []) as Array<{ conversation_id: string; message_id: string; snippet: string; rank: number }>);
        const unique = new Map<string, { conversation_id: string; message_id: string; snippet: string; rank: number }>();
        rows.forEach((row) => {
          const key = `${row.conversation_id}:${row.message_id}`;
          const existing = unique.get(key);
          if (!existing || Number(row.rank || 0) > Number(existing.rank || 0)) unique.set(key, row);
        });
        setMessageSearchResults(Array.from(unique.values()).sort((a, b) => Number(b.rank || 0) - Number(a.rank || 0)).slice(0, 20));
      } catch { setMessageSearchResults([]); }
      finally { setSearchingMessages(false); }
    }, 300);
    return () => { if (searchTimerRef.current) clearTimeout(searchTimerRef.current); };
  }, [conversations, search, searchMode]);

  useEffect(() => {
    // On mobile the options render as a portaled bottom sheet (outside
    // leadOptionsRef) that already has its own backdrop to dismiss it, so this
    // outside-click handler must not run there — it would treat taps on the
    // sheet as "outside" and close it before the action fires.
    if (!isLeadOptionsOpen || isMobileViewport) return undefined;
    const onPointerDown = (event: PointerEvent) => {
      if (leadOptionsRef.current?.contains(event.target as Node)) return;
      setIsLeadOptionsOpen(false);
    };
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [isLeadOptionsOpen, isMobileViewport]);

  useEffect(() => {
    setIsLeadOptionsOpen(false);
    setIsLeadInfoOpen(false);
  }, [selectedConversationId]);

  useEffect(() => {
    const id = window.setInterval(async () => {
      void loadConversations({ showLoader: false, silent: true });
      const wasAtBottom = isAtBottomRef.current;
      const beforeCount = messagesCountRef.current;
      await reloadMessages(true);
      // Only animate the scroll when a new message actually arrived and the user
      // was already at the bottom — mirrors native messenger behavior.
      if (wasAtBottom) {
        const grew = messagesCountRef.current > beforeCount;
        requestAnimationFrame(() => scrollToBottom(grew));
      }
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
    if (initialPinSettleTimeoutRef.current !== null) {
      window.clearTimeout(initialPinSettleTimeoutRef.current);
      initialPinSettleTimeoutRef.current = null;
    }
    // Block "load older" until this conversation has loaded and pinned to the
    // bottom (re-enabled in the first-load pin effect below), so opening a chat
    // never auto-loads older history at the top.
    initialPinSettledRef.current = false;
    lastVisibleIdRef.current = null;
    isAtBottomRef.current = true;
    if (selectedConversationId) scrollToBottomSettled();
  }, [selectedConversationId, scrollToBottomSettled]);

  // Keep a live message count for the poll's new-message detection.
  useEffect(() => { messagesCountRef.current = messages.length; }, [messages.length]);

  // When messages first load, pin to the newest message (settled), then allow
  // "load older" once the settle passes have run (scrollToBottomSettled re-pins
  // through 700ms). Tying this to load completion (not conversation selection)
  // avoids a race where a slow fetch enables loading before the pin.
  useEffect(() => {
    if (!loadingMessages && messages.length > 0 && !initialPinSettledRef.current) {
      const conversationIdAtPin = selectedConversationId;
      scrollToBottomSettled();
      if (initialPinSettleTimeoutRef.current !== null) {
        window.clearTimeout(initialPinSettleTimeoutRef.current);
      }
      initialPinSettleTimeoutRef.current = window.setTimeout(() => {
        if (selectedConversationId === conversationIdAtPin) {
          initialPinSettledRef.current = true;
        }
        initialPinSettleTimeoutRef.current = null;
      }, 750);
    }
  }, [loadingMessages, messages.length, scrollToBottomSettled, selectedConversationId]);

  useEffect(() => () => {
    if (initialPinSettleTimeoutRef.current !== null) {
      window.clearTimeout(initialPinSettleTimeoutRef.current);
    }
  }, []);

  // Follow the newest message: when a message is appended at the end (a new
  // inbound/outbound message) while the user is pinned to the bottom, keep it in
  // view and drop the "new messages" pill. Prepending older history (loadMore)
  // leaves the newest id unchanged, so it never triggers a jump to the bottom.
  useEffect(() => {
    const newestId = visibleMessages.length > 0 ? visibleMessages[visibleMessages.length - 1].id : null;
    const hadPrevious = lastVisibleIdRef.current !== null;
    const appended = newestId !== null && newestId !== lastVisibleIdRef.current;
    lastVisibleIdRef.current = newestId;
    // The very first population after opening is handled by the pin effect above.
    if (appended && hadPrevious && isAtBottomRef.current) {
      clearNewMessageCount();
      requestAnimationFrame(() => scrollToBottom(true));
    }
  }, [visibleMessages, clearNewMessageCount, scrollToBottom]);

  // IntersectionObserver for top sentinel (load older)
  useEffect(() => {
    const sentinel = topSentinelRef.current;
    if (!sentinel || !hasMore) return;
    const observer = new IntersectionObserver(
      (entries) => {
        // Only load older history once the chat has settled pinned to the newest
        // message. Before that, the top sentinel is visible during the first
        // render frames (scrollTop 0) and would auto-load older history, dragging
        // the view to the top instead of showing the latest messages.
        if (entries[0]?.isIntersecting && initialPinSettledRef.current) {
          void loadMore();
        }
      },
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
      <div className={`crm-conversation-shell border border-slate-200/50 bg-white shadow-ios26-lg dark:border-slate-800 dark:bg-slate-950 ${isMobileViewport && selectedConversationId ? "is-mobile-thread-open" : ""}`}>
        <div
          className="crm-conversation-panel bg-white dark:bg-slate-950"
          style={{ minHeight: isMobileViewport ? "0px" : "560px" }}
        >

          {/* ── Left sidebar */}
          {listVisible && (
            <ConversationsListPanel
              activeFiltersCount={activeFiltersCount}
              applyFilterView={applyFilterView}
              channelFilter={channelFilter}
              channels={channels}
              clearConversationFilters={clearConversationFilters}
              closeMobileFilters={closeMobileFilters}
              conversationsById={conversationsById}
              deleteFilterView={deleteFilterView}
              filteredConversations={filteredConversations}
              filtersCollapsed={filtersCollapsed}
              filterViews={filterViews}
              handleSelectConversation={handleSelectConversation}
              hasActiveFilters={hasActiveFilters}
              isMobileFiltersOpen={isMobileFiltersOpen}
              isMobileViewport={isMobileViewport}
              loadError={conversationLoadError}
              loadingConversations={loadingConversations}
              messageSearchResults={messageSearchResults}
              openMessageSearchResult={openMessageSearchResult}
              openMobileFilters={openMobileFilters}
              openSaveView={openSaveView}
              providerFilter={providerFilter}
              renderSearchSnippet={renderSearchSnippet}
              retryLoadConversations={retryLoadConversations}
              search={search}
              searchingMessages={searchingMessages}
              searchMode={searchMode}
              selectedConversationId={selectedConversationId}
              setChannelFilter={setChannelFilter}
              setMessageSearchResults={setMessageSearchResults}
              setProviderFilter={setProviderFilter}
              setSaveViewName={setSaveViewName}
              setSaveViewShared={setSaveViewShared}
              setSearch={setSearch}
              setSearchMode={setSearchMode}
              setShowOnlyUnread={setShowOnlyUnread}
              setStatusFilter={setStatusFilter}
              showOnlyUnread={showOnlyUnread}
              startConversation={openNewConversationModal}
              statusFilter={statusFilter}
              toggleFiltersCollapsed={toggleFiltersCollapsed}
              unreadTotal={unreadTotal}
            />
          )}

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
                    <button type="button" onClick={() => setSelectedConversationId(null)} className="inline-flex h-11 w-11 items-center justify-center rounded-xl border border-slate-200/60 text-slate-700 transition-all hover:bg-slate-100 active:scale-95 dark:border-slate-700/60 dark:text-slate-200 dark:hover:bg-slate-800" aria-label="Voltar">
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
                    <p className={`truncate text-[11px] font-medium lg:text-xs ${selectedTransferPending ? "font-semibold text-red-600 dark:text-red-400" : selectedIsAIHandling ? "font-semibold text-orange-600 dark:text-orange-400" : "text-slate-500 dark:text-slate-400"}`}>{selectedIsGroup ? "Conversa em grupo" : selectedConversation.crm_leads?.phone || "Sem telefone"} · {selectedConversation.crm_channels?.name || "N/A"} · {ownershipLabel}</p>
                  </div>
                  {Number(selectedConversation.unread_count || 0) > 0 && (
                    <button
                      type="button"
                      className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-emerald-200/80 bg-emerald-50 text-emerald-700 shadow-sm transition-colors hover:bg-emerald-100 dark:border-emerald-900/70 dark:bg-emerald-950/40 dark:text-emerald-300 dark:hover:bg-emerald-900/50"
                      onClick={() => void handleMarkSelectedAsRead()}
                      title="Marcar como lida"
                      aria-label="Marcar conversa como lida"
                    >
                      <CheckCheck size={18} />
                    </button>
                  )}
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
                    {/* Mobile: portal the bottom sheet to <body>. The conversation
                        header uses `liquid-glass-strong` (backdrop-filter), which
                        makes it the containing block for any fixed-positioned
                        descendant — so a sheet rendered here would anchor to the
                        header at the top of the screen instead of the viewport,
                        sliding up into the non-visible area above it. */}
                    {isMobileViewport && createPortal(
                      <AnimatePresence>
                        {isLeadOptionsOpen && (
                          <>
                            <m.button
                              type="button"
                              className="fixed inset-0 z-40 bg-slate-950/30 backdrop-blur-[1px] lg:hidden"
                              aria-label="Fechar opções"
                              onClick={() => setIsLeadOptionsOpen(false)}
                              initial={{ opacity: 0 }}
                              animate={{ opacity: 1 }}
                              exit={{ opacity: 0 }}
                            />
                            <m.div
                              role="dialog"
                              aria-modal="true"
                              className="fixed inset-x-0 bottom-0 z-50 mx-auto max-h-[82dvh] max-w-lg overflow-y-auto rounded-t-2xl border border-slate-200 bg-white px-4 pb-4 pt-3 shadow-2xl dark:border-slate-800 dark:bg-slate-950 lg:hidden"
                              style={{ paddingBottom: "max(1rem, env(safe-area-inset-bottom))" }}
                              initial={{ y: 28, opacity: 0 }}
                              animate={{ y: 0, opacity: 1 }}
                              exit={{ y: 28, opacity: 0 }}
                              transition={{ duration: 0.18 }}
                            >
                              <div className="mb-4 flex items-center justify-between">
                                <h3 className="text-sm font-bold text-slate-950 dark:text-slate-50">Opções do Lead</h3>
                                <button type="button" onClick={() => setIsLeadOptionsOpen(false)} className="crm-mobile-close-action inline-flex shrink-0 items-center justify-center rounded-full border border-slate-200 text-slate-500 dark:border-slate-700 dark:text-slate-300">
                                  <X size={16} />
                                </button>
                              </div>
                              <div className="flex flex-col gap-2">
                                <button
                                  type="button"
                                  className="flex w-full items-center gap-3 rounded-xl px-4 py-3.5 text-left font-medium text-slate-700 bg-slate-50 hover:bg-slate-100 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
                                  onClick={() => { setIsLeadOptionsOpen(false); setIsLeadInfoOpen(true); }}
                                >
                                  <Info size={18} className="text-brand-600 dark:text-brand-400" /> Informações do Lead
                                </button>
                                <button
                                  type="button"
                                  className="flex w-full items-center gap-3 rounded-xl px-4 py-3.5 text-left font-medium text-slate-700 bg-slate-50 hover:bg-slate-100 disabled:opacity-60 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
                                  disabled={isRefreshing}
                                  onClick={() => void refreshSelectedLead()}
                                >
                                  <RefreshCw size={18} className={`text-brand-600 dark:text-brand-400 ${isRefreshing ? "animate-spin" : ""}`} /> Atualizar Conversa
                                </button>
                                {selectedIsAIHandling || selectedTransferPending ? (
                                  <button
                                    type="button"
                                    className="flex w-full items-center gap-3 rounded-xl px-4 py-3.5 text-left font-semibold text-red-700 bg-red-50 hover:bg-red-100 disabled:opacity-60 dark:bg-red-950/30 dark:text-red-300 dark:hover:bg-red-900/40"
                                    disabled={handoffLoading === "assume"}
                                    onClick={() => { setIsLeadOptionsOpen(false); void assumeConversation(); }}
                                  >
                                    <Bot size={18} /> {handoffLoading === "assume" ? "Assumindo..." : "Assumir atendimento da IA"}
                                  </button>
                                ) : (
                                  <button
                                    type="button"
                                    className="flex w-full items-center gap-3 rounded-xl px-4 py-3.5 text-left font-semibold text-orange-700 bg-orange-50 hover:bg-orange-100 disabled:opacity-60 dark:bg-orange-950/30 dark:text-orange-300 dark:hover:bg-orange-900/40"
                                    disabled={handoffLoading === "ai"}
                                    onClick={() => { setIsLeadOptionsOpen(false); void transferConversationToAI(); }}
                                  >
                                    <Bot size={18} /> {selectedHasAIWebhook ? (handoffLoading === "ai" ? "Transferindo..." : "Transferir para IA") : "Configurar webhook IA"}
                                  </button>
                                )}
                                <button
                                  type="button"
                                  className="flex w-full items-center gap-3 rounded-xl px-4 py-3.5 text-left font-semibold text-red-700 bg-red-50 hover:bg-red-100 disabled:opacity-60 dark:bg-red-950/30 dark:text-red-300 dark:hover:bg-red-900/40"
                                  disabled={isDeletingLead}
                                  onClick={() => void deleteSelectedLead()}
                                >
                                  <Trash2 size={18} /> {isDeletingLead ? "Excluindo..." : "Excluir lead"}
                                </button>
                              </div>
                            </m.div>
                          </>
                        )}
                      </AnimatePresence>,
                      document.body,
                    )}
                    {!isMobileViewport && (
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
                            {selectedIsAIHandling || selectedTransferPending ? (
                              <button
                                type="button"
                                role="menuitem"
                                className="flex w-full items-center gap-3 px-4 py-2.5 text-left font-semibold text-red-700 hover:bg-red-50 disabled:opacity-60 dark:text-red-300 dark:hover:bg-red-950/30"
                                disabled={handoffLoading === "assume"}
                                onClick={() => { setIsLeadOptionsOpen(false); void assumeConversation(); }}
                              >
                                <Bot size={17} /> {handoffLoading === "assume" ? "Assumindo..." : "Assumir atendimento da IA"}
                              </button>
                            ) : (
                              <button
                                type="button"
                                role="menuitem"
                                className="flex w-full items-center gap-3 px-4 py-2.5 text-left font-semibold text-orange-700 hover:bg-orange-50 disabled:opacity-60 dark:text-orange-300 dark:hover:bg-orange-950/30"
                                disabled={handoffLoading === "ai"}
                                onClick={() => { setIsLeadOptionsOpen(false); void transferConversationToAI(); }}
                              >
                                <Bot size={17} /> {selectedHasAIWebhook ? (handoffLoading === "ai" ? "Transferindo..." : "Transferir para IA") : "Configurar webhook IA"}
                              </button>
                            )}
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
                    )}
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

                {/* Mobile handoff banner — visible immediately at top of thread on mobile.
                    Desktop already shows the status + action button in the header (hidden sm:flex). */}
                {(selectedTransferPending || selectedIsAIHandling) && (
                  <div className={`sm:hidden shrink-0 flex items-center gap-2 border-b px-3 py-2 ${selectedTransferPending ? "border-red-200/60 bg-red-50 dark:border-red-900/30 dark:bg-red-950/20" : "border-orange-200/60 bg-orange-50 dark:border-orange-900/30 dark:bg-orange-950/20"}`}>
                    <Bot size={13} className={`shrink-0 ${selectedTransferPending ? "text-red-600 dark:text-red-400" : "text-orange-600 dark:text-orange-400"}`} />
                    <p className={`min-w-0 flex-1 truncate text-xs font-semibold ${selectedTransferPending ? "text-red-700 dark:text-red-200" : "text-orange-700 dark:text-orange-200"}`}>
                      {selectedTransferPending ? "IA transferiu — toque em Assumir para responder" : "IA em atendimento ativo"}
                    </p>
                    <button
                      type="button"
                      className="inline-flex min-h-[36px] shrink-0 items-center rounded-xl bg-red-600 px-3 text-[11px] font-bold text-white transition-transform active:scale-95 disabled:opacity-60"
                      disabled={handoffLoading === "assume"}
                      onClick={() => void assumeConversation()}
                    >
                      {handoffLoading === "assume" ? "..." : "Assumir"}
                    </button>
                  </div>
                )}

                {/* Messages */}
                <ConversationMessagesPanel
                  clearNewMessageCount={clearNewMessageCount}
                  deleteMessageForEveryone={deleteMessageForEveryone}
                  handleScrollContainer={handleScrollContainer}
                  isMobileViewport={isMobileViewport}
                  loadError={messagesLoadError}
                  loadingMessages={loadingMessages}
                  loadingOlder={loadingOlder}
                  messagesEndRef={messagesEndRef}
                  newMessageCount={newMessageCount}
                  onOpenMedia={openMediaViewer}
                  openEditMessage={openEditMessage}
                  openForwardMessage={openForwardMessage}
                  reactToMessage={reactToMessage}
                  reactionsMap={reactionsMap}
                  retryLoadMessages={retryLoadMessages}
                  retryMessage={retryFailedMessage}
                  scrollContainerRef={scrollContainerRef}
                  scrollToBottom={scrollToBottom}
                  scrollToMessage={scrollToMessage}
                  selectedConversationId={selectedConversationId}
                  setReplyingTo={setReplyingTo}
                  threadGroups={threadGroups}
                  topSentinelRef={topSentinelRef}
                  visibleMessages={visibleMessages}
                />

                {/* Composer */}
                <m.footer
                  ref={composerRef}
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
  
                    <div className="flex min-w-0 max-w-full items-end gap-2">
                      {isRecording ? (
                        <AudioRecorder
                          initialStream={microphoneStream ?? undefined}
                          isSending={sendingAudio}
                          onCancel={() => {
                            if (sendingAudio) return;
                            setIsRecording(false);
                            setMicrophoneStream(null);
                            sendConversationPresence("paused");
                          }}
                          onError={(message) => {
                            toast.error(message);
                            setIsRecording(false);
                            setMicrophoneStream(null);
                          }}
                          onStop={(blob, mimeType) => { void sendAudioRecording(blob, mimeType); }}
                        />
                      ) : (
                        <>
                          {/* Attachment — circular 48px button OUTSIDE the text box, on the left.
                              Mobile: a single "+" opens the attach action sheet (Foto/Vídeo · Arquivo)
                              so there is only one attach affordance; desktop keeps the clip = single file. */}
                          <button type="button" className="inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-full text-slate-500 transition-all hover:bg-slate-100 hover:text-brand-700 active:scale-[0.96] disabled:opacity-50 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-brand-200" onClick={() => { if (isMobileViewport) openAttachSheet(); else requestFilePicker("single"); }} disabled={sending || selectedComposerLocked} title={isMobileViewport ? "Anexar" : "Anexar arquivo"} aria-label={isMobileViewport ? "Anexar foto, vídeo ou arquivo" : "Anexar arquivo"}>{isMobileViewport ? <Plus size={22} /> : <Paperclip size={20} />}</button>
                          {/* Text box — flex-1, rounded-[22px], with the image button INSIDE on the right */}
                          <div className="flex min-h-12 min-w-0 flex-1 items-end gap-1 overflow-hidden rounded-[22px] border border-slate-200 bg-slate-50/60 pr-1 transition-colors focus-within:border-brand-400 focus-within:bg-white focus-within:ring-2 focus-within:ring-brand-500/15 dark:border-slate-800 dark:bg-slate-950/60 dark:focus-within:bg-slate-900">
                            <textarea
                              ref={composerTextareaRef}
                              rows={1}
                              className="min-h-12 min-w-0 flex-1 resize-none overflow-y-auto border-0 bg-transparent px-4 py-3.5 text-[15px] leading-5 text-slate-950 outline-none placeholder:text-slate-400 dark:text-slate-50"
                              placeholder={selectedTransferPending ? 'IA transferiu para humano. Clique em "Assumir" para responder.' : selectedIsAIHandling ? "A IA está respondendo. Assuma para enviar manualmente." : attachedMedia.length > 0 ? "Legenda opcional..." : "Mensagem rápida..."}
                              spellCheck={true}
                              autoCorrect="on"
                              autoCapitalize="sentences"
                              value={draft}
                              onChange={(e) => {
                                const nextDraft = e.target.value;
                                setDraft(nextDraft);
                                sendConversationPresence(nextDraft.trim() ? "composing" : "paused");
                              }}
                              onFocus={() => {
                                // The shell shrinks to the visual viewport while the keyboard
                                // animates in, so re-anchor to the latest message once before
                                // and once after that resize settles to keep the thread visible.
                                if (!isMobileViewport) return;
                                if (!isAtBottomRef.current) return;
                                requestAnimationFrame(() => scrollToBottom(false));
                                window.setTimeout(() => { if (isAtBottomRef.current) scrollToBottom(false); }, 300);
                              }}
                              onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); void sendMessage(); } }}
                              disabled={selectedComposerLocked}
                            />
                            {/* Inner media-batch button — desktop only; on mobile it folds into the "+" action sheet. */}
                            {!isMobileViewport && (
                              <button type="button" className="mb-1.5 inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-full text-slate-500 transition-all hover:bg-slate-100 hover:text-brand-700 active:scale-[0.96] disabled:opacity-50 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-brand-200" onClick={() => requestFilePicker("media-batch")} disabled={sending || selectedComposerLocked} title="Lote de fotos/vídeos" aria-label="Anexar fotos ou vídeos"><ImageIcon size={20} /></button>
                            )}
                          </div>
                          {/* Send ↔ Microphone toggle — 48px, OUTSIDE the text box, on the right.
                              On mobile (iOS PWA) the send button is icon-only (a 48px circle that
                              mirrors the mic) so the label never steals width from the textarea;
                              desktop keeps the labeled pill where there is room. */}
                          {draft.trim() || attachedMedia.length > 0 ? (
                            <button
                              type="button"
                              className={`inline-flex h-12 shrink-0 items-center justify-center gap-2 rounded-full bg-linear-to-br from-brand-600 to-brand-700 font-black text-white shadow-lg shadow-brand-600/30 transition-all active:scale-[0.96] disabled:cursor-not-allowed disabled:opacity-50 ${isMobileViewport ? "w-12" : "px-5 text-sm"}`}
                              disabled={sending || selectedComposerLocked}
                              onClick={() => void sendMessage()}
                              title="Enviar mensagem"
                              aria-label={sending ? "Enviando mensagem" : "Enviar mensagem"}
                            >
                              {sending ? <RefreshCw size={isMobileViewport ? 20 : 16} className="animate-spin" /> : <Send size={isMobileViewport ? 20 : 16} />}
                              {!isMobileViewport && <span>{sending ? "ENVIANDO" : "ENVIAR"}</span>}
                            </button>
                          ) : (
                            <button type="button" className="inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-linear-to-br from-brand-600 to-brand-700 text-white shadow-lg shadow-brand-600/30 transition-all active:scale-[0.96] disabled:cursor-not-allowed disabled:opacity-50" disabled={sending || selectedComposerLocked} onClick={() => { if (micPermission === 'granted') { void handleMicAllow(); } else { openMicPermSheet(); } }} title="Gravar áudio" aria-label="Gravar áudio">
                              <Mic size={20} />
                            </button>
                          )}
                        </>
                      )}
                    </div>
                  </div>
                  <p className="crm-mobile-composer-hint mt-1.5 text-center text-[9px] font-semibold uppercase tracking-widest text-slate-400/60 dark:text-slate-500/60 sm:hidden">Toque em Enviar ou segure o microfone · 16MB máx</p>
                  <p className="crm-mobile-composer-hint mt-1.5 text-center text-[9px] font-semibold uppercase tracking-widest text-slate-400/60 dark:text-slate-500/60 hidden sm:block">Enter para enviar · Shift+Enter nova linha · 16MB máx</p>
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
                  <h3 className="text-xl font-black tracking-tight text-slate-950 dark:text-white">Inbox CRM</h3>
                  <p className="text-sm font-medium leading-relaxed text-slate-500 dark:text-slate-400">Selecione uma conversa à esquerda para iniciar o atendimento.</p>
                </div>
                <div className="mt-8 flex gap-3">
                  <div className="h-1 w-8 rounded-full bg-brand-600" />
                  <div className="h-1 w-2 rounded-full bg-slate-200 dark:bg-slate-800" />
                  <div className="h-1 w-2 rounded-full bg-slate-200 dark:bg-slate-800" />
                </div>
              </div>
            )}
          </section>
          {selectedConversation && (
            <ConversationContextPanel
              className="hidden xl:block"
              conversation={selectedConversation}
              leadName={selectedLeadName}
              avatarUrl={selectedAvatarUrl}
              isGroup={selectedIsGroup}
              ownershipLabel={ownershipLabel}
              messageCount={selectedConversation.message_count || visibleMessages.length}
              loadingCommerceSnapshot={loadingCommerceSnapshot}
              commerceSnapshot={commerceSnapshot}
            />
          )}
        </div>
      </div>

      {/* Mobile attach action sheet — single entry point for the composer "+".
          Portaled to <body> for the same reason as the lead-options sheet (the
          backdrop-filtered composer would otherwise be the fixed containing block). */}
      {isMobileViewport && createPortal(
        <AnimatePresence>
          {isAttachSheetOpen && (
            <>
              <m.button
                type="button"
                className="fixed inset-0 z-40 bg-slate-950/30 backdrop-blur-[1px] lg:hidden"
                aria-label="Fechar"
                onClick={closeAttachSheet}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
              />
              <m.div
                role="dialog"
                aria-modal="true"
                aria-label="Anexar"
                className="fixed inset-x-0 bottom-0 z-50 mx-auto max-w-lg rounded-t-2xl border border-slate-200 bg-white px-4 pt-3 shadow-2xl dark:border-slate-800 dark:bg-slate-950 lg:hidden"
                style={{ paddingBottom: "max(1rem, env(safe-area-inset-bottom))" }}
                initial={{ y: 28, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                exit={{ y: 28, opacity: 0 }}
                transition={{ duration: 0.18 }}
              >
                <div className="mx-auto mb-3 h-1 w-9 rounded-full bg-slate-300 dark:bg-slate-700" />
                <div className="flex flex-col gap-2">
                  <button
                    type="button"
                    className="flex w-full items-center gap-3 rounded-xl bg-slate-50 px-4 py-3.5 text-left font-medium text-slate-700 hover:bg-slate-100 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
                    onClick={() => { closeAttachSheet(); requestFilePicker("media-batch"); }}
                  >
                    <ImageIcon size={18} className="text-brand-600 dark:text-brand-400" /> Foto / Vídeo
                  </button>
                  <button
                    type="button"
                    className="flex w-full items-center gap-3 rounded-xl bg-slate-50 px-4 py-3.5 text-left font-medium text-slate-700 hover:bg-slate-100 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
                    onClick={() => { closeAttachSheet(); requestFilePicker("single"); }}
                  >
                    <Paperclip size={18} className="text-brand-600 dark:text-brand-400" /> Arquivo
                  </button>
                  <button
                    type="button"
                    className="mt-1 flex w-full items-center justify-center rounded-xl px-4 py-3.5 text-center font-semibold text-slate-500 hover:bg-slate-50 dark:text-slate-400 dark:hover:bg-slate-900"
                    onClick={closeAttachSheet}
                  >
                    Cancelar
                  </button>
                </div>
              </m.div>
            </>
          )}
        </AnimatePresence>,
        document.body,
      )}
      <MediaViewer state={mediaViewer} onClose={() => setMediaViewer(null)} />
      <Modal open={isLeadInfoOpen && Boolean(selectedConversation)} onClose={() => setIsLeadInfoOpen(false)} title="Contexto da conversa" size="md">
        {selectedConversation && (
          <ConversationContextPanel
            className="bg-transparent p-0"
            conversation={selectedConversation}
            leadName={selectedLeadName}
            avatarUrl={selectedAvatarUrl}
            isGroup={selectedIsGroup}
            ownershipLabel={ownershipLabel}
            messageCount={selectedConversation.message_count || visibleMessages.length}
            loadingCommerceSnapshot={loadingCommerceSnapshot}
            commerceSnapshot={commerceSnapshot}
          />
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
        allowLabel="Ativar microfone"
        onAllow={() => void handleMicAllow()}
        onDeny={() => closeMicPermSheet()}
      />

      <PermissionRequest
        permission="photos"
        open={showPhotosPermSheet}
        allowLabel="Escolher fotos e vídeos"
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
