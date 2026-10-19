// Tipos do Repasse Care+ espelhando o que o banco devolve (snake_case nas linhas, camelCase nos jsonb das RPCs).

export type CareCondition = 'NOVO' | 'SEMINOVO';
export type CareRuleSource = 'MODELO_CONDICAO' | 'CONDICAO';
export type CareDeductibleModality = 'PERCENTUAL' | 'VALOR_FIXO';

export type CareContractStatus =
  | 'rascunho'
  | 'aguardando_assinatura'
  | 'assinado_aguardando_primeiro_pagamento'
  | 'ativo'
  | 'assinatura_expirada'
  | 'assinatura_recusada'
  | 'suspenso'
  | 'encerrado'
  | 'cancelado';

export type CareServiceRequestStatus =
  | 'solicitado'
  | 'em_analise'
  | 'aprovado'
  | 'reprovado'
  | 'em_execucao'
  | 'concluido'
  | 'cancelado';

export interface CareQuoteBonus {
  benefitId: string;
  name: string;
  kind: string;
  description: string | null;
  quantity: number;
  deliveryCondition: string | null;
  referenceCost: number | null;
}

export interface CareQuote {
  ok: boolean;
  pendencias: string[];
  model: string;
  condition: CareCondition | null;
  salePrice: number | null;
  firstAmount: number | null;
  bonuses: CareQuoteBonus[];
  recurringPercent: number | null;
  recurringPercentSource: CareRuleSource | null;
  subsequentCount: number | null;
  recurringAmount: number | null;
  subsequentTotal: number | null;
  totalProgrammed: number | null;
  totalCharges: number | null;
  deductibleModality: CareDeductibleModality | null;
  deductibleRate: number | null;
  deductibleSource: CareRuleSource | null;
  deductibleBase: number | null;
  deductibleAmount: number | null;
  billingIntervalMonths: number | null;
  firstSubsequentDueMonths: number | null;
  servicesDescription: string | null;
  usageLimits: string | null;
  // Só na proposta de uma venda real:
  saleId?: string;
  saleItemId?: string;
  itemListPrice?: number;
  saleDiscountShare?: number;
  device?: { type: string; model: string; capacity: string | null; color: string | null; imei: string | null };
  customer?: { id: string | null; name: string | null; cpf: string | null; phone: string | null };
  existingContract?: { id: string; status: CareContractStatus; contractNumber: number } | null;
}

export interface CareContract {
  id: string;
  contract_number: number;
  status: CareContractStatus;
  sale_id: string;
  stock_item_id: string;
  customer_id: string;
  store_id: string | null;
  seller_id: string | null;
  customer_name: string;
  customer_cpf: string | null;
  customer_phone: string;
  device_model: string;
  device_capacity: string | null;
  device_color: string | null;
  device_imei: string | null;
  condition: CareCondition;
  sale_price: number;
  first_amount: number;
  recurring_percent: number;
  recurring_percent_source: CareRuleSource;
  subsequent_count: number;
  recurring_amount: number;
  subsequent_total: number;
  total_programmed: number;
  deductible_modality: CareDeductibleModality;
  deductible_rate: number;
  deductible_source: CareRuleSource;
  deductible_base: number | null;
  deductible_amount: number;
  clauses_version: string;
  model_rule_version: number;
  condition_rule_version: number;
  signed_at: string | null;
  first_payment_confirmed_at: string | null;
  activated_at: string | null;
  cancelled_at: string | null;
  cancel_reason: string | null;
  suspended_at: string | null;
  suspension_reason: string | null;
  created_at: string;
}

export interface CareInspection {
  id: string;
  inspected_at: string;
  result: 'sem_avarias' | 'avarias_excluidas';
  findings: string | null;
}

export interface CareInstallment {
  id: string;
  contract_id: string;
  sequence_number: number;
  kind: 'primeira' | 'recorrente';
  amount: number;
  due_date: string | null;
  status: 'programada' | 'paga' | 'cancelada';
  paid_at: string | null;
  payment_method: string | null;
  payment_account: string | null;
  payment_reference: string | null;
}

export interface CareContractBenefit {
  id: string;
  name: string;
  kind: string;
  quantity: number;
  status: 'pendente' | 'liberado' | 'entregue' | 'cancelado';
  released_at: string | null;
  delivered_at: string | null;
  delivery_notes: string | null;
}

