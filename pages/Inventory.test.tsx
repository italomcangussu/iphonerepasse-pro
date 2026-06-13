import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Condition, DeviceType, StockStatus, WarrantyType } from '../types';
import Inventory, { buildStockShareText } from './Inventory';

const useDataMock = vi.fn();
const usePermissionsMock = vi.fn();
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

vi.mock('../contexts/PermissionsContext', () => ({
  usePermissions: () => usePermissionsMock()
}));

vi.mock('../components/ui/ToastProvider', () => ({
  useToast: () => toastMock
}));

vi.mock('../components/StockFormModal', () => ({
  StockFormModal: ({ onDelete, onAddToInUse }: { onDelete?: () => void; onAddToInUse?: () => void }) => (
    <div>
      {onDelete && (
        <button type="button" onClick={onDelete}>
          Confirmar exclusao mock
        </button>
      )}
      {onAddToInUse && (
        <button type="button" onClick={onAddToInUse}>
          Adicionar em Uso
        </button>
      )}
    </div>
  )
}));

vi.mock('../components/StockReservationModal', () => ({
  StockReservationModal: ({
    open,
    onSave,
  }: {
    open: boolean;
    onSave: (input: any) => Promise<void> | void;
  }) => open ? (
    <div role="dialog" aria-label="Reservar aparelho">
      <button
        type="button"
        onClick={() => onSave({
          customerName: 'Cliente Reserva',
          customerPhone: '88999990000',
          expiresAt: '2026-06-20',
          depositAmount: 100,
          depositPaymentMethod: 'Pix',
          notes: 'Sinal confirmado'
        })}
      >
        Salvar reserva mock
      </button>
    </div>
  ) : null
}));

vi.mock('../components/StockDetailsModal', () => ({
  StockDetailsModal: () => null
}));

