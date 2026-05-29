# CRM Plus Mobile Shell and Conversations HIG Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship the approved mobile-first HIG evolution for CRM Plus shell and Conversations.

**Architecture:** Keep CRM routing, permissions, and data behavior unchanged. Add UI-only navigation derivations in `CRMStandaloneLayout.tsx`, style them through CRM-specific classes in `index.css`, and refine Conversations/MessageBubble markup with semantic class hooks that tests can assert. Use TDD for each behavior-facing UI change.

**Tech Stack:** React 19, React Router, TypeScript, Tailwind utility classes, lucide-react, framer-motion, Vitest, Testing Library, Vite.

---

## File Structure

- `components/crm/CRMStandaloneLayout.tsx`: derive primary mobile tabs and overflow pages from existing `CRM_PAGE_ACCESS`; render desktop sidebar, mobile bottom tab bar, and mobile overflow sheet.
- `index.css`: update CRM shell tokens and add classes for mobile bottom navigation, overflow sheet, calmer desktop sidebar, compact CRM main spacing, and conversation-specific refinements.
- `components/crm/CRMStandaloneLayout.test.tsx`: verify mobile bottom navigation, overflow sheet role filtering, existing simulator visibility, and absence of global store selector.
- `pages/crm/ConversationsPage.tsx`: refine chat list classes, compact active chat header, lighter thread/list surfaces, and composer spacing without changing data or message behavior.
- `pages/crm/ConversationsPage.newConversation.test.tsx`: verify compact mobile header semantics and existing mobile filter behavior.
- `components/crm/MessageBubble.tsx`: add semantic tone classes and adjust bubble visual treatment while preserving content/media/action behavior.
- `components/crm/MessageBubble.test.tsx`: verify tone class behavior for inbound, outbound human, and outbound AI bubbles.

## Task 1: Mobile Bottom Navigation and Overflow Sheet

**Files:**
- Modify: `components/crm/CRMStandaloneLayout.tsx`
- Modify: `components/crm/CRMStandaloneLayout.test.tsx`
- Modify: `index.css`

- [ ] **Step 1: Write failing mobile navigation tests**

Add tests to `components/crm/CRMStandaloneLayout.test.tsx`:

```tsx
it("renders a five-item bottom tab bar on mobile with role-aware primary pages", () => {
  vi.mocked(window.matchMedia).mockImplementation((query: string) => ({
    matches: query === "(max-width: 1024px)",
    media: query,
    onchange: null,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    addListener: vi.fn(),
    removeListener: vi.fn(),
    dispatchEvent: vi.fn(),
  }));

  render(
    <MemoryRouter initialEntries={["/"]}>
      <Routes>
        <Route element={<CRMStandaloneLayout />}>
          <Route index element={<div>Conteúdo CRM</div>} />
        </Route>
      </Routes>
    </MemoryRouter>,
  );

  const tabBar = screen.getByRole("navigation", { name: "Navegação principal CRM" });
  expect(tabBar).toHaveClass("crm-mobile-tabbar");
  expect(within(tabBar).getAllByRole("link")).toHaveLength(4);
  expect(within(tabBar).getByRole("link", { name: /Conversas/i })).toBeInTheDocument();
  expect(within(tabBar).getByRole("link", { name: /Leads/i })).toBeInTheDocument();
  expect(within(tabBar).getByRole("link", { name: /Simulador/i })).toBeInTheDocument();
  expect(within(tabBar).getByRole("link", { name: /Estatísticas/i })).toBeInTheDocument();
  expect(within(tabBar).getByRole("button", { name: /Mais/i })).toBeInTheDocument();
});

it("opens the mobile more sheet with overflow pages allowed for the current role", async () => {
  const user = userEvent.setup();
  vi.mocked(window.matchMedia).mockImplementation((query: string) => ({
    matches: query === "(max-width: 1024px)",
    media: query,
    onchange: null,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    addListener: vi.fn(),
    removeListener: vi.fn(),
    dispatchEvent: vi.fn(),
  }));

  render(
    <MemoryRouter initialEntries={["/"]}>
      <Routes>
        <Route element={<CRMStandaloneLayout />}>
          <Route index element={<div>Conteúdo CRM</div>} />
        </Route>
      </Routes>
    </MemoryRouter>,
  );

  await user.click(screen.getByRole("button", { name: /Mais/i }));

  const sheet = screen.getByRole("dialog", { name: "Mais páginas do CRM" });
  expect(within(sheet).getByRole("link", { name: /Comentários/i })).toBeInTheDocument();
  expect(within(sheet).getByRole("link", { name: /Configurações/i })).toBeInTheDocument();
});
```

