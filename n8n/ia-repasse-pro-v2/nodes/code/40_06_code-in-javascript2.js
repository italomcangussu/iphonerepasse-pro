// AUTO-HEADER (gerado por scripts/n8n/repasse-maint.mjs — re-gerado a cada pull)
// node:     Code in JavaScript2
// type:     n8n-nodes-base.code
// field:    jsCode
// stage:    40 router-memoria
// Edite SÓ o corpo abaixo da sentinela. 'build'/'deploy' remontam o workflow.json.
// ===== n8n-tool: NÃO EDITE ACIMA DESTA LINHA =====
// REPASSE LEAD_STATE ENUM NORMALIZE START
// Canônico: interest_type "trocar"; desired_condition "Novo"/"Seminovo".
// O LLM às vezes emite "troca"/"novo" — fora do enum → quebra o CHECK do
// upsert_lead_state (perde o estado inteiro) E o isIphonePurchaseFlow do roteamento.
function normInterestType(v) {
  if (v == null) return v;
  const s = String(v).trim().toLowerCase();
  if (s === 'troca') return 'trocar';
  if (s === 'compra') return 'comprar';
  if (s === 'venda') return 'vender';
  if (s === 'avaliacao' || s === 'avaliação') return 'avaliar';
  if (s === 'duvida' || s === 'dúvida') return 'duvida';
  return v;
}
function normCondition(v) {
  if (v == null) return v;
  const s = String(v).trim().toLowerCase();
  if (s === 'novo') return 'Novo';
  if (s === 'seminovo' || s === 'semi-novo' || s === 'semi novo') return 'Seminovo';
  return v;
}
// Normaliza campos que venham como "sim" ou "não" para booleano
// Ignora letras maiúsculas/minúsculas e aceita "nao" sem acento também.
function normSimNaoBoolean(v) {
  if (v == null) return v;
  if (typeof v !== 'string') return v;
  const s = v.trim().toLowerCase();
  if (s === 'sim') return true;
  if (s === 'não' || s === 'nao') return false;
  return v;
}
// Aplica a normalização de sim/não em qualquer campo do objeto,
// incluindo objetos e arrays aninhados.
function normalizeSimNaoFields(obj) {
  if (Array.isArray(obj)) {
    for (let i = 0; i < obj.length; i++) {
      if (obj[i] && typeof obj[i] === 'object') {
        normalizeSimNaoFields(obj[i]);
      } else {
        obj[i] = normSimNaoBoolean(obj[i]);
      }
    }
    return obj;
  }
  if (obj && typeof obj === 'object') {
    for (const key of Object.keys(obj)) {
      if (obj[key] && typeof obj[key] === 'object') {
        normalizeSimNaoFields(obj[key]);
      } else {
        obj[key] = normSimNaoBoolean(obj[key]);
      }
    }
  }
  return obj;
}
for (const item of $input.all()) {
  // Pega tudo o que está dentro do objeto e transforma na raiz do JSON
  item.json = $input.first().json.memory;
  if (item.json && typeof item.json === 'object') {
    item.json.interest_type = normInterestType(item.json.interest_type);
    item.json.desired_condition = normCondition(item.json.desired_condition);
    if (Array.isArray(item.json.desired_devices)) {
      for (const d of item.json.desired_devices) {
        if (d && typeof d === 'object') d.desired_condition = normCondition(d.desired_condition);
      }
    }
    normalizeSimNaoFields(item.json);
  }
}
// REPASSE LEAD_STATE ENUM NORMALIZE END

return $input.all();
