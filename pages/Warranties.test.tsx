import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import Warranties from './Warranties';
import { Condition } from '../types';

const toDataUrlMock = vi.fn();
const toastSuccessMock = vi.fn();
const toastErrorMock = vi.fn();
const useDataMock = vi.fn();
const getSessionMock = vi.fn();
const refreshSessionMock = vi.fn();
const fetchMock = vi.fn();
const addCustomerMock = vi.fn();
const addStockItemMock = vi.fn();
const removeStockItemMock = vi.fn();
const addSaleMock = vi.fn();
const updateCustomerMock = vi.fn();
const updateStockItemMock = vi.fn();
const refreshDataMock = vi.fn();

vi.mock('../services/dataContext', () => ({
  useData: () => useDataMock()
}));

vi.mock('../services/supabase', () => ({
  supabaseUrl: 'https://example.supabase.co',
  supabaseAnonKey: 'sb_publishable_test',
  supabase: {
    auth: {
      getSession: (...args: any[]) => getSessionMock(...args),
      refreshSession: (...args: any[]) => refreshSessionMock(...args)
    }
  }
}));

vi.mock('qrcode', () => ({
  default: {
    toDataURL: (...args: any[]) => toDataUrlMock(...args)
  }
}));

vi.mock('../components/ui/ToastProvider', () => ({
  useToast: () => ({
    success: toastSuccessMock,
    error: toastErrorMock,
    info: vi.fn(),
    dismiss: vi.fn(),
    clear: vi.fn()
  })
}));

describe('Warranties QR flow', () => {
  let writeTextMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();
    writeTextMock = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText: writeTextMock }
    });
    vi.stubGlobal('fetch', fetchMock);

    useDataMock.mockReturnValue({
      customers: [{ id: 'cust-1', name: 'Cliente Teste' }],
      sellers: [{ id: 'sel-1', name: 'Vendedor Teste', storeId: 'store-1' }],
      stores: [{ id: 'store-1', name: 'Matriz', city: 'Fortaleza' }],
      addCustomer: addCustomerMock,
      addStockItem: addStockItemMock,
      removeStockItem: removeStockItemMock,
      addSale: addSaleMock,
      updateCustomer: updateCustomerMock,
      updateStockItem: updateStockItemMock,
      refreshData: refreshDataMock,
      sales: [
        {
          id: 'sale-1',
          customerId: 'cust-1',
          sellerId: 'sel-1',
          items: [
            {
              id: 'stk-1',
              model: 'iPhone 15',
              capacity: '256 GB',
              color: 'Azul',
              imei: '123456789012345',
              condition: Condition.USED
            }
          ],
          paymentMethods: [{ type: 'Pix', amount: 5000 }],
          tradeInValue: 0,
          discount: 0,
          total: 5000,
          date: '2026-02-01T12:00:00.000Z',
          warrantyExpiresAt: '2026-05-01T12:00:00.000Z'
        },
        {
          id: 'sale-2',
          customerId: 'cust-1',
          sellerId: 'sel-1',
          items: [
            {
              id: 'stk-2',
              model: 'iPhone 16',
              capacity: '128 GB',
              color: 'Branco',
              imei: '555555555555555',
              condition: Condition.NEW
            }
          ],
          paymentMethods: [{ type: 'Pix', amount: 7000 }],
          tradeInValue: 0,
          discount: 0,
          total: 7000,
          date: '2026-02-05T12:00:00.000Z',
          warrantyExpiresAt: null
        }
      ]
    });

    fetchMock.mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue({ publicUrl: 'https://app.iphonerepasse.com.br/#/warranties/12345678901' })
    });
    toDataUrlMock.mockResolvedValue('data:image/png;base64,qr');
    getSessionMock.mockResolvedValue({
      data: {
        session: {
          access_token: 'jwt-token',
          expires_at: Math.floor(Date.now() / 1000) + 3600
        }
      },
      error: null
    });
    refreshSessionMock.mockResolvedValue({
      data: {
        session: {
          access_token: 'jwt-token-refreshed',
          expires_at: Math.floor(Date.now() / 1000) + 3600
        }
      },
      error: null
    });
  });

  it('generates real QR and copies public warranty link', async () => {
    const user = userEvent.setup();
    render(<Warranties />);

    expect(screen.getAllByRole('button', { name: /Ver Certificado/i })).toHaveLength(1);

    await user.click(screen.getByRole('button', { name: /Ver Certificado/i }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        'https://example.supabase.co/functions/v1/warranty-link-create',
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            apikey: 'sb_publishable_test',
            Authorization: 'Bearer jwt-token'
          })
        })
      );
    });
    await waitFor(() => {
      expect(toDataUrlMock).toHaveBeenCalledWith(
        'https://app.iphonerepasse.com.br/#/warranties/12345678901',
        expect.objectContaining({ width: 320, margin: 1, errorCorrectionLevel: 'M' })
      );
    });

    expect(await screen.findByAltText('QR Code da garantia')).toBeInTheDocument();

    await user.click(screen.getByTitle('Copiar link'));
    await waitFor(() => {
      expect(toastSuccessMock).toHaveBeenCalledWith('Link da garantia copiado.');
    });
    expect(toastErrorMock).not.toHaveBeenCalled();
  });

  it('opens management actions when clicking a warranty card', async () => {
    const user = userEvent.setup();
    render(<Warranties />);

    await user.click(screen.getByRole('button', { name: /Gerenciar garantia/i }));

    expect(screen.getByRole('button', { name: /Editar garantia/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Apagar garantia/i })).toBeInTheDocument();
  });

  it('opens add warranty modal from header CTA', async () => {
    const user = userEvent.setup();
    render(<Warranties />);

    await user.click(screen.getByRole('button', { name: /Adicionar garantia/i }));

    expect(screen.getByRole('heading', { name: /Adicionar garantia avulsa/i })).toBeInTheDocument();
    expect(screen.getByText('Modelo')).toBeInTheDocument();
  });
});
