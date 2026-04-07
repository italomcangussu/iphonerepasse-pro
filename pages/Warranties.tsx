import React, { useEffect, useMemo, useState } from 'react';
import { useData } from '../services/dataContext';
import { Condition, DeviceType, Sale, StockItem, StockStatus, WarrantyType } from '../types';
import {
  ShieldCheck,
  Search,
  ExternalLink,
  Printer,
  CheckCircle,
  XCircle,
  Smartphone,
  Copy,
  Plus,
  PencilLine,
  Trash2
} from 'lucide-react';
import Modal from '../components/ui/Modal';
import ConfirmDialog from '../components/ui/ConfirmDialog';
import { useToast } from '../components/ui/ToastProvider';
import { supabase, supabaseAnonKey, supabaseUrl } from '../services/supabase';
import QRCode from 'qrcode';
import { formatWarrantyDevice } from '../utils/warrantyDevice';
import { trackUxEvent } from '../services/telemetry';
import { Combobox } from '../components/ui/Combobox';
import { newId } from '../utils/id';

type WarrantyForm = {
  customerId: string;
  customerName: string;
  customerCpf: string;
  customerPhone: string;
  customerEmail: string;
  sellerId: string;
  saleDate: string;
  warrantyDays: string;
  saleTotal: string;
  deviceType: DeviceType;
  model: string;
  capacity: string;
  color: string;
  imei: string;
  condition: Condition;
  batteryHealth: string;
};

const dateToInput = (value: Date) => {
  const tzOffset = value.getTimezoneOffset() * 60_000;
  return new Date(value.getTime() - tzOffset).toISOString().slice(0, 10);
};

const defaultWarrantyForm = (): WarrantyForm => ({
  customerId: '',
  customerName: '',
  customerCpf: '',
  customerPhone: '',
  customerEmail: '',
  sellerId: '',
  saleDate: dateToInput(new Date()),
  warrantyDays: '90',
  saleTotal: '',
  deviceType: DeviceType.IPHONE,
  model: '',
  capacity: '',
  color: '',
  imei: '',
  condition: Condition.USED,
  batteryHealth: ''
});

const toStartOfDay = (inputDate: string) => new Date(`${inputDate}T12:00:00`);

const addDays = (baseDate: Date, days: number) => {
  const output = new Date(baseDate);
  output.setDate(output.getDate() + days);
  return output;
};

const getWarrantyDaysFromSale = (sale: Sale) => {
  if (!sale.warrantyExpiresAt) return 90;
  const start = new Date(sale.date).getTime();
  const end = new Date(sale.warrantyExpiresAt).getTime();
  if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) return 90;
  return Math.max(1, Math.round((end - start) / (1000 * 60 * 60 * 24)));
};

