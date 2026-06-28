import type React from 'react';
import { AlertCircle, Inbox, SearchX } from 'lucide-react';

type StateTone = 'neutral' | 'empty' | 'error';

type ConversationWorkspaceStateProps = {
  tone?: StateTone;
  title: string;
  description: string;
  compact?: boolean;
  action?: { label: string; onClick: () => void };
};

const ICONS = {
  neutral: Inbox,
  empty: SearchX,
  error: AlertCircle,
} satisfies Record<StateTone, React.ComponentType<{ size?: number; className?: string }>>;

export const ConversationWorkspaceState: React.FC<ConversationWorkspaceStateProps> = ({
  tone = 'neutral',
  title,
  description,
  compact = false,
  action,
}) => {
  const Icon = ICONS[tone];

  return (
    <section
      role={tone === 'error' ? 'alert' : 'status'}
      className={`mx-auto flex max-w-md flex-col items-start ${compact ? 'gap-2 p-4' : 'gap-3 p-6 sm:p-8'}`}
    >
      <span
        className="inline-flex h-11 w-11 items-center justify-center rounded-ios-lg bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300"
        aria-hidden="true"
      >
        <Icon size={20} />
      </span>
      <div className="space-y-1">
        <h3 className="text-ios-headline font-semibold text-slate-950 dark:text-slate-50">{title}</h3>
        <p className="text-ios-subhead text-slate-600 dark:text-slate-300">{description}</p>
      </div>
      {action && (
        <button type="button" className="crm-btn crm-btn-primary" onClick={action.onClick}>
          {action.label}
        </button>
      )}
    </section>
  );
};

export const ConversationListSkeleton: React.FC = () => (
  <div aria-label="Carregando conversas" aria-busy="true" className="space-y-2 p-3">
    {Array.from({ length: 6 }, (_, index) => (
      <div
        key={index}
        aria-hidden="true"
        className="h-[68px] animate-shimmer rounded-ios-lg bg-slate-100 dark:bg-slate-800"
      />
    ))}
  </div>
);

export const MessageThreadSkeleton: React.FC = () => (
  <div aria-label="Carregando mensagens" aria-busy="true" className="mt-auto space-y-3 p-4 sm:p-6">
    <div aria-hidden="true" className="h-16 w-3/5 animate-shimmer rounded-ios-lg bg-slate-100 dark:bg-slate-800" />
    <div aria-hidden="true" className="ml-auto h-14 w-1/2 animate-shimmer rounded-ios-lg bg-brand-100 dark:bg-brand-900/40" />
    <div aria-hidden="true" className="h-20 w-2/3 animate-shimmer rounded-ios-lg bg-slate-100 dark:bg-slate-800" />
  </div>
);
