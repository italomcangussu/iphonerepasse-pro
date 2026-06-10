import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Condition, DeviceType, StockStatus, WarrantyType } from '../../types';
import SimulatorPage from './SimulatorPage';

const useDataMock = vi.fn();
const useAuthMock = vi.fn();
const toastMock = {
  success: vi.fn(),
  error: vi.fn(),
  info: vi.fn(),
};
const updateSimulatorTradeInValueMock = vi.fn();
const removeSimulatorTradeInValueMock = vi.fn();

vi.mock('../../services/dataContext', () => ({
  useData: () => useDataMock(),
}));

vi.mock('../../contexts/AuthContext', () => ({
  useAuth: () => useAuthMock(),
}));

vi.mock('../../components/ui/ToastProvider', () => ({
  useToast: () => toastMock,
}));

describe('CRM SimulatorPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: {
        writeText: vi.fn().mockResolvedValue(undefined),
      }
    });
    useAuthMock.mockReturnValue({ role: 'seller' });
    useDataMock.mockReturnValue({
      stock: [
        {
          id: 'stk-1',
          type: DeviceType.IPHONE,
          model: 'iPhone 17 Pro Max',
          capacity: '512GB',
          color: 'Azul',
          imei: '123',
          condition: Condition.NEW,
          status: StockStatus.AVAILABLE,
          storeId: 'store-1',
          purchasePrice: 8000,
          sellPrice: 9950,
          maxDiscount: 0,
          warrantyType: WarrantyType.STORE,
          costs: [],
          photos: [],
          entryDate: '2026-05-28',
        },
      ],
      simulatorTradeInValues: [
        {
          id: 'value-1',
          model: 'iPhone 15 Pro Max',
          capacity: '256GB',
          baseValue: 4100,
          isActive: true,
          createdAt: '2026-05-28T12:00:00.000Z',
          updatedAt: '2026-05-28T12:00:00.000Z',
        },
      ],
      simulatorTradeInAdjustments: [
        {
          id: 'adj-1',
          label: 'Marcas de uso na lateral',
          model: 'iPhone 15 Pro Max',
          capacity: null,
          amountDelta: -500,
          isActive: true,
          createdAt: '2026-05-28T12:00:00.000Z',
          updatedAt: '2026-05-28T12:00:00.000Z',
        },
      ],
      cardFeeSettings: {
        visaMasterRates: [2.99, 4.09, 4.78, 5.47, 6.14, 6.81, 7.67, 8.33, 8.98, 9.63, 10.26, 10.9, 12.32, 12.94, 13.56, 14.17, 14.77, 15.37],
        otherRates: [3.99, 5.3, 5.99, 6.68, 7.35, 8.02, 9.47, 10.13, 10.78, 11.43, 12.06, 12.7, 13.32, 13.94, 14.56, 15.17, 15.77, 16.37],
        debitRate: 1.87,
      },
      upsertSimulatorTradeInValue: vi.fn(),
      updateSimulatorTradeInValue: updateSimulatorTradeInValueMock,
      removeSimulatorTradeInValue: removeSimulatorTradeInValueMock,
      upsertSimulatorTradeInAdjustment: vi.fn(),
      updateSimulatorTradeInAdjustment: vi.fn(),
      removeSimulatorTradeInAdjustment: vi.fn(),
    });
  });

  it('calculates a stock trade-in simulation with entries and copies the message', async () => {
    const user = userEvent.setup({ writeToClipboard: false });
    render(<SimulatorPage />);

    await user.selectOptions(screen.getByLabelText('Aparelho do estoque'), 'stk-1');
    await user.selectOptions(screen.getByLabelText('Modelo do trade-in'), 'iPhone 15 Pro Max');
    await user.selectOptions(screen.getByLabelText('Armazenamento'), '256GB');
    await user.type(screen.getByLabelText('Cor do trade-in'), 'Branco');
    await user.click(screen.getByLabelText('Marcas de uso na lateral'));
    await user.type(screen.getByLabelText('Valor da entrada'), '1000');
    await user.click(screen.getByRole('button', { name: 'Adicionar entrada' }));

    expect(screen.getByText(/5\.350,00/)).toBeInTheDocument();
    expect(screen.getByText('1x')).toBeInTheDocument();
    expect(screen.getAllByText(/iPhone 17 Pro Max 512GB Azul/).length).toBeGreaterThan(0);

    await user.click(screen.getByRole('button', { name: /Copiar mensagem/i }));
    expect(toastMock.success).toHaveBeenCalled();
  });

  it('allows copying a stock simulation without trade-in', async () => {
    const user = userEvent.setup({ writeToClipboard: false });
    render(<SimulatorPage />);

    await user.selectOptions(screen.getByLabelText('Aparelho do estoque'), 'stk-1');

    expect(screen.getByText(/9\.950,00/)).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /Copiar mensagem/i }));
    expect(toastMock.success).toHaveBeenCalled();
  });

  it('configures a payment revision with two cards', async () => {
    const user = userEvent.setup();
    render(<SimulatorPage />);

    await user.selectOptions(screen.getByLabelText('Aparelho do estoque'), 'stk-1');
    await user.click(screen.getByRole('checkbox', { name: 'Dividir em dois cartões' }));

    expect(screen.getByLabelText('Parcelas da divisão')).toBeInTheDocument();
    expect(screen.getByLabelText('Bandeira do cartão 1')).toBeInTheDocument();
    expect(screen.getByLabelText('Valor do cartão 1')).toBeInTheDocument();
    expect(screen.getByLabelText('Bandeira do cartão 2')).toBeInTheDocument();
    expect(screen.getByLabelText('Valor do cartão 2')).toBeInTheDocument();
    expect(screen.getByText(/Valor líquido financiado/i)).toBeInTheDocument();
    expect(screen.getByText(/Total com taxa/i)).toBeInTheDocument();
  });

  it('shows the admin configuration tab only for admins', async () => {
    const user = userEvent.setup();
    const { rerender } = render(<SimulatorPage />);
    expect(screen.queryByRole('button', { name: 'Configurações' })).not.toBeInTheDocument();

    useAuthMock.mockReturnValue({ role: 'admin' });
    rerender(<SimulatorPage />);

    await user.click(screen.getByRole('button', { name: 'Configurações' }));
    const configPanel = screen.getByTestId('simulator-admin-config');
    expect(within(configPanel).getByText(/iPhone 15 Pro Max/)).toBeInTheDocument();
  });

  it('allows admins to edit and delete base device values', async () => {
    const user = userEvent.setup();
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    useAuthMock.mockReturnValue({ role: 'admin' });

    render(<SimulatorPage />);

    const configPanel = screen.getByTestId('simulator-admin-config');
    await user.click(within(configPanel).getByRole('button', { name: 'Editar valor iPhone 15 Pro Max 256GB' }));

    await user.clear(screen.getByLabelText('Modelo do valor base'));
    await user.type(screen.getByLabelText('Modelo do valor base'), 'iPhone 15 Pro');
    await user.clear(screen.getByLabelText('Armazenamento do valor base'));
    await user.type(screen.getByLabelText('Armazenamento do valor base'), '128GB');
    await user.clear(screen.getByLabelText('Valor base'));
    await user.type(screen.getByLabelText('Valor base'), '3300');
    await user.click(screen.getByRole('button', { name: 'Salvar edição do valor base' }));

    expect(updateSimulatorTradeInValueMock).toHaveBeenCalledWith('value-1', {
      model: 'iPhone 15 Pro',
      capacity: '128GB',
      baseValue: 3300,
    });
    expect(toastMock.success).toHaveBeenCalledWith('Valor atualizado.');

    await user.click(within(configPanel).getByRole('button', { name: 'Excluir valor iPhone 15 Pro Max 256GB' }));

    expect(window.confirm).toHaveBeenCalledWith('Excluir o valor base de iPhone 15 Pro Max 256GB?');
    expect(removeSimulatorTradeInValueMock).toHaveBeenCalledWith('value-1');
    expect(toastMock.success).toHaveBeenCalledWith('Valor excluído.');
  });
});
