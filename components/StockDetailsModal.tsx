import React, { useEffect, useMemo, useState } from 'react';
import { Battery, Box, Calendar, Download, Edit, MessageCircle, Send, Smartphone, Store, Tag, Wrench } from 'lucide-react';
import Modal from './ui/Modal';
import IOSButton from './ui/IOSButton';
import { Stagger } from './motion';
import { StockItem, StockStatus } from '../types';
import { useToast } from './ui/ToastProvider';

interface StockDetailsModalProps {
  open: boolean;
  onClose: () => void;
  onEdit?: () => void;
  onSendToSale?: () => void;
  isSendingToSale?: boolean;
  item?: StockItem;
  storeName?: string;
}

type ShareOptions = {
  includePrice: boolean;
  includeSpecs: boolean;
  includeImeiMasked: boolean;
  includeObservations: boolean;
  includePhotos: boolean;
};

const formatCurrency = (value: number) => value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

const maskImei = (imei?: string) => {
  const digits = (imei || '').replace(/\D/g, '');
  if (!digits) return '-';
  if (digits.length <= 4) return digits;
  return `${'*'.repeat(Math.max(0, digits.length - 4))}${digits.slice(-4)}`;
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
  isSendingToSale = false,
  item,
  storeName
}) => {
  const toast = useToast();
  const [isShareModalOpen, setIsShareModalOpen] = useState(false);
  const [isSharing, setIsSharing] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [shareOptions, setShareOptions] = useState<ShareOptions>({
    includePrice: true,
    includeSpecs: true,
    includeImeiMasked: true,
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

  if (!item) return null;

  const repairCosts = item.costs?.reduce((acc, cost) => acc + cost.amount, 0) || 0;
  const totalCost = item.purchasePrice + repairCosts;
  const profit = item.sellPrice - totalCost;
  const entryDate = item.entryDate ? new Date(item.entryDate).toLocaleDateString('pt-BR') : '-';

  const shareMessage = useMemo(() => {
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
      lines.push(`Preço: ${formatCurrency(item.sellPrice)}`);
    }

    if (shareOptions.includeImeiMasked && item.imei) {
      lines.push(`IMEI (mascarado): ${maskImei(item.imei)}`);
    }

    if (shareOptions.includeObservations) {
      lines.push(`Observações: ${item.observations || item.notes || 'Sem observações.'}`);
    }

    if (shareOptions.includePhotos && item.photos.length > 0) {
      lines.push('');
      lines.push('Fotos:');
      item.photos.forEach((url, index) => lines.push(`${index + 1}. ${url}`));
    }

    return lines.join('\n');
  }, [item, shareOptions, storeName]);

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
            setIsShareModalOpen(false);
            return;
          }
        } catch {
          // fallback to WhatsApp deep-link below
        }
      }

      const encoded = encodeURIComponent(shareMessage);
      window.open(`https://wa.me/?text=${encoded}`, '_blank', 'noopener,noreferrer');

      if (shareOptions.includePhotos && item.photos.length > 0) {
        toast.info('Fotos incluídas como links na mensagem do WhatsApp.');
      } else {
        toast.success('WhatsApp aberto com a mensagem do aparelho.');
      }
      setIsShareModalOpen(false);
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
          <div className="flex flex-wrap justify-end gap-2">
            <IOSButton variant="secondary" onClick={onClose}>
              Fechar
            </IOSButton>
            {item.status === StockStatus.PREPARATION && onSendToSale && (
              <IOSButton
                variant="primary"
                onClick={onSendToSale}
                loading={isSendingToSale}
                leftIcon={<Send size={16} />}
              >
                Enviar para venda
              </IOSButton>
            )}
            <IOSButton
              variant="secondary"
              onClick={handleDownloadPhotos}
              loading={isDownloading}
              leftIcon={<Download size={16} />}
            >
              Baixar fotos
            </IOSButton>
            <IOSButton variant="secondary" onClick={() => setIsShareModalOpen(true)} leftIcon={<MessageCircle size={16} />}>
              Compartilhar WhatsApp
            </IOSButton>
            {onEdit && (
              <IOSButton variant="primary" onClick={onEdit} leftIcon={<Edit size={16} />}>
                Editar
              </IOSButton>
            )}
          </div>
        }
      >
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-[220px_1fr] gap-4">
            <div className="rounded-ios-xl bg-gray-100 dark:bg-surface-dark-200 border border-gray-200 dark:border-surface-dark-300 overflow-hidden h-[220px]">
              {item.photos && item.photos.length > 0 ? (
                <img src={item.photos[0]} alt={item.model} className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-gray-400 dark:text-surface-dark-500">
                  <Smartphone size={42} />
                </div>
              )}
            </div>

            <div className="space-y-3">
              <div>
                <h3 className="text-xl font-bold text-gray-900 dark:text-white">{item.model}</h3>
                <p className="text-sm text-gray-500 dark:text-surface-dark-500">{[item.capacity, item.color].filter(Boolean).join(' · ') || 'Sem detalhes'}</p>
              </div>

              <div className="flex flex-wrap gap-2">
                <span className="ios-badge-blue">{item.condition}</span>
                <span className={item.status === 'Em Preparação' ? 'ios-badge-orange' : 'ios-badge-green'}>{item.status}</span>
                <span className={item.hasBox ? 'ios-badge-blue' : 'ios-badge bg-gray-200 text-gray-700 dark:bg-surface-dark-300 dark:text-surface-dark-600'}>
                  <Box size={12} className="mr-1" /> {item.hasBox ? 'Com caixa' : 'Sem caixa'}
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                <div className="ios-card p-3">
                  <p className="text-xs text-gray-500 dark:text-surface-dark-500 mb-1">IMEI</p>
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
                <p className="font-bold text-gray-900 dark:text-white tabular-nums">{formatCurrency(item.purchasePrice)}</p>
              </div>
            </Stagger.Item>
            <Stagger.Item>
              <div className="ios-card p-4 h-full">
                <p className="text-xs text-gray-500 dark:text-surface-dark-500 mb-1">Custos Extras</p>
                <p className="font-bold text-gray-900 dark:text-white tabular-nums">{formatCurrency(repairCosts)}</p>
              </div>
            </Stagger.Item>
            <Stagger.Item>
              <div className="ios-card p-4 h-full">
                <p className="text-xs text-gray-500 dark:text-surface-dark-500 mb-1">Custo Total</p>
                <p className="font-bold text-gray-900 dark:text-white tabular-nums">{formatCurrency(totalCost)}</p>
              </div>
            </Stagger.Item>
            <Stagger.Item>
              <div className="ios-card p-4 h-full">
                <p className="text-xs text-gray-500 dark:text-surface-dark-500 mb-1">Venda</p>
                <p className="font-bold text-gray-900 dark:text-white tabular-nums">{formatCurrency(item.sellPrice)}</p>
              </div>
            </Stagger.Item>
            <Stagger.Item className="md:col-span-2">
              <div className="ios-card p-4 h-full">
                <p className="text-xs text-gray-500 dark:text-surface-dark-500 mb-1">Lucro Estimado</p>
                <p className={`font-bold tabular-nums ${profit >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                  {formatCurrency(profit)}
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
                    <p className="text-sm font-semibold text-gray-900 dark:text-white">{formatCurrency(cost.amount)}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </Modal>

      <Modal
        open={isShareModalOpen}
        onClose={() => setIsShareModalOpen(false)}
        title="Compartilhar via WhatsApp"
        size="md"
        footer={
          <div className="flex justify-end gap-2">
            <IOSButton variant="secondary" onClick={() => setIsShareModalOpen(false)}>
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
              checked={shareOptions.includeImeiMasked}
              onChange={(e) => setShareOptions((prev) => ({ ...prev, includeImeiMasked: e.target.checked }))}
            />
            IMEI mascarado
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
