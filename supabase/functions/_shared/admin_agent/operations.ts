// Finance/inventory operations exposed to the admin agent.
//
// Reads run directly against the DB with the service client. Writes are split:
// `prepare*` never mutates (it records a pending confirmation), and
// `executePending` performs the actual mutation via the admin-actor RPCs after
// the admin confirmed.

import { AdminIdentity } from "./identity.ts";
import { createPendingAction, PendingAction } from "./pending.ts";

interface SupabaseLike {
  from: (table: string) => any;
  rpc: (fn: string, args?: Record<string, unknown>) => any;
}

export interface OpsDeps {
  supabase: SupabaseLike;
  actor: AdminIdentity;
  channelId: string | null;
  conversationId: string | null;
  now?: () => number;
}

const ACCOUNTS = ["Conta Bancária", "Cofre"] as const;
export type TransferableAccount = (typeof ACCOUNTS)[number];

export function formatBRL(value: number): string {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(Number.isFinite(value) ? value : 0);
}

function parseAmount(value: unknown): number | null {
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  const cleaned = String(value ?? "")
    .replace(/[^\d,.-]/g, "")
    .replace(/\.(?=\d{3}(\D|$))/g, "")
    .replace(",", ".");
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : null;
}

function resolveAccount(value: unknown): TransferableAccount | null {
  const v = String(value ?? "").trim().toLowerCase();
  if (["cofre", "safe", "vault"].includes(v)) return "Cofre";
  if (
    ["conta", "conta bancária", "conta bancaria", "banco", "bank", "conta banco"]
      .includes(v)
  ) {
    return "Conta Bancária";
  }
  return null;
}

type PaymentMethod = "Pix" | "Dinheiro" | "Cartão";

function normalizePaymentMethod(value: unknown): PaymentMethod | null {
  const v = String(value ?? "").trim().toLowerCase();
  if (v === "pix") return "Pix";
  if (["dinheiro", "espécie", "especie", "cash"].includes(v)) return "Dinheiro";
  if (
    ["cartão", "cartao", "card", "crédito", "credito", "débito", "debito"].includes(v)
  ) {
    return "Cartão";
  }
  return null;
}

// ---------------------------------------------------------------------------
// Period helpers — America/Sao_Paulo (Brazil dropped DST in 2019 → fixed -03).
// Summaries compare against timestamptz boundaries so a "hoje"/"mês" window
// lines up with the business day, not UTC.
// ---------------------------------------------------------------------------

const SP_OFFSET = "-03:00";

function spParts(now: number): { y: number; m: number; d: number } {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date(now));
  const get = (t: string) => Number(parts.find((p) => p.type === t)?.value);
  return { y: get("year"), m: get("month"), d: get("day") };
}

function isoAt(y: number, m: number, d: number): string {
  return `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}T00:00:00${SP_OFFSET}`;
}

function shiftDays(y: number, m: number, d: number, delta: number) {
  const base = new Date(Date.UTC(y, m - 1, d));
  base.setUTCDate(base.getUTCDate() + delta);
  return {
    y: base.getUTCFullYear(),
    m: base.getUTCMonth() + 1,
    d: base.getUTCDate(),
  };
}

/** Today's date in São Paulo as 'YYYY-MM-DD' (for date-column comparisons). */
export function todaySP(now: number): string {
  const t = spParts(now);
  return `${t.y}-${String(t.m).padStart(2, "0")}-${String(t.d).padStart(2, "0")}`;
}

export interface PeriodRange {
  fromISO: string;
  toISO: string;
  label: string;
}

export function resolvePeriod(period: string | undefined, now: number): PeriodRange {
  const p = String(period ?? "").trim().toLowerCase();
  const t = spParts(now);
  const startToday = isoAt(t.y, t.m, t.d);
  const tomo = shiftDays(t.y, t.m, t.d, 1);
  const startTomorrow = isoAt(tomo.y, tomo.m, tomo.d);

  if (["hoje", "today", "dia"].includes(p)) {
    return { fromISO: startToday, toISO: startTomorrow, label: "hoje" };
  }
  if (["ontem", "yesterday"].includes(p)) {
    const y = shiftDays(t.y, t.m, t.d, -1);
    return { fromISO: isoAt(y.y, y.m, y.d), toISO: startToday, label: "ontem" };
  }
  if (
    ["7d", "semana", "week", "this_week", "last_7_days", "últimos 7 dias"].includes(p)
  ) {
    const s = shiftDays(t.y, t.m, t.d, -6);
    return {
      fromISO: isoAt(s.y, s.m, s.d),
      toISO: startTomorrow,
      label: "últimos 7 dias",
    };
  }
  if (["30d", "last_30_days", "últimos 30 dias"].includes(p)) {
    const s = shiftDays(t.y, t.m, t.d, -29);
    return {
      fromISO: isoAt(s.y, s.m, s.d),
      toISO: startTomorrow,
      label: "últimos 30 dias",
    };
  }
  if (["mes_passado", "mês passado", "mes passado", "last_month"].includes(p)) {
    const lastDayPrev = shiftDays(t.y, t.m, 1, -1);
    return {
      fromISO: isoAt(lastDayPrev.y, lastDayPrev.m, 1),
      toISO: isoAt(t.y, t.m, 1),
      label: "mês passado",
    };
  }
  const next = t.m === 12 ? { y: t.y + 1, m: 1 } : { y: t.y, m: t.m + 1 };
  return {
    fromISO: isoAt(t.y, t.m, 1),
    toISO: isoAt(next.y, next.m, 1),
    label: "mês atual",
  };
}

