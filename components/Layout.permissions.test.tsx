import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import Layout from './Layout';

const useAuthMock = vi.fn();
const usePermissionsMock = vi.fn();
const { refreshDataMock, prefetchPrimaryRouteMock } = vi.hoisted(() => ({
  refreshDataMock: vi.fn(),
  prefetchPrimaryRouteMock: vi.fn()
}));

vi.mock('../services/dataContext', () => ({
  useData: () => ({
    businessProfile: {},
    refreshData: refreshDataMock
  })
}));

vi.mock('../lib/routePrefetch', () => ({
  prefetchPrimaryRoute: prefetchPrimaryRouteMock
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
    Object.defineProperty(window.navigator, 'userAgent', {
      configurable: true,
      value: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15'
    });
    Object.defineProperty(window.navigator, 'maxTouchPoints', {
      configurable: true,
      value: 0
    });
    Object.defineProperty(window, 'innerWidth', {
      configurable: true,
      value: 1024
    });
    useAuthMock.mockReturnValue({
      role: 'seller',
      user: { email: 'seller@iphonerepasse.com' }
    });
  });

  it('shows management items for a non-admin when the permission matrix allows them', () => {
    usePermissionsMock.mockReturnValue({
      can: vi.fn((key: string, action = 'visible') => action === 'visible' && ['dashboard', 'finance', 'calculator'].includes(key))
    });

    render(
      <MemoryRouter>
        <Layout>
          <div>Conteudo</div>
        </Layout>
      </MemoryRouter>
    );

    expect(screen.getByTestId('nav-link-finance')).toBeInTheDocument();
    expect(screen.getByTestId('nav-link-calculator')).toBeInTheDocument();
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
    expect(screen.queryByTestId('nav-link-calculator')).not.toBeInTheDocument();
  });

  it('routes iPadOS mouse wheel events to the xl app scroller', () => {
    Object.defineProperty(window.navigator, 'maxTouchPoints', {
      configurable: true,
      value: 5
    });
    Object.defineProperty(window, 'innerWidth', {
      configurable: true,
      value: 1366
    });
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

    const main = screen.getByRole('main');
    Object.defineProperty(main, 'scrollHeight', { configurable: true, value: 2000 });
    Object.defineProperty(main, 'clientHeight', { configurable: true, value: 700 });
    main.scrollTop = 0;
    const scrollBy = vi.fn();
    main.scrollBy = scrollBy;
    const getComputedStyleSpy = vi.spyOn(window, 'getComputedStyle').mockImplementation((element) => ({
      overflowY: element === main ? 'auto' : 'visible'
    }) as CSSStyleDeclaration);

    const event = new WheelEvent('wheel', { bubbles: true, cancelable: true, deltaY: 120 });
    main.dispatchEvent(event);

    expect(event.defaultPrevented).toBe(true);
    expect(scrollBy).toHaveBeenCalledWith({ top: 120, behavior: 'auto' });
    getComputedStyleSpy.mockRestore();
  });

  it('supports iPadOS hardware keyboard tab and enter on xl controls', () => {
    Object.defineProperty(window.navigator, 'maxTouchPoints', {
      configurable: true,
      value: 5
    });
    Object.defineProperty(window, 'innerWidth', {
      configurable: true,
      value: 1366
    });
    usePermissionsMock.mockReturnValue({
      can: vi.fn((key: string, action = 'visible') => action === 'visible' && key === 'dashboard')
    });
    const onAction = vi.fn();

    render(
      <MemoryRouter>
        <Layout>
          <button type="button" onClick={onAction}>
            Ação
          </button>
          <select aria-label="Loja">
            <option>Sobral</option>
          </select>
        </Layout>
      </MemoryRouter>
    );

    const button = screen.getByRole('button', { name: 'Ação' });
    const select = screen.getByLabelText('Loja');
    button.scrollIntoView = vi.fn();
    select.scrollIntoView = vi.fn();
    const selectClick = vi.fn();
    select.click = selectClick;

    fireEvent.keyDown(window, { key: 'Tab' });
    expect(button).toHaveFocus();

    fireEvent.keyDown(window, { key: 'Enter' });
    expect(onAction).toHaveBeenCalledTimes(1);

    fireEvent.keyDown(window, { key: 'Tab' });
    expect(select).toHaveFocus();

    fireEvent.keyDown(window, { key: 'Enter' });
    expect(selectClick).toHaveBeenCalledTimes(1);
  });

  it('prefetches a primary tab on touch without refreshing all data', () => {
    usePermissionsMock.mockReturnValue({
      can: vi.fn((key: string, action = 'visible') => action === 'visible' && ['dashboard', 'pdv'].includes(key))
    });

    render(
      <MemoryRouter>
        <Layout>
          <div>Conteudo</div>
        </Layout>
      </MemoryRouter>
    );

    fireEvent.touchStart(screen.getByLabelText('PDV'));

    expect(prefetchPrimaryRouteMock).toHaveBeenCalledWith('/pdv');
    expect(refreshDataMock).not.toHaveBeenCalled();
  });
});
