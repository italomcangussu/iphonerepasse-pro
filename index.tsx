import React from 'react';
import ReactDOM from 'react-dom/client';
import { MotionConfig, LazyMotion, domMax } from 'framer-motion';
import App from './App';
import { ThemeProvider } from './contexts/ThemeContext';
import { ToastProvider } from './components/ui/ToastProvider';
import { bindRuntimeBranding } from './lib/runtimeBranding';
import { setupPwa } from './services/pwa';
import UpdateBanner from './components/pwa/UpdateBanner';
import InstallPrompt from './components/pwa/InstallPrompt';
import './index.css';

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

bindRuntimeBranding();
setupPwa();

const root = ReactDOM.createRoot(rootElement);
root.render(
  <React.StrictMode>
    <ThemeProvider>
      {/* iOS 26 motion: respect prefers-reduced-motion globally for all framer-motion children. */}
      <MotionConfig reducedMotion="user">
        {/*
         * LazyMotion + domMax: includes drag (US-006), layout/layoutId
         * (US-011, US-018), and all gestures. ~25-30kb gzip vs ~45kb full.
         * Use the `m` component (not `motion`) inside the tree to benefit
         * from tree-shaking.
         */}
        <LazyMotion features={domMax} strict>
          <ToastProvider>
            <App />
            <UpdateBanner />
            <InstallPrompt />
          </ToastProvider>
        </LazyMotion>
      </MotionConfig>
    </ThemeProvider>
  </React.StrictMode>
);
