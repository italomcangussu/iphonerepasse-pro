import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Loader2 } from 'lucide-react';
import type { useDesktopContextMenu } from '../../hooks/useDesktopContextMenu';
import { clampContextMenuPosition } from './contextMenuCore';

type DesktopContextMenuController = ReturnType<typeof useDesktopContextMenu>;

const MENU_FALLBACK_WIDTH = 248;
const MENU_MAX_HEIGHT = 360;

export function DesktopContextMenuHost({ controller }: { controller: DesktopContextMenuController }) {
  const { state, close, runAction } = controller;
  const menuRef = useRef<HTMLDivElement | null>(null);
  const [position, setPosition] = useState({ x: state.x, y: state.y });

  useLayoutEffect(() => {
    if (!state.open) return;

    const rect = menuRef.current?.getBoundingClientRect();
    setPosition(clampContextMenuPosition({
      x: state.x,
      y: state.y,
      menuWidth: rect?.width || MENU_FALLBACK_WIDTH,
      menuHeight: Math.min(rect?.height || MENU_MAX_HEIGHT, MENU_MAX_HEIGHT),
      viewportWidth: window.innerWidth,
      viewportHeight: window.innerHeight,
    }));
  }, [state.actions.length, state.open, state.x, state.y]);

  useEffect(() => {
    if (!state.open) return undefined;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') close();
    };
    const onPointerDown = (event: PointerEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) close();
    };
    const onScroll = () => close();

    document.addEventListener('keydown', onKeyDown);
    document.addEventListener('pointerdown', onPointerDown);
    window.addEventListener('scroll', onScroll, true);

    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.removeEventListener('pointerdown', onPointerDown);
      window.removeEventListener('scroll', onScroll, true);
    };
  }, [close, state.open]);

  if (!state.open) return null;

  return createPortal(
    <div
      ref={menuRef}
      role="menu"
      aria-label={state.label}
      className="fixed z-[60] max-h-[360px] w-[248px] overflow-y-auto rounded-xl border border-gray-200 bg-white py-1 text-sm text-gray-900 shadow-xl shadow-slate-900/10 ring-1 ring-black/5 dark:border-surface-dark-200 dark:bg-surface-dark-100 dark:text-white dark:shadow-black/30"
      style={{ left: position.x, top: position.y }}
    >
      {state.actions.map((action) => (
        <button
          key={action.id}
          type="button"
          role="menuitem"
          disabled={action.disabled || action.loading}
          className={`flex min-h-10 w-full items-center gap-3 px-3.5 py-2.5 text-left font-medium transition-colors hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-55 dark:hover:bg-surface-dark-200 ${action.separatorBefore ? 'mt-1 border-t border-gray-100 dark:border-surface-dark-200' : ''} ${action.destructive ? 'text-red-700 hover:bg-red-50 dark:text-red-300 dark:hover:bg-red-950/30' : 'text-gray-700 dark:text-surface-dark-700'}`}
          onClick={() => void runAction(action)}
        >
          <span className="inline-flex h-5 w-5 shrink-0 items-center justify-center" aria-hidden="true">
            {action.loading ? <Loader2 size={16} className="animate-spin" /> : action.icon}
          </span>
          <span className="min-w-0 flex-1">
            <span className="block truncate">{action.label}</span>
            {action.hint && (
              <span className="block truncate text-xs font-normal text-gray-500 dark:text-surface-dark-500">
                {action.hint}
              </span>
            )}
          </span>
        </button>
      ))}
    </div>,
    document.body,
  );
}

export default DesktopContextMenuHost;
