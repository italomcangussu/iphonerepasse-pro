// Resolve a WhatsApp sender to an authorized admin.

import { phonesMatch } from "./phone.ts";

export interface AdminIdentity {
  userId: string;
  phone: string;
  label: string | null;
}

interface SupabaseLike {
  from: (table: string) => any;
}

/**
 * Resolve `senderPhone` against `admin_agent_numbers` (active rows only) and
 * confirm the linked user is still an admin in `user_profiles`.
 * Returns null when the sender is not an authorized admin.
 */
export async function resolveAdminByPhone(
  supabase: SupabaseLike,
  senderPhone: string,
): Promise<AdminIdentity | null> {
  const { data, error } = await supabase
    .from("admin_agent_numbers")
    .select("phone, user_id, label, is_active")
    .eq("is_active", true);
  if (error || !Array.isArray(data)) return null;

  const match = data.find((row: Record<string, unknown>) =>
    phonesMatch(senderPhone, row.phone)
  );
  if (!match) return null;

  const userId = String(match.user_id || "").trim();
  if (!userId) return null;

  const { data: profile } = await supabase
    .from("user_profiles")
    .select("id, role")
    .eq("id", userId)
    .maybeSingle();
  if (!profile || String((profile as Record<string, unknown>).role) !== "admin") {
    return null;
  }

  return {
    userId,
    phone: String(match.phone || senderPhone),
    label: (match.label as string | null) ?? null,
  };
}
