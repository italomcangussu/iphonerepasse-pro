import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Condition, DeviceType, StockStatus, WarrantyType } from '../types';
import Inventory from './Inventory';

const useDataMock = vi.fn();

vi.mock('../services/dataContext', () => ({
  useData: () => useDataMock()
}));

vi.mock('../components/ui/ToastProvider', () => ({
  useToast: () => ({
    success: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
    dismiss: vi.fn(),
    clear: vi.fn()
  })
}));

vi.mock('../components/StockFormModal', () => ({
  StockFormModal: () => null
}));

vi.mock('../components/StockDetailsModal', () => ({
  StockDetailsModal: () => null
}));

describe('Inventory table columns', () => {
  beforeEach(() => {
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

  it('shows Estado and hides Custo Total/Lucro in table headers, including lacrado badge for new devices', () => {
    render(<Inventory />);

    const table = screen.getByRole('table');
    expect(within(table).getByRole('columnheader', { name: 'Estado' })).toBeInTheDocument();
    expect(within(table).queryByRole('columnheader', { name: 'Custo Total' })).not.toBeInTheDocument();
    expect(within(table).queryByRole('columnheader', { name: 'Lucro' })).not.toBeInTheDocument();

    expect(screen.getByText('Lacrado 100%')).toBeInTheDocument();
    expect(screen.getByText('85%')).toBeInTheDocument();
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
});
