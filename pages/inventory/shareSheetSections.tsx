import React from 'react';
import { Check, Instagram, ListChecks, MessageCircle } from 'lucide-react';
import { CARD_INSTALLMENTS_MAX } from '../../utils/cardFees';
import { INSTAGRAM_SHARE_CHAR_LIMIT, type ShareChannel, type SharePriceMode } from './inventoryViewModel';

export const SHARE_CHANNEL_LABEL: Record<ShareChannel, string> = { whatsapp: 'WhatsApp', instagram: 'Instagram' };
const INSTALLMENT_OPTIONS = Array.from({ length: CARD_INSTALLMENTS_MAX }, (_, index) => index + 1);
const PRICE_MODE_OPTIONS: Array<{ value: SharePriceMode; label: string }> = [
  { value: 'cash', label: 'Só à vista' },
  { value: 'installments', label: 'À vista + parcelado' }
];

const segmentClass = (isActive: boolean) => `ios-segment gap-1.5 ${isActive ? 'ios-segment-active' : ''}`;

export const ShareChannelPicker: React.FC<{ channel: ShareChannel; onChange: (channel: ShareChannel) => void }> = ({ channel, onChange }) => (
  <div className="ios-segmented-control" role="radiogroup" aria-label="Canal">
    {(['whatsapp', 'instagram'] as const).map((option) => (
      <button
        key={option}
        type="button"
        role="radio"
        aria-checked={channel === option}
        onClick={() => onChange(option)}
        className={segmentClass(channel === option)}
      >
        {option === 'whatsapp' ? <MessageCircle size={15} /> : <Instagram size={15} />}
        {SHARE_CHANNEL_LABEL[option]}
      </button>
    ))}
  </div>
);

type ShareScopeOptionRowProps = {
  title: string;
  description: string;
  isActive: boolean;
  isDisabled: boolean;
  onSelect: () => void;
  onEdit?: () => void;
};

export const ShareScopeOptionRow: React.FC<ShareScopeOptionRowProps> = ({ title, description, isActive, isDisabled, onSelect, onEdit }) => (
  <div className="relative">
    <button
      type="button"
      role="radio"
      aria-checked={isActive}
      disabled={isDisabled}
      onClick={onSelect}
      className={`flex w-full min-h-[56px] items-center gap-3 rounded-ios-lg border px-4 py-3 text-left transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${
        isActive ? 'border-brand-400 bg-brand-50 dark:border-brand-700 dark:bg-brand-900/20' : 'app-border app-surface-soft-hover'
      } ${onEdit ? 'pr-24' : ''}`}
    >
      <span
        aria-hidden="true"
        className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border ${isActive ? 'border-brand-500 bg-brand-500 text-white' : 'app-border-strong'}`}
      >
        {isActive && <Check size={13} strokeWidth={3} />}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-semibold app-text-primary">{title}</span>
        <span className="block text-xs app-text-muted">{description}</span>
      </span>
    </button>
    {onEdit && (
      <button
        type="button"
        onClick={onEdit}
        className="absolute right-2 top-1/2 inline-flex min-h-[44px] -translate-y-1/2 items-center gap-1 px-2 text-xs font-semibold text-brand-700 dark:text-brand-300"
      >
        <ListChecks size={14} />
        Editar
      </button>
    )}
  </div>
);

type SharePricePickerProps = {
  priceMode: SharePriceMode;
  installments: number;
  ratePercent: number;
  onPriceModeChange: (priceMode: SharePriceMode) => void;
  onInstallmentsChange: (installments: number) => void;
};

const InstallmentsGrid: React.FC<Pick<SharePricePickerProps, 'installments' | 'ratePercent' | 'onInstallmentsChange'>> = ({
  installments,
  ratePercent,
  onInstallmentsChange
}) => (
  <div className="space-y-2 pt-1">
    <div className="flex items-baseline justify-between gap-2">
      <p id="share-installments-title" className="text-xs font-semibold app-text-secondary">Parcelas no cartão</p>
      <p className="text-xs app-text-muted">Visa/Master · taxa {ratePercent.toFixed(2)}%</p>
    </div>
    <div role="radiogroup" aria-labelledby="share-installments-title" className="grid grid-cols-6 gap-1.5 sm:grid-cols-9">
      {INSTALLMENT_OPTIONS.map((option) => (
        <button
          key={option}
          type="button"
          role="radio"
          aria-checked={installments === option}
          aria-label={`${option}x`}
          onClick={() => onInstallmentsChange(option)}
          className={`min-h-[44px] rounded-ios text-sm font-semibold transition-colors ${
            installments === option ? 'bg-brand-500 text-white shadow-ios26-sm' : 'app-surface-soft app-text-secondary app-surface-soft-hover'
          }`}
        >
          {option}x
        </button>
      ))}
    </div>
  </div>
);

export const SharePricePicker: React.FC<SharePricePickerProps> = ({ priceMode, onPriceModeChange, ...installmentsProps }) => (
  <section aria-labelledby="share-price-title" className="space-y-2">
    <h3 id="share-price-title" className="ios-section-header">Valores</h3>
    <div className="ios-segmented-control" role="radiogroup" aria-labelledby="share-price-title">
      {PRICE_MODE_OPTIONS.map((option) => (
        <button
          key={option.value}
          type="button"
          role="radio"
          aria-checked={priceMode === option.value}
          onClick={() => onPriceModeChange(option.value)}
          className={segmentClass(priceMode === option.value)}
        >
          {option.label}
        </button>
      ))}
    </div>
    {priceMode === 'installments' && <InstallmentsGrid {...installmentsProps} />}
  </section>
);

// O texto do Instagram é cortado por linha e termina em "..." quando passa do limite.
const isInstagramTextTruncated = (text: string) => text.includes('...');

export const SharePreviewPanel: React.FC<{ channel: ShareChannel; text: string }> = ({ channel, text }) => {
  const showsCharCount = channel === 'instagram' && text.length > 0;
  const isTruncated = showsCharCount && isInstagramTextTruncated(text);

  return (
    <section aria-labelledby="share-preview-title" className="space-y-2">
      <div className="flex items-baseline justify-between gap-2">
        <h3 id="share-preview-title" className="ios-section-header">Prévia da mensagem</h3>
        {showsCharCount && (
          <span className={`text-xs ${isTruncated ? 'font-semibold text-amber-700 dark:text-amber-300' : 'app-text-muted'}`}>
            {text.length}/{INSTAGRAM_SHARE_CHAR_LIMIT}
          </span>
        )}
      </div>
      {text ? (
        <pre
          data-testid="share-preview"
          className="max-h-56 overflow-y-auto whitespace-pre-wrap break-words rounded-ios-lg border app-border app-surface-soft p-3 font-sans text-xs leading-relaxed app-text-secondary"
        >
          {text}
        </pre>
      ) : (
        <p className="rounded-ios-lg border border-dashed app-border p-4 text-center text-xs app-text-muted">
          Nenhum aparelho neste recorte. Escolha outra opção acima.
        </p>
      )}
      {isTruncated && (
        <p className="text-xs text-amber-700 dark:text-amber-300">
          O Instagram limita o texto: alguns aparelhos ficaram de fora. Escolha menos aparelhos para caber todos.
        </p>
      )}
    </section>
  );
};
