// AUTO-HEADER (gerado por scripts/n8n/repasse-maint.mjs — re-gerado a cada pull)
// node:     Code Parse Re-simulacao Bia 2 ESTOQUE
// type:     n8n-nodes-base.code
// field:    jsCode
// stage:    70 agentes-bia
// Edite SÓ o corpo abaixo da sentinela. 'build'/'deploy' remontam o workflow.json.
// ===== n8n-tool: NÃO EDITE ACIMA DESTA LINHA =====
// REPASSE HUMANIZER START
// Sanitiza caguetes de IA na mensagem final (travessão, ponto-e-vírgula, excesso de exclamação).
// Gerado de scripts/n8n/repasse-humanizer.mjs — edite lá e reaplique via apply-repasse-humanizer.mjs.
function repasseHumanizeMessage(text) {
  if (typeof text !== 'string') return text;
  // bullet de início de linha: "— item" → "- item" (no texto inteiro: travessão
  // em início de linha nunca faz parte de URL, e o split abaixo quebraria o ^)
  const bulleted = text.replace(/(^|\n)[ \t]*[—–][ \t]+/g, '$1- ');
  const parts = bulleted.split(/(https?:\/\/[^\s]+)/g);
  for (let i = 0; i < parts.length; i += 1) {
    if (i % 2 === 1) continue; // índices ímpares são URLs (grupo de captura do split)
    let seg = parts[i];
    // faixa numérica: 9h—22h → 9h-22h (antes das regras de vírgula)
    seg = seg.replace(/(\d[a-z]?)[—–](\d)/gi, '$1-$2');
    // travessão com espaços antes de maiúscula → vira ponto
    seg = seg.replace(/[ \t]+[—–][ \t]+(?=[A-ZÁÀÂÃÉÊÍÓÔÕÚÜÇ])/g, '. ');
    // travessão com espaços nos demais casos → vira vírgula
    seg = seg.replace(/[ \t]+[—–][ \t]+/g, ', ');
    // travessão colado entre palavras → vírgula
    seg = seg.replace(/([^\s])[—–](?=[^\s])/g, '$1, ');
    // ponto-e-vírgula → ponto (ninguém digita ; no WhatsApp)
    seg = seg.replace(/[ \t]*;[ \t]*(?=\S)/g, '. ');
    seg = seg.replace(/[ \t]*;/g, '.');
    parts[i] = seg;
  }
  let out = parts.join('');
  // exclamações: colapsa repetidas e mantém só a primeira da mensagem
  out = out.replace(/!{2,}/g, '!');
  let seenBang = false;
  out = out.replace(/!/g, () => {
    if (!seenBang) { seenBang = true; return '!'; }
    return '.';
  });
  // espaços duplicados criados pelas trocas (preserva \n)
  out = out.replace(/ {2,}/g, ' ');
  return out;
}
// REPASSE HUMANIZER END

const inputData = $input.first().json;
let raw = String(inputData.output || '').trim();
raw = raw.replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/```$/i, '').trim();

let decision = null;
try {
  decision = JSON.parse(raw);
} catch (error) {
  return [];
}

if (decision && typeof decision.message === "string") { decision.message = repasseHumanizeMessage(decision.message); }

if (decision?.rerun_simulation !== true) {
  return [];
}

let sourceContext = {};
try {
  sourceContext = $('Edit Fields10').first().json ?? {};
} catch (error) {
  sourceContext = {};
}

// REPASSE RESIM REATTACH TRADEIN: a "Bia 2 ESTOQUE" (agent) dropa o contexto e
// este parse só carrega Edit Fields10 (sem trade-in). Sem reanexar, o Montar
// Body re-simula SEM o aparelho de entrada. Reanexa trade-in/entrada/cartão/
// desejo a partir do estado persistido em "Code Refresh Lead State Before Switch2".
let leadCtx = {};
try { leadCtx = $('Code Refresh Lead State Before Switch2').last().json ?? {}; } catch (error) { leadCtx = {}; }
const reattach = {};
for (const k of [
  'has_tradein', 'tradein_model', 'tradein_model_accepted', 'tradein_disqualified',
  'tradein_capacity', 'tradein_color', 'tradein_battery_pct',
  'cash_entry_amount', 'card_brand',
  'desired_model', 'desired_capacity', 'desired_color', 'desired_condition'
]) {
  const v = leadCtx[k] ?? leadCtx.memory?.[k] ?? leadCtx.lead_state?.[k];
  if (v !== undefined && v !== null) reattach[k] = v;
}

return [
  {
    json: {
      ...sourceContext,
      ...inputData,
      ...reattach,
      router: decision,
      rerun_simulation_requested: true
    }
  }
];
