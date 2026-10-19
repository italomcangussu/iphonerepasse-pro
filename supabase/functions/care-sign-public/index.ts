/// <reference lib="deno.ns" />
// Página pública de assinatura do Repasse Care+ (sem login; o token do link é a credencial).
// Fluxo: open → viewed (documento integral) → accept (aceite expresso) → send_otp → verify_otp.
// Toda etapa vira evento na trilha append-only, com hora do servidor, IP e user-agent reais.
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";
import { corsHeaders, createServiceClient, jsonResponse, parseJsonBody } from "../_shared/crm.ts";
import { acceptanceText, contractTermMonths } from "../_shared/care/contract_text.ts";
import {
  appendEvent,
  buildContractTextData,
  CARE_BUCKET,
  finalizeSignedArtifacts,
  loadContract,
  loadSettings,
} from "../_shared/care/repository.ts";
import {
  generateOtp,
  geoEventColumns,
  isSixDigitCode,
  isWellFormedAccessToken,
  maskPhone,
  normalizeGeo,
  otpVerifier,
  resolveClientIp,
  sanitizeUserAgent,
  sha256Hex,
  timingSafeEqualHex,
} from "../_shared/care/security.ts";
import { resolveWhatsAppChannel, sendDirectWhatsApp } from "../_shared/care/whatsapp.ts";

type Body = { token?: string; action?: string; code?: string; accepted?: boolean; geo?: unknown };
type Session = Record<string, any> & { id: string; contract_id: string; document_id: string; status: string };
type Ctx = { supabase: SupabaseClient; session: Session; document: Record<string, any>; ip: string | null; ua: string | null };

class HttpError extends Error {
  constructor(public status: number, message: string, public code?: string) {
    super(message);
  }
}

const otpSecret = (): string => {
  const secret = Deno.env.get("CARE_OTP_SECRET") || Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!secret) throw new HttpError(500, "Assinatura indisponível no momento.");
  return secret;
};

const maskCpf = (cpf: string | null): string | null => {
  const digits = (cpf ?? "").replace(/\D/g, "");
  return digits.length >= 11 ? `***.${digits.slice(3, 6)}.***-${digits.slice(-2)}` : null;
};

const maskImei = (imei: string | null): string | null =>
  imei && imei.length > 4 ? `${"•".repeat(Math.min(imei.length - 4, 8))}${imei.slice(-4)}` : imei;

async function resolveSession(supabase: SupabaseClient, token: unknown): Promise<Session> {
  const raw = typeof token === "string" ? token.trim() : "";
  if (!isWellFormedAccessToken(raw)) throw new HttpError(404, "Link de assinatura inválido.", "invalido");
  const { data, error } = await supabase
    .from("care_signature_sessions")
    .select("*")
    .eq("access_token_hash", await sha256Hex(raw))
    .maybeSingle();
  if (error) throw new HttpError(500, "Não foi possível abrir o contrato agora.");
  if (!data) throw new HttpError(404, "Link de assinatura inválido.", "invalido");
  return data as Session;
}

function assertUsable(ctx: Ctx): void {
  const s = ctx.session;
  if (s.status === "revogada") throw new HttpError(410, "Este link foi substituído por um mais recente. Use o último link enviado pela loja.", "revogado");
  if (s.status === "bloqueada") throw new HttpError(423, "Assinatura bloqueada por excesso de tentativas. Peça um novo link à loja.", "bloqueado");
  if (s.status === "expirada") throw new HttpError(410, "Este link expirou. Peça um novo link à loja.", "expirado");
}

async function expireIfNeeded(ctx: Ctx): Promise<void> {
  const s = ctx.session;
  if (s.status === "assinada" || new Date(s.link_expires_at).getTime() > Date.now()) return;
  if (s.status === "aberta" || s.status === "aceita") {
    await ctx.supabase.from("care_signature_sessions").update({ status: "expirada", otp_verifier: null }).eq("id", s.id);
    await event(ctx, { type: "sessao_expirada", source: "sistema" });
    s.status = "expirada";
  }
}

interface SessionEvent {
  type: string;
  source: "assinante" | "sistema";
  data?: Record<string, unknown>;
  columns?: Record<string, unknown>;
}

const event = (ctx: Ctx, e: SessionEvent) =>
  appendEvent(ctx.supabase, {
    contract_id: ctx.session.contract_id,
    session_id: ctx.session.id,
    document_id: ctx.session.document_id,
    event_type: e.type,
    source: e.source,
    source_ip: ctx.ip,
    user_agent: ctx.ua,
    event_data: e.data ?? {},
    ...e.columns,
  });

