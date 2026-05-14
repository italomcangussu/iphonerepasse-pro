# PDV Edicao Completa Modal Overflow Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the current `Edicao Completa` redirect/cancel flow with a full editable overflow modal that saves through `updateSale`.

**Architecture:** Extract the complete sale edit behavior into `components/SaleCompleteEditModal.tsx`, keeping `PDVHistory.tsx` responsible only for opening the modal and calling `updateSale`. The existing simple `Editar` modal stays in `PDVHistory.tsx` unchanged. Tests verify the complete edit action does not call `removeSale`, does not navigate to PDV, shows section tabs, and persists a complete payload.

**Tech Stack:** React 19, TypeScript, Vite, Vitest, React Testing Library, Tailwind utility classes, existing `Modal` and `IOSButton` components.

---

### Task 1: Add Tests For Complete Edit Modal Entry

**Files:**
- Modify: `pages/PDVHistory.test.tsx`

- [ ] **Step 1: Replace the existing full edit test target**

In `pages/PDVHistory.test.tsx`, rename the test currently named `allows admin to save full sale edit payload` to:

```ts
it('opens complete edit modal without canceling or redirecting the sale', async () => {
```

Inside that test, click `Edicao Completa` instead of `Editar`:

```ts
await user.click(screen.getByRole('button', { name: 'Edição Completa' }));
```

Assert the new modal and its tabs:

```ts
expect(screen.getByRole('heading', { name: 'Editar Venda Concluida' })).toBeInTheDocument();
expect(screen.getByRole('button', { name: 'Resumo' })).toBeInTheDocument();
expect(screen.getByRole('button', { name: 'Itens vendidos' })).toBeInTheDocument();
expect(screen.getByRole('button', { name: 'Trade-in' })).toBeInTheDocument();
expect(screen.getByRole('button', { name: 'Pagamentos' })).toBeInTheDocument();
expect(screen.getByRole('button', { name: 'Totais' })).toBeInTheDocument();
expect(removeSaleMock).not.toHaveBeenCalled();
expect(window.localStorage.getItem('pdv:draft:v1')).toBeNull();
```

- [ ] **Step 2: Keep payload save assertions in the same test**

After the modal/tab assertions from Step 1, save and keep these payload expectations:

```ts
await user.click(screen.getByRole('button', { name: 'Salvar Alterações' }));

await waitFor(() => {
  expect(updateSaleMock).toHaveBeenCalledTimes(1);
});

const [saleId, payload] = updateSaleMock.mock.calls[0];
expect(saleId).toBe('sale-today');
expect(payload).toMatchObject({
  customerId: 'cust-1',
  sellerId: 'sel-1',
  total: 2000,
  paymentMethods: [{ type: 'Pix', amount: 2000 }]
});
expect(Array.isArray(payload.items)).toBe(true);
expect(toastSuccessMock).toHaveBeenCalledWith('Venda atualizada com sucesso.');
expect(removeSaleMock).not.toHaveBeenCalled();
```

- [ ] **Step 3: Run the focused test and verify it fails**

Run:

```bash
npm run test:run -- pages/PDVHistory.test.tsx -t "opens complete edit modal without canceling or redirecting the sale"
```

Expected: FAIL because `Edicao Completa` still opens a confirmation dialog and does not show tabs.

### Task 2: Create `SaleCompleteEditModal`

**Files:**
- Create: `components/SaleCompleteEditModal.tsx`
- Modify: `pages/PDVHistory.tsx`

- [ ] **Step 1: Create the component file by moving complete edit logic**

Create `components/SaleCompleteEditModal.tsx` with the state, calculations, validation, row helpers, and JSX currently inside `SaleEditModal`. The exported props must be:

```ts
export interface SaleCompleteEditModalProps {
  open: boolean;
  onClose: () => void;
  sale: Sale | null;
  onSave: (updates: Partial<Sale>) => Promise<void>;
}
```

The component must import its own dependencies:

