#!/usr/bin/env node
// Surgical patch — make Router Agent + Bia 1 ad-context aware on the LIVE workflow
// (Cr4fPWe0prwS6XjI) so the agent recognizes a Meta/Instagram campaign image and greets
// the customer about the exact device they clicked (e.g. iPhone 11), mirroring how a
// human specialist opens. Expression prompts (=…) live in workflow.json and CANNOT be
// shipped by `repasse-maint deploy` (it only composes decomposed node files), so this
// follows the surgical-patch contract: GET fresh live → exact-anchor edits → backup →
// PUT (buildPutBody allowlist) → /activate → re-export. Idempotent (marker guards).
//
// Ad context source in the workflow:
//   Router : $json.lead.source_ad_context                         (lead row via search_leads RPC)
//   Bia 1  : $('CRM Leads GET').last()...data.items[0].source_ad_context
//
// Migrado para scripts/n8n/tool/patch-kit.mjs (Fase 5): I/O único, sem o literal
// do snapshot legado. DRY=1 lê o snapshot local e grava /tmp/repasse-adcontext-dry.json sem PUT.
import fs from "node:fs";
import * as kit from "./tool/patch-kit.mjs";
import { CONFIG } from "./tool/config.mjs";

// ── edit payloads ────────────────────────────────────────────────────────────

const ROUTER_TEXT_BLOCK = `=== ORIGEM (ANÚNCIO META/INSTAGRAM) ===
Veio de anúncio: {{ $json.lead?.source_ad_context?.is_from_ad ? "sim" : "não" }}
Campanha: {{ $json.lead?.source_ad_context?.campaign_title ?? "—" }}
Texto do anúncio: {{ $json.lead?.source_ad_context?.campaign_body ?? "—" }}
Aparelho destacado no anúncio (imagem que o cliente clicou): {{ $json.lead?.source_ad_context?.product_hint?.model ?? "—" }}{{ $json.lead?.source_ad_context?.product_hint?.capacity_gb ? " " + $json.lead.source_ad_context.product_hint.capacity_gb + "GB" : "" }}

`;

const ROUTER_RULE = `

################################################################################
# REGRA DE ORIGEM POR ANÚNCIO (Click-to-WhatsApp / Instagram)
################################################################################
Quando o CONTEXTO trouxer "Veio de anúncio: sim", o cliente chegou clicando num anúncio de campanha. A imagem que ele recebeu é o CRIATIVO do anúncio e mostra o aparelho que ele clicou (num carrossel, é o card que ele escolheu) — NÃO é uma foto do aparelho dele para avaliação/trade-in. Classifique assim:
- intent_primary = "aparelho_iphone" quando o "Aparelho destacado no anúncio" for um iPhone (caso seja Mac/iPad/Watch/AirPods, use aparelho_outro), mesmo que a mensagem atual seja genérica ("Vi o anúncio e gostaria de mais informações", "Valor", "Quero", "Tem disponível?").
- needs_inventory = true, route = "ia", needs_human_now = false, next_agents = ["memory", "conversa", "event_crm"].
- NÃO classifique como fora_do_escopo nem garantia só pelo texto curto: a origem do anúncio indica intenção de compra do aparelho destacado.`;

// Array access mirrors the proven Bia 1 line `...data.items[0].attendance_owner`
// (lead always exists for an active conversation); optional chaining only on the
// nullable jsonb field to avoid n8n engine quirks with `?.[index]`.
const BIA1_TEXT_BLOCK = `=== ORIGEM (ANÚNCIO) ===
Veio de anúncio: {{ $('CRM Leads GET').last().json.data.items[0].source_ad_context?.is_from_ad ? "sim" : "não" }}
Aparelho do anúncio: {{ $('CRM Leads GET').last().json.data.items[0].source_ad_context?.product_hint?.model ?? "—" }}{{ $('CRM Leads GET').last().json.data.items[0].source_ad_context?.product_hint?.capacity_gb ? " " + $('CRM Leads GET').last().json.data.items[0].source_ad_context.product_hint.capacity_gb + "GB" : "" }}
Campanha: {{ $('CRM Leads GET').last().json.data.items[0].source_ad_context?.campaign_title ?? "—" }}

`;

