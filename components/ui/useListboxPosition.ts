import { useCallback, useLayoutEffect, useState, type RefObject } from 'react';
import { computeListboxPosition, readVisibleArea, type ListboxPosition } from './comboboxPosition';

const INITIAL_POSITION: ListboxPosition = {
  left: 0,
  width: 0,
  anchorTop: 0,
  maxHeight: 240,
  openUp: false,
};

/**
 * Keeps a portaled listbox next to its trigger while `isOpen`. The visual
 * viewport fires on its own when the on-screen keyboard opens or the page is
 * panned, without any window scroll/resize.
 */
export const useListboxPosition = (triggerRef: RefObject<HTMLElement | null>, isOpen: boolean): ListboxPosition => {
  const [position, setPosition] = useState<ListboxPosition>(INITIAL_POSITION);

  const update = useCallback(() => {
    const trigger = triggerRef.current;
    if (!trigger || typeof window === 'undefined') return;
    setPosition(
      computeListboxPosition({
        trigger: trigger.getBoundingClientRect(),
        visible: readVisibleArea(),
        scroll: { x: window.scrollX, y: window.scrollY },
      })
    );
  }, [triggerRef]);

  useLayoutEffect(() => {
    if (!isOpen) return;
    update();
    const visualViewport = window.visualViewport;
    window.addEventListener('scroll', update, true);
    window.addEventListener('resize', update);
    visualViewport?.addEventListener('resize', update);
    visualViewport?.addEventListener('scroll', update);
    return () => {
      window.removeEventListener('scroll', update, true);
      window.removeEventListener('resize', update);
      visualViewport?.removeEventListener('resize', update);
      visualViewport?.removeEventListener('scroll', update);
    };
  }, [isOpen, update]);

  return position;
};
