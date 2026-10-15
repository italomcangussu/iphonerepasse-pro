import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Check, Copy, RefreshCw, Send, ShieldCheck } from 'lucide-react';
import Modal from '../ui/Modal';
import IOSButton from '../ui/IOSButton';
import Banner from '../ui/Banner';
import CareLogo from './CareLogo';
import CareQuoteSummary, { CarePendencies } from './CareQuoteSummary';
import CareStatusBadge from './CareStatusBadge';
import { useCareContractFlow, type CareContractFlow } from './useCareContractFlow';
import { CARE_CONTRACT_STATUS, conditionLabel, careConditionFromStock } from '../../lib/care/careLabels';
import type { CareIssueResult } from '../../lib/care/careTypes';
import type { Sale, StockItem } from '../../types';
import { formatPhone } from '../../utils/inputMasks';

interface CareContractModalProps {
  open: boolean;
  onClose: () => void;
  sale: Pick<Sale, 'id' | 'items'> & { saleNumber?: number };
}

const deviceLabel = (item: StockItem): string => [item.model, item.capacity, item.color].filter(Boolean).join(' · ');

const DevicePicker: React.FC<{ items: StockItem[]; selected: string | null; onSelect: (id: string) => void }> = ({ items, selected, onSelect }) => (
  <fieldset className="space-y-2">
    <legend className="text-sm font-semibold app-text-primary mb-2">Qual aparelho recebe o Repasse Care+?</legend>
    {items.map((item) => (
      <label
        key={item.id}
        className={`flex min-h-[44px] cursor-pointer items-center gap-3 rounded-ios-lg border px-4 py-3 transition-colors ${
          selected === item.id ? 'border-brand-500 bg-brand-50/60 dark:bg-brand-500/10' : 'app-border app-surface-soft-hover'
        }`}
      >
        <input type="radio" name="care-device" className="accent-brand-500" checked={selected === item.id} onChange={() => onSelect(item.id)} />
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-semibold app-text-primary truncate">{deviceLabel(item)}</span>
          <span className="block text-xs app-text-muted">
            {conditionLabel(careConditionFromStock(item.condition))}{item.imei ? ` · IMEI ${item.imei}` : ''}
          </span>
        </span>
      </label>
    ))}
  </fieldset>
);

const CopyLinkButton: React.FC<{ link: string }> = ({ link }) => {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2500);
    } catch {
      window.prompt('Copie o link de assinatura:', link);
    }
  };
  return (
    <IOSButton variant="secondary" onClick={copy} type="button">
      <span className="inline-flex items-center gap-2">
        {copied ? <Check size={16} /> : <Copy size={16} />}
        {copied ? 'Link copiado' : 'Copiar link'}
      </span>
    </IOSButton>
  );
};

const IssuedPanel: React.FC<{ issued: CareIssueResult; phone: string | null }> = ({ issued, phone }) => (
  <div className="space-y-4">
    {issued.sent ? (
      <Banner
        kind="success"
        title="Link de assinatura enviado"
        message={`O cliente recebeu o link no WhatsApp${phone ? ` ${formatPhone(phone)}` : ''}. O contrato fica ativo depois da assinatura e da 1ª parcela confirmada.`}
      />
    ) : (
      <Banner
        kind="warning"
        title="Contrato gerado, mas o WhatsApp não enviou"
        message={`${issued.sendError ?? 'Falha no envio.'} Copie o link abaixo e envie ao cliente, ou tente reenviar.`}
      />
    )}
    <div className="rounded-ios-lg app-surface-soft p-3">
      <p className="text-xs app-text-muted">Link de assinatura (documento v{issued.documentVersion})</p>
      <p className="mt-1 break-all font-mono text-xs app-text-secondary">{issued.link}</p>
    </div>
  </div>
);

const LiveContractPanel: React.FC<{ flow: CareContractFlow }> = ({ flow }) => {
  const contract = flow.liveContract!;
  const status = CARE_CONTRACT_STATUS[contract.status];
  return (
    <div className="rounded-ios-lg border app-border p-4 space-y-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm font-semibold app-text-primary">Contrato nº {contract.contract_number}</p>
        <CareStatusBadge tone={status.tone} label={status.label} />
      </div>
      <p className="text-sm app-text-muted">{status.hint}</p>
      <Link to={`/care?contrato=${contract.id}`} className="inline-flex min-h-[44px] items-center text-sm font-semibold text-brand-600 dark:text-brand-400">
        Abrir no Repasse Care+
      </Link>
    </div>
  );
};