Also import `within` and `userEvent`.

- [ ] **Step 2: Run tests and verify RED**

Run: `npm test -- components/crm/CRMStandaloneLayout.test.tsx`

Expected: FAIL because `crm-mobile-tabbar` and the `Mais páginas do CRM` dialog do not exist.

- [ ] **Step 3: Implement layout navigation**

In `CRMStandaloneLayout.tsx`, add state `isMoreOpen`, create primary mobile page IDs `["conversations", "leads", "simulator", "statistics"]`, derive `mobilePrimaryItems` and `mobileOverflowItems` from `visibleItems`, render a bottom nav after `<main>`, and render a bottom sheet for overflow pages. Keep desktop sidebar links unchanged in behavior.

- [ ] **Step 4: Add shell CSS**

In `index.css`, add `.crm-mobile-tabbar`, `.crm-mobile-tabbar-item`, `.crm-mobile-more-backdrop`, `.crm-mobile-more-sheet`, and adjust `.crm-main` mobile padding bottom to account for the bottom tab bar.

- [ ] **Step 5: Run tests and verify GREEN**

Run: `npm test -- components/crm/CRMStandaloneLayout.test.tsx`

Expected: PASS.

## Task 2: Conversation Header and Chat List Semantics

**Files:**
- Modify: `pages/crm/ConversationsPage.tsx`
- Modify: `pages/crm/ConversationsPage.newConversation.test.tsx`
- Modify: `index.css`

- [ ] **Step 1: Write failing conversation UI tests**

Add tests to `pages/crm/ConversationsPage.newConversation.test.tsx`:

```tsx
it("uses a compact mobile conversation header when a chat is selected", async () => {
  conversationsData = existingConversations;
  vi.mocked(window.matchMedia).mockImplementation((query: string) => ({
    matches: true,
    media: query,
    onchange: null,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    addListener: vi.fn(),
    removeListener: vi.fn(),
    dispatchEvent: vi.fn(),
  }));

  render(<ConversationsPage />);

  await userEvent.click(await screen.findByText("Maria Silva"));

  const header = await screen.findByTestId("crm-conversation-compact-header");
  expect(header).toHaveClass("crm-conversation-compact-header");
  expect(within(header).getByRole("button", { name: "Voltar" })).toBeInTheDocument();
});

it("renders conversation rows with the refined grouped-list class", async () => {
  conversationsData = existingConversations;
  render(<ConversationsPage />);

  const row = await screen.findByRole("button", { name: /Maria Silva/i });
  expect(row).toHaveClass("crm-chat-row");
});
```

Also import `within`.

- [ ] **Step 2: Run tests and verify RED**

Run: `npm test -- pages/crm/ConversationsPage.newConversation.test.tsx`

Expected: FAIL because the compact header test id/class and `crm-chat-row` class do not exist.

- [ ] **Step 3: Implement conversation markup refinements**

In `ConversationsPage.tsx`, add `crm-chat-list-panel` to the list container, `crm-chat-row` to each conversation row, `data-testid="crm-conversation-compact-header"` and `crm-conversation-compact-header` to the active chat header, and reduce mobile header/content classes while preserving existing controls.

- [ ] **Step 4: Add conversation CSS**

In `index.css`, add CSS for `.crm-chat-list-panel`, `.crm-chat-row`, `.crm-conversation-compact-header`, smaller mobile header avatar sizing, grouped list separators, and safe-area-aware compact header behavior.

- [ ] **Step 5: Run tests and verify GREEN**

Run: `npm test -- pages/crm/ConversationsPage.newConversation.test.tsx`

Expected: PASS.

## Task 3: Message Bubble Tone System

**Files:**
- Modify: `components/crm/MessageBubble.tsx`
- Modify: `components/crm/MessageBubble.test.tsx`
- Modify: `index.css`

