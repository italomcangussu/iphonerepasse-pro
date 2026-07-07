# CRM Plus Chat Thread UI Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn the CRM Plus message thread into a compact messenger-style conversation with sender/time clusters, correct delivery metadata, accessible actions, and a quieter conversation list.

**Architecture:** Add a pure presentation helper that derives cluster position without changing persisted messages. Feed that metadata through `ConversationMessagesPanel` into `MessageBubble`, keeping provider actions and message state intact. Simplify only the rendered hierarchy of conversation rows and the selected-conversation header; no API, database, routing, read-state, or composer behavior changes.

**Tech Stack:** React 19, TypeScript 5.8, Tailwind CSS v4, Framer Motion 12, Lucide React, Vitest 4, Testing Library.

## Global Constraints

- Work directly on the existing `main` branch as requested; do not create a worktree.
- A cluster may span at most five minutes and may not cross sender, direction, or day boundaries.
- Calendar dates appear only in day dividers; bubble metadata uses `HH:mm`.
- Inbound messages never display outbound provider delivery state.
- Preserve explicit mark-as-read; never mark a conversation read merely by opening it.
- Preserve per-conversation drafts, optimistic sends, failed-send retry, provider ticks, reply/react/edit/delete/forward, media recovery, scroll anchoring, pagination, dark mode, and mobile PWA composer behavior.
- Every interactive message action target is at least 44x44px.
- Do not add GSAP or new dependencies; use existing CSS and Framer Motion only.
- User-facing fallback copy is Brazilian Portuguese and never exposes internal payload labels.

## File map

- Create `components/crm/messageClusters.ts`: pure sender/day/time cluster derivation.
- Create `components/crm/messageClusters.test.ts`: cluster boundary characterization.
- Modify `components/crm/MessageBubble.tsx`: cluster presentation props, compact metadata, localized fallbacks, contrast, and 44px actions.
- Modify `components/crm/MessageBubble.test.tsx`: behavior and accessibility regressions.
- Modify `components/crm/ConversationMessagesPanel.tsx`: derive and pass presentation metadata.
- Modify `components/crm/ConversationMessagesPanel.test.tsx`: integration assertions for clustered rendering.
- Modify `components/crm/ConversationListItem.tsx`: two-line default hierarchy and exception-only badges.
- Modify `components/crm/ConversationListItem.test.tsx`: simplified row hierarchy and exception badges.
- Modify `pages/crm/ConversationsPage.tsx`: reduce selected-conversation secondary header metadata.
- Modify `index.css`: remove default message-card elevation while preserving overlay elevation.

---

### Task 1: Pure message cluster presentation

**Files:**
- Create: `components/crm/messageClusters.ts`
- Create: `components/crm/messageClusters.test.ts`

**Interfaces:**
- Consumes: `MessageBubbleMessage[]` from `components/crm/MessageBubble.tsx`.
- Produces: `buildMessagePresentation(messages, maxGapMs?) => MessagePresentation[]` where `MessagePresentation` contains `message`, `position`, and `separateFromPrevious`.

- [ ] **Step 1: Write failing cluster tests**

```ts
import { describe, expect, it } from 'vitest';
import type { MessageBubbleMessage } from './MessageBubble';
import { buildMessagePresentation } from './messageClusters';

const message = (
  id: string,
  createdAt: string,
  overrides: Partial<MessageBubbleMessage> = {},
): MessageBubbleMessage => ({
  id,
  direction: 'inbound',
  sender_type: 'customer',
  content: id,
  created_at: createdAt,
  status: 'read',
  ...overrides,
});

describe('buildMessagePresentation', () => {
  it('clusters consecutive messages from the same sender within five minutes', () => {
    const result = buildMessagePresentation([
      message('one', '2026-07-07T10:00:00.000Z'),
      message('two', '2026-07-07T10:04:59.000Z'),
    ]);
    expect(result.map(({ position }) => position)).toEqual(['first', 'last']);
    expect(result.map(({ separateFromPrevious }) => separateFromPrevious)).toEqual([false, false]);
  });

  it('separates messages after five minutes or when direction changes', () => {
    const result = buildMessagePresentation([
      message('one', '2026-07-07T10:00:00.000Z'),
      message('two', '2026-07-07T10:05:01.000Z'),
      message('three', '2026-07-07T10:06:00.000Z', { direction: 'outbound', sender_type: 'human' }),
    ]);
    expect(result.map(({ position }) => position)).toEqual(['single', 'single', 'single']);
    expect(result.map(({ separateFromPrevious }) => separateFromPrevious)).toEqual([false, true, true]);
  });

  it('keeps different participants in a group conversation separate', () => {
    const result = buildMessagePresentation([
      message('maria', '2026-07-07T10:00:00.000Z', { webhook_payload: { message: { sender_pn: 'maria@s.whatsapp.net' } } }),
      message('joao', '2026-07-07T10:01:00.000Z', { webhook_payload: { message: { sender_pn: 'joao@s.whatsapp.net' } } }),
    ]);
    expect(result.map(({ position }) => position)).toEqual(['single', 'single']);
  });
});
```

