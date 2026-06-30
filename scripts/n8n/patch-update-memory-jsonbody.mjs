import * as kit from "./tool/patch-kit.mjs";

// Surgical patch: make the two CRM POST nodes that inline free-text build their
// JSON body via JSON.stringify so quotes/newlines in summaries are escaped.
// Root cause of execution #405587 error "JSON parameter needs to be valid JSON":
// summary_operational contained literal double quotes (modelo "iPhone 12" ...).
//
// Migrado para tool/patch-kit.mjs (Fase 5): I/O único. DRY=1 lê o snapshot.

const PATCHES = {
  'CRM Leads POST Update Memory':
    "={{ JSON.stringify({ action: 'update_memory', payload: { lead_id: $('Edit Fields').item.json.lead.id, summary_short: $json.summary_short, summary_operational: $json.summary_operational } }) }}",
  'CRM Leads POST update_funnel':
    "={{ JSON.stringify({ action: 'update_funnel', payload: { lead_id: $('Edit Fields').item.json.lead.id, funnel_stage: $('Edit Fields').item.json.lead.funnel_stage, intent: $json.intent, reason: $json.next_best_action } }) }}",
};

const wf = await kit.loadWorkflow();

const applied = [];
for (const node of wf.nodes) {
  if (PATCHES[node.name]) {
    const before = node.parameters.jsonBody;
    node.parameters.jsonBody = PATCHES[node.name];
    applied.push({ node: node.name, changed: before !== PATCHES[node.name] });
  }
}
if (applied.length !== Object.keys(PATCHES).length) {
  throw new Error(`Expected ${Object.keys(PATCHES).length} nodes, patched ${applied.length}`);
}

if (kit.DRY) { console.log(JSON.stringify({ dry: true, patched: applied }, null, 2)); process.exit(0); }
kit.backup(await kit.getLive(), "update-memory-jsonbody");
const { activeAfter, finalActive } = await kit.safePut(wf, "update-memory-jsonbody");
console.log(JSON.stringify({ patched: applied, activeAfter, finalActive }, null, 2));
