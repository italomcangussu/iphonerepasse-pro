# PWA Completo iOS/iPadOS e Push CRM Plus Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Harden the existing PWA so the installed iPhone/iPad experience, Web Push, and CRM Plus notifications are reliable, testable, and Apple-friendly.

**Architecture:** Keep the current Vite PWA `injectManifest` architecture and existing Supabase Edge Functions. Add missing tests and small compatibility fixes around installability, runtime branding, push subscription, service worker notification handling, CRM notification payloads, and user-facing permission controls.

**Tech Stack:** React 19, Vite 6, `vite-plugin-pwa`, Vitest, Testing Library, Supabase Edge Functions, Deno, Web Push, Safari/iOS Home Screen PWA APIs.

---

## Multiagent Execution Map

Run agents in parallel only when their write scopes do not overlap. The controller integrates diffs and runs final verification.

- **Agent A, baseline tests:** `tests/setup.ts`, selected flaky/failing tests only.
- **Agent B, build/installability:** `vite.config.ts`, `public/*.webmanifest`, `lib/runtimeBranding.ts`, related tests.
- **Agent C, client push and UI:** `services/pwa.ts`, `services/pushClient.ts`, `hooks/usePushNotifications.ts`, `components/pwa/*`, related tests.
- **Agent D, service worker:** `public/sw.js`, service worker tests/utilities.
- **Agent E, Supabase push functions:** `supabase/functions/push-subscribe`, `supabase/functions/push-send`, migration review/tests.
- **Agent F, CRM Plus push source:** `supabase/functions/crm-uaz-webhook-receiver/index.ts`, related tests.

If two agents need the same file, pause one and make that work sequential.

## Task 1: Baseline and Test Harness

**Files:**
- Modify: `tests/setup.ts`
- Test: `components/ui/IOSButton.test.tsx`
- Test: `components/ui/Modal.test.tsx`
- Test: `components/ui/ConfirmDialog.test.tsx`
- Test: `components/pwa/PushPermissionPrompt.test.tsx`

- [ ] **Step 1: Write a failing harness test for user-event timer integration**

Create or extend a focused test that fails under the current global setup when `userEvent.setup()` waits on fake/real timers in jsdom. Use a minimal button click test if no specific harness test exists.

```ts
it('allows user-event clicks to resolve without per-test timer plumbing', async () => {
  const user = userEvent.setup();
  const onClick = vi.fn();
  render(<button onClick={onClick}>Salvar</button>);

  await user.click(screen.getByRole('button', { name: 'Salvar' }));

  expect(onClick).toHaveBeenCalledTimes(1);
});
```

- [ ] **Step 2: Run the focused failing tests**

Run:

```bash
npm run test:run -- components/ui/IOSButton.test.tsx components/ui/Modal.test.tsx components/ui/ConfirmDialog.test.tsx components/pwa/PushPermissionPrompt.test.tsx
```

Expected before the fix: at least one test times out or hangs in a user interaction.

- [ ] **Step 3: Add minimal global browser API/test harness compatibility**

Patch `tests/setup.ts` only for missing jsdom APIs that are broadly browser-like and used across the suite. Keep the setup small.

```ts
import '@testing-library/jest-dom/vitest';
import { vi } from 'vitest';

Object.defineProperty(window, 'scrollTo', {
  configurable: true,
  writable: true,
  value: vi.fn()
});

Object.defineProperty(HTMLMediaElement.prototype, 'load', {
  configurable: true,
  writable: true,
  value: vi.fn()
});

if (!Element.prototype.scrollIntoView) {
  Object.defineProperty(Element.prototype, 'scrollIntoView', {
    configurable: true,
    writable: true,
    value: vi.fn()
  });
}

if (!HTMLElement.prototype.showPopover) {
  Object.defineProperty(HTMLElement.prototype, 'showPopover', {
    configurable: true,
    writable: true,
    value: vi.fn()
  });
}

if (!HTMLElement.prototype.hidePopover) {
  Object.defineProperty(HTMLElement.prototype, 'hidePopover', {
    configurable: true,
    writable: true,
    value: vi.fn()
  });
}
```

- [ ] **Step 4: Verify the focused tests**

Run:

