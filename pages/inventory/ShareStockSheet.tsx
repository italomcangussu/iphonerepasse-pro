import React, { useEffect, useMemo, useState } from 'react';
import { Copy, Instagram, MessageCircle } from 'lucide-react';
import Modal from '../../components/ui/Modal';
import { useToast } from '../../components/ui/ToastProvider';
import type { CardFeeSettings, StockItem } from '../../types';
import { getCardRate } from '../../utils/cardFees';
import {
  buildStockShareText,
  countShareItemsByCondition,
  type ShareChannel,
  type ShareScope
} from './inventoryViewModel';
import { copyShareText, deliverShareText } from './shareDelivery';
import { readSharePreferences, writeSharePreferences, type SharePreferences } from './sharePreferences';
import {
  SHARE_CHANNEL_LABEL,
  ShareChannelPicker,
  SharePreviewPanel,
  SharePricePicker,
  ShareScopeOptionRow
} from './shareSheetSections';

type ShareStockSheetProps = {
  open: boolean;
  channel: ShareChannel;
  initialScope: ShareScope;
  // Sem filtro, "o que está na tela" repete o estoque inteiro e só gera dúvida.
  hasActiveFilters: boolean;
  filteredItems: StockItem[];
  availableItems: StockItem[];
  selectedItems: StockItem[];
  cardFeeSettings: CardFeeSettings;
  onChannelChange: (channel: ShareChannel) => void;
  onPickDevices: () => void;
  onClose: () => void;
  onShared: () => void;
};

const SCOPE_TITLES: Record<ShareScope, string> = {
  filtered: 'O que está na tela',
  available: 'Todo o estoque disponível',
  selected: 'Aparelhos que eu escolher'
};
const SCOPE_ORDER: ShareScope[] = ['filtered', 'available', 'selected'];

const pluralizeDevices = (count: number) => `${count} ${count === 1 ? 'aparelho' : 'aparelhos'}`;
const pluralizeCondition = (count: number, singular: string) => (count > 0 ? `${count} ${singular}${count === 1 ? '' : 's'}` : null);

const describeScopeItems = (items: StockItem[]) => {
  const { newCount, usedCount } = countShareItemsByCondition(items);
  const conditions = [pluralizeCondition(newCount, 'novo'), pluralizeCondition(usedCount, 'seminovo')].filter(Boolean);
  return [pluralizeDevices(items.length), ...conditions].join(' · ');
};

const ShareStockSheet: React.FC<ShareStockSheetProps> = ({
  open,
  channel,
  initialScope,
  hasActiveFilters,
  filteredItems,
  availableItems,
  selectedItems,
  cardFeeSettings,
  onChannelChange,
  onPickDevices,
  onClose,
  onShared
}) => {
  const toast = useToast();
  const [scope, setScope] = useState<ShareScope>(initialScope);
  const [preferences, setPreferences] = useState(readSharePreferences);
  const [isSending, setIsSending] = useState(false);

  useEffect(() => {
    if (open) setScope(initialScope);
  }, [open, initialScope]);

  const itemsByScope: Record<ShareScope, StockItem[]> = { filtered: filteredItems, available: availableItems, selected: selectedItems };
  const itemsToShare = itemsByScope[scope];
  const ratePercent = getCardRate(cardFeeSettings, 'visa_master', preferences.installments);

  const text = useMemo(() => {
    if (itemsToShare.length === 0) return '';
    const paymentPlan = preferences.priceMode === 'installments'
      ? { installments: preferences.installments, feeRate: ratePercent }
      : undefined;
    return buildStockShareText(itemsToShare, channel, paymentPlan);
  }, [itemsToShare, channel, preferences, ratePercent]);

  const updatePreferences = (next: Partial<SharePreferences>) => {
    setPreferences((current) => {
      const merged = { ...current, ...next };
      writeSharePreferences(merged);
      return merged;
    });
  };

  const handleSelectScope = (value: ShareScope) => {
    if (value === 'selected' && selectedItems.length === 0) {
      onPickDevices();
      return;
    }
    setScope(value);
  };

  const handleCopy = async () => {
    try {
      await copyShareText(text);
      toast.success('Texto copiado. É só colar onde quiser.');
    } catch {
      toast.error('Não foi possível copiar o texto neste aparelho.');
    }
  };

  const handleSend = async () => {
    setIsSending(true);
    try {
      const result = await deliverShareText(channel, text);
      if (result === 'cancelled') return;
      toast.success(result === 'copied'
        ? 'Texto copiado. Cole no Instagram para publicar.'
        : `Lista com ${pluralizeDevices(itemsToShare.length)} pronta no ${SHARE_CHANNEL_LABEL[channel]}.`);
      onShared();
    } catch {
      toast.error(`Não foi possível abrir o ${SHARE_CHANNEL_LABEL[channel]}. Tente copiar o texto.`);
    } finally {
      setIsSending(false);
    }
  };

  const SendIcon = channel === 'whatsapp' ? MessageCircle : Instagram;
  const footer = (
    <div className="flex w-full flex-col-reverse gap-2 sm:flex-row sm:justify-end">
      <button
        type="button"
        onClick={() => void handleCopy()}
        disabled={!text}
        className="ios-button-secondary inline-flex min-h-[44px] items-center justify-center gap-2 disabled:cursor-not-allowed disabled:opacity-50"
      >
        <Copy size={16} />
        Copiar texto
      </button>
      <button
        type="button"
        onClick={() => void handleSend()}
        disabled={!text || isSending}
        className="ios-button-primary inline-flex min-h-[44px] items-center justify-center gap-2 disabled:cursor-not-allowed disabled:opacity-50"
      >
        <SendIcon size={16} />
        {channel === 'whatsapp' ? 'Abrir no WhatsApp' : 'Compartilhar no Instagram'}
      </button>
    </div>
  );

  return (
    <Modal open={open} onClose={onClose} title="Compartilhar lista" size="lg" footer={footer}>
      <div className="space-y-5">
        <ShareChannelPicker channel={channel} onChange={onChannelChange} />

        <section aria-labelledby="share-scope-title" className="space-y-2">
          <h3 id="share-scope-title" className="ios-section-header">Quais aparelhos</h3>
          <div role="radiogroup" aria-labelledby="share-scope-title" className="space-y-2">
            {SCOPE_ORDER.filter((value) => value !== 'filtered' || hasActiveFilters).map((value) => {
              const items = itemsByScope[value];
              const isPickWithoutSelection = value === 'selected' && items.length === 0;
              return (
                <ShareScopeOptionRow
                  key={value}
                  title={SCOPE_TITLES[value]}
                  description={isPickWithoutSelection ? 'Toque para marcar os aparelhos na lista' : describeScopeItems(items)}
                  isActive={scope === value}
                  isDisabled={items.length === 0 && value !== 'selected'}
                  onSelect={() => handleSelectScope(value)}
                  onEdit={value === 'selected' && items.length > 0 ? onPickDevices : undefined}
                />
              );
            })}
          </div>
        </section>

        <SharePricePicker
          priceMode={preferences.priceMode}
          installments={preferences.installments}
          ratePercent={ratePercent}
          onPriceModeChange={(priceMode) => updatePreferences({ priceMode })}
          onInstallmentsChange={(installments) => updatePreferences({ installments })}
        />

        <SharePreviewPanel channel={channel} text={text} />
      </div>
    </Modal>
  );
};

export default ShareStockSheet;