// ---------------------------------------------------------------------------
// Reads
// ---------------------------------------------------------------------------

export async function getAccountBalances(deps: OpsDeps) {
  const { data, error } = await deps.supabase.rpc(
    "admin_agent_account_balances",
  );
  if (error) return { ok: false, error: error.message };
  const balances = (data ?? {}) as Record<string, number>;
  return {
    ok: true,
    balances,
    formatted: {
      "Conta Bancária": formatBRL(Number(balances["Conta Bancária"] ?? 0)),
      "Cofre": formatBRL(Number(balances["Cofre"] ?? 0)),
      "Devedores": formatBRL(Number(balances["Devedores"] ?? 0)),
    },
  };
}

export async function findDebtBalance(
  deps: OpsDeps,
  args: { query?: string },
) {
  const query = String(args.query ?? "").trim();
  if (!query) {
    return { ok: false, error: "Informe o nome ou telefone do cliente." };
  }
  const digits = query.replace(/\D/g, "");
  let custQ = deps.supabase.from("customers").select("id, name, phone");
  if (digits.length >= 6) {
    custQ = custQ.ilike("phone", `%${digits}%`);
  } else {
    custQ = custQ.ilike("name", `%${query}%`);
  }
  const { data: customers, error: custErr } = await custQ.limit(8);
  if (custErr) return { ok: false, error: custErr.message };
  if (!Array.isArray(customers) || customers.length === 0) {
    return { ok: true, customers: [], debts: [] };
  }

  const ids = customers.map((c: Record<string, unknown>) => c.id);
  const { data: debts, error: debtErr } = await deps.supabase
    .from("debts")
    .select("id, customer_id, original_amount, remaining_amount, status, due_date")
    .in("customer_id", ids)
    .neq("status", "Quitada")
    .order("due_date", { ascending: true });
  if (debtErr) return { ok: false, error: debtErr.message };

  const byId = new Map(
    customers.map((c: Record<string, unknown>) => [c.id, c]),
  );
  const result = (debts ?? []).map((d: Record<string, unknown>) => {
    const cust = byId.get(d.customer_id) as Record<string, unknown> | undefined;
    return {
      debtId: d.id,
      customer: cust?.name ?? "—",
      phone: cust?.phone ?? null,
      originalAmount: Number(d.original_amount),
      remainingAmount: Number(d.remaining_amount),
      remainingFormatted: formatBRL(Number(d.remaining_amount)),
      status: d.status,
      dueDate: d.due_date,
    };
  });
  return {
    ok: true,
    customers: customers.map((c: Record<string, unknown>) => ({
      name: c.name,
      phone: c.phone,
    })),
    debts: result,
    totalRemaining: formatBRL(
      result.reduce(
        (s: number, d: { remainingAmount: number }) => s + d.remainingAmount,
        0,
      ),
    ),
  };
}

export async function searchStock(
  deps: OpsDeps,
  args: { query?: string; onlyAvailable?: boolean },
) {
  const query = String(args.query ?? "").trim();
  let q = deps.supabase
    .from("stock_items")
    .select(
      "id, model, color, capacity, imei, condition, status, sell_price, battery_health",
    );
  if (args.onlyAvailable !== false) q = q.eq("status", "Disponível");
  if (query) {
    const digits = query.replace(/\D/g, "");
    if (digits.length >= 5) {
      q = q.ilike("imei", `%${digits}%`);
    } else {
      q = q.ilike("model", `%${query}%`);
    }
  }
  const { data, error } = await q.limit(15);
  if (error) return { ok: false, error: error.message };
  return {
    ok: true,
    items: (data ?? []).map((s: Record<string, unknown>) => ({
      stockItemId: s.id,
      model: s.model,
      color: s.color,
      capacity: s.capacity,
      condition: s.condition,
      status: s.status,
      imei: s.imei,
      batteryHealth: s.battery_health,
      price: Number(s.sell_price),
      priceFormatted: formatBRL(Number(s.sell_price)),
    })),
  };
}

