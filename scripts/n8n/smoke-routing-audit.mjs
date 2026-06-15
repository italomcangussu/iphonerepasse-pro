import { readFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';

// Turn-by-turn LIVE driver for the existing sandbox lead (+558899990507) that,
// after each turn, audits the `Code Routing Flags` node output (routing_decision
// + should* flags + context_ready/missing_fields/shouldSimulateNow) for every
// execution that fired in the turn window, and reports which Bia/Simulator nodes
// ran. Adaptive scenarios: run once per turn with MSG=...; RESET=1 on turn 1.
//   RESET=1 MSG="..." node scripts/n8n/smoke-routing-audit.mjs
//   MSG="..." node scripts/n8n/smoke-routing-audit.mjs

const WEBHOOK_PATH = 'repasse';
const WORKFLOW_ID = 'Cr4fPWe0prwS6XjI';
const LEAD_ID = '+558899990507-st-cae5b9ed-d4e6-405f-9151-1c80542992ec';
const QUIET_MS = 12_000;
const POLL_MS = 5_000;
const TIMEOUT_MS = 180_000;

const MSG = process.env.MSG;
if (!MSG) throw new Error('set MSG="..."');
const RESET = process.env.RESET === '1';

function parseEnv(t) {
  return Object.fromEntries(t.split(/\r?\n/).map((l) => l.trim())
    .filter((l) => l && !l.startsWith('#') && l.includes('='))
    .map((l) => { const i = l.indexOf('='); let v = l.slice(i + 1).trim(); if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1); return [l.slice(0, i).trim(), v]; }));
}
const env = parseEnv(await readFile('.env.local', 'utf8'));
const ORIGIN = new URL(env.N8N_BASE_URL).origin;
const supabase = createClient(env.VITE_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });

const { data: lead, error: le } = await supabase.from('crm_leads').select('*').eq('id', LEAD_ID).single();
if (le) throw new Error(`lead load: ${le.message}`);
const { data: convs, error: ce } = await supabase.from('crm_conversations').select('*').eq('lead_id', LEAD_ID).order('created_at', { ascending: false }).limit(1);
if (ce) throw new Error(`conv load: ${ce.message}`);
const conversation = convs?.[0];
if (!conversation) throw new Error('no conversation for sandbox lead');
const chatid = conversation.talk_id || '558899990507@s.whatsapp.net';

if (RESET) {
  await supabase.from('crm_leads').update({ summary_short: null, summary_operational: null, last_message_content: null }).eq('id', LEAD_ID);
  await supabase.from('lead_state').delete().eq('lead_id', LEAD_ID).then(() => {}, () => {});
  await supabase.from('crm_conversations').update({ status: 'ai_handling', ai_enabled: true }).eq('id', conversation.id);
}

const PHONE_DIGITS = String(lead.phone ?? '').replace(/\D/g, '');

function payload(text) {
  const now = Date.now();
  // messageid MUST be unique per message — the buffer (Redis) is keyed by it; a
  // missing/duplicate id => empty message_buffered. The live `Formatar Payload
  // CRM2` reads lead_id from `lead_detail.id` (constant per lead) and the final
  // messageid from `raw_inbound.message.messageid` (overrides body.message.messageid).
  const providerMessageId = `558591546796:${randomUUID().replace(/-/g, '').slice(0, 12).toUpperCase()}`;
  return {
    event: 'inbound_message',
    instanceName: String(lead.entity_id || 'crm'),
    type: 'text',
    lead_id: PHONE_DIGITS,
    store_id: conversation.store_id || lead.store_id,
    // id -> lead_id (digits phone, same per lead).
    lead_detail: { id: PHONE_DIGITS, contact_id: chatid },
    // messageid -> body.message.messageid (unique per message); id is the lead fallback.
    raw_inbound: { message: { id: PHONE_DIGITS, messageid: providerMessageId, type: 'text', text } },
    body: {
      sender: chatid,
      message: { messageTimestamp: now, text, senderName: lead.name || 'Cliente', messageid: providerMessageId, last_messageid: null, last_messageid_at: null, fromMe: false, edited: '', owner: '', chatid, content: text },
      BaseUrl: 'https://crm.internal/inbound-dispatch', EventType: 'messages', chatid, mediaType: '',
    },
    lead: { summary_short: '', instagram_user_id: null, instagram_username: null },
    media: { URL: null, mimetype: null, mediaKey: null },
    meta: { source: 'crm_inbound_message', conversation_id: conversation.id, channel_id: conversation.channel_id, message_id: randomUUID(), instagram_user_id: null, instagram_username: null },
  };
}