```bash
npm run test:run -- components/ui/IOSButton.test.tsx components/ui/Modal.test.tsx components/ui/ConfirmDialog.test.tsx components/pwa/PushPermissionPrompt.test.tsx
```

Expected after the fix: focused tests pass or remaining failures are real assertions, not harness timeouts.

- [ ] **Step 5: Record baseline**

Run:

```bash
npm run typecheck
npm run build
npm run test:run
```

Expected: `typecheck` and `build` pass. If the full suite still has unrelated failures, capture the count and top failing domains in the final task summary.

## Task 2: Build and Installability Guardrails

**Files:**
- Modify: `lib/runtimeBranding.ts`
- Modify: `lib/runtimeBranding.test.ts`
- Modify: `public/app.webmanifest`
- Modify: `public/crm.webmanifest`
- Modify: `public/crmplus.webmanifest`
- Test: `lib/runtimeBranding.test.ts`

- [ ] **Step 1: Write failing manifest/runtime branding tests**

Add assertions that CRM Plus receives the CRM manifest, app title, Apple title, and theme color before install.

```ts
function metaContent(name: string) {
  return document.head.querySelector<HTMLMetaElement>(`meta[name="${name}"]`)?.getAttribute('content');
}

it('sets CRM Plus apple title and theme color with its manifest', () => {
  window.history.replaceState(null, '', '/#/crmplus');

  applyRuntimeBranding();

  expect(manifestHref()).toBe('/crmplus.webmanifest');
  expect(metaContent('apple-mobile-web-app-title')).toBe('CRM Plus');
  expect(metaContent('application-name')).toBe('CRM Plus iPhoneRepasse');
  expect(metaContent('theme-color')).toBe('#1d4ed8');
});
```

- [ ] **Step 2: Run the failing branding test**

Run:

```bash
npm run test:run -- lib/runtimeBranding.test.ts
```

Expected before implementation: the new assertions fail if runtime branding does not update all required metadata.

- [ ] **Step 3: Implement minimal runtime branding corrections**

Update `lib/runtimeBranding.ts` so `applyRuntimeBranding()` upserts a single canonical manifest link, Apple title, application name, and theme color for the active context. Do not change routing.

```ts
upsertMeta('meta[name="application-name"]', {
  name: 'application-name',
  content: brand.appName,
});

upsertMeta('meta[name="apple-mobile-web-app-title"]', {
  name: 'apple-mobile-web-app-title',
  content: brand.appShortName,
});
```

- [ ] **Step 4: Validate manifests structurally**

Run:

```bash
node -e "for (const f of ['public/app.webmanifest','public/crm.webmanifest','public/crmplus.webmanifest']) { const m = JSON.parse(require('fs').readFileSync(f,'utf8')); if (!m.name || !m.short_name || m.display !== 'standalone' || !m.start_url || !m.scope || !Array.isArray(m.icons) || !m.icons.length) throw new Error(f); console.log(f, 'ok'); }"
```

Expected: all manifests print `ok`.

- [ ] **Step 5: Verify PWA build artifact**

Run:

```bash
npm run build
test -f dist/sw.js
test -f dist/app.webmanifest
test -f dist/crm.webmanifest
test -f dist/crmplus.webmanifest
```

Expected: build passes and all artifacts exist.

## Task 3: Client Push State and Subscription

**Files:**
- Modify: `services/pushClient.ts`
- Create: `services/pushClient.test.ts`
- Modify: `hooks/usePushNotifications.ts`
- Modify: `hooks/usePushNotifications.test.tsx`

- [ ] **Step 1: Write failing push client tests**

Create `services/pushClient.test.ts` with tests for unsupported environments, VAPID conversion through subscribe, backend payload shape, and unsubscribe.

