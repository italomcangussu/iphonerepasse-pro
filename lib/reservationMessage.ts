import { formatCurrencyBRL } from '../utils/inputMasks';
import { formatReservationDayBR } from '../utils/reservations';
import type { ReservationDepositPart, ReservationTradeIn } from '../types';

/**
 * Mensagem automática de confirmação de reserva.
 *
 * O usuário monta o texto no próprio modal de reserva, inserindo as variáveis por
 * BOTÕES (ele nunca precisa digitar `{{...}}`). Cada variável vira um marcador no
 * template e é resolvida contra a reserva que está sendo salva.
 *
 * Regra de linha vazia: se uma variável da linha não tiver valor naquela reserva
 * (sem sinal, sem validade, sem vendedor…), a LINHA INTEIRA é removida. É o que
 * evita mensagens como "Entrada recebida:  ()" quando a reserva não tem sinal.
 */

export interface ReservationMessageContext {
  customerName?: string | null;
  model?: string | null;
  capacity?: string | null;
  color?: string | null;
  sellPrice?: number | null;
  depositAmount?: number | null;
  depositPaymentMethod?: string | null;
  /** Sinais em formas diferentes; sem eles vale o par depositAmount/depositPaymentMethod. */
  depositParts?: ReservationDepositPart[] | null;
  tradeIn?: ReservationTradeIn | null;
  expiresAt?: string | null;
  storeName?: string | null;
  sellerName?: string | null;
}

export interface ReservationMessageVariable {
  /** Marcador gravado no template (o usuário não digita isso, o botão insere). */
  token: string;
  /** Rótulo do botão, em linguagem de negócio. */
  label: string;
  /** Ajuda curta exibida no `title` do botão. */
  hint: string;
  resolve: (context: ReservationMessageContext) => string;
}

const text = (value: unknown): string => String(value ?? '').trim();

const money = (value: number | null | undefined): string => (
  typeof value === 'number' && Number.isFinite(value) && value > 0 ? formatCurrencyBRL(value) : ''
);

const describeDevice = (context: ReservationMessageContext): string => (
  [text(context.model), text(context.capacity), text(context.color)].filter(Boolean).join(' ')
);

const positive = (value: unknown): number => {
  const amount = Number(value);
  return Number.isFinite(amount) && amount > 0 ? amount : 0;
};

const depositParts = (context: ReservationMessageContext): ReservationDepositPart[] => {
  const parts = context.depositParts?.length
    ? context.depositParts
    : [{ amount: positive(context.depositAmount), method: text(context.depositPaymentMethod) }];
  return parts.filter((part) => positive(part.amount) > 0);
};

const depositTotal = (context: ReservationMessageContext): number =>
  depositParts(context).reduce((total, part) => total + positive(part.amount), 0);

const depositMethods = (context: ReservationMessageContext): string =>
  [...new Set(depositParts(context).map((part) => text(part.method)).filter(Boolean))].join(' + ');

/** "R$ 500,00 (Pix) + R$ 300,00 (Dinheiro)" */
const describeDeposits = (context: ReservationMessageContext): string =>
  depositParts(context)
    .map((part) => [formatCurrencyBRL(positive(part.amount)), text(part.method) && `(${text(part.method)})`]
      .filter(Boolean).join(' '))
    .join(' + ');

const tradeInValue = (context: ReservationMessageContext): number => positive(context.tradeIn?.value);

const remainingAmount = (context: ReservationMessageContext): number | null => {
  const price = positive(context.sellPrice);
  if (price === 0) return null;
  return Math.max(price - depositTotal(context) - tradeInValue(context), 0);
};

