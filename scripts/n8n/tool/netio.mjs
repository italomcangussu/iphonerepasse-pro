// ============================================================================
// netio.mjs — I/O de rede + leitura do segredo. NUNCA imprime/loga a chave.
// ============================================================================

import fs from "node:fs";
import path from "node:path";
import { CONFIG } from "./config.mjs";

/** Parser simples de `chave=valor` (ignora `#`/vazias, tira aspas). */
export function readEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return {};
  const env = {};
  for (const line of fs.readFileSync(filePath, "utf8").split(/\r?\n/)) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const m = t.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);
    if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
  return env;
}

function firstDefined(env, keys) {
  for (const k of keys) {
    if (process.env[k]) return process.env[k];
    if (env[k]) return env[k];
  }
  return undefined;
}

/** Resolve { apiKey, origin } sem nunca expor o valor. */
export function resolveAccess() {
  const env = readEnvFile(path.resolve(CONFIG.ENV_FILE));
  const apiKey = firstDefined(env, CONFIG.ENV_KEYS);
  const rawBase = firstDefined(env, CONFIG.BASE_URL_KEYS);
  let origin = CONFIG.FALLBACK_ORIGIN;
  if (rawBase) {
    try {
      origin = new URL(rawBase).origin;
    } catch {
      /* mantém fallback */
    }
  }
  return { apiKey, origin };
}

async function request(method, pathname, body) {
  const { apiKey, origin } = resolveAccess();
  if (!apiKey) {
    throw new Error(
      `Chave de API ausente: defina ${CONFIG.ENV_KEYS.join("/")} em ${CONFIG.ENV_FILE}. ` +
        `Use a chave de API DA CONTA (JWT eyJ… de Settings → API), não o segredo de webhook.`,
    );
  }
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), CONFIG.FETCH_TIMEOUT_MS);
  try {
    const r = await fetch(`${origin}${pathname}`, {
      method,
      headers: { [CONFIG.API_HEADER]: apiKey, "Content-Type": "application/json" },
      body: body == null ? undefined : JSON.stringify(body),
      signal: ctrl.signal,
    });
    const text = await r.text();
    if (!r.ok) {
      // Levanta com o corpo da resposta para ver o 400/401 real.
      throw new Error(`n8n API ${method} ${r.status}: ${text.slice(0, 600)}`);
    }
    return text ? JSON.parse(text) : null;
  } finally {
    clearTimeout(timer);
  }
}

export const getWorkflow = (id = CONFIG.WORKFLOW_ID) =>
  request("GET", `/api/v1/workflows/${id}`);

export const putWorkflow = (body, id = CONFIG.WORKFLOW_ID) =>
  request("PUT", `/api/v1/workflows/${id}`, body);

export const activateWorkflow = (id = CONFIG.WORKFLOW_ID) =>
  request("POST", `/api/v1/workflows/${id}/activate`);
