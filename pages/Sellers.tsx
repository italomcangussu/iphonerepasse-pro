import React, { useState } from 'react';
import { useData } from '../services/dataContext';
import { Seller } from '../types';
import { Briefcase, Plus, Edit, Award, DollarSign, X } from 'lucide-react';

const Sellers: React.FC = () => {
  const { sellers, addSeller, updateSeller } = useData();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [formData, setFormData] = useState<Partial<Seller>>({ name: '' });
  const [isEditing, setIsEditing] = useState(false);

  const handleOpenModal = (seller?: Seller) => {
    if (seller) {
      setFormData(seller);
      setIsEditing(true);
    } else {
      setFormData({ name: '', totalSales: 0 });
      setIsEditing(false);
    }
    setIsModalOpen(true);
  };

  const handleSave = () => {
    if (!formData.name) return alert("Preencha o nome do vendedor");

    if (isEditing && formData.id) {
      updateSeller(formData.id, formData);
    } else {
      addSeller({
        ...formData as Seller,
        id: `sel-${Date.now()}`,
        totalSales: 0
      });
    }
    setIsModalOpen(false);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-white">Vendedores</h2>
          <p className="text-slate-400">Gerencie sua equipe de vendas</p>
        </div>
        <button 
          onClick={() => handleOpenModal()}
          className="bg-primary-600 hover:bg-primary-500 text-white px-6 py-3 rounded-xl flex items-center gap-2 font-medium transition-colors shadow-lg shadow-primary-500/20"
        >
          <Plus size={20} />
          Novo Vendedor
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {sellers.map((seller, index) => (
          <div key={seller.id} className="bg-dark-800 rounded-2xl border border-dark-700 overflow-hidden hover:border-primary-500/50 transition-all group relative">
            {index === 0 && (
              <div className="absolute top-0 right-0 p-2">
                <div className="bg-yellow-500/20 text-yellow-500 p-1.5 rounded-lg" title="Top Vendedor">
                  <Award size={20} />
                </div>
              </div>
            )}
            
            <div className="p-6 text-center">
              <div className="w-20 h-20 mx-auto rounded-full bg-gradient-to-br from-dark-700 to-dark-600 border border-dark-500 flex items-center justify-center mb-4">
                <span className="text-2xl font-bold text-slate-300">{seller.name.charAt(0).toUpperCase()}</span>
              </div>
              
              <h3 className="text-lg font-bold text-white mb-1">{seller.name}</h3>
              <p className="text-slate-400 text-sm mb-4">Vendedor</p>
              
              <div className="bg-dark-900 p-3 rounded-xl border border-dark-700 mb-4">
                <p className="text-xs text-slate-500 mb-1">Total em Vendas</p>
                <p className="text-lg font-bold text-green-400">R$ {seller.totalSales.toLocaleString()}</p>
              </div>

              <button 
                onClick={() => handleOpenModal(seller)}
                className="w-full py-2 rounded-lg border border-dark-600 text-slate-400 hover:text-white hover:bg-dark-700 text-sm font-medium transition-colors"
              >
                Editar
              </button>
            </div>
          </div>
        ))}
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="bg-dark-900 w-full max-w-sm rounded-2xl border border-dark-700 shadow-2xl">
            <div className="p-6 border-b border-dark-700 flex justify-between items-center bg-dark-800 rounded-t-2xl">
              <h3 className="text-xl font-bold text-white">{isEditing ? 'Editar Vendedor' : 'Novo Vendedor'}</h3>
              <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-white"><X size={24} /></button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-400 mb-1">Nome do Vendedor</label>
                <input 
                  type="text"
                  className="w-full bg-dark-800 border border-dark-600 rounded-lg p-3 text-white focus:border-primary-500 outline-none"
                  value={formData.name}
                  onChange={e => setFormData({...formData, name: e.target.value})}
                  placeholder="Nome Completo"
                />
              </div>
              <button 
                onClick={handleSave}
                className="w-full bg-primary-600 hover:bg-primary-500 text-white font-bold py-3 rounded-xl mt-4 transition-all"
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