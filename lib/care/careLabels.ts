import type {
  CareCondition,
  CareContractStatus,
  CareDeductibleModality,
  CareInstallment,
  CareRuleSource,
  CareServiceRequestStatus,
} from './careTypes';

export type CareTone = 'neutral' | 'info' | 'warning' | 'success' | 'danger';

export const CARE_CONTRACT_STATUS: Record<CareContractStatus, { label: string; tone: CareTone; hint: string }> = {
  rascunho: { label: 'Rascunho', tone: 'neutral', hint: 'Contrato criado; o link de assinatura ainda não foi enviado.' },
  aguardando_assinatura: { label: 'Aguardando assinatura', tone: 'info', hint: 'Link enviado ao cliente pelo WhatsApp.' },
  assinado_aguardando_primeiro_pagamento: {
    label: 'Assinado · aguardando 1ª parcela',
    tone: 'warning',
    hint: 'Confirme o pagamento da 1ª parcela para ativar e liberar o bônus.',
  },
  ativo: { label: 'Ativo', tone: 'success', hint: 'Assinado e com a 1ª parcela confirmada.' },
  assinatura_expirada: { label: 'Assinatura expirada', tone: 'neutral', hint: 'O cliente não assinou no prazo.' },
  assinatura_recusada: { label: 'Assinatura recusada', tone: 'neutral', hint: 'O cliente recusou o contrato.' },
  suspenso: { label: 'Suspenso por atraso', tone: 'warning', hint: 'Sem acionamentos. Reativa com o atraso quitado e vistoria do aparelho.' },
  encerrado: { label: 'Encerrado', tone: 'neutral', hint: 'Vigência concluída.' },
  cancelado: { label: 'Cancelado', tone: 'danger', hint: 'Contrato cancelado; parcelas futuras canceladas.' },
};

export const CARE_SERVICE_STATUS: Record<CareServiceRequestStatus, { label: string; tone: CareTone }> = {
  solicitado: { label: 'Solicitado', tone: 'info' },
  em_analise: { label: 'Em análise', tone: 'info' },
  aprovado: { label: 'Aprovado', tone: 'success' },
  reprovado: { label: 'Reprovado', tone: 'danger' },
  em_execucao: { label: 'Em execução', tone: 'warning' },
  concluido: { label: 'Concluído', tone: 'success' },
  cancelado: { label: 'Cancelado', tone: 'neutral' },
};

// Próximos passos permitidos a partir de cada status (o banco valida de novo).
export const CARE_SERVICE_NEXT: Record<CareServiceRequestStatus, CareServiceRequestStatus[]> = {
  solicitado: ['em_analise', 'aprovado', 'reprovado', 'cancelado'],
  em_analise: ['aprovado', 'reprovado', 'cancelado'],
  aprovado: ['em_execucao', 'concluido', 'cancelado'],
  reprovado: [],
  em_execucao: ['concluido', 'cancelado'],
  concluido: [],
  cancelado: [],
};

export const CARE_TONE_CLASS: Record<CareTone, string> = {
  neutral: 'bg-gray-100 text-gray-700 dark:bg-surface-dark-200 dark:text-surface-dark-700',
  info: 'bg-blue-50 text-blue-700 dark:bg-blue-500/15 dark:text-blue-300',
  warning: 'bg-amber-50 text-amber-800 dark:bg-amber-500/15 dark:text-amber-300',
  success: 'bg-green-50 text-green-700 dark:bg-green-500/15 dark:text-green-300',
  danger: 'bg-red-50 text-red-700 dark:bg-red-500/15 dark:text-red-300',
};

export const conditionLabel = (condition: CareCondition | null | undefined): string =>
  condition === 'NOVO' ? 'Novo' : condition === 'SEMINOVO' ? 'Seminovo' : 'Sem condição';

export const ruleSourceLabel = (source: CareRuleSource | null | undefined): string =>
  source === 'MODELO_CONDICAO' ? 'regra específica do modelo' : source === 'CONDICAO' ? 'regra geral da condição' : '—';

export const deductibleModalityLabel = (modality: CareDeductibleModality | null | undefined): string =>
  modality === 'PERCENTUAL' ? 'percentual do preço de venda' : modality === 'VALOR_FIXO' ? 'valor fixo' : '—';

const SIGNATURE_EVENT_LABELS: Record<string, string> = {
  documento_emitido: 'Documento emitido',
  sessao_criada: 'Sessão de assinatura criada',
  link_enviado: 'Link enviado pelo WhatsApp',
  link_envio_falhou: 'Falha no envio do link',
  link_aberto: 'Link aberto pelo cliente',
  documento_visualizado: 'Contrato completo visualizado',
  aceite_registrado: 'Aceite expresso registrado',
  otp_enviado: 'Código enviado pelo WhatsApp',
  otp_envio_falhou: 'Falha no envio do código',
  otp_invalido: 'Código incorreto',
  otp_expirado: 'Código expirado',
  otp_validado: 'Código validado',
  sessao_bloqueada: 'Sessão bloqueada (tentativas)',
  sessao_expirada: 'Link expirado',
  contrato_assinado: 'Contrato assinado',
  artefatos_gerados: 'PDF assinado e dossiê gerados',
  artefatos_falharam: 'Falha ao gerar PDF assinado',
  copia_enviada: 'Cópia enviada ao cliente',
  copia_envio_falhou: 'Falha no envio da cópia',
  documento_exportado: 'Documento exportado',
  integridade_verificada: 'Integridade verificada',
  contrato_cancelado: 'Contrato cancelado',
  contrato_suspenso: 'Contrato suspenso por atraso',
  contrato_reativado: 'Contrato reativado após vistoria',
};

export const signatureEventLabel = (type: string): string => SIGNATURE_EVENT_LABELS[type] ?? type;

export const isInstallmentOverdue = (installment: CareInstallment, today: string): boolean =>
  installment.status === 'programada' && !!installment.due_date && installment.due_date < today;

export const nextPayableInstallment = (installments: CareInstallment[]): CareInstallment | null =>
  [...installments].sort((a, b) => a.sequence_number - b.sequence_number).find((i) => i.status === 'programada') ?? null;

export const paidTotal = (installments: CareInstallment[]): number =>
  installments.filter((i) => i.status === 'paga').reduce((sum, i) => sum + Number(i.amount), 0);

// Condição comercial a partir do estoque (Novo/Seminovo); nunca infere pelo nome do produto.
export const careConditionFromStock = (condition: string | null | undefined): CareCondition | null => {
  const normalized = (condition ?? '').trim().toLowerCase();
  if (normalized === 'novo') return 'NOVO';
  if (normalized === 'seminovo') return 'SEMINOVO';
  return null;
};
