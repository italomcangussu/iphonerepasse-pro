import React, { useState, useEffect } from 'react';
import { useData } from '../services/dataContext';
import { Save, Upload, Building2, MapPin, Phone, Mail, Instagram, X, Loader2 } from 'lucide-react';
import { uploadImage } from '../services/storage';

const Profile: React.FC = () => {
  const { businessProfile, updateBusinessProfile } = useData();
  const [formData, setFormData] = useState(businessProfile);
  const [showSuccess, setShowSuccess] = useState(false);
  const [isUploading, setIsUploading] = useState(false);

  useEffect(() => {
    setFormData(businessProfile);
  }, [businessProfile]);

  const handleSave = () => {
    updateBusinessProfile(formData);
    setShowSuccess(true);
    setTimeout(() => setShowSuccess(false), 3000);
  };

  const handleLogoChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setIsUploading(true);
      const publicUrl = await uploadImage(file, 'logos');
      if (publicUrl) {
        setFormData(prev => ({ ...prev, logoUrl: publicUrl }));
      }
      setIsUploading(false);
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
                  <img src={formData.logoUrl} alt="Logo" className="w-full h-full object-contain" />
                ) : (
                  <>
                    <img
                      src="/brand/logo-mark-dark.svg"
                      alt="iPhoneRepasse"
                      className="w-16 h-16 object-contain dark:hidden"
                    />
                    <img
                      src="/brand/logo-mark-light.svg"
                      alt="iPhoneRepasse"
                      className="w-16 h-16 object-contain hidden dark:block"
                    />
                  </>
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
                  onChange={e => setFormData({...formData, cnpj: e.target.value})}
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
                    onChange={e => setFormData({...formData, phone: e.target.value})}
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

          <div className="flex items-center justify-end gap-4">
            {showSuccess && (
              <span className="text-green-600 font-medium animate-pulse">
                Alterações salvas com sucesso!
              </span>
            )}
            <button 
              onClick={handleSave}
              className="ios-button-primary flex items-center gap-2"
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
