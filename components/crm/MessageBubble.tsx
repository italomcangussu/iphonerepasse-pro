import React, { memo } from 'react';
import { m } from 'framer-motion';
import {
  AlertTriangle,
  Bot,
  Check,
  CheckCheck,
  Clock,
  Download,
  ExternalLink,
  FileText,
  Image as ImageIcon,
  Mic,
  Reply,
  Sparkles,
  UserRound,
  Video,
} from 'lucide-react';
import type { ReactionSummary } from '../../lib/crm/groupReactions';
import type { MetaCampaignPreviewData } from '../../lib/crm/messageUtils';

// ─── Types ─────────────────────────────────────────────────────────────────────

export interface MessageBubbleMessage {
  id: string;
  direction: 'inbound' | 'outbound';
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
  webhook_payload?: Record<string, unknown> | null;
}

interface Props {
  message: MessageBubbleMessage;
  reactionSummary?: ReactionSummary | null;
  metaCampaign?: MetaCampaignPreviewData | null;
  onReply?: (message: MessageBubbleMessage) => void;
  onOpenMedia?: (url: string, type: 'image' | 'video' | 'audio' | 'document', fileName: string) => void;
  onScrollToReply?: (providerMessageId: string) => void;
}

// ─── Helpers ───────────────────────────────────────────────────────────────────

const formatMessageDateTime = (value: string): string => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
};

const resolveMediaKind = (mediaType?: string | null, mediaUrl?: string | null): 'image' | 'video' | 'audio' | 'document' | null => {
  const normalized = String(mediaType || '').toLowerCase();
  const url = String(mediaUrl || '').split('?')[0].toLowerCase();
  if (!normalized && !url) return null;
  if (normalized.includes('image') || /\.(jpg|jpeg|png|webp|gif)$/i.test(url)) return 'image';
  if (normalized.includes('video') || /\.(mp4|mov|webm|m4v)$/i.test(url)) return 'video';
  if (normalized.includes('audio') || /\.(mp3|m4a|ogg|opus|wav|webm)$/i.test(url)) return 'audio';
  return 'document';
};

const getFileName = (url?: string | null, fallback = 'arquivo') => {
  const clean = String(url || '').split('?')[0];
  const last = clean.split('/').filter(Boolean).pop();
  return decodeURIComponent(last || fallback);
};

const getMessageStatusLabel = (status: string | null | undefined): string => {
  const n = String(status || '').toLowerCase();
  if (n === 'pending') return 'Pendente';
  if (n === 'sent') return 'Enviada';
  if (n === 'delivered') return 'Entregue';
  if (n === 'read') return 'Lida';
  if (n === 'failed') return 'Falhou';
  return status || 'Registrada';
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

const resolveSenderLabel = (message: MessageBubbleMessage, isAi: boolean): string => {
  if (message.direction === 'outbound') return isAi ? 'IA Core Engine' : 'Human Specialist';

  const payload = asRecord(message.webhook_payload);
  const data = getPayloadData(payload);
  const nestedMessage = asRecord(data.message);
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
  ) || 'Authorized Client';
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
  const onColored = tone === 'inbound' || tone === 'outboundAi';
  const base = onColored ? 'h-3.5 w-3.5 text-white/75' : 'h-3.5 w-3.5 text-slate-400 dark:text-slate-500';
  if (normalized === 'pending') return <Clock className={base} />;
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
  if (!url) return null;
  const kind = resolveMediaKind(message.media_type, message.media_url) ?? 'document';
  const fileName = getFileName(url);

  const mediaBorder = tone === 'outboundHuman'
    ? 'border-slate-200 bg-slate-50 dark:border-slate-700 dark:bg-slate-900/40'
    : 'border-white/30 bg-slate-950/5';

  if (kind === 'image') {
    return (
      <button type="button" className={`group relative block max-w-full overflow-hidden rounded-xl border shadow-sm ${mediaBorder}`} onClick={() => onOpenMedia?.(url, 'image', fileName)}>
        <img src={url} alt={fileName} className="max-h-36 max-w-full rounded-lg object-cover" loading="lazy" />
        <span className="absolute left-1.5 top-1.5 inline-flex items-center gap-1 rounded-full bg-slate-950/70 px-1.5 py-0.5 text-[8px] font-bold uppercase text-white opacity-95">
          <ImageIcon size={10} /> Imagem
        </span>
      </button>
    );
  }
  if (kind === 'video') {
    return (
      <button type="button" className={`group relative block max-w-full overflow-hidden rounded-xl border shadow-sm ${mediaBorder}`} onClick={() => onOpenMedia?.(url, 'video', fileName)}>
        <video src={url} className="max-h-36 max-w-full rounded-lg" preload="metadata" muted />
        <span className="absolute left-1.5 top-1.5 inline-flex items-center gap-1 rounded-full bg-slate-950/70 px-1.5 py-0.5 text-[8px] font-bold uppercase text-white">
          <Video size={10} /> Vídeo
        </span>
      </button>
    );
  }
  if (kind === 'audio') {
    return (
      <div className="rounded-lg border border-slate-200 bg-white/80 p-2 shadow-sm dark:border-slate-700 dark:bg-slate-900/70">
        <div className="mb-1 flex items-center gap-1.5 text-[11px] font-semibold text-slate-600 dark:text-slate-300">
          <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-accent-100 text-accent-700 dark:bg-accent-500/20 dark:text-accent-100"><Mic size={12} /></span>
          <span className="truncate">{fileName}</span>
        </div>
        <audio src={url} controls className="w-full max-w-[240px]" />
      </div>
    );
  }
  return (
    <button type="button" onClick={() => onOpenMedia?.(url, 'document', fileName)} className="inline-flex max-w-full items-center gap-2 rounded-lg border border-slate-200 bg-white/85 px-2 py-2 text-left text-[11px] text-slate-700 shadow-sm hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 dark:hover:bg-slate-700">
      <span className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-brand-50 text-brand-700 dark:bg-brand-500/20 dark:text-brand-100"><FileText size={13} /></span>
      <span className="min-w-0">
        <span className="block truncate font-semibold">{fileName}</span>
        <span className="mt-0.5 inline-flex items-center gap-1 text-[10px] text-slate-500 dark:text-slate-400"><ExternalLink size={10} /> Abrir</span>
      </span>
    </button>
  );
};

