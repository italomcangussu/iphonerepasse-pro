import React, { useEffect, useMemo, useState } from 'react';
import { AnimatePresence, m, useReducedMotion } from 'framer-motion';
import { Battery, Edit, Filter, Plus, Search, Smartphone, X } from 'lucide-react';
import Modal from '../components/ui/Modal';
import { useToast } from '../components/ui/ToastProvider';
import { useData } from '../services/dataContext';
import { Condition, StockItem, StockStatus } from '../types';
import { StockFormModal } from '../components/StockFormModal';
import { StockDetailsModal } from '../components/StockDetailsModal';
import { trackUxEvent } from '../services/telemetry';
import { iosFastEase, iosSpring, iosStagger } from '../components/motion/transitions';

const DEFAULT_LIST_STATUSES: StockStatus[] = [StockStatus.AVAILABLE, StockStatus.RESERVED, StockStatus.SOLD];
const DEFAULT_PREP_STATUSES: StockStatus[] = [StockStatus.PREPARATION];
const QUICK_STORE_FILTERS = [
  { id: 'all', label: 'Loja' },
  { id: 'city:sobral', label: 'Sobral' },
  { id: 'city:fortaleza', label: 'Fortaleza' }
] as const;
const formatCurrency = (value: number) => value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

const Inventory: React.FC = () => {
  const { stock, removeStockItem, updateStockItem, stores } = useData();
  const toast = useToast();
  const reducedMotion = useReducedMotion();

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedEditItem, setSelectedEditItem] = useState<StockItem | undefined>(undefined);
  const [selectedDetailItem, setSelectedDetailItem] = useState<StockItem | undefined>(undefined);
  const [isDetailsOpen, setIsDetailsOpen] = useState(false);
  const [isSendingToSale, setIsSendingToSale] = useState(false);

  const [activeTab, setActiveTab] = useState<'list' | 'prep' | 'custom'>('list');
  const [searchTerm, setSearchTerm] = useState('');

  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [statusFilter, setStatusFilter] = useState<StockStatus[]>(DEFAULT_LIST_STATUSES);
  const [conditionFilter, setConditionFilter] = useState<Condition | 'all'>('all');
  const [storeFilter, setStoreFilter] = useState<string>('all');
  const [inlineError, setInlineError] = useState<string | null>(null);

  const filteredStock = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    return stock.filter((item) => {
      const matchesSearch =
        q.length === 0 ||
        item.model.toLowerCase().includes(q) ||
        (item.imei || '').toLowerCase().includes(q);

      const matchesStatus = statusFilter.includes(item.status);
      const matchesCondition = conditionFilter === 'all' ? true : item.condition === conditionFilter;
      const matchesStore = (() => {
        if (storeFilter === 'all') return true;
        if (storeFilter.startsWith('city:')) {
          const cityFilter = storeFilter.replace('city:', '').toLowerCase();
          const storeCity = stores.find((store) => store.id === item.storeId)?.city?.toLowerCase() || '';
          return storeCity.includes(cityFilter);
        }
        return item.storeId === storeFilter;
      })();

      return matchesSearch && matchesStatus && matchesCondition && matchesStore;
    });
  }, [stock, searchTerm, statusFilter, conditionFilter, storeFilter, stores]);

  const tableSummary = useMemo(() => {
    const totalPurchase = filteredStock.reduce((acc, item) => {
      const extraCosts = item.costs?.reduce((sum, cost) => sum + cost.amount, 0) || 0;
      return acc + item.purchasePrice + extraCosts;
    }, 0);
    const totalSell = filteredStock.reduce((acc, item) => acc + item.sellPrice, 0);
    return {
      totalItems: filteredStock.length,
      totalPurchase,
      totalSell,
      potentialProfit: totalSell - totalPurchase
    };
  }, [filteredStock]);

  const activeFilterChips = useMemo(() => {
    const chips: Array<{ key: string; label: string }> = [];
    const isDefaultStatus =
      (activeTab === 'list' &&
        statusFilter.length === DEFAULT_LIST_STATUSES.length &&
        DEFAULT_LIST_STATUSES.every((status) => statusFilter.includes(status))) ||
      (activeTab === 'prep' &&
        statusFilter.length === DEFAULT_PREP_STATUSES.length &&
        DEFAULT_PREP_STATUSES.every((status) => statusFilter.includes(status)));

    if (conditionFilter !== 'all') chips.push({ key: 'condition', label: `Condição: ${conditionFilter}` });
    if (storeFilter !== 'all') {
      if (storeFilter.startsWith('city:')) {
        const city = storeFilter.replace('city:', '');
        const cityLabel = city.charAt(0).toUpperCase() + city.slice(1);
        chips.push({ key: 'store', label: `Loja: ${cityLabel}` });
      } else {
        const storeName = stores.find((store) => store.id === storeFilter)?.name || 'Loja';
        chips.push({ key: 'store', label: `Loja: ${storeName}` });
      }
    }
    if (!isDefaultStatus) {
      statusFilter.forEach((status) => {
        chips.push({ key: `status:${status}`, label: `Status: ${status}` });
      });
    }
    return chips;
  }, [conditionFilter, storeFilter, statusFilter, stores, activeTab]);

  useEffect(() => {
    trackUxEvent({
      name: 'inventory_filter_applied',
      screen: 'Inventory',
      metadata: {
        search: searchTerm.length > 0,
        statusCount: statusFilter.length,
        hasCondition: conditionFilter !== 'all',
        hasStore: storeFilter !== 'all'
      },
      ts: new Date().toISOString()
    });
  }, [searchTerm, statusFilter, conditionFilter, storeFilter]);

  const getStoreName = (storeId: string) => stores.find((store) => store.id === storeId)?.name || 'Loja';

  const openNewModal = () => {
    setSelectedEditItem(undefined);
    setIsModalOpen(true);
  };

  const openEditModal = (item: StockItem) => {
    setSelectedEditItem(item);
    setIsModalOpen(true);
  };

  const openDetailsModal = (item: StockItem) => {
    setSelectedDetailItem(item);
    setIsDetailsOpen(true);
    setInlineError(null);
    trackUxEvent({
      name: 'inventory_item_opened',
      screen: 'Inventory',
      metadata: { itemId: item.id, status: item.status },
      ts: new Date().toISOString()
    });
  };

  const handleDelete = (id: string) => {
    removeStockItem(id);
    setIsModalOpen(false);
    setSelectedEditItem(undefined);
    toast.success('Aparelho excluído.');
  };

  const handleSendToSale = async () => {
    if (!selectedDetailItem || selectedDetailItem.status !== StockStatus.PREPARATION) return;

    setIsSendingToSale(true);
    try {
      await updateStockItem(selectedDetailItem.id, { status: StockStatus.AVAILABLE });
      setIsDetailsOpen(false);
      setSelectedDetailItem(undefined);
      setActiveTab('list');
      setStatusFilter(DEFAULT_LIST_STATUSES);
      setInlineError(null);
      trackUxEvent({
        name: 'inventory_sent_to_sale',
        screen: 'Inventory',
        metadata: { itemId: selectedDetailItem.id },
        ts: new Date().toISOString()
      });
      toast.success('Aparelho enviado para disponíveis.');
    } catch (error: any) {
      setInlineError(error?.message || 'Não foi possível enviar o aparelho para venda.');
      toast.error(error?.message || 'Não foi possível enviar o aparelho para venda.');
    } finally {
      setIsSendingToSale(false);
    }
  };

  return (
    <div className="space-y-5 md:space-y-6 max-w-7xl mx-auto">
      {/* Header — HIG: Large Title */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 md:gap-4">
        <div>
          <h2 className="text-[28px] md:text-ios-large font-bold text-gray-900 dark:text-white tracking-tight">Estoque</h2>
          <p className="text-ios-subhead text-gray-500 dark:text-surface-dark-500 mt-0.5">
            Gerencie seu inventario
          </p>
        </div>
        <button onClick={openNewModal} className="ios-button-primary flex items-center gap-2 w-full md:w-auto justify-center">
          <Plus size={20} />
          Adicionar Aparelho
        </button>
      </div>

      {/* HIG: Segmented Control instead of custom tabs */}
      <div className="ios-segmented-control">
        <button
          type="button"
          onClick={() => {
            setActiveTab('list');
            setStatusFilter(DEFAULT_LIST_STATUSES);
          }}
          className={`ios-segment ${activeTab === 'list' ? 'ios-segment-active' : ''}`}
        >
          Disponíveis
        </button>
        <button
          type="button"
          onClick={() => {
            setActiveTab('prep');
            setStatusFilter(DEFAULT_PREP_STATUSES);
          }}
          className={`ios-segment ${activeTab === 'prep' ? 'ios-segment-active' : ''}`}
        >
          Em Preparação
        </button>
      </div>

      <div className="ios-segmented-control">
        {QUICK_STORE_FILTERS.map((storeOption) => (
          <button
            key={storeOption.id}
            type="button"
            onClick={() => setStoreFilter(storeOption.id)}
            className={`ios-segment ${storeFilter === storeOption.id ? 'ios-segment-active' : ''}`}
          >
            {storeOption.label}
          </button>
        ))}
      </div>

      {/* Search + Filter — HIG: 36pt field inside 56pt container */}
      <div className="flex gap-3">
        <div className="relative flex-1 group">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none transition-colors group-focus-within:text-brand-500" size={18} />
          <input
            type="text"
            placeholder="Buscar por modelo ou IMEI..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="ios-input pl-10 transition-all focus:ring-4 focus:ring-brand-500/15 focus:border-brand-500"
          />
          <AnimatePresence>
            {searchTerm && (
              <m.button
                type="button"
                initial={{ opacity: 0, scale: 0.7 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.7 }}
                transition={iosFastEase}
                onClick={() => setSearchTerm('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 w-6 h-6 rounded-full bg-gray-200 dark:bg-surface-dark-300 flex items-center justify-center text-gray-600 dark:text-surface-dark-600 hover:bg-gray-300 dark:hover:bg-surface-dark-400"
                aria-label="Limpar busca"
              >
                <X size={12} />
              </m.button>
            )}
          </AnimatePresence>
        </div>
        <button
          type="button"
          className="ios-button-secondary shrink-0"
          onClick={() => setIsFilterOpen(true)}
          aria-label="Filtros"
        >
          <Filter size={20} />
        </button>
      </div>

      <AnimatePresence initial={false}>
        {activeFilterChips.length > 0 && (
          <m.div
            key="active-filter-chips"
            initial={reducedMotion ? false : { opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={iosFastEase}
            className="flex flex-wrap items-center gap-2 overflow-hidden"
          >
            <AnimatePresence initial={false}>
              {activeFilterChips.map((chip) => (
                <m.span
                  key={chip.key}
                  layout
                  initial={reducedMotion ? false : { opacity: 0, scale: 0.85, y: -4 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.85, transition: { duration: 0.14 } }}
                  transition={iosSpring}
                  className="inline-flex items-center px-3 py-1 rounded-full bg-brand-50 dark:bg-brand-900/20 text-brand-700 dark:text-brand-300 border border-brand-200 dark:border-brand-800 text-xs font-semibold"
                >
                  {chip.label}
                </m.span>
              ))}
            </AnimatePresence>
            <button
              type="button"
              className="text-xs text-brand-600 font-semibold hover:underline"
              onClick={() => {
                setConditionFilter('all');
                setStoreFilter('all');
                if (activeTab === 'prep') setStatusFilter(DEFAULT_PREP_STATUSES);
                else setStatusFilter(DEFAULT_LIST_STATUSES);
                setSearchTerm('');
              }}
            >
              Limpar filtros
            </button>
          </m.div>
        )}
      </AnimatePresence>

      {inlineError && (
        <div className="ios-card p-3 border border-red-200 bg-red-50 text-red-700 flex items-center justify-between gap-3">
          <p className="text-sm">{inlineError}</p>
          <button
            type="button"
            className="text-sm font-semibold underline"
            onClick={() => {
              setInlineError(null);
              if (selectedDetailItem?.status === StockStatus.PREPARATION) {
                void handleSendToSale();
              }
            }}
          >
            Tentar novamente
          </button>
        </div>
      )}

      {/* Stock Table */}
      {filteredStock.length === 0 ? (
        <div className="text-center py-16 md:py-20 ios-card">
          <Smartphone size={44} className="mx-auto mb-4 text-gray-300 dark:text-surface-dark-400" />
          <h3 className="text-ios-title-3 font-semibold text-gray-600 dark:text-surface-dark-600">
            {stock.length === 0 ? 'Nenhum aparelho cadastrado' : 'Nenhum aparelho encontrado com os filtros atuais'}
          </h3>
          <p className="text-ios-subhead text-gray-500 dark:text-surface-dark-500 mt-1">
            {stock.length === 0 ? 'Adicione seu primeiro aparelho para começar.' : 'Ajuste filtros ou limpe a busca para visualizar mais itens.'}
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <div className="ios-card p-4">
              <p className="text-ios-caption uppercase tracking-wide text-gray-500 dark:text-surface-dark-500">Itens</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">{tableSummary.totalItems}</p>
            </div>
            <div className="ios-card p-4">
              <p className="text-ios-caption uppercase tracking-wide text-gray-500 dark:text-surface-dark-500">Custo Total</p>
              <p className="text-lg font-bold text-gray-900 dark:text-white">{formatCurrency(tableSummary.totalPurchase)}</p>
            </div>
            <div className="ios-card p-4">
              <p className="text-ios-caption uppercase tracking-wide text-gray-500 dark:text-surface-dark-500">Venda Total</p>
              <p className="text-lg font-bold text-gray-900 dark:text-white">{formatCurrency(tableSummary.totalSell)}</p>
            </div>
            <div className="ios-card p-4">
              <p className="text-ios-caption uppercase tracking-wide text-gray-500 dark:text-surface-dark-500">Lucro Potencial</p>
              <p className={`text-lg font-bold ${tableSummary.potentialProfit >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                {formatCurrency(tableSummary.potentialProfit)}
              </p>
            </div>
          </div>

          <div className="ios-card overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-200 dark:border-surface-dark-300 flex items-center justify-between gap-2">
              <div>
                <h3 className="text-sm font-semibold text-gray-900 dark:text-white">Tabela do Estoque</h3>
                <p className="text-xs text-gray-500 dark:text-surface-dark-500">Toque no dispositivo para abrir os detalhes.</p>
              </div>
              <span className="text-xs text-gray-400 dark:text-surface-dark-500 whitespace-nowrap">Toque no dispositivo para ver detalhes</span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 dark:bg-surface-dark-200 text-xs uppercase tracking-wide text-gray-500 dark:text-surface-dark-500">
                  <tr>
                    <th className="text-left px-4 py-3 font-semibold">Dispositivo</th>
                    <th className="hidden md:table-cell text-left px-4 py-3 font-semibold">Loja</th>
                    <th className="hidden md:table-cell text-left px-4 py-3 font-semibold">IMEI</th>
                    <th className="hidden md:table-cell text-left px-4 py-3 font-semibold">Caixa</th>
                    <th className="text-right px-4 py-3 font-semibold">Venda</th>
                    <th className="text-right px-4 py-3 font-semibold">Ação</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 dark:divide-surface-dark-300">
                  {filteredStock.map((item, index) => {
                    const batteryHealth = typeof item.batteryHealth === 'number' ? item.batteryHealth : null;
                    const batteryBadgeClass =
                      batteryHealth === null
                        ? 'text-gray-400 dark:text-surface-dark-500'
                        : batteryHealth > 89
                          ? 'bg-green-50 text-green-700 dark:bg-green-900/20 dark:text-green-300'
                          : batteryHealth > 79
                            ? 'bg-amber-50 text-amber-700 dark:bg-amber-900/20 dark:text-amber-300'
                            : 'bg-red-50 text-red-700 dark:bg-red-900/20 dark:text-red-300';
                    // Stagger only first 12 rows (visible above the fold) — avoids
                    // delay accumulation on long lists.
                    const staggerDelay = Math.min(index, 11) * iosStagger.tight;
                    return (
                      <m.tr
                        key={item.id}
                        initial={reducedMotion ? false : { opacity: 0, y: 6 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ ...iosFastEase, delay: staggerDelay }}
                        whileHover={reducedMotion ? undefined : { backgroundColor: 'rgba(59, 130, 246, 0.04)' }}
                        className="transition-colors">
                        <td className="px-4 py-3">
                          <button
                            type="button"
                            onClick={() => openDetailsModal(item)}
                            className="text-left group w-full"
                            title="Ver detalhes do aparelho"
                          >
                            <p className="font-semibold text-gray-900 dark:text-white group-hover:text-brand-600 truncate">
                              {item.model}
                            </p>
                            <p className="text-xs text-gray-500 dark:text-surface-dark-500 truncate">
                              {[item.capacity, item.color].filter(Boolean).join(' · ') || 'Sem detalhes'}
                            </p>
                            <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                              <span className={item.condition === Condition.NEW ? 'ios-badge-blue' : 'ios-badge-orange'}>
                                {item.condition}
                              </span>
                              {item.condition === Condition.NEW ? (
                                <span className="ios-badge-blue inline-flex items-center gap-1">
                                  <Battery size={12} />
                                  100%
                                </span>
                              ) : batteryHealth !== null ? (
                                <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold ${batteryBadgeClass}`}>
                                  <Battery size={12} />
                                  {batteryHealth}%
                                </span>
                              ) : (
                                <span className={batteryBadgeClass}>Bateria não informada</span>
                              )}
                            </div>
                            {item.observations && (
                              <p className="text-xs text-amber-700 dark:text-amber-400 truncate mt-0.5">
                                Obs: {item.observations}
                              </p>
                            )}
                          </button>
                        </td>
                        <td className="hidden md:table-cell px-4 py-3 text-sm text-gray-700 dark:text-surface-dark-700">{getStoreName(item.storeId)}</td>
                        <td className="hidden md:table-cell px-4 py-3 text-sm font-mono text-gray-700 dark:text-surface-dark-700">
                          {item.imei || '-'}
                        </td>
                        <td className="hidden md:table-cell px-4 py-3">
                          <span className={item.hasBox ? 'ios-badge-blue' : 'ios-badge bg-gray-200 text-gray-700 dark:bg-surface-dark-300 dark:text-surface-dark-600'}>
                            {item.hasBox ? 'Sim' : 'Não'}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-sm font-semibold text-gray-900 dark:text-white text-right">
                          {formatCurrency(item.sellPrice)}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <div className="flex justify-end gap-2">
                            <button
                              type="button"
                              onClick={() => openEditModal(item)}
                              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-ios border border-brand-200 dark:border-brand-800 text-xs font-semibold text-brand-700 dark:text-brand-300 hover:bg-brand-50 dark:hover:bg-brand-900/20 transition-colors"
                              aria-label={`Editar ${item.model}`}
                              title="Editar"
                            >
                              <Edit size={14} />
                              <span className="hidden sm:inline">Editar</span>
                            </button>
                          </div>
                        </td>
                      </m.tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {isModalOpen && (
        <StockFormModal
          open={isModalOpen}
          initialData={selectedEditItem}
          onClose={() => {
            setIsModalOpen(false);
            setSelectedEditItem(undefined);
          }}
          onSave={() => {
            setIsModalOpen(false);
            setSelectedEditItem(undefined);
          }}
          onDelete={selectedEditItem ? () => handleDelete(selectedEditItem.id) : undefined}
        />
      )}

      <StockDetailsModal
        open={isDetailsOpen}
        item={selectedDetailItem}
        storeName={selectedDetailItem ? getStoreName(selectedDetailItem.storeId) : ''}
        onSendToSale={handleSendToSale}
        isSendingToSale={isSendingToSale}
        onClose={() => {
          setIsDetailsOpen(false);
          setSelectedDetailItem(undefined);
        }}
        onEdit={
          selectedDetailItem
            ? () => {
                setIsDetailsOpen(false);
                openEditModal(selectedDetailItem);
              }
            : undefined
        }
      />

      {/* Filter Modal — now a bottom sheet on mobile */}
      <Modal
        open={isFilterOpen}
        onClose={() => setIsFilterOpen(false)}
        title="Filtros"
        size="md"
        footer={
          <div className="flex gap-3">
            <button
              type="button"
              className="ios-button-secondary flex-1"
              onClick={() => {
                setConditionFilter('all');
                setStoreFilter('all');
                if (activeTab === 'prep') setStatusFilter(DEFAULT_PREP_STATUSES);
                else setStatusFilter(DEFAULT_LIST_STATUSES);
                toast.info('Filtros limpos.');
              }}
            >
              Limpar
            </button>
            <button type="button" className="ios-button-primary flex-1" onClick={() => setIsFilterOpen(false)}>
              Aplicar
            </button>
          </div>
        }
      >
        <div className="space-y-6">
          <div>
            <p className="ios-section-header px-0">Status</p>
            <div className="grid grid-cols-2 gap-2 mt-2">
              {Object.values(StockStatus).map((s) => {
                const checked = statusFilter.includes(s);
                return (
                  <button
                    key={s}
                    type="button"
                    onClick={() => {
                      setActiveTab('custom');
                      setStatusFilter((prev) => {
                        const next = prev.includes(s) ? prev.filter((x) => x !== s) : [...prev, s];
                        return next.length > 0 ? next : [s];
                      });
                    }}
                    className={`px-3 py-2.5 rounded-ios border text-ios-subhead text-left transition-colors ${
                      checked
                        ? 'bg-brand-500 border-brand-500 text-white'
                        : 'border-gray-300 dark:border-surface-dark-300 text-gray-700 dark:text-surface-dark-700 hover:border-brand-500'
                    }`}
                  >
                    {s}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="ios-label">Condição</label>
              <select className="ios-input" value={conditionFilter} onChange={(e) => setConditionFilter(e.target.value as any)}>
                <option value="all">Todas</option>
                {Object.values(Condition).map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="ios-label">Loja</label>
              <select className="ios-input" value={storeFilter} onChange={(e) => setStoreFilter(e.target.value)}>
                <option value="all">Todas</option>
                <option value="city:sobral">Sobral</option>
                <option value="city:fortaleza">Fortaleza</option>
                {stores.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>
      </Modal>
    </div>
  );
};

export default Inventory;
