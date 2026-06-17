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
