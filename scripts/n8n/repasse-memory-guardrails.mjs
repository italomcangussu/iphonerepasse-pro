export const GUARDRAIL_MARKER_START = "// === REPASSE MEMORY GUARDRAILS START ===";
export const GUARDRAIL_MARKER_END = "// === REPASSE MEMORY GUARDRAILS END ===";

export function normalizeFreeText(value) {
  return String(value ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function detectLastQuestionKind(lastMessageContent) {
  const text = normalizeFreeText(lastMessageContent);
  if (!text) return null;
  if (/\b(modelo|qual iphone|e o 17|pro ou pro max)\b/.test(text)) return "desired_model";
  if (/\b(armazenamento|capacidade|gb|128|256|512|1tb|1 tb)\b/.test(text)) return "desired_capacity";
  if (/\b(cor|cores|preto|branco|natural|azul|rosa|verde|titanio)\b/.test(text)) return "desired_color";
  if (/\b(cidade|retirada|qual loja|fortaleza|sobral)\b/.test(text)) return "preferred_city";
  if (/\b(bateria|arranho|arranhoes|lateral|liquido|peca|caixa|cabo|garantia apple)\b/.test(text)) return "tradein";
  if (/\b(nome completo|cpf|nascimento|cadastro|contato)\b/.test(text)) return "cadastro";
  if (/\b(entrada|pix|cartao|bandeira|visa|master|simulacao|simular)\b/.test(text)) return "payment";
  if (/\b(reserva|retirar|horario|dia|data)\b/.test(text)) return "reservation";
  return null;
}

export function detectIphoneModel(text, context = {}) {
  const normalized = normalizeFreeText([
    text,
    context.lastMessageContent,
    context.summaryShort,
    context.summaryOperational,
    context.previousDesiredModel,
  ].filter(Boolean).join(" "));
  const direct = normalizeFreeText(text);
  const hasIphoneContext = /\b(iphone|17|16|15|14|13|12|11)\b/.test(normalized);

  const generationMatch = normalized.match(/\b(?:iphone\s*)?(1[1-7])\s*(pro\s*max|promax|pro|max|plus)?\b/);
  if (generationMatch) {
    const generation = generationMatch[1];
    const variant = normalizeFreeText(generationMatch[2] ?? "");
    if (variant === "pro max" || variant === "promax") return `iPhone ${generation} Pro Max`;
    if (variant === "pro") return `iPhone ${generation} Pro`;
    if (variant === "plus") return `iPhone ${generation} Plus`;
    if (variant === "max" && /pro\s*max/.test(normalized)) return `iPhone ${generation} Pro Max`;
    return `iPhone ${generation}`;
  }

  if (/\bpro\s*max\b/.test(direct) && context.previousDesiredModel) {
    const generation = String(context.previousDesiredModel).match(/\b(1[1-7])\b/)?.[1];
    return generation ? `iPhone ${generation} Pro Max` : null;
  }

  if (/\bpro\b/.test(direct) && hasIphoneContext) {
    const generation = String(context.previousDesiredModel ?? context.lastMessageContent ?? "").match(/\b(1[1-7])\b/)?.[1];
    return generation ? `iPhone ${generation} Pro` : null;
  }

  return null;
}

export function detectCapacity(text) {
  const normalized = normalizeFreeText(text);
  if (/\b(1tb|1 tb|1000gb|1000 gb)\b/.test(normalized)) return "1TB";
  const match = normalized.match(/\b(128|256|512)\s*(gb)?\b/);
  return match ? `${match[1]}GB` : null;
}

export function detectCapacityConstraint(text) {
  const normalized = normalizeFreeText(text);
  if (/\b(maior|acima|mais)\b.*\b256\b|\b256\b.*\b(maior|acima|mais)\b/.test(normalized)) {
    return "greater_than_256GB";
  }
  return null;
}

export function detectColor(text) {
  const normalized = normalizeFreeText(text);
  if (/\b(preto|black|titanio preto)\b/.test(normalized)) return "preto";
  if (/\b(branco|white)\b/.test(normalized)) return "branco";
  if (/\b(natural|titanio natural)\b/.test(normalized)) return "natural";
  if (/\b(azul|blue)\b/.test(normalized)) return "azul";
  if (/\b(rosa|pink)\b/.test(normalized)) return "rosa";
  if (/\b(verde|green)\b/.test(normalized)) return "verde";
  if (/\b(dourado|gold)\b/.test(normalized)) return "dourado";
  return null;
}

export function detectOperationalCity(text) {
  const normalized = normalizeFreeText(text);
  if (/\b(sobral|massape|forquilha|tiangua|coreau|meruoca)\b/.test(normalized)) return "Sobral";
  if (/\b(fortaleza|fortal|eusebio|aquiraz|maracanau|caucaia|pacatuba)\b/.test(normalized)) return "Fortaleza";
  return null;
}

export function hasNonPurchaseSignal(text) {
  const normalized = normalizeFreeText(text);
  return /\b(vender|vendo|venda|avaliar|avaliacao|quanto vale|repasse|conserto|reparo|garantia|defeito|comprovante|pix pago|suporte)\b/.test(normalized);
}

export function applyRepasseMemoryGuardrails(input) {
  const memory = { ...(input.memory ?? input) };
  const currentMessage = input.message_buffered ?? input.currentMessage ?? "";
  const lastMessageContent = input.last_message_content ?? input.lastMessageContent ?? "";
  const summaryShort = memory.summary_short ?? input.summary_short ?? "";
  const summaryOperational = memory.summary_operational ?? input.summary_operational ?? "";
  const lastQuestionKind = detectLastQuestionKind(lastMessageContent);

  const model = detectIphoneModel(currentMessage, {
    lastMessageContent,
    summaryShort,
    summaryOperational,
    previousDesiredModel: memory.desired_model,
  });
  const capacity = detectCapacity(currentMessage);
  const capacityConstraint = detectCapacityConstraint(currentMessage);
  const color = detectColor(currentMessage);
  const city = detectOperationalCity(currentMessage);

  if (!memory.desired_model && model) memory.desired_model = model;
  if ((lastQuestionKind === "desired_model" || /iphone|1[1-7]/i.test(currentMessage)) && model) {
    memory.desired_model = model;
  }
  if (!memory.desired_capacity && capacity) memory.desired_capacity = capacity;
  if (lastQuestionKind === "desired_capacity" && capacity) memory.desired_capacity = capacity;
  if (capacityConstraint) memory.capacity_constraint = capacityConstraint;
  if (!memory.desired_color && color) memory.desired_color = color;
  if (lastQuestionKind === "desired_color" && color) memory.desired_color = color;
  if (!memory.preferred_city && city) memory.preferred_city = city;
  if (lastQuestionKind === "preferred_city" && city) memory.preferred_city = city;

  const purchaseSideModel = Boolean(memory.desired_model) && !hasNonPurchaseSignal(currentMessage);
  if (purchaseSideModel) {
    memory.desired_device_type = "iphone";
    memory.intent = ["aparelho_iphone", "aparelho_outro"].includes(memory.intent) ? memory.intent : "aparelho_iphone";
    if (!memory.interest_type) memory.interest_type = "comprar";
    if (["comprar", "trocar"].includes(memory.interest_type)) {
      memory.shouldPrecheckInventory = true;
      memory.shouldUseBia1 = true;
      memory.shouldSearchInventory = false;
      memory.shouldUseBia2NoStock = false;
      memory.shouldUseBia2Continuation = false;
      memory.routing_decision = "precheck_inventory_before_bia1";
    }
  }

  return memory;
}

export const N8N_GUARDRAIL_BLOCK = `${GUARDRAIL_MARKER_START}
function repasseDetectLastQuestionKind(lastMessageContent) {
  const text = normalizeFreeText(lastMessageContent);
  if (!text) return null;
  if (/\\b(modelo|qual iphone|e o 17|pro ou pro max)\\b/.test(text)) return "desired_model";
  if (/\\b(armazenamento|capacidade|gb|128|256|512|1tb|1 tb)\\b/.test(text)) return "desired_capacity";
  if (/\\b(cor|cores|preto|branco|natural|azul|rosa|verde|titanio)\\b/.test(text)) return "desired_color";
  if (/\\b(cidade|retirada|qual loja|fortaleza|sobral)\\b/.test(text)) return "preferred_city";
  if (/\\b(bateria|arranho|arranhoes|lateral|liquido|peca|caixa|cabo|garantia apple)\\b/.test(text)) return "tradein";
  if (/\\b(nome completo|cpf|nascimento|cadastro|contato)\\b/.test(text)) return "cadastro";
  if (/\\b(entrada|pix|cartao|bandeira|visa|master|simulacao|simular)\\b/.test(text)) return "payment";
  if (/\\b(reserva|retirar|horario|dia|data)\\b/.test(text)) return "reservation";
  return null;
}

function repasseDetectIphoneModel(text, context) {
  const joined = [text, context.lastMessageContent, context.summaryShort, context.summaryOperational, context.previousDesiredModel].filter(Boolean).join(" ");
  const normalized = normalizeFreeText(joined);
  const direct = normalizeFreeText(text);
  const hasIphoneContext = /\\b(iphone|17|16|15|14|13|12|11)\\b/.test(normalized);
  const generationMatch = normalized.match(/\\b(?:iphone\\s*)?(1[1-7])\\s*(pro\\s*max|promax|pro|max|plus)?\\b/);
  if (generationMatch) {
    const generation = generationMatch[1];
    const variant = normalizeFreeText(generationMatch[2] ?? "");
    if (variant === "pro max" || variant === "promax") return "iPhone " + generation + " Pro Max";
    if (variant === "pro") return "iPhone " + generation + " Pro";
    if (variant === "plus") return "iPhone " + generation + " Plus";
    if (variant === "max" && /pro\\s*max/.test(normalized)) return "iPhone " + generation + " Pro Max";
    return "iPhone " + generation;
  }
  if (/\\bpro\\s*max\\b/.test(direct) && context.previousDesiredModel) {
    const generation = String(context.previousDesiredModel).match(/\\b(1[1-7])\\b/)?.[1];
    return generation ? "iPhone " + generation + " Pro Max" : null;
  }
  if (/\\bpro\\b/.test(direct) && hasIphoneContext) {
    const generation = String(context.previousDesiredModel ?? context.lastMessageContent ?? "").match(/\\b(1[1-7])\\b/)?.[1];
    return generation ? "iPhone " + generation + " Pro" : null;
  }
  return null;
}

function repasseDetectCapacity(text) {
  const normalized = normalizeFreeText(text);
  if (/\\b(1tb|1 tb|1000gb|1000 gb)\\b/.test(normalized)) return "1TB";
  const match = normalized.match(/\\b(128|256|512)\\s*(gb)?\\b/);
  return match ? match[1] + "GB" : null;
}

function repasseDetectCapacityConstraint(text) {
  const normalized = normalizeFreeText(text);
  return /\\b(maior|acima|mais)\\b.*\\b256\\b|\\b256\\b.*\\b(maior|acima|mais)\\b/.test(normalized)
    ? "greater_than_256GB"
    : null;
}

function repasseDetectColor(text) {
  const normalized = normalizeFreeText(text);
  if (/\\b(preto|black|titanio preto)\\b/.test(normalized)) return "preto";
  if (/\\b(branco|white)\\b/.test(normalized)) return "branco";
  if (/\\b(natural|titanio natural)\\b/.test(normalized)) return "natural";
  if (/\\b(azul|blue)\\b/.test(normalized)) return "azul";
  if (/\\b(rosa|pink)\\b/.test(normalized)) return "rosa";
  if (/\\b(verde|green)\\b/.test(normalized)) return "verde";
  if (/\\b(dourado|gold)\\b/.test(normalized)) return "dourado";
  return null;
}

function repasseHasNonPurchaseSignal(text) {
  const normalized = normalizeFreeText(text);
  return /\\b(vender|vendo|venda|avaliar|avaliacao|quanto vale|repasse|conserto|reparo|garantia|defeito|comprovante|pix pago|suporte)\\b/.test(normalized);
}

const repasseLastMessageContent = String(inputData.last_message_content ?? inputData.lastMessageContent ?? memory.last_message_content ?? "");
const repasseSummaryShort = String(memory.summary_short ?? inputData.summary_short ?? "");
const repasseSummaryOperational = String(memory.summary_operational ?? inputData.summary_operational ?? "");
const repasseLastQuestionKind = repasseDetectLastQuestionKind(repasseLastMessageContent);
const repasseDetectedModel = repasseDetectIphoneModel(currentMessageRaw, {
  lastMessageContent: repasseLastMessageContent,
  summaryShort: repasseSummaryShort,
  summaryOperational: repasseSummaryOperational,
  previousDesiredModel: memory.desired_model,
});
const repasseDetectedCapacity = repasseDetectCapacity(currentMessageRaw);
const repasseDetectedCapacityConstraint = repasseDetectCapacityConstraint(currentMessageRaw);
const repasseDetectedColor = repasseDetectColor(currentMessageRaw);

if (!memory.desired_model && repasseDetectedModel) memory.desired_model = repasseDetectedModel;
if ((repasseLastQuestionKind === "desired_model" || /iphone|1[1-7]/i.test(currentMessageRaw)) && repasseDetectedModel) {
  memory.desired_model = repasseDetectedModel;
}
if (!memory.desired_capacity && repasseDetectedCapacity) memory.desired_capacity = repasseDetectedCapacity;
if (repasseLastQuestionKind === "desired_capacity" && repasseDetectedCapacity) memory.desired_capacity = repasseDetectedCapacity;
if (repasseDetectedCapacityConstraint) memory.capacity_constraint = repasseDetectedCapacityConstraint;
if (!memory.desired_color && repasseDetectedColor) memory.desired_color = repasseDetectedColor;
if (repasseLastQuestionKind === "desired_color" && repasseDetectedColor) memory.desired_color = repasseDetectedColor;

const repassePurchaseSideModel = Boolean(memory.desired_model) && !repasseHasNonPurchaseSignal(currentMessageRaw);
if (repassePurchaseSideModel) {
  memory.desired_device_type = "iphone";
  memory.intent = ["aparelho_iphone", "aparelho_outro"].includes(memory.intent) ? memory.intent : "aparelho_iphone";
  if (!memory.interest_type) memory.interest_type = "comprar";
}
${GUARDRAIL_MARKER_END}`;

export const BIA1_STOCK_SAFETY_PROMPT = `\n\n=== REGRAS DE SEGURANCA DE ESTOQUE ===\n- Nunca afirme que temos modelo, capacidade, cor, preco, condicao ou cidade de estoque sem pre_inventory ou last_inventory_context.\n- Nunca liste capacidades fixas como 128, 256 ou 512GB se essas opcoes nao vieram de pre_inventory.available_capacities ou last_inventory_context.\n- Se faltar armazenamento e nao houver opcoes de estoque, pergunte de forma neutra: "Qual armazenamento voce procura para o {{ $json.desired_model ?? 'iPhone' }}?"\n- Se houver pre_inventory.available_capacities, mencione somente essas capacidades.\n- Pre-consulta nao e reserva e nao confirma separacao. Use como contexto para nortear a proxima pergunta.\n`;
