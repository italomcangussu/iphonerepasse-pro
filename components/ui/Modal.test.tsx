import { fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import Modal from './Modal';

describe('Modal accessibility behavior', () => {
  it('traps focus and closes with Escape', () => {
    const onClose = vi.fn();

    render(
      <Modal
        open
        onClose={onClose}
        title="Teste"
        initialFocusSelector='[data-testid="second"]'
      >
        <button type="button" data-testid="first">
          Primeiro
        </button>
        <button type="button" data-testid="second">
          Segundo
        </button>
      </Modal>
    );

    const second = screen.getByTestId('second');
    const dialog = screen.getByRole('dialog');
    const closeButton = within(dialog).getByRole('button', { name: 'Fechar' });

    expect(second).toHaveFocus();

    fireEvent.keyDown(document, { key: 'Tab' });
    expect(closeButton).toHaveFocus();

    fireEvent.keyDown(document, { key: 'Tab', shiftKey: true });
    expect(second).toHaveFocus();

    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('does not close on backdrop when closeOnBackdrop is false', () => {
    const onClose = vi.fn();

    render(
      <Modal open onClose={onClose} title="Teste" closeOnBackdrop={false}>
        <div>Conteudo</div>
      </Modal>
    );

    const backdrop = document.querySelector('.liquid-glass-strong');
    expect(backdrop).toBeInTheDocument();
    fireEvent.click(backdrop as Element);
    expect(onClose).not.toHaveBeenCalled();
  });

  it('renders a non-interactive backdrop when closeOnBackdrop is false', () => {
    render(
      <Modal open onClose={vi.fn()} title="Editar" closeOnBackdrop={false}>
        <p>Conteúdo</p>
      </Modal>
    );

    expect(screen.queryByRole('button', { name: /fechar/i })).toBeInTheDocument();
    expect(screen.queryAllByRole('button', { name: /fechar/i })).toHaveLength(1);
  });
});

describe('Modal drag-to-dismiss (mobile bottom sheet)', () => {
  const originalMatchMedia = window.matchMedia;

  beforeEach(() => {
    // Simulate mobile viewport (max-width: 767px) so drag-to-dismiss activates.
    window.matchMedia = vi.fn().mockImplementation((query: string) => ({
      matches: query.includes('max-width: 767px'),
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })) as typeof window.matchMedia;
  });

  afterEach(() => {
    window.matchMedia = originalMatchMedia;
  });

  it('renders a grab handle on mobile that enables drag gesture', () => {
    const onClose = vi.fn();

    render(
      <Modal open onClose={onClose} title="Sheet mobile" centered={false}>
        <div>Conteudo do sheet</div>
      </Modal>
    );

    // Grab handle should be present on mobile — this is the pointer target
    // that activates the framer-motion dragControls via onPointerDown.
    const grabHandle = screen.getByTestId('modal-grab-handle');
    expect(grabHandle).toBeInTheDocument();
    expect(grabHandle.className).toContain('cursor-grab');
    expect(grabHandle.className).toContain('touch-none');

    // The dialog itself must still render and be focusable.
    const dialog = screen.getByRole('dialog');
    expect(dialog).toBeInTheDocument();
    expect(dialog).toHaveAttribute('aria-modal', 'true');
  });
});

describe('Modal horizontal scroll prevention and native app containment', () => {
  it('enforces overflow-x-hidden on the overlay, dialog card, and scrollable body', () => {
    render(
      <Modal open onClose={vi.fn()} title="Containment test">
        <div data-testid="modal-child">Conteudo interno</div>
      </Modal>
    );

    const dialog = screen.getByRole('dialog');
    expect(dialog.className).toContain('max-w-full');
    expect(dialog.className).toContain('min-w-0');
    expect(dialog.className).toContain('overflow-hidden');

    const overlay = dialog.parentElement;
    expect(overlay).not.toBeNull();
    expect(overlay?.className).toContain('overflow-x-hidden');
    expect(overlay?.className).toContain('overflow-y-auto');

    const scrollBody = screen.getByTestId('modal-child').parentElement;
    expect(scrollBody).not.toBeNull();
    expect(scrollBody?.className).toContain('overflow-x-hidden');
    expect(scrollBody?.className).toContain('overflow-y-auto');
    expect(scrollBody?.className).toContain('min-w-0');
    expect(scrollBody?.className).toContain('max-w-full');
  });
});
