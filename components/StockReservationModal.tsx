import React, { useEffect, useMemo, useRef, useState } from 'react';
import { AlertCircle, MessageCircle, Plus, UserPlus } from 'lucide-react';
import Modal from './ui/Modal';
import IOSButton from './ui/IOSButton';
import { Combobox } from './ui/Combobox';
import { formatCurrencyBRL, getCpfOrCnpjLabel, parseCurrencyBRL } from '../utils/inputMasks';
import { Customer, StockItem, StockReservation, StockReservationInput } from '../types';
import { toReservationCalendarDay } from '../utils/reservations';
import {
  DEFAULT_RESERVATION_MESSAGE_TEMPLATE,
  RESERVATION_MESSAGE_VARIABLES,
  buildReservationMessageToken,
  renderReservationMessage,
  type ReservationMessageContext,
} from '../lib/reservationMessage';

type ReservationField = 'customer' | 'phone' | 'depositAmount' | 'depositPaymentMethod';

/** O que o modal devolve sobre a mensagem automática da reserva. */
export interface ReservationMessageResult {
  /** Checkbox "enviar mensagem" — falso quando o usuário desmarca para esta reserva. */
  send: boolean;
  /** Texto já resolvido (sem marcadores), pronto para ir ao cliente. */
  content: string;
  /** Template com os marcadores, como o usuário deixou no campo. */
  template: string;
}

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
  /** Template padrão da loja (configurável); cai no padrão do app quando vazio. */
  messageTemplate?: string;
  /** Padrão do checkbox de envio ao abrir o modal para uma reserva NOVA. */
  messageSendByDefault?: boolean;
  storeName?: string | null;
  sellerName?: string | null;
  /** Só admin pode gravar o template como padrão da loja. */
  onSaveMessageTemplate?: (template: string) => Promise<void>;
  onClose: () => void;
  onSave: (input: StockReservationInput, message: ReservationMessageResult) => Promise<void> | void;
  onRequestCreateCustomer?: () => void;
}

// O <input type="date"> fala em dia de calendário — a mesma leitura que as listas e o
// modal de detalhes agora usam, via o helper compartilhado.
const toDateInputValue = (value?: string | null) => toReservationCalendarDay(value) || '';

