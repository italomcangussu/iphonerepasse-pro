import React, { memo, useEffect, useRef, useState } from 'react';
import { m } from 'framer-motion';
import {
  AlertTriangle,
  Bot,
  Check,
  CheckCheck,
  Clock,
  Download,
  Edit3,
  ExternalLink,
  FileText,
  Forward,
  Image as ImageIcon,
  LoaderCircle,
  MoreVertical,
  Reply,
  RefreshCw,
  Sparkles,
  Trash2,
  UserRound,
  Video,
} from 'lucide-react';
import type { ReactionSummary } from '../../lib/crm/groupReactions';
import type { MetaCampaignPreviewData } from '../../lib/crm/messageUtils';
import { supabase } from '../../services/supabase';
import DesktopContextMenuHost from '../ui/DesktopContextMenu';
import type { ContextMenuAction } from '../ui/contextMenuCore';
import AudioMessage from './AudioMessage';
import { useDesktopContextMenu } from '../../hooks/useDesktopContextMenu';
import type { MessageClusterPosition } from './messageClusters';

// ─── Types ─────────────────────────────────────────────────────────────────────

export interface MessageBubbleMessage {
  id: string;
  conversation_id?: string;
  direction: 'inbound' | 'outbound';
  sender_type: string;
  content: string | null;
  created_at: string;
  sent_at?: string | null;
  status: string;
  media_url?: string | null;
  media_type?: string | null;
  provider_message_id?: string | null;
  sender_user_id?: string | null;
  sender_display_name?: string | null;
  error_message?: string | null;
  reply_to_provider_message_id?: string | null;
  reply_preview_text?: string | null;
  reaction_target_provider_message_id?: string | null;
  reaction_emoji?: string | null;
  webhook_payload?: Record<string, unknown> | null;
}

interface Props {
  message: MessageBubbleMessage;
  reactionSummary?: ReactionSummary | null;
  metaCampaign?: MetaCampaignPreviewData | null;
  onReply?: (message: MessageBubbleMessage) => void;
  onReact?: (message: MessageBubbleMessage, emoji: string) => void;
  onForward?: (message: MessageBubbleMessage) => void;
  onEdit?: (message: MessageBubbleMessage) => void;
  onDelete?: (message: MessageBubbleMessage) => void;
  onOpenMedia?: (url: string, type: 'image' | 'video' | 'audio' | 'document' | 'sticker', fileName: string) => void;
  onRetry?: (message: MessageBubbleMessage) => void | Promise<void>;
  onScrollToReply?: (providerMessageId: string) => void;
  clusterPosition?: MessageClusterPosition;
  separateFromPrevious?: boolean;
  showSender?: boolean;
  showFooter?: boolean;
}

// ─── Helpers ───────────────────────────────────────────────────────────────────

const formatMessageTime = (value: string): string => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
};

const resolveMediaKind = (mediaType?: string | null, mediaUrl?: string | null): 'image' | 'video' | 'audio' | 'document' | 'sticker' | null => {
  const normalized = String(mediaType || '').toLowerCase();
  const url = String(mediaUrl || '').split('?')[0].toLowerCase();
  if (!normalized && !url) return null;
  if (normalized === 'sticker' || normalized.includes('sticker') || url.endsWith('.webp')) return 'sticker';
  if (normalized.includes('image') || /\.(jpg|jpeg|png|gif)$/i.test(url)) return 'image';
  if (normalized.includes('audio') || normalized === 'ptt' || normalized === 'audiomessage' || /\.(mp3|m4a|ogg|opus|wav)$/i.test(url)) return 'audio';
  if (normalized.includes('video') || /\.(mp4|mov|webm|m4v)$/i.test(url)) return 'video';
  return 'document';
};

const getFileName = (url?: string | null, fallback = 'arquivo') => {
  const clean = String(url || '').split('?')[0];
  const last = clean.split('/').filter(Boolean).pop();
  return decodeURIComponent(last || fallback);
};

const isEncryptedWhatsAppMediaUrl = (value: string) => {
  const lower = value.split('?')[0].toLowerCase();
  return value.includes('mmg.whatsapp.net') || lower.endsWith('.enc');
};

const isDownloadableMediaType = (mediaType?: string | null): boolean => {
  const normalized = String(mediaType || '').trim().toLowerCase();
  if (!normalized || normalized === 'error') return false;
  return (
    ['image', 'video', 'audio', 'document', 'sticker', 'ptt', 'myaudio', 'audiomessage', 'audio_message', 'ptv', 'videoplay'].includes(normalized) ||
    normalized.includes('image/') ||
    normalized.includes('video/') ||
    normalized.includes('audio/') ||
    normalized.includes('application/') ||
    normalized.includes('document') ||
    normalized.includes('sticker')
  );
};

const isUndecryptableWhatsAppContent = (value: unknown) => {
  const normalized = String(value ?? '')
    .trim()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
  return normalized.includes('[undecryptable]') || normalized.includes('nao foi possivel descriptografar');
};

const UNDECRYPTABLE_FALLBACK = 'Mensagem não descriptografada pela UAZAPI. Abra o WhatsApp no celular vinculado para visualizá-la.';

