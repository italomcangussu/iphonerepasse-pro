import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Condition, DeviceType, StockStatus, WarrantyType } from '../../types';
import SimulatorPage from './SimulatorPage';

const CRM_SIMULATOR_FLOW_TIMEOUT_MS = 45_000;

vi.setConfig({ testTimeout: CRM_SIMULATOR_FLOW_TIMEOUT_MS });

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

const setupSimulatorMocks = () => {
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
};

describe('CRM SimulatorPage', () => {
  beforeEach(setupSimulatorMocks);

  it('calculates a stock trade-in simulation with entries and copies the message', async () => {
    const user = userEvent.setup({ writeToClipboard: false });
    render(<SimulatorPage />);

    await user.selectOptions(screen.getByLabelText('Aparelho do estoque'), 'stk-1');
    await user.click(screen.getByRole('button', { name: /Trade-in do cliente/i }));
    await user.selectOptions(screen.getByLabelText('Modelo do trade-in'), 'iPhone 15 Pro Max');
    await user.selectOptions(screen.getByLabelText('Armazenamento'), '256GB');
    await user.type(screen.getByLabelText('Cor do trade-in'), 'Branco');
    await user.click(screen.getByRole('checkbox', { name: 'Marcas de uso na lateral' }));
    await user.type(screen.getByRole('textbox', { name: /Valor da entrada/i }), '1000');
    await user.click(screen.getByRole('button', { name: 'Adicionar entrada' }));

    expect(screen.getAllByText(/5\.350,00/).length).toBeGreaterThan(0);
    expect(screen.getAllByText('1x').length).toBeGreaterThan(0);
    expect(screen.getAllByText(/iPhone 17 Pro Max 512GB Azul/).length).toBeGreaterThan(0);

    await user.click(screen.getByRole('button', { name: /Copiar mensagem/i }));
    expect(toastMock.success).toHaveBeenCalled();
  });

  it('allows copying a stock simulation without trade-in', async () => {
    const user = userEvent.setup({ writeToClipboard: false });
    render(<SimulatorPage />);

    await user.selectOptions(screen.getByLabelText('Aparelho do estoque'), 'stk-1');

    expect(screen.getAllByText(/9\.950,00/).length).toBeGreaterThan(0);

    await user.click(screen.getByRole('button', { name: /Copiar mensagem/i }));
    expect(toastMock.success).toHaveBeenCalled();
  });

  it('configures a payment revision with two cards', async () => {
    const user = userEvent.setup();
    render(<SimulatorPage />);

    await user.selectOptions(screen.getByLabelText('Aparelho do estoque'), 'stk-1');
    await user.click(screen.getByRole('switch', { name: 'Dividir em dois cartões' }));

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
    expect(screen.queryByRole('tab', { name: 'Configurações' })).not.toBeInTheDocument();

    useAuthMock.mockReturnValue({ role: 'admin' });
    rerender(<SimulatorPage />);

    await user.click(screen.getByRole('tab', { name: 'Configurações' }));
    const configPanel = screen.getByTestId('simulator-admin-config');
    expect(within(configPanel).getAllByText(/iPhone 15 Pro Max/).length).toBeGreaterThan(0);
  });

  it('orders default receiving values by iPhone family instead of edit date', async () => {
    const user = userEvent.setup();
    useAuthMock.mockReturnValue({ role: 'admin' });
    useDataMock.mockReturnValue({
      ...useDataMock(),
      simulatorTradeInValues: [
        {
          id: 'value-15-pro',
          model: 'iPhone 15 Pro',
          capacity: '256GB',
          baseValue: 3350,
          isActive: true,
          createdAt: '2026-05-28T12:00:00.000Z',
          updatedAt: '2026-06-10T12:00:00.000Z',
        },
        {
          id: 'value-16',
          model: 'iPhone 16',
          capacity: '128GB',
          baseValue: 3000,
          isActive: true,
          createdAt: '2026-05-28T12:00:00.000Z',
          updatedAt: '2026-05-28T12:00:00.000Z',
        },
        {
          id: 'value-15',
          model: 'iPhone 15',
          capacity: '128GB',
          baseValue: 2600,
          isActive: true,
          createdAt: '2026-05-28T12:00:00.000Z',
          updatedAt: '2026-06-09T12:00:00.000Z',
        },
        {
          id: 'value-15-pro-max',
          model: 'iPhone 15 Pro Max',
          capacity: '256GB',
          baseValue: 4100,
          isActive: true,
          createdAt: '2026-05-28T12:00:00.000Z',
          updatedAt: '2026-06-11T12:00:00.000Z',
        },
      ],
    });

    render(<SimulatorPage />);

    await user.click(screen.getByRole('tab', { name: 'Configurações' }));

    const configPanel = screen.getByTestId('simulator-admin-config');
    const labels = within(configPanel)
      .getAllByRole('button', { name: /^Editar valor/ })
      .map((button) => button.getAttribute('aria-label'));

    expect(labels).toEqual([
      'Editar valor iPhone 16 128GB',
      'Editar valor iPhone 15 128GB',
      'Editar valor iPhone 15 Pro 256GB',
      'Editar valor iPhone 15 Pro Max 256GB',
    ]);
  });

  it('allows admins to edit and delete base device values', async () => {
    const user = userEvent.setup();
    useAuthMock.mockReturnValue({ role: 'admin' });

    render(<SimulatorPage />);

    await user.click(screen.getByRole('tab', { name: 'Configurações' }));

    const configPanel = screen.getByTestId('simulator-admin-config');
    await user.click(within(configPanel).getByRole('button', { name: 'Editar valor iPhone 15 Pro Max 256GB' }));

    await user.clear(screen.getByLabelText('Modelo do valor base'));
    await user.type(screen.getByLabelText('Modelo do valor base'), 'iPhone 15 Pro');
    await user.clear(screen.getByLabelText('Armazenamento do valor base'));
    await user.type(screen.getByLabelText('Armazenamento do valor base'), '128GB');
    const valueInputs = screen.getAllByLabelText('Valor base');
    const editingValueInput = valueInputs[valueInputs.length - 1];
    await user.clear(editingValueInput);
    await user.type(editingValueInput, '3300');
    await user.click(screen.getByRole('button', { name: 'Salvar edição do valor base' }));

    expect(updateSimulatorTradeInValueMock).toHaveBeenCalledWith('value-1', {
      model: 'iPhone 15 Pro',
      capacity: '128GB',
      baseValue: 3300,
    });
    expect(toastMock.success).toHaveBeenCalledWith('Valor atualizado.');

    await user.click(within(configPanel).getByRole('button', { name: 'Excluir valor iPhone 15 Pro Max 256GB' }));

    await user.click(screen.getByRole('button', { name: 'Excluir' }));

    expect(removeSimulatorTradeInValueMock).toHaveBeenCalledWith('value-1');
    expect(toastMock.success).toHaveBeenCalledWith('Valor excluído.');
  });

  it('opens a complete installment preview and returns to the simulator from the top action', async () => {
    const user = userEvent.setup();
    render(<SimulatorPage />);

    await user.selectOptions(screen.getByLabelText('Aparelho do estoque'), 'stk-1');
    await user.click(screen.getByRole('button', { name: 'Pré-visualizar todas as parcelas' }));

    const preview = screen.getByRole('dialog', { name: 'Prévia de parcelas' });
    expect(within(preview).getByText('1x')).toBeInTheDocument();
    expect(within(preview).getByText('18x')).toBeInTheDocument();
    expect(within(preview).getAllByText(/R\$/).length).toBeGreaterThanOrEqual(18);

    await user.click(within(preview).getByRole('button', { name: 'Voltar para simulação' }));

    expect(screen.queryByRole('dialog', { name: 'Prévia de parcelas' })).not.toBeInTheDocument();
  });
});