export async function getReservations(
  deps: OpsDeps,
  args: { query?: string },
) {
  const query = String(args.query ?? "").trim();
  let q = deps.supabase
    .from("stock_reservations")
    .select(
      "id, stock_item_id, customer_name, customer_phone, expires_at, deposit_amount, notes, status",
    )
    .eq("status", "active");
  if (query) {
    const digits = query.replace(/\D/g, "");
    if (digits.length >= 6) q = q.ilike("customer_phone", `%${digits}%`);
    else q = q.ilike("customer_name", `%${query}%`);
  }
  const { data, error } = await q.limit(15);
  if (error) return { ok: false, error: error.message };
  return {
    ok: true,
    reservations: (data ?? []).map((r: Record<string, unknown>) => ({
      reservationId: r.id,
      stockItemId: r.stock_item_id,
      customer: r.customer_name,
      phone: r.customer_phone,
      expiresAt: r.expires_at,
      depositAmount: r.deposit_amount != null
        ? formatBRL(Number(r.deposit_amount))
        : null,
      notes: r.notes,
    })),
  };
}

export async function getFinancialSummary(
  deps: OpsDeps,
  args: { period?: string },
) {
  const range = resolvePeriod(args.period, deps.now?.() ?? Date.now());
  const { data, error } = await deps.supabase.rpc(
    "admin_agent_financial_summary",
    { p_from: range.fromISO, p_to: range.toISO },
  );
  if (error) return { ok: false, error: error.message };
  const d = (data ?? {}) as Record<string, unknown>;
  const cats = Array.isArray(d.topExpenseCategories)
    ? d.topExpenseCategories as Array<Record<string, unknown>>
    : [];
  return {
    ok: true,
    period: range.label,
    income: formatBRL(Number(d.income ?? 0)),
    expense: formatBRL(Number(d.expense ?? 0)),
    net: formatBRL(Number(d.net ?? 0)),
    transactions: Number(d.count ?? 0),
    topExpenseCategories: cats.map((c) => ({
      category: c.category,
      total: formatBRL(Number(c.total ?? 0)),
    })),
  };
}

export async function getSalesSummary(
  deps: OpsDeps,
  args: { period?: string },
) {
  const range = resolvePeriod(args.period, deps.now?.() ?? Date.now());
  const { data, error } = await deps.supabase.rpc("admin_agent_sales_summary", {
    p_from: range.fromISO,
    p_to: range.toISO,
  });
  if (error) return { ok: false, error: error.message };
  const d = (data ?? {}) as Record<string, unknown>;
  return {
    ok: true,
    period: range.label,
    count: Number(d.count ?? 0),
    revenue: formatBRL(Number(d.revenue ?? 0)),
    avgTicket: formatBRL(Number(d.avgTicket ?? 0)),
  };
}

export async function getInventorySummary(deps: OpsDeps) {
  const { data, error } = await deps.supabase.rpc(
    "admin_agent_inventory_summary",
  );
  if (error) return { ok: false, error: error.message };
  const d = (data ?? {}) as Record<string, unknown>;
  return {
    ok: true,
    available: Number(d.available ?? 0),
    reserved: Number(d.reserved ?? 0),
    inPreparation: Number(d.inPreparation ?? 0),
    inStockCount: Number(d.inStockCount ?? 0),
    totalPurchaseValue: formatBRL(Number(d.totalPurchaseValue ?? 0)),
    totalSellValue: formatBRL(Number(d.totalSellValue ?? 0)),
  };
}

export async function listOverdueDebts(
  deps: OpsDeps,
  args: { limit?: number },
) {
  const today = todaySP(deps.now?.() ?? Date.now());
  const limit = Math.min(Math.max(Math.floor(Number(args.limit ?? 10)) || 10, 1), 25);
  const { data: debts, error } = await deps.supabase
    .from("debts")
    .select("id, customer_id, remaining_amount, due_date, status")
    .neq("status", "Quitada")
    .not("due_date", "is", null)
    .lt("due_date", today)
    .order("due_date", { ascending: true })
    .limit(limit);
  if (error) return { ok: false, error: error.message };
  const rows = (debts ?? []) as Array<Record<string, unknown>>;
  const ids = rows.map((r) => r.customer_id).filter(Boolean);
  const byId = new Map<unknown, Record<string, unknown>>();
  if (ids.length > 0) {
    const { data: customers } = await deps.supabase
      .from("customers").select("id, name, phone").in("id", ids);
    for (const c of (customers ?? []) as Array<Record<string, unknown>>) {
      byId.set(c.id, c);
    }
  }
  return {
    ok: true,
    today,
    debts: rows.map((r) => {
      const c = byId.get(r.customer_id);
      return {
        debtId: r.id,
        customer: c?.name ?? "—",
        phone: c?.phone ?? null,
        remaining: formatBRL(Number(r.remaining_amount)),
        dueDate: r.due_date,
        status: r.status,
      };
    }),
  };
}

