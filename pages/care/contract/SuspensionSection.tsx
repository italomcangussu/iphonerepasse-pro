import React, { useState } from 'react';
import { ClipboardCheck } from 'lucide-react';
import IOSButton from '../../../components/ui/IOSButton';
import Banner from '../../../components/ui/Banner';
import CareStatusBadge from '../../../components/care/CareStatusBadge';
import { useToast } from '../../../components/ui/ToastProvider';
import { reactivateCareAfterInspection } from '../../../services/careApi';
import type { CareContract, CareInspection, CareInstallment } from '../../../lib/care/careTypes';
import { formatDateTimeBRL } from '../../../utils/inputMasks';
import { Section } from './Section';

const today = () => new Date().toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' });

// Reativar exige todas as parcelas vencidas pagas (o banco confere de novo).
export const hasOverdueInstallments = (installments: CareInstallment[], now = today()): boolean =>
  installments.some((i) => i.status === 'programada' && !!i.due_date && i.due_date < now);

const InspectionForm: React.FC<{ contractId: string; onDone: () => void }> = ({ contractId, onDone }) => {
  const toast = useToast();
  const [findings, setFindings] = useState('');
  const [busy, setBusy] = useState(false);
  const submit = async () => {
    setBusy(true);
    try {
      await reactivateCareAfterInspection(contractId, findings.trim());
      toast.success(findings.trim() ? 'Contrato reativado; avarias registradas e excluídas.' : 'Contrato reativado após vistoria sem avarias.');
      onDone();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Não foi possível reativar.');
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="space-y-2 rounded-ios-lg border app-border p-3">
      <label htmlFor="care-inspection" className="block text-sm font-semibold app-text-primary">Vistoria do aparelho</label>
      <textarea
        id="care-inspection"
        className="ios-input w-full min-h-[84px]"
        value={findings}
        onChange={(e) => setFindings(e.target.value)}
        placeholder="Avarias encontradas (ex.: trinca no canto superior da tela). Deixe vazio se o aparelho estiver sem avarias."
        aria-describedby="care-inspection-help"
      />
      <p id="care-inspection-help" className="text-xs app-text-muted">Avarias registradas aqui ficam excluídas do contrato (Cláusula 12.3).</p>
      <div className="flex justify-end">
        <IOSButton variant="primary" type="button" loading={busy} onClick={submit}>
          <span className="inline-flex items-center gap-2"><ClipboardCheck size={16} /> Registrar vistoria e reativar</span>
        </IOSButton>
      </div>
    </div>
  );
};

const InspectionHistory: React.FC<{ inspections: CareInspection[] }> = ({ inspections }) => (
  <ul className="space-y-2">
    {inspections.map((i) => (
      <li key={i.id} className="rounded-ios-lg app-surface-soft px-3 py-2 text-sm">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="app-text-primary">Vistoria em {formatDateTimeBRL(i.inspected_at)}</span>
          <CareStatusBadge tone={i.result === 'sem_avarias' ? 'success' : 'warning'} label={i.result === 'sem_avarias' ? 'Sem avarias' : 'Avarias excluídas'} />
        </div>
        {i.findings && <p className="mt-1 app-text-secondary">{i.findings}</p>}
      </li>
    ))}
  </ul>
);

interface SuspensionSectionProps {
  contract: CareContract;
  installments: CareInstallment[];
  inspections: CareInspection[];
  onChanged: () => void;
}

const SuspensionSection: React.FC<SuspensionSectionProps> = ({ contract, installments, inspections, onChanged }) => {
  const suspended = contract.status === 'suspenso';
  if (!suspended && inspections.length === 0) return null;
  const overdue = hasOverdueInstallments(installments);
  return (
    <Section title="Suspensão e vistorias">
      {suspended && (
        <Banner
          kind="warning"
          title={`Suspenso por atraso desde ${formatDateTimeBRL(contract.suspended_at)}`}
          message={overdue
            ? 'Receba as parcelas em atraso na seção Parcelas; depois registre a vistoria do aparelho para reativar.'
            : 'Atraso quitado. Faça a vistoria do aparelho e registre abaixo para reativar. Danos do período suspenso não são contemplados.'}
        />
      )}
      {suspended && !overdue && <InspectionForm contractId={contract.id} onDone={onChanged} />}
      {inspections.length > 0 && <InspectionHistory inspections={inspections} />}
    </Section>
  );
};

export default SuspensionSection;
