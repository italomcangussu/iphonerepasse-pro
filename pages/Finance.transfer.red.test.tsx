/**
 * RED TESTS (TDD) — Transfers, aportes and cancellations in the Finance flow.
 *
 * These tests describe how account-to-account transfers and direct
 * aportes/withdrawals should behave to keep financial totals honest:
 *
 *   - A transfer is NOT new external capital, so the IN side must not use
 *     the "Aporte" category nor the OUT side use "Serviço". Both should
 *     carry a "Transferência" category (or equivalent) that is excluded
 *     from revenue/expense aggregations.
 *   - The two halves of a transfer must share a stable group id so that
 *     cancelling one half can cascade-cancel the other, otherwise the
 *     accounts go out of balance (phantom money appears or disappears).
 *   - Transfer must reject zero/negative amounts and same-source-target
 *     even when called programmatically through the data context.
 *   - Cancelling either half of a transfer pair must prompt the operator
 *     about the consequence (the other half will be cancelled too).
 *
 * Each test fails today and documents the bug it diagnoses.
 */
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import Finance from './Finance';

const useDataMock = vi.fn();
const toastErrorMock = vi.fn();
const toastSuccessMock = vi.fn();
const toastConfirmMock = vi.fn();
const addTransactionMock = vi.fn();
const updateTransactionMock = vi.fn();
const removeTransactionMock = vi.fn();
const removeDebtMock = vi.fn();

vi.mock('../services/dataContext', () => ({
  useData: () => useDataMock()
}));

vi.mock('../components/ui/ToastProvider', () => ({
  useToast: () => ({
    success: toastSuccessMock,
    error: toastErrorMock,
    info: vi.fn(),
    confirm: toastConfirmMock,
    dismiss: vi.fn(),
    clear: vi.fn()
  })
}));

const baseDataContext = (overrides: Partial<ReturnType<typeof useDataMock>> = {}) => ({
  stock: [],
  transactions: [],
  debts: [],
  debtPayments: [],
  customers: [],
  financialCategories: [
    { id: 'fcat-in-aporte', name: 'Aporte', type: 'IN', isDefault: true, createdAt: '2026-01-01T00:00:00.000Z' },
    { id: 'fcat-out-servico', name: 'Serviço', type: 'OUT', isDefault: true, createdAt: '2026-01-01T00:00:00.000Z' },
    { id: 'fcat-transfer', name: 'Transferência', type: 'IN', isDefault: false, createdAt: '2026-01-01T00:00:00.000Z' }
  ],
  payableDebts: [],
  creditors: [],
  sales: [],
  addTransaction: addTransactionMock,
  updateTransaction: updateTransactionMock,
  removeTransaction: removeTransactionMock,
  removeDebt: removeDebtMock,
  ...overrides
});

const openTransferModal = async (user: ReturnType<typeof userEvent.setup>) => {
  await user.click(screen.getByRole('button', { name: 'Conta Bancária' }));
  await user.click(screen.getByRole('button', { name: /Transferir/i }));
};

const fillTransferAmount = async (user: ReturnType<typeof userEvent.setup>, dialog: HTMLElement, value: string) => {
  const amountInput = within(dialog).getByPlaceholderText('R$ 0,00') as HTMLInputElement;
  await user.clear(amountInput);
  if (value) await user.type(amountInput, value);
};

const fillAporteAmount = async (user: ReturnType<typeof userEvent.setup>, dialog: HTMLElement, value: string) => {
  const amountInput = within(dialog).getByPlaceholderText('0,00') as HTMLInputElement;
  await user.clear(amountInput);
  if (value) await user.type(amountInput, value);
};

