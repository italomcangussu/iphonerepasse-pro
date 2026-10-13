import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import ProgressBar, { progressPercent } from './ProgressBar';

describe('progressPercent', () => {
  it('arredonda a fração para percentual inteiro', () => {
    expect(progressPercent(184300, 220000)).toBe(84);
  });

  it('limita entre 0 e 100', () => {
    expect(progressPercent(150, 100)).toBe(100);
    expect(progressPercent(-5, 100)).toBe(0);
  });

  it('trata total zero ou negativo como 0%', () => {
    expect(progressPercent(10, 0)).toBe(0);
  });
});

describe('ProgressBar', () => {
  it('expõe nome e valor para leitores de tela', () => {
    render(<ProgressBar value={1} total={4} label="Dívida quitada" />);
    const barra = screen.getByRole('progressbar', { name: 'Dívida quitada' });
    expect(barra).toHaveAttribute('aria-valuenow', '25');
  });
});
