import { fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
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
