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
  prepareTransfer,
  resolvePeriod,
} from "./operations.ts";
import { runTool } from "./tools.ts";
import { runAdminAgentTurn } from "./runner.ts";
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
