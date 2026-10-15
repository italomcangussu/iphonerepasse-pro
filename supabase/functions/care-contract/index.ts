/// <reference lib="deno.ns" />
// Repasse Care+ (painel/PDV, usuário autenticado):
//   issue        → gera o PDF imutável (ou reaproveita o vigente), abre sessão de assinatura e envia o link pelo CRM
//   document_url → URL assinada curta para contrato original, PDF assinado ou dossiê (registra exportação)
//   verify       → recalcula SHA-256 dos arquivos armazenados e compara com o registrado
//   finalize     → (re)gera PDF assinado + dossiê quando a etapa pós-assinatura falhou
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";
import {
  corsHeaders,
  createServiceClient,
  jsonResponse,
  parseJsonBody,
  requireAuthenticatedRole,
} from "../_shared/crm.ts";
import { renderContractPdf } from "../_shared/care/contract_pdf.ts";
import { CARE_ACCEPTANCE_TEXT_VERSION } from "../_shared/care/contract_text.ts";
import {
  appendEvent,
  buildContractTextData,
  CARE_BUCKET,
  type ContractRow,
  downloadBytes,
  finalizeSignedArtifacts,
  loadContract,
  loadLatestDocument,
  loadSettings,
  uploadImmutable,
} from "../_shared/care/repository.ts";
import { generateAccessToken, maskPhone, sha256Hex } from "../_shared/care/security.ts";

type Auth = { userId: string; role: "admin" | "seller" };
type Body = { action?: string; contractId?: string; appOrigin?: string; kind?: string };
type Ctx = { req: Request; supabase: SupabaseClient; auth: Auth; body: Body };

class HttpError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

const ISSUABLE = ["rascunho", "aguardando_assinatura"];

function resolveAppBaseUrl(appOrigin: unknown): string {
  const origin = typeof appOrigin === "string" ? appOrigin.trim().replace(/\/$/, "") : "";
  const isTrusted = /^https:\/\/[a-z0-9.-]+$/i.test(origin) || /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/i.test(origin);
  if (isTrusted) return origin;
  return (Deno.env.get("APP_PUBLIC_URL") || "https://app.iphonerepasse.com.br").replace(/\/$/, "");
}

async function ensureIssuedDocument(supabase: SupabaseClient, contract: ContractRow, auth: Auth) {
  const current = await loadLatestDocument(supabase, contract.id, ["emitido"]);
  if (current) return current;

  const { data: last } = await supabase
    .from("care_contract_documents")
    .select("version")
    .eq("contract_id", contract.id)
    .order("version", { ascending: false })
    .limit(1)
    .maybeSingle();
  const version = Number(last?.version ?? 0) + 1;
  const issuedAt = new Date();
  const pdf = await renderContractPdf(await buildContractTextData(supabase, { contract, documentVersion: version, issuedAt }));
  const sha256 = await sha256Hex(pdf);
  const path = `${contract.id}/v${version}-${sha256.slice(0, 12)}.pdf`;
  await uploadImmutable(supabase, { path, bytes: pdf, contentType: "application/pdf" });

  const { error } = await supabase.rpc("care_register_document", {
    p_contract_id: contract.id,
    p_storage_path: path,
    p_sha256: sha256,
    p_size_bytes: pdf.byteLength,
    p_acceptance_text_version: CARE_ACCEPTANCE_TEXT_VERSION,
    p_actor: auth.userId,
  });
  if (error) throw new HttpError(422, error.message);
  return await loadLatestDocument(supabase, contract.id, ["emitido"]);
}

async function invokeCrmSend(req: Request, body: Record<string, unknown>): Promise<Record<string, unknown>> {
  const response = await fetch(`${Deno.env.get("SUPABASE_URL")}/functions/v1/crm-send-message`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: req.headers.get("Authorization") || "",
      apikey: Deno.env.get("SUPABASE_ANON_KEY") || "",
    },
    body: JSON.stringify(body),
  });
  const payload = await response.json().catch(() => ({})) as Record<string, unknown>;
  if (!response.ok || payload.error) throw new Error(String(payload.error || `crm-send-message falhou (${response.status}).`));
  return payload;
}

async function pickStoreChannel(supabase: SupabaseClient, storeId: string | null) {
  const { data } = await supabase
    .from("crm_channels")
    .select("id, store_id")
    .eq("provider", "uazapi")
    .eq("is_active", true)
    .eq("is_admin_console", false)
    .order("created_at", { ascending: true });
  const list = (data ?? []) as Array<{ id: string; store_id: string | null }>;
  const channel = list.find((c) => c.store_id === storeId) ?? list[0];
  if (!channel) throw new Error("Nenhum canal WhatsApp ativo configurado.");
  return channel;
}

