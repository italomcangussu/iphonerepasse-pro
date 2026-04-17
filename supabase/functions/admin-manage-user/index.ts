import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";

type AppRole = "admin" | "manager" | "seller";
type DbRole = "admin" | "seller";
type ManageAction = "update" | "delete";

type ManageBody = {
  action?: ManageAction;
  userId?: string;
  name?: string;
  email?: string;
  role?: AppRole;
  storeId?: string;
};

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

const normalizeOptionalText = (value?: string) => {
  const normalized = (value || "").trim();
  return normalized || null;
};

const normalizeEmail = (email: string) => email.trim().toLowerCase();

const extractBearerToken = (authHeader: string | null): string | null => {
  if (!authHeader || !authHeader.startsWith("Bearer ")) return null;
  const token = authHeader.slice(7).trim();
  return token || null;
};

const resolveCallerId = async (
  adminClient: ReturnType<typeof createClient>,
  authHeader: string | null,
): Promise<string | null> => {
  const token = extractBearerToken(authHeader);
  if (!token) return null;

  const { data, error } = await adminClient.auth.getUser(token);
  if (error) return null;

  return data?.user?.id || null;
};

const isAlreadyRegisteredError = (message: string) => {
  const normalized = message.toLowerCase();
  return normalized.includes("already") || normalized.includes("registered") || normalized.includes("exists");
};

const ensureCallerIsAdmin = async (
  adminClient: ReturnType<typeof createClient>,
  authHeader: string | null,
): Promise<{ callerId: string | null; errorResponse: Response | null }> => {
  const callerId = await resolveCallerId(adminClient, authHeader);
  if (!callerId) {
    return {
      callerId: null,
      errorResponse: json(401, { error: "Sessao invalida. Faca login novamente." }),
    };
  }

  const { data: callerProfile, error: callerProfileError } = await adminClient
    .from("user_profiles")
    .select("role")
    .eq("id", callerId)
    .maybeSingle();

  if (callerProfileError) {
    return {
      callerId: null,
      errorResponse: json(500, { error: callerProfileError.message }),
    };
  }

  if (callerProfile?.role !== "admin") {
    return {
      callerId: null,
      errorResponse: json(403, { error: "Apenas administradores podem gerenciar usuarios." }),
    };
  }

  return { callerId, errorResponse: null };
};

const ensureNotLastAdmin = async (
  adminClient: ReturnType<typeof createClient>,
  userId: string,
): Promise<Response | null> => {
  const { data: targetProfile, error: targetProfileError } = await adminClient
    .from("user_profiles")
    .select("role")
    .eq("id", userId)
    .maybeSingle();

  if (targetProfileError) {
    return json(500, { error: targetProfileError.message });
  }

  if (!targetProfile) {
    return json(404, { error: "Usuario nao encontrado." });
  }

  if (targetProfile.role !== "admin") return null;

  const { count: adminCount, error: adminCountError } = await adminClient
    .from("user_profiles")
    .select("id", { count: "exact", head: true })
    .eq("role", "admin");

  if (adminCountError) {
    return json(500, { error: "Falha ao validar administradores." });
  }

  if ((adminCount ?? 0) <= 1) {
    return json(409, { error: "Nao e possivel remover ou rebaixar o ultimo administrador." });
  }

  return null;
};

const upsertSellerForUser = async (
  adminClient: ReturnType<typeof createClient>,
  args: {
    userId: string;
    profileSellerId: string | null;
    name: string;
    email: string;
    storeId: string | null | undefined;
  },
) => {
  const sellerById =
    args.profileSellerId
      ? await adminClient
          .from("sellers")
          .select("id, name, email, auth_user_id, store_id, total_sales")
          .eq("id", args.profileSellerId)
          .maybeSingle()
      : null;

  if (sellerById?.error) {
    throw new Error(sellerById.error.message);
  }

  const sellerByAuth = await adminClient
    .from("sellers")
    .select("id, name, email, auth_user_id, store_id, total_sales")
    .eq("auth_user_id", args.userId)
    .maybeSingle();

  if (sellerByAuth.error) {
    throw new Error(sellerByAuth.error.message);
  }

  const existingSeller = sellerById?.data || sellerByAuth.data;

  if (existingSeller) {
    const updatePayload: Record<string, unknown> = {
      name: args.name,
      email: args.email,
      auth_user_id: args.userId,
    };

    if (args.storeId !== undefined) {
      updatePayload.store_id = args.storeId;
    }

    const { data: updatedSeller, error: updateSellerError } = await adminClient
      .from("sellers")
      .update(updatePayload)
      .eq("id", existingSeller.id)
      .select("id, name, email, auth_user_id, store_id, total_sales")
      .single();

    if (updateSellerError) throw new Error(updateSellerError.message);
    return updatedSeller;
  }

  const newSellerId = `sel_${crypto.randomUUID().replace(/-/g, "").slice(0, 12)}`;
  const { data: insertedSeller, error: insertSellerError } = await adminClient
    .from("sellers")
    .insert({
      id: newSellerId,
      name: args.name,
      email: args.email,
      auth_user_id: args.userId,
      store_id: args.storeId || null,
      total_sales: 0,
    })
    .select("id, name, email, auth_user_id, store_id, total_sales")
    .single();

  if (insertSellerError) throw new Error(insertSellerError.message);
  return insertedSeller;
};