describe('CRM SimulatorPage — troca com vários aparelhos e aparelho fora do estoque', () => {
  beforeEach(setupSimulatorMocks);

  const tradeInCard = (position: number) => within(screen.getByRole('group', { name: `Aparelho ${position} da troca` }));

  it('soma dois aparelhos na troca, um deles fora da tabela', async () => {
    const user = userEvent.setup({ writeToClipboard: false });
    // userEvent instala o próprio stub de clipboard no setup; o nosso vem depois.
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText } });
    render(<SimulatorPage />);

    await user.selectOptions(screen.getByLabelText('Aparelho do estoque'), 'stk-1');
    await user.click(screen.getByRole('button', { name: /Trade-in do cliente/i }));

    await user.selectOptions(tradeInCard(1).getByLabelText('Modelo do trade-in'), 'iPhone 15 Pro Max');
    await user.selectOptions(tradeInCard(1).getByLabelText('Armazenamento'), '256GB');

    await user.click(screen.getByRole('button', { name: 'Adicionar aparelho' }));
    await user.click(tradeInCard(2).getByRole('tab', { name: 'Fora da tabela' }));
    await user.type(tradeInCard(2).getByLabelText('Modelo do trade-in'), 'Galaxy S23');
    await user.type(tradeInCard(2).getByLabelText('Armazenamento'), '256GB');
    await user.type(tradeInCard(2).getByLabelText('Valor final recebido'), '900');

    expect(tradeInCard(2).getByText('fora da tabela')).toBeInTheDocument();
    expect(screen.getByText('Total da troca')).toBeInTheDocument();

    const result = within(screen.getByLabelText('Resultado da simulação'));
    expect(result.getByText(/2 aparelhos na troca/)).toBeInTheDocument();
    expect(result.getAllByText(/4\.950,00/).length).toBeGreaterThan(0);

    await user.click(screen.getByRole('button', { name: /Copiar mensagem/i }));
    const copied = String(writeText.mock.calls[0][0]);
    expect(copied).toContain('📲 iPhone 15 Pro Max 256GB R$ 4.100,00');
    expect(copied).toContain('📲 Galaxy S23 256GB R$ 900,00');
    expect(copied).toContain('🔁 Total da troca: R$ 5.000,00');
  });

  it('marca a simulação de um aparelho que não existe no estoque', async () => {
    const user = userEvent.setup({ writeToClipboard: false });
    render(<SimulatorPage />);

    await user.click(screen.getByRole('tab', { name: 'Fora do estoque' }));
    await user.type(screen.getByLabelText('Aparelho manual'), 'iPhone 18 Pro 1TB');
    await user.type(screen.getByLabelText('Preço manual'), '12000');

    const result = within(screen.getByLabelText('Resultado da simulação'));
    expect(result.getByText('Fora do estoque')).toBeInTheDocument();
    expect(result.getByText('iPhone 18 Pro 1TB')).toBeInTheDocument();
    expect(result.getAllByText(/12\.000,00/).length).toBeGreaterThan(0);
  });

  it('aponta no card o aparelho da troca que ficou incompleto', async () => {
    const user = userEvent.setup({ writeToClipboard: false });
    render(<SimulatorPage />);

    await user.selectOptions(screen.getByLabelText('Aparelho do estoque'), 'stk-1');
    await user.click(screen.getByRole('button', { name: /Trade-in do cliente/i }));
    await user.selectOptions(tradeInCard(1).getByLabelText('Modelo do trade-in'), 'iPhone 15 Pro Max');

    expect(tradeInCard(1).getByRole('alert')).toHaveTextContent('Informe modelo e armazenamento');
  });
});