interface LinkMessage {
  contract: ContractRow;
  link: string;
  linkTtlHours: number;
}

const linkMessage = ({ contract, link, linkTtlHours }: LinkMessage): string =>
  [
    `Olá, ${contract.customer_name.split(/\s+/)[0]}! Aqui é a iPhone Repasse.`,
    `Seu contrato *Repasse Care+ nº ${contract.contract_number}* (assistência técnica continuada do seu ${contract.device_model}) está pronto para assinatura eletrônica.`,
    `Confira e assine pelo link seguro: ${link}`,
    `Na página, você lê o contrato completo, confirma o aceite e recebe aqui um código de 6 dígitos. Digitar o código é a sua assinatura. O link vale por ${linkTtlHours} h.`,
  ].join("\n\n");

async function sendLinkThroughCrm({ req, supabase }: Ctx, message: LinkMessage) {
  const { contract } = message;
  const channel = await pickStoreChannel(supabase, contract.store_id);
  const { data: leadId, error: leadError } = await supabase.rpc("upsert_crm_lead", {
    p_store_id: channel.store_id ?? contract.store_id,
    p_phone: contract.customer_phone,
    p_name: contract.customer_name,
    p_channel_id: channel.id,
    p_first_message: "Contrato Repasse Care+ enviado para assinatura.",
    p_intent: "care_contract",
  });
  if (leadError || !leadId) throw new Error(leadError?.message || "Não foi possível preparar o contato no CRM.");

  const result = await invokeCrmSend(req, { leadId, channelId: channel.id, content: linkMessage(message) });
  if (typeof result.conversationId === "string") {
    // Envio feito pelo vendedor: o atendimento continua humano (não acorda a IA).
    await supabase.from("crm_conversations").update({ status: "human_handling", ai_enabled: false }).eq("id", result.conversationId);
  }
  return typeof result.providerMessageId === "string" ? result.providerMessageId : null;
}

async function trySendLink(ctx: Ctx, message: LinkMessage): Promise<{ providerMessageId: string | null; sendError: string | null }> {
  try {
    return { providerMessageId: await sendLinkThroughCrm(ctx, message), sendError: null };
  } catch (e) {
    return { providerMessageId: null, sendError: e instanceof Error ? e.message : "Falha no envio pelo CRM." };
  }
}

async function issue(ctx: Ctx) {
  const { supabase, auth, body } = ctx;
  const contract = await requireContract(supabase, body.contractId);
  if (!ISSUABLE.includes(contract.status)) throw new HttpError(422, "Este contrato não está mais aguardando assinatura.");

  const document = await ensureIssuedDocument(supabase, contract, auth);
  if (!document) throw new HttpError(500, "Documento não pôde ser emitido.");
  const linkTtlHours = Number((await loadSettings(supabase)).signature_link_ttl_hours ?? 72);
  const token = generateAccessToken();
  const { data: sessionId, error } = await supabase.rpc("care_open_signature_session", {
    p_contract_id: contract.id,
    p_access_token_hash: await sha256Hex(token),
    p_link_expires_at: new Date(Date.now() + linkTtlHours * 3600_000).toISOString(),
    p_actor: auth.userId,
  });
  if (error) throw new HttpError(422, error.message);

  const link = `${resolveAppBaseUrl(body.appOrigin)}/#/care/assinar/${token}`;
  const { providerMessageId, sendError } = await trySendLink(ctx, { contract, link, linkTtlHours });
  await appendEvent(supabase, {
    contract_id: contract.id,
    session_id: sessionId,
    document_id: document.id,
    event_type: sendError ? "link_envio_falhou" : "link_enviado",
    source: "painel",
    actor_user_id: auth.userId,
    whatsapp_message_id: providerMessageId,
    event_data: { canal: "crm_whatsapp", telefone: maskPhone(contract.customer_phone), erro: sendError },
  });
  return { link, sessionId, documentVersion: document.version, documentSha256: document.sha256, sent: !sendError, sendError };
}

const DOCUMENT_KINDS: Record<string, { column: string; adminOnly: boolean; filename: string }> = {
  original: { column: "storage_path", adminOnly: false, filename: "contrato" },
  signed: { column: "signed_pdf_path", adminOnly: false, filename: "contrato-assinado" },
  evidence: { column: "evidence_path", adminOnly: true, filename: "dossie-assinatura" },
};

