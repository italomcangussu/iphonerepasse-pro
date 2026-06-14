import { readFile } from 'node:fs/promises';

// Canary monitor for the Fase 2 continuation flip. Pulls recent executions and
// reports: overall status mix, and specifically the health of the NEW path
// (executions where "Code Normalize Continuation" ran -> unified Bia 2 ESTOQUE).
// Flags errors and shows the AI reply + whether the color guard fired.
// Usage: node scripts/n8n/canary-fase2-flip.mjs [limit] [sinceISO]

const WORKFLOW_ID = 'Cr4fPWe0prwS6XjI';
const LIMIT = Number(process.argv[2] || 30);
const SINCE = process.argv[3] ? new Date(process.argv[3]).getTime() : 0;

function parseEnv(t) {
  return Object.fromEntries(t.split(/\r?\n/).map((l) => l.trim())
    .filter((l) => l && !l.startsWith('#') && l.includes('='))
    .map((l) => { const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim()]; }));
}
const env = parseEnv(await readFile('.env.local', 'utf8'));
const ORIGIN = new URL(env.N8N_BASE_URL).origin;
const api = (p) => fetch(new URL(p, ORIGIN), { headers: { 'X-N8N-API-KEY': env.N8N_API_KEY } });

const list = await (await api(`/api/v1/executions?workflowId=${WORKFLOW_ID}&limit=${LIMIT}&includeData=false`)).json();
const summary = { scanned: 0, statusMix: {}, newPath: { total: 0, success: 0, error: 0, rows: [] } };

for (const meta of list.data) {
  const started = new Date(meta.startedAt || meta.createdAt).getTime();
  if (SINCE && started < SINCE) continue;
  summary.scanned += 1;
  summary.statusMix[meta.status] = (summary.statusMix[meta.status] || 0) + 1;

  const exec = await (await api(`/api/v1/executions/${meta.id}?includeData=true`)).json();
  const rd = exec?.data?.resultData?.runData ?? {};
  if (!('Code Normalize Continuation' in rd)) continue; // not the new path
  summary.newPath.total += 1;
  if (meta.status === 'success') summary.newPath.success += 1; else summary.newPath.error += 1;

  // pull Bia 2 reply + guard telemetry
  let reply = null; let guard = null;
  for (const n of ['Code Parse Bia 2 SEM ESTOQUE', 'Code Parse Bia 2 SEM ESTOQUE1']) {
    const j = rd[n]?.[0]?.data?.main?.[0]?.[0]?.json;
    if (j?.router?.message) reply = j.router.message.slice(0, 120);
    if (j?.color_guard) guard = j.color_guard;
  }
  summary.newPath.rows.push({
    exec: meta.id, status: meta.status, error: exec?.data?.resultData?.error?.message ?? null,
    reply, colorGuardTriggered: guard ? true : false,
  });
}

console.log(JSON.stringify(summary, null, 2));
