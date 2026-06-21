# Buffer ciente de contexto (pending_detail) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Eliminar o eco em que a IA repergunta um detalhe (ex: modelo de entrada) porque o usuário respondeu em duas mensagens (`Sim` + `14pm`) e o buffer liberou a primeira sozinha.

**Architecture:** No **envio** do bot, gravar a última mensagem do bot num Redis key `pending_detail:{contact_id}` (TTL 90s). No **próximo inbound**, `Calcular Wait Buffer` lê esse texto, classifica com `classifyBiaQuestion` (cópia do regex VIVO do nó Memory 2) e — se uma pergunta de detalhe está pendente E a resposta é única/curta/parcial que ainda não contém o detalhe — estende a janela de debounce de 15s para **40s**, fazendo a segunda mensagem ser mesclada. Mecânica de winner/lock inalterada.

**Tech Stack:** n8n (workflow `Cr4fPWe0prwS6XjI`), nós Code (JS) + Redis (Get/Set), patch cirúrgico via REST API (Node ESM), testes `node:test`.

## Global Constraints

- **Workflow LIVE:** `Cr4fPWe0prwS6XjI` ("ia repasse-pro v2 avancada"). Toda alteração toca produção.
- **Rodar o guard PRIMEIRO** em qualquer toque no workflow vivo: `node scripts/n8n/guard-live-workflow-sync.mjs` (ou confiar no PreToolUse hook). Em drift, ele re-exporta e re-sincroniza os mirrors `.js` antes de qualquer patch.
- **Node via nvm:** o shell do Bash não tem node no PATH. Antes de qualquer comando node/npm: `export NVM_DIR="$HOME/.nvm"; . "$NVM_DIR/nvm.sh"`.
- **Protocolo de patch cirúrgico:** GET → backup em `output/n8n/backups/` → edição exata → `new Function()` syntax-assert → `DRY=1` preview → PUT com allowlist de `settings` → `/activate` → re-export → `repasse-maint.mjs pull` para re-sincronizar o mirror.
- **NUNCA editar na UI do n8n enquanto deploya via API** (reverte silenciosamente).
- **Env:** chaves reais são `N8N_API_KEY` + `N8N_BASE_URL` em `.env.local` (NÃO `N8N_PUBLIC_API`/`N8N_MCP_URL`).
- **Janela estendida:** 40s. **TTL do flag:** 90s. **Escopo:** as 5 classes do classificador (`tradein_model`, `cash_entry`, `desired_model`, `desired_capacity`, `desired_color`).
- **Regex canônico = o do nó VIVO `Code Parse Memory 2`** (40_05), que é mais rico que o bloco `reply_attribution.block.js` e é o único que casa "parte do pagamento". Copiar verbatim dele.

---

## File Structure

- **Create** `scripts/n8n/tool/parsers/blocks/buffer_pending_detail.block.js` — lógica pura: `classifyBiaQuestion` (cópia do regex vivo), `replyContainsDetail`, `isAffirmative`, `decideBufferWait`. Sem `$json`/`$input`/`$()`.
- **Create** `scripts/n8n/tool/tests/buffer-pending-detail.test.mjs` — caracterização + consistência de duplicação (a cópia de `classifyBiaQuestion` no bloco == o regex no nó vivo `40_05`).
- **Modify** `package.json` — adicionar o novo teste ao script `test:n8n-tool`.
- **Create** `scripts/n8n/patch-buffer-pending-detail.mjs` — patch cirúrgico: adiciona 2 nós `Redis Set pending_detail` (write, um por branch Bia), 1 nó `Redis Get pending_detail` (read), reescreve `Calcular Wait Buffer`, e religa conexões. DRY/backup/validate/PUT/activate/re-export.
- **Live (via patch):** workflow `Cr4fPWe0prwS6XjI` — 3 nós novos + `Calcular Wait Buffer` reescrito + 3 religações de conexão.

### Topologia confirmada (não suposta)

- **Read path:** `Atualizar Estado Buffer` → `Redis Set Buffer` → `Calcular Wait Buffer` → `Wait1`. (`Redis Set Buffer` também → `Values Set + buffer_obj`, intacto.)
- **Redis "get" NÃO faz pass-through** do input (confirmado: `Atualizar Estado Buffer` usa `items.find(hasOwnProperty('redis_buffer_value'))` + acha o item `buffer` à parte). Por isso `Calcular Wait Buffer` lê dados de buffer via ref explícita `$('Redis Set Buffer')`, não via `$input`.
- **Redis "set" FAZ pass-through** (confirmado: `Redis Set Buffer` → consumidores leem `$json.redis_key` que vem do input). Por isso os `Redis Set pending_detail` podem ser inseridos inline sem quebrar o branch.
- **Write paths (texto completo do bot = `router.message`):**
  - Bia 2: `Code Parse Bia 2 SEM ESTOQUE` → `CODE MONTAR LINK REPASSE 2` → … → `HTTP Request` (crm-send-message).
  - Bia 1: `Code Parse Bia 1` → `Code Montar Link Repasse 1` → … → `HTTP Request21`.
