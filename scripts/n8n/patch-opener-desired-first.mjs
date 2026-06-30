import * as kit from "./tool/patch-kit.mjs";

// Opener: ask the DESIRED model first; defer the current-device (trade-in) question
// to the SECOND interaction (2026-06-20).
//
// Why: asking "qual deseja comprar? E qual o aparelho atual?" in the very first
// message made desired_model vs tradein_model ambiguous (the client often answers
// with one model and the reconciler can't tell which slot it belongs to). Asking
// only the desired model first makes turn-1 unambiguous; the existing "COLETA DO
// APARELHO ATUAL" rule already asks for the current device on the next turn. This
// also strengthens the just-deployed reclass gate (classifyBiaQuestion now sees a
// clean standalone current-device question instead of a combined opener).
//
// Edits (idempotent, exact-string, asserted unique):
//  - Bia 1 + Bia 2 ESTOQUE: drop the current-device clause from the opener message
//    and reword the lead-in to "ask the desired only; current device comes next".
//  - Memory 2 - Reconciler: decouple the trade-in disambiguation from "abertura",
//    so "last bot message asked the current device" keeps routing the answer to
//    tradein_model on the standalone second turn.
//
// Migrado para tool/patch-kit.mjs (Fase 5): I/O único. DRY=1 lê o snapshot.

const OPENER_OLD = 'deseja comprar? E qual o modelo do seu aparelho atual?"';
const OPENER_NEW = 'deseja comprar?"';
const LEADIN_OLD = 'as perguntas de compra e de aparelho atual:';
const LEADIN_NEW = 'a pergunta de compra (pergunte SÓ o aparelho desejado nesta primeira mensagem; o aparelho atual fica para a próxima interação):';
const RECON_OLD = 'se a ULTIMA mensagem do atendimento foi a abertura/saudacao perguntando o APARELHO ATUAL do cliente';
const RECON_NEW = 'se a ULTIMA mensagem do atendimento perguntou o APARELHO ATUAL do cliente';

const EDITS = [
  { node: 'Bia 1', old: LEADIN_OLD, new: LEADIN_NEW },
  { node: 'Bia 1', old: OPENER_OLD, new: OPENER_NEW },
  { node: 'Bia 2 ESTOQUE', old: LEADIN_OLD, new: LEADIN_NEW },
  { node: 'Bia 2 ESTOQUE', old: OPENER_OLD, new: OPENER_NEW },
  { node: 'Memory 2 - Reconciler', old: RECON_OLD, new: RECON_NEW },
];

// Agent prompts live in parameters.text (Bia*) and/or parameters.options.systemMessage
// (Reconciler has both). Return every editable prompt field so the caller can pick
// the one that actually contains the target string.
function getPromptFields(node) {
  const p = node.parameters || {};
  const fields = [];
  if (typeof p.text === 'string') fields.push({ kind: 'text', get: () => p.text, set: (v) => { p.text = v; } });
  if (p.options && typeof p.options.systemMessage === 'string') {
    fields.push({ kind: 'systemMessage', get: () => p.options.systemMessage, set: (v) => { p.options.systemMessage = v; } });
  }
  return fields;
}

const workflow = await kit.loadWorkflow();

const results = [];
for (const edit of EDITS) {
  const node = workflow.nodes.find((n) => n.name === edit.node);
  if (!node) throw new Error(`Node not found: ${edit.node}`);
  const fields = getPromptFields(node);
  if (!fields.length) throw new Error(`${edit.node}: no editable prompt field`);

  // Already applied if the new string is present and the old one is gone anywhere.
  const alreadyApplied = fields.some((f) => !f.get().includes(edit.old) && f.get().includes(edit.new));
  const oldFields = fields.filter((f) => f.get().includes(edit.old));
  if (oldFields.length === 0 && alreadyApplied) { results.push({ node: edit.node, status: 'already-applied' }); continue; }

  const totalOld = fields.reduce((sum, f) => sum + (f.get().split(edit.old).length - 1), 0);
  if (totalOld !== 1) throw new Error(`${edit.node}: expected exactly 1 match for old string, found ${totalOld} (drift? run the live guard). old="${edit.old.slice(0, 40)}..."`);

  const field = oldFields[0];
  field.set(field.get().replace(edit.old, edit.new));
  results.push({ node: edit.node, status: 'patched', field: field.kind });
}

const anyPatched = results.some((r) => r.status === 'patched');
if (!anyPatched) {
  console.log(JSON.stringify({ skipped: true, reason: 'all edits already applied', results }, null, 2));
  process.exit(0);
}

if (process.env.DRY === '1') {
  console.log(JSON.stringify({ dry: true, results }, null, 2));
  process.exit(0);
}

kit.backup(await kit.getLive(), "opener-desired-first");
const { activeAfter, finalActive } = await kit.safePut(workflow, "opener-desired-first");
console.log(JSON.stringify({ patched: true, results, activeAfter, finalActive }, null, 2));
