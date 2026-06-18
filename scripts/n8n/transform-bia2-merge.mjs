// ============================================================================
// transform-bia2-merge.mjs — fusão Bia 2 ESTOQUE + Bia 2 SEM ESTOQUE (continuidade)
// num único agente Bia 2 (sobrevivente = "Bia 2 ESTOQUE"). REFACTOR ESTRUTURAL,
// comportamento idêntico. Lógica PURA (sem I/O de rede) — testável e idempotente.
//
// Faz 3 coisas, todas idempotentes:
//   1) UNIÃO DE PROMPT: enxerta no systemMessage do sobrevivente os blocos
//      EXCLUSIVOS da continuidade (entrada-antes-de-simular, continuidade-sem-
//      consulta, convencer-seminovo + tradein_condition_human_eval) + um preâmbulo
//      de modo-por-contexto. Marcador de idempotência.
//   2) UNIÃO DE CONTEXTO (campo `text`): torna defensiva a leitura da mensagem
//      atual e do estado do lead (root fallback) e expõe routing_decision/
//      last_inventory_context — tudo aditivo/behavior-preserving.
//   3) TOPOLOGIA: repointa as 3 entradas da continuidade para o sobrevivente e
//      remove o subgrafo que fica órfão (delta de alcançabilidade), preservando
//      Bia 1 (If4/POST4), sticky notes e tudo o mais.
//
// Uso CLI:  node scripts/n8n/transform-bia2-merge.mjs --in a.json --out b.json
// Uso test: import { transformWorkflow, computeDeadSet } from "./transform-bia2-merge.mjs"
// ============================================================================

import fs from "node:fs";

export const SURVIVOR = "Bia 2 ESTOQUE";
export const RETIRING = "Bia 2 SEM ESTOQUE "; // atenção: espaço no fim é o nome real
export const PROMPT_MARKER = "# MODO DE OPERAÇÃO POR CONTEXTO (Bia 2 unificada)";
export const TEXT_MARKER = "=== CONTEXTO DE CONTINUIDADE (Bia 2 unificada) ===";

// As 3 entradas que hoje vão para a continuidade e passam ao sobrevivente.
// [nó de origem, índice do grupo de saída main].
const REPOINTS = [
  ["Switch1", 0],          // fora_escopo
  ["Switch3", 2],          // bia2_continuation
  ["Parse Simulator", 0],  // pós-simulação
];

// -------- helpers de string --------
function sliceBlock(text, startAnchor, endAnchor) {
  const i = text.indexOf(startAnchor);
  if (i < 0) throw new Error(`âncora não encontrada: ${startAnchor}`);
  const j = endAnchor ? text.indexOf(endAnchor, i) : -1;
  return text.slice(i, j < 0 ? undefined : j).trim();
}

function replaceOnce(text, find, repl) {
  const i = text.indexOf(find);
  if (i < 0) throw new Error(`replaceOnce: trecho não encontrado: ${find.slice(0, 60)}`);
  if (text.indexOf(find, i + find.length) >= 0) {
    throw new Error(`replaceOnce: trecho não é único: ${find.slice(0, 60)}`);
  }
  return text.slice(0, i) + repl + text.slice(i + find.length);
}

// -------- 1) união de prompt --------
function unifyPrompt(wf) {
  const surv = wf.nodes.find((n) => n.name === SURVIVOR);
  if (!surv) throw new Error(`sobrevivente ausente: ${SURVIVOR}`);
  surv.parameters = surv.parameters ?? {};
  surv.parameters.options = surv.parameters.options ?? {};
  let sm = surv.parameters.options.systemMessage ?? "";
  if (sm.includes(PROMPT_MARKER)) return; // idempotente

  const agent = wf.nodes.find((n) => n.name === RETIRING);
  if (!agent) {
    throw new Error(`não dá para unir prompt: nó de origem ${RETIRING} ausente e marcador não presente`);
  }
  const cont = agent.parameters?.options?.systemMessage ?? "";
  const b1 = sliceBlock(cont, "CONTINUIDADE SEM CONSULTA DE ESTOQUE", "REGRA DE CORES — NUNCA INVENTE COR");
  const b2 = sliceBlock(cont, "REGRA DE ENTRADA ANTES DE SIMULAR", "FORA DO ESCOPO / HDI");
  const b3 = sliceBlock(cont, "// CONVENCER SEMINOVO / CIDADE POS-SIM (FAQ/FLUXO) v1", null);

  const graft = [
    "",
    "# ════════════════════════════════════════════════════════════════════════════",
    PROMPT_MARKER,
    "# ════════════════════════════════════════════════════════════════════════════",
    "Esta é a Bia 2 unificada: atende tanto a apresentação de estoque quanto a continuidade (FAQ, cidade, pós-simulação, entrada antes de simular, retomadas).",
    "Detecte o modo pelo CONTEXTO presente neste turno:",
    "- Se `inventory` PRESENTE neste turno: aplique os CENÁRIOS DE ESTOQUE (A/B/C) e o funil de venda acima.",
    "- Se `inventory` AUSENTE neste turno: opere em MODO CONTINUIDADE — responda FAQ, cidade pós-simulação, apresente a simulação e faça retomadas SEM afirmar indisponibilidade de estoque (nunca diga que o modelo não está no estoque sem inventory_checked=true ou inventory.inventory_found=false de consulta real).",
    "As regras abaixo (entrada antes de simular, continuidade sem consulta, convencer seminovo, condição do aparelho de entrada) valem em qualquer modo conforme o routing_decision.",
    "",
    b1,
    "",
    b2,
    "",
    b3,
    "",
  ].join("\n");

  // insere antes do bloco final de formato de saída
  sm = replaceOnce(sm, "FORMATO DE SAÍDA OBRIGATÓRIO", graft + "\nFORMATO DE SAÍDA OBRIGATÓRIO");
  surv.parameters.options.systemMessage = sm;
}

