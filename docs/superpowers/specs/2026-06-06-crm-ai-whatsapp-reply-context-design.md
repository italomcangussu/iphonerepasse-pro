# CRM AI WhatsApp Reply Context Design

## Goal

Improve the continuous CRM AI attendance flow so agents understand when a customer uses WhatsApp reply to refer to a specific previous message.

The chosen design is a structured `reply_context` contract. Supabase resolves and sends the referenced message separately from the customer's current text, and n8n renders a compact contextual line before Router, Memory, and Bia agents consume the message.

## Current Context

The `ia repasse-pro` n8n workflow receives compact inbound payloads from the CRM AI dispatch flow. The workflow already has modules for webhook intake, media normalization, Redis buffering, Router, Memory, inventory precheck, Bia 1, Bia 2, and outbound WhatsApp sending.

The CRM already stores WhatsApp reply metadata on `crm_messages`:

- `reply_to_provider_message_id`
- `reply_preview_text`

The UAZ webhook receiver extracts these fields through `extractUazReply`, and outbound CRM messages can also store reply metadata. The missing piece is the AI payload: continuous inbound dispatch currently sends only the current message text and raw inbound payload. Inside n8n, the Redis buffer normalizes each message to a small shape with only `event_id`, `text`, `created_at`, `type`, and `sender_name`, so the semantic relationship is lost.

## Scope

In scope:

- Include reply context for any customer reply, regardless of whether the target message was sent by AI, human, or customer.
- Enrich compact AI inbound payloads with a small `reply_context` object.
- Preserve reply metadata through the n8n Redis buffer.
- Render reply context into a controlled textual hint before Router, Memory, and Bia agents run.
- Add tests and n8n fixtures for resolved, preview-only, and missing reply targets.

Out of scope:

- Redesigning the CRM conversation UI.
- Reintroducing the old large `conversation_context` payload for continuous inbound dispatch.
- Loading broad history around every replied message.
- Blocking AI attendance when reply resolution fails.
- Changing WhatsApp send behavior for replies.

## Recommended Architecture

Add a focused helper in the Supabase AI payload layer to resolve and shape reply context:

- Input: current message row, `conversation_id`, `channel_id`, `reply_to_provider_message_id`, and `reply_preview_text`.
- Lookup: find the referenced message by `channel_id + provider_message_id` first; if that returns no row, fall back to `conversation_id + provider_message_id`.
- Output: a compact `reply_context` object on the AI payload.

The existing compact payload remains the source of truth for the current customer text. `reply_context` is adjacent metadata, not a replacement for `body.message.text`.

## Reply Context Contract

When a reply target is resolved from `crm_messages`, the payload should include:

```json
{
  "reply_context": {
    "target_provider_message_id": "provider-message-id",
    "target_message_id": "crm-message-id",
    "target_text": "Tem cor de preferencia?",
    "target_direction": "outbound",
    "target_sender_type": "ai_inbound",
    "target_created_at": "2026-06-06T12:39:00.000Z",
    "preview_source": "db_lookup"
  }
}
```

When only the WhatsApp/UAZ preview is available:

```json
{
  "reply_context": {
    "target_provider_message_id": "provider-message-id",
    "target_message_id": null,
    "target_text": "Tem cor de preferencia?",
    "target_direction": null,
    "target_sender_type": null,
    "target_created_at": null,
    "preview_source": "reply_preview_text"
  }
}
```

When the customer sent a reply but no target text is available:

```json
{
  "reply_context": {
    "target_provider_message_id": "provider-message-id",
    "target_message_id": null,
    "target_text": null,
    "target_direction": null,
    "target_sender_type": null,
    "target_created_at": null,
    "preview_source": "missing"
  }
}
```

`target_text` must be normalized and capped at 300 characters. Empty strings must become `null`.

## n8n Data Flow

The `ia repasse-pro` workflow should preserve reply context from webhook intake through the Redis buffer:

