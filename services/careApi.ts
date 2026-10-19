// Acesso a dados do Repasse Care+ (RPCs e edge functions). Telas e componentes usam só este módulo.
import { supabase } from './supabase';
import type {
  CareBenefit,
  CareCondition,
  CareConditionRule,
  CareContract,
  CareDashboard,
  CareDossier,
  CareIssueResult,
  CareModelRule,
  CareQuote,
  CareServiceRequest,
  CareServiceRequestStatus,
  CareSettings,
} from '../lib/care/careTypes';

const readErrorPayload = async (error: unknown): Promise<{ error?: string; code?: string }> => {
  const context = (error as { context?: Response } | null)?.context;
  if (!context || typeof context.clone !== 'function') return {};
  try {
    return await context.clone().json();
  } catch {
    return {};
  }
};

export class CareRequestError extends Error {
  constructor(message: string, public code: string | null = null) {
    super(message);
    this.name = 'CareRequestError';
  }
}

const OFFLINE_MESSAGE = 'Não foi possível concluir agora. Verifique a conexão e tente de novo.';

export async function invokeCareFunction<T>(name: 'care-contract' | 'care-sign-public', body: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.functions.invoke(name, { body });
  if (error) {
    const payload = await readErrorPayload(error);
    throw new CareRequestError(payload.error || OFFLINE_MESSAGE, payload.code ?? null);
  }
  const failure = (data as { error?: unknown } | null)?.error;
  if (typeof failure === 'string') throw new CareRequestError(failure);
  return data as T;
}

const unwrap = <T>(result: { data: T | null; error: { message: string } | null }): T => {
  if (result.error) throw new CareRequestError(result.error.message);
  return result.data as T;
};

// --- Proposta e contratação -------------------------------------------------

export const fetchQuoteForSaleItem = async (saleId: string, stockItemId: string): Promise<CareQuote> =>
  unwrap(await supabase.rpc('care_quote_for_sale_item', { p_sale_id: saleId, p_stock_item_id: stockItemId }));

export const simulateCare = async (model: string, condition: CareCondition, salePrice: number): Promise<CareQuote> =>
  unwrap(await supabase.rpc('care_simulate', { p_model: model, p_condition: condition, p_sale_price: salePrice }));

export const createCareContract = async (saleId: string, stockItemId: string): Promise<string> =>
  unwrap(await supabase.rpc('care_create_contract', { p_sale_id: saleId, p_stock_item_id: stockItemId }));

export const issueCareContract = (contractId: string): Promise<CareIssueResult> =>
  invokeCareFunction<CareIssueResult>('care-contract', {
    action: 'issue',
    contractId,
    appOrigin: typeof window !== 'undefined' ? window.location.origin : undefined,
  });

// --- Contratos ----------------------------------------------------------------

// Suspende antes de listar contratos com atraso acima da carência (a rotina diária também faz isso).
export const refreshCareSuspensions = async (): Promise<number> =>
  unwrap(await supabase.rpc('care_refresh_suspensions')) ?? 0;

export async function listCareContracts(): Promise<CareContract[]> {
  await refreshCareSuspensions().catch(() => 0);
  return unwrap(await supabase.from('care_contracts').select('*').order('created_at', { ascending: false }).limit(1000)) ?? [];
}

export const listCareContractsForSale = async (saleId: string): Promise<CareContract[]> =>
  unwrap(await supabase.from('care_contracts').select('*').eq('sale_id', saleId).order('created_at', { ascending: false })) ?? [];

export async function fetchCareDossier(contractId: string): Promise<CareDossier> {
  const [dossier, inspections] = await Promise.all([
    supabase.rpc('care_contract_dossier', { p_contract_id: contractId }),
    supabase.rpc('care_contract_inspections_json', { p_contract_id: contractId }),
  ]);
  return { ...(unwrap(dossier) as Omit<CareDossier, 'inspections'>), inspections: unwrap(inspections) ?? [] };
}

// Reativa contrato suspenso após vistoria; avarias informadas ficam excluídas do contrato.
export const reactivateCareAfterInspection = async (contractId: string, findings: string): Promise<void> => {
  unwrap(await supabase.rpc('care_reactivate_after_inspection', { p_contract_id: contractId, p_findings: findings || null }));
};

export interface InstallmentPayment {
  installmentId: string;
  method: string;
  account: 'Conta Bancária' | 'Cofre';
  reference?: string;
}

export const confirmCareInstallment = async (payment: InstallmentPayment): Promise<{ alreadyPaid: boolean }> =>
  unwrap(await supabase.rpc('care_confirm_installment_payment', {
    p_installment_id: payment.installmentId,
    p_payment_method: payment.method,
    p_account: payment.account,
    p_reference: payment.reference ?? null,
  }));

export const deliverCareBenefit = async (benefitId: string, notes: string): Promise<void> => {
  unwrap(await supabase.rpc('care_deliver_benefit', { p_benefit_id: benefitId, p_notes: notes || null }));
};

export const cancelCareContract = async (contractId: string, reason: string): Promise<void> => {
  unwrap(await supabase.rpc('care_cancel_contract', { p_contract_id: contractId, p_reason: reason }));
};

export type CareDocumentKind = 'original' | 'signed' | 'evidence';

export const fetchCareDocumentUrl = (contractId: string, kind: CareDocumentKind): Promise<{ url: string }> =>
  invokeCareFunction('care-contract', { action: 'document_url', contractId, kind });