```ts
it('subscribes with userVisibleOnly and persists the complete subscription payload', async () => {
  const invoke = vi.fn().mockResolvedValue({ data: { ok: true }, error: null });
  const subscribe = vi.fn().mockResolvedValue({
    endpoint: 'https://push.example/1',
    toJSON: () => ({ endpoint: 'https://push.example/1', keys: { p256dh: 'p256dh', auth: 'auth' } }),
  });

  vi.stubGlobal('PushManager', function PushManager() {});
  Object.defineProperty(navigator, 'serviceWorker', {
    configurable: true,
    value: { ready: Promise.resolve({ pushManager: { getSubscription: vi.fn().mockResolvedValue(null), subscribe } }) },
  });

  // Mock Supabase session and function invoke using the repo's existing mock pattern.
  // Then call getOrCreatePushSubscription(['crm_inbox'], 'store-1').

  expect(subscribe).toHaveBeenCalledWith(expect.objectContaining({ userVisibleOnly: true }));
  expect(invoke).toHaveBeenCalledWith('push-subscribe', expect.objectContaining({
    method: 'POST',
    body: expect.objectContaining({
      endpoint: 'https://push.example/1',
      p256dh: 'p256dh',
      auth: 'auth',
      topics: ['crm_inbox'],
      store_id: 'store-1',
    }),
  }));
});
```

- [ ] **Step 2: Run the failing push tests**

Run:

```bash
npm run test:run -- services/pushClient.test.ts hooks/usePushNotifications.test.tsx
```

Expected before implementation: new tests fail because the mock/test support or behavior is incomplete.

- [ ] **Step 3: Implement minimal client hardening**

Keep feature detection and current API. Ensure:

- no subscription attempt without `serviceWorker`, `PushManager`, `Notification`, and VAPID public key;
- subscription uses `userVisibleOnly: true`;
- full subscription JSON is persisted;
- unsubscribe deactivates backend subscription and clears local cache;
- iOS non-standalone remains `needs_install`.

```ts
export function canUseWebPush(): boolean {
  return typeof window !== 'undefined'
    && 'serviceWorker' in navigator
    && 'PushManager' in window
    && 'Notification' in window;
}
```

- [ ] **Step 4: Verify client push tests**

Run:

```bash
npm run test:run -- services/pushClient.test.ts hooks/usePushNotifications.test.tsx components/pwa/PushPermissionPrompt.test.tsx
```

Expected: all targeted tests pass.

## Task 4: Service Worker Visible Push and Click Routing

**Files:**
- Modify: `public/sw.js`
- Create: `tests/service-worker/push-sw.test.ts`

- [ ] **Step 1: Write failing service worker push tests**

Create a test harness that loads `public/sw.js` in a VM-like context or extracts the push/click behavior into testable handlers if needed.

```ts
it('shows a visible notification even when payload requests silent delivery', async () => {
  const showNotification = vi.fn().mockResolvedValue(undefined);
  const event = makePushEvent({
    title: 'Nova mensagem CRM',
    body: 'Cliente: Oi',
    url: 'https://crm.iphonerepasse.com.br/#/crmplus',
    silent: true,
  });

  await dispatchServiceWorkerEvent('push', event, { showNotification });

  expect(showNotification).toHaveBeenCalledWith('Nova mensagem CRM', expect.not.objectContaining({ silent: true }));
});
```

- [ ] **Step 2: Run the failing service worker test**

Run:

```bash
npm run test:run -- tests/service-worker/push-sw.test.ts
```

Expected before implementation: the test fails if `silent` is passed through or if the harness cannot observe `showNotification`.

- [ ] **Step 3: Implement minimal service worker push normalization**

Patch `public/sw.js` to drop iOS-incompatible silent behavior and keep notification data compact.

```js
const options = {
  body,
  tag,
  data: { url },
  icon: payload.icon || '/brand/icon-192.png',
  badge: payload.badge || '/brand/icon-192.png',
  requireInteraction: !!payload.requireInteraction,
};
```

- [ ] **Step 4: Verify click routing behavior**

Add or update test:

```ts
it('focuses an existing app window and posts NAVIGATE on notification click', async () => {
  const focus = vi.fn().mockResolvedValue(undefined);
  const postMessage = vi.fn();

  await dispatchServiceWorkerEvent('notificationclick', makeClickEvent('/#/crmplus'), {
    clients: [{ url: 'https://crm.iphonerepasse.com.br/', focus, postMessage }],
  });

  expect(focus).toHaveBeenCalled();
  expect(postMessage).toHaveBeenCalledWith({ type: 'NAVIGATE', url: '/#/crmplus' });
});
```

