import React, { useState } from 'react';
import IOSButton from '../../../components/ui/IOSButton';
import Banner from '../../../components/ui/Banner';
import CareQuoteSummary, { CarePendencies } from '../../../components/care/CareQuoteSummary';
import { listModelRules, simulateCare } from '../../../services/careApi';
import { conditionLabel } from '../../../lib/care/careLabels';
import type { CareCondition, CareQuote } from '../../../lib/care/careTypes';
import { useCareQuery } from '../useCareQuery';
import { DecimalField, fromField } from '../CareFields';

// Simulador comercial: calcula a proposta para um preço hipotético sem gravar nada.
const CareSimulatorTab: React.FC = () => {
  const rules = useCareQuery(listModelRules, []);
  const [model, setModel] = useState('');
  const [condition, setCondition] = useState<CareCondition>('SEMINOVO');
  const [price, setPrice] = useState('');
  const [quote, setQuote] = useState<CareQuote | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const models = Array.from(new Set((rules.data ?? []).map((r) => r.model))).sort();
  const salePrice = fromField(price);

  const simulate = async () => {
    setBusy(true);
    setError(null);
    try {
      setQuote(await simulateCare(model, condition, salePrice ?? 0));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Não foi possível simular.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
      <div className="ios-card space-y-3 p-4">
        <div className="space-y-1">
          <label htmlFor="care-sim-model" className="block text-xs font-semibold app-text-secondary">Modelo</label>
          <select id="care-sim-model" className="ios-input w-full" value={model} onChange={(e) => setModel(e.target.value)}>
            <option value="">Escolha um modelo configurado</option>
            {models.map((m) => <option key={m} value={m}>{m}</option>)}
          </select>
        </div>
        <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label="Condição">
          {(['NOVO', 'SEMINOVO'] as const).map((c) => (
            <button key={c} type="button" role="radio" aria-checked={condition === c} onClick={() => setCondition(c)}
              className={`min-h-[44px] rounded-ios-lg text-sm font-semibold ${condition === c ? 'bg-brand-500 text-white' : 'app-surface-soft app-text-secondary'}`}>
              {conditionLabel(c)}
            </button>
          ))}
        </div>
        <DecimalField label="Preço efetivo de venda" prefix="R$" value={price} onChange={setPrice} hint="O preço que o cliente pagaria no aparelho." />
        <IOSButton variant="primary" type="button" className="w-full" loading={busy} disabled={!model || !salePrice} onClick={simulate}>Simular</IOSButton>
        <p className="text-xs app-text-muted">Simulação: nada é gravado e não vale como proposta ao cliente.</p>
      </div>
      <div className="space-y-3">
        {error && <Banner kind="error" message={error} />}
        {quote && !quote.ok && <CarePendencies items={quote.pendencias} />}
        {quote?.ok && <CareQuoteSummary quote={quote} />}
        {!quote && !error && <p className="text-sm app-text-muted">Escolha modelo, condição e preço para ver 1ª parcela, parcelas seguintes, total e franquia.</p>}
      </div>
    </div>
  );
};

export default CareSimulatorTab;
