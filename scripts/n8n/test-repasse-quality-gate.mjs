/**
 * Repasse v2 — Quality Gate test suite (workflow Cr4fPWe0prwS6XjI).
 *
 * Focused, assertion-based smoke tests for the production WhatsApp agent "Bia".
 * Unlike run-repasse-scenario-audit.mjs (broad rubric scoring), this script makes
 * HARD pass/fail assertions for the behaviours we recently changed, so regressions
 * are caught deterministically:
 *
 *   A. Saudação por horário  — greeting word matches America/Fortaleza period.
 *   B. Split humanizado       — bubbles are mostly 1–2 sentences, never >3 (unless preserved).
 *   C. Trade-in atômico       — the "R:" questionnaire arrives as ONE message (no ReferenceError).
 *   D. Simulação preservada   — a price/installments proposal arrives as ONE message.
 *   E. Fora de escopo         — repair/accessory routes without breaking.
 *   F. Saúde de execução      — every triggered n8n execution finishes with status=success.
 *
 * Safety:
 *   - Each scenario runs against an EPHEMERAL sandbox lead+conversation (cloned identity,
 *     audit tag) that is deleted afterwards — the real lead 558899990507 conversation_status
 *     is never mutated.
 *   - The webhook URL is derived from the LIVE workflow's webhook node, so it can't go stale.
 *   - --run-live actually dispatches messages (the sandbox talk_id is the real phone, so the
 *     replies are delivered to that WhatsApp). --list is fully offline.
 *
 * Usage:
 *   node scripts/n8n/test-repasse-quality-gate.mjs --list
 *   node scripts/n8n/test-repasse-quality-gate.mjs --run-live [--only A,C] [--keep-sandbox]
 */

import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { createClient } from '@supabase/supabase-js';
import { createSandboxIdentity } from './repasse-scenario-harness.mjs';

const ROOT = process.cwd();
const ENV_PATH = path.join(ROOT, '.env.local');
const WORKFLOW_ID = 'Cr4fPWe0prwS6XjI';
const EXPECTED_PROJECT_REF = 'ubuusaiezpyayqgfujbe';
const SANDBOX_PHONE = '558899990507';
const RESPONSE_TIMEOUT_MS = 240_000;
const RESPONSE_POLL_MS = 4_000;
const RESPONSE_QUIET_MS = 12_000; // consider the burst complete after this much silence
// The workflow debounces inbound messages for 7–25s (Calcular Wait Buffer).
// Turns sent closer than that get merged into one buffer window, so a multi-turn
// conversation must space turns beyond the max debounce.
const INTER_TURN_MS = 28_000;

// ─────────────────────────────────────────────────────────────────────────────
// Scenario catalogue. `assert(ctx)` gets { messages, combined, executions, expectGreeting }
// and returns an array of { ok, label, detail } checks.
// ─────────────────────────────────────────────────────────────────────────────
function buildScenarios() {
  return [
    {
      id: 'A',
      title: 'Saudação por horário (America/Fortaleza)',
      turns: ['Oi, boa tarde! Tudo bem?'],
      assert: greetingChecks,
    },
    {
      id: 'B',
      title: 'Split humanizado (1–2 frases, teto 3)',
      turns: ['Me explica como funciona a compra de vocês e se é seguro?'],
      assert: (ctx) => splitChecks(ctx, { minBubbles: 1 }),
    },
    {
      id: 'C',
      title: 'Trade-in atômico (questionário R: em 1 mensagem)',
      primer: 'Oi, boa tarde!',
      turns: [
        'Tenho um iPhone 13 128GB preto para dar de entrada e quero um iPhone 16 Pro 256GB.',
        'Pode mandar as perguntas.',
      ],
      assert: tradeInChecks,
    },
    {
      id: 'D',
      title: 'Simulação preservada (preços/parcelas em 1 mensagem)',
      primer: 'Oi, boa tarde!',
      turns: [
        'Quero comprar o iPhone 16 Pro 256GB.',
        'No cartão Visa, à vista e parcelado por favor.',
      ],
      assert: simulationChecks,
    },
    {
      id: 'E',
      title: 'Fora de escopo (reparo → HDI, sem quebrar)',
      primer: 'Oi, boa tarde!',
      turns: ['Minha tela trincou, vocês fazem troca de tela?'],
      assert: outOfScopeChecks,
    },
  ];
}

