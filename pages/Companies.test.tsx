import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import Companies from './Companies';
import TenantSwitcher from '../components/TenantSwitcher';

const useAuthMock = vi.fn();
const fetchTransferCatalogMock = vi.fn();

vi.mock('../contexts/AuthContext', () => ({ useAuth: () => useAuthMock() }));
vi.mock('../components/ui/ToastProvider', () => ({
  useToast: () => ({ success: vi.fn(), error: vi.fn(), info: vi.fn(), dismiss: vi.fn(), clear: vi.fn() }),
}));
vi.mock('../services/tenants', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../services/tenants')>()),
  fetchTransferCatalog: () => fetchTransferCatalogMock(),
}));

const primary = { id: 't1', name: 'iPhone Repasse', role: 'admin' as const, isPrimary: true };
const second = { id: 't2', name: 'Nova Loja', role: 'admin' as const, isPrimary: false };

const authWith = (tenants: (typeof primary)[], canCreateTenants: boolean) => ({
  user: { id: 'u1' },
  refreshProfile: vi.fn(),
  switchTenant: vi.fn(),
  tenant: { activeTenantId: 't1', role: 'admin', sellerId: null, canCreateTenants, tenants },
});

describe('Companies', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('mostra a empresa que a pessoa está vendo e explica por que não dá para transferir com uma só', async () => {
    useAuthMock.mockReturnValue(authWith([primary], true));
    fetchTransferCatalogMock.mockResolvedValue([{ id: 't1', name: 'iPhone Repasse', isPrimary: true, stores: [] }]);
    render(<Companies />);

    expect(screen.getByText(/você está vendo esta/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Nova empresa/ })).toBeInTheDocument();
    expect(await screen.findByText(/administrar pelo menos duas empresas/)).toBeInTheDocument();
  });

  it('sem permissão de criar, não oferece Nova empresa; com duas empresas, mostra as abas de transferência', async () => {
    useAuthMock.mockReturnValue(authWith([primary, second], false));
    fetchTransferCatalogMock.mockResolvedValue([
      { id: 't1', name: 'iPhone Repasse', isPrimary: true, stores: [{ id: 'hdi', name: 'HDI', city: null, transferableCount: 2 }] },
      { id: 't2', name: 'Nova Loja', isPrimary: false, stores: [] },
    ]);
    render(<Companies />);

    expect(screen.queryByRole('button', { name: /Nova empresa/ })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Ver esta' })).toBeInTheDocument();
    expect(await screen.findByRole('tab', { name: 'Loja inteira' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Aparelhos' })).toHaveAttribute('aria-selected', 'true');
  });
});

describe('TenantSwitcher', () => {
  it('some quando a pessoa só tem uma empresa', () => {
    useAuthMock.mockReturnValue(authWith([primary], false));
    const { container } = render(<TenantSwitcher />);
    expect(container).toBeEmptyDOMElement();
  });

  it('lista as empresas no seletor do topo', () => {
    useAuthMock.mockReturnValue(authWith([primary, second], false));
    render(<TenantSwitcher />);
    const select = screen.getByLabelText('Empresa');
    expect(select).toHaveValue('t1');
    expect(screen.getByRole('option', { name: 'Nova Loja' })).toBeInTheDocument();
  });
});
