import React from 'react';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import { useOpenFromQuery } from './useOpenFromQuery';

const Probe: React.FC<{ open: () => void; enabled?: boolean }> = ({ open, enabled }) => {
  useOpenFromQuery('novo', open, enabled);
  return <span data-testid="search">{useLocation().search}</span>;
};

const renderAt = (url: string, open: () => void, enabled?: boolean) =>
  render(
    <MemoryRouter initialEntries={[url]}>
      <Probe open={open} enabled={enabled} />
    </MemoryRouter>
  );

describe('useOpenFromQuery', () => {
  it('abre o formulário e limpa o parâmetro quando a tela chega com ?novo=1', () => {
    const open = vi.fn();
    renderAt('/inventory?novo=1', open);
    expect(open).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId('search').textContent).toBe('');
  });

  it('não abre sem o parâmetro', () => {
    const open = vi.fn();
    renderAt('/inventory', open);
    expect(open).not.toHaveBeenCalled();
  });

  it('não abre para quem não pode editar, mas limpa o parâmetro', () => {
    const open = vi.fn();
    renderAt('/inventory?novo=1', open, false);
    expect(open).not.toHaveBeenCalled();
    expect(screen.getByTestId('search').textContent).toBe('');
  });
});
