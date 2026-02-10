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
    <div className="space-y-6 max-w-7xl mx-auto">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-ios-large font-bold text-gray-900 dark:text-white">Estoque de Aparelhos</h2>
          <p className="text-ios-body text-gray-500 dark:text-surface-dark-500 mt-1">
            Gerencie seu inventário de novos e seminovos
          </p>
        </div>
        <button onClick={openNewModal} className="ios-button-primary flex items-center gap-2">
          <Plus size={20} />
          Adicionar Aparelho
        </button>
      </div>

      <div className="flex gap-4 border-b border-gray-200 dark:border-surface-dark-200">
        <button
          type="button"
          onClick={() => {
            setActiveTab('list');
            setStatusFilter(DEFAULT_LIST_STATUSES);
          }}
          className={`pb-3 px-2 font-medium transition-colors relative ${
            activeTab === 'list' ? 'text-brand-500' : 'text-gray-500 dark:text-surface-dark-500'
          }`}
        >
          Disponíveis
          {activeTab === 'list' && (
            <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-brand-500 rounded-t-full" />
          )}
        </button>
        <button
          type="button"
          onClick={() => {
            setActiveTab('prep');
            setStatusFilter(DEFAULT_PREP_STATUSES);
          }}
          className={`pb-3 px-2 font-medium transition-colors relative ${
            activeTab === 'prep' ? 'text-brand-500' : 'text-gray-500 dark:text-surface-dark-500'
          }`}
        >
          Em Preparação
          {activeTab === 'prep' && (
            <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-brand-500 rounded-t-full" />
          )}
        </button>
      </div>

      <div className="flex gap-4">
        <div className="relative flex-1">
          <input
            type="text"
            placeholder="Buscar por modelo ou IMEI..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="ios-input pl-10"
          />
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
        </div>
        <button type="button" className="ios-button-secondary" onClick={() => setIsFilterOpen(true)} title="Filtros">
          <Filter size={20} />
        </button>
      </div>

      {filteredStock.length === 0 ? (
        <div className="text-center py-20 ios-card">
          <Smartphone size={48} className="mx-auto mb-4 text-gray-400" />
          <h3 className="text-ios-title-3 font-medium text-gray-600 dark:text-surface-dark-600">
            Nenhum aparelho encontrado
          </h3>
          <p className="text-ios-body text-gray-500 dark:text-surface-dark-500 mt-1">
            Adicione novos itens ao seu estoque ou ajuste os filtros.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredStock.map((item) => (
            <div key={item.id} className="ios-card-hover overflow-hidden group">
              <div className="relative h-48 bg-gray-100 dark:bg-surface-dark-200 flex items-center justify-center overflow-hidden">
                {item.photos && item.photos.length > 0 ? (
                  <img src={item.photos[0]} alt={item.model} className="w-full h-full object-cover" />
                ) : (
                  <Smartphone size={48} className="text-gray-300 dark:text-surface-dark-400" />
                )}
                <div className="absolute inset-0 bg-linear-to-t from-black/60 to-transparent" />
                <div className="absolute bottom-4 left-4 right-4 flex justify-between items-end">
                  <span
                    className={`px-3 py-1 text-ios-footnote font-bold rounded-full ${
                      item.condition === Condition.NEW ? 'bg-brand-500 text-white' : 'bg-accent-500 text-white'
                    }`}
                  >
                    {item.condition}
                  </span>
                  <span className="text-ios-footnote text-white px-3 py-1 bg-black/50 backdrop-blur-sm rounded-full">
                    {stores.find(s => s.id === item.storeId)?.name || 'Loja'}
                  </span>
                </div>
              </div>

              <div className="p-5">
                <div className="flex justify-between items-start mb-2">
                  <div>
                    <h3 className="text-ios-title-3 font-bold text-gray-900 dark:text-white">{item.model}</h3>
                    <p className="text-ios-body text-gray-500 dark:text-surface-dark-500">
                      {item.capacity} • {item.color}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => openEditModal(item)}
                    className="p-2 hover:bg-gray-100 dark:hover:bg-surface-dark-200 rounded-ios text-gray-400 hover:text-gray-600 dark:hover:text-white transition-colors"
                    title="Editar"
                  >
                    <Edit size={18} />
                  </button>
                </div>

                <div className="flex items-center justify-between mb-4 mt-4">
                  {item.condition === Condition.USED && item.batteryHealth && (
                    <div
                      className="flex items-center gap-1.5 text-ios-subhead font-medium"
                      style={{
                        color: item.batteryHealth > 89 ? '#22c55e' : item.batteryHealth > 79 ? '#eab308' : '#ef4444',
                      }}
                    >
                      <Battery size={18} />
                      {item.batteryHealth}%
                    </div>
                  )}
                  {item.condition === Condition.NEW && (
                    <span className="text-ios-subhead text-green-600 dark:text-green-400 flex items-center gap-1">
                      <Smartphone size={18} /> Lacrado
                    </span>
                  )}
                  <span className="text-ios-title-2 font-bold text-gray-900 dark:text-white">
                    R$ {item.sellPrice.toLocaleString('pt-BR')}
                  </span>
                </div>

                <div className="pt-4 border-t border-gray-200 dark:border-surface-dark-200 grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-ios-footnote text-gray-500 dark:text-surface-dark-500 mb-0.5">Custo Total</p>
                    <p className="text-ios-subhead font-medium text-gray-700 dark:text-surface-dark-700">
                      R${' '}
                      {(item.purchasePrice + (item.costs?.reduce((acc, c) => acc + c.amount, 0) || 0)).toLocaleString(
                        'pt-BR'
                      )}
                    </p>
                  </div>
                  <div>
                    <p className="text-ios-footnote text-gray-500 dark:text-surface-dark-500 mb-0.5">Lucro Est.</p>
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

      <Modal
        open={isFilterOpen}
        onClose={() => setIsFilterOpen(false)}
        title="Filtros"
        size="md"
        footer={
          <div className="flex justify-between gap-3">
            <button
              type="button"
              className="ios-button-secondary"
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
            <button type="button" className="ios-button-primary" onClick={() => setIsFilterOpen(false)}>
              Aplicar
            </button>
          </div>
        }
      >
        <div className="space-y-6">
          <div>
            <p className="text-ios-footnote text-gray-500 dark:text-surface-dark-500 mb-2">Status</p>
            <div className="grid grid-cols-2 gap-2">
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
                    className={`px-3 py-2 rounded-ios-lg border text-ios-footnote text-left transition-colors ${
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
