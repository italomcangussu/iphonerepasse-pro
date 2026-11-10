import React from 'react';
import { itemLabel } from '../../lib/companies';
import { SALE_ACCOUNTS, salePriceDigits, saleSummary, type SaleMode } from '../../lib/stockSale';
import { formatCurrencyBRL } from '../../utils/inputMasks';
import type { SaleAccount, TransferableItem } from '../../services/tenants';
import type { StockSaleState } from './useStockSale';

type SaleOptionsProps = {
  sale: StockSaleState;
  originName: string;
  targetName: string;
};

const LABEL_CLASS = 'block text-ios-subhead font-semibold text-gray-900 dark:text-white';
const MUTED_CLASS = 'text-ios-caption text-gray-500 dark:text-surface-dark-500';

type ModeChoiceProps = {
  value: SaleMode;
  checked: boolean;
  title: string;
  description: string;
  onChoose: (mode: SaleMode) => void;
};

const ModeChoice: React.FC<ModeChoiceProps> = ({ value, checked, title, description, onChoose }) => (
  <label
    className={`flex min-h-12 cursor-pointer items-start gap-3 rounded-ios-lg border p-3 ${
      checked ? 'border-brand-500 bg-brand-50 dark:bg-brand-900/20' : 'border-gray-200 dark:border-surface-dark-300'
    }`}
  >
    <input type="radio" name="stock-sale-mode" checked={checked} onChange={() => onChoose(value)} className="mt-1 h-5 w-5 shrink-0 accent-brand-500" />
    <span>
      <span className={LABEL_CLASS}>{title}</span>
      <span className={`block ${MUTED_CLASS}`}>{description}</span>
    </span>
  </label>
);

type PriceRowProps = {
  item: TransferableItem;
  digits: string;
  onChange: (typed: string, previous: string) => void;
};

const PriceRow: React.FC<PriceRowProps> = ({ item, digits, onChange }) => {
  const inputId = `sale-price-${item.id}`;
  return (
    <li className="flex flex-wrap items-center justify-between gap-2 px-3 py-2">
      <label htmlFor={inputId} className="min-w-0 flex-1">
        <span className="block truncate text-ios-subhead font-semibold text-gray-900 dark:text-white">{itemLabel(item)}</span>
        <span className={`block ${MUTED_CLASS}`}>Custo {formatCurrencyBRL(Number(item.cost ?? 0))}</span>
      </label>
      <input
        id={inputId}
        type="text"
        inputMode="numeric"
        placeholder="R$ 0,00"
        value={digits === '' ? '' : formatCurrencyBRL(digits)}
        onChange={(event) => onChange(event.target.value, digits)}
        aria-invalid={digits === ''}
        className={`ios-input min-h-12 w-36 text-right text-base font-semibold ${digits === '' ? 'border-red-500' : ''}`}
      />
    </li>
  );
};

function SalePrices({ sale, items }: { sale: StockSaleState; items: TransferableItem[] }) {
  if (items.length === 0) {
    return <p className={MUTED_CLASS}>Marque os aparelhos acima para definir o valor de cada um.</p>;
  }
  return (
    <div>
      <p className={LABEL_CLASS}>Valor de venda</p>
      <p className={MUTED_CLASS}>Começa no custo de cada aparelho. Mude se quiser vender por outro valor.</p>
      <ul className="mt-2 divide-y divide-gray-100 rounded-ios-lg border border-gray-200 dark:divide-surface-dark-300 dark:border-surface-dark-300">
        {items.map((item) => (
          <PriceRow
            key={item.id}
            item={item}
            digits={salePriceDigits(item, sale.edited)}
            onChange={(typed, previous) => sale.setPrice({ itemId: item.id, typed, previous })}
          />
        ))}
      </ul>
    </div>
  );
}

export default function SaleOptions({ sale, originName, targetName }: SaleOptionsProps) {
  const { isSale, items } = sale;
  return (
    <fieldset className="space-y-3">
      <legend className={`${LABEL_CLASS} mb-2`}>Como fica o dinheiro?</legend>
      <div className="grid gap-2 sm:grid-cols-2">
        <ModeChoice
          value="move"
          checked={!isSale}
          title="Só mudar de empresa"
          description={`Aparelhos e custos vão para a ${targetName}. Nada entra no caixa.`}
          onChoose={sale.setMode}
        />
        <ModeChoice
          value="sale"
          checked={isSale}
          title={`Vender para a ${targetName}`}
          description={`A ${originName} recebe o valor e a ${targetName} registra a compra.`}
          onChoose={sale.setMode}
        />
      </div>

      {isSale && (
        <>
          <label className="block">
            <span className={LABEL_CLASS}>Conta</span>
            <select
              value={sale.account}
              onChange={(event) => sale.setAccount(event.target.value as SaleAccount)}
              className="ios-input mt-1 min-h-12 w-full text-base sm:w-64"
            >
              {SALE_ACCOUNTS.map((account) => (
                <option key={account} value={account}>
                  {account}
                </option>
              ))}
            </select>
          </label>
          <SalePrices sale={sale} items={items} />
          {items.length > 0 && (
            <p className="rounded-ios-lg bg-gray-50 p-3 text-ios-subhead text-gray-700 dark:bg-surface-dark-200 dark:text-surface-dark-600">
              {saleSummary({ originName, targetName }, sale.account, sale.total)}
            </p>
          )}
        </>
      )}
    </fieldset>
  );
}
