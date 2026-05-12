import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
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
  it('finds customer by CPF digits without mask', () => {
    render(<Clients />);

    fireEvent.change(screen.getByPlaceholderText('Buscar por nome, CPF, telefone ou email...'), {
      target: { value: '05703430380' },
    });

    expect(screen.getAllByText('FRANCISCO KECIO JOHN AGUIAR MACHADO').length).toBeGreaterThan(0);
  });

  it('finds customer by phone digits without mask', () => {
    render(<Clients />);

    fireEvent.change(screen.getByPlaceholderText('Buscar por nome, CPF, telefone ou email...'), {
      target: { value: '88996275279' },
    });

    expect(screen.getAllByText('FRANCISCO KECIO JOHN AGUIAR MACHADO').length).toBeGreaterThan(0);
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
