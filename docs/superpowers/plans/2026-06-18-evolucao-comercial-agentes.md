# Evolução Comercial dos Agentes (Bia 1 / Bia 2) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task (inline execution). Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remover a pergunta de bandeira de cartão (simulação padrão `visa_master`) e tornar a Bia 2 ESTOQUE mais vendedora, sem regressão.

**Architecture:** Um módulo de transform puro/idempotente (`transform-sales-evolution.mjs`) edita um objeto-workflow (jsCode dos gates + systemMessage dos agentes) por `.replace()` exato com guards. Os testes aplicam o transform sobre `workflow.json` (em memória) e validam comportamento real executando o jsCode transformado (reusando `baseState`/`runRoutingFlags`). O deploy (`deploy-sales-evolution.mjs`, clone do `deploy-bia2-merge.mjs`) faz GET do vivo, aplica o transform da fase, valida, faz backup e PUT. Após cada deploy, re-sincroniza o mirror decomposto e roda smoke ao vivo. Mesma função pura no teste e no deploy → zero drift.

**Tech Stack:** Node ESM (via nvm), `node:test`, n8n REST (`tool/netio.mjs`), Supabase (smoke), workflow vivo `Cr4fPWe0prwS6XjI`.

## Global Constraints

- **node só via nvm:** antes de qualquer `node`/`npm`, rodar `export NVM_DIR="$HOME/.nvm"; . "$NVM_DIR/nvm.sh"`.
- **NUNCA renomear nós** (≥450 refs `$('Nome')` + patch scripts). O nó sobrevivente continua `Bia 2 ESTOQUE`.
- **Guard primeiro:** antes de tocar no vivo, rodar `node scripts/n8n/guard-live-workflow-sync.mjs` (re-sincroniza se houve edição manual). O hook PreToolUse também dispara.
- **PUT só com allowlist de settings** (`buildPutBody` já faz; strip `timeSavedMode`). **Segredos** lidos por `netio.mjs`, nunca impressos.
- **Não setar `state.card_brand`** em lugar nenhum; não persistir `visa_master` no `lead_state`. O fallback `visa_master` vive só no Montar Body ([60_01:171](../../../n8n/ia-repasse-pro-v2/nodes/code/60_01_montar-body-do-simulador.js)) — intocado.
- **Transform idempotente** e **testes state-aware** (pós-deploy o mirror já está transformado → re-aplicar é no-op). Mesmo padrão de `bia2-merge`.
- **Invariantes de prompt preservados** em toda mudança de voz: contrato `{message, transfer}`, marcadores de estágio/roteamento, `NATURALIDADE` 1×, regra de cidade pós-sim, regra de cor por estoque, transferência humana em trade-in de risco. Blocos de (B) são **aditivos** (não reescrevem texto existente, exceto o CTA fraco da linha 239).
- **Buffer-race no smoke:** validar pelo runData da execução que rodou `Simulador`/`Montar Body`, não pela resposta postada.
- **Não-regressão:** `npm run test:n8n-tool` verde a cada commit.

## File Structure

- **Create** `scripts/n8n/transform-sales-evolution.mjs` — transform puro. Exporta: `removeCardBrandGates(wf)`, `removeCardBrandPrompts(wf)`, `b1Cta(wf)`, `b2Objection(wf)`, `b3Recovery(wf)`, `b4Recommend(wf)`, `b5Microconv(wf)`, `transformPhase(wf, phase)`, e constantes de marcadores. Helpers internos `replaceOnce(s, find, repl)` (assert: `find` ocorre 1×) e `insertAfter(s, anchor, block)`.
- **Create** `scripts/n8n/deploy-sales-evolution.mjs` — deploy por fase (clone de `deploy-bia2-merge.mjs`): `DRY=1`, `--phase A|B1|B2|B3|B4|B5|B`, `--rollback <file>`.
- **Create** `scripts/n8n/tool/tests/sales-evolution.test.mjs` — invariantes do transform + comportamento dos gates (executa jsCode transformado).
- **Modify** `scripts/n8n/tool/tests/routing-flags.test.mjs:76-85` — atualizar o teste obsoleto "D3: com card_brand definido…" (Task 3, pós re-sync).
- **Modify** `package.json` (`test:n8n-tool`) — adicionar `sales-evolution.test.mjs`.
- **Modify** (pós-deploy, via re-sync automático) `n8n/ia-repasse-pro-v2/workflow.json` + `nodes/code/50_01_*.js` + `nodes/code/50_04_*.js` + `nodes/` prompts.
- **Modify** `n8n/ia-repasse-pro-v2/README.md` + memória — changelog (Task 10).

---

### Task 1: Transform module + remoção dos gates de `card_brand` (A — código)

**Files:**
- Create: `scripts/n8n/transform-sales-evolution.mjs`
- Create: `scripts/n8n/tool/tests/sales-evolution.test.mjs`
- Modify: `package.json` (script `test:n8n-tool`)

**Interfaces:**
- Produces: `removeCardBrandGates(wf) -> wf` (muta clones de `Code Routing Flags`.parameters.jsCode e `Code Refresh Lead State Before Switch2`.parameters.jsCode), `transformPhase(wf, phase) -> wf`, helper `replaceOnce(str, find, repl) -> str`.
- Consumes: `baseState`, `runRoutingFlags` exportados de `routing-flags.test.mjs`.

- [ ] **Step 1: Escrever o módulo transform (esqueleto + gates)**

`scripts/n8n/transform-sales-evolution.mjs`:

