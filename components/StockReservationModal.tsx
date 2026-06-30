import React, { useEffect, useMemo, useState } from 'react';
import { UserPlus } from 'lucide-react';
import Modal from './ui/Modal';
import IOSButton from './ui/IOSButton';
import { Combobox } from './ui/Combobox';
import { formatCurrencyBRL, parseCurrencyBRL } from '../utils/inputMasks';
import { Customer, StockItem, StockReservation, StockReservationInput } from '../types';

interface StockReservationModalProps {
  open: boolean;
  stockItem?: StockItem | null;
  initialReservation?: StockReservation | null;
  customers?: Customer[];
  customerToSelectId?: string | null;
  isSaving?: boolean;
  onClose: () => void;
  onSave: (input: StockReservationInput) => Promise<void> | void;
  onRequestCreateCustomer?: () => void;
}

const toDateInputValue = (value?: string | null) => {
  if (!value) return '';
  return value.slice(0, 10);
};

export const StockReservationModal: React.FC<StockReservationModalProps> = ({
  open,
  stockItem,
  initialReservation,
  customers = [],
  customerToSelectId,
  isSaving = false,
  onClose,
  onSave,
  onRequestCreateCustomer,
}) => {
  const manualReservationCustomerId = '__reservation_manual_customer__';
  const [selectedCustomerId, setSelectedCustomerId] = useState('');
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [expiresAt, setExpiresAt] = useState('');
  const [depositAmount, setDepositAmount] = useState('');
  const [depositPaymentMethod, setDepositPaymentMethod] = useState('');
  const [notes, setNotes] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    const initialName = initialReservation?.customerName || '';
    const initialPhone = initialReservation?.customerPhone || '';
    const matchingCustomer = customers.find((customer) => (
      customer.name.trim().toLowerCase() === initialName.trim().toLowerCase()
      && (!initialPhone || customer.phone.trim() === initialPhone.trim())
    ));
    setSelectedCustomerId(matchingCustomer?.id || (initialName ? manualReservationCustomerId : ''));
    setCustomerName(initialName);
    setCustomerPhone(initialPhone);
    setExpiresAt(toDateInputValue(initialReservation?.expiresAt));
    setDepositAmount(
      typeof initialReservation?.depositAmount === 'number' && initialReservation.depositAmount > 0
        ? String(initialReservation.depositAmount)
        : ''
    );
    setDepositPaymentMethod(initialReservation?.depositPaymentMethod || '');
    setNotes(initialReservation?.notes || '');
    setError(null);
  }, [customers, initialReservation, open]);

  useEffect(() => {
    if (!open || !customerToSelectId) return;
    const customer = customers.find((entry) => entry.id === customerToSelectId);
    if (!customer) return;
    setSelectedCustomerId(customer.id);
    setCustomerName(customer.name);
    setCustomerPhone(customer.phone || '');
    setError(null);
  }, [customerToSelectId, customers, open]);

  const parsedDepositAmount = useMemo(() => {
    if (!depositAmount.trim()) return null;
    const parsed = parseCurrencyBRL(depositAmount);
    return Number.isFinite(parsed) ? parsed : Number.NaN;
  }, [depositAmount]);

  const hasDeposit = typeof parsedDepositAmount === 'number' && parsedDepositAmount > 0;

  const customerOptions = useMemo(() => {
    const options = customers.map((customer) => ({
      id: customer.id,
      label: customer.name,
      subLabel: [customer.phone || null, customer.cpf ? `CPF: ${customer.cpf}` : null]
        .filter(Boolean)
        .join(' · ') || undefined,
    }));

    if (
      selectedCustomerId === manualReservationCustomerId
      && customerName.trim()
      && !options.some((option) => option.id === manualReservationCustomerId)
    ) {
      return [
        {
          id: manualReservationCustomerId,
          label: customerName.trim(),
          subLabel: customerPhone.trim() || 'Cliente da reserva',
        },
        ...options,
      ];
    }

    return options;
  }, [customerName, customerPhone, customers, selectedCustomerId]);

  const handleCustomerChange = (customerId: string) => {
    setSelectedCustomerId(customerId);
    const customer = customers.find((entry) => entry.id === customerId);
    if (!customer) return;
    setCustomerName(customer.name);
    setCustomerPhone(customer.phone || '');
    setError(null);
  };

  const handleSubmit = async () => {
    const trimmedName = customerName.trim();
    const trimmedPhone = customerPhone.trim();

    if (!trimmedName) {
      setError('Informe o cliente da reserva.');
      return;
    }
    if (!trimmedPhone) {
      setError('Informe o telefone da reserva.');
      return;
    }
    if (parsedDepositAmount !== null && (!Number.isFinite(parsedDepositAmount) || parsedDepositAmount < 0)) {
      setError('Valor do sinal inválido.');
      return;
    }
    if (hasDeposit && !depositPaymentMethod.trim()) {
      setError('Informe a forma do sinal.');
      return;
    }

    setError(null);
    await onSave({
      customerName: trimmedName,
      customerPhone: trimmedPhone,
      expiresAt: expiresAt || null,
      depositAmount: parsedDepositAmount,
      depositPaymentMethod: hasDeposit ? depositPaymentMethod.trim() : null,
      notes: notes.trim() || null,
    });
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={initialReservation ? 'Editar reserva' : 'Reservar aparelho'}
      size="md"
      initialFocusSelector="#reservation-customer-picker button[role='combobox']"
      onSubmit={() => {
        void handleSubmit();
      }}
      footer={
        <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2">
          <IOSButton variant="secondary" type="button" onClick={onClose} disabled={isSaving}>
            Cancelar
          </IOSButton>
          <IOSButton variant="primary" type="submit" loading={isSaving}>
            Salvar reserva
          </IOSButton>
        </div>
      }
    >
      <div className="space-y-4">
        {stockItem && (
          <div className="rounded-ios-lg border app-border app-surface-soft p-3">
            <p className="text-sm font-semibold app-text-primary">{stockItem.model}</p>
            <p className="text-xs app-text-muted">
              {[stockItem.capacity, stockItem.color, stockItem.imei ? `IMEI/Serial ${stockItem.imei}` : null]
                .filter(Boolean)
                .join(' · ')}
            </p>
          </div>
        )}

        {error && (
          <div className="rounded-ios border border-red-200 bg-red-50 px-3 py-2 text-sm font-medium text-red-700 dark:border-red-900/40 dark:bg-red-900/20 dark:text-red-300">
            {error}
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div id="reservation-customer-picker" className="grid grid-cols-[minmax(0,1fr)_auto] gap-2 items-start">
            <Combobox
              label="Cliente"
              placeholder="Buscar cliente..."
              searchPlaceholder="Buscar cliente cadastrado..."
              noResultsMessage="Nenhum cliente cadastrado encontrado."
              value={selectedCustomerId}
              onChange={handleCustomerChange}
              options={customerOptions}
            />
            <button
              type="button"
              className="ios-button-secondary mt-6 flex h-11 w-11 shrink-0 items-center justify-center p-0"
              onClick={onRequestCreateCustomer}
              disabled={isSaving || !onRequestCreateCustomer}
              title="Cadastrar cliente da reserva"
              aria-label="Cadastrar cliente da reserva"
            >
              <UserPlus size={20} />
            </button>
          </div>
          <div>
            <label className="ios-label" htmlFor="reservation-customer-phone">Telefone</label>
            <input
              id="reservation-customer-phone"
              className="ios-input"
              value={customerPhone}
              onChange={(event) => setCustomerPhone(event.target.value)}
              placeholder="WhatsApp ou contato"
              disabled={isSaving}
            />
          </div>
        </div>

        <div>
          <label className="ios-label" htmlFor="reservation-expires-at">Validade da reserva</label>
          <input
            id="reservation-expires-at"
            className="ios-input"
            type="date"
            value={expiresAt}
            onChange={(event) => setExpiresAt(event.target.value)}
            disabled={isSaving}
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="ios-label" htmlFor="reservation-deposit-amount">Sinal</label>
            <input
              id="reservation-deposit-amount"
              className="ios-input"
              inputMode="decimal"
              value={depositAmount}
              onChange={(event) => setDepositAmount(event.target.value)}
              onBlur={() => {
                const parsed = parseCurrencyBRL(depositAmount);
                if (depositAmount.trim() && Number.isFinite(parsed) && parsed > 0) {
                  setDepositAmount(formatCurrencyBRL(parsed));
                }
              }}
              placeholder="Opcional"
              disabled={isSaving}
            />
          </div>
          <div>
            <label className="ios-label" htmlFor="reservation-deposit-method">Forma do sinal</label>
            <select
              id="reservation-deposit-method"
              className="ios-input"
              value={depositPaymentMethod}
              onChange={(event) => setDepositPaymentMethod(event.target.value)}
              disabled={isSaving || !hasDeposit}
            >
              <option value="">Selecione</option>
              <option value="Pix">Pix</option>
              <option value="Dinheiro">Dinheiro</option>
              <option value="Cartão">Cartão</option>
              <option value="Cartão Débito">Cartão Débito</option>
              <option value="Outro">Outro</option>
            </select>
          </div>
        </div>

        <div>
          <label className="ios-label" htmlFor="reservation-notes">Observações</label>
          <textarea
            id="reservation-notes"
            className="ios-input min-h-24 resize-y"
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
            placeholder="Combinados da reserva, horário de retirada, detalhes do sinal..."
            disabled={isSaving}
          />
        </div>
      </div>
    </Modal>
  );
};

export default StockReservationModal;