- **contact_id** disponível via `$('Code Consolidador Payload Final').item.json.cliente.contact_id` (mesma ref do `Redis Delete Buffer`); no read path, `redis_key` (= contact_id) já está em `$json`.

---

### Task 1: Bloco puro `buffer_pending_detail.block.js` + testes

**Files:**
- Create: `scripts/n8n/tool/parsers/blocks/buffer_pending_detail.block.js`
- Test: `scripts/n8n/tool/tests/buffer-pending-detail.test.mjs`
- Modify: `package.json` (script `test:n8n-tool`)

**Interfaces:**
- Produces:
  - `classifyBiaQuestion(text: string): 'cash_entry'|'tradein_model'|'desired_model'|'desired_capacity'|'desired_color'|null`
  - `replyContainsDetail(text: string, expects: string): boolean`
  - `isAffirmative(text: string): boolean`
  - `decideBufferWait(input: { messages: Array<{text,type}>, lastBotText: string, baseSeconds: number, baseReason: string }): { seconds: number, reason: string }`
  - Exporta tudo via `module.exports` (CommonJS — alinhado ao mecanismo `loadBlock`).

- [ ] **Step 1: Escrever o bloco puro**

Create `scripts/n8n/tool/parsers/blocks/buffer_pending_detail.block.js`:

```js
// buffer_pending_detail.block.js — PURE logic (no $json/$input/$()).
// Canonical source duplicated INLINE into the "Calcular Wait Buffer" node.
//
// classifyBiaQuestion: BYTE-COPY dos regexes do nó VIVO "Code Parse Memory 2"
//   (n8n/ia-repasse-pro-v2/nodes/code/40_05_code-parse-memory-2.js). Mais rico que
//   reply_attribution.block.js — inclui "parte do pagamento"/"na troca", que é o
//   phrasing real do opener de entrada. A consistência é travada pelo teste.
// decideBufferWait: estende a janela de debounce de baseSeconds para 40s quando há
//   uma pergunta de detalhe pendente E a resposta é única/curta/parcial que ainda
//   não contém o detalhe pedido. Caso contrário devolve a base intacta.

function normalizeReplyText(s) {
  return String(s || '')
    .toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

// === CLASSIFY-BIA-QUESTION (cópia verbatim do nó vivo Code Parse Memory 2) ===
function classifyBiaQuestion(quotedText) {
  const t = normalizeReplyText(quotedText);
  if (!t) return null;
  if (/valor de entrada|entrada no pix|entrada em dinheiro|pix\/dinheiro|algum valor de entrada/.test(t)) return 'cash_entry';
  if (/aparelho que voce tem|aparelho atual|que voce tem (agora|hoje)|seu aparelho|aparelho de entrada|dar como entrada|dar de entrada|dar de entr|pra dar de entrada|de entrada|parte do pagamento|dar (algum|um|seu) (iphone|aparelho|celular)|na troca|de troca|pra troca|para troca|dar na troca/.test(t)) return 'tradein_model';
  if (/qual modelo|modelo de iphone|(deseja|quer) comprar|esta procurando|ta procurando|procurando/.test(t)) return 'desired_model';
  if (/armazenamento|capacidade|quantos gb|quantos giga/.test(t)) return 'desired_capacity';
  if (/\bcor\b|\bcores\b|qual cor/.test(t)) return 'desired_color';
  return null;
}
// === END CLASSIFY-BIA-QUESTION ===

const IPHONE_MODEL_RE = /\b(\d{1,2})\s?(pro\s?max|pro|plus|max|mini|promax|pm|p|\+)?\b|\b(xr|xs|se)\b/;
const COLOR_RE = /\b(preto|branco|azul|verde|rosa|roxo|lilas|cinza|natural|dourado|gold|deserto|vermelho|titanio|titânio|meia noite|estelar)\b/;

function replyContainsDetail(text, expects) {
  const t = normalizeReplyText(text);
  if (!t) return false;
  if (expects === 'tradein_model' || expects === 'desired_model') return IPHONE_MODEL_RE.test(t);
  if (expects === 'desired_capacity') return /\b\d+\s?(gb|tb)\b/.test(t.replace(/\s/g, ' '));
  if (expects === 'desired_color') return COLOR_RE.test(t);
  if (expects === 'cash_entry') return /\b\d/.test(t) || /\b(nao|sem entrada|nada|so no cartao|tudo no cartao)\b/.test(t);
  return false;
}

function isAffirmative(text) {
  const t = normalizeReplyText(text);
  return /^(s|sim|tenho|quero|aceito|pode|isso|positivo|claro|ok|opa|tenho sim|quero sim)\b/.test(t);
}

function decideBufferWait(input) {
  const messages = Array.isArray(input?.messages) ? input.messages : [];
  const baseSeconds = Number(input?.baseSeconds ?? 25);
  const baseReason = String(input?.baseReason ?? 'fallback_25s');
  const lastBotText = input?.lastBotText ?? '';

  // Só considera estender numa resposta ÚNICA (um único evento neste burst).
  if (messages.length !== 1) return { seconds: baseSeconds, reason: baseReason };

  const expects = classifyBiaQuestion(lastBotText);
  if (!expects) return { seconds: baseSeconds, reason: baseReason };

  const current = messages[0] || {};
  const type = normalizeReplyText(current.type || 'text');
  if (type && !['text', 'extendedtextmessage', 'conversation'].includes(type)) {
    return { seconds: baseSeconds, reason: baseReason };
  }

  const text = current.text || '';
  // Já respondeu o detalhe de uma vez → não atrasa.
  if (replyContainsDetail(text, expects)) return { seconds: baseSeconds, reason: baseReason };

  // Afirmativo nu OU resposta bem curta → provável resposta parcial a caminho.
  const short = isAffirmative(text) || normalizeReplyText(text).length <= 40;
  if (!short) return { seconds: baseSeconds, reason: baseReason };

  return { seconds: 40, reason: 'pending_detail_extend:' + expects };
}

module.exports = { normalizeReplyText, classifyBiaQuestion, replyContainsDetail, isAffirmative, decideBufferWait };
```