const Warranties: React.FC = () => {
  const {
    sales,
    customers,
    sellers,
    stores,
    addCustomer,
    addStockItem,
    removeStockItem,
    addSale,
    updateCustomer,
    updateStockItem,
    refreshData
  } = useData();

  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState<'active' | 'expired' | 'all'>('active');
  const [selectedWarranty, setSelectedWarranty] = useState<Sale | null>(null);
  const [manageWarranty, setManageWarranty] = useState<Sale | null>(null);
  const [editingWarranty, setEditingWarranty] = useState<Sale | null>(null);
  const [warrantyToDelete, setWarrantyToDelete] = useState<Sale | null>(null);

  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);

  const [addForm, setAddForm] = useState<WarrantyForm>(() => defaultWarrantyForm());
  const [editForm, setEditForm] = useState<WarrantyForm>(() => defaultWarrantyForm());

  const [isSavingAdd, setIsSavingAdd] = useState(false);
  const [isSavingEdit, setIsSavingEdit] = useState(false);
  const [isRemovingWarranty, setIsRemovingWarranty] = useState(false);

  const [publicLinkBySale, setPublicLinkBySale] = useState<Record<string, string>>({});
  const [qrDataUrl, setQrDataUrl] = useState<string>('');
  const [qrLoading, setQrLoading] = useState(false);
  const [qrError, setQrError] = useState('');
  const toast = useToast();

  const hasAppWarranty = (sale: Sale): sale is Sale & { warrantyExpiresAt: string } => {
    if (!sale.warrantyExpiresAt) return false;
    const expiresAt = new Date(sale.warrantyExpiresAt).getTime();
    return Number.isFinite(expiresAt);
  };

  const getWarrantyStatus = (saleDate: string, expiryDate: string) => {
    const start = new Date(saleDate).getTime();
    const end = new Date(expiryDate).getTime();
    const now = new Date().getTime();

    const totalDuration = end - start;
    const elapsed = now - start;
    const remaining = end - now;

    const daysRemaining = Math.ceil(remaining / (1000 * 60 * 60 * 24));
    const percentElapsed = totalDuration <= 0 ? 100 : Math.min(100, Math.max(0, (elapsed / totalDuration) * 100));
    const isExpired = now > end;

    return { daysRemaining, percentElapsed, isExpired };
  };

  const filteredWarranties = useMemo(() => {
    return sales
      .filter((sale) => {
        if (!hasAppWarranty(sale)) return false;
        const customer = customers.find((c) => c.id === sale.customerId);
        const searchString = searchTerm.toLowerCase();

        const matchesSearch =
          customer?.name.toLowerCase().includes(searchString) ||
          sale.items.some((item) => item.model.toLowerCase().includes(searchString) || item.imei.toLowerCase().includes(searchString));

        const { isExpired } = getWarrantyStatus(sale.date, sale.warrantyExpiresAt);

        const matchesFilter = filterStatus === 'all' ? true : filterStatus === 'active' ? !isExpired : isExpired;

        return matchesSearch && matchesFilter;
      })
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [sales, customers, searchTerm, filterStatus]);

  const fetchWarrantyLink = async (saleId: string) => {
    if (publicLinkBySale[saleId]) return publicLinkBySale[saleId];

    const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
    if (sessionError) {
      throw new Error(sessionError.message || 'Nao foi possivel validar sua sessao.');
    }

    let accessToken = sessionData.session?.access_token;
    const nowInSeconds = Math.floor(Date.now() / 1000);
    const expiresAt = sessionData.session?.expires_at ?? 0;

    if (!accessToken || expiresAt <= nowInSeconds + 30) {
      const { data: refreshed, error: refreshError } = await supabase.auth.refreshSession();
      if (refreshError) {
        throw new Error('Sessao expirada. Faca login novamente.');
      }
      accessToken = refreshed.session?.access_token;
    }

    if (!accessToken) {
      throw new Error('Sessao expirada. Faca login novamente.');
    }

    if (!supabaseUrl || !supabaseAnonKey) {
      throw new Error('Configuracao do Supabase ausente no frontend.');
    }

    const response = await fetch(`${supabaseUrl}/functions/v1/warranty-link-create`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: supabaseAnonKey,
        Authorization: `Bearer ${accessToken}`
      },
      body: JSON.stringify({ saleId })
    });

    const payload = (await response.json().catch(() => null)) as { publicUrl?: string; error?: string; message?: string } | null;
    if (!response.ok) {
      throw new Error(payload?.error || payload?.message || `Falha ao gerar link (${response.status}).`);
    }

    const link = payload?.publicUrl;
    if (!link) {
      throw new Error('Resposta invalida ao gerar link da garantia.');
    }

    setPublicLinkBySale((prev) => ({ ...prev, [saleId]: link }));
    trackUxEvent({
      name: 'warranty_link_generated',
      screen: 'Warranties',
      metadata: { saleId },
      ts: new Date().toISOString()
    });
    return link;
  };

  const loadQrForSale = async (saleId: string) => {
    setQrLoading(true);
    setQrError('');
    setQrDataUrl('');
    try {
      const link = await fetchWarrantyLink(saleId);
      const generatedQr = await QRCode.toDataURL(link, {
        width: 320,
        margin: 1,
        errorCorrectionLevel: 'M'
      });
      setQrDataUrl(generatedQr);
    } catch (error: any) {
      setQrError(error?.message || 'Nao foi possivel gerar o QR Code da garantia.');
    } finally {
      setQrLoading(false);
    }
  };

  useEffect(() => {
    if (!selectedWarranty || !selectedWarranty.warrantyExpiresAt) {
      setQrLoading(false);
      setQrError('');
      setQrDataUrl('');
      return;
    }
    void loadQrForSale(selectedWarranty.id);
  }, [selectedWarranty]);

  const handleCopyLink = async (saleId: string) => {
    try {
      const link = publicLinkBySale[saleId] || (await fetchWarrantyLink(saleId));
      await navigator.clipboard.writeText(link);
      toast.success('Link da garantia copiado.');
      trackUxEvent({
        name: 'warranty_link_copied',
        screen: 'Warranties',
        metadata: { saleId },
        ts: new Date().toISOString()
      });
    } catch (error: any) {
      toast.error(error?.message || 'Nao foi possivel copiar o link.');
    }
  };

  const resetAddForm = () => {
    setAddForm(defaultWarrantyForm());
  };

  const openAddModal = () => {
    resetAddForm();
    setIsAddModalOpen(true);
  };

  const parseWarrantyForm = (form: WarrantyForm, mode: 'add' | 'edit') => {
    const saleDate = toStartOfDay(form.saleDate);
    if (!Number.isFinite(saleDate.getTime())) {
      throw new Error('Informe uma data de venda valida.');
    }

    const warrantyDays = Number(form.warrantyDays);
    if (!Number.isFinite(warrantyDays) || warrantyDays <= 0) {
      throw new Error('Informe um tempo de garantia valido em dias.');
    }

    const roundedWarrantyDays = Math.round(warrantyDays);
    const warrantyExpiresAt = addDays(saleDate, roundedWarrantyDays).toISOString();

    const model = form.model.trim();
    if (!model) throw new Error('Informe o modelo do aparelho.');

    const imei = form.imei.trim();
    if (!imei) throw new Error('Informe o IMEI do aparelho.');

    const batteryRaw = form.batteryHealth.trim();
    let batteryHealth: number | undefined;
    if (batteryRaw) {
      const parsedBattery = Number(batteryRaw);
      if (!Number.isFinite(parsedBattery) || parsedBattery < 1 || parsedBattery > 100) {
        throw new Error('Bateria deve estar entre 1 e 100.');
      }
      batteryHealth = Math.round(parsedBattery);
    }

    const parsed = {
      saleDate,
      warrantyExpiresAt,
      warrantyDays: roundedWarrantyDays,
      model,
      imei,
      capacity: form.capacity.trim(),
      color: form.color.trim(),
      batteryHealth
    };

    if (mode === 'add') {
      const saleTotal = Number(form.saleTotal);
      if (!Number.isFinite(saleTotal) || saleTotal <= 0) {
        throw new Error('Informe um valor de venda maior que zero.');
      }
      return { ...parsed, saleTotal: Number(saleTotal.toFixed(2)) };
    }

    return parsed;
  };

  const resolveStoreId = (sellerId: string) => {
    const seller = sellers.find((entry) => entry.id === sellerId);
    return seller?.storeId || stores[0]?.id || '';
  };

  const handleAddManualWarranty = async () => {
    let createdStockItemId: string | null = null;
    try {
      setIsSavingAdd(true);
      const parsed = parseWarrantyForm(addForm, 'add');

      if (!addForm.sellerId) {
        throw new Error('Selecione um vendedor para registrar a garantia.');
      }

      const storeId = resolveStoreId(addForm.sellerId);
      if (!storeId) {
        throw new Error('Nao foi possivel definir a loja desta garantia. Cadastre loja/vendedor corretamente.');
      }

      let customerId = addForm.customerId;
      if (!customerId) {
        const customerName = addForm.customerName.trim();
        if (!customerName) {
          throw new Error('Selecione um cliente existente ou informe o nome para novo cliente.');
        }

        const customerPayload = {
          id: newId('cust'),
          name: customerName,
          cpf: addForm.customerCpf.trim(),
          phone: addForm.customerPhone.trim(),
          email: addForm.customerEmail.trim(),
          birthDate: '',
          purchases: 0,
          totalSpent: 0
        };

        await addCustomer(customerPayload);
        customerId = customerPayload.id;
      }

      const stockItem: StockItem = {
        id: newId('stk'),
        type: addForm.deviceType,
        model: parsed.model,
        color: parsed.color || 'Não informado',
        hasBox: false,
        capacity: parsed.capacity || 'N/A',
        imei: parsed.imei,
        condition: addForm.condition,
        status: StockStatus.AVAILABLE,
        batteryHealth: parsed.batteryHealth,
        storeId,
        purchasePrice: 0,
        sellPrice: parsed.saleTotal,
        maxDiscount: 0,
        warrantyType: WarrantyType.STORE,
        warrantyEnd: parsed.warrantyExpiresAt,
        origin: 'Garantia avulsa',
        notes: 'Cadastro manual de garantia',
        observations: 'Cadastro manual de garantia',
        costs: [],
        photos: [],
        entryDate: parsed.saleDate.toISOString()
      };

      await addStockItem(stockItem);
      createdStockItemId = stockItem.id;

      const manualSale: Sale = {
        id: newId('sale'),
        customerId,
        sellerId: addForm.sellerId,
        items: [stockItem],
        tradeInValue: 0,
        discount: 0,
        total: parsed.saleTotal,
        paymentMethods: [{ type: 'Pix', amount: parsed.saleTotal, account: 'Caixa' }],
        date: parsed.saleDate.toISOString(),
        warrantyExpiresAt: parsed.warrantyExpiresAt
      };

      await addSale(manualSale);
      setIsAddModalOpen(false);
      resetAddForm();
      toast.success('Garantia avulsa adicionada com sucesso.');
      trackUxEvent({
        name: 'warranty_manual_added',
        screen: 'Warranties',
        metadata: { saleId: manualSale.id },
        ts: new Date().toISOString()
      });
    } catch (error: any) {
      if (createdStockItemId) {
        try {
          await removeStockItem(createdStockItemId);
        } catch {
          // Ignore rollback failures and keep original error feedback.
        }
      }
      toast.error(error?.message || 'Nao foi possivel adicionar a garantia avulsa.');
    } finally {
      setIsSavingAdd(false);
    }
  };

  const openEditWarrantyModal = (sale: Sale) => {
    const mainItem = sale.items[0];
    if (!mainItem) {
      toast.error('Nao foi possivel editar: aparelho principal nao encontrado nesta garantia.');
      return;
    }

    const customer = customers.find((entry) => entry.id === sale.customerId);

    setEditingWarranty(sale);
    setEditForm({
      customerId: sale.customerId,
      customerName: customer?.name || '',
      customerCpf: customer?.cpf || '',
      customerPhone: customer?.phone || '',
      customerEmail: customer?.email || '',
      sellerId: sale.sellerId,
      saleDate: dateToInput(new Date(sale.date)),
      warrantyDays: String(getWarrantyDaysFromSale(sale)),
      saleTotal: String(sale.total || ''),
      deviceType: mainItem.type,
      model: mainItem.model || '',
      capacity: mainItem.capacity || '',
      color: mainItem.color || '',
      imei: mainItem.imei || '',
      condition: mainItem.condition,
      batteryHealth: mainItem.batteryHealth ? String(mainItem.batteryHealth) : ''
    });
    setIsEditModalOpen(true);
  };

  const handleSaveWarrantyEdit = async () => {
    if (!editingWarranty) return;

    const mainItem = editingWarranty.items[0];
    if (!mainItem) {
      toast.error('Garantia sem aparelho principal para editar.');
      return;
    }

    try {
      setIsSavingEdit(true);
      const parsed = parseWarrantyForm(editForm, 'edit');

      if (!editForm.customerName.trim()) {
        throw new Error('Informe o nome do cliente.');
      }

      await updateCustomer(editingWarranty.customerId, {
        name: editForm.customerName.trim(),
        cpf: editForm.customerCpf.trim(),
        phone: editForm.customerPhone.trim(),
        email: editForm.customerEmail.trim()
      });

      await updateStockItem(mainItem.id, {
        model: parsed.model,
        capacity: parsed.capacity,
        color: parsed.color,
        imei: parsed.imei,
        condition: editForm.condition,
        batteryHealth: parsed.batteryHealth,
        warrantyEnd: parsed.warrantyExpiresAt
      });

      const { error: saleUpdateError } = await supabase
        .from('sales')
        .update({
          date: parsed.saleDate.toISOString(),
          warranty_expires_at: parsed.warrantyExpiresAt
        })
        .eq('id', editingWarranty.id);

      if (saleUpdateError) {
        throw saleUpdateError;
      }

      await refreshData();
      setIsEditModalOpen(false);
      setEditingWarranty(null);
      setManageWarranty(null);
      toast.success('Garantia atualizada com sucesso.');
      trackUxEvent({
        name: 'warranty_updated',
        screen: 'Warranties',
        metadata: { saleId: editingWarranty.id },
        ts: new Date().toISOString()
      });
    } catch (error: any) {
      toast.error(error?.message || 'Nao foi possivel atualizar a garantia.');
    } finally {
      setIsSavingEdit(false);
    }
  };

  const handleRemoveWarranty = async () => {
    if (!warrantyToDelete) return;

    try {
      setIsRemovingWarranty(true);
      const { error } = await supabase
        .from('sales')
        .update({ warranty_expires_at: null })
        .eq('id', warrantyToDelete.id);

      if (error) throw error;

      await refreshData();
      if (selectedWarranty?.id === warrantyToDelete.id) {
        setSelectedWarranty(null);
      }
      setWarrantyToDelete(null);
      setManageWarranty(null);
      toast.success('Garantia removida com sucesso.');
      trackUxEvent({
        name: 'warranty_removed',
        screen: 'Warranties',
        metadata: { saleId: warrantyToDelete.id },
        ts: new Date().toISOString()
      });
    } catch (error: any) {
      toast.error(error?.message || 'Nao foi possivel remover a garantia.');
    } finally {
      setIsRemovingWarranty(false);
    }
  };

  return (
    <div className="space-y-5 md:space-y-6 max-w-7xl mx-auto">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 md:gap-4">
        <div>
          <h2 className="text-[28px] md:text-ios-large font-bold text-gray-900 dark:text-white tracking-tight">Garantias</h2>
          <p className="text-ios-subhead text-gray-500 dark:text-surface-dark-500 mt-0.5">Prazos e certificados digitais</p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button type="button" onClick={openAddModal} className="ios-button-primary inline-flex items-center gap-2">
            <Plus size={18} />
            Adicionar garantia
          </button>
          <div className="flex bg-white dark:bg-surface-dark-100 p-1 rounded-ios-lg border border-gray-200 dark:border-surface-dark-200 shadow-ios">
            {[
              { id: 'active', label: 'Ativas', color: 'bg-green-500' },
              { id: 'expired', label: 'Expiradas', color: 'bg-red-500' },
              { id: 'all', label: 'Todas', color: 'bg-gray-500' }
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setFilterStatus(tab.id as 'active' | 'expired' | 'all')}
                className={`px-4 py-2 rounded-ios text-ios-subhead font-medium transition-all ${
                  filterStatus === tab.id ? `${tab.color} text-white shadow-ios` : 'text-gray-500 hover:text-gray-900 dark:hover:text-white'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="relative">
        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" size={18} />
        <input
          type="text"
          placeholder="Buscar por cliente, modelo ou IMEI..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="ios-input pl-10"
        />
      </div>

      {filteredWarranties.length === 0 && (
        <div className="ios-card p-10 text-center">
          <ShieldCheck size={36} className="mx-auto mb-3 text-gray-300 dark:text-surface-dark-400" />
          <h3 className="text-ios-title-3 font-semibold text-gray-700 dark:text-surface-dark-700">Nenhuma garantia encontrada</h3>
          <p className="text-ios-subhead text-gray-500 mt-1">Ajuste os filtros ou refine sua busca por cliente, modelo ou IMEI.</p>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredWarranties.map((sale) => {
          const customer = customers.find((c) => c.id === sale.customerId);
          const { daysRemaining, percentElapsed, isExpired } = getWarrantyStatus(sale.date, sale.warrantyExpiresAt);
          const mainItem = sale.items[0];
          const mainItemDisplay = formatWarrantyDevice(mainItem);

          return (
            <div
              key={sale.id}
              role="button"
              tabIndex={0}
              onClick={() => setManageWarranty(sale)}
              onKeyDown={(event) => {
                if (event.key === 'Enter' || event.key === ' ') {
                  event.preventDefault();
                  setManageWarranty(sale);
                }
              }}
              className="ios-card-hover overflow-hidden cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
              aria-label={`Gerenciar garantia ${sale.id.slice(-4).toUpperCase()}`}
            >
              <div className="p-6">
                <div className="flex justify-between items-start mb-4">
                  <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center ${isExpired ? 'bg-red-100 text-red-600' : 'bg-green-100 text-green-600'}`}>
                      <ShieldCheck size={20} />
                    </div>
                    <div>
                      <p className="text-ios-subhead font-bold text-gray-900 dark:text-white truncate max-w-[150px]">{customer?.name}</p>
                      <p className="text-ios-footnote text-gray-500">Venda #{sale.id.slice(-4).toUpperCase()}</p>
                    </div>
                  </div>
                  <span className={`ios-badge ${isExpired ? 'bg-gray-100 text-gray-600' : 'bg-green-500 text-white'}`}>
                    {isExpired ? 'Expirada' : 'Ativa'}
                  </span>
                </div>

                <div className="space-y-3 mb-6">
                  <div className="flex items-start gap-2 text-ios-subhead text-gray-700 dark:text-surface-dark-700">
                    <Smartphone size={16} className="text-brand-500 mt-0.5" />
                    <div className="min-w-0">
                      <span className="block truncate">{mainItemDisplay.title}</span>
                      <div className="flex flex-wrap items-center gap-2 mt-2 text-ios-footnote text-gray-500">
                        {mainItemDisplay.capacity && (
                          <span className="bg-gray-100 dark:bg-surface-dark-200 px-2 py-1 rounded-ios">{mainItemDisplay.capacity}</span>
                        )}
                        {mainItemDisplay.battery && (
                          <span className="bg-gray-100 dark:bg-surface-dark-200 px-2 py-1 rounded-ios">{mainItemDisplay.battery}🔋</span>
                        )}
                        <span className="bg-gray-100 dark:bg-surface-dark-200 px-2 py-1 rounded-ios">IMEI: {mainItemDisplay.imei || '-'}</span>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="mb-2">
                  <div className="flex justify-between text-ios-footnote mb-1">
                    <span className="text-gray-500">Tempo de Cobertura</span>
                    <span className={isExpired ? 'text-red-500' : 'text-gray-900 dark:text-white'}>
                      {isExpired ? 'Finalizado' : `${daysRemaining} dias restantes`}
                    </span>
                  </div>
                  <div className="w-full h-2 bg-gray-200 dark:bg-surface-dark-300 rounded-full overflow-hidden">
                    <div
                      className={`h-full transition-all duration-1000 ${isExpired ? 'bg-red-500' : percentElapsed > 80 ? 'bg-orange-500' : 'bg-green-500'}`}
                      style={{ width: `${Math.min(100, percentElapsed)}%` }}
                    />
                  </div>
                  <div className="flex justify-between text-ios-footnote text-gray-400 mt-1">
                    <span>{new Date(sale.date).toLocaleDateString('pt-BR')}</span>
                    <span>{new Date(sale.warrantyExpiresAt).toLocaleDateString('pt-BR')}</span>
                  </div>
                </div>

                <div className="mt-4 flex items-center justify-between text-xs text-gray-500">
                  <span>Clique no card para editar ou apagar</span>
                  <button
                    type="button"
                    onClick={(event) => {
                      event.stopPropagation();
                      setSelectedWarranty(sale);
                    }}
                    className="ios-button-secondary py-1.5 px-3 text-xs"
                  >
                    <ExternalLink size={14} className="inline mr-1" />
                    Ver certificado
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <Modal open={isAddModalOpen} onClose={() => setIsAddModalOpen(false)} title="Adicionar garantia avulsa" size="lg">
        <div className="space-y-5">
          <div>
            <p className="text-ios-footnote font-bold text-gray-500 uppercase tracking-wider mb-2">Cliente</p>
            <Combobox
              label="Cliente existente (opcional)"
              placeholder="Buscar cliente..."
              value={addForm.customerId}
              onChange={(value) => setAddForm((prev) => ({ ...prev, customerId: value }))}
              options={customers.map((customer) => ({ id: customer.id, label: customer.name, subLabel: customer.cpf ? `CPF: ${customer.cpf}` : undefined }))}
            />
            {!addForm.customerId && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-3">
                <div className="md:col-span-2">
                  <label className="ios-label">Nome do cliente</label>
                  <input
                    type="text"
                    className="ios-input"
                    value={addForm.customerName}
                    onChange={(event) => setAddForm((prev) => ({ ...prev, customerName: event.target.value }))}
                  />
                </div>
                <div>
                  <label className="ios-label">CPF (opcional)</label>
                  <input
                    type="text"
                    className="ios-input"
                    value={addForm.customerCpf}
                    onChange={(event) => setAddForm((prev) => ({ ...prev, customerCpf: event.target.value }))}
                  />
                </div>
                <div>
                  <label className="ios-label">Telefone (opcional)</label>
                  <input
                    type="text"
                    className="ios-input"
                    value={addForm.customerPhone}
                    onChange={(event) => setAddForm((prev) => ({ ...prev, customerPhone: event.target.value }))}
                  />
                </div>
                <div className="md:col-span-2">
                  <label className="ios-label">Email (opcional)</label>
                  <input
                    type="email"
                    className="ios-input"
                    value={addForm.customerEmail}
                    onChange={(event) => setAddForm((prev) => ({ ...prev, customerEmail: event.target.value }))}
                  />
                </div>
              </div>
            )}
          </div>

          <div>
            <p className="text-ios-footnote font-bold text-gray-500 uppercase tracking-wider mb-2">Venda e garantia</p>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <Combobox
                label="Vendedor"
                placeholder="Selecionar vendedor..."
                value={addForm.sellerId}
                onChange={(value) => setAddForm((prev) => ({ ...prev, sellerId: value }))}
                options={sellers.map((seller) => ({ id: seller.id, label: seller.name }))}
              />
              <div>
                <label className="ios-label">Data da venda</label>
                <input
                  type="date"
                  className="ios-input"
                  value={addForm.saleDate}
                  onChange={(event) => setAddForm((prev) => ({ ...prev, saleDate: event.target.value }))}
                />
              </div>
              <div>
                <label className="ios-label">Garantia (dias)</label>
                <input
                  type="number"
                  min={1}
                  className="ios-input"
                  value={addForm.warrantyDays}
                  onChange={(event) => setAddForm((prev) => ({ ...prev, warrantyDays: event.target.value }))}
                />
              </div>
              <div>
                <label className="ios-label">Valor da venda (R$)</label>
                <input
                  type="number"
                  min={0}
                  step="0.01"
                  className="ios-input"
                  value={addForm.saleTotal}
                  onChange={(event) => setAddForm((prev) => ({ ...prev, saleTotal: event.target.value }))}
                />
              </div>
            </div>
          </div>

          <div>
            <p className="text-ios-footnote font-bold text-gray-500 uppercase tracking-wider mb-2">Aparelho</p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="ios-label">Tipo</label>
                <select
                  className="ios-input"
                  value={addForm.deviceType}
                  onChange={(event) => setAddForm((prev) => ({ ...prev, deviceType: event.target.value as DeviceType }))}
                >
                  {Object.values(DeviceType).map((type) => (
                    <option key={type} value={type}>
                      {type}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="ios-label">Condição</label>
                <select
                  className="ios-input"
                  value={addForm.condition}
                  onChange={(event) => setAddForm((prev) => ({ ...prev, condition: event.target.value as Condition }))}
                >
                  <option value={Condition.USED}>Seminovo</option>
                  <option value={Condition.NEW}>Novo</option>
                </select>
              </div>
              <div className="md:col-span-2">
                <label className="ios-label">Modelo</label>
                <input
                  type="text"
                  className="ios-input"
                  value={addForm.model}
                  onChange={(event) => setAddForm((prev) => ({ ...prev, model: event.target.value }))}
                />
              </div>
              <div>
                <label className="ios-label">Capacidade</label>
                <input
                  type="text"
                  className="ios-input"
                  value={addForm.capacity}
                  onChange={(event) => setAddForm((prev) => ({ ...prev, capacity: event.target.value }))}
                  placeholder="Ex: 128 GB"
                />
              </div>
              <div>
                <label className="ios-label">Cor</label>
                <input
                  type="text"
                  className="ios-input"
                  value={addForm.color}
                  onChange={(event) => setAddForm((prev) => ({ ...prev, color: event.target.value }))}
                />
              </div>
              <div>
                <label className="ios-label">IMEI</label>
                <input
                  type="text"
                  className="ios-input"
                  value={addForm.imei}
                  onChange={(event) => setAddForm((prev) => ({ ...prev, imei: event.target.value }))}
                />
              </div>
              <div>
                <label className="ios-label">Saúde da bateria (opcional)</label>
                <input
                  type="number"
                  min={1}
                  max={100}
                  className="ios-input"
                  value={addForm.batteryHealth}
                  onChange={(event) => setAddForm((prev) => ({ ...prev, batteryHealth: event.target.value }))}
                />
              </div>
            </div>
          </div>

          <div className="flex justify-end gap-3">
            <button type="button" className="ios-button-secondary" onClick={() => setIsAddModalOpen(false)} disabled={isSavingAdd}>
              Cancelar
            </button>
            <button type="button" className="ios-button-primary" onClick={handleAddManualWarranty} disabled={isSavingAdd}>
              {isSavingAdd ? 'Salvando...' : 'Salvar garantia'}
            </button>
          </div>
        </div>
      </Modal>

      <Modal open={!!manageWarranty} onClose={() => setManageWarranty(null)} title="Gerenciar garantia" size="sm">
        {manageWarranty && (
          <div className="space-y-4">
            <div className="ios-card p-3">
              <p className="text-sm font-semibold text-gray-900 dark:text-white">
                {customers.find((entry) => entry.id === manageWarranty.customerId)?.name || 'Cliente não identificado'}
              </p>
              <p className="text-xs text-gray-500 mt-1">Venda #{manageWarranty.id.slice(-4).toUpperCase()}</p>
              {manageWarranty.warrantyExpiresAt && (
                <p className="text-xs text-gray-500 mt-1">
                  Validade: {new Date(manageWarranty.warrantyExpiresAt).toLocaleDateString('pt-BR')}
                </p>
              )}
            </div>

            <div className="grid grid-cols-1 gap-2">
              <button
                type="button"
                className="ios-button-secondary justify-start flex items-center gap-2"
                onClick={() => {
                  setSelectedWarranty(manageWarranty);
                  setManageWarranty(null);
                }}
              >
                <ExternalLink size={16} /> Ver certificado
              </button>
              <button
                type="button"
                className="ios-button-secondary justify-start flex items-center gap-2"
                onClick={() => {
                  openEditWarrantyModal(manageWarranty);
                  setManageWarranty(null);
                }}
              >
                <PencilLine size={16} /> Editar garantia
              </button>
              <button
                type="button"
                className="ios-button-secondary justify-start flex items-center gap-2 border-red-200 text-red-600 hover:bg-red-50"
                onClick={() => {
                  setWarrantyToDelete(manageWarranty);
                  setManageWarranty(null);
                }}
              >
                <Trash2 size={16} /> Apagar garantia
              </button>
            </div>
          </div>
        )}
      </Modal>

      <Modal open={isEditModalOpen} onClose={() => setIsEditModalOpen(false)} title="Editar garantia" size="lg">
        {editingWarranty && (
          <div className="space-y-5">
            <div>
              <p className="text-ios-footnote font-bold text-gray-500 uppercase tracking-wider mb-2">Dados do cliente</p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="md:col-span-2">
                  <label className="ios-label">Nome</label>
                  <input
                    type="text"
                    className="ios-input"
                    value={editForm.customerName}
                    onChange={(event) => setEditForm((prev) => ({ ...prev, customerName: event.target.value }))}
                  />
                </div>
                <div>
                  <label className="ios-label">CPF</label>
                  <input
                    type="text"
                    className="ios-input"
                    value={editForm.customerCpf}
                    onChange={(event) => setEditForm((prev) => ({ ...prev, customerCpf: event.target.value }))}
                  />
                </div>
                <div>
                  <label className="ios-label">Telefone</label>
                  <input
                    type="text"
                    className="ios-input"
                    value={editForm.customerPhone}
                    onChange={(event) => setEditForm((prev) => ({ ...prev, customerPhone: event.target.value }))}
                  />
                </div>
                <div className="md:col-span-2">
                  <label className="ios-label">Email</label>
                  <input
                    type="email"
                    className="ios-input"
                    value={editForm.customerEmail}
                    onChange={(event) => setEditForm((prev) => ({ ...prev, customerEmail: event.target.value }))}
                  />
                </div>
              </div>
            </div>

            <div>
              <p className="text-ios-footnote font-bold text-gray-500 uppercase tracking-wider mb-2">Dados do aparelho</p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="ios-label">Condição</label>
                  <select
                    className="ios-input"
                    value={editForm.condition}
                    onChange={(event) => setEditForm((prev) => ({ ...prev, condition: event.target.value as Condition }))}
                  >
                    <option value={Condition.USED}>Seminovo</option>
                    <option value={Condition.NEW}>Novo</option>
                  </select>
                </div>
                <div>
                  <label className="ios-label">Saúde da bateria (opcional)</label>
                  <input
                    type="number"
                    min={1}
                    max={100}
                    className="ios-input"
                    value={editForm.batteryHealth}
                    onChange={(event) => setEditForm((prev) => ({ ...prev, batteryHealth: event.target.value }))}
                  />
                </div>
                <div className="md:col-span-2">
                  <label className="ios-label">Modelo</label>
                  <input
                    type="text"
                    className="ios-input"
                    value={editForm.model}
                    onChange={(event) => setEditForm((prev) => ({ ...prev, model: event.target.value }))}
                  />
                </div>
                <div>
                  <label className="ios-label">Capacidade</label>
                  <input
                    type="text"
                    className="ios-input"
                    value={editForm.capacity}
                    onChange={(event) => setEditForm((prev) => ({ ...prev, capacity: event.target.value }))}
                  />
                </div>
                <div>
                  <label className="ios-label">Cor</label>
                  <input
                    type="text"
                    className="ios-input"
                    value={editForm.color}
                    onChange={(event) => setEditForm((prev) => ({ ...prev, color: event.target.value }))}
                  />
                </div>
                <div>
                  <label className="ios-label">IMEI</label>
                  <input
                    type="text"
                    className="ios-input"
                    value={editForm.imei}
                    onChange={(event) => setEditForm((prev) => ({ ...prev, imei: event.target.value }))}
                  />
                </div>
              </div>
            </div>

            <div>
              <p className="text-ios-footnote font-bold text-gray-500 uppercase tracking-wider mb-2">Tempo de garantia</p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="ios-label">Data da venda</label>
                  <input
                    type="date"
                    className="ios-input"
                    value={editForm.saleDate}
                    onChange={(event) => setEditForm((prev) => ({ ...prev, saleDate: event.target.value }))}
                  />
                </div>
                <div>
                  <label className="ios-label">Garantia (dias)</label>
                  <input
                    type="number"
                    min={1}
                    className="ios-input"
                    value={editForm.warrantyDays}
                    onChange={(event) => setEditForm((prev) => ({ ...prev, warrantyDays: event.target.value }))}
                  />
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-3">
              <button type="button" className="ios-button-secondary" onClick={() => setIsEditModalOpen(false)} disabled={isSavingEdit}>
                Cancelar
              </button>
              <button type="button" className="ios-button-primary" onClick={handleSaveWarrantyEdit} disabled={isSavingEdit}>
                {isSavingEdit ? 'Salvando...' : 'Salvar alterações'}
              </button>
            </div>
          </div>
        )}
      </Modal>

      <ConfirmDialog
        open={!!warrantyToDelete}
        onClose={() => {
          if (!isRemovingWarranty) setWarrantyToDelete(null);
        }}
        title="Apagar garantia"
        description="Esta acao remove somente a garantia do app desta venda. O historico de venda permanece salvo."
        confirmLabel={isRemovingWarranty ? 'Apagando...' : 'Apagar garantia'}
        cancelLabel="Cancelar"
        variant="danger"
        onConfirm={() => {
          void handleRemoveWarranty();
        }}
      />

      <Modal open={!!selectedWarranty} onClose={() => setSelectedWarranty(null)} title="Certificado de Garantia" size="lg">
        {selectedWarranty && (
          <div className="print-content space-y-6">
            <div className="flex justify-end gap-2 no-print">
              <button
                type="button"
                onClick={() => handleCopyLink(selectedWarranty.id)}
                className="p-2 bg-gray-100 hover:bg-gray-200 rounded-full text-gray-600 transition-colors"
                title="Copiar link"
              >
                <Copy size={20} />
              </button>
              <button
                type="button"
                onClick={() => window.print()}
                className="p-2 bg-gray-100 hover:bg-gray-200 rounded-full text-gray-600 transition-colors"
                title="Imprimir"
              >
                <Printer size={20} />
              </button>
            </div>

            <div className="p-4 md:p-6">
              <div className="text-center border-b-2 border-gray-200 pb-8 mb-8">
                <div className="inline-flex items-center justify-center w-16 h-16 bg-brand-500 text-white rounded-ios-xl mb-4 shadow-ios-lg">
                  <ShieldCheck size={32} />
                </div>
                <h2 className="text-ios-large font-bold text-gray-900 uppercase tracking-wide">Certificado de Garantia</h2>
                <p className="text-gray-500 mt-2">iPhoneRepasse Store</p>
                <p className="text-ios-footnote text-gray-400 mt-1 uppercase tracking-widest">#{selectedWarranty.id.slice(-6).toUpperCase()}</p>
              </div>

              {(() => {
                if (!selectedWarranty.warrantyExpiresAt) return null;
                const status = getWarrantyStatus(selectedWarranty.date, selectedWarranty.warrantyExpiresAt);
                return (
                  <div
                    className={`rounded-ios-xl p-4 mb-8 flex items-center gap-4 ${
                      status.isExpired ? 'bg-red-50 border border-red-200' : 'bg-green-50 border border-green-200'
                    }`}
                  >
                    {status.isExpired ? <XCircle className="text-red-500" size={32} /> : <CheckCircle className="text-green-500" size={32} />}
                    <div>
                      <p className={`font-bold text-ios-title-3 ${status.isExpired ? 'text-red-700' : 'text-green-700'}`}>
                        {status.isExpired ? 'GARANTIA EXPIRADA' : 'GARANTIA ATIVA'}
                      </p>
                      <p className="text-ios-subhead text-gray-600">
                        {status.isExpired
                          ? `Expirou em ${new Date(selectedWarranty.warrantyExpiresAt).toLocaleDateString('pt-BR')}`
                          : `Válida até ${new Date(selectedWarranty.warrantyExpiresAt).toLocaleDateString('pt-BR')} (${status.daysRemaining} dias)`}
                      </p>
                    </div>
                  </div>
                );
              })()}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-8">
                <div>
                  <h4 className="text-ios-footnote font-bold text-gray-500 uppercase tracking-wider mb-3">Dados do Aparelho</h4>
                  <div className="space-y-3">
                    {selectedWarranty.items.map((item, idx) => {
                      const itemDisplay = formatWarrantyDevice(item);
                      return (
                        <div key={idx} className="bg-gray-50 p-3 rounded-ios-lg border border-gray-200">
                          <p className="font-bold text-gray-900">{itemDisplay.title}</p>
                          <div className="flex flex-wrap gap-2 mt-2 text-ios-footnote text-gray-600">
                            {itemDisplay.capacity && <span className="bg-white px-2 py-0.5 rounded-ios border border-gray-200">{itemDisplay.capacity}</span>}
                            {itemDisplay.battery && <span className="bg-white px-2 py-0.5 rounded-ios border border-gray-200">{itemDisplay.battery}🔋</span>}
                            <span className="bg-white px-2 py-0.5 rounded-ios border border-gray-200">IMEI: {itemDisplay.imei || '-'}</span>
                            <span className="text-ios-footnote font-medium text-brand-600 bg-brand-50 inline-block px-2 py-0.5 rounded-ios">
                              {item.condition}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                <div>
                  <h4 className="text-ios-footnote font-bold text-gray-500 uppercase tracking-wider mb-3">Dados da Compra</h4>
                  <div className="space-y-3">
                    <div className="flex justify-between border-b border-gray-200 pb-2">
                      <span className="text-gray-500 text-ios-subhead">Cliente</span>
                      <span className="font-medium text-gray-900">{customers.find((c) => c.id === selectedWarranty.customerId)?.name}</span>
                    </div>
                    <div className="flex justify-between border-b border-gray-200 pb-2">
                      <span className="text-gray-500 text-ios-subhead">Data</span>
                      <span className="font-medium text-gray-900">{new Date(selectedWarranty.date).toLocaleDateString('pt-BR')}</span>
                    </div>
                    <div className="flex justify-between border-b border-gray-200 pb-2">
                      <span className="text-gray-500 text-ios-subhead">Pagamento</span>
                      <span className="font-medium text-gray-900">{selectedWarranty.paymentMethods.map((p) => p.type).join(', ')}</span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex flex-col items-center justify-center border-t-2 border-gray-200 pt-8">
                {qrLoading && (
                  <div className="w-40 h-40 rounded-ios-lg border border-gray-200 bg-gray-50 flex items-center justify-center text-gray-500 text-sm">
                    Gerando QR Code...
                  </div>
                )}
                {!qrLoading && qrError && (
                  <div className="w-full max-w-md rounded-ios-lg border border-red-200 bg-red-50 text-red-600 text-sm px-4 py-3 text-center">{qrError}</div>
                )}
                {!qrLoading && !qrError && qrDataUrl && (
                  <img src={qrDataUrl} alt="QR Code da garantia" className="w-40 h-40 rounded-ios-lg border border-gray-200 bg-white p-2" />
                )}
                <p className="text-ios-footnote text-gray-400 text-center max-w-sm mt-4">Escaneie para abrir sua garantia digital</p>
                {publicLinkBySale[selectedWarranty.id] && (
                  <p className="text-xs text-gray-500 mt-2 break-all text-center">{publicLinkBySale[selectedWarranty.id]}</p>
                )}
              </div>

              <div className="mt-8 text-center text-ios-footnote text-gray-400">
                <p>iPhoneRepasse - Soluções em Apple</p>
                <p>Garantia cobre defeitos de fabricação e hardware.</p>
              </div>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};

export default Warranties;
