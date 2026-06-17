/// <reference lib="deno.ns" />
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import {
  corsHeaders,
  createServiceClient,
  jsonResponse,
  parseJsonBody,
  requireAuthenticatedRole,
  sanitizeText,
} from "../_shared/crm.ts";

type CardBrand = "visa_master" | "outras";
type SimulationMode = "single" | "comparison" | "bundle";
type PaymentRevisionInput = {
  installments?: number;
  cards?: Array<{ brand?: string; amount?: number }>;
  amountMode?: "taxed_total" | "net";
  quoteSlot?: number;
};

type QuoteInput = Record<string, any> & {
  slot?: number;
};

type QuoteSuccess = {
  slot: number;
  success: true;
  summary: Record<string, any>;
  installments: Array<Record<string, number>>;
  messageText: string;
};

type QuoteFailure = {
  slot: number;
  success: false;
  code: string;
  error: string;
  status: number;
};

type QuoteResult = QuoteSuccess | QuoteFailure;

const CARD_INSTALLMENTS_MAX = 18;
const RESERVATION_HINT_AMOUNT = 250;
const STOCK_ALLOWED_STATUSES = new Set(["Disponível", "Reservado"]);

const roundMoney = (value: number) => Math.round((value + Number.EPSILON) * 100) / 100;
const money = (value: number) => roundMoney(value).toLocaleString("pt-BR", { style: "currency", currency: "BRL" }).replace(/\s/g, " ");
const normalize = (value: unknown) => String(value ?? "").trim().replace(/\s+/g, " ").toLowerCase();
// Casa o trade-in de forma tolerante ao que o agente/LLM extrai vs. o que está
// cadastrado (que é inconsistente: "iPhone 13"/"128GB" vs "13 PRO"/"128gb ").
// Capacidade: extrai número + unidade (default GB) -> "128", "128GB", "128 gb", "128gb " viram "128gb".
const normalizeCapacity = (value: unknown) => {
  const match = String(value ?? "").trim().toLowerCase().match(/(\d+(?:[.,]\d+)?)\s*(tb|gb)?/);
  if (!match) return "";
  return `${match[1].replace(",", ".")}${match[2] || "gb"}`;
};
// Modelo: tolera o prefixo "iphone" presente ou ausente -> "iPhone 13", "13" e "13 " casam.
const normalizeModel = (value: unknown) => normalize(value).replace(/\biphone\b/g, "").replace(/\s+/g, " ").trim();
const parseAmount = (value: unknown) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

const checkN8NKey = (req: Request): boolean => {
  const expected = String(Deno.env.get("CRM_N8N_API_KEY") || "").trim();
  if (!expected) return false;
  const incoming = String(req.headers.get("x-api-key") || "").trim();
  return incoming !== "" && incoming === expected;
};

const cardLabel = (brand: CardBrand) => brand === "visa_master" ? "Visa / Master" : "Outras";
const normalizeSimulationMode = (value: unknown, hasQuotes: boolean): SimulationMode => {
  const normalized = normalize(value);
  if (normalized === "bundle" || normalized === "compra_conjunta" || normalized === "joint_purchase") return "bundle";
  if (normalized === "comparison" || normalized === "comparacao" || normalized === "comparativo") return "comparison";
  return hasQuotes ? "comparison" : "single";
};

const quoteFailure = (slot: number, code: string, error: string, status = 400): QuoteFailure => ({
  slot,
  success: false,
  code,
  error,
  status,
});

const calculateCardCharge = (netAmount: number, feeRate: number, installments: number) => {
  const safeNet = roundMoney(Math.max(0, Number(netAmount) || 0));
  const safeRate = Math.max(0, Math.min(99.99, Number(feeRate) || 0));
  const safeInstallments = Math.min(CARD_INSTALLMENTS_MAX, Math.max(1, Math.trunc(installments)));
  const customerAmount = safeRate === 0 ? safeNet : roundMoney(safeNet / (1 - safeRate / 100));
  return {
    netAmount: safeNet,
    customerAmount,
    feeAmount: roundMoney(customerAmount - safeNet),
    feeRate: roundMoney(safeRate),
    installments: safeInstallments,
    installmentAmount: roundMoney(customerAmount / safeInstallments),
  };
};

