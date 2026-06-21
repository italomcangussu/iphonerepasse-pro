import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadBlock } from '../parsers/load.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const BLOCK = path.resolve(HERE, '../parsers/blocks/buffer_pending_detail.block.js');
const LIVE_MEMORY2 = path.resolve(HERE, '../../../../n8n/ia-repasse-pro-v2/nodes/code/40_05_code-parse-memory-2.js');
const { classifyBiaQuestion, replyContainsDetail, isAffirmative, decideBufferWait } = loadBlock(
  'buffer_pending_detail.block.js',
  ['classifyBiaQuestion', 'replyContainsDetail', 'isAffirmative', 'decideBufferWait'],
);

test('classifyBiaQuestion casa o opener real de entrada (parte do pagamento)', () => {
  assert.equal(classifyBiaQuestion('Você tem algum iPhone pra dar como parte do pagamento? Se tiver, me conta qual modelo.'), 'tradein_model');
  assert.equal(classifyBiaQuestion('Qual modelo é o iPhone que você vai dar como entrada?'), 'tradein_model');
  assert.equal(classifyBiaQuestion('Quer dar algum valor de entrada no Pix?'), 'cash_entry');
  assert.equal(classifyBiaQuestion('Qual modelo você está procurando?'), 'desired_model');
  assert.equal(classifyBiaQuestion('Qual a capacidade? quantos GB?'), 'desired_capacity');
  assert.equal(classifyBiaQuestion('E a cor, qual prefere?'), 'desired_color');
  assert.equal(classifyBiaQuestion('Beleza, fechado então!'), null);
});

test('replyContainsDetail detecta resposta completa', () => {
  assert.equal(replyContainsDetail('14pm', 'tradein_model'), true);
  assert.equal(replyContainsDetail('iphone 13', 'desired_model'), true);
  assert.equal(replyContainsDetail('128gb', 'desired_capacity'), true);
  assert.equal(replyContainsDetail('preto', 'desired_color'), true);
  assert.equal(replyContainsDetail('500', 'cash_entry'), true);
  assert.equal(replyContainsDetail('Sim', 'tradein_model'), false);
});

test('isAffirmative', () => {
  assert.equal(isAffirmative('Sim'), true);
  assert.equal(isAffirmative('tenho sim'), true);
  assert.equal(isAffirmative('14pm'), false);
});

test('decideBufferWait: ESTENDE no cenário do bug (Sim isolado, pergunta de entrada pendente)', () => {
  const r = decideBufferWait({
    messages: [{ text: 'Sim', type: 'text' }],
    lastBotText: 'Você tem algum iPhone pra dar como parte do pagamento? Se tiver, me conta qual modelo.',
    baseSeconds: 15, baseReason: 'resposta_curta_segura_15s',
  });
  assert.equal(r.seconds, 40);
  assert.match(r.reason, /^pending_detail_extend:tradein_model$/);
});

test('decideBufferWait: NÃO estende se já veio o modelo de uma vez', () => {
  const r = decideBufferWait({
    messages: [{ text: '14pm', type: 'text' }],
    lastBotText: 'Qual modelo é o iPhone que você vai dar como entrada?',
    baseSeconds: 15, baseReason: 'resposta_curta_segura_15s',
  });
  assert.equal(r.seconds, 15);
});

test('decideBufferWait: NÃO estende sem pergunta pendente', () => {
  const r = decideBufferWait({
    messages: [{ text: 'Sim', type: 'text' }],
    lastBotText: 'Show, vou verificar aqui pra você!',
    baseSeconds: 15, baseReason: 'resposta_curta_segura_15s',
  });
  assert.equal(r.seconds, 15);
});

test('decideBufferWait: NÃO estende com múltiplas mensagens no buffer', () => {
  const r = decideBufferWait({
    messages: [{ text: 'Sim', type: 'text' }, { text: '14pm', type: 'text' }],
    lastBotText: 'Você tem algum iPhone pra dar como parte do pagamento?',
    baseSeconds: 25, baseReason: 'fallback_25s_buffer_com_multiplas_mensagens',
  });
  assert.equal(r.seconds, 25);
});

test('decideBufferWait: NÃO estende em mídia/áudio', () => {
  const r = decideBufferWait({
    messages: [{ text: 'Sim', type: 'audioMessage' }],
    lastBotText: 'Você tem algum iPhone pra dar como parte do pagamento?',
    baseSeconds: 25, baseReason: 'fallback_25s_midia_ou_tipo_complexo',
  });
  assert.equal(r.seconds, 25);
});

// CONSISTÊNCIA DE DUPLICAÇÃO: o regex de classifyBiaQuestion do bloco deve casar
// byte-a-byte com o do nó VIVO Code Parse Memory 2 (a fonte operacional de verdade).
test('classifyBiaQuestion: regexes idênticos ao nó vivo Memory 2', () => {
  const blockSrc = fs.readFileSync(BLOCK, 'utf8');
  const liveSrc = fs.readFileSync(LIVE_MEMORY2, 'utf8');
  const grab = (src, ret) => {
    const re = new RegExp(`if \\((\\/[^\\n]*?)\\.test\\(t\\)\\) return '${ret}';`);
    const m = src.match(re);
    assert.ok(m, `regex p/ ${ret} não encontrado`);
    return m[1];
  };
  for (const ret of ['cash_entry', 'tradein_model', 'desired_model', 'desired_capacity', 'desired_color']) {
    assert.equal(grab(blockSrc, ret), grab(liveSrc, ret), `regex divergente p/ ${ret}`);
  }
});
