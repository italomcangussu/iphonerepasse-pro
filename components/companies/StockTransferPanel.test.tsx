import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import StockTransferPanel from './StockTransferPanel';
import type { TransferTenant } from '../../services/tenants';

const fetchTransferableStockMock = vi.fn();
const transferStockItemsMock = vi.fn();

vi.mock('../ui/ToastProvider', () => ({
  useToast: () => ({ success: vi.fn(), error: vi.fn(), info: vi.fn(), dismiss: vi.fn(), clear: vi.fn() }),
}));
vi.mock('../../services/tenants', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../services/tenants')>()),
  fetchTransferableStock: (storeId: string) => fetchTransferableStockMock(storeId),
  transferStockItems: (...args: unknown[]) => transferStockItemsMock(...args),
}));

const catalog: TransferTenant[] = [
  { id: 't1', name: 'Repasse', isPrimary: true, stores: [
    { id: 'hdi', name: 'HDI', city: null, transferableCount: 1 },
    { id: 'gr', name: 'GR', city: null, transferableCount: 0 },
  ] },
  { id: 't2', name: 'Nova', isPrimary: false, stores: [{ id: 'nb', name: 'Loja B', city: null, transferableCount: 0 }] },
];

const device = {
  id: 'it_1', type: 'iPhone', model: 'iPhone 15', color: null, capacity: '128GB', imei: null,
  condition: 'Seminovo', status: 'Disponível', battery_health: null, sell_price: null, cost: 3150,
};

const chooseStores = async (targetId: string) => {
  fireEvent.change(screen.getByLabelText('De'), { target: { value: 'hdi' } });
  fireEvent.change(screen.getByLabelText('Para'), { target: { value: targetId } });
  fireEvent.click(await screen.findByLabelText(/iPhone 15/));
};

describe('StockTransferPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    fetchTransferableStockMock.mockResolvedValue([device]);
    transferStockItemsMock.mockResolvedValue({ moved: 1, targetStoreId: 'nb', saleTotal: 3200 });
  });

  it('entre lojas da mesma empresa não oferece venda', async () => {
    render(<StockTransferPanel catalog={catalog} onTransferred={vi.fn()} />);
    await chooseStores('gr');
    expect(screen.queryByText('Como fica o dinheiro?')).not.toBeInTheDocument();
  });

  it('vende para outra empresa com o valor editado', async () => {
    render(<StockTransferPanel catalog={catalog} onTransferred={vi.fn()} />);
    await chooseStores('nb');
    fireEvent.click(screen.getByLabelText(/Vender para a Nova/));

    const price = screen.getByLabelText(/Custo R\$ 3\.150,00/);
    expect(price).toHaveValue('R$ 3.150,00');
    fireEvent.change(price, { target: { value: 'R$ 3.200,00' } });
    fireEvent.change(screen.getByLabelText('Conta'), { target: { value: 'Cofre' } });

    fireEvent.click(screen.getByRole('button', { name: 'Vender 1 aparelho por R$ 3.200,00 para Nova' }));
    await waitFor(() =>
      expect(transferStockItemsMock).toHaveBeenCalledWith(['it_1'], 'nb', { account: 'Cofre', prices: { it_1: 3200 } }),
    );
  });

  it('valor apagado bloqueia a venda e diz por quê', async () => {
    render(<StockTransferPanel catalog={catalog} onTransferred={vi.fn()} />);
    await chooseStores('nb');
    fireEvent.click(screen.getByLabelText(/Vender para a Nova/));
    fireEvent.change(screen.getByLabelText(/Custo R\$/), { target: { value: '' } });
    expect(screen.getByText(/Informe o valor de cada aparelho/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Transferir|Vender/ })).toBeDisabled();
  });

  it('só mudar de empresa transfere sem venda', async () => {
    render(<StockTransferPanel catalog={catalog} onTransferred={vi.fn()} />);
    await chooseStores('nb');
    fireEvent.click(screen.getByRole('button', { name: 'Transferir 1 aparelho para Loja B' }));
    await waitFor(() => expect(transferStockItemsMock).toHaveBeenCalledWith(['it_1'], 'nb', undefined));
  });
});
