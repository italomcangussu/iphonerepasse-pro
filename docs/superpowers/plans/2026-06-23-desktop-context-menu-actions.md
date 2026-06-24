# Desktop Context Menu Actions Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add discreet desktop right-click context menus across high-frequency ERP and CRM surfaces without removing existing visible buttons.

**Architecture:** Build one shared desktop-only context menu primitive and wire existing page callbacks into it. Page integrations must construct action arrays from existing permissions and handlers, so right-click never creates a parallel business path.

**Tech Stack:** React 19, TypeScript, Vite, Vitest, Testing Library, lucide-react, Tailwind utility classes already used by the app.

## Global Constraints

- Work on `main`, as requested.
- Do not create a git worktree for this execution.
- Follow TDD for behavior changes: add a failing test, run it red, implement, run it green.
- Do not remove existing buttons or columns of actions.
- Do not intercept native context menus on inputs, textareas, selects, buttons, links, media, editable content, or selected text.
- Only open the custom menu when `(hover: hover) and (pointer: fine)` matches.
- Reuse existing callbacks, permissions, confirmations, toasts, and destructive-action flows.
- Keep labels in PT-BR and consistent with visible buttons.
- Ignore unrelated untracked `output/playwright/**` files.

---

## File Structure

- Create `components/ui/contextMenuCore.ts`: pure helpers and shared action types.
- Create `hooks/useDesktopContextMenu.tsx`: stateful hook that binds `onContextMenu` handlers and executes selected actions.
- Create `components/ui/DesktopContextMenu.tsx`: portal host that renders the active menu.
- Create `components/ui/DesktopContextMenu.test.tsx`: behavior tests for native-target guard, desktop gating, positioning, opening, closing, and action execution.
- Modify `pages/Inventory.tsx`: add right-click actions for stock cards and table rows.
- Modify `pages/Inventory.test.tsx`: assert right-click actions call existing inventory flows and respect read-only permissions.
- Modify `pages/PDVHistory.tsx`: add right-click actions for sale cards and table rows.
- Modify `pages/PDVHistory.test.tsx`: assert sale context menu opens detail/edit/cancel actions with current role gating.
- Modify `components/crm/MessageBubble.tsx`: use the shared menu model for message bubble right-click while keeping the visible three-dot button.
- Modify `components/crm/MessageBubble.test.tsx`: assert message right-click exposes the same actions as the visible menu.
- Modify `components/crm/CRMSimpleCrud.tsx`: add right-click actions for generic CRM admin rows/cards.
- Add or modify `components/crm/CRMSimpleCrud.test.tsx`: assert generic edit/remove actions are available from right-click.

## Task 1: Shared Desktop Context Menu Primitive

**Files:**
- Create: `components/ui/contextMenuCore.ts`
- Create: `hooks/useDesktopContextMenu.tsx`
- Create: `components/ui/DesktopContextMenu.tsx`
- Create: `components/ui/DesktopContextMenu.test.tsx`

**Interfaces:**
- Produces: `ContextMenuAction`, `ContextMenuOpenOptions`, `useDesktopContextMenu`, `DesktopContextMenuHost`, `canOpenDesktopContextMenu`, `shouldUseNativeContextMenu`, `clampContextMenuPosition`.
- Consumes: React, `createPortal`, existing Tailwind tokens.

- [x] **Step 1: Write failing tests**