const getMessageStatusLabel = (status: string | null | undefined): string => {
  const n = String(status || '').toLowerCase();
  if (n === 'pending') return 'Enviando';
  if (n === 'sent') return 'Enviada';
  if (n === 'delivered') return 'Entregue';
  if (n === 'read') return 'Lida';
  if (n === 'failed') return 'Falhou';
  return status || 'Registrada';
};

const isUnconfirmedDeliveryStatus = (status: string | null | undefined): boolean => {
  const normalized = String(status || '').trim().toLowerCase();
  return normalized === 'pending' || normalized === 'failed';
};

const isLocalOnlyProviderMessageId = (value: string | null | undefined): boolean => {
  const normalized = String(value || '').trim();
  return /^(?:uaz|ig)(?:_[a-z]+)?_[0-9a-f]{32}$/i.test(normalized);
};

const asRecord = (value: unknown): Record<string, unknown> => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  return value as Record<string, unknown>;
};

const pickFirstText = (...values: unknown[]): string | null => {
  for (const value of values) {
    if (value && typeof value === 'object') continue;
    const normalized = String(value ?? '').trim();
    if (normalized) return normalized;
  }
  return null;
};

const getPayloadData = (payload: Record<string, unknown> | null | undefined): Record<string, unknown> => {
  const root = asRecord(payload);
  const data = asRecord(root.data);
  if (Object.keys(data).length > 0) return data;
  const body = asRecord(root.body);
  if (Object.keys(body).length > 0) return body;
  return root;
};

const getContextInfo = (...records: Record<string, unknown>[]): Record<string, unknown> => {
  for (const record of records) {
    const contextInfo = asRecord(record.contextInfo || record.context_info);
    if (Object.keys(contextInfo).length > 0) return contextInfo;
  }
  return {};
};

const getProviderScopedMessageId = (messageId: string | null, owner: unknown): string | null => {
  if (!messageId) return null;
  if (messageId.includes(':')) return messageId;
  const ownerText = pickFirstText(owner);
  return ownerText ? `${ownerText}:${messageId}` : messageId;
};

const getMediaPlaceholder = (mediaType?: unknown, mediaUrl?: unknown): string | null => {
  const kind = resolveMediaKind(pickFirstText(mediaType), pickFirstText(mediaUrl));
  if (kind === 'image') return '[Imagem]';
  if (kind === 'video') return '[Vídeo]';
  if (kind === 'audio') return '[Áudio]';
  if (kind === 'document') return '[Documento]';
  if (kind === 'sticker') return '[Figurinha]';
  return null;
};

const resolvePayloadMediaPlaceholder = (payloadValue: Record<string, unknown> | null | undefined): string | null => {
  const payload = asRecord(payloadValue);
  const data = getPayloadData(payload);
  const nestedMessage = asRecord(data.message);
  const content = asRecord(data.content);
  const nestedContent = asRecord(nestedMessage.content);
  const rawType = pickFirstText(
    nestedMessage.mediaType,
    nestedMessage.messageType,
    nestedMessage.type,
    content.mimetype,
    nestedContent.mimetype,
  );

  if (String(content.PTT || nestedContent.PTT || '').toLowerCase() === 'true') return '[Áudio]';
  if (rawType) {
    const normalized = rawType.toLowerCase();
    if (normalized.includes('audio') || normalized === 'ptt') return '[Áudio]';
    if (normalized.includes('video')) return '[Vídeo]';
    if (normalized.includes('sticker')) return '[Figurinha]';
    if (normalized.includes('image') || normalized.includes('imagem')) return '[Imagem]';
    if (normalized.includes('document') || normalized.includes('application/')) return '[Documento]';
  }

  return getMediaPlaceholder(rawType, pickFirstText(content.URL, content.url, nestedContent.URL, nestedContent.url));
};

const resolveQuotedPreviewText = (quotedMessage: Record<string, unknown>): string | null => {
  const quotedText = resolvePayloadMessageText({ data: { message: quotedMessage } });
  if (quotedText) return quotedText;

  const imageMessage = asRecord(quotedMessage.imageMessage);
  const videoMessage = asRecord(quotedMessage.videoMessage);
  const audioMessage = asRecord(quotedMessage.audioMessage);
  const documentMessage = asRecord(quotedMessage.documentMessage);
  const stickerMessage = asRecord(quotedMessage.stickerMessage);

  if (Object.keys(videoMessage).length > 0) return '[Vídeo]';
  if (Object.keys(audioMessage).length > 0) return '[Áudio]';
  if (Object.keys(stickerMessage).length > 0) return '[Figurinha]';
  if (Object.keys(imageMessage).length > 0) return '[Imagem]';
  if (Object.keys(documentMessage).length > 0) return '[Documento]';
  return null;
};

