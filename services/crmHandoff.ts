import { supabase } from "./supabase";
import { getCRMUrl } from "../lib/crmRouting";

type HandoffResponse = {
  success?: boolean;
  redirect_url?: string;
  error?: string;
};

export async function createCrmHandoff(targetPath = "/"): Promise<string> {
  const { data: sessionData } = await supabase.auth.getSession();
  const accessToken = sessionData.session?.access_token;
  const refreshToken = sessionData.session?.refresh_token;

  if (!accessToken || !refreshToken) {
    throw new Error("Sessão inválida para handoff CRM.");
  }

  const { data, error } = await supabase.functions.invoke("crm-auth-handoff", {
    body: {
      action: "create",
      accessToken,
      refreshToken,
      targetPath,
    },
  });

  if (error) {
    throw new Error(error.message || "Falha ao criar handoff CRM.");
  }

  const payload = (data || {}) as HandoffResponse;
  if (!payload.success || !payload.redirect_url) {
    throw new Error(payload.error || "Resposta inválida do handoff CRM.");
  }

  return payload.redirect_url;
}

export function openCRMStandaloneFallback(): void {
  window.location.assign(getCRMUrl("conversations"));
}
