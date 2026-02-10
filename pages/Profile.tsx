import React, { useState, useEffect } from 'react';
import { useData } from '../services/dataContext';
import { Store, Save, Upload, Building2, MapPin, Phone, Mail, Instagram } from 'lucide-react';
import { BusinessProfile } from '../types';

const Profile: React.FC = () => {
  const { businessProfile, updateBusinessProfile } = useData();
  const [formData, setFormData] = useState<BusinessProfile>(businessProfile);
  const [showSuccess, setShowSuccess] = useState(false);

  useEffect(() => {
    setFormData(businessProfile);
  }, [businessProfile]);

  const handleSave = () => {
    updateBusinessProfile(formData);
    setShowSuccess(true);
    setTimeout(() => setShowSuccess(false), 3000);
  };

  const handleLogoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setFormData(prev => ({ ...prev, logoUrl: reader.result as string }));
      };
      reader.readAsDataURL(file);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      <div>
        <h2 className="text-2xl font-bold text-white">Perfil da Loja</h2>
        <p className="text-slate-400">Personalize a identidade do seu negócio e dados para recibos.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Logo Section */}
        <div className="lg:col-span-1">
          <div className="bg-dark-800 p-6 rounded-2xl border border-dark-700 flex flex-col items-center text-center">
            <div className="relative group w-40 h-40 mb-6">
              <div className="w-full h-full rounded-2xl bg-dark-900 border-2 border-dashed border-dark-600 flex items-center justify-center overflow-hidden">
                {formData.logoUrl ? (
                  <img src={formData.logoUrl} alt="Logo Preview" className="w-full h-full object-contain" />
                ) : (
                  <Store size={48} className="text-slate-600" />
                )}
              </div>
              <label className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center cursor-pointer rounded-2xl text-white font-medium">
                <Upload size={24} className="mb-2" />
                Alterar Logo
                <input type="file" accept="image/*" className="hidden" onChange={handleLogoChange} />
              </label>
            </div>
            
            <p className="text-sm text-slate-400 mb-2">Recomendado: 500x500px (PNG Transparente)</p>
            <p className="text-xs text-slate-500">Essa logo aparecerá no menu e nos recibos impressos.</p>
          </div>
        </div>

        {/* Form Section */}
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-dark-800 p-6 rounded-2xl border border-dark-700">
            <h3 className="text-lg font-bold text-white mb-6 flex items-center gap-2">
              <Building2 size={20} className="text-primary-500" />
              Informações Básicas
            </h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-slate-400 mb-2">Nome da Loja</label>
                <input 
                  type="text" 
                  value={formData.name}
                  onChange={e => setFormData({...formData, name: e.target.value})}
                  className="w-full bg-dark-900 border border-dark-600 rounded-lg p-3 text-white focus:border-primary-500 outline-none"
                  placeholder="Ex: iPhoneRepasse"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-400 mb-2">CNPJ</label>
                <input 
                  type="text" 
                  value={formData.cnpj}
                  onChange={e => setFormData({...formData, cnpj: e.target.value})}
                  className="w-full bg-dark-900 border border-dark-600 rounded-lg p-3 text-white focus:border-primary-500 outline-none"
                  placeholder="00.000.000/0001-00"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-400 mb-2 flex items-center gap-2">
                   <Instagram size={14} /> Instagram
                </label>
                <input 
                  type="text" 
                  value={formData.instagram}
                  onChange={e => setFormData({...formData, instagram: e.target.value})}
                  className="w-full bg-dark-900 border border-dark-600 rounded-lg p-3 text-white focus:border-primary-500 outline-none"
                  placeholder="@seunegocio"
                />
              </div>
            </div>
          </div>

          <div className="bg-dark-800 p-6 rounded-2xl border border-dark-700">
            <h3 className="text-lg font-bold text-white mb-6 flex items-center gap-2">
              <MapPin size={20} className="text-primary-500" />
              Contato e Endereço
            </h3>
            
            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-slate-400 mb-2 flex items-center gap-2">
                    <Phone size={14} /> Telefone / WhatsApp
                  </label>
                  <input 
                    type="text" 
                    value={formData.phone}
                    onChange={e => setFormData({...formData, phone: e.target.value})}
                    className="w-full bg-dark-900 border border-dark-600 rounded-lg p-3 text-white focus:border-primary-500 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-400 mb-2 flex items-center gap-2">
                    <Mail size={14} /> Email
                  </label>
                  <input 
                    type="email" 
                    value={formData.email}
                    onChange={e => setFormData({...formData, email: e.target.value})}
                    className="w-full bg-dark-900 border border-dark-600 rounded-lg p-3 text-white focus:border-primary-500 outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-400 mb-2">Endereço Completo</label>
                <textarea 
                  value={formData.address}
                  onChange={e => setFormData({...formData, address: e.target.value})}
                  className="w-full bg-dark-900 border border-dark-600 rounded-lg p-3 text-white focus:border-primary-500 outline-none min-h-[100px]"
                  placeholder="Rua, Número, Bairro, Cidade - UF"
                />
              </div>
            </div>
          </div>

          <div className="flex items-center justify-end gap-4">
            {showSuccess && (
              <span className="text-green-500 font-medium animate-pulse">
                Alterações salvas com sucesso!
              </span>
            )}
            <button 
              onClick={handleSave}
              className="bg-primary-600 hover:bg-primary-500 text-white px-8 py-4 rounded-xl font-bold flex items-center gap-2 shadow-lg shadow-primary-500/20 transition-all hover:scale-105"
            >
              <Save size={20} />
              Salvar Alterações
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Profile;