import React, { useEffect, useMemo, useState } from 'react';
import { useDisclosure } from '../hooks/useDisclosure';
import { AlertTriangle, Battery, Box, Calculator, Calendar, ChevronLeft, ChevronRight, Download, Edit, MessageCircle, RotateCcw, Send, Smartphone, Store, Tag, Wrench } from 'lucide-react';
import { m, AnimatePresence } from 'framer-motion';
import Modal from './ui/Modal';
import IOSButton from './ui/IOSButton';
import { Stagger } from './motion';
import { CardFeeSettings, SimulatorTradeInAdjustment, SimulatorTradeInValue, StockItem, StockStatus } from '../types';
import { useToast } from './ui/ToastProvider';
import { formatCurrencyBRL } from '../utils/inputMasks';
import { DEFAULT_CARD_FEE_SETTINGS } from '../utils/cardFees';
import { StockSimulatorModal } from './StockSimulatorModal';

interface StockDetailsModalProps {
  open: boolean;
  onClose: () => void;
  onEdit?: () => void;
  onSendToSale?: () => void;
  onReturnToStock?: () => void;
  onEditReservation?: () => void;
  onReleaseReservation?: () => void;
  onSellReserved?: () => void;
  isSendingToSale?: boolean;
  isReturningToStock?: boolean;
  isReleasingReservation?: boolean;
  item?: StockItem;
  storeName?: string;
  simulatorTradeInValues?: SimulatorTradeInValue[];
  simulatorTradeInAdjustments?: SimulatorTradeInAdjustment[];
  cardFeeSettings?: CardFeeSettings;
}

type ShareOptions = {
  includePrice: boolean;
  includeSpecs: boolean;
  includeIdentifierMasked: boolean;
  includeObservations: boolean;
  includePhotos: boolean;
};

const maskIdentifier = (value?: string) => {
  const raw = (value || '').trim();
  if (!raw) return '-';
  if (raw.length <= 4) return raw;
  return `${'*'.repeat(Math.max(0, raw.length - 4))}${raw.slice(-4)}`;
};

