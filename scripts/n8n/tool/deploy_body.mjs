// ============================================================================
// deploy_body.mjs — corpo do PUT à prova do schema de escrita. Lógica pura.
//
// O PUT SUBSTITUI o workflow. Envie só `name, nodes, connections, settings`.
// `settings` é additionalProperties:false → só chaves do allowlist; campos que o
// GET devolve mas o PUT recusa (ex.: `timeSavedMode`) causam HTTP 400 e são
// removidos aqui. Ver docs/n8n-maintainability-recipe.md → "Regras do PUT".
// ============================================================================

// Allowlist do schema workflowSettings (confirme via GET .../openapi.yml na sua instância).
export const SETTINGS_ALLOWLIST = [
  "saveExecutionProgress",
  "saveManualExecutions",
  "saveDataErrorExecution",
  "saveDataSuccessExecution",
  "executionTimeout",
  "errorWorkflow",
  "timezone",
  "executionOrder",
  "callerPolicy",
  "callerIds",
  "timeSavedPerExecution",
  "availableInMCP",
];

// Campos que o GET devolve mas o PUT NÃO aceita (causa 400). Documentados aqui
// para o erro ser explícito caso a instância mude.
export const SETTINGS_REJECTED = ["timeSavedMode"];

export function buildSettings(rawSettings = {}) {
  const out = {};
  for (const key of SETTINGS_ALLOWLIST) {
    if (rawSettings[key] !== undefined) out[key] = rawSettings[key];
  }
  // Default exigido pela API.
  if (out.executionOrder == null) out.executionOrder = "v1";
  return out;
}

/** Monta o corpo do PUT a partir do workflow (vivo fresco + edições). */
export function buildPutBody(workflow) {
  return {
    name: workflow.name,
    nodes: workflow.nodes,
    connections: workflow.connections,
    settings: buildSettings(workflow.settings ?? {}),
  };
}

/** Cópia portável para reimportar noutra instância (active:false). */
export function buildImportBody(workflow) {
  return {
    name: workflow.name,
    nodes: workflow.nodes,
    connections: workflow.connections,
    settings: buildSettings(workflow.settings ?? {}),
    active: false,
  };
}
