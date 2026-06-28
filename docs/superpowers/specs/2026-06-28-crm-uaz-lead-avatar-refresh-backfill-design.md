# CRM UAZ Lead Avatar Refresh and Backfill Design

**Date:** 2026-06-28

## Problem

CRM Plus persists WhatsApp lead avatars only while processing an inbound UAZApi
webhook. Existing conversations were not backfilled when avatar support was
deployed, so 416 conversations currently have a visible UAZApi image but a null
`crm_leads.avatar_url`. The fallback also calls `POST /chat/find`, which returns
cached chat rows and can expose expired WhatsApp image URLs. Finally,
`avatar_lead_updated = true` prevents every future refresh, even when a contact
changes their WhatsApp photo.

The frontend already renders `crm_leads.avatar_url`, but it subscribes only to
`crm_conversations`; a background avatar-only update is therefore not reflected
until another conversation event or a reload.

## Goals

- Populate avatars for eligible historical UAZApi conversations.
- Fetch current avatar metadata through the documented UAZApi v2.1.1 contract.
- Refresh an existing avatar at most once per 24 hours during normal webhook
  traffic.
- Recover once from expired WhatsApp image URLs.
- Keep a stable WebP copy in Supabase Storage while changing the stored public
  URL on every successful refresh to invalidate browser/CDN caches.
- Record `synced`, `missing`, `expired`, `failed`, and cooldown outcomes without
  logging provider tokens, phone numbers, or source image URLs.
- Update open CRM Plus conversation lists immediately after `crm_leads` changes.
- Provide a dry-run-first, resumable, idempotent production backfill.

## Non-goals

- No n8n workflow changes.
- No cron job or permanent full-table sweep.
- No group-avatar changes.
- No direct serving of expiring WhatsApp CDN URLs.
- No replacement of the existing public `crm-media` bucket.

## Architecture

### Shared avatar service

Move the avatar-specific logic out of the webhook receiver into
`supabase/functions/_shared/uazLeadAvatar.ts`. Both the webhook receiver and a
new privileged refresh function use this module, preventing the backfill and
live paths from drifting.

The service owns:

- UAZApi `POST /chat/details` request construction and response parsing;
- provider base URL and token resolution from the channel row;
- 24-hour cooldown decisions;
- source download validation and one expired-URL retry;
- ImageMagick conversion to a centered 320x320 WebP at quality 80;
- `crm-media` upload and cache-busted public URL construction;
- `crm_leads` timestamp/URL updates;
- sanitized `crm_event_log` telemetry.

The existing `avatar_lead_updated` column remains for backward compatibility,
but it no longer gates refreshes permanently.

### Database state

Add two nullable columns to `public.crm_leads`:

- `avatar_last_checked_at timestamptz`: last completed provider lookup attempt,
  including a legitimate missing-photo result;
- `avatar_refreshed_at timestamptz`: last successful Storage upload.

Existing rows with `avatar_lead_updated = true` and a non-empty `avatar_url`
are initialized from `updated_at`. No new exposed table, view, security-definer
function, or RLS policy is introduced.

### Live webhook flow

For individual chats, after `upsert_crm_lead` resolves the lead:

1. If `avatar_last_checked_at` is less than 24 hours old, return
   `skipped_cooldown`. A usable avatar URL present directly in a webhook may
   bypass cooldown only when the lead has no stored avatar.
2. Prefer a usable avatar URL carried by the webhook.
3. Otherwise call `POST /chat/details` with
   `{ "number": "<digits>", "preview": true }`.
4. If no image is visible, set `avatar_last_checked_at`, log `missing`, and keep
   the current stored avatar unchanged.
5. Download the source image. If it returns HTTP 401, 403, or 404, record that an
   expired URL was observed, call `/chat/details` once more with
   `preview: false`, and retry the download once.
6. Convert and upload to the deterministic
   `avatars/<store>/<lead>.webp` object with `upsert: true`.
7. Store the public object URL with `?v=<refresh epoch milliseconds>` so the
   changed photo is fetched immediately despite the one-day Storage cache.
8. Set `avatar_lead_updated = true`, `avatar_last_checked_at`,
   `avatar_refreshed_at`, and `updated_at`.

