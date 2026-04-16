import React, { useEffect, useMemo, useState } from 'react';
import { AnimatePresence, m } from 'framer-motion';
import {
  Activity,
  Bell,
  Clock3,
  CreditCard,
  KeyRound,
  LogOut,
  Moon,
  Plus,
  Save,
  Settings2,
  Shield,
  ShieldUser,
  Store,
  Sun,
  Users,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import Modal from '../components/ui/Modal';
import { iosSpring } from '../components/motion/transitions';
import { supabase } from '../services/supabase';
import { useAuth } from '../contexts/AuthContext';
import { usePermissions } from '../contexts/PermissionsContext';
import { useTheme } from '../contexts/ThemeContext';
import { useData } from '../services/dataContext';
import { useToast } from '../components/ui/ToastProvider';
import { PREVIOUS_VISITED_ITEM_KEY } from '../components/Layout';
import { adminProvisionUser } from '../services/adminProvision';
import { PERMISSION_DEFINITIONS, ROLE_LABELS, type PermissionAction, type PermissionKey } from '../lib/permissions';
import type { AppRole } from '../types';
import { formatPhone } from '../utils/inputMasks';

type SettingsTab = 'menu' | 'accounts' | 'logs' | 'permissions';

type UserAccessRoleRow = {
  user_id: string;
  app_role: AppRole;
  display_name: string;
  email: string;
  created_at: string;
};

type ActivityLogRow = {
  id: number;
  user_id: string;
  user_email: string | null;
  app_role: AppRole;
  category: string;
  action: string;
  screen: string | null;
  metadata: Record<string, string | number | boolean> | null;
  occurred_at: string;
};

type CreateUserForm = {
  name: string;
  email: string;
  password: string;
  role: AppRole;
  storeId: string;
};

const CATEGORY_OPTIONS = ['all', 'vendas', 'financeiro', 'cancelamentos', 'estoque', 'navegacao', 'outros'] as const;
type LogCategory = (typeof CATEGORY_OPTIONS)[number];
type BrowserPushPermission = NotificationPermission | 'unsupported';

const categoryLabel: Record<LogCategory, string> = {
  all: 'Todos',
  vendas: 'Vendas',
  financeiro: 'Financeiro',
  cancelamentos: 'Cancelamentos',
  estoque: 'Estoque',
  navegacao: 'Navegacao',
  outros: 'Outros',
};

const categoryBadgeClass = (category: string): string => {
  if (category === 'vendas') return 'bg-emerald-100 text-emerald-700';
  if (category === 'financeiro') return 'bg-blue-100 text-blue-700';
  if (category === 'cancelamentos') return 'bg-rose-100 text-rose-700';
  if (category === 'estoque') return 'bg-amber-100 text-amber-700';
  if (category === 'navegacao') return 'bg-slate-100 text-slate-700';
  return 'bg-gray-100 text-gray-700';
};

const roleOptions: Array<{ value: AppRole; label: string }> = [
  { value: 'admin', label: 'Admin' },
  { value: 'manager', label: 'Gerente' },
  { value: 'seller', label: 'Vendedor' },
];

const getPushPermissionState = (): BrowserPushPermission => {
  if (typeof window === 'undefined' || !('Notification' in window)) return 'unsupported';
  return window.Notification.permission;
};

const isIOSDevice = () => {
  if (typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent.toLowerCase();
  return /iphone|ipad|ipod/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
};

const isStandaloneDisplayMode = () => {
  if (typeof window === 'undefined') return false;
  const nav = window.navigator as Navigator & { standalone?: boolean };
  return window.matchMedia('(display-mode: standalone)').matches || nav.standalone === true;
};

const normalizeModalUser = (user: UserAccessRoleRow | null): UserAccessRoleRow =>
  user || {
    user_id: '',
    app_role: 'seller',
    display_name: '',
    email: '',
    created_at: '',
  };

const Settings: React.FC = () => {
  const { user, role, signOut } = useAuth();
  const { stores, refreshData } = useData();
  const { matrix, updatePermission, isLoading: isPermissionsLoading } = usePermissions();
  const { resolvedTheme, toggleTheme } = useTheme();
  const navigate = useNavigate();
  const toast = useToast();

  const [previousVisitedItem, setPreviousVisitedItem] = useState<{ path: string; label: string } | null>(null);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const raw = window.localStorage.getItem(PREVIOUS_VISITED_ITEM_KEY);
    if (!raw) return;
    try {
      const parsed = JSON.parse(raw);
      if (parsed?.path && parsed?.label && parsed.path !== '/settings') {
        setPreviousVisitedItem({ path: parsed.path, label: parsed.label });
      }
    } catch {
      // ignore
    }
  }, []);

  const isAdmin = role === 'admin';

  const [activeTab, setActiveTab] = useState<SettingsTab>('menu');

  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isSavingAccount, setIsSavingAccount] = useState(false);
  const [isSavingPassword, setIsSavingPassword] = useState(false);

  const [accessUsers, setAccessUsers] = useState<UserAccessRoleRow[]>([]);
  const [isLoadingUsers, setIsLoadingUsers] = useState(false);

  const [isCreateUserModalOpen, setIsCreateUserModalOpen] = useState(false);
  const [isCreatingUser, setIsCreatingUser] = useState(false);
  const [createUserForm, setCreateUserForm] = useState<CreateUserForm>({
    name: '',
    email: '',
    password: '',
    role: 'seller',
    storeId: '',
  });

  const [selectedLogUser, setSelectedLogUser] = useState<UserAccessRoleRow | null>(null);
  const [isLogModalOpen, setIsLogModalOpen] = useState(false);
  const [isLoadingLogs, setIsLoadingLogs] = useState(false);
  const [logCategory, setLogCategory] = useState<LogCategory>('all');
  const [activityLogs, setActivityLogs] = useState<ActivityLogRow[]>([]);

  const [updatingPermissionId, setUpdatingPermissionId] = useState<string | null>(null);
  const [pushPermissionState, setPushPermissionState] = useState<BrowserPushPermission>(() => getPushPermissionState());
  const [isRequestingPushPermission, setIsRequestingPushPermission] = useState(false);

  useEffect(() => {
    setFullName((user?.user_metadata?.full_name as string) || (user?.user_metadata?.name as string) || '');
    setPhone(formatPhone((user?.user_metadata?.phone as string) || ''));
    setEmail(user?.email || '');
  }, [user]);

  const tabs = useMemo(() => {
    const allTabs: Array<{ id: SettingsTab; label: string; icon: React.ComponentType<{ size?: number }> }> = [
      { id: 'menu', label: 'Menu', icon: Settings2 },
    ];

    if (isAdmin) {
      allTabs.push(
        { id: 'accounts', label: 'Senhas e Contas', icon: KeyRound },
        { id: 'logs', label: 'Log de usuarios', icon: Activity },
        { id: 'permissions', label: 'Permissoes e Privacidade', icon: Shield }
      );
    }

    return allTabs;
  }, [isAdmin]);

  useEffect(() => {
    if (tabs.some((tab) => tab.id === activeTab)) return;
    setActiveTab('menu');
  }, [activeTab, tabs]);

  const roleLabel = useMemo(() => ROLE_LABELS[role || 'seller'], [role]);
  const pushPermissionStatusLabel = useMemo(() => {
    if (pushPermissionState === 'granted') return 'Ativado';
    if (pushPermissionState === 'denied') return 'Bloqueado';
    if (pushPermissionState === 'default') return 'Não decidido';
    return 'Não suportado';
  }, [pushPermissionState]);

  useEffect(() => {
    const sync = () => setPushPermissionState(getPushPermissionState());
    sync();

    const handleVisibility = () => {
      if (document.visibilityState === 'visible') sync();
    };

    window.addEventListener('focus', sync);
    document.addEventListener('visibilitychange', handleVisibility);
    return () => {
      window.removeEventListener('focus', sync);
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, []);

  const loadAccessUsers = async () => {
    if (!isAdmin) return;

    setIsLoadingUsers(true);
    try {
      const { data, error } = await supabase
        .from('user_access_roles')
        .select('user_id, app_role, display_name, email, created_at')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setAccessUsers((data || []) as UserAccessRoleRow[]);
    } catch (error: any) {
      toast.error(error?.message || 'Nao foi possivel carregar usuarios.');
    } finally {
      setIsLoadingUsers(false);
    }
  };

  useEffect(() => {
    if (!isAdmin) return;
    void loadAccessUsers();
  }, [isAdmin]);

  const handleSaveAccount = async () => {
    if (!user) return;
    if (!email.trim()) {
      toast.error('Informe um email valido.');
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
          phone: nextPhone,
          name: nextName,
        },
      };

      if (emailChanged) {
        payload.email = nextEmail;
      }

      const { error } = await supabase.auth.updateUser(payload);
      if (error) throw error;

      toast.success(emailChanged ? 'Dados salvos. Confirme o novo email na sua caixa de entrada.' : 'Dados pessoais atualizados.');
    } catch (error: any) {
      toast.error(error?.message || 'Nao foi possivel salvar os dados da conta.');
    } finally {
      setIsSavingAccount(false);
    }
  };

  const handleChangePassword = async () => {
    if (!newPassword || !confirmPassword) {
      toast.error('Preencha a nova senha e a confirmacao.');
      return;
    }
    if (newPassword.length < 6) {
      toast.error('A senha deve ter no minimo 6 caracteres.');
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error('A confirmacao de senha nao confere.');
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
      toast.error(error?.message || 'Nao foi possivel atualizar a senha.');
    } finally {
      setIsSavingPassword(false);
    }
  };

  const handleCreateUser = async () => {
    const name = createUserForm.name.trim();
    const userEmail = createUserForm.email.trim();

    if (!name) {
      toast.error('Informe o nome do usuario.');
      return;
    }

    if (!userEmail) {
      toast.error('Informe o email de acesso.');
      return;
    }

    if (createUserForm.password.length < 6) {
      toast.error('A senha deve ter no minimo 6 caracteres.');
      return;
    }

    setIsCreatingUser(true);
    try {
      await adminProvisionUser({
        name,
        email: userEmail,
        password: createUserForm.password,
        role: createUserForm.role,
        storeId: createUserForm.role === 'admin' ? undefined : createUserForm.storeId || undefined,
      });

      await Promise.all([loadAccessUsers(), refreshData()]);

      setCreateUserForm({
        name: '',
        email: '',
        password: '',
        role: 'seller',
        storeId: '',
      });
      setIsCreateUserModalOpen(false);
      toast.success('Usuario criado com sucesso.');
    } catch (error: any) {
      toast.error(error?.message || 'Nao foi possivel criar o usuario.');
    } finally {
      setIsCreatingUser(false);
    }
  };

  const openUserLogs = async (targetUser: UserAccessRoleRow) => {
    setSelectedLogUser(targetUser);
    setIsLogModalOpen(true);
    setLogCategory('all');
    setIsLoadingLogs(true);

    try {
      const { data, error } = await supabase
        .from('app_user_activity_logs')
        .select('id, user_id, user_email, app_role, category, action, screen, metadata, occurred_at')
        .eq('user_id', targetUser.user_id)
        .order('occurred_at', { ascending: false })
        .limit(300);

      if (error) throw error;
      setActivityLogs((data || []) as ActivityLogRow[]);
    } catch (error: any) {
      toast.error(error?.message || 'Nao foi possivel carregar o log do usuario.');
      setActivityLogs([]);
    } finally {
      setIsLoadingLogs(false);
    }
  };

  const filteredLogs = useMemo(() => {
    if (logCategory === 'all') return activityLogs;
    return activityLogs.filter((entry) => entry.category === logCategory);
  }, [activityLogs, logCategory]);

  const handlePermissionChange = async (
    targetRole: AppRole,
    permissionKey: PermissionKey,
    action: PermissionAction,
    checked: boolean
  ) => {
    const opKey = `${targetRole}:${permissionKey}:${action}`;
    setUpdatingPermissionId(opKey);

    try {
      const current = matrix[targetRole][permissionKey];

      if (action === 'visible' && !checked) {
        await updatePermission(targetRole, permissionKey, {
          visible: false,
          editable: false,
          deletable: false,
        });
      } else if (action === 'editable' && !checked && current.deletable) {
        await updatePermission(targetRole, permissionKey, {
          editable: false,
          deletable: false,
        });
      } else {
        await updatePermission(targetRole, permissionKey, { [action]: checked });
      }
    } catch (error: any) {
      toast.error(error?.message || 'Nao foi possivel atualizar permissao.');
    } finally {
      setUpdatingPermissionId(null);
    }
  };

  const requestSystemPushPermission = async () => {
    if (typeof window === 'undefined' || !('Notification' in window)) {
      setPushPermissionState('unsupported');
      toast.info('Este navegador não suporta notificações push.', {
        title: 'Push indisponível',
      });
      return;
    }

    if (isRequestingPushPermission) return;

    setIsRequestingPushPermission(true);
    try {
      const permission = await window.Notification.requestPermission();
      setPushPermissionState(permission);

      if (permission === 'granted') {
        toast.success('Notificações push foram ativadas para este dispositivo.', {
          title: 'Push autorizado',
        });
        return;
      }

      if (permission === 'denied') {
        toast.error('Ative novamente em Ajustes > Notificações > iPhoneRepasse Pro.', {
          title: 'Push bloqueado',
          durationMs: 8000,
        });
        return;
      }

      toast.info('Quando quiser, toque novamente em "Ativar notificações push".', {
        title: 'Permissão não concluída',
      });
    } catch (error: any) {
      toast.error(error?.message || 'Não foi possível solicitar permissão de notificações.');
    } finally {
      setIsRequestingPushPermission(false);
    }
  };

  const handlePushPermissionRequest = () => {
    if (pushPermissionState === 'unsupported') {
      toast.info('Este navegador não suporta notificações push.', {
        title: 'Push indisponível',
      });
      return;
    }

    if (pushPermissionState === 'granted') {
      toast.success('As notificações push já estão ativas neste dispositivo.', {
        title: 'Push já habilitado',
      });
      return;
    }

    if (isIOSDevice() && !isStandaloneDisplayMode()) {
      toast.info('No iPhone, instale na Tela de Início para habilitar notificações push no Safari.', {
        title: 'Instale como app',
        durationMs: 8000,
      });
      return;
    }

    toast.info('Você verá o alerta do sistema para permitir alertas de vendas, garantias e atividades do app.', {
      title: 'Permissão de notificações',
      durationMs: 9000,
      action: {
        label: 'Continuar',
        onClick: () => {
          void requestSystemPushPermission();
        },
      },
    });
  };

  const selectedUser = normalizeModalUser(selectedLogUser);

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div>
        <h2 className="text-[28px] md:text-ios-large font-bold text-gray-900 dark:text-white tracking-tight">Configuracoes</h2>
        <p className="text-ios-subhead text-gray-500 dark:text-surface-dark-500 mt-0.5">Gerencie menu, acessos, logs e politicas de permissao.</p>
      </div>

      <div className="ios-card p-4">
        <div className="flex flex-wrap gap-2">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={`inline-flex items-center gap-2 px-4 py-2 rounded-ios-lg border transition-colors ${
                  isActive
                    ? 'bg-brand-500 text-white border-brand-500'
                    : 'bg-white dark:bg-surface-dark-100 text-gray-700 dark:text-surface-dark-700 border-gray-200 dark:border-surface-dark-300 hover:bg-gray-50 dark:hover:bg-surface-dark-200'
                }`}
              >
                <Icon size={16} />
                <span className="text-sm font-medium">{tab.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {activeTab === 'menu' && (
        <div className="ios-card p-5 space-y-5">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-gray-100 dark:bg-surface-dark-200 text-sm text-gray-700 dark:text-surface-dark-700">
            <ShieldUser size={14} />
            <span>Perfil atual: <strong>{roleLabel}</strong></span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <button
              type="button"
              onClick={() => previousVisitedItem && navigate(previousVisitedItem.path)}
              disabled={!previousVisitedItem}
              className="w-full flex items-center gap-3 px-4 py-3 rounded-ios-lg border border-gray-200 dark:border-surface-dark-300 hover:bg-gray-50 dark:hover:bg-surface-dark-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-left"
            >
              <Clock3 size={18} className="text-brand-500 shrink-0" />
              <div className="min-w-0">
                <p className="text-xs uppercase tracking-wide text-gray-500 dark:text-surface-dark-500">Última visita</p>
                <p className="text-sm font-semibold text-gray-900 dark:text-white truncate">
                  {previousVisitedItem ? previousVisitedItem.label : 'Nenhuma'}
                </p>
              </div>
            </button>

            <button
              type="button"
              onClick={toggleTheme}
              className="w-full flex items-center gap-3 px-4 py-3 rounded-ios-lg bg-gray-100 dark:bg-surface-dark-200 text-gray-700 dark:text-surface-dark-700 hover:bg-gray-200 dark:hover:bg-surface-dark-300 transition-colors"
            >
              {resolvedTheme === 'dark' ? (
                <>
                  <Sun size={18} className="text-accent-500 shrink-0" />
                  <span className="text-sm font-medium">Modo Claro</span>
                </>
              ) : (
                <>
                  <Moon size={18} className="text-brand-500 shrink-0" />
                  <span className="text-sm font-medium">Modo Escuro</span>
                </>
              )}
            </button>

            <button
              type="button"
              onClick={() => void signOut()}
              className="w-full flex items-center gap-3 px-4 py-3 rounded-ios-lg bg-red-50 dark:bg-red-900/20 text-red-600 hover:bg-red-100 dark:hover:bg-red-900/30 transition-colors"
            >
              <LogOut size={18} className="shrink-0" />
              <span className="text-sm font-medium">Sair</span>
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <button
              type="button"
              onClick={() => navigate('/profile')}
              disabled={!isAdmin}
              className="w-full text-left rounded-ios-lg border border-gray-200 dark:border-surface-dark-300 p-4 hover:bg-gray-50 dark:hover:bg-surface-dark-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <div className="flex items-center gap-2 text-gray-900 dark:text-white font-semibold">
                <Store size={18} className="text-brand-500" />
                Editar Perfil da Loja
              </div>
              <p className="text-ios-footnote text-gray-500 mt-1">
                {isAdmin ? 'Ajuste logo, nome, contatos e dados institucionais.' : 'Disponivel apenas para administradores.'}
              </p>
            </button>

            <button
              type="button"
              onClick={() => navigate('/settings/card-fees')}
              className="w-full text-left rounded-ios-lg border border-gray-200 dark:border-surface-dark-300 p-4 hover:bg-gray-50 dark:hover:bg-surface-dark-200 transition-colors"
            >
              <div className="flex items-center gap-2 text-gray-900 dark:text-white font-semibold">
                <CreditCard size={18} className="text-brand-500" />
                Editar Taxas
              </div>
              <p className="text-ios-footnote text-gray-500 mt-1">
                {isAdmin ? 'Configure as taxas de cartao para o PDV.' : 'Visualize as taxas de cartao usadas no PDV.'}
              </p>
            </button>

            <button
              type="button"
              onClick={handlePushPermissionRequest}
              disabled={isRequestingPushPermission}
              className="w-full text-left rounded-ios-lg border border-gray-200 dark:border-surface-dark-300 p-4 hover:bg-gray-50 dark:hover:bg-surface-dark-200 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
            >
              <div className="flex items-center gap-2 text-gray-900 dark:text-white font-semibold">
                <Bell size={18} className="text-brand-500" />
                Notificações Push
              </div>
              <p className="text-ios-footnote text-gray-500 mt-1">
                Status atual: <span className="font-semibold">{pushPermissionStatusLabel}</span>
              </p>
              <p className="text-xs text-gray-500 mt-1">
                {isRequestingPushPermission
                  ? 'Aguardando resposta do sistema...'
                  : 'Solicite permissão no padrão iOS com pré-aviso e CTA único.'}
              </p>
            </button>

            {isAdmin && (
              <button
                type="button"
                onClick={() => setActiveTab('accounts')}
                className="w-full text-left rounded-ios-lg border border-gray-200 dark:border-surface-dark-300 p-4 hover:bg-gray-50 dark:hover:bg-surface-dark-200 transition-colors"
              >
                <div className="flex items-center gap-2 text-gray-900 dark:text-white font-semibold">
                  <KeyRound size={18} className="text-brand-500" />
                  Senhas e Contas
                </div>
                <p className="text-ios-footnote text-gray-500 mt-1">Gerencie senha da conta e crie novos usuarios do app.</p>
              </button>
            )}
          </div>
        </div>
      )}

      {activeTab === 'accounts' && isAdmin && (
        <div className="space-y-6">
          <div className="ios-card p-5">
            <h3 className="text-ios-title-3 font-bold text-gray-900 dark:text-white mb-4">Dados da Conta</h3>

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
                  maxLength={15}
                  onChange={(e) => setPhone(formatPhone(e.target.value))}
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
                  placeholder="Minimo 6 caracteres"
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

          <div className="ios-card p-5">
            <div className="flex items-center justify-between gap-3 mb-4">
              <div>
                <h3 className="text-ios-title-3 font-bold text-gray-900 dark:text-white">Usuarios do App</h3>
                <p className="text-ios-footnote text-gray-500 mt-1">Criacao de usuario Auth sem confirmacao por email.</p>
              </div>
              <button type="button" className="ios-button-primary inline-flex items-center gap-2" onClick={() => setIsCreateUserModalOpen(true)}>
                <Plus size={16} />
                Criar usuario
              </button>
            </div>

            {isLoadingUsers ? (
              <p className="text-ios-subhead text-gray-500">Carregando usuarios...</p>
            ) : accessUsers.length === 0 ? (
              <p className="text-ios-subhead text-gray-500">Nenhum usuario encontrado.</p>
            ) : (
              <div className="space-y-2">
                {accessUsers.map((entry) => (
                  <div
                    key={entry.user_id}
                    className="border border-gray-200 dark:border-surface-dark-300 rounded-ios-lg px-4 py-3 flex items-center justify-between gap-3"
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-gray-900 dark:text-white truncate">{entry.display_name}</p>
                      <p className="text-xs text-gray-500 truncate">{entry.email}</p>
                    </div>
                    <span className="text-xs px-2.5 py-1 rounded-full bg-brand-50 text-brand-700 border border-brand-200">
                      {ROLE_LABELS[entry.app_role]}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {activeTab === 'logs' && isAdmin && (
        <div className="ios-card p-5">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 mb-4">
            <div>
              <h3 className="text-ios-title-3 font-bold text-gray-900 dark:text-white">Log de usuarios</h3>
              <p className="text-ios-footnote text-gray-500 mt-1">Auditoria por usuario em timeline cronologica com motion.</p>
            </div>
          </div>

          {isLoadingUsers ? (
            <p className="text-ios-subhead text-gray-500">Carregando usuarios...</p>
          ) : accessUsers.length === 0 ? (
            <p className="text-ios-subhead text-gray-500">Sem usuarios para auditar.</p>
          ) : (
            <div className="space-y-2">
              {accessUsers.map((entry) => (
                <button
                  key={entry.user_id}
                  type="button"
                  onClick={() => void openUserLogs(entry)}
                  className="w-full text-left border border-gray-200 dark:border-surface-dark-300 rounded-ios-lg px-4 py-3 hover:bg-gray-50 dark:hover:bg-surface-dark-200 transition-colors flex items-center justify-between gap-3"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-gray-900 dark:text-white truncate">{entry.display_name}</p>
                    <p className="text-xs text-gray-500 truncate">{entry.email}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs px-2.5 py-1 rounded-full bg-brand-50 text-brand-700 border border-brand-200">
                      {ROLE_LABELS[entry.app_role]}
                    </span>
                    <span className="text-xs text-gray-500">Ver historico</span>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {activeTab === 'permissions' && isAdmin && (
        <div className="ios-card p-5 space-y-6">
          <div>
            <h3 className="text-ios-title-3 font-bold text-gray-900 dark:text-white">Permissoes e Privacidade</h3>
            <p className="text-ios-footnote text-gray-500 mt-1">
              Controle por funcao o que fica visivel, editavel ou excluivel no app.
            </p>
          </div>

          {isPermissionsLoading ? (
            <p className="text-ios-subhead text-gray-500">Carregando permissoes...</p>
          ) : (
            <div className="space-y-6">
              <div className="rounded-ios-lg border border-gray-200 dark:border-surface-dark-300 bg-gray-50/70 dark:bg-surface-dark-200 p-4">
                <p className="text-sm font-semibold text-gray-900 dark:text-white">Mapeamento atual de permissões de dispositivo</p>
                <div className="mt-2 space-y-1 text-xs text-gray-600 dark:text-surface-dark-600">
                  <p>• Câmera e Fotos: usadas no cadastro/edição de aparelho em Estoque e na troca do PDV (componente `StockFormModal`).</p>
                  <p>• Push: solicitada manualmente em Configurações &gt; Menu &gt; Notificações Push.</p>
                </div>
              </div>

              {(Object.keys(ROLE_LABELS) as AppRole[]).map((targetRole) => (
                <div key={targetRole} className="border border-gray-200 dark:border-surface-dark-300 rounded-ios-xl overflow-hidden">
                  <div className="px-4 py-3 bg-gray-50 dark:bg-surface-dark-200 border-b border-gray-200 dark:border-surface-dark-300 flex items-center gap-2">
                    <Users size={16} className="text-brand-500" />
                    <p className="text-sm font-semibold text-gray-900 dark:text-white">{ROLE_LABELS[targetRole]}</p>
                  </div>

                  <div className="overflow-x-auto">
                    <table className="w-full text-sm min-w-[760px]">
                      <thead>
                        <tr className="text-left text-gray-500 border-b border-gray-100 dark:border-surface-dark-300">
                          <th className="px-4 py-3 font-medium">Modulo</th>
                          <th className="px-4 py-3 font-medium">Visivel</th>
                          <th className="px-4 py-3 font-medium">Editavel</th>
                          <th className="px-4 py-3 font-medium">Excluivel</th>
                        </tr>
                      </thead>
                      <tbody>
                        {PERMISSION_DEFINITIONS.map((permission) => {
                          const current = matrix[targetRole][permission.key];
                          return (
                            <tr key={`${targetRole}-${permission.key}`} className="border-b border-gray-100 dark:border-surface-dark-300 last:border-b-0">
                              <td className="px-4 py-3 text-gray-900 dark:text-white">{permission.label}</td>
                              {(['visible', 'editable', 'deletable'] as PermissionAction[]).map((action) => {
                                const toggleId = `${targetRole}:${permission.key}:${action}`;
                                const isUpdating = updatingPermissionId === toggleId;
                                const checked = current[action];
                                const disableByRule = action !== 'visible' && !current.visible;
                                const isDashboardVisibilityLock = permission.key === 'dashboard' && action === 'visible';
                                const isAdminRowLocked = targetRole === 'admin';

                                return (
                                  <td key={toggleId} className="px-4 py-3">
                                    <label className="inline-flex items-center gap-2">
                                      <input
                                        type="checkbox"
                                        checked={checked}
                                        disabled={isUpdating || disableByRule || isDashboardVisibilityLock || isAdminRowLocked}
                                        onChange={(event) => {
                                          void handlePermissionChange(targetRole, permission.key, action, event.target.checked);
                                        }}
                                      />
                                      <span className="text-xs text-gray-500">{checked ? 'Sim' : 'Nao'}</span>
                                    </label>
                                  </td>
                                );
                              })}
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      <Modal
        open={isCreateUserModalOpen}
        onClose={() => {
          if (!isCreatingUser) setIsCreateUserModalOpen(false);
        }}
        title="Criar usuario"
        size="md"
        footer={(
          <div className="flex justify-end gap-2">
            <button type="button" className="ios-button-secondary" onClick={() => setIsCreateUserModalOpen(false)} disabled={isCreatingUser}>
              Cancelar
            </button>
            <button type="button" className="ios-button-primary" onClick={() => void handleCreateUser()} disabled={isCreatingUser}>
              {isCreatingUser ? 'Criando...' : 'Criar usuario'}
            </button>
          </div>
        )}
      >
        <div className="space-y-4">
          <div>
            <label className="ios-label">Nome</label>
            <input
              type="text"
              className="ios-input"
              value={createUserForm.name}
              onChange={(e) => setCreateUserForm((prev) => ({ ...prev, name: e.target.value }))}
              placeholder="Nome completo"
            />
          </div>
          <div>
            <label className="ios-label">Email</label>
            <input
              type="email"
              className="ios-input"
              value={createUserForm.email}
              onChange={(e) => setCreateUserForm((prev) => ({ ...prev, email: e.target.value }))}
              placeholder="usuario@empresa.com"
            />
          </div>
          <div>
            <label className="ios-label">Senha inicial</label>
            <input
              type="password"
              className="ios-input"
              value={createUserForm.password}
              onChange={(e) => setCreateUserForm((prev) => ({ ...prev, password: e.target.value }))}
              placeholder="Minimo 6 caracteres"
            />
          </div>
          <div>
            <label className="ios-label">Funcao</label>
            <select
              className="ios-input"
              value={createUserForm.role}
              onChange={(e) => setCreateUserForm((prev) => ({ ...prev, role: e.target.value as AppRole }))}
            >
              {roleOptions.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
          </div>

          {createUserForm.role !== 'admin' && (
            <div>
              <label className="ios-label">Loja (opcional)</label>
              <select
                className="ios-input"
                value={createUserForm.storeId}
                onChange={(e) => setCreateUserForm((prev) => ({ ...prev, storeId: e.target.value }))}
              >
                <option value="">Sem loja vinculada</option>
                {stores.map((store) => (
                  <option key={store.id} value={store.id}>
                    {store.name} ({store.city})
                  </option>
                ))}
              </select>
            </div>
          )}

          <p className="text-xs text-gray-500">
            O usuario e criado no Auth com email confirmado automaticamente (sem confirmacao por email).
          </p>
        </div>
      </Modal>

      <Modal
        open={isLogModalOpen}
        onClose={() => {
          if (!isLoadingLogs) {
            setIsLogModalOpen(false);
            setActivityLogs([]);
            setSelectedLogUser(null);
          }
        }}
        title={`Historico cronologico - ${selectedUser.display_name || 'Usuario'}`}
        size="xl"
      >
        <div className="space-y-4">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
            <div className="text-xs text-gray-500">
              <p>{selectedUser.email}</p>
              <p>Funcao: {ROLE_LABELS[selectedUser.app_role]}</p>
            </div>

            <select
              className="ios-input md:w-56"
              value={logCategory}
              onChange={(e) => setLogCategory(e.target.value as LogCategory)}
            >
              {CATEGORY_OPTIONS.map((category) => (
                <option key={category} value={category}>{categoryLabel[category]}</option>
              ))}
            </select>
          </div>

          {isLoadingLogs ? (
            <p className="text-ios-subhead text-gray-500">Carregando historico...</p>
          ) : filteredLogs.length === 0 ? (
            <p className="text-ios-subhead text-gray-500">Nenhum evento encontrado para este filtro.</p>
          ) : (
            <div className="space-y-2 max-h-[58vh] overflow-y-auto pr-1">
              <AnimatePresence initial={false}>
                {filteredLogs.map((entry) => (
                  <m.div
                    key={`${entry.id}-${entry.occurred_at}`}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -6 }}
                    transition={iosSpring}
                    className="rounded-ios-lg border border-gray-200 dark:border-surface-dark-300 px-4 py-3"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                      <span className={`text-xs px-2.5 py-1 rounded-full ${categoryBadgeClass(entry.category)}`}>
                        {entry.category || 'outros'}
                      </span>
                      <span className="text-xs text-gray-500">{new Date(entry.occurred_at).toLocaleString('pt-BR')}</span>
                    </div>
                    <p className="text-sm font-semibold text-gray-900 dark:text-white">{entry.action}</p>
                    {entry.screen ? <p className="text-xs text-gray-500 mt-1">Tela: {entry.screen}</p> : null}
                    {entry.metadata && Object.keys(entry.metadata).length > 0 ? (
                      <pre className="mt-2 text-[11px] leading-5 bg-gray-50 dark:bg-surface-dark-200 rounded-ios p-2 overflow-x-auto text-gray-600 dark:text-surface-dark-600">
                        {JSON.stringify(entry.metadata, null, 2)}
                      </pre>
                    ) : null}
                  </m.div>
                ))}
              </AnimatePresence>
            </div>
          )}
        </div>
      </Modal>
    </div>
  );
};

export default Settings;
