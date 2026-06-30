// Patch cirurgico: alinhar a AUTENTICACAO do no `CRM Leads POST4` (handoff humano
// -> crm-ai-inbound transfer:true) ao padrao do `CRM Leads POST2`, que usa a
// credencial httpHeaderAuth configurada no n8n ("Authorization repasse") em vez de
// montar o header Authorization manualmente via $('credenciais') (que estava com
// credentials:null -> pedia credencial e quebrava o fluxo em loop).
// Copia authentication/genericAuthType/credentials do POST2; remove sendHeaders e
// headerParameters do POST4. NAO altera o body. Idempotente. DRY=1 previa.
//
// Migrado para scripts/n8n/tool/patch-kit.mjs (Fase 5): I/O único, sem o literal
// do snapshot legado. DRY=1 lê o snapshot local, não faz PUT.
import * as kit from "./tool/patch-kit.mjs";

const SOURCE = 'CRM Leads POST2';
const TARGET = 'CRM Leads POST4';

const workflow = await kit.loadWorkflow();
const src = workflow.nodes.find((n) => n.name === SOURCE);
const tgt = workflow.nodes.find((n) => n.name === TARGET);
if (!src) throw new Error(`Node not found: ${SOURCE}`);
if (!tgt) throw new Error(`Node not found: ${TARGET}`);

const srcCred = src.credentials?.httpHeaderAuth;
if (!srcCred?.id) throw new Error(`${SOURCE} has no httpHeaderAuth credential to copy`);
if (src.parameters?.genericAuthType !== 'httpHeaderAuth') {
  throw new Error(`${SOURCE} genericAuthType is not httpHeaderAuth (got ${src.parameters?.genericAuthType})`);
}

const before = {
  authentication: tgt.parameters.authentication,
  genericAuthType: tgt.parameters.genericAuthType,
  sendHeaders: tgt.parameters.sendHeaders,
  headerParameters: tgt.parameters.headerParameters,
  credentials: tgt.credentials,
};

const alreadyDone = tgt.credentials?.httpHeaderAuth?.id === srcCred.id
  && tgt.parameters.authentication === 'genericCredentialType'
  && tgt.parameters.genericAuthType === 'httpHeaderAuth'
  && !tgt.parameters.sendHeaders
  && !tgt.parameters.headerParameters;

if (!alreadyDone) {
  tgt.parameters.authentication = 'genericCredentialType';
  tgt.parameters.genericAuthType = 'httpHeaderAuth';
  delete tgt.parameters.sendHeaders;
  delete tgt.parameters.headerParameters;
  tgt.credentials = { httpHeaderAuth: { id: srcCred.id, name: srcCred.name } };
}

const after = {
  authentication: tgt.parameters.authentication,
  genericAuthType: tgt.parameters.genericAuthType,
  sendHeaders: tgt.parameters.sendHeaders,
  headerParameters: tgt.parameters.headerParameters,
  credentials: tgt.credentials,
};

if (kit.DRY) {
  console.log(JSON.stringify({ dry: true, alreadyDone, before, after }, null, 2));
  process.exit(0);
}

if (alreadyDone) {
  console.log(JSON.stringify({ patched: false, alreadyDone: true, after }, null, 2));
  process.exit(0);
}

kit.backup(await kit.getLive(), "crmleadspost4-auth");
const { activeAfter, finalActive } = await kit.safePut(workflow, "crmleadspost4-auth");
console.log(JSON.stringify({ patched: true, before, after, activeAfter, finalActive }, null, 2));
