import React, { useState } from 'react';
import { useData } from '../services/dataContext';
import { StoreLocation, StockStatus } from '../types';
import { MapPin, Plus, Edit, Box, TrendingUp, X } from 'lucide-react';

const Stores: React.FC = () => {
  const { stores, stock, addStore, updateStore } = useData();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [formData, setFormData] = useState<Partial<StoreLocation>>({ name: '', city: '' });
  const [isEditing, setIsEditing] = useState(false);

  const handleOpenModal = (store?: StoreLocation) => {
    if (store) {
      setFormData(store);
      setIsEditing(true);
    } else {
      setFormData({ name: '', city: '' });
      setIsEditing(false);
    }
    setIsModalOpen(true);
  };

  const handleSave = () => {
    if (!formData.name || !formData.city) return alert("Preencha todos os campos");

    if (isEditing && formData.id) {
      updateStore(formData.id, formData);
    } else {
      addStore({
        ...formData as StoreLocation,
        id: `st-${Date.now()}`
      });
    }
    setIsModalOpen(false);
  };

  // Helper to calculate stock value per store
  const getStoreStats = (storeName: string) => {
    const storeStock = stock.filter(s => s.storeLocation === storeName && s.status === StockStatus.AVAILABLE);
    const count = storeStock.length;
    const value = storeStock.reduce((acc, item) => acc + item.sellPrice, 0);
    return { count, value };
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-white">Lojas e Estoques</h2>
          <p className="text-slate-400">Gerencie suas unidades físicas</p>
        </div>
        <button 
          onClick={() => handleOpenModal()}
          className="bg-primary-600 hover:bg-primary-500 text-white px-6 py-3 rounded-xl flex items-center gap-2 font-medium transition-colors shadow-lg shadow-primary-500/20"
        >
          <Plus size={20} />
          Nova Loja
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {stores.map(store => {
          const stats = getStoreStats(store.name);
          return (
            <div key={store.id} className="bg-dark-800 rounded-2xl border border-dark-700 overflow-hidden hover:border-primary-500/50 transition-all group">
              <div className="p-6">
                <div className="flex justify-between items-start mb-4">
                  <div className="p-3 bg-accent-500/20 rounded-xl text-accent-500">
                    <MapPin size={24} />
                  </div>
                  <button 
                    onClick={() => handleOpenModal(store)}
                    className="p-2 text-slate-400 hover:text-white hover:bg-dark-700 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <Edit size={18} />
                  </button>
                </div>
                
                <h3 className="text-xl font-bold text-white mb-1">{store.name}</h3>
                <p className="text-slate-400 mb-6">{store.city}</p>
                
                <div className="grid grid-cols-2 gap-4 pt-4 border-t border-dark-700">
                  <div>
                    <div className="flex items-center gap-2 text-slate-500 text-xs mb-1">
                      <Box size={14} />
                      <span>Em Estoque</span>
                    </div>
                    <p className="text-lg font-bold text-white">{stats.count} itens</p>
                  </div>
                  <div>
                    <div className="flex items-center gap-2 text-slate-500 text-xs mb-1">
                      <TrendingUp size={14} />
                      <span>Valor em Venda</span>
                    </div>
                    <p className="text-lg font-bold text-green-400">R$ {stats.value.toLocaleString()}</p>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="bg-dark-900 w-full max-w-md rounded-2xl border border-dark-700 shadow-2xl">
            <div className="p-6 border-b border-dark-700 flex justify-between items-center bg-dark-800 rounded-t-2xl">
              <h3 className="text-xl font-bold text-white">{isEditing ? 'Editar Loja' : 'Nova Loja'}</h3>
              <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-white"><X size={24} /></button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-400 mb-1">Nome da Loja (Estoque)</label>
                <input 
                  type="text"
                  className="w-full bg-dark-800 border border-dark-600 rounded-lg p-3 text-white focus:border-primary-500 outline-none"
                  value={formData.name}
                  onChange={e => setFormData({...formData, name: e.target.value})}
                  placeholder="Ex: Matriz"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-400 mb-1">Cidade</label>
                <input 
                  type="text"
                  className="w-full bg-dark-800 border border-dark-600 rounded-lg p-3 text-white focus:border-primary-500 outline-none"
                  value={formData.city}
                  onChange={e => setFormData({...formData, city: e.target.value})}
                  placeholder="Ex: Sobral - CE"
                />
              </div>
              <button 
                onClick={handleSave}
                className="w-full bg-primary-600 hover:bg-primary-500 text-white font-bold py-3 rounded-xl mt-4 transition-all"
              >
                Salvar Loja
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Stores;