async function waitForReply(sinceIso) {
  const start = Date.now();
  let lastChange = Date.now();
  let seen = [];
  while (Date.now() - start < TIMEOUT_MS) {
    const { data } = await supabase.from('crm_messages').select('id,content,sender_type,created_at')
      .eq('conversation_id', conversation.id).gt('created_at', sinceIso).order('created_at', { ascending: true });
    const ai = (data ?? []).filter((m) => m.sender_type === 'ai_inbound' || m.sender_type === 'ai');
    if (ai.length !== seen.length) { seen = ai; lastChange = Date.now(); }
    if (ai.length > 0 && Date.now() - lastChange >= QUIET_MS) break;
    await new Promise((r) => setTimeout(r, POLL_MS));
  }
  return seen;
}

const BIA_NODES = ['Bia 1', 'Bia 2 ESTOQUE', 'Bia 2 SEM ESTOQUE ', 'Code Parse Re-simulacao Bia 2 ESTOQUE', 'Montar Body do Simulador', 'Simulador', 'CRM Inventory Search', 'CRM Inventory Precheck', 'Code in JavaScript'];
const FLAG_KEYS = ['routing_decision', 'shouldSearchInventory', 'shouldUseBia1', 'shouldUseBia2NoStock', 'shouldUseBia2Continuation', 'shouldStopAsSpam', 'shouldSendOperationalHandoff', 'shouldPrecheckInventory', 'shouldSimulateNow', 'context_ready', 'missing_fields', 'next_best_action'];

async function auditExecutionsSince(startMs) {
  const r = await fetch(new URL(`/api/v1/executions?workflowId=${WORKFLOW_ID}&limit=20`, ORIGIN), { headers: { 'X-N8N-API-KEY': env.N8N_API_KEY } });
  const j = await r.json();
  const execs = (j?.data ?? []).filter((e) => new Date(e.startedAt ?? e.createdAt).getTime() >= startMs - 2000);
  const audits = [];
  for (const e of execs.reverse()) {
    const rr = await fetch(new URL(`/api/v1/executions/${e.id}?includeData=true`, ORIGIN), { headers: { 'X-N8N-API-KEY': env.N8N_API_KEY } });
    const jj = await rr.json();
    const rd = jj?.data?.resultData?.runData ?? {};
    const crf = rd['Code Routing Flags']?.[0]?.data?.main?.[0]?.[0]?.json;
    const flags = crf ? Object.fromEntries(FLAG_KEYS.map((k) => [k, crf[k]])) : null;
    const ranNodes = BIA_NODES.filter((n) => rd[n]);
    const simRuns = (rd['Simulador'] || rd['Montar Body do Simulador']) ? (rd['Montar Body do Simulador']?.length ?? rd['Simulador']?.length ?? 0) : 0;
    audits.push({ exec: e.id, crfRan: !!crf, flags, ranNodes, lastNode: jj?.data?.resultData?.lastNodeExecuted, simRuns });
  }
  return audits;
}

const startMs = Date.now();
const sinceIso = new Date().toISOString();
const res = await fetch(new URL(`/webhook/${WEBHOOK_PATH}`, ORIGIN), { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload(MSG)) });
const dispatch = { status: res.status, ok: res.ok };
const replies = await waitForReply(sinceIso);
const audit = await auditExecutionsSince(startMs);

console.log(JSON.stringify({ reset: RESET, customer: MSG, dispatch, ai: replies.map((r) => r.content), routingAudit: audit }, null, 2));