Failures never reject the inbound webhook. They update `avatar_last_checked_at`
only when a provider lookup completed, preserve the last good avatar, and emit
sanitized telemetry.

### Privileged refresh function

Create `supabase/functions/crm-uaz-avatar-refresh/index.ts`. It accepts only
`POST` and requires an `Authorization: Bearer <SUPABASE_SERVICE_ROLE_KEY>` value
that exactly matches the function environment. Gateway JWT verification stays
enabled. Browser clients cannot call it.

Request:

```json
{
  "leadId": "lead-id",
  "force": true
}
```

The function resolves the lead's latest individual UAZApi conversation and
channel tenant-safely, then calls the shared service. It returns only sanitized
status fields and never returns the phone, talk ID, channel token, or source
URL.

### Backfill orchestrator

Add `scripts/crm/backfill-uaz-lead-avatars.mjs` with two explicit modes:

- default/`DRY=1`: page through UAZApi `/chat/find`, correlate by `talk_id`, and
  report candidates that have a remote image but no local avatar;
- `--apply`: invoke `crm-uaz-avatar-refresh` for candidates with bounded
  concurrency of three, print aggregate progress, and write a sanitized JSON
  report under `output/crm/avatar-backfill/`.

The script reads only the required values from `.env.local`, never prints
secrets or contact identifiers, and can be safely rerun. Leads already synced
are omitted on the next scan. `force: true` bypasses cooldown for the one-time
repair.

The backfill uses `/chat/find` only as a cheap candidate inventory. Every actual
refresh is resolved and validated through `/chat/details` by the shared service.

### Frontend realtime

Extend the existing CRM conversation-list Supabase channel with a
`postgres_changes` listener for `UPDATE` events on `crm_leads`. When an updated
lead is already present in local conversation state, patch its `avatar_url`
without reloading messages or the whole conversation list. RLS remains the
tenant boundary.

## Telemetry

Each attempted live or backfill sync emits a final `crm_uaz_avatar_sync` through
the existing `logCRMEvent` helper. When the first source URL is expired, it also
emits an `expired` event before the retry, followed by the final outcome. Events
contain:

- `status`: `synced`, `missing`, `expired`, `failed`, or `skipped_cooldown`;
- `source`: `webhook`, `chat_details_preview`, or `chat_details_full`;
- `trigger`: `inbound_webhook` or `backfill`;
- `retried_after_expiry`: boolean;
- sanitized error code when failed.

Existing foreign keys attach the event to store, channel, lead, and conversation
when available. Payloads exclude phone numbers, talk IDs, tokens, and URLs.

## Testing

Tests are written before production code and must demonstrate these failures:

- `/chat/details` request uses digits plus `preview` and parses both image
  fields;
- a recent check is skipped, while `force` bypasses cooldown;
- a direct webhook image can populate an empty avatar during cooldown;
- 401/403/404 download retries once with full details;
- a missing image records the check without erasing a good stored avatar;
- successful uploads set both timestamps and a cache-busting URL;
- service-role mismatch rejects the privileged function;
- the backfill dry run does not invoke the refresh function;
- the frontend patches the matching lead avatar on a realtime update.

Relevant Deno tests, frontend Vitest tests, typecheck, lint, build, migration
health, and RLS guard must pass before deployment.

## Production rollout

1. Verify the target project ref and remote migration state.
2. Deploy the additive migration through the Supabase CLI.
3. Deploy `crm-uaz-webhook-receiver` and `crm-uaz-avatar-refresh` through the
   Supabase CLI.
4. Confirm the deployed receiver source and function statuses.
5. Run the backfill dry run and record its candidate count.
6. Run `--apply` with concurrency three.
7. Query aggregate lead/avatar timestamps, Storage accessibility, event status
   counts, and remaining UAZ-visible/local-null mismatches.
8. Verify a CRM Plus list receives an avatar-only realtime update.

## Failure and rollback

The migration is additive and does not require immediate rollback. If the new
live path misbehaves, redeploy the previous receiver bundle and disable the
privileged refresh function. Existing Storage objects and good `avatar_url`
values remain valid. The backfill is idempotent and never deletes an avatar;
failed or missing lookups preserve the last good image.
