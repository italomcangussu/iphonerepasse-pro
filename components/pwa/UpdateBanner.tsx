import React, { useEffect, useState } from 'react';
import { m, AnimatePresence } from 'framer-motion';
import { RefreshCw, X } from 'lucide-react';
import { applyUpdate, getPwaState, subscribePwa } from '../../services/pwa';

const UpdateBanner: React.FC = () => {
  const [visible, setVisible] = useState(getPwaState().updateAvailable);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    const unsubscribe = subscribePwa(() => {
      setVisible(getPwaState().updateAvailable);
    });
    return unsubscribe;
  }, []);

  const show = visible && !dismissed;

  return (
    <AnimatePresence>
      {show && (
        <m.div
          initial={{ y: 80, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 80, opacity: 0 }}
          transition={{ type: 'spring', stiffness: 320, damping: 30 }}
          role="status"
          aria-live="polite"
          className="fixed left-1/2 z-[60] flex w-[min(92vw,28rem)] -translate-x-1/2 items-center gap-3 rounded-2xl border border-slate-200 bg-white/95 px-4 py-3 shadow-xl backdrop-blur-md dark:border-slate-700 dark:bg-slate-900/95"
          style={{ bottom: 'calc(env(safe-area-inset-bottom, 0px) + 1rem)' }}
        >
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand-600 text-white">
            <RefreshCw size={16} />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-slate-900 dark:text-slate-50">Nova versão disponível</p>
            <p className="text-xs text-slate-500 dark:text-slate-400">Recarregue para aplicar as melhorias.</p>
          </div>
          <button
            type="button"
            onClick={() => { void applyUpdate(); }}
            className="inline-flex h-9 shrink-0 items-center justify-center rounded-full bg-slate-900 px-3 text-xs font-semibold text-white shadow-sm hover:bg-slate-800 active:scale-[0.98] dark:bg-white dark:text-slate-900 dark:hover:bg-slate-100"
          >
            Atualizar
          </button>
          <button
            type="button"
            onClick={() => setDismissed(true)}
            className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
            aria-label="Dispensar"
          >
            <X size={14} />
          </button>
        </m.div>
      )}
    </AnimatePresence>
  );
};

export default UpdateBanner;
