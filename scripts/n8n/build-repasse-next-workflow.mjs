import { mkdir, readFile, writeFile } from 'node:fs/promises';
import crypto from 'node:crypto';

const sourcePath = 'output/n8n/ia-repasse-pro.current.json';
const outputPath = 'output/n8n/ia-repasse-pro-next.generated.json';

const source = JSON.parse(await readFile(sourcePath, 'utf8'));

const cloneNode = (name, nextName, position) => {
  const node = source.nodes.find((item) => item.name === name);
  if (!node) throw new Error(`Source node not found: ${name}`);
  const cloned = {
    ...JSON.parse(JSON.stringify(node)),
    id: crypto.randomUUID(),
    name: nextName,
    position,
  };

  delete cloned.credentials;

  if (cloned.type === 'n8n-nodes-base.webhook') {
    cloned.webhookId = crypto.randomUUID();
    cloned.parameters = {
      ...cloned.parameters,
      path: 'repasse-next',
    };
  }

  return cloned;
};

const codeNode = (name, jsCode, position) => ({
  parameters: { jsCode },
  type: 'n8n-nodes-base.code',
  typeVersion: 2,
  position,
  id: crypto.randomUUID(),
  name,
});

const setNode = (name, assignments, position) => ({
  parameters: {
    assignments: { assignments },
    options: {},
  },
  type: 'n8n-nodes-base.set',
  typeVersion: 3.4,
  position,
  id: crypto.randomUUID(),
  name,
});

const httpNode = (name, parameters, position) => ({
  parameters,
  type: 'n8n-nodes-base.httpRequest',
  typeVersion: 4.3,
  position,
  id: crypto.randomUUID(),
  name,
});

const assignment = (name, value, type = 'string') => ({
  id: crypto.randomUUID(),
  name,
  value,
  type,
});

