# CRM AI Agent Parity Design

Date: 2026-05-29

## Goal

Bring the `iphonerepasse-pro` CRM AI workflow to near-parity with the reference app at `/Volumes/DEV/projetos/warrantyguard-hdi`.

The target behavior is a CRM inbox where an external AI agent, reached through the same n8n/webhook pattern used by the reference app, can:

- receive inbound customer messages automatically while AI owns the conversation;
- receive a manual handoff from a human with recent conversation context;
- send responses back through Supabase edge functions as AI messages;
- transfer a conversation back to human handling;
- expose configuration, logs, invocations, and health indicators in the frontend;
- show clear visual ownership in the conversation UI.

## Reference Findings

The reference app already implements the relevant architecture through these main areas:

- `supabase/functions/crm-ai-inbound/index.ts`
- `supabase/functions/crm-ai-agent-test-endpoint/index.ts`
- `supabase/functions/_shared/crm_ai_inbound_dispatch.ts`
- `supabase/functions/_shared/crm_ai_entry_engine.ts`
- `supabase/functions/crm-conversation-handoff/index.ts`
- `supabase/functions/crm-send-message/index.ts`
- `supabase/functions/crm-uaz-webhook-receiver/index.ts`
- `supabase/functions/crm-instagram-webhook-receiver/index.ts`
- `src/components/crm/automation/AIAgentConfigurator.tsx`
- `src/pages/crm/AISettingsPage.tsx`
- `src/pages/crm/ConversationsList.tsx`
- `src/components/crm/ConversationListRow.tsx`
- `src/components/crm/MessageBubble.tsx`

The current app already has the CRM base, UAZ/Instagram channels, conversation statuses, human handoff, sender display names, and partial AI bubble styling. It lacks the complete AI agent runtime, webhook URL per channel, AI entry settings, invocation logs, manual human-to-AI resume flow, inbound dispatch from webhooks, atomic AI response guard, and the transfer-pending visual state.

## Scope

### In Scope

- Add the missing database fields and tables needed for near-parity.
- Add or adapt the AI edge functions from the reference app.
- Keep the same n8n/webhook HTTPS contract from the reference app.
- Add channel-level AI resume webhook configuration.
- Add AI agent configurator, logs, endpoint test, and recent dispatch health.
- Add inbound dispatch from UAZAPI and Instagram official webhook receivers.
- Add manual handoff from human to AI with context summary.
- Add safe AI response handling through `crm-ai-inbound` and `crm-send-message`.
- Add visual distinction for AI messages.
- Add conversation ownership controls: assume AI, transfer to AI, and blocked composer while AI owns the conversation.
- Add red pulsing top-priority state for conversations transferred by AI to human but not yet assumed.
- Add tests for the contracts and high-risk UI states.

### Out Of Scope

- Changing provider strategy away from n8n/webhook.
- Replacing UAZAPI or Instagram official channel behavior unrelated to AI dispatch.
- Redesigning the full CRM inbox beyond the ownership and AI parity states.
- Building a new AI model integration inside this app; the external agent remains responsible for reasoning.

## Data Model

### `crm_channels`

Add:

- `ai_resume_webhook_url text`

The value is optional, but transfer to AI and automatic inbound dispatch require it to be present and begin with `https://`.

### `crm_ai_entry_settings`

Add a store-scoped table equivalent to the reference app. It controls whether automatic AI entry/dispatch is enabled and how fallback behavior is handled.

Core fields:

- `store_id`
- `is_enabled`
- `fallback_mode`
- `reopen_hours`
- `business_hours`
- `special_business_hours`
- `rules`
- timestamps and RLS policies scoped to accessible stores

### `crm_ai_agent_configs`

Expand the current table so it can support the reference configurator:

- `endpoint_url`
- `behavior_modes`
- `auto_send_response`
- `require_human_approval`
- `trigger_conditions`
- `channel_ids`
- `total_invocations`
- `total_successes`
- `total_failures`
- `routing_mode`
- `routing_priority`
- `traffic_weight`

Existing basic fields such as `name`, `model`, `system_prompt`, `config`, and `is_active` stay compatible.

### `crm_ai_agent_invocations`

Add a log table for agent calls and responses:

- `store_id`
- `agent_config_id`
- `routing_rule_id` when available
- `source` such as `manual_test`, `inbound`, or `manual_handoff`
- `status` such as `success` or `failure`
- `routing_reason`
- `metadata`
- `created_at`

### Lead Attendance Fields

Add the fields required for UI ownership and priority:

- `conversation_status`
- `attendance_owner`
- `handoff_at`
- `human_started_at`
- `last_agent_type`

