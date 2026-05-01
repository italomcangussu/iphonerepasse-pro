import React, { memo } from 'react';
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
        <img src={url} alt={fileName} className="max-h-72 max-w-full rounded-xl object-cover" loading="lazy" />
        <span className="absolute left-2 top-2 inline-flex items-center gap-1 rounded-full bg-slate-950/70 px-2 py-1 text-[10px] font-bold uppercase text-white opacity-95">
          <ImageIcon size={12} /> Imagem
        </span>
      </button>
    );
  }
  if (kind === 'video') {
    return (
      <button type="button" className={`group relative block max-w-full overflow-hidden rounded-xl border shadow-sm ${mediaBorder}`} onClick={() => onOpenMedia?.(url, 'video', fileName)}>
        <video src={url} className="max-h-72 max-w-full rounded-xl" preload="metadata" muted />
        <span className="absolute left-2 top-2 inline-flex items-center gap-1 rounded-full bg-slate-950/70 px-2 py-1 text-[10px] font-bold uppercase text-white">
          <Video size={12} /> Vídeo
        </span>
      </button>
    );
  }
  if (kind === 'audio') {
    return (
      <div className="rounded-xl border border-slate-200 bg-white/80 p-3 shadow-sm dark:border-slate-700 dark:bg-slate-900/70">
        <div className="mb-2 flex items-center gap-2 text-xs font-semibold text-slate-600 dark:text-slate-300">
          <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-accent-100 text-accent-700 dark:bg-accent-500/20 dark:text-accent-100"><Mic size={14} /></span>
          <span className="truncate">{fileName}</span>
        </div>
        <audio src={url} controls className="w-full max-w-[320px]" />
      </div>
    );
  }
  return (
    <button type="button" onClick={() => onOpenMedia?.(url, 'document', fileName)} className="inline-flex max-w-full items-center gap-3 rounded-xl border border-slate-200 bg-white/85 px-3 py-3 text-left text-sm text-slate-700 shadow-sm hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 dark:hover:bg-slate-700">
      <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-brand-50 text-brand-700 dark:bg-brand-500/20 dark:text-brand-100"><FileText size={18} /></span>
      <span className="min-w-0">
        <span className="block truncate font-semibold">{fileName}</span>
        <span className="mt-0.5 inline-flex items-center gap-1 text-xs text-slate-500 dark:text-slate-400"><ExternalLink size={12} /> Abrir documento</span>
      </span>
    </button>
  );
};

const MetaCampaignCard: React.FC<{ campaign: MetaCampaignPreviewData }> = ({ campaign }) => (
  <div className="mb-2 overflow-hidden rounded-xl border border-indigo-300/30 bg-linear-to-br from-indigo-500 to-purple-600 text-white shadow-sm">
    <div className="px-3 py-2">
      <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest text-indigo-100/80">
        <span>Campanha Meta</span>
        {campaign.sourceApp && <span>· {campaign.sourceApp}</span>}
      </div>
      {campaign.title && <p className="mt-1 text-sm font-bold leading-tight">{campaign.title}</p>}
      {campaign.body && <p className="mt-0.5 line-clamp-2 text-xs text-indigo-100">{campaign.body}</p>}
      {campaign.openUrl && (
        <a href={campaign.openUrl} target="_blank" rel="noreferrer" className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-white/90 underline-offset-2 hover:underline">
          <ExternalLink size={11} /> Abrir anúncio
        </a>
      )}
    </div>
    {campaign.thumbnailURL && (
      <img src={campaign.thumbnailURL} alt="Prévia do anúncio" className="h-32 w-full object-cover opacity-80" />
    )}
  </div>
);

// ─── Main component ────────────────────────────────────────────────────────────