```js
// transform-sales-evolution.mjs — edições puras/idempotentes sobre um objeto-workflow.
// Mesma função no teste (sobre workflow.json) e no deploy (sobre o vivo fresco).
// node via nvm.

export function replaceOnce(str, find, repl) {
  const n = str.split(find).length - 1;
  if (n !== 1) throw new Error(`replaceOnce: esperado 1 match, achei ${n} para: ${JSON.stringify(find.slice(0, 60))}…`);
  return str.replace(find, repl);
}
export function insertAfter(str, anchor, block) {
  const n = str.split(anchor).length - 1;
  if (n !== 1) throw new Error(`insertAfter: âncora não única (${n}): ${JSON.stringify(anchor.slice(0, 60))}…`);
  return str.replace(anchor, anchor + "\n" + block);
}

const node = (wf, name) => {
  const x = wf.nodes.find((n) => n.name === name);
  if (!x) throw new Error(`nó ausente: ${name}`);
  return x;
};

// ── (A) gates: card_brand deixa de ser pré-requisito de simulação ──
export function removeCardBrandGates(wf) {
  const rf = node(wf, "Code Routing Flags");
  let js = rf.parameters.jsCode;
  if (js.includes("!!state.card_brand")) {
    // repasseV2CanRequestSimulation
    js = replaceOnce(js,
      "  cashEntryResolved === true &&\n  !!state.card_brand &&\n",
      "  cashEntryResolved === true &&\n");
    // shouldSimulateNow
    js = replaceOnce(js,
      "  !!state.stock_item_id &&\n  !!state.card_brand &&\n",
      "  !!state.stock_item_id &&\n");
  }
  if (js.includes("!state.card_brand")) {
    // needsCashEntryQuestion (cláusula redundante)
    js = replaceOnce(js,
      "  cashEntryResolved !== true &&\n  !state.card_brand &&\n",
      "  cashEntryResolved !== true &&\n");
  }
  rf.parameters.jsCode = js;

  const refresh = node(wf, "Code Refresh Lead State Before Switch2");
  let r = refresh.parameters.jsCode;
  if (r.includes("!!inputData.card_brand")) {
    r = replaceOnce(r,
      "  !!inputData.card_brand &&\n",
      "");
  }
  refresh.parameters.jsCode = r;
  return wf;
}

export function transformPhase(wf, phase) {
  const order = ["A", "B1", "B2", "B3", "B4", "B5"];
  const upto = phase === "B" ? order : order.slice(0, order.indexOf(phase) + 1);
  for (const p of upto) {
    if (p === "A") { removeCardBrandGates(wf); removeCardBrandPrompts(wf); }
    if (p === "B1") b1Cta(wf);
    if (p === "B2") b2Objection(wf);
    if (p === "B3") b3Recovery(wf);
    if (p === "B4") b4Recommend(wf);
    if (p === "B5") b5Microconv(wf);
  }
  return wf;
}

// stubs preenchidos nas próximas tasks (mantêm o módulo importável)
export function removeCardBrandPrompts(wf) { return wf; }
export function b1Cta(wf) { return wf; }
export function b2Objection(wf) { return wf; }
export function b3Recovery(wf) { return wf; }
export function b4Recommend(wf) { return wf; }
export function b5Microconv(wf) { return wf; }
```

- [ ] **Step 2: Escrever o teste de comportamento dos gates (RED)**

`scripts/n8n/tool/tests/sales-evolution.test.mjs`:

```js
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { removeCardBrandGates } from "../../transform-sales-evolution.mjs";
import { baseState } from "./routing-flags.test.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const WF = path.join(HERE, "../../../../n8n/ia-repasse-pro-v2/workflow.json");
const loadWf = () => JSON.parse(fs.readFileSync(WF, "utf8"));

// Executa o jsCode do "Code Routing Flags" JÁ transformado, com $input mockado.
function runFlags(wf, state) {
  const js = wf.nodes.find((n) => n.name === "Code Routing Flags").parameters.jsCode;
  const fn = new Function("$input", "$", js);
  const $input = { first: () => ({ json: structuredClone(state) }) };
  return fn($input, undefined)[0].json;
}
// state-aware: o vivo já pode estar transformado (pós-deploy).
const isGatesApplied = (wf) =>
  !wf.nodes.find((n) => n.name === "Code Routing Flags").parameters.jsCode.includes("!!state.card_brand");
function gated(wf) { return isGatesApplied(wf) ? wf : removeCardBrandGates(wf); }

test("gate A: lead pronto SEM card_brand simula (shouldSimulateNow=true)", () => {
  const wf = gated(loadWf());
  const out = runFlags(wf, baseState({
    stock_item_id: "abc-123",
    cash_entry_asked: true,   // entrada resolvida (sem intenção)
    card_brand: null,
  }));
  assert.equal(out.shouldSimulateNow, true);
});

test("gate A: entrada NÃO resolvida ainda dispara a pergunta de entrada (sem card_brand)", () => {
  const wf = gated(loadWf());
  const out = runFlags(wf, baseState({
    cash_entry_asked: false, cash_entry_intent: null, cash_entry_amount: null,
    card_brand: null,
  }));
  assert.equal(out.routing_decision, "ask_cash_entry_before_sim");
});

test("gate A: card_brand definido NÃO pula a pergunta de entrada não resolvida", () => {
  const wf = gated(loadWf());
  const out = runFlags(wf, baseState({
    card_brand: "visa",
    cash_entry_asked: false, cash_entry_intent: null, cash_entry_amount: null,
  }));
  assert.equal(out.routing_decision, "ask_cash_entry_before_sim");
});

test("gate A: idempotente (re-transformar não muda o jsCode)", () => {
  const once = gated(loadWf());
  const before = once.nodes.find((n) => n.name === "Code Routing Flags").parameters.jsCode;
  removeCardBrandGates(once);
  const after = once.nodes.find((n) => n.name === "Code Routing Flags").parameters.jsCode;
  assert.equal(after, before);
});
```

- [ ] **Step 3: Registrar o teste no `package.json`**

Editar o script `test:n8n-tool` adicionando ` scripts/n8n/tool/tests/sales-evolution.test.mjs` ao final da lista de arquivos.

- [ ] **Step 4: Rodar o teste — deve PASSAR (o transform já remove os gates)**

```bash
export NVM_DIR="$HOME/.nvm"; . "$NVM_DIR/nvm.sh"
node --test scripts/n8n/tool/tests/sales-evolution.test.mjs
```
Esperado: 4 testes PASS. (O 1º teste falharia se o `removeCardBrandGates` não removesse `!!state.card_brand` — é a prova da remoção do gate.)

