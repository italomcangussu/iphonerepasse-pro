import React from 'react';
import { m, AnimatePresence } from 'framer-motion';
import { WifiOff } from 'lucide-react';
import { useOnlineStatus } from '../../hooks/useOnlineStatus';

export default function OfflineBanner() {
  const online = useOnlineStatus();

  return (
    <AnimatePresence>
      {!online && (
        <m.div
          initial={{ y: -48, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: -48, opacity: 0 }}
          transition={{ type: 'spring', stiffness: 400, damping: 35 }}
          className="fixed inset-x-0 top-0 z-50 flex items-center justify-center gap-2 px-4 py-2 bg-amber-500 text-white text-sm font-medium shadow-md"
          style={{ paddingTop: 'calc(env(safe-area-inset-top, 0px) + 0.5rem)' }}
          role="status"
          aria-live="polite"
        >
          <WifiOff className="w-4 h-4 flex-shrink-0" aria-hidden="true" />
          <span>Você está offline — exibindo dados em cache</span>
        </m.div>
      )}
    </AnimatePresence>
  );
}
