import type React from 'react';

export type ContextMenuAction = {
  id: string;
  label: string;
  icon?: React.ReactNode;
  hint?: string;
  disabled?: boolean;
  loading?: boolean;
  destructive?: boolean;
  separatorBefore?: boolean;
  onSelect: () => void | Promise<void>;
};

export type ContextMenuOpenOptions = {
  label: string;
};

const NATIVE_CONTEXT_MENU_SELECTOR = [
  'input',
  'textarea',
  'select',
  'option',
  'button',
  'a[href]',
  'video',
  'audio',
  'img',
  '[contenteditable="true"]',
  '[data-native-context-menu="true"]',
].join(',');

export function canOpenDesktopContextMenu(mediaQuery: Pick<MediaQueryList, 'matches'> | null | undefined): boolean {
  return Boolean(mediaQuery?.matches);
}

export function hasSelectedText(
  selection: Selection | null | undefined = typeof window !== 'undefined' ? window.getSelection() : null,
): boolean {
  return Boolean(selection && !selection.isCollapsed && selection.toString().trim());
}

export function shouldUseNativeContextMenu(target: EventTarget | null, selection?: Selection | null): boolean {
  if (hasSelectedText(selection)) return true;
  if (!(target instanceof Element)) return false;
  return Boolean(target.closest(NATIVE_CONTEXT_MENU_SELECTOR));
}

export function clampContextMenuPosition(input: {
  x: number;
  y: number;
  menuWidth: number;
  menuHeight: number;
  viewportWidth: number;
  viewportHeight: number;
  margin?: number;
}): { x: number; y: number } {
  const margin = input.margin ?? 8;
  return {
    x: Math.max(margin, Math.min(input.x, input.viewportWidth - input.menuWidth - margin)),
    y: Math.max(margin, Math.min(input.y, input.viewportHeight - input.menuHeight - margin)),
  };
}
