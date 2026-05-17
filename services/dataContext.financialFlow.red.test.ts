/**
 * RED TESTS (TDD) — Financial-flow integrity inside DataProvider.
 *
 * These tests inspect the dataContext source directly to diagnose
 * silent data-integrity bugs in `updateSale` and `addTransaction`. The
 * full integration tests around DataProvider are heavy (see
 * dataContext.test.tsx), so for these specific code paths a focused
 * source-level red test is fast, falsifiable and exact: as long as the
 * source contains the expected snippets the bug is fixed; the moment
 * someone removes the safeguard the test goes red again.
 *
 * Diagnosed bugs:
 *
 *   - `updateSale` rebuilds the sales row but its `dbUpdates` payload
 *     omits every `client_payment_*` column. Editing a sale that had a
 *     trade-in surplus refund silently loses the refund metadata.
 *   - `updateSale` deletes the existing debts, debt_payments, sale_items,
 *     payment_methods, trade-ins and transactions linked to the sale,
 *     but NEVER touches `payable_debts`. Editing a sale that created a
 *     "loja deve ao cliente" payable_debt leaves a stale debt active.
 *   - `updateSale` recreates trade-in IN/OUT transactions but never
 *     recreates the OUT "Pagamento de trade-in ao cliente" transaction
 *     after deleting it, so the immediate-refund OUT disappears on edit.
 *   - `addTransaction` does not validate the amount: a programmatic call
 *     with amount=0 (or negative) succeeds and pollutes the ledger.
 *   - `addTransaction` does not stamp `sale_id` even when callers pass
 *     it via the `Transaction` payload (the insert object hand-picks
 *     fields and drops it silently).
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

const SOURCE = readFileSync('services/dataContext.tsx', 'utf8');

const sliceFunctionBody = (signature: RegExp): string => {
  const match = SOURCE.match(signature);
  if (!match) return '';
  const start = match.index ?? 0;
  // updateSale is ~370 lines long; addSale ~320. A 25k-char window safely
  // captures the full body of either function (and stops well before the
  // next const declaration that we'd never want to read into).
  return SOURCE.slice(start, start + 25000);
};

const UPDATE_SALE_BODY = sliceFunctionBody(/const updateSale = async \(saleId: string/);
const ADD_TRANSACTION_BODY = sliceFunctionBody(/const addTransaction = async \(transaction: Transaction\)/);
const ADD_SALE_BODY = sliceFunctionBody(/const addSale = async \(sale: Sale\)/);

describe('DataProvider financial flow — diagnostic RED tests', () => {
  // ---------------------------------------------------------------------------
  // 1. updateSale.dbUpdates must include client_payment_* columns
  // ---------------------------------------------------------------------------
  it('updateSale syncs the sales row client_payment_amount when editing', () => {
    expect(UPDATE_SALE_BODY).toBeTruthy();
    // RED: today the dbUpdates payload only carries items/discount/total/
    // trade_in fields. Editing a sale that originally had a trade-in surplus
    // refund silently keeps the stale refund amount on the sales row.
    expect(UPDATE_SALE_BODY).toContain('client_payment_amount');
  });

  it('updateSale syncs client_payment_mode/account/method/notes/due_date on edit', () => {
    expect(UPDATE_SALE_BODY).toContain('client_payment_mode');
    expect(UPDATE_SALE_BODY).toContain('client_payment_account');
    expect(UPDATE_SALE_BODY).toContain('client_payment_method');
    expect(UPDATE_SALE_BODY).toContain('client_payment_notes');
    expect(UPDATE_SALE_BODY).toContain('client_payment_due_date');
  });

  // ---------------------------------------------------------------------------
  // 2. updateSale must clean up payable_debts linked to the sale
  // ---------------------------------------------------------------------------
  it("updateSale deletes existing payable_debts for the sale before recreating them", () => {
    // RED: today payable_debts created from the original trade-in surplus
    // are never deleted on edit. Editing the sale to change the refund
    // amount or remove it entirely leaves an orphan debt active.
    expect(UPDATE_SALE_BODY).toMatch(/from\(['"]payable_debts['"]\)[\s\S]*?\.delete\(\)[\s\S]*?\.eq\(['"]sale_id['"]/);
  });

  // ---------------------------------------------------------------------------
  // 3. updateSale must recreate the client refund transaction
  // ---------------------------------------------------------------------------
  it('updateSale recreates the OUT refund transaction after editing (via the shared helper)', () => {
    // RED: line ~2712 deletes every transaction with sale_id = saleId. The
    // block that re-creates trade-in transactions only inserts the IN/OUT
    // pair for the trade-in itself, never the refund-to-customer OUT.
    expect(UPDATE_SALE_BODY).toMatch(/buildClientRefundTransaction\s*\(/);
  });

  // ---------------------------------------------------------------------------
  // 4. addTransaction validates the amount
  // ---------------------------------------------------------------------------
  it('addTransaction rejects amount <= 0 before hitting the database', () => {
    expect(ADD_TRANSACTION_BODY).toBeTruthy();
    // RED: today the function inserts whatever the caller passed.
    expect(ADD_TRANSACTION_BODY).toMatch(/amount\s*<=\s*0|toNumber\(transaction\.amount\)\s*<=\s*0|Number\(transaction\.amount\)\s*<=\s*0/);
  });

  // ---------------------------------------------------------------------------
  // 5. addTransaction validates the type explicitly
  // ---------------------------------------------------------------------------
  it("addTransaction validates transaction.type is 'IN' or 'OUT'", () => {
    // RED: today the function passes whatever string the caller sent.
    expect(ADD_TRANSACTION_BODY).toMatch(/transaction\.type\s*!==\s*['"]IN['"]|transaction\.type\s*!==\s*['"]OUT['"]|\[['"]IN['"],\s*['"]OUT['"]\]\.includes/);
  });

  // ---------------------------------------------------------------------------
  // 6. addTransaction forwards sale_id when provided
  // ---------------------------------------------------------------------------
  it('addTransaction forwards the optional sale_id and saleId fields into the insert payload', () => {
    // RED: today the insert object hand-picks id/type/category/amount/date/
    // description/account only. Any caller that wants to link a manual
    // transaction to a sale silently loses the link.
    expect(ADD_TRANSACTION_BODY).toMatch(/sale_id\s*:\s*transaction\.saleId/);
  });

  // ---------------------------------------------------------------------------
  // 7. addTransaction sanitizes/blocks transfers being booked as Aporte
  // ---------------------------------------------------------------------------
  it('addTransaction blocks the literal "Aporte" category when the transaction has a transferGroupId', () => {
    // RED: today nothing prevents a transfer from being filed under
    // category="Aporte", which is exactly what Finance.tsx does on the
    // credit half of a transfer (inflating revenue reports).
    expect(ADD_TRANSACTION_BODY).toMatch(/transferGroupId[\s\S]*?Aporte|Aporte[\s\S]*?transferGroupId/);
  });

  // ---------------------------------------------------------------------------
  // 8. addSale and updateSale converge on a single helper for client refund
  // ---------------------------------------------------------------------------
  it('addSale and updateSale share a common helper to build the client-refund OUT transaction', () => {
    // RED: today addSale emits the OUT refund inline (line ~2394) while
    // updateSale forgets to do it at all. Extracting a shared helper
    // (e.g. buildClientRefundTransaction) eliminates the drift.
    expect(ADD_SALE_BODY).toMatch(/buildClientRefundTransaction|emitClientRefundTransaction|writeClientRefundTransaction/);
    expect(UPDATE_SALE_BODY).toMatch(/buildClientRefundTransaction|emitClientRefundTransaction|writeClientRefundTransaction/);
  });
});