- [ ] **Step 2: Escrever os testes (falhando)**

Create `scripts/n8n/tool/tests/buffer-pending-detail.test.mjs`:

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const HERE = path.dirname(fileURLToPath(import.meta.url));
const BLOCK = path.resolve(HERE, '../parsers/blocks/buffer_pending_detail.block.js');
const LIVE_MEMORY2 = path.resolve(HERE, '../../../../n8n/ia-repasse-pro-v2/nodes/code/40_05_code-parse-memory-2.js');
const { classifyBiaQuestion, replyContainsDetail, isAffirmative, decideBufferWait } = require(BLOCK);

test('classifyBiaQuestion casa o opener real de entrada (parte do pagamento)', () => {
  assert.equal(classifyBiaQuestion('Você tem algum iPhone pra dar como parte do pagamento? Se tiver, me conta qual modelo.'), 'tradein_model');
  assert.equal(classifyBiaQuestion('Qual modelo é o iPhone que você vai dar como entrada?'), 'tradein_model');
  assert.equal(classifyBiaQuestion('Quer dar algum valor de entrada no Pix?'), 'cash_entry');
  assert.equal(classifyBiaQuestion('Qual modelo você está procurando?'), 'desired_model');
  assert.equal(classifyBiaQuestion('Qual a capacidade? quantos GB?'), 'desired_capacity');
  assert.equal(classifyBiaQuestion('E a cor, qual prefere?'), 'desired_color');
  assert.equal(classifyBiaQuestion('Beleza, fechado então!'), null);
});

test('replyContainsDetail detecta resposta completa', () => {
  assert.equal(replyContainsDetail('14pm', 'tradein_model'), true);
  assert.equal(replyContainsDetail('iphone 13', 'desired_model'), true);
  assert.equal(replyContainsDetail('128gb', 'desired_capacity'), true);
  assert.equal(replyContainsDetail('preto', 'desired_color'), true);
  assert.equal(replyContainsDetail('500', 'cash_entry'), true);
  assert.equal(replyContainsDetail('Sim', 'tradein_model'), false);
});

test('isAffirmative', () => {
  assert.equal(isAffirmative('Sim'), true);
  assert.equal(isAffirmative('tenho sim'), true);
  assert.equal(isAffirmative('14pm'), false);
});

test('decideBufferWait: ESTENDE no cenário do bug (Sim isolado, pergunta de entrada pendente)', () => {
  const r = decideBufferWait({
    messages: [{ text: 'Sim', type: 'text' }],
    lastBotText: 'Você tem algum iPhone pra dar como parte do pagamento? Se tiver, me conta qual modelo.',
    baseSeconds: 15, baseReason: 'resposta_curta_segura_15s',
  });
  assert.equal(r.seconds, 40);
  assert.match(r.reason, /^pending_detail_extend:tradein_model$/);
});

test('decideBufferWait: NÃO estende se já veio o modelo de uma vez', () => {
  const r = decideBufferWait({
    messages: [{ text: '14pm', type: 'text' }],
    lastBotText: 'Qual modelo é o iPhone que você vai dar como entrada?',
    baseSeconds: 15, baseReason: 'resposta_curta_segura_15s',
  });
  assert.equal(r.seconds, 15);
});

