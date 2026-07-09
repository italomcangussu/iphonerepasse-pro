// Two-step confirmation store for money/stock mutations.
//
// A "prepare" tool never mutates; it records a single-use, expiring pending
// action and returns a human summary. Money/stock only moves when a later
// inbound turn resolves that pending action (see runner.ts).

export type PendingActionType =
  | "transfer"
  | "reserve_stock"
  | "register_transaction"
  | "receive_debt_payment"
  | "pay_payable_debt"
  | "release_reservation"
  | "create_stock_item"
  | "update_stock_item"
  | "delete_stock_item"
  | "create_customer"
  | "update_customer"
  | "create_creditor"
  | "update_transaction"
  | "delete_transaction"
  | "create_sale"
  | "upsert_finance_category"
  | "upsert_device_catalog";

export interface PendingAction {
  id: string;
  phone: string;
  user_id: string;
  channel_id: string | null;
  conversation_id: string | null;
  action: PendingActionType;
  params: Record<string, unknown>;
  summary: string;
  status: "pending" | "confirmed" | "cancelled" | "expired";
  expires_at: string;
  created_at: string;
  resolved_at: string | null;
}

interface SupabaseLike {
  from: (table: string) => any;
}

const TABLE = "admin_agent_pending_actions";

/** How long a pending confirmation stays valid. */
export const PENDING_TTL_MS = 5 * 60 * 1000;

/**
 * Cancel any still-open pending action for this phone, then insert a fresh one.
 * A phone can only ever have a single live pending action.
 */
export async function createPendingAction(
  supabase: SupabaseLike,
  input: {
    phone: string;
    userId: string;
    channelId: string | null;
    conversationId: string | null;
    action: PendingActionType;
    params: Record<string, unknown>;
    summary: string;
    now?: number;
  },
): Promise<PendingAction | null> {
  const now = input.now ?? Date.now();
  await cancelOpenPendingActions(supabase, input.phone, now);

  const { data, error } = await supabase
    .from(TABLE)
    .insert({
      phone: input.phone,
      user_id: input.userId,
      channel_id: input.channelId,
      conversation_id: input.conversationId,
      action: input.action,
      params: input.params,
      summary: input.summary,
      status: "pending",
      expires_at: new Date(now + PENDING_TTL_MS).toISOString(),
    })
    .select("*")
    .single();
  if (error) return null;
  return data as PendingAction;
}

/** Return the live (pending, unexpired) action for a phone, expiring stale ones. */
export async function findOpenPendingAction(
  supabase: SupabaseLike,
  phone: string,
  now: number = Date.now(),
): Promise<PendingAction | null> {
  const { data, error } = await supabase
    .from(TABLE)
    .select("*")
    .eq("phone", phone)
    .eq("status", "pending")
    .order("created_at", { ascending: false })
    .limit(1);
  if (error || !Array.isArray(data) || data.length === 0) return null;
  const row = data[0] as PendingAction;
  if (new Date(row.expires_at).getTime() <= now) {
    await supabase
      .from(TABLE)
      .update({ status: "expired", resolved_at: new Date(now).toISOString() })
      .eq("id", row.id);
    return null;
  }
  return row;
}

/** Mark a pending action resolved (confirmed/cancelled). */
export async function resolvePendingAction(
  supabase: SupabaseLike,
  id: string,
  status: "confirmed" | "cancelled",
  now: number = Date.now(),
): Promise<void> {
  await supabase
    .from(TABLE)
    .update({ status, resolved_at: new Date(now).toISOString() })
    .eq("id", id)
    .eq("status", "pending");
}

async function cancelOpenPendingActions(
  supabase: SupabaseLike,
  phone: string,
  now: number,
): Promise<void> {
  await supabase
    .from(TABLE)
    .update({ status: "cancelled", resolved_at: new Date(now).toISOString() })
    .eq("phone", phone)
    .eq("status", "pending");
}
