import { memo } from 'react';
import { AlertTriangle, Bot, FileText, Image as ImageIcon, Mic, UsersRound, Video } from 'lucide-react';
import { m, useReducedMotion } from 'framer-motion';
import { iosFastEase } from '../motion/transitions';
import {
  formatConversationDate,
  getAvatarTone,
  getConversationAvatarUrl,
  getInitials,
  getLeadDisplay,
  getPreviewText,
  getProviderShortLabel,
  getStatusMeta,
  isAIHandlingConversation,
  isGroupConversation,
  isTransferPendingConversation,
  resolveMediaKind,
  type ConversationRow,
} from './conversationUi';

type ConversationListItemProps = {
  conversation: ConversationRow;
  selected: boolean;
  onSelect: (id: string) => void;
};

const getProviderDisplayLabel = (provider: string | null | undefined) => {
  if (provider === 'uazapi') return 'WhatsApp';
  if (provider === 'instagram_official') return 'Instagram';
  return getProviderShortLabel(provider);
};

const ConversationListItem = memo(({ conversation, selected, onSelect }: ConversationListItemProps) => {
  const reducedMotion = useReducedMotion();
  const leadName = getLeadDisplay(conversation);
  const provider = conversation.crm_channels?.provider;
  const providerLabel = getProviderDisplayLabel(provider);
  const unreadCount = Number(conversation.unread_count || 0);
  const transferPending = isTransferPendingConversation(conversation);
  const aiHandling = isAIHandlingConversation(conversation);
  const previewKind = resolveMediaKind(conversation.lastMessage?.media_type, conversation.lastMessage?.media_url);
  const avatarUrl = getConversationAvatarUrl(conversation);
  const previewText = getPreviewText(conversation.lastMessage);
  const PreviewIcon = previewKind === 'image'
    ? ImageIcon
    : previewKind === 'video'
      ? Video
      : previewKind === 'audio'
        ? Mic
        : FileText;

  return (
    <m.button
      layout={reducedMotion ? false : 'position'}
      transition={reducedMotion ? { duration: 0 } : iosFastEase}
      type="button"
      aria-current={selected ? 'true' : undefined}
      onClick={() => onSelect(conversation.id)}
      className={`crm-chat-row w-full rounded-ios-lg px-3 py-3 text-left transition-colors duration-150 ${selected
        ? 'bg-brand-50 ring-1 ring-brand-200 dark:bg-brand-500/10 dark:ring-brand-500/30'
        : 'hover:bg-slate-100 dark:hover:bg-slate-900'}`}
    >
      <span className="flex items-start gap-3">
        <span
          className={`relative inline-flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-full text-sm font-bold ${getAvatarTone(conversation.lead_id)}`}
          aria-hidden="true"
        >
          {avatarUrl ? (
            <img src={avatarUrl} alt="" className="h-full w-full object-cover" loading="lazy" />
          ) : isGroupConversation(conversation) ? (
            <UsersRound size={18} />
          ) : (
            getInitials(leadName)
          )}
        </span>
        <span className="min-w-0 flex-1">
          <span className="flex items-center justify-between gap-2">
            <strong className="truncate text-ios-subhead text-slate-950 dark:text-slate-50">{leadName}</strong>
            <time className="shrink-0 text-ios-caption text-slate-600 dark:text-slate-300">
              {formatConversationDate(conversation.last_message_at || conversation.lastMessage?.created_at || null)}
            </time>
          </span>
          <span className="mt-0.5 flex items-center gap-1 text-ios-caption text-slate-600 dark:text-slate-300">
            {providerLabel} · {conversation.crm_channels?.name || getProviderShortLabel(provider)}
          </span>
          <span className="mt-1 flex min-w-0 items-center gap-2 text-ios-caption text-slate-600 dark:text-slate-300">
            {previewKind && <PreviewIcon size={14} aria-hidden="true" />}
            <span className={`truncate ${unreadCount > 0 ? 'font-semibold text-slate-800 dark:text-slate-100' : ''}`}>
              {conversation.lastMessage?.direction === 'outbound' ? 'Você: ' : ''}{previewText}
            </span>
          </span>
          <span className="mt-2 flex flex-wrap items-center gap-1.5">
            <span className="rounded-full bg-slate-100 px-2 py-1 text-ios-caption font-semibold text-slate-700 dark:bg-slate-800 dark:text-slate-200">
              {getStatusMeta(conversation.status).label}
            </span>
            {transferPending && (
              <span className="inline-flex items-center gap-1 rounded-full bg-red-50 px-2 py-1 text-ios-caption font-semibold text-red-700 dark:bg-red-950/40 dark:text-red-200">
                <AlertTriangle size={12} aria-hidden="true" /> Transferência pendente
              </span>
            )}
            {!transferPending && aiHandling && (
              <span className="inline-flex items-center gap-1 rounded-full bg-orange-50 px-2 py-1 text-ios-caption font-semibold text-orange-800 dark:bg-orange-950/40 dark:text-orange-200">
                <Bot size={12} aria-hidden="true" /> IA atendendo
              </span>
            )}
            {unreadCount > 0 && (
              <span
                aria-label={`${unreadCount} mensagens não lidas`}
                className="ml-auto inline-flex min-h-6 min-w-6 items-center justify-center rounded-full bg-brand-600 px-1.5 text-ios-caption font-bold text-white"
              >
                {unreadCount}
              </span>
            )}
          </span>
        </span>
      </span>
    </m.button>
  );
});

ConversationListItem.displayName = 'ConversationListItem';

export default ConversationListItem;
