# CRM UAZ Lead Avatar WebP Sync Design

## Context

The CRM already receives inbound WhatsApp messages through
`crm-uaz-webhook-receiver`. That function can extract an avatar URL from UAZAPI
webhook payloads and currently writes the external URL directly to
`crm_leads.avatar_url`.

The remote Supabase project also has `crm_leads.avatar_lead_updated`, a
`trigger_new_lead_avatar()` SQL trigger, and a `crm-lead-profile` Edge Function.
The current deployed behavior does not complete avatar enrichment:
`crm-lead-profile` only returns lead profile data, the trigger calls it with an
incompatible authenticated contract, and no lead avatars are stored in
`crm-media`.

## Goal

Update a lead avatar automatically during inbound UAZAPI webhook handling, but
only when all of these are true:

- the message is from an individual chat, not a group;
- the webhook payload includes a usable lead avatar URL;
- the lead has not already been marked with `avatar_lead_updated = true`;
- the avatar can be downloaded, converted to WebP, uploaded to Supabase Storage,
  and written back successfully.

The webhook must not call avatar download logic for every message from the same
lead. Once a lead has a successfully stored avatar, future messages must skip
avatar processing.

## Non-Goals

- Do not poll UAZAPI for missing avatars when the payload does not include an
  avatar URL.
- Do not backfill all existing leads in this change.
- Do not process group avatars as lead avatars.
- Do not replace the CRM media attachment download function.
- Do not make the UI responsible for avatar conversion or storage.

## Recommended Approach

Extend `crm-uaz-webhook-receiver` with a small avatar sync path after
`upsert_crm_lead` resolves `resolvedLeadId`.

The webhook should keep the current lightweight extraction behavior, but replace
direct external URL persistence with a guarded storage flow:

1. Extract `leadAvatarUrl` with `extractUazLeadAvatarUrl(body)` only for
   non-group payloads.
2. If no avatar URL is present, return to the normal message flow without side
   effects.
3. Fetch `crm_leads.avatar_url` and `crm_leads.avatar_lead_updated` for the
   resolved lead.
4. If `avatar_lead_updated` is true, skip processing.
5. Download the avatar URL with timeout and size protection.
6. Validate the response as an image.
7. Convert the image to WebP using a Deno-compatible image pipeline.
8. Upload to `crm-media` using a deterministic path.
9. Update `crm_leads.avatar_url` with the public Storage URL and
   `avatar_lead_updated = true`.
10. Continue processing the inbound message even if avatar processing fails.

## Storage Contract

Use the existing public `crm-media` bucket because it already allows
`image/webp` and is used by CRM media surfaces.

Avatar object path:

```text
avatars/{storeId}/{leadId}.webp
```

Upload options:

- `contentType: "image/webp"`
- `upsert: true`
- cache control suitable for avatars, such as one day or longer

The database should store the public object URL in `crm_leads.avatar_url`, not
the original UAZAPI URL.

## Data Rules

`avatar_lead_updated` means "a local avatar sync has already succeeded."

The field should only be set to `true` after Storage upload and database update
are ready to commit. If download, conversion, or upload fails, leave
`avatar_lead_updated` unchanged or false so a later webhook with an avatar URL
can try again.

The webhook should not set `avatar_lead_updated = true` merely because the
payload lacked an avatar.

## Error Handling

Avatar sync is best-effort and must not block inbound message ingestion.

If avatar processing fails:

- log a CRM event or console warning with lead/channel context and a compact
  error reason;
- do not return a webhook error response solely because avatar sync failed;
- do not overwrite a valid existing avatar URL with a failed or empty value.

Potential failure reasons include missing content type, unsupported image
format, oversized response, network timeout, conversion failure, and Storage
upload error.

## Performance

The webhook should avoid unnecessary work by checking `avatar_lead_updated`
before downloading.

The avatar download should use a timeout and avoid reading very large responses.
The image conversion must produce a modest WebP avatar suitable for UI display
rather than a full-resolution source image. A target around 256x256 or 320x320
with lossy WebP quality around 75-85 is enough for lead list/detail avatars.

If a Deno-compatible WebP conversion path is not viable in the Edge Function
runtime, implementation should stop and choose a different conversion strategy
before deployment. Storing the original image format is outside this design.

## Testing

Add focused tests for the webhook avatar branch:

- skips avatar processing when payload has no avatar URL;
- skips when `avatar_lead_updated` is already true;
- downloads, converts, uploads, and updates the lead when avatar URL is present
  and the lead is not updated;
- does not fail the webhook when avatar sync fails;
- does not process group avatar as lead avatar.

Tests should mock `fetch`, Supabase Storage upload, and the lead row
lookup/update calls rather than hitting real UAZAPI or Storage.

## Deployment Notes

Deploy the updated `crm-uaz-webhook-receiver` Edge Function after tests pass.

The existing SQL trigger `trigger_new_lead_avatar()` and `crm-lead-profile` do
not need to be used for this workflow. A later cleanup can remove or repurpose
that trigger, but this design keeps the implementation focused on the webhook
path.
