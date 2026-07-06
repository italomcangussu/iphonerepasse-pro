import {
  StockStatus,
  type Debt,
  type DebtPayment,
  type PayableDebt,
  type PayableDebtPayment,
  type Sale,
  type StockItem,
  type Transaction
} from '../../../types';

export const upsertById = <T extends { id: string }>(rows: T[], incoming: T): T[] =>
  rows.some((row) => row.id === incoming.id)
    ? rows.map((row) => row.id === incoming.id ? incoming : row)
    : [...rows, incoming];

export const upsertManyById = <T extends { id: string }>(rows: T[], incoming: T[]): T[] =>
  incoming.reduce((current, row) => upsertById(current, row), rows);

export const removeById = <T extends { id: string }>(rows: T[], id: string): T[] =>
  rows.filter((row) => row.id !== id);

export interface SaleCascadeState {
  saleId: string;
  sales: Sale[];
  transactions: Transaction[];
  debts: Debt[];
  debtPayments: DebtPayment[];
  payableDebts: PayableDebt[];
  payableDebtPayments: PayableDebtPayment[];
  stock: StockItem[];
}

export const removeSaleCascade = ({
  saleId,
  sales,
  transactions,
  debts,
  debtPayments,
  payableDebts,
  payableDebtPayments,
  stock
}: SaleCascadeState): Omit<SaleCascadeState, 'saleId'> => {
  const deletedSale = sales.find((sale) => sale.id === saleId);
  const linkedDebtIds = new Set(
    debts.filter((debt) => debt.saleId === saleId).map((debt) => debt.id)
  );
  const linkedDebtPaymentIds = new Set(
    debtPayments
      .filter((payment) => linkedDebtIds.has(payment.debtId))
      .map((payment) => payment.id)
  );
  const linkedPayableDebtIds = new Set(
    payableDebts.filter((debt) => debt.saleId === saleId).map((debt) => debt.id)
  );
  const linkedPayableDebtPaymentIds = new Set(
    payableDebtPayments
      .filter((payment) => linkedPayableDebtIds.has(payment.payableDebtId))
      .map((payment) => payment.id)
  );
  const releasedStockIds = new Set(deletedSale?.items.map((item) => item.id) || []);

  return {
    sales: removeById(sales, saleId),
    transactions: transactions.filter((transaction) => (
      transaction.saleId !== saleId &&
      (!transaction.debtPaymentId || !linkedDebtPaymentIds.has(transaction.debtPaymentId)) &&
      (
        !transaction.payableDebtPaymentId ||
        !linkedPayableDebtPaymentIds.has(transaction.payableDebtPaymentId)
      ) &&
      (!transaction.payableDebtId || !linkedPayableDebtIds.has(transaction.payableDebtId))
    )),
    debts: debts.filter((debt) => debt.saleId !== saleId),
    debtPayments: debtPayments.filter((payment) => !linkedDebtIds.has(payment.debtId)),
    payableDebts: payableDebts.filter((debt) => debt.saleId !== saleId),
    payableDebtPayments: payableDebtPayments.filter(
      (payment) => !linkedPayableDebtIds.has(payment.payableDebtId)
    ),
    stock: deletedSale
      ? stock.map((item) => (
          releasedStockIds.has(item.id)
            ? { ...item, status: StockStatus.AVAILABLE }
            : item
        ))
      : stock
  };
};

export interface DebtCascadeState {
  debtId: string;
  debts: Debt[];
  debtPayments: DebtPayment[];
  transactions: Transaction[];
}

export const removeDebtCascade = ({
  debtId,
  debts,
  debtPayments,
  transactions
}: DebtCascadeState): Omit<DebtCascadeState, 'debtId'> => {
  const linkedPaymentIds = new Set(
    debtPayments
      .filter((payment) => payment.debtId === debtId)
      .map((payment) => payment.id)
  );

  return {
    debts: removeById(debts, debtId),
    debtPayments: debtPayments.filter((payment) => payment.debtId !== debtId),
    transactions: transactions.filter(
      (transaction) => !transaction.debtPaymentId || !linkedPaymentIds.has(transaction.debtPaymentId)
    )
  };
};

export interface PayableDebtCascadeState {
  payableDebtId: string;
  payableDebts: PayableDebt[];
  payableDebtPayments: PayableDebtPayment[];
  transactions: Transaction[];
}

export const removePayableDebtCascade = ({
  payableDebtId,
  payableDebts,
  payableDebtPayments,
  transactions
}: PayableDebtCascadeState): Omit<PayableDebtCascadeState, 'payableDebtId'> => {
  const linkedPaymentIds = new Set(
    payableDebtPayments
      .filter((payment) => payment.payableDebtId === payableDebtId)
      .map((payment) => payment.id)
  );

  return {
    payableDebts: removeById(payableDebts, payableDebtId),
    payableDebtPayments: payableDebtPayments.filter(
      (payment) => payment.payableDebtId !== payableDebtId
    ),
    transactions: transactions.filter((transaction) => (
      transaction.payableDebtId !== payableDebtId &&
      (!transaction.payableDebtPaymentId || !linkedPaymentIds.has(transaction.payableDebtPaymentId))
    ))
  };
};
