import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DEFAULT_CARD_FEE_SETTINGS } from '../utils/cardFees';
import { Condition, DeviceType, StockStatus, WarrantyType, type StockItem } from '../types';
import { StockSimulatorModal } from './StockSimulatorModal';

const toastMock = {
  success: vi.fn(),
  error: vi.fn(),
  info: vi.fn(),
  warning: vi.fn(),
};
let writeTextMock: ReturnType<typeof vi.fn>;

vi.mock('./ui/ToastProvider', () => ({
  useToast: () => toastMock,
}));

const stockItem: StockItem = {
  id: 'stock-1',
  type: DeviceType.IPHONE,
  model: 'iPhone 17 Pro Max',
  capacity: '512GB',
  color: 'Azul',
  imei: '123456789012345',
  condition: Condition.NEW,
  status: StockStatus.AVAILABLE,
  storeId: 'store-1',
  purchasePrice: 8000,
  sellPrice: 9950,
  maxDiscount: 0,
  warrantyType: WarrantyType.STORE,
  costs: [],
  photos: [],
  entryDate: '2026-06-03',
};

const tradeInValues = [
  {
    id: 'value-1',
    model: 'iPhone 15 Pro Max',
    capacity: '256GB',
    baseValue: 4100,
    isActive: true,
    createdAt: '2026-06-03T12:00:00.000Z',
    updatedAt: '2026-06-03T12:00:00.000Z',
  },
];

const tradeInAdjustments = [
  {
    id: 'adj-1',
    label: 'Marcas de uso',
    model: 'iPhone 15 Pro Max',
    capacity: null,
    amountDelta: -500,
    isActive: true,
    createdAt: '2026-06-03T12:00:00.000Z',
    updatedAt: '2026-06-03T12:00:00.000Z',
  },
];

const renderSimulator = () => render(
  <StockSimulatorModal
    open
    onClose={vi.fn()}
    item={stockItem}
    simulatorTradeInValues={tradeInValues}
    simulatorTradeInAdjustments={tradeInAdjustments}
    cardFeeSettings={DEFAULT_CARD_FEE_SETTINGS}
  />,
);

const pinClipboardMock = () => {
  Object.defineProperty(navigator, 'clipboard', {
    configurable: true,
    value: {
      writeText: writeTextMock,
    },
  });
};

describe('StockSimulatorModal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    writeTextMock = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: {
        writeText: writeTextMock,
      },
    });
    window.open = vi.fn();
  });

  it('opens in Dados and advances to Parcelas with 18x selected by default', async () => {
    const user = userEvent.setup({ writeToClipboard: false });
    pinClipboardMock();
    renderSimulator();

    expect(screen.getByRole('button', { name: /Dados/i })).toHaveAttribute('aria-current', 'step');

    await user.click(screen.getByRole('button', { name: /Continuar/i }));

    expect(screen.getByRole('button', { name: /Parcelas/i })).toHaveAttribute('aria-current', 'step');
    expect(screen.getByLabelText('Enviar até')).toHaveValue(18);
    expect(screen.getByText('18 parcela(s) na mensagem')).toBeInTheDocument();
  });

  it('copies only installments from 1x to the selected limit', async () => {
    const user = userEvent.setup({ writeToClipboard: false });
    pinClipboardMock();
    renderSimulator();

    await user.click(screen.getByRole('button', { name: /Continuar/i }));
    await user.clear(screen.getByLabelText('Enviar até'));
    await user.type(screen.getByLabelText('Enviar até'), '12');
    await user.click(screen.getByRole('button', { name: /Continuar/i }));
    await user.click(screen.getByRole('button', { name: /Copiar para CRM/i }));

    const copied = String(writeTextMock.mock.calls[0][0]);
    expect(copied).toContain('*12x*');
    expect(copied).not.toContain('*13x*');
  });

  it('opens WhatsApp with filtered installments when saída is WhatsApp', async () => {
    const user = userEvent.setup({ writeToClipboard: false });
    pinClipboardMock();
    renderSimulator();

    await user.selectOptions(screen.getByLabelText('Saída'), 'whatsapp');
    await user.click(screen.getByRole('button', { name: /Continuar/i }));
    await user.clear(screen.getByLabelText('Enviar até'));
    await user.type(screen.getByLabelText('Enviar até'), '12');
    await user.click(screen.getByRole('button', { name: /Continuar/i }));
    await user.click(screen.getByRole('button', { name: /Abrir WhatsApp/i }));

    expect(window.open).toHaveBeenCalledWith(expect.stringContaining('https://wa.me/?text='), '_blank', 'noopener,noreferrer');
    const openedUrl = String(vi.mocked(window.open).mock.calls[0][0]);
    const message = decodeURIComponent(openedUrl.replace('https://wa.me/?text=', ''));
    expect(message).toContain('*12x*');
    expect(message).not.toContain('*13x*');
  });
});
