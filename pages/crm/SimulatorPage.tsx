import React, { useEffect, useMemo, useState } from 'react';
import { Clipboard, ChevronDown, Pencil, Plus, Smartphone, Trash2, X } from 'lucide-react';
import CRMPageFrame from '../../components/crm/CRMPageFrame';
import ConfirmDialog from '../../components/ui/ConfirmDialog';
import { useAuth } from '../../contexts/AuthContext';
import { useData } from '../../services/dataContext';
import { useToast } from '../../components/ui/ToastProvider';
import { StockStatus, type SimulatorTradeInValue, type StockItem } from '../../types';
import {
  calculateSimulatorQuote,
  formatSimulatorCurrency,
  type SimulatorCardBrand,
  type SimulatorEntry,
} from '../../utils/simulator';
import {
  calculateMixedGroupCards,
  normalizeCardGroup,
  splitSameGroupTaxedTotal,
} from '../../lib/crm/paymentRevision';

// ─── Pure helpers (unchanged) ─────────────────────────────────────────────────

const buildStockLabel = (item: StockItem) =>
  [item.model, item.capacity, item.color].filter(Boolean).join(' ');
const parseAmountInput = (value: string) =>
  Number(value.replace(/\./g, '').replace(',', '.')) || 0;
const modelCollator = new Intl.Collator('pt-BR', { numeric: true, sensitivity: 'base' });
const iphoneVariantRank = (model: string) => {
  const n = model.toLowerCase();
  if (/\bpro\s+max\b/.test(n)) return 5;
  if (/\bpro\b/.test(n)) return 4;
  if (/\bair\b/.test(n)) return 3;
  if (/\bplus\b/.test(n)) return 2;
  if (/\bmini\b/.test(n)) return 1;
  return 0;
};
const iphoneGenerationRank = (model: string) => {
  const n = model.toLowerCase();
  const m = n.match(/\biphone\s+(\d+)/);
  if (m) return Number(m[1]);
  if (/\biphone\s+xs\b/.test(n)) return 10.2;
  if (/\biphone\s+xr\b/.test(n)) return 10.1;
  if (/\biphone\s+x\b/.test(n)) return 10;
  if (/\biphone\s+se\b/.test(n)) return 0;
  return -1;
};
const parseCapacityToGb = (value: string) => {
  const match = value.trim().toUpperCase().match(/(\d+(?:[.,]\d+)?)(?:\s*)(TB|GB)?/);
  if (!match) return 0;
  const amount = Number(match[1].replace(',', '.'));
  if (!Number.isFinite(amount)) return 0;
  return (match[2] || 'GB') === 'TB' ? amount * 1024 : amount;
};
const compareSimulatorTradeInValuesByFamily = (
  a: SimulatorTradeInValue,
  b: SimulatorTradeInValue,
) => {
  const aGen = iphoneGenerationRank(a.model);
  const bGen = iphoneGenerationRank(b.model);
  if (aGen !== bGen) return bGen - aGen;
  const byVariant = iphoneVariantRank(a.model) - iphoneVariantRank(b.model);
  if (byVariant !== 0) return byVariant;
  const byModel = modelCollator.compare(a.model, b.model);
  if (byModel !== 0) return byModel;
  const byCap = parseCapacityToGb(a.capacity) - parseCapacityToGb(b.capacity);
  if (byCap !== 0) return byCap;
  return modelCollator.compare(a.capacity, b.capacity);
};

// ─── iOS Switch ───────────────────────────────────────────────────────────────

function IOSSwitch({
  id,
  checked,
  onChange,
  label,
}: {
  id: string;
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
}) {
  return (
    <div className="flex items-center justify-between gap-3 min-h-[44px]">
      <span id={id} className="text-sm font-semibold text-slate-700 dark:text-slate-200 select-none">
        {label}
      </span>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-labelledby={id}
        onClick={() => onChange(!checked)}
        style={{ WebkitTapHighlightColor: 'transparent' }}
        className={`relative inline-flex h-[31px] w-[51px] shrink-0 rounded-full transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2 ${
          checked ? 'bg-brand-500' : 'bg-slate-300 dark:bg-slate-600'
        }`}
      >
        <span
          aria-hidden="true"
          className={`absolute top-[2px] h-[27px] w-[27px] rounded-full bg-white shadow-ios26-sm transition-transform duration-200 ${
            checked ? 'translate-x-[22px]' : 'translate-x-[2px]'
          }`}
        />
      </button>
    </div>
  );
}

// ─── Segmented pill row (inline, no generics needed) ──────────────────────────

const segBase =
  'flex-1 py-2 px-3 rounded-[8px] font-semibold transition-all duration-200 min-h-[36px] select-none text-sm';
const segActive = 'bg-white dark:bg-slate-700 shadow-sm text-slate-900 dark:text-white';
const segInactive = 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300';
const segSmBase =
  'flex-1 py-1.5 px-3 rounded-[7px] font-semibold transition-all duration-200 min-h-[32px] select-none text-xs';

// ─── Page ─────────────────────────────────────────────────────────────────────

