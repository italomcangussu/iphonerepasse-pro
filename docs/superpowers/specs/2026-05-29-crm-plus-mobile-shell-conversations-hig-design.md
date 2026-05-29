# CRM Plus Mobile Shell and Conversations HIG Design

## Summary

Evolve CRM Plus UI/UX with a mobile-first Apple HIG direction while preserving a productive desktop experience. The approved scope combines the global CRM shell with the Conversations inbox because, on iPhone/PWA, navigation, chat header, message list, and composer compete for the same viewport.

## Goals

- Make CRM Plus feel more native and efficient on iPhone/PWA.
- Replace mobile drawer-first navigation with a visible bottom tab bar for primary destinations.
- Reduce the vertical footprint of the active chat header.
- Improve the chat list scan experience for sellers handling multiple leads.
- Make message bubbles lighter, clearer, and closer to familiar mobile messaging patterns.
- Preserve desktop two-column productivity without keeping heavy mobile-only chrome.
- Maintain existing permissions and page access behavior.

## Non-Goals

- Reworking CRM data loading, realtime behavior, or Supabase schemas.
- Changing message sending, attachment upload, audio recording, reactions, forwarding, editing, or deletion behavior.
- Redesigning Leads, Simulador, Estatisticas, or settings internals beyond navigation entry points.
- Changing CRM standalone routing or authentication handoff.

## Design Principles

This work follows `AgenteHIG.md`:

- Clarity: labels, unread status, channel, and message previews must be readable at mobile sizes.
- Deference: content takes priority over decoration; gradients and heavy shadows are reduced.
- Depth: blur/material is reserved for navigation bars, tab bars, headers, and sheets.
- Consistency: mobile uses familiar iOS patterns: bottom tab bar, compact navigation header, grouped lists, and bottom sheets.
- Touch: every interactive control must meet at least 44px by 44px.
- Accessibility: contrast must remain WCAG AA, focus visible must remain intact, and animations must respect `prefers-reduced-motion`.

## Approved Direction

Use the approved approach: Shell + Conversations.

Mobile/PWA gets a bottom tab bar plus compact conversation surfaces. Desktop keeps a sidebar/two-column workspace, but with calmer styling and denser operational layout.

## Shell UX

### Mobile Navigation

Primary mobile navigation becomes a fixed bottom tab bar with safe-area padding and material blur. It should expose no more than five items:

- Conversas
- Leads
- Simulador
- Estatisticas
- Mais

`Mais` opens a bottom sheet containing the remaining pages available for the current role. The sheet uses the same permission-filtered source as the current sidebar. It must include admin-only pages only for users whose role already grants access.

The mobile drawer/sidebar is no longer the primary navigation. If retained, it is secondary and should not be required for common navigation.

### Desktop Navigation

Desktop keeps a left navigation area. The visual treatment should be calmer than the current dark gradient sidebar:

- lighter or neutral surface;
- clear active indicator;
- section grouping preserved;
- icons and labels aligned to improve scan speed;
- no large decorative gradient as the default surface;
- logout/app link remain accessible but visually secondary.

### Header

The global CRM header should be shorter and less visually noisy on mobile. It should show page context and PWA controls only when useful. It should not consume excessive vertical space before the work surface begins.

## Conversations UX

### Mobile Chat List

The chat list should adopt an iOS grouped-list feel:

- compact title area;
- search bar directly under title;
- most common filters as chips: Todas, Nao lidas, Abertas, WhatsApp;
- advanced filters in a bottom sheet;
- list rows grouped on a plain elevated surface rather than independent floating cards.

Each conversation row must prioritize:

- avatar or initials;
- lead/group name;
- last message preview;
- time;
- unread count;
- provider/channel signal;
- status, but with less visual weight than name and preview.

Rows should remain at least 64px tall on mobile and preserve 44px minimum tap target.

### Chat Header

The active conversation header should be compact on mobile, approximately 48-56px before safe-area adjustments. It should include:

- back button;
- small avatar;
- lead/group name;
- phone or channel subtitle;
- one compact secondary action affordance when needed.

