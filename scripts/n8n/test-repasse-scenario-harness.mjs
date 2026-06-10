import assert from 'node:assert/strict';
import {
  buildCriticalScenarios,
  createSandboxIdentity,
  normalizeScenarioTurns,
  validateScenario,
} from './repasse-scenario-harness.mjs';

assert.deepEqual(normalizeScenarioTurns({
  prompt: 'Quero um iPhone 16',
}), ['Quero um iPhone 16']);

const pronounScenario = {
  category: 'parcelamento_bandeira',
  turns: [
    'Quero o iPhone 16 Pro 256GB no Visa.',
    'Quanto fica a parcela dele em 10x?',
  ],
};
assert.equal(validateScenario(pronounScenario).valid, true);
assert.equal(validateScenario({
  category: 'parcelamento_bandeira',
  prompt: 'Quanto fica a parcela dele?',
}).valid, false);

const identityA = createSandboxIdentity('run-1', 1);
const identityB = createSandboxIdentity('run-1', 2);
assert.notEqual(identityA.leadId, identityB.leadId);
assert.notEqual(identityA.conversationId, identityB.conversationId);
assert.equal(identityA.cleanupTag, 'repasse_v2_scenario_audit');

const critical = buildCriticalScenarios();
assert.ok(critical.some((scenario) => scenario.category === 'tradein_consent_questionnaire'));
assert.ok(critical.some((scenario) => scenario.category === 'tradein_partial_answer'));
assert.ok(critical.some((scenario) => scenario.category === 'payment_revision_same_group'));
assert.ok(critical.some((scenario) => scenario.category === 'payment_revision_mixed_group'));
assert.ok(critical.every((scenario) => validateScenario(scenario).valid));

console.log('repasse scenario harness tests passed');
