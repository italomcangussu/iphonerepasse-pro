# CRM Plus Conversations Impeccable Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn CRM Plus Conversations into an accessible, responsive, high-confidence “Mesa de Atendimento” without changing messaging, realtime, provider, or AI handoff contracts.

**Architecture:** Keep `ConversationsPage` as the orchestration boundary, but move repeated presentation into focused, memoized list-row, workspace-state, and context-panel components. Preserve the existing pagination, scroll anchoring, optimistic message, media, and per-conversation draft behavior; improve recoverability and render isolation around them. Use CSS grid for the approved 30% / flexible / 25% desktop hierarchy, collapsing context to the existing modal/drawer pattern at narrower widths.

**Tech Stack:** React 19, TypeScript, Tailwind CSS v4, Framer Motion, Lucide React, Vitest, Testing Library, Playwright, Vite.

## Global Constraints

- Execute inline on the current `main` branch; do not create a worktree or dispatch subagents.
- Preserve Supabase schemas, Edge Functions, realtime contracts, UAZApi/Instagram behavior, n8n behavior, and the two AI handoff states.
- Never mark a conversation as read merely because it was opened; preserve explicit mark-read and reply-driven clearing.
- Preserve per-conversation drafts, message pagination, top-sentinel loading, unread divider, day grouping, read-receipt ticks, optimistic dedupe, scroll anchoring, and voice-note behavior.
- Meet WCAG 2.2 AA, including visible keyboard focus, 44 × 44px touch targets, non-color state cues, and reduced-motion behavior.
- Keep essential text at 12px or larger and body/placeholder contrast at least 4.5:1.
- Use solid or tonal surfaces; no decorative glassmorphism, gradient text, gradient action buttons, colored side stripes, broad border-plus-shadow cards, or structural panel radius above 20px.
- Use blue only for action, focus, and selection; use orange only for attention.
- Motion is state-driven: 150ms for local feedback and 200–250ms for menus/drawers; no page-load choreography.
- Do not add message virtualization until profiling proves it necessary.
- Follow TDD for each behavior change and commit after each independently reviewable task.

---

### Task 1: Baseline audit and reusable workspace states

**Files:**
- Create: `docs/ui-audits/2026-06-28-crm-plus-conversations.md`
- Create: `components/crm/ConversationWorkspaceState.tsx`
- Create: `components/crm/ConversationWorkspaceState.test.tsx`

**Interfaces:**
- Consumes: Lucide icons and the existing CRM color/type tokens.
- Produces: `ConversationWorkspaceState`, `ConversationListSkeleton`, and `MessageThreadSkeleton` for Tasks 2–4.

- [ ] **Step 1: Write the failing state-component tests**

```tsx
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import {
  ConversationListSkeleton,
  ConversationWorkspaceState,
  MessageThreadSkeleton,
} from './ConversationWorkspaceState';

describe('ConversationWorkspaceState', () => {
  it('renders a recoverable error with an accessible action', () => {
    const onAction = vi.fn();
    render(
      <ConversationWorkspaceState
        tone="error"
        title="Não foi possível carregar as conversas"
        description="Verifique sua conexão e tente novamente."
        action={{ label: 'Tentar novamente', onClick: onAction }}
      />,
    );

    expect(screen.getByRole('alert')).toHaveTextContent('Verifique sua conexão');
    fireEvent.click(screen.getByRole('button', { name: 'Tentar novamente' }));
    expect(onAction).toHaveBeenCalledTimes(1);
  });

  it('labels list and thread skeletons without exposing decorative rows', () => {
    const { rerender } = render(<ConversationListSkeleton />);
    expect(screen.getByLabelText('Carregando conversas')).toBeInTheDocument();
    rerender(<MessageThreadSkeleton />);
    expect(screen.getByLabelText('Carregando mensagens')).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run the focused test and confirm RED**

Run: `npx vitest run components/crm/ConversationWorkspaceState.test.tsx`

Expected: FAIL because `ConversationWorkspaceState.tsx` does not exist.

- [ ] **Step 3: Implement the accessible state and skeleton primitives**

```tsx
import type React from 'react';
import { AlertCircle, Inbox, SearchX } from 'lucide-react';

type StateTone = 'neutral' | 'empty' | 'error';

type ConversationWorkspaceStateProps = {
  tone?: StateTone;
  title: string;
  description: string;
  compact?: boolean;
  action?: { label: string; onClick: () => void };
};

const ICONS = {
  neutral: Inbox,
  empty: SearchX,
  error: AlertCircle,
} satisfies Record<StateTone, React.ComponentType<{ size?: number; className?: string }>>;

export const ConversationWorkspaceState: React.FC<ConversationWorkspaceStateProps> = ({
  tone = 'neutral',
  title,
  description,
  compact = false,
  action,
}) => {
  const Icon = ICONS[tone];
  return (
    <section
      role={tone === 'error' ? 'alert' : 'status'}
      className={`mx-auto flex max-w-md flex-col items-start ${compact ? 'gap-2 p-4' : 'gap-3 p-6 sm:p-8'}`}
    >
      <span className="inline-flex h-11 w-11 items-center justify-center rounded-ios-lg bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300" aria-hidden="true">
        <Icon size={20} />
      </span>
      <div className="space-y-1">
        <h3 className="text-ios-headline font-semibold text-slate-950 dark:text-slate-50">{title}</h3>
        <p className="text-ios-subhead text-slate-600 dark:text-slate-300">{description}</p>
      </div>
      {action && (
        <button type="button" className="crm-btn crm-btn-primary" onClick={action.onClick}>
          {action.label}
        </button>
      )}
    </section>
  );
};

export const ConversationListSkeleton = () => (
  <div aria-label="Carregando conversas" aria-busy="true" className="space-y-2 p-3">
    {Array.from({ length: 6 }, (_, index) => (
      <div key={index} aria-hidden="true" className="h-[68px] animate-shimmer rounded-ios-lg bg-slate-100 dark:bg-slate-800" />
    ))}
  </div>
);

export const MessageThreadSkeleton = () => (
  <div aria-label="Carregando mensagens" aria-busy="true" className="mt-auto space-y-3 p-4 sm:p-6">
    <div aria-hidden="true" className="h-16 w-3/5 animate-shimmer rounded-ios-lg bg-slate-100 dark:bg-slate-800" />
    <div aria-hidden="true" className="ml-auto h-14 w-1/2 animate-shimmer rounded-ios-lg bg-brand-100 dark:bg-brand-900/40" />
    <div aria-hidden="true" className="h-20 w-2/3 animate-shimmer rounded-ios-lg bg-slate-100 dark:bg-slate-800" />
  </div>
);
```

- [ ] **Step 4: Run the test and confirm GREEN**

Run: `npx vitest run components/crm/ConversationWorkspaceState.test.tsx`

Expected: PASS.

- [ ] **Step 5: Record the baseline three-lens audit**

Write `docs/ui-audits/2026-06-28-crm-plus-conversations.md` with this baseline and leave a final-score section to update in Task 6:

```markdown
# CRM Plus Conversations UI Audit

