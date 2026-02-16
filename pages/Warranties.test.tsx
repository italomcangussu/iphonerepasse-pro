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
        }
      ]
    });

    fetchMock.mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue({ publicUrl: 'https://app.iphonerepasse.com/#/warranties/12345678901' })
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
        'https://app.iphonerepasse.com/#/warranties/12345678901',
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
});
