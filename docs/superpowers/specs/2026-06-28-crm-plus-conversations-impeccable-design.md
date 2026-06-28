# CRM Plus Conversations — Impeccable Design

**Date:** 2026-06-28

**Status:** Approved in conversation

**Primary surface:** CRM Plus / Conversas
**Creative north star:** Mesa de Atendimento

## Context

CRM Plus serves iPhoneRepasse support staff and managers who handle commercial conversations from WhatsApp and Instagram under time pressure. The current Conversations surface is operationally rich, but its visual vocabulary mixes solid product patterns with generic SaaS treatments: broad shadows, repeated translucent layers, decorative gradients, oversized rounding, tiny uppercase labels, and empty or error states that often stop at describing absence.

The redesign keeps the conversation at the center. It must feel reliable and human, preserve operational density, and make context available without letting metadata compete with the customer dialogue.

## Goals

- Audit and improve accessibility to WCAG 2.2 AA.
- Improve responsive behavior from 320px mobile screens through large desktops and iOS standalone PWA use.
- Reduce avoidable rendering and painting work in the list, thread, composer, and contextual panel.
- Strengthen typography, color, spacing, and visual hierarchy while preserving iPhoneRepasse identity.
- Rewrite generic labels, errors, empty states, and first-use guidance so each state offers a clear next action.
- Add purposeful microinteractions for selection, sending, recording, attachments, handoff, and new-message feedback.
- Remove visual patterns that read as generic AI-generated SaaS UI.

## Non-goals

- Changing Supabase schemas, Edge Functions, realtime contracts, provider integrations, or n8n behavior.
- Redesigning CRM pages outside the Conversations journey.
- Refactoring the ERP visual system.
- Adding message virtualization before profiling proves it necessary.
- Changing the business meaning of AI-to-human handoff states.

## Scope and boundaries

The implementation may modify the following surface and supporting components:

- `components/crm/CRMStandaloneLayout.tsx`
- `pages/crm/ConversationsPage.tsx`
- `components/crm/ConversationsListPanel.tsx`
- `components/crm/ConversationMessagesPanel.tsx`
- `components/crm/MessageBubble.tsx`
- `components/crm/AudioRecorder.tsx`
- existing CRM-specific CSS and focused shared UI primitives
- colocated tests for the affected behavior

Components should be extracted from `ConversationsPage` only when the extraction creates a clear render boundary, isolates behavior for testing, or removes duplicated presentation logic. This work does not authorize an unrelated global component rewrite.

## Information architecture

### Desktop

Use the approved “Conversa no centro” hierarchy:

1. Conversation list: approximately 30% of the available workspace.
2. Thread: flexible central region and primary visual focus.
3. Lead context: approximately 25%, persistent but visually quieter than the thread.

The list provides enough information to triage without turning every metadata field into a badge. The thread owns the strongest contrast and the clearest action. The context panel groups only information that changes the next decision: identity, channel, ownership, AI/human state, commercial intent, pending data, and next action.

### Intermediate widths

Keep list and thread visible while moving lead context into a drawer. Do not compress all three regions until messages and controls become hard to read.

### Mobile

Use a progressive list → thread → details flow. Preserve the user's list position and selected conversation when navigating back. The composer remains attached to the visible bottom of the chat surface, respects safe areas, and returns to the correct position after the keyboard closes. No essential action may be reachable only through hover.

## Component behavior

### Conversation list

Each row answers, in order: who, what was last said, when, channel, unread/priority state, and responsibility when relevant. Selection uses color plus structure. Unread and transfer states use weight, iconography or text in addition to color.

Filters remain compact and use familiar control patterns. Saved views and advanced filters may progressively disclose; they should not permanently consume the primary list header on mobile.

### Thread header

Show identity, channel, attendance state, and the most relevant current action. Secondary actions belong in a standard overflow menu with a stable focus lifecycle. Avoid decorative labels and repeated status badges.

### Message history

Messages remain grouped by date, with chronological semantics preserved in the DOM. New-message feedback must not move the user's scroll position when they are reading older history. Load-older behavior preserves scroll anchoring.

Media retains lazy loading and receives explicit loading, failure, and retry states. Message action menus remain accessible by keyboard and touch.

### Composer

Treat attachment, text, audio, and send as one action zone. All controls use at least 44 × 44px targets. Replace decorative send and microphone gradients with solid stateful controls. Preserve typed content and prepared attachments when a send fails.

Shortcut guidance is contextual and sentence case. Do not keep tiny uppercase tracking-heavy hints permanently beneath the composer.

### Lead context

Prefer grouped rows and compact sections over nested cards. Promote the next actionable commercial gap, not every available field. The panel must distinguish AI state, human ownership, and pending transfer without relying on color.

## State and copy model

### No conversation selected

Explain how to begin: choose a conversation from the list or start a new one if the user has permission. Do not use decorative empty-state art or the label “Inbox CRM.”

### No filtered results

State that no conversation matches the active filters and provide an action to clear them. Preserve the search text until the user explicitly clears it.

### Truly empty inbox

Explain whether the next step is connecting a channel, verifying configuration, or starting the first conversation. Actions must respect permissions.

### Loading

Use skeletons shaped like conversation rows and message bubbles. Avoid centered page spinners that erase spatial context.

### Recoverable errors

