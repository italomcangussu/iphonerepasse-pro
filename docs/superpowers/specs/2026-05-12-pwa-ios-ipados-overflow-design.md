# PWA iOS/iPadOS Overflow Hardening Design

## Context

The app should behave like an installed iOS/iPadOS PWA without allowing the whole application viewport to pan horizontally. Horizontal scroll is allowed only for intentional wide content, especially tables and data grids that cannot fit on small screens.

Initial checks on the public login route at `http://127.0.0.1:5173/#/login` showed no document-level horizontal overflow on iPhone SE, iPhone 16-sized, or iPad portrait viewports. The likely risk is inside authenticated app surfaces, where the shell, tables, modals, and wide controls interact.

The local `:3000` server was ignored because it served a different application. The project Vite server was started on `127.0.0.1:5173` for inspection.

## Goals

- Prevent document-level horizontal scroll/pan across the authenticated app shell.
- Preserve horizontal scroll inside explicit table/grid wrappers when content is wider than the viewport.
- Improve iOS/iPadOS PWA compatibility where the audit found likely issues.
- Verify the result on mobile and tablet-sized viewports.

## Non-Goals

- Redesigning tables into mobile cards.
- Reworking every screen's information architecture.
- Changing authentication, data fetching, or Supabase behavior.
- Implementing a full push notification product flow.

## Layout Design

The app shell should own horizontal containment. The document and root containers should never become wider than the viewport. Any component that needs horizontal scroll must opt in with a dedicated wrapper.

Planned rules:

- `html`, `body`, and `#root` use `max-width: 100%` and document-level `overflow-x` containment.
- The authenticated shell in `components/Layout.tsx` uses full-width bounded containers: `w-full`, `min-w-0`, `max-w-full`, and `overflow-x-hidden`.
- The main content area keeps vertical scrolling but blocks accidental horizontal propagation.
- Wide tables and data grids keep local `overflow-x-auto` behavior through a dedicated class or wrapper such as `.table-scroll-x`.
- The table wrapper uses `max-width: 100%`, `overscroll-behavior-x: contain`, and `-webkit-overflow-scrolling: touch` so horizontal movement stays inside the table.

This makes horizontal scroll explicit instead of accidental.

## PWA Compatibility Design

iOS/iPadOS-specific behavior needs a small hardening pass:

- Validate in build/preview because service worker registration is disabled in dev.
- Keep the current manifest basics: `display: standalone`, scope, start URL, icons, and `viewport-fit=cover`.
- Replace the authenticated shell's `h-screen` dependency with dynamic viewport height handling, such as `100dvh`/`100svh` or an equivalent CSS utility, to avoid Safari standalone viewport issues.
- Review safe-area padding so `black-translucent` status bar support does not double-apply top or bottom insets.
- Update `public/sw.js` so Web Push never relies on silent notifications on Safari/iOS. The service worker should always call `showNotification()` and should not pass through `silent: true` for iOS-incompatible behavior.

## Affected Surfaces

- `index.css`: global horizontal containment and table-scroll utility.
- `components/Layout.tsx`: authenticated app shell sizing and overflow boundaries.
- Table-heavy screens: inventory, finance, settings permissions, CRM CRUD, and similar surfaces should keep horizontal scroll only inside table wrappers.
- `public/sw.js`: push notification options compatible with visible Web Push.

## Testing Strategy

Run static and rendered checks:

- `npm run build`
- Playwright overflow probe against build/preview at iPhone SE, iPhone 16-sized, and iPad portrait viewports.
- For each checked viewport, assert `document.documentElement.scrollWidth <= document.documentElement.clientWidth`.
- For table pages, confirm table wrappers can still scroll horizontally when content is wider than the viewport.
- If smoke credentials are available, repeat on authenticated core routes: dashboard, inventory, finance, PDV, settings, and CRM conversations.

## Acceptance Criteria

- The app document does not horizontally pan in iPhone/iPad PWA-sized viewports.
- Horizontal scroll remains available only inside intentional table/grid wrappers.
- Login, manifest delivery, and service worker build output remain functional.
- The service worker does not attempt iOS-incompatible silent Web Push behavior.
- Verification evidence includes at least one mobile phone viewport and one iPad viewport.

## Open Assumptions

- The reported issue occurs in the authenticated app shell, not the public login route.
- Existing table wrappers are the intended places where horizontal scroll is acceptable.
- Smoke credentials may not be available locally; if absent, authenticated route validation will need either credentials or a separate mocked-auth test harness.
