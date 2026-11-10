import { useCallback, useState } from 'react';
import { maskCurrencyInput } from '../../utils/inputMasks';
import type { SaleAccount, StockSale, TransferableItem } from '../../services/tenants';
import { buildStockSale, salePriceMissing, saleTotal, type EditedPrices, type SaleMode } from '../../lib/stockSale';

type PriceEdit = { itemId: string; typed: string; previous: string };

// Venda entre empresas dos aparelhos marcados: modo, conta, valores editados e o pedido pronto.
// canSell = origem e destino em empresas diferentes; sem isso a transferência é sempre simples.
export function useStockSale({ items, canSell }: { items: TransferableItem[]; canSell: boolean }) {
  const [mode, setMode] = useState<SaleMode>('move');
  const [account, setAccount] = useState<SaleAccount>('Conta Bancária');
  const [edited, setEdited] = useState<EditedPrices>({});

  const setPrice = useCallback(({ itemId, typed, previous }: PriceEdit) => {
    setEdited((current) => ({ ...current, [itemId]: maskCurrencyInput(typed, previous) }));
  }, []);

  const resetPrices = useCallback(() => setEdited({}), []);

  const isSale = canSell && mode === 'sale';
  const request: StockSale | undefined = isSale ? buildStockSale(account, items, edited) : undefined;

  return {
    mode, setMode, account, setAccount, edited, setPrice, resetPrices, items, isSale, request,
    total: saleTotal(items, edited),
    missingPrice: isSale && salePriceMissing(items, edited),
  };
}

export type StockSaleState = ReturnType<typeof useStockSale>;
