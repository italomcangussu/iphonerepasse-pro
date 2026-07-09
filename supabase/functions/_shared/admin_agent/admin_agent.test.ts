import {
  assert,
  assertEquals,
} from "https://deno.land/std@0.224.0/assert/mod.ts";
import {
  brazilPhoneKey,
  isAffirmation,
  isNegation,
  phonesMatch,
} from "./phone.ts";
import {
  getFinancialSummary,
  listOverdueDebts,
  prepareCreateSale,
  prepareCreateStockItem,
  prepareDeleteStockItem,
  prepareDeleteTransaction,
  prepareRegisterTransaction,
  prepareTransfer,
  prepareUpdateTransaction,
  prepareUpsertFinanceCategory,
  resolvePeriod,
} from "./operations.ts";
import { runTool } from "./tools.ts";
import { runAdminAgentTurn } from "./runner.ts";
import { asksConfirmation, claimsWriteSuccess } from "./guards.ts";
import type { ChatMessage, RunChatResult } from "./llm.ts";

// --------------------------------------------------------------------------
// Minimal in-memory Supabase double supporting the query surface the agent
// uses (select/eq/neq/in/ilike/order/limit/single/maybeSingle, insert, update,
// rpc). Good enough for deterministic flow tests.
// --------------------------------------------------------------------------
interface Store {
  data: Record<string, Record<string, unknown>[]>;
  rpcCalls: Array<{ fn: string; args: Record<string, unknown> }>;
  rpcImpl: (fn: string, args: Record<string, unknown>) => unknown;
  _id: number;
}

function makeQuery(store: Store, table: string) {
  const q: any = {
    _mode: "select",
    _eq: [] as [string, unknown][],
    _neq: [] as [string, unknown][],
    _in: [] as [string, unknown[]][],
    _ilike: [] as [string, string][],
    _cmp: [] as [string, string, unknown][],
    _notNull: [] as string[],
    _order: null as null | { col: string; asc: boolean },
    _limit: null as null | number,
    _single: false,
    _maybe: false,
    _insertRow: null as Record<string, unknown> | null,
    _updatePatch: null as Record<string, unknown> | null,
  };
  q.select = () => q;
  q.not = (c: string, op: string, v: unknown) => {
    if (op === "is" && v === null) q._notNull.push(c);
    return q;
  };
  q.gt = (c: string, v: unknown) => (q._cmp.push([c, "gt", v]), q);
  q.gte = (c: string, v: unknown) => (q._cmp.push([c, "gte", v]), q);
  q.lt = (c: string, v: unknown) => (q._cmp.push([c, "lt", v]), q);
  q.lte = (c: string, v: unknown) => (q._cmp.push([c, "lte", v]), q);
  q.insert = (payload: Record<string, unknown>) => {
    q._mode = "insert";
    const row = { id: `gen_${store._id++}`, ...payload };
    (store.data[table] ||= []).push(row);
    q._insertRow = row;
    return q;
  };
  q.update = (patch: Record<string, unknown>) => {
    q._mode = "update";
    q._updatePatch = patch;
    return q;
  };
  q.eq = (c: string, v: unknown) => (q._eq.push([c, v]), q);
  q.neq = (c: string, v: unknown) => (q._neq.push([c, v]), q);
  q.in = (c: string, v: unknown[]) => (q._in.push([c, v]), q);
  q.ilike = (c: string, v: string) => (q._ilike.push([c, v]), q);
  q.order = (col: string, opt?: { ascending?: boolean }) => (
    q._order = { col, asc: opt?.ascending !== false }, q
  );
  q.limit = (n: number) => (q._limit = n, q);
  q.single = () => (q._single = true, q);
  q.maybeSingle = () => (q._maybe = true, q);

  const match = (r: Record<string, unknown>) => {
    for (const [c, v] of q._eq) if (r[c] !== v) return false;
    for (const [c, v] of q._neq) if (r[c] === v) return false;
    for (const [c, vals] of q._in) if (!vals.includes(r[c])) return false;
    for (const [c, pat] of q._ilike) {
      const needle = String(pat).replaceAll("%", "").toLowerCase();
      if (!String(r[c] ?? "").toLowerCase().includes(needle)) return false;
    }
    for (const c of q._notNull) if (r[c] === null || r[c] === undefined) return false;
    for (const [c, op, v] of q._cmp) {
      const rv = r[c];
      if (rv === null || rv === undefined) return false;
      const a = typeof rv === "number" ? rv : String(rv);
      const b = typeof rv === "number" ? Number(v) : String(v);
      if (op === "lt" && !(a < b)) return false;
      if (op === "lte" && !(a <= b)) return false;
      if (op === "gt" && !(a > b)) return false;
      if (op === "gte" && !(a >= b)) return false;
    }
    return true;
  };
  q._run = () => {
    if (q._mode === "insert") return { data: q._insertRow, error: null };
    const rows = store.data[table] ||= [];
    if (q._mode === "update") {
      rows.filter(match).forEach((r) => Object.assign(r, q._updatePatch));
      return { data: null, error: null };
    }
    let out = rows.filter(match);
    if (q._order) {
      out = [...out].sort((a, b) => {
        const av = String(a[q._order!.col] ?? "");
        const bv = String(b[q._order!.col] ?? "");
        return q._order!.asc ? av.localeCompare(bv) : bv.localeCompare(av);
      });
    }
    if (q._limit != null) out = out.slice(0, q._limit);
    if (q._single || q._maybe) return { data: out[0] ?? null, error: null };
    return { data: out, error: null };
  };
  q.then = (res: (v: unknown) => unknown, rej?: (e: unknown) => unknown) =>
    Promise.resolve(q._run()).then(res, rej);
  return q;
}

