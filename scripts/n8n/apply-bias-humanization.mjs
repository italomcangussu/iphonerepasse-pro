// Surgical patch — humanização das Bias (1, 2 ESTOQUE, 2 SEM ESTOQUE).
// Remove "caguetes" de IA dos system prompts no workflow AO VIVO (Cr4fPWe0prwS6XjI):
//   - travessão (—) e ponto-e-vírgula (;) dentro dos exemplos de "message";
//   - aberturas viciadas (Show/Perfeito em série) nos exemplos;
//   - fechamento-carimbo "Qualquer coisa é só chamar!" em parte das transferências;
//   - "apareceu Prateado" (Bia 2 ESTOQUE), "quer vim" → "vir", "providenciar o fechamento";
//   - insere bloco NATURALIDADE — SEM CARA DE IA nos 3 prompts.
// Footgun guard: PUT cirúrgico + reativação explícita + verificação final.
import fs from "node:fs";
import path from "node:path";

const WORKFLOW_ID = "Cr4fPWe0prwS6XjI";
const N8N_BASE_URL = "https://iatende-n8n.ylgf5w.easypanel.host";

function readEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return {};
  const env = {};
  for (const line of fs.readFileSync(filePath, "utf8").split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const match = trimmed.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);
    if (!match) continue;
    env[match[1]] = match[2].replace(/^["']|["']$/g, "");
  }
  return env;
}

function getN8nApiKey() {
  return process.env.N8N_PUBLIC_API ?? readEnvFile(path.resolve(".env.local")).N8N_PUBLIC_API;
}

