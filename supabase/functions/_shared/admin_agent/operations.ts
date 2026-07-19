// Finance/inventory operations exposed to the admin agent.
//
// Reads run directly against the DB with the service client. Writes are split:
// `prepare*` never mutates (it records a pending confirmation), and
// `executePending` performs the actual mutation via the admin-actor RPCs after
// the admin confirmed.

import { AdminIdentity } from "./identity.ts";
import { createPendingAction, PendingAction } from "./pending.ts";

interface StorageBucketLike {
  upload: (
    path: string,
    body: unknown,
    opts?: Record<string, unknown>,
  ) => Promise<{ data: unknown; error: { message?: string } | null }>;
  createSignedUrl: (
    path: string,
    expiresIn: number,
  ) => Promise<{ data: { signedUrl: string } | null; error: { message?: string } | null }>;
}

interface SupabaseLike {
  from: (table: string) => any;
  rpc: (fn: string, args?: Record<string, unknown>) => any;
  storage?: { from: (bucket: string) => StorageBucketLike };
}

/** Send a generated document (e.g. a PDF report) back to the admin on WhatsApp. */
export type SendDocumentFn = (args: {
  mediaUrl: string;
  mediaFilename: string;
  mediaType?: string;
  caption?: string;
}) => Promise<{ ok: boolean; error?: string }>;