test('decideBufferWait: NÃO estende sem pergunta pendente', () => {
  const r = decideBufferWait({
    messages: [{ text: 'Sim', type: 'text' }],
    lastBotText: 'Show, vou verificar aqui pra você!',
    baseSeconds: 15, baseReason: 'resposta_curta_segura_15s',
  });
  assert.equal(r.seconds, 15);
});

test('decideBufferWait: NÃO estende com múltiplas mensagens no buffer', () => {
  const r = decideBufferWait({
    messages: [{ text: 'Sim', type: 'text' }, { text: '14pm', type: 'text' }],
    lastBotText: 'Você tem algum iPhone pra dar como parte do pagamento?',
    baseSeconds: 25, baseReason: 'fallback_25s_buffer_com_multiplas_mensagens',
  });
  assert.equal(r.seconds, 25);
});

test('decideBufferWait: NÃO estende em mídia/áudio', () => {
  const r = decideBufferWait({
    messages: [{ text: 'Sim', type: 'audioMessage' }],
    lastBotText: 'Você tem algum iPhone pra dar como parte do pagamento?',
    baseSeconds: 25, baseReason: 'fallback_25s_midia_ou_tipo_complexo',
  });
  assert.equal(r.seconds, 25);
});

// CONSISTÊNCIA DE DUPLICAÇÃO: o regex de classifyBiaQuestion do bloco deve casar
// byte-a-byte com o do nó VIVO Code Parse Memory 2 (a fonte operacional de verdade).
test('classifyBiaQuestion: regexes idênticos ao nó vivo Memory 2', () => {
  const blockSrc = fs.readFileSync(BLOCK, 'utf8');
  const liveSrc = fs.readFileSync(LIVE_MEMORY2, 'utf8');
  const grab = (src, ret) => {
    const re = new RegExp(`if \\((\\/[^\\n]*?)\\.test\\(t\\)\\) return '${ret}';`);
    const m = src.match(re);
    assert.ok(m, `regex p/ ${ret} não encontrado`);
    return m[1];
  };
  for (const ret of ['cash_entry', 'tradein_model', 'desired_model', 'desired_capacity', 'desired_color']) {
    assert.equal(grab(blockSrc, ret), grab(liveSrc, ret), `regex divergente p/ ${ret}`);
  }
});
```

- [ ] **Step 3: Rodar os testes — devem PASSAR (lógica e cópia já escritas)**

Run:
```bash
export NVM_DIR="$HOME/.nvm"; . "$NVM_DIR/nvm.sh"
node --test scripts/n8n/tool/tests/buffer-pending-detail.test.mjs
```
Expected: todos os testes PASS. Se o teste de consistência falhar, ajustar a cópia do regex no bloco para bater **exatamente** com o nó vivo `40_05` (a fonte de verdade), nunca o contrário.

- [ ] **Step 4: Registrar o teste no runner**

Modify `package.json`, no fim do valor de `"test:n8n-tool"`, antes do fechamento de aspas, acrescentar:
```
 scripts/n8n/tool/tests/buffer-pending-detail.test.mjs
```
(adicionar como mais um arquivo na lista separada por espaço passada a `node --test`).

- [ ] **Step 5: Rodar a suíte completa**

Run:
```bash
export NVM_DIR="$HOME/.nvm"; . "$NVM_DIR/nvm.sh"
npm run test:n8n-tool
```
Expected: PASS (incluindo o novo arquivo).

- [ ] **Step 6: Commit**

```bash
git add scripts/n8n/tool/parsers/blocks/buffer_pending_detail.block.js scripts/n8n/tool/tests/buffer-pending-detail.test.mjs package.json
git commit -m "feat(n8n): lógica pura do buffer ciente de contexto (pending_detail) + testes

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 2: Patch cirúrgico — guard + base congelada

**Files:**
- Run: `scripts/n8n/guard-live-workflow-sync.mjs`

**Interfaces:**
- Consumes: nada.
- Produces: mirror local (`n8n/ia-repasse-pro-v2/`) garantidamente == workflow vivo; confirma que o nó vivo `Calcular Wait Buffer` é a versão dinâmica (15/20/25s), não a `fixed_25s`.

- [ ] **Step 1: Rodar o guard**

Run:
```bash
export NVM_DIR="$HOME/.nvm"; . "$NVM_DIR/nvm.sh"
node scripts/n8n/guard-live-workflow-sync.mjs --json
```
Expected: sai 0; se reportar drift, ele re-sincroniza os mirrors. Reler os arquivos sincronizados antes de prosseguir.

- [ ] **Step 2: Confirmar a base de `Calcular Wait Buffer`**

Run:
```bash
export NVM_DIR="$HOME/.nvm"; . "$NVM_DIR/nvm.sh"
node -e 'const w=require("./output/n8n/ia-repasse-pro-v2-current.json"); const n=w.nodes.find(x=>x.name==="Calcular Wait Buffer"); console.log(n.parameters.jsCode.slice(0,120))'
```
Expected: começa com `// Calcula a janela de debounce` e contém `isSafeShortReply` (versão dinâmica). Se for a versão `fixed_25s`, PARAR e revisar com o usuário — a base assumida pelo patch mudou.

