import React, { useEffect, useState } from 'react';
import { AlertCircle, CheckCircle2, FileText, Gift, Lock, MapPin, ShieldCheck } from 'lucide-react';
import CareLogo from '../../../components/care/CareLogo';
import IOSButton from '../../../components/ui/IOSButton';
import type { CareSignView } from '../../../lib/care/careSignTypes';
import { conditionLabel } from '../../../lib/care/careLabels';
import { formatCurrencyBRL, formatPercentBRL } from '../../../utils/inputMasks';

const card = 'rounded-ios-xl bg-white dark:bg-surface-dark-100 shadow-ios p-5';

export const SignShell: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div className="min-h-[100dvh] bg-surface-light-100 dark:bg-surface-dark-50 px-4 pb-[max(2rem,env(safe-area-inset-bottom))] pt-[max(1.5rem,env(safe-area-inset-top))]">
    <main className="mx-auto w-full max-w-md space-y-4">
      <header className="flex justify-center py-2">
        <CareLogo className="h-32 w-auto" />
      </header>
      {children}
      <p className="flex items-center justify-center gap-1.5 pt-2 text-xs app-text-muted">
        <Lock size={12} aria-hidden /> Página segura da iPhone Repasse · assinatura eletrônica
      </p>
    </main>
  </div>
);

export const SignSkeleton: React.FC = () => (
  <div aria-busy aria-label="Carregando contrato" className="space-y-4">
    <div className={`${card} h-40 animate-pulse`} />
    <div className={`${card} h-64 animate-pulse`} />
  </div>
);

export const UnavailableScreen: React.FC<{ message: string }> = ({ message }) => (
  <section className={`${card} text-center space-y-3`}>
    <AlertCircle className="mx-auto text-amber-500" size={40} aria-hidden />
    <h1 className="text-lg font-bold app-text-primary">Não é possível assinar por este link</h1>
    <p className="text-sm app-text-secondary">{message}</p>
    <p className="text-sm app-text-muted">Fale com a loja pelo WhatsApp para receber um novo link.</p>
  </section>
);

const STEPS = ['Ler', 'Aceitar', 'Assinar'] as const;

export const SignProgress: React.FC<{ current: 0 | 1 | 2 }> = ({ current }) => (
  <ol className="grid grid-cols-3 gap-2" aria-label="Etapas da assinatura">
    {STEPS.map((label, index) => {
      const done = index < current;
      const active = index === current;
      return (
        <li key={label} aria-current={active ? 'step' : undefined} className="space-y-1.5">
          <span className={`block h-1.5 rounded-full ${done || active ? 'bg-brand-500' : 'bg-gray-200 dark:bg-surface-dark-300'}`} />
          <span className={`block text-xs font-semibold ${active ? 'text-brand-600 dark:text-brand-400' : 'app-text-muted'}`}>
            {index + 1}. {label}{done ? ' ✓' : ''}
          </span>
        </li>
      );
    })}
  </ol>
);

const Line: React.FC<{ label: string; value: React.ReactNode; hint?: string }> = ({ label, value, hint }) => (
  <div className="flex items-start justify-between gap-4 py-2">
    <div>
      <p className="text-sm app-text-secondary">{label}</p>
      {hint && <p className="text-xs app-text-muted">{hint}</p>}
    </div>
    <p className="whitespace-nowrap text-right text-sm font-semibold app-text-primary tabular-nums">{value}</p>
  </div>
);

const months = (n: number) => (n === 1 ? '1 mês' : `${n} meses`);