// -------- 2) união de contexto (campo text) --------
function unifyText(wf) {
  const surv = wf.nodes.find((n) => n.name === SURVIVOR);
  let text = surv.parameters?.text ?? "";
  if (text.includes(TEXT_MARKER)) return; // idempotente

  // (a) mensagem atual defensiva (evita throw quando buffer ausente nas entradas repontadas)
  text = replaceOnce(
    text,
    "=== MENSAGEM ATUAL DO CLIENTE ===\n{{ $json.buffer.message_buffered }}",
    '=== MENSAGEM ATUAL DO CLIENTE ===\n{{ $json.message_buffered ?? $json.buffer?.message_buffered ?? "" }}',
  );

  // (b) expõe routing_decision/last_inventory_context (as regras enxertadas dependem disso).
  //     inserido logo após a primeira linha do SNAPSHOT COMERCIAL.
  const contBlock = [
    "",
    TEXT_MARKER,
    'Routing decision: {{ $json.routing_decision ?? $json.memory?.routing_decision ?? "n/a" }}',
    "Estoque consultado neste turno (continuidade): {{ $json.inventory ? true : false }}",
    "Ultimo contexto de estoque salvo: {{ JSON.stringify($json.last_inventory_context ?? $json.memory?.last_inventory_context ?? null) }}",
    "REGRA: se inventory estiver ausente, estoque nao foi consultado neste turno; nao diga que esta sem estoque.",
    "",
  ].join("\n");
  text = replaceOnce(text, "==== SNAPSHOT COMERCIAL (FONTE ÚNICA) ===", "==== SNAPSHOT COMERCIAL (FONTE ÚNICA) ===" + contBlock);

  // (c) fallbacks de raiz no ESTADO DO LEAD (idênticos quando memory presente; cobrem entradas repontadas)
  const leadBlock = [
    "=== ESTADO DO LEAD ===",
    'Nome: {{ $json.first_name ?? $json.name ?? "não informado" }}',
    'Interest type: {{ $json.memory?.interest_type ?? $json.interest_type ?? "não informado" }}',
    'Desired model: {{ $json.memory?.desired_model ?? $json.desired_model ?? "não informado" }}',
    'Desired capacity: {{ $json.memory?.desired_capacity ?? $json.desired_capacity ?? "não informada" }}',
    'Desired color: {{ $json.memory?.desired_color ?? $json.desired_color ?? "não informada" }}',
    'Desired condition: {{ $json.memory?.desired_condition ?? $json.desired_condition ?? "não informada" }}',
    "",
    "Has tradein: {{ $json.memory?.has_tradein ?? $json.has_tradein ?? false }}",
    'Tradein model: {{ $json.memory?.tradein_model ?? $json.tradein_model ?? "não informado" }}',
    "Tradein disqualified: {{ $json.memory?.tradein_disqualified ?? $json.tradein_disqualified ?? false }}",
    'Tradein battery health: {{ $json.memory?.tradein_battery_pct ?? $json.tradein_battery_pct ?? "não informada" }}',
    "",
    'Preferred city: {{ $json.memory?.preferred_city ?? $json.preferred_city ?? "não definida" }}',
    'Card brand: {{ $json.memory?.card_brand ?? $json.card_brand ?? "não informado" }}',
    "Proposal accepted: {{ $json.memory?.proposal_accepted ?? $json.proposal_accepted ?? false }}",
    "Reservation intent: {{ $json.memory?.reservation_intent ?? $json.reservation_intent ?? false }}",
    "PIX data sent: {{ $json.memory?.pix_data_sent ?? $json.pix_data_sent ?? false }}",
    "PIX paid: {{ $json.memory?.pix_paid ?? $json.pix_paid ?? false }}",
    'Pickup datetime: {{ $json.memory?.pickup_datetime ?? $json.pickup_datetime ?? "não definido" }}',
    "Cadastro completo: {{ $json.memory?.cadastro_completo ?? $json.cadastro_completo ?? false }}",
    'Next best action: {{ $json.memory?.next_best_action ?? $json.next_best_action ?? "n/a" }}',
    'Sentiment: {{ $json.memory?.sentiment_current ?? "neutro" }}',
  ].join("\n");
  // substitui o bloco inteiro do ESTADO DO LEAD (âncoras de início e fim)
  const start = "=== ESTADO DO LEAD ===";
  const end = "=== ÚLTIMA MENSAGEM ENVIADA AO CLIENTE ===";
  const si = text.indexOf(start);
  const ei = text.indexOf(end);
  if (si < 0 || ei < 0 || ei < si) throw new Error("unifyText: âncoras do ESTADO DO LEAD não encontradas");
  text = text.slice(0, si) + leadBlock + "\n\n" + text.slice(ei);

  surv.parameters.text = text;
}

