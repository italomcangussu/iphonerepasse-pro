// ============================================================================
// extract.mjs — decompõe/recompõe SÓ os campos de risco. Lógica pura, sem I/O.
//
// Alvos: Code nodes (jsCode) e prompts ESTÁTICOS de Agente. Prompt montado por
// expressão (string começa com `=`) NÃO é extraído — fica no workflow.json.
// ============================================================================

export const CODE_TYPE = "n8n-nodes-base.code";
export const AGENT_TYPE = "@n8n/n8n-nodes-langchain.agent";

// Campos de prompt candidatos, em ordem.
const PROMPT_FIELDS = [
  ["options", "systemMessage"],
  ["text"],
  ["system"],
];

function getPath(obj, segs) {
  let cur = obj;
  for (const s of segs) {
    if (cur == null || typeof cur !== "object") return undefined;
    cur = cur[s];
  }
  return cur;
}

function setPath(obj, segs, value) {
  let cur = obj;
  for (let i = 0; i < segs.length - 1; i++) {
    const s = segs[i];
    if (cur[s] == null || typeof cur[s] !== "object") cur[s] = {};
    cur = cur[s];
  }
  cur[segs[segs.length - 1]] = value;
}

/** Só extrai string que NÃO começa com `=` (prompt-expressão fica no JSON). */
export function isStaticPrompt(value) {
  return typeof value === "string" && value.length > 0 && !value.startsWith("=");
}

/** Localiza o campo de prompt de um node de agente. Retorna {segs,value} ou null. */
export function findPromptField(node) {
  const params = node.parameters ?? {};
  for (const segs of PROMPT_FIELDS) {
    const v = getPath(params, segs);
    if (typeof v === "string") return { segs, value: v };
  }
  return null;
}

/**
 * Decompõe o workflow nos alvos de risco.
 * @returns {Array<{kind:'code'|'prompt', node:string, field:string, content:string, type:string, expression:boolean}>}
 * Para prompts-expressão, retorna `expression:true` e NÃO os marca como extraídos.
 */
export function extractTargets(workflow) {
  const out = [];
  for (const node of workflow.nodes ?? []) {
    if (node.type === CODE_TYPE) {
      const code = node.parameters?.jsCode;
      if (typeof code === "string") {
        out.push({ kind: "code", node: node.name, field: "jsCode", content: code, type: node.type, expression: false });
      }
    } else if (node.type === AGENT_TYPE) {
      const found = findPromptField(node);
      if (found) {
        const expression = !isStaticPrompt(found.value);
        out.push({
          kind: "prompt",
          node: node.name,
          field: found.segs.join("."),
          content: found.value,
          type: node.type,
          expression, // true → fica no workflow.json, NÃO vira arquivo
        });
      }
    }
  }
  return out;
}

const PROMPT_SEGS_BY_FIELD = new Map(PROMPT_FIELDS.map((segs) => [segs.join("."), segs]));

/**
 * compose(base, edits): deep-copy da base e dá splice SÓ nos campos editados.
 * `edits` = Map<nodeName, { jsCode?:string, prompt?:{field,content} }>.
 * Conexões, posições, credenciais e nodes não-extraídos passam intactos.
 */
export function compose(base, edits) {
  const wf = structuredClone(base);
  const byName = new Map((wf.nodes ?? []).map((n) => [n.name, n]));
  for (const [name, edit] of edits) {
    const node = byName.get(name);
    if (!node) throw new Error(`compose: node ausente no workflow base: ${name}`);
    if (edit.jsCode != null) {
      if (node.type !== CODE_TYPE) throw new Error(`compose: ${name} não é Code node`);
      node.parameters = node.parameters ?? {};
      node.parameters.jsCode = edit.jsCode;
    }
    if (edit.prompt != null) {
      const segs = PROMPT_SEGS_BY_FIELD.get(edit.prompt.field);
      if (!segs) throw new Error(`compose: campo de prompt desconhecido: ${edit.prompt.field}`);
      node.parameters = node.parameters ?? {};
      setPath(node.parameters, segs, edit.prompt.content);
    }
  }
  return wf;
}

/** Valida que toda conexão aponta para node existente. Retorna lista de erros. */
export function structuralErrors(workflow) {
  const names = new Set((workflow.nodes ?? []).map((n) => n.name));
  const errors = [];
  const conns = workflow.connections ?? {};
  for (const [source, outputs] of Object.entries(conns)) {
    if (!names.has(source)) errors.push(`conexão de origem inexistente: ${source}`);
    for (const groups of Object.values(outputs ?? {})) {
      for (const group of groups ?? []) {
        for (const link of group ?? []) {
          if (link && !names.has(link.node)) {
            errors.push(`conexão ${source} → node inexistente: ${link.node}`);
          }
        }
      }
    }
  }
  return errors;
}
