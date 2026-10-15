import React, { useState } from 'react';
import { CheckCircle2 } from 'lucide-react';
import IOSButton from '../../../components/ui/IOSButton';
import CareStatusBadge from '../../../components/care/CareStatusBadge';
import { useToast } from '../../../components/ui/ToastProvider';
import { confirmCareInstallment } from '../../../services/careApi';
import { isInstallmentOverdue, nextPayableInstallment, paidTotal } from '../../../lib/care/careLabels';
import type { CareContract, CareInstallment } from '../../../lib/care/careTypes';
import { formatCurrencyBRL, formatDateBRL, formatDateTimeBRL } from '../../../utils/inputMasks';
import { Section } from './Section';

const METHODS = ['Pix', 'Dinheiro', 'Cartão de débito', 'Cartão de crédito', 'Transferência'] as const;
const ACCOUNTS = ['Conta Bancária', 'Cofre'] as const;

const today = () => new Date().toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' });

// 1ª parcela pode ser recebida enquanto o contrato aguarda assinatura ou 1º pagamento; as seguintes, só com contrato vigente.
export function canReceive(contract: Pick<CareContract, 'status'>, installment: CareInstallment): boolean {
  if (installment.kind === 'primeira') {
    return ['aguardando_assinatura', 'assinado_aguardando_primeiro_pagamento'].includes(contract.status);
  }
  return ['ativo', 'suspenso'].includes(contract.status);
}

const PaymentForm: React.FC<{ installment: CareInstallment; onDone: () => void; onCancel: () => void }> = ({ installment, onDone, onCancel }) => {
  const toast = useToast();
  const [method, setMethod] = useState<string>('Pix');
  const [account, setAccount] = useState<(typeof ACCOUNTS)[number]>('Conta Bancária');
  const [reference, setReference] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    setBusy(true);
    try {
      const result = await confirmCareInstallment({ installmentId: installment.id, method, account, reference });
      toast.success(result.alreadyPaid ? 'Esta parcela já estava paga.' : `Parcela ${installment.sequence_number} registrada em ${account}.`);
      onDone();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Não foi possível registrar o pagamento.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="rounded-ios-lg border border-brand-200 bg-brand-50/50 p-3 space-y-3 dark:border-brand-500/30 dark:bg-brand-500/10">
      <p className="text-sm font-semibold app-text-primary">
        Receber parcela {installment.sequence_number} · {formatCurrencyBRL(installment.amount)}
      </p>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
        <label className="text-xs app-text-muted">Forma
          <select className="ios-input mt-1 w-full" value={method} onChange={(e) => setMethod(e.target.value)}>
            {METHODS.map((m) => <option key={m}>{m}</option>)}
          </select>
        </label>
        <label className="text-xs app-text-muted">Conta de entrada
          <select className="ios-input mt-1 w-full" value={account} onChange={(e) => setAccount(e.target.value as (typeof ACCOUNTS)[number])}>
            {ACCOUNTS.map((a) => <option key={a}>{a}</option>)}
          </select>
        </label>
        <label className="text-xs app-text-muted">Referência (opcional)
          <input className="ios-input mt-1 w-full" value={reference} onChange={(e) => setReference(e.target.value)} placeholder="ID do Pix, NSU…" />
        </label>
      </div>
      {installment.kind === 'primeira' && (
        <p className="text-xs app-text-muted">Com o contrato assinado, confirmar a 1ª parcela ativa o contrato e libera o bônus.</p>
      )}
      <div className="flex justify-end gap-2">
        <IOSButton variant="ghost" type="button" onClick={onCancel}>Cancelar</IOSButton>
        <IOSButton variant="primary" type="button" loading={busy} onClick={submit}>Confirmar recebimento</IOSButton>
      </div>
    </div>
  );
};

const InstallmentStatus: React.FC<{ installment: CareInstallment }> = ({ installment }) => {
  if (installment.status === 'paga') return <CareStatusBadge tone="success" label="Paga" />;
  if (installment.status === 'cancelada') return <CareStatusBadge tone="neutral" label="Cancelada" />;
  if (isInstallmentOverdue(installment, today())) return <CareStatusBadge tone="danger" label="Vencida" />;
  return <CareStatusBadge tone="info" label="Programada" />;
};

const InstallmentsSection: React.FC<{ contract: CareContract; installments: CareInstallment[]; onChanged: () => void }> = ({ contract, installments, onChanged }) => {
  const [paying, setPaying] = useState(false);
  const next = nextPayableInstallment(installments);
  const receivable = next && canReceive(contract, next);
  return (
    <Section
      title={`Parcelas · recebido ${formatCurrencyBRL(paidTotal(installments))} de ${formatCurrencyBRL(contract.total_programmed)}`}
      action={receivable && !paying ? (
        <IOSButton variant="primary" type="button" onClick={() => setPaying(true)}>
          <span className="inline-flex items-center gap-2"><CheckCircle2 size={16} /> Receber parcela {next.sequence_number}</span>
        </IOSButton>
      ) : undefined}
    >
      {paying && next && <PaymentForm installment={next} onCancel={() => setPaying(false)} onDone={() => { setPaying(false); onChanged(); }} />}
      <ul className="divide-y divide-gray-100 rounded-ios-lg border app-border dark:divide-surface-dark-200">
        {installments.map((i) => (
          <li key={i.id} className="flex items-center gap-3 px-3 py-2 text-sm">
            <span className="w-16 shrink-0 font-semibold app-text-primary">{i.sequence_number === 1 ? '1ª' : `${i.sequence_number}ª`}</span>
            <span className="flex-1 app-text-muted">
              {i.status === 'paga' ? `Paga em ${formatDateTimeBRL(i.paid_at)} · ${i.payment_method}` : i.due_date ? `Vence ${formatDateBRL(i.due_date)}` : 'Vencimento definido na ativação'}
            </span>
            <span className="tabular-nums font-semibold app-text-primary">{formatCurrencyBRL(i.amount)}</span>
            <InstallmentStatus installment={i} />
          </li>
        ))}
      </ul>
    </Section>
  );
};

export default InstallmentsSection;
