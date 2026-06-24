import type React from 'react';
import { useCallback, useMemo, useState } from 'react';
import {
  canOpenDesktopContextMenu,
  shouldUseNativeContextMenu,
  type ContextMenuAction,
  type ContextMenuOpenOptions,
} from '../components/ui/contextMenuCore';

export type DesktopContextMenuState = {
  open: boolean;
  x: number;
  y: number;
  label: string;
  actions: ContextMenuAction[];
};

const CLOSED_STATE: DesktopContextMenuState = {
  open: false,
  x: 0,
  y: 0,
  label: 'Ações',
  actions: [],
};

export function useDesktopContextMenu() {
  const [state, setState] = useState<DesktopContextMenuState>(CLOSED_STATE);

  const close = useCallback(() => {
    setState((current) => ({ ...current, open: false }));
  }, []);

  const bind = useCallback((actions: ContextMenuAction[], options: ContextMenuOpenOptions) => {
    return (event: React.MouseEvent<HTMLElement>) => {
      const mediaQuery = typeof window === 'undefined' ? null : window.matchMedia('(hover: hover) and (pointer: fine)');
      if (!canOpenDesktopContextMenu(mediaQuery) || shouldUseNativeContextMenu(event.target)) return;

      const availableActions = actions.filter(Boolean);
      if (availableActions.length === 0) return;

      event.preventDefault();
      setState({
        open: true,
        x: event.clientX,
        y: event.clientY,
        label: options.label,
        actions: availableActions,
      });
    };
  }, []);

  const runAction = useCallback(async (action: ContextMenuAction) => {
    if (action.disabled || action.loading) return;
    close();
    await action.onSelect();
  }, [close]);

  return useMemo(() => ({ state, bind, close, runAction }), [bind, close, runAction, state]);
}