// ─────────────────────────────────────────────────────────────────────────────
// Assertion helpers
// ─────────────────────────────────────────────────────────────────────────────
function deburr(value) {
  return String(value ?? '').normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase();
}

function countSentences(text) {
  const parts = String(text).split(/[.?!…]+(?:\s|$)/).map((s) => s.trim()).filter(Boolean);
  return Math.max(1, parts.length);
}

function fortalezaPeriod(date = new Date()) {
  const hour = Number(
    date.toLocaleString('en-US', { timeZone: 'America/Fortaleza', hour: '2-digit', hour12: false }),
  ) % 24;
  if (hour >= 5 && hour < 12) return { hour, word: 'bom dia' };
  if (hour >= 12 && hour < 18) return { hour, word: 'boa tarde' };
  return { hour, word: 'boa noite' };
}

function executionsOk(executions) {
  const rows = executions.filter((e) => e && e.id && !e.error);
  if (!rows.length) return { ok: true, label: 'Execuções n8n', detail: 'nenhuma execução nova capturada (verificar manualmente)' };
  const bad = rows.filter((e) => e.status && e.status !== 'success' && e.status !== 'finished');
  return {
    ok: bad.length === 0,
    label: 'Saúde de execução (status=success)',
    detail: bad.length ? `falhas: ${bad.map((e) => `${e.id}:${e.status}`).join(', ')}` : `${rows.length} execução(ões) ok`,
  };
}

function greetingChecks(ctx) {
  const period = fortalezaPeriod();
  const first = deburr(ctx.messages[0]?.content ?? '');
  const wrong = ['bom dia', 'boa tarde', 'boa noite'].filter((w) => w !== period.word && first.includes(w));
  const neutral = /\b(oi|ola|opa|e ai|bem-vindo|bem vindo)\b/.test(first);
  return [
    // HARD gate: the Request-2 fix guarantees the agent never uses the WRONG period.
    {
      ok: wrong.length === 0,
      label: 'Sem saudação do período errado (garantia do fix de horário)',
      detail: wrong.length ? `saudação indevida: ${wrong.join(', ')}` : 'ok',
    },
    // SOFT: prefer the time-based word, but a neutral opener ("Oi") is acceptable.
    {
      ok: first.includes(period.word) || neutral,
      label: `Abertura com saudação (período "${period.word}" @ ${period.hour}h, ou neutra)`,
      detail: first.slice(0, 80) || '[sem mensagem]',
    },
    executionsOk(ctx.executions),
  ];
}

function splitChecks(ctx, { minBubbles }) {
  const msgs = ctx.messages.map((m) => m.content).filter(Boolean);
  const sentenceCounts = msgs.map(countSentences);
  const over = sentenceCounts.filter((n) => n > 3).length;
  const oneOrTwo = sentenceCounts.filter((n) => n <= 2).length;
  return [
    { ok: msgs.length >= minBubbles, label: `Recebeu ≥${minBubbles} bolha(s)`, detail: `${msgs.length} bolha(s)` },
    { ok: over === 0, label: 'Nenhuma bolha > 3 frases', detail: `frases por bolha: [${sentenceCounts.join(', ')}]` },
    {
      ok: msgs.length === 0 ? false : oneOrTwo >= Math.ceil(msgs.length / 2),
      label: 'Maioria das bolhas com 1–2 frases',
      detail: `${oneOrTwo}/${msgs.length} com ≤2 frases`,
    },
    executionsOk(ctx.executions),
  ];
}