- [ ] **Step 1: Write failing tone tests**

Add tests to `components/crm/MessageBubble.test.tsx`:

```tsx
it("marks inbound bubbles with the neutral inbound tone class", () => {
  const { container } = renderBubble({
    id: "msg-tone-inbound",
    direction: "inbound",
    sender_type: "customer",
    content: "Oi",
    created_at: "2026-05-01T10:53:00.000Z",
    status: "read",
  });

  expect(container.querySelector(".crm-message-bubble--inbound")).toBeInTheDocument();
});

it("marks outbound human and AI bubbles with distinct tone classes", () => {
  const { container, rerender } = render(
    <LazyMotion features={domMax}>
      <MessageBubble
        message={{
          id: "msg-tone-human",
          direction: "outbound",
          sender_type: "human",
          content: "Mensagem humana",
          created_at: "2026-05-01T10:53:00.000Z",
          status: "sent",
        }}
      />
    </LazyMotion>,
  );

  expect(container.querySelector(".crm-message-bubble--outbound-human")).toBeInTheDocument();

  rerender(
    <LazyMotion features={domMax}>
      <MessageBubble
        message={{
          id: "msg-tone-ai",
          direction: "outbound",
          sender_type: "ai",
          content: "Mensagem IA",
          created_at: "2026-05-01T10:53:00.000Z",
          status: "sent",
        }}
      />
    </LazyMotion>,
  );

  expect(container.querySelector(".crm-message-bubble--outbound-ai")).toBeInTheDocument();
});
```

- [ ] **Step 2: Run tests and verify RED**

Run: `npm test -- components/crm/MessageBubble.test.tsx`

Expected: FAIL because tone classes do not exist.

- [ ] **Step 3: Implement tone classes and lighter markup**

In `MessageBubble.tsx`, add base class `crm-message-bubble` and tone classes for inbound, outbound human, outbound AI, and sticker-only. Shift visual responsibility to CSS while preserving existing media, reply, reaction, status, and action menu behavior.

- [ ] **Step 4: Add bubble CSS**

In `index.css`, define `.crm-message-bubble`, `.crm-message-bubble--inbound`, `.crm-message-bubble--outbound-human`, `.crm-message-bubble--outbound-ai`, and mobile max-width rules under `@media (max-width: 1024px)`.

- [ ] **Step 5: Run tests and verify GREEN**

Run: `npm test -- components/crm/MessageBubble.test.tsx`

Expected: PASS.

## Task 4: Integrated Verification and Visual QA

**Files:**
- Modify only if verification reveals a defect in files touched by Tasks 1-3.

- [ ] **Step 1: Run focused tests**

Run:

```bash
npm test -- components/crm/CRMStandaloneLayout.test.tsx pages/crm/ConversationsPage.newConversation.test.tsx components/crm/MessageBubble.test.tsx
```

Expected: PASS.

- [ ] **Step 2: Run typecheck**

Run: `npm run typecheck`

Expected: PASS.

- [ ] **Step 3: Build**

Run: `npm run build`

Expected: PASS.

- [ ] **Step 4: Manual browser QA**

Run: `npm run dev -- --host 127.0.0.1`.

Open the CRM Plus route in browser testing at:

- 393x852 mobile
- 375x667 small mobile
- 1440x900 desktop

Verify:

- bottom tab appears only on mobile;
- `Mais` opens a sheet and links close it;
- conversation composer does not overlap the bottom tab when no keyboard is open;
- selected chat header is compact;
- desktop keeps two-column conversation layout;
- no horizontal overflow.

- [ ] **Step 5: Commit implementation**

Run:

```bash
git add components/crm/CRMStandaloneLayout.tsx components/crm/CRMStandaloneLayout.test.tsx pages/crm/ConversationsPage.tsx pages/crm/ConversationsPage.newConversation.test.tsx components/crm/MessageBubble.tsx components/crm/MessageBubble.test.tsx index.css docs/superpowers/plans/2026-05-29-crm-plus-mobile-shell-conversations-hig.md
git commit -m "feat: refine crm plus mobile shell and conversations"
```

Expected: commit succeeds and leaves only unrelated pre-existing untracked files.