## Baseline

**Target:** Conversas journey
**Score:** 5/10 — functional, but the interface still makes users interpret decoration, tiny metadata, and generic states.

### Lens 1 — Cognition

- ✅ Sending, loading, optimistic messages, handoff, and unread state already provide feedback.
- ❌ Send failure clears the typed text before recovery and relies on transient toast plus a failed bubble.
- ❌ Several disabled/locked states explain themselves only through placeholder text or color.

### Lens 2 — Clarity

- ✅ List → thread mobile navigation follows a familiar messenger model.
- ❌ “Msg”, “Inbox CRM”, generic empty copy, uppercase metadata, and badge density create avoidable interpretation.
- ❌ Transfer and AI states use pulse/color more strongly than plain-language status.

### Lens 3 — Execution

- ✅ Touch targets and iOS keyboard/safe-area behavior have a strong existing foundation.
- ❌ Gradient actions, repeated blur, broad shadows, 24–32px structural radii, and tiny 8–10px text weaken hierarchy and painting performance.
- ❌ Reduced-motion handling is incomplete across list rows, empty states, and overlays.

## Priority fixes

1. Recoverable send failure and explicit state semantics.
2. Conversation-row hierarchy, text floor, keyboard state, and non-color cues.
3. Solid/tonal message, composer, and workspace surfaces.
4. Persistent desktop context with progressive disclosure below desktop.
5. Render isolation and measured browser verification.

## Final score

Update after implementation using the same ten-point rubric and attach verification evidence.
```

- [ ] **Step 6: Commit the primitives and audit baseline**

```bash
git add components/crm/ConversationWorkspaceState.tsx components/crm/ConversationWorkspaceState.test.tsx docs/ui-audits/2026-06-28-crm-plus-conversations.md
git commit -m "test(crm): establish conversations UI baseline"
```

---

### Task 2: Accessible, memoized conversation list

**Files:**
- Create: `components/crm/ConversationListItem.tsx`
- Create: `components/crm/ConversationListItem.test.tsx`
- Modify: `components/crm/ConversationsListPanel.tsx`
- Modify: `components/crm/ConversationsListPanel.test.tsx`
- Modify: `pages/crm/ConversationsPage.tsx`

**Interfaces:**
- Consumes: `ConversationRow` and helper functions from `conversationUi.ts`.
- Produces: `ConversationListItem({ conversation, selected, onSelect })`, memoized for composer render isolation.

- [ ] **Step 1: Write failing list-item accessibility and state tests**

```tsx
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import ConversationListItem from './ConversationListItem';
import type { ConversationRow } from './conversationUi';

const conversation: ConversationRow = {
  id: 'conversation-1', lead_id: 'lead-1', channel_id: 'channel-1', status: 'open',
  ai_enabled: false, unread_count: 2, message_count: 3,
  last_message_at: '2026-06-11T12:13:00.000Z', store_id: 'store-1',
  crm_leads: { id: 'lead-1', name: 'Maria Silva', phone: '+5585999990000' },
  crm_channels: { id: 'channel-1', name: 'Repasse', provider: 'uazapi' },
  lastMessage: { conversation_id: 'conversation-1', content: 'Pode simular?', created_at: '2026-06-11T12:13:00.000Z', direction: 'inbound', status: 'sent' },
};

describe('ConversationListItem', () => {
  it('exposes selection, unread count and provider without color-only meaning', () => {
    const onSelect = vi.fn();
    render(<ConversationListItem conversation={conversation} selected onSelect={onSelect} />);

    const row = screen.getByRole('button', { name: /Maria Silva/i });
    expect(row).toHaveAttribute('aria-current', 'true');
    expect(screen.getByLabelText('2 mensagens não lidas')).toBeInTheDocument();
    expect(screen.getByText('WhatsApp')).toBeInTheDocument();
    fireEvent.click(row);
    expect(onSelect).toHaveBeenCalledWith('conversation-1');
  });
});
```

- [ ] **Step 2: Run the focused tests and confirm RED**

Run: `npx vitest run components/crm/ConversationListItem.test.tsx components/crm/ConversationsListPanel.test.tsx`

Expected: FAIL because the extracted item does not exist and the old copy remains.

- [ ] **Step 3: Implement the memoized row without pulse, stripe, gradient, or sub-12px text**

```tsx
import { memo } from 'react';
import { AlertTriangle, Bot, FileText, Image as ImageIcon, Mic, UsersRound, Video } from 'lucide-react';
import { m, useReducedMotion } from 'framer-motion';
import { iosFastEase } from '../motion/transitions';
import {
  formatConversationDate, getAvatarTone, getConversationAvatarUrl, getInitials,
  getLeadDisplay, getPreviewText, getProviderLabel, getProviderShortLabel,
  getStatusMeta, isAIHandlingConversation, isGroupConversation,
  isTransferPendingConversation, resolveMediaKind, type ConversationRow,
} from './conversationUi';

type Props = { conversation: ConversationRow; selected: boolean; onSelect: (id: string) => void };