- [ ] **Step 5: Rodar a suíte inteira (não-regressão)**

```bash
export NVM_DIR="$HOME/.nvm"; . "$NVM_DIR/nvm.sh"
npm run test:n8n-tool
```
Esperado: tudo verde (o `routing-flags.test.mjs` roda contra o `.js` mirror ainda original → continua passando; será atualizado na Task 3 pós-deploy).

- [ ] **Step 6: Commit**

```bash
git add scripts/n8n/transform-sales-evolution.mjs scripts/n8n/tool/tests/sales-evolution.test.mjs package.json
git commit -m "feat(n8n): transform de evolução comercial + remoção dos gates de card_brand (A)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 2: Remoção da pergunta de bandeira nos prompts (A — voz)

**Files:**
- Modify: `scripts/n8n/transform-sales-evolution.mjs` (preencher `removeCardBrandPrompts`)
- Modify: `scripts/n8n/tool/tests/sales-evolution.test.mjs` (testes de prompt A)

**Interfaces:**
- Produces: `removeCardBrandPrompts(wf)` edita `Bia 2 ESTOQUE`.parameters.options.systemMessage e `Bia 1`.parameters.options.systemMessage.

- [ ] **Step 1: Preencher `removeCardBrandPrompts` no transform**

Substituir o stub `export function removeCardBrandPrompts(wf) { return wf; }` por:

```js
export const ESTAGIO2_NOVO = `# ESTÁGIO 2 — AVANÇO PARA SIMULAÇÃO (NUNCA PERGUNTE BANDEIRA)

Nunca pergunte a bandeira do cartão. A simulação usa a condição padrão do cartão automaticamente. Quando o cliente confirmar que a opção apresentada serve, avance direto para a simulação:

"Fechou. Vou simular na condição padrão do cartão pra você já ver como fica. 😊"

Se você ainda não perguntou sobre entrada, faça a pergunta de entrada (Pix/dinheiro) ANTES de simular — nunca pergunte bandeira no lugar dela.
Se o cliente informar uma bandeira espontaneamente, use-a; mas nunca bloqueie ou atrase a simulação por falta desse dado. Para o cliente, chame sempre de "condição padrão do cartão", nunca diga "visa_master".`;

export function removeCardBrandPrompts(wf) {
  const b2 = wf.nodes.find((n) => n.name === "Bia 2 ESTOQUE");
  let sm = b2.parameters.options.systemMessage;
  if (sm.includes("# ESTÁGIO 2 — BANDEIRA DO CARTÃO")) {
    // bloco inteiro do ESTÁGIO 2 (até o cabeçalho do ESTÁGIO 3)
    sm = replaceOnce(sm,
      `# ESTÁGIO 2 — BANDEIRA DO CARTÃO

(só após cliente confirmar que a opção apresentada serve)

"Fechou. Qual a bandeira do seu cartão? Visa, Master, Elo ou Amex?"

Mapeamento: Visa/Master → "visa_master" | Elo → "elo" | Amex → "amex" | Hipercard → "hipercard".`,
      ESTAGIO2_NOVO);
    // frases de disponibilidade que pedem bandeira → avanço direto
    const subs = [
      ["Qual a bandeira do seu cartão pra eu simular?", "Vou simular na condição padrão do cartão pra você."],
      ["Qual a bandeira do seu cartão pra eu já simular o valor pra você?", "Vou já simular o valor pra você na condição padrão do cartão."],
      ["conduza direto para a simulação pedindo a bandeira do cartão.", "conduza direto para a simulação na condição padrão do cartão."],
      ["diga que vai já simular o valor certinho pra ele e peça a bandeira do cartão.", "diga que vai já simular o valor certinho pra ele na condição padrão do cartão."],
      ["com mais razão não cite preço nem peça bandeira:", "com mais razão não cite preço:"],
      ["Como padrao, conduza para simulacao e peca a bandeira do cartao.", "Como padrao, conduza para a simulacao na condicao padrao do cartao (nunca pergunte bandeira)."],
      ["Se o cliente insistir no preco antes de informar bandeira ou antes da simulacao,", "Se o cliente insistir no preco antes da simulacao,"],
      ["A condicao final no cartao eu consigo te passar certinha na simulacao. Qual a bandeira do seu cartao?", "A condicao final no cartao eu consigo te passar certinha na simulacao."],
      ["(bandeira do cartão, simulação ou fechamento)", "(simulação ou fechamento)"],
      ["(cidade, capacidade, bandeira, simulação ou fechamento)", "(cidade, capacidade, simulação ou fechamento)"],
    ];
    for (const [a, b] of subs) sm = sm.split(a).join(b);
    b2.parameters.options.systemMessage = sm;
  }

  const b1 = wf.nodes.find((n) => n.name === "Bia 1");
  let s1 = b1.parameters.options.systemMessage;
  s1 = s1.split("(cidade, capacidade, bandeira, simulação ou fechamento)").join("(cidade, capacidade, simulação ou fechamento)");
  s1 = s1.split("cor quando fizer sentido, cidade de retirada e bandeira do cartão.").join("cor quando fizer sentido e cidade de retirada.");
  b1.parameters.options.systemMessage = s1;
  return wf;
}
```

- [ ] **Step 2: Escrever os testes de prompt A (no `sales-evolution.test.mjs`)**

Adicionar ao arquivo de teste:

```js
import { removeCardBrandPrompts } from "../../transform-sales-evolution.mjs";
import { structuralErrors } from "../extract.mjs";

const sm = (wf, name) => wf.nodes.find((n) => n.name === name).parameters.options.systemMessage;
const isPromptsApplied = (wf) => !sm(wf, "Bia 2 ESTOQUE").includes("# ESTÁGIO 2 — BANDEIRA DO CARTÃO");
function prompted(wf) { return isPromptsApplied(wf) ? wf : removeCardBrandPrompts(wf); }