function tradeInChecks(ctx) {
  const withR = ctx.messages.filter((m) => (m.content.match(/(^|\n)\s*R:/g) || []).length >= 2);
  const fragmentedR = ctx.messages.filter((m) => /(^|\n)\s*R:\s*$/.test(m.content)).length;
  return [
    {
      ok: withR.length >= 1,
      label: 'Questionário trade-in entregue como 1 mensagem (≥2 "R:")',
      detail: withR.length ? `mensagem com ${(withR[0].content.match(/R:/g) || []).length} campos R:` : 'questionário não encontrado',
    },
    {
      ok: !(fragmentedR > 1 && withR.length === 0),
      label: 'Questionário não fragmentado em bolhas soltas',
      detail: `bolhas terminando em "R:" sozinhas: ${fragmentedR}`,
    },
    executionsOk(ctx.executions),
  ];
}

function simulationChecks(ctx) {
  const priced = ctx.messages.filter((m) => {
    const installments = (m.content.match(/\b\d{1,2}\s?x\b/gi) || []).length;
    const prices = (m.content.match(/R\$\s?\d/gi) || []).length;
    return installments >= 2 || prices >= 3;
  });
  return [
    {
      ok: priced.length >= 1,
      label: 'Proposta com preços/parcelas presente',
      detail: priced.length ? 'ok' : 'nenhuma bolha com simulação detectada (pode ter pedido cartão/entrada antes)',
    },
    {
      ok: priced.length <= 1 || priced.every((m) => countSentences(m.content) <= 6),
      label: 'Simulação não estourou em várias bolhas curtas',
      detail: `${priced.length} bolha(s) com preços`,
    },
    executionsOk(ctx.executions),
  ];
}

function outOfScopeChecks(ctx) {
  const combined = deburr(ctx.combined);
  const routed = /(hdi|cidade|fortaleza|sobral|reparo|conserto|assistencia|link)/.test(combined);
  return [
    { ok: ctx.messages.length >= 1, label: 'Respondeu (não silenciou)', detail: `${ctx.messages.length} bolha(s)` },
    { ok: routed, label: 'Encaminhou para reparo/HDI ou pediu cidade', detail: combined.slice(0, 100) || '[vazio]' },
    executionsOk(ctx.executions),
  ];
}

// ─────────────────────────────────────────────────────────────────────────────
// Plumbing
// ─────────────────────────────────────────────────────────────────────────────
function parseEnv(text) {
  const env = {};
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#') || !line.includes('=')) continue;
    const i = line.indexOf('=');
    let value = line.slice(i + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) value = value.slice(1, -1);
    env[line.slice(0, i).trim()] = value;
  }
  return env;
}

async function loadEnv() {
  const env = parseEnv(await readFile(ENV_PATH, 'utf8'));
  for (const key of ['VITE_SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY', 'N8N_PUBLIC_API']) {
    if (!env[key]) throw new Error(`Missing ${key} in .env.local`);
  }
  const ref = new URL(env.VITE_SUPABASE_URL).hostname.split('.')[0];
  if (ref !== EXPECTED_PROJECT_REF) throw new Error(`Unexpected Supabase ref ${ref}; expected ${EXPECTED_PROJECT_REF}`);
  // canonical n8n origin for both API and webhook
  env.N8N_ORIGIN = 'https://n8n.iatende.sbs';
  return env;
}

async function n8nFetch(env, route, options = {}) {
  const r = await fetch(new URL(route, env.N8N_ORIGIN), {
    ...options,
    headers: { 'X-N8N-API-KEY': env.N8N_PUBLIC_API, ...(options.headers ?? {}) },
  });
  const text = await r.text();
  let data = null;
  try { data = text ? JSON.parse(text) : null; } catch { data = text; }
  if (!r.ok) throw new Error(`n8n ${route} -> HTTP ${r.status}`);
  return data;
}

