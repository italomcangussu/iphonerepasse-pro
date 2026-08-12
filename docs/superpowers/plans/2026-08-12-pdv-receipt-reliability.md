# PDV Receipt Reliability Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Prevent blank PDV receipts, preserve the negotiated value during editing, and make the commercial controls and used-device battery health clear on every receipt path.

**Architecture:** Render receipt templates in a print-only portal outside the app root, so print CSS can hide the application without hiding the selected receipt. Keep the last valid negotiated value while its input is temporarily empty, and make the discount action explicitly describe its relationship to the negotiated value.

**Tech Stack:** React 19, TypeScript, Vite, Vitest, Testing Library, Tailwind CSS.

## Global Constraints

- Preserve the existing 80 mm and A4 receipt formats.
- Do not change financial calculation or persistence contracts.
- Use the existing `Modal`, `ToastProvider`, Tailwind tokens, dark mode, and 44 px interaction primitives.
- Add regression coverage before each production change.

---

### Task 1: Isolate printable receipts from application chrome

**Files:**

- Modify: `pages/PDV.tsx`
- Modify: `pages/PDVHistory.tsx`
- Modify: `index.css`
- Test: `pages/PDVHistory.test.tsx`

**Interfaces:**

- Consumes: the existing `.print-layout-80mm` and `.print-layout-a4` template classes.
- Produces: receipt nodes appended directly to `document.body` while rendered, allowing `body[data-print-layout] #root` to be safely hidden.

- [ ] **Step 1: Write the failing test**

```tsx
expect(document.getElementById('receipt-content-80mm')?.parentElement).toBe(document.body);
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run pages/PDVHistory.test.tsx -t "renders receipt templates outside the app root"`

Expected: FAIL because templates are currently inside the React root.

- [ ] **Step 3: Write minimal implementation**

```tsx
return createPortal(receiptTemplates, document.body);
```

```css
@media print {
  body[data-print-layout] #root { display: none !important; }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run pages/PDVHistory.test.tsx -t "renders receipt templates outside the app root"`

Expected: PASS.

### Task 2: Preserve default negotiated value and clarify commercial controls

**Files:**

- Modify: `pages/PDV.tsx`
- Test: `pages/PDV.test.tsx`

**Interfaces:**

- Consumes: `negotiatedPrice` for all pricing totals and `negotiatedPriceInput` for user input.
- Produces: a nonzero, last-valid negotiated value while the input is being edited, plus an explicitly labelled discount control.

- [ ] **Step 1: Write failing tests**

```tsx
fireEvent.change(screen.getByLabelText('Valor negociado do aparelho'), { target: { value: '' } });
expect(screen.getByText('Total').parentElement).toHaveTextContent('R$ 3.000');
expect(screen.getByRole('button', { name: 'Definir desconto sobre o valor negociado' })).toBeVisible();
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run pages/PDV.test.tsx -t "keeps the current total while the negotiated price is temporarily empty"`

Expected: FAIL because clearing the input sets the numeric state to zero.

- [ ] **Step 3: Write minimal implementation**

```tsx
if (!Number.isFinite(parsed) || parsed <= 0) return;
setNegotiatedPrice(roundCurrency(parsed));
```

```tsx
<button aria-label="Definir desconto sobre o valor negociado">
  {discountAmount > 0 ? 'Alterar desconto' : 'Definir desconto'}
</button>
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run pages/PDV.test.tsx -t "negotiated price|discount"`

Expected: PASS.

### Task 3: Lock the used-device battery-health receipt contract

**Files:**

- Test: `pages/PDVHistory.test.tsx`
- Test: `utils/thermalPrinter.test.ts`

**Interfaces:**

- Consumes: `StockItem.condition` and `StockItem.batteryHealth` in sold sale items.
- Produces: regression coverage for browser and ESC/POS receipt text.

- [ ] **Step 1: Add receipt assertions**

```tsx
expect(document.getElementById('receipt-content-80mm')).toHaveTextContent('Saúde da bateria: 86%');
expect(new TextDecoder().decode(buildSaleReceiptBuffer(receipt))).toContain('Saude bateria: 86%');
```

- [ ] **Step 2: Run focused receipt tests**

Run: `npx vitest run pages/PDVHistory.test.tsx utils/thermalPrinter.test.ts`

Expected: PASS after confirming every supported receipt path uses the sold item snapshot.

### Task 4: Verify the completed flow

**Files:**

- Verify: `pages/PDV.tsx`
- Verify: `pages/PDVHistory.tsx`
- Verify: `index.css`

- [ ] **Step 1: Run focused tests**

Run: `npx vitest run pages/PDV.test.tsx pages/PDVHistory.test.tsx utils/thermalPrinter.test.ts`

- [ ] **Step 2: Run static validation**

Run: `npm run typecheck && npm run lint && npm run build`

- [ ] **Step 3: Inspect the final diff**

Run: `git diff --check && git diff -- pages/PDV.tsx pages/PDVHistory.tsx index.css`