export const ContractSummaryCard: React.FC<{ view: CareSignView }> = ({ view }) => {
  const { contract } = view;
  const v = contract.values;
  const device = [contract.device.model, contract.device.capacity, contract.device.color].filter(Boolean).join(' · ');
  return (
    <section className={`${card} space-y-4`} aria-labelledby="care-summary-title">
      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-accent-600">Contrato nº {contract.number}</p>
        <h1 id="care-summary-title" className="mt-1 text-xl font-bold app-text-primary">Assistência técnica continuada</h1>
        <p className="mt-1 text-sm app-text-muted">Confira seus dados e os valores antes de assinar.</p>
      </div>
      <dl className="rounded-ios-lg app-surface-soft p-3 text-sm space-y-1">
        <div className="flex justify-between gap-3"><dt className="app-text-muted">Contratante</dt><dd className="font-semibold app-text-primary text-right">{contract.customer.name}</dd></div>
        {contract.customer.cpfMasked && <div className="flex justify-between gap-3"><dt className="app-text-muted">CPF</dt><dd className="app-text-primary">{contract.customer.cpfMasked}</dd></div>}
        <div className="flex justify-between gap-3"><dt className="app-text-muted">WhatsApp</dt><dd className="app-text-primary">{contract.customer.phoneMasked}</dd></div>
        <div className="flex justify-between gap-3"><dt className="app-text-muted">Aparelho</dt><dd className="app-text-primary text-right">{device} · {conditionLabel(contract.device.condition)}</dd></div>
        {contract.device.imeiMasked && <div className="flex justify-between gap-3"><dt className="app-text-muted">IMEI</dt><dd className="app-text-primary font-mono">{contract.device.imeiMasked}</dd></div>}
      </dl>
      <div className="divide-y divide-gray-100 dark:divide-surface-dark-200">
        <Line label="1ª parcela" value={formatCurrencyBRL(v.firstAmount)} />
        {v.subsequentCount > 0 && (
          <Line
            label={`Parcelas seguintes: ${v.subsequentCount}×`}
            hint={`${formatPercentBRL(v.recurringPercent)} do valor pago no aparelho (${formatCurrencyBRL(v.salePrice)}), a cada ${months(v.billingIntervalMonths)}`}
            value={formatCurrencyBRL(v.recurringAmount)}
          />
        )}
        <Line label="Total do contrato" hint={`1 inicial + ${v.subsequentCount} seguinte(s)`} value={formatCurrencyBRL(v.totalProgrammed)} />
        <Line
          label="Coparticipação por atendimento"
          hint={v.deductibleModality === 'PERCENTUAL' ? `${formatPercentBRL(v.deductibleRate)} do valor pago no aparelho` : 'valor fixo'}
          value={formatCurrencyBRL(v.deductibleAmount)}
        />
        <Line label="Vigência" hint="a partir da ativação" value={months(v.termMonths)} />
      </div>
      {contract.bonuses.length > 0 && (
        <p className="flex items-start gap-2 text-sm app-text-secondary">
          <Gift size={16} className="mt-0.5 shrink-0 text-accent-500" aria-hidden />
          <span>
            <span className="font-semibold app-text-primary">Bônus: </span>
            {contract.bonuses.map((b) => `${b.quantity}× ${b.name}`).join(', ')} — entregue após a 1ª parcela paga.
          </span>
        </p>
      )}
      <p className="text-xs app-text-muted">
        Este contrato é de prestação de serviços de assistência técnica. Não é seguro: não há indenização nem reposição por perda, roubo ou furto.
      </p>
    </section>
  );
};

export const ReadStep: React.FC<{ url: string | null; viewed: boolean; onOpen: () => void }> = ({ url, viewed, onOpen }) => (
  <section className={`${card} space-y-3`}>
    <h2 className="text-base font-bold app-text-primary">1. Leia o contrato completo</h2>
    <p className="text-sm app-text-secondary">Abra o PDF com todas as cláusulas. Ele é o documento que você vai assinar.</p>
    {url ? (
      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        onClick={onOpen}
        className="ios-button-secondary flex min-h-[48px] w-full items-center justify-center gap-2"
      >
        <FileText size={18} aria-hidden /> {viewed ? 'Abrir o contrato de novo' : 'Abrir contrato completo (PDF)'}
      </a>
    ) : (
      <p className="text-sm text-red-600">O PDF não carregou. Atualize a página.</p>
    )}
    {viewed && <p className="flex items-center gap-1.5 text-sm text-green-700 dark:text-green-400"><CheckCircle2 size={16} aria-hidden /> Contrato aberto</p>}
  </section>
);

interface AcceptStepProps {
  acceptanceText: string;
  enabled: boolean;
  busy: boolean;
  onAccept: (shareLocation: boolean) => void;
}

