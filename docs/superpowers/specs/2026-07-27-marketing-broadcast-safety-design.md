# Marketing Broadcast Safety — Design

## Goal

Make Marketing campaign drafts truthfully persistable and safe to schedule, while correcting audience recency and ticket metrics.

## Scope

- Persist `crm_broadcasts` using the existing schema: `message_template` and `recipient_filters`.
- Expose only audience filters the broadcast worker currently applies: every CRM lead or CRM leads marked as customers.
- Keep RFM lists as ERP prioritization; do not claim they become CRM broadcast recipients until the backend has a customer-to-lead mapping and RFM-aware recipient preparation.
- Remove unsupported message placeholders from broadcast drafts.
- Use the shared `Modal` primitive for focus management, Escape, semantic dialog markup, scroll lock, and minimum close-target size.
- Exclude customers with no purchase history from a recency filter and calculate ticket by purchase count.

## Data Contract

`crm_broadcasts` requires `store_id`, `name`, and `message_template`. `recipient_filters` is JSONB and the worker currently recognizes only `is_customer` and `funnel_stage`.

The client payload is therefore one of:

```ts
{ recipient_filters: {} }
{ recipient_filters: { is_customer: true } }
```

No RFM key is written because the worker would ignore it and could broaden the audience unexpectedly.

## Components

- `lib/marketing/broadcastDraft.ts`: pure payload builder and audience labels.
- `lib/marketing/audience.ts`: pure recency predicate and audience statistics.
- `components/marketing/CampaignsTab.tsx`: accessible shared modal, honest success/error feedback, and supported audience choices.
- `components/marketing/AudienceTab.tsx`: consume the pure audience helpers.

## Error Handling and Accessibility

The modal keeps an operation error inline with `role="alert"`; it never claims local persistence. The shared `Modal` primitive provides dialog semantics, focus trapping, Escape handling, scroll lock, and a 44px close target. Inputs receive explicit `id`/`htmlFor` associations.

## Verification

Unit tests first prove payload shape, recency behavior, and ticket calculation. Then run the focused Marketing tests, changed-file lint, typecheck, build, and the full Vitest suite.