```tsx
// components/ui/DesktopContextMenu.test.tsx
import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import DesktopContextMenuHost from './DesktopContextMenu';
import { canOpenDesktopContextMenu, clampContextMenuPosition, shouldUseNativeContextMenu } from './contextMenuCore';
import { useDesktopContextMenu } from '../../hooks/useDesktopContextMenu';

function Harness({ onSelect = vi.fn() }: { onSelect?: () => void }) {
  const menu = useDesktopContextMenu();
  return (
    <>
      <div
        data-testid="target"
        onContextMenu={menu.bind([
          { id: 'edit', label: 'Editar', onSelect },
          { id: 'delete', label: 'Excluir', destructive: true, onSelect },
        ], { label: 'Ações do registro' })}
      >
        Registro
      </div>
      <DesktopContextMenuHost controller={menu} />
    </>
  );
}

describe('desktop context menu helpers', () => {
  it('allows custom context menus only on fine pointer desktop environments', () => {
    expect(canOpenDesktopContextMenu({ matches: true } as MediaQueryList)).toBe(true);
    expect(canOpenDesktopContextMenu({ matches: false } as MediaQueryList)).toBe(false);
  });

  it('keeps the native menu for form controls, buttons, links, media, editable content, and selected text', () => {
    document.body.innerHTML = `
      <input data-kind="input" />
      <textarea data-kind="textarea"></textarea>
      <select data-kind="select"></select>
      <button data-kind="button"></button>
      <a data-kind="link" href="#"></a>
      <img data-kind="image" />
      <div data-kind="editable" contenteditable="true"></div>
      <div data-kind="plain"></div>
    `;

    for (const kind of ['input', 'textarea', 'select', 'button', 'link', 'image', 'editable']) {
      expect(shouldUseNativeContextMenu(document.querySelector(`[data-kind="${kind}"]`))).toBe(true);
    }
    expect(shouldUseNativeContextMenu(document.querySelector('[data-kind="plain"]'))).toBe(false);
  });

  it('clamps menu position inside the viewport with an 8px margin', () => {
    expect(clampContextMenuPosition({ x: 790, y: 590, menuWidth: 220, menuHeight: 260, viewportWidth: 800, viewportHeight: 600 })).toEqual({ x: 572, y: 332 });
  });
});

describe('DesktopContextMenuHost', () => {
  it('opens from contextmenu, runs actions, and closes with Escape', async () => {
    window.matchMedia = vi.fn().mockReturnValue({ matches: true, addEventListener: vi.fn(), removeEventListener: vi.fn() });
    const onSelect = vi.fn();
    render(<Harness onSelect={onSelect} />);

    fireEvent.contextMenu(screen.getByTestId('target'), { clientX: 120, clientY: 140 });

    expect(screen.getByRole('menu', { name: 'Ações do registro' })).toBeInTheDocument();
    await userEvent.click(screen.getByRole('menuitem', { name: 'Editar' }));
    expect(onSelect).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();

    fireEvent.contextMenu(screen.getByTestId('target'), { clientX: 120, clientY: 140 });
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
  });
});
```

- [x] **Step 2: Run tests red**

Run: `npx vitest run components/ui/DesktopContextMenu.test.tsx`

Expected: FAIL because the new files and exports do not exist.

- [x] **Step 3: Implement minimal primitive**

```ts
// components/ui/contextMenuCore.ts
import type React from 'react';

export type ContextMenuAction = {
  id: string;
  label: string;
  icon?: React.ReactNode;
  hint?: string;
  disabled?: boolean;
  loading?: boolean;
  destructive?: boolean;
  separatorBefore?: boolean;
  onSelect: () => void | Promise<void>;
};

export type ContextMenuOpenOptions = {
  label: string;
};

const NATIVE_SELECTOR = [
  'input',
  'textarea',
  'select',
  'option',
  'button',
  'a[href]',
  'video',
  'audio',
  'img',
  '[contenteditable="true"]',
  '[data-native-context-menu="true"]',
].join(',');

export function canOpenDesktopContextMenu(mediaQuery: Pick<MediaQueryList, 'matches'> | null | undefined): boolean {
  return Boolean(mediaQuery?.matches);
}

export function hasSelectedText(selection: Selection | null | undefined = typeof window !== 'undefined' ? window.getSelection() : null): boolean {
  return Boolean(selection && !selection.isCollapsed && selection.toString().trim());
}

export function shouldUseNativeContextMenu(target: EventTarget | null, selection?: Selection | null): boolean {
  if (hasSelectedText(selection)) return true;
  if (!(target instanceof Element)) return false;
  return Boolean(target.closest(NATIVE_SELECTOR));
}

export function clampContextMenuPosition(input: {
  x: number;
  y: number;
  menuWidth: number;
  menuHeight: number;
  viewportWidth: number;
  viewportHeight: number;
  margin?: number;
}): { x: number; y: number } {
  const margin = input.margin ?? 8;
  return {
    x: Math.max(margin, Math.min(input.x, input.viewportWidth - input.menuWidth - margin)),
    y: Math.max(margin, Math.min(input.y, input.viewportHeight - input.menuHeight - margin)),
  };
}
```

