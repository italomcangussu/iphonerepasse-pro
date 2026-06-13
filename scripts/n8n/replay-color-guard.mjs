import { readFile } from 'node:fs/promises';
import { buildAllowedColors, enforceAllowedColors, detectColors } from './repasse-commerce-context.mjs';

// Regression replay: pull recent executions, extract each Bia 2 agent reply + the
// real inventory context of that turn, and run the guard. Flags potential
// FALSE POSITIVES (guard would have altered a message whose offered colors were
// actually stock-backed) and TRUE CATCHES (hallucinated colors with no stock).

const WORKFLOW_ID = 'Cr4fPWe0prwS6XjI';
const LIMIT = Number(process.argv[2] || 25);

function parseEnv(text) {
  return Object.fromEntries(text.split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith('#') && l.includes('='))
    .map((l) => { const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim()]; }));
}
const env = parseEnv(await readFile('.env.local', 'utf8'));
const KEY = env.N8N_API_KEY;
const ORIGIN = new URL(env.N8N_BASE_URL).origin;
const api = (p) => fetch(new URL(p, ORIGIN), { headers: { 'X-N8N-API-KEY': KEY } });

function parseAgentMessage(rd, nodeName) {
  const runs = rd?.[nodeName];
  if (!Array.isArray(runs) || !runs.length) return null;
  const out = runs[0]?.data?.main?.[0]?.[0]?.json?.output;
  if (typeof out !== 'string') return null;
  let raw = out.trim().replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/```$/i, '').trim();
  try { const obj = JSON.parse(raw); return typeof obj.message === 'string' ? obj.message : null; }
  catch { return null; }
}

function pick(rd, nodeName) {
  try { return rd?.[nodeName]?.[0]?.data?.main?.[0]?.[0]?.json ?? null; } catch { return null; }
}

const list = await (await api(`/api/v1/executions?workflowId=${WORKFLOW_ID}&limit=${LIMIT}&includeData=false`)).json();
const summary = { total: 0, withMessage: 0, triggered: 0, falsePositiveSuspects: 0, trueCatches: 0, rows: [] };

for (const meta of list.data) {
  const exec = await (await api(`/api/v1/executions/${meta.id}?includeData=true`)).json();
  const rd = exec?.data?.resultData?.runData;
  if (!rd) continue;
  summary.total += 1;

  // both Bia 2 agents
  for (const agent of ['Bia 2 ESTOQUE', 'Bia 2 SEM ESTOQUE ']) {
    const message = parseAgentMessage(rd, agent);
    if (!message) continue;
    summary.withMessage += 1;

    const node13 = pick(rd, 'Node13-Code Filtrar Resultados Estoque');
    const ef5 = pick(rd, 'Edit Fields5');
    const ef13 = pick(rd, 'Edit Fields13');
    const inventory = node13?.inventory ?? {};
    const last = ef5?.last_inventory_context ?? ef13?.last_inventory_context
      ?? ef5?.memory?.last_inventory_context ?? {};
    const allowed = buildAllowedColors({ inventory, last_inventory_context: last });
    // customer-echo colors (mirror live guard): message_buffered + state colors
    const buf = ef5?.message_buffered ?? ef13?.message_buffered ?? ef5?.buffer?.message_buffered ?? '';
    const stateColors = [ef5, ef13].flatMap((j) => j ? ['desired_color', 'tradein_color', 'secondary_color_simulation']
      .map((f) => (j[f] ?? j.memory?.[f])).filter((v) => typeof v === 'string' && v.trim()) : []);
    const customerColors = [...detectColors(buf), ...stateColors];
    const guard = enforceAllowedColors(message, allowed, customerColors);

    if (guard.triggered) {
      summary.triggered += 1;
      // false-positive suspect: stock was present (allowed non-empty) yet guard fired
      const suspect = allowed.length > 0;
      if (suspect) summary.falsePositiveSuspects += 1; else summary.trueCatches += 1;
      summary.rows.push({
        exec: meta.id, agent: agent.trim(), allowed, violations: guard.violations,
        kind: suspect ? 'FALSE_POSITIVE_SUSPECT' : 'true_catch',
        snippet: message.slice(0, 120),
      });
    }
  }
}

console.log(JSON.stringify(summary, null, 2));
