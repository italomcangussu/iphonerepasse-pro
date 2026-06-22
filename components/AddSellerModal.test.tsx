import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { AddSellerModal } from './AddSellerModal';

const toastMock = {
  success: vi.fn(),
  error: vi.fn(),
  info: vi.fn(),
  warning: vi.fn(),
  confirm: vi.fn(),
  dismiss: vi.fn(),
  clear: vi.fn(),
};

vi.mock('./ui/ToastProvider', () => ({ useToast: () => toastMock }));
vi.mock('../services/dataContext', () => ({ useData: () => ({ refreshData: vi.fn() }) }));
vi.mock('../services/adminProvision', () => ({ adminProvisionUser: vi.fn() }));

describe('AddSellerModal', () => {
  it('shows missing required fields inline instead of toast', async () => {
    render(<AddSellerModal open onClose={vi.fn()} onSellerAdded={vi.fn()} />);

    await userEvent.click(screen.getByRole('button', { name: /cadastrar vendedor/i }));

    expect(screen.getByRole('alert')).toHaveTextContent('Informe nome, e-mail e senha inicial.');
    expect(screen.getByLabelText(/nome do vendedor/i)).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByLabelText(/email de acesso/i)).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByLabelText(/senha inicial/i)).toHaveAttribute('aria-invalid', 'true');
    expect(toastMock.error).not.toHaveBeenCalledWith('Nome e email são obrigatórios');
  });
});
