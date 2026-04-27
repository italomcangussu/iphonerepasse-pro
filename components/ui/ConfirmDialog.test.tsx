import { render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import ConfirmDialog from './ConfirmDialog';
import Modal from './Modal';

describe('ConfirmDialog stacking', () => {
  it('renders above an already open modal', () => {
    render(
      <>
        <Modal open onClose={vi.fn()} title="Detalhes do lançamento">
          <p>Conteúdo do modal base</p>
        </Modal>
        <ConfirmDialog
          open
          onClose={vi.fn()}
          onConfirm={vi.fn()}
          title="Cancelar lançamento"
          description="Confirmar cancelamento?"
          confirmLabel="Cancelar lançamento"
          variant="danger"
        />
      </>
    );

    const confirmDialog = screen
      .getAllByRole('dialog')
      .find((dialog) => within(dialog).queryByRole('heading', { name: 'Cancelar lançamento' }));

    expect(confirmDialog?.parentElement).toHaveClass('z-[70]');
  });
});
