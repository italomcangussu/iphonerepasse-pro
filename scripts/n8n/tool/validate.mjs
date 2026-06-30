// ============================================================================
// validate.mjs — asserção de sintaxe de cada JS + erros estruturais.
//
// `node --check` só roda sobre arquivo; aqui (em-processo) usamos `new Function()`
// para assertar a sintaxe do jsCode isolado — mesmo truque dos patch scripts
// (`new Function()` syntax-assert). Não EXECUTA o código.
// ============================================================================

import { structuralErrors } from "./extract.mjs";

export { structuralErrors };

/** Retorna {ok, error} para o source de um Code node. */
export function checkJsSource(source, label = "code") {
  try {
    // Envolve como corpo de função (n8n roda o jsCode como corpo, com return).
    new Function(source);
    return { ok: true, error: null };
  } catch (e) {
    return { ok: false, error: `${label}: ${e.message}` };
  }
}

/** Valida todos os Code nodes de um workflow. Retorna lista de erros. */
export function checkAllCode(workflow) {
  const errors = [];
  for (const n of workflow.nodes ?? []) {
    if (n.type === "n8n-nodes-base.code" && typeof n.parameters?.jsCode === "string") {
      const r = checkJsSource(n.parameters.jsCode, n.name);
      if (!r.ok) errors.push(r.error);
    }
  }
  return errors;
}

// ============================================================================
// secretScan — varre o workflow por segredos hardcoded (JWT/Bearer/api-keys)
// antes de commitar/deployar. É um AVISO, não um erro: o build/deploy seguem,
// mas o operador é alertado para não vazar JWT do Supabase, chave do n8n, etc.
//
// Em workflow.json saudável as credenciais vivem em `credentials` (referência
// por id/nome) e webhooks-trigger são só paths — um JWT/Bearer literal aqui é
// quase sempre um segredo coladado num Code node ou expressão. Padrões focados
// p/ minimizar falso-positivo; cada achado é REDIGIDO (não re-vaza o segredo).
// ============================================================================
const SECRET_PATTERNS = [
  { type: "jwt", re: /eyJ[A-Za-z0-9_-]{8,}\.eyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{6,}/g },
  { type: "bearer-token", re: /Bearer\s+[A-Za-z0-9._-]{24,}/gi },
  { type: "supabase-secret-key", re: /sb_secret_[A-Za-z0-9]{16,}/g },
  { type: "n8n-api-key", re: /n8n_api_[A-Za-z0-9]{16,}/g },
  { type: "openai-key", re: /sk-[A-Za-z0-9]{24,}/g },
  { type: "google-api-key", re: /AIza[A-Za-z0-9_-]{30,}/g },
];

/** Redige um segredo: mantém um prefixo curto, mascara o resto. */
function redact(s) {
  const head = s.slice(0, 8);
  return `${head}…(${s.length} chars)`;
}

/**
 * scanSecrets(workflow) — varre o JSON serializado e devolve achados
 * `[{type, sample, count}]` (deduplicados por valor; `sample` redigido).
 * PURA: aceita qualquer objeto/string serializável; não lê arquivos nem rede.
 */
export function scanSecrets(workflow) {
  const text = typeof workflow === "string" ? workflow : JSON.stringify(workflow);
  const byType = new Map();
  for (const { type, re } of SECRET_PATTERNS) {
    re.lastIndex = 0;
    let m;
    while ((m = re.exec(text)) !== null) {
      const value = m[0];
      const key = `${type}:${value}`;
      const prior = byType.get(key);
      if (prior) prior.count += 1;
      else byType.set(key, { type, sample: redact(value), count: 1 });
    }
  }
  return [...byType.values()];
}