test("prompt A: Bia 2 não pede bandeira e ganha o ESTÁGIO 2 sem bandeira", () => {
  const wf = prompted(loadWf());
  const t = sm(wf, "Bia 2 ESTOQUE");
  assert.ok(!/bandeira/i.test(t), "nenhuma menção a bandeira na Bia 2");
  assert.ok(t.includes("AVANÇO PARA SIMULAÇÃO (NUNCA PERGUNTE BANDEIRA)"));
  assert.ok(t.includes("condição padrão do cartão"));
});

test("prompt A: Bia 1 não pede bandeira", () => {
  assert.ok(!/bandeira/i.test(sm(prompted(loadWf()), "Bia 1")));
});

test("prompt A: invariantes preservados (contrato + NATURALIDADE 1x + estágios)", () => {
  const t = sm(prompted(loadWf()), "Bia 2 ESTOQUE");
  assert.equal(t.split("NATURALIDADE — SEM CARA DE IA (REGRA DURA)").length - 1, 1);
  assert.ok(t.includes("ESTÁGIO 3 — SIMULAÇÃO + FECHAMENTO"));
  assert.ok(t.includes("ESTÁGIO 4 — RESERVA E DADOS PIX"));
  assert.ok(t.includes("FORMATO DE SAÍDA"));
});

test("prompt A: estrutura do workflow íntegra após transform", () => {
  const wf = prompted(gated(loadWf()));
  assert.deepEqual(structuralErrors(wf), []);
});
```

- [ ] **Step 3: Rodar os testes — devem passar**

```bash
export NVM_DIR="$HOME/.nvm"; . "$NVM_DIR/nvm.sh"
node --test scripts/n8n/tool/tests/sales-evolution.test.mjs
```
Esperado: todos PASS (gates + prompts A).

- [ ] **Step 4: Suíte inteira**

```bash
npm run test:n8n-tool
```
Esperado: verde.

- [ ] **Step 5: Commit**

```bash
git add scripts/n8n/transform-sales-evolution.mjs scripts/n8n/tool/tests/sales-evolution.test.mjs
git commit -m "feat(n8n): remover pergunta de bandeira dos prompts Bia 1/Bia 2 (A — voz)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 3: Deploy (A) ao vivo + smoke + atualizar teste obsoleto

**Files:**
- Create: `scripts/n8n/deploy-sales-evolution.mjs`
- Modify: `scripts/n8n/tool/tests/routing-flags.test.mjs:76-85` (pós re-sync)

**Interfaces:**
- Consumes: `transformPhase` de `transform-sales-evolution.mjs`; `getWorkflow/putWorkflow/activateWorkflow` (netio), `buildPutBody` (deploy_body), `structuralErrors` (extract).

- [ ] **Step 1: Escrever `deploy-sales-evolution.mjs`**

```js
// deploy-sales-evolution.mjs — aplica uma FASE da evolução comercial no vivo.
// GET vivo → transformPhase(live, PHASE) → valida (structuralErrors + new Function
// nos nós de código editados) → backup → buildPutBody → PUT → activate.
//   DRY=1                     → previa
//   --phase A|B1|B2|B3|B4|B5|B (default A)
//   --rollback <arquivo.json> → PUT do backup + activate
// node via nvm; segredo lido por netio (nunca impresso).
import fs from "node:fs";
import path from "node:path";
import { getWorkflow, putWorkflow, activateWorkflow } from "./tool/netio.mjs";
import { buildPutBody } from "./tool/deploy_body.mjs";
import { structuralErrors } from "./tool/extract.mjs";
import { transformPhase } from "./transform-sales-evolution.mjs";

const DRY = process.env.DRY === "1" || process.env.DRY === "true";
const BACKUP_DIR = "output/n8n/backups";
const ts = () => new Date().toISOString().replace(/[:.]/g, "-");
function saveBackup(wf, tag) {
  fs.mkdirSync(BACKUP_DIR, { recursive: true });
  const f = path.join(BACKUP_DIR, `sales-evolution-${tag}-${ts()}.json`);
  fs.writeFileSync(f, JSON.stringify(wf, null, 2));
  return f;
}
function assertSyntax(wf) {
  for (const name of ["Code Routing Flags", "Code Refresh Lead State Before Switch2"]) {
    const n = wf.nodes.find((x) => x.name === name);
    new Function("$input", "$", n.parameters.jsCode); // lança em erro de sintaxe
  }
}
async function rollback(file) {
  const saved = JSON.parse(fs.readFileSync(file, "utf8"));
  if (structuralErrors(saved).length) throw new Error("backup inválido");
  if (DRY) { console.log("DRY rollback"); return; }
  await putWorkflow(buildPutBody(saved)); await activateWorkflow();
  console.log("rollback aplicado + reativado.");
}
async function main() {
  const rb = process.argv.indexOf("--rollback");
  if (rb >= 0) return rollback(process.argv[rb + 1]);
  const pi = process.argv.indexOf("--phase");
  const PHASE = pi >= 0 ? process.argv[pi + 1] : "A";

  const live = await getWorkflow();
  console.log(`vivo: ${live.nodes.length} nós, versionId ${live.versionId} — fase ${PHASE}`);
  for (const must of ["Code Routing Flags", "Code Refresh Lead State Before Switch2", "Bia 2 ESTOQUE", "Bia 1"]) {
    if (!live.nodes.some((n) => n.name === must)) throw new Error(`base inesperada: falta ${must}`);
  }
  const out = transformPhase(structuredClone(live), PHASE);
  const errs = structuralErrors(out);
  if (errs.length) { console.error("structuralErrors:\n" + errs.join("\n")); process.exit(1); }
  assertSyntax(out);
  if (out.nodes.length !== live.nodes.length) { console.error("ERRO: contagem de nós mudou (topologia não deve mudar)"); process.exit(1); }
  console.log("validação OK (structuralErrors=[], sintaxe OK, topologia preservada)");
  if (DRY) { console.log("DRY=1 → nada escrito."); return; }
  const bkp = saveBackup(live, `pre-${PHASE}`);
  console.log(`backup: ${bkp}`);
  await putWorkflow(buildPutBody(out));
  await activateWorkflow();
  const after = await getWorkflow();
  console.log(`OK — vivo: ${after.nodes.length} nós, versionId ${after.versionId}, active=${after.active}`);
}
main().catch((e) => { console.error(e.message); process.exit(1); });
```