export async function listPayableDebts(
  deps: OpsDeps,
  args: { onlyOverdue?: boolean; limit?: number },
) {
  const limit = Math.min(Math.max(Math.floor(Number(args.limit ?? 15)) || 15, 1), 30);
  let q = deps.supabase
    .from("payable_debts")
    .select("id, creditor_name, remaining_amount, due_date, status")
    .neq("status", "Quitada");
  if (args.onlyOverdue) {
    q = q.not("due_date", "is", null).lt("due_date", todaySP(deps.now?.() ?? Date.now()));
  }
  const { data, error } = await q.order("due_date", { ascending: true }).limit(limit);
  if (error) return { ok: false, error: error.message };
  return {
    ok: true,
    payableDebts: ((data ?? []) as Array<Record<string, unknown>>).map((r) => ({
      payableDebtId: r.id,
      creditor: r.creditor_name,
      remaining: formatBRL(Number(r.remaining_amount)),
      dueDate: r.due_date,
      status: r.status,
    })),
  };
}

export async function listRecentTransactions(
  deps: OpsDeps,
  args: { limit?: number; account?: string; type?: string },
) {
  const limit = Math.min(Math.max(Math.floor(Number(args.limit ?? 10)) || 10, 1), 20);
  let q = deps.supabase
    .from("transactions")
    .select("id, type, category, amount, date, description, account");
  const account = resolveAccount(args.account);
  if (account) q = q.eq("account", account);
  const type = String(args.type ?? "").trim().toUpperCase();
  if (type === "IN" || type === "OUT") q = q.eq("type", type);
  const { data, error } = await q.order("date", { ascending: false }).limit(limit);
  if (error) return { ok: false, error: error.message };
  return {
    ok: true,
    transactions: ((data ?? []) as Array<Record<string, unknown>>).map((r) => ({
      id: r.id,
      type: r.type,
      category: r.category,
      amount: formatBRL(Number(r.amount)),
      date: r.date,
      description: r.description,
      account: r.account,
    })),
  };
}

export async function getCustomerProfile(
  deps: OpsDeps,
  args: { query?: string },
) {
  const query = String(args.query ?? "").trim();
  if (!query) return { ok: false, error: "Informe o nome ou telefone do cliente." };
  const digits = query.replace(/\D/g, "");
  let cq = deps.supabase
    .from("customers")
    .select("id, name, phone, email, purchases, total_spent");
  if (digits.length >= 6) cq = cq.ilike("phone", `%${digits}%`);
  else cq = cq.ilike("name", `%${query}%`);
  const { data: customers, error } = await cq.limit(5);
  if (error) return { ok: false, error: error.message };
  const list = (customers ?? []) as Array<Record<string, unknown>>;
  if (list.length === 0) return { ok: true, customers: [] };
  const ids = list.map((c) => c.id);
  const { data: debts } = await deps.supabase
    .from("debts")
    .select("customer_id, remaining_amount, status")
    .in("customer_id", ids)
    .neq("status", "Quitada");
  const openByCust = new Map<unknown, number>();
  for (const d of (debts ?? []) as Array<Record<string, unknown>>) {
    openByCust.set(
      d.customer_id,
      (openByCust.get(d.customer_id) ?? 0) + Number(d.remaining_amount ?? 0),
    );
  }
  return {
    ok: true,
    customers: list.map((c) => ({
      name: c.name,
      phone: c.phone,
      email: c.email ?? null,
      purchases: Number(c.purchases ?? 0),
      totalSpent: formatBRL(Number(c.total_spent ?? 0)),
      openDebt: formatBRL(openByCust.get(c.id) ?? 0),
    })),
  };
}

// ---------------------------------------------------------------------------
// Writes — prepare (no mutation) then executePending
// ---------------------------------------------------------------------------

