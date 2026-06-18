import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import PushOptIn from './PushOptIn';

const mockPush = vi.hoisted(() => ({
  status: 'default',
  subscribe: vi.fn(),
  updateTopics: vi.fn(),
  unsubscribe: vi.fn(),
}));

vi.mock('../../hooks/usePushNotifications', () => ({
  usePushNotifications: vi.fn(() => ({
    status: mockPush.status,
    platform: 'ios',
    subscribe: mockPush.subscribe,
    updateTopics: mockPush.updateTopics,
    unsubscribe: mockPush.unsubscribe,
  })),
}));

vi.mock('../../services/dataContext', () => ({
  useData: vi.fn(() => ({
    stores: [{ id: 'store-1' }],
  })),
}));

vi.mock('../../services/pushClient', () => ({
  getCachedTopics: vi.fn(() => ['sale', 'new_lead']),
}));

describe('PushOptIn', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPush.status = 'default';
    mockPush.subscribe.mockResolvedValue(undefined);
    mockPush.updateTopics.mockResolvedValue(true);
    mockPush.unsubscribe.mockResolvedValue(undefined);

    Object.defineProperty(window, 'Notification', {
      configurable: true,
      value: {
        permission: 'default',
        requestPermission: vi.fn().mockResolvedValue('granted'),
      },
    });
  });

  it('renders a manual toggle switch in the settings card and opens the pre-permission sheet before native permission', async () => {
    const user = userEvent.setup();

    render(<PushOptIn variant="card" />);

    const toggle = screen.getByRole('switch', { name: /notificações push/i });
    expect(toggle).toHaveAttribute('aria-checked', 'false');

    await user.click(toggle);

    expect(window.Notification.requestPermission).not.toHaveBeenCalled();
    expect(screen.getByRole('dialog', { name: /notificações push/i })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Continuar' }));

    await waitFor(() => {
      expect(mockPush.subscribe).toHaveBeenCalledWith(['sale', 'new_lead'], 'store-1', 'granted');
    });
  });

  it('uses the settings card toggle to unsubscribe when notifications are active', async () => {
    const user = userEvent.setup();
    mockPush.status = 'subscribed';

    render(<PushOptIn variant="card" />);

    const toggle = screen.getByRole('switch', { name: /notificações push/i });
    expect(toggle).toHaveAttribute('aria-checked', 'true');

    await user.click(toggle);

    expect(mockPush.unsubscribe).toHaveBeenCalledTimes(1);
  });
});
