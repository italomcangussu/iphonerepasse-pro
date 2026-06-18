// smoke-seed-sandbox.mjs — recria a fixture do lead/conversa sandbox usada pelos
// smokes ao vivo (smoke-step.mjs / smoke-live-bia2.mjs). A fixture vive na store
// real "Fortaleza" usando o canal WhatsApp real; o número +558899990507 é o de
// teste. Idempotente: upsert do lead + cria a conversa se não existir.
//   node scripts/n8n/smoke-seed-sandbox.mjs
import { readFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { createClient } from "@supabase/supabase-js";

const STORE = "st-cae5b9ed-d4e6-405f-9151-1c80542992ec"; // Fortaleza
const LEAD_ID = "+558899990507-" + STORE;
const PHONE = "+558899990507";
const CHANNEL_ID = "6ab8e2d9-9173-4635-b894-c9d8b1e8d7e9"; // canal WhatsApp da store
const TALK_ID = "558899990507@s.whatsapp.net";

const env = Object.fromEntries((await readFile(".env.local", "utf8")).split(/\r?\n/)
  .map((l) => l.trim()).filter((l) => l && !l.startsWith("#") && l.includes("="))
  .map((l) => { const i = l.indexOf("="); let v = l.slice(i + 1).trim(); if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1); return [l.slice(0, i).trim(), v]; }));
const sb = createClient(env.VITE_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });

const { error: le } = await sb.from("crm_leads").upsert({
  id: LEAD_ID, store_id: STORE, phone: PHONE,
  name: "Ítalo", first_name: "Ítalo", source: "crm_inbound_message",
}, { onConflict: "id" });
if (le) throw new Error("lead upsert: " + le.message);

let { data: conv } = await sb.from("crm_conversations").select("id").eq("lead_id", LEAD_ID).limit(1);
if (!conv?.length) {
  const { data: ins, error: ce } = await sb.from("crm_conversations").insert({
    id: randomUUID(), store_id: STORE, lead_id: LEAD_ID, channel_id: CHANNEL_ID,
    talk_id: TALK_ID, status: "ai_handling", ai_enabled: true,
  }).select("id").single();
  if (ce) throw new Error("conv insert: " + ce.message);
  conv = [ins];
}
console.log(JSON.stringify({ seeded: true, lead_id: LEAD_ID, conversation: conv[0].id, channel_id: CHANNEL_ID }, null, 2));