```ts
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { useData } from '../services/dataContext';
import { Condition, DeviceType, PaymentMethod, Sale, SaleTradeInItem, StockItem, StockStatus, WarrantyType } from '../types';
import IOSButton from './ui/IOSButton';
import Modal from './ui/Modal';
import { FINANCIAL_ACCOUNTS } from '../utils/financialAccounts';
import { newId } from '../utils/id';
import { formatCurrencyBRL } from '../utils/inputMasks';
```

Include local copies of helper functions used by the component:

```ts
type DiscountInputType = 'amount' | 'percent';

const roundCurrency = (value: number): number => {
  if (!Number.isFinite(value)) return 0;
  return Math.round(value * 100) / 100;
};

const formatCurrency = (value: number): string => formatCurrencyBRL(roundCurrency(value));

const parseNumberInput = (value: string, fallback = 0): number => {
  const normalized = value.replace(',', '.').trim();
  if (!normalized) return fallback;
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : fallback;
};
```

- [ ] **Step 2: Add tab navigation at the top of the modal**

Inside `SaleCompleteEditModal`, create section refs and a tab helper:

```ts
const summaryRef = useRef<HTMLDivElement>(null);
const itemsRef = useRef<HTMLDivElement>(null);
const tradeInsRef = useRef<HTMLDivElement>(null);
const paymentsRef = useRef<HTMLDivElement>(null);
const totalsRef = useRef<HTMLDivElement>(null);

const scrollToSection = (ref: React.RefObject<HTMLDivElement | null>) => {
  ref.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
};
```

Render tabs before the form sections:

```tsx
<div className="sticky top-0 z-10 -mx-1 bg-white/95 dark:bg-surface-dark-100/95 pb-3 backdrop-blur">
  <div className="flex gap-2 overflow-x-auto px-1">
    <button type="button" className="ios-button-secondary whitespace-nowrap text-xs" onClick={() => scrollToSection(summaryRef)}>Resumo</button>
    <button type="button" className="ios-button-secondary whitespace-nowrap text-xs" onClick={() => scrollToSection(itemsRef)}>Itens vendidos</button>
    <button type="button" className="ios-button-secondary whitespace-nowrap text-xs" onClick={() => scrollToSection(tradeInsRef)}>Trade-in</button>
    <button type="button" className="ios-button-secondary whitespace-nowrap text-xs" onClick={() => scrollToSection(paymentsRef)}>Pagamentos</button>
    <button type="button" className="ios-button-secondary whitespace-nowrap text-xs" onClick={() => scrollToSection(totalsRef)}>Totais</button>
  </div>
</div>
```

Attach refs to the matching section wrappers:

```tsx
<section ref={summaryRef} className="scroll-mt-20 space-y-3">
  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">{/* cliente, vendedor, data */}</div>
  <div>{/* observacoes */}</div>
  <div>{/* desconto */}</div>
</section>
<section ref={itemsRef} className="scroll-mt-20 rounded-ios border app-border p-3 space-y-3">
  {/* aparelho(s) vendido(s) */}
</section>
<section ref={tradeInsRef} className="scroll-mt-20 rounded-ios border app-border p-3 space-y-3">
  {/* aparelho(s) trade-in */}
</section>
<section ref={paymentsRef} className="scroll-mt-20 rounded-ios border app-border p-3 space-y-3">
  {/* formas de pagamento */}
</section>
<section ref={totalsRef} className="scroll-mt-20 rounded-ios border app-border p-3 text-sm space-y-1.5">
  {/* totais e validacao */}
</section>
```

- [ ] **Step 3: Keep modal save behavior atomic**

The component must call only:

```ts
await onSave(payload);
```

It must not call `removeSale`, `navigate`, or `localStorage`.

For the payment presence validation, use the net total rule:

```ts
if (netFinancialTotal > 0 && normalizedPayments.length === 0) {
  setFormError('Informe pelo menos uma forma de pagamento com valor maior que zero.');
  return;
}
```

- [ ] **Step 4: Import the component in `PDVHistory.tsx`**

Add:

```ts
import SaleCompleteEditModal from '../components/SaleCompleteEditModal';
```

### Task 3: Wire `Edicao Completa` To The New Modal

**Files:**
- Modify: `pages/PDVHistory.tsx`

- [ ] **Step 1: Remove navigation-only complete edit code**

Remove `useNavigate` from the React Router import and remove:

