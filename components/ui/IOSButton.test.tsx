import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import IOSButton from './IOSButton';

describe('IOSButton', () => {
  it('renders label and responds to click when idle', async () => {
    const onClick = vi.fn();
    render(<IOSButton onClick={onClick}>Salvar</IOSButton>);
    const btn = screen.getByRole('button', { name: /Salvar/ });
    expect(btn).toHaveAttribute('data-state', 'idle');
    btn.click();
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('shows loading state and disables click', () => {
    const onClick = vi.fn();
    render(
      <IOSButton onClick={onClick} loading>
        Salvar
      </IOSButton>
    );
    const btn = screen.getByRole('button');
    expect(btn).toHaveAttribute('data-state', 'loading');
    expect(btn).toHaveAttribute('aria-busy', 'true');
    expect(btn).toBeDisabled();
    expect(screen.getByText(/Processando/)).toBeInTheDocument();
  });

  it('shows success state with confirmation label', () => {
    render(
      <IOSButton success>
        Salvar
      </IOSButton>
    );
    const btn = screen.getByRole('button');
    expect(btn).toHaveAttribute('data-state', 'success');
    expect(screen.getByText(/Pronto/)).toBeInTheDocument();
  });
});
