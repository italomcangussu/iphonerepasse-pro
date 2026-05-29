import React, { useState, useEffect } from 'react';
import { useData } from '../services/dataContext';
import { Save, Upload, Building2, MapPin, Phone, Mail, Instagram, Loader2, Clock3, CalendarDays, Plus, Trash2 } from 'lucide-react';
import { uploadImage } from '../services/storage';
import BrandLogo from '../components/BrandLogo';
import { formatCnpj, formatPhone } from '../utils/inputMasks';
import { useAsyncHandler } from '../hooks/useAsyncHandler';
import type { BusinessDayKey, BusinessHours, SpecialBusinessHours } from '../types';
import {
  BUSINESS_DAY_KEYS,
  BUSINESS_DAY_LABELS,
  normalizeBusinessHours,
  normalizeSpecialBusinessHours
} from '../utils/businessHours';

type SpecialHoursRow = {
  id: string;
  date: string;
  label: string;
  closed: boolean;
  open: string;
  close: string;
};

const specialHoursToRows = (value: SpecialBusinessHours | undefined): SpecialHoursRow[] =>
  Object.entries(normalizeSpecialBusinessHours(value)).map(([date, entry]) => ({
    id: date,
    date,
    label: entry.label || '',
    closed: entry.closed !== false,
    open: entry.open || '09:00',
    close: entry.close || '22:00',
  }));

const rowsToSpecialHours = (rows: SpecialHoursRow[]): SpecialBusinessHours =>
  rows.reduce<SpecialBusinessHours>((hours, row) => {
    if (!row.date) return hours;
    hours[row.date] = row.closed
      ? { closed: true, label: row.label }
      : { closed: false, label: row.label, open: row.open, close: row.close };
    return hours;
  }, {});

