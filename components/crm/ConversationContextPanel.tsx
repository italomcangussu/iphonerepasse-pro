import type React from 'react';
import type { AICommerceSnapshot } from '../../lib/crm/aiCommerceSnapshot';
import AICommerceStatePanel from './AICommerceStatePanel';
import {
  formatConversationDate,
  getAvatarTone,
  type ConversationRow,
} from './conversationUi';
import CRMAvatarContent from './CRMAvatarContent';

type Props = {
  conversation: ConversationRow;
  leadName: string;
  avatarUrl: string | null;
  isGroup: boolean;
  ownershipLabel: string;
  messageCount: number;
  loadingCommerceSnapshot: boolean;
  commerceSnapshot: AICommerceSnapshot | null;
  className?: string;
};

const ConversationContextPanel: React.FC<Props> = ({
  conversation,
  leadName,
  avatarUrl,
  isGroup,
  ownershipLabel,
  messageCount,
  loadingCommerceSnapshot,
  commerceSnapshot,
  className = '',
}) => (
  <aside
    aria-label="Contexto da conversa"
    className={`crm-conversation-context min-w-0 overflow-y-auto bg-slate-50 p-4 dark:bg-slate-900 ${className}`}
  >
    <div className="flex items-center gap-3 border-b border-slate-200 pb-4 dark:border-slate-700">
      <span className={`inline-flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-full text-sm font-bold ${getAvatarTone(conversation.lead_id)}`}>
        <CRMAvatarContent avatarUrl={avatarUrl} name={leadName} isGroup={isGroup} />
      </span>
      <div className="min-w-0">
        <h2 className="truncate text-ios-headline font-semibold text-slate-950 dark:text-slate-50">{leadName}</h2>
        <p className="truncate text-ios-caption text-slate-600 dark:text-slate-300">{conversation.crm_leads?.phone || 'Telefone não informado'}</p>
      </div>
    </div>

    <dl className="divide-y divide-slate-200 dark:divide-slate-700">
      <div className="py-3">
        <dt className="text-ios-caption text-slate-600 dark:text-slate-300">Estado do atendimento</dt>
        <dd className="mt-1 text-ios-subhead font-semibold text-slate-950 dark:text-slate-50">{ownershipLabel}</dd>
      </div>
      <div className="py-3">
        <dt className="text-ios-caption text-slate-600 dark:text-slate-300">Canal</dt>
        <dd className="mt-1 text-ios-subhead font-semibold text-slate-950 dark:text-slate-50">{conversation.crm_channels?.name || 'Não informado'}</dd>
      </div>
      <div className="py-3">
        <dt className="text-ios-caption text-slate-600 dark:text-slate-300">Mensagens</dt>
        <dd className="mt-1 text-ios-subhead font-semibold text-slate-950 dark:text-slate-50">{messageCount}</dd>
      </div>
      <div className="py-3">
        <dt className="text-ios-caption text-slate-600 dark:text-slate-300">Última atividade</dt>
        <dd className="mt-1 text-ios-subhead font-semibold text-slate-950 dark:text-slate-50">
          {formatConversationDate(conversation.last_message_at || conversation.lastMessage?.created_at || null)}
        </dd>
      </div>
    </dl>

    <div className="mt-4">
      <AICommerceStatePanel loading={loadingCommerceSnapshot} snapshot={commerceSnapshot} />
    </div>

    <details className="mt-4 border-t border-slate-200 pt-3 text-ios-caption dark:border-slate-700">
      <summary className="min-h-11 cursor-pointer py-3 font-semibold text-slate-700 dark:text-slate-200">Identificadores técnicos</summary>
      <p className="break-all text-slate-600 dark:text-slate-300">Lead: {conversation.lead_id}</p>
      <p className="break-all text-slate-600 dark:text-slate-300">Conversa: {conversation.id}</p>
    </details>
  </aside>
);

export default ConversationContextPanel;
