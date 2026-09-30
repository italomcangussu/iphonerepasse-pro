import React, { useEffect, useMemo, useState } from 'react';
import { CreditCard, RotateCcw, Save } from 'lucide-react';
import { useData } from '../services/dataContext';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../components/ui/ToastProvider';
import { useAsyncHandler } from '../hooks/useAsyncHandler';
import { DEFAULT_CARD_FEE_SETTINGS } from '../utils/cardFees';
import {
  formatDecimalBRL,
  formatPercentBRL,
  maskDecimalInput,
  parseDecimalBRL,
} from '../utils/inputMasks';

type FeeTab = 'visa_master' | 'outras' | 'debit';

const CardFeesSettings: React.FC = () => {
  const { cardFeeSettings, updateCardFeeSettings } = useData();
  const { role } = useAuth();
  const toast = useToast();
  const run = useAsyncHandler();
  const isAdmin = role === 'admin';

  const [activeTab, setActiveTab] = useState<FeeTab>('visa_master');
  const [visaMasterInputs, setVisaMasterInputs] = useState<string[]>(() =>
    cardFeeSettings.visaMasterRates.map((r) => formatDecimalBRL(r))
  );
  const [otherInputs, setOtherInputs] = useState<string[]>(() =>
    cardFeeSettings.otherRates.map((r) => formatDecimalBRL(r))
  );
  const [debitRateInput, setDebitRateInput] = useState<string>(() =>
    formatDecimalBRL(cardFeeSettings.debitRate)
  );
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    setVisaMasterInputs(cardFeeSettings.visaMasterRates.map((r) => formatDecimalBRL(r)));
    setOtherInputs(cardFeeSettings.otherRates.map((r) => formatDecimalBRL(r)));
    setDebitRateInput(formatDecimalBRL(cardFeeSettings.debitRate));
  }, [cardFeeSettings]);

  const activeRates = useMemo(
    () => (activeTab === 'visa_master' ? visaMasterInputs : otherInputs),
    [activeTab, visaMasterInputs, otherInputs]
  );

  const updateRate = (index: number, nextRawValue: string) => {
    const masked = maskDecimalInput(nextRawValue, { maxDecimals: 2, max: 99.99 });

    if (activeTab === 'visa_master') {
      setVisaMasterInputs((prev) => prev.map((val, idx) => (idx === index ? masked : val)));
      return;
    }
    setOtherInputs((prev) => prev.map((val, idx) => (idx === index ? masked : val)));
  };

  const finalizeRate = (index: number) => {
    if (activeTab === 'visa_master') {
      setVisaMasterInputs((prev) =>
        prev.map((val, idx) => (idx === index ? (val.trim() ? formatDecimalBRL(parseDecimalBRL(val)) : '0,00') : val))
      );
      return;
    }
    setOtherInputs((prev) =>
      prev.map((val, idx) => (idx === index ? (val.trim() ? formatDecimalBRL(parseDecimalBRL(val)) : '0,00') : val))
    );
  };

  const finalizeDebitRate = () => {
    setDebitRateInput((prev) => (prev.trim() ? formatDecimalBRL(parseDecimalBRL(prev)) : '0,00'));
  };

  const validateRates = (rates: number[]) =>
    rates.length === 18 && rates.every((rate) => Number.isFinite(rate) && rate >= 0 && rate < 100);

  const handleSave = async () => {
    const visaMasterRates = visaMasterInputs.map(parseDecimalBRL);
    const otherRates = otherInputs.map(parseDecimalBRL);
    const debitRate = parseDecimalBRL(debitRateInput);

    if (!validateRates(visaMasterRates) || !validateRates(otherRates) || !Number.isFinite(debitRate) || debitRate < 0 || debitRate >= 100) {
      toast.error('Revise as taxas: cada parcela deve ter valor entre 0 e 99,99.');
      return;
    }

    await run(async () => {
      await updateCardFeeSettings({
        visaMasterRates: visaMasterRates.map((rate) => Number(rate.toFixed(2))),
        otherRates: otherRates.map((rate) => Number(rate.toFixed(2))),
        debitRate: Number(debitRate.toFixed(2))
      });
      toast.success('Taxas atualizadas com sucesso.');
    }, { errorMsg: 'Não foi possível atualizar as taxas.', setLoading: setIsSaving });
  };

  const handleReset = () => {
    setVisaMasterInputs(DEFAULT_CARD_FEE_SETTINGS.visaMasterRates.map((r) => formatDecimalBRL(r)));
    setOtherInputs(DEFAULT_CARD_FEE_SETTINGS.otherRates.map((r) => formatDecimalBRL(r)));
    setDebitRateInput(formatDecimalBRL(DEFAULT_CARD_FEE_SETTINGS.debitRate));
  };

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div>
        <h2 className="text-[28px] md:text-ios-large font-bold text-gray-900 dark:text-white tracking-tight">Editar Taxas</h2>
        <p className="text-ios-subhead text-gray-500 dark:text-surface-dark-500 mt-0.5">
          Configure taxas por bandeira e parcelas para o cálculo de cartão com acréscimo.
        </p>
      </div>

      {!isAdmin && (
        <div className="ios-card p-4 border border-amber-200 bg-amber-50 text-amber-700">
          Modo somente leitura: apenas administradores podem alterar as taxas.
        </div>
      )}

      <div className="ios-card p-5 space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2" role="tablist">
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'visa_master'}
            onClick={() => setActiveTab('visa_master')}
            className={`ios-button-secondary min-h-[44px] ${activeTab === 'visa_master' ? 'border-green-500 text-green-600 dark:text-green-400 font-semibold' : ''}`}
          >
            Visa / Master
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'outras'}
            onClick={() => setActiveTab('outras')}
            className={`ios-button-secondary min-h-[44px] ${activeTab === 'outras' ? 'border-orange-500 text-orange-600 dark:text-orange-400 font-semibold' : ''}`}
          >
            Outras (Elo / Hiper / Amex)
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'debit'}
            onClick={() => setActiveTab('debit')}
            className={`ios-button-secondary min-h-[44px] ${activeTab === 'debit' ? 'border-blue-500 text-blue-600 dark:text-blue-400 font-semibold' : ''}`}
          >
            Cartão Débito
          </button>
        </div>

        {activeTab === 'debit' ? (
          <div className="rounded-ios-lg border border-gray-200 dark:border-surface-dark-300 p-4 space-y-3">
            <div>
              <label htmlFor="card-fee-debit-input" className="ios-label">Taxa do cartão de débito (%)</label>
              <input
                id="card-fee-debit-input"
                type="text"
                inputMode="decimal"
                className="ios-input max-w-xs tabular-nums text-lg font-semibold"
                onFocus={(e) => e.target.select()}
                value={debitRateInput}
                disabled={!isAdmin}
                placeholder="0,00"
                onChange={(e) => {
                  const masked = maskDecimalInput(e.target.value, { maxDecimals: 2, max: 99.99 });
                  setDebitRateInput(masked);
                }}
                onBlur={finalizeDebitRate}
              />
            </div>
            <span className="inline-flex items-center gap-2 text-sm text-gray-600 dark:text-surface-dark-600">
              <CreditCard size={14} />
              Acréscimo de {formatPercentBRL(debitRateInput)}
            </span>
          </div>
        ) : (
          <div className="overflow-x-auto rounded-ios-lg border border-gray-200 dark:border-surface-dark-300">
            <table className="w-full min-w-[520px]">
              <thead className="bg-gray-50 dark:bg-surface-dark-200">
                <tr>
                  <th className="text-left p-3 text-gray-500 font-medium">Parcela</th>
                  <th className="text-left p-3 text-gray-500 font-medium">Taxa (%)</th>
                  <th className="text-left p-3 text-gray-500 font-medium">Preview</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-surface-dark-300">
                {activeRates.map((rate, index) => (
                  <tr key={`${activeTab}-${index}`}>
                    <td className="p-3 font-semibold text-brand-500">{index + 1}x</td>
                    <td className="p-3">
                      <input
                        type="text"
                        inputMode="decimal"
                        className="ios-input w-28 tabular-nums font-semibold"
                        aria-label={`Taxa ${index + 1}x (%)`}
                        onFocus={(e) => e.target.select()}
                        value={rate}
                        disabled={!isAdmin}
                        placeholder="0,00"
                        onChange={(e) => updateRate(index, e.target.value)}
                        onBlur={() => finalizeRate(index)}
                      />
                    </td>
                    <td className="p-3 text-gray-600 dark:text-surface-dark-600">
                      <span className="inline-flex items-center gap-2 text-sm">
                        <CreditCard size={14} />
                        Acréscimo de {formatPercentBRL(rate)}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {isAdmin && (
          <div className="flex items-center justify-end gap-3 pt-2">
            <button type="button" className="ios-button-secondary flex items-center gap-2 min-h-[44px]" onClick={handleReset}>
              <RotateCcw size={16} />
              Restaurar padrão
            </button>
            <button type="button" className="ios-button-primary flex items-center gap-2 min-h-[44px]" onClick={handleSave} disabled={isSaving}>
              <Save size={16} />
              {isSaving ? 'Salvando...' : 'Salvar taxas'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default CardFeesSettings;
