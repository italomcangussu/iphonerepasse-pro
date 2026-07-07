# CRM Plus Chat Thread UI Design

## Objective

Make the CRM Plus conversation workspace read like a modern messenger while
preserving the CRM-specific behavior already in place: explicit mark-as-read,
per-conversation drafts, provider delivery receipts, optimistic sending,
failure recovery, media actions, AI/human attribution, and mobile PWA behavior.

## Considered approaches

### 1. Native messenger clusters — selected

Consecutive messages from the same sender within five minutes form one visual
cluster. Identity appears at the beginning, delivery metadata at the end, and
the bubbles share compact geometry. This provides the best scanning speed and
removes repeated chrome without hiding operational state.

### 2. Lightweight CRM cards

Keep one card per message but reduce shadows, padding, and metadata. This is the
lowest-risk visual change, but short consecutive messages would still feel like
independent records instead of a conversation.

### 3. Minimal transcript timeline

Render messages as a dense text timeline with small direction markers. This is
excellent for audit/history use, but weakens the familiar WhatsApp/Instagram
mental model used during live attendance.

## Selected design

### Message clustering

The page derives presentation metadata after day grouping. A message joins the
previous cluster only when all of these are true:

- both messages have the same direction;
- both resolve to the same sender identity/type;
- neither crosses a day boundary;
- the time delta is at most five minutes.

Each rendered message receives a cluster position: `single`, `first`, `middle`,
or `last`. Sender attribution is visible on `single` and `first`; timestamp and
delivery state are visible on `single` and `last`.

Spacing is 4px inside a cluster and 12px between clusters. Date separators
remain the only place that displays the calendar date.

### Bubble content and metadata

- Show time as `HH:mm`, not `dd/MM HH:mm`.
- Inbound messages show time only. Provider delivery receipts belong only to
  outbound messages.
- Outbound delivery uses ticks as the compact default. Text remains accessible
  to screen readers; visible text is reserved for pending and failed states.
- Human-facing fallback labels are Portuguese: `IA`, `Você`, and `Cliente`.
- An empty provider payload renders a neutral recovery message, never an
  internal `[system: ...]` string.
- Existing reply, reaction, edit, forward, delete, media recovery, and retry
  behavior remains unchanged.

### Actions and accessibility

- The inbound action trigger uses a visible neutral foreground/background;
  colored outbound bubbles use a translucent white treatment.
- Interactive targets are at least 44x44px. The visible glyph may remain small
  inside the larger hit area.
- The redundant 16px reply shortcut is removed. Reply remains available in the
  44px action menu and desktop context menu.
- Focus-visible, dark mode, keyboard dismissal, and reduced-motion behavior are
  preserved.

### Visual depth and motion

- Normal bubbles use surface contrast instead of card-like elevation.
- Elevation is reserved for menus, reactions, failed-message recovery, and
  transient overlays.
- No GSAP scroll effects are introduced. Chat motion stays local and functional
  through the existing Framer Motion primitives, avoiding scroll/keyboard jank.

### Conversation list

The default row has two primary lines:

1. lead name and relative time;
2. message preview and unread count.

Provider/channel becomes compact tertiary metadata. A status chip appears only
for actionable exceptions such as transfer pending or AI handling; the generic
conversation status chip is removed from the default row.

### Header and context

The header keeps lead identity and ownership visible but reduces the secondary
line to the information needed during attendance. Technical identifiers remain
inside the existing collapsed details panel. No data or workflow behavior is
changed.

## Error handling and protected behavior

- Failed sends keep their inline cause, restored draft, and retry action.
- Opening a conversation does not mark it read.
- Sending a reply and explicit mark-as-read continue to clear unread state.
- Read receipt state remains provider-driven.
- Existing scroll anchoring, pagination, day grouping, media recovery, and
  mobile composer obstruction calculations must not regress.

## Testing

Tests will cover:

- cluster position and five-minute boundary;
- sender label only at cluster start;
- footer only at cluster end;
- inbound messages never showing outbound delivery labels;
- outbound ticks and accessible status labels;
- visible inbound action trigger and 44px targets;
- Portuguese/neutral fallbacks;
- simplified conversation-row metadata and exception badges;
- existing MessageBubble, ConversationMessagesPanel, ConversationListItem, and
  ConversationsPage behavior.

Verification will run focused Vitest suites, TypeScript typecheck, ESLint, and a
production build.