Run:

```bash
npm run test:run -- tests/service-worker/push-sw.test.ts
npm run build
```

Expected: test and build pass.

## Task 5: Supabase Push Functions

**Files:**
- Modify: `supabase/functions/push-subscribe/index.ts`
- Modify: `supabase/functions/push-send/index.ts`
- Create: `supabase/functions/push-subscribe/push-subscribe.deno.ts`
- Create: `supabase/functions/push-send/push-send.deno.ts`

- [ ] **Step 1: Write failing Edge Function tests for subscription validation**

Use the existing Supabase function test style in the repo. Cover missing auth, missing endpoint/keys, successful upsert, and delete.

```ts
Deno.test('push-subscribe rejects incomplete subscription bodies', async () => {
  const response = await invokePushSubscribe({
    method: 'POST',
    jwt: 'valid-user-jwt',
    body: { endpoint: 'https://push.example/1' },
  });

  assertEquals(response.status, 400);
});
```

- [ ] **Step 2: Write failing Edge Function tests for delivery cleanup**

Cover topic filtering and `404`/`410` deactivation.

```ts
Deno.test('push-send deactivates expired subscriptions on 410', async () => {
  const fetchMock = stubFetchEndpoint(410);
  const updateMock = mockSupabaseUpdate();

  const response = await invokePushSend({
    workerSecret: 'secret',
    body: { topic: 'crm_inbox', notification: { title: 'Nova mensagem CRM' } },
  });

  assertEquals(response.status, 200);
  assertEquals(updateMock.deactivatedIds, ['sub-1']);
  assertEquals(fetchMock.calls.length, 1);
});
```

- [ ] **Step 3: Run the failing function tests**

Run:

```bash
deno test --allow-env --allow-net=localhost supabase/functions/push-subscribe/push-subscribe.deno.ts supabase/functions/push-send/push-send.deno.ts
```

Expected before implementation: tests fail until the helper mocks and function seams are complete.

- [ ] **Step 4: Implement minimal function hardening**

Keep function contracts stable:

- `push-subscribe` requires Bearer JWT and complete subscription keys;
- `push-send` accepts service role or worker secret;
- payload requires `notification.title`;
- `404`/`410` deactivate subscriptions;
- transient errors update `last_error_at` and `last_error_message`.

- [ ] **Step 5: Verify function tests**

Run:

```bash
deno test --allow-env --allow-net=localhost supabase/functions/push-subscribe/push-subscribe.deno.ts supabase/functions/push-send/push-send.deno.ts
```

Expected: tests pass.

## Task 6: CRM Plus Notification Source

**Files:**
- Modify: `supabase/functions/crm-uaz-webhook-receiver/index.ts`
- Create or modify: `supabase/functions/crm-uaz-webhook-receiver/crm-uaz-webhook-receiver.deno.ts`

- [ ] **Step 1: Write failing CRM push payload tests**

Cover inbound message and new-lead push calls.

```ts
Deno.test('crm webhook sends crm_inbox push for inbound messages', async () => {
  const pushSend = stubPushSend();

  const response = await invokeCrmWebhook(makeInboundMessagePayload());

  assertEquals(response.status, 200);
  assertEquals(pushSend.calls[0].body.topic, 'crm_inbox');
  assertEquals(pushSend.calls[0].body.notification.title, 'Nova mensagem CRM');
  assertStringIncludes(pushSend.calls[0].body.notification.url, 'crm');
});
```

- [ ] **Step 2: Run the failing CRM function test**

Run:

```bash
deno test --allow-env --allow-net=localhost supabase/functions/crm-uaz-webhook-receiver/crm-uaz-webhook-receiver.deno.ts
```

Expected before implementation: tests fail if notification URLs/topics are incomplete or if no test seam exists.

- [ ] **Step 3: Implement minimal CRM push URL hardening**

Keep existing webhook behavior. Improve only the notification payload:

