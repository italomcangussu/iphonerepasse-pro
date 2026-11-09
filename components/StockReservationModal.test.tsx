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

    expect(onSave).toHaveBeenCalledWith(
      {
        customerName: 'MARIA CLIENTE',
        customerPhone: '(85) 99999-0000',
        expiresAt: null,
        depositAmount: null,
        depositPaymentMethod: null,
        depositParts: [],
        tradeIn: null,
        notes: null,
        sellerId: null,
        sellerName: null
      },
      expect.objectContaining({ send: true })
    );
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

    expect(onSave).toHaveBeenCalledWith(
      expect.objectContaining({ depositAmount: 200 }),
      expect.objectContaining({ send: true })
    );
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

    // Reserva já existente: o envio da mensagem começa desmarcado ao editar.
    expect(onSave).toHaveBeenCalledWith(
      expect.objectContaining({ depositAmount: 200 }),
      expect.objectContaining({ send: false })
    );
  });

  it('records two deposits in different methods plus a trade-in and shows what is left to pay', async () => {
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

    const addDeposit = screen.getByRole('button', { name: 'Adicionar outro sinal' });
    expect(addDeposit).toBeDisabled();

    await user.type(screen.getByLabelText('Sinal'), '50000');
    await user.selectOptions(screen.getByLabelText('Forma do sinal'), 'Pix');
    await user.click(addDeposit);
    await user.type(screen.getByLabelText('Sinal 2'), '30000');
    await user.selectOptions(screen.getByLabelText('Forma do sinal 2'), 'Dinheiro');
    await user.type(screen.getByLabelText('Aparelho da troca'), 'iPhone 11 64GB');
    await user.type(screen.getByLabelText('Valor da troca'), '120000');

    const summary = screen.getByLabelText('Resumo do pagamento');
    expect(summary).toHaveTextContent('Falta pagar');
    expect(summary).toHaveTextContent('R$ 4.700,00');
    expect(screen.getByTestId('reservation-message-preview')).toHaveTextContent(
      'Entrada recebida: R$ 500,00 (Pix) + R$ 300,00 (Dinheiro)'
    );
    expect(screen.getByTestId('reservation-message-preview')).toHaveTextContent('Seu iPhone 11 64GB na troca: R$ 1.200,00');

    await user.click(screen.getByRole('button', { name: 'Salvar reserva' }));

    expect(onSave).toHaveBeenCalledWith(
      expect.objectContaining({
        depositAmount: 800,
        depositPaymentMethod: 'Pix',
        depositParts: [{ amount: 500, method: 'Pix' }, { amount: 300, method: 'Dinheiro' }],
        tradeIn: { description: 'iPhone 11 64GB', value: 1200 },
      }),
      expect.anything()
    );
  });

  it('asks for the method of every extra deposit before saving', async () => {
    const user = userEvent.setup();
    const onSave = vi.fn();
    render(
      <StockReservationModal
        open
        stockItem={stockItem}
        customers={customers}
        initialReservation={{
          id: 'res-parts',
          stockItemId: stockItem.id,
          customerName: 'MARIA CLIENTE',
          customerPhone: '(85) 99999-0000',
          reservedAt: '2026-06-01T12:00:00.000Z',
          depositAmount: 800,
          depositPaymentMethod: 'Pix',
          depositParts: [{ amount: 500, method: 'Pix' }, { amount: 300, method: 'Dinheiro' }],
          status: 'active',
          createdAt: '2026-06-01T12:00:00.000Z',
          updatedAt: '2026-06-01T12:00:00.000Z'
        }}
        onClose={vi.fn()}
        onSave={onSave}
      />
    );

    expect(screen.getByLabelText('Sinal 2')).toHaveValue('R$ 300,00');
    await user.selectOptions(screen.getByLabelText('Forma do sinal 2'), '');
    await user.click(screen.getByRole('button', { name: 'Salvar reserva' }));

    expect(screen.getByLabelText('Forma do sinal 2')).toHaveAccessibleDescription('Informe a forma do sinal.');
    expect(onSave).not.toHaveBeenCalled();

    await user.click(screen.getByRole('button', { name: 'Remover sinal 2' }));
    await user.click(screen.getByRole('button', { name: 'Salvar reserva' }));
    expect(onSave).toHaveBeenCalledWith(
      expect.objectContaining({ depositAmount: 500, depositParts: [{ amount: 500, method: 'Pix' }] }),
      expect.anything()
    );
  });

  describe('mensagem automática da reserva', () => {
    const openWithMessage = (props: Record<string, unknown> = {}) => render(
      <StockReservationModal
        open
        stockItem={stockItem}
        customers={customers}
        onClose={vi.fn()}
        onSave={vi.fn()}
        {...props}
      />
    );

    it('comes with the send checkbox ticked and previews the reservation data', async () => {
      const user = userEvent.setup();
      openWithMessage({ storeName: 'Loja Centro' });

      const checkbox = screen.getByRole('checkbox', { name: /Enviar mensagem ao cliente/ });
      expect(checkbox).toBeChecked();

      await user.click(screen.getByRole('combobox', { name: 'Cliente' }));
      await user.click(await screen.findByRole('option', { name: /MARIA CLIENTE/ }));

      const preview = screen.getByTestId('reservation-message-preview');
      expect(preview).toHaveTextContent('Olá MARIA CLIENTE!');
      expect(preview).toHaveTextContent('iPhone 16 256 GB Branco');
      expect(preview.textContent).not.toMatch(/\{\{/);
    });

    it('lets the user skip the message for this reservation only', async () => {
      const user = userEvent.setup();
      const onSave = vi.fn();
      openWithMessage({ onSave });

      await user.click(screen.getByRole('combobox', { name: 'Cliente' }));
      await user.click(await screen.findByRole('option', { name: /MARIA CLIENTE/ }));
      await user.click(screen.getByRole('checkbox', { name: /Enviar mensagem ao cliente/ }));
      await user.click(screen.getByRole('button', { name: 'Salvar reserva' }));

      expect(onSave).toHaveBeenCalledWith(
        expect.objectContaining({ customerName: 'MARIA CLIENTE' }),
        expect.objectContaining({ send: false })
      );
    });

    it('inserts reservation variables through buttons, never typed markers', async () => {
      const user = userEvent.setup();
      openWithMessage({ messageTemplate: 'Oi ' });

      await user.click(screen.getByRole('combobox', { name: 'Cliente' }));
      await user.click(await screen.findByRole('option', { name: /MARIA CLIENTE/ }));
      await user.click(screen.getByRole('button', { name: /Cliente$/ }));

      expect(screen.getByLabelText('Mensagem')).toHaveValue('Oi {{cliente}}');
      expect(screen.getByTestId('reservation-message-preview')).toHaveTextContent('Oi MARIA CLIENTE');
    });

    it('saves the edited text as the default template when allowed', async () => {
      const user = userEvent.setup();
      const onSaveMessageTemplate = vi.fn().mockResolvedValue(undefined);
      openWithMessage({ messageTemplate: 'Reserva feita!', onSaveMessageTemplate });

      await user.click(screen.getByRole('button', { name: 'Salvar como padrão' }));

      expect(onSaveMessageTemplate).toHaveBeenCalledWith('Reserva feita!');
      expect(await screen.findByRole('status')).toHaveTextContent('padrão');
    });

    it('hides the default-template button for users who cannot change it', () => {
      openWithMessage();

      expect(screen.queryByRole('button', { name: 'Salvar como padrão' })).toBeNull();
    });
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
