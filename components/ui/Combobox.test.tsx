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

  it('keeps the listbox beside the input after the page scrolls (iOS keyboard)', async () => {
    const user = userEvent.setup();
    Object.defineProperty(window, 'scrollY', { value: 214, configurable: true });
    const rectSpy = vi
      .spyOn(HTMLElement.prototype, 'getBoundingClientRect')
      .mockReturnValue({ top: 178, bottom: 226, left: 16, right: 296, width: 280, height: 48, x: 16, y: 178, toJSON: () => ({}) });

    try {
      render(
        <Combobox
          label="Cliente"
          value=""
          onChange={() => {}}
          options={[{ id: '1', label: 'ANA PAULA', subLabel: 'CPF: 987.654.321-00' }]}
        />
      );

      await user.click(screen.getByRole('combobox', { name: 'Cliente' }));

      const anchor = screen.getByRole('listbox').parentElement as HTMLElement;
      // page coordinates: client bottom 226 + scrollY 214 + gap 4. `fixed` would drift under the keyboard.
      expect(anchor.style.position).toBe('absolute');
      expect(anchor.style.top).toBe('444px');
    } finally {
      rectSpy.mockRestore();
      Object.defineProperty(window, 'scrollY', { value: 0, configurable: true });
    }
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
