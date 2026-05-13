import React, { lazy, Suspense, useEffect, useMemo, useState } from 'react';
import { useDisclosure } from '../hooks/useDisclosure';
import { AnimatePresence, m, useReducedMotion } from 'framer-motion';
import { Battery, ChevronDown, Edit, Instagram, MessageCircle, Plus, Search, Smartphone, X } from 'lucide-react';
import { useToast } from '../components/ui/ToastProvider';
import { useAsyncHandler } from '../hooks/useAsyncHandler';
import { useData } from '../services/dataContext';
import { Condition, StockItem, StockStatus } from '../types';
import { StockFormModal } from '../components/StockFormModal';
import Banner from '../components/ui/Banner';
import Pagination from '../components/ui/Pagination';
import { trackUxEvent } from '../services/telemetry';
import { iosFastEase, iosSpring, iosStagger } from '../components/motion/transitions';
import { useIsMobileViewport } from '../hooks/useIsMobileViewport';
import { usePaginatedRows } from '../hooks/usePaginatedRows';
import { calculateCardCharge, CARD_INSTALLMENTS_MAX, DEFAULT_CARD_FEE_SETTINGS, getCardRate } from '../utils/cardFees';
import { formatCurrencyBRL } from '../utils/inputMasks';

const DEFAULT_LIST_STATUSES: StockStatus[] = [StockStatus.AVAILABLE, StockStatus.RESERVED];
const DEFAULT_PREP_STATUSES: StockStatus[] = [StockStatus.PREPARATION];
const COMPLETE_SHARE_STOCK_STATUSES = new Set([StockStatus.AVAILABLE, StockStatus.RESERVED]);
const QUICK_STORE_FILTERS = [
  { id: 'all', label: 'Geral' },
  { id: 'city:sobral', label: 'Sobral' },
  { id: 'city:fortaleza', label: 'Fortaleza' }
] as const;
const INVENTORY_PAGE_SIZE_MOBILE = 12;
const INVENTORY_PAGE_SIZE_DESKTOP = 30;
const StockDetailsModal = lazy(() => import('../components/StockDetailsModal').then((module) => ({ default: module.StockDetailsModal })));

const formatShareCurrency = (value: number) => formatCurrencyBRL(value).replace(/\s/g, ' ');
const modelCollator = new Intl.Collator('pt-BR', { numeric: true, sensitivity: 'base' });
const parseCapacityToGb = (value?: string) => {
  if (!value) return 0;

  const normalized = value.trim().toUpperCase();
  const match = normalized.match(/(\d+(?:[.,]\d+)?)(?:\s*)(TB|GB)?/);
  if (!match) return 0;

  const numericValue = Number(match[1].replace(',', '.'));
  if (!Number.isFinite(numericValue)) return 0;

  const unit = match[2] || 'GB';
  if (unit === 'TB') return numericValue * 1024;
  return numericValue;
};

const resolveBatterySortValue = (item: StockItem) => {
  if (typeof item.batteryHealth === 'number' && Number.isFinite(item.batteryHealth)) {
    return item.batteryHealth;
  }
  return item.condition === Condition.NEW ? 100 : -1;
};

const compareStockItemsForDisplay = (a: StockItem, b: StockItem) => {
  const byModel = modelCollator.compare(a.model || '', b.model || '');
  if (byModel !== 0) return -byModel;

  const byCapacity = parseCapacityToGb(b.capacity) - parseCapacityToGb(a.capacity);
  if (byCapacity !== 0) return byCapacity;

  const byBattery = resolveBatterySortValue(b) - resolveBatterySortValue(a);
  if (byBattery !== 0) return byBattery;

  return (b.entryDate || '').localeCompare(a.entryDate || '');
};

type ShareChannel = 'whatsapp' | 'instagram';
type ShareScope = 'current' | 'complete';
type SharePaymentPlan = {
  installments: number;
  feeRate: number;
};

const normalizeInlineShareText = (value: string) => value.replace(/\s+/g, ' ').trim();