const MessageBubbleInner: React.FC<Props> = ({ message, reactionSummary, metaCampaign, onReply, onOpenMedia, onScrollToReply }) => {
  const isOutbound = message.direction === 'outbound';
  const isAi = String(message.sender_type || '').toLowerCase().includes('ai');

  const tone: BubbleTone = isOutbound ? (isAi ? 'outboundAi' : 'outboundHuman') : 'inbound';

  const bubbleClass =
    tone === 'outboundAi'
      ? 'ml-auto rounded-br-md border border-indigo-400/20 bg-linear-to-br from-indigo-600 to-brand-700 text-white shadow-ios26-md'
      : tone === 'outboundHuman'
        ? 'ml-auto rounded-br-md border border-slate-200 bg-white text-slate-800 shadow-sm dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100'
        : 'rounded-bl-md bg-brand-600 text-white shadow-ios26-md dark:bg-brand-500';

  const metaTextClass =
    tone === 'outboundAi'
      ? 'text-white/70'
      : tone === 'outboundHuman'
        ? 'text-slate-500 dark:text-slate-400'
        : 'text-brand-100';

  // Legacy reaction line (orphan — target not in loaded messages)
  const isLegacyReaction = Boolean(message.reaction_emoji) && !message.reaction_target_provider_message_id;

  return (
    <article
      id={`msg-${message.id}`}
      className={`group relative max-w-[92%] rounded-2xl px-3 py-2.5 text-sm sm:max-w-[74%] ${bubbleClass}`}
    >
      {/* Sender label */}
      <div className={`mb-1 flex items-center justify-between gap-1.5 text-[11px] font-bold uppercase tracking-wide ${metaTextClass}`}>
        <span className="flex items-center gap-1.5">
          {isOutbound ? (isAi ? <Bot size={12} /> : <Sparkles size={12} />) : <UserRound size={12} />}
          {isOutbound ? (isAi ? 'IA iPhone Repasse' : 'Atendimento') : 'Cliente'}
        </span>
        {onReply && (
          <button
            type="button"
            title="Responder"
            aria-label="Responder esta mensagem"
            className={`opacity-0 group-hover:opacity-100 transition-opacity ml-2 inline-flex h-6 w-6 items-center justify-center rounded-full ${tone === 'outboundHuman' ? 'hover:bg-slate-200 dark:hover:bg-slate-700' : 'hover:bg-white/20'}`}
            onClick={() => onReply(message)}
          >
            <Reply size={13} />
          </button>
        )}
      </div>

      {/* Meta campaign card */}
      {metaCampaign && <MetaCampaignCard campaign={metaCampaign} />}

      {/* Reply preview strip */}
      {message.reply_preview_text && (
        <button
          type="button"
          className={`mb-2 w-full rounded-lg border-l-[3px] px-2.5 py-2 text-left text-xs transition-colors ${
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
      <MessageMedia message={message} tone={tone} onOpenMedia={onOpenMedia} />

      {/* Content */}
      {message.content ? (
        <p className={`${message.media_url ? 'mt-2.5' : ''} whitespace-pre-wrap wrap-break-word leading-6`}>{message.content}</p>
      ) : !message.media_url && !metaCampaign ? (
        <p className="whitespace-pre-wrap wrap-break-word leading-6 opacity-50">[mensagem sem conteúdo]</p>
      ) : null}

      {/* Legacy reaction line (orphaned reactions that have no target loaded) */}
      {isLegacyReaction && (
        <p className={`mt-2 inline-flex rounded-full px-2 py-0.5 text-xs ${tone === 'outboundHuman' ? 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300' : 'bg-white/15 text-white'}`}>
          Reação: {message.reaction_emoji}
        </p>
      )}

      {/* Footer: time + status */}
      <div className={`mt-2 flex flex-wrap items-center justify-end gap-1.5 text-[11px] ${metaTextClass}`}>
        <span>{formatMessageDateTime(message.sent_at || message.created_at)}</span>
        <span>·</span>
        <span className="inline-flex items-center gap-1">
          <StatusIcon status={message.status} tone={tone} />
          {getMessageStatusLabel(message.status)}
        </span>
        {message.error_message && (
          <span className={`inline-flex items-center gap-1 ${tone === 'outboundHuman' ? 'text-red-500' : 'text-amber-100'}`}>
            <AlertTriangle size={12} /> {message.error_message}
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
          className={`mt-2 inline-flex items-center gap-1.5 text-xs underline-offset-2 hover:underline ${tone === 'outboundHuman' ? 'text-slate-600 dark:text-slate-300' : 'text-white/80'}`}
        >
          <Download size={12} /> Baixar
        </a>
      )}

      {/* Reaction badge (inline — shown when target is this bubble) */}
      {reactionSummary && (
        <span
          className="absolute -bottom-3 right-3 inline-flex items-center gap-0.5 rounded-full border border-slate-200 bg-white px-1.5 py-0.5 text-xs shadow-sm dark:border-slate-700 dark:bg-slate-800"
          title={reactionSummary.fromCustomer ? 'Reação do cliente' : 'Reação do atendente'}
        >
          {reactionSummary.emoji}
        </span>
      )}
    </article>
  );
};

const MessageBubble = memo(MessageBubbleInner, (prev, next) => {
  return (
    prev.message.id === next.message.id &&
    prev.message.status === next.message.status &&
    prev.message.error_message === next.message.error_message &&
    prev.reactionSummary?.emoji === next.reactionSummary?.emoji &&
    prev.reactionSummary?.fromCustomer === next.reactionSummary?.fromCustomer &&
    prev.metaCampaign === next.metaCampaign
  );
});

export default MessageBubble;
