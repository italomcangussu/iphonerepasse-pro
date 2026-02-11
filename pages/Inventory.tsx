import React, { useMemo, useState } from 'react';
import { Battery, Edit, Filter, Plus, Search, Smartphone } from 'lucide-react';
import Modal from '../components/ui/Modal';
import { useToast } from '../components/ui/ToastProvider';
import { useData } from '../services/dataContext';
import { Condition, DeviceType, StockItem, StockStatus } from '../types';
import { StockFormModal } from '../components/StockFormModal';

const DEFAULT_LIST_STATUSES: StockStatus[] = [StockStatus.AVAILABLE, StockStatus.RESERVED, StockStatus.SOLD];
const DEFAULT_PREP_STATUSES: StockStatus[] = [StockStatus.PREPARATION];

const Inventory: React.FC = () => {
  const { stock, removeStockItem, stores } = useData();
  const toast = useToast();

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState<StockItem | undefined>(undefined);

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

  const openNewModal = () => {
    setSelectedItem(undefined);
    setIsModalOpen(true);
  };

  const openEditModal = (item: StockItem) => {
    setSelectedItem(item);
    setIsModalOpen(true);
  };

  const handleDelete = (id: string) => {
    removeStockItem(id);
    setIsModalOpen(false);
    toast.success('Aparelho excluído.');
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

      {/* Stock Grid */}
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
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
          {filteredStock.map((item) => (
            <div key={item.id} className="ios-card-hover overflow-hidden group">
              {/* Image area */}
              <div className="relative h-44 md:h-48 bg-gray-100 dark:bg-surface-dark-200 flex items-center justify-center overflow-hidden">
                {item.photos && item.photos.length > 0 ? (
                  <img src={item.photos[0]} alt={item.model} className="w-full h-full object-cover" />
                ) : (
                  <Smartphone size={44} className="text-gray-300 dark:text-surface-dark-400" />
                )}
                <div className="absolute inset-0 bg-linear-to-t from-black/60 to-transparent" />
                <div className="absolute bottom-3 left-3 right-3 flex justify-between items-end">
                  <span
                    className={`px-2.5 py-1 text-ios-caption font-bold rounded-full ${
                      item.condition === Condition.NEW ? 'bg-brand-500 text-white' : 'bg-accent-500 text-white'
                    }`}
                  >
                    {item.condition}
                  </span>
                  <span className="text-ios-caption text-white px-2.5 py-1 bg-black/50 backdrop-blur-sm rounded-full">
                    {stores.find(s => s.id === item.storeId)?.name || 'Loja'}
                  </span>
                </div>
              </div>

              {/* Content */}
              <div className="p-4 md:p-5">
                <div className="flex justify-between items-start mb-1">
                  <div className="min-w-0 flex-1">
                    <h3 className="text-[17px] font-bold text-gray-900 dark:text-white truncate">{item.model}</h3>
                    <p className="text-ios-subhead text-gray-500 dark:text-surface-dark-500">
                      {item.capacity} · {item.color}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => openEditModal(item)}
                    className="w-9 h-9 flex items-center justify-center hover:bg-gray-100 dark:hover:bg-surface-dark-200 rounded-full text-gray-400 hover:text-gray-600 dark:hover:text-white transition-colors shrink-0 ml-2"
                    aria-label="Editar"
                  >
                    <Edit size={18} />
                  </button>
                </div>

                <div className="flex items-center justify-between mt-3 mb-4">
                  {item.condition === Condition.USED && item.batteryHealth && (
                    <div
                      className="flex items-center gap-1 text-ios-subhead font-semibold"
                      style={{
                        color: item.batteryHealth > 89 ? '#34C759' : item.batteryHealth > 79 ? '#FF9500' : '#FF3B30',
                      }}
                    >
                      <Battery size={18} />
                      {item.batteryHealth}%
                    </div>
                  )}
                  {item.condition === Condition.NEW && (
                    <span className="text-ios-subhead text-green-600 dark:text-green-400 flex items-center gap-1 font-semibold">
                      <Smartphone size={16} /> Lacrado
                    </span>
                  )}
                  <span className="text-[20px] font-bold text-gray-900 dark:text-white">
                    R$ {item.sellPrice.toLocaleString('pt-BR')}
                  </span>
                </div>

                {/* Cost info — HIG: inset separator */}
                <div className="pt-3 border-t border-gray-200 dark:border-surface-dark-200 grid grid-cols-2 gap-3">
                  <div>
                    <p className="text-ios-caption text-gray-500 dark:text-surface-dark-500 mb-0.5">Custo Total</p>
                    <p className="text-ios-subhead font-medium text-gray-700 dark:text-surface-dark-700">
                      R${' '}
                      {(item.purchasePrice + (item.costs?.reduce((acc, c) => acc + c.amount, 0) || 0)).toLocaleString(
                        'pt-BR'
                      )}
                    </p>
                  </div>
                  <div>
                    <p className="text-ios-caption text-gray-500 dark:text-surface-dark-500 mb-0.5">Lucro Est.</p>
                    <p className="text-ios-subhead font-bold text-green-600 dark:text-green-400">
                      R${' '}
                      {(
                        item.sellPrice -
                        item.purchasePrice -
                        (item.costs?.reduce((acc, c) => acc + c.amount, 0) || 0)
                      ).toLocaleString('pt-BR')}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {isModalOpen && (
        <StockFormModal
          open={isModalOpen}
          initialData={selectedItem}
          onClose={() => {
            setIsModalOpen(false);
            setSelectedItem(undefined);
          }}
          onSave={() => {
            setIsModalOpen(false);
            setSelectedItem(undefined);
          }}
          onDelete={selectedItem ? () => handleDelete(selectedItem.id) : undefined}
        />
      )}

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
