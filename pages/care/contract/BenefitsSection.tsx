import React, { useState } from 'react';
import { PackageCheck } from 'lucide-react';
import IOSButton from '../../../components/ui/IOSButton';
import CareStatusBadge from '../../../components/care/CareStatusBadge';
import { useToast } from '../../../components/ui/ToastProvider';
import { deliverCareBenefit } from '../../../services/careApi';
import type { CareContractBenefit } from '../../../lib/care/careTypes';
import type { CareTone } from '../../../lib/care/careLabels';
import { formatDateTimeBRL } from '../../../utils/inputMasks';
import { Section } from './Section';

const BENEFIT_STATUS: Record<CareContractBenefit['status'], { label: string; tone: CareTone }> = {
  pendente: { label: 'Aguardando 1ª parcela', tone: 'neutral' },
  liberado: { label: 'Liberado para entrega', tone: 'warning' },
  entregue: { label: 'Entregue', tone: 'success' },
  cancelado: { label: 'Cancelado', tone: 'neutral' },
};

const DeliverButton: React.FC<{ benefit: CareContractBenefit; onDone: () => void }> = ({ benefit, onDone }) => {
  const toast = useToast();
  const [notes, setNotes] = useState('');
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const deliver = async () => {
    setBusy(true);
    try {
      await deliverCareBenefit(benefit.id, notes);
      toast.success(`Entrega de ${benefit.name} registrada.`);
      onDone();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Não foi possível registrar a entrega.');
    } finally {
      setBusy(false);
    }
  };
  if (!open) {
    return (
      <IOSButton variant="secondary" type="button" onClick={() => setOpen(true)}>
        <span className="inline-flex items-center gap-2"><PackageCheck size={16} /> Registrar entrega</span>
      </IOSButton>
    );
  }
  return (
    <div className="flex w-full flex-col gap-2 sm:flex-row">
      <input className="ios-input flex-1" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Itens entregues / observação" aria-label="Observação da entrega" />
      <IOSButton variant="primary" type="button" loading={busy} onClick={deliver}>Confirmar entrega</IOSButton>
    </div>
  );
};

const BenefitsSection: React.FC<{ benefits: CareContractBenefit[]; onChanged: () => void }> = ({ benefits, onChanged }) => (
  <Section title="Bônus da 1ª parcela">
    {benefits.length === 0 ? (
      <p className="text-sm app-text-muted">Sem bônus nesta contratação.</p>
    ) : (
      <ul className="space-y-2">
        {benefits.map((b) => (
          <li key={b.id} className="flex flex-wrap items-center gap-3 rounded-ios-lg border app-border px-3 py-2">
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold app-text-primary">{b.quantity}× {b.name}</p>
              {b.delivered_at && <p className="text-xs app-text-muted">Entregue em {formatDateTimeBRL(b.delivered_at)}{b.delivery_notes ? ` · ${b.delivery_notes}` : ''}</p>}
            </div>
            <CareStatusBadge {...BENEFIT_STATUS[b.status]} />
            {b.status === 'liberado' && <DeliverButton benefit={b} onDone={onChanged} />}
          </li>
        ))}
      </ul>
    )}
  </Section>
);

export default BenefitsSection;
