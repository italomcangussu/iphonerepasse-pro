import { act, render, screen, waitFor } from '@testing-library/react';
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
  });

  it('shows the notification permission sheet on first standalone entry after install', async () => {
    render(<PushPermissionPrompt />);

    await waitFor(() => {
      expect(screen.getByRole('dialog', { name: 'Notificações Push' })).toBeInTheDocument();
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
});