function makeSupabase(
  data: Record<string, Record<string, unknown>[]>,
  rpcImpl: (fn: string, args: Record<string, unknown>) => unknown = () => ({}),
): { supabase: any; store: Store } {
  const store: Store = { data, rpcCalls: [], rpcImpl, _id: 1 };
  const supabase = {
    from: (table: string) => makeQuery(store, table),
    rpc: (fn: string, args: Record<string, unknown> = {}) => {
      store.rpcCalls.push({ fn, args });
      return Promise.resolve({ data: store.rpcImpl(fn, args), error: null });
    },
  };
  return { supabase, store };
}

const ADMIN_ROW = {
  phone: "+5588999998888",
  user_id: "u1",
  label: "Ítalo",
  is_active: true,
};

function baseFixtures() {
  return {
    admin_agent_numbers: [{ ...ADMIN_ROW }],
    user_profiles: [{ id: "u1", role: "admin" }],
    admin_agent_pending_actions: [] as Record<string, unknown>[],
    admin_agent_audit_log: [] as Record<string, unknown>[],
    transactions: [] as Record<string, unknown>[],
  };
}

const balancesRpc = (fn: string) =>
  fn === "admin_agent_account_balances"
    ? { "Conta Bancária": 1000, "Cofre": 500 }
    : { ok: true };

// --------------------------------------------------------------------------
Deno.test("phone: brazilPhoneKey collapses the 9th digit and country code", () => {
  assertEquals(brazilPhoneKey("+55 88 99999-8888"), "8899998888");
  assertEquals(brazilPhoneKey("8899998888"), "8899998888");
  assert(phonesMatch("5588999998888", "+558899998888"));
  assert(phonesMatch("+5588999998888", "88999998888"));
  assert(!phonesMatch("+5588999998888", "+5511999998888"));
});

Deno.test("phone: affirmation / negation detection", () => {
  for (const y of ["sim", "SIM", "confirmo", "pode", "isso", "ok", "👍"]) {
    assert(isAffirmation(y), `expected affirmation: ${y}`);
  }
  for (const n of ["não", "nao", "cancela", "esquece", "👎"]) {
    assert(isNegation(n), `expected negation: ${n}`);
  }
  assert(!isAffirmation("quero ver o saldo"));
  assert(!isNegation("sim, pode"));
});

Deno.test("prepareTransfer rejects invalid input and never mutates", async () => {
  const { supabase, store } = makeSupabase(baseFixtures(), balancesRpc);
  const deps = {
    supabase,
    actor: { userId: "u1", phone: ADMIN_ROW.phone, label: "Ítalo" },
    channelId: "c1",
    conversationId: "conv1",
  };
  assertEquals((await prepareTransfer(deps, { amount: 0, from: "Cofre", to: "Conta Bancária" })).ok, false);
  assertEquals((await prepareTransfer(deps, { amount: 100, from: "Cofre", to: "Cofre" })).ok, false);
  assertEquals((await prepareTransfer(deps, { amount: 100, from: "Xis", to: "Cofre" })).ok, false);
  assertEquals(store.data.admin_agent_pending_actions.length, 0);
  assert(store.rpcCalls.every((c) => c.fn !== "admin_agent_transfer"));
});

Deno.test("unauthorized sender is denied and never resolves an admin", async () => {
  const { supabase } = makeSupabase(baseFixtures(), balancesRpc);
  const result = await runAdminAgentTurn({
    supabase,
    channelId: "c1",
    conversationId: "conv1",
    senderPhone: "+5511911112222",
    messageContent: "saldo do cofre",
    apiKey: "x",
    now: () => 1000,
  });
  assertEquals(result.authorized, false);
  assert(result.reply.includes("não está autorizado"));
});