export const RESERVATION_MESSAGE_VARIABLES: ReservationMessageVariable[] = [
  {
    token: 'cliente',
    label: 'Cliente',
    hint: 'Nome do cliente da reserva',
    resolve: (context) => text(context.customerName),
  },
  {
    token: 'aparelho',
    label: 'Aparelho',
    hint: 'Modelo, capacidade e cor juntos',
    resolve: describeDevice,
  },
  {
    token: 'modelo',
    label: 'Modelo',
    hint: 'Somente o modelo do aparelho',
    resolve: (context) => text(context.model),
  },
  {
    token: 'capacidade',
    label: 'Capacidade',
    hint: 'Capacidade do aparelho',
    resolve: (context) => text(context.capacity),
  },
  {
    token: 'cor',
    label: 'Cor',
    hint: 'Cor do aparelho',
    resolve: (context) => text(context.color),
  },
  {
    token: 'valor',
    label: 'Valor do aparelho',
    hint: 'Preço de venda do aparelho',
    resolve: (context) => money(context.sellPrice),
  },
  {
    token: 'sinal',
    label: 'Valor do sinal',
    hint: 'Soma dos sinais pagos na reserva',
    resolve: (context) => money(depositTotal(context)),
  },
  {
    token: 'forma_sinal',
    label: 'Forma do sinal',
    hint: 'Como o sinal foi pago (Pix, dinheiro…)',
    resolve: depositMethods,
  },
  {
    token: 'sinais',
    label: 'Sinais detalhados',
    hint: 'Cada sinal com a sua forma: R$ 500,00 (Pix) + R$ 300,00 (Dinheiro)',
    resolve: describeDeposits,
  },
  {
    token: 'troca',
    label: 'Aparelho da troca',
    hint: 'Aparelho que o cliente deixa na troca',
    resolve: (context) => text(context.tradeIn?.description),
  },
  {
    token: 'valor_troca',
    label: 'Valor da troca',
    hint: 'Quanto a loja paga pelo aparelho da troca',
    resolve: (context) => money(tradeInValue(context)),
  },
  {
    token: 'restante',
    label: 'Valor restante',
    hint: 'Preço de venda menos os sinais e a troca',
    resolve: (context) => money(remainingAmount(context)),
  },
  {
    token: 'validade',
    label: 'Validade',
    hint: 'Data até quando o aparelho fica reservado',
    resolve: (context) => formatReservationDayBR(context.expiresAt) || '',
  },
  {
    token: 'loja',
    label: 'Loja',
    hint: 'Nome da loja',
    resolve: (context) => text(context.storeName),
  },
  {
    token: 'vendedor',
    label: 'Vendedor',
    hint: 'Vendedor responsável pela reserva',
    resolve: (context) => text(context.sellerName),
  },
];

const VARIABLES_BY_TOKEN = new Map(
  RESERVATION_MESSAGE_VARIABLES.map((variable) => [variable.token, variable])
);

export const DEFAULT_RESERVATION_MESSAGE_TEMPLATE = [
  'Olá {{cliente}}! Sua reserva do {{aparelho}} foi concluída. ✅',
  'Entrada recebida: {{sinais}}',
  'Seu {{troca}} na troca: {{valor_troca}}',
  'Valor restante: {{restante}}',
  'Separamos o aparelho para você até {{validade}}.',
  'Qualquer dúvida, é só chamar por aqui. 😉',
].join('\n');

export const buildReservationMessageToken = (token: string): string => `{{${token}}}`;

const TOKEN_PATTERN = /\{\{\s*([a-z0-9_]+)\s*\}\}/gi;

/**
 * Resolve o template contra a reserva. Linhas cujas variáveis não tiverem valor
 * são descartadas (ver comentário no topo do arquivo).
 */
export const renderReservationMessage = (
  template: string,
  context: ReservationMessageContext
): string => {
  const lines = String(template ?? '').split('\n');

  const rendered = lines.reduce<string[]>((accumulator, line) => {
    let dropLine = false;

    const resolvedLine = line.replace(TOKEN_PATTERN, (_match, rawToken: string) => {
      const variable = VARIABLES_BY_TOKEN.get(String(rawToken).toLowerCase());
      if (!variable) return '';
      const value = variable.resolve(context);
      if (!value) dropLine = true;
      return value;
    });

    if (dropLine) return accumulator;
    accumulator.push(resolvedLine.replace(/[ \t]+/g, ' ').trimEnd());
    return accumulator;
  }, []);

  return rendered
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
};
