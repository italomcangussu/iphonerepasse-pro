import React, { useState } from 'react';
import { Plus } from 'lucide-react';
import IOSButton from '../../../components/ui/IOSButton';
import { useToast } from '../../../components/ui/ToastProvider';
import { saveCareBenefit } from '../../../services/careApi';
import type { CareBenefit } from '../../../lib/care/careTypes';
import { formatCurrencyBRL } from '../../../utils/inputMasks';
import { DecimalField, fromField, TextField, toField } from '../CareFields';

const KINDS: Array<{ value: CareBenefit['kind']; label: string }> = [
  { value: 'produto', label: 'Produto' },
  { value: 'kit', label: 'Kit' },
  { value: 'servico', label: 'Serviço' },
  { value: 'beneficio', label: 'Benefício' },
];

type Draft = { id?: string; name: string; kind: CareBenefit['kind']; description: string; cost: string; active: boolean };

const toDraft = (b?: CareBenefit): Draft => ({
  id: b?.id, name: b?.name ?? '', kind: b?.kind ?? 'produto', description: b?.description ?? '', cost: toField(b?.reference_cost), active: b?.active ?? true,
});

const BenefitEditor: React.FC<{ initial: Draft; onDone: () => void; onCancel: () => void }> = ({ initial, onDone, onCancel }) => {
  const toast = useToast();
  const [draft, setDraft] = useState(initial);
  const [busy, setBusy] = useState(false);
  const save = async () => {
    setBusy(true);
    try {
      await saveCareBenefit({ id: draft.id, name: draft.name.trim(), kind: draft.kind, description: draft.description.trim() || null, reference_cost: fromField(draft.cost), active: draft.active });
      toast.success(`${draft.name} salvo no catálogo.`);
      onDone();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Não foi possível salvar.');
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="ios-card space-y-3 p-4">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <TextField label="Nome" value={draft.name} onChange={(name) => setDraft({ ...draft, name })} placeholder="Ex.: Kit capa + película premium" />
        <div className="space-y-1">
          <label htmlFor="care-benefit-kind" className="block text-xs font-semibold app-text-secondary">Tipo</label>
          <select id="care-benefit-kind" className="ios-input w-full" value={draft.kind} onChange={(e) => setDraft({ ...draft, kind: e.target.value as CareBenefit['kind'] })}>
            {KINDS.map((k) => <option key={k.value} value={k.value}>{k.label}</option>)}
          </select>
        </div>
        <TextField label="Descrição exibida na proposta" value={draft.description} onChange={(description) => setDraft({ ...draft, description })} />
        <DecimalField label="Custo de referência (gerencial)" prefix="R$" value={draft.cost} onChange={(cost) => setDraft({ ...draft, cost })} hint="Não entra no preço cobrado do cliente." />
      </div>
      <label className="flex min-h-[44px] items-center gap-3 text-sm app-text-primary">
        <input type="checkbox" className="h-5 w-5 accent-brand-500" checked={draft.active} onChange={(e) => setDraft({ ...draft, active: e.target.checked })} />
        Disponível para novas regras
      </label>
      <div className="flex justify-end gap-2">
        <IOSButton variant="ghost" type="button" onClick={onCancel}>Cancelar</IOSButton>
        <IOSButton variant="primary" type="button" loading={busy} disabled={!draft.name.trim()} onClick={save}>Salvar item</IOSButton>
      </div>
    </div>
  );
};

const BenefitCatalogSection: React.FC<{ benefits: CareBenefit[]; onSaved: () => void }> = ({ benefits, onSaved }) => {
  const [editing, setEditing] = useState<Draft | null>(null);
  const done = () => {
    setEditing(null);
    onSaved();
  };
  return (
    <section className="space-y-3">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h3 className="text-base font-bold app-text-primary">Catálogo de bônus</h3>
          <p className="text-sm app-text-muted">Itens que podem acompanhar a 1ª parcela. Cada regra escolhe os seus.</p>
        </div>
        {!editing && (
          <IOSButton variant="secondary" type="button" onClick={() => setEditing(toDraft())}>
            <span className="inline-flex items-center gap-2"><Plus size={16} /> Novo item</span>
          </IOSButton>
        )}
      </div>
      {editing && <BenefitEditor initial={editing} onCancel={() => setEditing(null)} onDone={done} />}
      {benefits.length > 0 && (
        <ul className="ios-card overflow-hidden divide-y divide-gray-100 dark:divide-surface-dark-200">
          {benefits.map((b) => (
            <li key={b.id}>
              <button type="button" onClick={() => setEditing(toDraft(b))} className="flex w-full min-h-[52px] items-center gap-3 px-4 py-2 text-left app-surface-soft-hover">
                <span className="flex-1 text-sm app-text-primary">{b.name}{!b.active && <span className="app-text-muted"> · inativo</span>}</span>
                <span className="text-xs app-text-muted">{KINDS.find((k) => k.value === b.kind)?.label} · {formatCurrencyBRL(b.reference_cost)}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
};

export default BenefitCatalogSection;
