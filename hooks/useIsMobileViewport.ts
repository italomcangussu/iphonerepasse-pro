import { useEffect, useState } from 'react';

const supportsMatchMedia = () =>
  typeof window !== 'undefined' && typeof window.matchMedia === 'function';

const getIsMobile = (maxWidth: number) => {
  if (!supportsMatchMedia()) return false;
  return window.matchMedia(`(max-width: ${maxWidth}px)`).matches;
};

export function useIsMobileViewport(maxWidth = 767): boolean {
  const [isMobile, setIsMobile] = useState(() => getIsMobile(maxWidth));

  useEffect(() => {
    if (!supportsMatchMedia()) return;

    const mql = window.matchMedia(`(max-width: ${maxWidth}px)`);
    const onChange = (event: MediaQueryListEvent) => setIsMobile(event.matches);
    setIsMobile(mql.matches);

    if (mql.addEventListener) {
      mql.addEventListener('change', onChange);
      return () => mql.removeEventListener('change', onChange);
    }

    mql.addListener(onChange);
    return () => mql.removeListener(onChange);
  }, [maxWidth]);

  return isMobile;
}

