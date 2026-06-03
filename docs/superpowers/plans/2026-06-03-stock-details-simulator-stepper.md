# Stock Details Simulator Stepper Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Redesign the stock details simulator as a 3-step modal with installments shared from 1x up to a user-selected limit, defaulting to 18x.

**Architecture:** Extract simulator UI from `StockDetailsModal.tsx` into a focused `StockSimulatorModal` component. Keep `StockDetailsModal` responsible for details, photos, and launching the simulator. Reuse `calculateSimulatorQuote`, filtering installments only for preview/share text by `maxInstallmentsToShare`.

**Tech Stack:** React 19, TypeScript, Vitest, Testing Library, existing `Modal`, `IOSButton`, `useDisclosure`, `useToast`, `utils/simulator`.

---

## File Structure

- Create `components/StockSimulatorModal.tsx`: dedicated 3-step simulator modal.
- Modify `components/StockDetailsModal.tsx`: remove simulator state/UI and render `StockSimulatorModal`.
- Modify `components/StockDetailsModal.test.tsx`: keep launch integration test and assert the stepper flow.
- Create `components/StockSimulatorModal.test.tsx`: focused tests for default 18x, reducing to 12x, CRM copy, WhatsApp open, validation.
- Existing `pages/Inventory.tsx` and `pages/InUse.tsx`: keep passing simulator settings into `StockDetailsModal`.

## Task 1: Focused Stepper Tests

**Files:**
- Create: `components/StockSimulatorModal.test.tsx`
- Modify: `components/StockDetailsModal.test.tsx`

- [ ] **Step 1: Write failing tests for stepper behavior**

Create `components/StockSimulatorModal.test.tsx` with tests that render `StockSimulatorModal` open with a stock item, trade-in rules, adjustments, and card fees. Cover:

```tsx
it('opens in Dados and advances to Parcelas with 18x selected by default', async () => {
  render(
    <StockSimulatorModal
      open
      onClose={vi.fn()}
      item={stockItem}
      simulatorTradeInValues={tradeInValues}
      simulatorTradeInAdjustments={tradeInAdjustments}
      cardFeeSettings={DEFAULT_CARD_FEE_SETTINGS}
    />
  );
  expect(screen.getByRole('button', { name: /Dados/i })).toHaveAttribute('aria-current', 'step');
  await user.click(screen.getByRole('button', { name: /Continuar/i }));
  expect(screen.getByRole('button', { name: /Parcelas/i })).toHaveAttribute('aria-current', 'step');
  expect(screen.getByLabelText('Enviar até')).toHaveValue('18');
});

it('copies only installments from 1x to the selected limit', async () => {
  render(
    <StockSimulatorModal
      open
      onClose={vi.fn()}
      item={stockItem}
      simulatorTradeInValues={tradeInValues}
      simulatorTradeInAdjustments={tradeInAdjustments}
      cardFeeSettings={DEFAULT_CARD_FEE_SETTINGS}
    />
  );
  await user.click(screen.getByRole('button', { name: /Continuar/i }));
  await user.clear(screen.getByLabelText('Enviar até'));
  await user.type(screen.getByLabelText('Enviar até'), '12');
  await user.click(screen.getByRole('button', { name: /Continuar/i }));
  await user.click(screen.getByRole('button', { name: /Copiar para CRM/i }));
  const copied = writeTextMock.mock.calls[0][0];
  expect(copied).toContain('*12x*');
  expect(copied).not.toContain('*13x*');
});

it('opens WhatsApp with filtered installments when saída is WhatsApp', async () => {
  render(
    <StockSimulatorModal
      open
      onClose={vi.fn()}
      item={stockItem}
      simulatorTradeInValues={tradeInValues}
      simulatorTradeInAdjustments={tradeInAdjustments}
      cardFeeSettings={DEFAULT_CARD_FEE_SETTINGS}
    />
  );
  await user.selectOptions(screen.getByLabelText('Saída'), 'whatsapp');
  await user.click(screen.getByRole('button', { name: /Continuar/i }));
  await user.clear(screen.getByLabelText('Enviar até'));
  await user.type(screen.getByLabelText('Enviar até'), '12');
  await user.click(screen.getByRole('button', { name: /Continuar/i }));
  await user.click(screen.getByRole('button', { name: /Abrir WhatsApp/i }));
  expect(window.open).toHaveBeenCalledWith(expect.stringContaining('https://wa.me/?text='), '_blank', 'noopener,noreferrer');
});
```

Update `components/StockDetailsModal.test.tsx` to assert only that the details modal opens `StockSimulatorModal` and the existing user can still start the simulator from details.

- [ ] **Step 2: Run tests to verify RED**

Run:

```bash
npm run test:run -- components/StockSimulatorModal.test.tsx components/StockDetailsModal.test.tsx
```

Expected: fail because `StockSimulatorModal` does not exist or does not expose stepper behavior.

## Task 2: Extract `StockSimulatorModal`

