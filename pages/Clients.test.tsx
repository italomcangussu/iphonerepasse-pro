import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import Clients from './Clients';

vi.mock('../services/dataContext', () => ({
  useData: () => ({
    customers: [
      {
        id: 'cust-null',
        name: null,
        cpf: null,
        phone: null,
        email: null,
        birthDate: null,
        purchases: null,
        totalSpent: null
      }
    ],
    sales: [],
    addCustomer: vi.fn(),
    updateCustomer: vi.fn()
  })
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
  it('renders when customer rows contain null optional fields', () => {
    render(<Clients />);

    expect(screen.getByRole('heading', { name: 'Clientes' })).toBeInTheDocument();
    expect(screen.getAllByText('Cliente sem nome').length).toBeGreaterThan(0);
    expect(screen.getByText('0 compras')).toBeInTheDocument();
  });
});
