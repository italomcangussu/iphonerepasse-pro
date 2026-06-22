import React, { lazy, Suspense, useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { useDisclosure } from '../hooks/useDisclosure';
import { AnimatePresence, m, useReducedMotion } from 'framer-motion';
import { AlertTriangle, Battery, ChevronDown, Edit, Instagram, MessageCircle, Plus, RotateCcw, Search, Smartphone, Tag, X } from 'lucide-react';
import { useToast } from '../components/ui/ToastProvider';
import { useAsyncHandler } from '../hooks/useAsyncHandler';
import { useData } from '../services/dataContext';
import { Condition, StockItem, StockStatus } from '../types';
import { StockFormModal } from '../components/StockFormModal';
import { StockReservationModal } from '../components/StockReservationModal';
import Banner from '../components/ui/Banner';
import Pagination from '../components/ui/Pagination';
import { trackUxEvent } from '../services/telemetry';
import { iosFastEase, iosSpring, iosStagger } from '../components/motion/transitions';
import { useIsMobileViewport } from '../hooks/useIsMobileViewport';
import { usePaginatedRows } from '../hooks/usePaginatedRows';
import { ERP_COMPACT_CONTENT_MAX_WIDTH } from '../lib/erpResponsive';
import { CARD_INSTALLMENTS_MAX, DEFAULT_CARD_FEE_SETTINGS, getCardRate } from '../utils/cardFees';
import { formatCurrencyBRL } from '../utils/inputMasks';
import { usePermissions } from '../contexts/PermissionsContext';
import {
  buildStockShareText,
  compareStockItemsForDisplay,
  getReservationSummary,
  isReservationExpired as getIsReservationExpired,
  selectInventoryRows,
  type ShareChannel
} from './inventory/inventoryViewModel';

export { buildStockShareText } from './inventory/inventoryViewModel';

const DEFAULT_LIST_STATUSES: StockStatus[] = [StockStatus.AVAILABLE];
const DEFAULT_RESERVED_STATUSES: StockStatus[] = [StockStatus.RESERVED];
const DEFAULT_PREP_STATUSES: StockStatus[] = [StockStatus.PREPARATION];
const COMPLETE_SHARE_STOCK_STATUSES = new Set([StockStatus.AVAILABLE]);
const QUICK_STORE_FILTERS = [
  { id: 'all', label: 'Geral' },
  { id: 'city:sobral', label: 'Sobral' },
  { id: 'city:fortaleza', label: 'Fortaleza' }
] as const;
const INVENTORY_PAGE_SIZE_MOBILE = 12;
const INVENTORY_PAGE_SIZE_DESKTOP = 30;
const StockDetailsModal = lazy(() => import('../components/StockDetailsModal').then((module) => ({ default: module.StockDetailsModal })));

type ShareScope = 'current' | 'complete';

const Inventory: React.FC = () => {
  const {
    stock,
    removeStockItem,
    updateStockItem,
    reserveStockItem,
    updateStockReservation,
    releaseStockReservation,
    stores,
    cardFeeSettings = DEFAULT_CARD_FEE_SETTINGS,
    simulatorTradeInValues,
    simulatorTradeInAdjustments,
  } = useData();
  const toast = useToast();
  const run = useAsyncHandler();
  const reducedMotion = useReducedMotion();
  const isMobile = useIsMobileViewport(ERP_COMPACT_CONTENT_MAX_WIDTH);
  const { can } = usePermissions();
  const canEditInventory = can('inventory', 'editable');
  const canDeleteInventory = can('inventory', 'deletable');

  const { isOpen: isModalOpen, open: openModal, close: closeModal } = useDisclosure();
  const [selectedEditItem, setSelectedEditItem] = useState<StockItem | undefined>(undefined);
  const [selectedDetailItem, setSelectedDetailItem] = useState<StockItem | undefined>(undefined);
  const [selectedReservationItem, setSelectedReservationItem] = useState<StockItem | undefined>(undefined);
  const { isOpen: isDetailsOpen, open: openDetails, close: closeDetails } = useDisclosure();
  const { isOpen: isReservationModalOpen, open: openReservationModal, close: closeReservationModal } = useDisclosure();
  const [isSendingToSale, setIsSendingToSale] = useState(false);
  const [isSavingReservation, setIsSavingReservation] = useState(false);
  const [isReleasingReservation, setIsReleasingReservation] = useState(false);

  const [activeTab, setActiveTab] = useState<'list' | 'reserved' | 'prep' | 'custom'>('list');
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
  const [specialShareChannel, setSpecialShareChannel] = useState<ShareChannel | null>(null);
  const [specialShareSelectedIds, setSpecialShareSelectedIds] = useState<string[]>([]);
  const [specialInstallmentsOpen, setSpecialInstallmentsOpen] = useState(false);
  const isPreparationTab = activeTab === 'prep';

  useEffect(() => {
    localStorage.setItem('inventory:condition:v1', conditionFilter);
  }, [conditionFilter]);

  const filteredStock = useMemo(() => {
    return selectInventoryRows({
      stock,
      search: searchTerm,
      statuses: statusFilter,
      condition: conditionFilter,
      storeId: storeFilter,
      stores,
      ignoreCondition: isPreparationTab,
      now: new Date()
    });
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
      (activeTab === 'reserved' &&
        statusFilter.length === DEFAULT_RESERVED_STATUSES.length &&
        DEFAULT_RESERVED_STATUSES.every((status) => statusFilter.includes(status))) ||
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
  const isSpecialShareMode = specialShareChannel !== null;
  const specialSelectedItems = useMemo(
    () => filteredStock.filter((item) => specialShareSelectedIds.includes(item.id)),
    [filteredStock, specialShareSelectedIds]
  );
  const specialSelectedCount = specialSelectedItems.length;
  const specialSelectedLabel = `${specialSelectedCount} ${specialSelectedCount === 1 ? 'selecionado' : 'selecionados'}`;

  useEffect(() => {
    if (!isSpecialShareMode) return;
    const visibleIds = new Set(filteredStock.map((item) => item.id));
    setSpecialShareSelectedIds((current) => current.filter((id) => visibleIds.has(id)));
    setSpecialInstallmentsOpen(false);
  }, [filteredStock, isSpecialShareMode]);

  const endSpecialShareMode = () => {
    setSpecialShareChannel(null);
    setSpecialShareSelectedIds([]);
    setSpecialInstallmentsOpen(false);
  };

  const startSpecialShareMode = (channel: ShareChannel) => {
    if (filteredStock.length === 0) {
      toast.info('Nao ha aparelhos para compartilhar nesta lista.');
      setShareMenuOpen(null);
      return;
    }

    setSpecialShareChannel(channel);
    setSpecialShareSelectedIds([]);
    setSpecialInstallmentsOpen(false);
    setPendingShare(null);
    setShareMenuOpen(null);
  };

  const toggleSpecialShareItem = (itemId: string) => {
    setSpecialShareSelectedIds((current) => (
      current.includes(itemId) ? current.filter((id) => id !== itemId) : [...current, itemId]
    ));
  };

  const handleSpecialShareList = async (installments: number) => {
    if (!specialShareChannel || specialSelectedItems.length === 0) {
      toast.info('Selecione pelo menos um aparelho para compartilhar.');
      return;
    }

    const feeRate = getCardRate(cardFeeSettings, 'visa_master', installments);
    const text = buildStockShareText(specialSelectedItems, specialShareChannel, { installments, feeRate });

    if (specialShareChannel === 'whatsapp') {
      window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank', 'noopener,noreferrer');
      toast.success('WhatsApp aberto com a lista especial.');
      endSpecialShareMode();
      return;
    }

    try {
      if (typeof navigator !== 'undefined' && typeof navigator.share === 'function') {
        await navigator.share({ text });
      } else if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(text);
      }
      toast.success('Texto especial para Instagram preparado.');
      endSpecialShareMode();
    } catch (error: any) {
      if (error?.name !== 'AbortError') {
        toast.error('Nao foi possivel preparar o texto para Instagram.');
      }
    }
  };

  const specialShareFloatingBanner = typeof document === 'undefined'
    ? null
    : createPortal(
      <AnimatePresence initial={false}>
        {isSpecialShareMode && (
          <m.div
            aria-label="Banner flutuante da lista especial"
            initial={reducedMotion ? false : { opacity: 0, y: -18 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -18 }}
            transition={iosFastEase}
            className="fixed inset-x-0 top-[calc(env(safe-area-inset-top,0px)+5.75rem)] z-50 px-3 sm:px-6"
          >
            <div className="relative mx-auto max-w-3xl rounded-ios-lg border border-brand-200 bg-white/95 p-3 shadow-[0_14px_44px_rgba(15,23,42,0.22),0_0_28px_rgba(59,130,246,0.22)] backdrop-blur-xl dark:border-brand-800 dark:bg-surface-dark-100/95">
              {specialShareChannel === 'whatsapp' && (
                <span
                  aria-hidden="true"
                  className="absolute inset-y-4 left-0 w-1 rounded-r-full bg-emerald-500"
                />
              )}
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <p className="text-sm font-semibold app-text-primary">{specialSelectedLabel}</p>
                  <p className="text-xs app-text-muted">
                    {specialShareChannel === 'whatsapp' ? 'Lista especial para WhatsApp' : 'Lista especial para Instagram'}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={endSpecialShareMode}
                    className="ios-button-secondary min-h-[44px] px-3 text-ios-caption"
                  >
                    Cancelar
                  </button>
                  <div className="relative">
                    <button
                      type="button"
                      onClick={() => setSpecialInstallmentsOpen((current) => !current)}
                      disabled={specialSelectedCount === 0}
                      className="ios-button-primary min-h-[44px] px-4 text-ios-caption disabled:cursor-not-allowed disabled:opacity-50"
                      aria-expanded={specialInstallmentsOpen}
                      aria-haspopup="menu"
                    >
                      Escolher parcelas
                    </button>
                    {specialInstallmentsOpen && (
                      <div
                        role="menu"
                        className="absolute right-0 top-[calc(100%+0.5rem)] z-50 max-h-72 w-64 overflow-y-auto rounded-ios-lg border app-border bg-white py-1 shadow-ios26-lg dark:bg-surface-dark-100"
                      >
                        {Array.from({ length: CARD_INSTALLMENTS_MAX }, (_, index) => {
                          const installments = index + 1;
                          const rate = getCardRate(cardFeeSettings, 'visa_master', installments);
                          return (
                            <button
                              key={installments}
                              type="button"
                              role="menuitem"
                              onClick={() => void handleSpecialShareList(installments)}
                              className="w-full px-4 py-2.5 text-left text-sm font-medium app-text-primary hover:bg-brand-50 dark:hover:bg-brand-900/20"
                            >
                              {installments}x Visa/Master {rate.toFixed(2)}%
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </m.div>
        )}
      </AnimatePresence>,
      document.body
    );

  const getBatteryBadgeClass = (batteryHealth: number | null) => {
    if (batteryHealth === null) return 'app-text-muted';
    if (batteryHealth > 89) return 'bg-green-50 text-green-700 dark:bg-green-900/20 dark:text-green-300';
    if (batteryHealth > 79) return 'bg-amber-50 text-amber-700 dark:bg-amber-900/20 dark:text-amber-300';
    return 'bg-red-50 text-red-700 dark:bg-red-900/20 dark:text-red-300';
  };
  const isReservationExpired = (item: StockItem) => getIsReservationExpired(item, new Date());

  const openNewModal = () => {
    if (!canEditInventory) return;
    setSelectedEditItem(undefined);
    openModal();
  };

  const openEditModal = (item: StockItem) => {
    if (!canEditInventory) return;
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
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => startSpecialShareMode(channel)}
                  className="w-full text-left px-4 py-3 text-sm font-medium text-brand-700 hover:bg-brand-50 dark:text-brand-300 dark:hover:bg-brand-900/20"
                >
                  Lista especial
                </button>
              </>
            )}
          </div>
        )}
      </div>
    );
  };

  const handleDelete = async (id: string) => {
    if (!canDeleteInventory) {
      toast.error('Voce nao tem permissao para excluir aparelhos.');
      return;
    }

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

  const openReserveModal = (item: StockItem) => {
    if (!canEditInventory) return;
    setSelectedReservationItem(item);
    openReservationModal();
  };

  const handleCloseReservationModal = () => {
    if (isSavingReservation) return;
    closeReservationModal();
    setSelectedReservationItem(undefined);
  };

  const handleSaveReservation = async (input: Parameters<typeof reserveStockItem>[1]) => {
    if (!selectedReservationItem) return;
    setIsSavingReservation(true);
    try {
      if (selectedReservationItem.reservation?.id) {
        await updateStockReservation(selectedReservationItem.reservation.id, input);
        toast.success('Reserva atualizada.');
      } else {
        await reserveStockItem(selectedReservationItem.id, input);
        setActiveTab('reserved');
        setStatusFilter(DEFAULT_RESERVED_STATUSES);
        toast.success('Aparelho reservado.');
      }
      closeReservationModal();
      closeDetails();
      setSelectedReservationItem(undefined);
      setSelectedDetailItem(undefined);
    } catch (error: any) {
      toast.error(error?.message || 'Não foi possível salvar a reserva.');
    } finally {
      setIsSavingReservation(false);
    }
  };

  const handleReleaseReservation = async (item: StockItem) => {
    if (!canEditInventory) return;
    setIsReleasingReservation(true);
    try {
      await releaseStockReservation(item.id);
      closeDetails();
      setSelectedDetailItem(undefined);
      toast.success('Aparelho liberado para venda.');
    } catch (error: any) {
      toast.error(error?.message || 'Não foi possível liberar a reserva.');
    } finally {
      setIsReleasingReservation(false);
    }
  };

  const handleSellReserved = (item: StockItem) => {
    toast.info(`Venda reservada: selecione ${item.model} no PDV após liberar a reserva.`);
    window.location.hash = '#/pdv';
  };

  const handleAddToInUse = async () => {
    if (!selectedEditItem) return;
    if (!canEditInventory) {
      toast.error('Voce nao tem permissao para editar aparelhos.');
      return;
    }

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
    <div className={`inventory-page space-y-5 md:space-y-6 max-w-7xl mx-auto ${isSpecialShareMode ? 'pt-28 sm:pt-24' : ''}`}>
      <div className="inventory-header flex flex-col md:flex-row md:items-center justify-between gap-3 md:gap-4">
        <div>
          <h2 className="app-page-title">Estoque</h2>
          <p className="app-page-subtitle">
            Gerencie seu inventario
          </p>
        </div>
        {canEditInventory && (
          <button onClick={openNewModal} className="ios-button-primary flex items-center gap-2 w-full md:w-auto justify-center">
            <Plus size={20} />
            Adicionar Aparelho
          </button>
        )}
      </div>

      <div className="inventory-toolbar space-y-3">
        <div className="inventory-filter-row grid gap-2 md:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)]">
          <div className="ios-segmented-control inventory-segment-strip">
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
                setActiveTab('reserved');
                setStatusFilter(DEFAULT_RESERVED_STATUSES);
              }}
              className={`ios-segment ${activeTab === 'reserved' ? 'ios-segment-active' : ''}`}
            >
              Reservado
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

          <div className="ios-segmented-control inventory-segment-strip">
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
        </div>

        <div className={`inventory-filter-row grid gap-2 ${isPreparationTab ? 'md:grid-cols-1' : 'md:grid-cols-[minmax(0,0.95fr)_minmax(0,1.4fr)]'}`}>
          {!isPreparationTab && (
            <div className="ios-segmented-control inventory-segment-strip">
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

          <div className="app-search-wrap flex-1 group">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 app-search-icon pointer-events-none" size={18} />
            <input
              type="search"
              aria-label="Buscar no estoque"
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

        <div className="inventory-share-actions grid grid-cols-2 gap-2 sm:flex sm:flex-row sm:justify-end">
          {renderShareMenu('whatsapp')}
          {renderShareMenu('instagram')}
        </div>
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
                else if (activeTab === 'reserved') setStatusFilter(DEFAULT_RESERVED_STATUSES);
                else setStatusFilter(DEFAULT_LIST_STATUSES);
                setSearchTerm('');
              }}
            >
              Limpar filtros
            </button>
          </m.div>
        )}
      </AnimatePresence>

      <AnimatePresence initial={false}>
        {isSpecialShareMode && (
          <m.div
            initial={reducedMotion ? false : { opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={iosFastEase}
            className="flex flex-col gap-2 rounded-ios-lg border border-brand-200 bg-brand-50/80 px-4 py-3 text-sm text-brand-800 shadow-[0_0_22px_rgba(59,130,246,0.18)] dark:border-brand-800 dark:bg-brand-900/20 dark:text-brand-200 sm:flex-row sm:items-center sm:justify-between"
          >
            <div>
              <p className="font-semibold">Lista especial ativa</p>
              <p className="text-xs text-brand-700 dark:text-brand-300">Toque nos aparelhos da lista filtrada para montar o compartilhamento.</p>
            </div>
            <button
              type="button"
              onClick={endSpecialShareMode}
              className="text-left text-xs font-semibold text-brand-700 hover:underline dark:text-brand-200 sm:text-right"
            >
              Cancelar seleção
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
        <div data-testid="inventory-content" className={`space-y-4 ${isSpecialShareMode ? 'pt-28 sm:pt-24' : ''}`}>
          <div className="inventory-summary-grid grid grid-cols-2 lg:grid-cols-4 gap-3">
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
                const isSpecialSelected = specialShareSelectedIds.includes(item.id);
                return (
                  <m.div
                    key={item.id}
                    initial={reducedMotion ? false : { opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ ...iosFastEase, delay: staggerDelay }}
                    className={`ios-card p-4 space-y-3 transition-all ${isSpecialShareMode ? 'border-brand-400 shadow-[0_0_24px_rgba(59,130,246,0.28)]' : ''} ${isSpecialSelected ? 'bg-brand-50/90 ring-2 ring-brand-400 dark:bg-brand-900/25' : ''}`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <button
                        type="button"
                        onClick={() => (isSpecialShareMode ? toggleSpecialShareItem(item.id) : openDetailsModal(item))}
                        className="text-left min-w-0 flex-1"
                        title={isSpecialShareMode ? 'Selecionar para lista especial' : 'Ver detalhes do aparelho'}
                        aria-label={
                          isSpecialShareMode
                            ? `${isSpecialSelected ? 'Remover' : 'Selecionar'} ${item.model}`
                            : `Ver detalhes de ${item.model}`
                        }
                        aria-pressed={isSpecialShareMode ? isSpecialSelected : undefined}
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
                            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-ios-caption font-semibold ${batteryBadgeClass}`}>
                          <Battery size={12} />
                          {batteryHealth}%
                        </span>
                      ) : (
                          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-ios-caption font-semibold ${batteryBadgeClass}`}>
                          Bateria não informada
                        </span>
                      )}
                      <span className={item.hasBox ? 'ios-badge-blue' : 'ios-badge app-surface-soft app-text-secondary'}>
                        Caixa: {item.hasBox ? 'Sim' : 'Não'}
                      </span>
                      {item.status === StockStatus.RESERVED && (
                        <span className={isReservationExpired(item) ? 'ios-badge bg-red-100 text-red-700 dark:bg-red-900/20 dark:text-red-300' : 'ios-badge bg-amber-100 text-amber-700 dark:bg-amber-900/20 dark:text-amber-300'}>
                          {isReservationExpired(item) ? 'Reserva vencida' : 'Reservado'}
                        </span>
                      )}
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs app-text-secondary">
                      <p>Loja: {getStoreName(item.storeId)}</p>
                      <p className="font-mono truncate">IMEI/Serial: {item.imei || '-'}</p>
                    </div>

                    {item.observations && (
                      <p className="text-xs text-amber-700 dark:text-amber-400 truncate">Obs: {item.observations}</p>
                    )}
                    {item.status === StockStatus.RESERVED && (
                      <p className={`text-xs truncate ${isReservationExpired(item) ? 'text-red-700 dark:text-red-300' : 'text-amber-700 dark:text-amber-300'}`}>
                        Reserva: {getReservationSummary(item)}
                      </p>
                    )}

                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => (isSpecialShareMode ? toggleSpecialShareItem(item.id) : openDetailsModal(item))}
                        className="ios-button-secondary text-xs justify-center"
                        aria-label={
                          isSpecialShareMode
                            ? `${isSpecialSelected ? 'Remover' : 'Selecionar'} ${item.model}`
                            : `Ver detalhes de ${item.model}`
                        }
                      >
                        {isSpecialShareMode ? (isSpecialSelected ? 'Selecionado' : 'Selecionar') : 'Detalhes'}
                      </button>
                      {canEditInventory && item.status === StockStatus.AVAILABLE && (
                        <button
                          type="button"
                          onClick={() => openReserveModal(item)}
                          className="ios-button-secondary text-xs inline-flex items-center justify-center gap-1"
                          aria-label={`Reservar ${item.model}`}
                        >
                          <Tag size={14} />
                          Reservar
                        </button>
                      )}
                      {canEditInventory && item.status === StockStatus.RESERVED && (
                        <button
                          type="button"
                          onClick={() => void handleReleaseReservation(item)}
                          className="ios-button-secondary text-xs inline-flex items-center justify-center gap-1"
                          aria-label={`Liberar ${item.model}`}
                        >
                          <RotateCcw size={14} />
                          Liberar
                        </button>
                      )}
                      {canEditInventory && (
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
                      )}
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
                      <th className="hidden lg:table-cell text-left px-4 py-3 font-semibold">Loja</th>
                      <th className="hidden lg:table-cell text-left px-4 py-3 font-semibold">IMEI/Serial</th>
                      <th className="hidden lg:table-cell text-left px-4 py-3 font-semibold">Caixa</th>
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
                      const isSpecialSelected = specialShareSelectedIds.includes(item.id);
                      return (
                        <m.tr
                          key={item.id}
                          initial={reducedMotion ? false : { opacity: 0, y: 6 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ ...iosFastEase, delay: staggerDelay }}
                          whileHover={reducedMotion ? undefined : { backgroundColor: 'rgba(59, 130, 246, 0.04)' }}
                          className={`app-table-row-hover transition-all ${isSpecialShareMode ? 'outline outline-1 -outline-offset-2 outline-brand-300 shadow-[inset_0_0_18px_rgba(59,130,246,0.14)]' : ''} ${isSpecialSelected ? 'bg-brand-50/80 dark:bg-brand-900/25' : ''}`}
                        >
                          <td className="px-4 py-3">
                            <button
                              type="button"
                              onClick={() => (isSpecialShareMode ? toggleSpecialShareItem(item.id) : openDetailsModal(item))}
                              className="text-left group w-full"
                              title={isSpecialShareMode ? 'Selecionar para lista especial' : 'Ver detalhes do aparelho'}
                              aria-label={
                                isSpecialShareMode
                                  ? `${isSpecialSelected ? 'Remover' : 'Selecionar'} ${item.model}`
                                  : `Ver detalhes de ${item.model}`
                              }
                              aria-pressed={isSpecialShareMode ? isSpecialSelected : undefined}
                            >
                              <p className={`font-semibold app-text-primary group-hover:text-brand-600 truncate ${isSpecialSelected ? 'text-brand-700 dark:text-brand-200' : ''}`}>{item.model}</p>
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
                                  <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-ios-caption font-semibold ${batteryBadgeClass}`}>
                                    <Battery size={12} />
                                    {batteryHealth}%
                                  </span>
                                ) : (
                                  <span className={batteryBadgeClass}>Bateria não informada</span>
                                )}
                                {item.status === StockStatus.RESERVED && (
                                  <span className={isReservationExpired(item) ? 'ios-badge bg-red-100 text-red-700 dark:bg-red-900/20 dark:text-red-300' : 'ios-badge bg-amber-100 text-amber-700 dark:bg-amber-900/20 dark:text-amber-300'}>
                                    {isReservationExpired(item) ? (
                                      <span className="inline-flex items-center gap-1">
                                        <AlertTriangle size={12} />
                                        Reserva vencida
                                      </span>
                                    ) : 'Reservado'}
                                  </span>
                                )}
                              </div>
                              {item.status === StockStatus.RESERVED && (
                                <p className={`text-xs truncate mt-0.5 ${isReservationExpired(item) ? 'text-red-700 dark:text-red-300' : 'text-amber-700 dark:text-amber-300'}`}>
                                  Reserva: {getReservationSummary(item)}
                                </p>
                              )}
                              {item.observations && (
                                <p className="text-xs text-amber-700 dark:text-amber-400 truncate mt-0.5">
                                  Obs: {item.observations}
                                </p>
                              )}
                            </button>
                          </td>
                          <td className="hidden lg:table-cell px-4 py-3 text-sm app-text-secondary">{getStoreName(item.storeId)}</td>
                          <td className="hidden lg:table-cell px-4 py-3 text-sm font-mono app-text-secondary">
                            {item.imei || '-'}
                          </td>
                          <td className="hidden lg:table-cell px-4 py-3">
                            <span className={item.hasBox ? 'ios-badge-blue' : 'ios-badge app-surface-soft app-text-secondary'}>
                              {item.hasBox ? 'Sim' : 'Não'}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-sm font-semibold app-text-primary text-right">
                            {formatCurrencyBRL(item.sellPrice)}
                          </td>
                          <td className="px-4 py-3 text-right">
                            <div className="flex justify-end gap-2">
                              {canEditInventory && item.status === StockStatus.AVAILABLE && (
                                <button
                                  type="button"
                                  onClick={() => openReserveModal(item)}
                                  className="inline-flex min-h-[44px] items-center gap-1 rounded-ios border border-amber-200 px-3 py-2 text-ios-caption font-semibold text-amber-700 transition-colors hover:bg-amber-50 dark:border-amber-800 dark:text-amber-300 dark:hover:bg-amber-900/20"
                                  aria-label={`Reservar ${item.model}`}
                                  title="Reservar"
                                >
                                  <Tag size={14} />
                                  <span className="hidden sm:inline">Reservar</span>
                                </button>
                              )}
                              {canEditInventory && item.status === StockStatus.RESERVED && (
                                <button
                                  type="button"
                                  onClick={() => void handleReleaseReservation(item)}
                                  className="inline-flex min-h-[44px] items-center gap-1 rounded-ios border border-amber-200 px-3 py-2 text-ios-caption font-semibold text-amber-700 transition-colors hover:bg-amber-50 dark:border-amber-800 dark:text-amber-300 dark:hover:bg-amber-900/20"
                                  aria-label={`Liberar ${item.model}`}
                                  title="Liberar para venda"
                                >
                                  <RotateCcw size={14} />
                                  <span className="hidden sm:inline">Liberar</span>
                                </button>
                              )}
                              {canEditInventory && (
                                <button
                                  type="button"
                                  onClick={() => openEditModal(item)}
                                  className="inline-flex min-h-[44px] items-center gap-1 rounded-ios border border-brand-200 px-3 py-2 text-ios-caption font-semibold text-brand-700 transition-colors hover:bg-brand-50 dark:border-brand-800 dark:text-brand-300 dark:hover:bg-brand-900/20"
                                  aria-label={`Editar ${item.model}`}
                                  title="Editar"
                                >
                                  <Edit size={14} />
                                  <span className="hidden sm:inline">Editar</span>
                                </button>
                              )}
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

      {specialShareFloatingBanner}

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
            onDelete={selectedEditItem && canDeleteInventory ? () => handleDelete(selectedEditItem.id) : undefined}
            onAddToInUse={
              selectedEditItem && canEditInventory && selectedEditItem.status !== StockStatus.IN_USE
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
            simulatorTradeInValues={simulatorTradeInValues}
            simulatorTradeInAdjustments={simulatorTradeInAdjustments}
            cardFeeSettings={cardFeeSettings}
            onSendToSale={handleSendToSale}
            isSendingToSale={isSendingToSale}
            onEditReservation={
              selectedDetailItem?.status === StockStatus.RESERVED && canEditInventory
                ? () => {
                    if (!selectedDetailItem) return;
                    setSelectedReservationItem(selectedDetailItem);
                    openReservationModal();
                  }
                : undefined
            }
            onReleaseReservation={
              selectedDetailItem?.status === StockStatus.RESERVED && canEditInventory
                ? () => {
                    if (selectedDetailItem) void handleReleaseReservation(selectedDetailItem);
                  }
                : undefined
            }
            onSellReserved={
              selectedDetailItem?.status === StockStatus.RESERVED
                ? () => {
                    if (selectedDetailItem) handleSellReserved(selectedDetailItem);
                  }
                : undefined
            }
            isReleasingReservation={isReleasingReservation}
            onClose={() => {
              closeDetails();
              setSelectedDetailItem(undefined);
            }}
            onEdit={
              selectedDetailItem && canEditInventory
                ? () => {
                    closeDetails();
                    openEditModal(selectedDetailItem);
                  }
                : undefined
            }
          />
        )}
        {isReservationModalOpen && (
          <StockReservationModal
            open={isReservationModalOpen}
            stockItem={selectedReservationItem}
            initialReservation={selectedReservationItem?.reservation || null}
            isSaving={isSavingReservation}
            onClose={handleCloseReservationModal}
            onSave={handleSaveReservation}
          />
        )}
      </Suspense>

    </div>
  );
};

export default Inventory;
