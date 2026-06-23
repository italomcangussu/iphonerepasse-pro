import React, { useEffect, useState } from 'react';
import { m, AnimatePresence, useReducedMotion } from 'framer-motion';
import { RefreshCw, X } from 'lucide-react';
import { applyUpdate, getPwaState, subscribePwa } from '../../services/pwa';

const UpdateBanner: React.FC = () => {
  const [visible, setVisible] = useState(getPwaState().updateAvailable);
  const [dismissed, setDismissed] = useState(false);
  const reducedMotion = useReducedMotion();

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
          initial={reducedMotion ? false : { y: 80, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={reducedMotion ? { opacity: 0 } : { y: 80, opacity: 0 }}
          transition={reducedMotion ? { duration: 0.01 } : { type: 'spring', stiffness: 320, damping: 30 }}
          role="status"
          aria-live="polite"
          className="fixed left-1/2 z-[60] flex w-[min(92vw,28rem)] -translate-x-1/2 items-center gap-3 rounded-2xl border border-slate-200 bg-white/95 px-4 py-3 shadow-xl backdrop-blur-md dark:border-slate-700 dark:bg-slate-900/95 bottom-[calc(env(safe-area-inset-bottom,0px)+50px+1rem)] xl:bottom-[calc(env(safe-area-inset-bottom,0px)+1rem)]"
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
            className="hit-target-44 inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
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