const isIosDevice = () => {
  if (typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent.toLowerCase();
  return /iphone|ipad|ipod/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
};

const fileNameFromUrl = (url: string, fallback: string) => {
  try {
    const path = new URL(url).pathname;
    const candidate = path.split('/').pop() || fallback;
    return candidate.split('?')[0] || fallback;
  } catch {
    return fallback;
  }
};

const safeBaseName = (value: string) =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'aparelho';

export const StockDetailsModal: React.FC<StockDetailsModalProps> = ({
  open,
  onClose,
  onEdit,
  onSendToSale,
  onReturnToStock,
  onEditReservation,
  onReleaseReservation,
  onSellReserved,
  isSendingToSale = false,
  isReturningToStock = false,
  isReleasingReservation = false,
  item,
  storeName,
  simulatorTradeInValues = [],
  simulatorTradeInAdjustments = [],
  cardFeeSettings = DEFAULT_CARD_FEE_SETTINGS
}) => {
  const [currentPhotoIndex, setCurrentPhotoIndex] = useState(0);
  const photos = item?.photos || [];

  useEffect(() => {
    if (open) setCurrentPhotoIndex(0);
  }, [open, item]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!open || photos.length <= 1) return;
      if (e.key === 'ArrowLeft') handlePrev();
      if (e.key === 'ArrowRight') handleNext();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [open, photos.length, currentPhotoIndex]);

  const handleNext = () => {
    setCurrentPhotoIndex((prev) => (prev + 1) % photos.length);
  };

  const handlePrev = () => {
    setCurrentPhotoIndex((prev) => (prev - 1 + photos.length) % photos.length);
  };
  const toast = useToast();
  const { isOpen: isShareModalOpen, open: openShareModal, close: closeShareModal } = useDisclosure();
  const { isOpen: isSimulatorModalOpen, open: openSimulatorModal, close: closeSimulatorModal } = useDisclosure();
  const [isSharing, setIsSharing] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [shareOptions, setShareOptions] = useState<ShareOptions>({
    includePrice: true,
    includeSpecs: true,
    includeIdentifierMasked: true,
    includeObservations: true,
    includePhotos: true
  });

  useEffect(() => {
    if (!item) return;
    setShareOptions((prev) => ({
      ...prev,
      includePhotos: item.photos.length > 0
    }));
  }, [item]);

  const shareMessage = useMemo(() => {
    if (!item) return '';
    const lines: string[] = [];
    lines.push(`*${item.model}*`);

    if (shareOptions.includeSpecs) {
      lines.push(`Condição: ${item.condition}`);
      lines.push(`Capacidade: ${item.capacity || '-'}`);
      lines.push(`Cor: ${item.color || '-'}`);
      if (typeof item.batteryHealth === 'number') {
        lines.push(`Bateria: ${item.batteryHealth}%`);
      }
      lines.push(`Loja: ${storeName || '-'}`);
    }

    if (shareOptions.includePrice) {
      lines.push(`Preço: ${formatCurrencyBRL(item.sellPrice)}`);
    }

    if (shareOptions.includeIdentifierMasked && item.imei) {
      lines.push(`Identificação (mascarada): ${maskIdentifier(item.imei)}`);
    }

    if (shareOptions.includeObservations) {
      lines.push(`Observações: ${item.observations || item.notes || 'Sem observações.'}`);
    }

    return lines.join('\n');
  }, [item, shareOptions, storeName]);

  if (!item) return null;

  const repairCosts = item.costs?.reduce((acc, cost) => acc + cost.amount, 0) || 0;
  const totalCost = item.purchasePrice + repairCosts;
  const profit = item.sellPrice - totalCost;
  const entryDate = item.entryDate ? new Date(item.entryDate).toLocaleDateString('pt-BR') : '-';
  const reservation = item.reservation || null;
  const reservationExpiresDate = reservation?.expiresAt ? new Date(reservation.expiresAt) : null;
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const isReservationExpired = !!reservationExpiresDate && reservationExpiresDate < todayStart;
  const reservationDate = reservation?.reservedAt ? new Date(reservation.reservedAt).toLocaleDateString('pt-BR') : '-';
  const reservationExpiresLabel = reservationExpiresDate ? reservationExpiresDate.toLocaleDateString('pt-BR') : 'Sem validade';
  const statusBadgeClass =
    item.status === StockStatus.PREPARATION
      ? 'ios-badge-orange'
      : item.status === StockStatus.RESERVED
        ? 'ios-badge bg-amber-100 text-amber-700 dark:bg-amber-900/20 dark:text-amber-300'
        : 'ios-badge-green';

  const fetchPhotoFiles = async () => {
    const base = safeBaseName(item.model);
    const files: File[] = [];

    for (let index = 0; index < item.photos.length; index += 1) {
      const photoUrl = item.photos[index];
      const response = await fetch(photoUrl);
      if (!response.ok) continue;
      const blob = await response.blob();
      const sourceName = fileNameFromUrl(photoUrl, `${base}-${index + 1}.jpg`);
      const ext = sourceName.includes('.') ? sourceName.split('.').pop() : 'jpg';
      files.push(new File([blob], `${base}-${index + 1}.${ext}`, { type: blob.type || 'image/jpeg' }));
    }

    return files;
  };

  const handleShareViaWhatsApp = async () => {
    setIsSharing(true);
    try {
      const canNativeShare = typeof navigator !== 'undefined' && typeof navigator.share === 'function';
      const canShareFiles =
        canNativeShare &&
        typeof navigator.canShare === 'function' &&
        shareOptions.includePhotos &&
        item.photos.length > 0;

      if (canShareFiles) {
        try {
          const files = await fetchPhotoFiles();
          if (files.length > 0 && navigator.canShare({ files })) {
            await navigator.share({
              title: item.model,
              text: shareMessage,
              files
            });
            toast.success('Conteúdo preparado para compartilhamento.');
            closeShareModal();
            return;
          }
        } catch {
          // fallback to WhatsApp deep-link below
        }
      }

      const encoded = encodeURIComponent(shareMessage);
      window.open(`https://wa.me/?text=${encoded}`, '_blank', 'noopener,noreferrer');

      if (shareOptions.includePhotos && item.photos.length > 0) {
        toast.info('WhatsApp aberto. Baixando fotos para você anexar na conversa...');
        await handleDownloadPhotos();
      } else {
        toast.success('WhatsApp aberto com a mensagem do aparelho.');
      }
      closeShareModal();
    } catch {
      toast.error('Não foi possível iniciar o compartilhamento.');
    } finally {
      setIsSharing(false);
    }
  };

  const handleDownloadPhotos = async () => {
    if (!item.photos.length) {
      toast.info('Este aparelho não possui fotos cadastradas.');
      return;
    }

    setIsDownloading(true);
    try {
      const onIOS = isIosDevice();
      const canNativeShare = typeof navigator !== 'undefined' && typeof navigator.share === 'function';
      const canShareFiles = canNativeShare && typeof navigator.canShare === 'function';

      if (onIOS && canShareFiles) {
        try {
          const files = await fetchPhotoFiles();
          if (files.length > 0 && navigator.canShare({ files })) {
            await navigator.share({
              title: `Fotos ${item.model}`,
              text: 'Use "Salvar em Fotos" para enviar ao rolo da câmera.',
              files
            });
            toast.info('No menu de compartilhamento, escolha "Salvar em Fotos" para enviar ao rolo da câmera.');
            return;
          }
        } catch {
          // fallback para download/abertura de abas
        }
      }

      let fallbackOpened = 0;

      for (let index = 0; index < item.photos.length; index += 1) {
        const photoUrl = item.photos[index];
        try {
          const response = await fetch(photoUrl);
          if (!response.ok) throw new Error('download-failed');
          const blob = await response.blob();
          const objectUrl = URL.createObjectURL(blob);

          const anchor = document.createElement('a');
          anchor.href = objectUrl;
          anchor.download = fileNameFromUrl(photoUrl, `${safeBaseName(item.model)}-${index + 1}.jpg`);
          anchor.rel = 'noopener';
          document.body.appendChild(anchor);
          anchor.click();
          anchor.remove();

          setTimeout(() => URL.revokeObjectURL(objectUrl), 500);
        } catch {
          window.open(photoUrl, '_blank', 'noopener,noreferrer');
          fallbackOpened += 1;
        }
      }

      if (fallbackOpened > 0) {
        toast.info('Algumas fotos foram abertas em nova aba para salvar manualmente.');
      } else {
        toast.success(`Download de ${item.photos.length} foto(s) iniciado.`);
      }

      if (onIOS) {
        toast.info('No iPhone, toque e segure na imagem e escolha "Salvar em Fotos" quando necessário.');
      }
    } finally {
      setIsDownloading(false);
    }
  };

  return (
    <>
      <Modal
        open={open}
        onClose={onClose}
        title="Detalhes do Aparelho"
        size="xl"
        footer={
          <div className="space-y-2">
            {item.status === StockStatus.PREPARATION && onSendToSale && (
              <IOSButton
                variant="primary"
                onClick={onSendToSale}
                loading={isSendingToSale}
                leftIcon={<Send size={16} />}
                className="w-full"
              >
                Enviar para venda
              </IOSButton>
            )}
            {item.status === StockStatus.IN_USE && onReturnToStock && (
              <IOSButton
                variant="primary"
                onClick={onReturnToStock}
                loading={isReturningToStock}
                leftIcon={<RotateCcw size={16} />}
                className="w-full"
              >
                Devolver ao estoque
              </IOSButton>
            )}
            {item.status === StockStatus.RESERVED && onSellReserved && (
              <IOSButton variant="primary" onClick={onSellReserved} leftIcon={<Tag size={16} />} className="w-full">
                Vender reservado
              </IOSButton>
            )}
            <div className="grid grid-cols-2 gap-2">
              <IOSButton variant="secondary" onClick={() => openSimulatorModal()} leftIcon={<Calculator size={16} />}>
                Simulador
              </IOSButton>
              <IOSButton variant="secondary" onClick={() => openShareModal()} leftIcon={<MessageCircle size={16} />}>
                Compartilhar
              </IOSButton>
              {item.status === StockStatus.RESERVED && onReleaseReservation && (
                <IOSButton
                  variant="secondary"
                  onClick={onReleaseReservation}
                  loading={isReleasingReservation}
                  leftIcon={<RotateCcw size={16} />}
                >
                  Liberar reserva
                </IOSButton>
              )}
              {item.status === StockStatus.RESERVED && onEditReservation && (
                <IOSButton variant="secondary" onClick={onEditReservation} leftIcon={<Edit size={16} />}>
                  Editar reserva
                </IOSButton>
              )}
              <IOSButton
                variant="secondary"
                onClick={handleDownloadPhotos}
                loading={isDownloading}
                leftIcon={<Download size={16} />}
                className={!onEdit ? 'col-span-2' : ''}
              >
                Baixar fotos
              </IOSButton>
              {onEdit && (
                <IOSButton variant="primary" onClick={onEdit} leftIcon={<Edit size={16} />}>
                  Editar
                </IOSButton>
              )}
            </div>
          </div>
        }
      >
        <div className="space-y-6">
          <div className={`relative rounded-ios-xl overflow-hidden flex items-center justify-center group ${
            photos.length > 0
              ? 'bg-black/5 dark:bg-black h-[50vh] min-h-[300px] max-h-[600px]'
              : 'bg-gray-100/80 dark:bg-surface-dark-200 h-28'
          }`}>
            {photos.length > 0 ? (
              <div className="relative w-full h-full flex items-center justify-center p-2">
                <AnimatePresence mode="wait" initial={false}>
                  <m.img
                    key={photos[currentPhotoIndex]}
                    src={photos[currentPhotoIndex]}
                    initial={{ opacity: 0, scale: 0.95, x: 20 }}
                    animate={{ opacity: 1, scale: 1, x: 0 }}
                    exit={{ opacity: 0, scale: 1.05, x: -20 }}
                    transition={{ 
                      type: "spring",
                      stiffness: 300,
                      damping: 30,
                      opacity: { duration: 0.2 }
                    }}
                    drag="x"
                    dragConstraints={{ left: 0, right: 0 }}
                    dragElastic={0.7}
                    onDragEnd={(_, info) => {
                      const swipeThreshold = 50;
                      if (info.offset.x > swipeThreshold) handlePrev();
                      else if (info.offset.x < -swipeThreshold) handleNext();
                    }}
                    className="max-w-full max-h-full w-auto h-auto object-contain cursor-grab active:cursor-grabbing shadow-lg"
                    alt={`${item?.model} - foto ${currentPhotoIndex + 1}`}
                  />
                </AnimatePresence>

                {photos.length > 1 && (
                  <>
                    <button
                      onClick={handlePrev}
                      className="absolute left-2 top-1/2 -translate-y-1/2 p-2 rounded-full bg-black/30 text-white hover:bg-black/50 transition-colors backdrop-blur-sm"
                      aria-label="Foto anterior"
                    >
                      <ChevronLeft size={24} />
                    </button>
                    <button
                      onClick={handleNext}
                      className="absolute right-2 top-1/2 -translate-y-1/2 p-2 rounded-full bg-black/30 text-white hover:bg-black/50 transition-colors backdrop-blur-sm"
                      aria-label="Próxima foto"
                    >
                      <ChevronRight size={24} />
                    </button>
                    <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-1.5">
                      {photos.map((_, i) => (
                        <div
                          key={i}
                          className={`w-1.5 h-1.5 rounded-full transition-all ${
                            i === currentPhotoIndex ? 'bg-white w-4' : 'bg-white/40'
                          }`}
                        />
                      ))}
                    </div>
                  </>
                )}
              </div>
            ) : (
              <div className="w-full h-full flex flex-col items-center justify-center gap-1.5 text-gray-400 dark:text-surface-dark-400">
                <Smartphone size={28} className="opacity-50" />
                <span className="text-ios-caption font-medium uppercase tracking-wider">Sem fotos</span>
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-1 gap-4">

            <div className="space-y-3">
              <div>
                <h3 className="text-xl font-bold text-gray-900 dark:text-white">{item.model}</h3>
                <p className="text-sm text-gray-500 dark:text-surface-dark-500">{[item.capacity, item.color].filter(Boolean).join(' · ') || 'Sem detalhes'}</p>
              </div>

              <div className="flex flex-wrap gap-2">
                <span className="ios-badge-blue">{item.condition}</span>
                <span className={statusBadgeClass}>{item.status}</span>
                {isReservationExpired && (
                  <span className="ios-badge bg-red-100 text-red-700 dark:bg-red-900/20 dark:text-red-300">
                    Reserva vencida
                  </span>
                )}
                <span className={item.hasBox ? 'ios-badge-blue' : 'ios-badge bg-gray-200 text-gray-700 dark:bg-surface-dark-300 dark:text-surface-dark-600'}>
                  <Box size={12} className="mr-1" /> {item.hasBox ? 'Com caixa' : 'Sem caixa'}
                </span>
              </div>

              {item.status === StockStatus.RESERVED && reservation && (
                <div className={`rounded-ios-lg border p-4 ${
                  isReservationExpired
                    ? 'border-red-200 bg-red-50 dark:border-red-900/40 dark:bg-red-900/20'
                    : 'border-amber-200 bg-amber-50 dark:border-amber-900/40 dark:bg-amber-900/20'
                }`}>
                  <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-wide text-amber-700 dark:text-amber-300">Reserva</p>
                      <p className="text-base font-bold text-gray-900 dark:text-white">{reservation.customerName}</p>
                      <p className="text-sm text-gray-600 dark:text-surface-dark-600">{reservation.customerPhone}</p>
                    </div>
                    {isReservationExpired && (
                      <span className="inline-flex items-center gap-1 text-xs font-semibold text-red-700 dark:text-red-300">
                        <AlertTriangle size={14} />
                        Vencida
                      </span>
                    )}
                  </div>
                  <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm">
                    <p className="text-gray-700 dark:text-surface-dark-700">
                      <span className="font-semibold">Reservado em:</span> {reservationDate}
                    </p>
                    <p className="text-gray-700 dark:text-surface-dark-700">
                      <span className="font-semibold">Validade:</span> {reservationExpiresLabel}
                    </p>
                    <p className="text-gray-700 dark:text-surface-dark-700">
                      <span className="font-semibold">Sinal:</span>{' '}
                      {typeof reservation.depositAmount === 'number' && reservation.depositAmount > 0
                        ? formatCurrencyBRL(reservation.depositAmount)
                        : 'Nao informado'}
                    </p>
                    <p className="text-gray-700 dark:text-surface-dark-700">
                      <span className="font-semibold">Forma:</span> {reservation.depositPaymentMethod || 'Nao informada'}
                    </p>
                  </div>
                  {reservation.notes && (
                    <p className="mt-3 text-sm text-gray-700 dark:text-surface-dark-700">
                      <span className="font-semibold">Observacoes:</span> {reservation.notes}
                    </p>
                  )}
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                <div className="ios-card p-3">
                  <p className="text-xs text-gray-500 dark:text-surface-dark-500 mb-1">IMEI/Serial</p>
                  <p className="font-mono text-gray-800 dark:text-surface-dark-700 break-all">{item.imei || '-'}</p>
                </div>
                <div className="ios-card p-3">
                  <p className="text-xs text-gray-500 dark:text-surface-dark-500 mb-1">Loja</p>
                  <p className="font-medium text-gray-800 dark:text-surface-dark-700 flex items-center gap-1">
                    <Store size={14} />
                    {storeName || '-'}
                  </p>
                </div>
                <div className="ios-card p-3">
                  <p className="text-xs text-gray-500 dark:text-surface-dark-500 mb-1">Entrada</p>
                  <p className="font-medium text-gray-800 dark:text-surface-dark-700 flex items-center gap-1">
                    <Calendar size={14} />
                    {entryDate}
                  </p>
                </div>
                <div className="ios-card p-3">
                  <p className="text-xs text-gray-500 dark:text-surface-dark-500 mb-1">Bateria</p>
                  <p className="font-medium text-gray-800 dark:text-surface-dark-700 flex items-center gap-1">
                    <Battery size={14} />
                    {item.batteryHealth ? `${item.batteryHealth}%` : '-'}
                  </p>
                </div>
              </div>
            </div>
          </div>

          <Stagger className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <Stagger.Item>
              <div className="ios-card p-4 h-full">
                <p className="text-xs text-gray-500 dark:text-surface-dark-500 mb-1">Custo Base</p>
                <p className="font-bold text-gray-900 dark:text-white tabular-nums">{formatCurrencyBRL(item.purchasePrice)}</p>
              </div>
            </Stagger.Item>
            <Stagger.Item>
              <div className="ios-card p-4 h-full">
                <p className="text-xs text-gray-500 dark:text-surface-dark-500 mb-1">Custos Extras</p>
                <p className="font-bold text-gray-900 dark:text-white tabular-nums">{formatCurrencyBRL(repairCosts)}</p>
              </div>
            </Stagger.Item>
            <Stagger.Item>
              <div className="ios-card p-4 h-full">
                <p className="text-xs text-gray-500 dark:text-surface-dark-500 mb-1">Custo Total</p>
                <p className="font-bold text-gray-900 dark:text-white tabular-nums">{formatCurrencyBRL(totalCost)}</p>
              </div>
            </Stagger.Item>
            <Stagger.Item>
              <div className="ios-card p-4 h-full">
                <p className="text-xs text-gray-500 dark:text-surface-dark-500 mb-1">Venda</p>
                <p className="font-bold text-gray-900 dark:text-white tabular-nums">{formatCurrencyBRL(item.sellPrice)}</p>
              </div>
            </Stagger.Item>
            <Stagger.Item className="md:col-span-2">
              <div className="ios-card p-4 h-full">
                <p className="text-xs text-gray-500 dark:text-surface-dark-500 mb-1">Lucro Estimado</p>
                <p className={`font-bold tabular-nums ${profit >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                  {formatCurrencyBRL(profit)}
                </p>
              </div>
            </Stagger.Item>
          </Stagger>

          <div className="ios-card p-4">
            <p className="text-sm font-semibold text-gray-900 dark:text-white flex items-center gap-2 mb-2">
              <Tag size={16} />
              Observacoes
            </p>
            <p className="text-sm text-gray-700 dark:text-surface-dark-700 whitespace-pre-wrap">{item.observations || item.notes || 'Sem observacoes.'}</p>
          </div>

          <div className="ios-card p-4">
            <p className="text-sm font-semibold text-gray-900 dark:text-white flex items-center gap-2 mb-2">
              <Wrench size={16} />
              Historico de Custos
            </p>
            {(item.costs || []).length === 0 ? (
              <p className="text-sm text-gray-500 dark:text-surface-dark-500">Nenhum custo adicional registrado.</p>
            ) : (
              <div className="space-y-2">
                {item.costs.map((cost) => (
                  <div
                    key={cost.id}
                    className="flex items-center justify-between rounded-ios border border-gray-200 dark:border-surface-dark-300 px-3 py-2"
                  >
                    <div>
                      <p className="text-sm font-medium text-gray-800 dark:text-surface-dark-700">{cost.description}</p>
                      <p className="text-xs text-gray-500 dark:text-surface-dark-500">{new Date(cost.date).toLocaleDateString('pt-BR')}</p>
                    </div>
                    <p className="text-sm font-semibold text-gray-900 dark:text-white">{formatCurrencyBRL(cost.amount)}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </Modal>

      <StockSimulatorModal
        open={isSimulatorModalOpen}
        onClose={() => closeSimulatorModal()}
        item={item}
        simulatorTradeInValues={simulatorTradeInValues}
        simulatorTradeInAdjustments={simulatorTradeInAdjustments}
        cardFeeSettings={cardFeeSettings}
      />

      <Modal
        open={isShareModalOpen}
        onClose={() => closeShareModal()}
        title="Compartilhar via WhatsApp"
        size="md"
        footer={
          <div className="flex justify-end gap-2">
            <IOSButton variant="secondary" onClick={() => closeShareModal()}>
              Cancelar
            </IOSButton>
            <IOSButton variant="primary" onClick={handleShareViaWhatsApp} loading={isSharing}>
              Abrir WhatsApp
            </IOSButton>
          </div>
        }
      >
        <div className="space-y-3">
          <p className="text-sm text-gray-600 dark:text-surface-dark-600">Selecione o que deseja enviar para o cliente:</p>
          <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-surface-dark-700">
            <input
              type="checkbox"
              checked={shareOptions.includeSpecs}
              onChange={(e) => setShareOptions((prev) => ({ ...prev, includeSpecs: e.target.checked }))}
            />
            Especificações do aparelho
          </label>
          <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-surface-dark-700">
            <input
              type="checkbox"
              checked={shareOptions.includePrice}
              onChange={(e) => setShareOptions((prev) => ({ ...prev, includePrice: e.target.checked }))}
            />
            Preço
          </label>
          <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-surface-dark-700">
            <input
              type="checkbox"
	              checked={shareOptions.includeIdentifierMasked}
	              onChange={(e) => setShareOptions((prev) => ({ ...prev, includeIdentifierMasked: e.target.checked }))}
	            />
	            Identificação mascarada
	          </label>
          <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-surface-dark-700">
            <input
              type="checkbox"
              checked={shareOptions.includeObservations}
              onChange={(e) => setShareOptions((prev) => ({ ...prev, includeObservations: e.target.checked }))}
            />
            Observações
          </label>
          <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-surface-dark-700">
            <input
              type="checkbox"
              checked={shareOptions.includePhotos}
              onChange={(e) => setShareOptions((prev) => ({ ...prev, includePhotos: e.target.checked }))}
              disabled={item.photos.length === 0}
            />
            Fotos ({item.photos.length})
          </label>
        </div>
      </Modal>
    </>
  );
};
