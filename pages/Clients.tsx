import React, { useState, useMemo } from 'react';
import { useDisclosure } from '../hooks/useDisclosure';
import { useData } from '../services/dataContext';
import { Customer } from '../types';
import { Users, Search, Plus, Phone, Mail, Crown, History, ShoppingBag, Edit } from 'lucide-react';
import Modal from '../components/ui/Modal';
import { useToast } from '../components/ui/ToastProvider';
import { newId } from '../utils/id';
import { formatCpf, formatCurrencyBRL, formatPhone } from '../utils/inputMasks';

const safeText = (value: unknown) => (typeof value === 'string' ? value : '');
const safeNumber = (value: unknown) => (typeof value === 'number' && Number.isFinite(value) ? value : 0);
const formatCurrency = (value: unknown) => formatCurrencyBRL(safeNumber(value));
const onlyDigits = (value: unknown) => safeText(value).replace(/\D/g, '');
const normalizeForSearch = (value: unknown) =>
  safeText(value)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
    .replace(/\s+/g, ' ');

const isDuplicateCustomerError = (error: unknown): boolean => {
  if (!error || typeof error !== 'object') return false;
  const maybeError = error as { code?: string; message?: string; details?: string; status?: number };
  const message = `${maybeError.message || ''} ${maybeError.details || ''}`.toLowerCase();
  return (
    maybeError.code === '23505' ||
    maybeError.status === 409 ||
    message.includes('customers_cpf_key') ||
    message.includes('duplicate key') ||
    message.includes('unique constraint')
  );
};