- [ ] **Step 2: Run the new tests and verify RED**

Run: `npx vitest run components/crm/messageClusters.test.ts`

Expected: FAIL because `./messageClusters` does not exist.

- [ ] **Step 3: Implement the pure cluster helper**

Create the exact public contract:

```ts
import type { MessageBubbleMessage } from './MessageBubble';

export type MessageClusterPosition = 'single' | 'first' | 'middle' | 'last';

export type MessagePresentation = {
  message: MessageBubbleMessage;
  position: MessageClusterPosition;
  separateFromPrevious: boolean;
};

export const MESSAGE_CLUSTER_MAX_GAP_MS = 5 * 60 * 1000;

export const buildMessagePresentation = (
  messages: MessageBubbleMessage[],
  maxGapMs = MESSAGE_CLUSTER_MAX_GAP_MS,
): MessagePresentation[] => {
  const asRecord = (value: unknown): Record<string, unknown> => (
    value && typeof value === 'object' && !Array.isArray(value)
      ? value as Record<string, unknown>
      : {}
  );
  const pick = (...values: unknown[]): string => {
    for (const value of values) {
      const text = typeof value === 'string' ? value.trim() : '';
      if (text) return text;
    }
    return '';
  };
  const senderKey = (message: MessageBubbleMessage): string => {
    const payload = asRecord(message.webhook_payload);
    const data = asRecord(payload.data);
    const rootMessage = asRecord(payload.message);
    const dataMessage = asRecord(data.message);
    const participant = pick(
      payload.sender_pn, payload.participant, payload.author, payload.id,
      data.sender_pn, data.participant, data.author, data.id,
      rootMessage.sender_pn, rootMessage.participant, rootMessage.author, rootMessage.id,
      dataMessage.sender_pn, dataMessage.participant, dataMessage.author, dataMessage.id,
    );
    return [
      message.direction,
      message.sender_type,
      message.sender_user_id || '',
      message.sender_display_name || '',
      participant,
    ].join('|');
  };
  const timestamp = (message: MessageBubbleMessage): number => {
    const value = new Date(message.sent_at || message.created_at).getTime();
    return Number.isFinite(value) ? value : Number.NaN;
  };
  const dayKey = (message: MessageBubbleMessage): string => {
    const date = new Date(message.sent_at || message.created_at);
    if (Number.isNaN(date.getTime())) return '';
    return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
  };
  const connects = (left: MessageBubbleMessage, right: MessageBubbleMessage): boolean => {
    const delta = timestamp(right) - timestamp(left);
    return senderKey(left) === senderKey(right)
      && dayKey(left) !== ''
      && dayKey(left) === dayKey(right)
      && delta >= 0
      && delta <= maxGapMs;
  };

  return messages.map((message, index) => {
    const connectsPrevious = index > 0 && connects(messages[index - 1], message);
    const connectsNext = index < messages.length - 1 && connects(message, messages[index + 1]);
    const position: MessageClusterPosition = connectsPrevious
      ? (connectsNext ? 'middle' : 'last')
      : (connectsNext ? 'first' : 'single');
    return {
      message,
      position,
      separateFromPrevious: index > 0 && !connectsPrevious,
    };
  });
};
```

Provider participant lookup must inspect `sender_pn`, `participant`, `author`, and `id` under the payload root, `payload.data`, `payload.message`, and `payload.data.message`. Invalid dates never connect.

- [ ] **Step 4: Run the helper tests and verify GREEN**

Run: `npx vitest run components/crm/messageClusters.test.ts`

Expected: 3 tests pass.

- [ ] **Step 5: Commit Task 1**

```bash
git add components/crm/messageClusters.ts components/crm/messageClusters.test.ts
git commit -m "feat(crm): derive compact message clusters"
```

---

### Task 2: Compact and accessible MessageBubble

**Files:**
- Modify: `components/crm/MessageBubble.tsx`
- Modify: `components/crm/MessageBubble.test.tsx`