The implementation should preserve existing lead data and use defaults compatible with current CRM rows.

### Message Sender Type

Allow `crm_messages.sender_type = 'ai_inbound'` in addition to existing values.

AI outbound messages should be stored as:

- `direction = 'outbound'`
- `sender_type = 'ai_inbound'`

## Edge Function Design

### `crm-ai-inbound`

Receives the external agent callback.

Input contract follows the reference app:

- `conversation_id`
- `lead_id`
- `response_text`
- `confidence_score`
- `intent`
- `sentiment`
- `urgency`
- `lead_qualification`
- `suggested_actions`
- `metadata.channel_id`

Behavior:

- load conversation and verify `ai_enabled = true`;
- select an active agent config by store/channel/routing;
- if `auto_response` and `auto_send_response` are enabled, call `crm-send-message` with `sender_type = 'ai_inbound'`;
- if lead qualification is included, update lead tags/signals;
- if negative sentiment or high urgency requires escalation, set conversation to human handling and mark the lead as transfer pending;
- store suggestions in conversation metadata when auto-send is off;
- record `crm_ai_agent_invocations`.

### `crm-conversation-handoff`

Keep existing human handoff behavior and add `target = 'ai'`.

For `target = 'ai'`:

- require authenticated user;
- verify the user can access the conversation/store/channel;
- require channel `ai_resume_webhook_url` and HTTPS;
- collect recent human/customer messages since the last handoff or a bounded fallback window;
- include transcribed audio and image descriptions where the reference app already does so, adapted to available dependencies;
- generate or store an operational summary;
- update conversation to `status = 'ai_handling'`, `ai_enabled = true`;
- update lead ownership fields to AI;
- POST the manual handoff payload to the channel AI webhook;
- log `crm_manual_handoff_to_ai`.

If the conversation is already in AI handling, the function returns a no-op response and does not redispatch.

### `crm-send-message`

Add support for a caller-provided sender type, restricted to safe values.

For `sender_type = 'ai_inbound'`:

- require `conversationId`;
- verify conversation is still `status = 'ai_handling'` and `ai_enabled = true`;
- perform an atomic update/check before provider dispatch to prevent late AI sends after a human assumes;
- return a conflict error such as `human_assumed_during_ai_response` when the guard fails;
- store outbound message as AI, not human;
- preserve current human send behavior and sender display name logic.

For `sender_type = 'human'`:

- if sending into an AI-owned conversation from the UI, require the user to assume first;
- human sends should switch the conversation to human handling only through the intentional assume flow or existing provider `fromMe` logic.

### Webhook Receivers

Adapt UAZAPI and Instagram receivers to call the shared inbound dispatcher after inserting inbound customer messages.

Dispatch eligibility:

- message is inbound from customer;
- not a reaction-only event;
- conversation is `status = 'ai_handling'`;
- conversation has `ai_enabled = true`;
- store AI entry settings are enabled;
- channel has valid HTTPS `ai_resume_webhook_url`;
- no recent manual handoff duplicate event within the dedupe window.

Dispatch failure must not block message persistence.

### Shared Helpers

Port and adapt:

- `crm_ai_inbound_dispatch.ts`
- `crm_ai_entry_engine.ts`

The helper boundaries should stay small and testable: eligibility, payload building, dispatch/logging, business-hours/rule evaluation.

## Frontend Design

### Channel Configuration

`CRMChannels` gains an AI webhook field:

- label: `Webhook de retomada da IA`
- validates HTTPS in UI before save where practical;
- maps to `ai_resume_webhook_url`;
- shows a clear hint that this is the n8n endpoint used when the IA receives or resumes a conversation.

### AI Settings And Configurator

Add the AI settings page and configurator from the reference app, adapted to current routing and design tokens.

Capabilities:

- create/edit/delete AI agent configs;
- set endpoint URL, model, prompt, behavior modes, auto-send, approval mode, routing, and linked channels;
- test endpoint;
- view recent invocations and recent webhook dispatch health;
- show channels missing AI webhook URL.

### Conversation List

Conversation ordering should prioritize transfer-pending conversations above normal conversations until a human assumes them.

Transfer-pending row:

- red-tinted background;
- pulsing visual treatment;
- badge `Transferência pendente`;
- appears at the top even when other conversations have newer timestamps.

AI-owned row:

- AI badge/dot;
- warm but non-critical background, matching the approved visual direction.

### Conversation Header And Composer

Header shows who owns the atendimento:

- `IA ativa`
- `IA transferiu para humano`
- `Atendimento humano`

Actions:

- when AI owns: `Assumir atendimento da IA`;
- when human owns and channel has webhook: `Transferir para IA`;
- when human owns and channel lacks webhook: `Configurar webhook IA`;
- when transfer is pending: primary action is `Assumir`.

Composer:

- blocked while `ai_enabled = true`;
- helper text tells the user to assume before sending manually;
- enabled immediately after successful assume.

### Message Bubbles

Use three visual tones:

- inbound/customer: existing inbound style;
- outbound human: existing human outbound style;
- outbound AI: distinct AI style with IA label/icon.

The approved direction uses a warm/orange AI bubble and red system state for transfer pending.

## State Transitions

### Customer Inbound While AI Owns

1. Provider webhook receives message.
2. Message is persisted.
3. Dispatcher checks eligibility.
4. Dispatcher POSTs `inbound_message` payload to n8n webhook.
5. Event log records success/failure.
6. External agent calls `crm-ai-inbound`.
7. `crm-ai-inbound` sends AI response through `crm-send-message` when allowed.

### Human Transfers To AI

1. User clicks `Transferir para IA`.
2. `crm-conversation-handoff` validates channel webhook.
3. Function gathers context and updates conversation to AI handling.
4. Function POSTs manual handoff payload to n8n.
5. UI refreshes into AI-owned state and blocks composer.

### AI Transfers To Human

1. Agent callback indicates escalation through sentiment/urgency or explicit metadata.
2. `crm-ai-inbound` updates conversation to human handling and lead status to `transferencia_pendente`.
3. Conversation appears pulsing red at top.
4. Human clicks `Assumir`.
5. Lead `conversation_status` leaves pending, `human_started_at` is set, composer unlocks.

### Human Assumes During AI Delay

1. Human assumes conversation.
2. Conversation becomes human-owned.
3. Late `crm-ai-inbound` response attempts `crm-send-message`.
4. Atomic guard rejects with conflict.
5. No AI message is sent.

## Error Handling

- Missing AI webhook URL: block manual transfer to AI and show a configuration message.
- Non-HTTPS webhook URL: block manual transfer and automatic dispatch.
- n8n dispatch failure: log event and keep inbound message saved.
- `crm-ai-inbound` on disabled AI conversation: return non-success with no message sent.
- late AI response after human assumes: return conflict and do not dispatch provider message.
- database schema drift: tests should fail on missing expected columns/contracts.

## Testing Strategy

### Database / Migration Tests

- Required columns exist.
- Sender type accepts `ai_inbound`.
- AI invocation and entry settings tables have expected constraints and RLS grants.
- Conversation/lead ownership triggers or update paths keep lead attendance fields synchronized.

### Edge Function Tests

- `crm-ai-inbound` sends AI message when conversation is AI-owned.
- `crm-ai-inbound` does not send when AI is disabled.
- `crm-send-message` rejects late `ai_inbound` sends after human assume.
- `crm-conversation-handoff target='ai'` validates webhook URL and dispatches payload.
- UAZ/Instagram webhook receivers call inbound dispatcher only for eligible inbound customer messages.

### Frontend Tests

- Channel form maps and saves AI webhook URL.
- AI configurator can render configs, linked channels, and invocation states.
- AI message bubble uses AI styling.
- Human message bubble remains distinct.
- Transfer-pending conversation sorts above normal rows and uses red pulsing state.
- Composer is blocked while AI owns the conversation and enabled after assume.
- Buttons render correctly for AI-owned, human-owned, missing-webhook, and transfer-pending states.

## Implementation Notes

- Port by module, not by blind file copy.
- Keep existing `iphonerepasse-pro` naming and design tokens where they differ from the reference app.
- Preserve current CRM behavior for manual human messages, UAZAPI sends, Instagram sends, media handling, replies, and sender display names.
- Prefer small shared helpers for dispatch and entry logic so edge functions remain testable.
- Add migrations in chronological order after current latest migration.
- Do not commit `.superpowers/brainstorm` companion files.

## Acceptance Criteria

- A channel can store a valid HTTPS AI resume webhook URL.
- An admin can configure AI agents and view invocation/log health.
- A human can transfer a conversation to IA and the n8n webhook receives context.
- A customer reply during AI ownership dispatches to the n8n webhook.
- The external agent can call back through `crm-ai-inbound` and send an AI message.
- A human can assume an AI-owned conversation.
- Late AI responses do not send after human assumption.
- A conversation transferred by IA to human appears pulsing red at the top until assumed.
- Message bubbles clearly distinguish customer, human, and IA senders.
- Relevant edge and frontend tests cover the new behavior.