Deno.test("two-step transfer: prepare on turn 1, execute only after SIM", async () => {
  const fixtures = baseFixtures();
  const { supabase, store } = makeSupabase(fixtures, balancesRpc);
  const NOW = 1_000_000;

  // Turn 1 — the LLM decides to prepare a transfer (stubbed chat).
  const chatPrepare = async (
    _messages: ChatMessage[],
    deps: any,
  ): Promise<RunChatResult> => {
    const result = await runTool(
      "prepare_transfer",
      { amount: 200, from: "Cofre", to: "Conta Bancária" },
      deps,
    );
    return {
      reply: "Confirmar transferência de R$200,00 de Cofre para Conta Bancária? Responda SIM ou NÃO.",
      toolTrace: [{ name: "prepare_transfer", args: {}, result }],
    };
  };

  const turn1 = await runAdminAgentTurn({
    supabase,
    channelId: "c1",
    conversationId: "conv1",
    senderPhone: "5588999998888",
    messageContent: "transfere 200 do cofre pra conta",
    apiKey: "x",
    now: () => NOW,
    chat: chatPrepare,
  });
  assertEquals(turn1.authorized, true);
  const pendings = store.data.admin_agent_pending_actions;
  assertEquals(pendings.length, 1);
  assertEquals(pendings[0].status, "pending");
  assertEquals(pendings[0].action, "transfer");
  // No money moved yet.
  assert(store.rpcCalls.every((c) => c.fn !== "admin_agent_transfer"));

  // Turn 2 — admin says SIM: deterministic execution, no LLM.
  const chatShouldNotRun = async (): Promise<RunChatResult> => {
    throw new Error("LLM must not run on the confirmation turn");
  };
  const turn2 = await runAdminAgentTurn({
    supabase,
    channelId: "c1",
    conversationId: "conv1",
    senderPhone: "+5588999998888",
    messageContent: "sim",
    apiKey: "x",
    now: () => NOW + 1000,
    chat: chatShouldNotRun,
  });
  assertEquals(turn2.mutation?.action, "transfer");
  assertEquals(turn2.mutation?.ok, true);
  const transferCall = store.rpcCalls.find((c) => c.fn === "admin_agent_transfer");
  assert(transferCall, "expected admin_agent_transfer rpc");
  assertEquals(transferCall!.args.p_actor, "u1");
  assertEquals(transferCall!.args.p_amount, 200);
  assertEquals(transferCall!.args.p_from, "Cofre");
  assertEquals(transferCall!.args.p_to, "Conta Bancária");
  assertEquals(store.data.admin_agent_pending_actions[0].status, "confirmed");
  assert(turn2.reply.includes("✅"));
});

Deno.test("pending transfer is cancelled on NÃO and never executes", async () => {
  const fixtures = baseFixtures();
  const { supabase, store } = makeSupabase(fixtures, balancesRpc);
  const NOW = 2_000_000;
  const chatPrepare = async (_m: ChatMessage[], deps: any): Promise<RunChatResult> => {
    await runTool("prepare_transfer", { amount: 50, from: "Conta Bancária", to: "Cofre" }, deps);
    return { reply: "Confirmar? SIM/NÃO", toolTrace: [] };
  };
  await runAdminAgentTurn({
    supabase, channelId: "c1", conversationId: "conv1",
    senderPhone: "+5588999998888", messageContent: "passa 50 pro cofre",
    apiKey: "x", now: () => NOW, chat: chatPrepare,
  });
  const turn2 = await runAdminAgentTurn({
    supabase, channelId: "c1", conversationId: "conv1",
    senderPhone: "+5588999998888", messageContent: "não",
    apiKey: "x", now: () => NOW + 1000,
    chat: async () => ({ reply: "should not run", toolTrace: [] }),
  });
  assert(turn2.reply.toLowerCase().includes("cancelada"));
  assert(store.rpcCalls.every((c) => c.fn !== "admin_agent_transfer"));
  assertEquals(store.data.admin_agent_pending_actions[0].status, "cancelled");
});

Deno.test("expired pending is not executed on a late SIM", async () => {
  const fixtures = baseFixtures();
  const { supabase, store } = makeSupabase(fixtures, balancesRpc);
  const NOW = 3_000_000;
  const chatPrepare = async (_m: ChatMessage[], deps: any): Promise<RunChatResult> => {
    await runTool("prepare_transfer", { amount: 10, from: "Cofre", to: "Conta Bancária" }, deps);
    return { reply: "Confirmar? SIM/NÃO", toolTrace: [] };
  };
  await runAdminAgentTurn({
    supabase, channelId: "c1", conversationId: "conv1",
    senderPhone: "+5588999998888", messageContent: "passa 10",
    apiKey: "x", now: () => NOW, chat: chatPrepare,
  });
  // Jump past the TTL (5 min) then say SIM.
  let llmRan = false;
  await runAdminAgentTurn({
    supabase, channelId: "c1", conversationId: "conv1",
    senderPhone: "+5588999998888", messageContent: "sim",
    apiKey: "x", now: () => NOW + 6 * 60 * 1000,
    chat: async () => { llmRan = true; return { reply: "ok", toolTrace: [] }; },
  });
  assert(store.rpcCalls.every((c) => c.fn !== "admin_agent_transfer"));
  assertEquals(store.data.admin_agent_pending_actions[0].status, "expired");
  assert(llmRan, "an expired confirmation should fall through to the LLM as a new request");
});

// --------------------------------------------------------------------------
// Manager operations (reads + additional guarded writes)
// --------------------------------------------------------------------------

// 2026-07-08 15:00 UTC == 12:00 America/Sao_Paulo (SP date is 2026-07-08).
const NOW_SP = Date.UTC(2026, 6, 8, 15, 0, 0);

function managerDeps(supabase: any) {
  return {
    supabase,
    actor: { userId: "u1", phone: ADMIN_ROW.phone, label: "Ítalo" },
    channelId: "c1",
    conversationId: "conv1",
    now: () => NOW_SP,
  };
}

Deno.test("resolvePeriod: default is the current month, 'hoje' is the business day", () => {
  const month = resolvePeriod(undefined, NOW_SP);
  assertEquals(month.label, "mês atual");
  assert(month.fromISO.startsWith("2026-07-01T00:00:00-03:00"));
  assert(month.toISO.startsWith("2026-08-01T00:00:00-03:00"));

  const today = resolvePeriod("hoje", NOW_SP);
  assertEquals(today.label, "hoje");
  assert(today.fromISO.startsWith("2026-07-08T00:00:00-03:00"));
  assert(today.toISO.startsWith("2026-07-09T00:00:00-03:00"));
});

