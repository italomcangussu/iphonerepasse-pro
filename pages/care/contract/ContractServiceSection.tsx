import React, { useState } from 'react';
import { Wrench } from 'lucide-react';
import IOSButton from '../../../components/ui/IOSButton';
import CareStatusBadge from '../../../components/care/CareStatusBadge';
import { useToast } from '../../../components/ui/ToastProvider';
import { openCareServiceRequest } from '../../../services/careApi';
import { CARE_SERVICE_STATUS } from '../../../lib/care/careLabels';
import type { CareContract, CareServiceRequest } from '../../../lib/care/careTypes';
import { formatCurrencyBRL, formatDateTimeBRL } from '../../../utils/inputMasks';
import { Section } from './Section';

const OpenRequestForm: React.FC<{ contractId: string; onDone: () => void; onCancel: () => void }> = ({ contractId, onDone, onCancel }) => {
  const toast = useToast();
  const [serviceType, setServiceType] = useState('');
  const [description, setDescription] = useState('');
  const [busy, setBusy] = useState(false);
  const submit = async () => {
    setBusy(true);
    try {
      await openCareServiceRequest(contractId, serviceType, description);
      toast.success('Acionamento aberto. Ele segue para análise técnica.');
      onDone();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Não foi possível abrir o acionamento.');
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="space-y-2 rounded-ios-lg border app-border p-3">
      <label className="block text-xs app-text-muted">Tipo de atendimento
        <input className="ios-input mt-1 w-full" value={serviceType} onChange={(e) => setServiceType(e.target.value)} placeholder="Ex.: diagnóstico, troca de tela, bateria" />
      </label>
      <label className="block text-xs app-text-muted">Relato do cliente
        <textarea className="ios-input mt-1 w-full min-h-[80px]" value={description} onChange={(e) => setDescription(e.target.value)} />
      </label>
      <p className="text-xs app-text-muted">Abrir não significa cobertura: a aprovação é feita por um administrador após a análise técnica.</p>
      <div className="flex justify-end gap-2">
        <IOSButton variant="ghost" type="button" onClick={onCancel}>Cancelar</IOSButton>
        <IOSButton variant="primary" type="button" loading={busy} disabled={!serviceType.trim()} onClick={submit}>Abrir acionamento</IOSButton>
      </div>
    </div>
  );
};

const ContractServiceSection: React.FC<{ contract: CareContract; requests: CareServiceRequest[]; onChanged: () => void }> = ({ contract, requests, onChanged }) => {
  const [opening, setOpening] = useState(false);
  const canOpen = contract.status === 'ativo';
  return (
    <Section
      title="Acionamentos"
      action={canOpen && !opening ? (
        <IOSButton variant="secondary" type="button" onClick={() => setOpening(true)}>
          <span className="inline-flex items-center gap-2"><Wrench size={16} /> Novo acionamento</span>
        </IOSButton>
      ) : undefined}
    >
      {!canOpen && <p className="text-xs app-text-muted">Acionamentos ficam disponíveis com o contrato ativo.</p>}
      {opening && <OpenRequestForm contractId={contract.id} onCancel={() => setOpening(false)} onDone={() => { setOpening(false); onChanged(); }} />}
      {requests.length === 0 ? (
        <p className="text-sm app-text-muted">Nenhum acionamento.</p>
      ) : (
        <ul className="space-y-2">
          {requests.map((r) => (
            <li key={r.id} className="flex flex-wrap items-center justify-between gap-2 rounded-ios-lg app-surface-soft px-3 py-2 text-sm">
              <span className="app-text-primary">#{r.request_number} · {r.service_type}</span>
              <span className="app-text-muted">{formatDateTimeBRL(r.opened_at)} · franquia {formatCurrencyBRL(r.deductible_amount)}</span>
              <CareStatusBadge {...CARE_SERVICE_STATUS[r.status]} />
            </li>
          ))}
        </ul>
      )}
    </Section>
  );
};

export default ContractServiceSection;