const Profile: React.FC = () => {
  const { businessProfile, updateBusinessProfile } = useData();
  const run = useAsyncHandler();
  const [formData, setFormData] = useState(() => ({
    ...businessProfile,
    businessHours: normalizeBusinessHours(businessProfile.businessHours),
    specialBusinessHours: normalizeSpecialBusinessHours(businessProfile.specialBusinessHours),
  }));
  const [specialRows, setSpecialRows] = useState<SpecialHoursRow[]>(() => specialHoursToRows(businessProfile.specialBusinessHours));
  const [showSuccess, setShowSuccess] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    setFormData({
      ...businessProfile,
      businessHours: normalizeBusinessHours(businessProfile.businessHours),
      specialBusinessHours: normalizeSpecialBusinessHours(businessProfile.specialBusinessHours),
    });
    setSpecialRows(specialHoursToRows(businessProfile.specialBusinessHours));
  }, [businessProfile]);

  const handleSave = async () => {
    await run(async () => {
      await updateBusinessProfile({
        ...formData,
        businessHours: normalizeBusinessHours(formData.businessHours),
        specialBusinessHours: rowsToSpecialHours(specialRows),
      });
      setShowSuccess(true);
      setTimeout(() => setShowSuccess(false), 3000);
    }, { errorMsg: 'Não foi possível salvar o perfil da loja.', setLoading: setIsSaving });
  };

  const updateBusinessDay = (day: BusinessDayKey, field: keyof BusinessHours[BusinessDayKey], value: string) => {
    setFormData((prev) => ({
      ...prev,
      businessHours: {
        ...normalizeBusinessHours(prev.businessHours),
        [day]: {
          ...normalizeBusinessHours(prev.businessHours)[day],
          [field]: value,
        },
      },
    }));
  };

  const updateSpecialRow = (id: string, updates: Partial<SpecialHoursRow>) => {
    setSpecialRows((prev) => prev.map((row) => (row.id === id ? { ...row, ...updates } : row)));
  };

  const addSpecialRow = () => {
    const id = `new-${Date.now()}`;
    setSpecialRows((prev) => [...prev, {
      id,
      date: '',
      label: '',
      closed: true,
      open: '09:00',
      close: '22:00',
    }]);
  };

  const removeSpecialRow = (id: string) => {
    setSpecialRows((prev) => prev.filter((row) => row.id !== id));
  };

  const handleLogoChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      try {
        setIsUploading(true);
        const publicUrl = await uploadImage(file, 'logos');
        if (publicUrl) {
          setFormData(prev => ({ ...prev, logoUrl: publicUrl }));
        }
      } catch (error) {
        console.error('Erro ao enviar logo:', error);
      } finally {
        setIsUploading(false);
      }
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      <div>
        <h2 className="text-ios-large font-bold text-gray-900 dark:text-white">Perfil da Loja</h2>
        <p className="text-ios-body text-gray-500 dark:text-surface-dark-500 mt-1">Personalize a identidade do seu negócio</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-1">
          <div className="ios-card p-6 flex flex-col items-center text-center">
            <div className="relative group w-40 h-40 mb-6">
              <div className="w-full h-full rounded-ios-xl bg-gray-100 dark:bg-surface-dark-200 border-2 border-dashed border-gray-300 dark:border-surface-dark-300 flex items-center justify-center overflow-hidden">
                {formData.logoUrl ? (
                  <img src={formData.logoUrl} alt="Logo" className="w-full h-full object-contain" loading="lazy" decoding="async" />
                ) : (
                  <BrandLogo variant="mark" className="w-16 h-16 object-contain" />
                )}
              </div>
              <label className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center cursor-pointer rounded-ios-xl text-white font-medium">
                {isUploading ? (
                  <Loader2 size={24} className="animate-spin" />
                ) : (
                  <>
                    <Upload size={24} className="mb-2" />
                    Alterar Logo
                  </>
                )}
                <input type="file" accept="image/*" className="hidden" disabled={isUploading} onChange={handleLogoChange} />
              </label>
            </div>
            
            <p className="text-ios-footnote text-gray-500 mb-2">Recomendado: 500x500px</p>
            <p className="text-ios-footnote text-gray-400">Essa logo aparecerá no menu e nos recibos</p>
          </div>
        </div>

        <div className="lg:col-span-2 space-y-6">
          <div className="ios-card p-6">
            <h3 className="text-ios-title-3 font-bold text-gray-900 dark:text-white mb-6 flex items-center gap-2">
              <Building2 size={20} className="text-brand-500" />
              Informações Básicas
            </h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="md:col-span-2">
                <label className="ios-label">Nome da Loja</label>
                <input 
                  type="text" 
                  value={formData.name}
                  onChange={e => setFormData({...formData, name: e.target.value})}
                  className="ios-input"
                  placeholder="Ex: iPhoneRepasse"
                />
              </div>

              <div>
                <label className="ios-label">CNPJ</label>
                <input 
                  type="text" 
                  value={formData.cnpj}
                  maxLength={18}
                  onChange={e => setFormData({...formData, cnpj: formatCnpj(e.target.value)})}
                  className="ios-input"
                  placeholder="00.000.000/0001-00"
                />
              </div>

              <div>
                <label className="ios-label flex items-center gap-2">
                  <Instagram size={14} /> Instagram
                </label>
                <input 
                  type="text" 
                  value={formData.instagram}
                  onChange={e => setFormData({...formData, instagram: e.target.value})}
                  className="ios-input"
                  placeholder="@seunegocio"
                />
              </div>
            </div>
          </div>

          <div className="ios-card p-6">
            <h3 className="text-ios-title-3 font-bold text-gray-900 dark:text-white mb-6 flex items-center gap-2">
              <MapPin size={20} className="text-brand-500" />
              Contato e Endereço
            </h3>
            
            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="ios-label flex items-center gap-2">
                    <Phone size={14} /> Telefone
                  </label>
                  <input 
                    type="text" 
                    value={formData.phone}
                    maxLength={15}
                    onChange={e => setFormData({...formData, phone: formatPhone(e.target.value)})}
                    className="ios-input"
                  />
                </div>
                <div>
                  <label className="ios-label flex items-center gap-2">
                    <Mail size={14} /> Email
                  </label>
                  <input 
                    type="email" 
                    value={formData.email}
                    onChange={e => setFormData({...formData, email: e.target.value})}
                    className="ios-input"
                  />
                </div>
              </div>

              <div>
                <label className="ios-label">Endereço Completo</label>
                <textarea 
                  value={formData.address}
                  onChange={e => setFormData({...formData, address: e.target.value})}
                  className="ios-input min-h-[100px]"
                  placeholder="Rua, Número, Bairro, Cidade - UF"
                />
              </div>
            </div>
          </div>

          <div className="ios-card p-6">
            <h3 className="text-ios-title-3 font-bold text-gray-900 dark:text-white mb-6 flex items-center gap-2">
              <Clock3 size={20} className="text-brand-500" />
              Horários de funcionamento
            </h3>

            <div className="space-y-3">
              {BUSINESS_DAY_KEYS.map((day) => {
                const label = BUSINESS_DAY_LABELS[day];
                const hours = normalizeBusinessHours(formData.businessHours)[day];
                return (
                  <div key={day} className="grid grid-cols-1 sm:grid-cols-[minmax(100px,1fr)_minmax(0,120px)_minmax(0,120px)] gap-3 items-end">
                    <div className="text-ios-body font-semibold text-gray-700 dark:text-surface-dark-600 pb-2">
                      {label}
                    </div>
                    <div>
                      <label className="ios-label" htmlFor={`${day}-open`}>Abertura</label>
                      <input
                        id={`${day}-open`}
                        aria-label={`${label} abertura`}
                        type="time"
                        value={hours.open}
                        onChange={e => updateBusinessDay(day, 'open', e.target.value)}
                        className="ios-input"
                      />
                    </div>
                    <div>
                      <label className="ios-label" htmlFor={`${day}-close`}>Fechamento</label>
                      <input
                        id={`${day}-close`}
                        aria-label={`${label} fechamento`}
                        type="time"
                        value={hours.close}
                        onChange={e => updateBusinessDay(day, 'close', e.target.value)}
                        className="ios-input"
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="ios-card p-6">
            <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <h3 className="text-ios-title-3 font-bold text-gray-900 dark:text-white flex items-center gap-2">
                <CalendarDays size={20} className="text-brand-500" />
                Horários especiais
              </h3>
              <button
                type="button"
                onClick={addSpecialRow}
                className="ios-button-secondary inline-flex items-center justify-center gap-2"
              >
                <Plus size={18} />
                Adicionar feriado
              </button>
            </div>

            <div className="space-y-4">
              {specialRows.map((row) => (
                <div key={row.id} className="rounded-ios border border-gray-200 dark:border-surface-dark-300 p-4 space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-[minmax(0,150px)_minmax(0,1fr)] gap-4">
                    <div>
                      <label className="ios-label" htmlFor={`${row.id}-date`}>Data</label>
                      <input
                        id={`${row.id}-date`}
                        type="date"
                        value={row.date}
                        onChange={e => updateSpecialRow(row.id, { date: e.target.value })}
                        className="ios-input"
                      />
                    </div>
                    <div>
                      <label className="ios-label" htmlFor={`${row.id}-label`}>Descrição</label>
                      <input
                        id={`${row.id}-label`}
                        type="text"
                        value={row.label}
                        onChange={e => updateSpecialRow(row.id, { label: e.target.value })}
                        className="ios-input"
                        placeholder="Ex: Feriado"
                      />
                    </div>
                  </div>

                  <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
                    <label className="inline-flex items-center gap-2 text-ios-body font-medium text-gray-700 dark:text-surface-dark-600">
                      <input
                        type="checkbox"
                        checked={row.closed}
                        onChange={e => updateSpecialRow(row.id, { closed: e.target.checked })}
                        className="h-4 w-4 rounded border-gray-300 text-brand-500 focus:ring-brand-500"
                      />
                      Loja fechada neste dia
                    </label>

                    {!row.closed && (
                      <div className="grid grid-cols-2 gap-3 md:w-64">
                        <div>
                          <label className="ios-label" htmlFor={`${row.id}-open`}>Abertura</label>
                          <input
                            id={`${row.id}-open`}
                            type="time"
                            value={row.open}
                            onChange={e => updateSpecialRow(row.id, { open: e.target.value })}
                            className="ios-input"
                          />
                        </div>
                        <div>
                          <label className="ios-label" htmlFor={`${row.id}-close`}>Fechamento</label>
                          <input
                            id={`${row.id}-close`}
                            type="time"
                            value={row.close}
                            onChange={e => updateSpecialRow(row.id, { close: e.target.value })}
                            className="ios-input"
                          />
                        </div>
                      </div>
                    )}

                    <button
                      type="button"
                      onClick={() => removeSpecialRow(row.id)}
                      className="ios-button-secondary inline-flex items-center justify-center gap-2 text-red-600 dark:text-red-400"
                    >
                      <Trash2 size={18} />
                      Remover
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="flex items-center justify-end gap-4">
            {showSuccess && (
              <span className="text-green-600 font-medium animate-pulse">
                Alterações salvas com sucesso!
              </span>
            )}
            <button 
              onClick={handleSave}
              disabled={isSaving}
              className="ios-button-primary flex items-center gap-2"
            >
              <Save size={20} />
              {isSaving ? 'Salvando...' : 'Salvar Alterações'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Profile;