async function hasViewed(ctx: Ctx): Promise<boolean> {
  const { count } = await ctx.supabase
    .from("care_signature_events")
    .select("id", { count: "exact", head: true })
    .eq("session_id", ctx.session.id)
    .eq("event_type", "documento_visualizado");
  return (count ?? 0) > 0;
}

async function open(ctx: Ctx) {
  assertUsable(ctx);
  const contract = await loadContract(ctx.supabase, ctx.session.contract_id);
  if (!contract) throw new HttpError(404, "Contrato não encontrado.");
  const settings = await loadSettings(ctx.supabase);
  const text = await buildContractTextData(ctx.supabase, { contract, documentVersion: ctx.document.version, issuedAt: new Date(ctx.document.issued_at) });
  const { data: docUrl } = await ctx.supabase.storage.from(CARE_BUCKET).createSignedUrl(ctx.document.storage_path, 1800);
  const signedPath = ctx.session.status === "assinada" ? ctx.document.signed_pdf_path : null;
  const { data: signedUrl } = signedPath
    ? await ctx.supabase.storage.from(CARE_BUCKET).createSignedUrl(signedPath, 1800)
    : { data: null };

  await event(ctx, { type: "link_aberto", source: "assinante" });
  const cooldown = Number(settings.otp_resend_cooldown_seconds ?? 60);
  const lastSent = ctx.session.otp_last_sent_at ? new Date(ctx.session.otp_last_sent_at).getTime() : 0;

  return {
    session: {
      status: ctx.session.status,
      viewed: await hasViewed(ctx),
      linkExpiresAt: ctx.session.link_expires_at,
      signedAt: ctx.session.signed_at,
      otpPending: Boolean(ctx.session.otp_verifier),
      resendAvailableAt: lastSent ? new Date(lastSent + cooldown * 1000).toISOString() : null,
    },
    otp: { length: 6, ttlMinutes: Number(settings.otp_ttl_minutes ?? 5), phoneMasked: maskPhone(contract.customer_phone) },
    acceptance: {
      version: ctx.document.acceptance_text_version,
      text: acceptanceText(Number(contract.contract_number), ctx.document.version, contract.clauses_version),
    },
    document: { version: ctx.document.version, sha256: ctx.document.sha256, url: docUrl?.signedUrl ?? null, signedUrl: signedUrl?.signedUrl ?? null },
    contract: {
      number: contract.contract_number,
      status: contract.status,
      contractor: text.contractor.legalName,
      customer: { name: contract.customer_name, cpfMasked: maskCpf(contract.customer_cpf), phoneMasked: maskPhone(contract.customer_phone) },
      device: { model: contract.device_model, capacity: contract.device_capacity, color: contract.device_color, imeiMasked: maskImei(contract.device_imei), condition: contract.condition },
      values: { ...text.values, termMonths: contractTermMonths(text.values) },
      bonuses: text.bonuses,
      servicesDescription: text.servicesDescription,
      usageLimits: text.usageLimits,
      preventiveCheckupMonths: text.preventiveCheckupMonths,
      suspensionGraceDays: text.suspensionGraceDays,
    },
  };
}

async function viewed(ctx: Ctx) {
  assertUsable(ctx);
  if (!(await hasViewed(ctx))) await event(ctx, { type: "documento_visualizado", source: "assinante", data: { documento_sha256: ctx.document.sha256 } });
  return { viewed: true };
}

async function accept(ctx: Ctx, body: Body) {
  assertUsable(ctx);
  if (ctx.session.status === "aceita" || ctx.session.status === "assinada") return { accepted: true };
  if (body.accepted !== true) throw new HttpError(422, "Marque a confirmação de leitura e concordância para continuar.");
  if (!(await hasViewed(ctx))) throw new HttpError(422, "Abra o contrato completo antes de aceitar.", "nao_visualizado");

  const contract = await loadContract(ctx.supabase, ctx.session.contract_id);
  const geo = normalizeGeo(body.geo);
  const { data, error } = await ctx.supabase
    .from("care_signature_sessions")
    .update({ status: "aceita", accepted_at: new Date().toISOString(), acceptance_text_version: ctx.document.acceptance_text_version })
    .eq("id", ctx.session.id)
    .eq("status", "aberta")
    .select("id");
  if (error) throw new HttpError(500, "Não foi possível registrar o aceite.");
  if (!data || data.length === 0) return { accepted: true };

  await event(ctx, {
    type: "aceite_registrado",
    source: "assinante",
    data: {
      versao_aceite: ctx.document.acceptance_text_version,
      texto_aceite: acceptanceText(Number(contract?.contract_number), ctx.document.version, String(contract?.clauses_version)),
      documento_sha256: ctx.document.sha256,
      marcacao_explicita: true,
    },
    columns: geoEventColumns(geo),
  });
  return { accepted: true };
}

