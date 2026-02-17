import React, { useEffect, useMemo, useState } from 'react';
import { CreditCard, RotateCcw, Save } from 'lucide-react';
import { useData } from '../services/dataContext';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../components/ui/ToastProvider';
import { DEFAULT_CARD_FEE_SETTINGS } from '../utils/cardFees';

type FeeTab = 'visa_master' | 'outras';

const CardFeesSettings: React.FC = () => {
  const { cardFeeSettings, updateCardFeeSettings } = useData();
  const { role } = useAuth();
  const toast = useToast();
  const isAdmin = role === 'admin';

  const [activeTab, setActiveTab] = useState<FeeTab>('visa_master');
  const [visaMasterRates, setVisaMasterRates] = useState<number[]>(cardFeeSettings.visaMasterRates);
  const [otherRates, setOtherRates] = useState<number[]>(cardFeeSettings.otherRates);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    setVisaMasterRates(cardFeeSettings.visaMasterRates);
    setOtherRates(cardFeeSettings.otherRates);
  }, [cardFeeSettings]);

  const activeRates = useMemo(
    () => (activeTab === 'visa_master' ? visaMasterRates : otherRates),
    [activeTab, visaMasterRates, otherRates]
  );

  const updateRate = (index: number, nextValue: string) => {
    const parsed = Number(nextValue.replace(',', '.'));
    const safeValue = Number.isFinite(parsed) ? parsed : 0;

    if (activeTab === 'visa_master') {
      setVisaMasterRates((prev) => prev.map((rate, rateIndex) => (rateIndex === index ? safeValue : rate)));
      return;
    }
    setOtherRates((prev) => prev.map((rate, rateIndex) => (rateIndex === index ? safeValue : rate)));
  };

  const validateRates = (rates: number[]) => rates.length === 18 && rates.every((rate) => Number.isFinite(rate) && rate >= 0 && rate < 100);

  const handleSave = async () => {
    if (!validateRates(visaMasterRates) || !validateRates(otherRates)) {
      toast.error('Revise as taxas: cada parcela deve ter valor entre 0 e 99,99.');
      return;
    }

    setIsSaving(true);
    try {
      await updateCardFeeSettings({
        visaMasterRates: visaMasterRates.map((rate) => Number(rate.toFixed(2))),
        otherRates: otherRates.map((rate) => Number(rate.toFixed(2)))
      });
      toast.success('Taxas atualizadas com sucesso.');
    } catch (error: any) {
      toast.error(error?.message || 'Não foi possível atualizar as taxas.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleReset = () => {
    setVisaMasterRates(DEFAULT_CARD_FEE_SETTINGS.visaMasterRates);
    setOtherRates(DEFAULT_CARD_FEE_SETTINGS.otherRates);
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
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => setActiveTab('visa_master')}
            className={`ios-button-secondary ${activeTab === 'visa_master' ? 'border-green-500 text-green-600' : ''}`}
          >
            Visa / Master
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('outras')}
            className={`ios-button-secondary ${activeTab === 'outras' ? 'border-orange-500 text-orange-600' : ''}`}
          >
            Outras (Elo / Hiper / Amex)
          </button>
        </div>

        <div className="overflow-x-auto rounded-ios-lg border border-gray-200 dark:border-surface-dark-300">
          <table className="w-full min-w-[520px]">
            <thead className="bg-gray-50 dark:bg-surface-dark-200">
              <tr>
                <th className="text-left p-3 text-gray-500">Parcela</th>
                <th className="text-left p-3 text-gray-500">Taxa (%)</th>
                <th className="text-left p-3 text-gray-500">Preview</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-surface-dark-300">
              {activeRates.map((rate, index) => (
                <tr key={`${activeTab}-${index}`}>
                  <td className="p-3 font-semibold text-brand-500">{index + 1}x</td>
                  <td className="p-3">
                    <input
                      type="number"
                      min={0}
                      max={99.99}
                      step={0.01}
                      className="ios-input"
                      value={rate}
                      disabled={!isAdmin}
                      onChange={(e) => updateRate(index, e.target.value)}
                    />
                  </td>
                  <td className="p-3 text-gray-600 dark:text-surface-dark-600">
                    <span className="inline-flex items-center gap-2 text-sm">
                      <CreditCard size={14} />
                      Acréscimo de {Number(rate || 0).toFixed(2)}%
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {isAdmin && (
          <div className="flex items-center justify-end gap-3">
            <button type="button" className="ios-button-secondary flex items-center gap-2" onClick={handleReset}>
              <RotateCcw size={16} />
              Restaurar padrão
            </button>
            <button type="button" className="ios-button-primary flex items-center gap-2" onClick={handleSave} disabled={isSaving}>
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