const getRates = (settings: Record<string, unknown> | null, brand: CardBrand): number[] => {
  const fallbackVisa = [2.99, 4.09, 4.78, 5.47, 6.14, 6.81, 7.67, 8.33, 8.98, 9.63, 10.26, 10.9, 12.32, 12.94, 13.56, 14.17, 14.77, 15.37];
  const fallbackOther = [3.99, 5.3, 5.99, 6.68, 7.35, 8.02, 9.47, 10.13, 10.78, 11.43, 12.06, 12.7, 13.32, 13.94, 14.56, 15.17, 15.77, 16.37];
  const fallback = brand === "visa_master" ? fallbackVisa : fallbackOther;
  const raw = brand === "visa_master" ? settings?.visa_master_rates : settings?.other_rates;
  if (!Array.isArray(raw)) return fallback;
  return fallback.map((defaultRate, index) => {
    const parsed = Number(raw[index]);
    return Number.isFinite(parsed) && parsed >= 0 && parsed < 100 ? parsed : defaultRate;
  });
};

const normalizeCardGroup = (brand: unknown): CardBrand => {
  const normalized = normalize(brand).replace(/[^a-z0-9]/g, "");
  return ["visa", "master", "mastercard", "visamaster", "visa_master"].includes(normalized)
    ? "visa_master"
    : "outras";
};

const sumMoney = (values: number[]) => roundMoney(values.reduce((sum, value) => sum + roundMoney(value), 0));

const buildPaymentRevision = ({
  input,
  quote,
  cardSettings,
}: {
  input: PaymentRevisionInput | null;
  quote: QuoteSuccess;
  cardSettings: Record<string, unknown> | null;
}) => {
  if (!input) return { result: null, error: null };
  const cards = Array.isArray(input.cards) ? input.cards : [];
  if (cards.length === 0) return { result: null, error: quoteFailure(quote.slot, "cards_empty", "Informe pelo menos um cartão.") };
  if (cards.length > 2) return { result: null, error: quoteFailure(quote.slot, "too_many_cards", "Use no máximo dois cartões.") };

  const installments = Math.max(1, Math.min(CARD_INSTALLMENTS_MAX, Math.trunc(Number(input.installments) || 0)));
  const selectedInstallment = quote.installments.find((item) => Number(item.installments) === installments);
  if (!selectedInstallment) {
    return { result: null, error: quoteFailure(quote.slot, "installments_invalid", "Quantidade de parcelas inválida.") };
  }
  const allocations = cards.map((card) => ({
    brand: sanitizeText(card.brand) || "",
    group: normalizeCardGroup(card.brand),
    amount: roundMoney(parseAmount(card.amount)),
  }));
  if (allocations.some((card) => !card.brand || card.amount <= 0)) {
    return { result: null, error: quoteFailure(quote.slot, "card_allocation_invalid", "Informe bandeira e valor válido para cada cartão.") };
  }

  const groups = new Set(allocations.map((card) => card.group));
  const amountMode = input.amountMode === "taxed_total" ? "taxed_total" : "net";
  if (groups.size === 1) {
    if (amountMode !== "taxed_total") {
      return { result: null, error: quoteFailure(quote.slot, "amount_mode_invalid", "Cartões do mesmo grupo devem dividir o total com taxa.") };
    }
    if (sumMoney(allocations.map((card) => card.amount)) !== roundMoney(selectedInstallment.customerAmount)) {
      return { result: null, error: quoteFailure(quote.slot, "allocation_total_mismatch", "A divisão deve fechar o total com taxa da parcela escolhida.") };
    }
    return {
      error: null,
      result: {
        kind: "same_group",
        amountMode,
        installments,
        netAmount: quote.summary.cardNetAmount,
        taxedTotal: selectedInstallment.customerAmount,
        feeAmount: selectedInstallment.feeAmount,
        cards: allocations.map((card) => ({
          ...card,
          total: card.amount,
          installmentAmount: roundMoney(card.amount / installments),
        })),
      },
    };
  }

  if (amountMode !== "net") {
    return { result: null, error: quoteFailure(quote.slot, "amount_mode_invalid", "Cartões de grupos diferentes devem dividir o valor líquido.") };
  }
  if (sumMoney(allocations.map((card) => card.amount)) !== roundMoney(Number(quote.summary.cardNetAmount))) {
    return { result: null, error: quoteFailure(quote.slot, "allocation_total_mismatch", "A divisão deve fechar o valor líquido financiado.") };
  }
  const calculatedCards = allocations.map((card) => {
    const rate = getRates(cardSettings, card.group)[installments - 1];
    const charge = calculateCardCharge(card.amount, rate, installments);
    return {
      ...card,
      netAmount: charge.netAmount,
      feeRate: charge.feeRate,
      feeAmount: charge.feeAmount,
      total: charge.customerAmount,
      installmentAmount: charge.installmentAmount,
    };
  });
  return {
    error: null,
    result: {
      kind: "mixed_group",
      amountMode,
      installments,
      netAmount: quote.summary.cardNetAmount,
      taxedTotal: sumMoney(calculatedCards.map((card) => card.total)),
      feeAmount: sumMoney(calculatedCards.map((card) => card.feeAmount)),
      cards: calculatedCards,
    },
  };
};

