import { readFile } from 'node:fs/promises';
import { createClient } from '@supabase/supabase-js';

// Single-scenario LIVE smoke against the EXISTING sandbox lead/conversation
// (+558899990507). No new lead creation -> no `unique_lead_per_store` conflict.
// Resets lead state, sends a 2-turn flow that tends to make Bia 2 offer colors,
// polls crm_messages for the AI reply, and pulls the latest execution to show the
// `color_guard` telemetry. Validates the live pipeline end-to-end.

const WEBHOOK_PATH = 'repasse';
const LEAD_ID = '+558899990507-st-cae5b9ed-d4e6-405f-9151-1c80542992ec';
const QUIET_MS = 12_000;
const POLL_MS = 5_000;
const TIMEOUT_MS = 180_000;

const TURNS = process.env.SMOKE_TURNS
  ? JSON.parse(process.env.SMOKE_TURNS)
  : [
      'Quero comprar um iPhone 15. Tenho um iPhone 12 128GB azul pra dar de entrada.',
      'Quais as cores que vocês têm do iPhone 15?',
    ];

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

// Reset lead state so the scenario starts fresh.
await supabase.from('crm_leads').update({ summary_short: null, summary_operational: null, last_message_content: null }).eq('id', LEAD_ID);
await supabase.from('lead_state').delete().eq('lead_id', LEAD_ID).then(() => {}, () => {});
await supabase.from('crm_conversations').update({ status: 'ai_handling', ai_enabled: true }).eq('id', conversation.id);

const PHONE_DIGITS = String(lead.phone ?? '').replace(/\D/g, '');
let lastMid = null; let lastMidAt = null; // chained across turns like real inbound

// Mirrors buildCompactAiInboundPayload (supabase/functions/_shared/crm_ai_payload.ts)
// exactly — the canonical `inbound_message` contract the app dispatches to n8n
// (NOT the uazapi-receiver shape). Text message => type "text", mediaType "",
// no raw_inbound, meta.source "crm_inbound_message".
function payload(text /* , idx */) {
  const now = Date.now();
  const providerMessageId = `558591546796:${Math.random().toString(16).slice(2, 6).toUpperCase()}${now.toString(16).toUpperCase()}`;
  const p = {
    event: 'inbound_message',
    instanceName: String(lead.entity_id || 'crm'),
    type: 'text',
    lead_id: PHONE_DIGITS,
    store_id: conversation.store_id || lead.store_id,
    body: {
      sender: chatid,
      message: {
        messageTimestamp: now,
        text,
        senderName: lead.name || 'Cliente',
        messageid: providerMessageId,
        last_messageid: lastMid,
        last_messageid_at: lastMidAt,
        fromMe: false, edited: '', owner: '', chatid, content: text,
      },
      BaseUrl: 'https://crm.internal/inbound-dispatch',
      EventType: 'messages',
      chatid,
      mediaType: '',
    },
    lead: { summary_short: '', instagram_user_id: null, instagram_username: null },
    media: { URL: null, mimetype: null, mediaKey: null },
    meta: {
      source: 'crm_inbound_message',
      conversation_id: conversation.id,
      channel_id: conversation.channel_id,
      message_id: randomUUID(),
      instagram_user_id: null, instagram_username: null,
    },
  };
  lastMid = providerMessageId; lastMidAt = new Date(now).toISOString();
  return p;
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

const results = [];
for (let i = 0; i < TURNS.length; i += 1) {
  const sinceIso = new Date().toISOString();
  const res = await fetch(new URL(`/webhook/${WEBHOOK_PATH}`, ORIGIN), {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload(TURNS[i], i)),
  });
  const dispatch = { status: res.status, ok: res.ok };
  const replies = await waitForReply(sinceIso);
  results.push({ turn: i + 1, customer: TURNS[i], dispatch, ai: replies.map((r) => r.content) });
}

// Pull color_guard telemetry from the most recent execution.
const exId = await (async () => {
  try {
    const r = await fetch(new URL('/api/v1/executions?workflowId=Cr4fPWe0prwS6XjI&limit=1', ORIGIN), { headers: { 'X-N8N-API-KEY': env.N8N_API_KEY } });
    const j = await r.json();
    return j?.data?.[0]?.id ?? null;
  } catch { return null; }
})();
let colorGuard = 'n/a';
if (exId) {
  try {
    const r = await fetch(new URL(`/api/v1/executions/${exId}?includeData=true`, ORIGIN), { headers: { 'X-N8N-API-KEY': env.N8N_API_KEY } });
    const j = await r.json();
    const rd = j?.data?.resultData?.runData ?? {};
    for (const n of ['Code Parse Bia 2 SEM ESTOQUE', 'Code Parse Bia 2 SEM ESTOQUE1']) {
      const cg = rd[n]?.[0]?.data?.main?.[0]?.[0]?.json?.color_guard;
      const ac = rd[n]?.[0]?.data?.main?.[0]?.[0]?.json?.allowed_colors;
      if (cg !== undefined || ac !== undefined) colorGuard = { node: n, color_guard: cg ?? null, allowed_colors: ac ?? null };
    }
  } catch {}
}

console.log(JSON.stringify({ conversation: conversation.id, results, lastExecution: exId, colorGuard }, null, 2));
