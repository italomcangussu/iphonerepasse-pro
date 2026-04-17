const NETWORK_ERROR_PATTERNS = [
  /failed to fetch/i,
  /networkerror/i,
  /load failed/i,
  /err_name_not_resolved/i,
];

const getErrorMessage = (error: unknown): string => {
  if (error instanceof Error) return error.message || '';
  if (typeof error === 'string') return error;
  return '';
};

const isNetworkAuthError = (error: unknown): boolean => {
  if (error instanceof TypeError) return true;
  const message = getErrorMessage(error);
  return NETWORK_ERROR_PATTERNS.some((pattern) => pattern.test(message));
};

const extractHostname = (url: string): string | null => {
  if (!url) return null;
  try {
    return new URL(url).hostname || null;
  } catch {
    return null;
  }
};

export const normalizeAuthError = (error: unknown, authUrl: string): Error => {
  if (isNetworkAuthError(error)) {
    const hostname = extractHostname(authUrl);
    const hostSuffix = hostname ? ` (${hostname})` : '';
    return new Error(
      `Falha de conexão com o servidor de autenticação${hostSuffix}. Verifique DNS/internet e tente novamente.`
    );
  }

  if (error instanceof Error && error.message.trim()) {
    return error;
  }

  return new Error('Não foi possível entrar.');
};
