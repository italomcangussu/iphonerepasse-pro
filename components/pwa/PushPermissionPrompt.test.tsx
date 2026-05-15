import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import PushPermissionPrompt from './PushPermissionPrompt';

const mockPush = vi.hoisted(() => ({
  status: 'default',
  subscribe: vi.fn(),
  unsubscribe: vi.fn(),
}));

const mockPwa = vi.hoisted(() => ({
  state: {
    ready: true,
    isStandalone: true,
    isIOS: true,
    registration: null,
    updateAvailable: false,
    installPromptEvent: null,
  },
  listener: null as null | (() => void),
}));

vi.mock('../../hooks/usePushNotifications', () => ({
  usePushNotifications: vi.fn(() => ({
    status: mockPush.status,
    platform: 'ios',
    subscribe: mockPush.subscribe,
    unsubscribe: mockPush.unsubscribe,
  })),
}));

vi.mock('../../services/pwa', () => ({
  getPwaState: vi.fn(() => mockPwa.state),
  subscribePwa: vi.fn((listener: () => void) => {
    mockPwa.listener = listener;
    return vi.fn();
  }),
}));

describe('PushPermissionPrompt', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    window.history.replaceState(null, '', '/');
    mockPush.status = 'default';
    mockPush.subscribe.mockReset();
    mockPush.unsubscribe.mockReset();
    mockPwa.listener = null;
    mockPwa.state = {
      ready: true,
      isStandalone: true,
      isIOS: true,
      registration: null,
      updateAvailable: false,
      installPromptEvent: null,
    };

    Object.defineProperty(window, 'Notification', {
      configurable: true,
      value: {
        permission: 'default',
        requestPermission: vi.fn().mockResolvedValue('granted'),
      },
    });
  });

  it('shows the notification permission sheet on first standalone entry after install', async () => {
    render(<PushPermissionPrompt />);

    await waitFor(() => {
      expect(screen.getByRole('dialog', { name: 'Notificações Push' })).toBeInTheDocument();
    });
  });

  it('shows a CRM Plus notification permission sheet in the CRM PWA', async () => {
    window.history.replaceState(null, '', '/#/crmplus');

    render(<PushPermissionPrompt />);

    await waitFor(() => {
      expect(screen.getByRole('dialog', { name: 'Notificações Push do CRM Plus' })).toBeInTheDocument();
      expect(screen.getByText(/mensagens e leads do CRM/i)).toBeInTheDocument();
    });
  });

  it('does not suppress the CRM Plus sheet when the main app prompt was dismissed', async () => {
    localStorage.setItem('push.permission.prompt.dismissed.at.app', String(Date.now()));
    window.history.replaceState(null, '', '/#/crmplus');

    render(<PushPermissionPrompt />);

    await waitFor(() => {
      expect(screen.getByRole('dialog', { name: 'Notificações Push do CRM Plus' })).toBeInTheDocument();
    });
  });

  it('opens when the app becomes standalone after installation while permission is still default', async () => {
    mockPwa.state = {
      ...mockPwa.state,
      isStandalone: false,
    };

    render(<PushPermissionPrompt />);

    expect(screen.queryByRole('dialog', { name: 'Notificações Push' })).not.toBeInTheDocument();

    mockPwa.state = {
      ...mockPwa.state,
      isStandalone: true,
    };

    act(() => {
      mockPwa.listener?.();
    });

    await waitFor(() => {
      expect(screen.getByRole('dialog', { name: 'Notificações Push' })).toBeInTheDocument();
    });
  });

  it('requests the native notification permission when the user taps continue', async () => {
    const user = userEvent.setup();

    render(<PushPermissionPrompt />);

    await user.click(await screen.findByRole('button', { name: 'Continuar' }));

    expect(window.Notification.requestPermission).toHaveBeenCalledTimes(1);
    await waitFor(() => {
      expect(mockPush.subscribe).toHaveBeenCalledWith(undefined, undefined, 'granted');
    });
  });

  it('subscribes only to CRM topics from the CRM Plus prompt', async () => {
    const user = userEvent.setup();
    window.history.replaceState(null, '', '/#/crmplus');

    render(<PushPermissionPrompt />);

    await user.click(await screen.findByRole('button', { name: 'Continuar' }));

    await waitFor(() => {
      expect(mockPush.subscribe).toHaveBeenCalledWith(['crm_inbox', 'new_lead'], undefined, 'granted');
    });
  });

  it('keeps the sheet open and does not subscribe when native permission remains default', async () => {
    const user = userEvent.setup();
    vi.mocked(window.Notification.requestPermission).mockResolvedValue('default');

    render(<PushPermissionPrompt />);

    await user.click(await screen.findByRole('button', { name: 'Continuar' }));

    expect(window.Notification.requestPermission).toHaveBeenCalledTimes(1);
    expect(mockPush.subscribe).not.toHaveBeenCalled();
    expect(screen.getByRole('dialog', { name: 'Notificações Push' })).toBeInTheDocument();
  });

  it('does not request native notification permission before iOS standalone install', () => {
    mockPush.status = 'needs_install';
    mockPwa.state = {
      ...mockPwa.state,
      isIOS: true,
      isStandalone: false,
    };

    render(<PushPermissionPrompt />);

    expect(screen.queryByRole('dialog', { name: /Notificações Push/i })).not.toBeInTheDocument();
    expect(window.Notification.requestPermission).not.toHaveBeenCalled();
    expect(mockPush.subscribe).not.toHaveBeenCalled();
  });
});
