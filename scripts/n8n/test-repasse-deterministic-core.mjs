import assert from 'node:assert/strict';
import {
  buildAtomicTradeInResponse,
  deriveTradeInDecision,
  getMissingTradeInFields,
  resolveSimulationMode,
} from './repasse-deterministic-core.mjs';

const partial = {
  has_tradein: true,
  tradein_model: 'iPhone 13',
  tradein_capacity: '128GB',
  tradein_color: 'preto',
  tradein_scratches: false,
  tradein_liquid_contact: false,
  tradein_side_marks: null,
  tradein_parts_swapped: null,
  tradein_has_box_cable: true,
  tradein_battery_pct: 86,
  tradein_apple_warranty: false,
};

assert.deepEqual(getMissingTradeInFields(partial), ['tradein_side_marks', 'tradein_parts_swapped']);

assert.deepEqual(deriveTradeInDecision({
  ...partial,
  last_message_content: '',
  message_buffered: 'quero trocar meu iphone 13',
}), {
  status: 'awaiting_consent',
  action: 'ask_tradein_consent',
  missingFields: ['tradein_side_marks', 'tradein_parts_swapped'],
  canSimulate: false,
});

const collecting = deriveTradeInDecision({
  ...partial,
  last_message_content: 'Posso te mandar as perguntas rápidas de avaliação?',
  message_buffered: 'sim, pode mandar',
});
assert.equal(collecting.status, 'collecting');
assert.equal(collecting.action, 'send_tradein_questionnaire');
assert.equal(collecting.canSimulate, false);

const atomic = buildAtomicTradeInResponse(partial, collecting);
assert.equal(atomic.delivery_mode, 'atomic');
assert.match(atomic.message, /marcas de uso na lateral\?\nR:/i);
assert.match(atomic.message, /troca de alguma peça\?\nR:/i);
assert.equal((atomic.message.match(/\nR:/g) || []).length, 2);

assert.equal(resolveSimulationMode('iPhone 15 ou 16, qual compensa?', 2), 'comparison');
assert.equal(resolveSimulationMode('quero comprar os dois aparelhos', 2), 'bundle');
assert.equal(resolveSimulationMode('quero o iPhone 16', 1), 'single');

const complete = deriveTradeInDecision({
  ...partial,
  tradein_side_marks: false,
  tradein_parts_swapped: false,
  last_message_content: 'Apresenta marcas de uso na lateral?\nR:',
  message_buffered: 'não',
});
assert.equal(complete.canSimulate, true);
assert.equal(complete.action, null);

console.log('repasse deterministic core tests passed');