const resolvePayloadReply = (message: MessageBubbleMessage): { targetMessageId: string | null; previewText: string | null } => {
  const payload = asRecord(message.webhook_payload);
  const data = getPayloadData(payload);
  const nestedMessage = asRecord(data.message);
  const content = asRecord(data.content);
  const nestedContent = asRecord(nestedMessage.content);
  const extended = asRecord(nestedMessage.extendedTextMessage);
  const imageMessage = asRecord(nestedMessage.imageMessage);
  const videoMessage = asRecord(nestedMessage.videoMessage);
  const documentMessage = asRecord(nestedMessage.documentMessage);

  const contextInfo = getContextInfo(data, nestedMessage, content, nestedContent, extended, imageMessage, videoMessage, documentMessage);
  const quotedMessage = asRecord(
    contextInfo.quotedMessage ||
    contextInfo.quoted_message ||
    content.quotedMessage ||
    nestedContent.quotedMessage,
  );
  const rawTarget = pickFirstText(
    message.reply_to_provider_message_id,
    payload.replyid,
    payload.replyId,
    payload.reply_to_provider_message_id,
    data.replyid,
    data.replyId,
    data.reply_to_provider_message_id,
    nestedMessage.quoted,
    contextInfo.stanzaId,
    contextInfo.stanzaID,
    contextInfo.stanza_id,
  );

  return {
    targetMessageId: getProviderScopedMessageId(rawTarget, payload.owner || data.owner || nestedMessage.owner),
    previewText: pickFirstText(
      message.reply_preview_text,
      payload.replyPreviewText,
      payload.reply_preview_text,
      data.replyPreviewText,
      data.reply_preview_text,
      resolveQuotedPreviewText(quotedMessage),
    ),
  };
};

const resolveSenderLabel = (message: MessageBubbleMessage, isAi: boolean): string => {
  const payload = asRecord(message.webhook_payload);
  const data = getPayloadData(payload);
  const nestedMessage = asRecord(data.message);

  if (message.direction === 'outbound') {
    if (isAi) return 'IA';

    return pickFirstText(
      message.sender_display_name,
      payload.sent_by_display_name,
      payload.sender_display_name,
      data.sent_by_display_name,
      data.sender_display_name,
    ) || 'Você';
  }

  const chat = asRecord(payload.chat || data.chat);
  const contact = asRecord(payload.contact || data.contact);
  const sender = asRecord(payload.sender || data.sender || nestedMessage.sender);

  return pickFirstText(
    payload.username,
    payload.name,
    payload.pushName,
    payload.senderName,
    payload.contact_name,
    data.username,
    data.name,
    data.pushName,
    data.senderName,
    nestedMessage.username,
    nestedMessage.name,
    nestedMessage.pushName,
    nestedMessage.senderName,
    chat.username,
    chat.name,
    chat.wa_name,
    chat.wa_contactName,
    contact.username,
    contact.name,
    sender.username,
    sender.name,
  ) || 'Cliente';
};

const resolvePayloadMessageText = (payloadValue: Record<string, unknown> | null | undefined): string | null => {
  const payload = asRecord(payloadValue);
  const data = getPayloadData(payload);
  const nestedMessage = asRecord(data.message);
  const content = asRecord(data.content);
  const nestedContent = asRecord(nestedMessage.content);
  const extended = asRecord(nestedMessage.extendedTextMessage);
  const imageMessage = asRecord(nestedMessage.imageMessage);
  const videoMessage = asRecord(nestedMessage.videoMessage);
  const documentMessage = asRecord(nestedMessage.documentMessage);

  return pickFirstText(
    payload.message,
    payload.text,
    payload.body,
    data.text,
    data.body,
    data.caption,
    data.messageText,
    nestedMessage.text,
    nestedMessage.body,
    nestedMessage.caption,
    nestedMessage.messageText,
    content.text,
    content.body,
    content.caption,
    nestedContent.text,
    nestedContent.body,
    nestedContent.caption,
    nestedContent.conversation,
    nestedMessage.content,
    nestedMessage.conversation,
    extended.text,
    imageMessage.caption,
    videoMessage.caption,
    documentMessage.caption,
  );
};

// ─── Sub-components ────────────────────────────────────────────────────────────

type BubbleTone = 'inbound' | 'outboundHuman' | 'outboundAi';

const StatusIcon: React.FC<{ status: string | null | undefined; tone: BubbleTone }> = ({ status, tone }) => {
  const normalized = String(status || '').toLowerCase();
  const onColored = tone !== 'inbound';
  const base = onColored ? 'h-3.5 w-3.5 text-white/75' : 'h-3.5 w-3.5 text-slate-400 dark:text-slate-500';
  if (normalized === 'pending') return <LoaderCircle className={`${base} animate-spin`} />;
  if (normalized === 'sent') return <Check className={base} />;
  if (normalized === 'delivered') return <CheckCheck className={base} />;
  if (normalized === 'read') return <CheckCheck className={onColored ? 'h-3.5 w-3.5 text-sky-100' : 'h-3.5 w-3.5 text-brand-500'} />;
  if (normalized === 'failed') return <AlertTriangle className={onColored ? 'h-3.5 w-3.5 text-amber-100' : 'h-3.5 w-3.5 text-red-500'} />;
  return <Clock className={base} />;
};

