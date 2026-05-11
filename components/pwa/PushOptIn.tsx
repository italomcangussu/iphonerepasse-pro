import React from 'react';
import { Bell, BellOff, BellRing, Smartphone } from 'lucide-react';
import { usePushNotifications } from '../../hooks/usePushNotifications';
import { useData } from '../../services/dataContext';

interface Props {
  /** Display variant — 'card' for settings page, 'inline' for compact rows. */
  variant?: 'card' | 'inline';
}

const LABEL: Record<string, string> = {
  unsupported: 'Não suportado',
  needs_install: 'Instale o app',
  default: 'Ativar notificações',
  requesting: 'Aguardando permissão…',
  subscribing: 'Ativando…',
  subscribed: 'Notificações ativas',
  denied: 'Permissão negada',
  error: 'Tente novamente',
};

const TOPICS_DEFAULT = ['crm_inbox', 'new_lead', 'sale'];

const PushOptIn: React.FC<Props> = ({ variant = 'card' }) => {
  const { status, subscribe, unsubscribe } = usePushNotifications();
  const { stores } = useData();
  const storeId = stores[0]?.id;

  const isPending = status === 'requesting' || status === 'subscribing';
  const isSubscribed = status === 'subscribed';
  const canSubscribe = status === 'default' || status === 'error';

  const handleToggle = () => {
    if (isSubscribed) void unsubscribe();
    else if (canSubscribe) void subscribe(TOPICS_DEFAULT, storeId);
  };

  if (status === 'unsupported') return null;

  if (variant === 'inline') {
    return (
      <div className="flex items-center justify-between gap-3 py-2">
        <div className="flex items-center gap-2 min-w-0">
          {isSubscribed ? (
            <BellRing size={16} className="shrink-0 text-emerald-500" />
          ) : (
            <Bell size={16} className="shrink-0 text-slate-400" />
          )}
          <span className="text-sm text-slate-700 dark:text-slate-200">Push notifications</span>
        </div>
        <button
          type="button"
          disabled={isPending || status === 'denied' || status === 'needs_install'}
          onClick={handleToggle}
          className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 focus:outline-none disabled:opacity-40 ${
            isSubscribed ? 'bg-emerald-500' : 'bg-slate-200 dark:bg-slate-700'
          }`}
          role="switch"
          aria-checked={isSubscribed}
          aria-label="Ativar notificações push"
        >
          <span
            className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ${
              isSubscribed ? 'translate-x-5' : 'translate-x-0'
            }`}
          />
        </button>
      </div>
    );
  }

  // ── card variant ──────────────────────────────────────────────────────────

  if (status === 'needs_install') {
    return (
      <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-900/60">
        <div className="flex items-start gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand-100 text-brand-600 dark:bg-brand-950 dark:text-brand-300">
            <Smartphone size={18} />
          </div>
          <div>
            <p className="text-sm font-semibold text-slate-900 dark:text-slate-50">Notificações push</p>
            <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
              Adicione o app à Tela de Início para receber notificações em tempo real.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full transition-colors ${
            isSubscribed
              ? 'bg-emerald-100 text-emerald-600 dark:bg-emerald-950 dark:text-emerald-300'
              : 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400'
          }`}>
            {isSubscribed ? <BellRing size={18} /> : status === 'denied' ? <BellOff size={18} /> : <Bell size={18} />}
          </div>
          <div>
            <p className="text-sm font-semibold text-slate-900 dark:text-slate-50">
              {isSubscribed ? 'Notificações ativas' : 'Receba notificações'}
            </p>
            <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
              {status === 'denied'
                ? 'Permissão negada. Habilite nas configurações do navegador.'
                : isSubscribed
                ? 'Você será notificado sobre novas mensagens, leads e vendas.'
                : 'Novo lead, mensagem no CRM ou venda finalizada — em tempo real.'}
            </p>
          </div>
        </div>

        {status !== 'denied' && (
          <button
            type="button"
            disabled={isPending}
            onClick={handleToggle}
            className={`inline-flex shrink-0 items-center justify-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold transition-colors disabled:opacity-60 ${
              isSubscribed
                ? 'bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700'
                : 'bg-brand-600 text-white shadow-sm shadow-brand-600/20 hover:bg-brand-700'
            }`}
          >
            {isPending ? (
              <span className="inline-block h-3.5 w-3.5 animate-spin rounded-full border-2 border-white border-t-transparent" />
            ) : (
              LABEL[status]
            )}
          </button>
        )}
      </div>
    </div>
  );
};

export default PushOptIn;
