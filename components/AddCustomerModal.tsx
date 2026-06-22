import React, { useState } from 'react';
import Modal from './ui/Modal';
import { Customer } from '../types';
import { useData } from '../services/dataContext';
import { newId } from '../utils/id';
import { useToast } from './ui/ToastProvider';
import { formatCpf, formatPhone } from '../utils/inputMasks';

interface AddCustomerModalProps {
  open: boolean;
  onClose: () => void;
  onCustomerAdded: (customerId: string) => void;
}

export const AddCustomerModal: React.FC<AddCustomerModalProps> = ({ open, onClose, onCustomerAdded }) => {
  const { addCustomer } = useData();
  const toast = useToast();

  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [cpf, setCpf] = useState('');
  const [birthDate, setBirthDate] = useState('');
  const [fieldErrors, setFieldErrors] = useState<{ name?: string }>({});

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const normalizedName = name.trim().toUpperCase();

    if (!normalizedName) {
      setFieldErrors({ name: 'Informe o nome completo do cliente.' });
      return;
    }
    setFieldErrors({});

    const newCustomer: Customer = {
      id: newId('cust'),
      name: normalizedName,
      phone,
      email,
      cpf,
      birthDate: birthDate || undefined,
      purchases: 0,
      totalSpent: 0
    };

    try {
      await addCustomer(newCustomer);
      onCustomerAdded(newCustomer.id);
      toast.success('Cliente cadastrado com sucesso!');
      setName('');
      setPhone('');
      setEmail('');
      setCpf('');
      setBirthDate('');
      onClose();
    } catch (error: any) {
      toast.error(error?.message || 'Não foi possível cadastrar o cliente. Tente novamente.');
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Novo Cliente"
      centered={false}
    >
      <form onSubmit={handleSubmit} className="space-y-4" noValidate>
        <div>
          <label htmlFor="new-customer-name" className="ios-label">Nome Completo *</label>
          <input
            id="new-customer-name"
            type="text"
            required
            aria-invalid={!!fieldErrors.name}
            aria-describedby={fieldErrors.name ? 'new-customer-name-error' : undefined}
            className={`ios-input ${fieldErrors.name ? 'ios-input-error' : ''}`}
            value={name}
            onChange={(e) => {
              setName(e.target.value.toUpperCase());
              if (fieldErrors.name) setFieldErrors((prev) => ({ ...prev, name: undefined }));
            }}
            placeholder="Ex: João da Silva"
          />
          {fieldErrors.name && (
            <p id="new-customer-name-error" role="alert" className="mt-1 text-ios-footnote text-red-600 dark:text-red-400">
              {fieldErrors.name}
            </p>
          )}
        </div>
        
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="min-w-0">
            <label htmlFor="new-customer-phone" className="ios-label">Telefone</label>
            <input
              id="new-customer-phone"
              type="tel"
              className="ios-input"
              value={phone}
              maxLength={15}
              onChange={(e) => setPhone(formatPhone(e.target.value))}
              placeholder="(00) 00000-0000"
            />
          </div>
          <div className="min-w-0">
            <label htmlFor="new-customer-cpf" className="ios-label">CPF</label>
            <input
              id="new-customer-cpf"
              type="text"
              className="ios-input"
              value={cpf}
              maxLength={14}
              onChange={(e) => setCpf(formatCpf(e.target.value))}
              placeholder="000.000.000-00"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="min-w-0">
            <label htmlFor="new-customer-birth-date" className="ios-label">Data de Nascimento</label>
            <input
              id="new-customer-birth-date"
              type="date"
              className="ios-input"
              value={birthDate}
              onChange={(e) => setBirthDate(e.target.value)}
            />
          </div>
          <div className="min-w-0">
            <label htmlFor="new-customer-email" className="ios-label">Email</label>
            <input
              id="new-customer-email"
              type="email"
              className="ios-input"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="cliente@email.com"
            />
          </div>
        </div>

        <div className="pt-4 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="ios-button-secondary"
          >
            Cancelar
          </button>
          <button
            type="submit"
            className="ios-button-primary"
          >
            Cadastrar Cliente
          </button>
        </div>
      </form>
    </Modal>
  );
};