---

### Task 3: Patch cirúrgico — write nodes, read node, rewrite de `Calcular Wait Buffer`

**Files:**
- Create: `scripts/n8n/patch-buffer-pending-detail.mjs`

**Interfaces:**
- Consumes: bloco puro da Task 1 (lê o `.block.js` e injeta o corpo das funções inline no `Calcular Wait Buffer`).
- Produces: workflow vivo com 3 nós novos + `Calcular Wait Buffer` reescrito; `DRY=1` para preview.

- [ ] **Step 1: Escrever o patch script**

Create `scripts/n8n/patch-buffer-pending-detail.mjs`:

```js
import { mkdir, readFile, writeFile } from 'node:fs/promises';

// Adiciona o flag pending_detail (write nos 2 branches Bia + read antes do Wait) e
// reescreve "Calcular Wait Buffer" para estender a janela quando há detalhe pendente.
// Escopo: 3 nós novos + 1 nó reescrito + 3 religações. Sem mexer em winner/lock.

const WORKFLOW_ID = 'Cr4fPWe0prwS6XjI';
const TTL_SECONDS = 90;

// ── extrai os corpos de função do bloco puro p/ embutir no nó ──
const blockSrc = await readFile('scripts/n8n/tool/parsers/blocks/buffer_pending_detail.block.js', 'utf8');
const pure = blockSrc
  .replace(/^[\s\S]*?(?=function normalizeReplyText)/, '')   // tira o header de comentário
  .replace(/\nmodule\.exports[\s\S]*$/, '\n');               // tira o export CommonJS

const WAIT_CODE = `// Calcula a janela de debounce do buffer antes do Wait1 (context-aware).
// Base dinâmica (15/20/25s) PRESERVADA; estende p/ 40s só quando há pergunta de
// detalhe pendente (pending_detail) e a resposta única parece parcial.
${pure}
const src = $('Redis Set Buffer').first().json;
const buffer = src.buffer_obj || {};
const messages = Array.isArray(buffer.messages) ? buffer.messages : [];

function isGreetingOnly(text){ return /^(oi|ola|olá|bom dia|boa tarde|boa noite|opa|e ai|e aí)$/.test(text); }
function isSafeShortReply(text){
  if (!text || isGreetingOnly(text)) return false;
  const compact = text.replace(/\\s/g,'');
  if (/^(s|sim|nao|não|n|ok|okay|certo|pode|quero|aceito|fechado|combinado)$/.test(text)) return true;
  if (/^(64|128|256|512)gb?$/.test(compact) || /^(1|2)tb$/.test(compact)) return true;
  if (/^(preto|branco|azul|verde|rosa|roxo|lilas|lilás|cinza|natural|dourado|gold|deserto|vermelho)$/.test(text)) return true;
  if (/^(fortaleza|sobral|eusebio|eusébio|maracanau|maracanaú|caucaia|juazeiro|iguatu)$/.test(text)) return true;
  if (/^(pix|cartao|cartão|credito|crédito|debito|débito|dinheiro|a vista|à vista)$/.test(text)) return true;
  if (/^(novo|seminovo|usado|lacrado)$/.test(text)) return true;
  const words = text.split(' ').filter(Boolean);
  return text.length <= 30 && words.length <= 4;
}

const current = messages.length ? messages[messages.length-1] : {};
const ntext = normalizeReplyText(current.text || src.message_buffered || '');
const ntype = normalizeReplyText(current.type || 'text');
const words = ntext.split(' ').filter(Boolean);

let baseSeconds = 25, baseReason = 'fallback_25s';
if (!ntext) baseReason = 'fallback_25s_sem_texto';
else if (ntype && !['text','extendedtextmessage','conversation'].includes(ntype)) baseReason = 'fallback_25s_midia_ou_tipo_complexo';
else if (messages.length > 1) baseReason = 'fallback_25s_buffer_com_multiplas_mensagens';
else if (isSafeShortReply(ntext)) { baseSeconds = 15; baseReason = 'resposta_curta_segura_15s'; }
else if (ntext.length <= 100 && words.length <= 14) { baseSeconds = 20; baseReason = 'resposta_media_texto_unico_20s'; }

let lastBotText = '';
try { lastBotText = String($('Redis Get pending_detail').first().json.pending_detail_raw || ''); } catch (e) { lastBotText = ''; }

const decided = decideBufferWait({ messages, lastBotText, baseSeconds, baseReason });