**Files:**
- Create: `components/StockSimulatorModal.tsx`
- Modify: `components/StockDetailsModal.tsx`

- [ ] **Step 1: Implement focused component**

Create `components/StockSimulatorModal.tsx` with props:

```ts
type StockSimulatorModalProps = {
  open: boolean;
  onClose: () => void;
  item: StockItem;
  simulatorTradeInValues?: SimulatorTradeInValue[];
  simulatorTradeInAdjustments?: SimulatorTradeInAdjustment[];
  cardFeeSettings?: CardFeeSettings;
};
```

Move simulator state and helpers from `StockDetailsModal.tsx` into this component:

- `tradeInModel`
- `tradeInCapacity`
- `tradeInColor`
- `manualTradeInValue`
- `selectedAdjustmentIds`
- `entryAmount`
- `entries`
- `cardBrand`
- `simulatorShareTarget`
- `modelOptions`
- `capacityOptions`
- `applicableAdjustments`
- `simulatorQuote`

Add:

```ts
type SimulatorStep = 'dados' | 'parcelas' | 'enviar';
const [activeStep, setActiveStep] = useState<SimulatorStep>('dados');
const [maxInstallmentsToShare, setMaxInstallmentsToShare] = useState(18);
```

Reset both to defaults when the modal opens or item changes.

- [ ] **Step 2: Wire details modal**

In `components/StockDetailsModal.tsx`, import `StockSimulatorModal`, remove inline simulator modal JSX/state, and render:

```tsx
<StockSimulatorModal
  open={isSimulatorModalOpen}
  onClose={() => closeSimulatorModal()}
  item={item}
  simulatorTradeInValues={simulatorTradeInValues}
  simulatorTradeInAdjustments={simulatorTradeInAdjustments}
  cardFeeSettings={cardFeeSettings}
/>
```

Keep the `Simulador` footer button.

- [ ] **Step 3: Run tests to verify GREEN for extraction**

Run:

```bash
npm run test:run -- components/StockSimulatorModal.test.tsx components/StockDetailsModal.test.tsx
```

Expected: tests still fail only for incomplete stepper/share filtering, not missing component/import errors.

## Task 3: Implement Stepper UI And Installment Limit

**Files:**
- Modify: `components/StockSimulatorModal.tsx`

- [ ] **Step 1: Implement step navigation**

Render a `Modal` titled `Simulador` with three step buttons:

- `Dados`
- `Parcelas`
- `Enviar`

Use `aria-current="step"` on the active step. The primary footer button should be:

- `Continuar` on `dados`, validates `simulatorQuote.ok` before moving to `parcelas`;
- `Continuar` on `parcelas`, moves to `enviar`;
- `Copiar para CRM` or `Abrir WhatsApp` on `enviar`, based on `simulatorShareTarget`.

- [ ] **Step 2: Implement Parcelas step**

On `parcelas`, render an accessible numeric control:

```tsx
<label>
  <span>Enviar até</span>
  <input
    aria-label="Enviar até"
    type="number"
    min={1}
    max={18}
    value={maxInstallmentsToShare}
    onChange={(event) => setMaxInstallmentsToShare(clampInstallments(Number(event.target.value)))}
  />
</label>
```

Also show:

- saldo no cartão;
- count: `${maxInstallmentsToShare} parcela(s) na mensagem`;
- first installment preview;
- last selected installment preview.

- [ ] **Step 3: Filter message installments**

Build a filtered message:

```ts
const selectedInstallments = simulatorQuote.installments.slice(0, maxInstallmentsToShare);
const simulatorMessageText = simulatorQuote.ok
  ? formatSimulatorMessage({ summary: simulatorQuote.summary, installments: selectedInstallments })
  : '';
```

Use `simulatorMessageText` for CRM copy and WhatsApp. Do not change `simulatorQuote.summary.cardNetAmount`.

- [ ] **Step 4: Run tests**

Run:

```bash
npm run test:run -- components/StockSimulatorModal.test.tsx components/StockDetailsModal.test.tsx
```

Expected: all component tests pass.

## Task 4: Integration And Regression Verification

**Files:**
- Modify as needed only if tests expose integration issues.

- [ ] **Step 1: Run existing simulator tests**

Run:

```bash
npm run test:run -- pages/crm/SimulatorPage.test.tsx utils/simulator.test.ts components/StockSimulatorModal.test.tsx components/StockDetailsModal.test.tsx
```

Expected: all pass.

- [ ] **Step 2: Run typecheck**

Run:

```bash
npm run typecheck
```

Expected: exit 0.

- [ ] **Step 3: Run build**

Run:

```bash
npm run build
```

Expected: exit 0.

## Self-Review

Spec coverage:

- 3-step flow: Task 3.
- Default 18x: Task 1 and Task 2.
- 1x up to N filtering: Task 1 and Task 3.
- CRM/WhatsApp output: Task 1 and Task 3.
- Extraction from details modal: Task 2.
- Tests and regressions: Task 4.

No placeholders are intentionally left. All file paths are explicit.
