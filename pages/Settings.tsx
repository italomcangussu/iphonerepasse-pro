import React, { useEffect, useMemo, useState } from 'react';
import { KeyRound, LogOut, Save, ShieldUser, Store } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../services/supabase';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../components/ui/ToastProvider';

const Settings: React.FC = () => {
  const { user, role, signOut } = useAuth();
  const navigate = useNavigate();
  const toast = useToast();

  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isSavingAccount, setIsSavingAccount] = useState(false);
  const [isSavingPassword, setIsSavingPassword] = useState(false);

  useEffect(() => {
    setFullName((user?.user_metadata?.full_name as string) || '');
    setPhone((user?.user_metadata?.phone as string) || '');
    setEmail(user?.email || '');
  }, [user]);

  const roleLabel = useMemo(() => {
    if (role === 'admin') return 'Admin';
    if (role === 'seller') return 'Vendedor';
    return 'Usuário';
  }, [role]);

  const handleSaveAccount = async () => {
    if (!user) return;
    if (!email.trim()) {
      toast.error('Informe um email válido.');
      return;
    }

    setIsSavingAccount(true);
    try {
      const nextName = fullName.trim();
      const nextPhone = phone.trim();
      const nextEmail = email.trim();
      const emailChanged = nextEmail !== (user.email || '');

      const payload: { email?: string; data: Record<string, any> } = {
        data: {
          ...(user.user_metadata || {}),
          full_name: nextName,
          phone: nextPhone
        }
      };

      if (emailChanged) {
        payload.email = nextEmail;
      }

      const { error } = await supabase.auth.updateUser(payload);
      if (error) throw error;

      toast.success(emailChanged ? 'Dados salvos. Confirme o novo email na sua caixa de entrada.' : 'Dados pessoais atualizados.');
    } catch (error: any) {
      toast.error(error?.message || 'Não foi possível salvar os dados da conta.');
    } finally {
      setIsSavingAccount(false);
    }
  };

  const handleChangePassword = async () => {
    if (!newPassword || !confirmPassword) {
      toast.error('Preencha a nova senha e a confirmação.');
      return;
    }
    if (newPassword.length < 6) {
      toast.error('A senha deve ter no mínimo 6 caracteres.');
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error('A confirmação de senha não confere.');
      return;
    }

    setIsSavingPassword(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) throw error;

      setNewPassword('');
      setConfirmPassword('');
      toast.success('Senha atualizada com sucesso.');
    } catch (error: any) {
      toast.error(error?.message || 'Não foi possível atualizar a senha.');
    } finally {
      setIsSavingPassword(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div>
        <h2 className="text-[28px] md:text-ios-large font-bold text-gray-900 dark:text-white tracking-tight">Configurações</h2>
        <p className="text-ios-subhead text-gray-500 dark:text-surface-dark-500 mt-0.5">Gerencie perfil, credenciais e dados da conta.</p>
      </div>

      <div className="ios-card p-5">
        <h3 className="text-ios-title-3 font-bold text-gray-900 dark:text-white mb-4">Menu</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <button
            type="button"
            onClick={() => navigate('/profile')}
            disabled={role !== 'admin'}
            className="w-full text-left rounded-ios-lg border border-gray-200 dark:border-surface-dark-300 p-4 hover:bg-gray-50 dark:hover:bg-surface-dark-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <div className="flex items-center gap-2 text-gray-900 dark:text-white font-semibold">
              <Store size={18} className="text-brand-500" />
              Editar Perfil da Loja
            </div>
            <p className="text-ios-footnote text-gray-500 mt-1">
              {role === 'admin' ? 'Ajuste logo, nome, contatos e dados institucionais.' : 'Disponível apenas para administradores.'}
            </p>
          </button>

          <div className="rounded-ios-lg border border-gray-200 dark:border-surface-dark-300 p-4 bg-gray-50 dark:bg-surface-dark-200">
            <div className="flex items-center gap-2 text-gray-900 dark:text-white font-semibold">
              <ShieldUser size={18} className="text-brand-500" />
              Senhas e Contas
            </div>
            <p className="text-ios-footnote text-gray-500 mt-1">Use os formulários abaixo para atualizar seus dados e senha.</p>
          </div>
        </div>
      </div>

      <div className="ios-card p-5">
        <h3 className="text-ios-title-3 font-bold text-gray-900 dark:text-white mb-4">Senhas e Contas</h3>
        <div className="inline-flex items-center gap-2 mb-4 px-3 py-1.5 rounded-full bg-gray-100 dark:bg-surface-dark-200 text-sm text-gray-700 dark:text-surface-dark-700">
          <ShieldUser size={14} />
          <span>Role atual: <strong>{roleLabel}</strong></span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="ios-label">Nome completo</label>
            <input
              type="text"
              className="ios-input"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="Seu nome"
            />
          </div>
          <div>
            <label className="ios-label">Telefone</label>
            <input
              type="text"
              className="ios-input"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="(00) 00000-0000"
            />
          </div>
          <div className="md:col-span-2">
            <label className="ios-label">Email de acesso</label>
            <input
              type="email"
              className="ios-input"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="voce@email.com"
            />
          </div>
        </div>

        <div className="mt-5 flex justify-end">
          <button type="button" className="ios-button-primary flex items-center gap-2" onClick={handleSaveAccount} disabled={isSavingAccount}>
            <Save size={18} />
            {isSavingAccount ? 'Salvando...' : 'Salvar Dados da Conta'}
          </button>
        </div>
      </div>

      <div className="ios-card p-5">
        <h3 className="text-ios-title-3 font-bold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
          <KeyRound size={18} className="text-brand-500" />
          Alterar Senha
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="ios-label">Nova senha</label>
            <input
              type="password"
              className="ios-input"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="Mínimo 6 caracteres"
            />
          </div>
          <div>
            <label className="ios-label">Confirmar nova senha</label>
            <input
              type="password"
              className="ios-input"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Repita a nova senha"
            />
          </div>
        </div>

        <div className="mt-5 flex flex-wrap justify-end gap-3">
          <button type="button" className="ios-button-primary" onClick={handleChangePassword} disabled={isSavingPassword}>
            {isSavingPassword ? 'Atualizando...' : 'Atualizar Senha'}
          </button>
          <button type="button" onClick={() => void signOut()} className="ios-button-secondary text-red-600 border-red-200">
            <LogOut size={16} className="inline mr-1" />
            Sair da Conta
          </button>
        </div>
      </div>
    </div>
  );
};

export default Settings;
