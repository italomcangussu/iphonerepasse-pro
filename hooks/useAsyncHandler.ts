import { useCallback } from 'react';
import { useToast } from '../components/ui/ToastProvider';

type AsyncHandlerOptions = {
  errorMsg?: string;
  setLoading?: (v: boolean) => void;
};

/**
 * Returns a `run` helper that wraps an async fn in try/catch, shows a toast.error
 * on failure, and optionally manages a loading boolean.
 *
 * Usage:
 *   const run = useAsyncHandler();
 *   await run(async () => { await save(); toast.success('Saved!'); closeModal(); }, {
 *     errorMsg: 'Could not save.',
 *     setLoading: setIsSaving,
 *   });
 */
export function useAsyncHandler() {
  const toast = useToast();

  return useCallback(
    async <T>(
      fn: () => Promise<T>,
      opts?: string | AsyncHandlerOptions,
    ): Promise<T | null> => {
      const options: AsyncHandlerOptions =
        typeof opts === 'string' ? { errorMsg: opts } : (opts ?? {});

      options.setLoading?.(true);
      try {
        return await fn();
      } catch (err: unknown) {
        const msg =
          err instanceof Error
            ? err.message
            : typeof err === 'string'
              ? err
              : (options.errorMsg ?? 'Erro inesperado');
        toast.error(msg || options.errorMsg || 'Erro inesperado');
        return null;
      } finally {
        options.setLoading?.(false);
      }
    },
    [toast],
  );
}