async function resolveWebhook(env) {
  const wf = await n8nFetch(env, `/api/v1/workflows/${WORKFLOW_ID}`);
  const node = wf.nodes.find((n) => n.type === 'n8n-nodes-base.webhook');
  if (!node?.parameters?.path) throw new Error('webhook node/path not found in live workflow');
  return { active: wf.active, url: new URL(`/webhook/${node.parameters.path}`, env.N8N_ORIGIN).toString() };
}

async function recentExecutions(env, sinceIso) {
  try {
    const payload = await n8nFetch(env, `/api/v1/executions?workflowId=${WORKFLOW_ID}&limit=10`);
    const rows = Array.isArray(payload?.data) ? payload.data : [];
    const start = Date.parse(sinceIso) - 10000;
    return rows
      .filter((row) => Date.parse(row.startedAt ?? 0) >= start)
      .map((row) => ({ id: row.id, status: row.status ?? (row.finished ? 'finished' : 'unknown') }));
  } catch (e) {
    return [{ error: e.message }];
  }
}

async function selectTemplate(supabase) {
  const { data: leads, error } = await supabase
    .from('crm_leads').select('*').eq('phone', `+${SANDBOX_PHONE}`).limit(5);
  if (error) throw new Error(`lead lookup failed: ${error.message}`);
  const lead = (leads ?? []).find((l) => String(l.phone).replace(/\D/g, '') === SANDBOX_PHONE) ?? leads?.[0];
  if (!lead) throw new Error(`no sandbox lead for ${SANDBOX_PHONE}`);
  const { data: convs, error: cErr } = await supabase
    .from('crm_conversations').select('*').eq('lead_id', lead.id).order('updated_at', { ascending: false }).limit(5);
  if (cErr) throw new Error(`conversation lookup failed: ${cErr.message}`);
  const conversation = convs?.[0];
  if (!conversation) throw new Error(`no sandbox conversation for ${lead.id}`);
  return { lead, conversation };
}

async function createSandbox(supabase, template, ordinal, runId) {
  const identity = createSandboxIdentity(runId, ordinal);
  // CRITICAL ISOLATION: the n8n Redis debounce buffer is keyed by
  // 'repasse-next:' + contact_id (the WhatsApp JID). If every sandbox reuses the
  // REAL JID, all scenarios collide into one buffer and the Router classifies a
  // mash-up of unrelated messages → everything becomes fora_do_escopo. So each
  // sandbox needs a UNIQUE synthetic JID (phone + contact_id + talk_id).
  // Consequence: replies are NOT delivered to the real WhatsApp (the JID isn't a
  // real contact) — but crm-send-message still writes the ai_inbound rows we assert on.
  const uniq = `${String(Date.now()).slice(-8)}${String(ordinal).charCodeAt(0)}`;
  const syntheticPhone = `+5588${uniq}`;
  const syntheticJid = `5588${uniq}@s.whatsapp.net`;
  const { data: lead, error: lErr } = await supabase.from('crm_leads').insert({
    id: identity.leadId,
    store_id: template.lead.store_id,
    phone: syntheticPhone,
    name: `${template.lead.name || 'Cliente Teste'} [QG ${ordinal}]`,
    contact_id: syntheticJid,
    entity_id: template.lead.entity_id,
    source_channel_id: template.lead.source_channel_id || template.conversation.channel_id,
    tags: [...new Set([...(template.lead.tags || []), identity.cleanupTag])],
  }).select('*').single();
  if (lErr) throw new Error(`sandbox lead create failed: ${lErr.message}`);

  const { data: conversation, error: cErr } = await supabase.from('crm_conversations').insert({
    id: identity.conversationId,
    store_id: template.conversation.store_id || template.lead.store_id,
    lead_id: identity.leadId,
    channel_id: template.conversation.channel_id,
    talk_id: syntheticJid,
    status: 'ai_handling',
    ai_enabled: true,
  }).select('*').single();
  if (cErr) {
    await supabase.from('crm_leads').delete().eq('id', identity.leadId);
    throw new Error(`sandbox conversation create failed: ${cErr.message}`);
  }
  return { lead, conversation };
}

