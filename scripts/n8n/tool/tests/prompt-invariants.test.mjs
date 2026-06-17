// ============================================================================
// prompt-invariants.test.mjs — trava as CLÁUSULAS FUNCIONAIS dos prompts que não
// podem sumir numa reescrita de voz: o formato de saída que os nodes downstream
// parseiam, gatilhos de transferência/handoff, regras anti-alucinação.
//
// Fonte: o `workflow.json` versionado (BASE_DIR) — espelho canônico do vivo. Para
// o prompt estático, cross-check com o `.md` extraído (fidelidade do round-trip).
// Edite a VOZ à vontade; se uma regra de negócio cair junto, este teste pega.
//
// Rodar: node --test scripts/n8n/tool/tests/
// ============================================================================

import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const BASE = path.resolve(HERE, "../../../../n8n/ia-repasse-pro-v2");
const WF = JSON.parse(fs.readFileSync(path.join(BASE, "workflow.json"), "utf8"));

function systemMessage(nodeName) {
  const node = (WF.nodes ?? []).find((n) => n.name === nodeName);
  assert.ok(node, `node ausente no workflow.json: ${nodeName}`);
  const sm = node.parameters?.options?.systemMessage;
  assert.equal(typeof sm, "string", `${nodeName}: systemMessage não é string`);
  return sm;
}

const has = (hay, needle) => assert.ok(hay.includes(needle), `faltou cláusula: ${JSON.stringify(needle)}`);

// --- Router Agent (prompt-expressão) — contrato de roteamento que Code Parse Router lê
test("Router Agent: contrato de saída (intent/route/needs_*) preservado", () => {
  const p = systemMessage("Router Agent");
  for (const k of ["intent_primary", "intent_secondary", "route", "needs_inventory", "needs_human_now", "next_agents", "transfer_destination"]) {
    has(p, k);
  }
  has(p, '"route": "ia"');
  has(p, '"route": "humano"');
  // intents canônicos consumidos a jusante
  for (const intent of ["aparelho_iphone", "aparelho_outro", "fora_do_escopo", "garantia"]) has(p, intent);
});

// --- Bia 2 ESTOQUE (prompt-expressão) — formato JSON que os Code Parse Bia parseiam
test("Bia 2 ESTOQUE: formato de saída JSON {message,transfer} + gatilhos preservados", () => {
  const p = systemMessage("Bia 2 ESTOQUE");
  has(p, "FORMATO DE SAÍDA");
  has(p, '"message"');
  has(p, '"transfer"');
  has(p, "rerun_simulation"); // re-simulação (entrada/PIX) — chave lida a jusante
  has(p, "image_url");
});

// --- Memory 2 - Reconciler (prompt ESTÁTICO, no .md) — dono do lead_state
test("Memory 2 - Reconciler: contrato lead_state + cash_entry + anti-alucinação", () => {
  const p = systemMessage("Memory 2 - Reconciler");
  has(p, '"intent"');
  has(p, "context_ready");
  // feature cash-entry (CLAUDE.md) — não pode sumir numa reescrita
  has(p, "cash_entry_intent");
  has(p, "cash_entry_amount");
  // anti-alucinação
  has(p, "Nao invente");
  has(p, "stock_item_id");
});

// --- Cross-check: o .md extraído bate byte-a-byte com o systemMessage do workflow.json
test("Memory 2 - Reconciler: .md extraído é fiel ao workflow.json", () => {
  const promptsDir = path.join(BASE, "nodes", "prompts");
  const sm = systemMessage("Memory 2 - Reconciler");
  const files = fs.readdirSync(promptsDir).filter((f) => f.endsWith(".md"));
  const match = files.find((f) => fs.readFileSync(path.join(promptsDir, f), "utf8").includes("DONO do lead_state"));
  assert.ok(match, "arquivo .md do Memory 2 não encontrado");
  const body = fs.readFileSync(path.join(promptsDir, match), "utf8");
  // o corpo (sem header) deve conter as mesmas cláusulas-chave do systemMessage
  for (const needle of ["context_ready", "cash_entry_intent", "stock_item_id"]) {
    assert.ok(body.includes(needle) && sm.includes(needle), `divergência .md vs workflow.json em: ${needle}`);
  }
});
