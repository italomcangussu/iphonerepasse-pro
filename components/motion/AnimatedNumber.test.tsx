import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { AnimatedNumber } from './AnimatedNumber';

describe('AnimatedNumber', () => {
  it('renders the initial value', () => {
    render(<AnimatedNumber value={42} data-testid="num" />);
    // jsdom does not run requestAnimationFrame, so the rendered text reflects
    // the initial motion value (which we set to `value` immediately).
    expect(screen.getByText('42')).toBeInTheDocument();
  });

  it('formats the value with the provided formatter', () => {
    render(
      <AnimatedNumber
        value={1234.56}
        format={(n) => `R$ ${n.toFixed(2)}`}
      />
    );
    expect(screen.getByText('R$ 1234.56')).toBeInTheDocument();
  });
});