const SimulatorPage: React.FC = () => {
  const {
    stock = [],
    simulatorTradeInValues = [],
    simulatorTradeInAdjustments = [],
    cardFeeSettings,
    upsertSimulatorTradeInValue,
    updateSimulatorTradeInValue,
    removeSimulatorTradeInValue,
    upsertSimulatorTradeInAdjustment,
  } = useData();
  const { role } = useAuth();
  const toast = useToast();

  const availableStock = useMemo(
    () =>
      stock.filter(
        (item: StockItem) =>
          item.status === StockStatus.AVAILABLE || item.status === StockStatus.RESERVED,
      ),
    [stock],
  );

  // ─── Form state ───────────────────────────────────────────────────────────
  const [desiredMode, setDesiredMode] = useState<'stock' | 'manual'>('stock');
  const [selectedStockId, setSelectedStockId] = useState('');
  const [manualDeviceLabel, setManualDeviceLabel] = useState('');
  const [manualDevicePrice, setManualDevicePrice] = useState('');
  const [tradeInModel, setTradeInModel] = useState('');
  const [tradeInCapacity, setTradeInCapacity] = useState('');
  const [tradeInColor, setTradeInColor] = useState('');
  const [manualTradeInValue, setManualTradeInValue] = useState('');
  const [selectedAdjustmentIds, setSelectedAdjustmentIds] = useState<string[]>([]);
  const [entryAmount, setEntryAmount] = useState('');
  const [entries, setEntries] = useState<SimulatorEntry[]>([]);
  const [cardBrand, setCardBrand] = useState<SimulatorCardBrand>('visa_master');
  const [splitCards, setSplitCards] = useState(false);
  const [splitInstallments, setSplitInstallments] = useState(10);
  const [splitCardOne, setSplitCardOne] = useState({ brand: 'visa', amount: '' });
  const [splitCardTwo, setSplitCardTwo] = useState({ brand: 'master', amount: '' });

  // ─── UI state ─────────────────────────────────────────────────────────────
  const [activeTab, setActiveTab] = useState<'simulation' | 'settings'>('simulation');
  const [tradeInOpen, setTradeInOpen] = useState(true);
  const [deletingItem, setDeletingItem] = useState<SimulatorTradeInValue | null>(null);

  // ─── Settings state ───────────────────────────────────────────────────────
  const [newBaseValue, setNewBaseValue] = useState({ model: '', capacity: '', baseValue: '' });
  const [editingBaseValueId, setEditingBaseValueId] = useState<string | null>(null);
  const [editingBaseValue, setEditingBaseValue] = useState({
    model: '',
    capacity: '',
    baseValue: '',
  });
  const [newAdjustment, setNewAdjustment] = useState({
    label: '',
    model: '',
    capacity: '',
    amountDelta: '',
  });

  useEffect(() => {
    if (role === 'admin') setActiveTab('settings');
  }, [role]);

  // ─── Derived ──────────────────────────────────────────────────────────────
  const selectedStock =
    availableStock.find((item: StockItem) => item.id === selectedStockId) || null;

  const modelOptions = useMemo(
    () =>
      Array.from(
        new Set(
          [...simulatorTradeInValues]
            .filter((item) => item.isActive !== false)
            .sort(compareSimulatorTradeInValuesByFamily)
            .map((item) => item.model),
        ),
      ),
    [simulatorTradeInValues],
  );

  const capacityOptions = useMemo(
    () =>
      Array.from(
        new Set(
          [...simulatorTradeInValues]
            .filter((item) => item.isActive !== false && item.model === tradeInModel)
            .sort(compareSimulatorTradeInValuesByFamily)
            .map((item) => item.capacity),
        ),
      ),
    [simulatorTradeInValues, tradeInModel],
  );

  const sortedSimulatorTradeInValues = useMemo(
    () => [...simulatorTradeInValues].sort(compareSimulatorTradeInValuesByFamily),
    [simulatorTradeInValues],
  );

  const applicableAdjustments = useMemo(
    () =>
      simulatorTradeInAdjustments.filter((item) => {
        if (item.isActive === false) return false;
        if (item.model && item.model !== tradeInModel) return false;
        if (item.capacity && item.capacity !== tradeInCapacity) return false;
        return true;
      }),
    [simulatorTradeInAdjustments, tradeInCapacity, tradeInModel],
  );

  const desiredDevice =
    desiredMode === 'stock'
      ? {
          label: selectedStock ? buildStockLabel(selectedStock) : '',
          price: selectedStock?.sellPrice || 0,
        }
      : {
          label: manualDeviceLabel,
          price: parseAmountInput(manualDevicePrice),
        };

  const quote = useMemo(
    () =>
      calculateSimulatorQuote({
        desiredDevice,
        tradeIn: {
          model: tradeInModel,
          capacity: tradeInCapacity,
          color: tradeInColor,
          selectedAdjustmentIds,
          manualReceivedValue: manualTradeInValue.trim()
            ? parseAmountInput(manualTradeInValue)
            : null,
        },
        entries,
        cardBrand,
        valueRules: simulatorTradeInValues,
        adjustmentRules: simulatorTradeInAdjustments,
        cardFeeSettings,
      }),
    [
      cardBrand,
      cardFeeSettings,
      desiredDevice.label,
      desiredDevice.price,
      entries,
      manualTradeInValue,
      selectedAdjustmentIds,
      simulatorTradeInAdjustments,
      simulatorTradeInValues,
      tradeInCapacity,
      tradeInColor,
      tradeInModel,
    ],
  );

  const selectedInstallment =
    quote.installments.find((item) => item.installments === splitInstallments) || null;

  const paymentRevision = useMemo(() => {
    if (!splitCards || !selectedInstallment) return null;
    const cards = [
      { brand: splitCardOne.brand, amount: parseAmountInput(splitCardOne.amount) },
      { brand: splitCardTwo.brand, amount: parseAmountInput(splitCardTwo.amount) },
    ];
    if (cards.some((card) => card.amount <= 0)) return null;
    try {
      const sameGroup =
        normalizeCardGroup(cards[0].brand) === normalizeCardGroup(cards[1].brand);
      if (sameGroup) {
        return {
          kind: 'same_group' as const,
          netTotal: quote.summary.cardNetAmount,
          taxedTotal: selectedInstallment.customerAmount,
          cards: splitSameGroupTaxedTotal({
            taxedTotal: selectedInstallment.customerAmount,
            installments: splitInstallments,
            cards,
          }),
        };
      }
      return {
        kind: 'mixed_group' as const,
        ...calculateMixedGroupCards({
          netTotal: quote.summary.cardNetAmount,
          installments: splitInstallments,
          cards,
          feeRates: {
            visa_master: cardFeeSettings?.visaMasterRates?.[splitInstallments - 1] ?? 0,
            outras: cardFeeSettings?.otherRates?.[splitInstallments - 1] ?? 0,
          },
        }),
      };
    } catch {
      return null;
    }
  }, [
    cardFeeSettings?.otherRates,
    cardFeeSettings?.visaMasterRates,
    quote.summary.cardNetAmount,
    selectedInstallment,
    splitCardOne,
    splitCardTwo,
    splitCards,
    splitInstallments,
  ]);

  useEffect(() => {
    const baseRule = simulatorTradeInValues.find(
      (item) =>
        item.isActive !== false &&
        item.model === tradeInModel &&
        item.capacity === tradeInCapacity,
    );
    if (!baseRule) return;
    const adjustmentTotal = applicableAdjustments
      .filter((item) => selectedAdjustmentIds.includes(item.id))
      .reduce((sum, item) => sum + item.amountDelta, 0);
    setManualTradeInValue(String(Math.max(0, baseRule.baseValue + adjustmentTotal)));
  }, [applicableAdjustments, selectedAdjustmentIds, simulatorTradeInValues, tradeInCapacity, tradeInModel]);

  // ─── Handlers ─────────────────────────────────────────────────────────────
  const addEntry = () => {
    const amount = parseAmountInput(entryAmount);
    if (amount <= 0) return;
    setEntries((current) => [...current, { type: 'Pix', amount }]);
    setEntryAmount('');
  };

  const toggleAdjustment = (id: string) => {
    setSelectedAdjustmentIds((current) =>
      current.includes(id) ? current.filter((item) => item !== id) : [...current, id],
    );
  };

  const copyMessage = async () => {
    if (!quote.ok) {
      toast.error('Complete a simulação antes de copiar.');
      return;
    }
    await navigator.clipboard.writeText(quote.messageText);
    toast.success('Mensagem copiada.');
  };

  const saveBaseValue = async () => {
    await upsertSimulatorTradeInValue({
      model: newBaseValue.model,
      capacity: newBaseValue.capacity,
      baseValue: parseAmountInput(newBaseValue.baseValue),
      isActive: true,
    });
    setNewBaseValue({ model: '', capacity: '', baseValue: '' });
    toast.success('Valor salvo.');
  };

  const startEditingBaseValue = (item: (typeof simulatorTradeInValues)[number]) => {
    setEditingBaseValueId(item.id);
    setEditingBaseValue({
      model: item.model,
      capacity: item.capacity,
      baseValue: String(item.baseValue),
    });
  };

  const cancelEditingBaseValue = () => {
    setEditingBaseValueId(null);
    setEditingBaseValue({ model: '', capacity: '', baseValue: '' });
  };

  const saveEditingBaseValue = async () => {
    if (!editingBaseValueId) return;
    const model = editingBaseValue.model.trim();
    const capacity = editingBaseValue.capacity.trim();
    const baseValue = parseAmountInput(editingBaseValue.baseValue);
    if (!model || !capacity) {
      toast.error('Informe modelo e armazenamento.');
      return;
    }
    if (baseValue < 0) {
      toast.error('Informe um valor válido.');
      return;
    }
    await updateSimulatorTradeInValue(editingBaseValueId, { model, capacity, baseValue });
    cancelEditingBaseValue();
    toast.success('Valor atualizado.');
  };

  const deleteBaseValue = async (item: (typeof simulatorTradeInValues)[number]) => {
    await removeSimulatorTradeInValue(item.id);
    if (editingBaseValueId === item.id) cancelEditingBaseValue();
    toast.success('Valor excluído.');
  };

  const saveAdjustment = async () => {
    await upsertSimulatorTradeInAdjustment({
      label: newAdjustment.label,
      model: newAdjustment.model || null,
      capacity: newAdjustment.capacity || null,
      amountDelta: parseAmountInput(newAdjustment.amountDelta),
      isActive: true,
    });
    setNewAdjustment({ label: '', model: '', capacity: '', amountDelta: '' });
    toast.success('Ajuste salvo.');
  };

  // ─── Render ───────────────────────────────────────────────────────────────
  const resultDeviceLabel =
    desiredMode === 'stock'
      ? (selectedStock ? buildStockLabel(selectedStock) : null)
      : (manualDeviceLabel.trim() || null);

  return (
    <CRMPageFrame title="Simulador" description="Simule trocas com entrada, trade-in e parcelamento.">
      <div className="space-y-4">

        {/* ── iOS Segmented Control — tabs ─────────────────────────────── */}
        <div
          role="tablist"
          className="flex rounded-[11px] bg-slate-100 dark:bg-slate-800/80 p-1 gap-0.5"
        >
          <button
            role="tab"
            type="button"
            aria-selected={activeTab === 'simulation'}
            onClick={() => setActiveTab('simulation')}
            style={{ WebkitTapHighlightColor: 'transparent' }}
            className={`${segBase} ${activeTab === 'simulation' ? segActive : segInactive}`}
          >
            Simulação
          </button>
          {role === 'admin' && (
            <button
              role="tab"
              type="button"
              aria-selected={activeTab === 'settings'}
              onClick={() => setActiveTab('settings')}
              style={{ WebkitTapHighlightColor: 'transparent' }}
              className={`${segBase} ${activeTab === 'settings' ? segActive : segInactive}`}
            >
              Configurações
            </button>
          )}
        </div>

        {/* ════════════════════════════════════════════════════════════════
            SETTINGS TAB
        ════════════════════════════════════════════════════════════════ */}
        {activeTab === 'settings' && role === 'admin' && (
          <section data-testid="simulator-admin-config" className="space-y-6">
            <div className="grid gap-6 lg:grid-cols-2">

              {/* ── Coluna esquerda: valores base ────────────────────── */}
              <div className="space-y-3">

                {/* Formulário de adição */}
                <div className="ios-card p-4 space-y-3">
                  <h2 className="text-base font-bold text-slate-900 dark:text-slate-50">
                    Novo valor de trade-in
                  </h2>
                  <div className="grid gap-3 sm:grid-cols-3">
                    <label className="block space-y-1">
                      <span className="crm-field-label">Modelo</span>
                      <input
                        className="crm-input"
                        placeholder="iPhone 16"
                        value={newBaseValue.model}
                        onChange={(e) =>
                          setNewBaseValue((c) => ({ ...c, model: e.target.value }))
                        }
                      />
                    </label>
                    <label className="block space-y-1">
                      <span className="crm-field-label">Armazenamento</span>
                      <input
                        className="crm-input"
                        placeholder="128GB"
                        value={newBaseValue.capacity}
                        onChange={(e) =>
                          setNewBaseValue((c) => ({ ...c, capacity: e.target.value }))
                        }
                      />
                    </label>
                    <label className="block space-y-1">
                      <span className="crm-field-label">Valor base</span>
                      <input
                        className="crm-input"
                        placeholder="3.000"
                        inputMode="decimal"
                        value={newBaseValue.baseValue}
                        onChange={(e) =>
                          setNewBaseValue((c) => ({ ...c, baseValue: e.target.value }))
                        }
                      />
                    </label>
                  </div>
                  <button
                    type="button"
                    className="crm-btn crm-btn-primary w-full"
                    onClick={() => void saveBaseValue()}
                  >
                    <Plus size={16} aria-hidden="true" />
                    Salvar valor
                  </button>
                </div>

                {/* Lista de valores existentes */}
                <div className="space-y-2">
                  {sortedSimulatorTradeInValues.map((item) => (
                    <div key={item.id} className="ios-card overflow-hidden">
                      {editingBaseValueId === item.id ? (
                        /* Modo edição inline */
                        <div className="p-4 space-y-3">
                          <div className="grid gap-3 sm:grid-cols-3">
                            <label className="block space-y-1">
                              <span className="crm-field-label">Modelo</span>
                              <input
                                aria-label="Modelo do valor base"
                                className="crm-input"
                                value={editingBaseValue.model}
                                onChange={(e) =>
                                  setEditingBaseValue((c) => ({ ...c, model: e.target.value }))
                                }
                              />
                            </label>
                            <label className="block space-y-1">
                              <span className="crm-field-label">Armazenamento</span>
                              <input
                                aria-label="Armazenamento do valor base"
                                className="crm-input"
                                value={editingBaseValue.capacity}
                                onChange={(e) =>
                                  setEditingBaseValue((c) => ({
                                    ...c,
                                    capacity: e.target.value,
                                  }))
                                }
                              />
                            </label>
                            <label className="block space-y-1">
                              <span className="crm-field-label">Valor</span>
                              <input
                                aria-label="Valor base"
                                className="crm-input"
                                inputMode="decimal"
                                value={editingBaseValue.baseValue}
                                onChange={(e) =>
                                  setEditingBaseValue((c) => ({
                                    ...c,
                                    baseValue: e.target.value,
                                  }))
                                }
                              />
                            </label>
                          </div>
                          <div className="flex gap-2">
                            <button
                              type="button"
                              className="crm-btn crm-btn-primary flex-1"
                              onClick={() => void saveEditingBaseValue()}
                            >
                              Salvar edição do valor base
                            </button>
                            <button
                              type="button"
                              className="crm-btn crm-btn-secondary"
                              onClick={cancelEditingBaseValue}
                            >
                              Cancelar
                            </button>
                          </div>
                        </div>
                      ) : (
                        /* Modo exibição */
                        <div className="flex items-center justify-between gap-4 p-4 min-h-[72px]">
                          <div>
                            <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">
                              {item.model} {item.capacity}
                            </p>
                            <p className="text-xl font-black tabular-nums text-brand-600 dark:text-brand-400">
                              {formatSimulatorCurrency(item.baseValue)}
                            </p>
                          </div>
                          <div className="flex items-center gap-0.5 shrink-0">
                            <button
                              type="button"
                              aria-label={`Editar valor ${item.model} ${item.capacity}`}
                              onClick={() => startEditingBaseValue(item)}
                              style={{ WebkitTapHighlightColor: 'transparent' }}
                              className="flex items-center justify-center w-11 h-11 rounded-xl text-slate-400 hover:text-brand-600 hover:bg-brand-50 dark:hover:bg-brand-900/20 transition-colors"
                            >
                              <Pencil size={18} />
                            </button>
                            <button
                              type="button"
                              aria-label={`Excluir valor ${item.model} ${item.capacity}`}
                              onClick={() => setDeletingItem(item)}
                              style={{ WebkitTapHighlightColor: 'transparent' }}
                              className="flex items-center justify-center w-11 h-11 rounded-xl text-red-400 dark:text-red-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                            >
                              <Trash2 size={18} />
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                  {sortedSimulatorTradeInValues.length === 0 && (
                    <div className="text-center py-10 text-slate-400 dark:text-slate-500 text-sm">
                      Nenhum valor cadastrado
                    </div>
                  )}
                </div>
              </div>

              {/* ── Coluna direita: ajustes ──────────────────────────── */}
              <div className="space-y-3">
                <div className="ios-card p-4 space-y-3">
                  <h2 className="text-base font-bold text-slate-900 dark:text-slate-50">
                    Novo ajuste
                  </h2>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <label className="block space-y-1">
                      <span className="crm-field-label">Descrição</span>
                      <input
                        className="crm-input"
                        placeholder="Bateria trocada"
                        value={newAdjustment.label}
                        onChange={(e) =>
                          setNewAdjustment((c) => ({ ...c, label: e.target.value }))
                        }
                      />
                    </label>
                    <label className="block space-y-1">
                      <span className="crm-field-label">Valor +/-</span>
                      <input
                        className="crm-input"
                        placeholder="-200 ou +100"
                        inputMode="decimal"
                        value={newAdjustment.amountDelta}
                        onChange={(e) =>
                          setNewAdjustment((c) => ({ ...c, amountDelta: e.target.value }))
                        }
                      />
                    </label>
                    <label className="block space-y-1">
                      <span className="crm-field-label">Modelo opcional</span>
                      <input
                        className="crm-input"
                        placeholder="iPhone 15"
                        value={newAdjustment.model}
                        onChange={(e) =>
                          setNewAdjustment((c) => ({ ...c, model: e.target.value }))
                        }
                      />
                    </label>
                    <label className="block space-y-1">
                      <span className="crm-field-label">Armazenamento opcional</span>
                      <input
                        className="crm-input"
                        placeholder="128GB"
                        value={newAdjustment.capacity}
                        onChange={(e) =>
                          setNewAdjustment((c) => ({ ...c, capacity: e.target.value }))
                        }
                      />
                    </label>
                  </div>
                  <button
                    type="button"
                    className="crm-btn crm-btn-primary w-full"
                    onClick={() => void saveAdjustment()}
                  >
                    <Plus size={16} aria-hidden="true" />
                    Salvar ajuste
                  </button>
                </div>

                <div className="space-y-2">
                  {simulatorTradeInAdjustments.map((item) => (
                    <div
                      key={item.id}
                      className="ios-card flex items-center justify-between gap-4 p-4 min-h-[56px]"
                    >
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-slate-700 dark:text-slate-200 truncate">
                          {item.label}
                        </p>
                        {(item.model || item.capacity) && (
                          <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">
                            {[item.model, item.capacity].filter(Boolean).join(' ')}
                          </p>
                        )}
                      </div>
                      <strong
                        className={`text-base font-bold tabular-nums shrink-0 ${
                          item.amountDelta >= 0
                            ? 'text-emerald-600 dark:text-emerald-400'
                            : 'text-red-600 dark:text-red-400'
                        }`}
                      >
                        {item.amountDelta >= 0 ? '+' : ''}
                        {formatSimulatorCurrency(item.amountDelta)}
                      </strong>
                    </div>
                  ))}
                  {simulatorTradeInAdjustments.length === 0 && (
                    <div className="text-center py-8 text-slate-400 dark:text-slate-500 text-sm">
                      Nenhum ajuste cadastrado
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Confirmação de exclusão */}
            <ConfirmDialog
              open={deletingItem !== null}
              onClose={() => setDeletingItem(null)}
              title="Excluir valor de trade-in"
              description={
                deletingItem
                  ? `Excluir o valor base de ${deletingItem.model} ${deletingItem.capacity} (${formatSimulatorCurrency(deletingItem.baseValue)})?`
                  : undefined
              }
              confirmLabel="Excluir"
              cancelLabel="Cancelar"
              variant="danger"
              onConfirm={() => {
                const item = deletingItem;
                if (item) void deleteBaseValue(item);
              }}
            />
          </section>
        )}

        {/* ════════════════════════════════════════════════════════════════
            SIMULATION TAB
        ════════════════════════════════════════════════════════════════ */}
        {activeTab === 'simulation' && (
          <section className="grid gap-4 lg:grid-cols-[1fr_320px] items-start">

            {/* ── Coluna de formulário ─────────────────────────────────── */}
            {/* pb-44 no mobile para não esconder conteúdo sob o painel fixo */}
            <div className="space-y-4 pb-44 lg:pb-0">

              {/* 1. Aparelho desejado */}
              <div className="ios-card p-4 space-y-3">
                <h3 className="flex items-center gap-2 text-sm font-bold text-slate-900 dark:text-slate-50">
                  <Smartphone size={15} className="text-brand-500" aria-hidden="true" />
                  Aparelho desejado
                </h3>

                {/* Mini segmented: estoque vs manual */}
                <div
                  role="tablist"
                  className="flex rounded-[9px] bg-slate-100 dark:bg-slate-800/70 p-0.5 gap-0.5"
                >
                  <button
                    role="tab"
                    type="button"
                    aria-selected={desiredMode === 'stock'}
                    onClick={() => setDesiredMode('stock')}
                    style={{ WebkitTapHighlightColor: 'transparent' }}
                    className={`${segSmBase} ${desiredMode === 'stock' ? segActive : segInactive}`}
                  >
                    Do estoque
                  </button>
                  <button
                    role="tab"
                    type="button"
                    aria-selected={desiredMode === 'manual'}
                    onClick={() => setDesiredMode('manual')}
                    style={{ WebkitTapHighlightColor: 'transparent' }}
                    className={`${segSmBase} ${desiredMode === 'manual' ? segActive : segInactive}`}
                  >
                    Manual
                  </button>
                </div>

                {desiredMode === 'stock' ? (
                  <label className="block space-y-1.5">
                    <span className="crm-field-label">Aparelho do estoque</span>
                    <select
                      className="crm-input"
                      value={selectedStockId}
                      onChange={(e) => setSelectedStockId(e.target.value)}
                    >
                      <option value="">Selecione</option>
                      {availableStock.map((item: StockItem) => (
                        <option key={item.id} value={item.id}>
                          {buildStockLabel(item)}
                        </option>
                      ))}
                    </select>
                  </label>
                ) : (
                  <div className="grid gap-3 sm:grid-cols-[1fr_160px]">
                    <label className="block space-y-1.5">
                      <span className="crm-field-label">Aparelho manual</span>
                      <input
                        className="crm-input"
                        placeholder="iPhone 16 Pro Max 256GB"
                        value={manualDeviceLabel}
                        onChange={(e) => setManualDeviceLabel(e.target.value)}
                      />
                    </label>
                    <label className="block space-y-1.5">
                      <span className="crm-field-label">Preço manual</span>
                      <input
                        className="crm-input"
                        inputMode="decimal"
                        placeholder="5.000"
                        value={manualDevicePrice}
                        onChange={(e) => setManualDevicePrice(e.target.value)}
                      />
                    </label>
                  </div>
                )}
              </div>

              {/* 2. Trade-in — colapsável */}
              <div className="ios-card overflow-hidden">
                <button
                  type="button"
                  onClick={() => setTradeInOpen((o) => !o)}
                  style={{ WebkitTapHighlightColor: 'transparent' }}
                  className="flex items-center justify-between w-full px-4 py-3 text-left min-h-[52px] hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors"
                >
                  <span className="text-sm font-bold text-slate-900 dark:text-slate-50">
                    📲 Trade-in do cliente
                  </span>
                  <div className="flex items-center gap-2">
                    {tradeInModel && (
                      <span className="text-xs font-medium text-brand-600 dark:text-brand-400 bg-brand-50 dark:bg-brand-900/20 px-2 py-0.5 rounded-full">
                        {tradeInModel}
                      </span>
                    )}
                    <ChevronDown
                      size={16}
                      aria-hidden="true"
                      className={`text-slate-400 transition-transform duration-200 ${
                        tradeInOpen ? 'rotate-180' : ''
                      }`}
                    />
                  </div>
                </button>

                <div
                  className={`overflow-hidden transition-all duration-300 ease-in-out ${
                    tradeInOpen ? 'max-h-[700px] opacity-100' : 'max-h-0 opacity-0'
                  }`}
                >
                  <div className="px-4 pb-4 pt-1 space-y-3 border-t border-slate-100 dark:border-slate-800">
                    <div className="grid gap-3 sm:grid-cols-2">
                      <label className="block space-y-1.5">
                        <span className="crm-field-label">Modelo do trade-in</span>
                        <select
                          className="crm-input"
                          value={tradeInModel}
                          onChange={(e) => {
                            setTradeInModel(e.target.value);
                            setTradeInCapacity('');
                          }}
                        >
                          <option value="">Selecione</option>
                          {modelOptions.map((model) => (
                            <option key={model} value={model}>
                              {model}
                            </option>
                          ))}
                        </select>
                      </label>
                      <label className="block space-y-1.5">
                        <span className="crm-field-label">Armazenamento</span>
                        <select
                          className="crm-input"
                          value={tradeInCapacity}
                          onChange={(e) => setTradeInCapacity(e.target.value)}
                        >
                          <option value="">Selecione</option>
                          {capacityOptions.map((capacity) => (
                            <option key={capacity} value={capacity}>
                              {capacity}
                            </option>
                          ))}
                        </select>
                      </label>
                    </div>

                    <label className="block space-y-1.5">
                      <span className="crm-field-label">Cor do trade-in</span>
                      <input
                        className="crm-input"
                        placeholder="Natural Titanium"
                        value={tradeInColor}
                        onChange={(e) => setTradeInColor(e.target.value)}
                      />
                    </label>

                    {applicableAdjustments.length > 0 && (
                      <div className="space-y-2">
                        <p className="crm-field-label">Ajustes de condição</p>
                        <div className="grid gap-2">
                          {applicableAdjustments.map((item) => {
                            const isSelected = selectedAdjustmentIds.includes(item.id);
                            return (
                              <button
                                key={item.id}
                                type="button"
                                role="checkbox"
                                aria-checked={isSelected}
                                onClick={() => toggleAdjustment(item.id)}
                                style={{ WebkitTapHighlightColor: 'transparent' }}
                                className={`flex items-center justify-between p-3 rounded-xl border text-left transition-all duration-150 min-h-[44px] ${
                                  isSelected
                                    ? 'border-brand-500 bg-brand-50 dark:bg-brand-900/20 dark:border-brand-400'
                                    : 'border-slate-200 dark:border-slate-700 hover:border-slate-300'
                                }`}
                              >
                                <span
                                  className={`text-sm font-medium ${
                                    isSelected
                                      ? 'text-brand-700 dark:text-brand-300'
                                      : 'text-slate-700 dark:text-slate-200'
                                  }`}
                                >
                                  {item.label}
                                </span>
                                <span
                                  className={`text-sm font-semibold tabular-nums shrink-0 ${
                                    item.amountDelta >= 0
                                      ? 'text-emerald-600 dark:text-emerald-400'
                                      : 'text-red-500 dark:text-red-400'
                                  }`}
                                >
                                  {item.amountDelta >= 0 ? '+' : ''}
                                  {formatSimulatorCurrency(item.amountDelta)}
                                </span>
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    <label className="block space-y-1.5">
                      <span className="crm-field-label">Valor final recebido</span>
                      <div className="relative">
                        <span className="pointer-events-none select-none absolute left-3 top-1/2 -translate-y-1/2 text-sm font-semibold text-slate-400">
                          R$
                        </span>
                        <input
                          className="crm-input pl-10"
                          inputMode="decimal"
                          placeholder="0,00"
                          value={manualTradeInValue}
                          onChange={(e) => setManualTradeInValue(e.target.value)}
                        />
                      </div>
                    </label>
                  </div>
                </div>
              </div>

              {/* 3. Entrada (Pix / dinheiro) */}
              <div className="ios-card p-4 space-y-3">
                <h3 className="text-sm font-bold text-slate-900 dark:text-slate-50">
                  💰 Entrada
                </h3>
                <div className="flex items-end gap-2">
                  <label className="flex-1 block space-y-1.5">
                    <span className="crm-field-label">Valor da entrada</span>
                    <div className="relative">
                      <span className="pointer-events-none select-none absolute left-3 top-1/2 -translate-y-1/2 text-sm font-semibold text-slate-400">
                        R$
                      </span>
                      <input
                        className="crm-input pl-10"
                        inputMode="decimal"
                        placeholder="0,00"
                        value={entryAmount}
                        onChange={(e) => setEntryAmount(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') addEntry();
                        }}
                      />
                    </div>
                  </label>
                  <button
                    type="button"
                    aria-label="Adicionar entrada"
                    onClick={addEntry}
                    style={{ WebkitTapHighlightColor: 'transparent' }}
                    className="flex items-center justify-center w-11 h-11 rounded-full bg-brand-500 text-white hover:bg-brand-600 active:opacity-70 transition-colors shrink-0"
                  >
                    <Plus size={20} aria-hidden="true" />
                  </button>
                </div>

                {entries.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {entries.map((entry, index) => (
                      <div
                        key={`${entry.type}-${index}`}
                        className="flex items-center gap-1.5 pl-3 pr-2 py-1.5 rounded-full bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 text-sm font-medium text-emerald-700 dark:text-emerald-300"
                      >
                        <span>
                          {entry.type}: {formatSimulatorCurrency(entry.amount)}
                        </span>
                        <button
                          type="button"
                          aria-label={`Remover entrada de ${formatSimulatorCurrency(entry.amount)}`}
                          onClick={() =>
                            setEntries((current) => current.filter((_, i) => i !== index))
                          }
                          style={{ WebkitTapHighlightColor: 'transparent' }}
                          className="flex items-center justify-center w-5 h-5 rounded-full hover:bg-emerald-200 dark:hover:bg-emerald-800/60 transition-colors"
                        >
                          <X size={12} aria-hidden="true" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* 4. Pagamento */}
              <div className="ios-card p-4 space-y-4">
                <h3 className="text-sm font-bold text-slate-900 dark:text-slate-50">
                  💳 Pagamento
                </h3>

                {/* Bandeira: pill toggle */}
                <div className="space-y-1.5">
                  <p className="crm-field-label">Bandeira</p>
                  <div className="flex gap-2">
                    {(
                      [
                        { value: 'visa_master', label: 'Visa / Master' },
                        { value: 'outras', label: 'Outras' },
                      ] as const
                    ).map((opt) => (
                      <button
                        key={opt.value}
                        type="button"
                        onClick={() => setCardBrand(opt.value)}
                        style={{ WebkitTapHighlightColor: 'transparent' }}
                        className={`flex-1 py-2 px-4 rounded-full text-sm font-semibold min-h-[40px] border transition-all duration-150 ${
                          cardBrand === opt.value
                            ? 'bg-brand-500 border-brand-500 text-white shadow-sm'
                            : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:border-brand-300 dark:hover:border-brand-600'
                        }`}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* iOS Switch para dividir cartões */}
                <IOSSwitch
                  id="split-cards-label"
                  checked={splitCards}
                  onChange={setSplitCards}
                  label="Dividir em dois cartões"
                />

                {/* Split form — animação max-height */}
                <div
                  className={`overflow-hidden transition-all duration-300 ease-in-out ${
                    splitCards ? 'max-h-[600px] opacity-100' : 'max-h-0 opacity-0'
                  }`}
                >
                  <div className="space-y-3 pt-1 mt-1 border-t border-slate-100 dark:border-slate-800">
                    <label className="block space-y-1.5">
                      <span className="crm-field-label">Parcelas da divisão</span>
                      <select
                        className="crm-input"
                        value={splitInstallments}
                        onChange={(e) => setSplitInstallments(Number(e.target.value))}
                      >
                        {quote.installments.map((item) => (
                          <option key={item.installments} value={item.installments}>
                            {item.installments}x
                          </option>
                        ))}
                      </select>
                    </label>

                    {/* Cartão 1 */}
                    <div className="grid gap-3 sm:grid-cols-2">
                      <label className="block space-y-1.5">
                        <span className="crm-field-label">Bandeira do cartão 1</span>
                        <select
                          className="crm-input"
                          value={splitCardOne.brand}
                          onChange={(e) =>
                            setSplitCardOne((c) => ({ ...c, brand: e.target.value }))
                          }
                        >
                          <option value="visa">Visa</option>
                          <option value="master">Master</option>
                          <option value="elo">Elo</option>
                          <option value="hipercard">Hipercard</option>
                          <option value="amex">Amex</option>
                        </select>
                      </label>
                      <label className="block space-y-1.5">
                        <span className="crm-field-label">Valor do cartão 1</span>
                        <input
                          className="crm-input"
                          inputMode="decimal"
                          placeholder="0,00"
                          value={splitCardOne.amount}
                          onChange={(e) =>
                            setSplitCardOne((c) => ({ ...c, amount: e.target.value }))
                          }
                        />
                      </label>
                    </div>

                    {/* Cartão 2 */}
                    <div className="grid gap-3 sm:grid-cols-2">
                      <label className="block space-y-1.5">
                        <span className="crm-field-label">Bandeira do cartão 2</span>
                        <select
                          className="crm-input"
                          value={splitCardTwo.brand}
                          onChange={(e) =>
                            setSplitCardTwo((c) => ({ ...c, brand: e.target.value }))
                          }
                        >
                          <option value="visa">Visa</option>
                          <option value="master">Master</option>
                          <option value="elo">Elo</option>
                          <option value="hipercard">Hipercard</option>
                          <option value="amex">Amex</option>
                        </select>
                      </label>
                      <label className="block space-y-1.5">
                        <span className="crm-field-label">Valor do cartão 2</span>
                        <input
                          className="crm-input"
                          inputMode="decimal"
                          placeholder="0,00"
                          value={splitCardTwo.amount}
                          onChange={(e) =>
                            setSplitCardTwo((c) => ({ ...c, amount: e.target.value }))
                          }
                        />
                      </label>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* ── Resultado: aside desktop ─────────────────────────────── */}
            <aside className="hidden lg:block sticky top-4 self-start rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 overflow-hidden shadow-ios26-md">
              <div className="p-5 space-y-4">
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                    Aparelho
                  </p>
                  <p className="mt-0.5 text-sm font-semibold text-slate-800 dark:text-slate-100 leading-snug">
                    {resultDeviceLabel ?? 'Selecione um aparelho'}
                  </p>
                </div>

                {quote.ok ? (
                  <>
                    <div>
                      <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                        Valor líquido financiado
                      </p>
                      <p className="mt-0.5 text-[2.25rem] font-black leading-tight tabular-nums text-brand-700 dark:text-brand-300">
                        {formatSimulatorCurrency(quote.summary.cardNetAmount)}
                      </p>
                    </div>

                    {selectedInstallment && (
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        Total com taxa ({splitInstallments}x):{' '}
                        <strong className="text-slate-700 dark:text-slate-200 tabular-nums">
                          {formatSimulatorCurrency(selectedInstallment.customerAmount)}
                        </strong>
                      </p>
                    )}

                    {paymentRevision && (
                      <div className="rounded-xl bg-slate-50 dark:bg-slate-900 p-3 space-y-1.5">
                        <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                          Divisão em cartões
                        </p>
                        {paymentRevision.cards.map((card) => (
                          <div
                            key={`${card.brand}-${card.total}`}
                            className="flex items-center justify-between text-sm"
                          >
                            <span className="text-slate-600 dark:text-slate-300">{card.brand}</span>
                            <strong className="tabular-nums text-slate-900 dark:text-white">
                              {splitInstallments}x de{' '}
                              {formatSimulatorCurrency(card.installmentAmount)}
                            </strong>
                          </div>
                        ))}
                      </div>
                    )}

                    <div className="space-y-1.5">
                      <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                        Parcelas
                      </p>
                      <div className="grid grid-cols-2 gap-1">
                        {quote.installments.map((item) => (
                          <div
                            key={item.installments}
                            className="flex items-center justify-between rounded-lg bg-slate-50 dark:bg-slate-900 px-2.5 py-2"
                          >
                            <span className="text-xs font-semibold text-slate-400 dark:text-slate-500">
                              {item.installments}x
                            </span>
                            <strong className="text-sm font-bold tabular-nums text-slate-900 dark:text-white">
                              {formatSimulatorCurrency(item.installmentAmount)}
                            </strong>
                          </div>
                        ))}
                      </div>
                    </div>
                  </>
                ) : (
                  <div className="flex flex-col items-center text-center py-6 gap-3">
                    <div className="w-12 h-12 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center">
                      <Smartphone size={22} className="text-slate-400" aria-hidden="true" />
                    </div>
                    <p className="text-sm text-slate-400 dark:text-slate-500 max-w-[180px]">
                      Preencha os campos acima para simular
                    </p>
                  </div>
                )}

                <button
                  type="button"
                  className="crm-btn crm-btn-primary w-full"
                  disabled={!quote.ok}
                  onClick={() => void copyMessage()}
                >
                  <Clipboard size={15} aria-hidden="true" />
                  Copiar mensagem
                </button>
              </div>
            </aside>

            {/* ── Resultado: painel fixo mobile ────────────────────────── */}
            <div className="fixed bottom-0 inset-x-0 z-20 lg:hidden safe-area-bottom">
              <div className="mx-3 mb-3 rounded-2xl border border-slate-200/80 dark:border-slate-700/80 liquid-glass-strong shadow-ios26-lg overflow-hidden">
                <div className="px-4 pt-3 pb-3">
                  {quote.ok ? (
                    <div className="flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                          Valor líquido
                        </p>
                        <p className="text-2xl font-black tabular-nums leading-tight text-brand-700 dark:text-brand-300">
                          {formatSimulatorCurrency(quote.summary.cardNetAmount)}
                        </p>
                        {quote.installments.length > 0 && (
                          <p className="text-xs text-slate-500 dark:text-slate-400 tabular-nums truncate">
                            1x {formatSimulatorCurrency(quote.installments[0].installmentAmount)}
                            {quote.installments.length >= 12 && (
                              <>
                                {' '}· 12x{' '}
                                {formatSimulatorCurrency(
                                  quote.installments[11].installmentAmount,
                                )}
                              </>
                            )}
                          </p>
                        )}
                      </div>
                      <button
                        type="button"
                        className="crm-btn crm-btn-primary shrink-0"
                        onClick={() => void copyMessage()}
                      >
                        <Clipboard size={15} aria-hidden="true" />
                        Copiar
                      </button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-3 py-1">
                      <div className="w-9 h-9 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center shrink-0">
                        <Smartphone size={17} className="text-slate-400" aria-hidden="true" />
                      </div>
                      <p className="text-sm text-slate-400 dark:text-slate-500">
                        Preencha os campos para simular
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </div>

          </section>
        )}

      </div>
    </CRMPageFrame>
  );
};

export default SimulatorPage;
