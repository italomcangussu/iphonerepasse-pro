import React, { useState } from 'react';
import { useData } from '../services/dataContext';
import { MapPin, Plus, Edit, Box, TrendingUp } from 'lucide-react';
import Modal from '../components/ui/Modal';
import { useToast } from '../components/ui/ToastProvider';
import { newId } from '../utils/id';

const Stores: React.FC = () => {
  const { stores, stock, addStore, updateStore } = useData();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [formData, setFormData] = useState({ id: '', name: '', city: '' });
  const [isEditing, setIsEditing] = useState(false);
  const toast = useToast();

  const handleOpenModal = (store?: any) => {
    if (store) {
      setFormData(store);
      setIsEditing(true);
    } else {
      setFormData({ id: '', name: '', city: '' });
      setIsEditing(false);
    }
    setIsModalOpen(true);
  };

  const handleSave = async () => {
    if (!formData.name || !formData.city) {
      toast.error('Preencha todos os campos.');
      return;
    }

    try {
      if (isEditing && formData.id) {
        await updateStore(formData.id, formData);
        toast.success('Loja atualizada.');
      } else {
        await addStore({ ...formData, id: newId('st') });
        toast.success('Loja criada.');
      }
      setIsModalOpen(false);
    } catch (error: any) {
      toast.error('Erro ao salvar loja: ' + (error.message || 'Erro desconhecido'));
    }
  };

  const getStoreStats = (storeId: string) => {
    const storeStock = stock.filter(s => s.storeId === storeId);
    const count = storeStock.length;
    const value = storeStock.reduce((acc, item) => acc + item.sellPrice, 0);
    return { count, value };
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-ios-large font-bold text-gray-900 dark:text-white">Lojas e Estoques</h2>
          <p className="text-ios-body text-gray-500 dark:text-surface-dark-500">Gerencie suas unidades físicas</p>
        </div>
        <button 
          onClick={() => handleOpenModal()}
          className="ios-button-primary flex items-center gap-2"
        >
          <Plus size={20} />
          Nova Loja
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {stores.map(store => {
          const stats = getStoreStats(store.id);
          return (
            <div key={store.id} className="ios-card-hover group">
              <div className="p-6">
                <div className="flex justify-between items-start mb-4">
                  <div className="p-3 bg-accent-100 rounded-ios-xl text-accent-600">
                    <MapPin size={24} />
                  </div>
                  <button 
                    onClick={() => handleOpenModal(store)}
                    className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-ios-lg opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <Edit size={18} />
                  </button>
                </div>
                
                <h3 className="text-ios-title-2 font-bold text-gray-900 dark:text-white mb-1">{store.name}</h3>
                <p className="text-ios-body text-gray-500 mb-6">{store.city}</p>
                
                <div className="grid grid-cols-2 gap-4 pt-4 border-t border-gray-200 dark:border-surface-dark-200">
                  <div>
                    <div className="flex items-center gap-2 text-gray-400 text-ios-footnote mb-1">
                      <Box size={14} />
                      <span>Em Estoque</span>
                    </div>
                    <p className="text-ios-title-3 font-bold text-gray-900 dark:text-white">{stats.count} itens</p>
                  </div>
                  <div>
                    <div className="flex items-center gap-2 text-gray-400 text-ios-footnote mb-1">
                      <TrendingUp size={14} />
                      <span>Valor</span>
                    </div>
                    <p className="text-ios-title-3 font-bold text-green-600">R$ {stats.value.toLocaleString('pt-BR')}</p>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <Modal
        open={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={isEditing ? 'Editar Loja' : 'Nova Loja'}
        size="md"
        footer={
          <div className="flex justify-end gap-3">
            <button type="button" className="ios-button-secondary" onClick={() => setIsModalOpen(false)}>
              Cancelar
            </button>
            <button type="button" className="ios-button-primary" onClick={handleSave}>
              Salvar Loja
            </button>
          </div>
        }
      >
        <div className="space-y-4">
          <div>
            <label className="ios-label">Nome da Loja</label>
            <input
              type="text"
              className="ios-input"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="Ex: Matriz"
            />
          </div>
          <div>
            <label className="ios-label">Cidade</label>
            <input
              type="text"
              className="ios-input"
              value={formData.city}
              onChange={(e) => setFormData({ ...formData, city: e.target.value })}
              placeholder="Ex: Sobral - CE"
            />
          </div>
        </div>
      </Modal>
    </div>
  );
};

export default Stores;
