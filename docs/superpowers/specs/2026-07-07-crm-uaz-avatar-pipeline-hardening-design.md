# CRM Plus UAZ Avatar Pipeline Hardening Design

## Objective

Make lead-avatar refresh correct, non-blocking, retryable, tenant-scoped, and
observable while preserving the existing UAZAPI `/chat/details` contract and
the CRM rule that non-AI WhatsApp processing remains inside the app.

## Current behavior and verified defects

The UAZ webhook resolves a lead and synchronously calls `syncUazLeadAvatar`
before conversation/message persistence. The helper reads `/chat/details`,
downloads the returned profile image, converts it to 320x320 WebP, uploads to
`crm-media`, and stores a public URL in `crm_leads.avatar_url`.

Production inspection on 2026-07-07 established four concrete defects:

1. `crm_leads` is absent from `supabase_realtime`, so the existing frontend
   subscription cannot receive avatar updates.
2. Provider lookup, download, WASM conversion, and upload block the inbound
   webhook.
3. `crm-media` has a public `SELECT` policy, allowing object metadata listing
   even though public object delivery does not require that policy.
4. Storage contains 1,013 avatar objects for 549 active avatar URLs, indicating
   a substantial orphan lifecycle gap.

## Architecture

The webhook performs one small durable enqueue after lead/conversation
resolution. It then persists the message and starts a bounded background drain
with `EdgeRuntime.waitUntil`. Jobs are coalesced by `lead_id`, claimed atomically
through a service-role-only SQL RPC, and retained with retry state if processing
does not finish. Any later inbound webhook drains due work, so a terminated Edge
worker does not lose the request.

The worker always obtains the source URL from documented UAZAPI
`POST /chat/details { number, preview }`; it does not download an arbitrary URL
copied from the webhook payload. Remote URLs must be HTTPS and hosted by an
approved WhatsApp/UAZAPI domain, including every redirect hop.

## Data model

`crm_leads` gains:

- `avatar_storage_path text`
- `avatar_content_hash text`
- `avatar_missing_count integer not null default 0`
- `avatar_missing_since timestamptz`

`crm_uaz_avatar_jobs` contains one row per lead with store/channel/conversation
context, `talk_id`, status, attempts, `available_at`, lease timestamp, error
code, and timestamps. RLS is enabled. `anon` and `authenticated` receive no
table or RPC privileges; service role owns enqueue/claim/finish operations.

## Processing contract

- A successful changed image is converted, hashed, uploaded, and published.
- An unchanged hash updates check state without upload or Realtime churn.
- A successful provider response with no image increments the missing streak.
- The second missing result at least one cooldown cycle later clears the lead
  URL and removes the stored object best-effort.
- Network, timeout, 429, and 5xx failures retry with 5m, 1h, 6h, and 24h delays.
- Permanent configuration or validation failures stop after five attempts and
  remain observable as failed jobs.
- Events are written for real state transitions, not cooldown skips.

## Storage and frontend

The existing public object URLs remain compatible, but unauthenticated bucket
listing is removed. A later private-bucket migration is intentionally excluded:
it would require signed-URL caching throughout the conversation list and is not
needed to close the verified exposure.

One reusable avatar-content component handles image failure and falls back to
group icon or lead initials. `crm_leads` is added to Realtime, and the CRM
subscription is tenant-filtered by the store ids already loaded for the inbox.

## Lifecycle

The existing conversation/lead deletion function removes the lead avatar
best-effort before deleting the row. A dry-run-first maintenance script lists
only `crm-media/avatars/**`, derives referenced paths from lead storage metadata
or legacy public URLs, and deletes only confirmed orphans with `--apply`.

## Verification

Tests must cover SQL contract text, queue claim/retry behavior, safe remote URL
handling, content-hash no-op, two-check removal, deletion cleanup, avatar image
fallback, tenant-filter construction, and orphan discovery. Final verification
runs targeted Vitest before Deno because `deno --node-modules-dir=auto` rewrites
the worktree's dependency layout; npm dependencies are restored before any
subsequent frontend run.

