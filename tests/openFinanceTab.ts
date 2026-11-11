import { screen } from '@testing-library/react';

type Clicker = { click: (element: Element) => Promise<void> };

// O Financeiro agrupa as visões (Caixa = Conta Bancária + Cofre; Dívidas = Devedores + Contas a pagar).
const GROUP_OF_TAB: Record<string, string> = { bank: 'cash', safe: 'cash', debtors: 'debts', payable_debts: 'debts' };

export async function openFinanceTab(user: Clicker, tab: 'bank' | 'safe' | 'debtors' | 'payable_debts') {
  await user.click(screen.getByTestId(`finance-group-${GROUP_OF_TAB[tab]}`));
  await user.click(screen.getByTestId(`finance-tab-${tab}`));
}