const handleUpdateUser = async (
  adminClient: ReturnType<typeof createClient>,
  body: ManageBody,
) => {
  const userId = normalizeOptionalText(body.userId);
  if (!userId) return json(400, { error: "userId e obrigatorio para atualizar usuario." });

  const { data: targetProfile, error: targetProfileError } = await adminClient
    .from("user_profiles")
    .select("role, seller_id")
    .eq("id", userId)
    .maybeSingle();

  if (targetProfileError) {
    return json(500, { error: targetProfileError.message });
  }

  if (!targetProfile) {
    return json(404, { error: "Usuario nao encontrado." });
  }

  const { data: currentAccessRole, error: currentAccessRoleError } = await adminClient
    .from("user_access_roles")
    .select("app_role, display_name, email")
    .eq("user_id", userId)
    .maybeSingle();

  if (currentAccessRoleError) {
    return json(500, { error: currentAccessRoleError.message });
  }

  if (!currentAccessRole) {
    return json(404, { error: "Usuario sem configuracao de acesso encontrada." });
  }

  const nextName = (body.name || currentAccessRole.display_name || "").trim();
  const nextEmail = body.email ? normalizeEmail(body.email) : normalizeEmail(currentAccessRole.email || "");
  const nextAppRole = (body.role || currentAccessRole.app_role) as AppRole;
  const nextStoreId = body.storeId !== undefined ? normalizeOptionalText(body.storeId) : undefined;

  if (!nextName) {
    return json(400, { error: "name e obrigatorio." });
  }

  if (!nextEmail) {
    return json(400, { error: "email e obrigatorio." });
  }

  if (!["admin", "manager", "seller"].includes(nextAppRole)) {
    return json(400, { error: "role invalido." });
  }

  if (targetProfile.role === "admin" && nextAppRole !== "admin") {
    const lastAdminError = await ensureNotLastAdmin(adminClient, userId);
    if (lastAdminError) return lastAdminError;
  }

  const { data: currentAuthUserData, error: currentAuthUserError } = await adminClient.auth.admin.getUserById(userId);
  if (currentAuthUserError || !currentAuthUserData?.user) {
    return json(404, { error: currentAuthUserError?.message || "Usuario auth nao encontrado." });
  }

  const nextDbRole: DbRole = nextAppRole === "admin" ? "admin" : "seller";

  const userMetadata = {
    ...(currentAuthUserData.user.user_metadata || {}),
    name: nextName,
    full_name: nextName,
    app_role: nextAppRole,
  };

  const appMetadata = {
    ...(currentAuthUserData.user.app_metadata || {}),
    role: nextDbRole,
    app_role: nextAppRole,
  };

  const updatePayload: Record<string, unknown> = {
    user_metadata: userMetadata,
    app_metadata: appMetadata,
  };

  const currentEmail = (currentAuthUserData.user.email || "").toLowerCase();
  if (currentEmail !== nextEmail) {
    updatePayload.email = nextEmail;
    updatePayload.email_confirm = true;
  }

  const { error: updateAuthError } = await adminClient.auth.admin.updateUserById(userId, updatePayload);
  if (updateAuthError) {
    if (isAlreadyRegisteredError(updateAuthError.message || "")) {
      return json(409, { error: "Email ja cadastrado." });
    }
    return json(400, { error: updateAuthError.message || "Falha ao atualizar usuario auth." });
  }

  let sellerPayload: Record<string, unknown> | null = null;

  if (nextAppRole === "admin") {
    if (targetProfile.seller_id) {
      const { error: detachSellerError } = await adminClient
        .from("sellers")
        .update({ auth_user_id: null, email: null })
        .eq("id", targetProfile.seller_id);

      if (detachSellerError) {
        return json(500, { error: detachSellerError.message });
      }
    }

    const { error: updateProfileError } = await adminClient
      .from("user_profiles")
      .update({
        role: "admin",
        seller_id: null,
      })
      .eq("id", userId);

    if (updateProfileError) {
      return json(500, { error: updateProfileError.message });
    }
  } else {
    try {
      const seller = await upsertSellerForUser(adminClient, {
        userId,
        profileSellerId: targetProfile.seller_id,
        name: nextName,
        email: nextEmail,
        storeId: nextStoreId,
      });

      const { error: updateProfileError } = await adminClient
        .from("user_profiles")
        .update({
          role: "seller",
          seller_id: seller.id,
        })
        .eq("id", userId);

      if (updateProfileError) {
        return json(500, { error: updateProfileError.message });
      }

      sellerPayload = seller;
    } catch (error: any) {
      const message = error?.message || "Falha ao atualizar vendedor vinculado.";
      if (isAlreadyRegisteredError(message)) {
        return json(409, { error: "Email ja cadastrado." });
      }
      return json(500, { error: message });
    }
  }

  const { error: updateAccessError } = await adminClient
    .from("user_access_roles")
    .update({
      app_role: nextAppRole,
      display_name: nextName,
      email: nextEmail,
    })
    .eq("user_id", userId);

  if (updateAccessError) {
    return json(500, { error: updateAccessError.message });
  }

  return json(200, {
    user: {
      id: userId,
      email: nextEmail,
      role: nextAppRole,
      name: nextName,
    },
    seller: sellerPayload,
  });
};