**Interfaces:**
- Consumes: `MessageClusterPosition` from `components/crm/messageClusters.ts`.
- Produces: optional props `clusterPosition`, `separateFromPrevious`, `showSender`, and `showFooter`, all backward-compatible with standalone rendering.

- [ ] **Step 1: Add failing MessageBubble tests**

Add focused cases that assert:

```tsx
const baseInboundMessage: MessageBubbleMessage = {
  id: 'inbound-cluster',
  direction: 'inbound',
  sender_type: 'customer',
  content: 'Olá',
  created_at: '2026-07-07T10:00:00.000Z',
  status: 'read',
};

const baseOutboundMessage: MessageBubbleMessage = {
  id: 'outbound-cluster',
  direction: 'outbound',
  sender_type: 'human',
  content: 'Olá',
  created_at: '2026-07-07T10:00:00.000Z',
  status: 'sent',
};

it('hides repeated sender and footer inside a cluster', () => {
  renderBubble(baseInboundMessage, { clusterPosition: 'middle', showSender: false, showFooter: false });
  expect(screen.queryByText('Cliente')).not.toBeInTheDocument();
  expect(screen.queryByText('Lida')).not.toBeInTheDocument();
});

it('does not expose outbound delivery labels on inbound messages', () => {
  renderBubble({ ...baseInboundMessage, status: 'read' });
  expect(screen.queryByText('Lida')).not.toBeInTheDocument();
  expect(screen.queryByLabelText('Status: Lida')).not.toBeInTheDocument();
});

it('keeps outbound delivery state accessible without repeating visible text', () => {
  renderBubble({ ...baseOutboundMessage, status: 'delivered' });
  expect(screen.getByLabelText('Status: Entregue')).toBeInTheDocument();
  expect(screen.queryByText('Entregue')).not.toBeInTheDocument();
});

it('uses localized safe fallbacks', () => {
  renderBubble({ ...baseInboundMessage, content: null, webhook_payload: null });
  expect(screen.getByText('Mensagem sem conteúdo disponível.')).toBeInTheDocument();
  expect(screen.queryByText(/system: empty payload/i)).not.toBeInTheDocument();
});

it('gives the inbound actions trigger a visible neutral tone and 44px target', () => {
  renderBubble(baseInboundMessage);
  expect(screen.getByRole('button', { name: 'Mais ações da mensagem' }))
    .toHaveClass('min-h-11', 'min-w-11', 'text-slate-700');
});
```

Use complete inbound/outbound fixtures in the test file; do not depend on test order.

- [ ] **Step 2: Run MessageBubble tests and verify RED**

Run: `npx vitest run components/crm/MessageBubble.test.tsx`

Expected: new tests fail because the props, compact status behavior, localized empty copy, and hit-target classes are absent.

- [ ] **Step 3: Implement presentation props and metadata rules**

Update `Props` with:

```ts
clusterPosition?: MessageClusterPosition;
separateFromPrevious?: boolean;
showSender?: boolean;
showFooter?: boolean;
```

Defaults are `single`, `false`, `true`, and `true`. Replace the formatter with `toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })`. Change sender fallbacks to `IA`, `Você`, and `Cliente`. Replace `[system: empty payload]` with `Mensagem sem conteúdo disponível.`

Render sender only when `showSender`. Render the footer only when `showFooter`. Inside the footer, render provider status only when `isOutbound`; give the status wrapper `aria-label={`Status: ${label}`}`. Show status text visually only for `pending` and `failed`; place the other status text in `sr-only` or omit it after the accessible label is present.

- [ ] **Step 4: Implement action contrast, hit targets, and cluster geometry**

- Main action trigger: `min-h-11 min-w-11`.
- Inbound trigger: `border-slate-200 bg-white/90 text-slate-700 hover:bg-white dark:border-slate-600 dark:bg-slate-900/90 dark:text-slate-100`.
- Colored outbound triggers: translucent white border/background with white text.
- Reaction buttons and menu items: `min-h-11 min-w-11`; widen the menu to `w-[18rem] max-w-[calc(100vw-2rem)]` so six reactions fit.
- Remove the 16x16 `Responder esta mensagem` shortcut; reply remains in the menu/context menu.
- Add `data-cluster-position={clusterPosition}` and `mt-2` only when `separateFromPrevious`.
- Use tighter connected-corner classes for `first`, `middle`, and `last`, preserving left alignment for inbound and `ml-auto` for outbound.
- Add `min-h-11`, `px-3`, and `py-2`; retain responsive max widths.

- [ ] **Step 5: Run MessageBubble tests and verify GREEN**

Run: `npx vitest run components/crm/MessageBubble.test.tsx`