Deno.test("getFinancialSummary formats the RPC aggregate", async () => {
  const rpc = (fn: string) =>
    fn === "admin_agent_financial_summary"
      ? {
        income: 5000,
        expense: 1200.5,
        net: 3799.5,
        count: 12,
        topExpenseCategories: [{ category: "Compra", total: 900 }],
      }
      : {};
  const { supabase, store } = makeSupabase(baseFixtures(), rpc);
  const res = await getFinancialSummary(managerDeps(supabase), {}) as
    Record<string, any>;
  assertEquals(res.ok, true);
  assertEquals(res.period, "mês atual");
  assert(res.income.includes("5.000,00"));
  assert(res.expense.includes("1.200,50"));
  assertEquals(res.transactions, 12);
  assertEquals(res.topExpenseCategories[0].category, "Compra");
  const call = store.rpcCalls.find((c) => c.fn === "admin_agent_financial_summary");
  assert(call);
  assert(String(call!.args.p_from).startsWith("2026-07-01"));
});

Deno.test("listOverdueDebts returns only past-due open debts with names", async () => {
  const fixtures = {
    ...baseFixtures(),
    customers: [{ id: "cust1", name: "Felipe Vieira", phone: "8899990000" }],
    debts: [
      { id: "debt1", customer_id: "cust1", remaining_amount: 300, due_date: "2026-06-01", status: "Aberta" },
      { id: "debt2", customer_id: "cust1", remaining_amount: 100, due_date: "2026-12-01", status: "Aberta" },
      { id: "debt3", customer_id: "cust1", remaining_amount: 0, due_date: "2026-05-01", status: "Quitada" },
      { id: "debt4", customer_id: "cust1", remaining_amount: 50, due_date: null, status: "Aberta" },
    ],
  };
  const { supabase } = makeSupabase(fixtures, balancesRpc);
  const res = await listOverdueDebts(managerDeps(supabase), {}) as
    Record<string, any>;
  assertEquals(res.ok, true);
  assertEquals(res.today, "2026-07-08");
  assertEquals(res.debts.length, 1);
  assertEquals(res.debts[0].debtId, "debt1");
  assertEquals(res.debts[0].customer, "Felipe Vieira");
});

Deno.test("two-step register_transaction: prepare then SIM executes via RPC", async () => {
  const { supabase, store } = makeSupabase(baseFixtures(), balancesRpc);
  const NOW = 5_000_000;
  const chatPrepare = async (_m: ChatMessage[], deps: any): Promise<RunChatResult> => {
    const result = await runTool(
      "prepare_register_transaction",
      { type: "OUT", amount: 300, account: "Cofre", category: "Insumo", description: "Peças" },
      deps,
    );
    return { reply: "Confirmar? SIM/NÃO", toolTrace: [{ name: "prepare_register_transaction", args: {}, result }] };
  };
  const t1 = await runAdminAgentTurn({
    supabase, channelId: "c1", conversationId: "conv1",
    senderPhone: "+5588999998888", messageContent: "lança 300 de peças no cofre",
    apiKey: "x", now: () => NOW, chat: chatPrepare,
  });
  assertEquals(t1.authorized, true);
  assertEquals(store.data.admin_agent_pending_actions.length, 1);
  assertEquals(store.data.admin_agent_pending_actions[0].action, "register_transaction");
  assert(store.rpcCalls.every((c) => c.fn !== "admin_agent_register_transaction"));

  const t2 = await runAdminAgentTurn({
    supabase, channelId: "c1", conversationId: "conv1",
    senderPhone: "+5588999998888", messageContent: "sim",
    apiKey: "x", now: () => NOW + 1000,
    chat: async () => { throw new Error("LLM must not run on confirmation"); },
  });
  assertEquals(t2.mutation?.action, "register_transaction");
  assertEquals(t2.mutation?.ok, true);
  const call = store.rpcCalls.find((c) => c.fn === "admin_agent_register_transaction");
  assert(call, "expected admin_agent_register_transaction rpc");
  assertEquals(call!.args.p_actor, "u1");
  assertEquals(call!.args.p_type, "OUT");
  assertEquals(call!.args.p_amount, 300);
  assertEquals(call!.args.p_account, "Cofre");
});

Deno.test("prepareRegisterTransaction without category enumerates existing categories and stages nothing", async () => {
  const fixtures = {
    ...baseFixtures(),
    finance_categories: [
      { id: "fc1", name: "Aporte", type: "IN", is_default: true },
      { id: "fc2", name: "Insumo", type: "OUT", is_default: false },
      { id: "fc3", name: "Serviço", type: "OUT", is_default: false },
    ],
  };
  const { supabase, store } = makeSupabase(fixtures, balancesRpc);
  const deps = {
    supabase,
    actor: { userId: "u1", phone: ADMIN_ROW.phone, label: "Ítalo" },
    channelId: "c1",
    conversationId: "conv1",
  };
  const res = await prepareRegisterTransaction(deps, { type: "OUT", amount: 300, account: "Cofre" }) as any;
  assertEquals(res.ok, false);
  assertEquals(res.needsCategory, true);
  assertEquals(res.categories, ["Insumo", "Serviço"]);
  assert(String(res.error).includes("Insumo"));
  assert(String(res.error).includes("Serviço"));
  assert(!String(res.error).includes("Aporte"), "IN category must not be offered for an OUT entry");
  assertEquals(store.data.admin_agent_pending_actions.length, 0);
});

