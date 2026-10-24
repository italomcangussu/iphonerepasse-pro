import React from 'react';
import { Combobox } from '../../../components/ui/Combobox';
import type { Customer, Seller } from '../../../types';
import { formatPhone } from '../../../utils/inputMasks';
import { MoneyInput } from './QuoteControls';
import type { QuoteCustomerDraft } from './useQuoteDraft';

interface QuoteCustomerCardProps {
  customers: Customer[];
  sellers: Seller[];
  customer: QuoteCustomerDraft;
  sellerName: string;
  discount: number;
  subtotal: number;
  showDiscount: boolean;
  notes: string;
  onCustomerChange: (customer: QuoteCustomerDraft) => void;
  onSellerChange: (name: string) => void;
  onDiscountChange: (discount: number) => void;
  onNotesChange: (notes: string) => void;
}

export function QuoteCustomerCard(props: QuoteCustomerCardProps) {
  const { customers, sellers, customer, sellerName, discount, subtotal, showDiscount, notes } = props;
  const discountTooHigh = discount > subtotal && subtotal > 0;

  const pickCustomer = (id: string) => {
    const picked = customers.find((entry) => entry.id === id);
    if (picked) props.onCustomerChange({ customerId: picked.id, name: picked.name, phone: picked.phone });
  };

  return (
    <section aria-labelledby="quote-customer-title" className="ios-card p-4 md:p-5 space-y-4">
      <h2 id="quote-customer-title" className="text-[17px] font-bold app-text-primary">
        Cliente e detalhes <span className="text-sm font-normal app-text-muted">· opcional</span>
      </h2>

      <Combobox
        label="Buscar cliente cadastrado"
        placeholder="Nome ou CPF…"
        value={customer.customerId ?? ''}
        onChange={pickCustomer}
        options={customers.map((entry) => ({ id: entry.id, label: entry.name, subLabel: entry.phone ? formatPhone(entry.phone) : entry.cpf }))}
      />

      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label htmlFor="quote-customer-name" className="ios-label">Nome do cliente</label>
          <input id="quote-customer-name" type="text" autoComplete="off" value={customer.name} placeholder="Como aparece no orçamento"
            onChange={(event) => props.onCustomerChange({ ...customer, customerId: null, name: event.target.value })} className="ios-input" />
        </div>
        <div>
          <label htmlFor="quote-customer-phone" className="ios-label">WhatsApp</label>
          <input id="quote-customer-phone" type="tel" inputMode="tel" autoComplete="off" value={formatPhone(customer.phone)} placeholder="(00) 00000-0000"
            onChange={(event) => props.onCustomerChange({ ...customer, phone: event.target.value.replace(/\D/g, '').slice(0, 11) })} className="ios-input" />
        </div>
      </div>

      <div className={`grid gap-3 ${showDiscount ? 'sm:grid-cols-2' : ''}`}>
        <Combobox
          label="Atendimento"
          placeholder="Vendedor"
          value={sellers.find((seller) => seller.name === sellerName)?.id ?? ''}
          onChange={(id) => props.onSellerChange(sellers.find((seller) => seller.id === id)?.name ?? '')}
          options={sellers.map((seller) => ({ id: seller.id, label: seller.name }))}
        />
        {showDiscount && (
          <div>
            <label htmlFor="quote-discount" className="ios-label">Desconto no total</label>
            <MoneyInput id="quote-discount" value={discount} onChange={props.onDiscountChange} invalid={discountTooHigh}
              describedBy={discountTooHigh ? 'quote-discount-hint' : undefined} />
            {discountTooHigh && <p id="quote-discount-hint" className="mt-1 text-xs text-amber-700 dark:text-amber-400">O desconto foi limitado ao subtotal.</p>}
          </div>
        )}
      </div>

      <div>
        <label htmlFor="quote-notes" className="ios-label">Observações <span className="font-normal app-text-muted">(aparecem no orçamento)</span></label>
        <textarea id="quote-notes" rows={3} value={notes} placeholder="Ex.: aparelho com garantia de 90 dias, acompanha cabo."
          onChange={(event) => props.onNotesChange(event.target.value)} className="ios-input min-h-[88px] py-3" />
      </div>
    </section>
  );
}
