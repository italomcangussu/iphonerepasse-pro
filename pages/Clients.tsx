import React, { useState, useMemo } from 'react';
import { useData } from '../services/dataContext';
import { Customer, Sale } from '../types';
import { 
  Users, Search, Plus, Phone, Mail, Calendar, 
  MapPin, Crown, History, ShoppingBag, X, Edit
} from 'lucide-react';

const formatCPF = (value: string) => {
  return value
    .replace(/\D/g, '')
    .replace(/(\d{3})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d{1,2})/, '$1-$2')
    .replace(/(-\d{2})\d+?$/, '$1');
};

const formatPhone = (value: string) => {
  return value
    .replace(/\D/g, '')
    .replace(/(\d{2})(\d)/, '($1) $2')
    .replace(/(\d{5})(\d)/, '$1-$2')
    .replace(/(-\d{4})\d+?$/, '$1');
};

const Clients: React.FC = () => {
  const { customers, sales, addCustomer, updateCustomer } = useData();
  const [searchTerm, setSearchTerm] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [viewHistoryClient, setViewHistoryClient] = useState<Customer | null>(null);
  const [historySearchTerm, setHistorySearchTerm] = useState('');
  
  // Form State
  const initialFormState = {
    id: '',
    name: '',
    cpf: '',
    phone: '',
    email: '',
    birthDate: '',
  };
  const [formData, setFormData] = useState(initialFormState);
  const [isEditing, setIsEditing] = useState(false);

  // Derived Data
  const filteredClients = customers.filter(c => 
    c.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    c.cpf.includes(searchTerm) ||
    c.email.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const topClients = useMemo(() => {
    return [...customers].sort((a, b) => b.totalSpent - a.totalSpent).slice(0, 5);
  }, [customers]);

  const clientHistory = useMemo(() => {
    if (!viewHistoryClient) return [];
    
    // Filter by client ID first
    const clientSales = sales.filter(s => s.customerId === viewHistoryClient.id);
    
    // Filter by search term inside the modal
    if (!historySearchTerm) {
      return clientSales.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    }

    const term = historySearchTerm.toLowerCase();
    
    return clientSales.filter(sale => {
      // Search matches: Sale ID, Item Models, IMEIs
      const matchesSale = sale.id.toLowerCase().includes(term);
      const matchesItems = sale.items.some(item => 
        item.model.toLowerCase().includes(term) || 
        item.imei.toLowerCase().includes(term)
      );
      
      // Also match Client Name/CPF as requested (although redundant in single view, satisfies the requirement)
      const matchesClient = viewHistoryClient.name.toLowerCase().includes(term) || 
                            viewHistoryClient.cpf.includes(term);

      return matchesSale || matchesItems || matchesClient;
    }).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  }, [viewHistoryClient, sales, historySearchTerm]);

  const handleOpenModal = (client?: Customer) => {
    if (client) {
      setFormData({
        id: client.id,
        name: client.name,
        cpf: client.cpf,
        phone: client.phone,
        email: client.email,
        birthDate: client.birthDate
      });
      setIsEditing(true);
    } else {
      setFormData(initialFormState);
      setIsEditing(false);
    }
    setIsModalOpen(true);
  };

  const handleOpenHistory = (client: Customer) => {
    setViewHistoryClient(client);
    setHistorySearchTerm(''); // Reset search when opening
  };

  const handleSave = () => {
    if (!formData.name || !formData.phone) return alert("Nome e Telefone são obrigatórios");

    if (isEditing && formData.id) {
      updateCustomer(formData.id, formData);
    } else {
      const newCustomer: Customer = {
        ...formData,
        id: `cli-${Date.now()}`,
        purchases: 0,
        totalSpent: 0
      };
      addCustomer(newCustomer);
    }
    setIsModalOpen(false);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-white">Gestão de Clientes</h2>
          <p className="text-slate-400">CRM, histórico e cadastro de clientes</p>
        </div>
        <button 
          onClick={() => handleOpenModal()}
          className="bg-primary-600 hover:bg-primary-500 text-white px-6 py-3 rounded-xl flex items-center gap-2 font-medium transition-colors shadow-lg shadow-primary-500/20"
        >
          <Plus size={20} />
          Novo Cliente
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Main List */}
        <div className="lg:col-span-2 space-y-6">
          {/* Stats Row */}
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-dark-800 p-5 rounded-2xl border border-dark-700">
              <div className="flex items-center gap-3 mb-2">
                <div className="p-2 bg-blue-500/20 rounded-lg text-blue-400">
                   <Users size={20} />
                </div>
                <span className="text-slate-400 text-sm">Total de Clientes</span>
              </div>
              <p className="text-2xl font-bold text-white">{customers.length}</p>
            </div>
            <div className="bg-dark-800 p-5 rounded-2xl border border-dark-700">
              <div className="flex items-center gap-3 mb-2">
                <div className="p-2 bg-purple-500/20 rounded-lg text-purple-400">
                   <ShoppingBag size={20} />
                </div>
                <span className="text-slate-400 text-sm">Vendas Realizadas</span>
              </div>
              <p className="text-2xl font-bold text-white">{sales.length}</p>
            </div>
          </div>

          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={20} />
            <input 
              type="text" 
              placeholder="Buscar por nome, CPF ou email..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-dark-800 border border-dark-700 rounded-xl py-3 pl-10 pr-4 text-white focus:outline-none focus:border-primary-500 transition-all"
            />
          </div>

          {/* Client List */}
          <div className="space-y-4">
            {filteredClients.map(client => (
              <div key={client.id} className="bg-dark-800 p-4 rounded-xl border border-dark-700 hover:border-primary-500/50 transition-all group">
                <div className="flex flex-col md:flex-row justify-between md:items-center gap-4">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-full bg-gradient-to-br from-dark-700 to-dark-600 flex items-center justify-center text-lg font-bold text-slate-300 border border-dark-600">
                      {client.name.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <h3 className="text-white font-bold text-lg">{client.name}</h3>
                      <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-slate-400">
                        <span className="flex items-center gap-1"><Phone size={14} /> {client.phone}</span>
                        <span className="flex items-center gap-1"><Mail size={14} /> {client.email}</span>
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex items-center justify-between md:justify-end gap-6 border-t md:border-t-0 border-dark-700 pt-3 md:pt-0">
                    <div className="text-right">
                       <p className="text-xs text-slate-500">Total Gasto</p>
                       <p className="text-primary-400 font-bold">R$ {client.totalSpent.toLocaleString()}</p>
                    </div>
                    <div className="flex gap-2">
                      <button 
                        onClick={() => handleOpenHistory(client)}
                        className="p-2 text-slate-400 hover:text-white hover:bg-dark-700 rounded-lg tooltip"
                        title="Histórico"
                      >
                        <History size={20} />
                      </button>
                      <button 
                         onClick={() => handleOpenModal(client)}
                         className="p-2 text-slate-400 hover:text-primary-400 hover:bg-dark-700 rounded-lg"
                         title="Editar"
                      >
                        <Edit size={20} />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Sidebar Ranking */}
        <div className="bg-dark-800 p-6 rounded-2xl border border-dark-700 h-fit">
           <h3 className="text-lg font-bold text-white mb-6 flex items-center gap-2">
             <Crown size={20} className="text-yellow-500" /> Top Clientes
           </h3>
           <div className="space-y-6">
             {topClients.map((client, index) => (
               <div key={client.id} className="flex items-center gap-4">
                 <div className={`w-8 h-8 flex items-center justify-center rounded-lg font-bold text-sm
                    ${index === 0 ? 'bg-yellow-500/20 text-yellow-500' : 
                      index === 1 ? 'bg-slate-300/20 text-slate-300' : 
                      index === 2 ? 'bg-orange-700/20 text-orange-600' : 'bg-dark-700 text-slate-500'}
                 `}>
                   #{index + 1}
                 </div>
                 <div className="flex-1">
                   <p className="text-white font-medium truncate">{client.name}</p>
                   <p className="text-xs text-slate-500">{client.purchases} compras</p>
                 </div>
                 <span className="text-sm font-bold text-green-500">
                   R$ {client.totalSpent.toLocaleString()}
                 </span>
               </div>
             ))}
             {topClients.length === 0 && <p className="text-slate-500 text-sm">Sem dados suficientes.</p>}
           </div>
        </div>
      </div>

      {/* Add/Edit Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="bg-dark-900 w-full max-w-lg rounded-2xl border border-dark-700 shadow-2xl">
            <div className="p-6 border-b border-dark-700 flex justify-between items-center bg-dark-800 rounded-t-2xl">
              <h3 className="text-xl font-bold text-white">{isEditing ? 'Editar Cliente' : 'Novo Cliente'}</h3>
              <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-white"><X size={24} /></button>
            </div>
            <div className="p-6 space-y-4">
               <div>
                 <label className="block text-sm font-medium text-slate-400 mb-1">Nome Completo</label>
                 <input 
                   type="text"
                   className="w-full bg-dark-800 border border-dark-600 rounded-lg p-3 text-white focus:border-primary-500 outline-none"
                   value={formData.name}
                   onChange={e => setFormData({...formData, name: e.target.value})}
                 />
               </div>
               <div className="grid grid-cols-2 gap-4">
                 <div>
                   <label className="block text-sm font-medium text-slate-400 mb-1">CPF</label>
                   <input 
                     type="text"
                     className="w-full bg-dark-800 border border-dark-600 rounded-lg p-3 text-white focus:border-primary-500 outline-none"
                     value={formData.cpf}
                     maxLength={14}
                     onChange={e => setFormData({...formData, cpf: formatCPF(e.target.value)})}
                     placeholder="000.000.000-00"
                   />
                 </div>
                 <div>
                   <label className="block text-sm font-medium text-slate-400 mb-1">Data de Nascimento</label>
                   <input 
                     type="date"
                     className="w-full bg-dark-800 border border-dark-600 rounded-lg p-3 text-white focus:border-primary-500 outline-none"
                     value={formData.birthDate}
                     onChange={e => setFormData({...formData, birthDate: e.target.value})}
                   />
                 </div>
               </div>
               <div className="grid grid-cols-2 gap-4">
                 <div>
                   <label className="block text-sm font-medium text-slate-400 mb-1">Telefone</label>
                   <input 
                     type="text"
                     className="w-full bg-dark-800 border border-dark-600 rounded-lg p-3 text-white focus:border-primary-500 outline-none"
                     value={formData.phone}
                     maxLength={15}
                     onChange={e => setFormData({...formData, phone: formatPhone(e.target.value)})}
                     placeholder="(00) 00000-0000"
                   />
                 </div>
                 <div>
                   <label className="block text-sm font-medium text-slate-400 mb-1">Email</label>
                   <input 
                     type="email"
                     className="w-full bg-dark-800 border border-dark-600 rounded-lg p-3 text-white focus:border-primary-500 outline-none"
                     value={formData.email}
                     onChange={e => setFormData({...formData, email: e.target.value})}
                   />
                 </div>
               </div>
               
               <button 
                 onClick={handleSave}
                 className="w-full bg-primary-600 hover:bg-primary-500 text-white font-bold py-3 rounded-xl mt-4 transition-all"
               >
                 Salvar Cliente
               </button>
            </div>
          </div>
        </div>
      )}

      {/* History Modal */}
      {viewHistoryClient && (
         <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
           <div className="bg-dark-900 w-full max-w-2xl rounded-2xl border border-dark-700 shadow-2xl flex flex-col max-h-[90vh]">
             <div className="p-6 border-b border-dark-700 bg-dark-800 rounded-t-2xl space-y-4">
               <div className="flex justify-between items-center">
                  <div>
                    <h3 className="text-xl font-bold text-white">Histórico de Compras</h3>
                    <p className="text-slate-400 text-sm">{viewHistoryClient.name} • {viewHistoryClient.cpf}</p>
                  </div>
                  <button onClick={() => setViewHistoryClient(null)} className="text-slate-400 hover:text-white"><X size={24} /></button>
               </div>
               
               {/* Search in History */}
               <div className="relative">
                 <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={18} />
                 <input 
                   type="text"
                   placeholder="Buscar modelo, ID, nome ou CPF..."
                   value={historySearchTerm}
                   onChange={(e) => setHistorySearchTerm(e.target.value)}
                   className="w-full bg-dark-900 border border-dark-600 rounded-lg py-2.5 pl-10 pr-4 text-white text-sm focus:border-primary-500 outline-none"
                 />
               </div>
             </div>
             
             <div className="p-6 overflow-y-auto flex-1 space-y-4">
               {clientHistory.length > 0 ? (
                 clientHistory.map(sale => (
                   <div key={sale.id} className="bg-dark-800 p-4 rounded-xl border border-dark-700">
                      <div className="flex justify-between items-start mb-3">
                         <div>
                           <span className="text-primary-500 font-bold text-sm">Venda #{sale.id.slice(-4).toUpperCase()}</span>
                           <p className="text-xs text-slate-500">{new Date(sale.date).toLocaleString()}</p>
                         </div>
                         <span className="bg-green-500/20 text-green-400 px-2 py-1 rounded text-xs font-bold">Concluída</span>
                      </div>
                      
                      <div className="space-y-2 mb-3">
                        {sale.items.map(item => (
                          <div key={item.id} className="flex justify-between text-sm">
                            <span className="text-slate-300">{item.model} ({item.capacity})</span>
                            <span className="text-white">R$ {item.sellPrice.toLocaleString()}</span>
                          </div>
                        ))}
                      </div>

                      {sale.tradeIn && (
                        <div className="bg-dark-900 p-2 rounded text-xs text-slate-400 mb-3 flex justify-between">
                          <span>Entrada: {sale.tradeIn.model}</span>
                          <span className="text-red-400">- R$ {sale.tradeInValue.toLocaleString()}</span>
                        </div>
                      )}

                      <div className="border-t border-dark-700 pt-3 flex justify-between items-center">
                        <span className="text-sm text-slate-400">Total Pago</span>
                        <span className="text-lg font-bold text-white">R$ {sale.total.toLocaleString()}</span>
                      </div>
                   </div>
                 ))
               ) : (
                 <div className="text-center py-10 text-slate-500">
                   {historySearchTerm ? (
                     <>
                       <Search size={48} className="mx-auto mb-4 opacity-50" />
                       <p>Nenhuma venda encontrada para "{historySearchTerm}".</p>
                     </>
                   ) : (
                     <>
                       <ShoppingBag size={48} className="mx-auto mb-4 opacity-50" />
                       <p>Nenhuma compra registrada para este cliente.</p>
                     </>
                   )}
                 </div>
               )}
             </div>
           </div>
         </div>
      )}
    </div>
  );
};

export default Clients;