const MessageMedia: React.FC<{
  message: MessageBubbleMessage;
  tone: BubbleTone;
  onOpenMedia?: Props['onOpenMedia'];
}> = ({ message, tone, onOpenMedia }) => {
  const url = String(message.media_url || '').trim();
  const [resolvedUrl, setResolvedUrl] = useState(url);
  const [resolvingMedia, setResolvingMedia] = useState(false);
  const [mediaError, setMediaError] = useState<string | null>(null);
  const [retryKey, setRetryKey] = useState(0);
  useEffect(() => {
    setResolvedUrl(url);
    setMediaError(null);
  }, [url]);

  useEffect(() => {
    if (!url || !isEncryptedWhatsAppMediaUrl(url)) return;

    let cancelled = false;
    setResolvingMedia(true);
    setMediaError(null);
    void supabase.functions.invoke<{ mediaUrl?: string; error?: string }>('crm-uaz-media-download', {
      body: { messageId: message.id },
    }).then(({ data, error }) => {
      if (cancelled) return;
      if (error) throw new Error(error.message || 'Falha ao baixar mídia pela UAZAPI.');
      if (!data?.mediaUrl || data.error) throw new Error(data?.error || 'UAZAPI não retornou mídia baixada.');
      setResolvedUrl(data.mediaUrl);
    }).catch((err) => {
      if (!cancelled) setMediaError(err instanceof Error ? err.message : 'Falha ao baixar mídia.');
    }).finally(() => {
      if (!cancelled) setResolvingMedia(false);
    });

    return () => {
      cancelled = true;
    };
  }, [message.id, retryKey, url]);

  if (!url) return null;
  const kind = resolveMediaKind(message.media_type, resolvedUrl) ?? 'document';
  const fileName = getFileName(resolvedUrl);

  const mediaBorder = tone === 'outboundHuman'
    ? 'border-slate-200 bg-slate-50 dark:border-slate-700 dark:bg-slate-900/40'
    : 'border-white/30 bg-slate-950/5';

  if (kind === 'sticker') {
    return (
      <div className="relative block max-w-[160px]">
        <img src={resolvedUrl} alt="Figurinha" className="h-auto w-full object-contain drop-shadow-md" loading="lazy" />
      </div>
    );
  }

  if (kind === 'image') {
    return (
      <button type="button" className={`group relative block min-h-11 min-w-11 max-w-full overflow-hidden rounded-xl border shadow-sm ${mediaBorder}`} onClick={() => mediaError ? setRetryKey((value) => value + 1) : onOpenMedia?.(resolvedUrl, 'image', fileName)}>
        {resolvingMedia ? (
          <span className="flex h-24 min-w-40 items-center justify-center bg-slate-100 text-[11px] font-semibold text-slate-500 dark:bg-slate-800 dark:text-slate-300">Carregando imagem...</span>
        ) : mediaError ? (
          <span className="flex min-h-11 h-28 min-w-44 flex-col items-center justify-center gap-2 bg-red-50 px-3 text-center text-ios-footnote font-semibold text-red-700 dark:bg-red-950/30 dark:text-red-200">
            <AlertTriangle size={16} />
            <span>{mediaError}</span>
            <span className="inline-flex min-h-11 items-center gap-1 rounded-ios bg-white/80 px-3 text-red-700 shadow-sm dark:bg-red-950/50 dark:text-red-100"><RefreshCw size={13} /> Tentar novamente</span>
          </span>
        ) : (
          <img src={resolvedUrl} alt={fileName} className="max-h-36 max-w-full rounded-lg object-cover" loading="lazy" />
        )}
        <span className="absolute left-1.5 top-1.5 inline-flex items-center gap-1 rounded-full bg-slate-950/70 px-1.5 py-0.5 text-[8px] font-bold uppercase text-white opacity-95">
          <ImageIcon size={10} /> Imagem
        </span>
      </button>
    );
  }
  if (kind === 'video') {
    return (
      <button type="button" className={`group relative block min-h-11 min-w-11 max-w-full overflow-hidden rounded-xl border shadow-sm ${mediaBorder}`} onClick={() => mediaError ? setRetryKey((value) => value + 1) : onOpenMedia?.(resolvedUrl, 'video', fileName)}>
        {resolvingMedia ? (
          <span className="flex h-24 min-w-40 items-center justify-center bg-slate-100 text-[11px] font-semibold text-slate-500 dark:bg-slate-800 dark:text-slate-300">Carregando vídeo...</span>
        ) : mediaError ? (
          <span className="flex min-h-11 h-28 min-w-44 flex-col items-center justify-center gap-2 bg-red-50 px-3 text-center text-ios-footnote font-semibold text-red-700 dark:bg-red-950/30 dark:text-red-200">
            <AlertTriangle size={16} />
            <span>{mediaError}</span>
            <span className="inline-flex min-h-11 items-center gap-1 rounded-ios bg-white/80 px-3 text-red-700 shadow-sm dark:bg-red-950/50 dark:text-red-100"><RefreshCw size={13} /> Tentar novamente</span>
          </span>
        ) : (
          <video src={resolvedUrl} className="max-h-36 max-w-full rounded-lg" preload="metadata" muted />
        )}
        <span className="absolute left-1.5 top-1.5 inline-flex items-center gap-1 rounded-full bg-slate-950/70 px-1.5 py-0.5 text-[8px] font-bold uppercase text-white">
          <Video size={10} /> Vídeo
        </span>
      </button>
    );
  }
  if (kind === 'audio') {
    return <AudioMessage url={resolvedUrl} fileName={fileName} tone={tone} messageId={message.id} />;
  }
  return (
    <button type="button" onClick={() => onOpenMedia?.(resolvedUrl, 'document', fileName)} className="inline-flex min-h-11 max-w-full items-center gap-2 rounded-lg border border-slate-200 bg-white/85 px-2 py-2 text-left text-[11px] text-slate-700 shadow-sm hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 dark:hover:bg-slate-700">
      <span className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-brand-50 text-brand-700 dark:bg-brand-500/20 dark:text-brand-100"><FileText size={13} /></span>
      <span className="min-w-0">
        <span className="block truncate font-semibold">{fileName}</span>
        <span className="mt-0.5 inline-flex items-center gap-1 text-[10px] text-slate-500 dark:text-slate-400"><ExternalLink size={10} /> Visualizar</span>
      </span>
    </button>
  );
};

