import React, { useEffect, useMemo, useState } from 'react';
import { Copy, MessageCircle } from 'lucide-react';
import Modal from './ui/Modal';
import IOSButton from './ui/IOSButton';
import { useToast } from './ui/ToastProvider';
import {
  CardFeeSettings,
  SimulatorTradeInAdjustment,
  SimulatorTradeInValue,
  StockItem,
} from '../types';
import { DEFAULT_CARD_FEE_SETTINGS } from '../utils/cardFees';
import { formatCurrencyBRL } from '../utils/inputMasks';
import {
  calculateSimulatorQuote,
  formatSimulatorCurrency,
  formatSimulatorMessage,
  type SimulatorCardBrand,
  type SimulatorEntry,
} from '../utils/simulator';

type SimulatorStep = 'dados' | 'parcelas' | 'enviar';
type SimulatorShareTarget = 'crm' | 'whatsapp';
type InstallmentLimit = number | '';

type StockSimulatorModalProps = {
  open: boolean;
  onClose: () => void;
  item: StockItem;
  simulatorTradeInValues?: SimulatorTradeInValue[];
  simulatorTradeInAdjustments?: SimulatorTradeInAdjustment[];
  cardFeeSettings?: CardFeeSettings;
};

const buildStockLabel = (item: StockItem) => [item.model, item.capacity, item.color].filter(Boolean).join(' ');
const parseAmountInput = (value: string) => Number(value.replace(/\./g, '').replace(',', '.')) || 0;
const clampInstallments = (value: number) => Math.min(18, Math.max(1, Math.trunc(Number.isFinite(value) ? value : 1)));
const formatDeduction = (value: number) => (value > 0 ? `-${formatSimulatorCurrency(value)}` : formatSimulatorCurrency(0));