Deno.test("prepareRegisterTransaction rejects unknown category listing the valid ones", async () => {
  const fixtures = {
    ...baseFixtures(),
    finance_categories: [
      { id: "fc1", name: "Insumo", type: "OUT", is_default: false },
    ],
  };
  const { supabase, store } = makeSupabase(fixtures, balancesRpc);
  const deps = {
    supabase,
    actor: { userId: "u1", phone: ADMIN_ROW.phone, label: "Ítalo" },
    channelId: "c1",
    conversationId: "conv1",
  };
  const res = await prepareRegisterTransaction(
    deps,
    { type: "OUT", amount: 300, account: "Cofre", category: "Marketing" },
  ) as any;
  assertEquals(res.ok, false);
  assertEquals(res.needsCategory, true);
  assert(String(res.error).includes("Marketing"));
  assert(String(res.error).includes("Insumo"));
  assertEquals(store.data.admin_agent_pending_actions.length, 0);
});

Deno.test("prepareRegisterTransaction matches category case/accent-insensitively and stages the canonical name", async () => {
  const fixtures = {
    ...baseFixtures(),
    finance_categories: [
      { id: "fc1", name: "Serviço", type: "OUT", is_default: false },
    ],
  };
  const { supabase, store } = makeSupabase(fixtures, balancesRpc);
  const deps = {
    supabase,
    actor: { userId: "u1", phone: ADMIN_ROW.phone, label: "Ítalo" },
    channelId: "c1",
    conversationId: "conv1",
  };
  const res = await prepareRegisterTransaction(
    deps,
    { type: "OUT", amount: 120, account: "Conta Bancária", category: "servico" },
  ) as any;
  assertEquals(res.ok, true);
  assertEquals(store.data.admin_agent_pending_actions.length, 1);
  const params = store.data.admin_agent_pending_actions[0].params as Record<string, unknown>;
  assertEquals(params.category, "Serviço");
});

Deno.test("two-step receive_debt_payment resolves the debt by customer, executes on SIM", async () => {
  const fixtures = {
    ...baseFixtures(),
    customers: [{ id: "cust1", name: "Felipe Vieira", phone: "8899990000" }],
    debts: [{ id: "debt1", customer_id: "cust1", original_amount: 300, remaining_amount: 300, status: "Aberta", due_date: "2026-06-01" }],
  };
  const rpc = (fn: string, _args: Record<string, unknown>) =>
    fn === "admin_agent_receive_debt_payment"
      ? { paymentId: "dpm_x", remaining: 200, status: "Parcial" }
      : balancesRpc(fn);
  const { supabase, store } = makeSupabase(fixtures, rpc);
  const NOW = 6_000_000;
  const chatPrepare = async (_m: ChatMessage[], deps: any): Promise<RunChatResult> => {
    const result = await runTool(
      "prepare_receive_debt_payment",
      { query: "felipe", amount: 100, paymentMethod: "Pix" },
      deps,
    );
    return { reply: "Confirmar? SIM/NÃO", toolTrace: [{ name: "prepare_receive_debt_payment", args: {}, result }] };
  };
  await runAdminAgentTurn({
    supabase, channelId: "c1", conversationId: "conv1",
    senderPhone: "+5588999998888", messageContent: "recebi 100 do felipe no pix",
    apiKey: "x", now: () => NOW, chat: chatPrepare,
  });
  const pend = store.data.admin_agent_pending_actions[0];
  assertEquals(pend.action, "receive_debt_payment");
  assertEquals((pend.params as any).debtId, "debt1");
  assert(store.rpcCalls.every((c) => c.fn !== "admin_agent_receive_debt_payment"));

  const t2 = await runAdminAgentTurn({
    supabase, channelId: "c1", conversationId: "conv1",
    senderPhone: "+5588999998888", messageContent: "sim",
    apiKey: "x", now: () => NOW + 1000,
    chat: async () => { throw new Error("LLM must not run on confirmation"); },
  });
  assertEquals(t2.mutation?.ok, true);
  const call = store.rpcCalls.find((c) => c.fn === "admin_agent_receive_debt_payment");
  assert(call, "expected admin_agent_receive_debt_payment rpc");
  assertEquals(call!.args.p_debt_id, "debt1");
  assertEquals(call!.args.p_amount, 100);
  assertEquals(call!.args.p_method, "Pix");
});

// --------------------------------------------------------------------------
// Honesty guard — the agent must never claim/confirm an operation the LLM did
// not actually stage. Regression for the 2026-07-09 bug where the model wrote
// the whole "Resumo… Responda SIM" + "Despesa registrada com sucesso!" flow as
// prose without ever calling prepare_register_transaction, so nothing was
// staged and nothing was executed, yet the admin was told it succeeded.
// --------------------------------------------------------------------------

// The literal messages the model produced in production (from the screenshot).
const FABRICATED_CONFIRM =
  "Entendido! Vou ajustar a categoria para 'Compra de aparelho'.\n\n📥 *Resumo da operação:*\n- *Tipo:* Despesa (OUT)\n- *Conta:* Conta Bancária\n- *Valor:* R$ 7.000,00\n- *Categoria:* Compra de aparelho\n- *Descrição:* 17PM 256GB LARANJA LACRADO\n\nResponda SIM para confirmar ou NÃO para cancelar.";
