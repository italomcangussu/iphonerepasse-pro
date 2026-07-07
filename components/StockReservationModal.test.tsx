import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { Condition, Customer, DeviceType, StockItem, StockStatus, WarrantyType } from '../types';
import { StockReservationModal } from './StockReservationModal';

const stockItem: StockItem = {
  id: 'stk-1',
  type: DeviceType.IPHONE,
  model: 'iPhone 16',
  color: 'Branco',
  hasBox: true,
  capacity: '256 GB',
  imei: '111111111111111',
  condition: Condition.NEW,
  status: StockStatus.AVAILABLE,
  batteryHealth: 100,
  storeId: 'store-1',
  purchasePrice: 5500,
  sellPrice: 6700,
  maxDiscount: 0,
  warrantyType: WarrantyType.STORE,
  warrantyEnd: '',
  origin: '',
  notes: '',
  observations: '',
  costs: [],
  photos: [],
  entryDate: '2026-02-01'
};

const customers: Customer[] = [
  {
    id: 'cust-maria',
    name: 'MARIA CLIENTE',
    cpf: '123.456.789-00',
    phone: '(85) 99999-0000',
    email: '',
    purchases: 0,
    totalSpent: 0
  },
  {
    id: 'cust-joao',
    name: 'JOAO TESTE',
    cpf: '',
    phone: '(88) 98888-0000',
    email: '',
    purchases: 0,
    totalSpent: 0
  }
];

describe('StockReservationModal', () => {
  it('searches registered customers by name and fills reservation contact data', async () => {
    const user = userEvent.setup();
    const onSave = vi.fn();
    render(
      <StockReservationModal
        open
        stockItem={stockItem}
        customers={customers}
        onClose={vi.fn()}
        onSave={onSave}
      />
    );

    await user.click(screen.getByRole('combobox', { name: 'Cliente' }));
    await user.type(screen.getByPlaceholderText('Buscar cliente cadastrado...'), 'maria');
    await user.click(screen.getByRole('option', { name: /MARIA CLIENTE/i }));

    expect(screen.getByRole('combobox', { name: 'Cliente' })).toHaveTextContent('MARIA CLIENTE');
    expect(screen.getByLabelText('Telefone')).toHaveValue('(85) 99999-0000');

    await user.click(screen.getByRole('button', { name: 'Salvar reserva' }));

    expect(onSave).toHaveBeenCalledWith({
      customerName: 'MARIA CLIENTE',
      customerPhone: '(85) 99999-0000',
      expiresAt: null,
      depositAmount: null,
      depositPaymentMethod: null,
      notes: null
    });
  });

  it('offers an icon button to create a customer from the reservation modal', async () => {
    const user = userEvent.setup();
    const onRequestCreateCustomer = vi.fn();
    render(
      <StockReservationModal
        open
        stockItem={stockItem}
        customers={customers}
        onClose={vi.fn()}
        onSave={vi.fn()}
        onRequestCreateCustomer={onRequestCreateCustomer}
      />
    );

    const dialog = screen.getByRole('dialog', { name: 'Reservar aparelho' });
    await user.click(within(dialog).getByRole('button', { name: 'Cadastrar cliente da reserva' }));

    expect(onRequestCreateCustomer).toHaveBeenCalledTimes(1);
  });

  it('keeps the currency comma visible while typing the deposit so 200 becomes R$ 2,00 only if intended', async () => {
    const user = userEvent.setup();
    const onSave = vi.fn();
    render(
      <StockReservationModal
        open
        stockItem={stockItem}
        customers={customers}
        onClose={vi.fn()}
        onSave={onSave}
      />
    );

    await user.click(screen.getByRole('combobox', { name: 'Cliente' }));
    await user.type(screen.getByPlaceholderText('Buscar cliente cadastrado...'), 'maria');
    await user.click(screen.getByRole('option', { name: /MARIA CLIENTE/i }));

    const depositInput = screen.getByLabelText('Sinal') as HTMLInputElement;
    await user.type(depositInput, '20000');

    expect(depositInput.value).toBe('R$ 200,00');

    await user.selectOptions(screen.getByLabelText('Forma do sinal'), 'Pix');
    await user.click(screen.getByRole('button', { name: 'Salvar reserva' }));

    expect(onSave).toHaveBeenCalledWith(expect.objectContaining({ depositAmount: 200 }));
  });

  it('rehydrates an existing deposit already formatted so editing does not shrink the value', async () => {
    const user = userEvent.setup();
    const onSave = vi.fn();
    render(
      <StockReservationModal
        open
        stockItem={stockItem}
        customers={customers}
        initialReservation={{
          id: 'res-edit-1',
          stockItemId: stockItem.id,
          customerName: 'MARIA CLIENTE',
          customerPhone: '(85) 99999-0000',
          reservedAt: '2026-06-01T12:00:00.000Z',
          depositAmount: 200,
          depositPaymentMethod: 'Pix',
          status: 'active',
          createdAt: '2026-06-01T12:00:00.000Z',
          updatedAt: '2026-06-01T12:00:00.000Z'
        }}
        onClose={vi.fn()}
        onSave={onSave}
      />
    );

    expect((screen.getByLabelText('Sinal') as HTMLInputElement).value).toBe('R$ 200,00');

    await user.click(screen.getByRole('button', { name: 'Salvar reserva' }));

    expect(onSave).toHaveBeenCalledWith(expect.objectContaining({ depositAmount: 200 }));
  });

  it('shows reservation validation errors inline next to the fields', async () => {
    const user = userEvent.setup();
    const onSave = vi.fn();
    render(
      <StockReservationModal
        open
        stockItem={stockItem}
        customers={customers}
        onClose={vi.fn()}
        onSave={onSave}
      />
    );

    const dialog = screen.getByRole('dialog', { name: 'Reservar aparelho' });
    await user.click(within(dialog).getByRole('button', { name: 'Salvar reserva' }));

    const customerPicker = within(dialog).getByRole('combobox', { name: 'Cliente' });
    expect(customerPicker).toHaveAttribute('aria-invalid', 'true');
    expect(within(dialog).getByRole('alert', { name: /cliente da reserva/i })).toHaveTextContent('Informe o cliente da reserva.');

    await user.click(customerPicker);
    await user.click(screen.getByRole('option', { name: /MARIA CLIENTE/i }));
    await user.clear(within(dialog).getByLabelText('Telefone'));
    await user.click(within(dialog).getByRole('button', { name: 'Salvar reserva' }));

    const phoneInput = within(dialog).getByLabelText('Telefone');
    expect(phoneInput).toHaveAttribute('aria-invalid', 'true');
    expect(phoneInput).toHaveAccessibleDescription('Informe o telefone da reserva.');
    expect(onSave).not.toHaveBeenCalled();
  });
});
