import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import StatCard from './StatCard';

describe('StatCard', () => {
  it('mostra rótulo, valor e variação com o texto que dá sentido a ela', () => {
    render(<StatCard label="Vendas do mês" value="R$ 184.300" change="+12,4%" changeLabel="em relação a setembro" />);
    expect(screen.getByText('Vendas do mês')).toBeInTheDocument();
    expect(screen.getByText('R$ 184.300')).toBeInTheDocument();
    expect(screen.getByText('+12,4%')).toBeInTheDocument();
    expect(screen.getByText('em relação a setembro')).toBeInTheDocument();
  });

  it('aplica a classe do tom escolhido', () => {
    const { container } = render(<StatCard label="Dívidas" value="R$ 4.120" tone="error" />);
    expect(container.firstChild).toHaveClass('ios-stat-card', 'ios-stat-card-error');
  });

  it('omite a variação quando ela não é informada', () => {
    const { container } = render(<StatCard label="Itens" value="47" />);
    expect(container.querySelector('svg')).toBeNull();
  });
});
