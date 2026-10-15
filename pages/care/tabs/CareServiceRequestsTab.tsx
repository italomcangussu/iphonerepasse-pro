import React, { useMemo, useState } from 'react';
import IOSButton from '../../../components/ui/IOSButton';
import CareStatusBadge from '../../../components/care/CareStatusBadge';
import { useToast } from '../../../components/ui/ToastProvider';
import { type CareServiceRequestRow, listCareServiceRequests, updateCareServiceRequest } from '../../../services/careApi';
import { CARE_SERVICE_NEXT, CARE_SERVICE_STATUS, conditionLabel } from '../../../lib/care/careLabels';
import type { CareServiceRequestStatus } from '../../../lib/care/careTypes';
import { formatCurrencyBRL, formatDateTimeBRL, maskDecimalInput, parseDecimalBRL } from '../../../utils/inputMasks';
import { useCareQuery } from '../useCareQuery';
import { CareEmpty, CareLoadError, CareLoading } from '../CareStates';

const ADMIN_ONLY: CareServiceRequestStatus[] = ['aprovado', 'reprovado'];
const OPEN: CareServiceRequestStatus[] = ['solicitado', 'em_analise', 'aprovado', 'em_execucao'];

const ACTION_LABEL: Partial<Record<CareServiceRequestStatus, string>> = {
  em_analise: 'Iniciar análise',
  aprovado: 'Aprovar',
  reprovado: 'Reprovar',
  em_execucao: 'Iniciar execução',
  concluido: 'Concluir',
  cancelado: 'Cancelar',
};

const RequestActions: React.FC<{ request: CareServiceRequestRow; isAdmin: boolean; onChanged: () => void }> = ({ request, isAdmin, onChanged }) => {
  const toast = useToast();
  const [notes, setNotes] = useState('');
  const [cost, setCost] = useState('');
  const [busy, setBusy] = useState<CareServiceRequestStatus | null>(null);
  const next = CARE_SERVICE_NEXT[request.status].filter((s) => isAdmin || !ADMIN_ONLY.includes(s));
  if (next.length === 0) return null;

  const move = async (status: CareServiceRequestStatus) => {
    setBusy(status);
    try {
      await updateCareServiceRequest({
        requestId: request.id,
        status,
        notes,
        actualCost: status === 'concluido' && cost ? parseDecimalBRL(cost) : null,
        deductiblePaid: status === 'concluido' ? true : null,
      });
      toast.success(`Acionamento #${request.request_number}: ${CARE_SERVICE_STATUS[status].label.toLowerCase()}.`);
      onChanged();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Não foi possível atualizar.');
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="space-y-2 border-t app-border pt-3">
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        <input className="ios-input" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Parecer técnico / observação" aria-label="Parecer" />
        {next.includes('concluido') && (
          <input className="ios-input" inputMode="decimal" value={cost} onChange={(e) => setCost(maskDecimalInput(e.target.value, 2))} placeholder="Custo real do reparo (R$)" aria-label="Custo real" />
        )}
      </div>
      {next.includes('concluido') && <p className="text-xs app-text-muted">Concluir registra a franquia de {formatCurrencyBRL(request.deductible_amount)} como recebida.</p>}
      <div className="flex flex-wrap justify-end gap-2">
        {next.map((status) => (
          <IOSButton
            key={status}
            type="button"
            variant={status === 'reprovado' || status === 'cancelado' ? 'ghost' : status === 'aprovado' || status === 'concluido' ? 'primary' : 'secondary'}
            loading={busy === status}
            onClick={() => move(status)}
          >
            {ACTION_LABEL[status]}
          </IOSButton>
        ))}
      </div>
    </div>
  );
};

const CareServiceRequestsTab: React.FC<{ isAdmin: boolean; onOpenContract: (id: string) => void }> = ({ isAdmin, onOpenContract }) => {
  const [version, setVersion] = useState(0);
  const [onlyOpen, setOnlyOpen] = useState(true);
  const query = useCareQuery(listCareServiceRequests, [version]);
  const visible = useMemo(() => (query.data ?? []).filter((r) => !onlyOpen || OPEN.includes(r.status)), [query.data, onlyOpen]);

  return (
    <div className="space-y-4">
      <label className="inline-flex min-h-[44px] items-center gap-2 text-sm app-text-secondary">
        <input type="checkbox" className="h-5 w-5 accent-brand-500" checked={onlyOpen} onChange={(e) => setOnlyOpen(e.target.checked)} />
        Só os abertos
      </label>
      {query.loading && !query.data && <CareLoading />}
      {query.error && <CareLoadError message={query.error} onRetry={query.reload} />}
      {query.data && visible.length === 0 && (
        <CareEmpty title="Nenhum acionamento" message="Acionamentos são abertos no detalhe de um contrato ativo." />
      )}
      <ul className="space-y-3">
        {visible.map((r) => (
          <li key={r.id} className="ios-card p-4 space-y-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-sm font-semibold app-text-primary">#{r.request_number} · {r.service_type}</p>
              <CareStatusBadge {...CARE_SERVICE_STATUS[r.status]} />
            </div>
            {r.contract && (
              <button type="button" className="min-h-[44px] text-left text-sm text-brand-600 dark:text-brand-400" onClick={() => onOpenContract(r.contract_id)}>
                Contrato nº {r.contract.contract_number} · {r.contract.customer_name} · {r.contract.device_model} {conditionLabel(r.contract.condition)}
              </button>
            )}
            {r.description && <p className="text-sm app-text-secondary">{r.description}</p>}
            <p className="text-xs app-text-muted">
              Aberto {formatDateTimeBRL(r.opened_at)} · franquia {formatCurrencyBRL(r.deductible_amount)}
              {r.decision_notes ? ` · ${r.decision_notes}` : ''}
            </p>
            <RequestActions request={r} isAdmin={isAdmin} onChanged={() => setVersion((v) => v + 1)} />
          </li>
        ))}
      </ul>
    </div>
  );
};

export default CareServiceRequestsTab;