export const StockReservationModal: React.FC<StockReservationModalProps> = ({
  open,
  stockItem,
  initialReservation,
  customers = [],
  customerToSelectId,
  isSaving = false,
  messageTemplate,
  messageSendByDefault = true,
  storeName,
  sellerName,
  onSaveMessageTemplate,
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
  const [sendMessage, setSendMessage] = useState(true);
  const [messageDraft, setMessageDraft] = useState('');
  const [isSavingTemplate, setIsSavingTemplate] = useState(false);
  const [templateFeedback, setTemplateFeedback] = useState('');
  const messageInputRef = useRef<HTMLTextAreaElement | null>(null);

  const isEditing = !!initialReservation;

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
    setMessageDraft(messageTemplate?.trim() ? messageTemplate : DEFAULT_RESERVATION_MESSAGE_TEMPLATE);
    // Numa reserva NOVA o envio vem marcado (é o fim do cadastro que o cliente espera).
    // Ao EDITAR uma reserva já existente ele começa desmarcado: reenviar "sua reserva
    // foi concluída" a cada ajuste de observação seria spam.
    setSendMessage(!initialReservation && messageSendByDefault !== false);
    setTemplateFeedback('');
  }, [customers, initialReservation, messageSendByDefault, messageTemplate, open]);

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

  const messageContext = useMemo<ReservationMessageContext>(() => ({
    customerName: customerName.trim(),
    model: stockItem?.model,
    capacity: stockItem?.capacity,
    color: stockItem?.color,
    sellPrice: stockItem?.sellPrice ?? null,
    depositAmount: hasDeposit ? parsedDepositAmount : null,
    depositPaymentMethod: depositPaymentMethod.trim(),
    expiresAt,
    storeName,
    sellerName,
  }), [
    customerName,
    depositPaymentMethod,
    expiresAt,
    hasDeposit,
    parsedDepositAmount,
    sellerName,
    stockItem,
    storeName,
  ]);

  const messagePreview = useMemo(
    () => renderReservationMessage(messageDraft, messageContext),
    [messageContext, messageDraft]
  );

  // O usuário nunca digita `{{...}}`: o botão insere o marcador onde o cursor está.
  const insertMessageVariable = (token: string) => {
    const marker = buildReservationMessageToken(token);
    const input = messageInputRef.current;
    const start = input?.selectionStart ?? messageDraft.length;
    const end = input?.selectionEnd ?? start;

    setMessageDraft(`${messageDraft.slice(0, start)}${marker}${messageDraft.slice(end)}`);
    setTemplateFeedback('');

    window.setTimeout(() => {
      if (!input) return;
      const caret = start + marker.length;
      input.focus();
      input.setSelectionRange(caret, caret);
    }, 0);
  };

  const handleSaveMessageTemplate = async () => {
    if (!onSaveMessageTemplate) return;
    const template = messageDraft.trim();
    if (!template) {
      setTemplateFeedback('Escreva a mensagem antes de salvar como padrão.');
      return;
    }

    setIsSavingTemplate(true);
    try {
      await onSaveMessageTemplate(template);
      setTemplateFeedback('Mensagem salva como padrão das próximas reservas.');
    } catch (error: any) {
      setTemplateFeedback(error?.message || 'Não foi possível salvar a mensagem como padrão.');
    } finally {
      setIsSavingTemplate(false);
    }
  };

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
      sellerId: initialReservation?.sellerId || null,
      sellerName: initialReservation?.sellerName || null,
    }, {
      send: sendMessage && !!messagePreview,
      content: messagePreview,
      template: messageDraft,
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

        <section className="rounded-ios-lg border app-border app-surface-soft p-3 space-y-3">
          <label className="flex items-start gap-2.5 cursor-pointer" htmlFor="reservation-send-message">
            <input
              id="reservation-send-message"
              type="checkbox"
              className="mt-0.5 h-4 w-4 shrink-0 accent-brand-600"
              checked={sendMessage}
              onChange={(event) => setSendMessage(event.target.checked)}
              disabled={isSaving}
            />
            <span className="min-w-0">
              <span className="flex items-center gap-1.5 text-sm font-semibold app-text-primary">
                <MessageCircle size={15} aria-hidden="true" />
                {isEditing ? 'Reenviar mensagem ao cliente' : 'Enviar mensagem ao cliente'}
              </span>
              <span className="mt-0.5 block text-xs app-text-muted">
                {sendMessage
                  ? `Ao salvar, o CRM envia a mensagem abaixo no WhatsApp${customerPhone.trim() ? ` ${customerPhone.trim()}` : ''}.`
                  : 'Nenhuma mensagem será enviada nesta reserva.'}
              </span>
            </span>
          </label>

          {sendMessage && (
            <div className="space-y-3">
              <div>
                <label className="ios-label" htmlFor="reservation-message">Mensagem</label>
                <textarea
                  id="reservation-message"
                  ref={messageInputRef}
                  className="ios-input min-h-28 resize-y"
                  value={messageDraft}
                  onChange={(event) => {
                    setMessageDraft(event.target.value);
                    setTemplateFeedback('');
                  }}
                  placeholder="Escreva a mensagem de confirmação da reserva..."
                  disabled={isSaving}
                />
              </div>

              <div>
                <p className="text-xs font-medium app-text-muted" id="reservation-message-variables-label">
                  Toque para incluir dados desta reserva:
                </p>
                <div className="mt-1.5 flex flex-wrap gap-1.5" role="group" aria-labelledby="reservation-message-variables-label">
                  {RESERVATION_MESSAGE_VARIABLES.map((variable) => (
                    <button
                      key={variable.token}
                      type="button"
                      className="inline-flex items-center gap-1 rounded-full border app-border px-2.5 py-1 text-xs font-medium app-text-primary transition-colors hover:bg-brand-600/10 disabled:opacity-50"
                      onClick={() => insertMessageVariable(variable.token)}
                      title={variable.hint}
                      disabled={isSaving}
                    >
                      <Plus size={12} aria-hidden="true" />
                      {variable.label}
                    </button>
                  ))}
                </div>
                <p className="mt-1.5 text-xs app-text-muted">
                  Linhas com informação que esta reserva não tem (sem sinal, sem validade) saem da mensagem sozinhas.
                </p>
              </div>

              <div>
                <p className="ios-label" id="reservation-message-preview-label">Prévia</p>
                <p
                  className="whitespace-pre-line rounded-ios border app-border bg-white/70 p-2.5 text-sm app-text-primary dark:bg-black/20"
                  aria-labelledby="reservation-message-preview-label"
                  data-testid="reservation-message-preview"
                >
                  {messagePreview || 'A mensagem está vazia — nada será enviado.'}
                </p>
              </div>

              {onSaveMessageTemplate && (
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <button
                    type="button"
                    className="ios-button-secondary h-9 px-3 text-xs"
                    onClick={() => void handleSaveMessageTemplate()}
                    disabled={isSaving || isSavingTemplate}
                  >
                    {isSavingTemplate ? 'Salvando...' : 'Salvar como padrão'}
                  </button>
                  {templateFeedback && (
                    <span role="status" className="text-xs app-text-muted">{templateFeedback}</span>
                  )}
                </div>
              )}
            </div>
          )}
        </section>
      </div>
    </Modal>
  );
};

export default StockReservationModal;