const Clients: React.FC = () => {
  const { customers, sales, addCustomer, updateCustomer } = useData();
  const [searchTerm, setSearchTerm] = useState('');
  const { isOpen: isModalOpen, open: openModal, close: closeModal } = useDisclosure();
  const { isOpen: isDuplicateModalOpen, open: openDuplicateModal, close: closeDuplicateModal } = useDisclosure();
  const [viewHistoryClient, setViewHistoryClient] = useState<Customer | null>(null);
  const toast = useToast();
  const [duplicateContext, setDuplicateContext] = useState<{
    name: string;
    cpf: string;
    existingName: string;
    existingCpf: string;
    existingPhone: string;
    existingEmail: string;
  }>({
    name: '',
    cpf: '',
    existingName: '',
    existingCpf: '',
    existingPhone: '',
    existingEmail: '',
  });

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

  const filteredClients = customers.filter((client) => {
    const searchRaw = searchTerm.trim();
    if (!searchRaw) return true;
    const normalizedSearch = normalizeForSearch(searchRaw);
    const searchDigits = onlyDigits(searchRaw);
    const normalizedName = normalizeForSearch(client.name);
    const normalizedCpf = normalizeForSearch(client.cpf);
    const normalizedEmail = normalizeForSearch(client.email);
    const normalizedPhone = normalizeForSearch(client.phone);
    const phoneDigits = onlyDigits(client.phone);
    const cpfDigits = onlyDigits(client.cpf);

    return (
      normalizedName.includes(normalizedSearch) ||
      normalizedEmail.includes(normalizedSearch) ||
      normalizedPhone.includes(normalizedSearch) ||
      (searchDigits.length > 0 && (cpfDigits.includes(searchDigits) || phoneDigits.includes(searchDigits))) ||
      normalizedCpf.includes(normalizedSearch)
    );
  });

  const topClients = useMemo(() => {
    return [...customers].sort((a, b) => safeNumber(b.totalSpent) - safeNumber(a.totalSpent)).slice(0, 5);
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
        name: safeText(client.name),
        cpf: safeText(client.cpf),
        phone: safeText(client.phone),
        email: safeText(client.email),
        birthDate: safeText(client.birthDate)
      });
      setIsEditing(true);
    } else {
      setFormData(initialFormState);
      setIsEditing(false);
    }
    openModal();
  };

  const handleSave = async () => {
    const normalizedName = formData.name.trim().toUpperCase();

    if (!normalizedName) {
      toast.error('Nome é obrigatório.');
      return;
    }
    if (!formData.phone) {
      toast.error('Telefone é obrigatório.');
      return;
    }

    const payload = {
      ...formData,
      name: normalizedName
    };
    const formCpfDigits = onlyDigits(formData.cpf);
    const conflictingCustomer = customers.find((customer) => {
      if (!formCpfDigits) return false;
      if (isEditing && customer.id === formData.id) return false;
      return onlyDigits(customer.cpf) === formCpfDigits;
    });

    if (conflictingCustomer) {
      setDuplicateContext({
        name: normalizedName,
        cpf: safeText(formData.cpf),
        existingName: safeText(conflictingCustomer.name),
        existingCpf: safeText(conflictingCustomer.cpf),
        existingPhone: safeText(conflictingCustomer.phone),
        existingEmail: safeText(conflictingCustomer.email),
      });
      openDuplicateModal();
      return;
    }

    try {
      if (isEditing && formData.id) {
        await updateCustomer(formData.id, payload);
        toast.success('Cliente atualizado.');
      } else {
        const newCustomer: Customer = {
          ...payload,
          id: newId('cli'),
          purchases: 0,
          totalSpent: 0
        };
        await addCustomer(newCustomer);
        toast.success('Cliente criado.');
      }
      closeModal();
    } catch (error) {
      if (isDuplicateCustomerError(error)) {
        const existingFromState = customers.find((customer) => onlyDigits(customer.cpf) === formCpfDigits);
        setDuplicateContext({
          name: normalizedName,
          cpf: safeText(formData.cpf),
          existingName: safeText(existingFromState?.name),
          existingCpf: safeText(existingFromState?.cpf),
          existingPhone: safeText(existingFromState?.phone),
          existingEmail: safeText(existingFromState?.email),
        });
        openDuplicateModal();
        return;
      }
      toast.error('Não foi possível salvar o cliente. Tente novamente.');
    }
  };

  return (
    <div className="space-y-5 md:space-y-6 max-w-7xl mx-auto">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 md:gap-4">
        <div>
          <h2 className="app-page-title">Clientes</h2>
          <p className="app-page-subtitle">CRM e cadastro de clientes</p>
        </div>
        <button
          onClick={() => handleOpenModal()}
          className="ios-button-primary flex items-center gap-2 w-full md:w-auto justify-center"
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
                <span className="text-ios-footnote app-text-muted uppercase tracking-wide">Total de Clientes</span>
              </div>
              <p className="text-ios-title-1 font-bold app-text-primary">{customers.length}</p>
            </div>
            <div className="ios-card p-5">
              <div className="flex items-center gap-3 mb-2">
                <div className="p-2 bg-accent-100 rounded-ios-lg text-accent-600">
                  <ShoppingBag size={20} />
                </div>
                <span className="text-ios-footnote app-text-muted uppercase tracking-wide">Vendas Realizadas</span>
              </div>
              <p className="text-ios-title-1 font-bold app-text-primary">{sales.length}</p>
            </div>
          </div>

          <div className="app-search-wrap">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 app-search-icon pointer-events-none" size={18} />
            <input
              type="text"
              placeholder="Buscar por nome, CPF, telefone ou email..."
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
                    <div className="w-12 h-12 rounded-full bg-linear-to-br from-brand-500 to-accent-500 flex items-center justify-center text-lg font-bold text-white">
                      {safeText(client.name).charAt(0).toUpperCase() || '?'}
                    </div>
                    <div>
                      <h3 className="text-ios-title-3 font-bold app-text-primary">{safeText(client.name) || 'Cliente sem nome'}</h3>
                      <div className="flex flex-wrap gap-x-4 gap-y-1 text-ios-footnote app-text-muted">
                        <span className="flex items-center gap-1"><Phone size={14} /> {safeText(client.phone) || '-'}</span>
                        {safeText(client.email) && <span className="flex items-center gap-1"><Mail size={14} /> {safeText(client.email)}</span>}
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex items-center justify-between md:justify-end gap-6">
                    <div className="text-right">
                      <p className="text-ios-footnote app-text-muted">Total Gasto</p>
                      <p className="text-brand-500 font-bold">{formatCurrency(client.totalSpent)}</p>
                    </div>
                    <div className="flex gap-2">
                      <button 
                        onClick={() => setViewHistoryClient(client)}
                        className="app-icon-button-muted"
                        title="Histórico"
                      >
                        <History size={20} />
                      </button>
                      <button 
                        onClick={() => handleOpenModal(client)}
                        className="app-icon-button-muted"
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

        <div className="ios-card p-6 h-fit lg:sticky lg:top-4">
          <h3 className="text-ios-title-3 font-bold app-text-primary mb-6 flex items-center gap-2">
            <Crown size={20} className="text-accent-500" /> Top Clientes
          </h3>
          <div className="space-y-4">
            {topClients.map((client, index) => (
              <div key={client.id} className="flex items-start gap-3">
                <div className={`w-8 h-8 flex items-center justify-center rounded-ios font-bold text-ios-footnote shrink-0 mt-0.5
                  ${index === 0 ? 'bg-accent-100 text-accent-600' : 
                    index === 1 ? 'app-surface-soft app-text-secondary' : 
                    index === 2 ? 'bg-brand-100 text-brand-600' : 'app-surface-soft app-text-muted'}
                `}>
                  #{index + 1}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="app-text-primary font-medium wrap-break-word leading-snug">{safeText(client.name) || 'Cliente sem nome'}</p>
                  <p className="text-ios-footnote app-text-muted">{safeNumber(client.purchases)} compras</p>
                  <span className="text-ios-subhead font-bold text-green-600">
                    {formatCurrency(client.totalSpent)}
                  </span>
                </div>
              </div>
            ))}
            {topClients.length === 0 && (
              <p className="text-ios-footnote app-text-muted text-center py-4">Nenhum cliente ainda.</p>
            )}
          </div>
        </div>
      </div>

      <Modal
        open={isModalOpen}
        onClose={() => closeModal()}
        title={isEditing ? 'Editar Cliente' : 'Novo Cliente'}
        size="lg"
        onSubmit={handleSave}
        footer={
          <div className="flex justify-end gap-3">
            <button type="button" className="ios-button-secondary" onClick={() => closeModal()}>
              Cancelar
            </button>
            <button type="submit" className="ios-button-primary">
              Salvar Cliente
            </button>
          </div>
        }
      >
        <div className="space-y-4">
          <div>
            <label className="ios-label">Nome Completo</label>
            <input
              type="text"
              className="ios-input"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value.toUpperCase() })}
            />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="ios-label">CPF</label>
              <input
                type="text"
                className="ios-input"
                value={formData.cpf}
                maxLength={14}
                onChange={(e) => setFormData({ ...formData, cpf: formatCpf(e.target.value) })}
                placeholder="000.000.000-00"
              />
            </div>
            <div>
              <label className="ios-label">Data de Nascimento</label>
              <input
                type="date"
                className="ios-input"
                value={formData.birthDate}
                onChange={(e) => setFormData({ ...formData, birthDate: e.target.value })}
              />
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="ios-label">Telefone</label>
              <input
                type="text"
                className="ios-input"
                value={formData.phone}
                maxLength={15}
                onChange={(e) => setFormData({ ...formData, phone: formatPhone(e.target.value) })}
                placeholder="(00) 00000-0000"
              />
            </div>
            <div>
              <label className="ios-label">Email</label>
              <input
                type="email"
                className="ios-input"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              />
            </div>
          </div>
        </div>
      </Modal>

      <Modal
        open={!!viewHistoryClient}
        onClose={() => setViewHistoryClient(null)}
        title="Histórico de Compras"
        size="lg"
      >
        {viewHistoryClient && (
          <div className="space-y-4">
            <p className="text-ios-body app-text-muted">
              {safeText(viewHistoryClient.name) || 'Cliente sem nome'} {safeText(viewHistoryClient.cpf) ? `• ${safeText(viewHistoryClient.cpf)}` : ''}
            </p>

            <div className="max-h-[65vh] overflow-y-auto space-y-4 pr-1">
              {clientHistory.length > 0 ? (
                clientHistory.map((sale) => (
                  <div key={sale.id} className="ios-card p-4">
                    <div className="flex justify-between items-start mb-3">
                      <div>
                        <span className="text-brand-500 font-bold text-ios-footnote">
                          Venda #{sale.id.slice(-4).toUpperCase()}
                        </span>
                        <p className="text-ios-footnote app-text-muted">
                          {new Date(sale.date).toLocaleString('pt-BR')}
                        </p>
                      </div>
                      <span className="bg-green-100 text-green-700 px-2 py-1 rounded-full text-ios-footnote font-bold">
                        Concluída
                      </span>
                    </div>

                    <div className="space-y-2 mb-3">
                      {sale.items.map((item) => (
                        <div key={item.id} className="flex justify-between text-ios-subhead">
                          <span className="app-text-secondary">
                            {item.model} ({item.capacity})
                          </span>
                          <span className="app-text-primary">
                            {formatCurrency(item.sellPrice)}
                          </span>
                        </div>
                      ))}
                    </div>

                    {sale.tradeIn && (
                      <div className="app-surface-soft p-2 rounded-ios-lg text-ios-footnote app-text-muted mb-3 flex justify-between">
                        <span>Entrada: {sale.tradeIn.model}</span>
                        <span className="text-red-500">
                          - {formatCurrency(sale.tradeInValue)}
                        </span>
                      </div>
                    )}

                    <div className="border-t app-border pt-3 flex justify-between items-center">
                      <span className="text-ios-subhead app-text-muted">Total Pago</span>
                      <span className="text-ios-title-3 font-bold app-text-primary">
                        {formatCurrency(sale.total)}
                      </span>
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-center py-10 app-text-muted">
                  <ShoppingBag size={48} className="mx-auto mb-4 opacity-50" />
                  <p>Nenhuma compra registrada para este cliente.</p>
                </div>
              )}
            </div>
          </div>
        )}
      </Modal>

      <Modal
        open={isDuplicateModalOpen}
        onClose={() => closeDuplicateModal()}
        title="Cliente duplicado"
        size="md"
        footer={
          <div className="flex justify-end">
            <button type="button" className="ios-button-primary" onClick={() => closeDuplicateModal()}>
              Entendi
            </button>
          </div>
        }
      >
        <div className="space-y-3">
          <p className="text-ios-body app-text-secondary">
            Já existe um cliente cadastrado com este CPF.
          </p>
          <div className="ios-card p-3">
            <p className="text-ios-footnote app-text-muted">Nome informado</p>
            <p className="text-ios-subhead font-semibold app-text-primary">{duplicateContext.name || '-'}</p>
            <p className="text-ios-footnote app-text-muted mt-2">CPF informado</p>
            <p className="text-ios-subhead font-semibold app-text-primary">{duplicateContext.cpf || '-'}</p>
          </div>
          <div className="ios-card p-3">
            <p className="text-ios-footnote app-text-muted">Cadastro existente</p>
            <p className="text-ios-subhead font-semibold app-text-primary">{duplicateContext.existingName || '-'}</p>
            <p className="text-ios-footnote app-text-muted mt-2">CPF</p>
            <p className="text-ios-subhead font-semibold app-text-primary">{duplicateContext.existingCpf || '-'}</p>
            <p className="text-ios-footnote app-text-muted mt-2">Telefone</p>
            <p className="text-ios-subhead font-semibold app-text-primary">{duplicateContext.existingPhone || '-'}</p>
            <p className="text-ios-footnote app-text-muted mt-2">Email</p>
            <p className="text-ios-subhead font-semibold app-text-primary">{duplicateContext.existingEmail || '-'}</p>
          </div>
          <p className="text-ios-footnote app-text-muted">
            Revise o cadastro existente ou edite o cliente em vez de criar um novo.
          </p>
        </div>
      </Modal>
    </div>
  );
};

export default Clients;
