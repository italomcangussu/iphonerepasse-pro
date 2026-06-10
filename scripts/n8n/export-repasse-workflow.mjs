import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';

const envPath = '.env.local';
const sourceWorkflowId = 'oWNdWPUq6kEFitsnl8OpH';
const outputPath = 'output/n8n/ia-repasse-pro.current.json';

function parseEnv(text) {
  return Object.fromEntries(text.split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith('#') && line.includes('='))
    .map((line) => {
      const index = line.indexOf('=');
      return [line.slice(0, index).trim(), line.slice(index + 1).trim()];
    }));
}

if (!existsSync(envPath)) {
  throw new Error(`${envPath} not found`);
}

const env = parseEnv(await readFile(envPath, 'utf8'));
if (!env.N8N_PUBLIC_API || !env.N8N_MCP_URL) {
  throw new Error('Missing N8N_PUBLIC_API or N8N_MCP_URL in .env.local');
}

const origin = new URL(env.N8N_MCP_URL).origin;
const response = await fetch(new URL(`/api/v1/workflows/${sourceWorkflowId}`, origin), {
  headers: { 'X-N8N-API-KEY': env.N8N_PUBLIC_API },
});

if (!response.ok) {
  throw new Error(`n8n export failed: ${response.status} ${await response.text()}`);
}

const workflow = await response.json();
await mkdir('output/n8n', { recursive: true });
await writeFile(outputPath, `${JSON.stringify(workflow, null, 2)}\n`);

console.log(JSON.stringify({
  exported: true,
  workflowId: workflow.id,
  name: workflow.name,
  nodeCount: Array.isArray(workflow.nodes) ? workflow.nodes.length : 0,
  outputPath,
}, null, 2));