Place the error next to the failed operation and include a recovery action such as “Tentar novamente.” Preserve user input. Toasts may confirm a result but cannot be the only representation of a failure.

### Irrecoverable or permission errors

Explain what the user can do next: return to the list, request access, refresh the session, or contact an administrator. Do not expose raw provider or database terminology in the primary message.

## Accessibility contract

- Meet WCAG 2.2 AA for text, controls, focus indicators, and non-text contrast.
- Support complete keyboard navigation with visible focus.
- Use standard interactive elements before custom roles.
- Close menus and drawers with `Escape`; restore focus to the trigger.
- Keep focus inside modal dialogs and label each dialog from its visible title.
- Associate field errors and guidance through accessible descriptions.
- Announce sending, failure, and new-message states through scoped live regions without replaying the entire thread.
- Keep touch targets at least 44 × 44px.
- Do not encode state, priority, or ownership through color alone.
- Keep essential text at or above 12px and maintain 4.5:1 contrast for body and placeholder text.
- Support 200% zoom without loss of action or content.

## Visual system

Follow `PRODUCT.md` and `DESIGN.md`.

- Blue is reserved for primary action, focus, and current selection.
- Orange is an attention signal, not decoration.
- Use sentence case for UI labels; uppercase is limited to genuine abbreviations or dense tabular headers.
- Use 10px controls, 14px containers, and no more than 20px radius for structural panels.
- Prefer solid or tonal surfaces. Remove decorative glassmorphism and broad blur from scrolling regions.
- Do not pair a decorative border with a broad shadow on the same component.
- Do not use gradient text, decorative side stripes, repeated eyebrow labels, or identical nested card grids.
- Use tonal layering and dividers for structure. Shadows indicate temporary overlay.

## Motion and microinteractions

Motion communicates state only:

- selection and hover feedback: 150ms;
- panel, drawer, and menu transitions: 200–250ms;
- sending, recording, attachment preparation, handoff, and new-message feedback: immediate state change with restrained transition;
- no orchestrated page entrance sequence.

When `prefers-reduced-motion: reduce` is active, replace displacement and scale with instant state changes or a short crossfade. Content remains visible without animation classes, observers, or delayed JavaScript.

## Performance strategy

Retain existing message pagination, top-sentinel loading, realtime subscription, memoized message bubbles, and lazy media behavior. Improve the surface in this order:

1. Establish render boundaries so composer keystrokes do not rerender the list, full history, and contextual panel.
2. Stabilize callbacks and derived props that cross those boundaries.
3. Remove avoidable `backdrop-filter`, large shadows, and translucent stacking from scrolling and frequently repainted regions.
4. Keep media decoding and expensive content out of the critical interaction path.
5. Apply CSS containment to independent scrolling panels where it does not break overlays or sticky positioning.
6. Profile long lists and histories. Add virtualization only if measured rendering cost remains material and scroll anchoring, dynamic bubble height, search, reply navigation, and load-older behavior can remain correct.

Search, typing, scrolling, and realtime updates must stay responsive under representative conversation history. Performance claims require before-and-after evidence rather than visual inference.

## Data flow and failure safety

Existing data and provider contracts remain authoritative. UI refactoring may reorganize state ownership only when behavior remains equivalent and tests characterize the boundary first.

Optimistic message state must clearly distinguish sending, sent, delivered, read, and failed. A failed optimistic message remains visible with a retry path. Realtime reconciliation must not duplicate the optimistic item or steal scroll from a user reading earlier messages.

Draft text and local attachment metadata survive recoverable send failures and presentation-only rerenders. Object URLs continue to be revoked when attachments are removed or the composer is disposed.

## Verification strategy

### Automated behavior

Add or extend tests before changing behavior for:

- selecting and navigating conversations by keyboard;
- menu, dialog, drawer, and focus restoration behavior;
- loading, no-selection, filtered-empty, truly-empty, and error states;
- draft and attachment preservation after a failed send;
- sending, recorded audio, media attachment, and retry feedback;
- AI-to-human and human-to-AI handoff presentation;
- incoming realtime messages and unread indicators;
- reduced-motion behavior where observable in component logic.

Preserve all existing Conversations, list, message, audio, and handoff tests.

### Visual and responsive

Inspect light and dark themes at 320, 390, 768, 1024, and 1440px. Include iOS standalone behavior with the software keyboard open and closed. Check text zoom, long names, long unbroken message content, empty history, media errors, and busy composer states.

### Performance

Profile representative typing, list filtering, conversation selection, realtime arrival, and scrolling through a long paginated history. Record render counts or timing evidence for the boundaries changed.

### Completion gate

Run focused tests during development, then the relevant broader suite, TypeScript typecheck, ESLint, production build, and browser verification. Any unavailable environment or failing unrelated baseline must be recorded with evidence; it cannot be silently treated as passing.

## Definition of done

- The approved “Conversa no centro” hierarchy works across all target widths.
- Conversation, list, composer, context, empty, loading, and error states satisfy the accessibility contract.
- Generic SaaS visual patterns named in this document are removed from the scoped surface.
- Motion is purposeful and reduced-motion-safe.
- User input survives recoverable failures.
- The scoped performance paths are measured and do not regress.
- Relevant automated and browser verification passes.
- Backend, realtime, provider, and AI handoff contracts remain unchanged.
