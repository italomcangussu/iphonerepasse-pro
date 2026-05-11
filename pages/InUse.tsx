import React, { useMemo, useState } from 'react';
import { useDisclosure } from '../hooks/useDisclosure';
import { Battery, RotateCcw, Search, Smartphone, X } from 'lucide-react';
import Modal from '../components/ui/Modal';
import IOSButton from '../components/ui/IOSButton';
import { StockDetailsModal } from '../components/StockDetailsModal';
import { useToast } from '../components/ui/ToastProvider';
import { useAsyncHandler } from '../hooks/useAsyncHandler';
import { useData } from '../services/dataContext';
import { Condition, StockItem, StockStatus } from '../types';
import { trackUxEvent } from '../services/telemetry';
import { formatCurrencyBRL } from '../utils/inputMasks';

const InUse: React.FC = () => {
  const { stock, stores, updateStockItem } = useData();
  const toast = useToast();
  const run = useAsyncHandler();
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedItem, setSelectedItem] = useState<StockItem | undefined>(undefined);
  const { isOpen: isDetailsOpen, open: openDetails, close: closeDetails } = useDisclosure();
  const { isOpen: isReturnModalOpen, open: openReturnModal, close: closeReturnModal } = useDisclosure();
  const [isReturning, setIsReturning] = useState(false);

  const inUseItems = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    return stock
      .filter((item) => item.status === StockStatus.IN_USE)
      .filter((item) => {
        if (!q) return true;
        return item.model.toLowerCase().includes(q) || (item.imei || '').toLowerCase().includes(q);
      })
      .sort((a, b) => (b.entryDate || '').localeCompare(a.entryDate || ''));
  }, [stock, searchTerm]);

  const inUseStats = useMemo(() => {
    const all = stock.filter((item) => item.status === StockStatus.IN_USE);
    const totalCost = all.reduce((acc, item) => {
      const repairCosts = (Array.isArray(item.costs) ? item.costs : []).reduce(
        (r, c) => r + (Number.isFinite(Number(c.amount)) ? Number(c.amount) : 0),
        0
      );
      return acc + (Number.isFinite(Number(item.purchasePrice)) ? Number(item.purchasePrice) : 0) + repairCosts;
    }, 0);
    return { count: all.length, totalCost };
  }, [stock]);

  const getStoreName = (storeId: string) => stores.find((store) => store.id === storeId)?.name || 'Loja';

  const handleOpenDetails = (item: StockItem) => {
    setSelectedItem(item);
    openDetails();
    trackUxEvent({
      name: 'in_use_item_opened',
      screen: 'InUse',
      metadata: { itemId: item.id },
      ts: new Date().toISOString()
    });
  };

  const returnToStock = async (status: StockStatus.AVAILABLE | StockStatus.PREPARATION) => {
    if (!selectedItem) return;

    await run(async () => {
      await updateStockItem(selectedItem.id, { status });
      closeReturnModal();
      closeDetails();
      setSelectedItem(undefined);
      trackUxEvent({
        name: 'in_use_item_returned',
        screen: 'InUse',
        metadata: { itemId: selectedItem.id, status },
        ts: new Date().toISOString()
      });
      toast.success(
        status === StockStatus.AVAILABLE
          ? 'Aparelho devolvido para venda.'
          : 'Aparelho devolvido para preparação.'
      );
    }, { errorMsg: 'Não foi possível devolver o aparelho ao estoque.', setLoading: setIsReturning });
  };

  return (
    <div className="space-y-5 md:space-y-6 max-w-7xl mx-auto">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 md:gap-4">
        <div>
          <h2 className="app-page-title">Em Uso</h2>
          <p className="app-page-subtitle">Aparelhos do estoque utilizados internamente</p>
        </div>
      </div>

      {inUseStats.count > 0 && (
        <div className="grid grid-cols-2 gap-3">
          <div className="ios-card p-4">
            <p className="text-ios-caption uppercase tracking-wide app-text-muted">Itens</p>
            <p className="text-2xl font-bold app-text-primary">{inUseStats.count}</p>
          </div>
          <div className="ios-card p-4">
            <p className="text-ios-caption uppercase tracking-wide app-text-muted">Custo Total</p>
            <p className="text-lg font-bold app-text-primary">{inUseStats.totalCost.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</p>
          </div>
        </div>
      )}

      <div className="flex gap-3">
        <div className="app-search-wrap flex-1 group">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 app-search-icon pointer-events-none" size={18} />
          <input
            type="text"
            placeholder="Buscar por modelo ou IMEI/Serial..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="ios-input pl-10 transition-all focus:ring-4 focus:ring-brand-500/15 focus:border-brand-500"
          />
          {searchTerm && (
            <button
              type="button"
              onClick={() => setSearchTerm('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 app-search-clear"
              aria-label="Limpar busca"
            >
              <X size={12} />
            </button>
          )}
        </div>
      </div>

      {inUseItems.length === 0 ? (
        <div className="text-center py-16 md:py-20 ios-card">
          <Smartphone size={44} className="mx-auto mb-4 app-text-muted" />
          <h3 className="text-ios-title-3 font-semibold app-text-secondary">
            {stock.some((item) => item.status === StockStatus.IN_USE)
              ? 'Nenhum aparelho encontrado com os filtros atuais'
              : 'Nenhum aparelho em uso'}
          </h3>
          <p className="text-ios-subhead app-text-muted mt-1">
            Itens enviados para uso interno deixam de aparecer no estoque disponível.
          </p>
        </div>
      ) : (
        <div className="ios-card overflow-hidden">
          <div className="px-4 py-3 app-table-header flex items-center justify-between gap-2">
            <div>
              <h3 className="text-sm font-semibold app-text-primary">Itens em Uso</h3>
              <p className="text-xs app-text-muted">Toque no dispositivo para abrir os detalhes.</p>
            </div>
            <span className="text-xs app-text-muted whitespace-nowrap">{inUseItems.length} item(ns)</span>
          </div>

          <div className="divide-y app-table-divider">
            {inUseItems.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => handleOpenDetails(item)}
                className="w-full text-left px-4 py-4 hover:bg-gray-50 dark:hover:bg-surface-dark-200 transition-colors"
              >
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-2">
                  <div className="min-w-0">
                    <p className="font-semibold app-text-primary truncate">{item.model}</p>
                    <p className="text-xs app-text-muted truncate">
                      {[item.capacity, item.color, getStoreName(item.storeId)].filter(Boolean).join(' · ')}
                    </p>
                    <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                      <span className={item.condition === Condition.NEW ? 'ios-badge-blue' : 'ios-badge-orange'}>
                        {item.condition}
                      </span>
                      <span className="ios-badge-orange">Em Uso</span>
                      {typeof item.batteryHealth === 'number' && (
                        <span className="ios-badge-blue inline-flex items-center gap-1">
                          <Battery size={12} />
                          {item.batteryHealth}%
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="text-left md:text-right shrink-0">
                    <p className="text-sm font-semibold app-text-primary">{formatCurrencyBRL(item.sellPrice)}</p>
                    <p className="text-xs app-text-muted font-mono">{item.imei || '-'}</p>
                  </div>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      <StockDetailsModal
        open={isDetailsOpen}
        item={selectedItem}
        storeName={selectedItem ? getStoreName(selectedItem.storeId) : ''}
        onReturnToStock={() => openReturnModal()}
        isReturningToStock={isReturning}
        onClose={() => {
          closeDetails();
          setSelectedItem(undefined);
          closeReturnModal();
        }}
      />

      <Modal
        open={isReturnModalOpen}
        onClose={() => closeReturnModal()}
        title="Devolver ao estoque"
        size="md"
        footer={
          <div className="flex justify-end gap-2">
            <IOSButton variant="secondary" onClick={() => closeReturnModal()}>
              Cancelar
            </IOSButton>
          </div>
        }
      >
        <div className="space-y-3">
          <p className="text-sm app-text-secondary">
            Escolha como este aparelho deve voltar para o estoque.
          </p>
          <button
            type="button"
            aria-label="Disponível para venda"
            onClick={() => void returnToStock(StockStatus.AVAILABLE)}
            disabled={isReturning}
            className="w-full ios-card p-4 text-left hover:border-brand-300 dark:hover:border-brand-700 transition-colors disabled:opacity-60"
          >
            <span className="flex items-center gap-2 font-semibold app-text-primary">
              <RotateCcw size={16} />
              Disponível para venda
            </span>
            <span className="block text-sm app-text-muted mt-1">Volta para a lista de disponíveis.</span>
          </button>
          <button
            type="button"
            aria-label="Em preparação"
            onClick={() => void returnToStock(StockStatus.PREPARATION)}
            disabled={isReturning}
            className="w-full ios-card p-4 text-left hover:border-brand-300 dark:hover:border-brand-700 transition-colors disabled:opacity-60"
          >
            <span className="flex items-center gap-2 font-semibold app-text-primary">
              <RotateCcw size={16} />
              Em preparação
            </span>
            <span className="block text-sm app-text-muted mt-1">Volta para revisão antes da venda.</span>
          </button>
        </div>
      </Modal>
    </div>
  );
};

export default InUse;
