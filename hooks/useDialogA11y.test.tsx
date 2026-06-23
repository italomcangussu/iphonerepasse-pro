import { useRef, useState } from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useDialogA11y } from './useDialogA11y';

interface HarnessProps {
  open: boolean;
  onClose?: () => void;
  closeOnEscape?: boolean;
}

function Dialog({ open, onClose, closeOnEscape }: HarnessProps) {
  const ref = useRef<HTMLDivElement>(null);
  useDialogA11y(open, ref, onClose, { closeOnEscape });
  if (!open) return null;
  return (
    <div ref={ref} role="dialog" aria-modal="true" tabIndex={-1}>
      <button type="button">first</button>
      <button type="button">last</button>
    </div>
  );
}

afterEach(() => {
  document.body.style.overflow = '';
});

describe('useDialogA11y', () => {
  it('locks body scroll while open and restores it on close', () => {
    const { rerender } = render(<Dialog open />);
    expect(document.body.style.overflow).toBe('hidden');

    rerender(<Dialog open={false} />);
    expect(document.body.style.overflow).toBe('');
  });

  it('moves focus into the dialog on open and returns it to the trigger on close', async () => {
    const user = userEvent.setup();
    render(
      <>
        <button type="button">trigger</button>
        <DialogToggle />
      </>,
    );

    const trigger = screen.getByRole('button', { name: 'open' });
    trigger.focus();
    await user.click(trigger);

    // Initial focus landed inside the dialog.
    expect(screen.getByRole('button', { name: 'first' })).toHaveFocus();

    await user.keyboard('{Escape}');
    // Focus returned to whatever was focused before opening.
    expect(screen.getByRole('button', { name: 'open' })).toHaveFocus();
  });

  it('closes on Escape by default', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(<Dialog open onClose={onClose} />);

    await user.keyboard('{Escape}');
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('ignores Escape for forcing-function dialogs (closeOnEscape=false)', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(<Dialog open onClose={onClose} closeOnEscape={false} />);

    await user.keyboard('{Escape}');
    expect(onClose).not.toHaveBeenCalled();
  });
});

function DialogToggle() {
  const ref = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  useDialogA11y(open, ref, () => setOpen(false));
  return (
    <>
      <button type="button" onClick={() => setOpen(true)}>
        open
      </button>
      {open && (
        <div ref={ref} role="dialog" aria-modal="true" tabIndex={-1}>
          <button type="button">first</button>
          <button type="button">last</button>
        </div>
      )}
    </>
  );
}