const MetaCampaignCard: React.FC<{ campaign: MetaCampaignPreviewData }> = ({ campaign }) => (
  <div className="mb-1.5 overflow-hidden rounded-lg border border-brand-300/30 bg-linear-to-br from-brand-600 via-brand-700 to-slate-900 text-white shadow-sm">
    {campaign.thumbnailURL && (
      <div className="w-full overflow-hidden">
        <img
          src={campaign.thumbnailURL}
          alt="Prévia do anúncio"
          className="max-h-32 w-full object-contain bg-black/20"
          loading="lazy"
        />
      </div>
    )}
    <div className="px-2 py-1.5">
      <div className="flex items-center gap-1 text-[8px] font-bold uppercase tracking-widest text-brand-100/80">
        <span>Campanha Meta</span>
        {campaign.sourceApp && <span>· {campaign.sourceApp}</span>}
      </div>
      {campaign.title && <p className="mt-0.5 text-xs font-bold leading-tight">{campaign.title}</p>}
      {campaign.body && <p className="mt-0.5 line-clamp-3 text-[10px] leading-snug text-brand-50">{campaign.body}</p>}
      {campaign.openUrl && (
        <a href={campaign.openUrl} target="_blank" rel="noreferrer" className="mt-1.5 inline-flex min-h-11 items-center gap-1 px-2 text-[10px] font-semibold text-white/90 underline-offset-2 hover:underline">
          <ExternalLink size={10} /> Abrir anúncio
        </a>
      )}
    </div>
  </div>
);

// ─── Main component ────────────────────────────────────────────────────────────

const QUICK_REACTIONS = ['👍', '❤️', '😂', '😮', '😢', '🙏'];