const truncateShareSegmentByLine = (value: string, maxLength: number) => {
  if (value.length <= maxLength) return value;
  if (maxLength <= 3) return '.'.repeat(Math.max(0, maxLength));

  const lines = value.split('\n');
  const nextLines: string[] = [];

  for (const line of lines) {
    const candidate = [...nextLines, line].join('\n');
    if (candidate.length + 4 > maxLength) break;
    nextLines.push(line);
  }

  if (nextLines.length === 0) return `${value.slice(0, maxLength - 3).trimEnd()}...`;
  return `${nextLines.join('\n')}\n...`;
};

const formatStockShareItem = (item: StockItem, channel: ShareChannel, paymentPlan?: SharePaymentPlan) => {
  const battery = resolveBatterySortValue(item);
  const batteryLabel = battery >= 0 ? `${battery}%` : 'Bateria nao informada';
  const deviceLabel = normalizeInlineShareText(`${item.model} ${item.capacity || ''} ${item.color || ''}`);
  const cardCharge = paymentPlan
    ? calculateCardCharge(item.sellPrice, paymentPlan.feeRate, paymentPlan.installments)
    : null;

  if (channel === 'whatsapp') {
    return [
      `• ${deviceLabel}`,
      `  🔋 ${batteryLabel} | 💰 À vista ${formatShareCurrency(item.sellPrice)}`,
      cardCharge ? `  💳 ${cardCharge.installments}x de ${formatShareCurrency(cardCharge.installmentAmount)}` : null
    ].filter(Boolean).join('\n');
  }

  return [
    `${deviceLabel} 🔋 ${batteryLabel}`,
    `À vista ${formatShareCurrency(item.sellPrice)}${cardCharge ? ` | ${cardCharge.installments}x de ${formatShareCurrency(cardCharge.installmentAmount)}` : ''}`
  ].join('\n');
};

export const buildStockShareText = (items: StockItem[], channel: ShareChannel, paymentPlan?: SharePaymentPlan) => {
  const sortedItems = [...items].sort(compareStockItemsForDisplay);
  const groups = [
    { condition: Condition.NEW, label: channel === 'whatsapp' ? '🆕 *NOVOS*' : 'Novos' },
    { condition: Condition.USED, label: channel === 'whatsapp' ? '♻️ *SEMINOVOS*' : 'Seminovos' },
  ];

  const groupTexts = groups
    .map(({ condition, label }) => {
      const groupItems = sortedItems.filter((item) => item.condition === condition);
      const groupText = groupItems.length > 0 ? groupItems.map((item) => formatStockShareItem(item, channel, paymentPlan)).join('\n') : 'Nenhum';
      return { label, text: groupText };
    });

  if (channel === 'instagram') {
    const header = 'Lista de estoque\n';
    const fixedLength = header.length + groupTexts.reduce((sum, group) => sum + `${group.label}:\n`.length, 0) + '\n'.length;
    const segmentBudget = Math.max(0, Math.floor((1000 - fixedLength) / groupTexts.length));
    return (
      `${header}${groupTexts
        .map((group) => `${group.label}:\n${truncateShareSegmentByLine(group.text, segmentBudget)}`)
        .join('\n')}`
    );
  }

  return `*📱 LISTA DE ESTOQUE*\n\n${groupTexts.map((group) => `${group.label}\n${group.text}`).join('\n\n')}`;
};