return [{ json: { ...src, buffer_wait_seconds: decided.seconds, buffer_wait_reason: decided.reason } }];`;

// ── helpers REST ──
function parseEnv(text){
  return Object.fromEntries(text.split(/\r?\n/).map(l=>l.trim()).filter(l=>l&&!l.startsWith('#')&&l.includes('=')).map(l=>{const i=l.indexOf('=');let v=l.slice(i+1).trim();if((v.startsWith('"')&&v.endsWith('"'))||(v.startsWith("'")&&v.endsWith("'")))v=v.slice(1,-1);return [l.slice(0,i).trim(),v];}));
}
function sanitizeForUpdate(w){
  const allowed=['saveExecutionProgress','saveManualExecutions','saveDataErrorExecution','saveDataSuccessExecution','executionTimeout','errorWorkflow','timezone','executionOrder'];
  const settings=Object.fromEntries(Object.entries(w.settings??{}).filter(([k])=>allowed.includes(k)));
  const body={name:w.name,nodes:w.nodes,connections:w.connections,settings};
  if(w.staticData)body.staticData=w.staticData;
  return body;
}
async function api(origin,key,path,init={}){
  const r=await fetch(new URL(path,origin),{...init,headers:{'X-N8N-API-KEY':key,'content-type':'application/json',...(init.headers||{})}});
  const t=await r.text();
  if(!r.ok)throw new Error(`${init.method||'GET'} ${path} failed: ${r.status} ${t}`);
  return t?JSON.parse(t):null;
}

const env = parseEnv(await readFile('.env.local','utf8'));
const key = env.N8N_API_KEY;
const origin = new URL(env.N8N_BASE_URL).origin;
if(!key) throw new Error('Missing N8N_API_KEY');

const wf = await api(origin,key,`/api/v1/workflows/${WORKFLOW_ID}`);
await mkdir('output/n8n/backups',{recursive:true});
const backupPath = `output/n8n/backups/${WORKFLOW_ID}-before-pending-detail-${new Date().toISOString().replace(/[:.]/g,'-')}.json`;
await writeFile(backupPath, `${JSON.stringify(wf,null,2)}\n`);

const byName = n => wf.nodes.find(x=>x.name===n);
const must = n => { const x=byName(n); if(!x) throw new Error(`Node não encontrado: ${n}`); return x; };

// 0) Guard: a base de Calcular Wait Buffer precisa ser a dinâmica.
const calc = must('Calcular Wait Buffer');
if (!/isSafeShortReply/.test(calc.parameters?.jsCode||'') && !calc.parameters?.jsCode?.includes('decideBufferWait')) {
  throw new Error('Base de Calcular Wait Buffer não é a dinâmica esperada — abortando (rodar o guard).');
}

// posição helper p/ não empilhar nós
const near = (node,dx=0,dy=140) => [ (node.position?.[0]??0)+dx, (node.position?.[1]??0)+dy ];

const redisCred = must('Redis Set Buffer').credentials; // reaproveita a mesma credencial Redis

// 1) WRITE — Redis Set pending_detail no branch Bia 2 (após Code Parse Bia 2 SEM ESTOQUE)
function makeSetNode(name, anchor){
  return {
    parameters: {
      operation: 'set',
      key: "={{ 'pending_detail:' + $('Code Consolidador Payload Final').item.json.cliente.contact_id }}",
      value: "={{ $json.router && $json.router.message ? $json.router.message : '' }}",
      keyType: 'string',
      expire: true,
      ttl: TTL_SECONDS,
      valueIsJSON: false,
    },
    type: 'n8n-nodes-base.redis',
    typeVersion: 1,
    name, credentials: redisCred,
    position: near(anchor, 40, -160),
  };
}
const setBia2 = makeSetNode('Redis Set pending_detail B2', must('CODE MONTAR LINK REPASSE 2'));
const setBia1 = makeSetNode('Redis Set pending_detail B1', must('Code Montar Link Repasse 1'));

// 2) READ — Redis Get pending_detail antes de Calcular Wait Buffer
const getPending = {
  parameters: {
    operation: 'get',
    key: "={{ 'pending_detail:' + $json.redis_key }}",
    keyType: 'string',
    propertyName: 'pending_detail_raw',
    options: {},
  },
  type: 'n8n-nodes-base.redis', typeVersion: 1,
  name: 'Redis Get pending_detail', credentials: redisCred,
  position: near(calc, -40, -150),
};

wf.nodes.push(setBia2, setBia1, getPending);

// 3) Reescreve Calcular Wait Buffer
calc.parameters = { ...(calc.parameters??{}), jsCode: WAIT_CODE };
new Function(WAIT_CODE); // syntax-assert

// 4) Religações
const C = wf.connections;
const out = n => ((C[n] ||= { main: [[]] }).main[0] ||= []);

// 4a) WRITE B2: Code Parse Bia 2 SEM ESTOQUE → [Set B2] → CODE MONTAR LINK REPASSE 2
out('Code Parse Bia 2 SEM ESTOQUE').splice(0, out('Code Parse Bia 2 SEM ESTOQUE').length,
  { node: 'Redis Set pending_detail B2', type: 'main', index: 0 });
C['Redis Set pending_detail B2'] = { main: [[{ node: 'CODE MONTAR LINK REPASSE 2', type: 'main', index: 0 }]] };

// 4b) WRITE B1: Code Parse Bia 1 → [Set B1] → Code Montar Link Repasse 1
out('Code Parse Bia 1').splice(0, out('Code Parse Bia 1').length,
  { node: 'Redis Set pending_detail B1', type: 'main', index: 0 });
C['Redis Set pending_detail B1'] = { main: [[{ node: 'Code Montar Link Repasse 1', type: 'main', index: 0 }]] };

// 4c) READ: Redis Set Buffer → [Get pending] → Calcular Wait Buffer
//     (preserva a outra saída de Redis Set Buffer → Values Set + buffer_obj)
const rsb = out('Redis Set Buffer');
const idx = rsb.findIndex(c => c.node === 'Calcular Wait Buffer');
if (idx === -1) throw new Error('Conexão Redis Set Buffer → Calcular Wait Buffer não encontrada');
rsb[idx] = { node: 'Redis Get pending_detail', type: 'main', index: 0 };
C['Redis Get pending_detail'] = { main: [[{ node: 'Calcular Wait Buffer', type: 'main', index: 0 }]] };

// ── assert: cada conexão religada confere ──
function assertEdge(from, to){
  const f = (C[from]?.main?.[0]||[]).some(c=>c.node===to);
  if(!f) throw new Error(`Aresta ausente: ${from} → ${to}`);
}
assertEdge('Code Parse Bia 2 SEM ESTOQUE','Redis Set pending_detail B2');
assertEdge('Redis Set pending_detail B2','CODE MONTAR LINK REPASSE 2');
assertEdge('Code Parse Bia 1','Redis Set pending_detail B1');
assertEdge('Redis Set pending_detail B1','Code Montar Link Repasse 1');
assertEdge('Redis Set Buffer','Redis Get pending_detail');
assertEdge('Redis Get pending_detail','Calcular Wait Buffer');

if (process.env.DRY === '1'){
  console.log(JSON.stringify({ dry:true, backupPath, addedNodes:['Redis Set pending_detail B2','Redis Set pending_detail B1','Redis Get pending_detail'], waitCodeHead: WAIT_CODE.slice(0,80) }, null, 2));
  process.exit(0);
}

const updated = await api(origin,key,`/api/v1/workflows/${WORKFLOW_ID}`,{ method:'PUT', body: JSON.stringify(sanitizeForUpdate(wf)) });
let active = updated.active;
if(!active){ const a = await api(origin,key,`/api/v1/workflows/${WORKFLOW_ID}/activate`,{method:'POST'}); active = Boolean(a?.active??true); }
console.log(JSON.stringify({ patched:true, active, backupPath, updatedAt: updated.updatedAt }, null, 2));
```