- [ ] **Step 2: Guard + DRY (previa, não escreve)**

```bash
export NVM_DIR="$HOME/.nvm"; . "$NVM_DIR/nvm.sh"
node scripts/n8n/guard-live-workflow-sync.mjs
DRY=1 node scripts/n8n/deploy-sales-evolution.mjs --phase A
```
Esperado: guard "em sincronia"; DRY imprime "validação OK" e "DRY=1 → nada escrito."

- [ ] **Step 3: Deploy A ao vivo**

```bash
node scripts/n8n/deploy-sales-evolution.mjs --phase A
```
Esperado: "OK — vivo: … active=true". Anotar o `versionId` e o caminho do backup.

- [ ] **Step 4: Re-sincronizar o mirror decomposto**

```bash
node scripts/n8n/repasse-maint.mjs pull
node scripts/n8n/guard-live-workflow-sync.mjs
```
Esperado: `workflow.json` + `nodes/code/50_01_*.js` + `nodes/code/50_04_*.js` + prompts atualizados; guard registra novo baseline.

- [ ] **Step 5: Atualizar o teste obsoleto em `routing-flags.test.mjs`**

Agora o `.js` mirror reflete a nova lógica. O teste "D3: com card_brand definido, nunca repergunta entrada" (linhas 76-85) testava comportamento que mudou (card_brand não suprime mais a pergunta de entrada). Substituir por:

```js
test("D3: entrada resolvida (asked) não dispara pergunta — independe de card_brand", () => {
  const out = runRoutingFlags(baseState({
    preferred_city: "Sobral",
    card_brand: null,
    cash_entry_asked: true,
    cash_entry_intent: null,
    cash_entry_amount: null,
  }));
  assert.notEqual(out.routing_decision, "ask_cash_entry_before_sim");
});
```

- [ ] **Step 6: Suíte inteira — verde contra o novo código**

```bash
npm run test:n8n-tool
```
Esperado: tudo verde (routing-flags agora valida o gate removido; sales-evolution state-aware vê o mirror já transformado → no-op).

- [ ] **Step 7: Smoke ao vivo — A (no bandeira / visa_master / entrada ainda dispara)**

```bash
node scripts/n8n/smoke-step.mjs reset
node scripts/n8n/smoke-step.mjs say "Quero um iPhone 15 Pro Max 256GB"
node scripts/n8n/smoke-step.mjs say "Pode ser, quero esse"
```
Verificar nos diagnósticos: a IA **não** pergunta bandeira; quando pronto, dispara `ask_cash_entry_before_sim` (entrada antes de simular ainda funciona); ao resolver a entrada, a simulação roda em `visa_master` (conferir no runData do `Montar Body` que rodou o `Simulador` — cuidado buffer-race).

- [ ] **Step 8: Commit**

```bash
git add scripts/n8n/deploy-sales-evolution.mjs scripts/n8n/tool/tests/routing-flags.test.mjs n8n/ia-repasse-pro-v2/
git commit -m "feat(n8n): deploy A (sem bandeira, visa_master padrão) + re-sync mirror + teste D3 atualizado

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 4: B1 — CTA pós-simulação forte (Bia 2)

**Files:**
- Modify: `scripts/n8n/transform-sales-evolution.mjs` (`b1Cta`)
- Modify: `scripts/n8n/tool/tests/sales-evolution.test.mjs`

- [ ] **Step 1: Preencher `b1Cta`**

```js
export const B1_CTA = `Após a simulação, NUNCA feche com pergunta fraca ("o que achou?", "quer seguir?"). Conduza com proposta de valor + próximo passo concreto. Varie entre:
{"message": "Essa proposta ficou boa porque já considera seu aparelho de entrada e deixa o restante parcelado. Quer que eu já deixe o aparelho separado pra você?", "transfer": false}
{"message": "Se quiser deixar a parcela mais leve, dá pra simular com uma entrada maior. Prefere seguir com essa condição ou ajustar a entrada?", "transfer": false}`;

export function b1Cta(wf) {
  const b2 = wf.nodes.find((n) => n.name === "Bia 2 ESTOQUE");
  let sm = b2.parameters.options.systemMessage;
  const weak = `Após a simulação: "O que achou da proposta? Quer que eu já encaminhe o fechamento? 😃"`;
  if (sm.includes(weak)) sm = replaceOnce(sm, weak, B1_CTA);
  b2.parameters.options.systemMessage = sm;
  return wf;
}
```

- [ ] **Step 2: Teste B1**

```js
import { b1Cta } from "../../transform-sales-evolution.mjs";
const isB1 = (wf) => !sm(wf, "Bia 2 ESTOQUE").includes('O que achou da proposta? Quer que eu já encaminhe');
function withB1(wf) { return isB1(wf) ? wf : b1Cta(prompted(wf)); }

test("B1: CTA forte substitui a pergunta fraca, sem quebrar contrato", () => {
  const t = sm(withB1(loadWf()), "Bia 2 ESTOQUE");
  assert.ok(!t.includes("O que achou da proposta?"));
  assert.ok(t.includes("Quer que eu já deixe o aparelho separado"));
  assert.ok(t.includes('"transfer": false'));
});
```

- [ ] **Step 3: Rodar testes**

```bash
export NVM_DIR="$HOME/.nvm"; . "$NVM_DIR/nvm.sh"
npm run test:n8n-tool
```
Esperado: verde.

- [ ] **Step 4: Commit**

```bash
git add scripts/n8n/transform-sales-evolution.mjs scripts/n8n/tool/tests/sales-evolution.test.mjs
git commit -m "feat(n8n): B1 CTA pós-simulação forte (Bia 2)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 5: B2 — Régua de objeção de preço (Bia 2)

**Files:**
- Modify: `scripts/n8n/transform-sales-evolution.mjs` (`b2Objection`)
- Modify: `scripts/n8n/tool/tests/sales-evolution.test.mjs`

- [ ] **Step 1: Preencher `b2Objection`** (insere bloco após `# REGRAS TRANSVERSAIS`)

