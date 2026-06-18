// AUTO-HEADER (gerado por scripts/n8n/repasse-maint.mjs — re-gerado a cada pull)
// node:     CODE MONTAR LINK REPASSE 2
// type:     n8n-nodes-base.code
// field:    jsCode
// stage:    80 links-envio
// Edite SÓ o corpo abaixo da sentinela. 'build'/'deploy' remontam o workflow.json.
// ===== n8n-tool: NÃO EDITE ACIMA DESTA LINHA =====
// ═══════════════════════════════════════════════════════════════════════════
// CODE MONTAR LINK REPASSE
//
// Responsabilidade:
//   Lê o output do Code Parse Bia 1 ou Bia 2 SEM ESTOQUE, constrói o link wa.me com
//   mensagem pré-preenchida quando intent = aparelho, e substitui o
//   placeholder [LINK] na mensagem da Bia pelo link encodado real.
//
//   Quando NÃO há [LINK] na mensagem nem repasse_message preenchido
//   (toda mensagem normal fora do fluxo de aparelho), o nó passa o
//   payload intocado sem appender nenhum link.
//
// Inputs esperados (aceita os dois formatos):
//   - Code Parse Bia 1 → campos em json.router  (message, transfer, repasse_message)
//   - Code Parse Bia 2 SEM ESTOQUE → campos em json.alana   (message, transfer, repasse_message)
//
// Output:
//   - json.alana.message          → mensagem final com link substituído (ou original)
//   - json.alana.transfer         → booleano de transferência
//   - json.alana.repasse_message  → texto original da mensagem pré-preenchida
//   - json.link_built             → link wa.me completo (null se não aplicável)
//   - json.repasse_truncated      → true se o texto foi truncado para caber no limite
//   - json.parse_ok               → sempre true
// ═══════════════════════════════════════════════════════════════════════════


// ── CONFIGURAÇÃO ─────────────────────────────────────────────────────────

var BASE_NUMBER = "5585991546796";
var BASE_LINK   = "https://wa.me/" + BASE_NUMBER;
var PLACEHOLDER = "[LINK]";
var MAX_CHARS   = 300; // limite seguro de caracteres antes do URL encoding


// ── UTILITÁRIOS ──────────────────────────────────────────────────────────

function isEmpty(value) {
  if (value === null) { return true; }
  if (value === undefined) { return true; }
  if (String(value).length === 0) { return true; }
  return false;
}

// Trunca mantendo palavras inteiras
function truncate(text, max) {
  if (text.length <= max) { return text; }
  var truncated = text.substring(0, max);
  var lastSpace = truncated.lastIndexOf(" ");
  if (lastSpace > 0) { truncated = truncated.substring(0, lastSpace); }
  return truncated;
}


// ── LEITURA DO INPUT ─────────────────────────────────────────────────────
// Aceita json.alana (Code Parse Bia 2 SEM ESTOQUE) ou json.router (Code Parse Bia 1)

var input = $input.first().json;
var alana = input.alana || input.router || {};

var message  = alana.message          || "";
var transfer = alana.transfer         || false;
var repasse  = alana.repasse_message  || "";
var deliveryMode = alana.delivery_mode || input.delivery_mode || "normal";


// ── LÓGICA DO LINK ───────────────────────────────────────────────────────
// Só age quando há [LINK] na mensagem OU repasse_message preenchido.
// Qualquer outra mensagem passa intocada — sem appender link.

var finalLink    = null;
var finalMessage = message;
var truncated    = false;

var hasPlaceholder = (message.indexOf(PLACEHOLDER) !== -1);
var hasRepasse     = !isEmpty(repasse);

if (hasPlaceholder || hasRepasse) {

  // Constrói o link com texto encodado quando há repasse_message
  if (hasRepasse) {
    var safeText = truncate(String(repasse).trim(), MAX_CHARS);
    truncated    = (String(repasse).trim().length > MAX_CHARS);
    var encoded  = encodeURIComponent(safeText);
    finalLink    = BASE_LINK + "?text=" + encoded;
  } else {
    // Há [LINK] mas sem repasse_message — usa link base sem texto
    finalLink = BASE_LINK;
  }

  // Substitui o placeholder pelo link montado
  if (hasPlaceholder) {
    // Estratégia 1: substitui o placeholder [LINK]
    finalMessage = message.replace(PLACEHOLDER, finalLink);
  } else if (message.indexOf(BASE_LINK) !== -1) {
  // Estratégia 2: substitui o link base escrito diretamente pela Bia
  finalMessage = message.replace(BASE_LINK, finalLink);
}
}


// ── RETORNO ──────────────────────────────────────────────────────────────

return [
  {
    json: {
      alana: {
        message:         finalMessage,
        transfer:        transfer,
        repasse_message: repasse,
        delivery_mode:     deliveryMode
      },
      link_built:        finalLink,
      repasse_truncated: truncated,
      parse_ok:          true,
      delivery_mode:     deliveryMode
    }
  }
];