const ConversationListItem = memo(({ conversation, selected, onSelect }: Props) => {
  const reducedMotion = useReducedMotion();
  const leadName = getLeadDisplay(conversation);
  const providerLabel = getProviderLabel(conversation.crm_channels?.provider);
  const unreadCount = Number(conversation.unread_count || 0);
  const transferPending = isTransferPendingConversation(conversation);
  const aiHandling = isAIHandlingConversation(conversation);
  const previewKind = resolveMediaKind(conversation.lastMessage?.media_type, conversation.lastMessage?.media_url);
  const PreviewIcon = previewKind === 'image' ? ImageIcon : previewKind === 'video' ? Video : previewKind === 'audio' ? Mic : FileText;

  return (
    <m.button
      layout={reducedMotion ? false : 'position'}
      transition={reducedMotion ? { duration: 0 } : iosFastEase}
      type="button"
      aria-current={selected ? 'true' : undefined}
      onClick={() => onSelect(conversation.id)}
      className={`crm-chat-row w-full rounded-ios-lg px-3 py-3 text-left ${selected ? 'bg-brand-50 ring-1 ring-brand-200 dark:bg-brand-500/10 dark:ring-brand-500/30' : 'hover:bg-slate-100 dark:hover:bg-slate-900'}`}
    >
      <div className="flex items-start gap-3">
        <span className={`relative inline-flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-full text-sm font-bold ${getAvatarTone(conversation.lead_id)}`} aria-hidden="true">
          {getConversationAvatarUrl(conversation) ? <img src={getConversationAvatarUrl(conversation) || ''} alt="" className="h-full w-full object-cover" loading="lazy" /> : isGroupConversation(conversation) ? <UsersRound size={18} /> : getInitials(leadName)}
        </span>
        <span className="min-w-0 flex-1">
          <span className="flex items-center justify-between gap-2">
            <strong className="truncate text-ios-subhead text-slate-950 dark:text-slate-50">{leadName}</strong>
            <time className="shrink-0 text-ios-caption text-slate-600 dark:text-slate-300">{formatConversationDate(conversation.last_message_at || conversation.lastMessage?.created_at || null)}</time>
          </span>
          <span className="mt-0.5 flex items-center gap-1 text-ios-caption text-slate-600 dark:text-slate-300">
            {providerLabel} · {conversation.crm_channels?.name || getProviderShortLabel(conversation.crm_channels?.provider)}
          </span>
          <span className="mt-1 flex min-w-0 items-center gap-2 text-ios-caption text-slate-600 dark:text-slate-300">
            {previewKind && <PreviewIcon size={14} aria-hidden="true" />}
            <span className="truncate">{conversation.lastMessage?.direction === 'outbound' ? 'Você: ' : ''}{getPreviewText(conversation.lastMessage)}</span>
          </span>
          <span className="mt-2 flex flex-wrap items-center gap-1.5">
            <span className="rounded-full bg-slate-100 px-2 py-1 text-ios-caption font-semibold text-slate-700 dark:bg-slate-800 dark:text-slate-200">{getStatusMeta(conversation.status).label}</span>
            {transferPending && <span className="inline-flex items-center gap-1 rounded-full bg-red-50 px-2 py-1 text-ios-caption font-semibold text-red-700 dark:bg-red-950/40 dark:text-red-200"><AlertTriangle size={12} /> Transferência pendente</span>}
            {!transferPending && aiHandling && <span className="inline-flex items-center gap-1 rounded-full bg-orange-50 px-2 py-1 text-ios-caption font-semibold text-orange-800 dark:bg-orange-950/40 dark:text-orange-200"><Bot size={12} /> IA atendendo</span>}
            {unreadCount > 0 && <span aria-label={`${unreadCount} mensagens não lidas`} className="ml-auto inline-flex min-h-6 min-w-6 items-center justify-center rounded-full bg-brand-600 px-1.5 text-ios-caption font-bold text-white">{unreadCount}</span>}
          </span>
        </span>
      </div>
    </m.button>
  );
});

ConversationListItem.displayName = 'ConversationListItem';
export default ConversationListItem;
```

- [ ] **Step 4: Replace the inline row and improve panel semantics/copy**

In `ConversationsListPanel.tsx`:

```tsx
import { memo } from 'react';
import ConversationListItem from './ConversationListItem';
import { ConversationListSkeleton, ConversationWorkspaceState } from './ConversationWorkspaceState';

// Header
<h2 className="text-ios-headline font-semibold text-slate-950 dark:text-slate-50">Conversas</h2>
<p className="text-ios-caption text-slate-600 dark:text-slate-300">
  {filteredConversations.length} em atendimento
</p>

// Segmented search controls
<div role="group" aria-label="Tipo de busca" className="flex min-h-11 w-full shrink-0 gap-1 rounded-ios border border-slate-200 bg-slate-50 p-1 dark:border-slate-700 dark:bg-slate-900">
  <button aria-pressed={searchMode === 'leads'}>Contatos</button>
  <button aria-pressed={searchMode === 'messages'}>Mensagens</button>
</div>

// Loading and empty states
{loadError ? (
  <ConversationWorkspaceState
    compact
    tone="error"
    title="Não foi possível carregar as conversas"
    description="Verifique sua conexão e tente novamente."
    action={{ label: 'Tentar novamente', onClick: retryLoadConversations }}
  />
) : loadingConversations ? <ConversationListSkeleton /> : filteredConversations.length === 0 ? (
  <ConversationWorkspaceState
    compact
    tone="empty"
    title={hasActiveFilters || search.trim() ? 'Nenhuma conversa corresponde à busca' : 'Sua caixa de entrada está vazia'}
    description={hasActiveFilters || search.trim() ? 'Limpe a busca ou remova filtros para ver mais conversas.' : channels.length > 0 ? 'Inicie uma conversa ou aguarde a próxima mensagem de um cliente.' : 'Conecte um canal para começar a atender clientes.'}
    action={hasActiveFilters || search.trim()
      ? { label: 'Limpar filtros', onClick: clearConversationFilters }
      : channels.length > 0
        ? { label: 'Iniciar conversa', onClick: startConversation }
        : undefined}
  />
) : filteredConversations.map((conversation) => (
  <ConversationListItem key={conversation.id} conversation={conversation} selected={conversation.id === selectedConversationId} onSelect={handleSelectConversation} />
))}

export default memo(ConversationsListPanel);
```

Add these exact fields to `ConversationsListPanelProps` and its destructuring:

```tsx
loadError: string | null;
retryLoadConversations: () => void;
startConversation: () => void;
```

In `ConversationsPage.tsx`, add `const [conversationLoadError, setConversationLoadError] = useState<string | null>(null);`. At the start of `loadConversations`, call `setConversationLoadError(null)`. In its `catch`, call `setConversationLoadError('Verifique sua conexão e tente novamente.')` before the current toast. After `loadConversations`, add `const retryLoadConversations = useCallback(() => { void loadConversations(); }, [loadConversations]);`, then pass `loadError={conversationLoadError}`, `retryLoadConversations={retryLoadConversations}`, and `startConversation={openNewConversationModal}` to the panel.

Also add `aria-pressed` to mobile filter chips, replace “view/team” with “visualização/equipe”, keep each close/delete target at least 44px, and use sentence case for all saved-view labels.

- [ ] **Step 5: Extend panel tests for copy, filters, and empty recovery**

```tsx
it('explains filtered emptiness and clears filters', () => {
  const clearConversationFilters = vi.fn();
  render(<ConversationsListPanel {...defaultProps} filteredConversations={[]} search="Maria" clearConversationFilters={clearConversationFilters} />);
  expect(screen.getByText('Nenhuma conversa corresponde à busca')).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Limpar filtros' }));
  expect(clearConversationFilters).toHaveBeenCalledTimes(1);
});

