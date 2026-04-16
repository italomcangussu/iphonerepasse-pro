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

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    const normalizedName = name.trim().toUpperCase();

    if (!normalizedName) {
      toast.error('Nome é obrigatório');
      return;
    }

    const newCustomer: Customer = {
      id: newId('cust'),
      name: normalizedName,
      phone,
      email,
      cpf,
      birthDate,
      purchases: 0,
      totalSpent: 0
    };

    addCustomer(newCustomer);
    onCustomerAdded(newCustomer.id);
    toast.success('Cliente cadastrado com sucesso!');
    
    // Reset form
    setName('');
    setPhone('');
    setEmail('');
    setCpf('');
    setBirthDate('');
    onClose();
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Novo Cliente"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="ios-label">Nome Completo *</label>
          <input
            type="text"
            required
            className="ios-input"
            value={name}
            onChange={(e) => setName(e.target.value.toUpperCase())}
            placeholder="Ex: João da Silva"
          />
        </div>
        
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="ios-label">Telefone</label>
            <input
              type="tel"
              className="ios-input"
              value={phone}
              maxLength={15}
              onChange={(e) => setPhone(formatPhone(e.target.value))}
              placeholder="(00) 00000-0000"
            />
          </div>
          <div>
            <label className="ios-label">CPF</label>
            <input
              type="text"
              className="ios-input"
              value={cpf}
              maxLength={14}
              onChange={(e) => setCpf(formatCpf(e.target.value))}
              placeholder="000.000.000-00"
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="ios-label">Data de Nascimento</label>
            <input
              type="date"
              className="ios-input"
              value={birthDate}
              onChange={(e) => setBirthDate(e.target.value)}
            />
          </div>
          <div>
            <label className="ios-label">Email</label>
            <input
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