```js
export const B2_OBJECTION = `# RÉGUA DE OBJEÇÃO DE PREÇO (TRATE ANTES DE TRANSFERIR)

Quando o cliente achar caro ou pedir desconto, NÃO transfira na primeira objeção. Suba a régua:
1ª objeção — reforce valor + ofereça caminho:
{"message": "Entendo. A proposta já considera a máxima avaliação do seu aparelho de entrada, garantia e a confiança da nossa loja. Quer que eu deixe a parcela mais leve com uma entrada, ou posso simular em mais vezes no cartão (vai até 18x)?", "transfer": false}
2ª objeção — ofereça alternativa concreta:
{"message": "Dá pra seguir por dois caminhos: reduzir a parcela com uma entrada maior, ou eu te mostro uma opção mais em conta no mesmo padrão. Quer que eu mande outras opções?", "transfer": false}
3ª objeção ou pedido explícito de negociação humana — aí sim transfira:
{"message": "Pra tentar uma condição fora da simulação padrão, vou chamar nosso especialista da iPhone Repasse pra ver o melhor cenário com você.", "transfer": true}`;

export function b2Objection(wf) {
  const b2 = wf.nodes.find((n) => n.name === "Bia 2 ESTOQUE");
  let sm = b2.parameters.options.systemMessage;
  if (!sm.includes("# RÉGUA DE OBJEÇÃO DE PREÇO")) {
    sm = insertAfter(sm, "# REGRAS TRANSVERSAIS", "\n" + B2_OBJECTION);
  }
  b2.parameters.options.systemMessage = sm;
  return wf;
}
```

- [ ] **Step 2: Teste B2**

```js
import { b2Objection } from "../../transform-sales-evolution.mjs";
const isB2 = (wf) => sm(wf, "Bia 2 ESTOQUE").includes("# RÉGUA DE OBJEÇÃO DE PREÇO");
function withB2(wf) { return isB2(wf) ? wf : b2Objection(prompted(wf)); }

test("B2: régua de objeção presente com 3 níveis (transfer só no 3º)", () => {
  const t = sm(withB2(loadWf()), "Bia 2 ESTOQUE");
  assert.ok(t.includes("# RÉGUA DE OBJEÇÃO DE PREÇO"));
  assert.ok(t.includes("1ª objeção") && t.includes("2ª objeção") && t.includes("3ª objeção"));
  assert.ok(t.includes('vou chamar nosso especialista da iPhone Repasse pra ver o melhor cenário'));
});
```

- [ ] **Step 3: Rodar testes**

```bash
npm run test:n8n-tool
```
Esperado: verde.

- [ ] **Step 4: Commit**

```bash
git add scripts/n8n/transform-sales-evolution.mjs scripts/n8n/tool/tests/sales-evolution.test.mjs
git commit -m "feat(n8n): B2 régua de objeção de preço (Bia 2)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 6: B3 — Recuperação de cliente indeciso (Bia 2)

**Files:**
- Modify: `scripts/n8n/transform-sales-evolution.mjs` (`b3Recovery`)
- Modify: `scripts/n8n/tool/tests/sales-evolution.test.mjs`

- [ ] **Step 1: Preencher `b3Recovery`** (insere após o cabeçalho `CONTINUIDADE SEM CONSULTA DE ESTOQUE`)

```js
export const B3_RECOVERY = `# RECUPERAÇÃO DE CLIENTE INDECISO (CONTINUIDADE — NÃO RECOMECE O ATENDIMENTO)

Quando o cliente some e volta, ou está em cima do muro, NÃO refaça perguntas já respondidas. Reengaje a partir do que já existe:
{"message": "A opção que simulamos ainda é uma boa referência. Quer seguir nela ou prefere que eu veja uma alternativa mais em conta?", "transfer": false}
{"message": "Pra eu te ajudar sem mandar um monte de opção solta, você prefere priorizar menor parcela ou melhor custo-benefício?", "transfer": false}`;

export function b3Recovery(wf) {
  const b2 = wf.nodes.find((n) => n.name === "Bia 2 ESTOQUE");
  let sm = b2.parameters.options.systemMessage;
  if (!sm.includes("# RECUPERAÇÃO DE CLIENTE INDECISO")) {
    sm = insertAfter(sm, "CONTINUIDADE SEM CONSULTA DE ESTOQUE", "\n" + B3_RECOVERY);
  }
  b2.parameters.options.systemMessage = sm;
  return wf;
}
```

Nota: se a âncora `CONTINUIDADE SEM CONSULTA DE ESTOQUE` não for única (o `insertAfter` lança), usar a primeira linha completa do bloco como âncora — confirmar no `workflow.json` durante a execução.

- [ ] **Step 2: Teste B3**

```js
import { b3Recovery } from "../../transform-sales-evolution.mjs";
const isB3 = (wf) => sm(wf, "Bia 2 ESTOQUE").includes("# RECUPERAÇÃO DE CLIENTE INDECISO");
function withB3(wf) { return isB3(wf) ? wf : b3Recovery(prompted(wf)); }

test("B3: bloco de recuperação de indeciso presente", () => {
  const t = sm(withB3(loadWf()), "Bia 2 ESTOQUE");
  assert.ok(t.includes("# RECUPERAÇÃO DE CLIENTE INDECISO"));
  assert.ok(t.includes("ainda é uma boa referência"));
});
```

- [ ] **Step 3: Rodar testes**

```bash
npm run test:n8n-tool
```
Esperado: verde.

- [ ] **Step 4: Commit**

```bash
git add scripts/n8n/transform-sales-evolution.mjs scripts/n8n/tool/tests/sales-evolution.test.mjs
git commit -m "feat(n8n): B3 recuperação de cliente indeciso (Bia 2)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 7: B4 — Recomendação ativa + novo×seminovo (Bia 2)

**Files:**
- Modify: `scripts/n8n/transform-sales-evolution.mjs` (`b4Recommend`)
- Modify: `scripts/n8n/tool/tests/sales-evolution.test.mjs`