export async function prepareTransfer(
  deps: OpsDeps,
  args: { amount?: unknown; from?: unknown; to?: unknown },
) {
  const amount = parseAmount(args.amount);
  const from = resolveAccount(args.from);
  const to = resolveAccount(args.to);
  if (amount === null || amount <= 0) {
    return { ok: false, error: "Valor inválido. Ex.: 500 ou 1.250,50." };
  }
  if (!from || !to) {
    return {
      ok: false,
      error: "Contas válidas: 'Conta Bancária' e 'Cofre'.",
    };
  }
  if (from === to) {
    return { ok: false, error: "Escolha contas diferentes." };
  }

  const balancesRes = await getAccountBalances(deps);
  const fromBalance = balancesRes.ok
    ? Number((balancesRes.balances as Record<string, number>)[from] ?? 0)
    : null;
  const insufficient = fromBalance !== null && amount > fromBalance;

  const summary = `Transferir ${formatBRL(amount)} de ${from} para ${to}` +
    (insufficient
      ? ` (atenção: saldo de ${from} é ${formatBRL(fromBalance!)})`
      : "");

  const pending = await createPendingAction(deps.supabase, {
    phone: deps.actor.phone,
    userId: deps.actor.userId,
    channelId: deps.channelId,
    conversationId: deps.conversationId,
    action: "transfer",
    params: { amount, from, to },
    summary,
    now: deps.now?.(),
  });
  if (!pending) {
    return { ok: false, error: "Não foi possível registrar a operação." };
  }
  return {
    ok: true,
    status: "needs_confirmation",
    summary,
    insufficientFunds: insufficient,
  };
}

export async function prepareReserveStock(
  deps: OpsDeps,
  args: {
    stockItemId?: string;
    query?: string;
    customerName?: string;
    customerPhone?: string;
    expiresAt?: string;
    depositAmount?: unknown;
    depositPaymentMethod?: string;
    notes?: string;
  },
) {
  const customerName = String(args.customerName ?? "").trim();
  const customerPhone = String(args.customerPhone ?? "").trim();
  if (!customerName) return { ok: false, error: "Informe o nome do cliente da reserva." };
  if (!customerPhone) return { ok: false, error: "Informe o telefone do cliente da reserva." };

  // Resolve the target stock item.
  let stockItemId = String(args.stockItemId ?? "").trim();
  let itemLabel = "";
  if (!stockItemId) {
    const search = await searchStock(deps, { query: args.query, onlyAvailable: true });
    if (!search.ok) return search;
    const items = search.items as Array<Record<string, unknown>>;
    if (items.length === 0) {
      return { ok: false, error: "Nenhum aparelho disponível para essa busca." };
    }
    if (items.length > 1) {
      return {
        ok: false,
        error: "Mais de um aparelho corresponde. Escolha pelo stockItemId.",
        options: items,
      };
    }
    stockItemId = String(items[0].stockItemId);
    itemLabel =
      `${items[0].model} ${items[0].capacity} ${items[0].color}`.trim();
  } else {
    const { data: item } = await deps.supabase
      .from("stock_items")
      .select("id, model, color, capacity, status")
      .eq("id", stockItemId)
      .maybeSingle();
    if (!item) return { ok: false, error: "Aparelho não encontrado no estoque." };
    const row = item as Record<string, unknown>;
    if (!["Disponível", "Reservado"].includes(String(row.status))) {
      return { ok: false, error: `Aparelho está em ${row.status} e não pode ser reservado.` };
    }
    itemLabel = `${row.model} ${row.capacity} ${row.color}`.trim();
  }

  const depositAmount = args.depositAmount != null
    ? parseAmount(args.depositAmount)
    : null;
  const params = {
    stockItemId,
    customerName,
    customerPhone,
    expiresAt: args.expiresAt ?? null,
    depositAmount,
    depositPaymentMethod: args.depositPaymentMethod ?? null,
    notes: args.notes ?? null,
  };
  const summary = `Reservar ${itemLabel} para ${customerName} (${customerPhone})` +
    (depositAmount ? `, sinal de ${formatBRL(depositAmount)}` : "");

  const pending = await createPendingAction(deps.supabase, {
    phone: deps.actor.phone,
    userId: deps.actor.userId,
    channelId: deps.channelId,
    conversationId: deps.conversationId,
    action: "reserve_stock",
    params,
    summary,
    now: deps.now?.(),
  });
  if (!pending) {
    return { ok: false, error: "Não foi possível registrar a reserva." };
  }
  return { ok: true, status: "needs_confirmation", summary };
}