Expected: all MessageBubble tests pass.

- [ ] **Step 6: Commit Task 2**

```bash
git add components/crm/MessageBubble.tsx components/crm/MessageBubble.test.tsx
git commit -m "refactor(crm): compact message bubble metadata"
```

---

### Task 3: Integrate clusters into the thread and remove card elevation

**Files:**
- Modify: `components/crm/ConversationMessagesPanel.tsx`
- Modify: `components/crm/ConversationMessagesPanel.test.tsx`
- Modify: `index.css`

**Interfaces:**
- Consumes: `buildMessagePresentation()` from Task 1 and MessageBubble presentation props from Task 2.
- Produces: clustered message rendering inside each existing day section.

- [ ] **Step 1: Add failing panel integration test**

Render one day group containing two inbound messages four minutes apart and one outbound message. Assert:

```tsx
const bubbles = container.querySelectorAll('.crm-message-bubble');
expect(bubbles).toHaveLength(3);
expect(bubbles[0]).toHaveAttribute('data-cluster-position', 'first');
expect(bubbles[1]).toHaveAttribute('data-cluster-position', 'last');
expect(bubbles[2]).toHaveAttribute('data-cluster-position', 'single');
expect(screen.getAllByText('Cliente')).toHaveLength(1);
```

Provide `provider_message_id` values so existing action behavior remains representative.

- [ ] **Step 2: Run panel tests and verify RED**

Run: `npx vitest run components/crm/ConversationMessagesPanel.test.tsx`

Expected: cluster attributes and de-duplicated sender assertions fail.

- [ ] **Step 3: Pass presentation metadata into each bubble**

For every existing day group:

```tsx
const presentedMessages = buildMessagePresentation(group.messages);

{presentedMessages.map(({ message, position, separateFromPrevious }) => (
  <MessageBubble
    key={message.id}
    message={message}
    clusterPosition={position}
    separateFromPrevious={separateFromPrevious}
    showSender={position === 'single' || position === 'first'}
    showFooter={position === 'single' || position === 'last'}
    reactionSummary={reactionsMap.get(message.provider_message_id || '')}
    metaCampaign={resolveMetaCampaignPreviewData({ webhookPayload: message.webhook_payload as Record<string, unknown> | null })}
    onReply={setReplyingTo}
    onReact={(target, emoji) => void reactToMessage(target, emoji)}
    onForward={openForwardMessage}
    onEdit={openEditMessage}
    onDelete={(target) => void deleteMessageForEveryone(target)}
    onOpenMedia={onOpenMedia}
    onScrollToReply={scrollToMessage}
    onRetry={retryMessage}
  />
))}
```

Change the day section to `space-y-6` and the message stack to `gap-1`. Do not change scrolling, loading, empty, error, or new-message-pill code.

- [ ] **Step 4: Remove permanent bubble elevation**

In `index.css`, change `.crm-message-bubble` to `box-shadow: none` and remove the mobile selector that reapplies a shadow to inbound/human/AI bubbles. Keep shadows on action menus, reaction badges, retry controls, composer overlays, and modal sheets.

- [ ] **Step 5: Run thread and bubble suites**

Run: `npx vitest run components/crm/messageClusters.test.ts components/crm/MessageBubble.test.tsx components/crm/ConversationMessagesPanel.test.tsx`

Expected: all focused thread tests pass.

- [ ] **Step 6: Commit Task 3**

```bash
git add components/crm/ConversationMessagesPanel.tsx components/crm/ConversationMessagesPanel.test.tsx index.css
git commit -m "refactor(crm): render clustered message thread"
```

---

### Task 4: Simplify conversation rows and selected header

**Files:**
- Modify: `components/crm/ConversationListItem.tsx`
- Modify: `components/crm/ConversationListItem.test.tsx`
- Modify: `pages/crm/ConversationsPage.tsx`

**Interfaces:**
- Consumes: existing `ConversationRow`, provider helpers, exception-state helpers, and `ownershipLabel`.
- Produces: the same button/select callback API with less repeated visual metadata.

- [ ] **Step 1: Add failing row hierarchy tests**

Extend `ConversationListItem.test.tsx`:

```tsx
it('omits the generic status chip from a normal open conversation', () => {
  render(<ConversationListItem conversation={conversation} selected={false} onSelect={vi.fn()} />);
  expect(screen.queryByText('Aberta')).not.toBeInTheDocument();
  expect(screen.getByText('Pode simular?')).toBeInTheDocument();
  expect(screen.getByText(/WhatsApp/)).toBeInTheDocument();
});

it('keeps actionable exception badges', () => {
  render(<ConversationListItem
    conversation={{ ...conversation, crm_leads: { ...conversation.crm_leads!, conversation_status: 'transferencia_pendente' } }}
    selected={false}
    onSelect={vi.fn()}
  />);
  expect(screen.getByText('Transferência pendente')).toBeInTheDocument();
});
```