const nodes = [
  cloneNode('Webhook', 'Webhook Next', [0, 0]),
  setNode('Normalize Payload Next', [
    assignment('lead_id', "={{ $json.body.lead_detail?.id ?? $json.body.lead_id ?? '' }}"),
    assignment('store_id', "={{ $json.body.store_id ?? $json.body.lead_detail?.store_id ?? '' }}"),
    assignment('conversation_id', "={{ $json.body.meta?.conversation_id ?? '' }}"),
    assignment('message_text', "={{ $json.body.body?.message?.text ?? $json.body.body?.message?.content ?? $json.body.body?.message?.caption ?? '' }}"),
    assignment('sender_name', "={{ $json.body.body?.message?.senderName ?? $json.body.lead_detail?.name ?? '' }}"),
    assignment('media_type', "={{ $json.body.body?.mediaType ?? $json.body.media?.mimetype ?? 'text' }}"),
  ], [260, 0]),
  cloneNode('Atualizar Estado Buffer', 'Atualizar Estado Buffer Next', [520, 0]),
  cloneNode('Calcular Wait Buffer', 'Calcular Wait Buffer Next', [780, 0]),
  cloneNode('Verificar vencedor', 'Verificar vencedor Next', [1040, 0]),
  cloneNode('Tentar Lock', 'Tentar Lock Next', [1300, 0]),
  cloneNode('Code Consolidador Payload Final', 'Code Consolidador Payload Final Next', [1560, 0]),
  httpNode('Load CRM Context Next', {
    url: "={{ $env.SUPABASE_FUNCTIONS_URL + '/crm-leads-api?store_id=' + $json.store_id + '&search=' + $json.lead_id + '&limit=10&offset=0' }}",
    sendHeaders: true,
    headerParameters: { parameters: [
      { name: 'x-api-key', value: '={{ $env.CRM_N8N_API_KEY }}' },
    ] },
    options: {},
  }, [1820, 0]),
  codeNode('Commerce State Extractor Next', `const input = $input.first().json;
const text = String(input.message_text ?? input.buffer?.message_buffered ?? '').toLowerCase();
const devices = [];
const modelMatch = text.match(/(?:iphone\\s*)?(1[1-7])\\s*(pro max|promax|pro|max|plus)?/i);
if (modelMatch) {
  const generation = modelMatch[1];
  const variant = String(modelMatch[2] ?? '').replace('promax', 'pro max').trim();
  const suffix = variant ? ' ' + variant.split(' ').map((part) => part.charAt(0).toUpperCase() + part.slice(1)).join(' ') : '';
  const capacityMatch = text.match(/\\b(64|128|256|512)\\s*gb\\b|\\b(64|128|256|512)\\b|\\b1\\s*tb\\b/i);
  devices.push({
    slot: 1,
    model: 'iPhone ' + generation + suffix,
    capacity: capacityMatch ? (capacityMatch[1] || capacityMatch[2] || '1TB').toUpperCase().replace('TB', 'TB').replace(/^(\\d+)$/, '$1GB') : null,
    color: null,
    condition: null,
  });
}
const missing_fields = [];
if (!devices.length) missing_fields.push('desired_model');
else if (!devices[0].capacity) missing_fields.push('desired_capacity');
return [{ json: { ...input, desired_devices: devices.slice(0, 2), trade_ins: [], missing_fields, summary_short_next: input.lead?.summary_short ?? null } }];`, [2080, 0]),
  codeNode('Decision Engine Next', `const input = $input.first().json;
let action = 'ask_missing_field';
if (input.desired_devices?.length && !input.missing_fields?.length) action = input.card_brand ? 'simulate' : 'ask_card_brand';
return [{ json: { ...input, action } }];`, [2340, 0]),
  httpNode('Inventory Search Next', {
    url: "={{ $env.SUPABASE_URL + '/rest/v1/stock_items?select=id,model,capacity,color,condition,sell_price,status,stores(city)&status=in.(Dispon%C3%ADvel,Reservado)&limit=80' }}",
    sendHeaders: true,
    headerParameters: { parameters: [
      { name: 'apikey', value: '={{ $env.SUPABASE_SERVICE_ROLE_KEY }}' },
      { name: 'Authorization', value: '={{ "Bearer " + $env.SUPABASE_SERVICE_ROLE_KEY }}' },
    ] },
    options: {},
  }, [2600, 0]),
  codeNode('Build Multi Quote Request Next', `const input = $('Decision Engine Next').first().json;
const stockItems = $input.all().map((item) => item.json);
const quotes = (input.desired_devices ?? []).slice(0, 2).map((device) => {
  const found = stockItems.find((item) =>
    String(item.model ?? '').toLowerCase() === String(device.model ?? '').toLowerCase() &&
    (!device.capacity || String(item.capacity ?? '').toLowerCase() === String(device.capacity).toLowerCase())
  );
  return found ? { slot: device.slot, desiredDevice: { stockItemId: found.id } } : null;
}).filter(Boolean);
return [{ json: { ...input, inventory_items: stockItems, simulator_body: { quotes, cardBrand: input.card_brand ?? 'visa_master' } } }];`, [2860, 0]),
  httpNode('CRM Simulator Quote Next', {
    method: 'POST',
    url: "={{ $env.SUPABASE_FUNCTIONS_URL + '/crm-simulator-quote' }}",
    sendHeaders: true,
    headerParameters: { parameters: [
      { name: 'x-api-key', value: '={{ $env.CRM_N8N_API_KEY }}' },
    ] },
    sendBody: true,
    specifyBody: 'json',
    jsonBody: '={{ JSON.stringify($json.simulator_body) }}',
    options: {},
  }, [3120, 0]),
  codeNode('Response Composer Next', `const input = $input.first().json;
const fallback = input.missing_fields?.[0] === 'desired_capacity'
  ? 'Qual armazenamento voce procura para esse iPhone?'
  : 'Me passa o modelo e armazenamento do iPhone que voce procura?';
const text = input.messageText || fallback;
return [{ json: { ...input, messages: [text], transfer: false, summary_short_next: input.summary_short_next ?? null } }];`, [3380, 0]),
  httpNode('Persist Lead State Next', {
    method: 'POST',
    url: "={{ $env.SUPABASE_FUNCTIONS_URL + '/crm-leads-api' }}",
    sendHeaders: true,
    headerParameters: { parameters: [
      { name: 'x-api-key', value: '={{ $env.CRM_N8N_API_KEY }}' },
    ] },
    sendBody: true,
    specifyBody: 'json',
    jsonBody: '={{ JSON.stringify({ action: "upsert_lead_state", payload: { lead_id: $json.lead_id, store_id: $json.store_id, state: { summary_short: $json.summary_short_next } } }) }}',
    options: {},
  }, [3640, 0]),
  httpNode('Send WhatsApp Next', {
    method: 'POST',
    url: "={{ $env.SUPABASE_FUNCTIONS_URL + '/crm-send-message' }}",
    sendHeaders: true,
    headerParameters: { parameters: [
      { name: 'Authorization', value: '={{ $json.Authorization }}' },
      { name: 'apikey', value: '={{ $json.apikey }}' },
    ] },
    sendBody: true,
    bodyParameters: { parameters: [
      { name: 'conversationId', value: '={{ $json.conversation_id }}' },
      { name: 'content', value: '={{ $json.messages[0] }}' },
      { name: 'senderType', value: 'ai_inbound' },
    ] },
    options: {},
  }, [3900, 0]),
];