```tsx
// hooks/useDesktopContextMenu.tsx
import { useCallback, useMemo, useState } from 'react';
import { canOpenDesktopContextMenu, shouldUseNativeContextMenu, type ContextMenuAction, type ContextMenuOpenOptions } from '../components/ui/desktopContextMenu';

export type DesktopContextMenuState = {
  open: boolean;
  x: number;
  y: number;
  label: string;
  actions: ContextMenuAction[];
};

export function useDesktopContextMenu() {
  const [state, setState] = useState<DesktopContextMenuState>({ open: false, x: 0, y: 0, label: 'Ações', actions: [] });

  const close = useCallback(() => {
    setState((current) => ({ ...current, open: false }));
  }, []);

  const bind = useCallback((actions: ContextMenuAction[], options: ContextMenuOpenOptions) => {
    return (event: React.MouseEvent<HTMLElement>) => {
      const mediaQuery = typeof window === 'undefined' ? null : window.matchMedia('(hover: hover) and (pointer: fine)');
      if (!canOpenDesktopContextMenu(mediaQuery) || shouldUseNativeContextMenu(event.target)) return;
      const availableActions = actions.filter(Boolean);
      if (availableActions.length === 0) return;
      event.preventDefault();
      setState({ open: true, x: event.clientX, y: event.clientY, label: options.label, actions: availableActions });
    };
  }, []);

  const runAction = useCallback(async (action: ContextMenuAction) => {
    if (action.disabled || action.loading) return;
    close();
    await action.onSelect();
  }, [close]);

  return useMemo(() => ({ state, bind, close, runAction }), [bind, close, runAction, state]);
}
```

```tsx
// components/ui/DesktopContextMenu.tsx
import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Loader2 } from 'lucide-react';
import { clampContextMenuPosition } from './desktopContextMenu';
import type { useDesktopContextMenu } from '../../hooks/useDesktopContextMenu';

type Controller = ReturnType<typeof useDesktopContextMenu>;
const MENU_WIDTH = 248;
const MENU_MAX_HEIGHT = 360;

export default function DesktopContextMenuHost({ controller }: { controller: Controller }) {
  const { state, close, runAction } = controller;
  const menuRef = useRef<HTMLDivElement | null>(null);
  const [position, setPosition] = useState({ x: state.x, y: state.y });

  useLayoutEffect(() => {
    if (!state.open) return;
    const rect = menuRef.current?.getBoundingClientRect();
    setPosition(clampContextMenuPosition({
      x: state.x,
      y: state.y,
      menuWidth: rect?.width || MENU_WIDTH,
      menuHeight: Math.min(rect?.height || MENU_MAX_HEIGHT, MENU_MAX_HEIGHT),
      viewportWidth: window.innerWidth,
      viewportHeight: window.innerHeight,
    }));
  }, [state.open, state.x, state.y, state.actions.length]);

  useEffect(() => {
    if (!state.open) return undefined;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') close();
    };
    const onPointerDown = (event: PointerEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) close();
    };
    const onScroll = () => close();
    document.addEventListener('keydown', onKeyDown);
    document.addEventListener('pointerdown', onPointerDown);
    window.addEventListener('scroll', onScroll, true);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.removeEventListener('pointerdown', onPointerDown);
      window.removeEventListener('scroll', onScroll, true);
    };
  }, [close, state.open]);

  if (!state.open) return null;

  return createPortal(
    <div
      ref={menuRef}
      role="menu"
      aria-label={state.label}
      className="fixed z-[60] max-h-[360px] w-[248px] overflow-y-auto rounded-xl border border-gray-200 bg-white py-1 text-sm text-gray-900 shadow-xl shadow-slate-900/10 ring-1 ring-black/5 dark:border-surface-dark-200 dark:bg-surface-dark-100 dark:text-white dark:shadow-black/30"
      style={{ left: position.x, top: position.y }}
    >
      {state.actions.map((action) => (
        <button
          key={action.id}
          type="button"
          role="menuitem"
          disabled={action.disabled || action.loading}
          className={`flex min-h-10 w-full items-center gap-3 px-3.5 py-2.5 text-left font-medium transition-colors hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-55 dark:hover:bg-surface-dark-200 ${action.separatorBefore ? 'mt-1 border-t border-gray-100 dark:border-surface-dark-200' : ''} ${action.destructive ? 'text-red-700 hover:bg-red-50 dark:text-red-300 dark:hover:bg-red-950/30' : 'text-gray-700 dark:text-surface-dark-700'}`}
          onClick={() => void runAction(action)}
        >
          <span className="inline-flex h-5 w-5 shrink-0 items-center justify-center" aria-hidden="true">
            {action.loading ? <Loader2 size={16} className="animate-spin" /> : action.icon}
          </span>
          <span className="min-w-0 flex-1">
            <span className="block truncate">{action.label}</span>
            {action.hint && <span className="block truncate text-xs font-normal text-gray-500 dark:text-surface-dark-500">{action.hint}</span>}
          </span>
        </button>
      ))}
    </div>,
    document.body,
  );
}
```

