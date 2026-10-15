import React, { useState } from 'react';
import { Download, FileCheck2, FileText, RefreshCw, Send, ShieldQuestion } from 'lucide-react';
import IOSButton from '../../../components/ui/IOSButton';
import Banner from '../../../components/ui/Banner';
import { useToast } from '../../../components/ui/ToastProvider';
import {
  type CareDocumentKind,
  type CareIntegrityReport,
  fetchCareDocumentUrl,
  issueCareContract,
  regenerateCareArtifacts,
  verifyCareIntegrity,
} from '../../../services/careApi';
import type { CareContract, CareDocument, CareSessionSummary } from '../../../lib/care/careTypes';
import { formatDateTimeBRL } from '../../../utils/inputMasks';
import { Section } from './Section';

const SESSION_LABEL: Record<CareSessionSummary['status'], string> = {
  aberta: 'Link enviado, não aceito',
  aceita: 'Aceito, aguardando código',
  assinada: 'Assinada',
  expirada: 'Expirada',
  revogada: 'Substituída',
  bloqueada: 'Bloqueada (tentativas)',
};

interface SignatureSectionProps {
  contract: CareContract;
  documents: CareDocument[];
  sessions: CareSessionSummary[];
  isAdmin: boolean;
  onChanged: () => void;
}

const integrityMessage = (r: CareIntegrityReport): string => {
  const files = [r.files.original, r.files.signed, r.files.evidence].filter(Boolean).length;
  return r.files.ok && r.chain.ok
    ? `${files} arquivo(s) conferem com o SHA-256 registrado e a trilha de ${r.chain.events} evento(s) está íntegra.`
    : `Divergência encontrada${r.chain.ok ? ' nos arquivos' : ` na trilha (evento ${r.chain.brokenAtEventId})`}. Não altere nada e acione o responsável técnico.`;
};

function useSignatureActions(contract: CareContract, onChanged: () => void) {
  const toast = useToast();
  const [busy, setBusy] = useState<string | null>(null);
  const [integrity, setIntegrity] = useState<CareIntegrityReport | null>(null);
  const run = async (key: string, action: () => Promise<void>) => {
    setBusy(key);
    try {
      await action();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Não foi possível concluir.');
    } finally {
      setBusy(null);
    }
  };
  return {
    busy,
    integrity,
    open: (kind: CareDocumentKind) => {
      // Abre a aba no clique (o Safari bloqueia window.open depois de um await) e só então aponta para a URL assinada.
      const tab = window.open('', '_blank');
      if (tab) tab.opener = null;
      return run(kind, async () => {
        try {
          const { url } = await fetchCareDocumentUrl(contract.id, kind);
          if (tab) tab.location.href = url;
          else window.location.assign(url);
        } catch (e) {
          tab?.close();
          throw e;
        }
      });
    },
    verify: () => run('verify', async () => setIntegrity(await verifyCareIntegrity(contract.id))),
    resend: () => run('resend', async () => {
      const result = await issueCareContract(contract.id);
      if (result.sent) toast.success('Novo link de assinatura enviado ao cliente.');
      else toast.error(`Link gerado, mas o WhatsApp falhou: ${result.sendError ?? ''}`);
      onChanged();
    }),
    regenerate: () => run('regenerate', async () => {
      await regenerateCareArtifacts(contract.id);
      toast.success('PDF assinado e dossiê gerados.');
      onChanged();
    }),
  };
}

type ActionKey = 'original' | 'signed' | 'evidence' | 'verify' | 'resend' | 'regenerate';

// Quais ações de documento aparecem para este contrato e papel (dossiê/integridade são do administrador).
export function signatureActions(contract: Pick<CareContract, 'status'>, current: CareDocument | null, isAdmin: boolean): ActionKey[] {
  const signed = current?.status === 'assinado';
  const rules: Array<[ActionKey, boolean]> = [
    ['original', !!current],
    ['signed', signed && !!current?.signed_pdf_sha256],
    ['evidence', isAdmin && signed && !!current?.evidence_sha256],
    ['verify', isAdmin && !!current],
    ['resend', ['rascunho', 'aguardando_assinatura'].includes(contract.status)],
    ['regenerate', isAdmin && signed && !current?.signed_pdf_sha256],
  ];
  return rules.filter(([, visible]) => visible).map(([key]) => key);
}

const ACTION_VIEW: Record<ActionKey, { icon: React.ReactNode; label: (current: CareDocument | null) => string; primary?: boolean }> = {
  original: { icon: <FileText size={16} />, label: (d) => `Ver contrato (v${d?.version})` },
  signed: { icon: <FileCheck2 size={16} />, label: () => 'Ver contrato assinado' },
  evidence: { icon: <Download size={16} />, label: () => 'Baixar dossiê de assinatura' },
  verify: { icon: <ShieldQuestion size={16} />, label: () => 'Verificar integridade' },
  resend: { icon: <Send size={16} />, label: (d) => (d ? 'Reenviar link' : 'Enviar para assinatura'), primary: true },
  regenerate: { icon: <RefreshCw size={16} />, label: () => 'Gerar PDF assinado' },
};

const SessionList: React.FC<{ sessions: CareSessionSummary[] }> = ({ sessions }) => (
  <ul className="space-y-1 text-sm">
    {[...sessions].reverse().map((s) => (
      <li key={s.id} className="flex flex-wrap justify-between gap-2 rounded-ios-lg app-surface-soft px-3 py-2">
        <span className="app-text-primary">{SESSION_LABEL[s.status]}</span>
        <span className="app-text-muted">criada {formatDateTimeBRL(s.createdAt)} · {s.otpSends} código(s) · {s.otpAttempts} tentativa(s)</span>
      </li>
    ))}
  </ul>
);

const SignatureSection: React.FC<SignatureSectionProps> = ({ contract, documents, sessions, isAdmin, onChanged }) => {
  const a = useSignatureActions(contract, onChanged);
  const current = [...documents].reverse().find((d) => d.status !== 'substituido') ?? null;
  const handlers: Record<ActionKey, () => void> = {
    original: () => a.open('original'),
    signed: () => a.open('signed'),
    evidence: () => a.open('evidence'),
    verify: a.verify,
    resend: a.resend,
    regenerate: a.regenerate,
  };
  return (
    <Section title="Assinatura eletrônica">
      <div className="flex flex-wrap gap-2">
        {signatureActions(contract, current, isAdmin).map((key) => (
          <IOSButton key={key} variant={ACTION_VIEW[key].primary ? 'primary' : 'secondary'} type="button" loading={a.busy === key} onClick={handlers[key]}>
            <span className="inline-flex items-center gap-2">{ACTION_VIEW[key].icon} {ACTION_VIEW[key].label(current)}</span>
          </IOSButton>
        ))}
      </div>
      {a.integrity && (
        <Banner kind={a.integrity.files.ok && a.integrity.chain.ok ? 'success' : 'error'} title="Verificação de integridade" message={integrityMessage(a.integrity)} />
      )}
      {current && <p className="break-all font-mono text-xs app-text-muted">SHA-256 do documento: {current.sha256}</p>}
      {sessions.length > 0 && <SessionList sessions={sessions} />}
    </Section>
  );
};

export default SignatureSection;
