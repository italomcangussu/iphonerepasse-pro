import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import PermissionRequest from './PermissionRequest';

describe('PermissionRequest', () => {
  it('describes the photo picker without claiming full library access', async () => {
    const user = userEvent.setup();
    const onAllow = vi.fn();

    render(
      <PermissionRequest
        permission="photos"
        open
        allowLabel="Escolher fotos e vídeos"
        onAllow={onAllow}
        onDeny={vi.fn()}
      />
    );

    expect(screen.getByText(/somente.*escolher/i)).toBeInTheDocument();
    expect(screen.queryByText(/precisa acessar sua biblioteca/i)).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Escolher fotos e vídeos' }));

    expect(onAllow).toHaveBeenCalledOnce();
  });

  it('requests native notification permission only from the primary action', async () => {
    const user = userEvent.setup();
    const onAllow = vi.fn();
    const requestPermission = vi.fn().mockResolvedValue('granted');
    Object.defineProperty(window, 'Notification', {
      configurable: true,
      value: { permission: 'default', requestPermission },
    });

    render(
      <PermissionRequest
        permission="notifications"
        open
        onAllow={onAllow}
        onDeny={vi.fn()}
      />
    );

    expect(requestPermission).not.toHaveBeenCalled();
    await user.click(screen.getByRole('button', { name: 'Continuar' }));
    expect(requestPermission).toHaveBeenCalledOnce();
    expect(onAllow).toHaveBeenCalledWith('granted');
  });
});
