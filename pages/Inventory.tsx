import React, { useState, useEffect } from 'react';
import { useData } from '../services/dataContext';
import { StockItem, DeviceType, Condition, StockStatus, WarrantyType } from '../types';
import { APPLE_MODELS, COLORS, CAPACITIES } from '../constants';
import { Plus, Search, Filter, Smartphone, Battery, Edit, DollarSign, Camera, X } from 'lucide-react';
import BatterySlider from '../components/BatterySlider';

const Inventory: React.FC = () => {
  const { stock, addStockItem, updateStockItem, stores } = useData();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'list' | 'prep'>('list');
  const [searchTerm, setSearchTerm] = useState('');
  
  // Form State
  const initialFormState: Partial<StockItem> = {
    type: DeviceType.IPHONE,
    condition: Condition.USED,
    status: StockStatus.AVAILABLE,
    storeLocation: stores.length > 0 ? stores[0].name : '',
    batteryHealth: 100,
    warrantyType: WarrantyType.STORE,
    costs: [],
    photos: [],
    origin: '',
    notes: ''
  };
  const [formData, setFormData] = useState<Partial<StockItem>>(initialFormState);

  // Update store location if stores change or on mount
  useEffect(() => {
    if (stores.length > 0 && !formData.storeLocation) {
        setFormData(prev => ({...prev, storeLocation: stores[0].name}));
    }
  }, [stores, formData.storeLocation]);

  const filteredStock = stock.filter(item => {
    const matchesSearch = item.model.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          item.imei.includes(searchTerm);
    const matchesTab = activeTab === 'prep' ? item.status === StockStatus.PREPARATION : item.status !== StockStatus.PREPARATION;
    return matchesSearch && matchesTab;
  });

  const handleSave = () => {
    if (!formData.model || formData.sellPrice === undefined) return alert("Preencha os campos obrigatórios (Modelo e Preço de Venda)");
    
    const purchasePrice = Number(formData.purchasePrice || 0);
    const sellPrice = Number(formData.sellPrice);

    if (purchasePrice < 0) return alert("O preço de aquisição deve ser um valor positivo.");
    if (sellPrice < 0) return alert("O preço de venda deve ser um valor positivo.");

    const newItem: StockItem = {
      ...formData as StockItem,
      id: Math.random().toString(36).substr(2, 9),
      entryDate: new Date().toISOString(),
      costs: formData.costs || [],
      photos: formData.photos || []
    };
    
    addStockItem(newItem);
    setIsModalOpen(false);
    setFormData({
        ...initialFormState,
        storeLocation: stores.length > 0 ? stores[0].name : ''
    });
  };

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const newPhotos = await Promise.all(
        Array.from(e.target.files).map((file: File) => new Promise<string>((resolve) => {
          const reader = new FileReader();
          reader.onloadend = () => resolve(reader.result as string);
          reader.readAsDataURL(file);
        }))
      );
      
      setFormData(prev => ({
        ...prev,
        photos: [...(prev.photos || []), ...newPhotos]
      }));
    }
  };

  const removePhoto = (index: number) => {
    setFormData(prev => ({
      ...prev,
      photos: (prev.photos || []).filter((_, i) => i !== index)
    }));
  };

  const calculateProfit = () => {
    const sell = Number(formData.sellPrice) || 0;
    const buy = Number(formData.purchasePrice) || 0;
    const repairCosts = (formData.costs || []).reduce((acc, c) => acc + c.amount, 0);
    return sell - buy - repairCosts;
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-white">Estoque de Aparelhos</h2>
          <p className="text-slate-400">Gerencie seu inventário de novos e seminovos</p>
        </div>
        <button 
          onClick={() => setIsModalOpen(true)}
          className="bg-primary-600 hover:bg-primary-500 text-white px-6 py-3 rounded-xl flex items-center gap-2 font-medium transition-colors shadow-lg shadow-primary-500/20"
        >
          <Plus size={20} />
          Adicionar Aparelho
        </button>
      </div>

      <div className="flex gap-4 border-b border-dark-700">
        <button 
          onClick={() => setActiveTab('list')}
          className={`pb-3 px-2 font-medium transition-colors relative ${activeTab === 'list' ? 'text-primary-500' : 'text-slate-500'}`}
        >
          Disponíveis
          {activeTab === 'list' && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary-500 rounded-t-full" />}
        </button>
        <button 
          onClick={() => setActiveTab('prep')}
          className={`pb-3 px-2 font-medium transition-colors relative ${activeTab === 'prep' ? 'text-primary-500' : 'text-slate-500'}`}
        >
          Em Preparação
          {activeTab === 'prep' && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary-500 rounded-t-full" />}
        </button>
      </div>

      <div className="flex gap-4 mb-6">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={20} />
          <input 
            type="text" 
            placeholder="Buscar por modelo ou IMEI..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-dark-800 border border-dark-700 rounded-xl py-3 pl-10 pr-4 text-white focus:outline-none focus:border-primary-500 focus:ring-1 focus:ring-primary-500 transition-all"
          />
        </div>
        <button className="bg-dark-800 border border-dark-700 p-3 rounded-xl text-slate-400 hover:text-white hover:border-slate-500 transition-colors">
          <Filter size={20} />
        </button>
      </div>

      {filteredStock.length === 0 ? (
          <div className="text-center py-20 bg-dark-800/50 rounded-2xl border border-dashed border-dark-700">
              <Smartphone size={48} className="mx-auto mb-4 text-slate-600" />
              <h3 className="text-lg font-medium text-slate-400">Nenhum aparelho encontrado</h3>
              <p className="text-slate-500 text-sm mt-1">Adicione novos itens ao seu estoque ou ajuste os filtros.</p>
          </div>
      ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredStock.map(item => (
              <div key={item.id} className="bg-dark-800 rounded-2xl border border-dark-700 overflow-hidden group hover:border-primary-500/50 transition-all">
                <div className="relative h-48 bg-dark-900 flex items-center justify-center overflow-hidden">
                  {item.photos && item.photos.length > 0 ? (
                    <img src={item.photos[0]} alt={item.model} className="w-full h-full object-cover" />
                  ) : (
                    <Smartphone size={48} className="text-dark-700" />
                  )}
                  <div className="absolute inset-0 bg-gradient-to-t from-dark-900 to-transparent opacity-60"></div>
                  <div className="absolute bottom-4 left-5 right-5 flex justify-between items-end">
                      <span className={`px-2 py-1 text-xs font-bold rounded uppercase backdrop-blur-md ${
                        item.condition === Condition.NEW ? 'bg-blue-500/40 text-blue-100' : 'bg-orange-500/40 text-orange-100'
                      }`}>
                        {item.condition}
                      </span>
                      <span className="text-xs text-white px-2 py-1 bg-dark-800/80 backdrop-blur-md rounded border border-dark-600">
                        {item.storeLocation}
                      </span>
                  </div>
                </div>
                
                <div className="p-5">
                  <div className="flex justify-between items-start mb-2">
                     <div>
                        <h3 className="text-lg font-bold text-white mb-0.5">{item.model}</h3>
                        <p className="text-slate-400 text-sm">{item.capacity} • {item.color}</p>
                     </div>
                     <button className="p-1.5 hover:bg-dark-700 rounded text-slate-400 hover:text-white">
                        <Edit size={16} />
                     </button>
                  </div>
                  
                  <div className="flex items-center justify-between mb-4 mt-4">
                    {item.condition === Condition.USED && item.batteryHealth && (
                      <div className="flex items-center gap-1.5 text-sm font-medium" style={{
                        color: item.batteryHealth > 89 ? '#22c55e' : item.batteryHealth > 79 ? '#eab308' : '#ef4444'
                      }}>
                        <Battery size={16} />
                        {item.batteryHealth}%
                      </div>
                    )}
                    {item.condition === Condition.NEW && <span className="text-sm text-green-400 flex items-center gap-1"><Smartphone size={16} /> Lacrado</span>}
                    <span className="text-2xl font-bold text-white">R$ {item.sellPrice.toLocaleString()}</span>
                  </div>
                  
                  <div className="pt-4 border-t border-dark-700 grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-xs text-slate-500 mb-0.5">Custo Total</p>
                      <p className="text-sm font-medium text-slate-300">R$ {item.purchasePrice.toLocaleString()}</p>
                    </div>
                    <div>
                      <p className="text-xs text-slate-500 mb-0.5">Lucro Est.</p>
                      <p className="text-sm font-bold text-green-500">
                        R$ {(item.sellPrice - item.purchasePrice).toLocaleString()}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
      )}

      {/* Add Item Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="bg-dark-900 w-full max-w-4xl rounded-2xl border border-dark-700 shadow-2xl overflow-hidden max-h-[90vh] flex flex-col">
            <div className="p-6 border-b border-dark-700 flex justify-between items-center bg-dark-800">
              <h3 className="text-xl font-bold text-white">Cadastrar Aparelho</h3>
              <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-white"><Plus className="rotate-45" size={24} /></button>
            </div>
            
            <div className="p-6 overflow-y-auto space-y-8">
              {/* Type & Condition */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div>
                  <label className="block text-sm font-medium text-slate-400 mb-2">Tipo</label>
                  <select 
                    className="w-full bg-dark-800 border border-dark-600 rounded-lg p-3 text-white"
                    value={formData.type}
                    onChange={(e) => setFormData({...formData, type: e.target.value as DeviceType})}
                  >
                    {Object.values(DeviceType).map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-400 mb-2">Condição</label>
                  <div className="flex bg-dark-800 rounded-lg p-1 border border-dark-600">
                    {Object.values(Condition).map(c => (
                      <button 
                        key={c}
                        className={`flex-1 py-2 rounded-md text-sm font-medium transition-colors ${formData.condition === c ? 'bg-primary-600 text-white' : 'text-slate-400 hover:text-white'}`}
                        onClick={() => setFormData({...formData, condition: c})}
                      >
                        {c}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                   <label className="block text-sm font-medium text-slate-400 mb-2">Loja (Estoque)</label>
                   <div className="flex bg-dark-800 rounded-lg p-1 border border-dark-600 overflow-x-auto scrollbar-hide">
                      {stores.length > 0 ? stores.map(store => (
                        <button
                          key={store.id}
                          className={`flex-1 py-2 px-3 whitespace-nowrap rounded-md text-sm font-medium transition-colors ${formData.storeLocation === store.name ? 'bg-accent-600 text-white' : 'text-slate-400 hover:text-white'}`}
                          onClick={() => setFormData({...formData, storeLocation: store.name})}
                        >
                          {store.name}
                        </button>
                      )) : (
                          <div className="w-full text-center text-xs text-slate-500 py-2">
                             Nenhuma loja cadastrada. <br/> Adicione em "Lojas".
                          </div>
                      )}
                   </div>
                </div>
              </div>

              {/* Model & Specs */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-slate-400 mb-2">Modelo</label>
                  <select 
                    className="w-full bg-dark-800 border border-dark-600 rounded-lg p-3 text-white"
                    value={formData.model || ''}
                    onChange={(e) => setFormData({...formData, model: e.target.value})}
                  >
                    <option value="">Selecione o modelo</option>
                    {APPLE_MODELS[formData.type as DeviceType]?.map(m => (
                      <option key={m} value={m}>{m}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-400 mb-2">Cor</label>
                  <select 
                    className="w-full bg-dark-800 border border-dark-600 rounded-lg p-3 text-white"
                    value={formData.color || ''}
                    onChange={(e) => setFormData({...formData, color: e.target.value})}
                  >
                    <option value="">Selecione a cor</option>
                    {COLORS.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                <div>
                   <label className="block text-sm font-medium text-slate-400 mb-2">Capacidade</label>
                   <div className="flex flex-wrap gap-2">
                     {CAPACITIES.map(cap => (
                       <button
                         key={cap}
                         onClick={() => setFormData({...formData, capacity: cap})}
                         className={`px-3 py-1.5 rounded-lg border text-sm transition-colors ${formData.capacity === cap ? 'bg-primary-600 border-primary-500 text-white' : 'border-dark-600 text-slate-400 hover:border-slate-500'}`}
                       >
                         {cap}
                       </button>
                     ))}
                   </div>
                </div>
                <div>
                   <label className="block text-sm font-medium text-slate-400 mb-2">IMEI / Serial</label>
                   <input 
                      type="text" 
                      className="w-full bg-dark-800 border border-dark-600 rounded-lg p-3 text-white focus:border-primary-500 outline-none"
                      value={formData.imei || ''}
                      onChange={(e) => setFormData({...formData, imei: e.target.value})}
                   />
                </div>
              </div>

              {/* Condition Specifics */}
              {formData.condition === Condition.USED && (
                <div className="bg-dark-800 p-4 rounded-xl border border-dark-600">
                  <BatterySlider 
                    value={formData.batteryHealth || 100} 
                    onChange={(val) => setFormData({...formData, batteryHealth: val})} 
                  />
                  
                  <div className="mt-4 pt-4 border-t border-dark-700">
                    <label className="block text-sm font-medium text-slate-400 mb-2">Destino Inicial</label>
                    <div className="flex gap-4">
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input 
                          type="radio" 
                          name="status" 
                          checked={formData.status === StockStatus.AVAILABLE}
                          onChange={() => setFormData({...formData, status: StockStatus.AVAILABLE})}
                          className="accent-primary-500"
                        />
                        <span className="text-white">Pronto para Venda</span>
                      </label>
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input 
                          type="radio" 
                          name="status" 
                          checked={formData.status === StockStatus.PREPARATION}
                          onChange={() => setFormData({...formData, status: StockStatus.PREPARATION})}
                          className="accent-primary-500"
                        />
                        <span className="text-white">Enviar para Preparação (Reparos/Limpeza)</span>
                      </label>
                    </div>
                  </div>
                </div>
              )}

              {/* PHOTOS UPLOAD */}
              <div className="bg-dark-800 p-6 rounded-xl border border-dark-700">
                <h4 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                  <Camera size={18} /> Fotos do Aparelho
                </h4>
                <div className="flex gap-4 overflow-x-auto pb-2 scrollbar-hide">
                  {(formData.photos || []).map((photo, idx) => (
                      <div key={idx} className="relative w-32 h-32 flex-shrink-0 rounded-xl overflow-hidden border border-dark-600 group">
                        <img src={photo} className="w-full h-full object-cover" alt={`Foto ${idx}`} />
                        <button onClick={() => removePhoto(idx)} className="absolute top-2 right-2 bg-red-500/80 text-white p-1 rounded-full opacity-0 group-hover:opacity-100 transition-all hover:bg-red-600">
                          <X size={14} />
                        </button>
                      </div>
                  ))}
                  
                  {/* Add Button Slot */}
                  <label className="w-32 h-32 flex-shrink-0 bg-dark-900 border-2 border-dashed border-dark-600 rounded-xl flex flex-col items-center justify-center cursor-pointer hover:border-primary-500 hover:bg-dark-800 transition-all group">
                      <div className="w-10 h-10 rounded-full bg-dark-800 flex items-center justify-center mb-2 group-hover:scale-110 transition-transform">
                        <Camera size={20} className="text-slate-400 group-hover:text-primary-500" />
                      </div>
                      <span className="text-xs text-slate-500 font-medium group-hover:text-white">Adicionar Foto</span>
                      <input type="file" accept="image/*" multiple className="hidden" onChange={handlePhotoUpload} />
                  </label>
                </div>
                <p className="text-xs text-slate-500 mt-2">
                  * Permita o acesso à câmera ou galeria quando solicitado pelo navegador.
                </p>
              </div>

              {/* Origin & Notes */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                 <div>
                   <label className="block text-sm font-medium text-slate-400 mb-2">Origem do Aparelho</label>
                   <input 
                      type="text" 
                      placeholder="Ex: Fornecedor SP, Troca cliente João"
                      className="w-full bg-dark-800 border border-dark-600 rounded-lg p-3 text-white focus:border-primary-500 outline-none"
                      value={formData.origin || ''}
                      onChange={(e) => setFormData({...formData, origin: e.target.value})}
                   />
                 </div>
                 <div>
                   <label className="block text-sm font-medium text-slate-400 mb-2">Observações</label>
                   <input 
                      type="text" 
                      placeholder="Ex: Detalhe na carcaça, acompanha caixa"
                      className="w-full bg-dark-800 border border-dark-600 rounded-lg p-3 text-white focus:border-primary-500 outline-none"
                      value={formData.notes || ''}
                      onChange={(e) => setFormData({...formData, notes: e.target.value})}
                   />
                 </div>
              </div>

              {/* Financials */}
              <div className="bg-dark-800/50 p-6 rounded-xl border border-dark-700">
                <h4 className="text-lg font-semibold text-white mb-4 flex items-center gap-2"><DollarSign size={18} /> Financeiro do Item</h4>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div>
                    <label className="block text-sm font-medium text-slate-400 mb-2">Preço de Aquisição</label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500">R$</span>
                      <input 
                        type="number"
                        min="0"
                        className="w-full bg-dark-900 border border-dark-600 rounded-lg p-3 pl-10 text-white outline-none focus:border-primary-500"
                        value={formData.purchasePrice || ''}
                        onChange={(e) => setFormData({...formData, purchasePrice: parseFloat(e.target.value)})}
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-400 mb-2">Preço de Venda</label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500">R$</span>
                      <input 
                        type="number"
                        min="0"
                        className="w-full bg-dark-900 border border-dark-600 rounded-lg p-3 pl-10 text-white outline-none focus:border-primary-500"
                        value={formData.sellPrice || ''}
                        onChange={(e) => setFormData({...formData, sellPrice: parseFloat(e.target.value)})}
                      />
                    </div>
                  </div>
                  <div>
                     <label className="block text-sm font-medium text-slate-400 mb-2">Lucro Projetado</label>
                     <div className="p-3 bg-dark-900 rounded-lg border border-dark-600">
                       <span className={`font-bold ${calculateProfit() >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                         R$ {calculateProfit().toLocaleString()}
                       </span>
                     </div>
                  </div>
                </div>
              </div>

            </div>
            
            <div className="p-6 border-t border-dark-700 bg-dark-800 flex justify-end gap-3">
               <button 
                 onClick={() => setIsModalOpen(false)}
                 className="px-6 py-3 rounded-xl font-medium text-slate-300 hover:bg-dark-700 transition-colors"
               >
                 Cancelar
               </button>
               <button 
                 onClick={handleSave}
                 className="px-8 py-3 rounded-xl font-bold bg-primary-600 text-white hover:bg-primary-500 shadow-lg shadow-primary-500/20 transition-all transform hover:scale-105"
               >
                 Salvar Aparelho
               </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Inventory;