1. `Formatar Payload CRM2` or the equivalent early normalization step reads `body.message.text` and `reply_context`.
2. `Buffer + Data Lead` includes `reply_context` in each buffered message.
3. `Atualizar Estado Buffer` normalizes each message while preserving a safe `reply_context` object.
4. `Code Consolidador Payload Final` renders `message_buffered` using the reply-aware formatter.
5. Router, Memory, inventory precheck, Bia 1, and Bia 2 receive the same downstream shape as today, plus better text context.

The rendered text should be compact and deterministic. Example:

```text
[Reply: cliente respondeu a mensagem da IA "Tem cor de preferencia?"]
tem diferenca de preco?
```

Sender labels should be inferred from `target_sender_type`:

- `ai_inbound`: `mensagem da IA`
- `human`: `mensagem do atendente`
- `customer`: `mensagem anterior do cliente`
- unknown: `mensagem anterior`

If `target_text` is missing, render only:

```text
[Reply: cliente respondeu a uma mensagem anterior]
```

## Agent Behavior

Agents should treat the reply line as context, not as a new customer statement.

Examples:

- Customer replies `Sim` to `vcs pega o meu celular de entrada ne?`:
  - Memory should understand the customer confirmed trade-in interest.
- Customer replies `Queria ver o preco dos dois` to `O 17 Pro tem 512GB e 1TB tambem.`:
  - Memory and Bia should understand that `dos dois` refers to `512GB` and `1TB`.
- Customer replies `tem diferenca de preco?` to `Tem cor de preferencia?`:
  - Bia should understand the customer is asking whether colors affect price, instead of treating it as a new generic pricing question.

## Error Handling

Reply resolution must be best effort:

- If database lookup fails, fall back to `reply_preview_text`.
- If `reply_preview_text` is also absent, send `preview_source: "missing"` with the target provider id.
- If no reply id exists, omit `reply_context`.
- Dispatch must continue even when reply lookup fails.
- Logging should capture lookup failures at event-log level without exposing full payloads.

## Data Limits

To keep the compact AI payload safe:

- `reply_context.target_text`: max 300 characters.
- Rendered reply hint: max 360 characters.
- No media download or transcription is required for the replied-to target in this phase.
- If the replied-to target was media with no text, use existing `reply_preview_text` such as `[midia]` when available.

## Testing

Supabase tests:

- `buildCompactAiInboundPayload` includes a resolved `reply_context`.
- Reply target lookup prefers `channel_id + provider_message_id`.
- Preview-only fallback uses `reply_preview_text`.
- Missing target does not block dispatch.
- `crm_ai_inbound_dispatched` logs compact metadata and does not rely on `raw_inbound` as the primary reply source.

n8n fixture tests:

- A reply `Sim` to a human/AI question is rendered with the quoted message.
- A reply asking for prices of `os dois` preserves the quoted storage options.
- A reply to a color question preserves the color-question context.
- Messages without replies produce the same `message_buffered` output as before.

Regression tests:

- Existing compact manual handoff still omits the old `conversation_context`.
- Existing memory guardrail tests still pass for non-reply inputs.
- UAZ reply extraction tests remain valid for `replyid`, `stanzaId`, and quoted preview text.

## Rollout

1. Add payload shaping and tests in Supabase.
2. Patch n8n buffer normalization and final formatter using a fixture-driven script.
3. Run non-reply fixtures to confirm output parity.
4. Run reply fixtures based on the WhatsApp examples.
5. Deploy Supabase and n8n changes together, because n8n can ignore absent `reply_context` but Supabase must emit it for the new behavior.

## Acceptance Criteria

- Continuous AI inbound payloads include `reply_context` when the customer message is a WhatsApp reply.
- Any reply target type is supported: AI, human, or customer.
- n8n preserves reply context through Redis buffering.
- Agents receive a compact textual hint that makes short answers and references understandable.
- Reply lookup failures do not stop dispatch or message processing.
- Non-reply conversations keep their current behavior.