- [ ] **Step 1: Preencher `b4Recommend`** (insere após `# CENÁRIOS DE ESTOQUE — LEIA PRIMEIRO`)

```js
export const B4_RECOMMEND = `# RECOMENDAÇÃO ATIVA (RECOMENDE, NÃO SÓ LISTE)

Com mais de uma opção disponível, recomende uma com justificativa curta em vez de listar tudo:
{"message": "Das opções disponíveis, eu iria no 256GB porque costuma ser o melhor equilíbrio entre espaço e valor. Quer que eu simule nele?", "transfer": false}
Novo vs seminovo, deixe o cliente escolher com critério:
{"message": "Se a ideia é economizar, o seminovo faz mais sentido. Se quer garantia Apple cheia, o novo é melhor. Qual caminho você prefere?", "transfer": false}`;

export function b4Recommend(wf) {
  const b2 = wf.nodes.find((n) => n.name === "Bia 2 ESTOQUE");
  let sm = b2.parameters.options.systemMessage;
  if (!sm.includes("# RECOMENDAÇÃO ATIVA")) {
    sm = insertAfter(sm, "# CENÁRIOS DE ESTOQUE — LEIA PRIMEIRO", "\n" + B4_RECOMMEND);
  }
  b2.parameters.options.systemMessage = sm;
  return wf;
}
```

- [ ] **Step 2: Teste B4**

```js
import { b4Recommend } from "../../transform-sales-evolution.mjs";
const isB4 = (wf) => sm(wf, "Bia 2 ESTOQUE").includes("# RECOMENDAÇÃO ATIVA");
function withB4(wf) { return isB4(wf) ? wf : b4Recommend(prompted(wf)); }

test("B4: bloco de recomendação ativa presente", () => {
  const t = sm(withB4(loadWf()), "Bia 2 ESTOQUE");
  assert.ok(t.includes("# RECOMENDAÇÃO ATIVA"));
  assert.ok(t.includes("eu iria no 256GB"));
  assert.ok(t.includes("garantia Apple cheia"));
});
```

- [ ] **Step 3: Rodar testes**

```bash
npm run test:n8n-tool
```
Esperado: verde.

- [ ] **Step 4: Commit**

```bash
git add scripts/n8n/transform-sales-evolution.mjs scripts/n8n/tool/tests/sales-evolution.test.mjs
git commit -m "feat(n8n): B4 recomendação ativa + novo x seminovo (Bia 2)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 8: B5 — Microconversões antes de perguntas (Bia 1)

**Files:**
- Modify: `scripts/n8n/transform-sales-evolution.mjs` (`b5Microconv`)
- Modify: `scripts/n8n/tool/tests/sales-evolution.test.mjs`

- [ ] **Step 1: Preencher `b5Microconv`** (insere na Bia 1 após `# COMO DECIDIR O QUE PERGUNTAR — LEIA PRIMEIRO`)

```js
export const B5_MICRO = `# MICROCONVERSÃO ANTES DE PERGUNTAR

Antes de uma pergunta importante (capacidade, autorização de avaliação do trade-in, entrada), dê um motivo curto que mostre benefício pro cliente:
{"message": "Pra eu buscar a opção certa pra sua necessidade, você procura iPhone com qual armazenamento?", "transfer": false}
{"message": "Pra tentar puxar o melhor valor possível no seu iPhone de entrada, posso te fazer umas perguntas rápidas sobre ele?", "transfer": false}
{"message": "Pra deixar a simulação mais próxima da realidade, você quer colocar algum valor de entrada no Pix ou prefere ver sem entrada?", "transfer": false}`;

export function b5Microconv(wf) {
  const b1 = wf.nodes.find((n) => n.name === "Bia 1");
  let sm = b1.parameters.options.systemMessage;
  if (!sm.includes("# MICROCONVERSÃO ANTES DE PERGUNTAR")) {
    sm = insertAfter(sm, "# COMO DECIDIR O QUE PERGUNTAR — LEIA PRIMEIRO", "\n" + B5_MICRO);
  }
  b1.parameters.options.systemMessage = sm;
  return wf;
}
```

- [ ] **Step 2: Teste B5**

```js
import { b5Microconv } from "../../transform-sales-evolution.mjs";
const isB5 = (wf) => sm(wf, "Bia 1").includes("# MICROCONVERSÃO ANTES DE PERGUNTAR");
function withB5(wf) { return isB5(wf) ? wf : b5Microconv(prompted(wf)); }

test("B5: microconversão na Bia 1 presente, sem reintroduzir bandeira", () => {
  const t = sm(withB5(loadWf()), "Bia 1");
  assert.ok(t.includes("# MICROCONVERSÃO ANTES DE PERGUNTAR"));
  assert.ok(t.includes("qual armazenamento"));
  assert.ok(!/bandeira/i.test(t));
});
```

- [ ] **Step 3: Rodar testes**

```bash
npm run test:n8n-tool
```
Esperado: verde.

- [ ] **Step 4: Commit**

