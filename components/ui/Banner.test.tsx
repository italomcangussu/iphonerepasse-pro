import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import Banner from './Banner';

describe('Banner', () => {
  it('uses a 44px dismiss target when dismissible', () => {
    render(<Banner message="Modo offline" onClose={vi.fn()} />);

    const button = screen.getByRole('button', { name: /dispensar alerta/i });
    expect(button).toHaveClass('hit-target-44');
    expect(button).toHaveClass('w-11');
    expect(button).toHaveClass('h-11');
  });
});
