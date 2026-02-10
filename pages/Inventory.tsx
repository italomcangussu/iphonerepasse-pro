import React, { useState, useEffect, useMemo } from 'react';
import { useData, CostItem } from '../services/dataContext';
import { StockItem, DeviceType, Condition, StockStatus, WarrantyType } from '../types';
import { APPLE_MODELS, COLORS, CAPACITIES } from '../constants';
import { Plus, Search, Filter, Smartphone, Battery, Edit, DollarSign, Camera, X, ChevronDown, Wrench, History } from 'lucide-react';

const Inventory: React.FC = () => {
  const { stock, addStockItem, updateStockItem, stores, addCostToItem, getCostHistoryByModel } = useData();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'list' | 'prep'>('list');
  const [searchTerm, setSearchTerm] = useState('');
  const [showCostModal, setShowCostModal] = useState(false);
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);
  
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
  
  // Autocomplete states
  const [modelSearch, setModelSearch] = useState('');
  const [showModelSuggestions, setShowModelSuggestions] = useState(false);
  const [costHistory, setCostHistory] = useState<CostItem[]>([]);

  // Update store location if stores change
  useEffect(() => {
    if (stores.length > 0 && !formData.storeLocation) {
      setFormData(prev => ({...prev, storeLocation: stores[0].name}));
    }
  }, [stores, formData.storeLocation]);

  // Update cost history when model changes
  useEffect(() => {
    if (formData.model) {
      const history = getCostHistoryByModel(formData.model);
      setCostHistory(history.map(h => ({
        id: h.id,
        description: h.description,
        amount: h.amount,
        date: h.lastUsed
      })));
    }
  }, [formData.model, getCostHistoryByModel]);

  const filteredStock = stock.filter(item => {
    const matchesSearch = item.model.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          item.imei.includes(searchTerm);
    const matchesTab = activeTab === 'prep' ? item.status === StockStatus.PREPARATION : item.status !== StockStatus.PREPARATION;
    return matchesSearch && matchesTab;
  });

  const modelSuggestions = useMemo(() => {
    if (!modelSearch || modelSearch.length < 2) return [];
    const allModels = Object.values(APPLE_MODELS).flat();
    return allModels.filter(m => m.toLowerCase().includes(modelSearch.toLowerCase())).slice(0, 5);
  }, [modelSearch]);

  const handleSave = () => {
    if (!formData.model || formData.sellPrice === undefined) {
      alert("Preencha os campos obrigatórios (Modelo e Preço de Venda)");
      return;
    }
    
    const purchasePrice = Number(formData.purchasePrice || 0);
    const sellPrice = Number(formData.sellPrice);

    if (purchasePrice < 0) {
      alert("O preço de aquisição deve ser um valor positivo.");
      return;
    }
    if (sellPrice < 0) {
      alert("O preço de venda deve ser um valor positivo.");
      return;
    }

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
    setModelSearch('');
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

  const handleAddCostFromHistory = (cost: CostItem) => {
    setFormData(prev => ({
      ...prev,
      costs: [...(prev.costs || []), { ...cost, id: `cost-${Date.now()}`, date: new Date().toISOString() }]
    }));
  };

  const handleAddNewCost = () => {
    const description = prompt('Descrição do custo:');
    if (!description) return;
    const amount = parseFloat(prompt('Valor (R$):') || '0');
    if (amount > 0) {
      const newCost: CostItem = {
        id: `cost-${Date.now()}`,
        description,
        amount,
        date: new Date().toISOString()
      };
      setFormData(prev => ({
        ...prev,
        costs: [...(prev.costs || []), newCost]
      }));
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-ios-large font-bold text-gray-900 dark:text-white">Estoque de Aparelhos</h2>
          <p className="text-ios-body text-gray-500 dark:text-surface-dark-500 mt-1">Gerencie seu inventário de novos e seminovos</p>
        </div>
        <button 
          onClick={() => setIsModalOpen(true)}
          className="ios-button-primary flex items-center gap-2"
        >
          <Plus size={20} />
          Adicionar Aparelho
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-4 border-b border-gray-200 dark:border-surface-dark-200">
        <button 
          onClick={() => setActiveTab('list')}
          className={`pb-3 px-2 font-medium transition-colors relative ${activeTab === 'list' ? 'text-brand-500' : 'text-gray-500 dark:text-surface-dark-500'}`}
        >
          Disponíveis
          {activeTab === 'list' && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-brand-500 rounded-t-full" />}
        </button>
        <button 
          onClick={() => setActiveTab('prep')}
          className={`pb-3 px-2 font-medium transition-colors relative ${activeTab === 'prep' ? 'text-brand-500' : 'text-gray-500 dark:text-surface-dark-500'}`}
        >
          Em Preparação
          {activeTab === 'prep' && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-brand-500 rounded-t-full" />}
        </button>
      </div>

      {/* Search */}
      <div className="flex gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
          <input 
            type="text" 
            placeholder="Buscar por modelo ou IMEI..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="ios-input pl-10"
          />
        </div>
        <button className="ios-button-secondary">
          <Filter size={20} />
        </button>
      </div>

      {/* Grid */}
      {filteredStock.length === 0 ? (
        <div className="text-center py-20 ios-card">
          <Smartphone size={48} className="mx-auto mb-4 text-gray-400" />
          <h3 className="text-ios-title-3 font-medium text-gray-600 dark:text-surface-dark-600">Nenhum aparelho encontrado</h3>
          <p className="text-ios-body text-gray-500 dark:text-surface-dark-500 mt-1">Adicione novos itens ao seu estoque ou ajuste os filtros.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredStock.map(item => (
            <div key={item.id} className="ios-card-hover overflow-hidden group">
              <div className="relative h-48 bg-gray-100 dark:bg-surface-dark-200 flex items-center justify-center overflow-hidden">
                {item.photos && item.photos.length > 0 ? (
                  <img src={item.photos[0]} alt={item.model} className="w-full h-full object-cover" />
                ) : (
                  <Smartphone size={48} className="text-gray-300 dark:text-surface-dark-400" />
                )}
                <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent"></div>
                <div className="absolute bottom-4 left-4 right-4 flex justify-between items-end">
                  <span className={`px-3 py-1 text-ios-footnote font-bold rounded-full ${
                    item.condition === Condition.NEW ? 'bg-brand-500 text-white' : 'bg-accent-500 text-white'
                  }`}>
                    {item.condition}
                  </span>
                  <span className="text-ios-footnote text-white px-3 py-1 bg-black/50 backdrop-blur-sm rounded-full">
                    {item.storeLocation}
                  </span>
                </div>
              </div>
              
              <div className="p-5">
                <div className="flex justify-between items-start mb-2">
                  <div>
                    <h3 className="text-ios-title-3 font-bold text-gray-900 dark:text-white">{item.model}</h3>
                    <p className="text-ios-body text-gray-500 dark:text-surface-dark-500">{item.capacity} • {item.color}</p>
                  </div>
                  <button className="p-2 hover:bg-gray-100 dark:hover:bg-surface-dark-200 rounded-ios text-gray-400 hover:text-gray-600 dark:hover:text-white transition-colors">
                    <Edit size={18} />
                  </button>
                </div>
                
                <div className="flex items-center justify-between mb-4 mt-4">
                  {item.condition === Condition.USED && item.batteryHealth && (
                    <div className="flex items-center gap-1.5 text-ios-subhead font-medium" style={{
                      color: item.batteryHealth > 89 ? '#22c55e' : item.batteryHealth > 79 ? '#eab308' : '#ef4444'
                    }}>
                      <Battery size={18} />
                      {item.batteryHealth}%
                    </div>
                  )}
                  {item.condition === Condition.NEW && (
                    <span className="text-ios-subhead text-green-600 dark:text-green-400 flex items-center gap-1">
                      <Smartphone size={18} /> Lacrado
                    </span>
                  )}
                  <span className="text-ios-title-2 font-bold text-gray-900 dark:text-white">
                    R$ {item.sellPrice.toLocaleString('pt-BR')}
                  </span>
                </div>
                
                <div className="pt-4 border-t border-gray-200 dark:border-surface-dark-200 grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-ios-footnote text-gray-500 dark:text-surface-dark-500 mb-0.5">Custo Total</p>
                    <p className="text-ios-subhead font-medium text-gray-700 dark:text-surface-dark-700">
                      R$ {(item.purchasePrice + (item.costs?.reduce((acc, c) => acc + c.amount, 0) || 0)).toLocaleString('pt-BR')}
                    </p>
                  </div>
                  <div>
                    <p className="text-ios-footnote text-gray-500 dark:text-surface-dark-500 mb-0.5">Lucro Est.</p>
                    <p className="text-ios-subhead font-bold text-green-600 dark:text-green-400">
                      R$ {(item.sellPrice - item.purchasePrice - (item.costs?.reduce((acc, c) => acc + c.amount, 0) || 0)).toLocaleString('pt-BR')}
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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 overflow-y-auto" onClick={() => setIsModalOpen(false)}>
          <div className="bg-white dark:bg-surface-dark-100 w-full max-w-4xl rounded-ios-xl shadow-ios-xl overflow-hidden max-h-[90vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
            <div className="p-6 border-b border-gray-200 dark:border-surface-dark-200 flex justify-between items-center bg-gray-50 dark:bg-surface-dark-200">
              <h3 className="text-ios-title-2 font-bold text-gray-900 dark:text-white">Cadastrar Aparelho</h3>
              <button onClick={() => setIsModalOpen(false)} className="p-2 hover:bg-gray-200 dark:hover:bg-surface-dark-300 rounded-full">
                <X size={24} className="text-gray-500" />
              </button>
            </div>
            
            <div className="p-6 overflow-y-auto space-y-8">
              {/* Type & Condition */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div>
                  <label className="ios-label">Tipo</label>
                  <select 
                    className="ios-input"
                    value={formData.type}
                    onChange={(e) => setFormData({...formData, type: e.target.value as DeviceType})}
                  >
                    {Object.values(DeviceType).map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
                <div>
                  <label className="ios-label">Condição</label>
                  <div className="flex bg-gray-100 dark:bg-surface-dark-200 rounded-ios-lg p-1">
                    {Object.values(Condition).map(c => (
                      <button 
                        key={c}
                        className={`flex-1 py-2 rounded-ios text-ios-subhead font-medium transition-colors ${formData.condition === c ? 'bg-white dark:bg-surface-dark-100 shadow-ios text-brand-500' : 'text-gray-500 dark:text-surface-dark-500'}`}
                        onClick={() => setFormData({...formData, condition: c})}
                      >
                        {c}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="ios-label">Loja (Estoque)</label>
                  <div className="flex bg-gray-100 dark:bg-surface-dark-200 rounded-ios-lg p-1 overflow-x-auto">
                    {stores.length > 0 ? stores.map(store => (
                      <button
                        key={store.id}
                        className={`flex-1 py-2 px-3 whitespace-nowrap rounded-ios text-ios-subhead font-medium transition-colors ${formData.storeLocation === store.name ? 'bg-accent-500 text-white' : 'text-gray-500 dark:text-surface-dark-500'}`}
                        onClick={() => setFormData({...formData, storeLocation: store.name})}
                      >
                        {store.name}
                      </button>
                    )) : (
                      <div className="w-full text-center text-ios-footnote text-gray-500 py-2">
                        Nenhuma loja cadastrada. <br/> Adicione em "Lojas".
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Model & Specs */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="relative">
                  <label className="ios-label">Modelo</label>
                  <input
                    type="text"
                    className="ios-input"
                    placeholder="Digite ou selecione o modelo"
                    value={modelSearch || formData.model}
                    onChange={(e) => {
                      setModelSearch(e.target.value);
                      setFormData({...formData, model: e.target.value});
                      setShowModelSuggestions(true);
                    }}
                    onFocus={() => setShowModelSuggestions(true)}
                  />
                  {showModelSuggestions && modelSuggestions.length > 0 && (
                    <div className="absolute z-10 w-full mt-1 bg-white dark:bg-surface-dark-100 border border-gray-200 dark:border-surface-dark-200 rounded-ios-lg shadow-ios-lg max-h-48 overflow-y-auto">
                      {modelSuggestions.map((model, idx) => (
                        <button
                          key={idx}
                          className="w-full text-left px-4 py-2 hover:bg-gray-100 dark:hover:bg-surface-dark-200 text-ios-body"
                          onClick={() => {
                            setFormData({...formData, model});
                            setModelSearch(model);
                            setShowModelSuggestions(false);
                          }}
                        >
                          {model}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                <div>
                  <label className="ios-label">Cor</label>
                  <select 
                    className="ios-input"
                    value={formData.color || ''}
                    onChange={(e) => setFormData({...formData, color: e.target.value})}
                  >
                    <option value="">Selecione a cor</option>
                    {COLORS.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                <div>
                  <label className="ios-label">Capacidade</label>
                  <div className="flex flex-wrap gap-2">
                    {CAPACITIES.map(cap => (
                      <button
                        key={cap}
                        onClick={() => setFormData({...formData, capacity: cap})}
                        className={`px-4 py-2 rounded-ios-lg border text-ios-subhead transition-colors ${formData.capacity === cap ? 'bg-brand-500 border-brand-500 text-white' : 'border-gray-300 dark:border-surface-dark-300 text-gray-700 dark:text-surface-dark-700 hover:border-brand-500'}`}
                      >
                        {cap}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="ios-label">IMEI / Serial</label>
                  <input 
                    type="text" 
                    className="ios-input"
                    value={formData.imei || ''}
                    onChange={(e) => setFormData({...formData, imei: e.target.value})}
                  />
                </div>
              </div>

              {/* Battery & Status for Used */}
              {formData.condition === Condition.USED && (
                <div className="bg-gray-50 dark:bg-surface-dark-200 p-6 rounded-ios-xl">
                  <div className="mb-4">
                    <label className="ios-label flex items-center gap-2">
                      <Battery size={18} />
                      Saúde da Bateria: {formData.batteryHealth}%
                    </label>
                    <input
                      type="range"
                      min="0"
                      max="100"
                      value={formData.batteryHealth}
                      onChange={(e) => setFormData({...formData, batteryHealth: parseInt(e.target.value)})}
                      className="w-full h-2 bg-gray-300 dark:bg-surface-dark-300 rounded-ios-lg appearance-none cursor-pointer mt-3"
                      style={{
                        background: `linear-gradient(to right, 
                          ${formData.batteryHealth! <= 20 ? '#ef4444' : formData.batteryHealth! <= 80 ? '#eab308' : '#22c55e'} 0%, 
                          ${formData.batteryHealth! <= 20 ? '#ef4444' : formData.batteryHealth! <= 80 ? '#eab308' : '#22c55e'} ${formData.batteryHealth}%, 
                          #e5e7eb ${formData.batteryHealth}%, 
                          #e5e7eb 100%)`
                      }}
                    />
                    <div className="flex justify-between mt-2 text-ios-footnote text-gray-500">
                      <span>0%</span>
                      <span>50%</span>
                      <span>100%</span>
                    </div>
                  </div>
                  
                  <div className="mt-6 pt-4 border-t border-gray-200 dark:border-surface-dark-300">
                    <label className="ios-label">Destino Inicial</label>
                    <div className="flex gap-4 mt-2">
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input 
                          type="radio" 
                          name="status" 
                          checked={formData.status === StockStatus.AVAILABLE}
                          onChange={() => setFormData({...formData, status: StockStatus.AVAILABLE})}
                          className="w-4 h-4 text-brand-500"
                        />
                        <span className="text-gray-900 dark:text-white">Pronto para Venda</span>
                      </label>
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input 
                          type="radio" 
                          name="status" 
                          checked={formData.status === StockStatus.PREPARATION}
                          onChange={() => setFormData({...formData, status: StockStatus.PREPARATION})}
                          className="w-4 h-4 text-brand-500"
                        />
                        <span className="text-gray-900 dark:text-white">Enviar para Preparação</span>
                      </label>
                    </div>
                  </div>
                </div>
              )}

              {/* Photos */}
              <div className="ios-card p-6">
                <h4 className="text-ios-title-3 font-bold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                  <Camera size={20} /> Fotos do Aparelho
                </h4>
                <div className="flex gap-4 overflow-x-auto pb-2">
                  {(formData.photos || []).map((photo, idx) => (
                    <div key={idx} className="relative w-32 h-32 flex-shrink-0 rounded-ios-lg overflow-hidden border border-gray-200 dark:border-surface-dark-300 group">
                      <img src={photo} className="w-full h-full object-cover" alt={`Foto ${idx}`} />
                      <button 
                        onClick={() => removePhoto(idx)} 
                        className="absolute top-2 right-2 bg-red-500 text-white p-1.5 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <X size={14} />
                      </button>
                    </div>
                  ))}
                  
                  <label className="w-32 h-32 flex-shrink-0 bg-gray-100 dark:bg-surface-dark-200 border-2 border-dashed border-gray-300 dark:border-surface-dark-300 rounded-ios-lg flex flex-col items-center justify-center cursor-pointer hover:border-brand-500 hover:bg-gray-50 dark:hover:bg-surface-dark-300 transition-all group">
                    <div className="w-10 h-10 rounded-full bg-gray-200 dark:bg-surface-dark-300 flex items-center justify-center mb-2 group-hover:scale-110 transition-transform">
                      <Camera size={20} className="text-gray-500" />
                    </div>
                    <span className="text-ios-footnote text-gray-500 font-medium">Adicionar</span>
                    <input type="file" accept="image/*" multiple className="hidden" onChange={handlePhotoUpload} />
                  </label>
                </div>
              </div>

              {/* Costs Section */}
              <div className="ios-card p-6">
                <div className="flex justify-between items-center mb-4">
                  <h4 className="text-ios-title-3 font-bold text-gray-900 dark:text-white flex items-center gap-2">
                    <Wrench size={20} /> Custos do Aparelho
                  </h4>
                  <button 
                    onClick={handleAddNewCost}
                    className="text-brand-500 hover:text-brand-600 text-ios-subhead font-medium"
                  >
                    + Adicionar Custo
                  </button>
                </div>

                {/* Cost History */}
                {costHistory.length > 0 && (
                  <div className="mb-4 p-4 bg-gray-50 dark:bg-surface-dark-200 rounded-ios-lg">
                    <p className="text-ios-footnote text-gray-500 mb-2 flex items-center gap-1">
                      <History size={14} /> Custos anteriores para {formData.model}
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {costHistory.slice(0, 5).map((cost, idx) => (
                        <button
                          key={idx}
                          onClick={() => handleAddCostFromHistory(cost)}
                          className="px-3 py-1.5 bg-white dark:bg-surface-dark-100 border border-gray-200 dark:border-surface-dark-300 rounded-ios text-ios-footnote hover:border-brand-500 transition-colors"
                        >
                          {cost.description}: R$ {cost.amount}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Current Costs */}
                {(formData.costs || []).length > 0 && (
                  <div className="space-y-2">
                    {formData.costs?.map((cost, idx) => (
                      <div key={idx} className="flex justify-between items-center p-3 bg-gray-50 dark:bg-surface-dark-200 rounded-ios-lg">
                        <span className="text-ios-subhead">{cost.description}</span>
                        <span className="text-ios-subhead font-medium">R$ {cost.amount.toLocaleString('pt-BR')}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Origin & Notes */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="ios-label">Origem do Aparelho</label>
                  <input 
                    type="text" 
                    placeholder="Ex: Fornecedor SP, Troca cliente João"
                    className="ios-input"
                    value={formData.origin || ''}
                    onChange={(e) => setFormData({...formData, origin: e.target.value})}
                  />
                </div>
                <div>
                  <label className="ios-label">Observações</label>
                  <input 
                    type="text" 
                    placeholder="Ex: Detalhe na carcaça, acompanha caixa"
                    className="ios-input"
                    value={formData.notes || ''}
                    onChange={(e) => setFormData({...formData, notes: e.target.value})}
                  />
                </div>
              </div>

              {/* Financials */}
              <div className="bg-gray-50 dark:bg-surface-dark-200 p-6 rounded-ios-xl">
                <h4 className="text-ios-title-3 font-bold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                  <DollarSign size={20} /> Financeiro do Item
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div>
                    <label className="ios-label">Preço de Aquisição</label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">R$</span>
                      <input 
                        type="number"
                        min="0"
                        className="ios-input pl-10"
                        value={formData.purchasePrice || ''}
                        onChange={(e) => setFormData({...formData, purchasePrice: parseFloat(e.target.value)})}
                      />
                    </div>
                  </div>
                  <div>
                    <label className="ios-label">Preço de Venda</label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">R$</span>
                      <input 
                        type="number"
                        min="0"
                        className="ios-input pl-10"
                        value={formData.sellPrice || ''}
                        onChange={(e) => setFormData({...formData, sellPrice: parseFloat(e.target.value)})}
                      />
                    </div>
                  </div>
                  <div>
                    <label className="ios-label">Lucro Projetado</label>
                    <div className="p-3 bg-white dark:bg-surface-dark-100 rounded-ios-lg border border-gray-200 dark:border-surface-dark-300">
                      <span className={`text-ios-title-3 font-bold ${calculateProfit() >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                        R$ {calculateProfit().toLocaleString('pt-BR')}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
            
            <div className="p-6 border-t border-gray-200 dark:border-surface-dark-200 bg-gray-50 dark:bg-surface-dark-200 flex justify-end gap-3">
              <button 
                onClick={() => setIsModalOpen(false)}
                className="ios-button-secondary"
              >
                Cancelar
              </button>
              <button 
                onClick={handleSave}
                className="ios-button-primary"
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