const handleDeleteUser = async (
  adminClient: ReturnType<typeof createClient>,
  callerId: string,
  body: ManageBody,
) => {
  const userId = normalizeOptionalText(body.userId);
  if (!userId) return json(400, { error: "userId e obrigatorio para remover usuario." });

  if (userId === callerId) {
    return json(400, { error: "Nao e permitido remover o proprio usuario." });
  }

  const lastAdminError = await ensureNotLastAdmin(adminClient, userId);
  if (lastAdminError) return lastAdminError;

  const { data: targetProfile, error: targetProfileError } = await adminClient
    .from("user_profiles")
    .select("seller_id")
    .eq("id", userId)
    .maybeSingle();

  if (targetProfileError) {
    return json(500, { error: targetProfileError.message });
  }

  if (!targetProfile) {
    return json(404, { error: "Usuario nao encontrado." });
  }

  let sellerIdToRemove = targetProfile.seller_id || null;

  if (!sellerIdToRemove) {
    const { data: sellerByAuth, error: sellerByAuthError } = await adminClient
      .from("sellers")
      .select("id")
      .eq("auth_user_id", userId)
      .maybeSingle();

    if (sellerByAuthError) {
      return json(500, { error: sellerByAuthError.message });
    }

    sellerIdToRemove = sellerByAuth?.id || null;
  }

  if (sellerIdToRemove) {
    const { error: removeSellerError } = await adminClient
      .from("sellers")
      .delete()
      .eq("id", sellerIdToRemove);

    if (removeSellerError) {
      return json(500, { error: `Falha ao remover vendedor vinculado: ${removeSellerError.message}` });
    }
  }

  const { error: removeUserError } = await adminClient.auth.admin.deleteUser(userId);
  if (removeUserError) {
    return json(500, { error: removeUserError.message || "Falha ao remover usuario auth." });
  }

  return json(200, {
    success: true,
    removedUserId: userId,
    removedSellerId: sellerIdToRemove,
  });
};

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

  let body: ManageBody;
  try {
    body = (await req.json()) as ManageBody;
  } catch {
    return json(400, { error: "Invalid JSON body." });
  }

  const action = body.action;
  if (action !== "update" && action !== "delete") {
    return json(400, { error: "action invalida. Use 'update' ou 'delete'." });
  }

  const { callerId, errorResponse } = await ensureCallerIsAdmin(adminClient, req.headers.get("Authorization"));
  if (errorResponse || !callerId) return errorResponse!;

  try {
    if (action === "update") {
      return await handleUpdateUser(adminClient, body);
    }

    return await handleDeleteUser(adminClient, callerId, body);
  } catch (error: any) {
    return json(500, { error: error?.message || "Falha ao gerenciar usuario." });
  }
});