Status should move to a small pill or secondary text instead of consuming an entire visible lane. The header should stay sticky, use subtle material blur, and avoid heavy shadows.

### Message Area

The thread should keep day separators, infinite scroll, new-message pill, and loading/empty states. Visual changes should be restrained:

- message canvas uses a quiet grouped background;
- day separators are smaller and lower contrast;
- message spacing is tightened without making tap targets cramped;
- no horizontal overflow on mobile.

### Message Bubbles

Message bubbles should become lighter and more familiar:

- inbound bubbles use neutral elevated surface;
- outbound human bubbles use the primary iOS/brand blue tint;
- outbound AI bubbles remain distinguishable but less gradient-heavy;
- max width increases on mobile to improve readability, with a target range of 76-82% of thread width;
- desktop max width stays narrower for scan quality;
- shadows are reduced;
- metadata is smaller and quieter;
- timestamp and status remain available;
- action menu remains accessible, but less visually present until hover/tap.

Media previews, audio messages, document cards, quoted replies, reactions, undecryptable fallbacks, and Meta campaign previews must keep their current behavior.

### Composer

The existing composer behavior stays, including attachments, media batch, audio recording, reply preview, and keyboard handling. Visual changes should:

- keep the input reachable above the iPhone home indicator;
- reduce nested card feeling;
- keep 44px icon buttons;
- preserve `is-crm-keyboard-open` behavior;
- avoid hiding essential send/record actions.

## Desktop Conversation Layout

Desktop continues using a two-column layout:

- left chat list remains 340px on desktop, with an allowed range of 320-360px if visual QA shows clipping or inefficient density;
- thread header becomes calmer and more compact;
- chat rows become less card-like;
- filters can remain visible on desktop but should be visually lighter and collapsible;
- no bottom tab bar on desktop.

## Implementation Surface

Expected files:

- `components/crm/CRMStandaloneLayout.tsx`
- `pages/crm/ConversationsPage.tsx`
- `components/crm/MessageBubble.tsx`
- `index.css`
- `components/crm/CRMStandaloneLayout.test.tsx`
- Conversations and MessageBubble tests covering the automated checks listed below

The implementation must not change Supabase data contracts. UI-only helper types are allowed when they do not alter persisted or API shapes.

## Testing

Automated checks should cover:

- CRM layout still renders available role-based pages.
- Seller/admin still see Simulador where currently expected.
- Global store selector remains absent from CRM Plus.
- Mobile viewport renders bottom tab navigation.
- `Mais` exposes role-available overflow pages.
- Conversation list and thread visibility still follow mobile selection behavior.
- Message bubble rendering still supports inbound, outbound human, outbound AI, media, status, and actions.

Manual/browser verification should cover:

- iPhone-sized viewport at 393x852.
- Small iPhone/SE-style viewport at 375x667.
- Desktop viewport at 1440x900.
- Light and dark mode.
- Keyboard-open behavior in the conversation composer.
- No incoherent overlap between global bottom tab, composer, and safe area.

## Acceptance Criteria

- On mobile, CRM Plus has visible bottom navigation with no more than five tabs.
- On mobile, less common pages are reachable through `Mais`.
- The active chat header consumes noticeably less height than the current header while preserving identity and back navigation.
- Chat list rows are easier to scan and do not rely on heavy shadows or gradients.
- Message bubbles are visually lighter, readable, and preserve all current interaction affordances.
- Desktop remains efficient with sidebar navigation and two-column Conversations layout.
- Existing CRM behavior and permissions are preserved.
- Tests and build/type checks used for touched surfaces pass.

## Risks

- Bottom tab and conversation composer can compete for vertical space on small iPhones; safe-area and keyboard states must be verified together.
- Moving overflow navigation into `Mais` can hide admin pages if role filtering is implemented incorrectly.
- Reducing visual weight in message bubbles must not remove status clarity for pending, failed, delivered, and read messages.
- Existing snapshot-free tests may not catch visual regressions, so browser verification is required.
