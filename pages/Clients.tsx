import React, { useState, useMemo } from 'react';
import { useData } from '../services/dataContext';
import { Customer } from '../types';
import { Users, Search, Plus, Phone, Mail, Calendar, Crown, History, ShoppingBag, X, Edit } from 'lucide-react';

const formatCPF = (value: string) => {
  return value
    .replace(/\D/g, '')
    .replace(/(\d{3})(\d)/, '\$1.\$2')
    .replace(/(\d{3})(\d)/, '\$1.\$2')
    .replace(/(\d{3})(\d{1,2})/, '\$1-\$2')
    .replace(/(-\d{2})\d+?\$/, '\$1');
};

const formatPhone = (value: string) => {
  return value
    .replace(/\D/g, '')
    .replace(/(\d{2})(\d)/, '(\$1) \$2')
    .replace(/(\d{5})(\d)/, '\$1-\$2')
    .replace(/(-\d{4})\d+?\$/, '\$1');
};

const Clients: React.FC = () => {
  const { customers, sales, addCustomer, updateCustomer } = useData();
  const [searchTerm, setSearchTerm] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [viewHistoryClient, setViewHistoryClient] = useState<Customer | null>(null);
  
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
    return sales
      .filter(s => s.customerId === viewHistoryClient.id)
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [viewHistoryClient, sales]);

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

  const handleSave = () => {
    if (!formData.name || !formData.phone) {
      alert("Nome e Telefone são obrigatórios");
      return;
    }

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
    <div className="space-y-6 max-w-7xl mx-auto">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-ios-large font-bold text-gray-900 dark:text-white">Gestão de Clientes</h2>
          <p className="text-ios-body text-gray-500 dark:text-surface-dark-500 mt-1">CRM, histórico e cadastro de clientes</p>
        </div>
        <button 
          onClick={() => handleOpenModal()}
          className="ios-button-primary flex items-center gap-2"
        >
          <Plus size={20} />
          Novo Cliente
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <div className="grid grid-cols-2 gap-4">
            <div className="ios-card p-5">
              <div className="flex items-center gap-3 mb-2">
                <div className="p-2 bg-brand-100 rounded-ios-lg text-brand-600">
                  <Users size={20} />
                </div>
                <span className="text-ios-footnote text-gray-500 uppercase tracking-wide">Total de Clientes</span>
              </div>
              <p className="text-ios-title-1 font-bold text-gray-900 dark:text-white">{customers.length}</p>
            </div>
            <div className="ios-card p-5">
              <div className="flex items-center gap-3 mb-2">
                <div className="p-2 bg-accent-100 rounded-ios-lg text-accent-600">
                  <ShoppingBag size={20} />
                </div>
                <span className="text-ios-footnote text-gray-500 uppercase tracking-wide">Vendas Realizadas</span>
              </div>
              <p className="text-ios-title-1 font-bold text-gray-900 dark:text-white">{sales.length}</p>
            </div>
          </div>

          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
            <input 
              type="text" 
              placeholder="Buscar por nome, CPF ou email..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="ios-input pl-10"
            />
          </div>

          <div className="space-y-3">
            {filteredClients.map(client => (
              <div key={client.id} className="ios-card-hover p-4">
                <div className="flex flex-col md:flex-row justify-between md:items-center gap-4">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-full bg-gradient-to-br from-brand-500 to-accent-500 flex items-center justify-center text-lg font-bold text-white">
                      {client.name.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <h3 className="text-ios-title-3 font-bold text-gray-900 dark:text-white">{client.name}</h3>
                      <div className="flex flex-wrap gap-x-4 gap-y-1 text-ios-footnote text-gray-500">
                        <span className="flex items-center gap-1"><Phone size={14} /> {client.phone}</span>
                        {client.email && <span className="flex items-center gap-1"><Mail size={14} /> {client.email}</span>}
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex items-center justify-between md:justify-end gap-6">
                    <div className="text-right">
                      <p className="text-ios-footnote text-gray-500">Total Gasto</p>
                      <p className="text-brand-500 font-bold">R$ {client.totalSpent.toLocaleString('pt-BR')}</p>
                    </div>
                    <div className="flex gap-2">
                      <button 
                        onClick={() => setViewHistoryClient(client)}
                        className="p-2 text-gray-400 hover:text-brand-500 hover:bg-gray-100 dark:hover:bg-surface-dark-200 rounded-ios-lg"
                        title="Histórico"
                      >
                        <History size={20} />
                      </button>
                      <button 
                        onClick={() => handleOpenModal(client)}
                        className="p-2 text-gray-400 hover:text-brand-500 hover:bg-gray-100 dark:hover:bg-surface-dark-200 rounded-ios-lg"
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

        <div className="ios-card p-6 h-fit">
          <h3 className="text-ios-title-3 font-bold text-gray-900 dark:text-white mb-6 flex items-center gap-2">
            <Crown size={20} className="text-accent-500" /> Top Clientes
          </h3>
          <div className="space-y-4">
            {topClients.map((client, index) => (
              <div key={client.id} className="flex items-center gap-4">
                <div className={`w-8 h-8 flex items-center justify-center rounded-ios font-bold text-ios-footnote
                  ${index === 0 ? 'bg-accent-100 text-accent-600' : 
                    index === 1 ? 'bg-gray-200 text-gray-600' : 
                    index === 2 ? 'bg-brand-100 text-brand-600' : 'bg-gray-100 text-gray-500'}
                `}>
                  #{index + 1}
                </div>
                <div className="flex-1">
                  <p className="text-gray-900 dark:text-white font-medium truncate">{client.name}</p>
                  <p className="text-ios-footnote text-gray-500">{client.purchases} compras</p>
                </div>
                <span className="text-ios-subhead font-bold text-green-600">
                  R$ {client.totalSpent.toLocaleString('pt-BR')}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Add/Edit Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4" onClick={() => setIsModalOpen(false)}>
          <div className="bg-white dark:bg-surface-dark-100 w-full max-w-lg rounded-ios-xl shadow-ios-xl" onClick={(e) => e.stopPropagation()}>
            <div className="p-6 border-b border-gray-200 dark:border-surface-dark-200 flex justify-between items-center bg-gray-50 dark:bg-surface-dark-200">
              <h3 className="text-ios-title-2 font-bold text-gray-900 dark:text-white">{isEditing ? 'Editar Cliente' : 'Novo Cliente'}</h3>
              <button onClick={() => setIsModalOpen(false)} className="p-2 hover:bg-gray-200 rounded-full">
                <X size={24} className="text-gray-500" />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="ios-label">Nome Completo</label>
                <input 
                  type="text"
                  className="ios-input"
                  value={formData.name}
                  onChange={e => setFormData({...formData, name: e.target.value})}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="ios-label">CPF</label>
                  <input 
                    type="text"
                    className="ios-input"
                    value={formData.cpf}
                    maxLength={14}
                    onChange={e => setFormData({...formData, cpf: formatCPF(e.target.value)})}
                    placeholder="000.000.000-00"
                  />
                </div>
                <div>
                  <label className="ios-label">Data de Nascimento</label>
                  <input 
                    type="date"
                    className="ios-input"
                    value={formData.birthDate}
                    onChange={e => setFormData({...formData, birthDate: e.target.value})}
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="ios-label">Telefone</label>
                  <input 
                    type="text"
                    className="ios-input"
                    value={formData.phone}
                    maxLength={15}
                    onChange={e => setFormData({...formData, phone: formatPhone(e.target.value)})}
                    placeholder="(00) 00000-0000"
                  />
                </div>
                <div>
                  <label className="ios-label">Email</label>
                  <input 
                    type="email"
                    className="ios-input"
                    value={formData.email}
                    onChange={e => setFormData({...formData, email: e.target.value})}
                  />
                </div>
              </div>
              
              <button 
                onClick={handleSave}
                className="w-full ios-button-primary mt-4"
              >
                Salvar Cliente
              </button>
            </div>
          </div>
        </div>
      )}

      {/* History Modal */}
      {viewHistoryClient && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4" onClick={() => setViewHistoryClient(null)}>
          <div className="bg-white dark:bg-surface-dark-100 w-full max-w-2xl rounded-ios-xl shadow-ios-xl flex flex-col max-h-[90vh]" onClick={(e) => e.stopPropagation()}>
            <div className="p-6 border-b border-gray-200 dark:border-surface-dark-200 bg-gray-50 dark:bg-surface-dark-200">
              <div className="flex justify-between items-center">
                <div>
                  <h3 className="text-ios-title-2 font-bold text-gray-900 dark:text-white">Histórico de Compras</h3>
                  <p className="text-ios-body text-gray-500">{viewHistoryClient.name} • {viewHistoryClient.cpf}</p>
                </div>
                <button onClick={() => setViewHistoryClient(null)} className="p-2 hover:bg-gray-200 rounded-full">
                  <X size={24} className="text-gray-500" />
                </button>
              </div>
            </div>
            
            <div className="p-6 overflow-y-auto flex-1 space-y-4">
              {clientHistory.length > 0 ? (
                clientHistory.map(sale => (
                  <div key={sale.id} className="ios-card p-4">
                    <div className="flex justify-between items-start mb-3">
                      <div>
                        <span className="text-brand-500 font-bold text-ios-footnote">Venda #{sale.id.slice(-4).toUpperCase()}</span>
                        <p className="text-ios-footnote text-gray-500">{new Date(sale.date).toLocaleString('pt-BR')}</p>
                      </div>
                      <span className="bg-green-100 text-green-700 px-2 py-1 rounded-full text-ios-footnote font-bold">Concluída</span>
                    </div>
                    
                    <div className="space-y-2 mb-3">
                      {sale.items.map(item => (
                        <div key={item.id} className="flex justify-between text-ios-subhead">
                          <span className="text-gray-700 dark:text-surface-dark-700">{item.model} ({item.capacity})</span>
                          <span className="text-gray-900 dark:text-white">R$ {item.sellPrice.toLocaleString('pt-BR')}</span>
                        </div>
                      ))}
                    </div>

                    {sale.tradeIn && (
                      <div className="bg-gray-50 dark:bg-surface-dark-200 p-2 rounded-ios-lg text-ios-footnote text-gray-500 mb-3 flex justify-between">
                        <span>Entrada: {sale.tradeIn.model}</span>
                        <span className="text-red-500">- R$ {sale.tradeInValue.toLocaleString('pt-BR')}</span>
                      </div>
                    )}

                    <div className="border-t border-gray-200 dark:border-surface-dark-200 pt-3 flex justify-between items-center">
                      <span className="text-ios-subhead text-gray-500">Total Pago</span>
                      <span className="text-ios-title-3 font-bold text-gray-900 dark:text-white">R$ {sale.total.toLocaleString('pt-BR')}</span>
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-center py-10 text-gray-500">
                  <ShoppingBag size={48} className="mx-auto mb-4 opacity-50" />
                  <p>Nenhuma compra registrada para este cliente.</p>
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
