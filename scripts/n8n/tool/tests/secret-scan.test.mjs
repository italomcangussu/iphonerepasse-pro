// ============================================================================
// secret-scan.test.mjs — net puro do scanSecrets (fase menor "secretScan").
// Sem rede, sem arquivos. Garante: detecta segredos comuns, redige o achado
// (não re-vaza), deduplica por valor com contagem, e NÃO dispara em workflow
// saudável (referências de credencial por id/nome + paths de webhook).
// ============================================================================
import { test } from "node:test";
import assert from "node:assert/strict";
import { scanSecrets } from "../validate.mjs";

const JWT =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyb2xlIjoic2VydmljZV9yb2xlIn0.abcDEF123456_secret";

test("detecta JWT hardcoded e redige (não re-vaza o segredo)", () => {
  const found = scanSecrets({ nodes: [{ parameters: { jsCode: `const k = "${JWT}";` } }] });
  const jwt = found.find((f) => f.type === "jwt");
  assert.ok(jwt, "deveria achar o JWT");
  assert.ok(!jwt.sample.includes("service_role"), "amostra não pode conter o corpo do JWT");
  assert.match(jwt.sample, /^eyJhbGci…\(\d+ chars\)$/);
});

test("detecta Bearer, n8n api key, openai e google", () => {
  const wf = {
    a: "Authorization: Bearer abcdefghijklmnopqrstuvwxyz0123456789",
    b: "n8n_api_0123456789abcdefABCDEF",
    c: "sk-0123456789abcdefABCDEFghij",
    d: "AIzaSyA0123456789_abcdefghijklmnopqrstuv",
  };
  const types = scanSecrets(wf).map((f) => f.type).sort();
  assert.deepEqual(types, ["bearer-token", "google-api-key", "n8n-api-key", "openai-key"]);
});

test("deduplica por valor e conta ocorrências", () => {
  const found = scanSecrets({ x: JWT, y: JWT });
  const jwt = found.find((f) => f.type === "jwt");
  assert.equal(jwt.count, 2);
  assert.equal(found.filter((f) => f.type === "jwt").length, 1);
});

test("workflow saudável (credencial por id/nome + path de webhook) não dispara", () => {
  const clean = {
    nodes: [
      {
        name: "Webhook",
        type: "n8n-nodes-base.webhook",
        parameters: { path: "ai-resume", httpMethod: "POST" },
        credentials: { httpHeaderAuth: { id: "abc123", name: "CRM N8N API" } },
      },
      { name: "Code", type: "n8n-nodes-base.code", parameters: { jsCode: "return $input.all();" } },
    ],
  };
  assert.deepEqual(scanSecrets(clean), []);
});

test("aceita string serializada direto", () => {
  assert.equal(scanSecrets("nada aqui").length, 0);
  assert.equal(scanSecrets(JSON.stringify({ t: JWT })).length, 1);
});
