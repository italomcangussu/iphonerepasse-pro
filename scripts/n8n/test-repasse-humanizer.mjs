import assert from 'node:assert/strict';
import { repasseHumanizeMessage, N8N_HUMANIZER_BLOCK, HUMANIZER_MARKER_START, HUMANIZER_MARKER_END } from './repasse-humanizer.mjs';

const cases = [
  // travessão com espaços, continuação minúscula → vírgula
  ['tenho o 15 Pro Max — se tiver interesse, já simulo',
   'tenho o 15 Pro Max, se tiver interesse, já simulo'],
  // travessão antes de maiúscula → ponto
  ['costuma chegar no mesmo dia — Quer que eu te avise?',
   'costuma chegar no mesmo dia. Quer que eu te avise?'],
  // en-dash igual a em-dash
  ['valor à vista – no cartão muda conforme as parcelas',
   'valor à vista, no cartão muda conforme as parcelas'],
  // travessão colado → vírgula
  ['não sou bot que dá raiva—se preferir um atendente é só pedir',
   'não sou bot que dá raiva, se preferir um atendente é só pedir'],
  // faixa numérica vira hífen, não vírgula
  ['funcionamos de 9h—22h todos os dias', 'funcionamos de 9h-22h todos os dias'],
  // bullet de linha vira hífen simples
  ['Opções:\n— 128GB\n— 256GB', 'Opções:\n- 128GB\n- 256GB'],
  // ponto-e-vírgula vira ponto
  ['a condição continua valendo; quer seguir?', 'a condição continua valendo. quer seguir?'],
  // ponto-e-vírgula no fim
  ['fechado então;', 'fechado então.'],
  // URL preservada (inclusive ; dentro dela), travessão fora corrigido
  ['o link é https://wa.me/5585999640050?a=1;b=2 — me chama lá',
   'o link é https://wa.me/5585999640050?a=1;b=2, me chama lá'],
  // exclamações: colapsa repetidas e mantém só a primeira
  ['Show!! Que legal! Vamos fechar!', 'Show! Que legal. Vamos fechar.'],
  // texto limpo intocado (lista operacional com \n e R:)
  ['Me responde aí:\n\nQual % de bateria?\nR:\nPossui caixa e cabo originais?\nR:',
   'Me responde aí:\n\nQual % de bateria?\nR:\nPossui caixa e cabo originais?\nR:'],
  // bloco PIX com asteriscos/quebras preservado
  ['*Chave Pix iPhone Repasse*\nCNPJ: 63733688000139\nBanco Inter',
   '*Chave Pix iPhone Repasse*\nCNPJ: 63733688000139\nBanco Inter'],
];

let failed = 0;
for (const [input, expected] of cases) {
  const got = repasseHumanizeMessage(input);
  try {
    assert.equal(got, expected);
  } catch {
    failed += 1;
    console.error(`FAIL\n  in : ${JSON.stringify(input)}\n  got: ${JSON.stringify(got)}\n  exp: ${JSON.stringify(expected)}`);
  }
}

// não-string passa direto
assert.equal(repasseHumanizeMessage(null), null);
assert.equal(repasseHumanizeMessage(undefined), undefined);
assert.deepEqual(repasseHumanizeMessage({ a: 1 }), { a: 1 });

// bloco injetável: marcadores presentes e código parseável com a função utilizável
assert.ok(N8N_HUMANIZER_BLOCK.startsWith(HUMANIZER_MARKER_START));
assert.ok(N8N_HUMANIZER_BLOCK.trimEnd().endsWith(HUMANIZER_MARKER_END));
const injected = new Function(`${N8N_HUMANIZER_BLOCK}\nreturn repasseHumanizeMessage("a — b");`)();
assert.equal(injected, 'a, b');

if (failed) {
  console.error(`${failed} case(s) failed`);
  process.exit(1);
}
console.log(`repasse-humanizer: ${cases.length} cases + block parity passed`);
