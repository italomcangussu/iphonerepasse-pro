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

const CARD_INSTALLMENTS_MAX = 18;
const RESERVATION_HINT_AMOUNT = 250;
const STOCK_ALLOWED_STATUSES = new Set(["Disponível", "Reservado"]);

const roundMoney = (value: number) => Math.round((value + Number.EPSILON) * 100) / 100;
const money = (value: number) => roundMoney(value).toLocaleString("pt-BR", { style: "currency", currency: "BRL" }).replace(/\s/g, " ");
const normalize = (value: unknown) => String(value ?? "").trim().replace(/\s+/g, " ").toLowerCase();
const parseAmount = (value: unknown) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

const cardLabel = (brand: CardBrand) => brand === "visa_master" ? "Visa / Master" : "Outras";

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

const buildMessage = (summary: Record<string, any>, installments: Array<Record<string, number>>) => {
  const adjustmentLines = (summary.appliedAdjustments as Array<Record<string, any>>).map((adjustment) => {
    const amount = Number(adjustment.amount_delta || 0);
    return `${adjustment.label}: ${amount < 0 ? "-" : "+"}${money(Math.abs(amount))}`;
  });
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
    `📲 ${summary.tradeInLabel} ${money(summary.tradeInReceivedValue)}`,
    ...adjustmentLines,
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

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return jsonResponse({ success: false, code: "method_not_allowed", error: "Method not allowed." }, 405);

  let supabase;
  try {
    supabase = createServiceClient();
  } catch (error: any) {
    return jsonResponse({ success: false, code: "supabase_init_failed", error: error?.message || "Failed to initialize Supabase." }, 500);
  }

  try {
    await requireAuthenticatedRole(req, supabase);
  } catch (error: any) {
    return jsonResponse({ success: false, code: "unauthorized", error: error?.message || "Unauthorized." }, 401);
  }

  const body = await parseJsonBody<Record<string, any>>(req);
  if (!body) return jsonResponse({ success: false, code: "invalid_json", error: "Invalid JSON body." }, 400);

  const cardBrand = sanitizeText(body.cardBrand || body.card_brand) as CardBrand | null;
  if (cardBrand !== "visa_master" && cardBrand !== "outras") {
    return jsonResponse({ success: false, code: "card_brand_invalid", error: "Bandeira do cartão inválida." }, 400);
  }

  const desiredDeviceInput = body.desiredDevice || body.desired_device || {};
  const stockItemId = sanitizeText(desiredDeviceInput.stockItemId || desiredDeviceInput.stock_item_id);
  const manualDesired = desiredDeviceInput.manual || {};
  let desiredDeviceLabel = sanitizeText(manualDesired.description || desiredDeviceInput.description) || "";
  let desiredDevicePrice = parseAmount(manualDesired.price || desiredDeviceInput.price);

  if (stockItemId) {
    const { data: stockItem, error: stockError } = await supabase
      .from("stock_items")
      .select("id, model, capacity, color, sell_price, status")
      .eq("id", stockItemId)
      .maybeSingle();
    if (stockError) return jsonResponse({ success: false, code: "stock_lookup_failed", error: stockError.message }, 500);
    if (!stockItem) return jsonResponse({ success: false, code: "stock_not_found", error: "Aparelho de estoque não encontrado." }, 404);
    if (!STOCK_ALLOWED_STATUSES.has(String(stockItem.status))) {
      return jsonResponse({ success: false, code: "stock_unavailable", error: "Aparelho de estoque fora de Disponível ou Reservado." }, 400);
    }
    desiredDeviceLabel = [stockItem.model, stockItem.capacity, stockItem.color].filter(Boolean).join(" ");
    desiredDevicePrice = parseAmount(stockItem.sell_price);
  }

  if (!desiredDeviceLabel || desiredDevicePrice <= 0) {
    return jsonResponse({ success: false, code: "desired_device_invalid", error: "Informe aparelho desejado e preço válido." }, 400);
  }

  const tradeIn = body.tradeIn || body.trade_in || {};
  const tradeInModel = sanitizeText(tradeIn.model) || "";
  const tradeInCapacity = sanitizeText(tradeIn.capacity) || "";
  const tradeInColor = sanitizeText(tradeIn.color) || "";
  if (!tradeInModel || !tradeInCapacity) {
    return jsonResponse({ success: false, code: "trade_in_invalid", error: "Informe modelo e armazenamento do trade-in." }, 400);
  }

  const [{ data: valueRows, error: valueError }, { data: adjustmentRows, error: adjustmentError }, { data: cardSettings, error: cardError }] = await Promise.all([
    supabase.from("simulator_trade_in_values").select("*").eq("is_active", true),
    supabase.from("simulator_trade_in_adjustments").select("*").eq("is_active", true),
    supabase.from("card_fee_settings").select("*").eq("id", "default").maybeSingle(),
  ]);
  if (valueError) return jsonResponse({ success: false, code: "value_rules_failed", error: valueError.message }, 500);
  if (adjustmentError) return jsonResponse({ success: false, code: "adjustment_rules_failed", error: adjustmentError.message }, 500);
  if (cardError) return jsonResponse({ success: false, code: "card_settings_failed", error: cardError.message }, 500);

  const baseRule = (valueRows || []).find((rule: any) => normalize(rule.model) === normalize(tradeInModel) && normalize(rule.capacity) === normalize(tradeInCapacity));
  if (!baseRule) {
    return jsonResponse({ success: false, code: "trade_in_value_not_found", error: "Não existe valor padrão ativo para este trade-in." }, 400);
  }

  const applicableAdjustments = (adjustmentRows || []).filter((rule: any) => {
    if (rule.model && normalize(rule.model) !== normalize(tradeInModel)) return false;
    if (rule.capacity && normalize(rule.capacity) !== normalize(tradeInCapacity)) return false;
    return true;
  });
  const selectedAdjustmentIds = new Set(Array.isArray(tradeIn.selectedAdjustmentIds) ? tradeIn.selectedAdjustmentIds.map(String) : []);
  const appliedAdjustments = applicableAdjustments.filter((rule: any) => selectedAdjustmentIds.has(String(rule.id)));
  if ([...selectedAdjustmentIds].some((id) => !applicableAdjustments.some((rule: any) => String(rule.id) === id))) {
    return jsonResponse({ success: false, code: "adjustment_invalid", error: "Um ou mais ajustes selecionados não são compatíveis." }, 400);
  }

  const entries = Array.isArray(body.entries) ? body.entries.map((entry: any) => ({
    type: sanitizeText(entry.type) || "Entrada",
    amount: roundMoney(parseAmount(entry.amount)),
  })) : [];
  if (entries.some((entry: any) => entry.amount < 0)) {
    return jsonResponse({ success: false, code: "entry_invalid", error: "Entradas não podem ter valor negativo." }, 400);
  }

  const tradeInBaseValue = roundMoney(parseAmount(baseRule.base_value));
  const tradeInAdjustmentsTotal = roundMoney(appliedAdjustments.reduce((sum: number, rule: any) => sum + parseAmount(rule.amount_delta), 0));
  const suggestedTradeInValue = Math.max(0, roundMoney(tradeInBaseValue + tradeInAdjustmentsTotal));
  const manualReceivedValue = tradeIn.manualReceivedValue ?? tradeIn.manual_received_value;
  const tradeInReceivedValue = Number.isFinite(Number(manualReceivedValue))
    ? roundMoney(Math.max(0, Number(manualReceivedValue)))
    : suggestedTradeInValue;
  const entriesTotal = roundMoney(entries.reduce((sum: number, entry: any) => sum + entry.amount, 0));
  const cardNetAmount = roundMoney(desiredDevicePrice - tradeInReceivedValue - entriesTotal);
  if (cardNetAmount < 0) {
    return jsonResponse({ success: false, code: "entries_exceed_balance", error: "Entradas e trade-in excedem o valor do aparelho." }, 400);
  }

  const rates = getRates(cardSettings as Record<string, unknown> | null, cardBrand);
  const installments = rates.map((rate, index) => calculateCardCharge(cardNetAmount, rate, index + 1));
  const summary = {
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
  };
  const messageText = buildMessage(summary, installments);

  return jsonResponse({ success: true, summary, installments, messageText });
});
