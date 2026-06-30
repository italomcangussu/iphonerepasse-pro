import * as kit from "./tool/patch-kit.mjs";
import { readFile } from 'node:fs/promises';

// Adiciona o flag pending_detail (write nos 2 branches Bia + read antes do Wait) e
// reescreve "Calcular Wait Buffer" para estender a janela quando há detalhe pendente.
// Escopo: 3 nós novos + 1 nó reescrito + 3 religações. Sem mexer em winner/lock.
//
// Param-shape dos nós Redis espelha EXATAMENTE o nó vivo "Redis Set Buffer":
//   set: { operation, key, value, expire, ttl }   get: { operation, propertyName, key, options }
//
// Migrado para tool/patch-kit.mjs (Fase 5): I/O único. DRY=1 lê o snapshot.

const TTL_SECONDS = 90;

// ── extrai os corpos de função do bloco puro p/ embutir no nó ──
const blockSrc = await readFile('scripts/n8n/tool/parsers/blocks/buffer_pending_detail.block.js', 'utf8');
const pure = blockSrc
  .replace(/^[\s\S]*?(?=function normalizeReplyText)/, '')   // tira o header de comentário
  .replace(/\nmodule\.exports[\s\S]*$/, '\n');               // no-op se não houver export

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

const wf = await kit.loadWorkflow();

const byName = n => wf.nodes.find(x=>x.name===n);
const must = n => { const x=byName(n); if(!x) throw new Error(`Node não encontrado: ${n}`); return x; };

// Idempotência: se já aplicado, não duplica.
if (byName('Redis Get pending_detail')) {
  console.log(JSON.stringify({ alreadyApplied:true }, null, 2));
  process.exit(0);
}

// 0) Guard: a base de Calcular Wait Buffer precisa ser a dinâmica.
const calc = must('Calcular Wait Buffer');
if (!/isSafeShortReply/.test(calc.parameters?.jsCode||'')) {
  throw new Error('Base de Calcular Wait Buffer não é a dinâmica esperada — abortando (rodar o guard).');
}

const near = (node,dx=0,dy=140) => [ (node.position?.[0]??0)+dx, (node.position?.[1]??0)+dy ];
const redisCred = must('Redis Set Buffer').credentials; // reaproveita a mesma credencial Redis

// 1) WRITE — Redis Set pending_detail (param-shape == Redis Set Buffer)
function makeSetNode(name, anchor){
  return {
    parameters: {
      operation: 'set',
      key: "={{ 'pending_detail:' + $('Code Consolidador Payload Final').item.json.cliente.contact_id }}",
      value: "={{ $json.router && $json.router.message ? $json.router.message : '' }}",
      expire: true,
      ttl: TTL_SECONDS,
    },
    type: 'n8n-nodes-base.redis',
    typeVersion: 1,
    name, credentials: redisCred,
    position: near(anchor, 40, -160),
  };
}
const setBia2 = makeSetNode('Redis Set pending_detail B2', must('CODE MONTAR LINK REPASSE 2'));
const setBia1 = makeSetNode('Redis Set pending_detail B1', must('Code Montar Link Repasse 1'));

// 2) READ — Redis Get pending_detail (param-shape == Redis Get Buffer)
const getPending = {
  parameters: {
    operation: 'get',
    propertyName: 'pending_detail_raw',
    key: "={{ 'pending_detail:' + $json.redis_key }}",
    options: {},
  },
  type: 'n8n-nodes-base.redis', typeVersion: 1,
  name: 'Redis Get pending_detail', credentials: redisCred,
  position: near(calc, -40, -150),
};

wf.nodes.push(setBia2, setBia1, getPending);

// 3) Reescreve Calcular Wait Buffer
calc.parameters = { ...(calc.parameters??{}), jsCode: WAIT_CODE };
kit.assertSyntax(WAIT_CODE, 'Calcular Wait Buffer'); // syntax-assert

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

// ── assert: cada conexão religada confere; conexões antigas removidas ──
function assertEdge(from, to){
  const f = (C[from]?.main?.[0]||[]).some(c=>c.node===to);
  if(!f) throw new Error(`Aresta ausente: ${from} → ${to}`);
}
function assertNoEdge(from, to){
  const f = (C[from]?.main?.[0]||[]).some(c=>c.node===to);
  if(f) throw new Error(`Aresta antiga ainda presente: ${from} → ${to}`);
}
assertEdge('Code Parse Bia 2 SEM ESTOQUE','Redis Set pending_detail B2');
assertNoEdge('Code Parse Bia 2 SEM ESTOQUE','CODE MONTAR LINK REPASSE 2');
assertEdge('Redis Set pending_detail B2','CODE MONTAR LINK REPASSE 2');
assertEdge('Code Parse Bia 1','Redis Set pending_detail B1');
assertNoEdge('Code Parse Bia 1','Code Montar Link Repasse 1');
assertEdge('Redis Set pending_detail B1','Code Montar Link Repasse 1');
assertEdge('Redis Set Buffer','Redis Get pending_detail');
assertNoEdge('Redis Set Buffer','Calcular Wait Buffer');
assertEdge('Redis Get pending_detail','Calcular Wait Buffer');
assertEdge('Redis Set Buffer','Values Set + buffer_obj'); // a outra saída deve continuar

if (process.env.DRY === '1'){
  console.log(JSON.stringify({ dry:true, addedNodes:['Redis Set pending_detail B2','Redis Set pending_detail B1','Redis Get pending_detail'], redisCred, waitCodeHead: WAIT_CODE.slice(0,80) }, null, 2));
  process.exit(0);
}

kit.backup(await kit.getLive(), "pending-detail");
const { activeAfter, finalActive } = await kit.safePut(wf, "pending-detail");
console.log(JSON.stringify({ patched:true, activeAfter, finalActive }, null, 2));