async function documentUrl({ supabase, auth, body }: Ctx) {
  const kind = DOCUMENT_KINDS[String(body.kind)];
  if (!kind) throw new HttpError(400, "Tipo de documento inválido.");
  if (kind.adminOnly && auth.role !== "admin") throw new HttpError(403, "O dossiê de assinatura é restrito a administradores.");
  const contract = await requireContract(supabase, body.contractId);
  const document = await loadLatestDocument(supabase, contract.id, ["assinado", "emitido"]);
  const path = document?.[kind.column] as string | undefined;
  if (!document || !path) throw new HttpError(404, "Documento ainda não disponível para este contrato.");

  const { data, error } = await supabase.storage.from(CARE_BUCKET).createSignedUrl(path, 600, {
    download: `${kind.filename}-${contract.contract_number}.${path.endsWith(".json") ? "json" : "pdf"}`,
  });
  if (error || !data?.signedUrl) throw new HttpError(500, "Não foi possível gerar o link do documento.");
  await appendEvent(supabase, {
    contract_id: contract.id,
    document_id: document.id,
    event_type: "documento_exportado",
    source: "painel",
    actor_user_id: auth.userId,
    event_data: { tipo: body.kind },
  });
  return { url: data.signedUrl, expiresInSeconds: 600 };
}

async function verifyFile(supabase: SupabaseClient, path: string | null, expected: string | null) {
  if (!path || !expected) return null;
  const actual = await sha256Hex(await downloadBytes(supabase, path));
  return { expected, actual, ok: actual === expected };
}

async function verify({ supabase, auth, body }: Ctx) {
  if (auth.role !== "admin") throw new HttpError(403, "Verificação de integridade restrita a administradores.");
  const contract = await requireContract(supabase, body.contractId);
  const document = await loadLatestDocument(supabase, contract.id, ["assinado", "emitido"]);
  if (!document) throw new HttpError(404, "Contrato sem documento emitido.");

  const result = {
    documentVersion: document.version,
    original: await verifyFile(supabase, document.storage_path, document.sha256),
    signed: await verifyFile(supabase, document.signed_pdf_path, document.signed_pdf_sha256),
    evidence: await verifyFile(supabase, document.evidence_path, document.evidence_sha256),
  };
  const ok = [result.original, result.signed, result.evidence].every((r) => r === null || r.ok);
  await appendEvent(supabase, {
    contract_id: contract.id,
    document_id: document.id,
    event_type: "integridade_verificada",
    source: "painel",
    actor_user_id: auth.userId,
    event_data: { resultado: ok ? "integro" : "divergente" },
  });
  return { ok, ...result };
}

async function requireContract(supabase: SupabaseClient, contractId: unknown): Promise<ContractRow> {
  const id = typeof contractId === "string" ? contractId.trim() : "";
  if (!/^[0-9a-f-]{36}$/i.test(id)) throw new HttpError(400, "contractId inválido.");
  const contract = await loadContract(supabase, id);
  if (!contract) throw new HttpError(404, "Contrato não encontrado.");
  return contract;
}

async function finalize({ supabase, auth, body }: Ctx) {
  if (auth.role !== "admin") throw new HttpError(403, "Restrito a administradores.");
  const contract = await requireContract(supabase, body.contractId);
  return { ...(await finalizeSignedArtifacts(supabase, contract.id)) };
}

const ACTIONS: Record<string, (ctx: Ctx) => Promise<Record<string, unknown>>> = {
  issue,
  document_url: documentUrl,
  verify,
  finalize,
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return jsonResponse({ error: "Método não permitido." }, 405);

  const supabase = createServiceClient();
  let auth: Auth;
  try {
    auth = await requireAuthenticatedRole(req, supabase);
  } catch {
    return jsonResponse({ error: "Não autorizado." }, 401);
  }

  const body = await parseJsonBody<Body>(req);
  const handler = ACTIONS[String(body?.action)];
  if (!body || !handler) return jsonResponse({ error: "Ação desconhecida." }, 400);
  try {
    return jsonResponse(await handler({ req, supabase, auth, body }));
  } catch (error) {
    const status = error instanceof HttpError ? error.status : 500;
    return jsonResponse({ error: error instanceof Error ? error.message : "Erro inesperado." }, status);
  }
});