export interface OpsDeps {
  supabase: SupabaseLike;
  actor: AdminIdentity;
  channelId: string | null;
  conversationId: string | null;
  now?: () => number;
  // Injected by the edge function so report tools can deliver a PDF document.
  sendDocument?: SendDocumentFn;
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

function normalizeCategoryKey(value: string): string {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim().toLowerCase();
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
  const { data, error } = await q
    .order("date", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(limit);
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

export async function searchSellers(
  deps: OpsDeps,
  args: { query?: string },
) {
  const query = String(args.query ?? "").trim();
  let q = deps.supabase.from("sellers").select("id, name, email, store_id");
  if (query) q = q.ilike("name", `%${query}%`);
  const { data, error } = await q.limit(15);
  if (error) return { ok: false, error: error.message };
  return {
    ok: true,
    sellers: ((data ?? []) as Array<Record<string, unknown>>).map((s) => ({
      sellerId: s.id,
      name: s.name,
      email: s.email ?? null,
      storeId: s.store_id ?? null,
    })),
  };
}

export async function listFinanceCategories(
  deps: OpsDeps,
  args: { type?: string },
) {
  let q = deps.supabase
    .from("finance_categories")
    .select("id, name, type, is_default");
  const type = String(args.type ?? "").trim().toUpperCase();
  if (type === "IN" || type === "OUT") q = q.eq("type", type);
  const { data, error } = await q.order("type", { ascending: true }).limit(100);
  if (error) return { ok: false, error: error.message };
  return {
    ok: true,
    categories: ((data ?? []) as Array<Record<string, unknown>>).map((c) => ({
      id: c.id,
      name: c.name,
      type: c.type,
      isDefault: c.is_default === true,
    })),
  };
}

export async function listDeviceCatalog(
  deps: OpsDeps,
  args: { query?: string },
) {
  const query = String(args.query ?? "").trim();
  let q = deps.supabase
    .from("device_catalog")
    .select("id, type, model, color");
  if (query) q = q.ilike("model", `%${query}%`);
  const { data, error } = await q.order("model", { ascending: true }).limit(50);
  if (error) return { ok: false, error: error.message };
  return {
    ok: true,
    devices: ((data ?? []) as Array<Record<string, unknown>>).map((d) => ({
      id: d.id,
      type: d.type,
      model: d.model,
      color: d.color,
    })),
  };
}

/** Resolve a single customer by id or a name/phone query. */
async function resolveCustomer(
  deps: OpsDeps,
  args: { customerId?: string; query?: string },
): Promise<
  | { ok: true; id: string; name: string; phone: string | null }
  | { ok: false; error: string; options?: unknown[] }
> {
  const id = String(args.customerId ?? "").trim();
  if (id) {
    const { data } = await deps.supabase
      .from("customers").select("id, name, phone").eq("id", id).maybeSingle();
    if (!data) return { ok: false, error: "Cliente não encontrado." };
    const row = data as Record<string, unknown>;
    return { ok: true, id: String(row.id), name: String(row.name ?? ""), phone: (row.phone as string) ?? null };
  }
  const query = String(args.query ?? "").trim();
  if (!query) return { ok: false, error: "Informe o cliente (nome ou telefone)." };
  const digits = query.replace(/\D/g, "");
  let cq = deps.supabase.from("customers").select("id, name, phone");
  if (digits.length >= 6) cq = cq.ilike("phone", `%${digits}%`);
  else cq = cq.ilike("name", `%${query}%`);
  const { data, error } = await cq.limit(8);
  if (error) return { ok: false, error: error.message };
  const list = (data ?? []) as Array<Record<string, unknown>>;
  if (list.length === 0) return { ok: false, error: "Cliente não encontrado. Cadastre o cliente antes." };
  if (list.length > 1) {
    return {
      ok: false,
      error: "Mais de um cliente corresponde. Especifique melhor ou informe o customerId.",
      options: list.map((c) => ({ id: c.id, name: c.name, phone: c.phone })),
    };
  }
  return { ok: true, id: String(list[0].id), name: String(list[0].name ?? ""), phone: (list[0].phone as string) ?? null };
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
  // A category is mandatory and must be one of the registered finance
  // categories of the matching type; when it is missing or unknown we return
  // the list so the agent asks the admin instead of guessing a default.
  const requestedCategory = String(args.category ?? "").trim();
  const typeLabel = type === "IN" ? "receita" : "despesa";
  const catList = await listFinanceCategories(deps, { type });
  const knownNames = catList.ok
    ? ((catList.categories ?? []) as Array<{ name: unknown }>).map((c) => String(c.name))
    : [];
  let category = requestedCategory;
  if (knownNames.length > 0) {
    const enumerated = knownNames.join(", ");
    if (!requestedCategory) {
      return {
        ok: false,
        needsCategory: true,
        categories: knownNames,
        error:
          `Falta a categoria do lançamento. Categorias de ${typeLabel} existentes: ${enumerated}. Pergunte ao admin qual usar (ou se quer criar uma nova).`,
      };
    }
    const match = knownNames.find((n) => normalizeCategoryKey(n) === normalizeCategoryKey(requestedCategory));
    if (!match) {
      return {
        ok: false,
        needsCategory: true,
        categories: knownNames,
        error:
          `A categoria "${requestedCategory}" não existe para ${typeLabel}. Existentes: ${enumerated}. Pergunte ao admin qual usar (ou crie com prepare_upsert_finance_category).`,
      };
    }
    category = match;
  } else if (!requestedCategory) {
    return {
      ok: false,
      needsCategory: true,
      categories: [],
      error:
        `Nenhuma categoria de ${typeLabel} cadastrada. Pergunte ao admin o nome da categoria e cadastre com prepare_upsert_finance_category antes do lançamento.`,
    };
  }
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

// --- Stock item writes ------------------------------------------------------

function stockLabel(row: Record<string, unknown>): string {
  return [row.model, row.capacity, row.color]
    .map((v) => String(v ?? "").trim())
    .filter(Boolean)
    .join(" ");
}

/** Resolve a stock item by id or query (any status, for edit/delete). */
async function resolveStockItemAny(
  deps: OpsDeps,
  args: { stockItemId?: string; query?: string },
): Promise<
  | { ok: true; item: Record<string, unknown> }
  | { ok: false; error: string; options?: unknown[] }
> {
  const id = String(args.stockItemId ?? "").trim();
  if (id) {
    const { data } = await deps.supabase
      .from("stock_items")
      .select("id, model, color, capacity, status, sell_price")
      .eq("id", id).maybeSingle();
    if (!data) return { ok: false, error: "Aparelho não encontrado." };
    return { ok: true, item: data as Record<string, unknown> };
  }
  const search = await searchStock(deps, { query: args.query, onlyAvailable: false });
  if (!search.ok) return { ok: false, error: search.error as string };
  const items = (search.items ?? []) as Array<Record<string, unknown>>;
  if (items.length === 0) return { ok: false, error: "Nenhum aparelho corresponde a essa busca." };
  if (items.length > 1) {
    return { ok: false, error: "Mais de um aparelho corresponde. Escolha pelo stockItemId.", options: items };
  }
  const it = items[0];
  return {
    ok: true,
    item: { id: it.stockItemId, model: it.model, color: it.color, capacity: it.capacity, status: it.status, sell_price: it.price },
  };
}

const STOCK_PATCH_KEYS = [
  "model", "imei", "color", "capacity", "condition", "status", "hasBox",
  "batteryHealth", "purchasePrice", "sellPrice", "maxDiscount",
  "warrantyType", "warrantyEnd", "notes", "observations",
] as const;

export async function prepareCreateStockItem(
  deps: OpsDeps,
  args: Record<string, unknown>,
) {
  const model = String(args.model ?? "").trim();
  const imei = String(args.imei ?? "").trim();
  const hasPurchase = args.purchasePrice !== undefined && args.purchasePrice !== null && args.purchasePrice !== "";
  const hasSell = args.sellPrice !== undefined && args.sellPrice !== null && args.sellPrice !== "";
  const purchasePrice = parseAmount(args.purchasePrice);
  const sellPrice = parseAmount(args.sellPrice);
  if (!model) return { ok: false, error: "Informe o modelo do aparelho." };
  if (!imei) return { ok: false, error: "Informe o IMEI/Serial do aparelho." };
  if (!hasPurchase || purchasePrice === null || purchasePrice < 0) return { ok: false, error: "Informe um preço de compra válido." };
  if (!hasSell || sellPrice === null || sellPrice < 0) return { ok: false, error: "Informe um preço de venda válido." };

  const payload: Record<string, unknown> = {
    type: String(args.type ?? "").trim() || "iPhone",
    model,
    imei,
    color: String(args.color ?? "").trim(),
    capacity: String(args.capacity ?? "").trim(),
    condition: String(args.condition ?? "").trim() || "Seminovo",
    status: String(args.status ?? "").trim() || "Disponível",
    hasBox: args.hasBox === true,
    batteryHealth: args.batteryHealth != null ? parseAmount(args.batteryHealth) : null,
    storeId: String(args.storeId ?? "").trim() || null,
    purchasePrice,
    sellPrice,
    maxDiscount: args.maxDiscount != null ? parseAmount(args.maxDiscount) : 0,
    warrantyType: String(args.warrantyType ?? "").trim() || "Loja",
    notes: String(args.notes ?? "").trim() || null,
  };

  const summary = `Cadastrar ${payload.type} ${model}` +
    (payload.capacity ? ` ${payload.capacity}` : "") +
    (payload.color ? ` ${payload.color}` : "") +
    ` (IMEI ${imei}) — compra ${formatBRL(purchasePrice)}, venda ${formatBRL(sellPrice)}`;

  const pending = await createPendingAction(deps.supabase, {
    phone: deps.actor.phone,
    userId: deps.actor.userId,
    channelId: deps.channelId,
    conversationId: deps.conversationId,
    action: "create_stock_item",
    params: { payload },
    summary,
    now: deps.now?.(),
  });
  if (!pending) return { ok: false, error: "Não foi possível registrar o cadastro." };
  return { ok: true, status: "needs_confirmation", summary };
}

export async function prepareUpdateStockItem(
  deps: OpsDeps,
  args: Record<string, unknown>,
) {
  const resolved = await resolveStockItemAny(deps, {
    stockItemId: args.stockItemId as string,
    query: args.query as string,
  });
  if (!resolved.ok) return resolved;
  const item = resolved.item;

  const patch: Record<string, unknown> = {};
  for (const key of STOCK_PATCH_KEYS) {
    if (args[key] === undefined || args[key] === null || args[key] === "") continue;
    if (key === "purchasePrice" || key === "sellPrice" || key === "maxDiscount" || key === "batteryHealth") {
      const n = parseAmount(args[key]);
      if (n !== null) patch[key] = n;
    } else if (key === "hasBox") {
      patch[key] = args[key] === true;
    } else {
      patch[key] = String(args[key]).trim();
    }
  }
  if (Object.keys(patch).length === 0) {
    return { ok: false, error: "Nada para alterar. Informe o que mudar (ex.: preço de venda)." };
  }

  const changes = Object.entries(patch)
    .map(([k, v]) => `${k}=${typeof v === "number" && /price|Discount/i.test(k) ? formatBRL(v) : v}`)
    .join(", ");
  const summary = `Editar ${stockLabel(item)}: ${changes}`;

  const pending = await createPendingAction(deps.supabase, {
    phone: deps.actor.phone,
    userId: deps.actor.userId,
    channelId: deps.channelId,
    conversationId: deps.conversationId,
    action: "update_stock_item",
    params: { stockItemId: item.id, patch },
    summary,
    now: deps.now?.(),
  });
  if (!pending) return { ok: false, error: "Não foi possível registrar a edição." };
  return { ok: true, status: "needs_confirmation", summary };
}

export async function prepareDeleteStockItem(
  deps: OpsDeps,
  args: Record<string, unknown>,
) {
  const resolved = await resolveStockItemAny(deps, {
    stockItemId: args.stockItemId as string,
    query: args.query as string,
  });
  if (!resolved.ok) return resolved;
  const item = resolved.item;
  if (String(item.status) === "Vendido") {
    return { ok: false, error: "Não é possível excluir um aparelho já vendido." };
  }
  const summary = `Excluir do estoque: ${stockLabel(item)}`;
  const pending = await createPendingAction(deps.supabase, {
    phone: deps.actor.phone,
    userId: deps.actor.userId,
    channelId: deps.channelId,
    conversationId: deps.conversationId,
    action: "delete_stock_item",
    params: { stockItemId: item.id },
    summary,
    now: deps.now?.(),
  });
  if (!pending) return { ok: false, error: "Não foi possível registrar a exclusão." };
  return { ok: true, status: "needs_confirmation", summary };
}

// --- Customer / creditor writes ---------------------------------------------

export async function prepareCreateCustomer(
  deps: OpsDeps,
  args: Record<string, unknown>,
) {
  const name = String(args.name ?? "").trim();
  const phone = String(args.phone ?? "").trim();
  if (!name) return { ok: false, error: "Informe o nome do cliente." };
  if (!phone) return { ok: false, error: "Informe o telefone do cliente." };
  const payload = {
    name,
    phone,
    cpf: String(args.cpf ?? "").trim() || null,
    alternativePhone: String(args.alternativePhone ?? "").trim() || null,
    email: String(args.email ?? "").trim() || null,
    birthDate: String(args.birthDate ?? "").trim() || null,
  };
  const summary = `Cadastrar cliente ${name} (${phone})` +
    (payload.cpf ? `, CPF ${payload.cpf}` : "");
  const pending = await createPendingAction(deps.supabase, {
    phone: deps.actor.phone,
    userId: deps.actor.userId,
    channelId: deps.channelId,
    conversationId: deps.conversationId,
    action: "create_customer",
    params: { payload },
    summary,
    now: deps.now?.(),
  });
  if (!pending) return { ok: false, error: "Não foi possível registrar o cadastro." };
  return { ok: true, status: "needs_confirmation", summary };
}

export async function prepareUpdateCustomer(
  deps: OpsDeps,
  args: Record<string, unknown>,
) {
  const resolved = await resolveCustomer(deps, {
    customerId: args.customerId as string,
    query: args.query as string,
  });
  if (!resolved.ok) return resolved;

  const keys = ["name", "cpf", "phone", "alternativePhone", "email", "birthDate"] as const;
  const patch: Record<string, unknown> = {};
  for (const key of keys) {
    if (args[key] === undefined || args[key] === null) continue;
    patch[key] = String(args[key]).trim();
  }
  if (Object.keys(patch).length === 0) {
    return { ok: false, error: "Nada para alterar no cliente." };
  }
  const changes = Object.entries(patch).map(([k, v]) => `${k}=${v || "(vazio)"}`).join(", ");
  const summary = `Editar cliente ${resolved.name}: ${changes}`;
  const pending = await createPendingAction(deps.supabase, {
    phone: deps.actor.phone,
    userId: deps.actor.userId,
    channelId: deps.channelId,
    conversationId: deps.conversationId,
    action: "update_customer",
    params: { customerId: resolved.id, patch },
    summary,
    now: deps.now?.(),
  });
  if (!pending) return { ok: false, error: "Não foi possível registrar a edição." };
  return { ok: true, status: "needs_confirmation", summary };
}

export async function prepareCreateCreditor(
  deps: OpsDeps,
  args: Record<string, unknown>,
) {
  const name = String(args.name ?? "").trim();
  if (!name) return { ok: false, error: "Informe o nome do credor." };
  const documentType = String(args.documentType ?? "").trim().toUpperCase();
  if (documentType && documentType !== "CPF" && documentType !== "CNPJ") {
    return { ok: false, error: "Tipo de documento inválido (CPF ou CNPJ)." };
  }
  const payload = {
    name,
    document: String(args.document ?? "").trim() || null,
    documentType: documentType || null,
    phone: String(args.phone ?? "").trim() || null,
    email: String(args.email ?? "").trim() || null,
    notes: String(args.notes ?? "").trim() || null,
  };
  const summary = `Cadastrar credor ${name}` +
    (payload.document ? ` (${payload.documentType ?? "doc"} ${payload.document})` : "");
  const pending = await createPendingAction(deps.supabase, {
    phone: deps.actor.phone,
    userId: deps.actor.userId,
    channelId: deps.channelId,
    conversationId: deps.conversationId,
    action: "create_creditor",
    params: { payload },
    summary,
    now: deps.now?.(),
  });
  if (!pending) return { ok: false, error: "Não foi possível registrar o cadastro." };
  return { ok: true, status: "needs_confirmation", summary };
}

// --- Manual transaction edit / delete ---------------------------------------

async function fetchManualTransaction(
  deps: OpsDeps,
  id: string,
): Promise<
  | { ok: true; row: Record<string, unknown> }
  | { ok: false; error: string }
> {
  const { data } = await deps.supabase
    .from("transactions")
    .select("id, type, category, amount, date, description, account, sale_id, debt_payment_id, payable_debt_payment_id, payable_debt_id, transfer_group_id")
    .eq("id", id).maybeSingle();
  if (!data) return { ok: false, error: "Lançamento não encontrado." };
  const row = data as Record<string, unknown>;
  if (row.sale_id || row.debt_payment_id || row.payable_debt_payment_id || row.payable_debt_id || row.transfer_group_id) {
    return { ok: false, error: "Só dá para editar/excluir lançamentos manuais (este veio de uma venda/dívida/transferência)." };
  }
  return { ok: true, row };
}

export async function prepareUpdateTransaction(
  deps: OpsDeps,
  args: Record<string, unknown>,
) {
  const id = String(args.transactionId ?? "").trim();
  if (!id) return { ok: false, error: "Informe o ID do lançamento (de list_recent_transactions)." };
  const found = await fetchManualTransaction(deps, id);
  if (!found.ok) return found;

  const patch: Record<string, unknown> = {};
  if (args.category != null && String(args.category).trim()) patch.category = String(args.category).trim();
  if (args.description != null) patch.description = String(args.description).trim();
  if (args.account != null && String(args.account).trim()) {
    const acc = resolveAccount(args.account);
    if (!acc) return { ok: false, error: "Conta inválida ('Conta Bancária' ou 'Cofre')." };
    patch.account = acc;
  }
  if (args.amount != null) {
    const amt = parseAmount(args.amount);
    if (amt === null || amt <= 0) return { ok: false, error: "Valor inválido." };
    patch.amount = amt;
  }
  if (args.date != null && String(args.date).trim()) patch.date = String(args.date).trim();
  if (Object.keys(patch).length === 0) {
    return { ok: false, error: "Nada para alterar no lançamento." };
  }
  const changes = Object.entries(patch)
    .map(([k, v]) => `${k}=${k === "amount" ? formatBRL(v as number) : v}`)
    .join(", ");
  const summary = `Editar lançamento (${formatBRL(Number(found.row.amount))} ${found.row.category}): ${changes}`;
  const pending = await createPendingAction(deps.supabase, {
    phone: deps.actor.phone,
    userId: deps.actor.userId,
    channelId: deps.channelId,
    conversationId: deps.conversationId,
    action: "update_transaction",
    params: { transactionId: id, patch },
    summary,
    now: deps.now?.(),
  });
  if (!pending) return { ok: false, error: "Não foi possível registrar a edição." };
  return { ok: true, status: "needs_confirmation", summary };
}

export async function prepareDeleteTransaction(
  deps: OpsDeps,
  args: Record<string, unknown>,
) {
  const id = String(args.transactionId ?? "").trim();
  if (!id) return { ok: false, error: "Informe o ID do lançamento (de list_recent_transactions)." };
  const found = await fetchManualTransaction(deps, id);
  if (!found.ok) return found;
  const row = found.row;
  const summary = `Excluir o lançamento de ${formatBRL(Number(row.amount))} (${row.category}) em ${row.account}`;
  const pending = await createPendingAction(deps.supabase, {
    phone: deps.actor.phone,
    userId: deps.actor.userId,
    channelId: deps.channelId,
    conversationId: deps.conversationId,
    action: "delete_transaction",
    params: { transactionId: id },
    summary,
    now: deps.now?.(),
  });
  if (!pending) return { ok: false, error: "Não foi possível registrar a exclusão." };
  return { ok: true, status: "needs_confirmation", summary };
}

// --- Settings: finance categories + device catalog -------------------------

export async function prepareUpsertFinanceCategory(
  deps: OpsDeps,
  args: Record<string, unknown>,
) {
  const name = String(args.name ?? "").trim();
  const type = String(args.type ?? "").trim().toUpperCase();
  if (!name) return { ok: false, error: "Informe o nome da categoria." };
  if (type !== "IN" && type !== "OUT") {
    return { ok: false, error: "Tipo inválido (IN = receita, OUT = despesa)." };
  }
  const isDefault = args.isDefault === true;
  const summary = `Salvar categoria financeira "${name}" (${type === "IN" ? "receita" : "despesa"})`;
  const pending = await createPendingAction(deps.supabase, {
    phone: deps.actor.phone,
    userId: deps.actor.userId,
    channelId: deps.channelId,
    conversationId: deps.conversationId,
    action: "upsert_finance_category",
    params: { payload: { name, type, isDefault } },
    summary,
    now: deps.now?.(),
  });
  if (!pending) return { ok: false, error: "Não foi possível registrar a operação." };
  return { ok: true, status: "needs_confirmation", summary };
}

export async function prepareUpsertDeviceCatalog(
  deps: OpsDeps,
  args: Record<string, unknown>,
) {
  const type = String(args.type ?? "").trim();
  const model = String(args.model ?? "").trim();
  const color = String(args.color ?? "").trim();
  const validTypes = ["iPhone", "iPad", "Macbook", "Apple Watch", "Acessório"];
  if (!validTypes.includes(type)) {
    return { ok: false, error: `Tipo inválido (${validTypes.join(", ")}).` };
  }
  if (!model) return { ok: false, error: "Informe o modelo." };
  const summary = `Adicionar ao catálogo: ${type} ${model}${color ? ` ${color}` : ""}`;
  const pending = await createPendingAction(deps.supabase, {
    phone: deps.actor.phone,
    userId: deps.actor.userId,
    channelId: deps.channelId,
    conversationId: deps.conversationId,
    action: "upsert_device_catalog",
    params: { payload: { type, model, color } },
    summary,
    now: deps.now?.(),
  });
  if (!pending) return { ok: false, error: "Não foi possível registrar a operação." };
  return { ok: true, status: "needs_confirmation", summary };
}

// --- Full sale --------------------------------------------------------------

function normalizeSalePaymentType(value: unknown): string | null {
  const v = String(value ?? "").trim().toLowerCase();
  if (v === "pix") return "Pix";
  if (["dinheiro", "espécie", "especie", "cash"].includes(v)) return "Dinheiro";
  if (["cartão débito", "cartao debito", "débito", "debito", "debit"].includes(v)) return "Cartão Débito";
  if (["cartão", "cartao", "card", "crédito", "credito"].includes(v)) return "Cartão";
  if (["devedor", "fiado", "crediário", "crediario", "a prazo"].includes(v)) return "Devedor";
  return null;
}

export async function prepareCreateSale(
  deps: OpsDeps,
  args: Record<string, unknown>,
) {
  // 1) customer (must exist)
  const cust = await resolveCustomer(deps, {
    customerId: args.customerId as string,
    query: args.customerQuery as string,
  });
  if (!cust.ok) return cust;

  // 2) seller
  let sellerId = String(args.sellerId ?? "").trim();
  let sellerName = "";
  if (!sellerId) {
    const sellers = await searchSellers(deps, { query: args.sellerQuery as string });
    if (!sellers.ok) return sellers;
    const list = (sellers.sellers ?? []) as Array<Record<string, unknown>>;
    if (list.length === 0) return { ok: false, error: "Vendedor não encontrado." };
    if (list.length > 1) {
      return { ok: false, error: "Mais de um vendedor corresponde. Escolha pelo sellerId.", options: list };
    }
    sellerId = String(list[0].sellerId);
    sellerName = String(list[0].name ?? "");
  }
  if (!sellerId) return { ok: false, error: "Informe o vendedor da venda." };

  // 3) items — resolve each to an available stock item
  const rawItems = Array.isArray(args.items) ? args.items as Array<Record<string, unknown>> : [];
  if (rawItems.length === 0) return { ok: false, error: "Informe ao menos um aparelho da venda." };
  const items: Array<{ stockItemId: string; price: number; originalPrice: number; label: string }> = [];
  let storeId = String(args.storeId ?? "").trim();
  for (const raw of rawItems) {
    const stockItemId = String(raw.stockItemId ?? "").trim();
    let row: Record<string, unknown> | null = null;
    if (stockItemId) {
      const { data } = await deps.supabase
        .from("stock_items")
        .select("id, model, color, capacity, status, sell_price, store_id")
        .eq("id", stockItemId).maybeSingle();
      row = (data as Record<string, unknown>) ?? null;
    } else {
      const search = await searchStock(deps, { query: raw.query as string, onlyAvailable: true });
      if (!search.ok) return search;
      const found = (search.items ?? []) as Array<Record<string, unknown>>;
      if (found.length === 0) return { ok: false, error: `Nenhum aparelho disponível para "${raw.query ?? ""}".` };
      if (found.length > 1) return { ok: false, error: "Mais de um aparelho corresponde. Informe o stockItemId.", options: found };
      const { data } = await deps.supabase
        .from("stock_items")
        .select("id, model, color, capacity, status, sell_price, store_id")
        .eq("id", found[0].stockItemId).maybeSingle();
      row = (data as Record<string, unknown>) ?? null;
    }
    if (!row) return { ok: false, error: "Aparelho da venda não encontrado." };
    if (String(row.status) !== "Disponível") {
      return { ok: false, error: `${stockLabel(row)} não está disponível (${row.status}).` };
    }
    const listPrice = Number(row.sell_price ?? 0);
    const price = raw.price != null ? (parseAmount(raw.price) ?? listPrice) : listPrice;
    items.push({ stockItemId: String(row.id), price, originalPrice: listPrice, label: stockLabel(row) });
    if (!storeId && row.store_id) storeId = String(row.store_id);
  }

  // 4) totals
  const itemsTotal = items.reduce((s, i) => s + i.price, 0);
  const originalSubtotal = items.reduce((s, i) => s + i.originalPrice, 0);
  const discount = args.discount != null ? (parseAmount(args.discount) ?? 0) : 0;
  const total = Math.round((itemsTotal - discount) * 100) / 100;
  if (total <= 0) return { ok: false, error: "Total da venda inválido." };

  // 5) payments — must sum to total
  const rawPayments = Array.isArray(args.payments) ? args.payments as Array<Record<string, unknown>> : [];
  if (rawPayments.length === 0) return { ok: false, error: "Informe a(s) forma(s) de pagamento." };
  const payments: Array<Record<string, unknown>> = [];
  for (const rp of rawPayments) {
    const type = normalizeSalePaymentType(rp.type);
    const amount = parseAmount(rp.amount);
    if (!type) return { ok: false, error: `Forma de pagamento inválida: ${rp.type ?? ""}.` };
    if (amount === null || amount <= 0) return { ok: false, error: "Valor de pagamento inválido." };
    const pm: Record<string, unknown> = { type, amount };
    if (rp.account) pm.account = resolveAccount(rp.account) ?? undefined;
    if (rp.installments != null) pm.installments = Math.max(1, Math.floor(Number(rp.installments)) || 1);
    if (rp.cardBrand) pm.cardBrand = String(rp.cardBrand);
    if (type === "Devedor") {
      if (!rp.debtDueDate) return { ok: false, error: "Para 'Devedor', informe a data de vencimento (debtDueDate)." };
      pm.debtDueDate = String(rp.debtDueDate);
      if (rp.debtInstallments != null) pm.debtInstallments = Math.max(1, Math.floor(Number(rp.debtInstallments)) || 1);
      if (rp.debtNotes) pm.debtNotes = String(rp.debtNotes);
    }
    payments.push(pm);
  }
  const paySum = Math.round(payments.reduce((s, p) => s + Number(p.amount), 0) * 100) / 100;
  if (Math.abs(paySum - total) > 0.01) {
    return {
      ok: false,
      error: `A soma dos pagamentos (${formatBRL(paySum)}) precisa ser igual ao total (${formatBRL(total)}).`,
    };
  }

  const saleId = "sale_" + crypto.randomUUID().replace(/-/g, "");
  const payload: Record<string, unknown> = {
    id: saleId,
    customerId: cust.id,
    sellerId,
    storeId: storeId || null,
    total,
    discount,
    discountType: discount > 0 ? "amount" : null,
    originalSubtotal,
    negotiatedSubtotal: itemsTotal,
    date: new Date(deps.now?.() ?? Date.now()).toISOString(),
    items: items.map((i) => ({ stockItemId: i.stockItemId, price: i.price, originalPrice: i.originalPrice })),
    paymentMethods: payments,
    tradeIns: [],
  };

  const paySummary = payments.map((p) => `${p.type} ${formatBRL(Number(p.amount))}`).join(" + ");
  const summary = `Registrar venda de ${items.map((i) => i.label).join(", ")} para ${cust.name}` +
    (sellerName ? ` (vendedor ${sellerName})` : "") +
    ` por ${formatBRL(total)} — ${paySummary}`;

  const pending = await createPendingAction(deps.supabase, {
    phone: deps.actor.phone,
    userId: deps.actor.userId,
    channelId: deps.channelId,
    conversationId: deps.conversationId,
    action: "create_sale",
    params: { payload, label: summary },
    summary,
    now: deps.now?.(),
  });
  if (!pending) return { ok: false, error: "Não foi possível registrar a venda." };
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
  if (pending.action === "create_stock_item") {
    const { data, error } = await deps.supabase.rpc("admin_agent_create_stock_item", {
      p_actor: deps.actor.userId,
      p_payload: p.payload,
    });
    if (error) return { ok: false, message: `Falha: ${error.message}`, error: error.message };
    const d = (data ?? {}) as Record<string, unknown>;
    return { ok: true, message: `✅ Aparelho ${d.model ?? ""} cadastrado no estoque.`, result: data };
  }
  if (pending.action === "update_stock_item") {
    const { data, error } = await deps.supabase.rpc("admin_agent_update_stock_item", {
      p_actor: deps.actor.userId,
      p_id: String(p.stockItemId),
      p_patch: p.patch,
    });
    if (error) return { ok: false, message: `Falha: ${error.message}`, error: error.message };
    return { ok: true, message: `✅ Aparelho atualizado.`, result: data };
  }
  if (pending.action === "delete_stock_item") {
    const { data, error } = await deps.supabase.rpc("admin_agent_delete_stock_item", {
      p_actor: deps.actor.userId,
      p_id: String(p.stockItemId),
    });
    if (error) return { ok: false, message: `Falha: ${error.message}`, error: error.message };
    return { ok: true, message: `✅ Aparelho excluído do estoque.`, result: data };
  }
  if (pending.action === "create_customer") {
    const { data, error } = await deps.supabase.rpc("admin_agent_create_customer", {
      p_actor: deps.actor.userId,
      p_payload: p.payload,
    });
    if (error) return { ok: false, message: `Falha: ${error.message}`, error: error.message };
    const d = (data ?? {}) as Record<string, unknown>;
    const msg = d.existed
      ? `ℹ️ Cliente ${d.name ?? ""} já estava cadastrado.`
      : `✅ Cliente ${d.name ?? ""} cadastrado.`;
    return { ok: true, message: msg, result: data };
  }
  if (pending.action === "update_customer") {
    const { data, error } = await deps.supabase.rpc("admin_agent_update_customer", {
      p_actor: deps.actor.userId,
      p_id: String(p.customerId),
      p_patch: p.patch,
    });
    if (error) return { ok: false, message: `Falha: ${error.message}`, error: error.message };
    return { ok: true, message: `✅ Cliente atualizado.`, result: data };
  }
  if (pending.action === "create_creditor") {
    const { data, error } = await deps.supabase.rpc("admin_agent_create_creditor", {
      p_actor: deps.actor.userId,
      p_payload: p.payload,
    });
    if (error) return { ok: false, message: `Falha: ${error.message}`, error: error.message };
    const d = (data ?? {}) as Record<string, unknown>;
    const msg = d.existed
      ? `ℹ️ Credor ${d.name ?? ""} já estava cadastrado.`
      : `✅ Credor ${d.name ?? ""} cadastrado.`;
    return { ok: true, message: msg, result: data };
  }
  if (pending.action === "update_transaction") {
    const { data, error } = await deps.supabase.rpc("admin_agent_update_transaction", {
      p_actor: deps.actor.userId,
      p_id: String(p.transactionId),
      p_patch: p.patch,
    });
    if (error) return { ok: false, message: `Falha: ${error.message}`, error: error.message };
    return { ok: true, message: `✅ Lançamento atualizado.`, result: data };
  }
  if (pending.action === "delete_transaction") {
    const { data, error } = await deps.supabase.rpc("admin_agent_delete_transaction", {
      p_actor: deps.actor.userId,
      p_id: String(p.transactionId),
    });
    if (error) return { ok: false, message: `Falha: ${error.message}`, error: error.message };
    return { ok: true, message: `✅ Lançamento excluído.`, result: data };
  }
  if (pending.action === "create_sale") {
    const { data, error } = await deps.supabase.rpc("admin_agent_create_sale", {
      p_actor: deps.actor.userId,
      p_payload: p.payload,
    });
    if (error) return { ok: false, message: `Falha: ${error.message}`, error: error.message };
    const d = (data ?? {}) as Record<string, unknown>;
    const total = Number(d.total ?? (p.payload as Record<string, unknown>)?.total ?? 0);
    return { ok: true, message: `✅ Venda registrada — ${formatBRL(total)}.`, result: data };
  }
  if (pending.action === "upsert_finance_category") {
    const { data, error } = await deps.supabase.rpc("admin_agent_upsert_finance_category", {
      p_actor: deps.actor.userId,
      p_payload: p.payload,
    });
    if (error) return { ok: false, message: `Falha: ${error.message}`, error: error.message };
    return { ok: true, message: `✅ Categoria financeira salva.`, result: data };
  }
  if (pending.action === "upsert_device_catalog") {
    const { data, error } = await deps.supabase.rpc("admin_agent_upsert_device_catalog", {
      p_actor: deps.actor.userId,
      p_payload: p.payload,
    });
    if (error) return { ok: false, message: `Falha: ${error.message}`, error: error.message };
    return { ok: true, message: `✅ Catálogo de aparelhos atualizado.`, result: data };
  }
  return { ok: false, message: "Ação desconhecida.", error: "unknown_action" };
}