- [ ] **Step 2: DRY run (sem escrever no vivo)**

Run:
```bash
export NVM_DIR="$HOME/.nvm"; . "$NVM_DIR/nvm.sh"
DRY=1 node scripts/n8n/patch-buffer-pending-detail.mjs
```
Expected: imprime `{ dry: true, ... addedNodes: [...3...], ... }` sem erro. Se qualquer `assertEdge` ou o guard de base disparar, corrigir antes de prosseguir. **Nada foi escrito no vivo ainda.**

- [ ] **Step 3: Commit do script (ainda não deployado)**

```bash
git add scripts/n8n/patch-buffer-pending-detail.mjs
git commit -m "feat(n8n): patch cirúrgico do buffer ciente de contexto (pending_detail)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 4: Deploy + re-sync do mirror

**Files:**
- Run: `scripts/n8n/patch-buffer-pending-detail.mjs`, `scripts/n8n/validate-repasse-next-workflow.mjs`, `scripts/n8n/repasse-maint.mjs`

**Interfaces:**
- Consumes: patch da Task 3.
- Produces: workflow vivo atualizado + ativo; mirror local re-sincronizado.

- [ ] **Step 1: Deploy real**

Run:
```bash
export NVM_DIR="$HOME/.nvm"; . "$NVM_DIR/nvm.sh"
node scripts/n8n/patch-buffer-pending-detail.mjs
```
Expected: `{ patched: true, active: true, ... }`. Se `active` vier `false`, o script tenta `/activate`; confirmar `true`.

- [ ] **Step 2: Validar a estrutura do workflow vivo**

Run:
```bash
export NVM_DIR="$HOME/.nvm"; . "$NVM_DIR/nvm.sh"
node scripts/n8n/validate-repasse-next-workflow.mjs
```
Expected: sem erros de estrutura/JS. Se falhar, restaurar do backup impresso na Task 3/4 (`output/n8n/backups/...-before-pending-detail-*.json`) via PUT e revisar.

- [ ] **Step 3: Re-sync do mirror decomposto**

Run:
```bash
export NVM_DIR="$HOME/.nvm"; . "$NVM_DIR/nvm.sh"
node scripts/n8n/repasse-maint.mjs pull
node scripts/n8n/guard-live-workflow-sync.mjs --check
```
Expected: `pull` atualiza `n8n/ia-repasse-pro-v2/` com os 3 nós novos + o `Calcular Wait Buffer` reescrito; `--check` sai 0 (sem drift).

- [ ] **Step 4: Commit do mirror sincronizado**

```bash
git add n8n/ia-repasse-pro-v2/ output/n8n/
git commit -m "chore(n8n): sync mirror após deploy do buffer ciente de contexto

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 5: Smoke live — reproduzir o cenário do bug

