import crypto from 'node:crypto';

const PRONOUN_ONLY = /^(quanto|como|e)\b.*\b(dele|dela|desse|dessa|nisso)\b/i;

export function normalizeScenarioTurns(scenario) {
  if (Array.isArray(scenario?.turns)) {
    return scenario.turns.map((turn) => String(turn ?? '').trim()).filter(Boolean);
  }
  const prompt = String(scenario?.prompt ?? '').trim();
  return prompt ? [prompt] : [];
}

export function validateScenario(scenario) {
  const turns = normalizeScenarioTurns(scenario);
  if (turns.length === 0) return { valid: false, reason: 'scenario_without_turns' };
  if (turns.length === 1 && PRONOUN_ONLY.test(turns[0])) {
    return { valid: false, reason: 'pronoun_requires_prior_turn' };
  }
  return { valid: true, reason: null };
}

export function createSandboxIdentity(runId, ordinal) {
  const suffix = `${String(runId).replace(/[^a-z0-9]/gi, '').slice(-18)}-${ordinal}-${crypto.randomUUID().slice(0, 8)}`;
  return {
    leadId: `audit-${suffix}`,
    conversationId: crypto.randomUUID(),
    cleanupTag: 'repasse_v2_scenario_audit',
  };
}

export function buildCriticalScenarios() {
  return [
    {
      id: 'critical-tradein-consent',
      category: 'tradein_consent_questionnaire',
      source: 'critical_generated',
      turns: [
        'Tenho um iPhone 13 128GB preto para dar de entrada e quero um iPhone 16 Pro 256GB.',
        'Sim, pode mandar.',
      ],
    },
    {
      id: 'critical-tradein-partial',
      category: 'tradein_partial_answer',
      source: 'critical_generated',
      turns: [
        'Quero trocar meu iPhone 13 128GB preto pelo iPhone 16 Pro 256GB.',
        'Pode mandar as perguntas.',
        'Apresenta arranhões?\nR: Não\nAparelho já teve contato com líquido?\nR: Não\nQual % de bateria?\nR: 86%',
      ],
    },
    {
      id: 'critical-comparison',
      category: 'comparacao_dois_iphones',
      source: 'critical_generated',
      turns: [
        'Estou em dúvida entre iPhone 15 Pro 256GB e iPhone 16 Pro 256GB. Quero comparar os dois no Visa.',
      ],
    },
    {
      id: 'critical-remove-entry',
      category: 'payment_revision_remove_entry',
      source: 'critical_generated',
      turns: [
        'Quero o iPhone 16 Pro 256GB no Visa com 1000 de entrada no Pix.',
        'Agora simula sem a entrada.',
      ],
    },
    {
      id: 'critical-installments',
      category: 'payment_revision_installments',
      source: 'critical_generated',
      turns: [
        'Quero o iPhone 16 Pro 256GB no Visa.',
        'Quanto fica ele em 10x?',
      ],
    },
    {
      id: 'critical-same-group',
      category: 'payment_revision_same_group',
      source: 'critical_generated',
      turns: [
        'Quero o iPhone 16 Pro 256GB no Visa e me mostra 10x.',
        'Vou dividir o total: 3000 no Visa e o restante no Master, ambos em 10x.',
      ],
    },
    {
      id: 'critical-mixed-group',
      category: 'payment_revision_mixed_group',
      source: 'critical_generated',
      turns: [
        'Quero o iPhone 16 Pro 256GB e preciso do valor em 10x.',
        'Vou passar 3000 do valor sem taxa no Visa e o restante no Elo, ambos em 10x.',
      ],
    },
  ];
}
