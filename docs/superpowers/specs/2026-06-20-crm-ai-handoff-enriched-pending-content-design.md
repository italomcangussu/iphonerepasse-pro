# CRM AI Handoff Enriched Pending Content Design

## Goal

Improve the CRM manual "Transferir para IA" flow so the compact webhook payload gives the n8n AI enough usable context when a human transfers a conversation back to AI. The handoff should keep sending a compact text payload, but `body.message.text` and `body.message.content` must contain all pending customer messages since the last human outbound reply, enriched with audio transcription and image description when possible.

## Current Behavior

The frontend calls `crm-conversation-handoff` with:

```json
{
  "conversation_id": "<conversation id>",
  "target": "ai",
  "reason": "manual_handoff_to_ai"
}
```

The Edge Function validates the conversation and channel, switches ownership to AI, generates `summary_short`, and posts a compact payload to `crm_channels.ai_resume_webhook_url`.

The existing media enrichment is partial:

- `resolveLatestCustomerMessageForAi` enriches only the latest customer message for summary generation.
- `pendingCustomerTextForAiHandoff` builds the handoff `content/text` synchronously from raw message content.
- Pending audio or image messages without stored text become generic fallbacks such as "Cliente enviou áudio e aguarda continuidade do atendimento."
- The manual handoff payload is intentionally `type: "text"` with `media.URL: null`; n8n receives it as a normal text trigger.

## Design Decision

Use approach B: enrich every pending customer message after the last outbound human reply, concatenate them in chronological order, and use that string as the manual handoff trigger text.

Do not change the n8n webhook contract. The handoff remains:

- `event: "manual_handoff_to_ai"`
- `type: "text"`
- `body.message.text` and `body.message.content` as the enriched pending text
- `media.URL: null`
- no `conversation_context`

This keeps the live `ia repasse-pro v2 avancada` workflow compatible with the current `Webhook -> Formatar Payload CRM2 -> text path` flow while making the message content materially more useful.

## Proposed Data Flow

When `crm-conversation-handoff` handles `target: "ai"`:

1. Fetch the same context window used today:
   - from `lead.handoff_at`, or
   - from `lead.human_started_at`, or
   - from `conversation.created_at`.
2. Filter conversation context to customer inbound and human outbound messages.
3. Build an enriched pending customer text from all messages after the last outbound message:
   - text message: use cleaned `content`;
   - audio message: download `media_url`, transcribe through Groq, use the transcription;
   - image message: download `media_url`, describe through OpenRouter, use a short description;
   - unsupported media or failed enrichment: use the existing operational fallback.
4. Build an enriched transcript for `summary_short` from customer and human messages in the context window.
5. Generate `summary_short` from the enriched transcript and the enriched latest customer message.
6. Update AI ownership fields and `crm_leads.summary_short`.
7. Build the compact handoff payload with `messageText = enrichedPendingText || enrichedLatestCustomerText`.
8. Log the enrichment diagnostics with the existing `crm_manual_handoff_to_ai` event.

## Helper Boundaries

Keep the logic in `supabase/functions/_shared/crm_ai_payload.ts`.

Add small, testable helpers:

- `resolveMessageTextForAi(message, env, fetchImpl)`  
  Returns text plus metadata for one message. It should reuse the existing text, audio, image, and fallback behavior.

- `buildEnrichedTranscript(messages, options)`  
  Async version of `buildTranscript`, preserving the existing `CLIENTE:` and `ATENDENTE:` format while enriching customer media messages.

- `pendingCustomerTextForAiHandoffEnriched(messages, options)`  
  Async replacement for the manual handoff path. It keeps the current "reset pending list on outbound" rule and enriches each pending customer message.

Keep the existing synchronous helpers where they are still useful for cheap fallbacks and tests, unless the implementation plan finds a simpler low-risk cleanup.

## Audio Logic

Audio is already supported in `_shared/crm_ai_payload.ts` through Groq transcription. This design makes that support visible in the actual handoff `content/text`, not only in summary generation.

Audio handling rules:

- detect audio from `media_type` or media URL extension;
- call `transcribeAudioForAi` with `GROQ_API_KEY`;
- preserve model names, values, cities, percentages and commercial details as returned by transcription;
- if the key is missing, the media URL is missing, download fails, or transcription returns empty text, use the existing audio fallback and record the error in diagnostics.

The manual handoff should not be sent as a media payload just because pending messages include audio. n8n already has an audio branch for normal inbound media, but manual handoff is a synthetic CRM resume event and should remain compact text.

## Image Logic

Image handling remains consistent with the current helper:

- detect image from `media_type` or file extension;
- download from `crm_messages.media_url`;
- send a base64 data URL to OpenRouter;
- ask for a short Brazilian Portuguese operational description;
- if enrichment fails, use the image fallback and record the error.

## Summary Short

`summary_short` should improve alongside `content/text`.

Generate it from:

- enriched transcript over the context window;
- enriched latest customer message;
- the same 280-character sanitized limit.

The summary prompt remains operational: short enough to help the AI resume without inventing facts. If OpenRouter fails, fallback to the enriched latest customer message, then enriched pending text, then existing generic fallback.

## Logging And Observability

Extend the `crm_manual_handoff_to_ai` log payload with diagnostics that do not expose secrets:

- `pending_customer_text`: final enriched text sent in the payload;
- `pending_message_count`;
- `enriched_message_count`;
- `enrichment_media_kinds`, for example `["audio", "image"]`;
- `enrichment_errors`, capped and sanitized;
- `summary_fallback` and `summary_error`, preserving current fields;
- `trigger_payload`, preserving current behavior for audit.

The log should make it obvious whether an audio message became a transcription or fell back to a generic text.

## Error Handling

- Missing or invalid webhook URL: keep current behavior, return 422 before ownership changes.
- Missing Groq key or failed audio transcription: continue handoff with fallback text.
- Missing OpenRouter key or failed image description/summary: continue handoff with fallback text.
- Failed webhook dispatch: keep current behavior, AI ownership remains changed and the response returns `triggerDispatched: false`.
- Enrichment should not block transfer for more than the existing practical Edge Function budget. Individual media failures should degrade gracefully.

## Testing Plan

Add Deno tests around the shared helper and handoff contract:

- pending text with only text messages remains unchanged;
- outbound human message resets the pending customer window;
- pending text with text plus audio uses the audio transcription in chronological order;
- audio transcription failure uses the fallback and exposes a diagnostic error;
- pending text with image uses the image description;
- enriched transcript includes enriched media text with `CLIENTE:` and human messages with `ATENDENTE:`;
- `generateSummaryShort` receives enriched context through the handoff flow;
- compact payload still omits `conversation_context` and keeps `event: "manual_handoff_to_ai"`, `type: "text"`, `media.URL: null`.

Run the relevant Deno tests for Edge Functions and the existing n8n guard before any workflow analysis. No n8n workflow edit is required by this design.

## Out Of Scope

- Changing the n8n workflow topology.
- Sending manual handoff as `type: "media"`.
- Persisting transcriptions or image descriptions to `crm_messages`.
- Regenerating `summary_short` on every future inbound dispatch after AI ownership.
- UI changes to the Conversations page.