const MetaCampaignCard: React.FC<{ campaign: MetaCampaignPreviewData }> = ({ campaign }) => (
  <div className="mb-1.5 overflow-hidden rounded-lg border border-brand-300/30 bg-linear-to-br from-brand-600 to-brand-700 text-white shadow-sm">
    <div className="px-2 py-1.5">
      <div className="flex items-center gap-1 text-[8px] font-bold uppercase tracking-widest text-brand-100/80">
        <span>Campanha Meta</span>
        {campaign.sourceApp && <span>· {campaign.sourceApp}</span>}
      </div>
      {campaign.title && <p className="mt-0.5 text-xs font-bold leading-tight">{campaign.title}</p>}
      {campaign.body && <p className="line-clamp-2 text-[10px] text-brand-50">{campaign.body}</p>}
      {campaign.openUrl && (
        <a href={campaign.openUrl} target="_blank" rel="noreferrer" className="mt-1 inline-flex items-center gap-1 text-[10px] font-semibold text-white/90 underline-offset-2 hover:underline">
          <ExternalLink size={10} /> Abrir anúncio
        </a>
      )}
    </div>
    {campaign.thumbnailURL && (
      <img src={campaign.thumbnailURL} alt="Prévia do anúncio" className="h-20 w-full object-cover opacity-80" />
    )}
  </div>
);

// ─── Main component ────────────────────────────────────────────────────────────

