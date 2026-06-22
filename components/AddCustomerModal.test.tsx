import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { AddCustomerModal } from './AddCustomerModal';

const toastMock = {
  success: vi.fn(),
  error: vi.fn(),
  info: vi.fn(),
  warning: vi.fn(),
  confirm: vi.fn(),
  dismiss: vi.fn(),
  clear: vi.fn(),
};

const addCustomerMock = vi.fn();

vi.mock('./ui/ToastProvider', () => ({ useToast: () => toastMock }));
vi.mock('../services/dataContext', () => ({ useData: () => ({ addCustomer: addCustomerMock }) }));

describe('AddCustomerModal', () => {
  it('shows required name validation inline instead of toast', async () => {
    render(<AddCustomerModal open onClose={vi.fn()} onCustomerAdded={vi.fn()} />);

    await userEvent.click(screen.getByRole('button', { name: /cadastrar cliente/i }));

    expect(screen.getByRole('alert')).toHaveTextContent('Informe o nome completo do cliente.');
    expect(screen.getByLabelText(/nome completo/i)).toHaveAttribute('aria-invalid', 'true');
    expect(toastMock.error).not.toHaveBeenCalledWith('Nome é obrigatório.');
  });
});
