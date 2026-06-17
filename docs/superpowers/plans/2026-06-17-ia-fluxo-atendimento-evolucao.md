# Evolução do Fluxo de Atendimento da IA — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Corrigir as violações de FAQ/FLUXO do agente de IA do CRM (caso lead VD +558897107383) via abordagem híbrida — determinismo para estado/ordem, prompt para linguagem/venda.

**Architecture:** O workflow n8n v2 (`Cr4fPWe0prwS6XjI`) mantém a topologia atual (nenhum node renomeado). Mudamos (1) o node determinístico `Code Routing Flags` para reordenar cidade/cor/entrada e bloquear re-perguntas, (2) os guards de parser (color-guard existente + novo price-strip) para impedir alucinação de cor/preço, e (3) os prompts dos agentes (Bia 1, Bia 2 ESTOQUE, Bia 2 SEM ESTOQUE, Memory 2) para tom/lista/preço-sob-demanda. Spec: [docs/superpowers/specs/2026-06-17-ia-fluxo-atendimento-evolucao-design.md](../specs/2026-06-17-ia-fluxo-atendimento-evolucao-design.md).

**Tech Stack:** n8n (nodes Code em JS, agentes LangChain), Node `node:test`, Supabase REST (estoque), scripts de manutenção `repasse-maint.mjs` + patches cirúrgicos + `guard-live-workflow-sync.mjs`.

## Global Constraints

- **Node runtime:** antes de QUALQUER comando node/npm: `export NVM_DIR="$HOME/.nvm"; . "$NVM_DIR/nvm.sh" >/dev/null 2>&1` (o shell do Bash tool não carrega `~/.zshrc`).
- **Guard primeiro:** antes de tocar o workflow vivo, rode `node scripts/n8n/guard-live-workflow-sync.mjs` (no Claude Code dispara via hook PreToolUse; rode manualmente em outros agentes). Se houver drift, re-leia os arquivos sincronizados antes de editar.
- **Nunca renomear nodes** — 450 referências `$('Name')` + 25 scripts de patch dependem dos nomes atuais.
- **Nunca usar o build script** (`scripts/n8n/build-*`): ele clobbera e deixa o workflow OFF. Deploy só via `repasse-maint.mjs deploy --confirm` (code nodes + prompts `.md`) ou patch cirúrgico (prompts expression-built). Sempre `DRY=1` para preview; sempre reativar + re-export ao final.
- **Prompts expression-built** (`=…`: Router Agent, Bia 1, Bia 2 ESTOQUE, Bia 2 SEM ESTOQUE) ficam em `workflow.json` e **não** são extraídos para arquivo → editar via patch cirúrgico. Apenas o prompt **estático** Memory 2 - Reconciler é o `.md` (`nodes/prompts/40_04_memory-2-reconciler.md`) → deploy via `repasse-maint`.
- **Contrato de saída dos prompts** travado por `scripts/n8n/tool/tests/prompt-invariants.test.mjs` — reescrita de texto não pode quebrar o shape do JSON emitido.
- **color-guard** tem 1 bloco canônico (`scripts/n8n/tool/parsers/blocks/commerce_context.block.js`) + 3 cópias inline byte-idênticas; os testes `parsers.test.mjs` ("FIDELIDADE" e "DUPLICAÇÃO") travam essa igualdade — qualquer edição deve atualizar canônico + as 3 cópias juntos.
- **`lead_state` é colunar** com `upsert_lead_state(text, jsonb)` coalesce-preserve; `Edit Fields5` tem 90 assignments explícitos (sem `includeOtherFields`) — qualquer NOVO campo persistido precisa ser adicionado lá. (Este plano não adiciona campos persistidos novos; flags de roteamento são transitórias.)
- **Smoke harness** debounce por JID — cada cenário de sandbox deve usar JID único (ver memória "repasse live-validation tooling"; usar `smoke-live-bia2.mjs` / `smoke-routing-audit.mjs` contra o lead sandbox; `lead_id` do webhook deve ser só dígitos do telefone).

## File Structure

**Criar:**
- `scripts/n8n/tool/tests/routing-flags.test.mjs` — harness `node:test` que carrega o corpo do node `Code Routing Flags` e exercita a árvore de decisão (D1–D5).
- `scripts/n8n/fixtures/vd-558897107383-transcript.json` — transcript dos 48 turnos do lead VD, fixture do cenário de regressão.
- `scripts/n8n/patch-bia1-price-city-list.mjs` — patch cirúrgico do prompt Bia 1.
- `scripts/n8n/patch-bia2-estoque-color.mjs` — patch cirúrgico do prompt Bia 2 ESTOQUE.
- `scripts/n8n/patch-bia2-semestoque-convince-city.mjs` — patch cirúrgico do prompt Bia 2 SEM ESTOQUE.
- `scripts/n8n/smoke-vd-regression.mjs` — replay do cenário VD com asserções de FLUXO.

**Modificar:**
- `n8n/ia-repasse-pro-v2/nodes/code/50_01_code-routing-flags.js` — D1 (cidade pós-sim), D2 (cor não exigida), D3 (anti-reask entrada), D5 (confirmação de variante). Fonte canônica do node `Code Routing Flags`.
- `scripts/n8n/tool/parsers/blocks/commerce_context.block.js` + 3 cópias inline (`nodes/code/70_01_code-commerce-context.js`, `nodes/code/80_02_code-parse-bia-2-sem-estoque.js`, `nodes/code/80_03_code-parse-bia-2-sem-estoque1.js`) — extensão/cobertura do color-guard (D4).
- `n8n/ia-repasse-pro-v2/nodes/code/70_02_code-parse-bia-1.js` — `stripBrowsingPrices` (D4 preço na navegação).
- `n8n/ia-repasse-pro-v2/nodes/prompts/40_04_memory-2-reconciler.md` — carry-forward + correção asterisco (P5).
- `scripts/n8n/tool/tests/parsers.test.mjs` — novos testes de guard.
- `package.json` — incluir `routing-flags.test.mjs` no script `test:n8n-tool`.
- Prompts em `workflow.json` (Bia 1, Bia 2 ESTOQUE, Bia 2 SEM ESTOQUE) via patches cirúrgicos.

**Correções de premissa (vs. spec, descobertas na exploração):**
- Os HTTP nodes `CRM Inventory Precheck` / `CRM Inventory Search` **já consultam todas as lojas** (`/rest/v1/stock_items` sem filtro de cidade) → D1 **não** mexe em HTTP. A cidade hoje é só um *gate* de roteamento + ranking em `Node13`. Com `preferred_city` nulo, `Node13` degrada para "sem preferência" e mantém itens das duas cidades (filtros usam `includes("")` → sempre verdadeiro). Logo D1 é apenas: remover o gate em `Code Routing Flags`.
- O **color-guard já existe** (`enforceAllowedColors` em `commerce_context.block.js`). D4 = (a) descobrir por que "Dourado" passou (qual caminho de resposta não estava guardado) e estendê-lo, (b) adicionar o price-strip na navegação.