const FABRICATED_SUCCESS =
  "✅ *Despesa registrada com sucesso!*\n\nSaída de R$ 7.000,00 da Conta Bancária lançada.\n\n*Novo saldo da Conta Bancária:* R$ 27.382,50";

Deno.test("guards: detect fabricated confirmation and success, spare read replies", () => {
  assert(asksConfirmation(FABRICATED_CONFIRM), "should flag the SIM/NÃO ask");
  assert(claimsWriteSuccess(FABRICATED_SUCCESS), "should flag the success claim");
  assert(asksConfirmation("Confirmar? SIM/NÃO"));
  // Reads must not be flagged.
  assert(!asksConfirmation("O saldo da Conta Bancária é R$ 27.382,50 e o Cofre R$ 500,00."));
  assert(!claimsWriteSuccess("O saldo da Conta Bancária é R$ 27.382,50 e o Cofre R$ 500,00."));
  assert(
    !claimsWriteSuccess("Últimos lançamentos:\n- Despesa de R$ 300 (Insumo) registrada em 08/07."),
    "listing an existing transaction is not a success claim",
  );
});

Deno.test("runner neutralizes a fabricated confirmation when nothing was staged", async () => {
  const { supabase, store } = makeSupabase(baseFixtures(), balancesRpc);
  // The model asks for SIM/NÃO but never calls a prepare_* tool.
  const chatNoStage = async (): Promise<RunChatResult> => ({
    reply: FABRICATED_CONFIRM,
    toolTrace: [],
  });
  const res = await runAdminAgentTurn({
    supabase,
    channelId: "c1",
    conversationId: "conv1",
    senderPhone: "+5588999998888",
    messageContent: "Da saída na conta de 7000, compra de aparelho",
    apiKey: "x",
    now: () => 10_000_000,
    chat: chatNoStage,
  });
  assert(!asksConfirmation(res.reply), "must not pass through a fake SIM/NÃO prompt");
  assert(res.reply.includes("não executei nada") || res.reply.includes("Ainda não"));
  assertEquals(store.data.admin_agent_pending_actions.length, 0);
});

Deno.test("runner neutralizes a fabricated success and moves no money", async () => {
  const { supabase, store } = makeSupabase(baseFixtures(), balancesRpc);
  // "Sim" with no pending action falls to the LLM, which hallucinates success.
  const chatHallucinate = async (): Promise<RunChatResult> => ({
    reply: FABRICATED_SUCCESS,
    toolTrace: [],
  });
  const res = await runAdminAgentTurn({
    supabase,
    channelId: "c1",
    conversationId: "conv1",
    senderPhone: "+5588999998888",
    messageContent: "Sim",
    apiKey: "x",
    now: () => 11_000_000,
    chat: chatHallucinate,
  });
  assert(!claimsWriteSuccess(res.reply), "must not tell the admin it succeeded");
  assertEquals(res.mutation ?? null, null);
  assert(store.rpcCalls.every((c) => c.fn !== "admin_agent_register_transaction"));
});

Deno.test("runner authors the SIM/NÃO prompt deterministically from a real prepare", async () => {
  const { supabase, store } = makeSupabase(baseFixtures(), balancesRpc);
  // The model does call prepare, but writes a chatty (non-canonical) reply.
  const chatPrepare = async (_m: ChatMessage[], deps: any): Promise<RunChatResult> => {
    const result = await runTool(
      "prepare_register_transaction",
      { type: "OUT", amount: 7000, account: "Conta Bancária", category: "Compra de aparelho", description: "17PM 256GB LARANJA LACRADO" },
      deps,
    );
    return {
      reply: "beleza, preparei aí 👍",
      toolTrace: [{ name: "prepare_register_transaction", args: {}, result }],
    };
  };
  const res = await runAdminAgentTurn({
    supabase,
    channelId: "c1",
    conversationId: "conv1",
    senderPhone: "+5588999998888",
    messageContent: "lança 7000 de compra de aparelho na conta",
    apiKey: "x",
    now: () => 12_000_000,
    chat: chatPrepare,
  });
  assertEquals(store.data.admin_agent_pending_actions.length, 1);
  assert(res.reply.includes("7.000,00"), "canonical reply carries the staged summary");
  assert(res.reply.includes("SIM"), "canonical reply asks for confirmation");
  assert(res.reply.includes("Compra de aparelho"));
});

// --------------------------------------------------------------------------
// Full manager operations (stock, sale, edit/delete, settings, report)
// --------------------------------------------------------------------------

Deno.test("prepareCreateStockItem validates required fields and stages a pending", async () => {
  const { supabase, store } = makeSupabase(baseFixtures(), balancesRpc);
  const deps = managerDeps(supabase);
  // Missing required fields → no mutation.
  assertEquals((await prepareCreateStockItem(deps, { model: "iPhone 13" }) as any).ok, false);
  assertEquals((await prepareCreateStockItem(deps, { model: "iPhone 13", imei: "123", purchasePrice: 1800 }) as any).ok, false);
  assertEquals(store.data.admin_agent_pending_actions.length, 0);

  const ok = await prepareCreateStockItem(deps, {
    model: "iPhone 13", imei: "356789", capacity: "128 GB", color: "Preto",
    purchasePrice: 1800, sellPrice: 2600,
  }) as any;
  assertEquals(ok.ok, true);
  const pend = store.data.admin_agent_pending_actions[0];
  assertEquals(pend.action, "create_stock_item");
  assertEquals((pend.params as any).payload.model, "iPhone 13");
  assertEquals((pend.params as any).payload.sellPrice, 2600);
});

