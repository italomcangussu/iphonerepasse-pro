import React, { useEffect, useMemo, useState } from 'react';
import { m, AnimatePresence } from 'framer-motion';
import { Plus, Share, Smartphone, X } from 'lucide-react';
import { getPwaState, promptInstall, subscribePwa } from '../../services/pwa';

const DISMISSED_KEY = 'pwa.install.dismissed.at';
const DISMISS_WINDOW_MS = 14 * 24 * 60 * 60 * 1000; // re-prompt after 14 days
const MIN_VISITS_KEY = 'pwa.install.visits';
const MIN_VISITS = 2;

function incrementVisits(): number {
  try {
    const raw = window.localStorage.getItem(MIN_VISITS_KEY);
    const n = (raw ? parseInt(raw, 10) : 0) + 1;
    window.localStorage.setItem(MIN_VISITS_KEY, String(n));
    return n;
  } catch (_) { return MIN_VISITS; }
}

function wasRecentlyDismissed(): boolean {
  try {
    const raw = window.localStorage.getItem(DISMISSED_KEY);
    if (!raw) return false;
    const ts = parseInt(raw, 10);
    if (!Number.isFinite(ts)) return false;
    return Date.now() - ts < DISMISS_WINDOW_MS;
  } catch (_) { return false; }
}

function markDismissed(): void {
  try { window.localStorage.setItem(DISMISSED_KEY, String(Date.now())); } catch (_) { /* ignore */ }
}

const InstallPrompt: React.FC = () => {
  const [pwa, setPwa] = useState(getPwaState());
  const [open, setOpen] = useState(false);
  const [visits, setVisits] = useState(0);

  useEffect(() => {
    setVisits(incrementVisits());
    const unsubscribe = subscribePwa(() => setPwa({ ...getPwaState() }));
    return unsubscribe;
  }, []);

  // Show only when:
  //  - app is not already installed (standalone)
  //  - user has visited at least MIN_VISITS times
  //  - not recently dismissed
  //  - either iOS Safari OR we captured a beforeinstallprompt event
  const eligible = useMemo(() => {
    if (!pwa.ready) return false;
    if (pwa.isStandalone) return false;
    if (visits < MIN_VISITS) return false;
    if (wasRecentlyDismissed()) return false;
    if (pwa.isIOS) return true;
    return Boolean(pwa.installPromptEvent);
  }, [pwa, visits]);

  useEffect(() => {
    if (!eligible) { setOpen(false); return; }
    const t = setTimeout(() => setOpen(true), 1200);
    return () => clearTimeout(t);
  }, [eligible]);

  const close = () => { markDismissed(); setOpen(false); };

  const handleNativeInstall = async () => {
    const outcome = await promptInstall();
    if (outcome !== 'unavailable') close();
  };

  if (!eligible) return null;

  return (
    <AnimatePresence>
      {open && (
        <>
          <m.button
            type="button"
            aria-label="Fechar"
            className="fixed inset-0 z-[55] bg-slate-950/30 backdrop-blur-[1px]"
            onClick={close}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          />
          <m.div
            role="dialog"
            aria-modal="true"
            aria-labelledby="pwa-install-title"
            className="fixed inset-x-0 z-[56] mx-auto max-w-md rounded-t-2xl border border-slate-200 bg-white p-5 shadow-2xl dark:border-slate-800 dark:bg-slate-950 sm:rounded-2xl"
            style={{
              bottom: 0,
              paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 1.25rem)',
            }}
            initial={{ y: 60, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 60, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 320, damping: 30 }}
          >
            <div className="flex items-start gap-3">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-brand-500 to-brand-700 text-white shadow-md shadow-brand-500/30">
                <Smartphone size={20} />
              </div>
              <div className="min-w-0 flex-1">
                <h3 id="pwa-install-title" className="text-base font-bold text-slate-900 dark:text-slate-50">
                  Instalar iPhoneRepasse Pro
                </h3>
                <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                  Acesso rápido, modo offline e notificações ficam disponíveis após instalar.
                </p>
              </div>
              <button
                type="button"
                onClick={close}
                className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
                aria-label="Fechar"
              >
                <X size={16} />
              </button>
            </div>

            {pwa.isIOS ? (
              <div className="mt-4 space-y-3 rounded-xl bg-slate-50 p-3 text-xs text-slate-600 dark:bg-slate-900 dark:text-slate-300">
                <div className="flex items-start gap-2">
                  <span className="mt-0.5 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-white text-slate-700 shadow-sm dark:bg-slate-800 dark:text-slate-200">
                    <Share size={13} />
                  </span>
                  <p>
                    Toque em <span className="font-semibold">Compartilhar</span> na barra do Safari.
                  </p>
                </div>
                <div className="flex items-start gap-2">
                  <span className="mt-0.5 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-white text-slate-700 shadow-sm dark:bg-slate-800 dark:text-slate-200">
                    <Plus size={13} />
                  </span>
                  <p>
                    Escolha <span className="font-semibold">Adicionar à Tela de Início</span> e confirme.
                  </p>
                </div>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => { void handleNativeInstall(); }}
                className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-full bg-brand-600 px-4 py-3 text-sm font-semibold text-white shadow-sm shadow-brand-600/20 hover:bg-brand-700 active:scale-[0.99]"
              >
                <Plus size={16} /> Instalar agora
              </button>
            )}

            <button
              type="button"
              onClick={close}
              className="mt-3 w-full text-center text-xs font-medium text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
            >
              Mais tarde
            </button>
          </m.div>
        </>
      )}
    </AnimatePresence>
  );
};

export default InstallPrompt;
