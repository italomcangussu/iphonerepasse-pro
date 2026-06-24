import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { useDesktopContextMenu } from '../../hooks/useDesktopContextMenu';
import { DesktopContextMenuHost } from './DesktopContextMenu';
import { canOpenDesktopContextMenu, clampContextMenuPosition, shouldUseNativeContextMenu } from './contextMenuCore';

function Harness({ onSelect = vi.fn() }: { onSelect?: () => void }) {
  const menu = useDesktopContextMenu();

  return (
    <>
      <div
        data-testid="target"
        onContextMenu={menu.bind(
          [
            { id: 'edit', label: 'Editar', onSelect },
            { id: 'delete', label: 'Excluir', destructive: true, onSelect },
          ],
          { label: 'Ações do registro' },
        )}
      >
        Registro
      </div>
      <DesktopContextMenuHost controller={menu} />
    </>
  );
}

describe('desktop context menu helpers', () => {
  it('allows custom context menus only on fine pointer desktop environments', () => {
    expect(canOpenDesktopContextMenu({ matches: true } as MediaQueryList)).toBe(true);
    expect(canOpenDesktopContextMenu({ matches: false } as MediaQueryList)).toBe(false);
  });

  it('keeps the native menu for form controls, buttons, links, media, editable content, and selected text', () => {
    document.body.innerHTML = `
      <input data-kind="input" />
      <textarea data-kind="textarea"></textarea>
      <select data-kind="select"></select>
      <button data-kind="button"></button>
      <a data-kind="link" href="#"></a>
      <img data-kind="image" />
      <div data-kind="editable" contenteditable="true"></div>
      <div data-kind="plain"></div>
    `;

    for (const kind of ['input', 'textarea', 'select', 'button', 'link', 'image', 'editable']) {
      expect(shouldUseNativeContextMenu(document.querySelector(`[data-kind="${kind}"]`))).toBe(true);
    }
    expect(shouldUseNativeContextMenu(document.querySelector('[data-kind="plain"]'))).toBe(false);
  });

  it('clamps menu position inside the viewport with an 8px margin', () => {
    expect(
      clampContextMenuPosition({
        x: 790,
        y: 590,
        menuWidth: 220,
        menuHeight: 260,
        viewportWidth: 800,
        viewportHeight: 600,
      }),
    ).toEqual({ x: 572, y: 332 });
  });
});

describe('DesktopContextMenuHost', () => {
  it('opens from contextmenu, runs actions, and closes with Escape', async () => {
    window.matchMedia = vi.fn().mockReturnValue({
      matches: true,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    });
    const onSelect = vi.fn();
    expect(DesktopContextMenuHost).toBeTypeOf('function');
    render(<Harness onSelect={onSelect} />);

    fireEvent.contextMenu(screen.getByTestId('target'), { clientX: 120, clientY: 140 });

    expect(screen.getByRole('menu', { name: 'Ações do registro' })).toBeInTheDocument();
    await userEvent.click(screen.getByRole('menuitem', { name: 'Editar' }));
    expect(onSelect).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();

    fireEvent.contextMenu(screen.getByTestId('target'), { clientX: 120, clientY: 140 });
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
  });
});
