import React, { useState } from 'react';
import Modal from './ui/Modal';
import { Seller } from '../types';
import { useData } from '../services/dataContext';
import { newId } from '../utils/id';
import { useToast } from './ui/ToastProvider';

interface AddSellerModalProps {
  open: boolean;
  onClose: () => void;
  onSellerAdded: (sellerId: string) => void;
}

export const AddSellerModal: React.FC<AddSellerModalProps> = ({ open, onClose, onSellerAdded }) => {
  const { addSeller } = useData();
  const toast = useToast();

  const [name, setName] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!name.trim()) {
      toast.error('Nome é obrigatório');
      return;
    }

    const newSeller: Seller = {
      id: newId('sel'),
      name,
      totalSales: 0
    };

    addSeller(newSeller);
    onSellerAdded(newSeller.id);
    toast.success('Vendedor cadastrado com sucesso!');
    
    // Reset form
    setName('');
    onClose();
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Novo Vendedor"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="ios-label">Nome do Vendedor *</label>
          <input
            type="text"
            required
            className="ios-input"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Ex: Vendedor 01"
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
            Cadastrar Vendedor
          </button>
        </div>
      </form>
    </Modal>
  );
};