export interface CareDocument {
  id: string;
  version: number;
  sha256: string;
  size_bytes: number;
  status: 'emitido' | 'substituido' | 'assinado';
  issued_at: string;
  signed_at: string | null;
  signed_pdf_sha256: string | null;
  evidence_sha256: string | null;
}

export interface CareSessionSummary {
  id: string;
  status: 'aberta' | 'aceita' | 'assinada' | 'expirada' | 'revogada' | 'bloqueada';
  phone: string;
  linkExpiresAt: string;
  otpAttempts: number;
  otpSends: number;
  acceptedAt: string | null;
  signedAt: string | null;
  createdAt: string;
}

export interface CareSignatureEvent {
  id: number;
  event_type: string;
  occurred_at: string;
  source: string;
  source_ip: string | null;
  user_agent: string | null;
  whatsapp_message_id: string | null;
  geo_permission: string | null;
  geo_lat: number | null;
  geo_lon: number | null;
  geo_accuracy_m: number | null;
  event_data: Record<string, unknown>;
  evidence_hash: string;
}

export interface CareServiceRequest {
  id: string;
  request_number: number;
  contract_id: string;
  service_type: string;
  description: string | null;
  status: CareServiceRequestStatus;
  deductible_amount: number | null;
  deductible_paid: boolean;
  actual_cost: number | null;
  parts_cost: number | null;
  decision_notes: string | null;
  opened_at: string;
  decided_at: string | null;
  completed_at: string | null;
}

export interface CareDossier {
  contract: CareContract | null;
  installments: CareInstallment[];
  benefits: CareContractBenefit[];
  documents: CareDocument[];
  sessions: CareSessionSummary[];
  events: CareSignatureEvent[] | null;
  serviceRequests: CareServiceRequest[];
  inspections: CareInspection[];
}

export interface CareConditionRule {
  condition: CareCondition;
  recurring_percent: number | null;
  deductible_modality: CareDeductibleModality | null;
  deductible_value: number | null;
  version: number;
  updated_at: string;
}

export interface CareModelRule {
  id: string;
  model: string;
  condition: CareCondition;
  active: boolean;
  first_installment_amount: number;
  subsequent_installment_count: number;
  recurring_percent_override: number | null;
  deductible_modality: CareDeductibleModality | null;
  deductible_value: number | null;
  billing_interval_months: number;
  first_subsequent_due_months: number;
  services_description: string | null;
  usage_limits: string | null;
  notes: string | null;
  version: number;
  updated_at: string;
  bonuses: Array<{ benefit_id: string; quantity: number; delivery_condition: string | null }>;
}

export interface CareBenefit {
  id: string;
  name: string;
  kind: 'produto' | 'servico' | 'beneficio' | 'kit';
  description: string | null;
  reference_cost: number | null;
  active: boolean;
}

export interface CareSettings {
  otp_ttl_minutes: number;
  otp_max_attempts: number;
  otp_resend_cooldown_seconds: number;
  otp_max_sends: number;
  signature_link_ttl_hours: number;
  clauses_version: string;
  contractor_legal_name: string | null;
  contractor_cnpj: string | null;
  contractor_address: string | null;
  default_services_description: string | null;
  default_usage_limits: string | null;
  preventive_checkup_months: number | null;
  suspension_grace_days: number;
  privacy_contact: string | null;
}

export interface CareDashboard {
  statusCounts: Partial<Record<CareContractStatus, number>>;
  devicesSold: number;
  contractsCreated: number;
  contractsSigned: number;
  firstInstallmentRevenue: number;
  recurringRevenue: number;
  contractedTotalActive: number;
  receivedTotalActive: number;
  overdueAmount: number;
  overdueCount: number;
  benefits: { pendentes: number; liberados: number; entregues: number; custoEntregue: number };
  serviceRequests: { abertos: number; concluidos: number; reprovados: number; receitaFranquias: number; custoReparos: number };
  byModel: Array<{ model: string; condition: CareCondition; contracts: number; active: number; contracted: number; received: number; serviceRequests: number }>;
}

export interface CareIssueResult {
  link: string;
  sessionId: string;
  documentVersion: number;
  documentSha256: string;
  sent: boolean;
  sendError: string | null;
}
