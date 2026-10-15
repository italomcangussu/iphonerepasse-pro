// Acesso a dados do Repasse Care+ compartilhado pelos edge functions (service_role).

import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";
import { type CareContractTextData, CARE_ACCEPTANCE_TEXT_VERSION } from "./contract_text.ts";
import { type CertificateEvent, renderSignedPdf } from "./contract_pdf.ts";
import { maskPhone, sha256Hex } from "./security.ts";
import { resolveWhatsAppChannel, sendDirectWhatsApp } from "./whatsapp.ts";

export const CARE_BUCKET = "care-contracts";

export type ContractRow = Record<string, any> & {
  id: string;
  contract_number: number;
  status: string;
  store_id: string | null;
  customer_phone: string;
  customer_name: string;
};

export type DocumentRow = Record<string, any> & {
  id: string;
  contract_id: string;
  version: number;
  storage_path: string;
  sha256: string;
  status: string;
};

export async function loadContract(supabase: SupabaseClient, contractId: string): Promise<ContractRow | null> {
  const { data, error } = await supabase.from("care_contracts").select("*").eq("id", contractId).maybeSingle();
  if (error) throw new Error(error.message);
  return (data as ContractRow | null) ?? null;
}

export async function loadLatestDocument(
  supabase: SupabaseClient,
  contractId: string,
  statuses: string[],
): Promise<DocumentRow | null> {
  const { data, error } = await supabase
    .from("care_contract_documents")
    .select("*")
    .eq("contract_id", contractId)
    .in("status", statuses)
    .order("version", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return (data as DocumentRow | null) ?? null;
}

export async function loadSettings(supabase: SupabaseClient): Promise<Record<string, any>> {
  const { data } = await supabase.from("care_settings").select("*").eq("id", true).maybeSingle();
  return (data as Record<string, any>) ?? {};
}

export async function appendEvent(supabase: SupabaseClient, event: Record<string, unknown>): Promise<void> {
  const { error } = await supabase.from("care_signature_events").insert(event);
  if (error) throw new Error(`Falha ao registrar evidência: ${error.message}`);
}

export interface ContractTextRequest {
  contract: ContractRow;
  documentVersion: number;
  issuedAt: Date;
}

const resolveContractor = (settings: Record<string, any>, profile: Record<string, any> | null) => ({
  legalName: settings.contractor_legal_name || profile?.name || "iPhone Repasse",
  cnpj: settings.contractor_cnpj || profile?.cnpj || null,
  address: settings.contractor_address || profile?.address || null,
});

const contractValues = (c: ContractRow): CareContractTextData["values"] => ({
  salePrice: Number(c.sale_price),
  firstAmount: Number(c.first_amount),
  recurringPercent: Number(c.recurring_percent),
  subsequentCount: Number(c.subsequent_count),
  recurringAmount: Number(c.recurring_amount),
  subsequentTotal: Number(c.subsequent_total),
  totalProgrammed: Number(c.total_programmed),
  billingIntervalMonths: Number(c.billing_interval_months),
  firstSubsequentDueMonths: Number(c.first_subsequent_due_months),
  deductibleModality: c.deductible_modality,
  deductibleRate: Number(c.deductible_rate),
  deductibleAmount: Number(c.deductible_amount),
});

const snapshotBonuses = (c: ContractRow): CareContractTextData["bonuses"] => {
  const bonuses = (c.quote_snapshot as Record<string, any> | null)?.bonuses;
  return (Array.isArray(bonuses) ? bonuses : []).map((b: Record<string, any>) => ({
    name: String(b.name ?? ""),
    quantity: Number(b.quantity ?? 1),
    description: b.description ?? null,
  }));
};

export async function buildContractTextData(
  supabase: SupabaseClient,
  { contract, documentVersion, issuedAt }: ContractTextRequest,
): Promise<CareContractTextData> {
  const settings = await loadSettings(supabase);
  const { data: profile } = await supabase.from("business_profile").select("name, cnpj, address").limit(1).maybeSingle();
  const { data: sale } = await supabase.from("sales").select("sale_number").eq("id", contract.sale_id).maybeSingle();
  return {
    contractNumber: Number(contract.contract_number),
    documentVersion,
    clausesVersion: contract.clauses_version,
    issuedAt,
    contractor: resolveContractor(settings, profile),
    customer: { name: contract.customer_name, cpf: contract.customer_cpf, phone: contract.customer_phone },
    device: {
      model: contract.device_model,
      capacity: contract.device_capacity,
      color: contract.device_color,
      imei: contract.device_imei,
      condition: contract.condition,
    },
    sale: { number: sale?.sale_number ?? null, date: null },
    values: contractValues(contract),
    bonuses: snapshotBonuses(contract),
    servicesDescription: contract.services_description,
    usageLimits: contract.usage_limits,
  };
}

export const acceptanceTextVersion = CARE_ACCEPTANCE_TEXT_VERSION;

export async function downloadBytes(supabase: SupabaseClient, path: string): Promise<Uint8Array> {
  const { data, error } = await supabase.storage.from(CARE_BUCKET).download(path);
  if (error || !data) throw new Error(`Arquivo indisponível no armazenamento (${path}).`);
  return new Uint8Array(await data.arrayBuffer());
}

export interface StoredFile {
  path: string;
  bytes: Uint8Array;
  contentType: string;
}

export async function uploadImmutable(supabase: SupabaseClient, file: StoredFile): Promise<void> {
  // upsert:false — um caminho de contrato nunca é sobrescrito.
  const { error } = await supabase.storage.from(CARE_BUCKET).upload(file.path, file.bytes, { contentType: file.contentType, upsert: false });
  if (error) throw new Error(`Falha ao armazenar ${file.path}: ${error.message}`);
}

const maskCpf = (cpf: string | null): string => {
  const digits = (cpf ?? "").replace(/\D/g, "");
  return digits.length >= 11 ? `***.${digits.slice(3, 6)}.***-${digits.slice(-2)}` : "não informado";
};

const geoText = (e: Record<string, any>): string => {
  if (e.geo_permission === "concedida" && e.geo_lat != null) {
    const accuracy = e.geo_accuracy_m != null ? ` (±${e.geo_accuracy_m} m)` : "";
    return `${e.geo_lat}, ${e.geo_lon}${accuracy}`;
  }
  if (e.geo_permission === "nao_compartilhada") return "não compartilhada pelo assinante";
  if (e.geo_permission === "indisponivel") return "indisponível no dispositivo";
  return "não solicitada";
};

async function loadEvents(supabase: SupabaseClient, contractId: string): Promise<Record<string, any>[]> {
  const { data, error } = await supabase
    .from("care_signature_events")
    .select("*")
    .eq("contract_id", contractId)
    .order("id", { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []) as Record<string, any>[];
}

export interface FinalizeResult {
  signedPdfPath: string;
  signedPdfSha256: string;
  evidencePath: string;
  evidenceSha256: string;
  copySent: boolean;
}

type Signed = { contract: ContractRow; doc: DocumentRow; events: Record<string, any>[] };

const toCertificateEvent = (e: Record<string, any>): CertificateEvent => ({
  occurredAt: new Date(e.occurred_at).toISOString(),
  type: e.event_type,
  source: e.source,
  ip: e.source_ip,
  userAgent: e.user_agent,
  whatsappMessageId: e.whatsapp_message_id,
  geo: geoText(e),
  hash: e.evidence_hash,
});

async function renderSignedArtifact({ contract, doc, events }: Signed, original: Uint8Array): Promise<Uint8Array> {
  const signedEvent = [...events].reverse().find((e) => e.event_type === "contrato_assinado");
  return await renderSignedPdf(original, {
    contractNumber: Number(contract.contract_number),
    documentVersion: doc.version,
    documentSha256: doc.sha256,
    signerName: contract.customer_name,
    signerCpfMasked: maskCpf(contract.customer_cpf),
    signerPhoneMasked: maskPhone(contract.customer_phone),
    signedAtUtc: new Date(signedEvent?.occurred_at ?? doc.signed_at).toISOString(),
    method: "Aceite expresso + código numérico de 6 dígitos de uso único enviado ao WhatsApp do contratante",
    events: events.filter((e) => !e.document_id || e.document_id === doc.id).map(toCertificateEvent),
    chainLastHash: events.at(-1)?.evidence_hash ?? null,
  });
}

const evidencePackage = ({ contract, doc, events }: Signed, signedPdfSha256: string): Uint8Array =>
  new TextEncoder().encode(JSON.stringify({
    tipo: "dossie_assinatura_repasse_care",
    geradoEmUtc: new Date().toISOString(),
    contrato: { id: contract.id, numero: contract.contract_number, versaoClausulas: contract.clauses_version, snapshotComercial: contract.quote_snapshot },
    documento: { id: doc.id, versao: doc.version, sha256: doc.sha256, tamanhoBytes: doc.size_bytes, versaoAceite: doc.acceptance_text_version },
    pdfAssinado: { sha256: signedPdfSha256 },
    assinante: { nome: contract.customer_name, cpfMascarado: maskCpf(contract.customer_cpf), telefoneMascarado: maskPhone(contract.customer_phone) },
    eventos: events,
  }, null, 2));

async function loadSigned(supabase: SupabaseClient, contractId: string): Promise<Signed> {
  const contract = await loadContract(supabase, contractId);
  if (!contract) throw new Error("Contrato não encontrado.");
  const doc = await loadLatestDocument(supabase, contractId, ["assinado"]);
  if (!doc) throw new Error("Contrato ainda não assinado.");
  return { contract, doc, events: await loadEvents(supabase, contractId) };
}

const existingArtifacts = (doc: DocumentRow): FinalizeResult | null =>
  doc.signed_pdf_sha256 && doc.evidence_sha256
    ? { signedPdfPath: doc.signed_pdf_path, signedPdfSha256: doc.signed_pdf_sha256, evidencePath: doc.evidence_path, evidenceSha256: doc.evidence_sha256, copySent: false }
    : null;

async function verifiedOriginal(supabase: SupabaseClient, doc: DocumentRow): Promise<Uint8Array> {
  const original = await downloadBytes(supabase, doc.storage_path);
  if ((await sha256Hex(original)) !== doc.sha256) throw new Error("Integridade do PDF original não confere com o hash registrado.");
  return original;
}

async function storeArtifacts(supabase: SupabaseClient, signed: Signed, signedPdf: Uint8Array): Promise<Omit<FinalizeResult, "copySent">> {
  const signedPdfSha256 = await sha256Hex(signedPdf);
  const evidence = evidencePackage(signed, signedPdfSha256);
  const evidenceSha256 = await sha256Hex(evidence);
  const base = `${signed.contract.id}/v${signed.doc.version}`;
  const signedPdfPath = `${base}-assinado-${signedPdfSha256.slice(0, 12)}.pdf`;
  const evidencePath = `${base}-dossie-${evidenceSha256.slice(0, 12)}.json`;
  await uploadImmutable(supabase, { path: signedPdfPath, bytes: signedPdf, contentType: "application/pdf" });
  await uploadImmutable(supabase, { path: evidencePath, bytes: evidence, contentType: "application/json" });

  const { error } = await supabase
    .from("care_contract_documents")
    .update({ signed_pdf_path: signedPdfPath, signed_pdf_sha256: signedPdfSha256, evidence_path: evidencePath, evidence_sha256: evidenceSha256 })
    .eq("id", signed.doc.id)
    .is("signed_pdf_sha256", null);
  if (error) throw new Error(error.message);
  await appendEvent(supabase, {
    contract_id: signed.contract.id,
    document_id: signed.doc.id,
    event_type: "artefatos_gerados",
    source: "sistema",
    event_data: { pdf_assinado_sha256: signedPdfSha256, dossie_sha256: evidenceSha256 },
  });
  return { signedPdfPath, signedPdfSha256, evidencePath, evidenceSha256 };
}

// Gera PDF final + pacote de evidências e envia a cópia ao cliente. Idempotente: se os
// artefatos já existem, só os devolve (nunca sobrescreve prova).
export async function finalizeSignedArtifacts(supabase: SupabaseClient, contractId: string): Promise<FinalizeResult> {
  const signed = await loadSigned(supabase, contractId);
  const existing = existingArtifacts(signed.doc);
  if (existing) return existing;
  const signedPdf = await renderSignedArtifact(signed, await verifiedOriginal(supabase, signed.doc));
  const stored = await storeArtifacts(supabase, signed, signedPdf);
  const copySent = await sendSignedCopy(supabase, { contract: signed.contract, documentId: signed.doc.id, path: stored.signedPdfPath });
  return { ...stored, copySent };
}

interface SignedCopy {
  contract: ContractRow;
  documentId: string;
  path: string;
}

async function sendSignedCopy(supabase: SupabaseClient, { contract, documentId, path }: SignedCopy): Promise<boolean> {
  const channel = await resolveWhatsAppChannel(supabase, contract.store_id);
  const { data: signed } = await supabase.storage.from(CARE_BUCKET).createSignedUrl(path, 7 * 24 * 3600);
  const base = { contract_id: contract.id, document_id: documentId, source: "sistema" };
  if (!channel || !signed?.signedUrl) {
    await appendEvent(supabase, { ...base, event_type: "copia_envio_falhou", event_data: { motivo: channel ? "url_assinada_indisponivel" : "sem_canal_whatsapp" } });
    return false;
  }
  const result = await sendDirectWhatsApp(channel, {
    number: contract.customer_phone,
    text: `Repasse Care+ — iPhone Repasse\nSeu contrato nº ${contract.contract_number} foi assinado. Segue a cópia com o certificado de assinatura.`,
    mediaUrl: signed.signedUrl,
    mediaType: "application/pdf",
    mediaFilename: `repasse-care-contrato-${contract.contract_number}.pdf`,
  });
  await appendEvent(supabase, {
    ...base,
    event_type: result.ok ? "copia_enviada" : "copia_envio_falhou",
    whatsapp_message_id: result.providerMessageId,
    event_data: { provedor: "uazapi", telefone: maskPhone(contract.customer_phone), erro: result.error },
  });
  return result.ok;
}
