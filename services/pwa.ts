/**
 * PWA service worker registration and lifecycle management.
 *
 * Exposes a small reactive store so UI components can react to:
 *   - update available  → show "Reload to update" banner
 *   - controller change → reload page once the new SW takes over
 *   - install state     → show "Add to Home Screen" prompt
 */

type Listener = () => void;

export interface PwaState {
  registration: ServiceWorkerRegistration | null;
  updateAvailable: boolean;
  isStandalone: boolean;
  isIOS: boolean;
  installPromptEvent: BeforeInstallPromptEvent | null;
  /** True once setup() has run and computed installability. */
  ready: boolean;
}

interface BeforeInstallPromptEvent extends Event {
  readonly platforms: string[];
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
}

const state: PwaState = {
  registration: null,
  updateAvailable: false,
  isStandalone: false,
  isIOS: false,
  installPromptEvent: null,
  ready: false,
};

const listeners = new Set<Listener>();
const AUTO_RELOAD_BLOCK_KEY = 'iphonerepasse:pwa:auto-reload-blocked';

// Guards the one-shot reload performed when a new service worker takes control.
let swReloading = false;
let pwaAutoReloadBlocked = false;

function emit() {
  listeners.forEach((fn) => {
    try { fn(); } catch (_) { /* no-op */ }
  });
}

export function subscribePwa(fn: Listener): () => void {
  listeners.add(fn);
  return () => { listeners.delete(fn); };
}

export function getPwaState(): PwaState {
  return state;
}

export function detectStandalone(): boolean {
  if (typeof window === 'undefined') return false;
  const navStandalone = (window.navigator as Navigator & { standalone?: boolean }).standalone === true;
  const mql = window.matchMedia?.('(display-mode: standalone)').matches === true;
  return navStandalone || mql;
}

export function detectIOS(): boolean {
  if (typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent || '';
  // iPadOS 13+ reports as Mac; double-check via touch points.
  const isIPadOS = ua.includes('Macintosh') && (navigator.maxTouchPoints || 0) > 1;
  return /iPad|iPhone|iPod/.test(ua) || isIPadOS;
}

export async function applyUpdate(): Promise<void> {
  const reg = state.registration;
  const waiting = reg?.waiting;
  if (!waiting) {
    if (state.updateAvailable && typeof window !== 'undefined') {
      window.location.reload();
    }
    return;
  }
  // Tell the waiting worker to take over; the global controllerchange listener
  // (registered in setupPwa) performs the one-shot reload.
  waiting.postMessage({ type: 'SKIP_WAITING' });
}

export function setPwaAutoReloadBlocked(blocked: boolean): void {
  pwaAutoReloadBlocked = blocked;
  try {
    if (typeof window === 'undefined' || !window.sessionStorage) return;
    if (blocked) window.sessionStorage.setItem(AUTO_RELOAD_BLOCK_KEY, '1');
    else window.sessionStorage.removeItem(AUTO_RELOAD_BLOCK_KEY);
  } catch (_) {
    // sessionStorage can be unavailable in private/locked-down contexts.
  }
}

export function isPwaAutoReloadBlocked(): boolean {
  if (pwaAutoReloadBlocked) return true;
  try {
    return typeof window !== 'undefined' && window.sessionStorage?.getItem(AUTO_RELOAD_BLOCK_KEY) === '1';
  } catch (_) {
    return false;
  }
}

export function handleServiceWorkerControllerChange(
  reload: () => void = () => window.location.reload()
): 'deferred' | 'ignored' | 'reloaded' {
  if (swReloading) return 'ignored';
  if (isPwaAutoReloadBlocked()) {
    state.updateAvailable = true;
    emit();
    return 'deferred';
  }
  swReloading = true;
  reload();
  return 'reloaded';
}

export async function promptInstall(): Promise<'accepted' | 'dismissed' | 'unavailable'> {
  const evt = state.installPromptEvent;
  if (!evt) return 'unavailable';
  try {
    await evt.prompt();
    const choice = await evt.userChoice;
    state.installPromptEvent = null;
    emit();
    return choice.outcome;
  } catch (_) {
    return 'dismissed';
  }
}

export function setupPwa(): void {
  if (typeof window === 'undefined') return;

  state.isStandalone = detectStandalone();
  state.isIOS = detectIOS();
  state.ready = true;

  // Track display-mode changes (Apple may switch when user enters/exits standalone).
  try {
    window.matchMedia('(display-mode: standalone)').addEventListener?.('change', (e) => {
      state.isStandalone = e.matches;
      emit();
    });
  } catch (_) { /* old Safari */ }

  // Capture install prompt (Chromium/Edge — iOS Safari does not fire this).
  window.addEventListener('beforeinstallprompt', (event: Event) => {
    event.preventDefault();
    state.installPromptEvent = event as BeforeInstallPromptEvent;
    emit();
  });

  window.addEventListener('appinstalled', () => {
    state.installPromptEvent = null;
    emit();
  });

  if (!('serviceWorker' in navigator)) {
    emit();
    return;
  }

  // Only register in production (avoid stale SW interfering with Vite HMR).
  if (import.meta.env?.DEV) {
    emit();
    return;
  }

  // When a new service worker takes control (e.g. after a deploy + skipWaiting),
  // reload once so the page runs the freshly cached bundle. Guarded so it cannot
  // loop. This is what lets an installed iOS PWA pick up new code on relaunch
  // without the user manually clearing it.
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    handleServiceWorkerControllerChange();
  });

  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register('/sw.js', { scope: '/', updateViaCache: 'none' })
      .then((registration) => {
        state.registration = registration;

        // Already-waiting worker on load.
        if (registration.waiting && navigator.serviceWorker.controller) {
          state.updateAvailable = true;
          emit();
        }

        registration.addEventListener('updatefound', () => {
          const installing = registration.installing;
          if (!installing) return;
          installing.addEventListener('statechange', () => {
            if (installing.state === 'installed' && navigator.serviceWorker.controller) {
              state.updateAvailable = true;
              emit();
            }
          });
        });

        // Listen for messages from SW (e.g. NAVIGATE on notification click).
        navigator.serviceWorker.addEventListener('message', (event) => {
          const data = event.data || {};
          if (data.type === 'NAVIGATE' && typeof data.url === 'string') {
            try {
              const url = new URL(data.url, window.location.origin);
              // HashRouter: preserve hash routing.
              if (url.hash) window.location.hash = url.hash;
              else if (url.pathname !== window.location.pathname) window.location.href = url.toString();
            } catch (_) { /* ignore */ }
          }
        });

        // Re-check for updates when the tab becomes visible.
        document.addEventListener('visibilitychange', () => {
          if (document.visibilityState === 'visible') {
            registration.update().catch(() => {});
          }
        });

        emit();
      })
      .catch((err) => {
        console.warn('[pwa] sw registration failed', err);
        emit();
      });
  });
}
