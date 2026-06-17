// ============================================================================
// load.mjs — materializa as FUNÇÕES PURAS dos parsers a partir dos blocos
// canônicos byte-extraídos dos nós vivos (blocks/*.block.js).
//
// Os Code nodes do n8n não fazem `require()` de módulos locais, então a lógica
// pura (color-guard, json-repair, decisão de trade-in) vive INLINE em vários
// nós. Estes blocos são a fonte canônica única; o mesmo texto é injetado nos
// nós (como o humanizer já faz via N8N_HUMANIZER_BLOCK). `loadBlock` avalia o
// bloco isoladamente (sem globais n8n — os blocos são puros) e expõe as funções
// para teste de caracterização + fidelidade. NÃO executa lógica de nó.
// ============================================================================

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
export const BLOCKS_DIR = path.join(HERE, "blocks");

/** Lê um bloco canônico e devolve {names...} avaliando-o num escopo isolado. */
export function loadBlock(fileName, exportNames) {
  const src = fs.readFileSync(path.join(BLOCKS_DIR, fileName), "utf8");
  // O bloco é puro (sem $json/$input/$()). new Function isola o escopo; as
  // declarações `function`/`const` viram locais e são devolvidas por nome.
  const factory = new Function(`${src}\n;return { ${exportNames.join(", ")} };`);
  const out = factory();
  for (const name of exportNames) {
    if (!(name in out)) throw new Error(`loadBlock(${fileName}): export ausente "${name}"`);
  }
  return out;
}

export const readBlock = (fileName) => fs.readFileSync(path.join(BLOCKS_DIR, fileName), "utf8");
