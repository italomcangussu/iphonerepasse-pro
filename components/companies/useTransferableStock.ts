import { useCallback, useEffect, useState } from 'react';
import { fetchTransferableStock, type TransferableItem } from '../../services/tenants';

export type ItemsState =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'ready'; items: TransferableItem[] };

const errorMessage = (error: unknown) => (error instanceof Error ? error.message : 'Não foi possível carregar o estoque.');

// Aparelhos que podem sair da loja (disponíveis e sem reserva), recarregáveis após uma transferência.
export function useTransferableStock(storeId: string) {
  const [state, setState] = useState<ItemsState>({ status: 'idle' });
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    if (!storeId) {
      setState({ status: 'idle' });
      return;
    }
    let active = true;
    setState({ status: 'loading' });
    fetchTransferableStock(storeId)
      .then((items) => active && setState({ status: 'ready', items }))
      .catch((error: unknown) => active && setState({ status: 'error', message: errorMessage(error) }));
    return () => {
      active = false;
    };
  }, [storeId, reloadKey]);

  const reload = useCallback(() => setReloadKey((key) => key + 1), []);
  return { state, items: state.status === 'ready' ? state.items : [], reload };
}
