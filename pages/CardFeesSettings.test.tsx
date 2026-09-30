import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import CardFeesSettings from './CardFeesSettings';

const updateCardFeeSettingsMock = vi.fn();
const useDataMock = vi.fn();
const useAuthMock = vi.fn();
const toastSuccessMock = vi.fn();
const toastErrorMock = vi.fn();

vi.mock('../services/dataContext', () => ({
  useData: () => useDataMock(),
}));

vi.mock('../contexts/AuthContext', () => ({
  useAuth: () => useAuthMock(),
}));

vi.mock('../components/ui/ToastProvider', () => ({
  useToast: () => ({
    success: toastSuccessMock,
    error: toastErrorMock,
    info: vi.fn(),
    dismiss: vi.fn(),
    clear: vi.fn(),
  }),
}));

const mockCardFeeSettings = {
  visaMasterRates: [
    3.5, 4.2, 5.1, 6.0, 6.9, 7.8, 8.7, 9.6, 10.5, 11.4, 12.3, 13.2, 14.1, 15.0, 15.9, 16.8, 17.7, 18.6,
  ],
  otherRates: [
    4.5, 5.2, 6.1, 7.0, 7.9, 8.8, 9.7, 10.6, 11.5, 12.4, 13.3, 14.2, 15.1, 16.0, 16.9, 17.8, 18.7, 19.6,
  ],
  debitRate: 1.87,
};

describe('CardFeesSettings - cognição e digitação decimal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useAuthMock.mockReturnValue({ role: 'admin' });
    useDataMock.mockReturnValue({
      cardFeeSettings: mockCardFeeSettings,
      updateCardFeeSettings: updateCardFeeSettingsMock,
    });
  });

  it('renders initial rates formatted with pt-BR comma', () => {
    render(<CardFeesSettings />);

    // 1x rate in visa_master is 3.5 -> "3,50"
    const firstRateInput = screen.getByLabelText('Taxa 1x (%)');
    expect(firstRateInput).toHaveValue('3,50');
    expect(screen.getByText('Acréscimo de 3,50%')).toBeInTheDocument();
  });

  it('allows typing comma without resetting to 0 or losing the comma', () => {
    render(<CardFeesSettings />);

    // Switch to debit tab
    fireEvent.click(screen.getByRole('tab', { name: /Cartão Débito/i }));

    const debitInput = screen.getByLabelText(/Taxa do cartão de débito/i);
    expect(debitInput).toHaveValue('1,87');
    expect(screen.getByText('Acréscimo de 1,87%')).toBeInTheDocument();

    // User types "2,"
    fireEvent.change(debitInput, { target: { value: '2,' } });
    expect(debitInput).toHaveValue('2,');
    expect(screen.queryByText('Acréscimo de 0,00%')).not.toBeInTheDocument();

    // User continues typing "45"
    fireEvent.change(debitInput, { target: { value: '2,45' } });
    expect(debitInput).toHaveValue('2,45');
    expect(screen.getByText('Acréscimo de 2,45%')).toBeInTheDocument();
  });

  it('converts dots to commas automatically when typed', () => {
    render(<CardFeesSettings />);

    fireEvent.click(screen.getByRole('tab', { name: /Cartão Débito/i }));
    const debitInput = screen.getByLabelText(/Taxa do cartão de débito/i);

    fireEvent.change(debitInput, { target: { value: '3.15' } });
    expect(debitInput).toHaveValue('3,15');
    expect(screen.getByText('Acréscimo de 3,15%')).toBeInTheDocument();
  });

  it('saves rates as numbers with two decimal places', async () => {
    updateCardFeeSettingsMock.mockResolvedValue(undefined);
    render(<CardFeesSettings />);

    fireEvent.click(screen.getByRole('tab', { name: /Cartão Débito/i }));
    const debitInput = screen.getByLabelText(/Taxa do cartão de débito/i);
    fireEvent.change(debitInput, { target: { value: '2,15' } });

    const saveButton = screen.getByRole('button', { name: /Salvar taxas/i });
    fireEvent.click(saveButton);

    await waitFor(() => {
      expect(updateCardFeeSettingsMock).toHaveBeenCalledWith(
        expect.objectContaining({
          debitRate: 2.15,
        })
      );
      expect(toastSuccessMock).toHaveBeenCalledWith('Taxas atualizadas com sucesso.');
    });
  });

  it('restores default rates when requested', () => {
    render(<CardFeesSettings />);

    fireEvent.click(screen.getByRole('tab', { name: /Cartão Débito/i }));
    const debitInput = screen.getByLabelText(/Taxa do cartão de débito/i);
    fireEvent.change(debitInput, { target: { value: '9,99' } });
    expect(debitInput).toHaveValue('9,99');

    fireEvent.click(screen.getByRole('button', { name: /Restaurar padrão/i }));
    // default debit rate is 1.87
    expect(debitInput).toHaveValue('1,87');
  });
});