const loadStockItem = async (supabase: any, stockItemId: string) => {
  const { data: stockItem, error: stockError } = await supabase
    .from("stock_items")
    .select("id, model, capacity, color, sell_price, status")
    .eq("id", stockItemId)
    .maybeSingle();

  if (stockError) return { error: quoteFailure(0, "stock_lookup_failed", stockError.message, 500), stockItem: null };
  if (!stockItem) return { error: quoteFailure(0, "stock_not_found", "Aparelho de estoque não encontrado.", 404), stockItem: null };
  if (!STOCK_ALLOWED_STATUSES.has(String(stockItem.status))) {
    return { error: quoteFailure(0, "stock_unavailable", "Aparelho de estoque fora de Disponível ou Reservado.", 400), stockItem: null };
  }

  return { error: null, stockItem };
};

const buildMessage = (summary: Record<string, any>, installments: Array<Record<string, number>>) => {
  const adjustmentLines = (summary.appliedAdjustments as Array<Record<string, any>>).map((adjustment) => {
    const amount = Number(adjustment.amount_delta || 0);
    return `${adjustment.label}: ${amount < 0 ? "-" : "+"}${money(Math.abs(amount))}`;
  });
  const tradeInLines = summary.tradeInLabel || Number(summary.tradeInReceivedValue || 0) > 0 || adjustmentLines.length > 0
    ? [`📲 ${summary.tradeInLabel} ${money(summary.tradeInReceivedValue)}`, ...adjustmentLines]
    : [];
  const entryLines = (summary.entries as Array<Record<string, any>>).length > 0
    ? ["Entradas:", ...(summary.entries as Array<Record<string, any>>).map((entry) => `${entry.type}: ${money(entry.amount)}`), ""]
    : [];
  const installmentLines = installments.flatMap((item, index) => [
    `🔹 *${item.installments}x*`,
    `💸 Parcela: ${money(item.installmentAmount)}`,
    `🧾 Total: ${money(item.customerAmount)}`,
    index < installments.length - 1 ? "────────" : "",
  ]).filter(Boolean);

  return [
    `📱 ${summary.desiredDeviceLabel} ${money(summary.desiredDevicePrice)}`,
    "",
    ...tradeInLines,
    `Reserva/sinal opcional: ${money(RESERVATION_HINT_AMOUNT)} via Pix`,
    "",
    ...entryLines,
    `Resta a pagar ${money(summary.cardNetAmount)}`,
    "",
    "💳 *Simulação de Parcelamento*",
    "",
    `🏷️ Bandeira: *${summary.cardBrandLabel}*`,
    `🎯 Valor líquido desejado: *${money(summary.cardNetAmount)}*`,
    "",
    "📋 *Parcelas disponíveis*",
    "",
    ...installmentLines,
    "",
    `🗓️ Gerado em: ${new Date().toLocaleString("pt-BR", { timeZone: "America/Fortaleza" })}`,
  ].join("\n");
};

