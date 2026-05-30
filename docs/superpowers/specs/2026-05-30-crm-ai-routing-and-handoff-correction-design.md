# CRM AI Routing And Handoff Correction Design

## Context

The current CRM AI flow has overlapping signals for who owns a conversation. New inbound leads can be created as `open` with `ai_enabled = true`, while the lead attendance fields may say AI, human, or remain unset depending on historical backfills and triggers. The operational AI endpoint is also split between `crm_ai_agent_configs.endpoint_url` and `crm_channels.ai_resume_webhook_url`, but live inbound dispatch and manual handoff use the channel webhook.

This design corrects the business contract before implementation. The goal is that every new inbound customer message resolves to a clear owner, AI or human, and that lead summaries are only written by the intended N8N lead/state upsert flows.

## Goals

- Make inbound ownership configurable by store with per-channel override.
- Use the channel webhook as the single operational endpoint for AI attendance.
- Fall back to human handling when the rule selects AI but AI is unavailable.
- Remove the unused human-approval option from frontend configuration.
- Prevent CRM runtime functions from writing lead summaries outside the N8N lead/state upsert contract.
- Send rich session context to N8N when a human transfers a conversation to AI.
- Sanitize existing inconsistent CRM lead/conversation states conservatively.

## Non-Goals

- Building advanced rule routing by business hours, tags, funnel, or traffic weighting.
- Moving media transcription or visual analysis into Supabase Edge Functions.
- Replacing N8N as the AI orchestration layer.
- Redesigning the full AI agent module beyond removing confusing endpoint/approval controls.

## Routing Contract

Store-level default routing remains in `crm_ai_entry_settings.fallback_mode`, limited operationally to:

- `force_ai`
- `force_human`

Each channel gets an explicit override:

- `crm_channels.ai_entry_mode = 'inherit' | 'force_ai' | 'force_human'`

Inbound customer routing resolves in this order:

1. If the provider message is `fromMe`, the conversation is human-owned.
2. If the channel has `ai_entry_mode` set to `force_ai` or `force_human`, use that value.
3. Otherwise use the store default from `crm_ai_entry_settings.fallback_mode`.
4. If the final decision is AI but `crm_channels.ai_resume_webhook_url` is missing or is not HTTPS, route to human and record an AI-unavailable fallback event.

Resulting states:

- AI available: `crm_conversations.status = 'ai_handling'`, `ai_enabled = true`, `crm_leads.conversation_status = 'em_atendimento_ia'`, `attendance_owner = 'ia'`.
- Human by rule or fallback: `crm_conversations.status = 'human_handling'`, `ai_enabled = false`, `crm_leads.conversation_status = 'em_atendimento_humano'`, `attendance_owner = 'humano_loja'`.

`open` should not be the final state for a newly received customer message. It may remain as a legacy or technical state, but the inbound webhook should resolve the conversation to AI or human.

## Endpoint And Configuration Contract

The live AI endpoint remains on the channel:

- `crm_channels.ai_resume_webhook_url`

This URL is used for:

- inbound customer message dispatch to N8N;
- manual human-to-AI handoff;
- AI availability validation.

`crm_ai_agent_configs.endpoint_url` is not part of the operational flow. The frontend should remove the agent endpoint field and operational endpoint test button from the AI agent settings screen. Agent configs continue to describe non-endpoint behavior only: model, prompt, active state, behavior modes, linked channels, invocation counts, and logs.

`require_human_approval` should be removed from the frontend and no longer saved by the UI. Backend behavior should not depend on it.

The channel screen becomes the operational control surface:

- A top-level store default: "New leads: AI / Human".
- Per-channel routing: "New leads from this channel: Inherit / AI / Human".
- The channel AI webhook HTTPS field.
- A visible readiness indicator showing whether the channel can route to AI.

## Lead Summary Contract

`summary_short` and `summary_operational` are controlled memory fields. They must not be treated as live CRM-derived summaries.

Allowed writers:

- N8N lead upsert through `crm-leads-api`.
- N8N lead-state upsert through `crm-leads-api` when the request updates the lead memory/state portion of the payload.

Disallowed writers:

- message/event triggers;
- automatic summary rebuilds during ordinary CRM state changes;
- `crm-ai-inbound`;
- manual human-to-AI handoff.

`crm-ai-inbound` should accept legacy payloads that include `summary_short` or `summary_operational`, but it must ignore those fields and not update `crm_leads`. If those fields are present, the function should record in log metadata that legacy summary fields were ignored.

Manual human-to-AI handoff does not write summaries. It sends session context to N8N, and N8N may update official summaries later through `crm-leads-api` or lead-state upsert.

Existing generic summaries created by previous CRM backfill should be cleaned conservatively:

