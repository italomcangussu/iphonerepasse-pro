import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import RepasseCare from './RepasseCare';
import { filterContracts } from './tabs/CareContractsTab';
import { periodRange } from './tabs/CareDashboardTab';
import type { CareContract } from '../../lib/care/careTypes';

const auth = vi.hoisted(() => ({ role: 'seller' as string }));
vi.mock('../../contexts/AuthContext', () => ({ useAuth: () => ({ role: auth.role }) }));
vi.mock('../../services/careApi', () => ({
  listCareContracts: vi.fn().mockResolvedValue([]),
  fetchCareDashboard: vi.fn().mockReturnValue(new Promise(() => {})),
}));

const contract = (patch: Partial<CareContract>): CareContract => ({
  id: 'c', contract_number: 1, status: 'ativo', customer_name: 'Maria Souza', device_model: 'iPhone 13', device_imei: '356789', customer_phone: '85999990000',
  ...patch,
} as CareContract);

describe('RepasseCare', () => {
  it('vendedor não vê painel nem regras (decisões administrativas)', async () => {
    auth.role = 'seller';
    render(<MemoryRouter><RepasseCare /></MemoryRouter>);
    expect(screen.getByRole('tab', { name: 'Contratos' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.queryByRole('tab', { name: 'Painel' })).not.toBeInTheDocument();
    expect(screen.queryByRole('tab', { name: 'Regras' })).not.toBeInTheDocument();
    expect(await screen.findByText('Nenhum contrato nesta situação')).toBeInTheDocument();
  });

  it('admin abre no painel', () => {
    auth.role = 'admin';
    render(<MemoryRouter><RepasseCare /></MemoryRouter>);
    expect(screen.getByRole('tab', { name: 'Painel' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('tab', { name: 'Regras' })).toBeInTheDocument();
  });

  it('filtra contratos por situação e busca sem acento', () => {
    const list = [
      contract({ id: '1', status: 'ativo', customer_name: 'João Araújo' }),
      contract({ id: '2', status: 'aguardando_assinatura', contract_number: 22 }),
      contract({ id: '3', status: 'cancelado' }),
    ];
    expect(filterContracts(list, 'vigentes', '').map((c) => c.id)).toEqual(['1']);
    expect(filterContracts(list, 'pendentes', '').map((c) => c.id)).toEqual(['2']);
    expect(filterContracts(list, 'todos', 'araujo').map((c) => c.id)).toEqual(['1']);
    expect(filterContracts(list, 'todos', '22').map((c) => c.id)).toEqual(['2']);
    expect(filterContracts(list, 'todos', '356789')).toHaveLength(3);
  });

  it('períodos do painel em data local de São Paulo', () => {
    const today = new Date('2026-10-15T15:00:00Z');
    expect(periodRange('mes', today)).toEqual({ from: '2026-10-01', to: '2026-10-15' });
    expect(periodRange('30d', today)).toEqual({ from: '2026-09-16', to: '2026-10-15' });
  });
});
