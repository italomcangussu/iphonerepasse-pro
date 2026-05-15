import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import Calculator from './Calculator';

const toastInfoMock = vi.fn();
const toastSuccessMock = vi.fn();
const toastErrorMock = vi.fn();

vi.mock('../components/ui/ToastProvider', () => ({
  useToast: () => ({
    info: toastInfoMock,
    success: toastSuccessMock,
    error: toastErrorMock,
    confirm: vi.fn(),
    dismiss: vi.fn(),
    clear: vi.fn()
  })
}));

describe('Calculator page', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.localStorage.clear();
  });

  it('simulates the 1x Visa/Master installment from the desired net amount', async () => {
    const user = userEvent.setup();

    render(<Calculator />);

    await user.type(screen.getByLabelText('Valor da Venda (Quero Receber)'), '1000');

    expect(screen.getByRole('heading', { name: /Calculadora de Taxas/i })).toBeInTheDocument();
    expect(screen.getAllByText('R$ 1.030,82').length).toBeGreaterThan(0);
  });

  it('updates the simulation when switching to Elo/Hiper rates', async () => {
    const user = userEvent.setup();

    render(<Calculator />);

    await user.type(screen.getByLabelText('Valor da Venda (Quero Receber)'), '1000');
    await user.click(screen.getByRole('button', { name: /Elo \/ Hiper/i }));

    expect(screen.getAllByText('R$ 1.041,56').length).toBeGreaterThan(0);
  });

  it('shows feedback when copying without an amount', async () => {
    const user = userEvent.setup();

    render(<Calculator />);

    await user.click(screen.getByRole('button', { name: 'Copiar texto' }));

    expect(toastInfoMock).toHaveBeenCalledWith('Informe um valor para gerar a simulação.');
  });
});
