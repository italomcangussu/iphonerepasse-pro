import { formatCurrencyBRL } from '../utils/inputMasks';
import { formatReservationDayBR } from '../utils/reservations';

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

const remainingAmount = (context: ReservationMessageContext): number | null => {
  const price = typeof context.sellPrice === 'number' && Number.isFinite(context.sellPrice)
    ? context.sellPrice
    : null;
  if (price === null || price <= 0) return null;
  const deposit = typeof context.depositAmount === 'number' && Number.isFinite(context.depositAmount)
    ? Math.max(context.depositAmount, 0)
    : 0;
  return Math.max(price - deposit, 0);
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
    hint: 'Entrada paga na reserva',
    resolve: (context) => money(context.depositAmount),
  },
  {
    token: 'forma_sinal',
    label: 'Forma do sinal',
    hint: 'Como o sinal foi pago (Pix, dinheiro…)',
    resolve: (context) => (money(context.depositAmount) ? text(context.depositPaymentMethod) : ''),
  },
  {
    token: 'restante',
    label: 'Valor restante',
    hint: 'Preço de venda menos o sinal',
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
  'Entrada recebida: {{sinal}} ({{forma_sinal}})',
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
