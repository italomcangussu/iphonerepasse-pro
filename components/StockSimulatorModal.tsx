import React, { useEffect, useId, useMemo, useState } from 'react';
import { Copy, MessageCircle, Plus, Smartphone, Sparkles, Trash2 } from 'lucide-react';
import Modal from './ui/Modal';
import IOSButton from './ui/IOSButton';
import { useToast } from './ui/ToastProvider';
import { maskDecimalInput } from '../utils/inputMasks';
import {
  CardFeeSettings,
  SimulatorTradeInAdjustment,
  SimulatorTradeInValue,
  StockItem,
} from '../types';
import { DEFAULT_CARD_FEE_SETTINGS } from '../utils/cardFees';
import { useTradeInDrafts, type TradeInDraftView } from '../hooks/useTradeInDrafts';
import {
  calculateSimulatorQuote,
  formatSimulatorCurrency,
  formatSimulatorMessage,
  parseSimulatorAmount,
  SIMULATOR_MAX_TRADE_INS,
  type SimulatorCardBrand,
  type SimulatorEntry,
} from '../utils/simulator';

type SimulatorStep = 'dados' | 'parcelas' | 'enviar';
type SimulatorShareTarget = 'crm' | 'whatsapp';
type DesiredDeviceMode = 'stock' | 'manual';
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
const clampInstallments = (value: number) => Math.min(18, Math.max(1, Math.trunc(Number.isFinite(value) ? value : 1)));
const formatDeduction = (value: number) => (value > 0 ? `-${formatSimulatorCurrency(value)}` : formatSimulatorCurrency(0));

const fieldLabelClass = 'text-xs font-semibold text-gray-500 dark:text-surface-dark-500';
const cardClass = 'min-w-0 space-y-4 rounded-ios-xl border border-gray-200 bg-white p-5 shadow-ios dark:border-surface-dark-300 dark:bg-surface-dark-100';

/** Controle segmentado iOS: uma decisão binária que troca o conteúdo abaixo dela. */
const SegmentedControl = <Value extends string>({
  ariaLabel,
  value,
  options,
  onChange,
}: {
  ariaLabel: string;
  value: Value;
  options: ReadonlyArray<{ value: Value; label: string }>;
  onChange: (value: Value) => void;
}) => (
  <div role="tablist" aria-label={ariaLabel} className="flex gap-1 rounded-ios-lg bg-gray-100 p-1 dark:bg-surface-dark-200">
    {options.map((option) => (
      <button
        key={option.value}
        type="button"
        role="tab"
        aria-selected={value === option.value}
        onClick={() => onChange(option.value)}
        className={`min-h-11 min-w-0 flex-1 truncate rounded-ios px-3 text-sm font-semibold transition-colors ${
          value === option.value
            ? 'bg-white text-gray-900 shadow-ios26-sm dark:bg-surface-dark-100 dark:text-white'
            : 'text-gray-500 hover:text-gray-700 dark:text-surface-dark-500 dark:hover:text-surface-dark-700'
        }`}
      >
        {option.label}
      </button>
    ))}
  </div>
);

const CurrencyField = ({
  label,
  value,
  onChange,
  placeholder = '0,00',
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}) => {
  const inputId = useId();
  return (
    <div className="min-w-0 space-y-1.5">
      <label htmlFor={inputId} className={`block ${fieldLabelClass}`}>{label}</label>
      <div className="relative">
        <span aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm font-semibold text-gray-400 dark:text-surface-dark-500">
          R$
        </span>
        <input
          id={inputId}
          type="text"
          role="spinbutton"
          className="ios-input w-full min-w-0 pl-10 tabular-nums font-semibold"
          inputMode="decimal"
          placeholder={placeholder}
          value={value}
          onChange={(event) => onChange(maskDecimalInput(event.target.value))}
        />
      </div>
    </div>
  );
};

