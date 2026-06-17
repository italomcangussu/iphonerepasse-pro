// AUTO-HEADER (gerado por scripts/n8n/repasse-maint.mjs — re-gerado a cada pull)
// node:     Split Out3
// type:     n8n-nodes-base.code
// field:    jsCode
// stage:    80 links-envio
// Edite SÓ o corpo abaixo da sentinela. 'build'/'deploy' remontam o workflow.json.
// ===== n8n-tool: NÃO EDITE ACIMA DESTA LINHA =====
// ═══════════════════════════════════════════════════════════════════════
// CODE SPLIT OUT — quebra a resposta em bolhas curtas (estilo conversa humana)
// Alvo: 1–2 frases por mensagem; teto absoluto de 3 frases.
// Preserva como UMA mensagem: delivery_mode "atomic" (questionário trade-in),
// blocos estruturados (cadastro / questionário "R:") e simulações (proposta
// com preços/parcelas). Saída count-agnostic: formattedResponse.messages.
// Propaga transfer, repasse_message e link_built para os nós de envio.
// ═══════════════════════════════════════════════════════════════════════

var input = $input.first().json;

var alana      = input.alana || {};
var textoRaw   = alana.message || "";
var transfer   = alana.transfer || false;
var repasseMsg = alana.repasse_message || null;
var linkBuilt  = input.link_built || null;

var normalized = String(textoRaw)
  .replace(/\r?\n/g, "\n")
  .replace(/"/g, "'")
  .trim();

// Quebra em frases: pontuação final seguida de espaço e início de nova frase.
// Não quebra decimais (1.299) nem URLs (sem espaço após o ponto). Parágrafos
// (\n\n) são fronteiras fortes; \n simples vira espaço dentro do bloco.
function splitSentences(s) {
  var out = [];
  var blocks = s.split(/\n{2,}/);
  for (var b = 0; b < blocks.length; b++) {
    var block = blocks[b].replace(/\n/g, " ").trim();
    if (!block) continue;
    var re = /([.?!…])\s+(?=[A-ZÁÉÍÓÚÂÊÔÃÕÇ0-9"'(])/g;
    var last = 0, m;
    while ((m = re.exec(block)) !== null) {
      var cut = m.index + m[0].length;
      out.push(block.slice(last, cut).trim());
      last = cut;
    }
    if (last < block.length) out.push(block.slice(last).trim());
  }
  return out.filter(Boolean);
}

// Agrupa frases em bolhas: alvo 1–2 frases, teto 3, mescla fragmentos curtos
// (ex.: "Show!") para não enviar bolhas minúsculas demais.
function groupSentences(sents) {
  var SOFT_CHARS = 170;
  var msgs = [];
  var cur = "";
  var count = 0;
  for (var i = 0; i < sents.length; i++) {
    var sent = sents[i];
    if (cur === "") { cur = sent; count = 1; continue; }
    var merged = cur + " " + sent;
    var curIsTiny = cur.length < 45;
    var withinSoft = (count + 1) <= 2 && merged.length <= SOFT_CHARS;
    var canAttach = count < 3 && (curIsTiny || withinSoft);
    if (canAttach) { cur = merged; count += 1; }
    else { msgs.push(cur); cur = sent; count = 1; }
  }
  if (cur) msgs.push(cur);
  return msgs;
}

// Bloco estruturado (questionário trade-in "R:" / cadastro): não fragmentar —
// o cliente copia/edita como UMA mensagem no WhatsApp.
function isStructuredBlock(s) {
  var lines = String(s).split("\n");
  var rCount = 0, labelCount = 0;
  for (var i = 0; i < lines.length; i++) {
    var t = lines[i].trim();
    if (t === "R:") rCount++;
    if (t.length > 0 && t.length <= 40 && t.charAt(t.length - 1) === ":") labelCount++;
  }
  return rCount >= 2 || labelCount >= 3;
}

// Simulação / proposta de preço: preservar a mensagem inteira (à vista + parcelas).
function looksLikeSimulation(s) {
  var installments = (s.match(/\b\d{1,2}\s?x\b/gi) || []).length;
  var prices = (s.match(/R\$\s?\d/gi) || []).length;
  return installments >= 2 || prices >= 3;
}

var deliveryMode = input.delivery_mode || alana.delivery_mode || "normal";
var preserveWhole = deliveryMode === "atomic"
  || isStructuredBlock(normalized)
  || looksLikeSimulation(normalized);

var parts = preserveWhole ? [normalized] : groupSentences(splitSentences(normalized));
if (parts.length === 0) { parts = [normalized]; }

var messages = [];
for (var i = 0; i < parts.length; i++) {
  if (parts[i]) { messages.push({ key: "string" + (i + 1), text: parts[i] }); }
}

return [
  {
    json: {
      formattedResponse: {
        messages: messages,
        meta: {
          total:     messages.length,
          preserved: preserveWhole,
          hasSecond: Boolean(messages[1]),
          hasThird:  Boolean(messages[2])
        }
      },
      transfer:        transfer,
      repasse_message: repasseMsg,
      link_built:      linkBuilt
    }
  }
];
