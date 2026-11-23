type ErrorLike = { message?: string; code?: string; status?: number | string; statusCode?: number | string };

const asErrorLike = (error: unknown): ErrorLike =>
  error && typeof error === 'object' ? (error as ErrorLike) : { message: String(error ?? '') };

const statusOf = (error: ErrorLike): number => Number(error.status ?? error.statusCode ?? 0);

const NETWORK_PATTERN = /failed to fetch|networkerror|network request failed|load failed/i;
const PERMISSION_PATTERN = /row-level security|permission denied|not authorized|unauthorized/i;
const SESSION_PATTERN = /jwt expired|invalid jwt|refresh token/i;
const TOO_LARGE_PATTERN = /payload too large|exceeded the maximum allowed size|entity too large/i;

/**
 * Traduz uma falha técnica (rede, permissão, sessão, arquivo grande) para
 * uma mensagem de gente. Mensagem levantada de propósito pelo banco
 * (`raise exception`, código P0001) já é de negócio e passa como está.
 * O detalhe técnico vai para o console, não para a tela.
 */
export const toFriendlyErrorMessage = (error: unknown, fallback: string): string => {
  const err = asErrorLike(error);
  const message = err.message ?? '';
  const status = statusOf(err);

  if (err.code === 'P0001' && message) return message;

  console.error(error);

  if (NETWORK_PATTERN.test(message)) return 'Sem conexão com o servidor. Confira a internet e tente de novo.';
  if (SESSION_PATTERN.test(message)) return 'Sua sessão expirou. Entre de novo para continuar.';
  if (err.code === '42501' || status === 401 || status === 403 || PERMISSION_PATTERN.test(message)) {
    return 'Você não tem permissão para fazer isso.';
  }
  if (status === 413 || TOO_LARGE_PATTERN.test(message)) return 'O arquivo é grande demais (máx. 10 MB).';
  return fallback;
};
