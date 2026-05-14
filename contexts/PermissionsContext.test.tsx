import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PermissionsProvider, usePermissions } from './PermissionsContext';

const useAuthMock = vi.fn();
const supabaseFromMock = vi.fn();
const supabaseSelectMock = vi.fn();
const supabaseEqMock = vi.fn();

vi.mock('./AuthContext', () => ({
  useAuth: () => useAuthMock()
}));

vi.mock('../services/supabase', () => ({
  supabase: {
    from: (...args: any[]) => supabaseFromMock(...args)
  }
}));

const Probe = () => {
  const { can, refreshPermissions } = usePermissions();
  return (
    <div>
      <p data-testid="finance-visible">{can('finance', 'visible') ? 'sim' : 'nao'}</p>
      <p data-testid="finance-editable">{can('finance', 'editable') ? 'sim' : 'nao'}</p>
      <button type="button" onClick={() => void refreshPermissions()}>
        Recarregar
      </button>
    </div>
  );
};

describe('PermissionsProvider', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useAuthMock.mockReturnValue({
      role: 'seller',
      isAuthenticated: true,
      isLoading: false
    });
    supabaseFromMock.mockReturnValue({ select: supabaseSelectMock });
    supabaseSelectMock.mockReturnValue({ eq: supabaseEqMock });
  });

  it('updates user behavior when refreshed permissions change in Supabase', async () => {
    const user = userEvent.setup();
    supabaseEqMock
      .mockResolvedValueOnce({
        data: [
          {
            role: 'seller',
            permission_key: 'finance',
            is_visible: false,
            is_editable: false,
            is_deletable: false
          }
        ],
        error: null
      })
      .mockResolvedValueOnce({
        data: [
          {
            role: 'seller',
            permission_key: 'finance',
            is_visible: true,
            is_editable: true,
            is_deletable: false
          }
        ],
        error: null
      });

    render(
      <PermissionsProvider>
        <Probe />
      </PermissionsProvider>
    );

    await waitFor(() => expect(screen.getByTestId('finance-visible')).toHaveTextContent('nao'));
    expect(screen.getByTestId('finance-editable')).toHaveTextContent('nao');

    await user.click(screen.getByRole('button', { name: 'Recarregar' }));

    await waitFor(() => expect(screen.getByTestId('finance-visible')).toHaveTextContent('sim'));
    expect(screen.getByTestId('finance-editable')).toHaveTextContent('sim');
    expect(supabaseFromMock).toHaveBeenCalledWith('app_role_permissions');
    expect(supabaseEqMock).toHaveBeenCalledWith('role', 'seller');
  });
});