const connections = {
  'Webhook Next': { main: [[{ node: 'Normalize Payload Next', type: 'main', index: 0 }]] },
  'Normalize Payload Next': { main: [[{ node: 'Atualizar Estado Buffer Next', type: 'main', index: 0 }]] },
  'Atualizar Estado Buffer Next': { main: [[{ node: 'Calcular Wait Buffer Next', type: 'main', index: 0 }]] },
  'Calcular Wait Buffer Next': { main: [[{ node: 'Verificar vencedor Next', type: 'main', index: 0 }]] },
  'Verificar vencedor Next': { main: [[{ node: 'Tentar Lock Next', type: 'main', index: 0 }]] },
  'Tentar Lock Next': { main: [[{ node: 'Code Consolidador Payload Final Next', type: 'main', index: 0 }]] },
  'Code Consolidador Payload Final Next': { main: [[{ node: 'Load CRM Context Next', type: 'main', index: 0 }]] },
  'Load CRM Context Next': { main: [[{ node: 'Commerce State Extractor Next', type: 'main', index: 0 }]] },
  'Commerce State Extractor Next': { main: [[{ node: 'Decision Engine Next', type: 'main', index: 0 }]] },
  'Decision Engine Next': { main: [[{ node: 'Inventory Search Next', type: 'main', index: 0 }]] },
  'Inventory Search Next': { main: [[{ node: 'Build Multi Quote Request Next', type: 'main', index: 0 }]] },
  'Build Multi Quote Request Next': { main: [[{ node: 'CRM Simulator Quote Next', type: 'main', index: 0 }]] },
  'CRM Simulator Quote Next': { main: [[{ node: 'Response Composer Next', type: 'main', index: 0 }]] },
  'Response Composer Next': { main: [[{ node: 'Persist Lead State Next', type: 'main', index: 0 }]] },
  'Persist Lead State Next': { main: [[{ node: 'Send WhatsApp Next', type: 'main', index: 0 }]] },
};

const workflow = {
  name: 'ia repasse-pro next',
  active: false,
  nodes,
  connections,
  settings: {
    executionOrder: 'v1',
    availableInMCP: true,
    callerPolicy: 'workflowsFromSameOwner',
  },
};

await mkdir('output/n8n', { recursive: true });
await writeFile(outputPath, `${JSON.stringify(workflow, null, 2)}\n`);
console.log(JSON.stringify({ generated: true, outputPath, nodeCount: nodes.length }, null, 2));

if (process.argv.includes('--create')) {
  const envText = await readFile('.env.local', 'utf8');
  const env = Object.fromEntries(envText.split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith('#') && line.includes('='))
    .map((line) => {
      const index = line.indexOf('=');
      return [line.slice(0, index).trim(), line.slice(index + 1).trim()];
    }));

  const origin = new URL(env.N8N_MCP_URL).origin;
  const { active: _active, ...createWorkflowBody } = workflow;
  const response = await fetch(new URL('/api/v1/workflows', origin), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-N8N-API-KEY': env.N8N_PUBLIC_API,
    },
    body: JSON.stringify(createWorkflowBody),
  });

  if (!response.ok) {
    throw new Error(`n8n create failed: ${response.status} ${await response.text()}`);
  }

  const created = await response.json();
  console.log(JSON.stringify({
    created: true,
    workflowId: created.id,
    name: created.name,
    active: created.active,
  }, null, 2));
}
