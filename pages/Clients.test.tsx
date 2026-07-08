import { fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import Clients from './Clients';

const addCustomerMock = vi.fn();
const updateCustomerMock = vi.fn();

const mockCustomers = [
  {
    id: 'cust-null',
    name: null,
    cpf: null,
    phone: null,
    email: null,
    birthDate: null,
    purchases: null,
    totalSpent: null,
  },
  {
    id: 'cust-1',
    name: 'FRANCISCO KECIO JOHN AGUIAR MACHADO',
    cpf: '057.034.303-80',
    phone: '(88) 99627-5279',
    alternativePhone: '(88) 98888-0000',
    email: 'keciojonh_rc@hotmail.com',
    birthDate: '',
    purchases: 2,
    totalSpent: 1200,
  },
];

vi.mock('../services/dataContext', () => ({
  useData: () => ({
    customers: mockCustomers,
    sales: [],
    addCustomer: addCustomerMock,
    updateCustomer: updateCustomerMock,
  }),
}));

vi.mock('../components/ui/ToastProvider', () => ({
  useToast: () => ({
    success: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
    dismiss: vi.fn(),
    clear: vi.fn()
  })
}));

describe('Clients', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('finds customer by CPF digits without mask', () => {
    render(<Clients />);

    fireEvent.change(screen.getByPlaceholderText('Buscar por nome, CPF/CNPJ, telefone ou email...'), {
      target: { value: '05703430380' },
    });

    expect(screen.getAllByText('FRANCISCO KECIO JOHN AGUIAR MACHADO').length).toBeGreaterThan(0);
  });

  it('finds customer by phone digits without mask', () => {
    render(<Clients />);

    fireEvent.change(screen.getByPlaceholderText('Buscar por nome, CPF/CNPJ, telefone ou email...'), {
      target: { value: '88996275279' },
    });

    expect(screen.getAllByText('FRANCISCO KECIO JOHN AGUIAR MACHADO').length).toBeGreaterThan(0);
  });

  it('finds customer by alternative phone digits without mask', () => {
    render(<Clients />);

    fireEvent.change(screen.getByPlaceholderText('Buscar por nome, CPF/CNPJ, telefone ou email...'), {
      target: { value: '88988880000' },
    });

    expect(screen.getAllByText('FRANCISCO KECIO JOHN AGUIAR MACHADO').length).toBeGreaterThan(0);
  });

  it('creates customer with CNPJ and alternative phone', async () => {
    addCustomerMock.mockResolvedValueOnce(undefined);
    const user = userEvent.setup();
    render(<Clients />);

    await user.click(screen.getByRole('button', { name: 'Novo Cliente' }));
    const dialog = screen.getByRole('dialog', { name: 'Novo Cliente' });

    fireEvent.change(within(dialog).getByLabelText(/nome completo/i), {
      target: { value: 'Cliente Empresa' },
    });
    fireEvent.change(within(dialog).getByLabelText(/cpf\/cnpj/i), {
      target: { value: '12345678000195' },
    });
    fireEvent.change(within(dialog).getByLabelText(/^telefone$/i), {
      target: { value: '85999990000' },
    });
    fireEvent.change(within(dialog).getByLabelText(/telefone alternativo/i), {
      target: { value: '88988880000' },
    });

    await user.click(screen.getByRole('button', { name: 'Salvar Cliente' }));

    expect(addCustomerMock).toHaveBeenCalledWith(expect.objectContaining({
      name: 'CLIENTE EMPRESA',
      cpf: '12.345.678/0001-95',
      phone: '(85) 99999-0000',
      alternativePhone: '(88) 98888-0000',
    }));
  });

  it('opens duplicate modal with existing customer details before saving', () => {
    render(<Clients />);

    fireEvent.click(screen.getByRole('button', { name: 'Novo Cliente' }));
    const dialog = screen.getByRole('dialog');
    const modalInputs = dialog.querySelectorAll('input');
    fireEvent.change(modalInputs[0], {
      target: { value: 'FRANCISCO KECIO JOHN AGUIAR MACHADO' },
    });
    fireEvent.change(modalInputs[1], {
      target: { value: '057.034.303-80' },
    });
    fireEvent.change(modalInputs[3], {
      target: { value: '(88) 99627-5279' },
    });

    fireEvent.click(screen.getByRole('button', { name: 'Salvar Cliente' }));

    expect(screen.getByRole('heading', { name: 'Cliente duplicado' })).toBeInTheDocument();
    expect(screen.getAllByText('FRANCISCO KECIO JOHN AGUIAR MACHADO').length).toBeGreaterThan(0);
    expect(screen.getAllByText('057.034.303-80').length).toBeGreaterThan(0);
    expect(addCustomerMock).not.toHaveBeenCalled();
  });

  it('renders when customer rows contain null optional fields', () => {
    render(<Clients />);

    expect(screen.getByRole('heading', { name: 'Clientes' })).toBeInTheDocument();
    expect(screen.getAllByText('Cliente sem nome').length).toBeGreaterThan(0);
    expect(screen.getByText('0 compras')).toBeInTheDocument();
  });
});