- [ ] **Step 2: Run row tests and verify RED**

Run: `npx vitest run components/crm/ConversationListItem.test.tsx`

Expected: the normal row still renders `Aberta`.

- [ ] **Step 3: Implement the two-line primary hierarchy**

Keep name/time as the first line. Merge provider/channel and preview into the second content block, with provider metadata as `text-ios-caption text-slate-500` and preview as the stronger flexible text. Keep unread count aligned at the far edge. Remove the unconditional `getStatusMeta(conversation.status).label` chip. Render a third line only when `transferPending` or `aiHandling`; keep their existing icon+text semantics and colors.

Remove the now-unused `getStatusMeta` import. Preserve avatar, media preview icon, `aria-current`, list reorder animation, reduced motion, dark mode, and the `onSelect` contract.

- [ ] **Step 4: Reduce the selected-conversation header secondary line**

In `ConversationsPage.tsx`, change the secondary header copy from phone + channel + ownership to:

```tsx
{selectedIsGroup ? 'Conversa em grupo' : selectedConversation.crm_leads?.phone || 'Sem telefone'} · {ownershipLabel}
```

The provider badge on the avatar remains visible, and channel details remain available in `ConversationContextPanel`.

- [ ] **Step 5: Run list and page regression suites**

Run: `npx vitest run components/crm/ConversationListItem.test.tsx components/crm/ConversationsListPanel.test.tsx pages/crm/ConversationsPage.ai-handoff.test.tsx pages/crm/ConversationsPage.leadOptions.test.tsx pages/crm/ConversationsPage.newConversation.test.tsx`

Expected: all selected suites pass.

- [ ] **Step 6: Commit Task 4**

```bash
git add components/crm/ConversationListItem.tsx components/crm/ConversationListItem.test.tsx pages/crm/ConversationsPage.tsx
git commit -m "refactor(crm): simplify conversation workspace hierarchy"
```

---

### Task 5: Full verification and requirements audit

**Files:**
- Review: all files modified by Tasks 1–4
- Review: `docs/superpowers/specs/2026-07-07-crm-chat-thread-ui-design.md`

**Interfaces:**
- Consumes: completed implementation.
- Produces: verification evidence and a clean main-branch handoff.

- [ ] **Step 1: Run all focal CRM component tests**

Run:

```bash
npx vitest run \
  components/crm/messageClusters.test.ts \
  components/crm/MessageBubble.test.tsx \
  components/crm/ConversationMessagesPanel.test.tsx \
  components/crm/ConversationListItem.test.tsx \
  components/crm/ConversationsListPanel.test.tsx \
  pages/crm/ConversationsPage.ai-handoff.test.tsx \
  pages/crm/ConversationsPage.leadOptions.test.tsx \
  pages/crm/ConversationsPage.newConversation.test.tsx
```

Expected: exit 0 with no failed tests.

- [ ] **Step 2: Run static verification**

Run: `npm run typecheck && npm run lint`

Expected: both commands exit 0.

- [ ] **Step 3: Run the production build**

Run: `npm run build`

Expected: Vite exits 0 and writes `dist/`.

- [ ] **Step 4: Inspect the final diff**

Run: `git diff HEAD~4 --check && git status --short && git log -5 --oneline`

Expected: no whitespace errors; only intentional source/test changes are present; the four implementation commits are visible.

- [ ] **Step 5: Audit the spec line by line**

Confirm every Global Constraint above against the code and tests. Specifically verify no auto-read-on-open was introduced, no provider callback was removed, every message action is 44px, inbound messages omit delivery state, and day dividers remain intact.

- [ ] **Step 6: Commit any verification-only correction**

Only if verification required a correction:

```bash
git add components/crm/messageClusters.ts components/crm/messageClusters.test.ts \
  components/crm/MessageBubble.tsx components/crm/MessageBubble.test.tsx \
  components/crm/ConversationMessagesPanel.tsx components/crm/ConversationMessagesPanel.test.tsx \
  components/crm/ConversationListItem.tsx components/crm/ConversationListItem.test.tsx \
  pages/crm/ConversationsPage.tsx index.css
git commit -m "fix(crm): close chat thread verification gaps"
```

If no correction was required, do not create an empty commit.
