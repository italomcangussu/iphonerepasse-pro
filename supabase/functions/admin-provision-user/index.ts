import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";

type AppRole = "admin" | "seller";

type ProvisionBody = {
  email?: string;
  password?: string;
  role?: AppRole;
  name?: string;
};

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-bootstrap-secret",
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

const parseJwtSub = (authHeader: string | null): string | null => {
  if (!authHeader || !authHeader.startsWith("Bearer ")) return null;

  const token = authHeader.slice(7);
  const parts = token.split(".");
  if (parts.length < 2) return null;

  try {
    const payload = JSON.parse(atob(parts[1].replace(/-/g, "+").replace(/_/g, "/")));
    return typeof payload?.sub === "string" ? payload.sub : null;
  } catch {
    return null;
  }
};

const normalizeEmail = (email: string) => email.trim().toLowerCase();

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return json(405, { error: "Method not allowed" });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

  if (!supabaseUrl || !serviceRoleKey) {
    return json(500, { error: "Missing Supabase function secrets." });
  }

  const adminClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  let body: ProvisionBody;
  try {
    body = (await req.json()) as ProvisionBody;
  } catch {
    return json(400, { error: "Invalid JSON body." });
  }

  const email = body.email ? normalizeEmail(body.email) : "";
  const password = body.password || "";
  const role = body.role;
  const name = (body.name || "").trim();

  if (!email || !password || !role || !name) {
    return json(400, { error: "email, password, role e name são obrigatórios." });
  }

  if (!["admin", "seller"].includes(role)) {
    return json(400, { error: "role inválido." });
  }

  if (password.length < 6) {
    return json(400, { error: "A senha deve ter no mínimo 6 caracteres." });
  }

  const callerId = parseJwtSub(req.headers.get("Authorization"));
  let isCallerAdmin = false;

  if (callerId) {
    const { data: callerProfile } = await adminClient
      .from("user_profiles")
      .select("role")
      .eq("id", callerId)
      .maybeSingle();

    isCallerAdmin = callerProfile?.role === "admin";
  }

  if (!isCallerAdmin) {
    const bootstrapSecret = req.headers.get("x-bootstrap-secret");
    const expectedBootstrapSecret = Deno.env.get("BOOTSTRAP_SECRET");

    const { count: adminCount, error: adminCountError } = await adminClient
      .from("user_profiles")
      .select("id", { count: "exact", head: true })
      .eq("role", "admin");

    if (adminCountError) {
      return json(500, { error: "Falha ao validar bootstrap." });
    }

    const canBootstrap =
      !!expectedBootstrapSecret &&
      !!bootstrapSecret &&
      bootstrapSecret === expectedBootstrapSecret &&
      (adminCount ?? 0) === 0;

    if (!canBootstrap) {
      return json(403, { error: "Apenas administradores podem criar usuários." });
    }
  }

  const { data: createdUserData, error: createUserError } = await adminClient.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { name },
    app_metadata: { role },
  });

  if (createUserError || !createdUserData?.user) {
    const message = createUserError?.message || "Erro ao criar usuário.";
    if (message.toLowerCase().includes("already") || message.toLowerCase().includes("registered")) {
      return json(409, { error: "Email já cadastrado." });
    }
    return json(400, { error: message });
  }

  const user = createdUserData.user;

  try {
    if (role === "admin") {
      const { error: adminProfileError } = await adminClient.from("user_profiles").insert({
        id: user.id,
        role: "admin",
        seller_id: null,
      });

      if (adminProfileError) {
        throw new Error(adminProfileError.message);
      }

      return json(201, {
        user: {
          id: user.id,
          email: user.email,
          role: "admin",
        },
      });
    }

    const sellerId = `sel_${crypto.randomUUID().replace(/-/g, "").slice(0, 12)}`;

    const { error: sellerInsertError } = await adminClient.from("sellers").insert({
      id: sellerId,
      name,
      email,
      auth_user_id: user.id,
      total_sales: 0,
    });

    if (sellerInsertError) {
      throw new Error(sellerInsertError.message);
    }

    const { error: sellerProfileError } = await adminClient.from("user_profiles").insert({
      id: user.id,
      role: "seller",
      seller_id: sellerId,
    });

    if (sellerProfileError) {
      throw new Error(sellerProfileError.message);
    }

    return json(201, {
      user: {
        id: user.id,
        email: user.email,
        role: "seller",
      },
      seller: {
        id: sellerId,
        name,
        email,
        auth_user_id: user.id,
        total_sales: 0,
      },
    });
  } catch (error: any) {
    await adminClient.auth.admin.deleteUser(user.id);
    return json(500, { error: error?.message || "Falha ao provisionar usuário." });
  }
});