const ReadyBody: React.FC<{ flow: CareContractFlow }> = ({ flow }) => {
  const quote = flow.quote;
  const phone = quote?.customer?.phone;
  if (flow.liveContract) return <LiveContractPanel flow={flow} />;
  if (!quote) return null;
  if (!quote.ok) return <CarePendencies items={quote.pendencias} />;
  return (
    <>
      <CareQuoteSummary quote={quote} />
      <p className="text-xs app-text-muted">
        Ao gerar, o sistema congela estes valores num PDF com hash SHA-256 e envia ao WhatsApp
        {phone ? ` ${formatPhone(phone)}` : ''} o link para o cliente ler, aceitar e assinar com um código de 6 dígitos.
      </p>
    </>
  );
};

const FlowBody: React.FC<{ flow: CareContractFlow }> = ({ flow }) => {
  if (flow.step === 'loading' || flow.step === 'idle') {
    return <div aria-busy className="h-48 rounded-ios-lg app-surface-soft animate-pulse" />;
  }
  if (flow.step === 'load-error') {
    return <Banner kind="error" title="Não carregamos a proposta" message={flow.loadError ?? ''} action={{ label: 'Tentar de novo', onClick: flow.reload }} />;
  }
  if (flow.issued) return <IssuedPanel issued={flow.issued} phone={flow.quote?.customer?.phone ?? null} />;
  return (
    <div className="space-y-4">
      {flow.submitError && <Banner kind="error" title="O contrato não foi enviado" message={flow.submitError} />}
      <ReadyBody flow={flow} />
    </div>
  );
};

type FooterAction = 'copy' | 'retry-send' | 'resend' | 'create' | 'close';

// Decide as ações do rodapé a partir do estado do fluxo (uma ação primária por vez).
export function footerActions(flow: Pick<CareContractFlow, 'issued' | 'liveContract' | 'quote'>): FooterAction[] {
  if (flow.issued) return flow.issued.sent ? ['copy', 'close'] : ['copy', 'retry-send'];
  const resendable = flow.liveContract && ['rascunho', 'aguardando_assinatura'].includes(flow.liveContract.status);
  if (resendable) return ['resend'];
  if (!flow.liveContract && flow.quote?.ok) return ['create'];
  return ['close'];
}

const FlowFooter: React.FC<{ flow: CareContractFlow; onClose: () => void }> = ({ flow, onClose }) => {
  const busy = flow.step === 'submitting';
  const render: Record<FooterAction, React.ReactNode> = {
    copy: flow.issued ? <CopyLinkButton key="copy" link={flow.issued.link} /> : null,
    'retry-send': (
      <IOSButton key="retry" variant="secondary" onClick={flow.resend} loading={busy} type="button">
        <span className="inline-flex items-center gap-2"><RefreshCw size={16} /> Reenviar</span>
      </IOSButton>
    ),
    resend: (
      <IOSButton key="resend" variant="primary" onClick={flow.resend} loading={busy} type="button">
        <span className="inline-flex items-center gap-2"><Send size={16} /> Reenviar link de assinatura</span>
      </IOSButton>
    ),
    create: (
      <IOSButton key="create" variant="primary" onClick={flow.submit} loading={busy} type="button">
        <span className="inline-flex items-center gap-2"><ShieldCheck size={16} /> Gerar contrato e enviar para assinatura</span>
      </IOSButton>
    ),
    close: <IOSButton key="close" variant="secondary" onClick={onClose} type="button">Fechar</IOSButton>,
  };
  return <div className="flex flex-wrap justify-end gap-2">{footerActions(flow).map((action) => render[action])}</div>;
};

const CareContractModal: React.FC<CareContractModalProps> = ({ open, onClose, sale }) => {
  const [stockItemId, setStockItemId] = useState<string | null>(sale.items.length === 1 ? sale.items[0].id : null);
  const flow = useCareContractFlow(sale.id, open ? stockItemId : null);

  useEffect(() => {
    if (open) setStockItemId(sale.items.length === 1 ? sale.items[0].id : null);
  }, [open, sale.id, sale.items]);

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="lg"
      title={`Repasse Care+${sale.saleNumber ? ` · venda #${sale.saleNumber}` : ''}`}
      footer={stockItemId ? <FlowFooter flow={flow} onClose={onClose} /> : undefined}
    >
      <div className="space-y-5">
        <div className="flex items-center gap-3">
          <CareLogo className="h-9 w-auto" />
          <p className="text-sm app-text-muted">Assistência técnica continuada do aparelho, com contrato assinado pelo cliente no celular.</p>
        </div>
        {sale.items.length > 1 && <DevicePicker items={sale.items} selected={stockItemId} onSelect={setStockItemId} />}
        {sale.items.length === 0 && <p className="text-sm app-text-muted">Esta venda não tem aparelho para vincular.</p>}
        {stockItemId && <FlowBody flow={flow} />}
      </div>
    </Modal>
  );
};

export default CareContractModal;
