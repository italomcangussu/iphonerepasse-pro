import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import Sparkline, { sparklinePoints } from './Sparkline';

describe('sparklinePoints', () => {
  it('espalha os pontos pela largura e inverte o eixo y (maior valor no topo)', () => {
    expect(sparklinePoints([0, 10], 100, 24)).toBe('0.0,22.0 100.0,2.0');
  });

  it('mantém uma série constante dentro da caixa', () => {
    expect(sparklinePoints([5, 5, 5], 100, 24)).toBe('0.0,22.0 50.0,22.0 100.0,22.0');
  });

  it('devolve vazio quando não há pelo menos dois pontos', () => {
    expect(sparklinePoints([7], 100, 24)).toBe('');
  });
});

describe('Sparkline', () => {
  it('não renderiza nada sem série suficiente', () => {
    const { container } = render(<Sparkline values={[1]} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('é decorativo para leitores de tela', () => {
    const { container } = render(<Sparkline values={[1, 2, 3]} />);
    expect(container.querySelector('svg')).toHaveAttribute('aria-hidden', 'true');
  });
});