const otpMessage = (contractNumber: number, code: string, ttlMinutes: number): string =>
  [
    `Repasse Care+ — iPhone Repasse`,
    `Seu código para ASSINAR o contrato nº ${contractNumber} é: *${code}*`,
    `Válido por ${ttlMinutes} minutos. Digite-o na página do contrato.`,
    `Não compartilhe este código: ao informá-lo, você assina o contrato eletronicamente.`,
  ].join("\n\n");

interface OtpPolicy {
  ttlMinutes: number;
  cooldownSeconds: number;
  maxSends: number;
}

const otpPolicy = (settings: Record<string, any>): OtpPolicy => ({
  ttlMinutes: Number(settings.otp_ttl_minutes ?? 5),
  cooldownSeconds: Number(settings.otp_resend_cooldown_seconds ?? 60),
  maxSends: Number(settings.otp_max_sends ?? 5),
});

// Atualização condicional: dois cliques simultâneos não geram dois códigos válidos.
async function claimOtpSlot(ctx: Ctx, policy: OtpPolicy, code: string): Promise<Date> {
  const now = new Date();
  const cutoff = new Date(now.getTime() - policy.cooldownSeconds * 1000).toISOString();
  const verifier = await otpVerifier(otpSecret(), { sessionId: ctx.session.id, documentSha256: ctx.document.sha256, code });
  const { data: claimed } = await ctx.supabase
    .from("care_signature_sessions")
    .update({
      otp_verifier: verifier,
      otp_expires_at: new Date(now.getTime() + policy.ttlMinutes * 60_000).toISOString(),
      otp_attempts: 0,
      otp_sends: Number(ctx.session.otp_sends) + 1,
      otp_last_sent_at: now.toISOString(),
    })
    .eq("id", ctx.session.id)
    .eq("status", "aceita")
    .or(`otp_last_sent_at.is.null,otp_last_sent_at.lt.${cutoff}`)
    .select("id");
  if (!claimed || claimed.length === 0) {
    throw new HttpError(429, `Aguarde ${policy.cooldownSeconds} segundos para pedir outro código.`, "aguarde");
  }
  return now;
}

function assertCanSendOtp(ctx: Ctx, policy: OtpPolicy): void {
  assertUsable(ctx);
  if (ctx.session.status !== "aceita") throw new HttpError(422, "Confirme o aceite do contrato antes de pedir o código.");
  if (Number(ctx.session.otp_sends) >= policy.maxSends) {
    throw new HttpError(429, "Limite de envios de código atingido. Peça um novo link à loja.", "limite_envios");
  }
}

async function sendOtp(ctx: Ctx) {
  const policy = otpPolicy(await loadSettings(ctx.supabase));
  assertCanSendOtp(ctx, policy);
  const contract = await loadContract(ctx.supabase, ctx.session.contract_id);
  if (!contract) throw new HttpError(404, "Contrato não encontrado.");

  const code = generateOtp();
  const sentAt = await claimOtpSlot(ctx, policy, code);
  const channel = await resolveWhatsAppChannel(ctx.supabase, contract.store_id);
  const result = channel
    ? await sendDirectWhatsApp(channel, { number: contract.customer_phone, text: otpMessage(contract.contract_number, code, policy.ttlMinutes) })
    : { ok: false, providerMessageId: null, error: "Nenhum canal WhatsApp ativo." };

  await event(ctx, {
    type: result.ok ? "otp_enviado" : "otp_envio_falhou",
    source: "sistema",
    data: { provedor: "uazapi", telefone: maskPhone(contract.customer_phone), envio_numero: Number(ctx.session.otp_sends) + 1, erro: result.error },
    columns: { whatsapp_message_id: result.providerMessageId },
  });
  if (!result.ok) {
    await ctx.supabase.from("care_signature_sessions").update({ otp_verifier: null }).eq("id", ctx.session.id);
    throw new HttpError(502, "Não conseguimos enviar o código pelo WhatsApp agora. Tente de novo em instantes.");
  }
  return {
    sent: true,
    phoneMasked: maskPhone(contract.customer_phone),
    resendAvailableAt: new Date(sentAt.getTime() + policy.cooldownSeconds * 1000).toISOString(),
  };
}

type Attempt = { state: string; verifier?: string; attempt?: number; maxAttempts?: number };

