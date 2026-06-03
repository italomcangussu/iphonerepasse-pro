import React from 'react';
import { createRoot } from 'react-dom/client';
import { HashRouter } from 'react-router-dom';
import { MotionConfig, LazyMotion, domMax } from 'framer-motion';
import '../index.css';
import PDV from '../pages/PDV';

/**
 * Faithful reproduction of the app shell (components/Layout.tsx) so the
 * sticky-stepper / header interaction renders exactly as in production,
 * but without the auth/data/nav machinery. Mobile header is `sticky top-0
 * z-20` and the window is the scroller below `xl` — identical to Layout.
 */
const Shell: React.FC = () => (
  <div className="flex h-full min-h-screen bg-surface-light-100 dark:bg-surface-dark-50">
    <div className="flex-1 flex flex-col min-w-0 max-w-full overflow-x-clip relative xl:h-full xl:overflow-y-hidden">
      {/* Mobile/tablet header — Layout.tsx:333 */}
      <header className="xl:hidden sticky top-0 h-[calc(52px+env(safe-area-inset-top,0px))] liquid-glass-thin border-b border-gray-200/40 dark:border-surface-dark-200/40 flex items-center justify-between px-3 sm:px-4 z-20 safe-area-top">
        <div className="flex items-center gap-2 min-w-0 flex-1 pr-2">
          <div className="w-8 h-8 rounded-ios bg-gray-50 border border-gray-200 flex items-center justify-center shrink-0 text-brand-500 font-bold">iR</div>
          <h1 className="min-w-0 text-[clamp(13px,4.2vw,17px)] font-semibold text-gray-900 dark:text-white tracking-tight whitespace-nowrap leading-none">
            iPhone<span className="text-brand-500">Repasse</span>
          </h1>
        </div>
      </header>

      {/* Desktop header — Layout.tsx:366 */}
      <header className="hidden xl:flex h-12 liquid-glass-thin border-b border-gray-200/40 dark:border-surface-dark-200/40 items-center justify-between px-6 z-10">
        <h1 className="text-sm font-bold tracking-tight text-gray-900 dark:text-white truncate">PDV</h1>
      </header>

      {/* main — Layout.tsx:466 */}
      <main className="flex-1 min-w-0 max-w-full overflow-x-clip xl:overflow-y-auto bg-surface-light-100 dark:bg-surface-dark-50 relative" style={{ overscrollBehaviorY: 'contain' }}>
        <div className="px-4 pt-2 pb-[calc(8rem+env(safe-area-inset-bottom,0px))] md:px-6 md:pt-3 xl:px-8 xl:pt-4 xl:pb-8">
          <PDV />
        </div>
      </main>
    </div>
  </div>
);

createRoot(document.getElementById('root')!).render(
  <MotionConfig reducedMotion="user">
    <LazyMotion features={domMax} strict>
      <HashRouter>
        <Shell />
      </HashRouter>
    </LazyMotion>
  </MotionConfig>
);
