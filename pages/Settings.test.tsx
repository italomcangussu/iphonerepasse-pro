import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import Settings from './Settings';

const useAuthMock = vi.fn();
const useDataMock = vi.fn();
const usePermissionsMock = vi.fn();
const toggleThemeMock = vi.fn();
const signOutMock = vi.fn();
const refreshDataMock = vi.fn();
const updatePermissionMock = vi.fn();
const addFinancialCategoryMock = vi.fn();
const updateFinancialCategoryMock = vi.fn();
const removeFinancialCategoryMock = vi.fn();
const toastSuccessMock = vi.fn();
const toastErrorMock = vi.fn();
const toastInfoMock = vi.fn();
const toastConfirmMock = vi.fn(async () => true);
const supabaseFromMock = vi.fn();
const supabaseSelectMock = vi.fn();
const supabaseOrderMock = vi.fn();

vi.mock('../contexts/AuthContext', () => ({
  useAuth: () => useAuthMock()
}));

vi.mock('../services/dataContext', () => ({
  useData: () => useDataMock()
}));

vi.mock('../contexts/PermissionsContext', () => ({
  usePermissions: () => usePermissionsMock()
}));

vi.mock('../contexts/ThemeContext', () => ({
  useTheme: () => ({
    resolvedTheme: 'light',
    toggleTheme: toggleThemeMock
  })
}));

vi.mock('../components/ui/ToastProvider', () => ({
  useToast: () => ({
    success: toastSuccessMock,
    error: toastErrorMock,
    info: toastInfoMock,
    confirm: toastConfirmMock,
    dismiss: vi.fn(),
    clear: vi.fn()
  })
}));

vi.mock('../services/adminProvision', () => ({
  adminProvisionUser: vi.fn()
}));

vi.mock('../services/adminManageUser', () => ({
  adminUpdateUser: vi.fn(),
  adminDeleteUser: vi.fn()
}));

vi.mock('../services/supabase', () => ({
  supabase: {
    from: (...args: any[]) => supabaseFromMock(...args),
    auth: {
      updateUser: vi.fn()
    }
  }
}));

