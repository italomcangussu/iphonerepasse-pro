import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const json = (status: number, payload: Record<string, unknown>) =>
  new Response(JSON.stringify(payload), {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json",
    },
  });

const textEncoder = new TextEncoder();

const toBase64Url = (bytes: Uint8Array) =>
  btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");

const hmacSha256 = async (message: string, secret: string) => {
  const key = await crypto.subtle.importKey(
    "raw",
    textEncoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign("HMAC", key, textEncoder.encode(message));
  return toBase64Url(new Uint8Array(signature));
};

const sha256Hex = async (value: string) => {
  const digest = await crypto.subtle.digest("SHA-256", textEncoder.encode(value));
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
};

const timingSafeEqual = (a: string, b: string) => {
  if (a.length !== b.length) return false;
  let result = 0;
  for (let i = 0; i < a.length; i += 1) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return result === 0;
};

const onlyDigits = (value: string | null | undefined) => (value || "").replace(/\D/g, "");

const maskImei = (imei?: string | null) => {
  if (!imei) return "-";
  const digits = imei.replace(/\D/g, "");
  if (digits.length <= 4) return `****${digits}`;
  const hidden = "*".repeat(digits.length - 4);
  return `${hidden}${digits.slice(-4)}`;
};

const maskCpf = (cpfDigits: string) => {
  if (cpfDigits.length !== 11) return "***.***.***-**";
  return `***.***.***-${cpfDigits.slice(-2)}`;
};

const mapSaleToWarranty = (sale: any, storeName: string) => {
  const warrantyEnd = sale.warranty_expires_at ? new Date(sale.warranty_expires_at) : null;
  const isExpired = warrantyEnd ? Date.now() > warrantyEnd.getTime() : false;

  const items = (sale.sale_items || [])
    .map((si: any) => si.stock_item)
    .filter(Boolean)
    .map((item: any) => ({
      model: item.model || "Aparelho",
      capacity: item.capacity || "",
      color: item.color || "",
      condition: item.condition || "",
      imeiMasked: maskImei(item.imei),
    }));

  return {
    certificateId: `#${sale.id.slice(-6).toUpperCase()}`,
    saleDate: sale.date,
    warrantyExpiresAt: sale.warranty_expires_at,
    status: isExpired ? "expired" : "active",
    customerName: sale.customer?.name || "Cliente",
    storeName,
    items,
  };
};

const resolveStoreName = async (adminClient: ReturnType<typeof createClient>) => {
  const { data: businessProfile } = await adminClient
    .from("business_profile")
    .select("name")
    .limit(1)
    .maybeSingle();
  return businessProfile?.name || "iPhoneRepasse";
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json(405, { error: "Method not allowed" });

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !serviceRoleKey) {
    return json(500, { error: "Missing function secrets." });
  }

  const adminClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  let body: { token?: string; cpf?: string };
  try {
    body = (await req.json()) as { token?: string; cpf?: string };
  } catch {
    return json(400, { error: "Invalid JSON body." });
  }

  const cpfDigits = onlyDigits(body.cpf);
  if (cpfDigits) {
    if (cpfDigits.length !== 11) {
      return json(400, { error: "CPF inválido." });
    }

    const { data: customers, error: customerLookupError } = await adminClient.rpc(
      "customer_ids_by_normalized_cpf",
      { input_cpf: cpfDigits },
    );
    if (customerLookupError) return json(500, { error: customerLookupError.message });

    const customerRows = (customers || []) as Array<{ id: string; name: string; cpf: string | null }>;
    const customerIds = customerRows.map((row) => row.id);
    const customerName = customerRows[0]?.name || "Cliente";
    const storeName = await resolveStoreName(adminClient);

    if (customerIds.length === 0) {
      return json(200, {
        lookup: {
          mode: "cpf",
          customerName,
          cpfMasked: maskCpf(cpfDigits),
          warranties: [],
        },
      });
    }

    const { data: sales, error: salesError } = await adminClient
      .from("sales")
      .select(
        "id, date, warranty_expires_at, customer:customers(name, cpf), sale_items(*, stock_item:stock_items(model, capacity, color, imei, condition))",
      )
      .in("customer_id", customerIds)
      .order("date", { ascending: false });

    if (salesError) return json(500, { error: salesError.message });

    const warranties = (sales || []).map((sale) => mapSaleToWarranty(sale, storeName));

    return json(200, {
      lookup: {
        mode: "cpf",
        customerName,
        cpfMasked: maskCpf(cpfDigits),
        warranties,
      },
    });
  }

  const token = (body.token || "").trim();
  if (!token) return json(400, { error: "token ou cpf é obrigatório." });

  const tokenSecret = Deno.env.get("WARRANTY_TOKEN_SECRET");
  if (!tokenSecret) return json(500, { error: "Missing function secrets." });

  const [tokenId, expRaw, signature] = token.split(".");
  if (!tokenId || !expRaw || !signature) {
    return json(400, { error: "Token inválido." });
  }

  const exp = Number(expRaw);
  if (!Number.isFinite(exp) || exp <= 0) {
    return json(400, { error: "Token inválido." });
  }

  const payload = `${tokenId}.${expRaw}`;
  const expectedSig = await hmacSha256(payload, tokenSecret);
  if (!timingSafeEqual(signature, expectedSig)) {
    return json(401, { error: "Token inválido." });
  }

  if (Date.now() >= exp * 1000) {
    return json(410, { error: "Token expirado." });
  }

  const tokenHash = await sha256Hex(token);
  const { data: tokenRow, error: tokenError } = await adminClient
    .from("warranty_public_tokens")
    .select("id, sale_id, expires_at, revoked_at")
    .eq("token_hash", tokenHash)
    .maybeSingle();

  if (tokenError) return json(500, { error: tokenError.message });
  if (!tokenRow) return json(404, { error: "Token não encontrado." });
  if (tokenRow.id !== tokenId) return json(401, { error: "Token inválido." });
  if (tokenRow.revoked_at) return json(403, { error: "Token revogado." });
  if (Math.floor(new Date(tokenRow.expires_at).getTime() / 1000) !== exp) {
    return json(401, { error: "Token inválido." });
  }
  if (new Date(tokenRow.expires_at).getTime() <= Date.now()) {
    return json(410, { error: "Token expirado." });
  }

  const { data: sale, error: saleError } = await adminClient
    .from("sales")
    .select(
      "id, date, warranty_expires_at, customer:customers(name, cpf), sale_items(*, stock_item:stock_items(model, capacity, color, imei, condition))",
    )
    .eq("id", tokenRow.sale_id)
    .maybeSingle();

  if (saleError) return json(500, { error: saleError.message });
  if (!sale) return json(404, { error: "Garantia não encontrada." });

  const storeName = await resolveStoreName(adminClient);
  const warranty = mapSaleToWarranty(sale, storeName);

  await adminClient
    .from("warranty_public_tokens")
    .update({ last_accessed_at: new Date().toISOString() })
    .eq("id", tokenRow.id);

  return json(200, { warranty });
});