describe('Finance transfers, aportes and cancellations — diagnostic RED tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    addTransactionMock.mockResolvedValue(undefined);
    updateTransactionMock.mockResolvedValue(undefined);
    removeTransactionMock.mockResolvedValue(undefined);
    removeDebtMock.mockResolvedValue(undefined);
    toastConfirmMock.mockResolvedValue(true);
    useDataMock.mockReturnValue(baseDataContext());
  });

  // ---------------------------------------------------------------------------
  // 1. Transfer IN side must NOT be category "Aporte"
  // ---------------------------------------------------------------------------
  it('records the credit half of a transfer under a "Transferência" category, not "Aporte"', async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter>
        <Finance />
      </MemoryRouter>
    );

    await openTransferModal(user);
    const dialog = screen.getByRole('dialog');
    await fillTransferAmount(user, dialog, '500');
    await user.click(within(dialog).getByRole('button', { name: /Confirmar Transferência/i }));

    await waitFor(() => {
      expect(addTransactionMock).toHaveBeenCalledTimes(2);
    });
    const inCall = addTransactionMock.mock.calls.find((call) => call[0].type === 'IN')?.[0];
    expect(inCall).toBeDefined();
    // RED: the credit half is currently saved with category "Aporte", which
    // inflates revenue reports by every transfer.
    expect(inCall.category).toBe('Transferência');
    expect(inCall.category).not.toBe('Aporte');
  });

  // ---------------------------------------------------------------------------
  // 2. Transfer OUT side must NOT be category "Serviço"
  // ---------------------------------------------------------------------------
  it('records the debit half of a transfer under a "Transferência" category, not "Serviço"', async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter>
        <Finance />
      </MemoryRouter>
    );

    await openTransferModal(user);
    const dialog = screen.getByRole('dialog');
    await fillTransferAmount(user, dialog, '750');
    await user.click(within(dialog).getByRole('button', { name: /Confirmar Transferência/i }));

    await waitFor(() => {
      expect(addTransactionMock).toHaveBeenCalledTimes(2);
    });
    const outCall = addTransactionMock.mock.calls.find((call) => call[0].type === 'OUT')?.[0];
    expect(outCall).toBeDefined();
    // RED: the debit half is currently saved with category "Serviço", which
    // inflates expense reports by every transfer.
    expect(outCall.category).toBe('Transferência');
    expect(outCall.category).not.toBe('Serviço');
  });

  // ---------------------------------------------------------------------------
  // 3. Both halves of a transfer share a stable group id
  // ---------------------------------------------------------------------------
  it('tags both transfer transactions with the same transferGroupId so they can be cancelled as a pair', async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter>
        <Finance />
      </MemoryRouter>
    );

    await openTransferModal(user);
    const dialog = screen.getByRole('dialog');
    await fillTransferAmount(user, dialog, '300');
    await user.click(within(dialog).getByRole('button', { name: /Confirmar Transferência/i }));

    await waitFor(() => {
      expect(addTransactionMock).toHaveBeenCalledTimes(2);
    });
    const [first, second] = addTransactionMock.mock.calls.map((call) => call[0]);
    // RED: today the OUT/IN pair carries no shared identifier, so cancelling
    // one half leaves the other dangling — accounts drift out of balance.
    expect(first.transferGroupId).toBeDefined();
    expect(second.transferGroupId).toBeDefined();
    expect(first.transferGroupId).toBe(second.transferGroupId);
  });

  // ---------------------------------------------------------------------------
  // 4. Cancelling one half of a transfer warns about the linked half
  // ---------------------------------------------------------------------------
  it('warns the operator that cancelling a transfer reverses BOTH accounts when one half is deleted', async () => {
    const user = userEvent.setup();
    useDataMock.mockReturnValue(
      baseDataContext({
        transactions: [
          {
            id: 'trx-transfer-out',
            type: 'OUT',
            category: 'Transferência',
            amount: 400,
            date: '2026-03-15T10:00:00.000Z',
            description: 'Transferência para Cofre',
            account: 'Conta Bancária',
            transferGroupId: 'grp-1'
          },
          {
            id: 'trx-transfer-in',
            type: 'IN',
            category: 'Transferência',
            amount: 400,
            date: '2026-03-15T10:00:00.000Z',
            description: 'Transferência de Conta Bancária',
            account: 'Cofre',
            transferGroupId: 'grp-1'
          }
        ] as any
      })
    );
    render(
      <MemoryRouter>
        <Finance />
      </MemoryRouter>
    );

    await user.click(screen.getByRole('button', { name: 'Conta Bancária' }));
    await user.click(screen.getByText('Transferência para Cofre'));
    await user.click(screen.getByRole('button', { name: 'Cancelar lançamento' }));

    await waitFor(() => {
      expect(toastConfirmMock).toHaveBeenCalled();
    });
    const confirmArgs = toastConfirmMock.mock.calls[0][0];
    // RED: today the confirm dialog has no awareness of the paired half and
    // does not mention that cancelling will also remove the credit on Cofre.
    expect(confirmArgs.description).toMatch(/(contraparte|outra ponta|também será|reverter.*ambas|destino do par|par desta transferência)/i);
  });

  // ---------------------------------------------------------------------------
  // 5. Cancelling one half cascades the cancellation of the paired half
  // ---------------------------------------------------------------------------
  it('cancels the paired transfer transaction when the operator cancels either half', async () => {
    const user = userEvent.setup();
    useDataMock.mockReturnValue(
      baseDataContext({
        transactions: [
          {
            id: 'trx-transfer-out',
            type: 'OUT',
            category: 'Transferência',
            amount: 400,
            date: '2026-03-15T10:00:00.000Z',
            description: 'Transferência para Cofre',
            account: 'Conta Bancária',
            transferGroupId: 'grp-cascade'
          },
          {
            id: 'trx-transfer-in',
            type: 'IN',
            category: 'Transferência',
            amount: 400,
            date: '2026-03-15T10:00:00.000Z',
            description: 'Transferência de Conta Bancária',
            account: 'Cofre',
            transferGroupId: 'grp-cascade'
          }
        ] as any
      })
    );
    render(
      <MemoryRouter>
        <Finance />
      </MemoryRouter>
    );

    await user.click(screen.getByRole('button', { name: 'Conta Bancária' }));
    await user.click(screen.getByText('Transferência para Cofre'));
    await user.click(screen.getByRole('button', { name: 'Cancelar lançamento' }));

    await waitFor(() => {
      // RED: removeTransaction is currently called only with the half the user
      // clicked. The paired half stays alive → accounts drift apart.
      expect(removeTransactionMock).toHaveBeenCalledWith('trx-transfer-out');
      expect(removeTransactionMock).toHaveBeenCalledWith('trx-transfer-in');
    });
  });

  // ---------------------------------------------------------------------------
  // 6. Transfer rejects zero amount without partial side effects
  // ---------------------------------------------------------------------------
  it('does not call addTransaction at all when the operator submits a transfer with amount 0', async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter>
        <Finance />
      </MemoryRouter>
    );

    await openTransferModal(user);
    const dialog = screen.getByRole('dialog');
    await fillTransferAmount(user, dialog, '0');
    await user.click(within(dialog).getByRole('button', { name: /Confirmar Transferência/i }));

    expect(toastErrorMock).toHaveBeenCalled();
    expect(addTransactionMock).not.toHaveBeenCalled();
  });

  // ---------------------------------------------------------------------------
  // 7. Aporte is rejected when amount is zero (UX guard)
  // ---------------------------------------------------------------------------
  it('refuses to create an aporte with amount 0 and does not call addTransaction', async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter>
        <Finance />
      </MemoryRouter>
    );

    await user.click(screen.getByRole('button', { name: 'Conta Bancária' }));
    await user.click(screen.getByRole('button', { name: 'Aporte' }));

    const dialog = screen.getByRole('dialog');
    await fillAporteAmount(user, dialog, '0');
    await user.click(within(dialog).getByRole('button', { name: /Confirmar Aporte/i }));

    expect(toastErrorMock).toHaveBeenCalled();
    expect(addTransactionMock).not.toHaveBeenCalled();
  });

  // ---------------------------------------------------------------------------
  // 8. Aporte amount is preserved with cent precision (BRL comma)
  // ---------------------------------------------------------------------------
  it('preserves Brazilian decimal centavos (1234,56) when registering an aporte', async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter>
        <Finance />
      </MemoryRouter>
    );

    await user.click(screen.getByRole('button', { name: 'Conta Bancária' }));
    await user.click(screen.getByRole('button', { name: 'Aporte' }));
    const dialog = screen.getByRole('dialog');
    await fillAporteAmount(user, dialog, '1234,56');
    await user.click(within(dialog).getByRole('button', { name: /Confirmar Aporte/i }));

    await waitFor(() => {
      expect(addTransactionMock).toHaveBeenCalled();
    });
    const payload = addTransactionMock.mock.calls[0][0];
    expect(payload.amount).toBe(1234.56);
  });
});
