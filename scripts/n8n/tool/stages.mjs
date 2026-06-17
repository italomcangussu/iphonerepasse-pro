// ============================================================================
// stages.mjs — nomes determinísticos por STAGE. Lógica pura.
//
// ADAPTAÇÃO ao iPhoneRepasse Pro: a receita original numera nodes no canvas
// (prefixo `00 …`). Aqui o canvas NÃO é renomeado (450 refs $('Nome') + 25 patch
// scripts quebrariam). Em vez disso, o stage é inferido pela POSIÇÃO x do node
// contra as faixas declaradas em stages.json — o layout já é esquerda→direita.
// ============================================================================

export function slug(name) {
  return String(name)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60) || "node";
}

/**
 * Atribui stage a cada node pela faixa de x.
 * @param {Array} nodes nodes do workflow
 * @param {Array<{id:string,label:string,xMin:number,xMax:number}>} bands de stages.json
 * @returns Map<nodeName, {id,label}>
 */
export function assignStages(nodes, bands) {
  const sorted = [...bands].sort((a, b) => a.xMin - b.xMin);
  const fallback = sorted[sorted.length - 1] ?? { id: "99", label: "outros" };
  const map = new Map();
  for (const n of nodes) {
    const x = Array.isArray(n.position) ? n.position[0] : 0;
    const band = sorted.find((b) => x >= b.xMin && x < b.xMax) ?? fallback;
    map.set(n.name, { id: band.id, label: band.label });
  }
  return map;
}

/**
 * Gera nome de arquivo `<stage>_<seq>_<slug>.<ext>`, de-duplicado.
 * `seq` é uma sequência por-stage (2 dígitos) seguindo a ordem passada.
 */
export function makeFilenamer() {
  const used = new Set();
  const seqByStage = new Map();
  return function filename(stageId, name, ext) {
    const n = (seqByStage.get(stageId) ?? 0) + 1;
    seqByStage.set(stageId, n);
    const seq = String(n).padStart(2, "0");
    let base = `${stageId}_${seq}_${slug(name)}`;
    let candidate = `${base}.${ext}`;
    let i = 2;
    while (used.has(candidate)) candidate = `${base}-${i++}.${ext}`;
    used.add(candidate);
    return candidate;
  };
}

/**
 * Ordena os alvos por (x, y) — ordem de execução visual — e devolve cada um
 * com seu stage e filename atribuídos.
 */
export function planFiles(targets, nodesByName, bands) {
  const stages = assignStages([...nodesByName.values()], bands);
  const enriched = targets.map((t) => {
    const node = nodesByName.get(t.node);
    const pos = node?.position ?? [0, 0];
    return { ...t, x: pos[0], y: pos[1], stage: stages.get(t.node) ?? { id: "99", label: "outros" } };
  });
  enriched.sort((a, b) => a.x - b.x || a.y - b.y || a.node.localeCompare(b.node));
  const namer = makeFilenamer();
  for (const t of enriched) {
    const ext = t.kind === "code" ? "js" : "md";
    t.filename = namer(t.stage.id, t.node, ext);
  }
  return enriched;
}
