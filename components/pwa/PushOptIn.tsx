import React, { useState } from 'react';
import { Bell, BellOff, BellRing, Smartphone } from 'lucide-react';
import { usePushNotifications } from '../../hooks/usePushNotifications';
import { useData } from '../../services/dataContext';
import { getCachedTopics } from '../../services/pushClient';
import { getDefaultPushTopics, getPushPermissionCopy, PUSH_TOPIC_CATALOG, resolvePushProduct } from '../../lib/pushProduct';
import PermissionRequest from './PermissionRequest';

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

const TOPIC_META: Record<string, { label: string; description: string }> = {
  crm_inbox: { label: 'Mensagens CRM', description: 'Novas respostas de leads e clientes.' },
  new_lead: { label: 'Novos leads', description: 'Entradas novas no funil comercial.' },
  sale: { label: 'Vendas', description: 'Confirmações de vendas registradas no PDV.' },
  finance_due: { label: 'Contas a vencer', description: 'Lembretes de contas a pagar/receber.' },
  stock_alert: { label: 'Alertas de estoque', description: 'Produtos com estoque baixo ou reservas pendentes.' },
  transfer_pending: { label: 'Atendimento pendente', description: 'Conversas aguardando um atendente humano.' },
};

const TOPICS_DEFAULT = getDefaultPushTopics();
const TOPIC_OPTIONS = PUSH_TOPIC_CATALOG[resolvePushProduct()].map((id) => ({ id, ...TOPIC_META[id] }));

const PushOptIn: React.FC<Props> = ({ variant = 'card' }) => {
  const { status, subscribe, updateTopics, unsubscribe } = usePushNotifications();
  const { stores } = useData();
  const [isPermissionSheetOpen, setIsPermissionSheetOpen] = useState(false);
  const [selectedTopics, setSelectedTopics] = useState<string[]>(() => getCachedTopics());
  const storeId = stores[0]?.id;

  const isPending = status === 'requesting' || status === 'subscribing';
  const isSubscribed = status === 'subscribed';
  const canSubscribe = status === 'default' || status === 'error';

  const handleToggle = () => {
    if (isSubscribed) void unsubscribe();
    else if (canSubscribe || status === 'denied') setIsPermissionSheetOpen(true);
  };

  const handleAllow = (prefetchedPermission?: NotificationPermission) => {
    setIsPermissionSheetOpen(false);
    if (canSubscribe) void subscribe(selectedTopics.length ? selectedTopics : TOPICS_DEFAULT, storeId, prefetchedPermission);
  };

  const handleTopicToggle = (topic: string, checked: boolean) => {
    const next = checked
      ? Array.from(new Set([...selectedTopics, topic]))
      : selectedTopics.filter((item) => item !== topic);
    setSelectedTopics(next);
    if (isSubscribed && next.length > 0) {
      void updateTopics(next, storeId);
    }
  };

  const permissionSheet = (
    <PermissionRequest
      permission="notifications"
      open={isPermissionSheetOpen}
      status={status === 'denied' ? 'denied' : 'prompt'}
      {...getPushPermissionCopy()}
      onAllow={handleAllow}
      onDeny={() => setIsPermissionSheetOpen(false)}
    />
  );

  if (status === 'unsupported') return null;

  if (variant === 'inline') {
    return (
      <>
        <div className="flex items-center justify-between gap-3 py-2">
          <div className="flex items-center gap-2 min-w-0">
            {isSubscribed ? (
              <BellRing size={16} className="shrink-0 text-emerald-500" />
            ) : status === 'denied' ? (
              <BellOff size={16} className="shrink-0 text-rose-500" />
            ) : (
              <Bell size={16} className="shrink-0 text-slate-400" />
            )}
            <span className="text-sm text-slate-700 dark:text-slate-200">Push notifications</span>
          </div>
          <button
            type="button"
            disabled={isPending || status === 'needs_install'}
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
        {permissionSheet}
      </>
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
    <>
      <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full transition-colors ${
              isSubscribed
                ? 'bg-emerald-100 text-emerald-600 dark:bg-emerald-950 dark:text-emerald-300'
                : status === 'denied'
                ? 'bg-rose-100 text-rose-600 dark:bg-rose-950 dark:text-rose-300'
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
                  ? 'Permissão negada. Veja como reativar nos ajustes do sistema.'
                  : isSubscribed
                  ? 'Você será notificado sobre novas mensagens, leads e vendas.'
                  : 'Novo lead, mensagem no CRM ou venda finalizada — em tempo real.'}
              </p>
            </div>
          </div>

          <div className="flex shrink-0 flex-col items-end gap-1">
            <button
              type="button"
              disabled={isPending}
              onClick={handleToggle}
              className={`relative inline-flex h-7 w-12 shrink-0 rounded-full border-2 border-transparent transition-colors duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2 disabled:opacity-60 ${
                isSubscribed
                  ? 'bg-emerald-500'
                  : status === 'denied'
                  ? 'bg-rose-300 dark:bg-rose-900'
                  : 'bg-slate-200 dark:bg-slate-700'
              }`}
              role="switch"
              aria-checked={isSubscribed}
              aria-label="Notificações push"
            >
              <span
                className={`pointer-events-none inline-flex h-6 w-6 transform items-center justify-center rounded-full bg-white shadow ring-0 transition duration-200 ${
                  isSubscribed ? 'translate-x-5' : 'translate-x-0'
                }`}
              >
                {isPending && (
                  <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-slate-300 border-t-brand-600" />
                )}
              </span>
            </button>
            <span className={`text-[11px] font-semibold ${
              isSubscribed
                ? 'text-emerald-600 dark:text-emerald-300'
                : status === 'denied'
                ? 'text-rose-600 dark:text-rose-300'
                : 'text-slate-500 dark:text-slate-400'
            }`}>
              {status === 'denied' ? 'Bloqueado' : LABEL[status]}
            </span>
          </div>
        </div>

        <div className="mt-4 space-y-2 border-t border-slate-100 pt-3 dark:border-slate-800">
          {TOPIC_OPTIONS.map((topic) => {
            const checked = selectedTopics.includes(topic.id);
            return (
              <label
                key={topic.id}
                className={`flex items-center justify-between gap-3 rounded-xl px-3 py-2 transition-colors ${
                  isSubscribed ? 'bg-slate-50 dark:bg-slate-950/50' : 'bg-slate-50/60 opacity-70 dark:bg-slate-950/30'
                }`}
              >
                <span className="min-w-0">
                  <span className="block text-xs font-semibold text-slate-800 dark:text-slate-100">{topic.label}</span>
                  <span className="block text-[11px] leading-snug text-slate-500 dark:text-slate-400">{topic.description}</span>
                </span>
                <input
                  type="checkbox"
                  checked={checked}
                  disabled={!isSubscribed && status !== 'default' && status !== 'error'}
                  onChange={(event) => handleTopicToggle(topic.id, event.target.checked)}
                  className="h-5 w-5 shrink-0 accent-brand-600"
                  aria-label={`Receber ${topic.label}`}
                />
              </label>
            );
          })}
          <p className="text-[11px] leading-snug text-slate-500 dark:text-slate-400">
            Alertas promocionais/marketing ficam separados destas notificações operacionais e exigem consentimento próprio.
          </p>
        </div>
      </div>
      {permissionSheet}
    </>
  );
};

export default PushOptIn;