const MessageBubbleInner: React.FC<Props> = ({ message, reactionSummary, metaCampaign, onReply, onOpenMedia, onScrollToReply }) => {
  const isOutbound = message.direction === 'outbound';
  const isAi = String(message.sender_type || '').toLowerCase().includes('ai');
  const senderLabel = resolveSenderLabel(message, isAi);
  const displayContent = message.content || resolvePayloadMessageText(message.webhook_payload);

  const tone: BubbleTone = isOutbound ? (isAi ? 'outboundAi' : 'outboundHuman') : 'inbound';

  const bubbleClass =
    tone === 'outboundAi'
      ? 'ml-auto rounded-br-none border border-white/10 bg-linear-to-br from-brand-600 via-brand-700 to-slate-900 text-white pl-shadow-ao pl-radius-container'
      : tone === 'outboundHuman'
        ? 'ml-auto rounded-br-none border border-slate-200 bg-white text-slate-800 pl-shadow-ao pl-radius-container dark:border-slate-700 dark:bg-slate-900/80 dark:text-slate-100'
        : 'rounded-bl-none bg-brand-600 text-white pl-shadow-ao pl-radius-container dark:bg-brand-500';

  const innerContentClass = 'pl-radius-technical overflow-hidden';

  const metaTextClass =
    tone === 'outboundAi'
      ? 'text-white/70'
      : tone === 'outboundHuman'
        ? 'text-slate-500 dark:text-slate-400'
        : 'text-brand-100';

  // Legacy reaction line (orphan — target not in loaded messages)
  const isLegacyReaction = Boolean(message.reaction_emoji) && !message.reaction_target_provider_message_id;

  return (
    <m.article
      id={`msg-${message.id}`}
      initial={{ opacity: 0, y: 12, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      whileHover={{ y: -2, transition: { duration: 0.2 } }}
      className={`group relative max-w-[76%] px-2 py-1.5 text-xs sm:max-w-[42%] transition-shadow duration-300 ${bubbleClass}`}
    >
      {/* Sender label */}
      <div className={`mb-0.5 flex items-center justify-between gap-1 text-[8px] font-bold uppercase tracking-wider ${metaTextClass}`}>
        <span className="flex items-center gap-1">
          {isOutbound ? (isAi ? <Bot size={10} className="text-brand-300" /> : <Sparkles size={10} className="text-amber-400" />) : <UserRound size={10} className="text-brand-200" />}
          <span className={isOutbound ? undefined : 'normal-case'}>{senderLabel}</span>
        </span>
        {onReply && (
          <button
            type="button"
            title="Responder"
            aria-label="Responder esta mensagem"
            className={`opacity-0 group-hover:opacity-100 transition-all duration-300 ml-1 inline-flex h-4 w-4 items-center justify-center rounded-full ${tone === 'outboundHuman' ? 'hover:bg-slate-100 dark:hover:bg-slate-800' : 'hover:bg-white/10'}`}
            onClick={() => onReply(message)}
          >
            <Reply size={10} />
          </button>
        )}
      </div>

      {/* Meta campaign card */}
      {metaCampaign && <MetaCampaignCard campaign={metaCampaign} />}

      {/* Reply preview strip */}
      {message.reply_preview_text && (
        <button
          type="button"
          className={`mb-1 w-full rounded-md border-l-2 px-2 py-1 text-left text-[10px] transition-colors ${
            tone === 'outboundHuman'
              ? 'border-brand-400 bg-brand-50 text-slate-600 hover:bg-brand-100 dark:bg-brand-500/10 dark:text-slate-300 dark:hover:bg-brand-500/20'
              : 'border-white/60 bg-white/10 text-brand-50 hover:bg-white/20'
          }`}
          onClick={() => message.reply_to_provider_message_id && onScrollToReply?.(message.reply_to_provider_message_id)}
          title="Ir para mensagem original"
        >
          <span className="line-clamp-2">{message.reply_preview_text}</span>
        </button>
      )}

      {/* Media */}
      <div className={innerContentClass}>
        <MessageMedia message={message} tone={tone} onOpenMedia={onOpenMedia} />
      </div>

      {/* Content */}
      {displayContent ? (
        <p className={`${message.media_url ? 'mt-1.5' : ''} whitespace-pre-wrap wrap-break-word leading-snug font-normal`}>
          {displayContent}
        </p>
      ) : !message.media_url && !metaCampaign ? (
        <p className="whitespace-pre-wrap wrap-break-word leading-snug opacity-40 italic">[system: empty payload]</p>
      ) : null}

      {/* Legacy reaction line (orphaned reactions that have no target loaded) */}
      {isLegacyReaction && (
        <p className={`mt-1 inline-flex rounded-full px-1.5 py-0.5 text-[10px] ${tone === 'outboundHuman' ? 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300' : 'bg-white/15 text-white'}`}>
          Reação: {message.reaction_emoji}
        </p>
      )}

      {/* Footer: time + status */}
      <div className={`mt-1 flex flex-wrap items-center justify-end gap-1 text-[8px] font-medium tracking-tight ${metaTextClass}`}>
        <span>{formatMessageDateTime(message.sent_at || message.created_at)}</span>
        <span className="opacity-30">|</span>
        <span className="inline-flex items-center gap-1">
          <StatusIcon status={message.status} tone={tone} />
          {getMessageStatusLabel(message.status).toUpperCase()}
        </span>
        {message.error_message && (
          <span className={`inline-flex items-center gap-1 ${tone === 'outboundHuman' ? 'text-red-500' : 'text-amber-100'}`}>
            <AlertTriangle size={10} /> {message.error_message}
          </span>
        )}
      </div>
      {/* Download button for documents in outbound bubbles */}
      {message.media_url && resolveMediaKind(message.media_type, message.media_url) === 'document' && isOutbound && (
        <a
          href={message.media_url}
          target="_blank"
          rel="noreferrer"
          download
          className={`mt-1 inline-flex items-center gap-1 text-[10px] underline-offset-2 hover:underline ${tone === 'outboundHuman' ? 'text-slate-600 dark:text-slate-300' : 'text-white/80'}`}
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
    </m.article>
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
    prev.message.error_message === next.message.error_message &&
    prev.message.reply_to_provider_message_id === next.message.reply_to_provider_message_id &&
    prev.message.reply_preview_text === next.message.reply_preview_text &&
    prev.message.reaction_target_provider_message_id === next.message.reaction_target_provider_message_id &&
    prev.message.reaction_emoji === next.message.reaction_emoji &&
    prev.message.webhook_payload === next.message.webhook_payload &&
    prev.reactionSummary?.emoji === next.reactionSummary?.emoji &&
    prev.reactionSummary?.fromCustomer === next.reactionSummary?.fromCustomer &&
    prev.metaCampaign === next.metaCampaign
  );
});

export default MessageBubble;
