import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import TransactionRow from './TransactionRow';

const renderRow = (direction: 'in' | 'out') =>
  render(
    <ul>
      <TransactionRow title="Parcela" detail="9 out" amount="R$ 350,00" direction={direction} account="Pix" />
    </ul>,
  );

describe('TransactionRow', () => {
  it('marca entrada com sinal de mais e texto falado, não só com cor', () => {
    renderRow('in');
    expect(screen.getByText(/\+ R\$ 350,00/)).toBeInTheDocument();
    expect(screen.getByText('Entrada:', { exact: false })).toBeInTheDocument();
  });

  it('marca saída com sinal de menos e texto falado', () => {
    renderRow('out');
    expect(screen.getByText(/− R\$ 350,00/)).toBeInTheDocument();
    expect(screen.getByText('Saída:', { exact: false })).toBeInTheDocument();
  });

  it('mostra a conta quando informada', () => {
    renderRow('in');
    expect(screen.getByText('Pix')).toBeInTheDocument();
  });
});