describe('Settings financial categories modal', () => {
  let locationReloadMock: ReturnType<typeof vi.fn>;

  const renderSettings = async () => {
    render(
      <MemoryRouter>
        <Settings />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(supabaseFromMock).toHaveBeenCalledWith('user_access_roles');
    });
  };

  const openFinanceTab = async (user: ReturnType<typeof userEvent.setup>) => {
    await user.click(screen.getByRole('button', { name: 'Financeiro' }));
    expect(screen.getByRole('heading', { name: 'Categorias Financeiras' })).toBeInTheDocument();
  };

  beforeEach(() => {
    vi.clearAllMocks();
    toastConfirmMock.mockResolvedValue(true);

    supabaseOrderMock.mockResolvedValue({ data: [], error: null });
    supabaseSelectMock.mockReturnValue({ order: supabaseOrderMock });
    supabaseFromMock.mockReturnValue({ select: supabaseSelectMock });
    removeFinancialCategoryMock.mockResolvedValue(undefined);
    locationReloadMock = vi.fn();

    Object.defineProperty(window, 'location', {
      configurable: true,
      value: {
        ...window.location,
        reload: locationReloadMock,
      },
    });

    useAuthMock.mockReturnValue({
      user: {
        id: 'admin-user-id',
        email: 'admin@iphonerepasse.com',
        user_metadata: {
          full_name: 'Admin',
          name: 'Admin',
          phone: ''
        }
      },
      role: 'admin',
      signOut: signOutMock
    });

    usePermissionsMock.mockReturnValue({
      matrix: {
        admin: {},
        manager: {},
        seller: {}
      },
      updatePermission: updatePermissionMock,
      isLoading: false
    });

    useDataMock.mockReturnValue({
      stores: [{ id: 'store-1', name: 'Matriz', city: 'Fortaleza' }],
      refreshData: refreshDataMock,
      sellers: [],
      financialCategories: [
        {
          id: 'fcat-in-1',
          name: 'Servico Tecnico',
          type: 'IN',
          isDefault: false,
          createdAt: '2026-04-01T10:00:00.000Z'
        },
        {
          id: 'fcat-out-1',
          name: 'Compra de Pecas',
          type: 'OUT',
          isDefault: false,
          createdAt: '2026-04-01T10:00:00.000Z'
        }
      ],
      addFinancialCategory: addFinancialCategoryMock,
      updateFinancialCategory: updateFinancialCategoryMock,
      removeFinancialCategory: removeFinancialCategoryMock
    });
  });

  it('opens new category modal from the finance tab CTA', async () => {
    const user = userEvent.setup();
    await renderSettings();

    await openFinanceTab(user);
    await user.click(screen.getByRole('button', { name: 'Nova Categoria' }));

    expect(screen.getByRole('heading', { name: 'Nova Categoria Financeira' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Adicionar' })).toBeInTheDocument();
  });

  it('opens edit category modal with selected category data', async () => {
    const user = userEvent.setup();
    await renderSettings();

    await openFinanceTab(user);

    const entryLabel = screen.getByText('Servico Tecnico');
    const entryRow = entryLabel.parentElement as HTMLElement;
    const editButton = within(entryRow).getAllByRole('button')[0];
    await user.click(editButton);

    expect(screen.getByRole('heading', { name: 'Editar Categoria Financeira' })).toBeInTheDocument();
    const nameInput = screen.getByPlaceholderText('Ex: Aluguel, Bonus, etc.') as HTMLInputElement;
    expect(nameInput.value).toBe('Servico Tecnico');
    expect(screen.getByRole('button', { name: 'Salvar Alterações' })).toBeInTheDocument();
  });

  it('removes category after confirmation and shows success feedback', async () => {
    const user = userEvent.setup();
    await renderSettings();

    await openFinanceTab(user);

    await user.click(screen.getByRole('button', { name: 'Remover categoria Servico Tecnico' }));

    await waitFor(() => {
      expect(toastConfirmMock).toHaveBeenCalledWith(
        expect.objectContaining({
          variant: 'danger',
          confirmLabel: expect.stringMatching(/remover/i),
        })
      );
      expect(removeFinancialCategoryMock).toHaveBeenCalledWith('fcat-in-1');
      expect(toastSuccessMock).toHaveBeenCalledWith('Categoria removida.');
    });
  });

  it('shows error feedback when remove category fails', async () => {
    const user = userEvent.setup();
    removeFinancialCategoryMock.mockRejectedValueOnce(new Error('falha ao remover'));

    await renderSettings();
    await openFinanceTab(user);

    await user.click(screen.getByRole('button', { name: 'Remover categoria Compra de Pecas' }));

    await waitFor(() => {
      expect(removeFinancialCategoryMock).toHaveBeenCalledWith('fcat-out-1');
      expect(toastErrorMock).toHaveBeenCalledWith('falha ao remover');
    });
  });

  it('checks the service worker for a newly waiting update from the about tab', async () => {
    const user = userEvent.setup();
    const waitingWorker = { postMessage: vi.fn() };
    const registration = {
      waiting: null as null | typeof waitingWorker,
      update: vi.fn(async () => {
        registration.waiting = waitingWorker;
      }),
    };

    Object.defineProperty(navigator, 'serviceWorker', {
      configurable: true,
      value: {
        ready: Promise.resolve(registration),
      },
    });

    await renderSettings();

    await user.click(screen.getByRole('button', { name: 'Sobre' }));
    await user.click(screen.getByRole('button', { name: /Verificar atualizações/i }));

    await waitFor(() => {
      expect(registration.update).toHaveBeenCalledTimes(1);
      expect(waitingWorker.postMessage).toHaveBeenCalledWith({ type: 'SKIP_WAITING' });
      expect(locationReloadMock).toHaveBeenCalledTimes(1);
    });
  });
});
