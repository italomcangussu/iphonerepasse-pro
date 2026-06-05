# CRM AI Compact Handoff Design

## Goal

Refactor the CRM backend handoff to AI so manual transfers and future AI-owned inbound messages use a compact, useful payload. The manual "Transferir para IA" flow must generate and persist `crm_leads.summary_short` as the business short memory, including the latest customer interaction enriched with audio transcription or image description when available.

## Existing Constraints

- Keep existing tables and columns. The short memory is `crm_leads.summary_short`; no `short_memory` column will be added.
- Use the existing `crm_channels.ai_resume_webhook_url` for both manual handoff and future inbound dispatch.
- Continue using `crm_conversations.status = 'ai_handling'` and `crm_conversations.ai_enabled = true` to mark AI ownership.
- Continue using `crm_leads.conversation_status = 'em_atendimento_ia'` and `crm_leads.attendance_owner = 'ia'`.
- Treat API keys as runtime secrets:
  - `OPEN_ROUTER_API_KEY`
  - `OPEN_ROUTER_IMAGE_DESCRIPTION_MODEL`, optional
  - `OPEN_ROUTER_SUMMARY_MODEL`, optional
  - `GROQ_API_KEY`

## Recommended Architecture

Create a shared Edge Function helper, `supabase/functions/_shared/crm_ai_payload.ts`, used by:

- `supabase/functions/crm-conversation-handoff/index.ts`
- `supabase/functions/_shared/crm_ai_inbound_dispatch.ts`

The helper will own compact payload shaping, media-aware message text resolution, and short-memory generation. Existing functions keep authentication, permission checks, database updates, fetch dispatch, and event logging.

## Manual Handoff Flow

When the frontend invokes `crm-conversation-handoff` with `target: "ai"`:

1. Validate the conversation, lead, channel, and HTTPS AI webhook.
2. If the conversation is already `status = 'ai_handling'` and `ai_enabled = true`, return `noop: true`.
3. Build the context window from:
   - `lead.handoff_at`, if present;
   - otherwise `lead.human_started_at`, if present;
   - otherwise `conversation.created_at`.
4. Fetch up to 500 messages from that window.
5. Include only:
   - inbound customer messages;
   - outbound human messages;
   - messages with useful text, audio, or image.
6. Build a transcript with `CLIENTE:` and `ATENDENTE:` lines, truncated to 12,000 characters.
7. Resolve the latest customer message as the primary AI trigger text:
   - text is used directly;
   - audio is downloaded and transcribed through Groq Whisper;
   - image is downloaded and described through OpenRouter;
   - failures use operational fallbacks.
8. Generate `summary_short` with OpenRouter from the transcript and the enriched latest customer message.
9. Sanitize `summary_short`:
   - normalize whitespace;
   - limit to 280 characters;
   - fallback to the latest customer message if the model fails.
10. Update `crm_leads.summary_short`, AI ownership fields, and conversation AI status.
11. Send compact trigger payload to `ai_resume_webhook_url`.
12. Log `crm_manual_handoff_to_ai` with the summary, trigger payload, dispatch status, context count, media flags, and processing errors.

## Media Processing

Audio:

- Detect audio from `media_type` or media URL extension.
- Download from `crm_messages.media_url`.
- Call Groq audio transcription with:
  - endpoint `https://api.groq.com/openai/v1/audio/transcriptions`
  - model `whisper-large-v3-turbo`
  - language `pt`
  - `response_format = verbose_json`
- Use the returned text as:
  - latest trigger text;
  - transcript text for the message.

Image:

- Detect image from `media_type` or media URL extension.
- Download from `crm_messages.media_url`.
- Send base64 data URL to OpenRouter chat completions.
- Default model: `mistralai/mistral-ocr-latest`.
- Optional override: `OPEN_ROUTER_IMAGE_DESCRIPTION_MODEL`.
- Prompt asks for Brazilian Portuguese, up to 3 short sentences, no invented details, focused on main item, visible condition/defect, and likely customer intent.

Summary:

- OpenRouter chat completions.
- Default model: `mistralai/mistral-ocr-latest`.
- Optional override: `OPEN_ROUTER_SUMMARY_MODEL`.
- Prompt asks for Brazilian Portuguese, at most 2 short operational sentences, enough for AI to resume without losing context.
- If the call fails, fallback to a compact statement based on the latest customer text or media type.

## Manual Handoff Payload

The webhook payload should be compact:

```json
{
  "event": "manual_handoff_to_ai",
  "type": "text",
  "instanceName": "crm",
  "lead_id": "normalized_phone_or_lead_id",
  "store_id": "store_id",
  "body": {
    "sender": "chatid",
    "message": {
      "messageTimestamp": 1780000000000,
      "text": "latest enriched customer message",
      "senderName": "Cliente",
      "messageid": "manual-ai-conversationId-1780000000000",
      "fromMe": false,
      "edited": "",
      "owner": "",
      "chatid": "chatid",
      "content": "latest enriched customer message"
    },
    "BaseUrl": "https://crm.internal/manual-handoff",
    "EventType": "messages",
    "chatid": "chatid",
    "mediaType": ""
  },
  "lead": {
    "summary_short": "short memory",
    "instagram_user_id": null,
    "instagram_username": null
  },
  "media": {
    "URL": null,
    "mimetype": null,
    "mediaKey": null
  },
  "meta": {
    "source": "crm_manual_handoff",
    "conversation_id": "conversation_id",
    "channel_id": "channel_id",
    "reason": "manual_handoff_to_ai",
    "instagram_user_id": null,
    "instagram_username": null
  }
}
```

## Future Inbound Payload

When the conversation is already owned by AI, `dispatchAiInboundIfEligible` keeps the existing eligibility rules:

- not `fromMe`;
- `sender_type = 'customer'`;
- not a reaction;
- conversation is `status = 'ai_handling'`;
- `ai_enabled = true`;
- channel has HTTPS `ai_resume_webhook_url`;
- no manual handoff log for the same conversation in the last 30 seconds.

It sends a compact payload with:

- `event = 'inbound_message'`;
- `type = 'text'` or `media`;
- `body.message.text/content` from the real inbound message;
- `lead.summary_short` from `crm_leads.summary_short`;
- `media.URL` and `body.mediaType` when there is media;
- `raw_inbound` truncated for observability.

It does not regenerate `summary_short` on every future inbound dispatch in this first refactor.

## Error Handling

- Missing or invalid webhook: return 422 and do not change ownership.
- Missing OpenRouter key: keep handoff working using fallback summary and log the error.
- Missing Groq key or failed audio transcription: use audio fallback and log the error.
- Failed image description: use image fallback and log the error.
- Failed webhook dispatch: keep AI ownership changed, return success with `trigger_dispatched = false`, and log the dispatch failure.

## Testing Plan

Use contract and helper tests before production code changes:

- Manual handoff compact payload includes `lead.summary_short` and omits the old large `conversation_context`.
- Manual handoff updates `crm_leads.summary_short`.
- Manual handoff uses fallback summary when OpenRouter is unavailable.
- Audio/image latest message fallbacks are reflected in trigger text.
- Future inbound dispatch includes `crm_leads.summary_short`.
- Future inbound dispatch keeps the 30-second recent manual handoff dedupe rule.
- Existing AI-to-human transfer behavior remains unchanged.

