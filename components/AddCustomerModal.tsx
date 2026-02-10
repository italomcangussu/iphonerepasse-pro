import React, { useState } from 'react';
import Modal from './ui/Modal';
import { Customer } from '../types';
import { useData } from '../services/dataContext';
import { newId } from '../utils/id';
import { useToast } from './ui/ToastProvider';

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

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!name.trim()) {
      toast.error('Nome é obrigatório');
      return;
    }

    const newCustomer: Customer = {
      id: newId('cust'),
      name,
      phone,
      email,
      cpf,
      birthDate: '', // Optional for quick add
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
            onChange={(e) => setName(e.target.value)}
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
              onChange={(e) => setPhone(e.target.value)}
              placeholder="(00) 00000-0000"
            />
          </div>
          <div>
            <label className="ios-label">CPF</label>
            <input
              type="text"
              className="ios-input"
              value={cpf}
              onChange={(e) => setCpf(e.target.value)}
              placeholder="000.000.000-00"
            />
          </div>
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