const MessageBubbleInner: React.FC<Props> = ({
  message,
  reactionSummary,
  metaCampaign,
  onReply,
  onReact,
  onForward,
  onEdit,
  onDelete,
  onOpenMedia,
  onRetry,
  onScrollToReply,
  clusterPosition = 'single',
  separateFromPrevious = false,
  showSender = true,
  showFooter = true,
}) => {
  const [isActionMenuOpen, setIsActionMenuOpen] = useState(false);
  const [recoveredMessage, setRecoveredMessage] = useState<{ content: string | null; mediaUrl: string | null; mediaType: string | null } | null>(null);
  const [recoveryMode, setRecoveryMode] = useState<'content' | 'media' | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const contextMenu = useDesktopContextMenu();
  const isOutbound = message.direction === 'outbound';
  const isAi = String(message.sender_type || '').toLowerCase().includes('ai');
  const senderLabel = resolveSenderLabel(message, isAi);
  const rawDisplayContent = recoveredMessage?.content || message.content || resolvePayloadMessageText(message.webhook_payload);
  const isUndecryptableContent = isUndecryptableWhatsAppContent(rawDisplayContent);
  const renderedMessage = recoveredMessage?.mediaUrl
    ? {
        ...message,
        content: recoveredMessage.content ?? message.content,
        media_url: recoveredMessage.mediaUrl,
        media_type: recoveredMessage.mediaType ?? message.media_type,
      }
    : message;
  const displayContent = isUndecryptableContent ? UNDECRYPTABLE_FALLBACK : rawDisplayContent;
  const mediaPlaceholder = getMediaPlaceholder(renderedMessage.media_type, renderedMessage.media_url) || resolvePayloadMediaPlaceholder(message.webhook_payload);
  const reply = resolvePayloadReply(message);
  const providerMessageId = String(message.provider_message_id || '').trim();
  const canUseProviderActions = Boolean(providerMessageId)
    && !isUnconfirmedDeliveryStatus(message.status)
    && !isLocalOnlyProviderMessageId(providerMessageId);
  const canEditOrDelete = isOutbound && canUseProviderActions;

  const tone: BubbleTone = isOutbound ? (isAi ? 'outboundAi' : 'outboundHuman') : 'inbound';

  const isOnlySticker = !displayContent && renderedMessage.media_url && resolveMediaKind(renderedMessage.media_type, renderedMessage.media_url) === 'sticker';

  const bubbleClass = isOnlySticker
    ? tone === 'inbound' ? '' : 'ml-auto'
    : tone === 'outboundAi'
      ? 'ml-auto bg-slate-800 text-white dark:bg-slate-700'
      : tone === 'outboundHuman'
        ? 'ml-auto bg-brand-600 text-white dark:bg-brand-500'
        : 'bg-slate-100 text-slate-900 dark:bg-slate-800 dark:text-slate-50';
  const toneClass = isOnlySticker
    ? 'crm-message-bubble--sticker'
    : tone === 'outboundAi'
      ? 'crm-message-bubble--outbound-ai'
      : tone === 'outboundHuman'
        ? 'crm-message-bubble--outbound-human'
        : 'crm-message-bubble--inbound';

  const innerContentClass = isOnlySticker ? '' : 'overflow-hidden rounded-ios-lg';

  const metaTextClass = isOnlySticker
    ? 'text-slate-500 dark:text-slate-400 drop-shadow-sm'
    : tone === 'outboundAi'
      ? 'text-white/75'
      : tone === 'outboundHuman'
        ? 'text-white/80'
      : 'text-slate-600 dark:text-slate-300';

  const clusterRadiusClass = isOnlySticker
    ? ''
    : clusterPosition === 'single'
      ? tone === 'inbound' ? 'rounded-ios-lg rounded-bl-sm' : 'rounded-ios-lg rounded-br-sm'
      : clusterPosition === 'first'
        ? tone === 'inbound' ? 'rounded-ios-lg rounded-bl-md' : 'rounded-ios-lg rounded-br-md'
        : clusterPosition === 'middle'
          ? tone === 'inbound' ? 'rounded-ios-lg rounded-l-md' : 'rounded-ios-lg rounded-r-md'
          : tone === 'inbound' ? 'rounded-ios-lg rounded-tl-md rounded-bl-sm' : 'rounded-ios-lg rounded-tr-md rounded-br-sm';

  // Legacy reaction line (orphan — target not in loaded messages)
  const isLegacyReaction = Boolean(message.reaction_emoji) && !message.reaction_target_provider_message_id;

  useEffect(() => {
    if (!isActionMenuOpen) return undefined;
    const handlePointerDown = (event: MouseEvent) => {
      if (menuRef.current?.contains(event.target as Node)) return;
      setIsActionMenuOpen(false);
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setIsActionMenuOpen(false);
    };
    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isActionMenuOpen]);

  useEffect(() => {
    setRecoveredMessage(null);
  }, [message.id, message.content, message.media_url, message.media_type]);

  useEffect(() => {
    const shouldRecoverContent = isUndecryptableContent && !recoveredMessage;
    const shouldRecoverMedia = !recoveredMessage &&
      !String(message.media_url || '').trim() &&
      isDownloadableMediaType(message.media_type);
    if (!shouldRecoverContent && !shouldRecoverMedia) return undefined;

    let cancelled = false;
    setRecoveryMode(shouldRecoverContent ? 'content' : 'media');
    void supabase.functions.invoke<{ mediaUrl?: string | null; mediaType?: string | null; content?: string | null; error?: string }>('crm-uaz-media-download', {
      body: { messageId: message.id },
    }).then(({ data, error }) => {
      if (cancelled) return;
      if (error || data?.error) {
        setRecoveredMessage({ content: null, mediaUrl: null, mediaType: null });
        return;
      }
      setRecoveredMessage({
        content: data?.content || null,
        mediaUrl: data?.mediaUrl || null,
        mediaType: data?.mediaType || null,
      });
    }).catch(() => {
      if (!cancelled) setRecoveredMessage({ content: null, mediaUrl: null, mediaType: null });
    }).finally(() => {
      if (!cancelled) setRecoveryMode(null);
    });

    return () => {
      cancelled = true;
    };
  }, [isUndecryptableContent, message.id, message.media_type, message.media_url, recoveredMessage]);

  const runMenuAction = (callback?: () => void) => {
    setIsActionMenuOpen(false);
    callback?.();
  };

  const messageContextActions: ContextMenuAction[] = [
    ...(onReact && canUseProviderActions ? QUICK_REACTIONS.map((emoji) => ({
      id: `react-${emoji}`,
      label: `Reagir com ${emoji}`,
      onSelect: () => onReact(message, emoji),
    })) : []),
    ...(onReply ? [{
      id: 'reply',
      label: 'Responder',
      icon: <Reply size={16} />,
      separatorBefore: Boolean(onReact && canUseProviderActions),
      onSelect: () => onReply(message),
    }] : []),
    ...(canEditOrDelete && onEdit ? [{
      id: 'edit',
      label: 'Editar mensagem',
      icon: <Edit3 size={16} />,
      onSelect: () => onEdit(message),
    }] : []),
    ...(onForward ? [{
      id: 'forward',
      label: 'Encaminhar',
      icon: <Forward size={16} />,
      onSelect: () => onForward(message),
    }] : []),
    ...(canEditOrDelete && onDelete ? [{
      id: 'delete',
      label: 'Apagar para todos',
      icon: <Trash2 size={16} />,
      destructive: true,
      separatorBefore: true,
      onSelect: () => onDelete(message),
    }] : []),
  ];

  return (
    <article
      id={`msg-${message.id}`}
      data-cluster-position={clusterPosition}
      onContextMenu={contextMenu.bind(messageContextActions, { label: 'Ações da mensagem' })}
      /* No mount/entrance animation by design (spec §7): it causes jank on
         keyboard reflow and history pagination. The perceived "entrance" comes
         from the smooth scroll-to-bottom on send. Bubble width is driven by a
         container query on the list (@container) so it reacts to the thread
         width, not the screen width. */
      className={`crm-message-bubble ${toneClass} group relative max-w-[78%] text-[13px] normal-case @[480px]:max-w-[65%] transition-shadow duration-300 ${separateFromPrevious ? 'mt-2' : ''} ${isOnlySticker ? '' : 'min-h-11 px-3 py-2'} ${clusterRadiusClass} ${bubbleClass}`}
    >
      <div ref={menuRef} className="absolute right-1 top-1 z-30">
        <button
          type="button"
          aria-label="Mais ações da mensagem"
          aria-expanded={isActionMenuOpen}
          className={`inline-flex min-h-11 min-w-11 items-center justify-center rounded-full border transition-colors ${
            tone === 'inbound'
              ? 'border-slate-200 bg-white/90 text-slate-700 hover:bg-white dark:border-slate-600 dark:bg-slate-900/90 dark:text-slate-100'
              : 'border-white/20 bg-white/15 text-white hover:bg-white/25'
          }`}
          onClick={() => setIsActionMenuOpen((prev) => !prev)}
        >
          <MoreVertical size={17} />
        </button>

        {isActionMenuOpen && (
          <div
            role="menu"
            className="absolute right-0 top-12 w-[18rem] max-w-[calc(100vw-2rem)] overflow-hidden rounded-2xl border border-slate-200 bg-white text-slate-900 shadow-ios26-lg ring-1 ring-black/5 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
          >
            {onReact && canUseProviderActions && (
              <div className="flex items-center justify-between gap-1 border-b border-slate-100 px-3 py-2 text-lg dark:border-slate-800">
                {QUICK_REACTIONS.map((emoji) => (
                  <button
                    key={emoji}
                    type="button"
                    aria-label={`Reagir com ${emoji}`}
                  className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-full text-[22px] transition-transform hover:scale-110 hover:bg-slate-100 motion-reduce:transform-none dark:hover:bg-slate-800"
                    onClick={() => runMenuAction(() => onReact(message, emoji))}
                  >
                    {emoji}
                  </button>
                ))}
              </div>
            )}

            <div className="py-1 text-[15px] font-medium">
              {onReply && (
                <button type="button" role="menuitem" className="flex min-h-11 w-full items-center gap-3 px-4 py-2.5 text-left hover:bg-slate-50 dark:hover:bg-slate-900" onClick={() => runMenuAction(() => onReply(message))}>
                  <Reply size={18} /> Responder
                </button>
              )}
              {canEditOrDelete && onEdit && (
                <button type="button" role="menuitem" className="flex min-h-11 w-full items-center gap-3 px-4 py-2.5 text-left hover:bg-slate-50 dark:hover:bg-slate-900" onClick={() => runMenuAction(() => onEdit(message))}>
                  <Edit3 size={18} /> Editar mensagem
                </button>
              )}
              {onForward && (
                <button type="button" role="menuitem" className="flex min-h-11 w-full items-center gap-3 px-4 py-2.5 text-left text-amber-800 hover:bg-amber-50 dark:text-amber-300 dark:hover:bg-amber-950/30" onClick={() => runMenuAction(() => onForward(message))}>
                  <Forward size={18} /> Encaminhar
                </button>
              )}
              {canEditOrDelete && onDelete && (
                <button type="button" role="menuitem" className="flex min-h-11 w-full items-center gap-3 px-4 py-2.5 text-left text-red-700 hover:bg-red-50 dark:text-red-300 dark:hover:bg-red-950/30" onClick={() => runMenuAction(() => onDelete(message))}>
                  <Trash2 size={18} /> Apagar para todos
                </button>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Sender label */}
      {showSender && (
        <div className={`mb-1 flex items-center gap-1 pr-11 text-ios-caption font-medium ${metaTextClass}`}>
          {isOutbound ? (isAi ? <Bot size={10} className="text-brand-300" /> : <Sparkles size={10} className="text-amber-300" />) : <UserRound size={10} className="text-brand-500 dark:text-brand-300" />}
          <span className={isOutbound ? undefined : 'normal-case'}>{senderLabel}</span>
        </div>
      )}

      {/* Meta campaign card */}
      {metaCampaign && <MetaCampaignCard campaign={metaCampaign} />}

      {/* Reply preview strip */}
      {reply.previewText && (
        <button
          type="button"
          className={`mb-1 min-h-11 w-full rounded-md border px-2 py-1 text-left text-ios-caption transition-colors ${
            tone === 'outboundHuman'
              ? 'border-brand-400/40 bg-white/15 text-white hover:bg-white/20'
              : 'border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-900/40 dark:text-slate-200 dark:hover:bg-slate-900'
          }`}
          onClick={() => reply.targetMessageId && onScrollToReply?.(reply.targetMessageId)}
          title="Ir para mensagem original"
        >
          <span className="line-clamp-2">{reply.previewText}</span>
        </button>
      )}

      {/* Media */}
      <div className={innerContentClass}>
        <MessageMedia message={renderedMessage} tone={tone} onOpenMedia={onOpenMedia} />
      </div>

      {/* Content */}
      {displayContent ? (
        <p className={`${renderedMessage.media_url ? 'mt-2' : ''} pr-11 whitespace-pre-wrap wrap-break-word leading-[1.4] font-medium tracking-[-0.01em]`}>
          {recoveryMode === 'content' ? 'Tentando recuperar mensagem...' : displayContent}
        </p>
      ) : !renderedMessage.media_url && mediaPlaceholder ? (
        <p className="pr-11 whitespace-pre-wrap wrap-break-word leading-snug opacity-70 italic">
          {recoveryMode === 'media' ? 'Carregando mídia...' : mediaPlaceholder}
        </p>
      ) : !renderedMessage.media_url && !metaCampaign ? (
        <p className="pr-11 whitespace-pre-wrap wrap-break-word leading-snug opacity-70 italic">Mensagem sem conteúdo disponível.</p>
      ) : null}

      {/* Legacy reaction line (orphaned reactions that have no target loaded) */}
      {isLegacyReaction && (
        <p className={`mt-1 inline-flex rounded-full px-1.5 py-0.5 text-[10px] ${tone === 'outboundHuman' ? 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300' : 'bg-white/15 text-white'}`}>
          Reação: {message.reaction_emoji}
        </p>
      )}

      {/* Footer: time + status */}
      {showFooter && (
        <div className={`mt-1 flex flex-wrap items-center justify-end gap-1 text-ios-caption font-medium ${metaTextClass}`}>
          <span>{formatMessageTime(message.sent_at || message.created_at)}</span>
          {isOutbound && (
            <>
              <span aria-hidden="true" className="opacity-50">·</span>
              <span
                aria-label={`Status: ${getMessageStatusLabel(message.status)}`}
                className="inline-flex items-center gap-1"
              >
                <StatusIcon status={message.status} tone={tone} />
                {['pending', 'failed'].includes(String(message.status || '').toLowerCase()) && (
                  <span>{getMessageStatusLabel(message.status)}</span>
                )}
              </span>
            </>
          )}
          {message.error_message && (
            <span className={`inline-flex items-center gap-1 ${tone === 'outboundHuman' ? 'text-red-100' : 'text-red-600 dark:text-red-300'}`}>
              <AlertTriangle size={10} /> {message.error_message}
            </span>
          )}
        </div>
      )}
      {message.status === 'failed' && onRetry && (
        <button
          type="button"
          className="mt-2 inline-flex min-h-11 items-center gap-2 rounded-ios bg-red-50 px-3 text-ios-caption font-semibold text-red-700 transition-colors duration-150 hover:bg-red-100 focus-visible:ring-2 focus-visible:ring-red-500 focus-visible:ring-offset-2 dark:bg-red-950/40 dark:text-red-200 dark:hover:bg-red-950/60"
          onClick={() => void onRetry(message)}
        >
          <RefreshCw size={14} />
          Tentar enviar novamente
        </button>
      )}
      {/* Download button for documents in outbound bubbles */}
      {renderedMessage.media_url && resolveMediaKind(renderedMessage.media_type, renderedMessage.media_url) === 'document' && isOutbound && (
        <a
          href={renderedMessage.media_url}
          target="_blank"
          rel="noreferrer"
          download
          className={`mt-1 inline-flex min-h-11 items-center gap-1 px-2 text-ios-caption underline-offset-2 hover:underline ${tone === 'outboundHuman' ? 'text-white/80' : 'text-slate-600 dark:text-slate-300'}`}
        >
          <Download size={10} /> Baixar
        </a>
      )}

      {/* Reaction badge (inline — shown when target is this bubble) */}
      {reactionSummary && (
        <m.span
          initial={{ scale: 0, y: 10 }}
          animate={{ scale: 1, y: 0 }}
          className="absolute -bottom-2 right-3 inline-flex items-center gap-1 rounded-full border border-slate-200/50 bg-white/90 px-1.5 py-0.5 text-[10px] font-bold pl-shadow-ao backdrop-blur-md dark:border-slate-700/50 dark:bg-slate-800/90"
          title={reactionSummary.fromCustomer ? 'Reação do cliente' : 'Reação do atendente'}
        >
          <span className="text-xs">{reactionSummary.emoji}</span>
          {reactionSummary.count > 1 && <span className="text-[8px] opacity-70">{reactionSummary.count}</span>}
        </m.span>
      )}
      <DesktopContextMenuHost controller={contextMenu} />
    </article>
  );
};

const MessageBubble = memo(MessageBubbleInner, (prev, next) => {
  return (
    prev.message.id === next.message.id &&
    prev.message.direction === next.message.direction &&
    prev.message.sender_type === next.message.sender_type &&
    prev.message.content === next.message.content &&
    prev.message.created_at === next.message.created_at &&
    prev.message.sent_at === next.message.sent_at &&
    prev.message.status === next.message.status &&
    prev.message.media_url === next.message.media_url &&
    prev.message.media_type === next.message.media_type &&
    prev.message.provider_message_id === next.message.provider_message_id &&
    prev.message.sender_user_id === next.message.sender_user_id &&
    prev.message.sender_display_name === next.message.sender_display_name &&
    prev.message.error_message === next.message.error_message &&
    prev.message.reply_to_provider_message_id === next.message.reply_to_provider_message_id &&
    prev.message.reply_preview_text === next.message.reply_preview_text &&
    prev.message.reaction_target_provider_message_id === next.message.reaction_target_provider_message_id &&
    prev.message.reaction_emoji === next.message.reaction_emoji &&
    prev.message.webhook_payload === next.message.webhook_payload &&
    prev.reactionSummary?.emoji === next.reactionSummary?.emoji &&
    prev.reactionSummary?.fromCustomer === next.reactionSummary?.fromCustomer &&
    prev.metaCampaign === next.metaCampaign &&
    prev.onRetry === next.onRetry &&
    prev.clusterPosition === next.clusterPosition &&
    prev.separateFromPrevious === next.separateFromPrevious &&
    prev.showSender === next.showSender &&
    prev.showFooter === next.showFooter
  );
});

export default MessageBubble;
