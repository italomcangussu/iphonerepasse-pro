import React, { useState } from 'react';
import { useData } from '../services/dataContext';
import { Briefcase, Plus, Award, DollarSign, X, User } from 'lucide-react';

const Sellers: React.FC = () => {
  const { sellers, addSeller, updateSeller } = useData();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [formData, setFormData] = useState({ id: '', name: '' });
  const [isEditing, setIsEditing] = useState(false);

  const handleOpenModal = (seller?: any) => {
    if (seller) {
      setFormData(seller);
      setIsEditing(true);
    } else {
      setFormData({ id: '', name: '' });
      setIsEditing(false);
    }
    setIsModalOpen(true);
  };

  const handleSave = () => {
    if (!formData.name) {
      alert("Preencha o nome do vendedor");
      return;
    }

    if (isEditing && formData.id) {
      updateSeller(formData.id, formData);
    } else {
      addSeller({ ...formData, id: `sel-${Date.now()}`, totalSales: 0 });
    }
    setIsModalOpen(false);
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-ios-large font-bold text-gray-900 dark:text-white">Vendedores</h2>
          <p className="text-ios-body text-gray-500 dark:text-surface-dark-500">Gerencie sua equipe de vendas</p>
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
              <div className="w-20 h-20 mx-auto rounded-full bg-gradient-to-br from-brand-500 to-accent-500 flex items-center justify-center mb-4">
                <User size={40} className="text-white" />
              </div>
              
              <h3 className="text-ios-title-3 font-bold text-gray-900 dark:text-white mb-1">{seller.name}</h3>
              <p className="text-ios-body text-gray-500 mb-4">Vendedor</p>
              
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

      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4" onClick={() => setIsModalOpen(false)}>
          <div className="bg-white dark:bg-surface-dark-100 w-full max-w-sm rounded-ios-xl shadow-ios-xl" onClick={(e) => e.stopPropagation()}>
            <div className="p-6 border-b border-gray-200 dark:border-surface-dark-200 bg-gray-50 dark:bg-surface-dark-200 flex justify-between items-center">
              <h3 className="text-ios-title-2 font-bold text-gray-900 dark:text-white">{isEditing ? 'Editar Vendedor' : 'Novo Vendedor'}</h3>
              <button onClick={() => setIsModalOpen(false)} className="p-2 hover:bg-gray-200 rounded-full">
                <X size={24} className="text-gray-500" />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="ios-label">Nome do Vendedor</label>
                <input 
                  type="text"
                  className="ios-input"
                  value={formData.name}
                  onChange={e => setFormData({...formData, name: e.target.value})}
                  placeholder="Nome Completo"
                />
              </div>
              <button 
                onClick={handleSave}
                className="w-full ios-button-primary"
              >
                Salvar Vendedor
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Sellers;
