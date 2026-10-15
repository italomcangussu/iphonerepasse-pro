import { describe, expect, it } from 'vitest';
import { careConditionFromStock, isInstallmentOverdue, nextPayableInstallment, paidTotal } from './careLabels';
import type { CareInstallment } from './careTypes';

const inst = (seq: number, status: CareInstallment['status'], due: string | null, amount = 80): CareInstallment => ({
  id: String(seq), contract_id: 'c', sequence_number: seq, kind: seq === 1 ? 'primeira' : 'recorrente', amount, due_date: due,
  status, paid_at: null, payment_method: null, payment_account: null, payment_reference: null,
});

describe('careLabels', () => {
  it('condição vem do estoque, sem inferir pelo nome', () => {
    expect(careConditionFromStock('Novo')).toBe('NOVO');
    expect(careConditionFromStock(' seminovo ')).toBe('SEMINOVO');
    expect(careConditionFromStock('iPhone 13 Novo')).toBeNull();
    expect(careConditionFromStock(undefined)).toBeNull();
  });

  it('parcela vencida é programada com vencimento anterior a hoje', () => {
    expect(isInstallmentOverdue(inst(2, 'programada', '2026-10-01'), '2026-10-15')).toBe(true);
    expect(isInstallmentOverdue(inst(2, 'programada', '2026-10-15'), '2026-10-15')).toBe(false);
    expect(isInstallmentOverdue(inst(2, 'paga', '2026-10-01'), '2026-10-15')).toBe(false);
    expect(isInstallmentOverdue(inst(2, 'programada', null), '2026-10-15')).toBe(false);
  });

  it('próxima parcela a pagar segue a ordem e total pago soma só as pagas', () => {
    const list = [inst(3, 'programada', null), inst(1, 'paga', '2026-10-01', 199), inst(2, 'programada', null)];
    expect(nextPayableInstallment(list)?.sequence_number).toBe(2);
    expect(paidTotal(list)).toBe(199);
    expect(nextPayableInstallment([inst(1, 'paga', null)])).toBeNull();
  });
});
