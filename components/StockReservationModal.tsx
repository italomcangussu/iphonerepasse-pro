import React, { useEffect, useMemo, useState } from 'react';
import { AlertCircle, UserPlus } from 'lucide-react';
import Modal from './ui/Modal';
import IOSButton from './ui/IOSButton';
import { Combobox } from './ui/Combobox';
import { formatCurrencyBRL, getCpfOrCnpjLabel, parseCurrencyBRL } from '../utils/inputMasks';
import { Customer, StockItem, StockReservation, StockReservationInput } from '../types';

type ReservationField = 'customer' | 'phone' | 'depositAmount' | 'depositPaymentMethod';

const FieldError = ({ id, children }: { id: string; children: string }) => (
  <p id={id} role="alert" aria-label={children} className="mt-1 flex items-start gap-1.5 text-ios-footnote font-medium text-red-600 dark:text-red-400">
    <AlertCircle size={14} className="mt-0.5 shrink-0" aria-hidden="true" />
    <span>{children}</span>
  </p>
);

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
  const [errors, setErrors] = useState<Partial<Record<ReservationField, string>>>({});

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
    // Hidrata já formatado (R$ 200,00): o parse do campo é em centavos, então
    // um valor cru como "200" seria relido como R$ 2,00 ao salvar a edição.
    setDepositAmount(
      typeof initialReservation?.depositAmount === 'number' && initialReservation.depositAmount > 0
        ? formatCurrencyBRL(initialReservation.depositAmount)
        : ''
    );
    setDepositPaymentMethod(initialReservation?.depositPaymentMethod || '');
    setNotes(initialReservation?.notes || '');
    setErrors({});
  }, [customers, initialReservation, open]);

  useEffect(() => {
    if (!open || !customerToSelectId) return;
    const customer = customers.find((entry) => entry.id === customerToSelectId);
    if (!customer) return;
    setSelectedCustomerId(customer.id);
    setCustomerName(customer.name);
    setCustomerPhone(customer.phone || '');
    setErrors((current) => ({ ...current, customer: undefined, phone: undefined }));
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
      subLabel: [
        customer.phone || null,
        customer.cpf ? `${getCpfOrCnpjLabel(customer.cpf)}: ${customer.cpf}` : null,
      ]
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
    setErrors((current) => ({ ...current, customer: undefined, phone: undefined }));
  };

  const handleSubmit = async () => {
    const trimmedName = customerName.trim();
    const trimmedPhone = customerPhone.trim();
    const nextErrors: Partial<Record<ReservationField, string>> = {};

    if (!trimmedName) {
      nextErrors.customer = 'Informe o cliente da reserva.';
    }
    if (!trimmedPhone) {
      nextErrors.phone = 'Informe o telefone da reserva.';
    }
    if (parsedDepositAmount !== null && (!Number.isFinite(parsedDepositAmount) || parsedDepositAmount < 0)) {
      nextErrors.depositAmount = 'Informe um valor de sinal válido.';
    }
    if (hasDeposit && !depositPaymentMethod.trim()) {
      nextErrors.depositPaymentMethod = 'Informe a forma do sinal.';
    }

    if (Object.keys(nextErrors).length > 0) {
      setErrors(nextErrors);
      const firstInvalidSelector = nextErrors.customer
        ? '#reservation-customer-picker button[role="combobox"]'
        : nextErrors.phone
          ? '#reservation-customer-phone'
          : nextErrors.depositAmount
            ? '#reservation-deposit-amount'
            : '#reservation-deposit-method';
      window.setTimeout(() => {
        document.querySelector<HTMLElement>(firstInvalidSelector)?.focus();
      }, 0);
      return;
    }

    setErrors({});
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
      size="lg"
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

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div id="reservation-customer-picker" className="grid grid-cols-[minmax(0,1fr)_auto] gap-2 items-start min-w-0">
            <Combobox
              label="Cliente"
              placeholder="Buscar cliente..."
              searchPlaceholder="Buscar cliente cadastrado..."
              noResultsMessage="Nenhum cliente cadastrado encontrado."
              value={selectedCustomerId}
              onChange={handleCustomerChange}
              options={customerOptions}
              errorMessage={errors.customer}
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
          <div className="min-w-0">
            <label className="ios-label" htmlFor="reservation-customer-phone">Telefone</label>
            <input
              id="reservation-customer-phone"
              className={`ios-input ${errors.phone ? 'ios-input-error' : ''}`}
              value={customerPhone}
              onChange={(event) => {
                setCustomerPhone(event.target.value);
                setErrors((current) => ({ ...current, phone: undefined }));
              }}
              placeholder="WhatsApp ou contato"
              disabled={isSaving}
              aria-invalid={!!errors.phone}
              aria-describedby={errors.phone ? 'reservation-customer-phone-error' : undefined}
            />
            {errors.phone && <FieldError id="reservation-customer-phone-error">{errors.phone}</FieldError>}
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

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div className="min-w-0">
            <label className="ios-label" htmlFor="reservation-deposit-amount">Sinal</label>
            <input
              id="reservation-deposit-amount"
              className={`ios-input ${errors.depositAmount ? 'ios-input-error' : ''}`}
              inputMode="numeric"
              value={depositAmount}
              onChange={(event) => {
                // Máscara em centavos ao digitar (2-0-0 → R$ 2,00): a vírgula
                // fica sempre visível, então o valor salvo é o valor exibido.
                const hasDigits = /\d/.test(event.target.value);
                setDepositAmount(hasDigits ? formatCurrencyBRL(parseCurrencyBRL(event.target.value)) : '');
                setErrors((current) => ({ ...current, depositAmount: undefined, depositPaymentMethod: undefined }));
              }}
              placeholder="Opcional"
              disabled={isSaving}
              aria-invalid={!!errors.depositAmount}
              aria-describedby={errors.depositAmount ? 'reservation-deposit-amount-error' : undefined}
            />
            {errors.depositAmount && <FieldError id="reservation-deposit-amount-error">{errors.depositAmount}</FieldError>}
          </div>
          <div className="min-w-0">
            <label className="ios-label" htmlFor="reservation-deposit-method">Forma do sinal</label>
            <select
              id="reservation-deposit-method"
              className={`ios-input ${errors.depositPaymentMethod ? 'ios-input-error' : ''}`}
              value={depositPaymentMethod}
              onChange={(event) => {
                setDepositPaymentMethod(event.target.value);
                setErrors((current) => ({ ...current, depositPaymentMethod: undefined }));
              }}
              disabled={isSaving || !hasDeposit}
              aria-invalid={!!errors.depositPaymentMethod}
              aria-describedby={errors.depositPaymentMethod ? 'reservation-deposit-method-error' : undefined}
            >
              <option value="">Selecione</option>
              <option value="Pix">Pix</option>
              <option value="Dinheiro">Dinheiro</option>
              <option value="Cartão">Cartão</option>
              <option value="Cartão Débito">Cartão Débito</option>
              <option value="Outro">Outro</option>
            </select>
            {errors.depositPaymentMethod && <FieldError id="reservation-deposit-method-error">{errors.depositPaymentMethod}</FieldError>}
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