export async function prepareRegisterTransaction(
  deps: OpsDeps,
  args: {
    type?: unknown;
    amount?: unknown;
    account?: unknown;
    category?: string;
    description?: string;
  },
) {
  const type = String(args.type ?? "").trim().toUpperCase();
  const amount = parseAmount(args.amount);
  const account = resolveAccount(args.account);
  if (type !== "IN" && type !== "OUT") {
    return { ok: false, error: "Tipo inválido. Use receita (IN) ou despesa (OUT)." };
  }
  if (amount === null || amount <= 0) {
    return { ok: false, error: "Valor inválido. Ex.: 500 ou 1.250,50." };
  }
  if (!account) {
    return { ok: false, error: "Conta inválida. Use 'Conta Bancária' ou 'Cofre'." };
  }
  const category = String(args.category ?? "").trim() ||
    (type === "IN" ? "Aporte" : "Retirada");
  const description = String(args.description ?? "").trim();

  let insufficient = false;
  if (type === "OUT") {
    const balances = await getAccountBalances(deps);
    if (balances.ok) {
      const bal = Number((balances.balances as Record<string, number>)[account] ?? 0);
      insufficient = amount > bal;
    }
  }
  const verb = type === "IN" ? "Registrar receita" : "Registrar despesa";
  const summary = `${verb} de ${formatBRL(amount)} em ${account} (${category})` +
    (description ? ` — ${description}` : "") +
    (insufficient ? ` (atenção: saldo insuficiente em ${account})` : "");

  const pending = await createPendingAction(deps.supabase, {
    phone: deps.actor.phone,
    userId: deps.actor.userId,
    channelId: deps.channelId,
    conversationId: deps.conversationId,
    action: "register_transaction",
    params: { type, amount, account, category, description: description || null },
    summary,
    now: deps.now?.(),
  });
  if (!pending) return { ok: false, error: "Não foi possível registrar a operação." };
  return { ok: true, status: "needs_confirmation", summary, insufficientFunds: insufficient };
}

export async function prepareReceiveDebtPayment(
  deps: OpsDeps,
  args: {
    debtId?: string;
    query?: string;
    amount?: unknown;
    paymentMethod?: string;
    account?: unknown;
    notes?: string;
  },
) {
  const amount = parseAmount(args.amount);
  if (amount === null || amount <= 0) {
    return { ok: false, error: "Valor inválido do pagamento." };
  }
  const method = normalizePaymentMethod(args.paymentMethod);
  if (!method) return { ok: false, error: "Forma inválida (Pix, Dinheiro ou Cartão)." };
  const account = resolveAccount(args.account) ?? "Conta Bancária";

  let debtId = String(args.debtId ?? "").trim();
  let label = "";
  let remaining = 0;
  if (!debtId) {
    const found = await findDebtBalance(deps, { query: args.query });
    if (!found.ok) return found;
    const debts = (found.debts ?? []) as Array<Record<string, unknown>>;
    if (debts.length === 0) {
      return { ok: false, error: "Nenhuma dívida em aberto para esse cliente." };
    }
    if (debts.length > 1) {
      return {
        ok: false,
        error: "Mais de uma dívida em aberto. Escolha pelo debtId.",
        options: debts,
      };
    }
    debtId = String(debts[0].debtId);
    label = String(debts[0].customer ?? "");
    remaining = Number(debts[0].remainingAmount ?? 0);
  } else {
    const { data: debt } = await deps.supabase
      .from("debts")
      .select("id, remaining_amount, status, customer_id")
      .eq("id", debtId)
      .maybeSingle();
    if (!debt) return { ok: false, error: "Dívida não encontrada." };
    const row = debt as Record<string, unknown>;
    if (String(row.status) === "Quitada") {
      return { ok: false, error: "Essa dívida já está quitada." };
    }
    remaining = Number(row.remaining_amount ?? 0);
    const { data: cust } = await deps.supabase
      .from("customers").select("name").eq("id", row.customer_id).maybeSingle();
    label = String((cust as Record<string, unknown> | null)?.name ?? "");
  }
  if (remaining > 0 && amount > remaining + 0.001) {
    return {
      ok: false,
      error: `O valor excede o saldo devedor (${formatBRL(remaining)}).`,
    };
  }
  const summary =
    `Receber ${formatBRL(amount)} da dívida de ${label || debtId} via ${method} em ${account}`;
  const pending = await createPendingAction(deps.supabase, {
    phone: deps.actor.phone,
    userId: deps.actor.userId,
    channelId: deps.channelId,
    conversationId: deps.conversationId,
    action: "receive_debt_payment",
    params: {
      debtId,
      amount,
      method,
      account,
      notes: String(args.notes ?? "").trim() || null,
    },
    summary,
    now: deps.now?.(),
  });
  if (!pending) return { ok: false, error: "Não foi possível registrar o pagamento." };
  return { ok: true, status: "needs_confirmation", summary };
}

