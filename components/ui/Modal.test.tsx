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

    const first = screen.getByTestId('first');
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

    const closeButtons = screen.getAllByRole('button', { name: 'Fechar' });
    fireEvent.click(closeButtons[0]);
    expect(onClose).not.toHaveBeenCalled();
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
      <Modal open onClose={onClose} title="Sheet mobile">
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