**Files:**
- Run: harness de smoke (`scripts/n8n/smoke-step.mjs` / `scripts/n8n/smoke-live-bia2.mjs` — usar o que existir; JID único).

**Interfaces:**
- Consumes: workflow deployado (Task 4).
- Produces: evidência de que `Sim` + `14pm` (gap 20–40s) são processados JUNTOS e a IA NÃO repergunta o modelo.

- [ ] **Step 1: Localizar o harness e a fixture de sandbox**

Run:
```bash
export NVM_DIR="$HOME/.nvm"; . "$NVM_DIR/nvm.sh"
ls scripts/n8n/smoke-*.mjs
node scripts/n8n/smoke-seed-sandbox.mjs   # recria a fixture do lead sandbox, se necessário
```
Expected: lista os scripts de smoke; o seed prepara o lead sandbox (lead_id = telefone só-dígitos).

- [ ] **Step 2: Disparar o turno do opener de entrada e ler a resposta**

Conduzir o lead sandbox até a IA fazer a pergunta de entrada/troca (`classifyBiaQuestion(...) === 'tradein_model'`), usando o harness turn-by-turn (`smoke-step.mjs`) com um JID ÚNICO (o harness faz debounce por JID — JIDs repetidos colidem).

Expected: a IA envia algo como "Você tem algum iPhone pra dar como parte do pagamento? ...". Confirmar no Redis (ou no runData) que `pending_detail:{contact}` foi gravado.

- [ ] **Step 3: Enviar `Sim`, esperar ~25s, enviar `14pm`**

Enviar "Sim"; aguardar ~25s (dentro da janela estendida de 40s, fora da antiga de 15s); enviar "14pm".

Expected: a execução vencedora processa `message_buffered === "Sim\n14pm"` (as duas juntas). Verificar pelo runData do `Montar Body do Simulador` / `Simulador` da execução correta — NÃO confiar só na reply postada (cuidado com a buffer-race de execuções paralelas, ver CLAUDE.md).

- [ ] **Step 4: Confirmar ausência de eco**

Expected: a IA NÃO envia "Qual modelo é o iPhone que você vai dar como entrada?" depois do "14pm". Ela prossegue (avaliação/ simulação da entrada com o 14 Pro Max).

- [ ] **Step 5: Regressão — resposta completa não atrasa**

Em outro JID único, no mesmo opener, responder "14pm" numa única mensagem.

Expected: `replyContainsDetail` ⇒ sem extensão; janela base (15s); a IA responde no tempo normal, sem o atraso de 40s.

- [ ] **Step 6: Registrar evidência**

Anotar (no PR/commit ou numa nota) os execution IDs e o `buffer_wait_reason` observado (`pending_detail_extend:tradein_model` no cenário do bug; `resposta_curta_segura_15s` na regressão).

---

## Self-Review

- **Cobertura do spec:** write no envio (Task 3, 2 nós) ✓; read antes do wait (Task 3, 1 nó + rewrite) ✓; classificador reutilizado com o regex VIVO (Task 1, com teste de consistência) ✓; janela 40s / TTL 90s / 5 classes (Global Constraints + Task 1) ✓; guard de completude (`replyContainsDetail`, Task 1) ✓; protocolo de deploy live (Tasks 2/4) ✓; smoke (Task 5) ✓.
- **Sem placeholders:** todo código presente; comandos exatos.
- **Consistência de tipos:** `decideBufferWait`/`classifyBiaQuestion`/`replyContainsDetail`/`isAffirmative` definidos na Task 1 e consumidos verbatim na Task 3 (bloco embutido). `pending_detail_raw` (propertyName do Get) lido em `Calcular Wait Buffer`. `router.message` (saída dos parse nodes) usado como valor do Set.
- **Risco residual conhecido:** a credencial Redis é reaproveitada de `Redis Set Buffer` (`must('Redis Set Buffer').credentials`); se o nó vivo usar outra estrutura de credencial, o DRY run não pega (só o deploy). Mitigação: o DRY imprime os nós; conferir credentials no backup antes do deploy real. Custo de over-extensão (≤25s extra num "Sim" sem continuação) é aceito e documentado no spec.
