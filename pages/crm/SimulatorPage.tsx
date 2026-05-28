import React, { useEffect, useMemo, useState } from 'react';
import CRMPageFrame from '../../components/crm/CRMPageFrame';
import { useAuth } from '../../contexts/AuthContext';
import { useData } from '../../services/dataContext';
import { useToast } from '../../components/ui/ToastProvider';
import { StockStatus, type StockItem } from '../../types';
import {
  calculateSimulatorQuote,
  formatSimulatorCurrency,
  type SimulatorCardBrand,
  type SimulatorEntry,
} from '../../utils/simulator';

const buildStockLabel = (item: StockItem) => [item.model, item.capacity, item.color].filter(Boolean).join(' ');
const parseAmountInput = (value: string) => Number(value.replace(/\./g, '').replace(',', '.')) || 0;

const SimulatorPage: React.FC = () => {
  const {
    stock = [],
    simulatorTradeInValues = [],
    simulatorTradeInAdjustments = [],
    cardFeeSettings,
    upsertSimulatorTradeInValue,
    upsertSimulatorTradeInAdjustment,
  } = useData();
  const { role } = useAuth();
  const toast = useToast();
  const availableStock = useMemo(
    () => stock.filter((item: StockItem) => item.status === StockStatus.AVAILABLE || item.status === StockStatus.RESERVED),
    [stock],
  );
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
  const [activeTab, setActiveTab] = useState<'simulation' | 'settings'>('simulation');
  const [newBaseValue, setNewBaseValue] = useState({ model: '', capacity: '', baseValue: '' });
  const [newAdjustment, setNewAdjustment] = useState({ label: '', model: '', capacity: '', amountDelta: '' });

  useEffect(() => {
    if (role === 'admin') setActiveTab('settings');
  }, [role]);

  const selectedStock = availableStock.find((item: StockItem) => item.id === selectedStockId) || null;
  const modelOptions = useMemo(
    () => Array.from(new Set(simulatorTradeInValues.filter((item) => item.isActive !== false).map((item) => item.model))).sort(),
    [simulatorTradeInValues],
  );
  const capacityOptions = useMemo(
    () => Array.from(new Set(
      simulatorTradeInValues
        .filter((item) => item.isActive !== false && item.model === tradeInModel)
        .map((item) => item.capacity),
    )).sort(),
    [simulatorTradeInValues, tradeInModel],
  );
  const applicableAdjustments = useMemo(
    () => simulatorTradeInAdjustments.filter((item) => {
      if (item.isActive === false) return false;
      if (item.model && item.model !== tradeInModel) return false;
      if (item.capacity && item.capacity !== tradeInCapacity) return false;
      return true;
    }),
    [simulatorTradeInAdjustments, tradeInCapacity, tradeInModel],
  );
  const desiredDevice = desiredMode === 'stock'
    ? {
        label: selectedStock ? buildStockLabel(selectedStock) : '',
        price: selectedStock?.sellPrice || 0,
      }
    : {
        label: manualDeviceLabel,
        price: parseAmountInput(manualDevicePrice),
      };

  const quote = useMemo(() => calculateSimulatorQuote({
    desiredDevice,
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
  ]);

  useEffect(() => {
    const baseRule = simulatorTradeInValues.find((item) => item.isActive !== false && item.model === tradeInModel && item.capacity === tradeInCapacity);
    if (!baseRule) return;
    const adjustmentTotal = applicableAdjustments
      .filter((item) => selectedAdjustmentIds.includes(item.id))
      .reduce((sum, item) => sum + item.amountDelta, 0);
    setManualTradeInValue(String(Math.max(0, baseRule.baseValue + adjustmentTotal)));
  }, [applicableAdjustments, selectedAdjustmentIds, simulatorTradeInValues, tradeInCapacity, tradeInModel]);

  const addEntry = () => {
    const amount = parseAmountInput(entryAmount);
    if (amount <= 0) return;
    setEntries((current) => [...current, { type: 'Pix', amount }]);
    setEntryAmount('');
  };

  const toggleAdjustment = (id: string) => {
    setSelectedAdjustmentIds((current) => (
      current.includes(id) ? current.filter((item) => item !== id) : [...current, id]
    ));
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

  return (
    <CRMPageFrame title="Simulador" description="Simule trocas com entrada, trade-in e parcelamento.">
      <div className="space-y-4">
        <div className="flex flex-wrap gap-2">
          <button type="button" className="crm-btn crm-btn-primary" onClick={() => setActiveTab('simulation')}>
            Simulação
          </button>
          {role === 'admin' && (
            <button type="button" className="crm-btn crm-btn-secondary" onClick={() => setActiveTab('settings')}>
              Configurações
            </button>
          )}
        </div>

        {activeTab === 'settings' && role === 'admin' ? (
          <section data-testid="simulator-admin-config" className="crm-card grid gap-5 p-4 lg:grid-cols-2">
            <div className="space-y-3">
            <h2 className="text-lg font-bold text-slate-950 dark:text-slate-50">Configurações</h2>
              <div className="grid gap-2 sm:grid-cols-3">
                <input className="crm-input" placeholder="Modelo" value={newBaseValue.model} onChange={(event) => setNewBaseValue((current) => ({ ...current, model: event.target.value }))} />
                <input className="crm-input" placeholder="Armazenamento" value={newBaseValue.capacity} onChange={(event) => setNewBaseValue((current) => ({ ...current, capacity: event.target.value }))} />
                <input className="crm-input" placeholder="Valor" value={newBaseValue.baseValue} onChange={(event) => setNewBaseValue((current) => ({ ...current, baseValue: event.target.value }))} />
              </div>
              <button type="button" className="crm-btn crm-btn-primary" onClick={() => void saveBaseValue()}>Salvar valor</button>
            <div className="grid gap-2 text-sm text-slate-600 dark:text-slate-300">
              {simulatorTradeInValues.map((item) => (
                <div key={item.id} className="flex items-center justify-between rounded-xl border border-slate-200 p-3 dark:border-slate-800">
                  <span>{item.model} {item.capacity}</span>
                  <strong>{formatSimulatorCurrency(item.baseValue)}</strong>
                </div>
              ))}
            </div>
            </div>
            <div className="space-y-3">
              <h2 className="text-lg font-bold text-slate-950 dark:text-slate-50">Ajustes</h2>
              <div className="grid gap-2 sm:grid-cols-2">
                <input className="crm-input" placeholder="Descrição" value={newAdjustment.label} onChange={(event) => setNewAdjustment((current) => ({ ...current, label: event.target.value }))} />
                <input className="crm-input" placeholder="Valor +/-" value={newAdjustment.amountDelta} onChange={(event) => setNewAdjustment((current) => ({ ...current, amountDelta: event.target.value }))} />
                <input className="crm-input" placeholder="Modelo opcional" value={newAdjustment.model} onChange={(event) => setNewAdjustment((current) => ({ ...current, model: event.target.value }))} />
                <input className="crm-input" placeholder="Armazenamento opcional" value={newAdjustment.capacity} onChange={(event) => setNewAdjustment((current) => ({ ...current, capacity: event.target.value }))} />
              </div>
              <button type="button" className="crm-btn crm-btn-primary" onClick={() => void saveAdjustment()}>Salvar ajuste</button>
              <div className="grid gap-2 text-sm text-slate-600 dark:text-slate-300">
                {simulatorTradeInAdjustments.map((item) => (
                  <div key={item.id} className="flex items-center justify-between rounded-xl border border-slate-200 p-3 dark:border-slate-800">
                    <span>{item.label}</span>
                    <strong>{formatSimulatorCurrency(item.amountDelta)}</strong>
                  </div>
                ))}
              </div>
            </div>
          </section>
        ) : (
          <section className="crm-card grid gap-4 p-4 lg:grid-cols-[minmax(0,1fr)_minmax(280px,360px)]">
            <div className="space-y-4">
              <div className="flex flex-wrap gap-2">
                <button type="button" className={`crm-btn ${desiredMode === 'stock' ? 'crm-btn-primary' : 'crm-btn-secondary'}`} onClick={() => setDesiredMode('stock')}>
                  Estoque
                </button>
                <button type="button" className={`crm-btn ${desiredMode === 'manual' ? 'crm-btn-primary' : 'crm-btn-secondary'}`} onClick={() => setDesiredMode('manual')}>
                  Manual
                </button>
              </div>
              {desiredMode === 'stock' ? (
              <label className="block space-y-1.5">
                <span className="crm-field-label">Aparelho do estoque</span>
                <select className="crm-input" value={selectedStockId} onChange={(event) => setSelectedStockId(event.target.value)}>
                  <option value="">Selecione</option>
                  {availableStock.map((item: StockItem) => (
                    <option key={item.id} value={item.id}>{buildStockLabel(item)}</option>
                  ))}
                </select>
              </label>
              ) : (
                <div className="grid gap-3 sm:grid-cols-[1fr_160px]">
                  <label className="block space-y-1.5">
                    <span className="crm-field-label">Aparelho manual</span>
                    <input className="crm-input" value={manualDeviceLabel} onChange={(event) => setManualDeviceLabel(event.target.value)} />
                  </label>
                  <label className="block space-y-1.5">
                    <span className="crm-field-label">Preço manual</span>
                    <input className="crm-input" inputMode="decimal" value={manualDevicePrice} onChange={(event) => setManualDevicePrice(event.target.value)} />
                  </label>
                </div>
              )}

              <div className="grid gap-3 sm:grid-cols-2">
                <label className="block space-y-1.5">
                  <span className="crm-field-label">Modelo do trade-in</span>
                  <select className="crm-input" value={tradeInModel} onChange={(event) => { setTradeInModel(event.target.value); setTradeInCapacity(''); }}>
                    <option value="">Selecione</option>
                    {modelOptions.map((model) => <option key={model} value={model}>{model}</option>)}
                  </select>
                </label>
                <label className="block space-y-1.5">
                  <span className="crm-field-label">Armazenamento</span>
                  <select className="crm-input" value={tradeInCapacity} onChange={(event) => setTradeInCapacity(event.target.value)}>
                    <option value="">Selecione</option>
                    {capacityOptions.map((capacity) => <option key={capacity} value={capacity}>{capacity}</option>)}
                  </select>
                </label>
              </div>

              <label className="block space-y-1.5">
                <span className="crm-field-label">Cor do trade-in</span>
                <input className="crm-input" value={tradeInColor} onChange={(event) => setTradeInColor(event.target.value)} />
              </label>

              {applicableAdjustments.length > 0 && (
                <div className="space-y-2">
                  <p className="crm-field-label">Ajustes</p>
                  {applicableAdjustments.map((item) => (
                    <label key={item.id} className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-200">
                      <input
                        type="checkbox"
                        checked={selectedAdjustmentIds.includes(item.id)}
                        onChange={() => toggleAdjustment(item.id)}
                      />
                      {item.label}
                    </label>
                  ))}
                </div>
              )}

              <label className="block space-y-1.5">
                <span className="crm-field-label">Valor final recebido</span>
                <input className="crm-input" inputMode="decimal" value={manualTradeInValue} onChange={(event) => setManualTradeInValue(event.target.value)} />
              </label>

              <div className="flex flex-wrap items-end gap-2">
                <label className="block flex-1 space-y-1.5">
                  <span className="crm-field-label">Valor da entrada</span>
                  <input className="crm-input" inputMode="decimal" value={entryAmount} onChange={(event) => setEntryAmount(event.target.value)} />
                </label>
                <button type="button" className="crm-btn crm-btn-secondary" onClick={addEntry}>
                  Adicionar entrada
                </button>
              </div>
              {entries.map((entry, index) => (
                <div key={`${entry.type}-${index}`} className="flex items-center justify-between rounded-xl bg-slate-50 px-3 py-2 text-sm dark:bg-slate-900">
                  <span>{entry.type}: {formatSimulatorCurrency(entry.amount)}</span>
                  <button type="button" className="text-slate-500" onClick={() => setEntries((current) => current.filter((_, itemIndex) => itemIndex !== index))}>Remover</button>
                </div>
              ))}
              <label className="block space-y-1.5">
                <span className="crm-field-label">Bandeira</span>
                <select className="crm-input" value={cardBrand} onChange={(event) => setCardBrand(event.target.value as SimulatorCardBrand)}>
                  <option value="visa_master">Visa / Master</option>
                  <option value="outras">Outras</option>
                </select>
              </label>
            </div>

            <aside className="space-y-3 rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-950">
              <p className="text-sm font-bold text-slate-950 dark:text-slate-50">{selectedStock ? buildStockLabel(selectedStock) : 'Selecione um aparelho'}</p>
              <p className="text-2xl font-black text-brand-700 dark:text-brand-200">{formatSimulatorCurrency(quote.summary.cardNetAmount)}</p>
              {quote.installments.slice(0, 6).map((item) => (
                <div key={item.installments} className="flex justify-between text-sm">
                  <span>{item.installments}x</span>
                  <strong>{formatSimulatorCurrency(item.installmentAmount)}</strong>
                </div>
              ))}
              <button type="button" className="crm-btn crm-btn-primary w-full" onClick={() => void copyMessage()}>
                Copiar mensagem
              </button>
            </aside>
          </section>
        )}
      </div>
    </CRMPageFrame>
  );
};

export default SimulatorPage;