- [x] **Step 4: Run tests green**

Run: `npx vitest run components/ui/DesktopContextMenu.test.tsx`

Expected: PASS.

## Task 2: Inventory Context Actions

**Files:**
- Modify: `pages/Inventory.tsx`
- Modify: `pages/Inventory.test.tsx`

**Interfaces:**
- Consumes: `useDesktopContextMenu`, `DesktopContextMenuHost`, existing `openDetailsModal`, `openEditModal`, `openReserveModal`, `handleReleaseReservation`, `toggleSpecialShareItem`, `formatCurrencyBRL`, permissions.
- Produces: desktop right-click menu on stock cards and table rows.

- [x] **Step 1: Write failing Inventory tests**

Add tests that mock desktop `matchMedia`, right-click an inventory row/card, and assert:

```tsx
fireEvent.contextMenu(screen.getByText('iPhone 16').closest('tr') ?? screen.getByText('iPhone 16'));
expect(screen.getByRole('menu', { name: /Ações de iPhone 16/i })).toBeInTheDocument();
expect(screen.getByRole('menuitem', { name: 'Ver detalhes' })).toBeInTheDocument();
expect(screen.getByRole('menuitem', { name: 'Editar' })).toBeInTheDocument();
expect(screen.getByRole('menuitem', { name: 'Copiar resumo' })).toBeInTheDocument();
```

Also extend the read-only permission test to assert `Editar` is absent from the context menu.

- [x] **Step 2: Run Inventory tests red**

Run: `npx vitest run pages/Inventory.test.tsx -t "context menu|read-only"`

Expected: FAIL because no context menu exists.

- [x] **Step 3: Implement Inventory actions**

Use this shape inside `Inventory`:

```tsx
const contextMenu = useDesktopContextMenu();

const buildInventoryContextActions = (item: StockItem): ContextMenuAction[] => [
  { id: 'details', label: 'Ver detalhes', icon: <Smartphone size={16} />, onSelect: () => openDetailsModal(item) },
  ...(canEditInventory ? [{ id: 'edit', label: 'Editar', icon: <Edit size={16} />, onSelect: () => openEditModal(item) }] : []),
  ...(canEditInventory && item.status === StockStatus.AVAILABLE ? [{ id: 'reserve', label: 'Reservar', icon: <Tag size={16} />, onSelect: () => openReserveModal(item) }] : []),
  ...(canEditInventory && item.status === StockStatus.RESERVED ? [{ id: 'release', label: 'Liberar reserva', icon: <RotateCcw size={16} />, onSelect: () => void handleReleaseReservation(item) }] : []),
  ...(item.imei ? [{ id: 'copy-imei', label: 'Copiar IMEI/Serial', icon: <Copy size={16} />, separatorBefore: true, onSelect: () => void copyText(item.imei || '', 'IMEI/Serial copiado.') }] : []),
  { id: 'copy-summary', label: 'Copiar resumo', icon: <Copy size={16} />, onSelect: () => void copyText(buildInventoryContextSummary(item), 'Resumo copiado.') },
];
```

