import React, { useMemo, useState } from 'react';
import { Battery, Edit, Eye, Filter, Plus, Search, Smartphone } from 'lucide-react';
import Modal from '../components/ui/Modal';
import { useToast } from '../components/ui/ToastProvider';
import { useData } from '../services/dataContext';
import { Condition, StockItem, StockStatus } from '../types';
import { StockFormModal } from '../components/StockFormModal';
import { StockDetailsModal } from '../components/StockDetailsModal';

const DEFAULT_LIST_STATUSES: StockStatus[] = [StockStatus.AVAILABLE, StockStatus.RESERVED, StockStatus.SOLD];
const DEFAULT_PREP_STATUSES: StockStatus[] = [StockStatus.PREPARATION];
const formatCurrency = (value: number) => value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

const Inventory: React.FC = () => {
  const { stock, removeStockItem, updateStockItem, stores } = useData();
  const toast = useToast();

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

  const filteredStock = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    return stock.filter((item) => {
      const matchesSearch =
        q.length === 0 ||
        item.model.toLowerCase().includes(q) ||
        (item.imei || '').toLowerCase().includes(q);

      const matchesStatus = statusFilter.includes(item.status);
      const matchesCondition = conditionFilter === 'all' ? true : item.condition === conditionFilter;
      const matchesStore = storeFilter === 'all' ? true : item.storeId === storeFilter;

      return matchesSearch && matchesStatus && matchesCondition && matchesStore;
    });
  }, [stock, searchTerm, statusFilter, conditionFilter, storeFilter]);

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
      toast.success('Aparelho enviado para disponíveis.');
    } catch (error: any) {
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

      {/* Search + Filter — HIG: 36pt field inside 56pt container */}
      <div className="flex gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" size={18} />
          <input
            type="text"
            placeholder="Buscar por modelo ou IMEI..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="ios-input pl-10"
          />
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

      {/* Stock Table */}
      {filteredStock.length === 0 ? (
        <div className="text-center py-16 md:py-20 ios-card">
          <Smartphone size={44} className="mx-auto mb-4 text-gray-300 dark:text-surface-dark-400" />
          <h3 className="text-ios-title-3 font-semibold text-gray-600 dark:text-surface-dark-600">
            Nenhum aparelho encontrado
          </h3>
          <p className="text-ios-subhead text-gray-500 dark:text-surface-dark-500 mt-1">
            Adicione novos itens ou ajuste os filtros.
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
                <p className="text-xs text-gray-500 dark:text-surface-dark-500">Toque em um item para editar rapidamente.</p>
              </div>
              <span className="text-xs text-gray-400 dark:text-surface-dark-500 whitespace-nowrap">Role para o lado no celular</span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full min-w-[1080px]">
                <thead className="bg-gray-50 dark:bg-surface-dark-200 text-xs uppercase tracking-wide text-gray-500 dark:text-surface-dark-500">
                  <tr>
                    <th className="text-left px-4 py-3 font-semibold">Dispositivo</th>
                    <th className="text-left px-4 py-3 font-semibold">Status</th>
                    <th className="text-left px-4 py-3 font-semibold">Loja</th>
                    <th className="text-left px-4 py-3 font-semibold">IMEI</th>
                    <th className="text-left px-4 py-3 font-semibold">Bateria</th>
                    <th className="text-left px-4 py-3 font-semibold">Caixa</th>
                    <th className="text-right px-4 py-3 font-semibold">Custo Total</th>
                    <th className="text-right px-4 py-3 font-semibold">Venda</th>
                    <th className="text-right px-4 py-3 font-semibold">Lucro</th>
                    <th className="text-right px-4 py-3 font-semibold">Ação</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 dark:divide-surface-dark-300">
                  {filteredStock.map((item) => {
                    const repairCosts = item.costs?.reduce((acc, cost) => acc + cost.amount, 0) || 0;
                    const totalCost = item.purchasePrice + repairCosts;
                    const profit = item.sellPrice - totalCost;
                    return (
                      <tr key={item.id} className="hover:bg-gray-50/80 dark:hover:bg-surface-dark-200/60 transition-colors">
                        <td className="px-4 py-3">
                          <button
                            type="button"
                            onClick={() => openDetailsModal(item)}
                            className="text-left group max-w-[280px]"
                            title="Ver detalhes do aparelho"
                          >
                            <p className="font-semibold text-gray-900 dark:text-white group-hover:text-brand-600 truncate">
                              {item.model}
                            </p>
                            <p className="text-xs text-gray-500 dark:text-surface-dark-500 truncate">
                              {[item.capacity, item.color].filter(Boolean).join(' · ') || 'Sem detalhes'}
                            </p>
                            {item.observations && (
                              <p className="text-xs text-amber-700 dark:text-amber-400 truncate mt-0.5">
                                Obs: {item.observations}
                              </p>
                            )}
                          </button>
                        </td>
                        <td className="px-4 py-3">
                          <span
                            className={
                              item.status === StockStatus.AVAILABLE
                                ? 'ios-badge-green'
                                : item.status === StockStatus.PREPARATION
                                  ? 'ios-badge-orange'
                                  : item.status === StockStatus.RESERVED
                                    ? 'ios-badge-blue'
                                    : 'ios-badge bg-gray-200 text-gray-700 dark:bg-surface-dark-300 dark:text-surface-dark-600'
                            }
                          >
                            {item.status}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-700 dark:text-surface-dark-700">{getStoreName(item.storeId)}</td>
                        <td className="px-4 py-3 text-sm font-mono text-gray-700 dark:text-surface-dark-700">
                          {item.imei || '-'}
                        </td>
                        <td className="px-4 py-3">
                          {item.condition === Condition.USED && item.batteryHealth ? (
                            <div
                              className="inline-flex items-center gap-1 text-sm font-semibold"
                              style={{
                                color: item.batteryHealth > 89 ? '#34C759' : item.batteryHealth > 79 ? '#FF9500' : '#FF3B30'
                              }}
                            >
                              <Battery size={16} />
                              {item.batteryHealth}%
                            </div>
                          ) : (
                            <span className="text-sm text-gray-400 dark:text-surface-dark-500">-</span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <span className={item.hasBox ? 'ios-badge-blue' : 'ios-badge bg-gray-200 text-gray-700 dark:bg-surface-dark-300 dark:text-surface-dark-600'}>
                            {item.hasBox ? 'Sim' : 'Não'}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-sm font-semibold text-gray-800 dark:text-surface-dark-700 text-right">
                          {formatCurrency(totalCost)}
                        </td>
                        <td className="px-4 py-3 text-sm font-semibold text-gray-900 dark:text-white text-right">
                          {formatCurrency(item.sellPrice)}
                        </td>
                        <td className={`px-4 py-3 text-sm font-bold text-right ${profit >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                          {formatCurrency(profit)}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <div className="flex justify-end gap-2">
                            <button
                              type="button"
                              onClick={() => openDetailsModal(item)}
                              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-ios border border-gray-200 dark:border-surface-dark-300 text-xs font-semibold text-gray-700 dark:text-surface-dark-700 hover:bg-gray-100 dark:hover:bg-surface-dark-200"
                              aria-label={`Ver detalhes de ${item.model}`}
                              title="Detalhes"
                            >
                              <Eye size={14} />
                              Detalhes
                            </button>
                            <button
                              type="button"
                              onClick={() => openEditModal(item)}
                              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-ios border border-brand-200 dark:border-brand-800 text-xs font-semibold text-brand-700 dark:text-brand-300 hover:bg-brand-50 dark:hover:bg-brand-900/20"
                              aria-label={`Editar ${item.model}`}
                              title="Editar"
                            >
                              <Edit size={14} />
                              Editar
                            </button>
                          </div>
                        </td>
                      </tr>
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