export const StockSimulatorModal: React.FC<StockSimulatorModalProps> = ({
  open,
  onClose,
  item,
  simulatorTradeInValues = [],
  simulatorTradeInAdjustments = [],
  cardFeeSettings = DEFAULT_CARD_FEE_SETTINGS,
}) => {
  const toast = useToast();
  const simulatorMessageLabelId = useId();
  const stockLabel = buildStockLabel(item);
  const [activeStep, setActiveStep] = useState<SimulatorStep>('dados');
  const [maxInstallmentsToShare, setMaxInstallmentsToShare] = useState<InstallmentLimit>(18);
  const [desiredMode, setDesiredMode] = useState<DesiredDeviceMode>('stock');
  const [manualDeviceLabel, setManualDeviceLabel] = useState(stockLabel);
  const [manualDevicePrice, setManualDevicePrice] = useState(String(item.sellPrice || ''));
  const [entryAmount, setEntryAmount] = useState('');
  const [entries, setEntries] = useState<SimulatorEntry[]>([]);
  const [cardBrand, setCardBrand] = useState<SimulatorCardBrand>('visa_master');
  const [simulatorShareTarget, setSimulatorShareTarget] = useState<SimulatorShareTarget>('crm');
  const [editableSimulatorMessage, setEditableSimulatorMessage] = useState('');

  const tradeIns = useTradeInDrafts({
    valueRules: simulatorTradeInValues,
    adjustmentRules: simulatorTradeInAdjustments,
  });
  const { resetDrafts } = tradeIns;

  useEffect(() => {
    if (!open) return;
    setActiveStep('dados');
    setMaxInstallmentsToShare(18);
    setDesiredMode('stock');
    // O aparelho do estoque é o ponto de partida do modo livre: o vendedor
    // ajusta o que precisa em vez de digitar tudo de novo.
    setManualDeviceLabel(buildStockLabel(item));
    setManualDevicePrice(String(item.sellPrice || ''));
    setEntryAmount('');
    setEntries([]);
    setCardBrand('visa_master');
    setSimulatorShareTarget('crm');
    setEditableSimulatorMessage('');
    resetDrafts();
  }, [open, item, resetDrafts]);

  const desiredDevice = useMemo(() => (
    desiredMode === 'manual'
      ? { label: manualDeviceLabel.trim(), price: parseSimulatorAmount(manualDevicePrice), source: 'manual' as const }
      : { label: stockLabel, price: item.sellPrice, color: item.color, source: 'stock' as const }
  ), [desiredMode, item.color, item.sellPrice, manualDeviceLabel, manualDevicePrice, stockLabel]);

  const simulatorQuote = useMemo(() => calculateSimulatorQuote({
    desiredDevice,
    tradeIns: tradeIns.tradeInInputs,
    entries,
    cardBrand,
    valueRules: simulatorTradeInValues,
    adjustmentRules: simulatorTradeInAdjustments,
    cardFeeSettings,
  }), [
    cardBrand,
    cardFeeSettings,
    desiredDevice,
    entries,
    simulatorTradeInAdjustments,
    simulatorTradeInValues,
    tradeIns.tradeInInputs,
  ]);

  // Os erros da engine são indexados pelos aparelhos preenchidos; aqui eles
  // voltam para o card que os causou, para a correção aparecer onde se digita.
  const errorByDraftId = useMemo(() => {
    const map = new Map<string, string>();
    simulatorQuote.errors.forEach((error) => {
      if (typeof error.tradeInIndex !== 'number') return;
      const view = tradeIns.filledViews[error.tradeInIndex];
      if (view && !map.has(view.id)) map.set(view.id, error.message);
    });
    return map;
  }, [simulatorQuote.errors, tradeIns.filledViews]);

  // Erros que não pertencem a nenhum card sobem para o rodapé do formulário.
  const generalError = simulatorQuote.errors.find((error) => {
    if (typeof error.tradeInIndex !== 'number') return true;
    const view = tradeIns.filledViews[error.tradeInIndex];
    return !view || !errorByDraftId.has(view.id);
  });

  const effectiveInstallmentLimit = clampInstallments(maxInstallmentsToShare === '' ? 1 : maxInstallmentsToShare);
  const selectedInstallments = simulatorQuote.installments.slice(0, effectiveInstallmentLimit);
  const firstInstallment = selectedInstallments[0] || null;
  const lastInstallment = selectedInstallments[selectedInstallments.length - 1] || null;
  const simulatorMessageText = simulatorQuote.ok
    ? formatSimulatorMessage({ summary: simulatorQuote.summary, installments: selectedInstallments })
    : '';

  useEffect(() => {
    setEditableSimulatorMessage(simulatorMessageText);
  }, [simulatorMessageText]);

  const addSimulatorEntry = () => {
    const amount = parseSimulatorAmount(entryAmount);
    if (amount <= 0) {
      toast.error('Informe um valor de entrada maior que zero.');
      return;
    }
    setEntries((current) => [...current, { type: 'Pix', amount }]);
    setEntryAmount('');
  };

  const addTradeInDevice = () => {
    if (!tradeIns.canAddDraft) {
      toast.info(`Você pode simular até ${SIMULATOR_MAX_TRADE_INS} aparelhos na troca.`);
      return;
    }
    tradeIns.addDraft();
  };

  const continueFromDados = () => {
    if (!simulatorQuote.ok) {
      toast.error(simulatorQuote.errors[0]?.message || 'Complete a simulação antes de continuar.');
      return;
    }
    setActiveStep('parcelas');
  };

  const shareSimulatorQuote = async () => {
    const messageToShare = editableSimulatorMessage.trim();

    if (!simulatorQuote.ok || !messageToShare) {
      toast.error('Complete a simulação antes de compartilhar.');
      return;
    }

    if (simulatorShareTarget === 'whatsapp') {
      window.open(`https://wa.me/?text=${encodeURIComponent(messageToShare)}`, '_blank', 'noopener,noreferrer');
      toast.success('WhatsApp aberto com a simulação.');
      return;
    }

    await navigator.clipboard.writeText(messageToShare);
    toast.success('Mensagem copiada para usar no CRM.');
  };

  const copySimulatorMessage = async () => {
    const messageToCopy = editableSimulatorMessage.trim();

    if (!simulatorQuote.ok || !messageToCopy) {
      toast.error('Complete a simulação antes de copiar.');
      return;
    }

    try {
      await navigator.clipboard.writeText(messageToCopy);
      toast.success('Texto da simulação copiado.');
    } catch {
      toast.error('Não foi possível copiar o texto da simulação.');
    }
  };

  const renderTradeInCard = (view: TradeInDraftView) => {
    const inlineError = errorByDraftId.get(view.id);
    const isCustom = view.mode === 'custom';

    return (
      <div
        key={view.id}
        role="group"
        aria-label={`Aparelho ${view.index + 1} da troca`}
        className="min-w-0 space-y-3 rounded-ios-lg border border-gray-200 bg-gray-50/60 p-4 dark:border-surface-dark-300 dark:bg-surface-dark-200/50"
      >
        <div className="flex items-center justify-between gap-2">
          <p className="flex items-center gap-2 text-sm font-bold text-gray-900 dark:text-white">
            <Smartphone size={15} className="text-brand-600 dark:text-brand-300" aria-hidden="true" />
            Aparelho {view.index + 1}
          </p>
          {(tradeIns.views.length > 1 || !view.isEmpty) && (
            <button
              type="button"
              aria-label={`Remover aparelho ${view.index + 1} da troca`}
              onClick={() => tradeIns.removeDraft(view.id)}
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-gray-400 transition-colors hover:bg-red-50 hover:text-red-600 active:scale-95 dark:text-surface-dark-500 dark:hover:bg-red-950/30 dark:hover:text-red-300"
            >
              <Trash2 size={16} aria-hidden="true" />
            </button>
          )}
        </div>

        <SegmentedControl
          ariaLabel={`Origem do aparelho ${view.index + 1} da troca`}
          value={view.mode}
          onChange={(mode) => tradeIns.setMode(view.id, mode)}
          options={[
            { value: 'catalog', label: 'Da tabela' },
            { value: 'custom', label: 'Fora da tabela' },
          ]}
        />

        <div className="grid gap-4 md:grid-cols-2">
          <label className="block min-w-0 space-y-1.5">
            <span className={fieldLabelClass}>Modelo do trade-in</span>
            {isCustom ? (
              <input
                className="ios-input w-full min-w-0"
                placeholder="Galaxy S23"
                value={view.model}
                onChange={(event) => tradeIns.setModel(view.id, event.target.value)}
              />
            ) : (
              <select
                className="ios-input w-full min-w-0"
                value={view.model}
                onChange={(event) => tradeIns.setModel(view.id, event.target.value)}
              >
                <option value="">Sem trade-in</option>
                {tradeIns.modelOptions.map((model) => <option key={model} value={model}>{model}</option>)}
              </select>
            )}
          </label>
          <label className="block min-w-0 space-y-1.5">
            <span className={fieldLabelClass}>Armazenamento</span>
            {isCustom ? (
              <input
                className="ios-input w-full min-w-0"
                placeholder="256GB"
                value={view.capacity}
                onChange={(event) => tradeIns.setCapacity(view.id, event.target.value)}
              />
            ) : (
              <select
                className="ios-input w-full min-w-0"
                value={view.capacity}
                onChange={(event) => tradeIns.setCapacity(view.id, event.target.value)}
                disabled={!view.model}
              >
                <option value="">Selecione</option>
                {view.capacityOptions.map((capacity) => <option key={capacity} value={capacity}>{capacity}</option>)}
              </select>
            )}
          </label>
          <label className="block min-w-0 space-y-1.5">
            <span className={fieldLabelClass}>Cor do trade-in</span>
            <input
              className="ios-input w-full min-w-0"
              placeholder="Natural Titanium"
              value={view.color}
              onChange={(event) => tradeIns.setColor(view.id, event.target.value)}
            />
          </label>
          <CurrencyField
            label="Valor final recebido"
            value={view.valueInput}
            onChange={(value) => tradeIns.setValue(view.id, value)}
          />
        </div>

        {view.adjustments.length > 0 && (
          <div className="space-y-2">
            <p className={fieldLabelClass}>Ajustes de condição</p>
            <div className="grid gap-2">
              {view.adjustments.map((adjustment) => {
                const isSelected = view.adjustmentIds.includes(adjustment.id);
                return (
                  <button
                    key={adjustment.id}
                    type="button"
                    role="checkbox"
                    aria-checked={isSelected}
                    aria-label={adjustment.label}
                    onClick={() => tradeIns.toggleAdjustment(view.id, adjustment.id)}
                    className={`flex min-h-11 items-center justify-between gap-3 rounded-ios-lg border px-3 py-2 text-left transition-colors ${
                      isSelected
                        ? 'border-brand-500 bg-brand-50 dark:border-brand-400 dark:bg-brand-950/30'
                        : 'border-gray-200 bg-white hover:border-gray-300 dark:border-surface-dark-300 dark:bg-surface-dark-100'
                    }`}
                  >
                    <span className={`min-w-0 text-sm font-medium ${isSelected ? 'text-brand-700 dark:text-brand-200' : 'text-gray-700 dark:text-surface-dark-700'}`}>
                      {adjustment.label}
                    </span>
                    <span className={`shrink-0 text-sm font-semibold tabular-nums ${adjustment.amountDelta >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                      {adjustment.amountDelta >= 0 ? '+' : ''}{formatSimulatorCurrency(adjustment.amountDelta)}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-gray-200 pt-3 dark:border-surface-dark-300">
          <span className="flex items-center gap-2 text-xs font-semibold text-gray-500 dark:text-surface-dark-500">
            Abatimento deste aparelho
            {view.baseValue === null && !view.isEmpty && (
              <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-bold text-amber-700 dark:bg-amber-950/40 dark:text-amber-300">
                fora da tabela
              </span>
            )}
          </span>
          <strong className="text-sm font-black tabular-nums text-gray-900 dark:text-white">
            {formatSimulatorCurrency(view.receivedValue)}
          </strong>
        </div>

        {inlineError && (
          <p role="alert" className="rounded-ios bg-red-50 px-3 py-2 text-sm font-medium text-red-700 dark:bg-red-950/30 dark:text-red-300">
            {inlineError}
          </p>
        )}
      </div>
    );
  };

  const footer = (
    <div className="grid gap-2 sm:flex sm:items-center sm:justify-between">
      <div className={`grid gap-2 ${activeStep !== 'dados' ? 'grid-cols-2' : 'grid-cols-1 justify-items-start'} sm:flex`}>
        {activeStep !== 'dados' && (
          <IOSButton
            variant="secondary"
            onClick={() => setActiveStep(activeStep === 'enviar' ? 'parcelas' : 'dados')}
            className="w-full justify-center sm:w-auto"
          >
            Voltar
          </IOSButton>
        )}
        <IOSButton variant="secondary" onClick={onClose} className="w-full justify-center sm:w-auto">
          Fechar
        </IOSButton>
      </div>
      <div className="grid gap-2 sm:flex sm:justify-end">
        {activeStep === 'dados' && (
          <IOSButton variant="primary" onClick={continueFromDados} className="w-full justify-center sm:w-auto">
            Continuar
          </IOSButton>
        )}
        {activeStep === 'parcelas' && (
          <IOSButton variant="primary" onClick={() => setActiveStep('enviar')} className="w-full justify-center sm:w-auto">
            Continuar
          </IOSButton>
        )}
        {activeStep === 'enviar' && (
          <IOSButton
            variant={simulatorShareTarget === 'whatsapp' ? 'primary' : 'secondary'}
            onClick={() => void shareSimulatorQuote()}
            leftIcon={simulatorShareTarget === 'whatsapp' ? <MessageCircle size={16} /> : <Copy size={16} />}
            className="w-full justify-center sm:w-auto"
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
        <nav className="grid grid-cols-3 gap-2 xl:flex xl:flex-col" aria-label="Etapas do simulador">
          {[
            ['dados', 'Dados'],
            ['parcelas', 'Parcelas'],
            ['enviar', 'Enviar'],
          ].map(([step, label], index) => (
            <button
              key={step}
              type="button"
              aria-current={activeStep === step ? 'step' : undefined}
              aria-disabled={step !== 'dados' && !simulatorQuote.ok ? true : undefined}
              onClick={() => {
                if (step !== 'dados' && !simulatorQuote.ok) {
                  toast.error(simulatorQuote.errors[0]?.message || 'Complete a simulação antes de continuar.');
                  return;
                }
                setActiveStep(step as SimulatorStep);
              }}
              className={`flex min-h-11 min-w-0 items-center justify-center gap-1 overflow-hidden rounded-ios-lg border px-3 py-3 text-center text-sm font-bold transition-colors xl:justify-start xl:text-left ${
                activeStep === step
                  ? 'border-brand-600 bg-brand-600 text-white'
                  : 'border-gray-200 bg-white text-gray-600 hover:bg-gray-50 dark:border-surface-dark-300 dark:bg-surface-dark-100 dark:text-surface-dark-600'
              }`}
            >
              <span className="shrink-0 opacity-70" aria-hidden="true">{index + 1}</span>
              <span className="min-w-0 truncate">{label}</span>
            </button>
          ))}
        </nav>

        <section className="min-w-0 space-y-5">
          {activeStep === 'dados' && (
            <>
              <div className="sticky top-0 z-10 min-w-0 max-w-full rounded-ios-lg border border-brand-100 bg-brand-50/90 px-4 py-3 backdrop-blur dark:border-brand-900/40 dark:bg-brand-950/70 xl:hidden">
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-brand-700 dark:text-brand-200">Saldo no cartão</p>
                    <p className="text-2xl font-black leading-tight tabular-nums text-brand-700 dark:text-brand-200">
                      {formatSimulatorCurrency(simulatorQuote.summary.cardNetAmount)}
                    </p>
                  </div>
                  {lastInstallment && (
                    <p className="shrink-0 text-right text-sm font-semibold tabular-nums text-gray-700 dark:text-surface-dark-700">
                      {lastInstallment.installments}x de {formatSimulatorCurrency(lastInstallment.installmentAmount)}
                    </p>
                  )}
                </div>
              </div>

              <fieldset className={cardClass} aria-label="Aparelho desejado">
                <legend className="text-base font-bold text-gray-900 dark:text-white">Aparelho desejado</legend>
                <p className="-mt-3 text-sm text-gray-500 dark:text-surface-dark-500">
                  Simule o item aberto ou qualquer outro aparelho, mesmo sem estoque.
                </p>
                <SegmentedControl
                  ariaLabel="Origem do aparelho desejado"
                  value={desiredMode}
                  onChange={setDesiredMode}
                  options={[
                    { value: 'stock', label: 'Do estoque' },
                    { value: 'manual', label: 'Outro aparelho' },
                  ]}
                />
                {desiredMode === 'stock' ? (
                  <div className="flex items-center justify-between gap-3 rounded-ios-lg bg-gray-50 px-4 py-3 dark:bg-surface-dark-200/60">
                    <span className="min-w-0 text-sm font-medium text-gray-700 dark:text-surface-dark-700">
                      Item aberto no estoque
                    </span>
                    <strong className="shrink-0 text-sm font-black tabular-nums text-gray-900 dark:text-white">
                      {formatSimulatorCurrency(item.sellPrice)}
                    </strong>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_200px]">
                      <label className="block min-w-0 space-y-1.5">
                        <span className={fieldLabelClass}>Aparelho</span>
                        <input
                          className="ios-input w-full min-w-0"
                          placeholder="iPhone 16 Pro Max 256GB"
                          value={manualDeviceLabel}
                          onChange={(event) => setManualDeviceLabel(event.target.value)}
                        />
                      </label>
                      <CurrencyField
                        label="Preço de venda"
                        value={manualDevicePrice}
                        onChange={setManualDevicePrice}
                        placeholder="5.000"
                      />
                    </div>
                    <p className="flex items-start gap-2 rounded-ios bg-amber-50 px-3 py-2 text-sm text-amber-800 dark:bg-amber-950/30 dark:text-amber-200">
                      <Sparkles size={15} className="mt-0.5 shrink-0" aria-hidden="true" />
                      Simulação livre: este aparelho não existe no estoque e nada será reservado.
                    </p>
                  </div>
                )}
              </fieldset>

              <fieldset className={cardClass} aria-label="Trade-in">
                <legend className="text-base font-bold text-gray-900 dark:text-white">Trade-in</legend>
                <p className="-mt-3 text-sm text-gray-500 dark:text-surface-dark-500">
                  Some quantos aparelhos o cliente deixar como parte do pagamento — até {SIMULATOR_MAX_TRADE_INS}.
                </p>

                <div className="space-y-3">
                  {tradeIns.views.map(renderTradeInCard)}
                </div>

                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <IOSButton
                    variant="secondary"
                    onClick={addTradeInDevice}
                    disabled={!tradeIns.canAddDraft}
                    leftIcon={<Plus size={16} />}
                    className="w-full justify-center sm:w-auto"
                  >
                    Adicionar aparelho
                  </IOSButton>
                  {tradeIns.filledViews.length > 1 && (
                    <div className="flex items-center justify-between gap-3 rounded-ios-lg bg-brand-50 px-4 py-2 dark:bg-brand-950/30 sm:justify-end">
                      <span className="text-xs font-semibold uppercase tracking-wide text-brand-700 dark:text-brand-200">
                        Total da troca
                      </span>
                      <strong className="text-base font-black tabular-nums text-brand-700 dark:text-brand-200">
                        {formatSimulatorCurrency(simulatorQuote.summary.tradeInReceivedValue)}
                      </strong>
                    </div>
                  )}
                </div>
              </fieldset>

              <fieldset className={cardClass} aria-label="Pagamento">
                <legend className="text-base font-bold text-gray-900 dark:text-white">Pagamento</legend>
                <p className="-mt-3 text-sm text-gray-500 dark:text-surface-dark-500">Defina entrada fora do cartão, bandeira e canal de saída da simulação.</p>
                <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_auto]">
                  <CurrencyField label="Valor da entrada" value={entryAmount} onChange={setEntryAmount} />
                  <div className="flex items-end">
                    <IOSButton variant="secondary" onClick={addSimulatorEntry} className="w-full md:w-auto">
                      Adicionar entrada
                    </IOSButton>
                  </div>
                  <label className="block min-w-0 space-y-1.5">
                    <span className={fieldLabelClass}>Bandeira</span>
                    <select className="ios-input w-full min-w-0" value={cardBrand} onChange={(event) => setCardBrand(event.target.value as SimulatorCardBrand)}>
                      <option value="visa_master">Visa / Master</option>
                      <option value="outras">Outras</option>
                    </select>
                  </label>
                  <label className="block min-w-0 space-y-1.5">
                    <span className={fieldLabelClass}>Saída</span>
                    <select className="ios-input w-full min-w-0" value={simulatorShareTarget} onChange={(event) => setSimulatorShareTarget(event.target.value as SimulatorShareTarget)}>
                      <option value="crm">Copiar para CRM</option>
                      <option value="whatsapp">Abrir WhatsApp</option>
                    </select>
                  </label>
                </div>

                {entries.map((entry, index) => (
                  <div key={`${entry.type}-${index}`} className="flex items-center justify-between gap-3 rounded-ios-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm dark:border-surface-dark-300 dark:bg-surface-dark-200">
                    <span className="min-w-0 truncate">{entry.type}: {formatSimulatorCurrency(entry.amount)}</span>
                    <button
                      type="button"
                      className="min-h-11 px-2 text-gray-500 dark:text-surface-dark-500"
                      onClick={() => setEntries((current) => current.filter((_, entryIndex) => entryIndex !== index))}
                    >
                      Remover
                    </button>
                  </div>
                ))}
              </fieldset>

              {generalError && (
                <p role="alert" className="rounded-ios bg-red-50 px-4 py-3 text-sm font-medium text-red-700 dark:bg-red-950/30 dark:text-red-300">
                  {generalError.message}
                </p>
              )}
            </>
          )}

          {activeStep === 'parcelas' && (
            <div className="space-y-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-surface-dark-500">Saldo no cartão</p>
                <p className="mt-1 text-3xl font-black text-brand-700 dark:text-brand-200">{formatSimulatorCurrency(simulatorQuote.summary.cardNetAmount)}</p>
              </div>
              <label className="block space-y-1.5">
                <span className={fieldLabelClass}>Enviar até</span>
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
                <div className="space-y-2">
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                    <span
                      id={simulatorMessageLabelId}
                      className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-surface-dark-500"
                    >
                      Texto da simulação
                    </span>
                    <IOSButton
                      type="button"
                      variant="secondary"
                      onClick={() => void copySimulatorMessage()}
                      leftIcon={<Copy size={16} />}
                      aria-label="Copiar texto da simulação"
                      className="min-h-11 w-full justify-center px-3 py-2 text-sm sm:w-auto"
                    >
                      Copiar
                    </IOSButton>
                  </div>
                  <textarea
                    aria-labelledby={simulatorMessageLabelId}
                    className="ios-input min-h-72 w-full resize-y whitespace-pre-wrap font-mono text-sm leading-6"
                    value={editableSimulatorMessage}
                    onChange={(event) => setEditableSimulatorMessage(event.target.value)}
                  />
                </div>
              </div>
            </div>
          )}
        </section>

        <aside aria-label="Resumo da simulação" className="self-start rounded-ios-xl border border-brand-100 bg-brand-50/50 p-5 shadow-ios dark:border-brand-900/40 dark:bg-brand-950/20">
          <div className="flex items-center justify-between gap-2">
            <p className="text-xs font-semibold uppercase tracking-wide text-brand-700 dark:text-brand-200">Aparelho escolhido</p>
            {simulatorQuote.summary.desiredDeviceSource === 'manual' && (
              <span className="shrink-0 rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-bold text-amber-700 dark:bg-amber-950/40 dark:text-amber-300">
                Fora do estoque
              </span>
            )}
          </div>
          <p className="mt-2 text-base font-black leading-snug text-gray-950 dark:text-white">
            {simulatorQuote.summary.desiredDeviceLabel || 'Informe o aparelho desejado'}
          </p>
          <div className="mt-4 space-y-2 rounded-ios-lg bg-white p-3 text-sm dark:bg-surface-dark-100">
            <div className="flex items-center justify-between gap-3">
              <span className="text-gray-500 dark:text-surface-dark-500">Preço do aparelho</span>
              <strong className="text-gray-900 dark:text-white">{formatSimulatorCurrency(simulatorQuote.summary.desiredDevicePrice)}</strong>
            </div>
            <div className="flex items-center justify-between gap-3">
              <span className="text-gray-500 dark:text-surface-dark-500">Entrada</span>
              <strong className="text-gray-900 dark:text-white">{formatDeduction(simulatorQuote.summary.entriesTotal)}</strong>
            </div>
            <div className="flex items-center justify-between gap-3">
              <span className="text-gray-500 dark:text-surface-dark-500">Trade-in</span>
              <strong className="text-gray-900 dark:text-white">{formatDeduction(simulatorQuote.summary.tradeInReceivedValue)}</strong>
            </div>
            {simulatorQuote.summary.tradeIns.length > 1 && simulatorQuote.summary.tradeIns.map((tradeIn, index) => (
              <div key={`${tradeIn.label}-${index}`} className="flex items-center justify-between gap-3 pl-3 text-xs">
                <span className="min-w-0 truncate text-gray-500 dark:text-surface-dark-500">{tradeIn.label}</span>
                <span className="shrink-0 tabular-nums text-gray-600 dark:text-surface-dark-600">{formatDeduction(tradeIn.receivedValue)}</span>
              </div>
            ))}
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
