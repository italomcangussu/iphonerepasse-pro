import React, { useState } from 'react';
import Modal from './ui/Modal';
import { useData } from '../services/dataContext';
import { useToast } from './ui/ToastProvider';
import { adminProvisionUser } from '../services/adminProvision';

interface AddSellerModalProps {
  open: boolean;
  onClose: () => void;
  onSellerAdded: (sellerId: string) => void;
}

export const AddSellerModal: React.FC<AddSellerModalProps> = ({ open, onClose, onSellerAdded }) => {
  const { refreshData } = useData();
  const toast = useToast();

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!name.trim() || !email.trim()) {
      toast.error('Nome e email são obrigatórios');
      return;
    }

    if (password.length < 6) {
      toast.error('A senha deve ter no mínimo 6 caracteres.');
      return;
    }

    setIsSubmitting(true);
    try {
      const result = await adminProvisionUser({
        email: email.trim(),
        password,
        role: 'seller',
        name: name.trim()
      });

      await refreshData();

      if (result.seller?.id) {
        onSellerAdded(result.seller.id);
      }

      toast.success('Vendedor cadastrado com sucesso!');
      setName('');
      setEmail('');
      setPassword('');
      onClose();
    } catch (error: any) {
      toast.error(error?.message || 'Não foi possível cadastrar vendedor.');
    } finally {
      setIsSubmitting(false);
    }
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
        <div>
          <label className="ios-label">Email de Acesso *</label>
          <input
            type="email"
            required
            className="ios-input"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="vendedor@email.com"
          />
        </div>
        <div>
          <label className="ios-label">Senha Inicial *</label>
          <input
            type="password"
            required
            className="ios-input"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Mínimo de 6 caracteres"
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
            disabled={isSubmitting}
          >
            {isSubmitting ? 'Cadastrando...' : 'Cadastrar Vendedor'}
          </button>
        </div>
      </form>
    </Modal>
  );
};
