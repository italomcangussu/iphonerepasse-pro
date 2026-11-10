import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import CompanyMembersModal from './CompanyMembersModal';

const listTenantMembersMock = vi.fn();
const listShareableMembersMock = vi.fn();
const shareTenantMembersMock = vi.fn();

vi.mock('../ui/ToastProvider', () => ({
  useToast: () => ({ success: vi.fn(), error: vi.fn(), info: vi.fn(), dismiss: vi.fn(), clear: vi.fn() }),
}));
vi.mock('../../services/tenants', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../services/tenants')>()),
  listTenantMembers: (id: string) => listTenantMembersMock(id),
  listShareableMembers: (id: string) => listShareableMembersMock(id),
  shareTenantMembers: (id: string, ids: string[]) => shareTenantMembersMock(id, ids),
}));

const second = { id: 't2', name: 'Loja Exemplo', role: 'admin' as const, isPrimary: false };
const primary = { id: 't1', name: 'iPhone Repasse', role: 'admin' as const, isPrimary: true };
const dono = { user_id: 'u1', email: 'dono@x.com', display_name: 'Victor', role: 'admin' as const };

describe('CompanyMembersModal · funcionários da iPhone Repasse', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    listTenantMembersMock.mockResolvedValue([{ ...dono, created_at: '2026-11-10', follows_primary: false }]);
    listShareableMembersMock.mockResolvedValue([
      { ...dono, access: 'member' },
      { user_id: 'u2', email: 'ana@x.com', display_name: 'Ana', role: 'manager', access: null },
      { user_id: 'u3', email: 'bia@x.com', display_name: 'Bia', role: 'seller', access: null },
    ]);
    shareTenantMembersMock.mockResolvedValue(1);
  });

  it('libera um funcionário com o papel da iPhone Repasse', async () => {
    render(<CompanyMembersModal company={second} currentUserId="u1" canShareFromPrimary onClose={vi.fn()} />);

    const section = await screen.findByRole('region', { name: 'Funcionários da iPhone Repasse' });
    expect(await within(section).findByText('Gerente na iPhone Repasse')).toBeInTheDocument();
    expect(within(section).getByText('Já tem acesso')).toBeInTheDocument();
    expect(within(section).getByRole('button', { name: 'Liberar todos' })).toBeInTheDocument();

    await userEvent.click(within(section).getByRole('button', { name: 'Liberar Ana' }));
    await waitFor(() => expect(shareTenantMembersMock).toHaveBeenCalledWith('t2', ['u2']));
    await waitFor(() => expect(listShareableMembersMock).toHaveBeenCalledTimes(2));
  });

  it('não oferece liberar na própria iPhone Repasse nem para quem não administra a principal', async () => {
    const { rerender } = render(<CompanyMembersModal company={primary} currentUserId="u1" canShareFromPrimary onClose={vi.fn()} />);
    await screen.findByText('Victor');
    expect(screen.queryByText('Funcionários da iPhone Repasse')).not.toBeInTheDocument();

    rerender(<CompanyMembersModal company={second} currentUserId="u1" canShareFromPrimary={false} onClose={vi.fn()} />);
    await screen.findByText('Victor');
    expect(screen.queryByText('Funcionários da iPhone Repasse')).not.toBeInTheDocument();
    expect(listShareableMembersMock).not.toHaveBeenCalled();
  });
});
