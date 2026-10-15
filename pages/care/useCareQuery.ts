import { type DependencyList, useCallback, useEffect, useState } from 'react';

export interface CareQueryState<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
  reload: () => void;
}

// Leitura assíncrona simples com recarga manual; ignora respostas de buscas antigas.
export function useCareQuery<T>(fetcher: () => Promise<T>, deps: DependencyList): CareQueryState<T> {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [version, setVersion] = useState(0);
  const run = useCallback(fetcher, deps);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    run()
      .then((result) => !cancelled && setData(result))
      .catch((e: Error) => !cancelled && setError(e.message || 'Não foi possível carregar.'))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [run, version]);

  return { data, loading, error, reload: () => setVersion((v) => v + 1) };
}