- Clear `summary_short` when it matches the generic format similar to `name | phone | etapa: ...`.
- Clear `summary_operational` when it begins with the generic format similar to `lead: ... | etapa: ...`.
- Preserve non-generic summaries.

## Human-To-AI Handoff Contract

When a human transfers a conversation to AI:

1. Validate that the channel has an HTTPS `ai_resume_webhook_url`.
2. Resolve the current session window:
   - from the latest relevant handoff/assumption marker to now;
   - limited to the current day;
   - if no clear marker exists, fall back to inbound customer messages from the current day.
3. Collect inbound customer messages in that window in chronological order.
4. Build `body.message.text` by joining those messages.
5. Include `conversation_context[]` with structured message data:
   - `id`
   - `created_at`
   - `direction`
   - `sender_type`
   - `content`
   - `media_url`
   - `media_type`
   - `media_filename`
   - `provider_message_id`
   - useful metadata needed by N8N
6. Include `lead_detail`, `store_id`, `channel_id`, `conversation_id`, and `meta.source = 'crm_manual_handoff'`.
7. Update the conversation and lead to AI-owned only after the handoff is accepted for dispatch.

Supabase does not transcribe or analyze media in this flow. If a message contains media without text, the joined text should include clear placeholders such as:

- `[audio pendente de transcricao]`
- `[imagem pendente de analise]`
- `[video pendente de analise]`

N8N is responsible for Groq audio transcription and Gemini Flash image/video interpretation using the structured context and media URLs.

If the webhook is missing or invalid, the handoff must not transfer to AI. The conversation remains or becomes human-owned and an AI-unavailable fallback event is recorded.

## Existing Data Sanitization

A migration should:

- Add `crm_channels.ai_entry_mode` with default `inherit` and a check constraint.
- Ensure every store has a `crm_ai_entry_settings` row with an explicit fallback mode.
- Move `ai_handling` conversations without a valid channel AI webhook to `human_handling` with `ai_enabled = false`.
- Align lead attendance fields with the related conversation when the conversation is not AI-owned.
- Avoid using old defaults that mark historical leads as AI-owned without evidence.
- Clear generic backfilled summaries while preserving non-generic summaries.

The sanitization should be conservative and avoid deleting meaningful operator or N8N-authored memory.

## Logging

Add or preserve the following events:

- `crm_ai_routing_decision`: recorded when inbound customer routing selects AI or human.
- `crm_ai_unavailable_fallback`: recorded when a rule selects AI but the channel cannot dispatch to AI.
- `crm_manual_handoff_to_ai`: recorded for manual human-to-AI handoff with the structured context payload metadata.

`crm-ai-inbound` should record that legacy summary fields were ignored when they appear in the payload.

## UI Changes

Channel screen:

- Add store default control for new inbound leads: AI or Human.
- Add per-channel control: Inherit, AI, Human.
- Keep and validate the AI webhook HTTPS field.
- Show AI readiness per channel.

AI agent settings screen:

- Remove `Endpoint n8n`.
- Remove the operational endpoint test button.
- Remove `Aprovacao humana`.
- Stop saving `require_human_approval`.

Conversation screen:

- Preserve manual "Transferir para IA" and "Assumir" actions.
- Manual transfer should rely on the channel webhook readiness.
- If AI is unavailable, show the existing toast/error path and record the fallback event.

## Testing Requirements

Backend tests:

- Store default AI + channel inherit + valid webhook routes inbound to AI.
- Store default AI + channel inherit + invalid/missing webhook routes inbound to human and logs `crm_ai_unavailable_fallback`.
- Channel `force_human` overrides store AI.
- Channel `force_ai` overrides store human.
- Manual human-to-AI handoff sends only the current session/day inbound context and does not write summaries.
- `crm-ai-inbound` ignores `summary_short` and `summary_operational`.
- Generic summary cleanup preserves non-generic summaries.

Frontend tests:

- Channel screen saves store default, channel override, and AI webhook.
- Channel screen shows AI readiness.
- AI agent screen no longer renders endpoint, endpoint test, or human approval controls.

Contract tests:

- Legacy payloads containing summaries to `crm-ai-inbound` do not update `crm_leads`.
- `crm-send-message` guard still rejects late AI sends after human assumption.

## Acceptance Criteria

- A newly received customer message always resolves to AI or human according to store/channel configuration.
- AI routing never silently leaves a lead unattended when AI is unavailable.
- The live AI endpoint is unambiguously the channel webhook.
- `summary_short` and `summary_operational` are not modified by CRM runtime functions except through the approved N8N lead/state upsert contract.
- Manual human-to-AI handoff gives N8N the current session context, including structured media data, without mutating summaries.
- Existing generic backfilled summaries are cleaned without wiping meaningful custom summaries.