Deno.test("two-step create_stock_item: SIM executes admin_agent_create_stock_item", async () => {
  const rpc = (fn: string) =>
    fn === "admin_agent_create_stock_item" ? { id: "stk_new", model: "iPhone 13" } : balancesRpc(fn);
  const { supabase, store } = makeSupabase(baseFixtures(), rpc);
  const NOW = 20_000_000;
  const chatPrepare = async (_m: ChatMessage[], deps: any): Promise<RunChatResult> => {
    const result = await runTool("prepare_create_stock_item", {
      model: "iPhone 13", imei: "356789", purchasePrice: 1800, sellPrice: 2600,
    }, deps);
    return { reply: "preparei", toolTrace: [{ name: "prepare_create_stock_item", args: {}, result }] };
  };
  await runAdminAgentTurn({
    supabase, channelId: "c1", conversationId: "conv1",
    senderPhone: "+5588999998888", messageContent: "cadastra um iphone 13",
    apiKey: "x", now: () => NOW, chat: chatPrepare,
  });
  const t2 = await runAdminAgentTurn({
    supabase, channelId: "c1", conversationId: "conv1",
    senderPhone: "+5588999998888", messageContent: "sim",
    apiKey: "x", now: () => NOW + 1000,
    chat: async () => { throw new Error("LLM must not run on confirmation"); },
  });
  assertEquals(t2.mutation?.action, "create_stock_item");
  assertEquals(t2.mutation?.ok, true);
  const call = store.rpcCalls.find((c) => c.fn === "admin_agent_create_stock_item");
  assert(call, "expected admin_agent_create_stock_item rpc");
  assertEquals(call!.args.p_actor, "u1");
  assertEquals((call!.args.p_payload as any).model, "iPhone 13");
});

Deno.test("prepareDeleteStockItem blocks a sold device", async () => {
  const fixtures = {
    ...baseFixtures(),
    stock_items: [{ id: "stk_sold", model: "iPhone 12", color: "Azul", capacity: "64 GB", status: "Vendido", sell_price: 2000 }],
  };
  const { supabase, store } = makeSupabase(fixtures, balancesRpc);
  const res = await prepareDeleteStockItem(managerDeps(supabase), { stockItemId: "stk_sold" }) as any;
  assertEquals(res.ok, false);
  assert(String(res.error).toLowerCase().includes("vendido"));
  assertEquals(store.data.admin_agent_pending_actions.length, 0);
});

Deno.test("manual-transaction guard: cannot edit/delete a sale-generated transaction", async () => {
  const fixtures = {
    ...baseFixtures(),
    transactions: [{ id: "trx_sale", type: "IN", category: "Venda", amount: 2600, account: "Conta Bancária", date: "2026-07-08", sale_id: "sale1", debt_payment_id: null, payable_debt_payment_id: null, payable_debt_id: null, transfer_group_id: null }],
  };
  const { supabase, store } = makeSupabase(fixtures, balancesRpc);
  const del = await prepareDeleteTransaction(managerDeps(supabase), { transactionId: "trx_sale" }) as any;
  const upd = await prepareUpdateTransaction(managerDeps(supabase), { transactionId: "trx_sale", amount: 10 }) as any;
  assertEquals(del.ok, false);
  assertEquals(upd.ok, false);
  assertEquals(store.data.admin_agent_pending_actions.length, 0);
});

Deno.test("prepareDeleteTransaction stages for a manual transaction", async () => {
  const fixtures = {
    ...baseFixtures(),
    transactions: [{ id: "trx_man", type: "OUT", category: "Insumo", amount: 50, account: "Cofre", date: "2026-07-08", sale_id: null, debt_payment_id: null, payable_debt_payment_id: null, payable_debt_id: null, transfer_group_id: null }],
  };
  const { supabase, store } = makeSupabase(fixtures, balancesRpc);
  const res = await prepareDeleteTransaction(managerDeps(supabase), { transactionId: "trx_man" }) as any;
  assertEquals(res.ok, true);
  assertEquals(store.data.admin_agent_pending_actions[0].action, "delete_transaction");
});

Deno.test("prepareUpsertFinanceCategory rejects an invalid type", async () => {
  const { supabase, store } = makeSupabase(baseFixtures(), balancesRpc);
  const res = await prepareUpsertFinanceCategory(managerDeps(supabase), { name: "Marketing", type: "XX" }) as any;
  assertEquals(res.ok, false);
  assertEquals(store.data.admin_agent_pending_actions.length, 0);
});

function saleFixtures() {
  return {
    ...baseFixtures(),
    customers: [{ id: "cust1", name: "Maria Souza", phone: "8899991111" }],
    sellers: [{ id: "sel1", name: "João Vendedor", email: "j@x.com", store_id: "loja1" }],
    stock_items: [{ id: "stk1", model: "iPhone 13", color: "Preto", capacity: "128 GB", status: "Disponível", sell_price: 2600, store_id: "loja1" }],
  };
}