const BIA1_RULE = `

################################################################################
# REGRA DE ABERTURA POR ANÚNCIO — PRIORIDADE ALTA
################################################################################
Quando "Veio de anúncio: sim" no bloco ORIGEM, o cliente clicou num anúncio e recebeu a imagem do criativo com o aparelho de interesse (ex.: iPhone 11). NÃO comece perguntando "qual aparelho você procura?" — você já sabe pelo anúncio. Abra reconhecendo a origem, no tom de um especialista que confirma a boa escolha, espelhando este exemplo real de um atendente:
  "Olá, boa noite! Tudo bem? 😊 Que ótimo, você garantiu o {APARELHO DO ANÚNCIO} na nossa oferta. Vamos reservar o seu para retirada? 😍"
Regras:
- Use o "Aparelho do anúncio" como o aparelho desejado — confirme-o com naturalidade em vez de perguntar do zero.
- Conduza para o próximo passo (capacidade/cor/cidade ou reserva/simulação), seguindo a AÇÃO PRIORITÁRIA e os CAMPOS QUE FALTAM.
- Se o cliente só disse "Valor"/"Quanto é?"/"Quero", responda já contextualizando no aparelho do anúncio e avance para coletar o que falta para simular.
- A imagem do anúncio é o produto que ele quer COMPRAR; nunca a trate como aparelho de entrada/trade-in só porque aparece um iPhone na figura.
- Se "Veio de anúncio: não", ignore esta regra inteira e siga o fluxo normal.`;

// ── apply ─────────────────────────────────────────────────────────────────────

function patchNode(wf, nodeName, { textAnchor, textBlock, ruleMarker, rule }) {
  const node = wf.nodes.find((n) => n.name === nodeName);
  if (!node) throw new Error(`node ausente: ${nodeName}`);
  const changes = [];

  if (!node.parameters.text.includes("=== ORIGEM (")) {
    const occ = node.parameters.text.split(textAnchor).length - 1;
    if (occ !== 1) throw new Error(`${nodeName}: âncora de text não-única (${occ})`);
    node.parameters.text = node.parameters.text.replace(textAnchor, textBlock + textAnchor);
    changes.push("text:+ORIGEM");
  }

  const sm = node.parameters.options.systemMessage;
  if (!sm.includes(ruleMarker)) {
    node.parameters.options.systemMessage = sm + rule;
    changes.push("systemMessage:+regra");
  }
  return changes;
}

function applyAll(wf) {
  const router = patchNode(wf, "Router Agent", {
    textAnchor: "=== ÚLTIMA MENSAGEM ENVIADA AO CLIENTE ===",
    textBlock: ROUTER_TEXT_BLOCK,
    ruleMarker: "REGRA DE ORIGEM POR ANÚNCIO",
    rule: ROUTER_RULE,
  });
  const bia1 = patchNode(wf, "Bia 1", {
    textAnchor: "=== REGRA DE ABERTURA (primeiro contato) ===",
    textBlock: BIA1_TEXT_BLOCK,
    ruleMarker: "REGRA DE ABERTURA POR ANÚNCIO",
    rule: BIA1_RULE,
  });
  return { router, bia1 };
}

const wf = await kit.loadWorkflow();

const wasActive = wf.active;
const changes = applyAll(wf);
console.log("Router Agent:", changes.router.length ? changes.router.join(", ") : "(sem mudança)");
console.log("Bia 1       :", changes.bia1.length ? changes.bia1.join(", ") : "(sem mudança)");

// round-trip JSON sanity
JSON.parse(JSON.stringify(wf));

if (kit.DRY) {
  fs.writeFileSync("/tmp/repasse-adcontext-dry.json", JSON.stringify(wf, null, 2));
  console.log("\nDRY=1 — gravado /tmp/repasse-adcontext-dry.json (sem PUT).");
  process.exit(0);
}

if (!changes.router.length && !changes.bia1.length) {
  console.log("\nNada a enviar — já aplicado no vivo.");
  process.exit(0);
}

kit.backup(await kit.getLive(), "adcontext");
const { verify, activeAfter, finalActive } = await kit.safePut(wf, "adcontext");
const r = verify.nodes.find((n) => n.name === "Router Agent");
const b = verify.nodes.find((n) => n.name === "Bia 1");
console.log(JSON.stringify({
  wasActive,
  activeAfter,
  finalActive,
  newVersionId: verify.versionId ?? null,
  routerApplied: r.parameters.options.systemMessage.includes("REGRA DE ORIGEM POR ANÚNCIO"),
  bia1Applied: b.parameters.options.systemMessage.includes("REGRA DE ABERTURA POR ANÚNCIO"),
  workflowId: CONFIG.WORKFLOW_ID,
}, null, 2));
console.log("\nPróximo: node scripts/n8n/repasse-maint.mjs pull  (reconcilia o mirror decomposto)");
