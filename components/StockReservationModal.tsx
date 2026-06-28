import React, { useEffect, useMemo, useState } from 'react';
import Modal from './ui/Modal';
import IOSButton from './ui/IOSButton';
import { formatCurrencyBRL, parseCurrencyBRL } from '../utils/inputMasks';
import { StockItem, StockReservation, StockReservationInput } from '../types';

interface StockReservationModalProps {
  open: boolean;
  stockItem?: StockItem | null;
  initialReservation?: StockReservation | null;
  isSaving?: boolean;
  onClose: () => void;
  onSave: (input: StockReservationInput) => Promise<void> | void;
}

const toDateInputValue = (value?: string | null) => {
  if (!value) return '';
  return value.slice(0, 10);
};

export const StockReservationModal: React.FC<StockReservationModalProps> = ({
  open,
  stockItem,
  initialReservation,
  isSaving = false,
  onClose,
  onSave,
}) => {
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [expiresAt, setExpiresAt] = useState('');
  const [depositAmount, setDepositAmount] = useState('');
  const [depositPaymentMethod, setDepositPaymentMethod] = useState('');
  const [notes, setNotes] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setCustomerName(initialReservation?.customerName || '');
    setCustomerPhone(initialReservation?.customerPhone || '');
    setExpiresAt(toDateInputValue(initialReservation?.expiresAt));
    setDepositAmount(
      typeof initialReservation?.depositAmount === 'number' && initialReservation.depositAmount > 0
        ? String(initialReservation.depositAmount)
        : ''
    );
    setDepositPaymentMethod(initialReservation?.depositPaymentMethod || '');
    setNotes(initialReservation?.notes || '');
    setError(null);
  }, [initialReservation, open]);

  const parsedDepositAmount = useMemo(() => {
    if (!depositAmount.trim()) return null;
    const parsed = parseCurrencyBRL(depositAmount);
    return Number.isFinite(parsed) ? parsed : Number.NaN;
  }, [depositAmount]);

  const hasDeposit = typeof parsedDepositAmount === 'number' && parsedDepositAmount > 0;

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
      initialFocusSelector="#reservation-customer-name"
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
          <div>
            <label className="ios-label" htmlFor="reservation-customer-name">Cliente</label>
            <input
              id="reservation-customer-name"
              className="ios-input"
              value={customerName}
              onChange={(event) => setCustomerName(event.target.value)}
              placeholder="Nome do cliente"
              disabled={isSaving}
            />
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