---

### Task 0: Baseline, guard e fixture do caso VD

**Files:**
- Create: `scripts/n8n/fixtures/vd-558897107383-transcript.json`

**Interfaces:**
- Produces: fixture `vd-558897107383-transcript.json` = `{ lead_id, conversation_id, turns: [{ direction, text }] }` consumido por `smoke-vd-regression.mjs` (Task 11).

- [ ] **Step 1: Sincronizar com o vivo (guard) e confirmar runtime**

Run:
```bash
export NVM_DIR="$HOME/.nvm"; . "$NVM_DIR/nvm.sh" >/dev/null 2>&1
node scripts/n8n/guard-live-workflow-sync.mjs
```
Expected: relatório sem erro; se acusar drift, ele re-sincroniza os mirrors — re-leia os arquivos antes de prosseguir.

- [ ] **Step 2: Rodar a rede de testes existente (baseline verde)**

Run:
```bash
export NVM_DIR="$HOME/.nvm"; . "$NVM_DIR/nvm.sh" >/dev/null 2>&1
npm run test:n8n-tool
```
Expected: PASS (todos os testes atuais de `tool.test.mjs`, `prompt-invariants.test.mjs`, `parsers.test.mjs`). Anote a contagem para comparar depois.

- [ ] **Step 3: Criar a fixture do transcript VD**

Cria `scripts/n8n/fixtures/vd-558897107383-transcript.json` com os 48 turnos da conversa `26c2b4be-1309-4fea-9e71-e653693af001` (telefone `558897107383`). Conteúdo (turnos do cliente, na ordem; as falas da IA são referência de comportamento esperado, não entrada):

```json
{
  "lead_id": "558897107383",
  "conversation_id": "26c2b4be-1309-4fea-9e71-e653693af001",
  "customer_turns": [
    "Oi! Vim pelo hospital dos iphones, poderia me enviar tabela dos iphones?",
    "Gostaria de verificar modelos pro Max",
    "Exatamente",
    "Quais você tem?",
    "15 pro max",
    "Qual tem disponível?",
    "256gb",
    "Sobral",
    "Não",
    "Quero dar um 13",
    "Sim",
    "128\nPreto\nSim\nNão\nNão\nNão\nSim, só a caixa\n78%\nNão",
    "Existe diferença d valores?",
    "De*",
    "Prefiro Titanium natural mesmo",
    "Queria dar 500",
    "Tem alguma diferença?",
    "Nos valores",
    "Simula na bandeira visa e na elo por favor",
    "Sim, PIX e cartão"
  ],
  "flow_assertions": [
    "lista_curta_sem_preco_aparece_em_pergunta_generica",
    "nenhuma_pergunta_de_cidade_antes_da_simulacao",
    "nenhuma_pergunta_de_cor_antes_da_simulacao",
    "sem_termo_compra_direta",
    "responde_diferenca_de_preco_quando_perguntado",
    "confirma_variante_13_normal_pro_promax",
    "entrada_perguntada_no_maximo_uma_vez",
    "ao_menos_uma_simulacao_produzida"
  ]
}
```

- [ ] **Step 4: Commit**

```bash
git add scripts/n8n/fixtures/vd-558897107383-transcript.json
git commit -m "test(n8n): fixture do transcript do lead VD para regressão de fluxo"
```

---

### Task 1: Harness de teste do Code Routing Flags

**Files:**
- Create: `scripts/n8n/tool/tests/routing-flags.test.mjs`
- Modify: `package.json` (script `test:n8n-tool`)

**Interfaces:**
- Consumes: corpo do node em `n8n/ia-repasse-pro-v2/nodes/code/50_01_code-routing-flags.js` (texto após a linha sentinela `===== n8n-tool: NÃO EDITE ACIMA DESTA LINHA =====`).
- Produces: helpers de teste `runRoutingFlags(state) -> outState` e `baseState(overrides)`; reutilizados pelas Tasks 2–4.

- [ ] **Step 1: Escrever o harness + 1 teste de caracterização (baseline)**

Cria `scripts/n8n/tool/tests/routing-flags.test.mjs`:

```js
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const NODE_FILE = path.join(HERE, "../../../../n8n/ia-repasse-pro-v2/nodes/code/50_01_code-routing-flags.js");

const SENTINEL = "===== n8n-tool: NÃO EDITE ACIMA DESTA LINHA =====";

function loadBody() {
  const raw = fs.readFileSync(NODE_FILE, "utf8");
  const idx = raw.indexOf(SENTINEL);
  return idx === -1 ? raw : raw.slice(raw.indexOf("\n", idx) + 1);
}

// Executa o node com um $input mockado. O node usa `$('...')` só dentro de
// readCurrentMessageFromWorkflow, protegido por try/catch + `typeof $ === "function"`;
// passando $ = undefined ele retorna "".
export function runRoutingFlags(state) {
  const body = loadBody();
  const fn = new Function("$input", "$", body);
  const $input = { first: () => ({ json: structuredClone(state) }) };
  const out = fn($input, undefined);
  return out[0].json;
}

// Estado base "pronto para simular" (compra de iPhone, trade-in OK), sobreposto por overrides.
export function baseState(overrides = {}) {
  return {
    intent: "aparelho_iphone",
    interest_type: "comprar",
    desired_model: "iPhone 15 Pro Max",
    desired_capacity: "256GB",
    desired_condition: "Seminovo",
    has_tradein: false,
    cash_entry_asked: false,
    cash_entry_intent: null,
    cash_entry_amount: null,
    card_brand: null,
    preferred_city: null,
    simulation_done: false,
    simulation_count: 0,
    ...overrides,
  };
}

test("baseline: estado de compra simples produz uma rota principal definida", () => {
  const out = runRoutingFlags(baseState());
  const routes = [
    out.shouldSearchInventory, out.shouldUseBia1, out.shouldUseBia2NoStock,
    out.shouldUseBia2Continuation, out.shouldStopAsSpam,
  ];
  assert.equal(routes.filter(Boolean).length >= 1, true, "deve haver ao menos uma rota ativa");
  assert.equal(typeof out.routing_decision, "string");
});
```

- [ ] **Step 2: Registrar o novo arquivo no script de teste**

Em `package.json`, no script `test:n8n-tool`, acrescenta o arquivo ao final da lista:

```
"test:n8n-tool": "node --test scripts/n8n/tool/tests/tool.test.mjs scripts/n8n/tool/tests/prompt-invariants.test.mjs scripts/n8n/tool/tests/parsers.test.mjs scripts/n8n/tool/tests/routing-flags.test.mjs",
```

- [ ] **Step 3: Rodar e confirmar verde**

Run:
```bash
export NVM_DIR="$HOME/.nvm"; . "$NVM_DIR/nvm.sh" >/dev/null 2>&1
node --test scripts/n8n/tool/tests/routing-flags.test.mjs
```
Expected: PASS (1 teste).

- [ ] **Step 4: Commit**

```bash
git add scripts/n8n/tool/tests/routing-flags.test.mjs package.json
git commit -m "test(n8n): harness de teste do node Code Routing Flags"
```

---

### Task 2: D2 (cor não exigida) + D3 (anti-reask de entrada)

**Files:**
- Modify: `n8n/ia-repasse-pro-v2/nodes/code/50_01_code-routing-flags.js`
- Test: `scripts/n8n/tool/tests/routing-flags.test.mjs`

**Interfaces:**
- Consumes: `runRoutingFlags`, `baseState` (Task 1).
- Produces: garantia de que `desired_color` nunca entra em `missing_fields`/bloqueio; e que, com `card_brand` definido, `needsCashEntryQuestion` não dispara (sem rota `ask_cash_entry_before_sim`).

- [ ] **Step 1: Escrever os testes que falham**

Acrescenta a `routing-flags.test.mjs`:

```js
import { runRoutingFlags as _r, baseState as _b } from "./routing-flags.test.mjs"; // (mesmos exports do arquivo)

test("D2: cor ausente não entra em missing_fields nem bloqueia (desired_condition basta)", () => {
  const out = runRoutingFlags(baseState({ desired_color: null, desired_condition: "Seminovo" }));
  assert.equal(out.missing_fields.includes("desired_color"), false);
});

test("D3: com card_brand definido, não há rota de perguntar entrada", () => {
  const out = runRoutingFlags(baseState({
    preferred_city: "Sobral",          // elegível a inventário
    card_brand: "visa",
    cash_entry_intent: true,
    cash_entry_amount: 500,
  }));
  assert.notEqual(out.routing_decision, "ask_cash_entry_before_sim");
});

test("D3: entrada já informada (intent+amount) marca cashEntryResolved e não repergunta", () => {
  const out = runRoutingFlags(baseState({
    preferred_city: "Sobral",
    cash_entry_intent: true,
    cash_entry_amount: 500,
    card_brand: "visa",
  }));
  assert.equal(out.missing_fields.includes("cash_entry_amount"), false);
});
```
> Nota: como o teste importa de si mesmo, na prática mova `runRoutingFlags`/`baseState` para o topo do arquivo (Task 1 já os exporta); aqui basta usá-los diretamente, sem o `import` acima. Remova a linha de import duplicado.

- [ ] **Step 2: Rodar e ver falhar**

Run: `node --test scripts/n8n/tool/tests/routing-flags.test.mjs`
Expected: FAIL nos testes D2/D3 (a lógica atual exige cor quando falta `desired_condition` e pode re-perguntar entrada).

- [ ] **Step 3: Implementar D2 — cor nunca exigida**

Em `50_01_code-routing-flags.js`, na função `shouldRequireDesiredColor` (≈ linha 58-60), troca o corpo para sempre falso:

```js
function shouldRequireDesiredColor(/* m */) {
  // FLUXO: cor não é necessária para simular — vem como sugestão pós-simulação.
  return false;
}
```

- [ ] **Step 4: Implementar D3 — endurecer cashEntryResolved e o gate**

Na definição de `cashEntryResolved` (≈ linha 106), inclua o valor de `cash_entry_amount`:

```js
const cashEntryResolved =
  cashEntryAsked === true ||
  state.cash_entry_intent != null ||
  state.cash_entry_amount != null;
```

E no gate `needsCashEntryQuestion` (≈ linhas 223-228), acrescente a condição de bandeira ainda não escolhida (uma vez dada a bandeira, nunca mais perguntar entrada):

```js
const needsCashEntryQuestion = (
  isIphonePurchaseFlow(state) &&
  postSimulationFlow !== true &&
  cashEntryResolved !== true &&
  !state.card_brand &&
  eligibleForInventory === true
);
```

- [ ] **Step 5: Rodar e confirmar verde**

Run: `node --test scripts/n8n/tool/tests/routing-flags.test.mjs`
Expected: PASS (baseline + D2 + D3).

- [ ] **Step 6: Commit**

```bash
git add n8n/ia-repasse-pro-v2/nodes/code/50_01_code-routing-flags.js scripts/n8n/tool/tests/routing-flags.test.mjs
git commit -m "feat(n8n): cor não exigida + anti-reask de entrada no roteamento (D2/D3)"
```

---

### Task 3: D1 (cidade só após a simulação)

**Files:**
- Modify: `n8n/ia-repasse-pro-v2/nodes/code/50_01_code-routing-flags.js`
- Test: `scripts/n8n/tool/tests/routing-flags.test.mjs`

**Interfaces:**
- Consumes: `runRoutingFlags`, `baseState`.
- Produces: novo flag transitório `state.needsPickupCity` (bool) e rota `ask_pickup_city_after_sim`; `eligibleForInventory` deixa de exigir `preferred_city`.

- [ ] **Step 1: Escrever os testes que falham**

Acrescenta a `routing-flags.test.mjs`:

```js
test("D1: busca de estoque NÃO exige cidade (sem preferred_city ainda assim elegível)", () => {
  const out = runRoutingFlags(baseState({ preferred_city: null }));
  // pré-simulação, pronto p/ inventário: deve perguntar entrada OU buscar estoque,
  // nunca pedir cidade antes do estoque.
  assert.notEqual(out.routing_decision, "ask_client_city_before_stock");
  assert.equal(out.missing_fields.includes("preferred_city"), false);
});

test("D1: cidade é pedida só após simulação aceita e sem cidade definida", () => {
  const out = runRoutingFlags(baseState({
    preferred_city: null,
    simulation_done: true,
    simulation_count: 1,
    last_simulation_total: 5190,
    proposal_accepted: true,
  }));
  assert.equal(out.needsPickupCity, true);
  assert.equal(out.routing_decision, "ask_pickup_city_after_sim");
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `node --test scripts/n8n/tool/tests/routing-flags.test.mjs`
Expected: FAIL nos testes D1.

- [ ] **Step 3: Remover o gate de cidade pré-estoque**

Em `50_01_code-routing-flags.js`:

(a) Em `eligibleForInventory` (≈ linhas 214-219), **remova** a exigência `!!state.preferred_city`:

```js
const eligibleForInventory = (
  isIphonePurchaseFlow(state) &&
  !!state.desired_model && !!state.desired_capacity && !!(state.desired_color || state.desired_condition) &&
  cashEntryOk === true &&
  (tradeinOk === true || (postSimulationFlow === true && state.proposal_accepted === true))
);
```

(b) **Remova** a definição de `needsClientCityBeforeStock` (≈ linhas 209-213) inteira.

(c) No `if/else` da DECISÃO PRINCIPAL (≈ linhas 240-267), **remova** o ramo `else if (needsClientCityBeforeStock) { ... }` (≈ 250-253).

- [ ] **Step 4: Adicionar o passo pós-simulação `needsPickupCity`**

Logo após o bloco de `eligibleForInventory`/`needsCashEntryQuestion` (antes da DECISÃO PRINCIPAL), adicione:

```js
// Cidade de retirada SÓ após a simulação e com proposta aceita (FLUXO).
const needsPickupCity = (
  postSimulationFlow === true &&
  state.proposal_accepted === true &&
  !state.preferred_city
);
```

E na DECISÃO PRINCIPAL, adicione o ramo **antes** do bloco de fechamento (logo após o `else if (needsCashEntryQuestion) {...}`):

```js
} else if (needsPickupCity) {
  state.needsPickupCity = true;
  setMainRoute("shouldUseBia2Continuation", "ask_pickup_city_after_sim");
  state.next_best_action = "perguntar cidade de retirada após simulação aceita";
  state.attendance_owner_next = "ia";
```

Garanta que `state.needsPickupCity` exista como `false` por padrão — adicione perto do topo, após `const state = {...}`:

```js
state.needsPickupCity = false;
```

- [ ] **Step 5: Rodar e confirmar verde**

Run: `node --test scripts/n8n/tool/tests/routing-flags.test.mjs`
Expected: PASS (todos, incl. D1).

- [ ] **Step 6: Commit**

```bash
git add n8n/ia-repasse-pro-v2/nodes/code/50_01_code-routing-flags.js scripts/n8n/tool/tests/routing-flags.test.mjs
git commit -m "feat(n8n): cidade de retirada apenas após simulação aceita (D1)"
```

---

### Task 4: D5 (confirmar variante do modelo: 13 → 13/Pro/Pro Max)

**Files:**
- Modify: `n8n/ia-repasse-pro-v2/nodes/code/50_01_code-routing-flags.js`
- Test: `scripts/n8n/tool/tests/routing-flags.test.mjs`

**Interfaces:**
- Consumes: `runRoutingFlags`, `baseState`.
- Produces: flag transitório `state.needs_model_tier_confirmation` (bool) lido pelo prompt Bia 1 (Task 8); quando true, roteia para Bia 1 e adiciona `model_tier` a `missing_fields`, bloqueando inventário/simulação.

- [ ] **Step 1: Escrever os testes que falham**

```js
test("D5: modelo base sem tier marca confirmação e bloqueia avanço", () => {
  const out = runRoutingFlags(baseState({ desired_model: "iPhone 13", desired_capacity: "128GB" }));
  assert.equal(out.needs_model_tier_confirmation, true);
  assert.equal(out.missing_fields.includes("model_tier"), true);
  assert.equal(out.context_ready, false);
});

test("D5: modelo com tier explícito NÃO pede confirmação", () => {
  const out = runRoutingFlags(baseState({ desired_model: "iPhone 13 Pro Max", desired_capacity: "128GB" }));
  assert.equal(out.needs_model_tier_confirmation, false);
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `node --test scripts/n8n/tool/tests/routing-flags.test.mjs`
Expected: FAIL nos testes D5.

- [ ] **Step 3: Implementar a detecção de variante e o bloqueio**

Em `50_01_code-routing-flags.js`, perto dos pré-cálculos (após `const intent = ...`), adicione o detector (reusa a ideia do `parseIphoneModel` do inventory-lite, em forma mínima):

```js
// D5: "iPhone 13/14/15" sem tier explícito exige confirmar normal/Pro/Pro Max.
function modelLacksTier(model) {
  const s = String(model ?? "").toLowerCase();
  const hasGen = /\biphone\s*1[0-9]\b/.test(s);
  const hasTier = /\b(pro\s*max|pro|plus|se|mini)\b/.test(s);
  return hasGen && !hasTier;
}
const needsModelTier = isIphonePurchaseFlow(state) && modelLacksTier(state.desired_model);
state.needs_model_tier_confirmation = needsModelTier === true;
```

No bloco de `missing_fields` (após calcular `missing`, antes de `state.missing_fields = missing;` na ≈ linha 203), adicione:

```js
if (needsModelTier && !missing.includes("model_tier")) missing.push("model_tier");
```

No cálculo de `context_ready` para compra/troca (≈ linha 163-164), force false quando faltar tier:

```js
const desiredOk = !!(state.desired_model && state.desired_capacity && (state.desired_color || state.desired_condition)) && !needsModelTier;
```

E na DECISÃO PRINCIPAL, adicione o ramo **logo após** o tratamento de spam/garantia (antes de `needsCashEntryQuestion`):

```js
} else if (needsModelTier) {
  setMainRoute("shouldUseBia1", "ask_model_tier");
  state.next_best_action = "confirmar se o modelo é normal, Pro ou Pro Max";
  state.attendance_owner_next = "ia";
```

> Atenção à ordem do `if/else`: este ramo deve vir antes de `eligibleForInventory`/`shouldPrecheckInventory` para impedir busca/simulação com modelo ambíguo.

- [ ] **Step 4: Rodar e confirmar verde**

Run: `node --test scripts/n8n/tool/tests/routing-flags.test.mjs`
Expected: PASS (todos).

- [ ] **Step 5: Rodar a suíte completa de tool (regressão)**

Run: `npm run test:n8n-tool`
Expected: PASS — nenhum teste pré-existente quebrou.

- [ ] **Step 6: Commit**

```bash
git add n8n/ia-repasse-pro-v2/nodes/code/50_01_code-routing-flags.js scripts/n8n/tool/tests/routing-flags.test.mjs
git commit -m "feat(n8n): confirmação de variante de modelo no roteamento (D5)"
```

---

### Task 5: D4 (guards de cor e preço na navegação)

**Files:**
- Modify: `scripts/n8n/tool/parsers/blocks/commerce_context.block.js` (+ 3 cópias inline: `nodes/code/70_01_code-commerce-context.js`, `nodes/code/80_02_code-parse-bia-2-sem-estoque.js`, `nodes/code/80_03_code-parse-bia-2-sem-estoque1.js`)
- Modify: `n8n/ia-repasse-pro-v2/nodes/code/70_02_code-parse-bia-1.js`
- Test: `scripts/n8n/tool/tests/parsers.test.mjs`

**Interfaces:**
- Consumes: `loadBlock` de `scripts/n8n/tool/parsers/load.mjs`; funções existentes do color-guard (`enforceAllowedColors`, `buildAllowedColors`, `deriveStage`).
- Produces: nova função pura `stripBrowsingPrices(text, stage)` no bloco canônico; cobertura do `enforceAllowedColors` no caminho de apresentação Bia 2 ESTOQUE.

- [ ] **Step 1: Diagnóstico — por que "Dourado" passou (systematic-debugging)**

Run:
```bash
export NVM_DIR="$HOME/.nvm"; . "$NVM_DIR/nvm.sh" >/dev/null 2>&1
grep -rnE "enforceAllowedColors|buildAllowedColors|deriveStage" n8n/ia-repasse-pro-v2/nodes/code/
```
Expected: identificar quais nodes de resposta aplicam o guard. Confirme se o caminho da **apresentação Bia 2 ESTOQUE** (onde surgiu "Ótimo, Dourado então!") aplica `enforceAllowedColors`. Registre a conclusão no commit. Se um caminho de resposta NÃO aplica o guard, ele é o alvo da extensão no Step 4.

- [ ] **Step 2: Escrever os testes que falham (price-strip + cobertura)**

Em `scripts/n8n/tool/tests/parsers.test.mjs`, adicione (usando o mesmo padrão `loadBlock` dos testes existentes do color-guard):

```js
test("price-guard: stripBrowsingPrices remove R$ na navegação (collection/presentation)", () => {
  const { stripBrowsingPrices } = loadBlock("commerce_context.block.js", ["stripBrowsingPrices"]);
  const txt = "Temos o 15 Pro Max 256GB por R$ 5.190 e o 14 Pro por R$4.490.";
  const out = stripBrowsingPrices(txt, "collection");
  assert.equal(/R\$\s?\d/.test(out), false);
});

test("price-guard: stripBrowsingPrices preserva preço em simulation/closing", () => {
  const { stripBrowsingPrices } = loadBlock("commerce_context.block.js", ["stripBrowsingPrices"]);
  const txt = "Fica em 12x de R$ 480 no cartão.";
  assert.equal(stripBrowsingPrices(txt, "simulation"), txt);
});
```

- [ ] **Step 3: Rodar e ver falhar**

Run: `node --test scripts/n8n/tool/tests/parsers.test.mjs`
Expected: FAIL (`export ausente "stripBrowsingPrices"`).

- [ ] **Step 4: Implementar `stripBrowsingPrices` no bloco canônico + 3 cópias**

No `scripts/n8n/tool/parsers/blocks/commerce_context.block.js`, adicione a função pura (junto às demais do guard):

```js
// Remove valores em R$ quando o estágio é de navegação (não-simulação).
// FLUXO: lista/triagem sem preço; preço só sob demanda (prompt) ou na simulação.
function stripBrowsingPrices(text, stage) {
  if (stage === "simulation" || stage === "closing") return text;
  return String(text ?? "")
    .replace(/R\$\s?\d[\d.\s]*(,\d{2})?/g, "")
    .replace(/\s{2,}/g, " ")
    .trim();
}
```

Copie a MESMA função (byte-idêntica) para as 3 cópias inline em `70_01_code-commerce-context.js`, `80_02_code-parse-bia-2-sem-estoque.js`, `80_03_code-parse-bia-2-sem-estoque1.js`, exportando-a junto do bloco de guard, para manter o teste "DUPLICAÇÃO byte-idênticas" verde. (Use o mesmo recorte/sentinela que as cópias já usam.)

- [ ] **Step 5: Estender a cobertura do color-guard ao caminho identificado no Step 1**

No node de **apresentação Bia 2 ESTOQUE** identificado (provável `70_xx`/`Code Parse Bia 1` ou o parser da Bia 2 ESTOQUE) que emite a resposta com cor, aplique `enforceAllowedColors(reply, buildAllowedColors(available_colors), deriveStage(...))` antes de retornar — exatamente como já é feito nas cópias existentes. (Reaproveite o bloco; não reescreva a lógica.)

- [ ] **Step 6: Rodar testes de parser (incl. FIDELIDADE/DUPLICAÇÃO)**

Run: `node --test scripts/n8n/tool/tests/parsers.test.mjs`
Expected: PASS — price-guard novo + os testes de fidelidade/duplicação continuam verdes (canônico == cópias).

- [ ] **Step 7: Commit**

```bash
git add scripts/n8n/tool/parsers/blocks/commerce_context.block.js \
        n8n/ia-repasse-pro-v2/nodes/code/70_01_code-commerce-context.js \
        n8n/ia-repasse-pro-v2/nodes/code/80_02_code-parse-bia-2-sem-estoque.js \
        n8n/ia-repasse-pro-v2/nodes/code/80_03_code-parse-bia-2-sem-estoque1.js \
        n8n/ia-repasse-pro-v2/nodes/code/70_02_code-parse-bia-1.js \
        scripts/n8n/tool/tests/parsers.test.mjs
git commit -m "feat(n8n): price-strip na navegação + cobertura do color-guard (D4)"
```

---

### Task 6: Deploy dos code nodes (routing-flags + parsers) para o vivo

**Files:** (deploy — sem edição de fonte)

**Interfaces:**
- Consumes: arquivos decompostos editados nas Tasks 2–5.
- Produces: workflow vivo atualizado + mirrors re-sincronizados.

- [ ] **Step 1: Guard + validação de estrutura/JS local**

Run:
```bash
export NVM_DIR="$HOME/.nvm"; . "$NVM_DIR/nvm.sh" >/dev/null 2>&1
node scripts/n8n/guard-live-workflow-sync.mjs
node scripts/n8n/repasse-maint.mjs status
```
Expected: guard sem drift; `status` lista exatamente os nodes editados (`Code Routing Flags`, `Code Commerce Context`, `Code Parse Bia 2 SEM ESTOQUE`, `Code Parse Bia 2 SEM ESTOQUE1`, `Code Parse Bia 1`).

- [ ] **Step 2: Dry-run do deploy**

Run: `node scripts/n8n/repasse-maint.mjs deploy`
Expected: `dryRun: true`, lista de edits = os nodes do Step 1, sem `drift`.

- [ ] **Step 3: Deploy confirmado**

Run: `node scripts/n8n/repasse-maint.mjs deploy --confirm`
Expected: `deployed: true`, `activated: true`, backup gravado em `output/n8n/backups/`, `newVersionId` novo, re-sync executado.

- [ ] **Step 4: Verificar roteamento no vivo (audit)**

Run: `node scripts/n8n/smoke-routing-audit.mjs`
Expected: sem rotas mudas; decisões coerentes (sem `ask_client_city_before_stock`).

- [ ] **Step 5: Re-rodar guard (deve estar limpo após re-sync)**

Run: `node scripts/n8n/guard-live-workflow-sync.mjs --check`
Expected: exit 0 (sem drift).

- [ ] **Step 6: Commit**

```bash
git add n8n/ia-repasse-pro-v2/ scripts/n8n/repasse-code-routing-flags.js output/n8n/
git commit -m "chore(n8n): deploy dos code nodes de roteamento e guards (D1–D5)"
```

---

### Task 7: P5 — Memory 2 Reconciler (carry-forward + correção asterisco)

**Files:**
- Modify: `n8n/ia-repasse-pro-v2/nodes/prompts/40_04_memory-2-reconciler.md`

**Interfaces:**
- Consumes: contrato de saída do Memory 2 (JSON do `lead_state` reconciliado).
- Produces: prompt que preserva `cash_entry_*`/`card_brand`/`preferred_city` e interpreta correção por `*`.

- [ ] **Step 1: Ler o prompt atual e localizar a seção de regras de reconciliação**

Run: `sed -n '1,60p' n8n/ia-repasse-pro-v2/nodes/prompts/40_04_memory-2-reconciler.md`
Expected: identificar onde estão as instruções de "copie o LEAD_STATE ATUAL e sobreponha só o que mudou".

- [ ] **Step 2: Acrescentar as regras de carry-forward e correção por asterisco**

Adicione ao prompt (na seção de regras de reconciliação) o bloco:

```markdown
## PRESERVAÇÃO OBRIGATÓRIA (carry-forward)
Copie SEMPRE do LEAD_STATE ATUAL e NUNCA omita: cash_entry_asked, cash_entry_intent,
cash_entry_amount, card_brand, preferred_city. Só altere esses campos se a ÚLTIMA
mensagem do cliente os mudar explicitamente. Omitir = perder o estado e re-perguntar.

## CORREÇÃO COM ASTERISCO (*)
Se a última mensagem do cliente começar/contiver "* <texto>" (ou "<texto>*"), trate
como CORREÇÃO da mensagem imediatamente anterior dele — sobrescreva o campo
correspondente, não crie um novo. Ex.: cliente escreve "d" e depois "De*" → é só
correção ortográfica, não muda intenção nem campos de produto.
```

- [ ] **Step 3: Validar contrato de saída (não pode quebrar o shape)**

Run:
```bash
export NVM_DIR="$HOME/.nvm"; . "$NVM_DIR/nvm.sh" >/dev/null 2>&1
node --test scripts/n8n/tool/tests/prompt-invariants.test.mjs
```
Expected: PASS (o contrato de saída do Memory 2 segue intacto).

- [ ] **Step 4: Deploy (prompt .md via repasse-maint)**

Run:
```bash
node scripts/n8n/repasse-maint.mjs status        # deve listar "Memory 2 - Reconciler"
node scripts/n8n/repasse-maint.mjs deploy        # dry-run
node scripts/n8n/repasse-maint.mjs deploy --confirm
node scripts/n8n/guard-live-workflow-sync.mjs --check
```
Expected: deploy + activate OK; guard limpo.

- [ ] **Step 5: Commit**

```bash
git add n8n/ia-repasse-pro-v2/nodes/prompts/40_04_memory-2-reconciler.md output/n8n/
git commit -m "feat(n8n): Memory 2 preserva entrada/cartão/cidade e entende correção com asterisco (P5)"
```

---

### Task 8: P1/P2 — Prompt Bia 1 (lista curta, disponibilidade, preço sob demanda, sem "compra direta", variante)

**Files:**
- Create: `scripts/n8n/patch-bia1-price-city-list.mjs`

**Interfaces:**
- Consumes: prompt `systemMessage` do node `Bia 1` no workflow vivo.
- Produces: prompt Bia 1 atualizado no vivo + `workflow.json`.

- [ ] **Step 1: Exportar e inspecionar o prompt atual**

Run:
```bash
export NVM_DIR="$HOME/.nvm"; . "$NVM_DIR/nvm.sh" >/dev/null 2>&1
node scripts/n8n/guard-live-workflow-sync.mjs
node -e "const wf=require('./n8n/ia-repasse-pro-v2/workflow.json');const n=wf.nodes.find(x=>x.name==='Bia 1');require('fs').writeFileSync('/tmp/bia1.txt',n.parameters.options.systemMessage);console.log('ok')"
grep -nE 'NUNCA cite preço|Fortaleza ou Sobral|no máximo 2 opções|perguntinhas|tabela' /tmp/bia1.txt
```
Expected: confirma os trechos exatos a substituir (linhas ≈ 243, 220, 101, 136).

- [ ] **Step 2: Escrever o patch cirúrgico**

Cria `scripts/n8n/patch-bia1-price-city-list.mjs` no mesmo formato dos patches existentes (GET → backup em `output/n8n/backups/` → `.replace()` exato com guardas → PUT → `/activate` → re-export; `DRY=1` faz preview). Substituições (exact-string; ajuste o old-string ao texto real do Step 1):

1. **Preço sob demanda** — troca a regra de "nunca cite preço":
   - OLD: `NUNCA cite preço, valor ou faixa de preço — nem se o cliente perguntar. Diga que o valor sai certinho na simulação`
   - NEW: `Não OFEREÇA preço espontaneamente na navegação. MAS se o cliente perguntar, RESPONDA: preço à vista de um modelo (use available_options[].sell_price) e a diferença de valor entre dois modelos. Parcelamento/entrada/troca só na simulação da Bia 2.`

2. **Cidade nunca antes da simulação** — remove a frase de cidade:
   - OLD: `Se já tiver modelo e capacidade, mas faltar cidade: {"message": "Voce prefere retirar em Fortaleza ou Sobral?", "transfer": false}`
   - NEW: `Nunca pergunte cidade de retirada nesta fase. A cidade só é perguntada após a simulação aceita.`

3. **Lista curta (até ~5-6, sem preço)** — amplia o limite:
   - OLD: `mencione no máximo 2 opções disponíveis em 1 frase curta`
   - NEW: `quando a pergunta for genérica (ex.: "quais vocês têm", "modelos Pro Max", pedido de tabela), monte uma LISTA CURTA: até 5 itens por modelo + capacidade (marque novo/seminovo quando útil), SEM cor e SEM preço, terminando com "qual desses te interessa?". Nunca diga que não tem tabela — investigue mostrando a lista.`

4. **Autorização direta do seminovo**:
   - OLD: `Posso te mandar as perguntinhas pra calcular o valor do seu [tradein_model] como entrada?`
   - NEW: `Posso te fazer algumas perguntas sobre o seu iPhone?`

5. **Banir "compra direta" + confirmar variante** — acrescenta ao fim do prompt:
   - APPEND:
     ```
     NUNCA use os termos "compra direta" nem "tem aparelho de entrada?". Para saber se há troca, pergunte de forma humana: "você pretende dar um iPhone usado como parte do pagamento?".
     Se needs_model_tier_confirmation = true (cliente disse só "13/14/15"), antes de seguir confirme: "esse 13 é o normal, o Pro ou o Pro Max?".
     ```

- [ ] **Step 3: Preview (DRY) e validar JSON do node**

Run: `DRY=1 node scripts/n8n/patch-bia1-price-city-list.mjs`
Expected: mostra os 5 hunks aplicados, sem erro de "string não encontrada"; node continua válido.

- [ ] **Step 4: Aplicar + reativar + re-export**

Run: `node scripts/n8n/patch-bia1-price-city-list.mjs`
Expected: PUT + activate OK; re-export atualizou `workflow.json`.

- [ ] **Step 5: Invariants + guard**

Run:
```bash
node --test scripts/n8n/tool/tests/prompt-invariants.test.mjs
node scripts/n8n/guard-live-workflow-sync.mjs --check
```
Expected: PASS; guard limpo.

- [ ] **Step 6: Commit**

```bash
git add scripts/n8n/patch-bia1-price-city-list.mjs n8n/ia-repasse-pro-v2/workflow.json output/n8n/
git commit -m "feat(n8n): Bia 1 — lista curta, disponibilidade, preço sob demanda, sem compra direta, variante (P1/P2)"
```

---

### Task 9: P3 — Prompt Bia 2 ESTOQUE (cor pós-simulação; só cores em estoque)

**Files:**
- Create: `scripts/n8n/patch-bia2-estoque-color.mjs`

**Interfaces:**
- Consumes: `systemMessage` do node `Bia 2 ESTOQUE`.
- Produces: prompt atualizado no vivo + `workflow.json`.

- [ ] **Step 1: Exportar e localizar as regras de cor**

Run:
```bash
export NVM_DIR="$HOME/.nvm"; . "$NVM_DIR/nvm.sh" >/dev/null 2>&1
node -e "const wf=require('./n8n/ia-repasse-pro-v2/workflow.json');const n=wf.nodes.find(x=>x.name==='Bia 2 ESTOQUE');require('fs').writeFileSync('/tmp/bia2e.txt',n.parameters.options.systemMessage);console.log('ok')"
grep -nE 'cor|cores|available_colors|prefer' /tmp/bia2e.txt | head
```
Expected: localizar onde a cor é pedida/oferecida.

- [ ] **Step 2: Escrever o patch cirúrgico**

Cria `scripts/n8n/patch-bia2-estoque-color.mjs` (mesmo formato). Regras a inserir (acrescente bloco e/ou substitua a regra de cor existente):

```
REGRA DE COR:
- Não pergunte cor antes de simular. Cor é sugestão APÓS a simulação, ou só quando o cliente perguntar.
- Só ofereça/confirme cores presentes em available_colors. NUNCA invente nem confirme uma cor que o cliente não disse (ex.: não responda "Ótimo, Dourado então" sem o cliente ter dito Dourado).
- Se o cliente pedir uma cor fora de available_colors, diga que essa cor não está disponível agora e ofereça as cores em estoque: "{available_colors}".
```

- [ ] **Step 3: Preview (DRY)**

Run: `DRY=1 node scripts/n8n/patch-bia2-estoque-color.mjs`
Expected: hunks aplicados sem erro.

- [ ] **Step 4: Aplicar + reativar + re-export**

Run: `node scripts/n8n/patch-bia2-estoque-color.mjs`
Expected: PUT + activate OK.

- [ ] **Step 5: Invariants + guard**

Run:
```bash
node --test scripts/n8n/tool/tests/prompt-invariants.test.mjs
node scripts/n8n/guard-live-workflow-sync.mjs --check
```
Expected: PASS; guard limpo.

- [ ] **Step 6: Commit**

```bash
git add scripts/n8n/patch-bia2-estoque-color.mjs n8n/ia-repasse-pro-v2/workflow.json output/n8n/
git commit -m "feat(n8n): Bia 2 ESTOQUE — cor pós-simulação e só cores em estoque (P3)"
```

---

### Task 10: P4 — Prompt Bia 2 SEM ESTOQUE (convencer no seminovo; handoff só p/ novo; cidade pós-sim)

**Files:**
- Create: `scripts/n8n/patch-bia2-semestoque-convince-city.mjs`

**Interfaces:**
- Consumes: `systemMessage` do node `Bia 2 SEM ESTOQUE ` (atenção ao espaço final no nome).
- Produces: prompt atualizado no vivo + `workflow.json`.

- [ ] **Step 1: Exportar e localizar as regras**

Run:
```bash
export NVM_DIR="$HOME/.nvm"; . "$NVM_DIR/nvm.sh" >/dev/null 2>&1
node -e "const wf=require('./n8n/ia-repasse-pro-v2/workflow.json');const n=wf.nodes.find(x=>x.name==='Bia 2 SEM ESTOQUE ');require('fs').writeFileSync('/tmp/bia2s.txt',n.parameters.options.systemMessage);console.log('ok')"
grep -nE 'ask_client_city_before_stock|Fortaleza ou Sobral|especialista|cor de prefer' /tmp/bia2s.txt
```
Expected: localizar as frases de cidade (linhas ≈ 22, 49, 68) e de transferência (≈ 39-40).

- [ ] **Step 2: Escrever o patch cirúrgico**

Cria `scripts/n8n/patch-bia2-semestoque-convince-city.mjs`. Substituições:

1. **Rota de cidade renomeada (pós-sim)**:
   - OLD: `Se routing_decision = "ask_client_city_before_stock", responda apenas perguntando: "Voce prefere retirar em Fortaleza ou Sobral?"`
   - NEW: `Se routing_decision = "ask_pickup_city_after_sim", aí sim pergunte: "Voce prefere retirar em Fortaleza ou Sobral?". Nunca pergunte cidade antes da simulação aceita.`

2. **Não travar por falta de cidade antes da simulação**:
   - OLD: `Se preferred_city estiver ausente ou "não definida", nao confirme disponibilidade, endereco, PIX, reserva ou retirada. Pergunte: "Voce prefere retirar em Fortaleza ou Sobral?"`
   - NEW: `Antes da simulação, NÃO pergunte cidade. A cidade só é necessária ao confirmar reserva/retirada, após a proposta aceita.`

3. **Convencer no seminovo; especialista só p/ novo** — APPEND:
   ```
   REGRA DE TRANSFERÊNCIA POR FALTA DE MODELO/COR:
   - Para iPhone NOVO indisponível, pode oferecer o especialista.
   - Para SEMINOVO, NÃO ofereça especialista por falta de modelo/cor: convença mostrando a alternativa mais próxima em estoque e oferecendo simular ("posso simular o parcelamento dessa opção pra você?").
   ```

- [ ] **Step 3: Preview (DRY)**

Run: `DRY=1 node scripts/n8n/patch-bia2-semestoque-convince-city.mjs`
Expected: hunks aplicados sem erro.

- [ ] **Step 4: Aplicar + reativar + re-export**

Run: `node scripts/n8n/patch-bia2-semestoque-convince-city.mjs`
Expected: PUT + activate OK.

- [ ] **Step 5: Invariants + guard**

Run:
```bash
node --test scripts/n8n/tool/tests/prompt-invariants.test.mjs
node scripts/n8n/guard-live-workflow-sync.mjs --check
```
Expected: PASS; guard limpo.

- [ ] **Step 6: Commit**

```bash
git add scripts/n8n/patch-bia2-semestoque-convince-city.mjs n8n/ia-repasse-pro-v2/workflow.json output/n8n/
git commit -m "feat(n8n): Bia 2 SEM ESTOQUE — convencer no seminovo e cidade pós-sim (P4)"
```

---

### Task 11: Regressão do caso VD (integração ao vivo) + fechamento

**Files:**
- Create: `scripts/n8n/smoke-vd-regression.mjs`

**Interfaces:**
- Consumes: `scripts/n8n/fixtures/vd-558897107383-transcript.json` (Task 0); padrão de envio de `smoke-live-bia2.mjs`.
- Produces: relatório de asserções de FLUXO sobre o replay.

- [ ] **Step 1: Escrever o cenário de replay**

Cria `scripts/n8n/smoke-vd-regression.mjs` reusando o cliente de envio do `smoke-live-bia2.mjs`. Requisitos:
- usar **JID único** (ex.: `5511` + timestamp) para não colidir com o debounce do harness;
- enviar `customer_turns` da fixture em ordem, aguardando a resposta de cada turno;
- coletar as respostas da IA (do `Simulador`/`Montar Body` runData do execution correto — não confie só no reply postado, por causa da buffer-race);
- afirmar os `flow_assertions` da fixture:
  1. aparece uma lista-curta (≥2 modelos, sem `R$`) na resposta ao pedido genérico;
  2. nenhuma resposta pergunta cidade antes do primeiro `simulation_done`;
  3. nenhuma resposta pergunta cor antes do primeiro `simulation_done`;
  4. nenhuma resposta contém "compra direta";
  5. ao perguntar diferença de preço, a resposta contém um valor/declaração de diferença;
  6. ao dizer "Quero dar um 13", a IA confirma normal/Pro/Pro Max;
  7. a pergunta de entrada aparece no máximo 1×;
  8. ao menos uma simulação é produzida (runData de `Simulador`).

- [ ] **Step 2: Guard antes de tocar o vivo**

Run:
```bash
export NVM_DIR="$HOME/.nvm"; . "$NVM_DIR/nvm.sh" >/dev/null 2>&1
node scripts/n8n/guard-live-workflow-sync.mjs --check
```
Expected: exit 0.

- [ ] **Step 3: Rodar o replay**

Run: `node scripts/n8n/smoke-vd-regression.mjs`
Expected: todas as 8 asserções PASS. Se alguma falhar, isolar (systematic-debugging) entre routing-flags (Tasks 2–4) e prompt (Tasks 8–10) e corrigir na task de origem.

- [ ] **Step 4: Suíte completa verde**

Run: `npm run test:n8n-tool`
Expected: PASS (tool + prompt-invariants + parsers + routing-flags).

- [ ] **Step 5: Commit**

```bash
git add scripts/n8n/smoke-vd-regression.mjs
git commit -m "test(n8n): regressão de fluxo do caso VD (replay + asserções FAQ/FLUXO)"
```

- [ ] **Step 6: Fechamento da branch**

Invoque a skill `superpowers:finishing-a-development-branch` para decidir merge/PR/cleanup da branch `feat/ia-fluxo-atendimento-evolucao`. Confirme que o workflow vivo está **ativo** (re-export final) antes de fechar.

---

## Self-Review (executado na escrita do plano)

**Cobertura do spec:**
- FAQ tabela → Task 8 (lista curta, "nunca diga que não tem tabela"). ✓
- "compra direta" / autorização direta → Task 8. ✓
- Lista curta p/ genérico → Task 8 + Task 11 (asserção 1). ✓
- Disponibilidade buscar/não negar → Task 8 (usa `available_*`) + Task 6 (rota não-muda). ✓
- Cidade pós-sim → Task 3 (D1) + Task 8/10 (prompts) + Task 11 (asserção 2). ✓
- Cor pós-sim / não exigida → Task 2 (D2) + Task 9 (P3) + Task 11 (asserção 3). ✓
- Confirmar variante 13/Pro/Pro Max → Task 4 (D5) + Task 8 (pergunta) + Task 11 (asserção 6). ✓
- Correção asterisco → Task 7 (P5). ✓
- Diferença/preço sob demanda → Task 8 (P2) + Task 5 (price-strip navegação) + Task 11 (asserção 5). ✓
- Não confirmar/inventar cor fora de estoque → Task 5 (D4 color-guard) + Task 9 (P3) + Task 11 (asserção... cobertura cor). ✓
- Convencer seminovo / handoff só novo → Task 10 (P4). ✓
- Não reperguntar entrada → Task 2 (D3) + Task 11 (asserção 7). ✓

**Placeholders:** nenhum "TBD/TODO"; trechos onde o old-string exato depende do texto vivo do prompt (Tasks 8–10) têm Step explícito de exportar e localizar a string antes de aplicar — é instrução acionável, não placeholder.

**Consistência de tipos/nomes:** `runRoutingFlags`/`baseState` definidos na Task 1 e reusados igual nas Tasks 2–4; `stripBrowsingPrices(text, stage)` definido na Task 5 e testado com a mesma assinatura; flags `needsPickupCity`/`needs_model_tier_confirmation` nomeadas igual em routing-flags e nos prompts que as leem.

## Execution Handoff

Plano salvo em `docs/superpowers/plans/2026-06-17-ia-fluxo-atendimento-evolucao.md`. Duas opções de execução:

1. **Subagent-Driven (recomendado)** — um subagente novo por task, revisão entre tasks, iteração rápida.
2. **Inline Execution** — executar as tasks nesta sessão via executing-plans, com checkpoints de revisão.
```
