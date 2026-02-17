import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { Combobox } from './Combobox';

describe('Combobox keyboard accessibility', () => {
  it('supports keyboard navigation and selection', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();

    render(
      <Combobox
        label="Produto"
        value=""
        onChange={onChange}
        options={[
          { id: '1', label: 'iPhone 14', subLabel: '256 GB' },
          { id: '2', label: 'iPhone 15', subLabel: '128 GB' }
        ]}
        searchPlaceholder="Buscar..."
      />
    );

    const trigger = screen.getByRole('combobox', { name: 'Produto' });
    fireEvent.keyDown(trigger, { key: 'ArrowDown' });

    const input = screen.getByPlaceholderText('Buscar...');
    await user.type(input, 'iphone');
    fireEvent.keyDown(input, { key: 'ArrowDown' });
    fireEvent.keyDown(input, { key: 'Enter' });

    expect(onChange).toHaveBeenCalledWith('2');
  });

  it('exposes field error with aria invalid state', () => {
    render(
      <Combobox
        label="Cliente"
        value=""
        onChange={() => {}}
        options={[]}
        errorMessage="Selecione um cliente."
      />
    );

    const trigger = screen.getByRole('combobox', { name: 'Cliente' });
    expect(trigger).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByText('Selecione um cliente.')).toBeInTheDocument();
  });
});