export async function preparePayPayableDebt(
  deps: OpsDeps,
  args: {
    payableDebtId?: string;
    query?: string;
    amount?: unknown;
    paymentMethod?: string;
    account?: unknown;
    notes?: string;
  },
) {
  const amount = parseAmount(args.amount);
  if (amount === null || amount <= 0) {
    return { ok: false, error: "Valor inválido do pagamento." };
  }
  const method = normalizePaymentMethod(args.paymentMethod);
  if (!method) return { ok: false, error: "Forma inválida (Pix, Dinheiro ou Cartão)." };
  const account = resolveAccount(args.account) ?? "Conta Bancária";

  let debtId = String(args.payableDebtId ?? "").trim();
  let label = "";
  let remaining = 0;
  if (!debtId) {
    const query = String(args.query ?? "").trim();
    if (!query) {
      return { ok: false, error: "Informe o credor ou o ID da conta a pagar." };
    }
    const { data: debts, error } = await deps.supabase
      .from("payable_debts")
      .select("id, creditor_name, remaining_amount, status")
      .neq("status", "Quitada")
      .ilike("creditor_name", `%${query}%`)
      .limit(8);
    if (error) return { ok: false, error: error.message };
    const rows = (debts ?? []) as Array<Record<string, unknown>>;
    if (rows.length === 0) {
      return { ok: false, error: "Nenhuma conta a pagar em aberto para esse credor." };
    }
    if (rows.length > 1) {
      return {
        ok: false,
        error: "Mais de uma conta a pagar. Escolha pelo payableDebtId.",
        options: rows,
      };
    }
    debtId = String(rows[0].id);
    label = String(rows[0].creditor_name ?? "");
    remaining = Number(rows[0].remaining_amount ?? 0);
  } else {
    const { data: debt } = await deps.supabase
      .from("payable_debts")
      .select("id, creditor_name, remaining_amount, status")
      .eq("id", debtId)
      .maybeSingle();
    if (!debt) return { ok: false, error: "Conta a pagar não encontrada." };
    const row = debt as Record<string, unknown>;
    if (String(row.status) === "Quitada") {
      return { ok: false, error: "Essa conta já está quitada." };
    }
    label = String(row.creditor_name ?? "");
    remaining = Number(row.remaining_amount ?? 0);
  }
  if (remaining > 0 && amount > remaining + 0.001) {
    return {
      ok: false,
      error: `O valor excede o saldo em aberto (${formatBRL(remaining)}).`,
    };
  }
  const summary =
    `Pagar ${formatBRL(amount)} da conta de ${label || debtId} via ${method} de ${account}`;
  const pending = await createPendingAction(deps.supabase, {
    phone: deps.actor.phone,
    userId: deps.actor.userId,
    channelId: deps.channelId,
    conversationId: deps.conversationId,
    action: "pay_payable_debt",
    params: {
      payableDebtId: debtId,
      amount,
      method,
      account,
      notes: String(args.notes ?? "").trim() || null,
    },
    summary,
    now: deps.now?.(),
  });
  if (!pending) return { ok: false, error: "Não foi possível registrar o pagamento." };
  return { ok: true, status: "needs_confirmation", summary };
}

export async function prepareReleaseReservation(
  deps: OpsDeps,
  args: { stockItemId?: string; query?: string; refundDeposit?: boolean },
) {
  let stockItemId = String(args.stockItemId ?? "").trim();
  let label = "";
  if (!stockItemId) {
    const res = await getReservations(deps, { query: args.query });
    if (!res.ok) return res;
    const list = (res.reservations ?? []) as Array<Record<string, unknown>>;
    if (list.length === 0) {
      return { ok: false, error: "Nenhuma reserva ativa para essa busca." };
    }
    if (list.length > 1) {
      return {
        ok: false,
        error: "Mais de uma reserva corresponde. Escolha pelo stockItemId.",
        options: list,
      };
    }
    stockItemId = String(list[0].stockItemId);
    label = String(list[0].customer ?? "");
  } else {
    const { data: res } = await deps.supabase
      .from("stock_reservations")
      .select("customer_name, status")
      .eq("stock_item_id", stockItemId)
      .eq("status", "active")
      .maybeSingle();
    if (!res) {
      return { ok: false, error: "Reserva ativa não encontrada para esse aparelho." };
    }
    label = String((res as Record<string, unknown>).customer_name ?? "");
  }
  const refund = args.refundDeposit === true;
  const summary = `Liberar a reserva${label ? ` de ${label}` : ""}` +
    (refund ? " e estornar o sinal" : "");
  const pending = await createPendingAction(deps.supabase, {
    phone: deps.actor.phone,
    userId: deps.actor.userId,
    channelId: deps.channelId,
    conversationId: deps.conversationId,
    action: "release_reservation",
    params: { stockItemId, refundDeposit: refund },
    summary,
    now: deps.now?.(),
  });
  if (!pending) return { ok: false, error: "Não foi possível registrar a liberação." };
  return { ok: true, status: "needs_confirmation", summary };
}

