import { readFile } from 'node:fs/promises';

const path = process.argv[2] || 'output/n8n/ia-repasse-pro-next.generated.json';
const workflow = JSON.parse(await readFile(path, 'utf8'));
const names = new Set(workflow.nodes.map((node) => node.name));

const required = [
  'Webhook Next',
  'Normalize Payload Next',
  'Atualizar Estado Buffer Next',
  'Calcular Wait Buffer Next',
  'Verificar vencedor Next',
  'Tentar Lock Next',
  'Code Consolidador Payload Final Next',
  'Load CRM Context Next',
  'Commerce State Extractor Next',
  'Decision Engine Next',
  'Inventory Search Next',
  'Build Multi Quote Request Next',
  'CRM Simulator Quote Next',
  'Response Composer Next',
  'Persist Lead State Next',
  'Send WhatsApp Next',
];

const missing = required.filter((name) => !names.has(name));
if (missing.length) {
  throw new Error(`Missing required nodes: ${missing.join(', ')}`);
}

if (workflow.active !== false) {
  throw new Error('Generated workflow must be inactive');
}

const serialized = JSON.stringify(workflow);
if (/Bearer\s+[A-Za-z0-9._-]+/.test(serialized) || /[A-Za-z0-9_-]{32,}\.[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}/.test(serialized)) {
  throw new Error('Generated workflow appears to contain hardcoded token material');
}

const connectionTargets = new Set();
for (const groups of Object.values(workflow.connections || {})) {
  for (const outputs of Object.values(groups || {})) {
    for (const output of outputs || []) {
      for (const edge of output || []) {
        connectionTargets.add(edge.node);
      }
    }
  }
}

const danglingTargets = [...connectionTargets].filter((name) => !names.has(name));
if (danglingTargets.length) {
  throw new Error(`Generated workflow has dangling connection targets: ${danglingTargets.join(', ')}`);
}

console.log(JSON.stringify({
  valid: true,
  name: workflow.name,
  active: workflow.active,
  nodeCount: workflow.nodes.length,
}, null, 2));