// -------- 3) topologia --------
function triggerNames(wf) {
  return wf.nodes.filter((n) => /trigger|webhook/i.test(n.type)).map((n) => n.name);
}

// alcançabilidade: main a partir dos triggers + provedores ai_* que alimentam nós vivos
function reachable(connections, triggers) {
  const mainAdj = {};
  for (const [s, o] of Object.entries(connections)) {
    for (const g of o.main ?? []) for (const l of g ?? []) (mainAdj[s] ??= new Set()).add(l.node);
  }
  const live = new Set(triggers);
  const stack = [...live];
  while (stack.length) {
    const n = stack.pop();
    for (const m of mainAdj[n] ?? []) if (!live.has(m)) { live.add(m); stack.push(m); }
  }
  let changed = true;
  while (changed) {
    changed = false;
    for (const [s, o] of Object.entries(connections)) {
      for (const [k, groups] of Object.entries(o)) {
        if (k === "main") continue;
        for (const g of groups ?? []) for (const l of g ?? []) {
          if (live.has(l.node) && !live.has(s)) { live.add(s); changed = true; }
        }
      }
    }
  }
  return live;
}

function repointConnections(connections) {
  for (const [src, group] of REPOINTS) {
    const links = connections[src]?.main?.[group] ?? [];
    for (const l of links) if (l.node === RETIRING) l.node = SURVIVOR;
  }
}

/** conjunto morto = alcançável-antes \ alcançável-depois do repointe (delta). */
export function computeDeadSet(wf) {
  const triggers = triggerNames(wf);
  const before = reachable(wf.connections ?? {}, triggers);
  const after = structuredClone(wf.connections ?? {});
  repointConnections(after);
  const afterLive = reachable(after, triggers);
  return new Set([...before].filter((n) => !afterLive.has(n)));
}

function applyTopology(wf) {
  wf.connections = wf.connections ?? {};
  const dead = computeDeadSet(wf);
  // repointa as 3 entradas
  repointConnections(wf.connections);
  // remove nós mortos
  wf.nodes = wf.nodes.filter((n) => !dead.has(n.name));
  // limpa conexões: origens mortas + links para nós mortos
  for (const deadName of dead) delete wf.connections[deadName];
  for (const outs of Object.values(wf.connections)) {
    for (const [k, groups] of Object.entries(outs)) {
      outs[k] = (groups ?? []).map((g) => (g ?? []).filter((l) => l && !dead.has(l.node)));
    }
  }
  return dead;
}

/** Transformação completa, pura e idempotente. Retorna { wf, dead }. */
export function transformWorkflow(input) {
  const wf = structuredClone(input);
  unifyPrompt(wf);
  unifyText(wf);
  const dead = applyTopology(wf);
  return { wf, dead: [...dead].sort() };
}

// -------- CLI --------
function parseArgs(argv) {
  const a = {};
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--in") a.in = argv[++i];
    else if (argv[i] === "--out") a.out = argv[++i];
  }
  return a;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const args = parseArgs(process.argv.slice(2));
  const inPath = args.in ?? "n8n/ia-repasse-pro-v2/workflow.json";
  const wf = JSON.parse(fs.readFileSync(inPath, "utf8"));
  const { wf: out, dead } = transformWorkflow(wf);
  console.log(`transform OK — removidos ${dead.length} nós:`);
  for (const d of dead) console.log("  - " + JSON.stringify(d));
  if (args.out) {
    fs.writeFileSync(args.out, JSON.stringify(out, null, 2));
    console.log(`escrito: ${args.out}`);
  } else {
    console.log("(sem --out: nada escrito)");
  }
}
