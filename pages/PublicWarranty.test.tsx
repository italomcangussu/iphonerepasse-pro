import { render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import PublicWarranty from './PublicWarranty';

const invokeMock = vi.fn();

vi.mock('../services/supabase', () => ({
  supabase: {
    functions: {
      invoke: (...args: any[]) => invokeMock(...args)
    }
  }
}));

describe('PublicWarranty page', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const renderCpfRoute = (route = '/warranties/211.265.773-91') =>
    render(
      <MemoryRouter initialEntries={[route]}>
        <Routes>
          <Route path="/warranties/:cpf" element={<PublicWarranty />} />
        </Routes>
      </MemoryRouter>
    );

  const renderTokenRoute = (route = '/warranty/token-123') =>
    render(
      <MemoryRouter initialEntries={[route]}>
        <Routes>
          <Route path="/warranty/:token" element={<PublicWarranty />} />
        </Routes>
      </MemoryRouter>
    );

  it('normalizes cpf from route and renders warranty list lookup', async () => {
    invokeMock.mockResolvedValue({
      error: null,
      data: {
        lookup: {
          mode: 'cpf',
          customerName: 'Cliente Teste',
          cpfMasked: '***.***.***-91',
          warranties: [
            {
              certificateId: '#NEW123',
              saleDate: '2026-03-01T00:00:00.000Z',
              warrantyExpiresAt: '2026-06-01T00:00:00.000Z',
              status: 'active',
              customerName: 'Cliente Teste',
              storeName: 'Loja Teste',
              items: [
                {
                  model: 'iPhone 15',
                  capacity: '256 GB',
                  color: 'Azul',
                  condition: 'Seminovo',
                  imeiMasked: '***********2345'
                }
              ]
            },
            {
              certificateId: '#OLD123',
              saleDate: '2025-01-01T00:00:00.000Z',
              warrantyExpiresAt: '2025-04-01T00:00:00.000Z',
              status: 'expired',
              customerName: 'Cliente Teste',
              storeName: 'Loja Teste',
              items: []
            }
          ]
        }
      }
    });

    renderCpfRoute();

    await waitFor(() => {
      expect(invokeMock).toHaveBeenCalledWith('warranty-public', { body: { cpf: '21126577391' } });
    });
    expect(await screen.findByText('Garantias do Cliente')).toBeInTheDocument();
    expect(screen.getByText('***.***.***-91')).toBeInTheDocument();
    expect(screen.getByText('#NEW123')).toBeInTheDocument();
    expect(screen.getByText('#OLD123')).toBeInTheDocument();
  });

  it('shows empty state when cpf has no warranties', async () => {
    invokeMock.mockResolvedValue({
      error: null,
      data: {
        lookup: {
          mode: 'cpf',
          customerName: 'Cliente Sem Garantia',
          cpfMasked: '***.***.***-00',
          warranties: []
        }
      }
    });

    renderCpfRoute('/warranties/12345678900');
    expect(await screen.findByText('Nenhuma garantia encontrada para este CPF.')).toBeInTheDocument();
  });

  it('shows error for invalid cpf route param', async () => {
    renderCpfRoute('/warranties/12345');
    expect(await screen.findByText('CPF inválido.')).toBeInTheDocument();
    expect(invokeMock).not.toHaveBeenCalled();
  });

  it('keeps legacy token route working', async () => {
    invokeMock.mockResolvedValue({
      error: null,
      data: {
        warranty: {
          certificateId: '#ABC123',
          saleDate: '2026-02-01T00:00:00.000Z',
          warrantyExpiresAt: '2026-05-01T00:00:00.000Z',
          status: 'active',
          customerName: 'Cliente Teste',
          storeName: 'Loja Teste',
          items: [
            {
              model: 'iPhone 15',
              capacity: '256 GB',
              color: 'Azul',
              condition: 'Seminovo',
              imeiMasked: '***********2345'
            }
          ]
        }
      }
    });

    renderTokenRoute();
    await waitFor(() => {
      expect(invokeMock).toHaveBeenCalledWith('warranty-public', { body: { token: 'token-123' } });
    });
    expect(await screen.findByText('Certificado de Garantia')).toBeInTheDocument();
  });
});