it('offers retry when loading the list fails', () => {
  const retryLoadConversations = vi.fn();
  render(<ConversationsListPanel {...defaultProps} loadError="offline" retryLoadConversations={retryLoadConversations} />);
  fireEvent.click(screen.getByRole('button', { name: 'Tentar novamente' }));
  expect(retryLoadConversations).toHaveBeenCalledTimes(1);
});
```

Set `loadError: null`, `retryLoadConversations: vi.fn()`, and `startConversation: vi.fn()` in `defaultProps`. Add this empty-inbox test:

```tsx
it('guides the first conversation when a channel is connected', () => {
  const startConversation = vi.fn();
  render(
    <ConversationsListPanel
      {...defaultProps}
      channels={[{ id: 'channel-1', name: 'Repasse', provider: 'uazapi', is_active: true }]}
      filteredConversations={[]}
      startConversation={startConversation}
    />,
  );
  fireEvent.click(screen.getByRole('button', { name: 'Iniciar conversa' }));
  expect(startConversation).toHaveBeenCalledTimes(1);
});
```

- [ ] **Step 6: Run list tests and confirm GREEN**

Run: `npx vitest run components/crm/ConversationListItem.test.tsx components/crm/ConversationsListPanel.test.tsx`

Expected: PASS.

- [ ] **Step 7: Commit the list improvements**

```bash
git add components/crm/ConversationListItem.tsx components/crm/ConversationListItem.test.tsx components/crm/ConversationsListPanel.tsx components/crm/ConversationsListPanel.test.tsx pages/crm/ConversationsPage.tsx
git commit -m "refactor(crm): clarify conversation triage list"
```

---

### Task 3: Thread hierarchy, message semantics, and reduced decoration

**Files:**
- Modify: `components/crm/ConversationMessagesPanel.tsx`
- Modify: `components/crm/ConversationMessagesPanel.test.tsx`
- Modify: `components/crm/MessageBubble.tsx`
- Modify: `components/crm/MessageBubble.test.tsx`
- Modify: `hooks/useMessagesPagination.ts`
- Create: `hooks/useMessagesPagination.test.tsx`
- Modify: `pages/crm/ConversationsPage.tsx`
- Modify: `index.css`

**Interfaces:**
- Consumes: workspace states from Task 1 and existing `MessageBubbleMessage` callbacks.
- Produces: memoized `ConversationMessagesPanel`; `MessageBubble` gains optional `onRetry(message)` for failed optimistic sends used in Task 5.

- [ ] **Step 1: Write failing thread and failed-message behavior tests**

```tsx
it('renders a helpful empty thread state', () => {
  render(<ConversationMessagesPanel {...baseProps} />);
  expect(screen.getByText('Ainda não há mensagens nesta conversa')).toBeInTheDocument();
  expect(screen.getByText('Envie a primeira mensagem quando estiver pronto.')).toBeInTheDocument();
});

it('announces new messages politely', () => {
  render(<ConversationMessagesPanel {...baseProps} newMessageCount={2} />);
  expect(screen.getByRole('status')).toHaveTextContent('2 novas mensagens');
});

it('offers retry for a failed outbound message', () => {
  const onRetry = vi.fn();
  renderBubble({
    id: 'failed-1', direction: 'outbound', sender_type: 'human', content: 'Olá',
    created_at: '2026-06-28T10:00:00.000Z', status: 'failed', error_message: 'Sem conexão',
  }, { onRetry });
  fireEvent.click(screen.getByRole('button', { name: 'Tentar enviar novamente' }));
  expect(onRetry).toHaveBeenCalledWith(expect.objectContaining({ id: 'failed-1' }));
});

