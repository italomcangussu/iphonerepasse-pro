# Tablet Temporal Input Layout Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Prevent iOS temporal inputs and Dashboard columns from overflowing at tablet widths.

**Architecture:** Apply the browser-specific constraint in the shared `.ios-input` primitive so every ERP temporal field inherits it. Delay Dashboard desktop grids until `xl`, then extend the existing responsive smoke suite with tablet geometry checks.

**Tech Stack:** React 19, Tailwind CSS v4, Vitest, Playwright, WebKit.

## Global Constraints

- Preserve the existing UI tokens and visual direction.
- Do not change form data, submission behavior, or business logic.
- Protect 768, 820, 834, 1024, and 1194px viewports.
- Write and observe a failing regression test before production changes.

---

### Task 1: Add failing layout contracts

**Files:**
- Create: `tests/tablet-input-layout-contract.test.ts`

**Interfaces:**
- Consumes: `index.css`, `pages/Dashboard.tsx`, `tests/smoke/erp-responsive-ui.smoke.spec.ts`
- Produces: source-level contracts for iOS temporal sizing, Dashboard breakpoints, and smoke coverage

- [x] Write assertions for the iOS support block and temporal value pseudo-element.
- [x] Assert Dashboard three-column classes use `xl`, not `lg`.
- [x] Assert all required tablet widths and the Dashboard route exist in smoke coverage.
- [x] Run `npx vitest run tests/tablet-input-layout-contract.test.ts` and confirm it fails for the missing rules.

### Task 2: Implement the shared iOS and Dashboard fix

**Files:**
- Modify: `index.css`
- Modify: `pages/Dashboard.tsx`

**Interfaces:**
- Consumes: `.ios-input`, `.dashboard-metrics-grid`
- Produces: contained temporal controls and tablet-safe Dashboard grids

- [x] Add the iOS-only temporal input constraints to `index.css`.
- [x] Change both Dashboard `lg:grid-cols-3` classes to `xl:grid-cols-3`.
- [x] Re-run the contract test and confirm it passes.

### Task 3: Extend browser regression coverage

**Files:**
- Modify: `tests/smoke/erp-responsive-ui.smoke.spec.ts`

**Interfaces:**
- Consumes: authenticated ERP smoke harness
- Produces: Dashboard route coverage and temporal input containment assertions

- [x] Add the Dashboard route and tablet viewport matrix.
- [x] Check each visible temporal input remains inside its parent and has no internal horizontal overflow.
- [x] Run affected Vitest tests, typecheck, and `git diff --check`.
- [x] Run a WebKit geometry audit and compile/list the authenticated smoke suite; executing it still requires valid smoke credentials.