```bash
git add scripts/n8n/transform-sales-evolution.mjs scripts/n8n/tool/tests/sales-evolution.test.mjs
git commit -m "feat(n8n): B5 microconversões antes de perguntar (Bia 1)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 9: Deploy (B) ao vivo + smoke dos cenários + docs/memória

**Files:**
- Modify: `n8n/ia-repasse-pro-v2/` (re-sync automático pós-deploy)
- Modify: `n8n/ia-repasse-pro-v2/README.md`
- Modify: `~/.claude/projects/-Volumes-DEV-projetos-iphonerepasse-pro/memory/` (nova memória + índice)

**Nota de não-regressão:** as 5 fases de (B) são blocos **aditivos** independentes, cada um já validado por teste unitário. Deployamos as 5 juntas (`--phase B`, que aplica A+B1..B5 de forma idempotente) e verificamos cada cenário por smoke. Rollback granular continua possível: o `transform-sales-evolution.mjs` permite recompor sem um bloco específico e re-deployar, ou `--rollback <backup>`.

- [ ] **Step 1: Guard + DRY da fase B**

```bash
export NVM_DIR="$HOME/.nvm"; . "$NVM_DIR/nvm.sh"
node scripts/n8n/guard-live-workflow-sync.mjs
DRY=1 node scripts/n8n/deploy-sales-evolution.mjs --phase B
```
Esperado: "validação OK", "DRY=1 → nada escrito."

- [ ] **Step 2: Deploy B ao vivo**

```bash
node scripts/n8n/deploy-sales-evolution.mjs --phase B
```
Esperado: "OK — vivo: … active=true". Anotar versionId + backup.

- [ ] **Step 3: Re-sync do mirror**

```bash
node scripts/n8n/repasse-maint.mjs pull
node scripts/n8n/guard-live-workflow-sync.mjs
```

- [ ] **Step 4: Suíte inteira contra o vivo transformado**

```bash
npm run test:n8n-tool
```
Esperado: verde (testes state-aware veem o mirror já com A+B → no-op nos transforms).

- [ ] **Step 5: Smoke dos cenários de (B)**

```bash
node scripts/n8n/smoke-step.mjs reset
node scripts/n8n/smoke-step.mjs say "Quero um iPhone 15 Pro Max 256GB"
node scripts/n8n/smoke-step.mjs say "Pode ser, sem entrada"
node scripts/n8n/smoke-step.mjs say "Tá caro"
node scripts/n8n/smoke-step.mjs say "Ainda tá caro, faz desconto?"
```
Verificar: pós-sim a IA usa CTA forte (B1, não "o que achou?"); "tá caro" → 1ª régua (B2, sem transferir); 2º "caro" → 2ª régua (alternativa, ainda sem transferir). Depois testar recuperação:
```bash
node scripts/n8n/smoke-step.mjs say "Deixa eu pensar"
node scripts/n8n/smoke-step.mjs say "Voltei"
```
Verificar: B3 reengaja sem refazer perguntas. (Cuidado buffer-race: ler runData da execução correta.)

- [ ] **Step 6: Atualizar `README.md` do mirror**

Adicionar entrada no changelog do [n8n/ia-repasse-pro-v2/README.md](../../../n8n/ia-repasse-pro-v2/README.md):

```md
## Evolução comercial (2026-06-18, versão <versionId do deploy B>)

- (A) Removida a pergunta de bandeira de cartão; simulação padrão `visa_master`. `card_brand` deixou de ser gate de simulação (4 cláusulas removidas em `Code Routing Flags` + `Code Refresh Lead State Before Switch2`); fallback `visa_master` só no `Montar Body`. Não persiste `visa_master` no `lead_state`.
- (B) Bia 2 ESTOQUE: CTA pós-sim forte, régua de objeção de preço (3 níveis), recuperação de indeciso, recomendação ativa. Bia 1: microconversões. Tudo aditivo (blocos rotulados), contrato de saída preservado.
- Ferramentas: `scripts/n8n/transform-sales-evolution.mjs` (transform puro/idempotente por fase) + `scripts/n8n/deploy-sales-evolution.mjs` (`--phase`, `DRY=1`, `--rollback`). Testes: `tool/tests/sales-evolution.test.mjs`.
```

- [ ] **Step 7: Atualizar a memória do projeto**

Criar `~/.claude/projects/-Volumes-DEV-projetos-iphonerepasse-pro/memory/n8n-remover-bandeira-evolucao-comercial.md` (frontmatter `type: project`) descrevendo: card_brand deixou de gatear simulação; o risco de regressão da entrada-antes-de-simular (não setar state.card_brand) e como foi evitado; ferramentas transform/deploy por fase; link `[[n8n-bia2-unificada]]`, `[[n8n-repasse-simulation-chain-fixes]]`. Adicionar uma linha no `MEMORY.md`.

- [ ] **Step 8: Commit**

```bash
git add n8n/ia-repasse-pro-v2/
git commit -m "feat(n8n): deploy B (evolução comercial Bia 1/Bia 2) + re-sync mirror + docs

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 10: Review final (uncle-bob) + fechamento

**Files:** nenhum (revisão).

- [ ] **Step 1: Suíte completa final**

```bash
export NVM_DIR="$HOME/.nvm"; . "$NVM_DIR/nvm.sh"
npm run test:n8n-tool
```
Esperado: 100% verde.

- [ ] **Step 2: Review `/uncle-bob` (modo REVIEW)**

Conferir os dois-chapéus (cada commit muda comportamento OU estrutura, nunca os dois), não-regressão (testes verdes, `structuralErrors=[]`, sintaxe assertada, smoke ao vivo por cenário), e que nenhum invariante de prompt foi violado. Entregar tabela antes→depois (pergunta de bandeira: sim→não; gates de card_brand: 4→0; CTA pós-sim: fraco→forte; régua de objeção: ausente→3 níveis; recuperação/recomendação/microconversão: ausentes→presentes).

- [ ] **Step 3: Verificar guard em sincronia**

```bash
node scripts/n8n/guard-live-workflow-sync.mjs --check
```
Esperado: em sincronia (exit 0).

---

## Self-Review (preenchido)

**Spec coverage:** §2/§3 (gates A) → Task 1; §3.2 (voz A) → Task 2 + deploy Task 3; §4 B1→Task 4, B2→Task 5, B3→Task 6, B4→Task 7, B5→Task 8; §5 (não-regressão por fase) → estrutura de Tasks 1-9; §6 (cenários) → Tasks 3 e 9 (smoke); §7 (fora de escopo) → respeitado (sem topologia, sem renomear, sem Memory/Router); §8 (riscos) → guards `replaceOnce`/`assertSyntax`/`structuralErrors`/state-aware.

**Placeholder scan:** sem TBD/TODO; todo passo de código mostra o código; comandos com saída esperada.

**Type consistency:** nomes de funções consistentes (`removeCardBrandGates`, `removeCardBrandPrompts`, `b1Cta`..`b5Microconv`, `transformPhase`, `replaceOnce`, `insertAfter`); helpers de teste (`sm`, `prompted`, `gated`, `runFlags`) definidos na Task 1/2 e reusados nas seguintes; `baseState`/`runRoutingFlags` importados de `routing-flags.test.mjs` (já exportados).
