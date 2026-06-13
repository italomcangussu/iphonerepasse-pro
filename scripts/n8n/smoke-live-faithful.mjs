import { readFile } from 'node:fs/promises';
import { createClient } from '@supabase/supabase-js';
import { randomUUID } from 'node:crypto';

// FAITHFUL live smoke: replays the REAL uazapi webhook payload shape (fetched from a
// recent real execution: meta.source="crm_inbound_message", type="media",
// full raw_inbound, last_messageid, nested mediaType) and only substitutes the
// message text + unique ids/timestamps. Avoids false positives/negatives from a
// hand-built divergent payload. Reuses the existing sandbox lead/conversation.
//
//   SMOKE_TURNS='["msg1","msg2"]' node scripts/n8n/smoke-live-faithful.mjs

const WEBHOOK_PATH = 'repasse';
const LEAD_ID = '+558899990507-st-cae5b9ed-d4e6-405f-9151-1c80542992ec';
const QUIET_MS = 12_000; const POLL_MS = 5_000; const TIMEOUT_MS = 180_000;
const TURNS = process.env.SMOKE_TURNS ? JSON.parse(process.env.SMOKE_TURNS)
  : ['Tô querendo um 16 pro max que esteja em boas condições. Aceita iPhone na troca?'];

function parseEnv(t) {
  return Object.fromEntries(t.split(/\r?\n/).map((l) => l.trim())
    .filter((l) => l && !l.startsWith('#') && l.includes('='))
    .map((l) => { const i = l.indexOf('='); let v = l.slice(i + 1).trim(); if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1); return [l.slice(0, i).trim(), v]; }));
}
const env = parseEnv(await readFile('.env.local', 'utf8'));
const ORIGIN = new URL(env.N8N_BASE_URL).origin;
const supabase = createClient(env.VITE_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const napi = (p) => fetch(new URL(p, ORIGIN), { headers: { 'X-N8N-API-KEY': env.N8N_API_KEY } });

// 1) Fetch a real-traffic webhook body as template (source=crm_inbound_message, text).
async function fetchRealTemplate() {
  const list = await (await napi('/api/v1/executions?workflowId=Cr4fPWe0prwS6XjI&limit=40&includeData=false')).json();
  for (const meta of list.data) {
    const exec = await (await napi(`/api/v1/executions/${meta.id}?includeData=true`)).json();
    const body = exec?.data?.resultData?.runData?.Webhook?.[0]?.data?.main?.[0]?.[0]?.json?.body;
    if (body?.meta?.source === 'crm_inbound_message' && body?.body?.message?.text && body?.raw_inbound?.chat) {
      return { body, execId: meta.id };
    }
  }
  throw new Error('no real crm_inbound_message text template found in recent executions');
}
const tpl = await fetchRealTemplate();
console.error(`template from real exec ${tpl.execId}`);

const { data: lead } = await supabase.from('crm_leads').select('*').eq('id', LEAD_ID).single();
const { data: convs } = await supabase.from('crm_conversations').select('*').eq('lead_id', LEAD_ID).order('created_at', { ascending: false }).limit(1);
const conversation = convs[0];

// reset lead state (correct table) for a fresh scenario
await supabase.from('crm_leads').update({ summary_short: null, summary_operational: null, last_message_content: null }).eq('id', LEAD_ID);
await supabase.from('lead_state').delete().eq('lead_id', LEAD_ID).then(() => {}, () => {});

function buildFromTemplate(text) {
  const b = JSON.parse(JSON.stringify(tpl.body)); // deep clone real shape
  const now = Date.now();
  const wid = `${Math.random().toString(16).slice(2, 6).toUpperCase()}${now.toString(16).toUpperCase()}`;
  // substitute only the message content + unique ids/timestamps; keep everything else real
  b.body.message.text = text; b.body.message.content = text;
  b.body.message.messageTimestamp = now; b.body.message.messageid = `558591546796:${wid}`;
  if (b.raw_inbound?.message) {
    b.raw_inbound.message.text = text;
    if (b.raw_inbound.message.content) b.raw_inbound.message.content = { ...(b.raw_inbound.message.content), text };
    b.raw_inbound.message.id = `558591546796:${wid}`;
    b.raw_inbound.message.messageid = wid;
    b.raw_inbound.message.messageTimestamp = now;
  }
  if (b.meta) b.meta.message_id = randomUUID();
  return b;
}

async function waitForReply(sinceIso) {
  const start = Date.now(); let lastChange = Date.now(); let seen = [];
  while (Date.now() - start < TIMEOUT_MS) {
    const { data } = await supabase.from('crm_messages').select('content,sender_type,created_at')
      .eq('conversation_id', conversation.id).gt('created_at', sinceIso).order('created_at', { ascending: true });
    const ai = (data ?? []).filter((m) => m.sender_type === 'ai_inbound' || m.sender_type === 'ai');
    if (ai.length !== seen.length) { seen = ai; lastChange = Date.now(); }
    if (ai.length > 0 && Date.now() - lastChange >= QUIET_MS) break;
    await new Promise((r) => setTimeout(r, POLL_MS));
  }
  return seen.map((r) => r.content);
}

const results = [];
for (let i = 0; i < TURNS.length; i += 1) {
  const sinceIso = new Date().toISOString();
  const res = await fetch(new URL(`/webhook/${WEBHOOK_PATH}`, ORIGIN), {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(buildFromTemplate(TURNS[i])),
  });
  const ai = await waitForReply(sinceIso);
  results.push({ turn: i + 1, customer: TURNS[i], dispatch: res.status, ai });
}

// pull desired_model + agent + phrasing from the last execution
const last = (await (await napi('/api/v1/executions?workflowId=Cr4fPWe0prwS6XjI&limit=1&includeData=false')).json())?.data?.[0]?.id;
let diag = {};
if (last) {
  const ex = await (await napi(`/api/v1/executions/${last}?includeData=true`)).json();
  const rd = ex?.data?.resultData?.runData ?? {};
  const pm = rd['Parse Memory']?.[0]?.data?.main?.[0]?.[0]?.json;
  diag = {
    execId: last, status: ex?.data?.resultData?.status ?? ex?.status,
    desired_model: pm?.desired_model ?? null, routing_decision: pm?.routing_decision ?? null,
    ranBia1: 'Bia 1' in rd, ranPrecheck: 'CRM Inventory Precheck' in rd,
    ranBia2: 'Bia 2 ESTOQUE' in rd, ranNormalize: 'Code Normalize Continuation' in rd,
  };
}
console.log(JSON.stringify({ templateExec: tpl.execId, results, diag }, null, 2));
