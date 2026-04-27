import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Condition, DeviceType, StockStatus, WarrantyType } from '../types';
import Inventory from './Inventory';

const useDataMock = vi.fn();
const toastMock = {
  success: vi.fn(),
  error: vi.fn(),
  info: vi.fn(),
  confirm: vi.fn(),
  dismiss: vi.fn(),
  clear: vi.fn()
};

vi.mock('../services/dataContext', () => ({
  useData: () => useDataMock()
}));

vi.mock('../components/ui/ToastProvider', () => ({
  useToast: () => toastMock
}));

vi.mock('../components/StockFormModal', () => ({
  StockFormModal: ({ onDelete }: { onDelete?: () => void }) => (
    <button type="button" onClick={onDelete}>
      Confirmar exclusao mock
    </button>
  )
}));

vi.mock('../components/StockDetailsModal', () => ({
  StockDetailsModal: () => null
}));

describe('Inventory table columns', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    toastMock.confirm.mockResolvedValue(true);
    useDataMock.mockReturnValue({
      stock: [
        {
          id: 'stk-new',
          type: DeviceType.IPHONE,
          model: 'iPhone 16',
          color: 'Branco',
          hasBox: true,
          capacity: '256 GB',
          imei: '111111111111111',
          condition: Condition.NEW,
          status: StockStatus.AVAILABLE,
          batteryHealth: 100,
          storeId: 'store-1',
          purchasePrice: 5500,
          sellPrice: 6700,
          maxDiscount: 0,
          warrantyType: WarrantyType.STORE,
          warrantyEnd: '',
          origin: '',
          notes: '',
          observations: '',
          costs: [],
          photos: [],
          entryDate: '2026-02-01'
        },
        {
          id: 'stk-used',
          type: DeviceType.IPHONE,
          model: 'iPhone 14',
          color: 'Preto',
          hasBox: false,
          capacity: '128 GB',
          imei: '222222222222222',
          condition: Condition.USED,
          status: StockStatus.AVAILABLE,
          batteryHealth: 85,
          storeId: 'store-2',
          purchasePrice: 2800,
          sellPrice: 3500,
          maxDiscount: 0,
          warrantyType: WarrantyType.STORE,
          warrantyEnd: '',
          origin: '',
          notes: '',
          observations: '',
          costs: [],
          photos: [],
          entryDate: '2026-02-01'
        },
        {
          id: 'stk-sold',
          type: DeviceType.IPHONE,
          model: 'iPhone 15 Pro (Vendido)',
          color: 'Titânio',
          hasBox: true,
          capacity: '128 GB',
          imei: '999999999999999',
          condition: Condition.USED,
          status: StockStatus.SOLD,
          batteryHealth: 90,
          storeId: 'store-1',
          purchasePrice: 4200,
          sellPrice: 5200,
          maxDiscount: 0,
          warrantyType: WarrantyType.STORE,
          warrantyEnd: '',
          origin: '',
          notes: '',
          observations: '',
          costs: [],
          photos: [],
          entryDate: '2026-02-01'
        },
        {
          id: 'stk-prep-sobral',
          type: DeviceType.IPHONE,
          model: 'iPhone 13',
          color: 'Azul',
          hasBox: false,
          capacity: '128 GB',
          imei: '333333333333333',
          condition: Condition.USED,
          status: StockStatus.PREPARATION,
          batteryHealth: 82,
          storeId: 'store-2',
          purchasePrice: 2400,
          sellPrice: 3100,
          maxDiscount: 0,
          warrantyType: WarrantyType.STORE,
          warrantyEnd: '',
          origin: '',
          notes: '',
          observations: '',
          costs: [],
          photos: [],
          entryDate: '2026-02-01'
        },
        {
          id: 'stk-prep-fortaleza',
          type: DeviceType.IPHONE,
          model: 'iPhone 12',
          color: 'Roxo',
          hasBox: true,
          capacity: '64 GB',
          imei: '444444444444444',
          condition: Condition.USED,
          status: StockStatus.PREPARATION,
          batteryHealth: 88,
          storeId: 'store-1',
          purchasePrice: 1800,
          sellPrice: 2400,
          maxDiscount: 0,
          warrantyType: WarrantyType.STORE,
          warrantyEnd: '',
          origin: '',
          notes: '',
          observations: '',
          costs: [],
          photos: [],
          entryDate: '2026-02-01'
        }
      ],
      removeStockItem: vi.fn(),
      updateStockItem: vi.fn(),
      stores: [
        { id: 'store-1', name: 'Matriz Fortaleza', city: 'Fortaleza' },
        { id: 'store-2', name: 'Matriz Sobral', city: 'Sobral' }
      ]
    });
  });

  it('renders current stock table headers and battery badges', () => {
    render(<Inventory />);

    expect(screen.getByRole('button', { name: 'Geral' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Loja' })).not.toBeInTheDocument();

    const table = screen.getByRole('table');
    expect(within(table).getByRole('columnheader', { name: 'Dispositivo' })).toBeInTheDocument();
    expect(within(table).getByRole('columnheader', { name: 'Caixa' })).toBeInTheDocument();
    expect(within(table).queryByRole('columnheader', { name: 'Custo Total' })).not.toBeInTheDocument();
    expect(within(table).queryByRole('columnheader', { name: 'Lucro' })).not.toBeInTheDocument();

    expect(screen.getByText('100%')).toBeInTheDocument();
    expect(screen.getByText('85%')).toBeInTheDocument();
    expect(screen.queryByText('iPhone 15 Pro (Vendido)')).not.toBeInTheDocument();
  });

  it('shows available devices ordered by model from highest to lowest', () => {
    useDataMock.mockReturnValue({
      stock: [
        {
          id: 'stk-14',
          type: DeviceType.IPHONE,
          model: 'iPhone 14',
          color: 'Preto',
          hasBox: false,
          capacity: '128 GB',
          imei: '141414141414141',
          condition: Condition.USED,
          status: StockStatus.AVAILABLE,
          batteryHealth: 85,
          storeId: 'store-1',
          purchasePrice: 3000,
          sellPrice: 3900,
          maxDiscount: 0,
          warrantyType: WarrantyType.STORE,
          warrantyEnd: '',
          origin: '',
          notes: '',
          observations: '',
          costs: [],
          photos: [],
          entryDate: '2026-02-03'
        },
        {
          id: 'stk-16',
          type: DeviceType.IPHONE,
          model: 'iPhone 16',
          color: 'Branco',
          hasBox: true,
          capacity: '256 GB',
          imei: '161616161616161',
          condition: Condition.NEW,
          status: StockStatus.AVAILABLE,
          batteryHealth: 100,
          storeId: 'store-1',
          purchasePrice: 5800,
          sellPrice: 7000,
          maxDiscount: 0,
          warrantyType: WarrantyType.STORE,
          warrantyEnd: '',
          origin: '',
          notes: '',
          observations: '',
          costs: [],
          photos: [],
          entryDate: '2026-02-01'
        },
        {
          id: 'stk-15',
          type: DeviceType.IPHONE,
          model: 'iPhone 15',
          color: 'Azul',
          hasBox: true,
          capacity: '128 GB',
          imei: '151515151515151',
          condition: Condition.USED,
          status: StockStatus.AVAILABLE,
          batteryHealth: 90,
          storeId: 'store-1',
          purchasePrice: 4200,
          sellPrice: 5200,
          maxDiscount: 0,
          warrantyType: WarrantyType.STORE,
          warrantyEnd: '',
          origin: '',
          notes: '',
          observations: '',
          costs: [],
          photos: [],
          entryDate: '2026-02-02'
        }
      ],
      removeStockItem: vi.fn(),
      updateStockItem: vi.fn(),
      stores: [{ id: 'store-1', name: 'Matriz Fortaleza', city: 'Fortaleza' }]
    });

    render(<Inventory />);

    const table = screen.getByRole('table');
    const bodyRows = within(table).getAllByRole('row').slice(1);
    const modelOrder = bodyRows.map((row) => within(row).getAllByRole('button')[0]?.textContent || '');

    expect(modelOrder[0]).toContain('iPhone 16');
    expect(modelOrder[1]).toContain('iPhone 15');
    expect(modelOrder[2]).toContain('iPhone 14');
  });

  it('renders contextual empty state when filters return no rows', async () => {
    const user = userEvent.setup();
    render(<Inventory />);

    await user.type(screen.getByPlaceholderText('Buscar por modelo ou IMEI...'), 'inexistente');

    expect(screen.getByText('Nenhum aparelho encontrado com os filtros atuais')).toBeInTheDocument();
    expect(screen.getByText('Ajuste filtros ou limpe a busca para visualizar mais itens.')).toBeInTheDocument();
  });

  it('filters quick store options for available and preparation tabs', async () => {
    const user = userEvent.setup();
    render(<Inventory />);

    await user.click(screen.getByRole('button', { name: 'Sobral' }));
    expect(screen.getByText('iPhone 14')).toBeInTheDocument();
    expect(screen.queryByText('iPhone 16')).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Em Preparação' }));
    expect(screen.getByText('iPhone 13')).toBeInTheDocument();
    expect(screen.queryByText('iPhone 12')).not.toBeInTheDocument();
  });

  it('hides condition filters when viewing preparation stock', async () => {
    const user = userEvent.setup();
    render(<Inventory />);

    await user.click(screen.getByRole('button', { name: 'Novo' }));
    expect(screen.getByText('iPhone 16')).toBeInTheDocument();
    expect(screen.queryByText('iPhone 14')).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Em Preparação' }));

    expect(screen.queryByRole('button', { name: 'Novo' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Seminovo' })).not.toBeInTheDocument();
    expect(screen.getByText('iPhone 13')).toBeInTheDocument();
    expect(screen.getByText('iPhone 12')).toBeInTheDocument();
  });

  it('reports backend delete failures instead of showing success', async () => {
    const user = userEvent.setup();
    const removeStockItem = vi.fn().mockRejectedValue(new Error('violates foreign key'));
    useDataMock.mockReturnValue({
      stock: [
        {
          id: 'stk-delete',
          type: DeviceType.IPHONE,
          model: 'iPhone 16',
          color: 'Branco',
          hasBox: true,
          capacity: '256 GB',
          imei: '111111111111111',
          condition: Condition.NEW,
          status: StockStatus.AVAILABLE,
          batteryHealth: 100,
          storeId: 'store-1',
          purchasePrice: 5500,
          sellPrice: 6700,
          maxDiscount: 0,
          warrantyType: WarrantyType.STORE,
          warrantyEnd: '',
          origin: '',
          notes: '',
          observations: '',
          costs: [],
          photos: [],
          entryDate: '2026-02-01'
        }
      ],
      removeStockItem,
      updateStockItem: vi.fn(),
      stores: [{ id: 'store-1', name: 'Matriz Fortaleza', city: 'Fortaleza' }]
    });

    render(<Inventory />);

    await user.click(screen.getByRole('button', { name: 'Editar iPhone 16' }));
    await user.click(screen.getByRole('button', { name: 'Confirmar exclusao mock' }));

    expect(removeStockItem).toHaveBeenCalledWith('stk-delete');
    expect(toastMock.error).toHaveBeenCalledWith('violates foreign key');
    expect(toastMock.success).not.toHaveBeenCalledWith('Aparelho excluido.');
  });
});