const Inventory: React.FC = () => {
  const { stock, removeStockItem, updateStockItem, stores, cardFeeSettings = DEFAULT_CARD_FEE_SETTINGS } = useData();
  const toast = useToast();
  const run = useAsyncHandler();
  const reducedMotion = useReducedMotion();
  const isMobile = useIsMobileViewport();

  const { isOpen: isModalOpen, open: openModal, close: closeModal } = useDisclosure();
  const [selectedEditItem, setSelectedEditItem] = useState<StockItem | undefined>(undefined);
  const [selectedDetailItem, setSelectedDetailItem] = useState<StockItem | undefined>(undefined);
  const { isOpen: isDetailsOpen, open: openDetails, close: closeDetails } = useDisclosure();
  const [isSendingToSale, setIsSendingToSale] = useState(false);

  const [activeTab, setActiveTab] = useState<'list' | 'prep' | 'custom'>('list');
  const [searchTerm, setSearchTerm] = useState('');

  const [statusFilter, setStatusFilter] = useState<StockStatus[]>(DEFAULT_LIST_STATUSES);
  const [conditionFilter, setConditionFilter] = useState<Condition | 'all'>(() => {
    const saved = localStorage.getItem('inventory:condition:v1');
    return (saved as Condition | 'all') || 'all';
  });
  const [storeFilter, setStoreFilter] = useState<string>('all');
  const [inlineError, setInlineError] = useState<string | null>(null);
  const [shareMenuOpen, setShareMenuOpen] = useState<ShareChannel | null>(null);
  const [pendingShare, setPendingShare] = useState<{ channel: ShareChannel; scope: ShareScope } | null>(null);
  const isPreparationTab = activeTab === 'prep';

  useEffect(() => {
    localStorage.setItem('inventory:condition:v1', conditionFilter);
  }, [conditionFilter]);

  const filteredStock = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    return stock
      .filter((item) => {
        const matchesSearch =
          q.length === 0 ||
          item.model.toLowerCase().includes(q) ||
          (item.imei || '').toLowerCase().includes(q);

        const matchesStatus = statusFilter.includes(item.status);
        const matchesCondition =
          isPreparationTab || conditionFilter === 'all' ? true : item.condition === conditionFilter;
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
      })
      .sort(compareStockItemsForDisplay);
  }, [stock, searchTerm, statusFilter, conditionFilter, storeFilter, stores, isPreparationTab]);

  const completeShareStock = useMemo(
    () => stock.filter((item) => COMPLETE_SHARE_STOCK_STATUSES.has(item.status)).sort(compareStockItemsForDisplay),
    [stock]
  );

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
  const inventoryPageSize = isMobile ? INVENTORY_PAGE_SIZE_MOBILE : INVENTORY_PAGE_SIZE_DESKTOP;
  const inventoryPagination = usePaginatedRows(filteredStock, {
    pageSize: inventoryPageSize,
    resetKey: `${activeTab}|${searchTerm}|${statusFilter.join(',')}|${conditionFilter}|${storeFilter}|${isMobile ? 'mobile' : 'desktop'}`,
  });

  const activeFilterChips = useMemo(() => {
    const chips: Array<{ key: string; label: string }> = [];
    const isDefaultStatus =
      (activeTab === 'list' &&
        statusFilter.length === DEFAULT_LIST_STATUSES.length &&
        DEFAULT_LIST_STATUSES.every((status) => statusFilter.includes(status))) ||
      (activeTab === 'prep' &&
        statusFilter.length === DEFAULT_PREP_STATUSES.length &&
        DEFAULT_PREP_STATUSES.every((status) => statusFilter.includes(status)));

    if (!isPreparationTab && conditionFilter !== 'all') chips.push({ key: 'condition', label: `Condição: ${conditionFilter}` });
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
  }, [conditionFilter, storeFilter, statusFilter, stores, activeTab, isPreparationTab]);

  useEffect(() => {
    trackUxEvent({
      name: 'inventory_filter_applied',
      screen: 'Inventory',
      metadata: {
        search: searchTerm.length > 0,
        statusCount: statusFilter.length,
        hasCondition: !isPreparationTab && conditionFilter !== 'all',
        hasStore: storeFilter !== 'all'
      },
      ts: new Date().toISOString()
    });
  }, [searchTerm, statusFilter, conditionFilter, storeFilter, isPreparationTab]);

  const getStoreName = (storeId: string) => stores.find((store) => store.id === storeId)?.name || 'Loja';
  const getBatteryBadgeClass = (batteryHealth: number | null) => {
    if (batteryHealth === null) return 'app-text-muted';
    if (batteryHealth > 89) return 'bg-green-50 text-green-700 dark:bg-green-900/20 dark:text-green-300';
    if (batteryHealth > 79) return 'bg-amber-50 text-amber-700 dark:bg-amber-900/20 dark:text-amber-300';
    return 'bg-red-50 text-red-700 dark:bg-red-900/20 dark:text-red-300';
  };

  const openNewModal = () => {
    setSelectedEditItem(undefined);
    openModal();
  };

  const openEditModal = (item: StockItem) => {
    setSelectedEditItem(item);
    openModal();
  };

  const openDetailsModal = (item: StockItem) => {
    setSelectedDetailItem(item);
    openDetails();
    setInlineError(null);
    trackUxEvent({
      name: 'inventory_item_opened',
      screen: 'Inventory',
      metadata: { itemId: item.id, status: item.status },
      ts: new Date().toISOString()
    });
  };

  const getShareItems = (scope: ShareScope) => (scope === 'current' ? filteredStock : completeShareStock);

  const handleShareList = async (channel: ShareChannel, scope: ShareScope, installments: number) => {
    const itemsToShare = getShareItems(scope);

    if (itemsToShare.length === 0) {
      toast.info('Nao ha aparelhos para compartilhar nesta lista.');
      setPendingShare(null);
      setShareMenuOpen(null);
      return;
    }

    const feeRate = getCardRate(cardFeeSettings, 'visa_master', installments);
    const text = buildStockShareText(itemsToShare, channel, { installments, feeRate });

    if (channel === 'whatsapp') {
      window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank', 'noopener,noreferrer');
      toast.success(scope === 'current' ? 'WhatsApp aberto com a lista filtrada.' : 'WhatsApp aberto com a lista completa.');
      setPendingShare(null);
      setShareMenuOpen(null);
      return;
    }

    try {
      if (typeof navigator !== 'undefined' && typeof navigator.share === 'function') {
        await navigator.share({ text });
      } else if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(text);
      }
      toast.success('Texto para Instagram preparado.');
    } catch (error: any) {
      if (error?.name !== 'AbortError') {
        toast.error('Nao foi possivel preparar o texto para Instagram.');
      }
    } finally {
      setPendingShare(null);
      setShareMenuOpen(null);
    }
  };

  const handleSelectShareScope = (channel: ShareChannel, scope: ShareScope) => {
    setPendingShare({ channel, scope });
  };

  const renderShareMenu = (channel: ShareChannel) => {
    const isOpen = shareMenuOpen === channel;
    const label = channel === 'whatsapp' ? 'WhatsApp' : 'Instagram';
    const Icon = channel === 'whatsapp' ? MessageCircle : Instagram;

    return (
      <div className="relative">
        <button
          type="button"
          onClick={() => {
            setPendingShare(null);
            setShareMenuOpen((current) => (current === channel ? null : channel));
          }}
          className="ios-button-secondary inline-flex items-center justify-center gap-2 w-full sm:w-auto"
          aria-expanded={isOpen}
          aria-haspopup="menu"
        >
          <Icon size={17} />
          {label}
          <ChevronDown size={15} />
        </button>
        {isOpen && (
          <div
            role="menu"
            className="absolute right-0 z-20 mt-2 w-56 rounded-ios-lg border app-border bg-white dark:bg-surface-dark-100 shadow-ios26-lg overflow-hidden"
          >
            {pendingShare?.channel === channel ? (
              Array.from({ length: CARD_INSTALLMENTS_MAX }, (_, index) => {
                const installments = index + 1;
                const rate = getCardRate(cardFeeSettings, 'visa_master', installments);
                return (
                  <button
                    key={installments}
                    type="button"
                    role="menuitem"
                    onClick={() => {
                      void handleShareList(channel, pendingShare.scope, installments);
                    }}
                    className="w-full text-left px-4 py-2.5 text-sm font-medium app-text-primary hover:bg-gray-50 dark:hover:bg-surface-dark-200"
                  >
                    {installments}x Visa/Master {rate.toFixed(2)}%
                  </button>
                );
              })
            ) : (
              <>
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => handleSelectShareScope(channel, 'current')}
                  className="w-full text-left px-4 py-3 text-sm font-medium app-text-primary hover:bg-gray-50 dark:hover:bg-surface-dark-200"
                >
                  Lista atual filtrada
                </button>
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => handleSelectShareScope(channel, 'complete')}
                  className="w-full text-left px-4 py-3 text-sm font-medium app-text-primary hover:bg-gray-50 dark:hover:bg-surface-dark-200"
                >
                  Lista completa
                </button>
              </>
            )}
          </div>
        )}
      </div>
    );
  };

  const handleDelete = async (id: string) => {
    await run(async () => {
      await removeStockItem(id);
      closeModal();
      setSelectedEditItem(undefined);
      toast.success('Aparelho excluído.');
    }, 'Não foi possível excluir o aparelho.');
  };

  const handleSendToSale = async () => {
    if (!selectedDetailItem || selectedDetailItem.status !== StockStatus.PREPARATION) return;

    setIsSendingToSale(true);
    try {
      await updateStockItem(selectedDetailItem.id, { status: StockStatus.AVAILABLE });
      closeDetails();
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

  const handleAddToInUse = async () => {
    if (!selectedEditItem) return;

    try {
      await updateStockItem(selectedEditItem.id, { status: StockStatus.IN_USE });
      closeModal();
      setSelectedEditItem(undefined);
      setInlineError(null);
      trackUxEvent({
        name: 'inventory_sent_to_in_use',
        screen: 'Inventory',
        metadata: { itemId: selectedEditItem.id },
        ts: new Date().toISOString()
      });
      toast.success('Aparelho movido para Em Uso.');
    } catch (error: any) {
      setInlineError(error?.message || 'Não foi possível mover o aparelho para Em Uso.');
      toast.error(error?.message || 'Não foi possível mover o aparelho para Em Uso.');
    }
  };

  return (
    <div className="space-y-5 md:space-y-6 max-w-7xl mx-auto">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 md:gap-4">
        <div>
          <h2 className="app-page-title">Estoque</h2>
          <p className="app-page-subtitle">
            Gerencie seu inventario
          </p>
        </div>
        <button onClick={openNewModal} className="ios-button-primary flex items-center gap-2 w-full md:w-auto justify-center">
          <Plus size={20} />
          Adicionar Aparelho
        </button>
      </div>

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
            setConditionFilter('all');
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

      {!isPreparationTab && (
        <div className="ios-segmented-control mt-2">
          <button
            type="button"
            onClick={() => setConditionFilter('all')}
            className={`ios-segment ${conditionFilter === 'all' ? 'ios-segment-active' : ''}`}
          >
            Todos
          </button>
          <button
            type="button"
            onClick={() => setConditionFilter(Condition.NEW)}
            className={`ios-segment ${conditionFilter === Condition.NEW ? 'ios-segment-active' : ''}`}
          >
            Novo
          </button>
          <button
            type="button"
            onClick={() => setConditionFilter(Condition.USED)}
            className={`ios-segment ${conditionFilter === Condition.USED ? 'ios-segment-active' : ''}`}
          >
            Seminovo
          </button>
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
          <AnimatePresence>
            {searchTerm && (
              <m.button
                type="button"
                initial={{ opacity: 0, scale: 0.7 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.7 }}
                transition={iosFastEase}
                onClick={() => setSearchTerm('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 app-search-clear"
                aria-label="Limpar busca"
              >
                <X size={12} />
              </m.button>
            )}
          </AnimatePresence>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row sm:justify-end gap-2">
        {renderShareMenu('whatsapp')}
        {renderShareMenu('instagram')}
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
        <Banner
          kind="error"
          message={inlineError}
          onClose={() => setInlineError(null)}
          action={{
            label: 'Tentar novamente',
            onClick: () => {
              setInlineError(null);
              if (selectedDetailItem?.status === StockStatus.PREPARATION) {
                void handleSendToSale();
              }
            }
          }}
          className="mb-4"
        />
      )}

      {filteredStock.length === 0 ? (
        <div className="text-center py-16 md:py-20 ios-card">
          <Smartphone size={44} className="mx-auto mb-4 app-text-muted" />
          <h3 className="text-ios-title-3 font-semibold app-text-secondary">
            {stock.length === 0 ? 'Nenhum aparelho cadastrado' : 'Nenhum aparelho encontrado com os filtros atuais'}
          </h3>
          <p className="text-ios-subhead app-text-muted mt-1">
            {stock.length === 0 ? 'Adicione seu primeiro aparelho para começar.' : 'Ajuste filtros ou limpe a busca para visualizar mais itens.'}
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <div className="ios-card p-4">
              <p className="text-ios-caption uppercase tracking-wide app-text-muted">Itens</p>
              <p className="text-2xl font-bold app-text-primary">{tableSummary.totalItems}</p>
            </div>
            <div className="ios-card p-4">
              <p className="text-ios-caption uppercase tracking-wide app-text-muted">Custo Total</p>
              <p className="text-lg font-bold app-text-primary">{formatCurrencyBRL(tableSummary.totalPurchase)}</p>
            </div>
            <div className="ios-card p-4">
              <p className="text-ios-caption uppercase tracking-wide app-text-muted">Venda Total</p>
              <p className="text-lg font-bold app-text-primary">{formatCurrencyBRL(tableSummary.totalSell)}</p>
            </div>
            <div className="ios-card p-4">
              <p className="text-ios-caption uppercase tracking-wide app-text-muted">Lucro Potencial</p>
              <p className={`text-lg font-bold ${tableSummary.potentialProfit >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                {formatCurrencyBRL(tableSummary.potentialProfit)}
              </p>
            </div>
          </div>

          {isMobile ? (
            <div className="space-y-3">
              {inventoryPagination.rows.map((item, index) => {
                const batteryHealth = typeof item.batteryHealth === 'number' ? item.batteryHealth : null;
                const batteryBadgeClass = getBatteryBadgeClass(batteryHealth);
                const staggerDelay = Math.min(index, 11) * iosStagger.tight;
                return (
                  <m.div
                    key={item.id}
                    initial={reducedMotion ? false : { opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ ...iosFastEase, delay: staggerDelay }}
                    className="ios-card p-4 space-y-3"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <button
                        type="button"
                        onClick={() => openDetailsModal(item)}
                        className="text-left min-w-0 flex-1"
                        title="Ver detalhes do aparelho"
                      >
                        <p className="font-semibold app-text-primary truncate">{item.model}</p>
                        <p className="text-xs app-text-muted truncate">
                          {[item.capacity, item.color].filter(Boolean).join(' · ') || 'Sem detalhes'}
                        </p>
                      </button>
                      <span className="text-sm font-semibold app-text-primary shrink-0">{formatCurrencyBRL(item.sellPrice)}</span>
                    </div>

                    <div className="flex flex-wrap items-center gap-1.5">
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
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold ${batteryBadgeClass}`}>
                          Bateria não informada
                        </span>
                      )}
                      <span className={item.hasBox ? 'ios-badge-blue' : 'ios-badge app-surface-soft app-text-secondary'}>
                        Caixa: {item.hasBox ? 'Sim' : 'Não'}
                      </span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs app-text-secondary">
                      <p>Loja: {getStoreName(item.storeId)}</p>
                      <p className="font-mono truncate">IMEI/Serial: {item.imei || '-'}</p>
                    </div>

                    {item.observations && (
                      <p className="text-xs text-amber-700 dark:text-amber-400 truncate">Obs: {item.observations}</p>
                    )}

                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => openDetailsModal(item)}
                        className="ios-button-secondary text-xs justify-center"
                      >
                        Detalhes
                      </button>
                      <button
                        type="button"
                        onClick={() => openEditModal(item)}
                        className="ios-button-secondary text-xs inline-flex items-center justify-center gap-1"
                        aria-label={`Editar ${item.model}`}
                        title="Editar"
                      >
                        <Edit size={14} />
                        Editar
                      </button>
                    </div>
                  </m.div>
                );
              })}
              <Pagination
                page={inventoryPagination.page}
                totalPages={inventoryPagination.totalPages}
                totalItems={inventoryPagination.totalItems}
                pageSize={inventoryPagination.pageSize}
                onPageChange={inventoryPagination.setPage}
                className="rounded-ios-lg border border-gray-200 bg-white dark:border-surface-dark-200 dark:bg-surface-dark-100"
              />
            </div>
          ) : (
            <div className="ios-card overflow-hidden">
              <div className="px-4 py-3 app-table-header flex items-center justify-between gap-2">
                <div>
                  <h3 className="text-sm font-semibold app-text-primary">Tabela do Estoque</h3>
                  <p className="text-xs app-text-muted">Toque no dispositivo para abrir os detalhes.</p>
                </div>
                <span className="text-xs app-text-muted whitespace-nowrap">Toque no dispositivo para ver detalhes</span>
              </div>

              <div className="table-scroll-x">
                <table className="w-full">
                  <thead className="app-table-head text-xs uppercase tracking-wide">
                    <tr>
                      <th className="text-left px-4 py-3 font-semibold">Dispositivo</th>
                      <th className="hidden md:table-cell text-left px-4 py-3 font-semibold">Loja</th>
                      <th className="hidden md:table-cell text-left px-4 py-3 font-semibold">IMEI/Serial</th>
                      <th className="hidden md:table-cell text-left px-4 py-3 font-semibold">Caixa</th>
                      <th className="text-right px-4 py-3 font-semibold">Venda</th>
                      <th className="text-right px-4 py-3 font-semibold">Ação</th>
                    </tr>
                  </thead>
                  <tbody className="app-table-divider">
                    {inventoryPagination.rows.map((item, index) => {
                      const batteryHealth = typeof item.batteryHealth === 'number' ? item.batteryHealth : null;
                      const batteryBadgeClass = getBatteryBadgeClass(batteryHealth);
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
                          className="app-table-row-hover"
                        >
                          <td className="px-4 py-3">
                            <button
                              type="button"
                              onClick={() => openDetailsModal(item)}
                              className="text-left group w-full"
                              title="Ver detalhes do aparelho"
                            >
                              <p className="font-semibold app-text-primary group-hover:text-brand-600 truncate">{item.model}</p>
                              <p className="text-xs app-text-muted truncate">
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
                          <td className="hidden md:table-cell px-4 py-3 text-sm app-text-secondary">{getStoreName(item.storeId)}</td>
                          <td className="hidden md:table-cell px-4 py-3 text-sm font-mono app-text-secondary">
                            {item.imei || '-'}
                          </td>
                          <td className="hidden md:table-cell px-4 py-3">
                            <span className={item.hasBox ? 'ios-badge-blue' : 'ios-badge app-surface-soft app-text-secondary'}>
                              {item.hasBox ? 'Sim' : 'Não'}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-sm font-semibold app-text-primary text-right">
                            {formatCurrencyBRL(item.sellPrice)}
                          </td>
                          <td className="px-4 py-3 text-right">
                            <div className="flex justify-end gap-2">
                              <button
                                type="button"
                                onClick={() => openEditModal(item)}
                                className="inline-flex min-h-10 items-center gap-1 rounded-ios border border-brand-200 px-3 py-2 text-xs font-semibold text-brand-700 transition-colors hover:bg-brand-50 dark:border-brand-800 dark:text-brand-300 dark:hover:bg-brand-900/20"
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
              <Pagination
                page={inventoryPagination.page}
                totalPages={inventoryPagination.totalPages}
                totalItems={inventoryPagination.totalItems}
                pageSize={inventoryPagination.pageSize}
                onPageChange={inventoryPagination.setPage}
              />
            </div>
          )}
        </div>
      )}

      <Suspense fallback={null}>
        {isModalOpen && (
          <StockFormModal
            open={isModalOpen}
            draftContext="inventory"
            initialData={selectedEditItem}
            onClose={() => {
              closeModal();
              setSelectedEditItem(undefined);
            }}
            onSave={() => {
              closeModal();
              setSelectedEditItem(undefined);
            }}
            onDelete={selectedEditItem ? () => handleDelete(selectedEditItem.id) : undefined}
            onAddToInUse={
              selectedEditItem && selectedEditItem.status !== StockStatus.IN_USE
                ? handleAddToInUse
                : undefined
            }
          />
        )}

        {isDetailsOpen && (
          <StockDetailsModal
            open={isDetailsOpen}
            item={selectedDetailItem}
            storeName={selectedDetailItem ? getStoreName(selectedDetailItem.storeId) : ''}
            onSendToSale={handleSendToSale}
            isSendingToSale={isSendingToSale}
            onClose={() => {
              closeDetails();
              setSelectedDetailItem(undefined);
            }}
            onEdit={
              selectedDetailItem
                ? () => {
                    closeDetails();
                    openEditModal(selectedDetailItem);
                  }
                : undefined
            }
          />
        )}
      </Suspense>

    </div>
  );
};

export default Inventory;