/** Execute a confirmed pending action via the admin-actor RPCs. */
export async function executePending(
  deps: OpsDeps,
  pending: PendingAction,
): Promise<{ ok: boolean; message: string; result?: unknown; error?: string }> {
  const p = pending.params as Record<string, unknown>;
  if (pending.action === "transfer") {
    const { data, error } = await deps.supabase.rpc("admin_agent_transfer", {
      p_actor: deps.actor.userId,
      p_amount: Number(p.amount),
      p_from: String(p.from),
      p_to: String(p.to),
    });
    if (error) return { ok: false, message: `Falha: ${error.message}`, error: error.message };
    const balances = await getAccountBalances(deps);
    const tail = balances.ok
      ? ` Saldos — Conta: ${(balances.formatted as any)["Conta Bancária"]} · Cofre: ${(balances.formatted as any)["Cofre"]}.`
      : "";
    return {
      ok: true,
      message: `✅ Transferido ${formatBRL(Number(p.amount))} de ${p.from} para ${p.to}.${tail}`,
      result: data,
    };
  }
  if (pending.action === "reserve_stock") {
    const payload = {
      customerName: p.customerName,
      customerPhone: p.customerPhone,
      expiresAt: p.expiresAt,
      depositAmount: p.depositAmount,
      depositPaymentMethod: p.depositPaymentMethod,
      notes: p.notes,
    };
    const { data, error } = await deps.supabase.rpc(
      "admin_agent_reserve_stock",
      {
        p_actor: deps.actor.userId,
        p_stock_item_id: String(p.stockItemId),
        p_payload: payload,
      },
    );
    if (error) return { ok: false, message: `Falha: ${error.message}`, error: error.message };
    return {
      ok: true,
      message: `✅ Reserva confirmada para ${p.customerName}.`,
      result: data,
    };
  }
  if (pending.action === "register_transaction") {
    const { data, error } = await deps.supabase.rpc(
      "admin_agent_register_transaction",
      {
        p_actor: deps.actor.userId,
        p_type: String(p.type),
        p_category: (p.category as string) ?? null,
        p_amount: Number(p.amount),
        p_account: String(p.account),
        p_description: (p.description as string) ?? null,
      },
    );
    if (error) {
      return { ok: false, message: `Falha: ${error.message}`, error: error.message };
    }
    const verb = String(p.type) === "IN" ? "Receita" : "Despesa";
    return {
      ok: true,
      message: `✅ ${verb} de ${formatBRL(Number(p.amount))} lançada em ${p.account}.`,
      result: data,
    };
  }
  if (pending.action === "receive_debt_payment") {
    const { data, error } = await deps.supabase.rpc(
      "admin_agent_receive_debt_payment",
      {
        p_actor: deps.actor.userId,
        p_debt_id: String(p.debtId),
        p_amount: Number(p.amount),
        p_method: String(p.method),
        p_account: String(p.account),
        p_notes: (p.notes as string) ?? null,
      },
    );
    if (error) {
      return { ok: false, message: `Falha: ${error.message}`, error: error.message };
    }
    const d = (data ?? {}) as Record<string, unknown>;
    const tail = d.status
      ? ` Saldo restante: ${formatBRL(Number(d.remaining ?? 0))} (${d.status}).`
      : "";
    return {
      ok: true,
      message: `✅ Recebido ${formatBRL(Number(p.amount))}.${tail}`,
      result: data,
    };
  }
  if (pending.action === "pay_payable_debt") {
    const { data, error } = await deps.supabase.rpc(
      "admin_agent_pay_payable_debt",
      {
        p_actor: deps.actor.userId,
        p_payable_debt_id: String(p.payableDebtId),
        p_amount: Number(p.amount),
        p_method: String(p.method),
        p_account: String(p.account),
        p_notes: (p.notes as string) ?? null,
      },
    );
    if (error) {
      return { ok: false, message: `Falha: ${error.message}`, error: error.message };
    }
    const d = (data ?? {}) as Record<string, unknown>;
    const tail = d.status
      ? ` Saldo restante: ${formatBRL(Number(d.remaining ?? 0))} (${d.status}).`
      : "";
    return {
      ok: true,
      message: `✅ Pago ${formatBRL(Number(p.amount))}.${tail}`,
      result: data,
    };
  }
  if (pending.action === "release_reservation") {
    const { data, error } = await deps.supabase.rpc(
      "admin_agent_release_reservation",
      {
        p_actor: deps.actor.userId,
        p_stock_item_id: String(p.stockItemId),
        p_refund_deposit: p.refundDeposit === true,
      },
    );
    if (error) {
      return { ok: false, message: `Falha: ${error.message}`, error: error.message };
    }
    return {
      ok: true,
      message: `✅ Reserva liberada${p.refundDeposit === true ? " e sinal estornado" : ""}.`,
      result: data,
    };
  }
  return { ok: false, message: "Ação desconhecida.", error: "unknown_action" };
}