const processQuote = async ({
  supabase,
  quote,
  slot,
  cardBrand,
  valueRows,
  adjustmentRows,
  cardSettings,
}: {
  supabase: any;
  quote: QuoteInput;
  slot: number;
  cardBrand: CardBrand;
  valueRows: Array<Record<string, any>>;
  adjustmentRows: Array<Record<string, any>>;
  cardSettings: Record<string, unknown> | null;
}): Promise<QuoteResult> => {
  const desiredDeviceInput = quote.desiredDevice || quote.desired_device || {};
  const stockItemId = sanitizeText(desiredDeviceInput.stockItemId || desiredDeviceInput.stock_item_id);
  const manualDesired = desiredDeviceInput.manual || {};
  let desiredDeviceLabel = sanitizeText(manualDesired.description || desiredDeviceInput.description) || "";
  let desiredDevicePrice = parseAmount(manualDesired.price || desiredDeviceInput.price);

  if (stockItemId) {
    const { error, stockItem } = await loadStockItem(supabase, stockItemId);
    if (error) return { ...error, slot };
    desiredDeviceLabel = [stockItem.model, stockItem.capacity, stockItem.color].filter(Boolean).join(" ");
    desiredDevicePrice = parseAmount(stockItem.sell_price);
  }

  if (!desiredDeviceLabel || desiredDevicePrice <= 0) {
    return quoteFailure(slot, "desired_device_invalid", "Informe aparelho desejado e preço válido.");
  }

  const tradeIn = quote.tradeIn || quote.trade_in || {};
  const tradeInModel = sanitizeText(tradeIn.model) || "";
  const tradeInCapacity = sanitizeText(tradeIn.capacity) || "";
  const tradeInColor = sanitizeText(tradeIn.color) || "";
  const manualReceivedValue = tradeIn.manualReceivedValue ?? tradeIn.manual_received_value;
  const hasManualReceivedValue = manualReceivedValue !== null
    && manualReceivedValue !== undefined
    && String(manualReceivedValue).trim() !== ""
    && Number.isFinite(Number(manualReceivedValue));
  const selectedAdjustmentIds = new Set(Array.isArray(tradeIn.selectedAdjustmentIds) ? tradeIn.selectedAdjustmentIds.map(String) : []);
  const hasTradeIn = Boolean(tradeInModel || tradeInCapacity || tradeInColor || selectedAdjustmentIds.size > 0 || hasManualReceivedValue);

  if (hasTradeIn && (!tradeInModel || !tradeInCapacity)) {
    return quoteFailure(slot, "trade_in_invalid", "Informe modelo e armazenamento do trade-in.");
  }

  const baseRule = hasTradeIn
    ? (valueRows || []).find((rule: any) => normalizeModel(rule.model) === normalizeModel(tradeInModel) && normalizeCapacity(rule.capacity) === normalizeCapacity(tradeInCapacity))
    : null;
  if (hasTradeIn && !baseRule) {
    return quoteFailure(slot, "trade_in_value_not_found", "Não existe valor padrão ativo para este trade-in.");
  }

  const applicableAdjustments = hasTradeIn
    ? (adjustmentRows || []).filter((rule: any) => {
      if (rule.model && normalizeModel(rule.model) !== normalizeModel(tradeInModel)) return false;
      if (rule.capacity && normalizeCapacity(rule.capacity) !== normalizeCapacity(tradeInCapacity)) return false;
      return true;
    })
    : [];
  const appliedAdjustments = applicableAdjustments.filter((rule: any) => selectedAdjustmentIds.has(String(rule.id)));
  if ([...selectedAdjustmentIds].some((id) => !applicableAdjustments.some((rule: any) => String(rule.id) === id))) {
    return quoteFailure(slot, "adjustment_invalid", "Um ou mais ajustes selecionados não são compatíveis.");
  }

  const entries = Array.isArray(quote.entries) ? quote.entries.map((entry: any) => ({
    type: sanitizeText(entry.type) || "Entrada",
    amount: roundMoney(parseAmount(entry.amount)),
  })) : [];
  if (entries.some((entry: any) => entry.amount < 0)) {
    return quoteFailure(slot, "entry_invalid", "Entradas não podem ter valor negativo.");
  }

  const tradeInBaseValue = roundMoney(parseAmount(baseRule?.base_value));
  const tradeInAdjustmentsTotal = roundMoney(appliedAdjustments.reduce((sum: number, rule: any) => sum + parseAmount(rule.amount_delta), 0));
  const suggestedTradeInValue = Math.max(0, roundMoney(tradeInBaseValue + tradeInAdjustmentsTotal));
  const tradeInReceivedValue = hasTradeIn && hasManualReceivedValue
    ? roundMoney(Math.max(0, Number(manualReceivedValue)))
    : hasTradeIn ? suggestedTradeInValue : 0;
  const entriesTotal = roundMoney(entries.reduce((sum: number, entry: any) => sum + entry.amount, 0));
  const cardNetAmount = roundMoney(desiredDevicePrice - tradeInReceivedValue - entriesTotal);

  if (cardNetAmount < 0) {
    return quoteFailure(slot, "entries_exceed_balance", "Entradas e trade-in excedem o valor do aparelho.");
  }

  const rates = getRates(cardSettings, cardBrand);
  const installments = rates.map((rate, index) => calculateCardCharge(cardNetAmount, rate, index + 1));
  const installmentOptions = [1, 6, 12, 18]
    .map((target) => installments.find((item) => item.installments === target))
    .filter(Boolean);
  const summary = {
    slot,
    desiredDeviceLabel,
    desiredDevicePrice,
    tradeInLabel: [tradeInModel, tradeInCapacity, tradeInColor].filter(Boolean).join(" "),
    tradeInBaseValue,
    tradeInAdjustmentsTotal,
    tradeInReceivedValue,
    entriesTotal,
    cardNetAmount,
    reservationHintAmount: RESERVATION_HINT_AMOUNT,
    cardBrand,
    cardBrandLabel: cardLabel(cardBrand),
    appliedAdjustments,
    entries,
    installmentOptions,
  };
  const messageText = buildMessage(summary, installments);

  return { slot, success: true, summary, installments, messageText };
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return jsonResponse({ success: false, code: "method_not_allowed", error: "Method not allowed." }, 405);

  let supabase;
  try {
    supabase = createServiceClient();
  } catch (error: any) {
    return jsonResponse({ success: false, code: "supabase_init_failed", error: error?.message || "Failed to initialize Supabase." }, 500);
  }

  let authenticated = false;
  if (checkN8NKey(req)) {
    authenticated = true;
  } else {
    try {
      await requireAuthenticatedRole(req, supabase);
      authenticated = true;
    } catch {
      authenticated = false;
    }
  }

  if (!authenticated) {
    return jsonResponse({ success: false, code: "unauthorized", error: "Unauthorized. Use x-api-key ou Bearer válido." }, 401);
  }

  const body = await parseJsonBody<Record<string, any>>(req);
  if (!body) return jsonResponse({ success: false, code: "invalid_json", error: "Invalid JSON body." }, 400);

  // Aceita variações de bandeira (visa / visa_master / master / mastercard…) sem
  // diferenciar maiúsculas/minúsculas, normalizando para "visa_master" via
  // normalizeCardGroup; só rejeita quando a bandeira vier vazia/ausente.
  const rawCardBrand = sanitizeText(body.cardBrand || body.card_brand);
  if (!rawCardBrand) {
    return jsonResponse({ success: false, code: "card_brand_invalid", error: "Bandeira do cartão inválida." }, 400);
  }
  const cardBrand: CardBrand = normalizeCardGroup(rawCardBrand);

  const [{ data: valueRows, error: valueError }, { data: adjustmentRows, error: adjustmentError }, { data: cardSettings, error: cardError }] = await Promise.all([
    supabase.from("simulator_trade_in_values").select("*").eq("is_active", true),
    supabase.from("simulator_trade_in_adjustments").select("*").eq("is_active", true),
    supabase.from("card_fee_settings").select("*").eq("id", "default").maybeSingle(),
  ]);
  if (valueError) return jsonResponse({ success: false, code: "value_rules_failed", error: valueError.message }, 500);
  if (adjustmentError) return jsonResponse({ success: false, code: "adjustment_rules_failed", error: adjustmentError.message }, 500);
  if (cardError) return jsonResponse({ success: false, code: "card_settings_failed", error: cardError.message }, 500);

  const rawQuotes = Array.isArray(body.quotes) ? body.quotes : null;
  const paymentRevision = (body.paymentRevision || body.payment_revision || null) as PaymentRevisionInput | null;
  const simulationMode = normalizeSimulationMode(body.simulationMode || body.simulation_mode, Boolean(rawQuotes));

  if (rawQuotes && rawQuotes.length > 2) {
    return jsonResponse({ success: false, code: "too_many_quotes", error: "Simule no máximo dois aparelhos por vez." }, 400);
  }

  if (!rawQuotes) {
    const result = await processQuote({
      supabase,
      quote: body,
      slot: 1,
      cardBrand,
      valueRows: valueRows || [],
      adjustmentRows: adjustmentRows || [],
      cardSettings: cardSettings as Record<string, unknown> | null,
    });

    if (!result.success) {
      return jsonResponse({ success: false, code: result.code, error: result.error }, result.status);
    }

    const { summary, installments, messageText } = result;
    const { result: paymentRevisionResult, error: paymentRevisionError } = buildPaymentRevision({
      input: paymentRevision,
      quote: result,
      cardSettings: cardSettings as Record<string, unknown> | null,
    });
    if (paymentRevisionError) {
      return jsonResponse({ success: false, code: paymentRevisionError.code, error: paymentRevisionError.error }, paymentRevisionError.status);
    }
    return jsonResponse({
      success: true,
      simulationMode,
      summary,
      installments,
      messageText,
      paymentRevision: paymentRevisionResult,
    });
  }

  if (rawQuotes.length === 0) {
    return jsonResponse({ success: false, code: "quotes_empty", error: "Informe pelo menos um aparelho para simular." }, 400);
  }

  const quoteResults = await Promise.all(rawQuotes.map((quote: QuoteInput, index: number) => processQuote({
    supabase,
    quote,
    slot: Number(quote?.slot) || index + 1,
    cardBrand,
    valueRows: valueRows || [],
    adjustmentRows: adjustmentRows || [],
    cardSettings: cardSettings as Record<string, unknown> | null,
  })));

  const successfulQuotes = quoteResults.filter((quote) => quote.success);
  if (successfulQuotes.length === 0) {
    const firstFailure = quoteResults.find((quote) => !quote.success) as QuoteFailure | undefined;
    return jsonResponse({
      success: false,
      code: firstFailure?.code || "quote_failed",
      error: firstFailure?.error || "Nenhuma simulação pôde ser calculada.",
      quotes: quoteResults,
    }, firstFailure?.status || 400);
  }

  const combinedSummary = {
    simulationMode,
    quoteCount: successfulQuotes.length,
    requestedQuoteCount: rawQuotes.length,
    cardBrand,
    cardBrandLabel: cardLabel(cardBrand),
    partial: successfulQuotes.length !== quoteResults.length,
    totalCardNetAmount: simulationMode === "bundle"
      ? roundMoney(successfulQuotes.reduce((sum, quote) => sum + Number(quote.summary.cardNetAmount || 0), 0))
      : null,
  };
  const paymentRevisionQuote = successfulQuotes.find((quote) => (
    !paymentRevision?.quoteSlot || quote.slot === Number(paymentRevision.quoteSlot)
  )) ?? successfulQuotes[0];
  const { result: paymentRevisionResult, error: paymentRevisionError } = buildPaymentRevision({
    input: paymentRevision,
    quote: paymentRevisionQuote,
    cardSettings: cardSettings as Record<string, unknown> | null,
  });
  if (paymentRevisionError) {
    return jsonResponse({
      success: false,
      code: paymentRevisionError.code,
      error: paymentRevisionError.error,
      quotes: quoteResults,
    }, paymentRevisionError.status);
  }
  const messageText = successfulQuotes.map((quote, index) => [
    successfulQuotes.length > 1 ? `${simulationMode === "comparison" ? "*Comparativo" : "*Opção"} ${index + 1}*` : "",
    quote.messageText,
  ].filter(Boolean).join("\n")).join("\n\n====================\n\n");

  return jsonResponse({
    success: true,
    simulationMode,
    partial: successfulQuotes.length !== quoteResults.length,
    quotes: quoteResults,
    combinedSummary,
    messageText,
    paymentRevision: paymentRevisionResult,
  });
});
