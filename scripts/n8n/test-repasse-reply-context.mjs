import assert from "node:assert/strict";
import {
  normalizeBufferedReplyContext,
  renderBufferedMessagesForAgents,
  renderReplyHint,
} from "./repasse-reply-context.mjs";

const normalized = normalizeBufferedReplyContext({
  target_provider_message_id: "provider-target",
  target_message_id: "target-1",
  target_text: "  Tem cor de preferência? 😊  ",
  target_direction: "outbound",
  target_sender_type: "ai_inbound",
  target_created_at: "2026-06-06T12:39:00.000Z",
  preview_source: "db_lookup",
});

assert.deepEqual(normalized, {
  target_provider_message_id: "provider-target",
  target_message_id: "target-1",
  target_text: "Tem cor de preferência? 😊",
  target_direction: "outbound",
  target_sender_type: "ai_inbound",
  target_created_at: "2026-06-06T12:39:00.000Z",
  preview_source: "db_lookup",
});

assert.equal(
  renderReplyHint(normalized),
  '[Reply: cliente respondeu a mensagem da IA "Tem cor de preferência? 😊"]',
);

const rendered = renderBufferedMessagesForAgents([
  {
    event_id: "m1",
    text: "tem diferença de preço?",
    created_at: "2026-06-06T12:40:00.000Z",
    type: "text",
    sender_name: "Thay",
    reply_context: normalized,
  },
]);

assert.equal(
  rendered,
  '[Reply: cliente respondeu a mensagem da IA "Tem cor de preferência? 😊"]\ntem diferença de preço?',
);

assert.equal(
  renderBufferedMessagesForAgents([
    {
      event_id: "m2",
      text: "Oi",
      created_at: "2026-06-06T12:40:00.000Z",
      type: "text",
      sender_name: "Thay",
    },
  ]),
  "Oi",
);

assert.equal(
  renderBufferedMessagesForAgents([
    {
      event_id: "m3",
      text: "Sim",
      created_at: "2026-06-06T12:40:00.000Z",
      type: "text",
      sender_name: "Thay",
      reply_context: {
        target_provider_message_id: "provider-target",
        target_text: "vcs pega o meu celular de entrada né?",
        target_sender_type: "human",
        preview_source: "reply_preview_text",
      },
    },
  ]),
  '[Reply: cliente respondeu a mensagem do atendente "vcs pega o meu celular de entrada né?"]\nSim',
);

assert.equal(
  renderBufferedMessagesForAgents([
    {
      event_id: "m4",
      text: "queria ver o preço dos dois",
      created_at: "2026-06-06T12:40:00.000Z",
      type: "text",
      sender_name: "Thay",
      reply_context: {
        target_provider_message_id: "provider-target",
        target_text: "O 17 Pro tem 512GB e 1TB também.",
        target_sender_type: "ai_inbound",
        preview_source: "db_lookup",
      },
    },
  ]),
  '[Reply: cliente respondeu a mensagem da IA "O 17 Pro tem 512GB e 1TB também."]\nqueria ver o preço dos dois',
);

assert.equal(
  renderBufferedMessagesForAgents([
    {
      event_id: "m5",
      text: "sim",
      created_at: "2026-06-06T12:40:00.000Z",
      type: "text",
      sender_name: "Thay",
      reply_context: {
        target_provider_message_id: "provider-target",
        target_text: null,
        target_sender_type: null,
        preview_source: "missing",
      },
    },
  ]),
  "[Reply: cliente respondeu a uma mensagem anterior]\nsim",
);

console.log("repasse-reply-context: fixtures passed");