```ts
const navigate = useNavigate();
```

Delete `handleEditCompleteConfirmed`.

- [ ] **Step 2: Render the new modal**

Replace the `ConfirmDialog` that uses `saleToEditComplete` with:

```tsx
<SaleCompleteEditModal
  open={!!saleToEditComplete}
  onClose={() => setSaleToEditComplete(null)}
  sale={saleToEditComplete}
  onSave={handleUpdateCompleteSale}
/>
```

Add the save handler near `handleUpdateSale`:

```ts
const handleUpdateCompleteSale = async (updates: Partial<Sale>) => {
  if (!saleToEditComplete) return;
  try {
    await updateSale(saleToEditComplete.id, updates);
    toast.success('Venda atualizada com sucesso.');
    setSaleToEditComplete(null);
    if (saleToView?.id === saleToEditComplete.id) {
      setSaleToView(null);
    }
  } catch (err: any) {
    toast.error(err?.message || 'Erro ao atualizar venda.');
    throw err;
  }
};
```

- [ ] **Step 3: Keep simple edit unchanged**

Leave this render in place:

```tsx
<SaleEditModal
  open={!!saleToEdit}
  onClose={() => setSaleToEdit(null)}
  sale={saleToEdit}
  onSave={handleUpdateSale}
/>
```

Do not change the `Editar` button behavior.

### Task 4: Remove Duplicated Complete Edit Code From `PDVHistory`

**Files:**
- Modify: `pages/PDVHistory.tsx`

- [ ] **Step 1: Delete local types and helpers no longer used by `PDVHistory`**

After extracting the complete modal, remove unused local types from `PDVHistory.tsx` if TypeScript reports them unused:

```ts
type DiscountInputType = 'amount' | 'percent';
type EditableSoldItemRow = {
  id: string;
  stockItemId: string;
  sellPrice: string;
  originalSellPrice: string;
};
type EditableTradeInRow = {
  id: string;
  stockItemId: string;
  model: string;
  capacity: string;
  color: string;
  imei: string;
  condition: string;
  receivedValue: string;
};
type EditablePaymentRow = {
  id: string;
  type: PaymentMethod['type'];
  amount: string;
  account: string;
  installments: string;
  cardBrand: 'visa_master' | 'outras';
  customerAmount: string;
  feeRate: string;
  feeAmount: string;
  debtDueDate: string;
  debtInstallments: string;
  debtNotes: string;
};
```

Remove complete-edit-only helpers if unused:

```ts
parseNumberInput
toDateTimeLocalInput
fromDateTimeLocalInput
buildDefaultPaymentRow
```

Keep shared display helpers still used by history and receipts:

```ts
roundCurrency
formatCurrency
getSaleTradeIns
getSaleTradeInSubtotal
getSaleHistoryTotal
getPaymentCustomerAmount
```

- [ ] **Step 2: Remove unused imports**

After `npm run typecheck` reports unused imports, remove only unused symbols from `PDVHistory.tsx`. Expected removals include some of:

```ts
useRef
useNavigate
Plus
Trash2
Condition
DeviceType
SaleTradeInItem
StockItem
StockStatus
WarrantyType
FINANCIAL_ACCOUNTS
newId
```

Do not remove symbols still used by sale details, print templates, or history calculations.

### Task 5: Verify Behavior

**Files:**
- Test: `pages/PDVHistory.test.tsx`
- Verify: TypeScript project

- [ ] **Step 1: Run focused complete edit test**

Run:

```bash
npm run test:run -- pages/PDVHistory.test.tsx -t "opens complete edit modal without canceling or redirecting the sale"
```

Expected: PASS.

- [ ] **Step 2: Run PDVHistory test file**

Run:

```bash
npm run test:run -- pages/PDVHistory.test.tsx
```

Expected: PASS.

- [ ] **Step 3: Run typecheck**

Run:

```bash
npm run typecheck
```

Expected: PASS.

- [ ] **Step 4: Commit implementation**

Run:

```bash
git add pages/PDVHistory.tsx pages/PDVHistory.test.tsx components/SaleCompleteEditModal.tsx
git commit -m "feat: edit complete sale in modal"
```