// Traduz o estado da tentativa em resposta ao assinante; só "ok" segue para a comparação.
async function rejectUnusableAttempt(ctx: Ctx, attempt: Attempt): Promise<void> {
  if (attempt.state === "sem_codigo") throw new HttpError(422, "Peça o código pelo WhatsApp antes de confirmar.");
  if (attempt.state === "expirado") {
    await event(ctx, { type: "otp_expirado", source: "sistema" });
    throw new HttpError(410, "O código expirou. Peça um novo código.", "otp_expirado");
  }
  if (attempt.state === "bloqueada") {
    await event(ctx, { type: "sessao_bloqueada", source: "sistema", data: { motivo: "tentativas_esgotadas" } });
    throw new HttpError(423, "Assinatura bloqueada por excesso de tentativas. Peça um novo link à loja.", "bloqueado");
  }
}

async function assertCodeMatches(ctx: Ctx, attempt: Attempt, code: string): Promise<void> {
  const expected = await otpVerifier(otpSecret(), { sessionId: ctx.session.id, documentSha256: ctx.document.sha256, code });
  if (timingSafeEqualHex(expected, String(attempt.verifier))) return;
  const remaining = Number(attempt.maxAttempts) - Number(attempt.attempt);
  await event(ctx, { type: "otp_invalido", source: "assinante", data: { tentativa: attempt.attempt, restantes: remaining } });
  throw new HttpError(
    422,
    remaining > 0 ? `Código incorreto. Você tem mais ${remaining} tentativa(s).` : "Código incorreto. Peça um novo link à loja.",
    "otp_invalido",
  );
}

async function finalizeQuietly(ctx: Ctx): Promise<string | null> {
  try {
    return (await finalizeSignedArtifacts(ctx.supabase, ctx.session.contract_id)).signedPdfSha256;
  } catch (e) {
    // A assinatura já vale; o painel consegue regerar os artefatos (ação finalize).
    await event(ctx, { type: "artefatos_falharam", source: "sistema", data: { erro: e instanceof Error ? e.message : String(e) } });
    return null;
  }
}

async function verifyOtp(ctx: Ctx, body: Body) {
  if (ctx.session.status === "assinada") return { signed: true, alreadySigned: true };
  assertUsable(ctx);
  const code = String(body.code ?? "").trim();
  if (!isSixDigitCode(code)) throw new HttpError(422, "Digite os 6 números do código.");

  const { data, error } = await ctx.supabase.rpc("care_consume_otp_attempt", { p_session_id: ctx.session.id });
  if (error) throw new HttpError(500, "Não foi possível validar o código agora.");
  const attempt = data as Attempt;
  if (attempt.state === "assinada") return { signed: true, alreadySigned: true };
  await rejectUnusableAttempt(ctx, attempt);
  await assertCodeMatches(ctx, attempt, code);

  await event(ctx, { type: "otp_validado", source: "assinante", data: { tentativa: attempt.attempt } });
  const { data: signed, error: signError } = await ctx.supabase.rpc("care_sign_session", {
    p_session_id: ctx.session.id,
    p_document_sha256: ctx.document.sha256,
    p_source_ip: ctx.ip,
    p_user_agent: ctx.ua,
    p_geo: normalizeGeo(body.geo),
  });
  if (signError) throw new HttpError(422, signError.message);
  const signedPdfSha256 = await finalizeQuietly(ctx);
  return { signed: true, alreadySigned: Boolean(signed?.alreadySigned), activated: Boolean(signed?.activated), signedPdfSha256 };
}

const ACTIONS: Record<string, (ctx: Ctx, body: Body) => Promise<Record<string, unknown>>> = {
  open: (ctx) => open(ctx),
  viewed: (ctx) => viewed(ctx),
  accept,
  send_otp: (ctx) => sendOtp(ctx),
  verify_otp: verifyOtp,
};

async function buildContext(req: Request, token: unknown): Promise<Ctx> {
  const supabase = createServiceClient();
  const session = await resolveSession(supabase, token);
  const { data: document } = await supabase.from("care_contract_documents").select("*").eq("id", session.document_id).single();
  const ctx: Ctx = { supabase, session, document: document as Record<string, any>, ip: resolveClientIp(req.headers), ua: sanitizeUserAgent(req.headers.get("user-agent")) };
  await expireIfNeeded(ctx);
  return ctx;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return jsonResponse({ error: "Método não permitido." }, 405);

  const body = await parseJsonBody<Body>(req);
  const handler = ACTIONS[String(body?.action)];
  if (!body || !handler) return jsonResponse({ error: "Requisição inválida." }, 400);
  try {
    return jsonResponse(await handler(await buildContext(req, body.token), body));
  } catch (error) {
    if (error instanceof HttpError) return jsonResponse({ error: error.message, code: error.code ?? null }, error.status);
    return jsonResponse({ error: "Não foi possível concluir agora. Tente novamente." }, 500);
  }
});