Deno.test("prepareCreateSale refuses when payments do not equal the total", async () => {
  const { supabase, store } = makeSupabase(saleFixtures(), balancesRpc);
  const res = await prepareCreateSale(managerDeps(supabase), {
    customerQuery: "maria", sellerQuery: "joão",
    items: [{ stockItemId: "stk1" }],
    payments: [{ type: "Pix", amount: 2000 }],
  }) as any;
  assertEquals(res.ok, false);
  assert(String(res.error).includes("igual ao total"));
  assertEquals(store.data.admin_agent_pending_actions.length, 0);
});

Deno.test("two-step create_sale: builds a valid payload and executes on SIM", async () => {
  const rpc = (fn: string) =>
    fn === "admin_agent_create_sale" ? { id: "sale_x", total: 2600 } : balancesRpc(fn);
  const { supabase, store } = makeSupabase(saleFixtures(), rpc);
  const NOW = 21_000_000;
  const chatPrepare = async (_m: ChatMessage[], deps: any): Promise<RunChatResult> => {
    const result = await runTool("prepare_create_sale", {
      customerQuery: "maria", sellerQuery: "joão",
      items: [{ stockItemId: "stk1" }],
      payments: [{ type: "Pix", amount: 2600 }],
    }, deps);
    return { reply: "preparei a venda", toolTrace: [{ name: "prepare_create_sale", args: {}, result }] };
  };
  await runAdminAgentTurn({
    supabase, channelId: "c1", conversationId: "conv1",
    senderPhone: "+5588999998888", messageContent: "vende o iphone 13 pra maria",
    apiKey: "x", now: () => NOW, chat: chatPrepare,
  });
  const pend = store.data.admin_agent_pending_actions[0];
  assertEquals(pend.action, "create_sale");
  const payload = (pend.params as any).payload;
  assertEquals(payload.customerId, "cust1");
  assertEquals(payload.sellerId, "sel1");
  assertEquals(payload.total, 2600);
  assertEquals(payload.items[0].stockItemId, "stk1");
  assert(store.rpcCalls.every((c) => c.fn !== "admin_agent_create_sale"));

  const t2 = await runAdminAgentTurn({
    supabase, channelId: "c1", conversationId: "conv1",
    senderPhone: "+5588999998888", messageContent: "sim",
    apiKey: "x", now: () => NOW + 1000,
    chat: async () => { throw new Error("LLM must not run on confirmation"); },
  });
  assertEquals(t2.mutation?.action, "create_sale");
  assertEquals(t2.mutation?.ok, true);
  const call = store.rpcCalls.find((c) => c.fn === "admin_agent_create_sale");
  assert(call, "expected admin_agent_create_sale rpc");
  assertEquals((call!.args.p_payload as any).total, 2600);
});

Deno.test("generate_report renders a PDF and sends it as a WhatsApp document", async () => {
  const rpc = (fn: string) =>
    fn === "admin_agent_financial_summary"
      ? { income: 5000, expense: 1200, net: 3800, count: 8, topExpenseCategories: [{ category: "Compra", total: 900 }] }
      : balancesRpc(fn);
  const { supabase } = makeSupabase(baseFixtures(), rpc);
  const uploads: string[] = [];
  supabase.storage = {
    from: (_bucket: string) => ({
      upload: (path: string) => { uploads.push(path); return Promise.resolve({ data: { path }, error: null }); },
      createSignedUrl: (_path: string, _exp: number) =>
        Promise.resolve({ data: { signedUrl: "https://storage.example/report.pdf" }, error: null }),
    }),
  };
  const sent: Array<Record<string, unknown>> = [];
  const deps = {
    ...managerDeps(supabase),
    sendDocument: (args: Record<string, unknown>) => { sent.push(args); return Promise.resolve({ ok: true }); },
  };
  const res = await runTool("generate_report", { kind: "financeiro", period: "mes_atual" }, deps) as Record<string, any>;
  assertEquals(res.ok, true);
  assertEquals(res.kind, "financeiro");
  assertEquals(sent.length, 1);
  assertEquals(sent[0].mediaType, "document");
  assert(String(sent[0].mediaFilename).endsWith(".pdf"));
  assert(String(sent[0].mediaUrl).startsWith("https://"));
  assertEquals(uploads.length, 1);
});

Deno.test("generate_report reports an error when document delivery is unavailable", async () => {
  const { supabase } = makeSupabase(baseFixtures(), balancesRpc);
  // No sendDocument injected → the tool cannot deliver the PDF.
  const res = await runTool("generate_report", { kind: "vendas" }, managerDeps(supabase)) as Record<string, any>;
  assertEquals(res.ok, false);
});

Deno.test("receive_debt_payment refuses an amount above the remaining balance", async () => {
  const fixtures = {
    ...baseFixtures(),
    customers: [{ id: "cust1", name: "Felipe Vieira", phone: "8899990000" }],
    debts: [{ id: "debt1", customer_id: "cust1", original_amount: 300, remaining_amount: 300, status: "Aberta", due_date: "2026-06-01" }],
  };
  const { supabase, store } = makeSupabase(fixtures, balancesRpc);
  const res = await runTool(
    "prepare_receive_debt_payment",
    { debtId: "debt1", amount: 5000, paymentMethod: "Pix" },
    managerDeps(supabase),
  ) as Record<string, any>;
  assertEquals(res.ok, false);
  assert(String(res.error).includes("excede"));
  assertEquals(store.data.admin_agent_pending_actions.length, 0);
});
