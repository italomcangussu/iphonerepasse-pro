import { useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';

/**
 * Abre um formulário quando a tela chega com `?<param>=1` (atalhos "Novo aparelho",
 * "Novo cliente") e limpa o parâmetro, para que voltar ou recarregar não reabra.
 */
export const useOpenFromQuery = (param: string, open: () => void, enabled = true) => {
  const [searchParams, setSearchParams] = useSearchParams();
  const requested = searchParams.get(param) === '1';

  useEffect(() => {
    if (!requested) return;
    if (enabled) open();
    const next = new URLSearchParams(searchParams);
    next.delete(param);
    setSearchParams(next, { replace: true });
    // `open` muda de identidade a cada render; o disparo depende só do parâmetro.
  }, [requested]);
};