describe('Inventory table columns', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    vi.spyOn(window, 'open').mockImplementation(() => null);
    toastMock.confirm.mockResolvedValue(true);
    usePermissionsMock.mockReturnValue({
      can: vi.fn(() => true)
    });
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
          id: 'stk-reserved',
          type: DeviceType.IPHONE,
          model: 'iPhone 15 Reservado',
          color: 'Preto',
          hasBox: true,
          capacity: '256 GB',
          imei: '555555555555555',
          condition: Condition.USED,
          status: StockStatus.RESERVED,
          batteryHealth: 91,
          storeId: 'store-1',
          purchasePrice: 3900,
          sellPrice: 4800,
          maxDiscount: 0,
          warrantyType: WarrantyType.STORE,
          warrantyEnd: '',
          origin: '',
          notes: '',
          observations: '',
          costs: [],
          photos: [],
          entryDate: '2026-02-01',
          reservation: {
            id: 'res-1',
            stockItemId: 'stk-reserved',
            customerName: 'Cliente Antigo',
            customerPhone: '88988887777',
            reservedAt: '2026-06-01T12:00:00.000Z',
            expiresAt: '2026-06-02T00:00:00.000Z',
            depositAmount: null,
            depositPaymentMethod: null,
            notes: null,
            status: 'active',
            releasedAt: null,
            soldAt: null,
            createdAt: '2026-06-01T12:00:00.000Z',
            updatedAt: '2026-06-01T12:00:00.000Z'
          }
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
      reserveStockItem: vi.fn(),
      updateStockReservation: vi.fn(),
      releaseStockReservation: vi.fn(),
      stores: [
        { id: 'store-1', name: 'Matriz Fortaleza', city: 'Fortaleza' },
        { id: 'store-2', name: 'Matriz Sobral', city: 'Sobral' }
      ]
    });
  });

  it('renders current stock table headers and battery badges', () => {
    const { container } = render(<Inventory />);

    expect(screen.getByRole('button', { name: 'Geral' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Loja' })).not.toBeInTheDocument();

    const table = container.querySelector('table');
    expect(table).toBeInTheDocument();
    expect(within(table as HTMLElement).getByText('Dispositivo')).toBeInTheDocument();
    expect(within(table as HTMLElement).getByText('Caixa')).toBeInTheDocument();
    expect(within(table as HTMLElement).queryByText('Custo Total')).not.toBeInTheDocument();
    expect(within(table as HTMLElement).queryByText('Lucro')).not.toBeInTheDocument();

    expect(screen.getByText('100%')).toBeInTheDocument();
    expect(screen.getByText('85%')).toBeInTheDocument();
    expect(screen.queryByText('iPhone 15 Pro (Vendido)')).not.toBeInTheDocument();
  });

  it('separates reserved stock from available tab', async () => {
    render(<Inventory />);

    expect(screen.getByText('iPhone 16')).toBeInTheDocument();
    expect(screen.queryByText('iPhone 15 Reservado')).not.toBeInTheDocument();

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Reservado' }));
    });

    expect(screen.getByText('iPhone 15 Reservado')).toBeInTheDocument();
    expect(screen.queryByText('iPhone 16')).not.toBeInTheDocument();
    expect(screen.getByText('Reserva vencida')).toBeInTheDocument();
  });

  it('reserves an available stock item with structured data', async () => {
    const reserveStockItem = vi.fn().mockResolvedValue(undefined);
    useDataMock.mockReturnValue({
      ...useDataMock(),
      reserveStockItem
    });

    render(<Inventory />);

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Reservar iPhone 16/i }));
    });
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Salvar reserva mock' }));
    });

    expect(reserveStockItem).toHaveBeenCalledWith('stk-new', {
      customerName: 'Cliente Reserva',
      customerPhone: '88999990000',
      expiresAt: '2026-06-20',
      depositAmount: 100,
      depositPaymentMethod: 'Pix',
      notes: 'Sinal confirmado'
    });
    await waitFor(() => {
      expect(toastMock.success).toHaveBeenCalledWith('Aparelho reservado.');
    });
  });

  it('releases a reserved stock item back to available', async () => {
    const releaseStockReservation = vi.fn().mockResolvedValue(undefined);
    useDataMock.mockReturnValue({
      ...useDataMock(),
      releaseStockReservation
    });

    render(<Inventory />);

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Reservado' }));
    });
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Liberar iPhone 15 Reservado/i }));
    });

    expect(releaseStockReservation).toHaveBeenCalledWith('stk-reserved');
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

  it('uses capacity first and battery health second when model is the same', () => {
    const baseStockItem = {
      type: DeviceType.IPHONE,
      model: 'iPhone 15',
      color: 'Preto',
      hasBox: true,
      imei: '',
      condition: Condition.USED,
      status: StockStatus.AVAILABLE,
      batteryHealth: 90,
      storeId: 'store-1',
      purchasePrice: 4000,
      sellPrice: 5000,
      maxDiscount: 0,
      warrantyType: WarrantyType.STORE,
      warrantyEnd: '',
      origin: '',
      notes: '',
      observations: '',
      costs: [],
      photos: []
    };

    useDataMock.mockReturnValue({
      stock: [
        {
          ...baseStockItem,
          id: 'stk-128',
          capacity: '128 GB',
          entryDate: '2026-02-07'
        },
        {
          ...baseStockItem,
          id: 'stk-512',
          capacity: '512 GB',
          entryDate: '2026-02-01'
        },
        {
          ...baseStockItem,
          id: 'stk-256-older',
          capacity: '256 GB',
          color: 'Azul',
          batteryHealth: 93,
          entryDate: '2026-02-05'
        },
        {
          ...baseStockItem,
          id: 'stk-256-newer',
          capacity: '256 GB',
          color: 'Branco',
          batteryHealth: 86,
          entryDate: '2026-02-06'
        }
      ],
      removeStockItem: vi.fn(),
      updateStockItem: vi.fn(),
      stores: [{ id: 'store-1', name: 'Matriz Fortaleza', city: 'Fortaleza' }]
    });

    render(<Inventory />);

    const table = screen.getByRole('table');
    const bodyRows = within(table).getAllByRole('row').slice(1);
    const orderedRowText = bodyRows.map((row) => within(row).getAllByRole('button')[0]?.textContent || '');

    expect(orderedRowText[0]).toContain('512 GB');
    expect(orderedRowText[1]).toContain('256 GB');
    expect(orderedRowText[2]).toContain('256 GB');
    expect(orderedRowText[3]).toContain('128 GB');
    expect(orderedRowText[1]).toContain('Azul');
    expect(orderedRowText[2]).toContain('Branco');
  });

  it('renders contextual empty state when filters return no rows', async () => {
    const user = userEvent.setup();
    render(<Inventory />);

    await user.type(screen.getByPlaceholderText('Buscar por modelo ou IMEI/Serial...'), 'inexistente');

    expect(screen.getByText('Nenhum aparelho encontrado com os filtros atuais')).toBeInTheDocument();
    expect(screen.getByText('Ajuste filtros ou limpe a busca para visualizar mais itens.')).toBeInTheDocument();
  });

  it('prioritizes exact iPhone generation matches before variants in stock search', async () => {
    const user = userEvent.setup();
    const baseStockItem = {
      type: DeviceType.IPHONE,
      color: 'Preto',
      hasBox: true,
      capacity: '128 GB',
      condition: Condition.USED,
      status: StockStatus.AVAILABLE,
      batteryHealth: 90,
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
      entryDate: '2026-02-01'
    };
    useDataMock.mockReturnValue({
      stock: [
        {
          ...baseStockItem,
          id: 'stk-14-imei-match',
          model: 'iPhone 14',
          imei: '001300000000000'
        },
        {
          ...baseStockItem,
          id: 'stk-13-pro-max',
          model: 'iPhone 13 Pro Max',
          imei: '130000000000003'
        },
        {
          ...baseStockItem,
          id: 'stk-13-pro',
          model: 'iPhone 13 Pro',
          imei: '130000000000002'
        },
        {
          ...baseStockItem,
          id: 'stk-13',
          model: 'iPhone 13',
          imei: '130000000000001'
        }
      ],
      removeStockItem: vi.fn(),
      updateStockItem: vi.fn(),
      stores: [{ id: 'store-1', name: 'Matriz Fortaleza', city: 'Fortaleza' }]
    });
    render(<Inventory />);

    await user.type(screen.getByPlaceholderText('Buscar por modelo ou IMEI/Serial...'), '13');

    const table = screen.getByRole('table');
    const bodyRows = within(table).getAllByRole('row').slice(1);
    const modelOrder = bodyRows.map((row) => within(row).getAllByRole('button')[0]?.textContent || '');

    expect(modelOrder).toHaveLength(3);
    expect(modelOrder[0]).toContain('iPhone 13');
    expect(modelOrder[0]).not.toContain('Pro');
    expect(modelOrder[1]).toContain('iPhone 13 Pro');
    expect(modelOrder[1]).not.toContain('Max');
    expect(modelOrder[2]).toContain('iPhone 13 Pro Max');
    expect(modelOrder.join(' ')).not.toContain('iPhone 14');
  });

  it('hides insert, update and delete inventory actions when permission is read-only', async () => {
    usePermissionsMock.mockReturnValue({
      can: vi.fn((_key: string, action = 'visible') => action === 'visible')
    });

    render(<Inventory />);

    expect(screen.queryByRole('button', { name: 'Adicionar Aparelho' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Editar iPhone 16/i })).not.toBeInTheDocument();

    await act(async () => {
      fireEvent.click(screen.getByText('iPhone 16'));
    });
    expect(screen.queryByRole('button', { name: 'Confirmar exclusao mock' })).not.toBeInTheDocument();
  });

  it('filters quick store options for available and preparation tabs', async () => {
    render(<Inventory />);

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Sobral' }));
    });
    expect(screen.getByText('iPhone 14')).toBeInTheDocument();
    expect(screen.queryByText('iPhone 16')).not.toBeInTheDocument();

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Em Preparação' }));
    });
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

  it('opens WhatsApp complete share list without preparation items', async () => {
    render(<Inventory />);

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /WhatsApp/i }));
    });
    await act(async () => {
      fireEvent.click(screen.getByRole('menuitem', { name: 'Lista completa' }));
    });
    expect(window.open).not.toHaveBeenCalled();
    await act(async () => {
      fireEvent.click(screen.getByRole('menuitem', { name: /12x/i }));
    });

    expect(window.open).toHaveBeenCalledTimes(1);
    const [url] = vi.mocked(window.open).mock.calls[0];
    const sharedText = decodeURIComponent(String(url).replace('https://wa.me/?text=', ''));

    expect(sharedText).toContain('*📱 LISTA DE ESTOQUE*');
    expect(sharedText).toContain('🆕 *NOVOS*');
    expect(sharedText).toContain('♻️ *SEMINOVOS*');
    expect(sharedText).toContain('iPhone 16');
    expect(sharedText).toContain('iPhone 14');
    expect(sharedText).not.toContain('iPhone 15 Reservado');
    expect(sharedText).toMatch(/🆕 \*NOVOS\*\n.*iPhone 16.*\n♻️ \*SEMINOVOS\*\n.*iPhone 14/s);
    expect(sharedText).toContain('🔋 100%');
    expect(sharedText).toMatch(/💰 À vista R\$\s+6\.700,00/);
    expect(sharedText).toContain('💳 12x de R$');
    expect(sharedText).not.toContain('iPhone 13');
    expect(sharedText).not.toContain('iPhone 12');
    expect(sharedText).not.toContain('Vendido');
  });

  it('shares a special WhatsApp list with only selected filtered devices', async () => {
    const user = userEvent.setup();
    render(<Inventory />);

    await user.click(screen.getByRole('button', { name: /WhatsApp/i }));
    await user.click(screen.getByRole('menuitem', { name: 'Lista especial' }));

    expect(screen.getByText('Lista especial ativa')).toBeInTheDocument();
    expect(screen.getByLabelText('Banner flutuante da lista especial')).toHaveClass('fixed');
    expect(screen.getByLabelText('Banner flutuante da lista especial').className).toContain('top-[calc(env(safe-area-inset-top,0px)+5.75rem)]');
    expect(screen.getByLabelText('Banner flutuante da lista especial').parentElement).toBe(document.body);
    expect(screen.getByTestId('inventory-content')).toHaveClass('pt-28');
    expect(screen.getByRole('button', { name: /Escolher parcelas/i })).toBeDisabled();

    await user.click(screen.getByRole('button', { name: /Selecionar iPhone 16/i }));

    expect(screen.getByText('1 selecionado')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /Escolher parcelas/i }));
    await user.click(screen.getByRole('menuitem', { name: /12x/i }));

    expect(window.open).toHaveBeenCalledTimes(1);
    const [url] = vi.mocked(window.open).mock.calls[0];
    const sharedText = decodeURIComponent(String(url).replace('https://wa.me/?text=', ''));

    expect(sharedText).toContain('iPhone 16');
    expect(sharedText).not.toContain('iPhone 14');
    expect(sharedText).toContain('💳 12x de R$');
  });

  it('builds Instagram share text with battery emoji only, one item per line, and at most 1000 characters', () => {
    const manyItems = Array.from({ length: 80 }, (_, index) => ({
      id: `stk-share-${index}`,
      type: DeviceType.IPHONE,
      model: `iPhone ${16 - (index % 5)}`,
      color: index % 2 === 0 ? 'Preto' : 'Branco',
      hasBox: true,
      capacity: `${128 + (index % 4) * 128} GB`,
      imei: '',
      condition: index % 3 === 0 ? Condition.NEW : Condition.USED,
      status: StockStatus.AVAILABLE,
      batteryHealth: 100 - (index % 20),
      storeId: 'store-1',
      purchasePrice: 3000,
      sellPrice: 4500 + index,
      maxDiscount: 0,
      warrantyType: WarrantyType.STORE,
      warrantyEnd: '',
      origin: '',
      notes: '',
      observations: '',
      costs: [],
      photos: [],
      entryDate: '2026-02-01'
    }));

    const text = buildStockShareText(manyItems, 'instagram', { installments: 12, feeRate: 10.9 });

    expect(text).toContain('Novos:');
    expect(text).toContain('Seminovos:');
    expect(text).toMatch(/Novos:\n.*🔋.*\nSeminovos:/s);
    expect(text).toContain('À vista R$');
    expect(text).toContain('12x de R$');
    expect(text).not.toMatch(/[📱🆕♻️💰]/u);
    expect(text.length).toBeLessThanOrEqual(1000);
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

  it('moves an edited stock item to Em Uso', async () => {
    const user = userEvent.setup();
    const updateStockItem = vi.fn().mockResolvedValue(undefined);
    useDataMock.mockReturnValue({
      stock: [
        {
          id: 'stk-in-use',
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
        }
      ],
      removeStockItem: vi.fn(),
      updateStockItem,
      stores: [{ id: 'store-1', name: 'Matriz Fortaleza', city: 'Fortaleza' }]
    });

    render(<Inventory />);

    await user.click(screen.getByRole('button', { name: /Editar iPhone 16/i }));
    await user.click(screen.getByRole('button', { name: 'Adicionar em Uso' }));

    expect(updateStockItem).toHaveBeenCalledWith('stk-in-use', { status: StockStatus.IN_USE });
    expect(toastMock.success).toHaveBeenCalledWith('Aparelho movido para Em Uso.');
  });
});