export const StockSimulatorModal: React.FC<StockSimulatorModalProps> = ({
  open,
  onClose,
  item,
  simulatorTradeInValues = [],
  simulatorTradeInAdjustments = [],
  cardFeeSettings = DEFAULT_CARD_FEE_SETTINGS,
}) => {
  const toast = useToast();
  const [activeStep, setActiveStep] = useState<SimulatorStep>('dados');
  const [maxInstallmentsToShare, setMaxInstallmentsToShare] = useState<InstallmentLimit>(18);
  const [tradeInModel, setTradeInModel] = useState('');
  const [tradeInCapacity, setTradeInCapacity] = useState('');
  const [tradeInColor, setTradeInColor] = useState('');
  const [manualTradeInValue, setManualTradeInValue] = useState('');
  const [selectedAdjustmentIds, setSelectedAdjustmentIds] = useState<string[]>([]);
  const [entryAmount, setEntryAmount] = useState('');
  const [entries, setEntries] = useState<SimulatorEntry[]>([]);
  const [cardBrand, setCardBrand] = useState<SimulatorCardBrand>('visa_master');
  const [simulatorShareTarget, setSimulatorShareTarget] = useState<SimulatorShareTarget>('crm');

  useEffect(() => {
    if (!open) return;
    setActiveStep('dados');
    setMaxInstallmentsToShare(18);
    setTradeInModel('');
    setTradeInCapacity('');
    setTradeInColor('');
    setManualTradeInValue('');
    setSelectedAdjustmentIds([]);
    setEntryAmount('');
    setEntries([]);
    setCardBrand('visa_master');
    setSimulatorShareTarget('crm');
  }, [open, item]);

  const modelOptions = useMemo(
    () => Array.from(new Set(simulatorTradeInValues.filter((rule) => rule.isActive !== false).map((rule) => rule.model))).sort(),
    [simulatorTradeInValues],
  );

  const capacityOptions = useMemo(
    () => Array.from(new Set(
      simulatorTradeInValues
        .filter((rule) => rule.isActive !== false && rule.model === tradeInModel)
        .map((rule) => rule.capacity),
    )).sort(),
    [simulatorTradeInValues, tradeInModel],
  );

  const applicableAdjustments = useMemo(
    () => simulatorTradeInAdjustments.filter((rule) => {
      if (rule.isActive === false) return false;
      if (rule.model && rule.model !== tradeInModel) return false;
      if (rule.capacity && rule.capacity !== tradeInCapacity) return false;
      return true;
    }),
    [simulatorTradeInAdjustments, tradeInCapacity, tradeInModel],
  );

  useEffect(() => {
    const baseRule = simulatorTradeInValues.find((rule) => rule.isActive !== false && rule.model === tradeInModel && rule.capacity === tradeInCapacity);
    if (!baseRule) return;
    const adjustmentTotal = applicableAdjustments
      .filter((rule) => selectedAdjustmentIds.includes(rule.id))
      .reduce((sum, rule) => sum + rule.amountDelta, 0);
    setManualTradeInValue(String(Math.max(0, baseRule.baseValue + adjustmentTotal)));
  }, [applicableAdjustments, selectedAdjustmentIds, simulatorTradeInValues, tradeInCapacity, tradeInModel]);

  const simulatorQuote = useMemo(() => calculateSimulatorQuote({
    desiredDevice: {
      label: buildStockLabel(item),
      price: item.sellPrice,
      color: item.color,
    },
    tradeIn: {
      model: tradeInModel,
      capacity: tradeInCapacity,
      color: tradeInColor,
      selectedAdjustmentIds,
      manualReceivedValue: manualTradeInValue.trim() ? parseAmountInput(manualTradeInValue) : null,
    },
    entries,
    cardBrand,
    valueRules: simulatorTradeInValues,
    adjustmentRules: simulatorTradeInAdjustments,
    cardFeeSettings,
  }), [
    cardBrand,
    cardFeeSettings,
    entries,
    item,
    manualTradeInValue,
    selectedAdjustmentIds,
    simulatorTradeInAdjustments,
    simulatorTradeInValues,
    tradeInCapacity,
    tradeInColor,
    tradeInModel,
  ]);

  const effectiveInstallmentLimit = clampInstallments(maxInstallmentsToShare === '' ? 1 : maxInstallmentsToShare);
  const selectedInstallments = simulatorQuote.installments.slice(0, effectiveInstallmentLimit);
  const firstInstallment = selectedInstallments[0] || null;
  const lastInstallment = selectedInstallments[selectedInstallments.length - 1] || null;
  const simulatorMessageText = simulatorQuote.ok
    ? formatSimulatorMessage({ summary: simulatorQuote.summary, installments: selectedInstallments })
    : '';

  const addSimulatorEntry = () => {
    const amount = parseAmountInput(entryAmount);
    if (amount <= 0) return;
    setEntries((current) => [...current, { type: 'Pix', amount }]);
    setEntryAmount('');
  };

  const toggleSimulatorAdjustment = (id: string) => {
    setSelectedAdjustmentIds((current) => (
      current.includes(id) ? current.filter((itemId) => itemId !== id) : [...current, id]
    ));
  };

  const continueFromDados = () => {
    if (!simulatorQuote.ok) {
      toast.error(simulatorQuote.errors[0]?.message || 'Complete a simulação antes de continuar.');
      return;
    }
    setActiveStep('parcelas');
  };

  const shareSimulatorQuote = async () => {
    if (!simulatorQuote.ok || !simulatorMessageText) {
      toast.error('Complete a simulação antes de compartilhar.');
      return;
    }

    if (simulatorShareTarget === 'whatsapp') {
      window.open(`https://wa.me/?text=${encodeURIComponent(simulatorMessageText)}`, '_blank', 'noopener,noreferrer');
      toast.success('WhatsApp aberto com a simulação.');
      return;
    }

    await navigator.clipboard.writeText(simulatorMessageText);
    toast.success('Mensagem copiada para usar no CRM.');
  };

  const footer = (
    <div className="flex flex-wrap justify-between gap-2">
      <div>
        {activeStep !== 'dados' && (
          <IOSButton
            variant="secondary"
            onClick={() => setActiveStep(activeStep === 'enviar' ? 'parcelas' : 'dados')}
          >
            Voltar
          </IOSButton>
        )}
      </div>
      <div className="flex flex-wrap justify-end gap-2">
        <IOSButton variant="secondary" onClick={onClose}>
          Fechar
        </IOSButton>
        {activeStep === 'dados' && (
          <IOSButton variant="primary" onClick={continueFromDados}>
            Continuar
          </IOSButton>
        )}
        {activeStep === 'parcelas' && (
          <IOSButton variant="primary" onClick={() => setActiveStep('enviar')}>
            Continuar
          </IOSButton>
        )}
        {activeStep === 'enviar' && (
          <IOSButton
            variant={simulatorShareTarget === 'whatsapp' ? 'primary' : 'secondary'}
            onClick={() => void shareSimulatorQuote()}
            leftIcon={simulatorShareTarget === 'whatsapp' ? <MessageCircle size={16} /> : <Copy size={16} />}
          >
            {simulatorShareTarget === 'whatsapp' ? 'Abrir WhatsApp' : 'Copiar para CRM'}
          </IOSButton>
        )}
      </div>
    </div>
  );

  return (
    <Modal open={open} onClose={onClose} title="Simulador" size="3xl" footer={footer}>
      <div className="grid gap-6 xl:grid-cols-[170px_minmax(560px,1fr)_minmax(330px,360px)]">
        <nav className="flex gap-2 overflow-x-auto xl:flex-col xl:overflow-visible" aria-label="Etapas do simulador">
          {[
            ['dados', 'Dados'],
            ['parcelas', 'Parcelas'],
            ['enviar', 'Enviar'],
          ].map(([step, label], index) => (
            <button
              key={step}
              type="button"
              aria-current={activeStep === step ? 'step' : undefined}
              onClick={() => {
                if (step === 'parcelas' && !simulatorQuote.ok) return;
                if (step === 'enviar' && !simulatorQuote.ok) return;
                setActiveStep(step as SimulatorStep);
              }}
              className={`min-h-11 min-w-[9rem] shrink-0 rounded-ios-lg border px-4 py-3 text-left text-sm font-bold transition-colors xl:min-w-0 ${
                activeStep === step
                  ? 'border-brand-600 bg-brand-600 text-white'
                  : 'border-gray-200 bg-white text-gray-600 hover:bg-gray-50 dark:border-surface-dark-300 dark:bg-surface-dark-100 dark:text-surface-dark-600'
              }`}
            >
              <span className="mr-2 opacity-70">{index + 1}</span>
              {label}
            </button>
          ))}
        </nav>

        <section className="min-w-0 space-y-5">
          {activeStep === 'dados' && (
            <>
              <fieldset className="min-w-0 space-y-4 rounded-ios-xl border border-gray-200 bg-white p-5 shadow-ios dark:border-surface-dark-300 dark:bg-surface-dark-100" aria-label="Trade-in">
                <legend className="text-base font-bold text-gray-900 dark:text-white">Trade-in</legend>
                <p className="-mt-3 text-sm text-gray-500 dark:text-surface-dark-500">Informe apenas se o cliente vai deixar um aparelho como entrada.</p>
                <div className="grid gap-4 md:grid-cols-2">
                  <label className="block min-w-0 space-y-1.5">
                    <span className="text-xs font-semibold text-gray-500 dark:text-surface-dark-500">Modelo do trade-in</span>
                    <select className="ios-input w-full min-w-0" value={tradeInModel} onChange={(event) => { setTradeInModel(event.target.value); setTradeInCapacity(''); }}>
                      <option value="">Sem trade-in</option>
                      {modelOptions.map((model) => <option key={model} value={model}>{model}</option>)}
                    </select>
                  </label>
                  <label className="block min-w-0 space-y-1.5">
                    <span className="text-xs font-semibold text-gray-500 dark:text-surface-dark-500">Armazenamento</span>
                    <select className="ios-input w-full min-w-0" value={tradeInCapacity} onChange={(event) => setTradeInCapacity(event.target.value)} disabled={!tradeInModel}>
                      <option value="">Selecione</option>
                      {capacityOptions.map((capacity) => <option key={capacity} value={capacity}>{capacity}</option>)}
                    </select>
                  </label>
                  <label className="block min-w-0 space-y-1.5">
                    <span className="text-xs font-semibold text-gray-500 dark:text-surface-dark-500">Cor do trade-in</span>
                    <input className="ios-input w-full min-w-0" value={tradeInColor} onChange={(event) => setTradeInColor(event.target.value)} />
                  </label>
                  <label className="block min-w-0 space-y-1.5">
                    <span className="text-xs font-semibold text-gray-500 dark:text-surface-dark-500">Valor final recebido</span>
                    <input className="ios-input w-full min-w-0" inputMode="decimal" value={manualTradeInValue} onChange={(event) => setManualTradeInValue(event.target.value)} />
                  </label>
                </div>
                {applicableAdjustments.length > 0 && (
                  <div className="space-y-2">
                    <p className="text-xs font-semibold text-gray-500 dark:text-surface-dark-500">Ajustes</p>
                    {applicableAdjustments.map((adjustment) => (
                      <label key={adjustment.id} className="flex items-center gap-2 text-sm text-gray-700 dark:text-surface-dark-700">
                        <input
                          type="checkbox"
                          checked={selectedAdjustmentIds.includes(adjustment.id)}
                          onChange={() => toggleSimulatorAdjustment(adjustment.id)}
                        />
                        {adjustment.label}
                      </label>
                    ))}
                  </div>
                )}
              </fieldset>

              <fieldset className="min-w-0 space-y-4 rounded-ios-xl border border-gray-200 bg-white p-5 shadow-ios dark:border-surface-dark-300 dark:bg-surface-dark-100" aria-label="Pagamento">
                <legend className="text-base font-bold text-gray-900 dark:text-white">Pagamento</legend>
                <p className="-mt-3 text-sm text-gray-500 dark:text-surface-dark-500">Defina entrada fora do cartão, bandeira e canal de saída da simulação.</p>
                <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_auto]">
                  <label className="block min-w-0 space-y-1.5">
                    <span className="text-xs font-semibold text-gray-500 dark:text-surface-dark-500">Valor da entrada</span>
                    <input className="ios-input w-full min-w-0" inputMode="decimal" value={entryAmount} onChange={(event) => setEntryAmount(event.target.value)} />
                  </label>
                  <div className="flex items-end">
                    <IOSButton variant="secondary" onClick={addSimulatorEntry} className="w-full md:w-auto">
                      Adicionar entrada
                    </IOSButton>
                  </div>
                  <label className="block min-w-0 space-y-1.5">
                    <span className="text-xs font-semibold text-gray-500 dark:text-surface-dark-500">Bandeira</span>
                    <select className="ios-input w-full min-w-0" value={cardBrand} onChange={(event) => setCardBrand(event.target.value as SimulatorCardBrand)}>
                      <option value="visa_master">Visa / Master</option>
                      <option value="outras">Outras</option>
                    </select>
                  </label>
                  <label className="block min-w-0 space-y-1.5">
                    <span className="text-xs font-semibold text-gray-500 dark:text-surface-dark-500">Saída</span>
                    <select className="ios-input w-full min-w-0" value={simulatorShareTarget} onChange={(event) => setSimulatorShareTarget(event.target.value as SimulatorShareTarget)}>
                      <option value="crm">Copiar para CRM</option>
                      <option value="whatsapp">Abrir WhatsApp</option>
                    </select>
                  </label>
                </div>

                {entries.map((entry, index) => (
                  <div key={`${entry.type}-${index}`} className="flex items-center justify-between gap-3 rounded-ios-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm dark:border-surface-dark-300 dark:bg-surface-dark-200">
                    <span className="min-w-0 truncate">{entry.type}: {formatSimulatorCurrency(entry.amount)}</span>
                    <button type="button" className="text-gray-500 dark:text-surface-dark-500" onClick={() => setEntries((current) => current.filter((_, entryIndex) => entryIndex !== index))}>
                      Remover
                    </button>
                  </div>
                ))}
              </fieldset>
            </>
          )}

          {activeStep === 'parcelas' && (
            <div className="space-y-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-surface-dark-500">Saldo no cartão</p>
                <p className="mt-1 text-3xl font-black text-brand-700 dark:text-brand-200">{formatSimulatorCurrency(simulatorQuote.summary.cardNetAmount)}</p>
              </div>
              <label className="block space-y-1.5">
                <span className="text-xs font-semibold text-gray-500 dark:text-surface-dark-500">Enviar até</span>
                <input
                  aria-label="Enviar até"
                  className="ios-input w-full"
                  type="number"
                  min={1}
                  max={18}
                  value={maxInstallmentsToShare}
                  onChange={(event) => {
                    const raw = event.target.value;
                    setMaxInstallmentsToShare(raw === '' ? '' : clampInstallments(Number(raw)));
                  }}
                  onBlur={() => setMaxInstallmentsToShare(effectiveInstallmentLimit)}
                />
              </label>
              <p className="text-sm font-semibold text-gray-700 dark:text-surface-dark-700">
                {effectiveInstallmentLimit} parcela(s) na mensagem
              </p>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="ios-card p-4">
                  <p className="text-xs text-gray-500 dark:text-surface-dark-500">Primeira opção</p>
                  <p className="mt-1 font-bold text-gray-900 dark:text-white">
                    {firstInstallment ? `${firstInstallment.installments}x ${formatSimulatorCurrency(firstInstallment.installmentAmount)}` : '-'}
                  </p>
                </div>
                <div className="ios-card p-4">
                  <p className="text-xs text-gray-500 dark:text-surface-dark-500">Última opção enviada</p>
                  <p className="mt-1 font-bold text-gray-900 dark:text-white">
                    {lastInstallment ? `${lastInstallment.installments}x ${formatSimulatorCurrency(lastInstallment.installmentAmount)}` : '-'}
                  </p>
                </div>
              </div>
            </div>
          )}

          {activeStep === 'enviar' && (
            <div className="space-y-4">
              <div className="ios-card p-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-surface-dark-500">Prévia do envio</p>
                <pre className="mt-3 max-h-72 overflow-auto whitespace-pre-wrap text-sm text-gray-700 dark:text-surface-dark-700">{simulatorMessageText}</pre>
              </div>
            </div>
          )}
        </section>

        <aside aria-label="Resumo da simulação" className="self-start rounded-ios-xl border border-brand-100 bg-brand-50/50 p-5 shadow-ios dark:border-brand-900/40 dark:bg-brand-950/20">
          <p className="text-xs font-semibold uppercase tracking-wide text-brand-700 dark:text-brand-200">Aparelho escolhido</p>
          <p className="mt-2 text-base font-black leading-snug text-gray-950 dark:text-white">{buildStockLabel(item)}</p>
          <div className="mt-4 space-y-2 rounded-ios-lg bg-white p-3 text-sm dark:bg-surface-dark-100">
            <div className="flex items-center justify-between gap-3">
              <span className="text-gray-500 dark:text-surface-dark-500">Preço do aparelho</span>
              <strong className="text-gray-900 dark:text-white">{formatCurrencyBRL(item.sellPrice)}</strong>
            </div>
            <div className="flex items-center justify-between gap-3">
              <span className="text-gray-500 dark:text-surface-dark-500">Entrada</span>
              <strong className="text-gray-900 dark:text-white">{formatDeduction(simulatorQuote.summary.entriesTotal)}</strong>
            </div>
            <div className="flex items-center justify-between gap-3">
              <span className="text-gray-500 dark:text-surface-dark-500">Trade-in</span>
              <strong className="text-gray-900 dark:text-white">{formatDeduction(simulatorQuote.summary.tradeInReceivedValue)}</strong>
            </div>
          </div>
          <div className="mt-4 rounded-ios-lg bg-white p-3 dark:bg-surface-dark-100">
            <p className="text-xs font-semibold text-gray-500 dark:text-surface-dark-500">Saldo no cartão</p>
            <p className="mt-1 text-3xl font-black text-brand-700 dark:text-brand-200">{formatSimulatorCurrency(simulatorQuote.summary.cardNetAmount)}</p>
            <p className="mt-1 text-xs text-gray-500 dark:text-surface-dark-500">{simulatorQuote.summary.cardBrandLabel}</p>
          </div>
          <div className="mt-4 space-y-2 rounded-ios-lg bg-white p-3 dark:bg-surface-dark-100">
            {selectedInstallments.slice(0, 6).map((installment) => (
              <div key={installment.installments} className="flex justify-between text-sm text-gray-700 dark:text-surface-dark-700">
                <span>{installment.installments}x</span>
                <strong>{formatSimulatorCurrency(installment.installmentAmount)}</strong>
              </div>
            ))}
            {selectedInstallments.length > 6 && (
              <p className="text-xs font-semibold text-gray-500 dark:text-surface-dark-500">
                +{selectedInstallments.length - 6} parcela(s) na mensagem
              </p>
            )}
          </div>
          {!simulatorQuote.ok && simulatorQuote.errors.length > 0 && (
            <div className="mt-4 rounded-ios bg-red-50 p-3 text-sm text-red-700 dark:bg-red-950/30 dark:text-red-300">
              {simulatorQuote.errors[0].message}
            </div>
          )}
        </aside>
      </div>
    </Modal>
  );
};
