import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { Condition, DeviceType, StockStatus, WarrantyType } from '../types';
import PDVHistory from './PDVHistory';

const useDataMock = vi.fn();
const useAuthMock = vi.fn();

vi.mock('../services/dataContext', () => ({
  useData: () => useDataMock()
}));

vi.mock('../contexts/AuthContext', () => ({
  useAuth: () => useAuthMock()
}));

const buildSale = ({
  id,
  customerId,
  sellerId,
  paymentType,
  date
}: {
  id: string;
  customerId: string;
  sellerId: string;
  paymentType: 'Pix' | 'Dinheiro' | 'Cartão' | 'Devedor';
  date: string;
}) => ({
  id,
  customerId,
  sellerId,
  items: [
    {
      id: `stk-${id}`,
      type: DeviceType.IPHONE,
      model: 'iPhone Test',
      color: 'Preto',
      capacity: '128 GB',
      imei: `imei-${id}`,
      condition: Condition.USED,
      status: StockStatus.SOLD,
      storeId: sellerId === 'sel-1' ? 'store-1' : 'store-2',
      purchasePrice: 1000,
      sellPrice: 2000,
      maxDiscount: 0,
      warrantyType: WarrantyType.STORE,
      costs: [],
      photos: [],
      entryDate: '2026-01-01'
    }
  ],
  tradeInValue: 0,
  discount: 0,
  total: 2000,
  paymentMethods: [{ type: paymentType, amount: 2000 }],
  date,
  warrantyExpiresAt: null
});

describe('PDVHistory', () => {
  const todayDate = new Date();
  const todayIso = new Date(
    todayDate.getFullYear(),
    todayDate.getMonth(),
    todayDate.getDate(),
    10,
    0,
    0
  ).toISOString();
  const oldIso = new Date(
    todayDate.getFullYear(),
    todayDate.getMonth(),
    todayDate.getDate() - 10,
    10,
    0,
    0
  ).toISOString();

  beforeEach(() => {
    vi.clearAllMocks();
    useAuthMock.mockReturnValue({
      profile: null
    });
    useDataMock.mockReturnValue({
      sales: [
        buildSale({
          id: 'sale-today',
          customerId: 'cust-1',
          sellerId: 'sel-1',
          paymentType: 'Pix',
          date: todayIso
        }),
        buildSale({
          id: 'sale-old',
          customerId: 'cust-2',
          sellerId: 'sel-2',
          paymentType: 'Devedor',
          date: oldIso
        })
      ],
      stores: [
        { id: 'store-1', name: 'Loja Centro', city: 'Fortaleza' },
        { id: 'store-2', name: 'Loja Aldeota', city: 'Fortaleza' }
      ],
      sellers: [
        { id: 'sel-1', name: 'Vendedor 1', email: '', authUserId: '', storeId: 'store-1', totalSales: 0 },
        { id: 'sel-2', name: 'Vendedor 2', email: '', authUserId: '', storeId: 'store-2', totalSales: 0 }
      ],
      customers: [
        { id: 'cust-1', name: 'Cliente Hoje', cpf: '', phone: '', email: '', birthDate: '', purchases: 0, totalSpent: 0 },
        { id: 'cust-2', name: 'Cliente Antigo', cpf: '', phone: '', email: '', birthDate: '', purchases: 0, totalSpent: 0 }
      ]
    });
  });

  it('shows sales history first and keeps new sale button pointing to step flow page', () => {
    render(
      <MemoryRouter>
        <PDVHistory />
      </MemoryRouter>
    );

    expect(screen.getByRole('heading', { name: 'Historico de Vendas' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Nova venda' })).toHaveAttribute('href', '/pdv/nova-venda');
    expect(screen.getByText('Cliente Hoje')).toBeInTheDocument();
    expect(screen.queryByText('Cliente Antigo')).not.toBeInTheDocument();
  });

  it('filters by payment method', async () => {
    const user = userEvent.setup();

    useDataMock.mockReturnValue({
      sales: [
        buildSale({
          id: 'sale-pix',
          customerId: 'cust-1',
          sellerId: 'sel-1',
          paymentType: 'Pix',
          date: todayIso
        }),
        buildSale({
          id: 'sale-debt',
          customerId: 'cust-2',
          sellerId: 'sel-2',
          paymentType: 'Devedor',
          date: todayIso
        })
      ],
      stores: [
        { id: 'store-1', name: 'Loja Centro', city: 'Fortaleza' },
        { id: 'store-2', name: 'Loja Aldeota', city: 'Fortaleza' }
      ],
      sellers: [
        { id: 'sel-1', name: 'Vendedor 1', email: '', authUserId: '', storeId: 'store-1', totalSales: 0 },
        { id: 'sel-2', name: 'Vendedor 2', email: '', authUserId: '', storeId: 'store-2', totalSales: 0 }
      ],
      customers: [
        { id: 'cust-1', name: 'Cliente Pix', cpf: '', phone: '', email: '', birthDate: '', purchases: 0, totalSpent: 0 },
        { id: 'cust-2', name: 'Cliente Devedor', cpf: '', phone: '', email: '', birthDate: '', purchases: 0, totalSpent: 0 }
      ]
    });

    render(
      <MemoryRouter>
        <PDVHistory />
      </MemoryRouter>
    );

    expect(screen.getByText('Cliente Pix')).toBeInTheDocument();
    expect(screen.getByText('Cliente Devedor')).toBeInTheDocument();

    await user.selectOptions(screen.getByLabelText('Metodo de pagamento'), 'Devedor');

    expect(screen.queryByText('Cliente Pix')).not.toBeInTheDocument();
    expect(screen.getByText('Cliente Devedor')).toBeInTheDocument();
  });

  it('defaults store filter to logged seller store', async () => {
    useAuthMock.mockReturnValue({
      profile: {
        id: 'user-1',
        role: 'seller',
        sellerId: 'sel-2'
      }
    });
    useDataMock.mockReturnValue({
      sales: [
        buildSale({
          id: 'sale-store-1',
          customerId: 'cust-1',
          sellerId: 'sel-1',
          paymentType: 'Pix',
          date: todayIso
        }),
        buildSale({
          id: 'sale-store-2',
          customerId: 'cust-2',
          sellerId: 'sel-2',
          paymentType: 'Devedor',
          date: todayIso
        })
      ],
      stores: [
        { id: 'store-1', name: 'Loja Centro', city: 'Fortaleza' },
        { id: 'store-2', name: 'Loja Aldeota', city: 'Fortaleza' }
      ],
      sellers: [
        { id: 'sel-1', name: 'Vendedor 1', email: '', authUserId: '', storeId: 'store-1', totalSales: 0 },
        { id: 'sel-2', name: 'Vendedor 2', email: '', authUserId: '', storeId: 'store-2', totalSales: 0 }
      ],
      customers: [
        { id: 'cust-1', name: 'Cliente Hoje', cpf: '', phone: '', email: '', birthDate: '', purchases: 0, totalSpent: 0 },
        { id: 'cust-2', name: 'Cliente Antigo', cpf: '', phone: '', email: '', birthDate: '', purchases: 0, totalSpent: 0 }
      ]
    });

    render(
      <MemoryRouter>
        <PDVHistory />
      </MemoryRouter>
    );

    const storeFilter = screen.getByLabelText('Loja');
    await waitFor(() => {
      expect(storeFilter).toHaveValue('store-2');
    });

    expect(screen.getByText('Cliente Antigo')).toBeInTheDocument();
    expect(screen.queryByText('Cliente Hoje')).not.toBeInTheDocument();
  });
});
