import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import Layout from './Layout';

const useAuthMock = vi.fn();
const usePermissionsMock = vi.fn();

vi.mock('../services/dataContext', () => ({
  useData: () => ({
    businessProfile: {}
  })
}));

vi.mock('../contexts/ThemeContext', () => ({
  useTheme: () => ({
    resolvedTheme: 'light',
    toggleTheme: vi.fn()
  })
}));

vi.mock('../contexts/AuthContext', () => ({
  useAuth: () => useAuthMock()
}));

vi.mock('../contexts/PermissionsContext', () => ({
  usePermissions: () => usePermissionsMock()
}));

vi.mock('../services/crmHandoff', () => ({
  createCrmHandoff: vi.fn(),
  openCRMStandaloneFallback: vi.fn()
}));

vi.mock('../services/supabase', () => ({
  supabase: {
    channel: vi.fn(() => ({
      on: vi.fn().mockReturnThis(),
      subscribe: vi.fn()
    })),
    removeChannel: vi.fn()
  }
}));

vi.mock('../components/ui/ToastProvider', () => ({
  useToast: () => ({
    info: vi.fn(),
    success: vi.fn(),
    error: vi.fn()
  })
}));

vi.mock('../hooks/useCRMUnreadCount', () => ({
  useCRMUnreadCount: () => 0
}));

vi.mock('../services/telemetry', () => ({
  trackUxEvent: vi.fn()
}));

describe('Layout permission navigation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useAuthMock.mockReturnValue({
      role: 'seller',
      user: { email: 'seller@iphonerepasse.com' }
    });
  });

  it('shows management items for a non-admin when the permission matrix allows them', () => {
    usePermissionsMock.mockReturnValue({
      can: vi.fn((key: string, action = 'visible') => action === 'visible' && ['dashboard', 'finance'].includes(key))
    });

    render(
      <MemoryRouter>
        <Layout>
          <div>Conteudo</div>
        </Layout>
      </MemoryRouter>
    );

    expect(screen.getByTestId('nav-link-finance')).toBeInTheDocument();
  });

  it('hides management items when the permission matrix denies visibility', () => {
    usePermissionsMock.mockReturnValue({
      can: vi.fn((key: string, action = 'visible') => action === 'visible' && key === 'dashboard')
    });

    render(
      <MemoryRouter>
        <Layout>
          <div>Conteudo</div>
        </Layout>
      </MemoryRouter>
    );

    expect(screen.queryByTestId('nav-link-finance')).not.toBeInTheDocument();
  });
});