Bind it to stock `m.div` cards and `m.tr` rows:

```tsx
onContextMenu={contextMenu.bind(buildInventoryContextActions(item), { label: `Ações de ${item.model}` })}
```

Render once near the end of the page:

```tsx
<DesktopContextMenuHost controller={contextMenu} />
```

- [x] **Step 4: Run Inventory tests green**

Run: `npx vitest run pages/Inventory.test.tsx -t "context menu|read-only"`

Expected: PASS.

## Task 3: Sales History Context Actions

**Files:**
- Modify: `pages/PDVHistory.tsx`
- Modify: `pages/PDVHistory.test.tsx`

**Interfaces:**
- Consumes: `setSaleToView`, `setSaleToEdit`, `setSaleToCancel`, `setSaleToEditComplete`, `isAdmin`, `formatSaleNumber`, existing sale helpers.
- Produces: desktop right-click menu on sale cards and table rows.

- [x] **Step 1: Write failing PDVHistory tests**

Add a desktop context-menu test that right-clicks a sale row and expects `Ver detalhes`, `Copiar número da venda`, and admin actions when the user is admin.

- [x] **Step 2: Run PDVHistory tests red**

Run: `npx vitest run pages/PDVHistory.test.tsx -t "context menu|Editar Venda Concluida"`

Expected: FAIL for context-menu assertions.

- [x] **Step 3: Implement sale context actions**

Inside `PDVHistory`, create:

```tsx
const contextMenu = useDesktopContextMenu();
const copySaleNumber = async (sale: Sale) => {
  await navigator.clipboard?.writeText(formatSaleNumber(sale));
  toast.success('Número da venda copiado.');
};
const buildSaleContextActions = (sale: Sale): ContextMenuAction[] => [
  { id: 'details', label: 'Ver detalhes', icon: <Eye size={16} />, onSelect: () => setSaleToView(sale) },
  ...(isAdmin ? [{ id: 'edit', label: 'Editar', icon: <Edit size={16} />, onSelect: () => setSaleToEdit(sale) }] : []),
  ...(isAdmin ? [{ id: 'complete-edit', label: 'Edição completa', icon: <Edit size={16} />, onSelect: () => setSaleToEditComplete(sale) }] : []),
  { id: 'copy-number', label: 'Copiar número da venda', icon: <Copy size={16} />, separatorBefore: true, onSelect: () => void copySaleNumber(sale) },
  ...(isAdmin ? [{ id: 'cancel', label: 'Cancelar venda', icon: <RotateCcw size={16} />, destructive: true, separatorBefore: true, onSelect: () => setSaleToCancel(sale) }] : []),
];
```

Bind to mobile sale cards and desktop sale rows, and render `DesktopContextMenuHost`.

- [x] **Step 4: Run PDVHistory tests green**

Run: `npx vitest run pages/PDVHistory.test.tsx -t "context menu|Editar Venda Concluida"`

Expected: PASS.

## Task 4: CRM Message Bubble Context Actions

**Files:**
- Modify: `components/crm/MessageBubble.tsx`
- Modify: `components/crm/MessageBubble.test.tsx`

**Interfaces:**
- Consumes: existing `onReply`, `onReact`, `onEdit`, `onForward`, `onDelete`, provider permission checks.
- Produces: right-click menu on message bubbles with the same actions as the three-dot menu.

- [x] **Step 1: Write failing MessageBubble tests**

Extend the existing contextual action menu tests to right-click the message article and assert `Responder`, `Encaminhar`, and outbound-only `Editar mensagem`/`Apagar para todos`.

