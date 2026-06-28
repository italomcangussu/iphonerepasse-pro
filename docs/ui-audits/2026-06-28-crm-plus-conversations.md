# CRM Plus Conversations UI Audit

## Baseline

**Target:** Conversas journey

**Score:** 5/10 — functional, but the interface still makes users interpret decoration, tiny metadata, and generic states.

### Lens 1 — Cognition

- ✅ Sending, loading, optimistic messages, handoff, and unread state already provide feedback.
- ❌ Send failure clears the typed text before recovery and relies on transient toast plus a failed bubble.
- ❌ Several disabled or locked states explain themselves only through placeholder text or color.

### Lens 2 — Clarity

- ✅ List → thread mobile navigation follows a familiar messenger model.
- ❌ “Msg”, “Inbox CRM”, generic empty copy, uppercase metadata, and badge density create avoidable interpretation.
- ❌ Transfer and AI states use pulse and color more strongly than plain-language status.

### Lens 3 — Execution

- ✅ Touch targets and iOS keyboard and safe-area behavior have a strong existing foundation.
- ❌ Gradient actions, repeated blur, broad shadows, 24–32px structural radii, and tiny 8–10px text weaken hierarchy and painting performance.
- ❌ Reduced-motion handling is incomplete across list rows, empty states, and overlays.

## Priority fixes

1. Recoverable send failure and explicit state semantics.
2. Conversation-row hierarchy, text floor, keyboard state, and non-color cues.
3. Solid and tonal message, composer, and workspace surfaces.
4. Persistent desktop context with progressive disclosure below desktop.
5. Render isolation and measured browser verification.

## Final score

Update after implementation using the same ten-point rubric and attach verification evidence.
