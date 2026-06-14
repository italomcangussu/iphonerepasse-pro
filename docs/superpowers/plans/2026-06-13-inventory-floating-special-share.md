# Inventory Floating Special Share Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Keep the special share selector floating below the iOS PWA header while users scroll the Inventory list.

**Architecture:** Keep the change local to `pages/Inventory.tsx`. Add one accessibility/layout test in `pages/Inventory.test.tsx`, then update the existing floating banner classes and add top spacing to the inventory content while special share mode is active.

**Tech Stack:** React 19, TypeScript, Tailwind utility classes, Framer Motion, Vitest, Testing Library.

---

### Task 1: Test Floating Special Share Panel

**Files:**
- Modify: `pages/Inventory.test.tsx`

- [ ] **Step 1: Write the failing test**

Add a test near the existing special WhatsApp list test:

```tsx
it('keeps the special share selector floating below the inventory header', async () => {
  const user = userEvent.setup();

  render(<Inventory />);

  await user.click(screen.getByRole('button', { name: /WhatsApp/i }));
  await user.click(screen.getByRole('menuitem', { name: 'Lista especial' }));

  const floatingPanel = screen.getByLabelText('Banner flutuante da lista especial');
  expect(floatingPanel).toHaveClass('fixed');
  expect(floatingPanel.className).toContain('top-[calc(env(safe-area-inset-top,0px)+5.75rem)]');
  expect(screen.getByTestId('inventory-content')).toHaveClass('pt-28');
  expect(screen.getByRole('button', { name: /Escolher parcelas/i })).toBeDisabled();
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `PATH="$HOME/.local/bin:$HOME/.deno/bin:/opt/homebrew/bin:$PATH" npm test -- pages/Inventory.test.tsx -t "keeps the special share selector floating"`

Expected: FAIL because `inventory-content` test id and the new top offset/spacing are not implemented.

### Task 2: Implement Floating Layout

**Files:**
- Modify: `pages/Inventory.tsx`

- [ ] **Step 1: Add content wrapper test id and spacing**

Change the stock content wrapper from:

```tsx
<div className="space-y-4">
```

to:

```tsx
<div data-testid="inventory-content" className={`space-y-4 ${isSpecialShareMode ? 'pt-28 sm:pt-24' : ''}`}>
```

- [ ] **Step 2: Move the floating panel below the header**

Change the floating panel container class from:

```tsx
className="fixed inset-x-0 top-[calc(env(safe-area-inset-top,0px)+0.75rem)] z-50 px-3 sm:px-6"
```

to:

```tsx
className="fixed inset-x-0 top-[calc(env(safe-area-inset-top,0px)+5.75rem)] z-50 px-3 sm:px-6"
```

- [ ] **Step 3: Add the WhatsApp visual strip**

Inside the panel card, add an absolutely positioned channel marker when `specialShareChannel === 'whatsapp'`.

- [ ] **Step 4: Run focused tests**

Run: `PATH="$HOME/.local/bin:$HOME/.deno/bin:/opt/homebrew/bin:$PATH" npm test -- pages/Inventory.test.tsx -t "special share|floating"`

Expected: PASS.

### Task 3: Final Verification

**Files:**
- Verify only

- [ ] **Step 1: Run Inventory tests**

Run: `PATH="$HOME/.local/bin:$HOME/.deno/bin:/opt/homebrew/bin:$PATH" npm test -- pages/Inventory.test.tsx`

Expected: PASS.

- [ ] **Step 2: Run typecheck**

Run: `PATH="$HOME/.local/bin:$HOME/.deno/bin:/opt/homebrew/bin:$PATH" npm run typecheck`

Expected: PASS.
