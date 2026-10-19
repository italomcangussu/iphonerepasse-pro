import React, { useState } from 'react';
import { XCircle } from 'lucide-react';
import Modal from '../../../components/ui/Modal';
import IOSButton from '../../../components/ui/IOSButton';
import ConfirmDialog from '../../../components/ui/ConfirmDialog';
import CareStatusBadge from '../../../components/care/CareStatusBadge';
import { useToast } from '../../../components/ui/ToastProvider';
import { cancelCareContract, fetchCareDossier } from '../../../services/careApi';
import { CARE_CONTRACT_STATUS } from '../../../lib/care/careLabels';
import type { CareContract, CareDossier } from '../../../lib/care/careTypes';
import { useCareQuery } from '../useCareQuery';
import { CareLoadError, CareLoading } from '../CareStates';
import SummarySection from './SummarySection';
import InstallmentsSection from './InstallmentsSection';
import BenefitsSection from './BenefitsSection';
import SignatureSection from './SignatureSection';
import AuditTrailSection from './AuditTrailSection';
import ContractServiceSection from './ContractServiceSection';
import SuspensionSection from './SuspensionSection';

const SELLER_CANCELLABLE = ['rascunho', 'aguardando_assinatura'];

const CancelContract: React.FC<{ contract: CareContract; isAdmin: boolean; onDone: () => void }> = ({ contract, isAdmin, onDone }) => {
  const toast = useToast();
  const [reason, setReason] = useState('');
  const [confirming, setConfirming] = useState(false);
  if (['cancelado', 'encerrado'].includes(contract.status)) return null;
  if (!isAdmin && !SELLER_CANCELLABLE.includes(contract.status)) return null;

  const cancel = async () => {
    setConfirming(false);
    try {
      await cancelCareContract(contract.id, reason);
      toast.success(`Contrato nº ${contract.contract_number} cancelado.`);
      onDone();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Não foi possível cancelar.');
    }
  };

  return (
    <section className="space-y-2 border-t app-border pt-4">
      <label htmlFor="care-cancel-reason" className="block text-sm font-semibold app-text-primary">Cancelar contrato</label>
      <div className="flex flex-col gap-2 sm:flex-row">
        <input id="care-cancel-reason" className="ios-input flex-1" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Motivo (obrigatório)" />
        <IOSButton variant="destructive" type="button" disabled={!reason.trim()} onClick={() => setConfirming(true)}>
          <span className="inline-flex items-center gap-2"><XCircle size={16} /> Cancelar contrato</span>
        </IOSButton>
      </div>
      <p className="text-xs app-text-muted">Parcelas futuras e bônus não entregues são cancelados; o histórico e as provas ficam guardados.</p>
      <ConfirmDialog
        open={confirming}
        onClose={() => setConfirming(false)}
        onConfirm={cancel}
        variant="danger"
        title={`Cancelar o contrato nº ${contract.contract_number}?`}
        description="Não dá para desfazer. Para voltar a proteger o aparelho será preciso gerar e assinar um novo contrato."
        confirmLabel="Cancelar contrato"
        cancelLabel="Manter"
      />
    </section>
  );
};

interface ContractDetailModalProps {
  contractId: string;
  isAdmin: boolean;
  onClose: () => void;
  onChanged: () => void;
}

const DossierBody: React.FC<{ dossier: CareDossier; contract: CareContract; isAdmin: boolean; refresh: () => void }> = ({ dossier, contract, isAdmin, refresh }) => {
  const status = CARE_CONTRACT_STATUS[contract.status];
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-2">
        <CareStatusBadge tone={status.tone} label={status.label} />
        <p className="text-sm app-text-muted">{status.hint}</p>
      </div>
      <SummarySection contract={contract} />
      <SuspensionSection contract={contract} installments={dossier.installments} inspections={dossier.inspections} onChanged={refresh} />
      <InstallmentsSection contract={contract} installments={dossier.installments} onChanged={refresh} />
      <BenefitsSection benefits={dossier.benefits} onChanged={refresh} />
      <SignatureSection contract={contract} documents={dossier.documents} sessions={dossier.sessions} isAdmin={isAdmin} onChanged={refresh} />
      <ContractServiceSection contract={contract} requests={dossier.serviceRequests} onChanged={refresh} />
      {isAdmin && dossier.events && <AuditTrailSection events={dossier.events} />}
      <CancelContract contract={contract} isAdmin={isAdmin} onDone={refresh} />
    </div>
  );
};

const ContractDetailModal: React.FC<ContractDetailModalProps> = ({ contractId, isAdmin, onClose, onChanged }) => {
  const [version, setVersion] = useState(0);
  const query = useCareQuery(() => fetchCareDossier(contractId), [contractId, version]);
  const refresh = () => {
    setVersion((v) => v + 1);
    onChanged();
  };
  const contract = query.data?.contract ?? null;

  return (
    <Modal open onClose={onClose} size="xl" title={contract ? `Contrato Repasse Care+ nº ${contract.contract_number}` : 'Contrato Repasse Care+'}>
      {query.loading && !query.data && <CareLoading rows={5} />}
      {query.error && <CareLoadError message={query.error} onRetry={query.reload} />}
      {query.data && contract && <DossierBody dossier={query.data} contract={contract} isAdmin={isAdmin} refresh={refresh} />}
    </Modal>
  );
};

export default ContractDetailModal;
