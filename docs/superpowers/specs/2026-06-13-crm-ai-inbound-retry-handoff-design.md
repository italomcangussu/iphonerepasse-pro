# CRM AI Inbound Retry and Handoff Design

**Date:** 2026-06-13

## Objective

Prevent transient delivery failures between the Supabase CRM inbound dispatcher and
the per-channel n8n webhook from silently dropping customer messages. When the
remote endpoint rejects a request with a client error, move the conversation from
AI handling to pending human handling according to the rules below.

## Scope

The change is limited to the outbound HTTP dispatch performed by
`supabase/functions/_shared/crm_ai_inbound_dispatch.ts`.

It does not change UAZAPI ingestion, message persistence, n8n workflow behavior, or
the existing AI-to-human callback handled by `crm-ai-inbound`.

## Retry Policy

Each inbound message can make at most three HTTP attempts:

1. Initial attempt immediately.
2. First retry after 3 seconds.
3. Second retry after an additional 5 seconds.

Retries apply to:

- DNS and connection failures.
- Request timeouts.
- HTTP `429`.
- HTTP `5xx`.

Retries do not apply to other HTTP `4xx` responses.

Each attempt keeps the existing 15-second request timeout. A successful `2xx`
response stops the retry sequence immediately.

## Automatic Handoff

An HTTP `4xx` response causes the conversation to leave AI handling:

- HTTP `429`: retry according to the policy above. If the sequence receives any
  `429` response and no attempt succeeds, perform the handoff after retries are
  exhausted, even if a later attempt ends with another transient failure.
- Other HTTP `4xx`: perform the handoff immediately after the first response.

The handoff must use the existing pending-human semantics:

- `crm_conversations.status = 'human_handling'`
- `crm_conversations.ai_enabled = false`
- `crm_leads.conversation_status = 'transferencia_pendente'`
- `crm_leads.attendance_owner = 'humano_loja'`
- `crm_leads.last_agent_type = 'alana'`
- `crm_leads.handoff_at` and relevant `updated_at` fields receive the current time.

The transition must be idempotent and must not overwrite a conversation already
assumed by a human.

Network failures, timeouts, and HTTP `5xx` responses do not trigger automatic
handoff after retries are exhausted. They remain operational delivery failures
recorded for monitoring.

## Telemetry

The existing `crm_ai_inbound_dispatched` event remains the final dispatch record
and includes:

- Total attempt count.
- Final dispatch result and status code.
- Final error and response body.
- A compact history containing attempt number, status code, and error.
- Whether automatic handoff was requested and its reason.

The event must continue to identify the message, lead, conversation, channel, and
webhook host. It must populate the top-level `conversation_id`, `lead_id`, and
`channel_id` columns through the logging helper so operational queries do not need
to inspect only the JSON payload.

An automatic handoff also records an `ai_escalation` event with source
`ai_inbound_dispatch`, the HTTP status, message ID, and handoff reason.

## Testing

Automated tests must cover:

- Network failure followed by success on the first retry.
- Network failures followed by success on the second retry.
- Immediate success without waiting or retrying.
- HTTP `5xx` exhaustion without handoff.
- HTTP `429` success after retry without handoff.
- HTTP `429` exhaustion followed by pending-human handoff.
- Non-`429` HTTP `4xx` immediate handoff without retry.
- Idempotency when a human has already assumed the conversation.
- Final event telemetry, including attempt count and attempt history.

Tests use injected waiting behavior so the suite verifies the `3000` and `5000`
millisecond delays without sleeping in real time.

## Success Criteria

- A transient DNS failure can recover through either retry without losing the
  customer message.
- No dispatch performs more than three HTTP attempts.
- Client errors cannot leave a rejected message indefinitely marked as AI-owned.
- Human-assumed conversations are never reverted to pending handoff.
- Existing successful dispatch behavior remains unchanged.
