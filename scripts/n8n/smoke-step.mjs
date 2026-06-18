import { readFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';

// Stateful, turn-by-turn LIVE driver for the sandbox lead (+558899990507).
// Unlike smoke-live-bia2.mjs (which resets + replays a static list), this lets the
// operator drive ONE message at a time so the test user can answer what the AI
// actually asked. State (lead_state, crm_messages) is preserved BETWEEN `say`
// calls; only `reset` clears it.
//
//   node scripts/n8n/smoke-step.mjs reset
//   node scripts/n8n/smoke-step.mjs say "Oi, vocês têm tabela dos iPhones?"
//
// After each `say` it prints the AI reply AND routing diagnostics from the latest
// execution (which Bia ran, route/decision, whether the Simulador fired).

const WEBHOOK_PATH = 'repasse';
const LEAD_ID = '+558899990507-st-cae5b9ed-d4e6-405f-9151-1c80542992ec';
const QUIET_MS = 12_000;
const POLL_MS = 4_000;
const TIMEOUT_MS = 180_000;

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
const PHONE_DIGITS = String(lead.phone ?? '').replace(/\D/g, '');

const cmd = process.argv[2];
const arg = process.argv[3];

if (cmd === 'reset') {
  await supabase.from('crm_leads').update({ summary_short: null, summary_operational: null, last_message_content: null }).eq('id', LEAD_ID);
  await supabase.from('lead_state').delete().eq('lead_id', LEAD_ID).then(() => {}, () => {});
  await supabase.from('crm_conversations').update({ status: 'ai_handling', ai_enabled: true }).eq('id', conversation.id);
  // optional: clear message history for a clean transcript
  if (process.env.WIPE_MSGS === '1') {
    await supabase.from('crm_messages').delete().eq('conversation_id', conversation.id).then(() => {}, () => {});
  }
  console.log(JSON.stringify({ reset: true, conversation: conversation.id, wipedMessages: process.env.WIPE_MSGS === '1' }, null, 2));
  process.exit(0);
}

if (cmd !== 'say' || !arg) {
  console.error('usage: smoke-step.mjs reset | say "<message>"');
  process.exit(1);
}

// chain last message id from prior AI/user messages so n8n debounce behaves
function payload(text) {
  const now = Date.now();
  const providerMessageId = `558591546796:${Math.random().toString(16).slice(2, 6).toUpperCase()}${now.toString(16).toUpperCase()}`;
  return {
    event: 'inbound_message', instanceName: String(lead.entity_id || 'crm'), type: 'text',
    lead_id: PHONE_DIGITS, store_id: conversation.store_id || lead.store_id,
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
  const start = Date.now(); let lastChange = Date.now(); let seen = [];
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

async function diagnostics(sinceIso) {
  // pull last few executions; keep only those that started during/after this turn
  const list = await (await fetch(new URL('/api/v1/executions?workflowId=Cr4fPWe0prwS6XjI&limit=8', ORIGIN), { headers: { 'X-N8N-API-KEY': env.N8N_API_KEY } })).json();
  const out = [];
  const cutoff = new Date(sinceIso).getTime() - 3000;
  for (const e of (list?.data ?? [])) {
    if (e.stoppedAt && new Date(e.stoppedAt).getTime() < cutoff) continue;
    const full = await (await fetch(new URL(`/api/v1/executions/${e.id}?includeData=true`, ORIGIN), { headers: { 'X-N8N-API-KEY': env.N8N_API_KEY } })).json();
    const rd = full?.data?.resultData?.runData ?? {};
    const ran = (n) => Boolean(rd[n]);
    const biaRan = ['Bia 1', 'Bia 2 ESTOQUE', 'Bia 2 SEM ESTOQUE '].filter(ran);
    const flags = rd['Code Routing Flags']?.[0]?.data?.main?.[0]?.[0]?.json ?? null;
    const invSearch = rd['CRM Inventory Search']?.[0]?.data?.main?.[0] ?? null;
    const invPre = rd['CRM Inventory Precheck']?.[0]?.data?.main?.[0] ?? null;
    const errs = full?.data?.resultData?.error ? [full.data.resultData.error.message] : [];
    out.push({
      id: e.id, status: e.status, stoppedAt: e.stoppedAt,
      biaRan, simuladorRan: ran('Simulador'), montarBodyRan: ran('Montar Body do Simulador'),
      route: flags?.route, routing_decision: flags?.routing_decision,
      shouldSimulateNow: flags?.shouldSimulateNow, useBia1: flags?.useBia1 ?? flags?.shouldUseBia1,
      desired_model: flags?.desired_model ?? flags?.memory?.desired_model,
      inventorySearchCount: Array.isArray(invSearch) ? invSearch.length : null,
      inventoryPrecheckCount: Array.isArray(invPre) ? invPre.length : null,
      errors: errs,
    });
  }
  return out;
}

const sinceIso = new Date().toISOString();
const res = await fetch(new URL(`/webhook/${WEBHOOK_PATH}`, ORIGIN), {
  method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload(arg)),
});
const replies = await waitForReply(sinceIso);
const diag = await diagnostics(sinceIso);
console.log(JSON.stringify({ customer: arg, dispatch: { status: res.status }, ai: replies.map((r) => r.content), executions: diag }, null, 2));