export interface CareIntegrityReport {
  files: { ok: boolean; original: FileCheck | null; signed: FileCheck | null; evidence: FileCheck | null };
  chain: { ok: boolean; events: number; brokenAtEventId?: number };
}
type FileCheck = { expected: string; actual: string; ok: boolean };

export async function verifyCareIntegrity(contractId: string): Promise<CareIntegrityReport> {
  const files = await invokeCareFunction<CareIntegrityReport['files']>('care-contract', { action: 'verify', contractId });
  const chain = unwrap(await supabase.rpc('care_verify_event_chain', { p_contract_id: contractId })) as CareIntegrityReport['chain'];
  return { files, chain };
}

export const regenerateCareArtifacts = (contractId: string): Promise<unknown> =>
  invokeCareFunction('care-contract', { action: 'finalize', contractId });

// --- Acionamentos -------------------------------------------------------------

export type CareServiceRequestRow = CareServiceRequest & {
  contract: Pick<CareContract, 'contract_number' | 'customer_name' | 'device_model' | 'condition' | 'status'> | null;
};

export const listCareServiceRequests = async (): Promise<CareServiceRequestRow[]> =>
  unwrap(await supabase
    .from('care_service_requests')
    .select('*, contract:care_contracts(contract_number, customer_name, device_model, condition, status)')
    .order('opened_at', { ascending: false })
    .limit(500)) ?? [];

export const openCareServiceRequest = async (contractId: string, serviceType: string, description: string): Promise<string> =>
  unwrap(await supabase.rpc('care_open_service_request', {
    p_contract_id: contractId,
    p_service_type: serviceType,
    p_description: description || null,
  }));

export interface ServiceRequestUpdate {
  requestId: string;
  status: CareServiceRequestStatus;
  notes?: string;
  actualCost?: number | null;
  partsCost?: number | null;
  deductiblePaid?: boolean | null;
}

export const updateCareServiceRequest = async (u: ServiceRequestUpdate): Promise<void> => {
  unwrap(await supabase.rpc('care_update_service_request', {
    p_request_id: u.requestId,
    p_status: u.status,
    p_notes: u.notes ?? null,
    p_actual_cost: u.actualCost ?? null,
    p_parts_cost: u.partsCost ?? null,
    p_deductible_paid: u.deductiblePaid ?? null,
  }));
};

// --- Painel -------------------------------------------------------------------

export const fetchCareDashboard = async (from: string, to: string): Promise<CareDashboard> =>
  unwrap(await supabase.rpc('care_dashboard', { p_from: from, p_to: to }));

// --- Regras comerciais ----------------------------------------------------------

export const listConditionRules = async (): Promise<CareConditionRule[]> =>
  unwrap(await supabase.from('care_condition_rules').select('*').order('condition')) ?? [];

export type ConditionRulePatch = Pick<CareConditionRule, 'recurring_percent' | 'deductible_modality' | 'deductible_value'>;

export const updateConditionRule = async (condition: CareCondition, patch: ConditionRulePatch): Promise<void> => {
  unwrap(await supabase.from('care_condition_rules').update(patch).eq('condition', condition));
};

export const listModelRules = async (): Promise<CareModelRule[]> =>
  unwrap(await supabase
    .from('care_model_rules')
    .select('*, bonuses:care_model_rule_bonuses(benefit_id, quantity, delivery_condition)')
    .order('model')) ?? [];

export type ModelRuleInput = Omit<CareModelRule, 'id' | 'version' | 'updated_at' | 'bonuses'> & {
  id?: string;
  bonuses: Array<{ benefit_id: string; quantity: number }>;
};

export async function saveModelRule(input: ModelRuleInput): Promise<string> {
  const { id, bonuses, ...fields } = input;
  const row = id
    ? unwrap(await supabase.from('care_model_rules').update(fields).eq('id', id).select('id').single())
    : unwrap(await supabase.from('care_model_rules').insert(fields).select('id').single());
  const ruleId = (row as { id: string }).id;
  unwrap(await supabase.from('care_model_rule_bonuses').delete().eq('rule_id', ruleId));
  if (bonuses.length > 0) {
    unwrap(await supabase.from('care_model_rule_bonuses').insert(bonuses.map((b) => ({ ...b, rule_id: ruleId }))));
  }
  return ruleId;
}

export const listCareBenefits = async (): Promise<CareBenefit[]> =>
  unwrap(await supabase.from('care_benefits').select('*').order('name')) ?? [];

export const saveCareBenefit = async (benefit: Omit<CareBenefit, 'id'> & { id?: string }): Promise<void> => {
  const { id, ...fields } = benefit;
  unwrap(id
    ? await supabase.from('care_benefits').update(fields).eq('id', id)
    : await supabase.from('care_benefits').insert(fields));
};

export const fetchCareSettings = async (): Promise<CareSettings> =>
  unwrap(await supabase.from('care_settings').select('*').eq('id', true).single());

export const updateCareSettings = async (patch: Partial<CareSettings>): Promise<void> => {
  unwrap(await supabase.from('care_settings').update(patch).eq('id', true));
};

export const listCatalogModels = async (): Promise<string[]> => {
  const rows = unwrap(await supabase.from('device_catalog').select('model').eq('type', 'iPhone')) as Array<{ model: string }> | null;
  return Array.from(new Set((rows ?? []).map((r) => r.model.trim()).filter(Boolean))).sort((a, b) => a.localeCompare(b, 'pt-BR', { numeric: true }));
};