it('renders a recoverable thread-load error', () => {
  const retryLoadMessages = vi.fn();
  render(<ConversationMessagesPanel {...baseProps} loadError="offline" retryLoadMessages={retryLoadMessages} />);
  fireEvent.click(screen.getByRole('button', { name: 'Tentar novamente' }));
  expect(retryLoadMessages).toHaveBeenCalledTimes(1);
});
```

Update the local `renderBubble` test helper to accept optional props and pass them through to `MessageBubble`.

Create `hooks/useMessagesPagination.test.tsx`:

```tsx
import { act, renderHook, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { useMessagesPagination } from './useMessagesPagination';

const { limitMock } = vi.hoisted(() => ({ limitMock: vi.fn() }));

vi.mock('../services/supabase', () => {
  const query = {
    select: vi.fn(), eq: vi.fn(), order: vi.fn(), limit: limitMock,
  };
  query.select.mockReturnValue(query);
  query.eq.mockReturnValue(query);
  query.order.mockReturnValue(query);
  const channel = { on: vi.fn(), subscribe: vi.fn() };
  channel.on.mockReturnValue(channel);
  channel.subscribe.mockReturnValue(channel);
  return {
    supabase: {
      from: vi.fn(() => query),
      channel: vi.fn(() => channel),
      removeChannel: vi.fn(),
    },
  };
});

describe('useMessagesPagination', () => {
  it('exposes and clears a recoverable initial-load error', async () => {
    limitMock
      .mockResolvedValueOnce({ data: null, error: new Error('offline') })
      .mockResolvedValueOnce({ data: [], error: null });
    const scrollRef = { current: null };
    const { result } = renderHook(() => useMessagesPagination('conversation-1', scrollRef));
    await waitFor(() => expect(result.current.loadError).toBe('Não foi possível carregar as mensagens.'));
    await act(async () => { await result.current.retryInitial(); });
    expect(result.current.loadError).toBeNull();
  });
});
```

- [ ] **Step 2: Run focused tests and confirm RED**

Run: `npx vitest run components/crm/ConversationMessagesPanel.test.tsx components/crm/MessageBubble.test.tsx`

Expected: FAIL on the new copy, live region, and retry action.

- [ ] **Step 3: Replace generic loading/empty content and date decoration**

In `ConversationMessagesPanel.tsx`:

```tsx
import { memo } from 'react';
import { ConversationWorkspaceState, MessageThreadSkeleton } from './ConversationWorkspaceState';

// Add this optional field to ConversationMessagesPanelProps in Task 3;
// Task 5 supplies the callback after the retry flow exists.
retryMessage?: (message: MessageBubbleMessage) => void | Promise<void>;

// Add these required fields to ConversationMessagesPanelProps.
loadError: string | null;
retryLoadMessages: () => void;

{loadError ? (
  <ConversationWorkspaceState
    tone="error"
    title="Não foi possível carregar as mensagens"
    description="Verifique sua conexão e tente novamente."
    action={{ label: 'Tentar novamente', onClick: retryLoadMessages }}
  />
) : loadingMessages ? (
  <MessageThreadSkeleton />
) : visibleMessages.length === 0 ? (
  <ConversationWorkspaceState
    tone="neutral"
    title="Ainda não há mensagens nesta conversa"
    description="Envie a primeira mensagem quando estiver pronto."
  />
) : (
  <div className="@container mt-auto min-w-0 max-w-full space-y-4 overflow-x-clip">
    {threadGroups.map((group) => (
      <section key={group.label} aria-label={group.label} className="space-y-3">
        <div className="flex items-center gap-3" aria-hidden="true">
          <span className="h-px flex-1 bg-slate-200 dark:bg-slate-700" />
          <span className="rounded-full bg-slate-100 px-3 py-1 text-ios-caption font-semibold text-slate-600 dark:bg-slate-800 dark:text-slate-300">{group.label}</span>
          <span className="h-px flex-1 bg-slate-200 dark:bg-slate-700" />
        </div>
        <div className="flex min-w-0 max-w-full flex-col gap-1.5 overflow-x-clip">
          {group.messages.map((message) => (
            <MessageBubble
              key={message.id}
              message={message}
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
        </div>
      </section>
    ))}
  </div>
)}

{newMessageCount > 0 && (
  <div role="status" aria-live="polite">
    <button type="button" onClick={() => { clearNewMessageCount(); scrollToBottom(); }} className="inline-flex min-h-11 items-center gap-2 rounded-full bg-brand-600 px-4 text-ios-caption font-semibold text-white shadow-ios26-sm transition-colors duration-150 hover:bg-brand-700 focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2">
      <ArrowDown size={14} />
      {newMessageCount} nova{newMessageCount > 1 ? 's mensagens' : ' mensagem'}
    </button>
  </div>
)}

export default memo(ConversationMessagesPanel);
```

In `hooks/useMessagesPagination.ts`, extend the result interface and state:

```tsx
loadError: string | null;
retryInitial: () => Promise<void>;

const [loadError, setLoadError] = useState<string | null>(null);
```

At the start of `loadInitial`, call `setLoadError(null)`. Add this catch before its current `finally`:

```tsx
} catch {
  setLoadError('Não foi possível carregar as mensagens.');
}
```

Add and return the retry callback:

```tsx
const retryInitial = useCallback(async () => {
  const conversationId = conversationIdRef.current;
  if (conversationId) await loadInitial(conversationId);
}, [loadInitial]);

return { messages, loadingInitial, loadingOlder, hasMore, newMessageCount, loadError, clearNewMessageCount, loadMore, reload, retryInitial };
```

Clear `loadError` in the no-conversation branch. Destructure `loadError: messagesLoadError` and `retryInitial: retryLoadMessages` in `ConversationsPage`, then pass both to `ConversationMessagesPanel`.

- [ ] **Step 4: Simplify bubble tones and add retry semantics**

Update `MessageBubble` props and classes:

```tsx
// Add this exact field to the current Props type without changing its other fields.
onRetry?: (message: MessageBubbleMessage) => void | Promise<void>;

const bubbleClass = isOnlySticker
  ? tone === 'inbound' ? '' : 'ml-auto'
  : tone === 'outboundAi'
    ? 'ml-auto rounded-br-sm bg-slate-800 text-white shadow-ios26-sm dark:bg-slate-700'
    : tone === 'outboundHuman'
      ? 'ml-auto rounded-br-sm bg-brand-600 text-white shadow-ios26-sm dark:bg-brand-500'
      : 'rounded-bl-sm bg-white text-slate-900 shadow-ios26-sm dark:bg-slate-800 dark:text-slate-50';

const innerContentClass = isOnlySticker ? '' : 'rounded-ios-lg overflow-hidden';

<div className={`mt-1 flex flex-wrap items-center justify-end gap-1 text-ios-caption font-medium ${metaTextClass}`}>
  <span>{formatMessageDateTime(message.sent_at || message.created_at)}</span>
  <span aria-hidden="true">·</span>
  <span className="inline-flex items-center gap-1">
    <StatusIcon status={message.status} tone={tone} />
    {getMessageStatusLabel(message.status)}
  </span>
</div>

{message.status === 'failed' && onRetry && (
  <button type="button" className="mt-2 inline-flex min-h-11 items-center gap-2 rounded-ios bg-red-50 px-3 text-ios-caption font-semibold text-red-700 focus-visible:ring-2 focus-visible:ring-red-500 dark:bg-red-950/40 dark:text-red-200" onClick={() => void onRetry(message)}>
    <RefreshCw size={14} /> Tentar enviar novamente
  </button>
)}
```

Include `onRetry` in the custom memo comparator. Remove `pl-radius-container`, message gradients, blur from reaction badges, and all 8–10px essential text in the bubble footer/reactions.

- [ ] **Step 5: Remove scoped message blur and broad shadow CSS**

In `index.css`, make conversation surfaces solid and tonal:

```css
.crm-conversation-compact-header {
  min-height: 3.25rem;
  background: var(--ds-color-surface);
  backdrop-filter: none;
  -webkit-backdrop-filter: none;
}

.crm-message-bubble {
  border: 0;
  border-radius: 0.875rem;
  box-shadow: var(--ds-shadow-sm);
}

.crm-message-bubble--inbound,
.crm-message-bubble--outbound-human,
.crm-message-bubble--outbound-ai {
  border: 0 !important;
}
```

Keep global `liquid-glass` primitives for legitimate overlays elsewhere; remove their use only from the scoped conversation header, composer, message reactions, and scrolling surfaces.

- [ ] **Step 6: Run thread and bubble tests and confirm GREEN**

Run: `npx vitest run components/crm/ConversationMessagesPanel.test.tsx components/crm/MessageBubble.test.tsx hooks/useMessagesPagination.test.tsx`

Expected: PASS.

- [ ] **Step 7: Commit thread and message improvements**

```bash
git add components/crm/ConversationMessagesPanel.tsx components/crm/ConversationMessagesPanel.test.tsx components/crm/MessageBubble.tsx components/crm/MessageBubble.test.tsx hooks/useMessagesPagination.ts hooks/useMessagesPagination.test.tsx pages/crm/ConversationsPage.tsx index.css
git commit -m "refactor(crm): strengthen message thread hierarchy"
```

---

### Task 4: Persistent desktop context and approved responsive hierarchy

**Files:**
- Create: `components/crm/ConversationContextPanel.tsx`
- Create: `components/crm/ConversationContextPanel.test.tsx`
- Modify: `pages/crm/ConversationsPage.tsx`
- Modify: `index.css`

**Interfaces:**
- Consumes: `ConversationRow`, `AICommerceSnapshot`, `AICommerceStatePanel`, and existing formatting helpers.
- Produces: `ConversationContextPanel` rendered persistently at ≥1280px and reused inside the existing lead-information modal below that width.

- [ ] **Step 1: Write the failing context-panel test**

```tsx
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import ConversationContextPanel from './ConversationContextPanel';

it('presents decision context as one labelled region without nested card grids', () => {
  render(
    <ConversationContextPanel
      conversation={{
        id: 'conversation-1', lead_id: 'lead-1', channel_id: 'channel-1', status: 'open', ai_enabled: false,
        unread_count: 2, message_count: 3, last_message_at: '2026-06-28T10:00:00.000Z', store_id: 'store-1',
        crm_leads: { id: 'lead-1', name: 'Maria Silva', phone: '+5585999990000' },
        crm_channels: { id: 'channel-1', name: 'Repasse', provider: 'uazapi' }, lastMessage: null,
      }}
      leadName="Maria Silva"
      avatarUrl={null}
      isGroup={false}
      ownershipLabel="Atendimento humano"
      messageCount={3}
      loadingCommerceSnapshot={false}
      commerceSnapshot={null}
    />,
  );

  expect(screen.getByRole('complementary', { name: 'Contexto da conversa' })).toBeInTheDocument();
  expect(screen.getByText('Estado do atendimento')).toBeInTheDocument();
  expect(screen.getByText('Atendimento humano')).toBeInTheDocument();
});
```

- [ ] **Step 2: Run the context test and confirm RED**

Run: `npx vitest run components/crm/ConversationContextPanel.test.tsx`

Expected: FAIL because the panel does not exist.

- [ ] **Step 3: Implement a compact contextual region**

```tsx
import type React from 'react';
import { UsersRound } from 'lucide-react';
import type { AICommerceSnapshot } from '../../lib/crm/aiCommerceSnapshot';
import AICommerceStatePanel from './AICommerceStatePanel';
import { formatConversationDate, getAvatarTone, getInitials, type ConversationRow } from './conversationUi';

type Props = {
  conversation: ConversationRow;
  leadName: string;
  avatarUrl: string | null;
  isGroup: boolean;
  ownershipLabel: string;
  messageCount: number;
  loadingCommerceSnapshot: boolean;
  commerceSnapshot: AICommerceSnapshot | null;
  className?: string;
};

const ConversationContextPanel: React.FC<Props> = ({ conversation, leadName, avatarUrl, isGroup, ownershipLabel, messageCount, loadingCommerceSnapshot, commerceSnapshot, className = '' }) => (
  <aside aria-label="Contexto da conversa" className={`crm-conversation-context min-w-0 overflow-y-auto bg-slate-50 p-4 dark:bg-slate-900 ${className}`}>
    <div className="flex items-center gap-3 border-b border-slate-200 pb-4 dark:border-slate-700">
      <span className={`inline-flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-full text-sm font-bold ${getAvatarTone(conversation.lead_id)}`}>
        {avatarUrl ? <img src={avatarUrl} alt={leadName} className="h-full w-full object-cover" loading="lazy" /> : isGroup ? <UsersRound size={18} aria-hidden="true" /> : getInitials(leadName)}
      </span>
      <div className="min-w-0">
        <h2 className="truncate text-ios-headline font-semibold text-slate-950 dark:text-slate-50">{leadName}</h2>
        <p className="truncate text-ios-caption text-slate-600 dark:text-slate-300">{conversation.crm_leads?.phone || 'Telefone não informado'}</p>
      </div>
    </div>
    <dl className="divide-y divide-slate-200 dark:divide-slate-700">
      <div className="py-3"><dt className="text-ios-caption text-slate-600 dark:text-slate-300">Estado do atendimento</dt><dd className="mt-1 text-ios-subhead font-semibold text-slate-950 dark:text-slate-50">{ownershipLabel}</dd></div>
      <div className="py-3"><dt className="text-ios-caption text-slate-600 dark:text-slate-300">Canal</dt><dd className="mt-1 text-ios-subhead font-semibold">{conversation.crm_channels?.name || 'Não informado'}</dd></div>
      <div className="py-3"><dt className="text-ios-caption text-slate-600 dark:text-slate-300">Mensagens</dt><dd className="mt-1 text-ios-subhead font-semibold">{messageCount}</dd></div>
      <div className="py-3"><dt className="text-ios-caption text-slate-600 dark:text-slate-300">Última atividade</dt><dd className="mt-1 text-ios-subhead font-semibold">{formatConversationDate(conversation.last_message_at || conversation.lastMessage?.created_at || null)}</dd></div>
    </dl>
    <div className="mt-4"><AICommerceStatePanel loading={loadingCommerceSnapshot} snapshot={commerceSnapshot} /></div>
    <details className="mt-4 border-t border-slate-200 pt-3 text-ios-caption dark:border-slate-700">
      <summary className="min-h-11 cursor-pointer py-3 font-semibold text-slate-700 dark:text-slate-200">Identificadores técnicos</summary>
      <p className="break-all text-slate-600 dark:text-slate-300">Lead: {conversation.lead_id}</p>
      <p className="break-all text-slate-600 dark:text-slate-300">Conversa: {conversation.id}</p>
    </details>
  </aside>
);

export default ConversationContextPanel;
```

- [ ] **Step 4: Reuse the component in the page and modal**

In `ConversationsPage.tsx`:

```tsx
import ConversationContextPanel from '../../components/crm/ConversationContextPanel';

<div className="crm-conversation-panel bg-white dark:bg-slate-950">
  {/* Keep the current explicit ConversationsListPanel and thread nodes in their current order. */}
  {selectedConversation && (
    <ConversationContextPanel
      className="hidden xl:block"
      conversation={selectedConversation}
      leadName={selectedLeadName}
      avatarUrl={selectedAvatarUrl}
      isGroup={selectedIsGroup}
      ownershipLabel={ownershipLabel}
      messageCount={selectedConversation.message_count || visibleMessages.length}
      loadingCommerceSnapshot={loadingCommerceSnapshot}
      commerceSnapshot={commerceSnapshot}
    />
  )}
</div>

<Modal open={isLeadInfoOpen && Boolean(selectedConversation)} onClose={() => setIsLeadInfoOpen(false)} title="Contexto da conversa" size="md">
  {selectedConversation && (
    <ConversationContextPanel
      className="bg-transparent p-0"
      conversation={selectedConversation}
      leadName={selectedLeadName}
      avatarUrl={selectedAvatarUrl}
      isGroup={selectedIsGroup}
      ownershipLabel={ownershipLabel}
      messageCount={selectedConversation.message_count || visibleMessages.length}
      loadingCommerceSnapshot={loadingCommerceSnapshot}
      commerceSnapshot={commerceSnapshot}
    />
  )}
</Modal>
```

Remove the duplicated modal markup after the shared panel is wired.

- [ ] **Step 5: Implement the 30% / flexible / 25% responsive grid**

In `index.css`:

```css
.crm-conversation-panel {
  display: grid;
  grid-template-columns: minmax(280px, 30%) minmax(0, 1fr) minmax(280px, 25%);
}

.crm-chat-list-panel,
.crm-conversation-thread,
.crm-conversation-context {
  width: 100%;
  min-width: 0;
}

@media (max-width: 1279px) {
  .crm-conversation-panel {
    grid-template-columns: minmax(280px, 34%) minmax(0, 1fr);
  }
}

@media (max-width: 767px) {
  .crm-conversation-panel {
    grid-template-columns: minmax(0, 1fr);
  }
}
```

Remove fixed `md/lg/xl` widths from `ConversationsListPanel`; preserve its mobile single-pane visibility and existing keyboard/safe-area behavior.

- [ ] **Step 6: Run context and existing page tests**

Run: `npx vitest run components/crm/ConversationContextPanel.test.tsx pages/crm/ConversationsPage.newConversation.test.tsx pages/crm/ConversationsPage.ai-handoff.test.tsx pages/crm/ConversationsPage.leadOptions.test.tsx`

Expected: PASS.

- [ ] **Step 7: Commit the hierarchy**

```bash
git add components/crm/ConversationContextPanel.tsx components/crm/ConversationContextPanel.test.tsx pages/crm/ConversationsPage.tsx index.css
git commit -m "feat(crm): center conversations in responsive workspace"
```

---

### Task 5: Recoverable composer, retry flow, and render isolation

**Files:**
- Modify: `pages/crm/ConversationsPage.tsx`
- Create: `components/crm/useConversationDrafts.ts`
- Create: `components/crm/useConversationDrafts.test.tsx`
- Modify: `components/crm/ConversationMessagesPanel.tsx`
- Modify: `components/crm/MessageBubble.tsx`
- Modify: `index.css`

**Interfaces:**
- Consumes: `MessageBubble.onRetry` from Task 3 and `selectedConversationId` from the page.
- Produces: `useConversationDrafts(conversationId)`, `retryFailedMessage(message)`, and stable panel callbacks so composer keystrokes do not force list/thread rerenders.

- [ ] **Step 1: Write failing per-conversation draft and recovery tests**

```tsx
import { act, renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { useConversationDrafts } from './useConversationDrafts';

describe('useConversationDrafts', () => {
  it('keeps a separate draft for each conversation', () => {
    const { result, rerender } = renderHook(
      ({ conversationId }) => useConversationDrafts(conversationId),
      { initialProps: { conversationId: 'maria' as string | null } },
    );
    act(() => result.current.setDraft('Rascunho da Maria'));
    rerender({ conversationId: 'joao' });
    act(() => result.current.setDraft('Rascunho do João'));
    rerender({ conversationId: 'maria' });
    expect(result.current.draft).toBe('Rascunho da Maria');
  });

  it('restores sent text after failure without overwriting newer input', () => {
    const { result } = renderHook(() => useConversationDrafts('maria'));
    act(() => result.current.restoreAfterFailure('Mensagem importante'));
    expect(result.current.draft).toBe('Mensagem importante');
    act(() => result.current.setDraft('Texto mais novo'));
    act(() => result.current.restoreAfterFailure('Mensagem antiga'));
    expect(result.current.draft).toBe('Texto mais novo');
  });
});
```

- [ ] **Step 2: Run the draft-hook test and confirm RED**

Run: `npx vitest run components/crm/useConversationDrafts.test.tsx`

Expected: FAIL because `useConversationDrafts.ts` does not exist.

- [ ] **Step 3: Implement the draft hook and replace the page-local map/effects**

```tsx
import { useCallback, useEffect, useRef, useState } from 'react';

export function useConversationDrafts(conversationId: string | null) {
  const [draft, setDraftState] = useState('');
  const draftsRef = useRef(new Map<string, string>());
  const activeConversationRef = useRef<string | null>(null);
  const draftRef = useRef('');

  const setDraft = useCallback((value: string) => {
    draftRef.current = value;
    setDraftState(value);
  }, []);

  const clearDraft = useCallback(() => setDraft(''), [setDraft]);

  const restoreAfterFailure = useCallback((sentText: string) => {
    if (!draftRef.current.trim()) setDraft(sentText);
  }, [setDraft]);

  useEffect(() => {
    const previousId = activeConversationRef.current;
    if (previousId && previousId !== conversationId) draftsRef.current.set(previousId, draftRef.current);
    const nextDraft = conversationId ? draftsRef.current.get(conversationId) || '' : '';
    activeConversationRef.current = conversationId;
    setDraft(nextDraft);
  }, [conversationId, setDraft]);

  return { draft, setDraft, clearDraft, restoreAfterFailure };
}
```

In `ConversationsPage.tsx`, remove the local `draft` state, `draftRef`, `draftsRef`, `prevConversationIdRef`, and their synchronization effects. Import the hook and add this line immediately after `selectedConversationId` state is declared:

```tsx
const { draft, setDraft, clearDraft, restoreAfterFailure } = useConversationDrafts(selectedConversationId);
```

- [ ] **Step 4: Restore text after failure and expose inline recovery state**

In `ConversationsPage.tsx`:

```tsx
const [composerError, setComposerError] = useState<string | null>(null);

// Immediately before setSending(true) in sendMessage:
setComposerError(null);

// Replace setDraft('') in sendMessage with:
clearDraft();

// Replace the catch block in sendMessage with:
} catch (error: unknown) {
  const failure = (error as Error)?.message || 'Falha ao enviar mensagem.';
  restoreAfterFailure(content);
  setComposerError('Não foi possível enviar. Verifique sua conexão e tente novamente.');
  if (shouldShowOptimisticMessage) {
    setPendingMessages((previous) => previous.map((message) => message.id === optimisticId ? {
      ...message,
      status: 'failed',
      error_message: failure,
    } : message));
  }
}

<textarea
  aria-label="Mensagem"
  aria-describedby={composerError ? 'crm-composer-error' : 'crm-composer-help'}
  aria-invalid={Boolean(composerError)}
/>

{composerError && (
  <p id="crm-composer-error" role="alert" className="mt-2 flex items-center gap-2 text-ios-footnote text-red-700 dark:text-red-300">
    <AlertCircle size={14} aria-hidden="true" /> {composerError}
  </p>
)}
<p id="crm-composer-help" className="sr-only">Enter envia. Shift mais Enter cria uma nova linha. Limite de 16 MB por arquivo.</p>
```

Add `clearDraft` and `restoreAfterFailure` to the `sendMessage` dependency array. Clear `composerError` when `selectedConversationId` changes and after a successful send.

- [ ] **Step 5: Implement failed optimistic retry without duplicating messages**

```tsx
const retryFailedMessage = useCallback(async (message: MessageBubbleMessage) => {
  if (!selectedConversation || message.status !== 'failed') return;
  setPendingMessages((previous) => previous.map((item) => item.id === message.id ? { ...item, status: 'pending', error_message: null } : item));
  setComposerError(null);
  try {
    const { data, error } = await supabase.functions.invoke('crm-send-message', {
      body: {
        conversationId: selectedConversation.id,
        leadId: selectedConversation.lead_id,
        channelId: selectedConversation.channel_id,
        content: String(message.content || ''),
        ...(message.reply_to_provider_message_id ? { replyToProviderMessageId: message.reply_to_provider_message_id, replyPreviewText: message.reply_preview_text } : {}),
      },
    });
    if (error) throw error;
    if (data?.error) throw new Error(String(data.error));
    setPendingMessages((previous) => previous.filter((item) => item.id !== message.id));
    if (draft === String(message.content || '')) clearDraft();
    await Promise.all([loadConversations({ showLoader: false, silent: true }), reloadMessages(true)]);
    toast.success('Mensagem enviada.');
  } catch (error: unknown) {
    setPendingMessages((previous) => previous.map((item) => item.id === message.id ? { ...item, status: 'failed', error_message: (error as Error)?.message || 'Falha ao enviar mensagem.' } : item));
    setComposerError('Não foi possível enviar. Verifique sua conexão e tente novamente.');
  }
}, [clearDraft, draft, loadConversations, reloadMessages, selectedConversation, toast]);
```

Pass `onRetry={retryFailedMessage}` from `ConversationMessagesPanel` to each `MessageBubble`.

- [ ] **Step 6: Make composer actions solid, legible, and reduced-motion-safe**

Replace both gradient action classes with:

```tsx
className="inline-flex h-12 min-w-12 shrink-0 items-center justify-center gap-2 rounded-full bg-brand-600 font-semibold text-white transition-[background-color,transform] duration-150 hover:bg-brand-700 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50 motion-reduce:transform-none motion-reduce:transition-none"
```

Use “Enviar” and “Enviando” in sentence case, remove the visible 9px uppercase helper paragraphs, and remove `backdrop-blur-xl` / `pl-shadow-float` from the composer container. Keep a solid surface, a 1px structural top divider, 14–20px radius, and safe-area padding.

- [ ] **Step 7: Stabilize memoized panel props**

```tsx
const openMediaViewer = useCallback((url: string, type: NonNullable<MediaViewerState>['type'], fileName: string) => {
  setMediaViewer({ url, type, fileName });
}, []);

// Replace the inline onOpenMedia callback with:
onOpenMedia={openMediaViewer}

// Add the retry callback prop:
retryMessage={retryFailedMessage}
```

Add those exact props to the current explicit `ConversationMessagesPanel` call. Verify that `ConversationsListPanel`, `ConversationListItem`, `ConversationMessagesPanel`, and `MessageBubble` remain memoized. Do not add deep-equality helpers or JSON serialization.

- [ ] **Step 8: Run draft, thread, and page tests**

Run: `npx vitest run components/crm/useConversationDrafts.test.tsx components/crm/ConversationMessagesPanel.test.tsx components/crm/MessageBubble.test.tsx pages/crm/ConversationsPage.ai-handoff.test.tsx`

Expected: PASS; no read-on-open behavior changes.

- [ ] **Step 9: Commit recoverability and performance boundaries**

```bash
git add pages/crm/ConversationsPage.tsx components/crm/useConversationDrafts.ts components/crm/useConversationDrafts.test.tsx components/crm/ConversationMessagesPanel.tsx components/crm/MessageBubble.tsx index.css
git commit -m "fix(crm): preserve messages across send failures"
```

---

### Task 6: Responsive, accessibility, performance, and visual verification

**Files:**
- Modify: `docs/ui-audits/2026-06-28-crm-plus-conversations.md`
- Modify: affected tests or styles only when verification exposes a scoped defect.

**Interfaces:**
- Consumes: all Tasks 1–5.
- Produces: final audit score, browser evidence, and a verified production build.

- [ ] **Step 1: Run the scoped automated suite**

Run:

```bash
npx vitest run \
  components/crm/ConversationWorkspaceState.test.tsx \
  components/crm/ConversationListItem.test.tsx \
  components/crm/ConversationsListPanel.test.tsx \
  components/crm/ConversationMessagesPanel.test.tsx \
  components/crm/ConversationContextPanel.test.tsx \
  components/crm/MessageBubble.test.tsx \
  components/crm/AudioRecorder.test.tsx \
  hooks/useMessagesPagination.test.tsx \
  components/crm/useConversationDrafts.test.tsx \
  pages/crm/ConversationsPage.newConversation.test.tsx \
  pages/crm/ConversationsPage.ai-handoff.test.tsx \
  pages/crm/ConversationsPage.leadOptions.test.tsx
```

Expected: all tests PASS.

- [ ] **Step 2: Run static and production verification**

Run:

```bash
npm run typecheck
npm run lint
npm run build
```

Expected: all commands exit 0; the production build must not add a new chunk over the existing 500kB warning threshold.

- [ ] **Step 3: Start the app and inspect the real Conversations surface**

Run: `npm run dev -- --host 127.0.0.1`

Use the Playwright workflow to inspect `/crmplus/conversations` or the configured CRM route with the existing authenticated test state. Capture light and dark screenshots at:

- 320 × 568
- 390 × 844
- 768 × 1024
- 1024 × 768
- 1440 × 900

At each width verify: no horizontal overflow, list/thread navigation, selected state, 44px actions, persistent context only at ≥1280px, context modal below that width, visible focus, long names, long messages, empty state, failed-send retry, and no structural panel radius above 20px.

- [ ] **Step 4: Verify reduced motion and keyboard behavior**

In Playwright, emulate `reducedMotion: 'reduce'` and confirm no list-slide, pulse, scale loop, or composer entrance displacement occurs. Keyboard-check search, conversation selection, overflow menus, modal focus trap, `Escape` close, focus restoration, composer send with Enter, and newline with Shift+Enter.

Expected: the journey is fully operable without a pointer and focus never disappears behind overlays.

- [ ] **Step 5: Profile the scoped interaction paths**

Use React DevTools Profiler or an equivalent browser performance trace for:

1. typing ten characters in the composer;
2. selecting another conversation;
3. receiving or simulating a realtime message;
4. scrolling a loaded, paginated thread.

Acceptance criteria:

- composer typing does not commit `ConversationListItem` or unchanged `MessageBubble` instances;
- no long task above 50ms is introduced by the refactor;
- scrolling does not show repeated GPU-heavy blur repainting in the conversation panels;
- no message virtualization is added unless these measurements fail and a separate design is approved.

- [ ] **Step 6: Update the final audit score with evidence**

Append to the audit document:

```markdown
## Final score

**Score:** 9/10 — the journey is accessible, recoverable, responsive, visually coherent, and measured. The remaining point is reserved for production telemetry with real high-volume histories.

- Feedback: ✅ sending, retry, loading, handoff, and unread states are explicit.
- Recovery: ✅ failed text returns to the composer and the failed optimistic item offers retry.
- Affordance/model: ✅ standard controls, persistent selection, and clear action hierarchy.
- Auto-evidence: ✅ list, thread, context, and next action are recognizable without instruction.
- Scan/convention: ✅ sentence case, fewer badges, and clear label/value grouping.
- Hierarchy: ✅ conversation dominates; context remains available and visually quiet.
- Spacing/type: ✅ fixed scale and 12px minimum essential text.
- Color/contrast: ✅ semantic tokens and non-color state cues meet AA checks.
- Depth: ✅ tonal structure; overlay shadows only where layers actually float.
- Polish/a11y: ✅ loading/empty/error/reduced-motion/dark/mobile states verified.
```

If any acceptance criterion is not met, lower the score and state the exact remaining defect instead of claiming 9/10.

- [ ] **Step 7: Run final diff and regression checks**

Run:

```bash
git diff --check
git status --short
npm run test:run -- --maxWorkers=1
```

Expected: no whitespace errors, only intended files modified, and the full frontend suite passes. If the full suite exposes an unrelated baseline failure, record the failing command, test name, and evidence before proceeding.

- [ ] **Step 8: Commit verification evidence**

```bash
git add docs/ui-audits/2026-06-28-crm-plus-conversations.md
git commit -m "docs(crm): record conversations UI verification"
```

---

## Execution order and checkpoints

Execute Tasks 1–6 in order. After each task: run its focused tests, inspect the staged diff, and commit only that task. Because execution is explicitly inline on `main`, do not create a worktree and do not use subagents. Stop and report before any database, Edge Function, provider, realtime, or n8n change becomes necessary; those changes are outside this plan.