```ts
const buildCrmNotificationUrl = (conversationId: string, leadId: string): string => {
  const baseUrl = getCrmNotificationBaseUrl();
  const target = conversationId
    ? `/#/crmplus/conversations/${encodeURIComponent(conversationId)}`
    : `/#/crmplus/leads/${encodeURIComponent(leadId)}`;
  return `${baseUrl}${target}`;
};
```

Use this URL in `sendCrmPushNotification` while preserving fallback to the base CRM URL if route support is unavailable.

- [ ] **Step 4: Verify CRM tests**

Run:

```bash
deno test --allow-env --allow-net=localhost supabase/functions/crm-uaz-webhook-receiver/crm-uaz-webhook-receiver.deno.ts
```

Expected: tests pass and webhook still returns success when push-send fails.

## Task 7: Apple-Friendly Push Controls and Settings

**Files:**
- Modify: `components/pwa/PushPermissionPrompt.tsx`
- Modify: `components/pwa/CRMPwaControls.tsx`
- Modify: `components/pwa/PushOptIn.tsx`
- Modify: `components/pwa/PermissionRequest.tsx`
- Modify: related tests under `components/pwa/*.test.tsx`

- [ ] **Step 1: Write failing UI tests for iOS install-first behavior**

Add tests that ensure iOS non-standalone users see install guidance instead of a native notification prompt.

```ts
it('does not request native notification permission before iOS standalone install', async () => {
  mockPush.status = 'needs_install';
  mockPwa.state = { ...mockPwa.state, isIOS: true, isStandalone: false };

  render(<PushPermissionPrompt />);

  expect(screen.queryByRole('dialog', { name: /Notificacoes Push/i })).not.toBeInTheDocument();
  expect(window.Notification.requestPermission).not.toHaveBeenCalled();
});
```

- [ ] **Step 2: Run failing UI tests**

Run:

```bash
npm run test:run -- components/pwa/PushPermissionPrompt.test.tsx
```

Expected before implementation: missing states or copy cause test failure.

- [ ] **Step 3: Implement minimal Apple-friendly controls**

Ensure:

- permission request only happens from a button click;
- denied permission displays recovery guidance;
- `needs_install` disables push activation and shows install guidance where relevant;
- CRM controls subscribe only to `['crm_inbox', 'new_lead']`;
- text is short and actionable.

- [ ] **Step 4: Verify PWA UI tests**

Run:

```bash
npm run test:run -- components/pwa/PushPermissionPrompt.test.tsx hooks/usePushNotifications.test.tsx
```

Expected: tests pass.

## Task 8: Final Integration and Verification

**Files:**
- Modify: `docs/superpowers/plans/2026-05-15-pwa-completo-ios-push-crmplus.md` only for checkbox status if desired.

- [ ] **Step 1: Review worktree**

Run:

```bash
git status --short
git diff --stat
```

Expected: changes are limited to PWA/push/CRM/test files from this plan.

- [ ] **Step 2: Run targeted verification**

Run:

```bash
npm run typecheck
npm run test:run -- lib/runtimeBranding.test.ts services/pushClient.test.ts hooks/usePushNotifications.test.tsx components/pwa/PushPermissionPrompt.test.tsx tests/service-worker/push-sw.test.ts
npm run build
```

Expected: all pass.

- [ ] **Step 3: Run Edge Function verification**

Run:

```bash
deno test --allow-env --allow-net=localhost supabase/functions/push-subscribe/push-subscribe.deno.ts supabase/functions/push-send/push-send.deno.ts supabase/functions/crm-uaz-webhook-receiver/crm-uaz-webhook-receiver.deno.ts
```

Expected: all pass, or document if the repo lacks a stable local Deno test harness for these functions.

- [ ] **Step 4: Run full suite baseline**

Run:

```bash
npm run test:run
```

Expected: either full suite passes or remaining failures match documented pre-existing domains from Task 1.

- [ ] **Step 5: Manual device checklist**

Run on a real iPhone/iPad with iOS/iPadOS 16.4+:

```text
1. Open production/preview HTTPS URL in Safari.
2. Add app to Home Screen.
3. Open from Home Screen icon.
4. Activate notifications from explicit button.
5. Send CRM test notification through push-send.
6. Confirm visible notification appears.
7. Tap notification and confirm CRM Plus opens.
8. Disable notification subscription.
```

Expected: all manual steps pass. If a local machine cannot provide real iOS push delivery, report this as pending device verification.
