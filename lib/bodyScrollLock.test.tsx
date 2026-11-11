import { render } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import Modal from '../components/ui/Modal';

const TwoModals = ({ first, second }: { first: boolean; second: boolean }) => (
  <>
    <Modal open={first} onClose={() => {}} title="Detalhes">
      <p>Primeiro</p>
    </Modal>
    <Modal open={second} onClose={() => {}} title="Confirmar">
      <p>Segundo</p>
    </Modal>
  </>
);

describe('trava de rolagem da página com modais empilhados', () => {
  afterEach(() => {
    document.body.style.overflow = '';
  });

  it('libera a rolagem quando os dois modais fecham juntos', () => {
    const { rerender } = render(<TwoModals first second={false} />);
    rerender(<TwoModals first second />);
    expect(document.body.style.overflow).toBe('hidden');

    rerender(<TwoModals first={false} second={false} />);

    expect(document.body.style.overflow).toBe('');
  });

  it('libera a rolagem quando a tela com os dois modais sai', () => {
    const { rerender, unmount } = render(<TwoModals first second={false} />);
    rerender(<TwoModals first second />);

    unmount();

    expect(document.body.style.overflow).toBe('');
  });

  it('mantém a página travada enquanto resta um modal aberto', () => {
    const { rerender } = render(<TwoModals first second={false} />);
    rerender(<TwoModals first second />);

    rerender(<TwoModals first={false} second />);

    expect(document.body.style.overflow).toBe('hidden');
  });
});
