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

**Score:** 8/10 — the journey is substantially more accessible, recoverable, responsive, visually coherent, and less generic. The remaining points are reserved for authenticated browser screenshots/profiling with real conversation history and for resolving unrelated lint warnings in legacy n8n patch scripts.

- Feedback: ✅ sending, retry, loading, handoff, unread, empty, and load-error states are explicit.
- Recovery: ✅ failed text is preserved through `useConversationDrafts`; failed optimistic items can be retried inline.
- Affordance/model: ✅ list, thread, context, and composer use standard controls, named regions, and 44px actions.
- Auto-evidence: ✅ triage list, message thread, and desktop context can be understood without decorative badges doing the explaining.
- Scan/convention: ✅ sentence case replaced uppercase metadata in the core chat path; state labels are plain language.
- Hierarchy: ✅ conversation stays centered; context is persistent at ≥1280px and reused in the modal below that.
- Spacing/type: ✅ essential chat text now uses project text tokens at 12px+; tiny helper copy was removed from the composer.
- Color/contrast: ✅ action blue is reserved for primary actions/selection; errors use text plus icon and alert semantics.
- Depth: ✅ message/composer surfaces are solid and tonal; decorative blur and gradient action buttons were removed from the scoped path.
- Polish/a11y: ✅ automated coverage validates list/thread/context/retry/drafts, but full authenticated visual inspection remains pending.

## Verification evidence — 2026-06-28

- ✅ `npx vitest run components/crm/ConversationWorkspaceState.test.tsx components/crm/ConversationListItem.test.tsx components/crm/ConversationsListPanel.test.tsx components/crm/ConversationMessagesPanel.test.tsx components/crm/ConversationContextPanel.test.tsx components/crm/MessageBubble.test.tsx components/crm/AudioRecorder.test.tsx hooks/useMessagesPagination.test.tsx components/crm/useConversationDrafts.test.tsx pages/crm/ConversationsPage.newConversation.test.tsx pages/crm/ConversationsPage.ai-handoff.test.tsx pages/crm/ConversationsPage.leadOptions.test.tsx` → 12 files, 52 tests passed.
- ✅ `npm run typecheck` → `tsc --noEmit` passed.
- ✅ `npm run lint` → exit 0 after ignoring generated `reports/smoke/**`; remaining output is 10 pre-existing warnings in `scripts/n8n/patch-*.mjs`.
- ✅ `npm run build` → production build passed; largest emitted JS chunk remained below the 500 kB warning threshold.
- ⚠️ `npm run test:run -- --maxWorkers=1` → 108 files / 643 tests passed; 2 files / 7 tests failed outside this Conversas scope:
  - `pages/crm/SimulatorPage.test.tsx` — 6 failures around simulator form/admin configuration expectations.
  - `tests/crm-ios-layout-contract.test.ts` — 1 failure expecting mobile-list markers in `pages/crm/AdsPage.tsx`.
- ⚠️ Playwright browser check opened `http://127.0.0.1:3000/#/crm/conversations`, but the local browser redirected to `#/login` because no authenticated CRM session was available. Authenticated screenshots at 320×568, 390×844, 768×1024, 1024×768, and 1440×900 are still the next manual verification step.
- ⚠️ Performance profiling with React DevTools/trace on real high-volume histories remains pending for production-like authenticated data.