export const AcceptStep: React.FC<AcceptStepProps> = ({ acceptanceText, enabled, busy, onAccept }) => {
  const [agreed, setAgreed] = useState(false);
  const [shareLocation, setShareLocation] = useState(false);
  return (
    <section className={`${card} space-y-4 ${enabled ? '' : 'opacity-60'}`} aria-disabled={!enabled}>
      <h2 className="text-base font-bold app-text-primary">2. Confirme que concorda</h2>
      <label className="flex min-h-[44px] cursor-pointer items-start gap-3 rounded-ios-lg border app-border p-3">
        <input type="checkbox" className="mt-0.5 h-5 w-5 shrink-0 accent-brand-500" checked={agreed} disabled={!enabled} onChange={(e) => setAgreed(e.target.checked)} />
        <span className="text-sm font-medium app-text-primary">{acceptanceText}</span>
      </label>
      <label className="flex min-h-[44px] cursor-pointer items-start gap-3 p-1">
        <input type="checkbox" className="mt-0.5 h-5 w-5 shrink-0 accent-brand-500" checked={shareLocation} disabled={!enabled} onChange={(e) => setShareLocation(e.target.checked)} />
        <span className="text-sm app-text-secondary">
          <MapPin size={14} className="mr-1 inline" aria-hidden />
          Registrar minha localização como prova da assinatura <span className="app-text-muted">(opcional; o celular vai pedir permissão)</span>
        </span>
      </label>
      <IOSButton variant="primary" className="w-full min-h-[48px]" disabled={!enabled || !agreed} loading={busy} onClick={() => onAccept(shareLocation)} type="button">
        Aceitar e receber o código no WhatsApp
      </IOSButton>
      {!enabled && <p className="text-xs app-text-muted">Abra o contrato completo para liberar esta etapa.</p>}
      {enabled && !agreed && <p className="text-xs app-text-muted">Marque a confirmação acima para continuar.</p>}
    </section>
  );
};

const useSecondsUntil = (iso: string | null): number => {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);
  return iso ? Math.max(0, Math.ceil((new Date(iso).getTime() - now) / 1000)) : 0;
};

interface CodeStepProps {
  phoneMasked: string | null;
  ttlMinutes: number;
  busy: boolean;
  resendAvailableAt: string | null;
  onConfirm: (code: string) => void;
  onResend: () => void;
}

export const CodeStep: React.FC<CodeStepProps> = ({ phoneMasked, ttlMinutes, busy, resendAvailableAt, onConfirm, onResend }) => {
  const [code, setCode] = useState('');
  const wait = useSecondsUntil(resendAvailableAt);

  return (
    <section className={`${card} space-y-4`}>
      <h2 className="text-base font-bold app-text-primary">3. Assine com o código</h2>
      <p className="text-sm app-text-secondary">
        {phoneMasked ? `Enviamos um código de 6 números para o WhatsApp terminado em ${phoneMasked.slice(-4)}.` : 'Peça o código para continuar.'} Ele vale {ttlMinutes} minutos.
      </p>
      <label htmlFor="care-otp" className="block text-sm font-semibold app-text-primary">Código de assinatura</label>
      <input
        id="care-otp"
        autoFocus
        inputMode="numeric"
        autoComplete="one-time-code"
        pattern="\d{6}"
        maxLength={6}
        value={code}
        onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
        className="ios-input w-full min-h-[56px] text-center text-2xl font-bold tracking-[0.5em] tabular-nums"
        placeholder="••••••"
        aria-describedby="care-otp-help"
      />
      <p id="care-otp-help" className="text-xs app-text-muted">Ao confirmar o código, você assina o contrato eletronicamente.</p>
      <IOSButton variant="primary" className="w-full min-h-[48px]" disabled={code.length !== 6} loading={busy} onClick={() => onConfirm(code)} type="button">
        <span className="inline-flex items-center gap-2"><ShieldCheck size={18} /> Assinar contrato</span>
      </IOSButton>
      <button type="button" onClick={onResend} disabled={busy || wait > 0} className="min-h-[44px] w-full text-sm font-semibold text-brand-600 disabled:text-gray-400 dark:text-brand-400">
        {wait > 0 ? `Reenviar código em ${wait}s` : 'Não recebi — reenviar código'}
      </button>
    </section>
  );
};

export const SignedScreen: React.FC<{ view: CareSignView }> = ({ view }) => (
  <section className={`${card} text-center space-y-3`}>
    <CheckCircle2 className="mx-auto text-green-500" size={48} aria-hidden />
    <h1 className="text-xl font-bold app-text-primary">Contrato assinado</h1>
    <p className="text-sm app-text-secondary">
      Contrato Repasse Care+ nº {view.contract.number} assinado
      {view.session.signedAt ? ` em ${new Date(view.session.signedAt).toLocaleString('pt-BR', { timeZone: 'America/Fortaleza' })}` : ''}.
      Você também recebe a cópia no WhatsApp.
    </p>
    <p className="text-sm app-text-muted">O contrato é ativado quando a loja confirmar o pagamento da 1ª parcela{view.contract.bonuses.length > 0 ? ' — e aí seu bônus é liberado' : ''}.</p>
    {view.document.signedUrl && (
      <a href={view.document.signedUrl} target="_blank" rel="noopener noreferrer" className="ios-button-secondary inline-flex min-h-[48px] w-full items-center justify-center gap-2">
        <FileText size={18} aria-hidden /> Baixar contrato assinado
      </a>
    )}
  </section>
);