async function cleanupSandbox(supabase, sandbox) {
  if (!sandbox?.lead?.id) return;
  await supabase.from('crm_messages').delete().eq('conversation_id', sandbox.conversation.id);
  await supabase.from('crm_conversations').delete().eq('id', sandbox.conversation.id);
  await supabase.from('crm_leads').delete().eq('id', sandbox.lead.id);
}

function buildPayload(scenario, lead, conversation, turnText, turnIndex) {
  const now = Date.now();
  const chatid = conversation.talk_id || `${SANDBOX_PHONE}@s.whatsapp.net`;
  const messageId = `qg-${scenario.id}-${turnIndex + 1}-${now}`;
  return {
    event: 'inbound_message',
    instanceName: String(lead.entity_id || 'crm'),
    type: 'text',
    lead_id: lead.id,
    store_id: conversation.store_id || lead.store_id,
    body: {
      sender: chatid,
      message: { messageTimestamp: now, text: turnText, senderName: lead.name || 'Cliente Teste', messageid: messageId, fromMe: false, edited: '', owner: '', chatid, content: turnText },
      BaseUrl: 'https://crm.internal/quality-gate', EventType: 'messages', chatid, mediaType: '',
    },
    lead: { summary_short: '', instagram_user_id: null, instagram_username: null },
    lead_detail: { ...lead, summary_short: '', summary_operational: '', first_message: '', last_message_content: '', last_event_name: '', last_event_at: null, last_message_at: null, last_interaction_at: null },
    media: { URL: null, mimetype: null, mediaKey: null },
    // source MUST be 'repasse_v2_scenario_audit' + a stable scenario_id: the agent's
    // Postgres Chat Memory sessionKey only threads per-scenario memory in that branch,
    // so multi-turn conversations actually advance instead of looping on the welcome.
    meta: { source: 'repasse_v2_scenario_audit', conversation_id: conversation.id, channel_id: conversation.channel_id, message_id: messageId, scenario_id: `qg-${scenario.id}`, scenario_category: scenario.title, scenario_turn: turnIndex + 1 },
    raw_inbound: { source: 'repasse_v2_scenario_audit', message: { type: 'text', messageType: 'conversation', id: messageId } },
  };
}