- [x] **Step 2: Run MessageBubble tests red**

Run: `npx vitest run components/crm/MessageBubble.test.tsx -t "contextual action menu|right-click"`

Expected: FAIL because right-click is not wired.

- [x] **Step 3: Implement shared action builder in MessageBubble**

Create one `messageContextActions` array and use it for right-click. Keep the visible three-dot menu markup or gradually adapt it to the same action list.

```tsx
const contextMenu = useDesktopContextMenu();
const messageContextActions: ContextMenuAction[] = [
  ...(onReply ? [{ id: 'reply', label: 'Responder', icon: <Reply size={16} />, onSelect: () => onReply(message) }] : []),
  ...(canEditOrDelete && onEdit ? [{ id: 'edit', label: 'Editar mensagem', icon: <Edit3 size={16} />, onSelect: () => onEdit(message) }] : []),
  ...(onForward ? [{ id: 'forward', label: 'Encaminhar', icon: <Forward size={16} />, onSelect: () => onForward(message) }] : []),
  ...(canEditOrDelete && onDelete ? [{ id: 'delete', label: 'Apagar para todos', icon: <Trash2 size={16} />, destructive: true, separatorBefore: true, onSelect: () => onDelete(message) }] : []),
];
```

Bind it to the root `<article>` and render `DesktopContextMenuHost`.

- [x] **Step 4: Run MessageBubble tests green**

Run: `npx vitest run components/crm/MessageBubble.test.tsx -t "contextual action menu|right-click"`

Expected: PASS.

## Task 5: Generic CRM CRUD Context Actions

**Files:**
- Modify: `components/crm/CRMSimpleCrud.tsx`
- Create or modify: `components/crm/CRMSimpleCrud.test.tsx`

**Interfaces:**
- Consumes: existing `startEdit(row)` and `remove(row)`.
- Produces: right-click menu for CRM admin rows/cards reused by multiple pages.

- [x] **Step 1: Write failing CRMSimpleCrud test**

Render the component with a mocked Supabase response, right-click a row/card, and assert `Editar` and `Remover` appear and call the existing flows.

- [x] **Step 2: Run CRMSimpleCrud test red**

Run: `npx vitest run components/crm/CRMSimpleCrud.test.tsx`

Expected: FAIL because the test file or behavior does not exist.

- [x] **Step 3: Implement CRMSimpleCrud actions**

Inside `CRMSimpleCrud`, add:

```tsx
const contextMenu = useDesktopContextMenu();
const buildRowContextActions = (row: Record<string, any>): ContextMenuAction[] => [
  { id: 'edit', label: 'Editar', icon: <Save size={16} />, onSelect: () => startEdit(row) },
  { id: 'remove', label: 'Remover', icon: <Trash2 size={16} />, destructive: true, separatorBefore: true, onSelect: () => void remove(row) },
];
```

Bind to mobile `article` and desktop `tr`, and render `DesktopContextMenuHost`.

- [x] **Step 4: Run CRMSimpleCrud test green**

Run: `npx vitest run components/crm/CRMSimpleCrud.test.tsx`

Expected: PASS.

## Task 6: Final Verification

**Files:**
- No new files unless tests reveal targeted fixes.

**Interfaces:**
- Consumes: all previous tasks.
- Produces: verified implementation on `main`.

- [x] **Step 1: Run focused test suite**

Run:

```bash
npx vitest run components/ui/DesktopContextMenu.test.tsx pages/Inventory.test.tsx pages/PDVHistory.test.tsx components/crm/MessageBubble.test.tsx components/crm/CRMSimpleCrud.test.tsx
```

Expected: PASS.

- [x] **Step 2: Run typecheck**

Run: `npm run typecheck`

Expected: PASS.

- [x] **Step 3: Run lint if typecheck passes**

Run: `npm run lint`

Expected: PASS or report only pre-existing unrelated issues with evidence.

- [x] **Step 4: Review diff**

Run: `git diff --stat && git diff --check`

Expected: `git diff --check` exits 0.