async function n8nFetch(pathname, options = {}) {
  const apiKey = getN8nApiKey();
  if (!apiKey) throw new Error("N8N_PUBLIC_API missing from environment or .env.local");
  const response = await fetch(`${N8N_BASE_URL}${pathname}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      "X-N8N-API-KEY": apiKey,
      ...(options.headers ?? {}),
    },
  });
  const text = await response.text();
  if (!response.ok) throw new Error(`n8n API ${response.status}: ${text}`);
  return text ? JSON.parse(text) : null;
}

// Replace with occurrence-count assertion.
function sub(source, needle, replacement, { min = 1, max = Infinity, label }) {
  const parts = source.split(needle);
  const count = parts.length - 1;
  if (count < min || count > max) {
    throw new Error(`${label}: found ${count} occurrence(s), expected between ${min} and ${max}`);
  }
  console.log(`  ok [${label}] x${count}`);
  return parts.join(replacement);
}

const NATURALIDADE_BLOCK = `NATURALIDADE — SEM CARA DE IA (REGRA DURA)

Estes sinais entregam texto de robô e são PROIBIDOS dentro de "message":
- Travessão (—) ou hífen com espaços ( - ) no meio de frase. Reescreva com vírgula, ponto ou duas frases curtas.
- Ponto e vírgula (;).
- Mais de 1 exclamação na mesma mensagem. O natural é a maioria das mensagens não ter nenhuma.
- Começar duas mensagens seguidas com a mesma palavra (Show, Perfeito, Boa, Tranquilo). Varie a abertura ou entre direto no assunto.
- Fechar toda transferência com a mesma frase pronta. Use "Qualquer coisa é só chamar!" no máximo de vez em quando. Varie ("qualquer dúvida me chama", "tô por aqui se precisar") ou apenas finalize a frase.
- Conectivos de redação: "todavia", "entretanto", "ademais", "além disso", "vale destacar".
- Mais de 1 emoji por mensagem. Nem toda mensagem precisa de emoji.
Escreva como uma atendente real escreve no WhatsApp: frases curtas, "pra", "tá", direto ao ponto.`;

const BOT_OLD = `não sou aquele tipo de bot que dá raiva — se preferir falar com um atendente é só pedir que transfiro na hora. 👍`;
const BOT_NEW = `não sou aquele tipo de bot que dá raiva. Se preferir falar com um atendente é só pedir que transfiro na hora 👍`;

function patchBia1(s) {
  if (s.includes("NATURALIDADE — SEM CARA DE IA")) return s; // idempotente
  console.log(" Bia 1:");
  s = sub(s, BOT_OLD, BOT_NEW, { min: 2, max: 2, label: "bot sem travessão" });
  s = sub(s, `"E qual armazenamento — 128, 256, 512?"`,
    `"E qual armazenamento? 128, 256 ou 512?"`, { min: 1, max: 1, label: "armazenamento template" });
  s = sub(s, `"E qual armazenamento — 128, 256 ou 512?"`,
    `"E qual armazenamento? 128, 256 ou 512?"`, { min: 1, max: 1, label: "armazenamento exemplo" });
  s = sub(s, `iPhone 15 Pro Max — se tiver interesse, consigo já simular`,
    `iPhone 15 Pro Max, se tiver interesse consigo já simular`, { min: 1, max: 1, label: "nearby corpo sem travessão" });
  s = sub(s, `às vezes no mesmo dia — quer que eu te avise quando entrar?`,
    `às vezes no mesmo dia. Quer que eu te avise quando entrar?`, { min: 1, max: 1, label: "nearby exemplo sem travessão" });
  s = sub(s, `Entendido, vou te conectar com nossa equipe agora pra olhar isso com você. Qualquer coisa é só chamar!`,
    `Entendido, vou te conectar com nossa equipe agora pra olhar isso com você.`, { min: 2, max: 2, label: "garantia sem carimbo" });
  s = sub(s, `Perfeito! Vou te passar pro nosso especialista pra acompanhar a chegada do seu iPhone 15 com você. Qualquer coisa é só chamar!`,
    `Vou te passar pro nosso especialista pra acompanhar a chegada do seu iPhone 15 com você, beleza?`, { min: 1, max: 1, label: "nearby passo 4 sem carimbo" });
  s = sub(s, `Show, faltou só: [campos]. Pode me passar?`,
    `Boa, faltou só [campos]. Pode me passar?`, { min: 1, max: 1, label: "faltou-só template" });
  s = sub(s, `Show, faltou só: o % de bateria e se tá na garantia Apple. Pode me passar?`,
    `Boa, faltou só o % de bateria e se tá na garantia Apple. Pode me passar?`, { min: 1, max: 1, label: "faltou-só exemplo" });
  s = sub(s, `Não repita o que o cliente disse. Não use o nome do cliente em mensagens consecutivas.`,
    `Não repita o que o cliente disse. Não use o nome do cliente em mensagens consecutivas.\n\n\n${NATURALIDADE_BLOCK}`,
    { min: 1, max: 1, label: "bloco naturalidade" });
  return s;
}

function patchBia2Estoque(s) {
  if (s.includes("NATURALIDADE — SEM CARA DE IA")) return s;
  console.log(" Bia 2 ESTOQUE:");
  s = sub(s, BOT_OLD, BOT_NEW, { min: 1, max: 1, label: "bot sem travessão" });
  s = sub(s, `em frente a Americanas — quiosque`,
    `em frente à Americanas, no quiosque`, { min: 2, max: 2, label: "endereço Sobral sem travessão" });
  s = sub(s, `O valor já é o à vista — no cartão o que muda é conforme as parcelas.`,
    `O valor já é o à vista, no cartão o que muda é conforme as parcelas.`, { min: 1, max: 1, label: "objeção sem travessão" });
  s = sub(s, `certinha na simulacao; qual a bandeira do seu cartao?`,
    `certinha na simulacao. Qual a bandeira do seu cartao?`, { min: 1, max: 1, label: "preço-insistência sem ;" });
  s = sub(s, `Em Sobral apareceu Prateado disponivel`,
    `Em Sobral tenho o Prateado disponivel`, { min: 1, max: 1, label: "apareceu Prateado" });
  s = sub(s, `Esse modelo exato nao apareceu agora, mas encontrei opcoes proximas:`,
    `Esse modelo exato nao ta no estoque agora, mas tenho opcoes proximas:`, { min: 1, max: 1, label: "apareceu handoff-alternativas" });
  s = sub(s, `ainda hoje ou amanha; na maioria das vezes a gente consegue transferir entre lojas no mesmo dia.`,
    `ainda hoje ou amanha. Na maioria das vezes a gente consegue transferir entre lojas no mesmo dia.`, { min: 1, max: 1, label: "cross-city sem ;" });
  s = sub(s, `Show, é o Azul Profundo.`,
    `Esse é o Azul Profundo.`, { min: 2, max: 4, label: "B1 abertura variada" });
  s = sub(s, `"Show. Qual a bandeira do seu cartão? Pode ser Visa, Master, Elo ou Amex."`,
    `"Fechou. Qual a bandeira do seu cartão? Visa, Master, Elo ou Amex?"`, { min: 1, max: 1, label: "estágio 2 abertura" });
  s = sub(s, `"Show, vou refazer a simulacao com esse valor de entrada e ja te mando."`,
    `"Boa, refaco a simulacao com esse valor de entrada e ja te mando."`, { min: 1, max: 1, label: "rerun entrada abertura" });
  s = sub(s, `"Show, simulo agora pra voce."`,
    `"Boa, ja simulo aqui pra voce."`, { min: 2, max: 2, label: "rerun opção abertura" });
  s = sub(s, `Perfeito! Pix recebido. Qual horário você quer vim?`,
    `Pix recebido ✅ Que horário fica bom pra você vir buscar?`, { min: 2, max: 2, label: "pix recebido + vim→vir" });
  s = sub(s, `Perfeito. Poderia me passar seus dados para cadastro?`,
    `Boa. Me passa seus dados pro cadastro?`, { min: 2, max: 2, label: "cadastro abertura" });
  s = sub(s, `O que você achou da proposta, vamos providenciar o fechamento? 😃`,
    `O que achou da proposta? Quer que eu já encaminhe o fechamento? 😃`, { min: 2, max: 2, label: "fechamento humano" });
  s = sub(s, `Já chamo nossa equipe pra continuar com você. Qualquer coisa é só chamar!`,
    `Já chamo nossa equipe pra continuar com você 👍`, { min: 1, max: 1, label: "pedido de humano sem carimbo" });
  s = sub(s, `Não repita o que o cliente disse. Não use o nome em mensagens consecutivas.`,
    `Não repita o que o cliente disse. Não use o nome em mensagens consecutivas.\n\n\n${NATURALIDADE_BLOCK}`,
    { min: 1, max: 1, label: "bloco naturalidade" });
  return s;
}

function patchBia2SemEstoque(s) {
  if (s.includes("NATURALIDADE — SEM CARA DE IA")) return s;
  console.log(" Bia 2 SEM ESTOQUE:");
  s = sub(s, `continua valendo; quer que eu siga com a reserva?`,
    `continua valendo. Quer que eu siga com a reserva?`, { min: 1, max: 1, label: "FAQ sem ;" });
  s = sub(s, `O que você achou da proposta, vamos providenciar o fechamento? 😃`,
    `O que achou da proposta? Quer que eu já encaminhe o fechamento? 😃`, { min: 1, max: 1, label: "fechamento humano" });
  s = sub(s, `Já chamo nossa equipe pra continuar com você. Qualquer coisa é só chamar!`,
    `Já chamo nossa equipe pra continuar com você 👍`, { min: 1, max: 1, label: "pedido de humano sem carimbo" });
  s = sub(s, `Evite clichês como "Claro!", "Com certeza!" e "Pode deixar!".`,
    `Evite clichês como "Claro!", "Com certeza!" e "Pode deixar!".\n\n${NATURALIDADE_BLOCK}`,
    { min: 1, max: 1, label: "bloco naturalidade" });
  return s;
}

// Scan de caguete nos exemplos "message" — deve zerar ANTES do PUT.
function scanMessageTells(name, prompt) {
  const msgs = [...prompt.matchAll(/"message":\s*"((?:[^"\\]|\\.)*)"/g)].map((m) => m[1]);
  const offenders = [];
  for (const msg of msgs) {
    if (msg.includes("—")) offenders.push(`travessão: ${msg.slice(0, 60)}`);
    if (msg.includes(";")) offenders.push(`ponto-e-vírgula: ${msg.slice(0, 60)}`);
    if (/\bapareceu\b/.test(msg)) offenders.push(`apareceu: ${msg.slice(0, 60)}`);
  }
  if (offenders.length) {
    throw new Error(`${name} ainda tem caguetes nos exemplos:\n  ${offenders.join("\n  ")}`);
  }
  console.log(`  scan limpo [${name}]: ${msgs.length} exemplos sem travessão/;/apareceu`);
}

// ---- Run ----
const workflow = await n8nFetch(`/api/v1/workflows/${WORKFLOW_ID}`);
const wasActive = workflow.active;
const backupPath = `/tmp/repasse-workflow-${WORKFLOW_ID}-${Date.now()}.json`;
fs.writeFileSync(backupPath, JSON.stringify(workflow, null, 2));

const AGENTS = [
  ["Bia 1", patchBia1],
  ["Bia 2 ESTOQUE", patchBia2Estoque],
  ["Bia 2 SEM ESTOQUE ", patchBia2SemEstoque],
];

for (const [name, patch] of AGENTS) {
  const node = workflow.nodes.find((n) => n.name === name);
  if (!node) throw new Error(`${name} node not found`);
  node.parameters.options.systemMessage = patch(node.parameters.options.systemMessage);
  scanMessageTells(name, node.parameters.options.systemMessage);
}

const body = {
  name: workflow.name,
  nodes: workflow.nodes,
  connections: workflow.connections,
  settings: { executionOrder: workflow.settings?.executionOrder ?? "v1" },
};

await n8nFetch(`/api/v1/workflows/${WORKFLOW_ID}`, { method: "PUT", body: JSON.stringify(body) });

let activeAfter = false;
try {
  const activated = await n8nFetch(`/api/v1/workflows/${WORKFLOW_ID}/activate`, { method: "POST" });
  activeAfter = activated?.active ?? false;
} catch (err) {
  activeAfter = `ACTIVATE_FAILED: ${err.message}`;
}

const verify = await n8nFetch(`/api/v1/workflows/${WORKFLOW_ID}`);
const results = {};
for (const [name] of AGENTS) {
  const prompt = verify.nodes.find((n) => n.name === name).parameters.options.systemMessage;
  results[name.trim()] = {
    naturalidadeBlock: prompt.includes("NATURALIDADE — SEM CARA DE IA"),
    promptLen: prompt.length,
  };
}

console.log(JSON.stringify({
  workflowId: verify.id,
  wasActive,
  activeAfter,
  finalActive: verify.active,
  backupPath,
  results,
}, null, 2));
