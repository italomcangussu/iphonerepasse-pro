import assert from "node:assert/strict";
import { applyRepasseMemoryGuardrails } from "./repasse-memory-guardrails.mjs";

const cases = [
  {
    name: "model answer after Bia model question triggers precheck",
    input: {
      memory: { intent: "aparelho_iphone", interest_type: null, desired_model: null },
      last_message_content: "Faltou só me dizer: é o 17, o Pro ou o Pro Max?",
      message_buffered: "17 pro",
    },
    expected: {
      desired_model: "iPhone 17 Pro",
      interest_type: "comprar",
      shouldPrecheckInventory: true,
      routing_decision: "precheck_inventory_before_bia1",
    },
  },
  {
    name: "availability question captures model and capacity",
    input: {
      memory: { intent: "aparelho_iphone", interest_type: null },
      last_message_content: "Qual armazenamento voce procura para o iPhone 17 Pro?",
      message_buffered: "tem 17 pro 512?",
    },
    expected: {
      desired_model: "iPhone 17 Pro",
      desired_capacity: "512GB",
      shouldPrecheckInventory: true,
    },
  },
  {
    name: "greater than 256 preserves capacity constraint",
    input: {
      memory: { intent: "aparelho_iphone", desired_model: "iPhone 17 Pro" },
      last_message_content: "Qual armazenamento voce procura para o iPhone 17 Pro?",
      message_buffered: "tem maior que 256?",
    },
    expected: {
      desired_model: "iPhone 17 Pro",
      capacity_constraint: "greater_than_256GB",
      shouldPrecheckInventory: true,
    },
  },
  {
    name: "city answer captures preferred city",
    input: {
      memory: { intent: "aparelho_iphone", desired_model: "iPhone 17 Pro", interest_type: "comprar" },
      last_message_content: "Qual cidade fica melhor para retirada?",
      message_buffered: "fortaleza",
    },
    expected: {
      preferred_city: "Fortaleza",
      shouldPrecheckInventory: true,
    },
  },
  {
    name: "sell intent does not force purchase precheck",
    input: {
      memory: { intent: "aparelho_iphone", interest_type: "vender" },
      last_message_content: "Como posso ajudar?",
      message_buffered: "quero vender meu 17 pro",
    },
    expected: {
      shouldPrecheckInventory: undefined,
      interest_type: "vender",
    },
  },
];

for (const testCase of cases) {
  const actual = applyRepasseMemoryGuardrails(testCase.input);
  for (const [key, expectedValue] of Object.entries(testCase.expected)) {
    assert.equal(actual[key], expectedValue, `${testCase.name}: ${key}`);
  }
}

console.log(`repasse-memory-guardrails: ${cases.length} cases passed`);
