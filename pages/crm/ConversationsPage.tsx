import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowLeft,
  FileText,
  Image as ImageIcon,
  MessageCircleMore,
  Mic,
  Paperclip,
  RefreshCw,
  Search,
  Send,
  UserRound,
  Video,
  X,
} from "lucide-react";
import { supabase } from "../../services/supabase";
import { useToast } from "../../components/ui/ToastProvider";
import CRMPageFrame from "../../components/crm/CRMPageFrame";
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

const getProviderLabel = (provider: string | null | undefined) => {
  if (provider === "uazapi") return "UAZAPI";
  if (provider === "instagram_official") return "Instagram Oficial";
  return provider || "-";
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

  if (kind === "image") {
    return (
      <button type="button" className="block overflow-hidden rounded-lg" onClick={() => onOpenMedia({ url, type: "image", fileName })}>
        <img src={url} alt={fileName} className="max-h-72 max-w-full rounded-lg object-cover" loading="lazy" />
      </button>
    );
  }

  if (kind === "video") {
    return (
      <button type="button" className="block overflow-hidden rounded-lg" onClick={() => onOpenMedia({ url, type: "video", fileName })}>
        <video src={url} className="max-h-72 max-w-full rounded-lg" preload="metadata" muted />
      </button>
    );
  }

  if (kind === "audio") {
    return <audio src={url} controls className="mt-1 max-w-full" />;
  }

  return (
    <button
      type="button"
      onClick={() => onOpenMedia({ url, type: "document", fileName })}
      className="inline-flex max-w-full items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-100 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 dark:hover:bg-slate-700"
    >
      <FileText size={16} className="shrink-0" />
      <span className="truncate">{fileName}</span>
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
      description="Inbox operacional para triagem, leitura de mídia e atendimento por canal."
      actions={actions}
    >
      <div className="crm-card overflow-hidden">
        <div className="flex h-[78vh] min-h-[580px]">
          <aside
            className={`w-full border-r border-slate-200/70 bg-white/95 dark:border-slate-700/70 dark:bg-slate-900/90 lg:w-[390px] lg:shrink-0 ${
              listVisible ? "flex" : "hidden"
            } flex-col`}
          >
            <div className="sticky top-0 z-10 space-y-3 border-b border-slate-200/70 bg-white/95 px-4 py-3 dark:border-slate-700/70 dark:bg-slate-900/95">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <p className="text-xs uppercase text-slate-500">Inbox</p>
                  <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                    {filteredConversations.length} conversa(s)
                  </h2>
                </div>
                <span className="inline-flex items-center rounded-full bg-brand-100 px-2.5 py-1 text-xs font-semibold text-brand-700 dark:bg-brand-500/20 dark:text-brand-200">
                  Não lidas: {unreadTotal}
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
                className={`inline-flex w-fit items-center rounded-full px-3 py-1 text-xs font-semibold ${
                  showOnlyUnread
                    ? "bg-emerald-600 text-white"
                    : "bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-200"
                }`}
                onClick={() => setShowOnlyUnread((current) => !current)}
              >
                Somente não lidas
              </button>
            </div>

            <div className="flex-1 overflow-y-auto">
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

                  return (
                    <button
                      key={conversation.id}
                      type="button"
                      onClick={() => setSelectedConversationId(conversation.id)}
                      className={`w-full border-b border-slate-100 px-4 py-3 text-left transition-colors dark:border-slate-800 ${
                        isActive ? "bg-brand-50/90 dark:bg-brand-500/12" : "hover:bg-slate-50 dark:hover:bg-slate-800/60"
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0 flex items-center gap-2">
                          <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-slate-200 text-slate-700 dark:bg-slate-700 dark:text-slate-200">
                            <UserRound size={15} />
                          </span>
                          <div className="min-w-0">
                            <p className="truncate font-semibold text-slate-900 dark:text-slate-100">{getLeadDisplay(conversation)}</p>
                            <p className="truncate text-xs text-slate-500 dark:text-slate-400">
                              {conversation.crm_channels?.name || "Canal não definido"} · {getProviderLabel(conversation.crm_channels?.provider)}
                            </p>
                          </div>
                        </div>
                        <p className="shrink-0 text-[11px] text-slate-500 dark:text-slate-400">
                          {formatConversationDate(conversation.last_message_at || conversation.lastMessage?.created_at || null)}
                        </p>
                      </div>

                      <p className="mt-2 line-clamp-2 text-xs text-slate-600 dark:text-slate-300">
                        {conversation.lastMessage?.direction === "outbound" ? "Você: " : ""}
                        {getPreviewText(conversation.lastMessage)}
                      </p>

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

          <section className={`min-w-0 flex-1 bg-slate-50/70 dark:bg-slate-950/70 ${threadVisible ? "flex" : "hidden"} flex-col`}>
            {selectedConversation ? (
              <>
                <header className="sticky top-0 z-10 flex items-center gap-3 border-b border-slate-200/70 bg-white/95 px-4 py-3 backdrop-blur dark:border-slate-700/70 dark:bg-slate-900/95">
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

                  <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand-100 text-brand-700 dark:bg-brand-500/20 dark:text-brand-200">
                    <MessageCircleMore size={16} />
                  </span>

                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-slate-900 dark:text-slate-100">{getLeadDisplay(selectedConversation)}</p>
                    <p className="truncate text-xs text-slate-500 dark:text-slate-400">
                      {selectedConversation.crm_leads?.phone || "Telefone não informado"} · {selectedConversation.crm_channels?.name || "N/A"} ({getProviderLabel(selectedConversation.crm_channels?.provider)})
                    </p>
                  </div>

                  <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${getStatusMeta(selectedConversation.status).className}`}>
                    {getStatusMeta(selectedConversation.status).label}
                  </span>
                </header>

                <div className="flex-1 space-y-3 overflow-y-auto px-4 py-4">
                  {loadingMessages ? (
                    <div className="text-sm text-slate-500">Carregando mensagens...</div>
                  ) : messages.length === 0 ? (
                    <div className="text-sm text-slate-500">Nenhuma mensagem encontrada.</div>
                  ) : (
                    messages.map((message) => {
                      const isOutbound = message.direction === "outbound";
                      return (
                        <article
                          key={message.id}
                          className={`max-w-[88%] rounded-lg px-3 py-2 text-sm shadow-sm ${
                            isOutbound
                              ? "ml-auto bg-brand-600 text-white"
                              : "bg-white text-slate-800 dark:bg-slate-800 dark:text-slate-100"
                          }`}
                        >
                          {message.reply_preview_text ? (
                            <div className={`mb-2 rounded-md border-l-2 px-2 py-1 text-xs ${
                              isOutbound ? "border-white/60 bg-white/10 text-brand-50" : "border-brand-400 bg-slate-50 text-slate-500 dark:bg-slate-700 dark:text-slate-300"
                            }`}>
                              {message.reply_preview_text}
                            </div>
                          ) : null}

                          <MessageMedia message={message} onOpenMedia={setMediaViewer} />

                          {message.content ? (
                            <p className={`${message.media_url ? "mt-2" : ""} whitespace-pre-wrap break-words`}>{message.content}</p>
                          ) : !message.media_url ? (
                            <p className="whitespace-pre-wrap break-words">[mensagem sem conteúdo]</p>
                          ) : null}

                          {message.reaction_emoji ? (
                            <p className={`mt-2 text-xs ${isOutbound ? "text-brand-100" : "text-slate-500 dark:text-slate-400"}`}>
                              Reação: {message.reaction_emoji}
                            </p>
                          ) : null}

                          <p className={`mt-1 text-[11px] ${isOutbound ? "text-brand-100" : "text-slate-500 dark:text-slate-400"}`}>
                            {formatMessageDateTime(message.sent_at || message.created_at)} · {message.status}
                            {message.error_message ? ` · ${message.error_message}` : ""}
                          </p>
                        </article>
                      );
                    })
                  )}
                  <div ref={messagesEndRef} />
                </div>

                <footer className="border-t border-slate-200/70 bg-white/95 p-3 dark:border-slate-700/70 dark:bg-slate-900/95">
                  <input ref={fileInputRef} type="file" className="hidden" onChange={handleFileSelect} />

                  {attachedMedia.length > 0 ? (
                    <div className="mb-3 flex gap-2 overflow-x-auto pb-1">
                      {attachedMedia.map((attachment) => {
                        const kind = resolveMediaKind(attachment.file.type, attachment.file.name) || "document";
                        return (
                          <div key={attachment.id} className="relative flex min-w-[140px] max-w-[180px] items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 p-2 dark:border-slate-700 dark:bg-slate-800">
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
                              <Video size={22} className="shrink-0 text-slate-500" />
                            ) : kind === "audio" ? (
                              <Mic size={22} className="shrink-0 text-slate-500" />
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

                  <div className="flex items-end gap-2">
                    <div className="flex gap-1">
                      <button
                        type="button"
                        className="crm-btn crm-btn-secondary px-3"
                        onClick={() => openFilePicker("single")}
                        disabled={sending}
                        title="Anexar arquivo"
                      >
                        <Paperclip size={16} />
                      </button>
                      <button
                        type="button"
                        className="crm-btn crm-btn-secondary px-3"
                        onClick={() => openFilePicker("media-batch")}
                        disabled={sending}
                        title="Anexar lote de fotos/vídeos"
                      >
                        <ImageIcon size={16} />
                      </button>
                    </div>
                    <textarea
                      className="crm-input min-h-[44px] max-h-28 resize-y"
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
                      className="crm-btn crm-btn-primary"
                      disabled={sending || (!draft.trim() && attachedMedia.length === 0)}
                      onClick={() => void sendMessage()}
                    >
                      <Send size={16} />
                      {sending ? "Enviando" : "Enviar"}
                    </button>
                  </div>
                  <p className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">
                    Enter envia · Shift+Enter quebra linha · anexos até 16 MB
                  </p>
                </footer>
              </>
            ) : (
              <div className="flex flex-1 items-center justify-center px-6 text-center">
                <div className="max-w-sm space-y-2">
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
    </CRMPageFrame>
  );
};

export default ConversationsPage;
