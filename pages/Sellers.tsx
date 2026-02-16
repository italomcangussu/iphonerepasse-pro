import React, { useState } from 'react';
import { useData } from '../services/dataContext';
import { Plus, Award, User, Mail, MapPin } from 'lucide-react';
import Modal from '../components/ui/Modal';
import { useToast } from '../components/ui/ToastProvider';
import { adminProvisionUser } from '../services/adminProvision';
import type { Seller } from '../types';

const Sellers: React.FC = () => {
  const { sellers, stores, addSeller, updateSeller, refreshData } = useData();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [formData, setFormData] = useState({ id: '', name: '', email: '', password: '', storeId: '', authUserId: '' });
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const toast = useToast();

  const getStoreName = (storeId: string) => stores.find(store => store.id === storeId)?.name || 'Sem loja';

  const handleOpenModal = (seller?: Seller) => {
    if (seller) {
      setFormData({
        id: seller.id,
        name: seller.name,
        email: seller.email || '',
        password: '',
        storeId: seller.storeId || '',
        authUserId: seller.authUserId || ''
      });
      setIsEditing(true);
    } else {
      setFormData({ id: '', name: '', email: '', password: '', storeId: '', authUserId: '' });
      setIsEditing(false);
    }
    setIsModalOpen(true);
  };

  const handleSave = async () => {
    const name = formData.name.trim();
    const email = formData.email.trim();
    const password = formData.password;
    const hasEmail = !!email;
    const hasPassword = !!password;

    if (!name) {
      toast.error('Preencha o nome do vendedor.');
      return;
    }

    if (!formData.storeId) {
      toast.error('Selecione a loja do vendedor.');
      return;
    }

    if (hasEmail !== hasPassword) {
      toast.error('Preencha email e senha juntos, ou deixe ambos em branco.');
      return;
    }

    if (hasPassword && password.length < 6) {
      toast.error('A senha deve ter no mínimo 6 caracteres.');
      return;
    }

    if (isEditing && formData.authUserId && hasPassword) {
      toast.error('Este vendedor já possui acesso. Defina nova senha pelo fluxo de recuperação.');
      return;
    }

    setIsSaving(true);
    try {
      if (isEditing && formData.id) {
        if (!formData.authUserId && hasEmail && hasPassword) {
          await adminProvisionUser({
            sellerId: formData.id,
            email,
            password,
            role: 'seller',
            name,
            storeId: formData.storeId
          });
          await refreshData();
          toast.success('Acesso do vendedor criado com sucesso.');
        } else {
          await updateSeller(formData.id, { name, email, storeId: formData.storeId });
          toast.success('Vendedor atualizado.');
        }
      } else {
        if (hasEmail && hasPassword) {
          await adminProvisionUser({
            email,
            password,
            role: 'seller',
            name,
            storeId: formData.storeId
          });
          await refreshData();
          toast.success('Vendedor criado com acesso ao app.');
        } else {
          await addSeller({
            id: '',
            name,
            email: '',
            authUserId: '',
            storeId: formData.storeId,
            totalSales: 0
          });
          toast.success('Vendedor criado sem acesso. Você pode preencher email e senha depois.');
        }
      }
      setIsModalOpen(false);
    } catch (error: any) {
      toast.error(error?.message || 'Não foi possível salvar vendedor.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-5 md:space-y-6 max-w-7xl mx-auto">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 md:gap-4">
        <div>
          <h2 className="text-[28px] md:text-ios-large font-bold text-gray-900 dark:text-white tracking-tight">Vendedores</h2>
          <p className="text-ios-subhead text-gray-500 dark:text-surface-dark-500 mt-0.5">Gerencie sua equipe de vendas</p>
        </div>
        <button 
          onClick={() => handleOpenModal()}
          className="ios-button-primary flex items-center gap-2"
        >
          <Plus size={20} />
          Novo Vendedor
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {sellers.map((seller, index) => (
          <div key={seller.id} className="ios-card-hover group relative">
            {index === 0 && sellers.length > 1 && (
              <div className="absolute top-0 right-0 p-2">
                <div className="bg-accent-100 text-accent-600 p-1.5 rounded-ios-lg" title="Top Vendedor">
                  <Award size={20} />
                </div>
              </div>
            )}
            
            <div className="p-6 text-center">
              <div className="w-20 h-20 mx-auto rounded-full bg-linear-to-br from-brand-500 to-accent-500 flex items-center justify-center mb-4">
                <User size={40} className="text-white" />
              </div>
              
              <h3 className="text-ios-title-3 font-bold text-gray-900 dark:text-white mb-1">{seller.name}</h3>
              <p className="text-ios-body text-gray-500 mb-4 flex items-center justify-center gap-1">
                <Mail size={14} />
                <span className="truncate">{seller.email || 'Sem email'}</span>
              </p>
              <p className="text-ios-footnote text-gray-500 mb-4 flex items-center justify-center gap-1">
                <MapPin size={13} />
                <span className="truncate">{getStoreName(seller.storeId)}</span>
              </p>
              
              <div className="ios-card p-3 bg-gray-50 dark:bg-surface-dark-200 mb-4">
                <p className="text-ios-footnote text-gray-500 mb-1">Total em Vendas</p>
                <p className="text-ios-title-2 font-bold text-green-600">R$ {seller.totalSales.toLocaleString('pt-BR')}</p>
              </div>

              <button 
                onClick={() => handleOpenModal(seller)}
                className="w-full ios-button-secondary text-ios-subhead"
              >
                Editar
              </button>
            </div>
          </div>
        ))}
      </div>

      <Modal
        open={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={isEditing ? 'Editar Vendedor' : 'Novo Vendedor'}
        size="sm"
        footer={
          <div className="flex justify-end gap-3">
            <button type="button" className="ios-button-secondary" onClick={() => setIsModalOpen(false)}>
              Cancelar
            </button>
            <button type="button" className="ios-button-primary" onClick={handleSave} disabled={isSaving}>
              {isSaving ? 'Salvando...' : 'Salvar Vendedor'}
            </button>
          </div>
        }
      >
        <div className="space-y-4">
          <div>
            <label className="ios-label">Nome do Vendedor</label>
            <input
              type="text"
              className="ios-input"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="Nome Completo"
            />
          </div>
          <div>
            <label className="ios-label">Loja</label>
            <select
              className="ios-input"
              value={formData.storeId}
              onChange={(e) => setFormData({ ...formData, storeId: e.target.value })}
            >
              <option value="">Selecione a loja...</option>
              {stores.map((store) => (
                <option key={store.id} value={store.id}>
                  {store.name} ({store.city})
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="ios-label">Email de acesso</label>
            <input
              type="email"
              className="ios-input"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              placeholder="vendedor@email.com"
            />
          </div>
          {!formData.authUserId && (
            <div>
              <label className="ios-label">Senha de acesso</label>
              <input
                type="password"
                className="ios-input"
                value={formData.password}
                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                placeholder="Mínimo de 6 caracteres (opcional)"
              />
            </div>
          )}
          <p className="text-xs text-gray-500 dark:text-surface-dark-500">
            Email e senha são opcionais. Se preencher os dois, o vendedor recebe acesso ao app.
          </p>
        </div>
      </Modal>
    </div>
  );
};

export default Sellers;