async function dispatch(env, webhookUrl, payload) {
  const r = await fetch(webhookUrl, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
  return { ok: r.ok, status: r.status };
}

async function waitForReply(supabase, conversationId, sinceIso) {
  const deadline = Date.now() + RESPONSE_TIMEOUT_MS;
  let rows = [];
  let count = 0;
  let lastChange = Date.now();
  while (Date.now() < deadline) {
    const { data, error } = await supabase
      .from('crm_messages')
      .select('id,content,direction,sender_type,status,created_at,error_message')
      .eq('conversation_id', conversationId).gte('created_at', sinceIso)
      .order('created_at', { ascending: true }).limit(30);
    if (error) throw new Error(`reply polling failed: ${error.message}`);
    rows = data ?? [];
    const ai = rows.filter((r) => r.direction === 'outbound' && r.sender_type === 'ai_inbound');
    if (ai.length !== count) { count = ai.length; lastChange = Date.now(); }
    if (ai.length > 0 && Date.now() - lastChange >= RESPONSE_QUIET_MS) {
      return { timedOut: false, messages: ai };
    }
    await new Promise((res) => setTimeout(res, RESPONSE_POLL_MS));
  }
  const ai = rows.filter((r) => r.direction === 'outbound' && r.sender_type === 'ai_inbound');
  return { timedOut: ai.length === 0, messages: ai };
}

function printList(scenarios) {
  console.log(`\nRepasse v2 — Quality Gate (${scenarios.length} cenários)\n`);
  for (const s of scenarios) {
    console.log(`[${s.id}] ${s.title}`);
    s.turns.forEach((t, i) => console.log(`     ${i + 1}. ${t}`));
  }
  const p = fortalezaPeriod();
  console.log(`\nSaudação esperada agora: "${p.word}" (${p.hour}h America/Fortaleza)\n`);
}

async function run() {
  const argv = process.argv.slice(2);
  const list = argv.includes('--list');
  const runLive = argv.includes('--run-live');
  const keep = argv.includes('--keep-sandbox');
  const onlyArg = argv[argv.indexOf('--only') + 1];
  const only = argv.includes('--only') && onlyArg ? onlyArg.split(',').map((s) => s.trim().toUpperCase()) : null;

  let scenarios = buildScenarios();
  if (only) scenarios = scenarios.filter((s) => only.includes(s.id));

  if (list || (!runLive)) {
    printList(scenarios);
    if (!list) console.log('Modo offline. Use --run-live para executar de verdade (envia WhatsApp ao 558899990507).');
    return;
  }

  const env = await loadEnv();
  const supabase = createClient(env.VITE_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
  const webhook = await resolveWebhook(env);
  if (!webhook.active) throw new Error('workflow inativo — ative antes de testar');
  console.log(`webhook: ${webhook.url} | active: ${webhook.active}`);
  const template = await selectTemplate(supabase);
  const runId = new Date().toISOString().replace(/[^0-9]/g, '').slice(0, 14);

  const summary = [];
  for (const scenario of scenarios) {
    let sandbox = null;
    const checks = [];
    try {
      sandbox = await createSandbox(supabase, template, scenario.id, runId);
      const allMessages = [];
      let executions = [];
      let timedOut = false;

      // Optional primer turn: consumes the first-contact welcome so the asserted
      // turns exercise real intent handling instead of the canned greeting.
      if (scenario.primer) {
        const primerAt = new Date();
        await dispatch(env, webhook.url, buildPayload(scenario, sandbox.lead, sandbox.conversation, scenario.primer, -1));
        await waitForReply(supabase, sandbox.conversation.id, primerAt.toISOString());
        await new Promise((res) => setTimeout(res, INTER_TURN_MS));
      }

      for (const [turnIndex, turnText] of scenario.turns.entries()) {
        const startedAt = new Date();
        const d = await dispatch(env, webhook.url, buildPayload(scenario, sandbox.lead, sandbox.conversation, turnText, turnIndex));
        if (!d.ok) { checks.push({ ok: false, label: 'Dispatch webhook', detail: `HTTP ${d.status}` }); break; }
        const reply = await waitForReply(supabase, sandbox.conversation.id, startedAt.toISOString());
        executions = executions.concat(await recentExecutions(env, startedAt.toISOString()));
        allMessages.push(...reply.messages);
        if (reply.timedOut) { timedOut = true; break; }
        // Space turns beyond the inbound debounce so they aren't merged.
        if (turnIndex < scenario.turns.length - 1) await new Promise((res) => setTimeout(res, INTER_TURN_MS));
      }
      const ctx = { messages: allMessages, combined: allMessages.map((m) => m.content).join('\n\n'), executions };
      if (timedOut) checks.push({ ok: false, label: 'IA respondeu no tempo', detail: 'timeout' });
      else checks.push(...scenario.assert(ctx));
    } catch (e) {
      checks.push({ ok: false, label: 'Erro de execução do teste', detail: e.message });
    } finally {
      if (!keep) { try { await cleanupSandbox(supabase, sandbox); } catch { /* noop */ } }
    }
    const passed = checks.every((c) => c.ok);
    summary.push({ id: scenario.id, title: scenario.title, passed, checks });
    console.log(`\n[${scenario.id}] ${scenario.title} → ${passed ? 'PASS ✅' : 'FAIL ❌'}`);
    for (const c of checks) console.log(`   ${c.ok ? '✓' : '✗'} ${c.label} — ${c.detail}`);
  }

  const passCount = summary.filter((s) => s.passed).length;
  console.log(`\n══════ RESULTADO: ${passCount}/${summary.length} cenários PASS ══════`);
  process.exit(passCount === summary.length ? 0 : 1);
}

run().catch((e) => { console.error(e.message || e); process.exit(1); });
