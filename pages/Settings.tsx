import React, { useEffect, useMemo, useState } from 'react';
import { useDisclosure } from '../hooks/useDisclosure';
import { AnimatePresence, m } from 'framer-motion';
import {
  Activity,
  Banknote,
  Bell,
  Clock3,
  CreditCard,
  Download,
  Edit,
  ExternalLink,
  Info,
  KeyRound,
  LogOut,
  Moon,
  Plus,
  RefreshCw,
  Save,
  Settings2,
  Shield,
  ShieldUser,
  Smartphone,
  Store,
  Sun,
  Trash2,
  Users,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import Modal from '../components/ui/Modal';
import PushOptIn from '../components/pwa/PushOptIn';
import { useConsents } from '../hooks/useConsents';
import { DPO_CONTACT_EMAIL, PRIVACY_POLICY_VERSION } from '../constants';
import { iosSpring } from '../components/motion/transitions';
import { supabase } from '../services/supabase';
import { useAuth } from '../contexts/AuthContext';
import { usePermissions } from '../contexts/PermissionsContext';
import { useTheme } from '../contexts/ThemeContext';
import { useData } from '../services/dataContext';
import { useToast } from '../components/ui/ToastProvider';
import { useAsyncHandler } from '../hooks/useAsyncHandler';
import { PREVIOUS_VISITED_ITEM_KEY } from '../components/Layout';
import { adminProvisionUser } from '../services/adminProvision';
import { adminDeleteUser, adminUpdateUser } from '../services/adminManageUser';
import { PERMISSION_DEFINITIONS, ROLE_LABELS, type PermissionAction, type PermissionKey } from '../lib/permissions';
import type { AppRole, FinancialCategory } from '../types';
import { formatPhone } from '../utils/inputMasks';
import { assertNoError } from '../utils/supabase';

type SettingsTab = 'menu' | 'accounts' | 'logs' | 'permissions' | 'finance' | 'privacy' | 'notifications' | 'about';

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
  sellerId: string;
};

type EditUserForm = {
  userId: string;
  name: string;
  email: string;
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
  const { stores, refreshData, sellers } = useData();
  const { matrix, updatePermission, isLoading: isPermissionsLoading } = usePermissions();
  const { resolvedTheme, toggleTheme } = useTheme();
  const navigate = useNavigate();
  const toast = useToast();
  const run = useAsyncHandler();
  const { needsBanner: _needsBanner, hasConsent: _hasConsent, grantConsents: _grantConsents, revokeConsent: _revokeConsent, consents: _consents } = useConsents(user?.id);

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

  const { isOpen: isCreateUserModalOpen, open: openCreateUserModal, close: closeCreateUserModal } = useDisclosure();
  const [isCreatingUser, setIsCreatingUser] = useState(false);
  const [createUserForm, setCreateUserForm] = useState<CreateUserForm>({
    name: '',
    email: '',
    password: '',
    role: 'seller',
    storeId: '',
    sellerId: '',
  });
  const { isOpen: isEditUserModalOpen, open: openEditUserModal, close: closeEditUserModal } = useDisclosure();
  const [isUpdatingUser, setIsUpdatingUser] = useState(false);
  const [isRemovingUserId, setIsRemovingUserId] = useState<string | null>(null);
  const [editUserForm, setEditUserForm] = useState<EditUserForm>({
    userId: '',
    name: '',
    email: '',
    role: 'seller',
    storeId: '',
  });

  const [selectedLogUser, setSelectedLogUser] = useState<UserAccessRoleRow | null>(null);
  const { isOpen: isLogModalOpen, open: openLogModal, close: closeLogModal } = useDisclosure();
  const [isLoadingLogs, setIsLoadingLogs] = useState(false);
  const [logCategory, setLogCategory] = useState<LogCategory>('all');
  const [activityLogs, setActivityLogs] = useState<ActivityLogRow[]>([]);

  const [updatingPermissionId, setUpdatingPermissionId] = useState<string | null>(null);
  const [pushPermissionState, setPushPermissionState] = useState<BrowserPushPermission>(() => getPushPermissionState());

  const [isExportingData, setIsExportingData] = useState(false);
  const [deletionStatus, setDeletionStatus] = useState<'idle' | 'requesting' | 'pending' | 'cancelled'>('idle');
  const [deletionScheduledAt, setDeletionScheduledAt] = useState<string | null>(null);

  const { financialCategories, addFinancialCategory, updateFinancialCategory, removeFinancialCategory } = useData();
  const [isAddingCategory, setIsAddingCategory] = useState(false);
  const [editingCategory, setEditingCategory] = useState<FinancialCategory | null>(null);
  const [newCategory, setNewCategory] = useState<{ name: string; type: 'IN' | 'OUT' }>({ name: '', type: 'OUT' });

  useEffect(() => {
    setFullName((user?.user_metadata?.full_name as string) || (user?.user_metadata?.name as string) || '');
    setPhone(formatPhone((user?.user_metadata?.phone as string) || ''));
    setEmail(user?.email || '');
  }, [user]);

  const tabs = useMemo(() => {
    const allTabs: Array<{ id: SettingsTab; label: string; icon: React.ComponentType<{ size?: number }> }> = [
      { id: 'menu', label: 'Menu', icon: Settings2 },
      { id: 'privacy', label: 'Privacidade', icon: Shield },
      { id: 'notifications', label: 'Notificações', icon: Bell },
      { id: 'about', label: 'Sobre', icon: Info },
    ];

    if (isAdmin) {
      allTabs.push(
        { id: 'finance', label: 'Financeiro', icon: Banknote },
        { id: 'accounts', label: 'Senhas e Contas', icon: KeyRound },
        { id: 'logs', label: 'Log de usuários', icon: Activity },
        { id: 'permissions', label: 'Permissões', icon: ShieldUser }
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

    await run(async () => {
      const data = assertNoError(await supabase
        .from('user_access_roles')
        .select('user_id, app_role, display_name, email, created_at')
        .order('created_at', { ascending: false }));
      setAccessUsers((data || []) as UserAccessRoleRow[]);
    }, { errorMsg: 'Nao foi possivel carregar usuarios.', setLoading: setIsLoadingUsers });
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

    await run(async () => {
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

      assertNoError(await supabase.auth.updateUser(payload));

      toast.success(emailChanged ? 'Dados salvos. Confirme o novo email na sua caixa de entrada.' : 'Dados pessoais atualizados.');
    }, { errorMsg: 'Nao foi possivel salvar os dados da conta.', setLoading: setIsSavingAccount });
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

    await run(async () => {
      assertNoError(await supabase.auth.updateUser({ password: newPassword }));

      setNewPassword('');
      setConfirmPassword('');
      toast.success('Senha atualizada com sucesso.');
    }, { errorMsg: 'Nao foi possivel atualizar a senha.', setLoading: setIsSavingPassword });
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

    await run(async () => {
      await adminProvisionUser({
        name,
        email: userEmail,
        password: createUserForm.password,
        role: createUserForm.role,
        storeId: createUserForm.role === 'admin' ? undefined : createUserForm.storeId || undefined,
        sellerId: createUserForm.role !== 'admin' ? createUserForm.sellerId || undefined : undefined,
      });

      await Promise.all([loadAccessUsers(), refreshData()]);

      setCreateUserForm({
        name: '',
        email: '',
        password: '',
        role: 'seller',
        storeId: '',
        sellerId: '',
      });
      closeCreateUserModal();
      toast.success('Usuario criado com sucesso.');
    }, { errorMsg: 'Nao foi possivel criar o usuario.', setLoading: setIsCreatingUser });
  };

  const resetEditUserForm = () => {
    setEditUserForm({
      userId: '',
      name: '',
      email: '',
      role: 'seller',
      storeId: '',
    });
  };

  const handleOpenEditUserModal = (entry: UserAccessRoleRow) => {
    const seller = sellers.find((item) => item.authUserId === entry.user_id);
    setEditUserForm({
      userId: entry.user_id,
      name: entry.display_name,
      email: entry.email,
      role: entry.app_role,
      storeId: seller?.storeId || '',
    });
    openEditUserModal();
  };

  const handleUpdateUser = async () => {
    const userId = editUserForm.userId.trim();
    const name = editUserForm.name.trim();
    const userEmail = editUserForm.email.trim();

    if (!userId) {
      toast.error('Usuario invalido para edicao.');
      return;
    }

    if (!name) {
      toast.error('Informe o nome do usuario.');
      return;
    }

    if (!userEmail) {
      toast.error('Informe o email de acesso.');
      return;
    }

    await run(async () => {
      await adminUpdateUser({
        userId,
        name,
        email: userEmail,
        role: editUserForm.role,
        storeId: editUserForm.role === 'admin' ? undefined : editUserForm.storeId || undefined,
      });

      await Promise.all([loadAccessUsers(), refreshData()]);
      closeEditUserModal();
      resetEditUserForm();
      toast.success('Usuario atualizado com sucesso.');
    }, { errorMsg: 'Nao foi possivel atualizar o usuario.', setLoading: setIsUpdatingUser });
  };

  const handleRemoveUser = async (entry: UserAccessRoleRow) => {
    if (entry.user_id === user?.id) {
      toast.error('Nao e permitido remover a propria conta.');
      return;
    }

    const confirmed = await toast.confirm({
      title: 'Remover Usuario',
      description: `Deseja realmente remover o usuario "${entry.display_name}"? Esta acao tambem removera o vendedor vinculado, quando existir.`,
      confirmLabel: 'Remover',
      variant: 'danger'
    });

    if (!confirmed) return;

    setIsRemovingUserId(entry.user_id);
    await run(async () => {
      const response = await adminDeleteUser({ userId: entry.user_id });
      await Promise.all([loadAccessUsers(), refreshData()]);
      toast.success(
        response.removedSellerId
          ? 'Usuario e vendedor vinculado removidos com sucesso.'
          : 'Usuario removido com sucesso.'
      );
    }, 'Nao foi possivel remover o usuario.');
    setIsRemovingUserId(null);
  };

  const openUserLogs = async (targetUser: UserAccessRoleRow) => {
    setSelectedLogUser(targetUser);
    openLogModal();
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
    await run(async () => {
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
    }, 'Nao foi possivel atualizar permissao.');
    setUpdatingPermissionId(null);
  };

  const handleRemoveCategory = async (category: FinancialCategory) => {
    if (category.isDefault) {
      toast.info('Categorias padrão não podem ser removidas.');
      return;
    }

    const confirmed = window.confirm(
      `Deseja remover a categoria "${category.name}"? Esta ação não pode ser desfeita.`
    );

    if (!confirmed) return;

    await run(async () => {
      await removeFinancialCategory(category.id);
      toast.success('Categoria removida.');
      if (editingCategory?.id === category.id) {
        setEditingCategory(null);
      }
    }, 'Não foi possível remover a categoria.');
  };

  const handleCheckForAppUpdate = async () => {
    if (!('serviceWorker' in navigator)) {
      toast.info('Não foi possível verificar atualizações.');
      return;
    }

    try {
      const reg = await navigator.serviceWorker.ready;
      if (!reg.waiting) {
        await reg.update();
      }

      if (reg.waiting) {
        reg.waiting.postMessage({ type: 'SKIP_WAITING' });
        window.location.reload();
        return;
      }

      toast.info('O app já está na versão mais recente.', { title: 'Sem atualizações' });
    } catch {
      toast.info('Não foi possível verificar atualizações.');
    }
  };

  const handleExportData = async () => {
    if (!user) return;
    setIsExportingData(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      if (!token) { toast.error('Sessão expirada. Faça login novamente.'); return; }

      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
      const res = await fetch(`${supabaseUrl}/functions/v1/user-data-export`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) { toast.error('Não foi possível exportar os dados. Tente novamente.'); return; }

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `iphonerepasse-dados-${new Date().toISOString().split('T')[0]}.json`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success('Dados exportados com sucesso.', { title: 'Exportação concluída' });
    } catch {
      toast.error('Erro ao exportar dados. Tente novamente.');
    } finally {
      setIsExportingData(false);
    }
  };

  const handleRequestAccountDeletion = async () => {
    if (!user) return;
    const confirmed = window.confirm(
      'Tem certeza que deseja excluir sua conta?\n\nSua conta será desativada imediatamente e excluída permanentemente em 30 dias. Você pode cancelar antes disso.'
    );
    if (!confirmed) return;

    setDeletionStatus('requesting');
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      if (!token) { toast.error('Sessão expirada.'); setDeletionStatus('idle'); return; }

      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
      const res = await fetch(`${supabaseUrl}/functions/v1/user-account-delete`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: 'Solicitado pelo usuário via Configurações' }),
      });
      const json = await res.json() as { ok: boolean; scheduled_delete_at?: string; message?: string };
      if (json.ok) {
        setDeletionStatus('pending');
        setDeletionScheduledAt(json.scheduled_delete_at ?? null);
        toast.info(json.message ?? 'Conta agendada para exclusão.', { title: 'Exclusão solicitada', durationMs: 8000 });
        await signOut();
      } else {
        toast.error('Não foi possível solicitar a exclusão. Tente novamente.');
        setDeletionStatus('idle');
      }
    } catch {
      toast.error('Erro ao solicitar exclusão.');
      setDeletionStatus('idle');
    }
  };

  const handleCancelAccountDeletion = async () => {
    if (!user) return;
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      if (!token) return;

      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
      const res = await fetch(`${supabaseUrl}/functions/v1/user-account-delete`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      const json = await res.json() as { ok: boolean };
      if (json.ok) {
        setDeletionStatus('idle');
        setDeletionScheduledAt(null);
        toast.success('Exclusão de conta cancelada.', { title: 'Cancelado' });
      }
    } catch {
      toast.error('Erro ao cancelar exclusão.');
    }
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

            {isAdmin && (
              <button
                type="button"
                onClick={() => setActiveTab('finance')}
                className="w-full text-left rounded-ios-lg border border-gray-200 dark:border-surface-dark-300 p-4 hover:bg-gray-50 dark:hover:bg-surface-dark-200 transition-colors"
              >
                <div className="flex items-center gap-2 text-gray-900 dark:text-white font-semibold">
                  <Banknote size={18} className="text-brand-500" />
                  Configurações Financeiras
                </div>
                <p className="text-ios-footnote text-gray-500 mt-1">Configure categorias de pagamento, aportes e outras preferências financeiras.</p>
              </button>
            )}
          </div>
        </div>
      )}

      {activeTab === 'finance' && isAdmin && (
        <div className="space-y-6">
          <div className="ios-card p-5">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h3 className="text-xl font-bold text-gray-900 dark:text-white">Categorias Financeiras</h3>
                <p className="text-sm text-gray-500 dark:text-surface-dark-500">Gerencie as categorias de entrada e saída de caixa.</p>
              </div>
              <button
                onClick={() => setIsAddingCategory(true)}
                className="ios-button-primary flex items-center gap-2"
              >
                <Plus size={18} />
                Nova Categoria
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Entradas */}
              <div className="space-y-3">
                <h4 className="text-sm font-semibold text-emerald-600 uppercase tracking-wider flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-emerald-500" />
                  Entradas (Receitas / Aportes)
                </h4>
                <div className="space-y-2">
                  {financialCategories.filter(c => c.type === 'IN').map(category => (
                    <div 
                      key={category.id}
                      className="flex items-center justify-between p-3 rounded-ios-lg border border-gray-200 dark:border-surface-dark-300 bg-gray-50/50 dark:bg-surface-dark-200/50"
                    >
                      <span className="font-medium text-gray-900 dark:text-white">{category.name}</span>
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => setEditingCategory(category)}
                          aria-label={`Editar categoria ${category.name}`}
                          title={`Editar categoria ${category.name}`}
                          className="p-1.5 text-gray-400 hover:text-brand-500 transition-colors"
                        >
                          <Edit size={16} />
                        </button>
                        {!category.isDefault && (
                          <button
                            type="button"
                            onClick={() => {
                              void handleRemoveCategory(category);
                            }}
                            aria-label={`Remover categoria ${category.name}`}
                            title={`Remover categoria ${category.name}`}
                            className="p-1.5 text-gray-400 hover:text-red-500 transition-colors"
                          >
                            <Trash2 size={16} />
                          </button>
                        )}
                        {category.isDefault && (
                          <span className="text-[10px] font-bold uppercase text-gray-400 px-1.5 py-0.5 border border-gray-200 rounded">Padrão</span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Saídas */}
              <div className="space-y-3">
                <h4 className="text-sm font-semibold text-rose-600 uppercase tracking-wider flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-rose-500" />
                  Saídas (Pagamentos / Despesas)
                </h4>
                <div className="space-y-2">
                  {financialCategories.filter(c => c.type === 'OUT').map(category => (
                    <div 
                      key={category.id}
                      className="flex items-center justify-between p-3 rounded-ios-lg border border-gray-200 dark:border-surface-dark-300 bg-gray-50/50 dark:bg-surface-dark-200/50"
                    >
                      <span className="font-medium text-gray-900 dark:text-white">{category.name}</span>
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => setEditingCategory(category)}
                          aria-label={`Editar categoria ${category.name}`}
                          title={`Editar categoria ${category.name}`}
                          className="p-1.5 text-gray-400 hover:text-brand-500 transition-colors"
                        >
                          <Edit size={16} />
                        </button>
                        {!category.isDefault && (
                          <button
                            type="button"
                            onClick={() => {
                              void handleRemoveCategory(category);
                            }}
                            aria-label={`Remover categoria ${category.name}`}
                            title={`Remover categoria ${category.name}`}
                            className="p-1.5 text-gray-400 hover:text-red-500 transition-colors"
                          >
                            <Trash2 size={16} />
                          </button>
                        )}
                        {category.isDefault && (
                          <span className="text-[10px] font-bold uppercase text-gray-400 px-1.5 py-0.5 border border-gray-200 rounded">Padrão</span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Modal for adding/editing category */}
          <Modal
            open={isAddingCategory || !!editingCategory}
            onClose={() => {
              setIsAddingCategory(false);
              setEditingCategory(null);
              setNewCategory({ name: '', type: 'OUT' });
            }}
            title={editingCategory ? "Editar Categoria Financeira" : "Nova Categoria Financeira"}
          >
            <div className="space-y-4">
              <div>
                <label className="ios-label">Nome da Categoria</label>
                <input
                  type="text"
                  className="ios-input"
                  placeholder="Ex: Aluguel, Bonus, etc."
                  value={editingCategory ? editingCategory.name : newCategory.name}
                  onChange={e => {
                    const val = e.target.value;
                    if (editingCategory) {
                      setEditingCategory({ ...editingCategory, name: val });
                    } else {
                      setNewCategory(prev => ({ ...prev, name: val }));
                    }
                  }}
                />
              </div>
              <div>
                <label className="ios-label">Tipo</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => {
                      if (editingCategory) setEditingCategory({ ...editingCategory, type: 'IN' });
                      else setNewCategory(prev => ({ ...prev, type: 'IN' }));
                    }}
                    className={`px-4 py-2 rounded-ios-lg border text-sm font-medium transition-all ${
                      (editingCategory ? editingCategory.type : newCategory.type) === 'IN'
                        ? 'bg-emerald-500 text-white border-emerald-500'
                        : 'bg-white dark:bg-surface-dark-200 text-gray-700 dark:text-surface-dark-700 border-gray-200 dark:border-surface-dark-300'
                    }`}
                  >
                    Entrada (+)
                  </button>
                  <button
                    onClick={() => {
                      if (editingCategory) setEditingCategory({ ...editingCategory, type: 'OUT' });
                      else setNewCategory(prev => ({ ...prev, type: 'OUT' }));
                    }}
                    className={`px-4 py-2 rounded-ios-lg border text-sm font-medium transition-all ${
                      (editingCategory ? editingCategory.type : newCategory.type) === 'OUT'
                        ? 'bg-rose-500 text-white border-rose-500'
                        : 'bg-white dark:bg-surface-dark-200 text-gray-700 dark:text-surface-dark-700 border-gray-200 dark:border-surface-dark-300'
                    }`}
                  >
                    Saída (-)
                  </button>
                </div>
              </div>
              <div className="pt-4 flex justify-end gap-3">
                <button
                  onClick={() => {
                    setIsAddingCategory(false);
                    setEditingCategory(null);
                    setNewCategory({ name: '', type: 'OUT' });
                  }}
                  className="px-4 py-2 text-sm font-medium text-gray-600 dark:text-surface-dark-600"
                >
                  Cancelar
                </button>
                <button
                  onClick={async () => {
                    const name = (editingCategory ? editingCategory.name : newCategory.name).trim();
                    if(!name) {
                      toast.error('Informe um nome para a categoria.');
                      return;
                    }
                    try {
                      if (editingCategory) {
                        await updateFinancialCategory(editingCategory.id, { name, type: editingCategory.type });
                        setEditingCategory(null);
                        toast.success('Categoria atualizada.');
                      } else {
                        await addFinancialCategory({ ...newCategory, name, isDefault: false });
                        setNewCategory({ name: '', type: 'OUT' });
                        setIsAddingCategory(false);
                        toast.success('Categoria adicionada.');
                      }
                    } catch (e: any) {
                      toast.error(e.message || 'Erro ao processar categoria.');
                    }
                  }}
                  className="ios-button-primary"
                >
                  {editingCategory ? 'Salvar Alterações' : 'Adicionar'}
                </button>
              </div>
            </div>
          </Modal>
        </div>
      )}

      {activeTab === 'privacy' && (
        <div className="space-y-4">
          {/* Permissões de dispositivo */}
          <div className="ios-card p-5 space-y-4">
            <div>
              <h3 className="text-ios-title-3 font-bold text-gray-900 dark:text-white">Permissões do dispositivo</h3>
              <p className="text-ios-footnote text-gray-500 mt-1">Status das permissões concedidas a este dispositivo.</p>
            </div>
            <div className="space-y-3">
              {/* Camera */}
              <div className="flex items-center justify-between p-3 rounded-ios-lg bg-gray-50 dark:bg-surface-dark-200">
                <div className="flex items-center gap-3">
                  <Smartphone size={18} className="text-brand-500" />
                  <div>
                    <p className="text-sm font-medium text-gray-900 dark:text-white">Câmera</p>
                    <p className="text-xs text-gray-500">Fotografar aparelhos no estoque</p>
                  </div>
                </div>
                <span className="text-xs font-medium text-gray-500">Via sistema</span>
              </div>
              {/* Push */}
              <div className="flex items-center justify-between p-3 rounded-ios-lg bg-gray-50 dark:bg-surface-dark-200">
                <div className="flex items-center gap-3">
                  <Bell size={18} className="text-brand-500" />
                  <div>
                    <p className="text-sm font-medium text-gray-900 dark:text-white">Notificações Push</p>
                    <p className="text-xs text-gray-500">Alertas de vendas, leads e CRM</p>
                  </div>
                </div>
                <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                  pushPermissionState === 'granted'
                    ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400'
                    : pushPermissionState === 'denied'
                      ? 'bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400'
                      : 'bg-gray-100 text-gray-600 dark:bg-surface-dark-300 dark:text-surface-dark-600'
                }`}>
                  {pushPermissionStatusLabel}
                </span>
              </div>
            </div>
          </div>

          {/* Seus dados (LGPD) */}
          <div className="ios-card p-5 space-y-4">
            <div>
              <h3 className="text-ios-title-3 font-bold text-gray-900 dark:text-white">Seus dados</h3>
              <p className="text-ios-footnote text-gray-500 mt-1">Exercite seus direitos previstos na LGPD (art. 18).</p>
            </div>
            <div className="space-y-3">
              <button
                type="button"
                onClick={() => void handleExportData()}
                disabled={isExportingData}
                className="w-full flex items-center gap-3 px-4 py-3 rounded-ios-lg border border-gray-200 dark:border-surface-dark-300 hover:bg-gray-50 dark:hover:bg-surface-dark-200 transition-colors disabled:opacity-60 disabled:cursor-not-allowed text-left"
              >
                <Download size={18} className="text-brand-500 shrink-0" />
                <div>
                  <p className="text-sm font-semibold text-gray-900 dark:text-white">
                    {isExportingData ? 'Exportando...' : 'Exportar meus dados'}
                  </p>
                  <p className="text-xs text-gray-500">Baixa um arquivo JSON com todos os seus dados</p>
                </div>
              </button>

              {deletionStatus === 'pending' ? (
                <div className="p-4 rounded-ios-lg border border-rose-200 dark:border-rose-800 bg-rose-50 dark:bg-rose-900/20 space-y-2">
                  <p className="text-sm font-semibold text-rose-700 dark:text-rose-400">Exclusão de conta agendada</p>
                  {deletionScheduledAt && (
                    <p className="text-xs text-rose-600 dark:text-rose-500">
                      Será excluída em: {new Date(deletionScheduledAt).toLocaleDateString('pt-BR')}
                    </p>
                  )}
                  <button
                    type="button"
                    onClick={() => void handleCancelAccountDeletion()}
                    className="text-xs font-semibold text-rose-600 dark:text-rose-400 underline"
                  >
                    Cancelar exclusão
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => void handleRequestAccountDeletion()}
                  disabled={deletionStatus === 'requesting'}
                  className="w-full flex items-center gap-3 px-4 py-3 rounded-ios-lg border border-rose-200 dark:border-rose-800 hover:bg-rose-50 dark:hover:bg-rose-900/20 transition-colors disabled:opacity-60 disabled:cursor-not-allowed text-left"
                >
                  <Trash2 size={18} className="text-rose-500 shrink-0" />
                  <div>
                    <p className="text-sm font-semibold text-rose-600 dark:text-rose-400">
                      {deletionStatus === 'requesting' ? 'Solicitando...' : 'Excluir minha conta'}
                    </p>
                    <p className="text-xs text-gray-500">Exclusão com janela de 30 dias para cancelar</p>
                  </div>
                </button>
              )}
            </div>
          </div>

          {/* Links legais */}
          <div className="ios-card p-5 space-y-3">
            <h3 className="text-ios-title-3 font-bold text-gray-900 dark:text-white">Documentos legais</h3>
            <a
              href="/#/legal/privacidade"
              className="flex items-center justify-between p-3 rounded-ios-lg bg-gray-50 dark:bg-surface-dark-200 hover:bg-gray-100 dark:hover:bg-surface-dark-300 transition-colors"
            >
              <div className="flex items-center gap-3">
                <Shield size={16} className="text-brand-500" />
                <span className="text-sm font-medium text-gray-900 dark:text-white">Política de Privacidade</span>
              </div>
              <ExternalLink size={14} className="text-gray-400" />
            </a>
            <a
              href="/#/legal/termos"
              className="flex items-center justify-between p-3 rounded-ios-lg bg-gray-50 dark:bg-surface-dark-200 hover:bg-gray-100 dark:hover:bg-surface-dark-300 transition-colors"
            >
              <div className="flex items-center gap-3">
                <Info size={16} className="text-brand-500" />
                <span className="text-sm font-medium text-gray-900 dark:text-white">Termos de Uso</span>
              </div>
              <ExternalLink size={14} className="text-gray-400" />
            </a>
            <a
              href="/#/legal/dados"
              className="flex items-center justify-between p-3 rounded-ios-lg bg-gray-50 dark:bg-surface-dark-200 hover:bg-gray-100 dark:hover:bg-surface-dark-300 transition-colors"
            >
              <div className="flex items-center gap-3">
                <Download size={16} className="text-brand-500" />
                <span className="text-sm font-medium text-gray-900 dark:text-white">O que coletamos e por quê</span>
              </div>
              <ExternalLink size={14} className="text-gray-400" />
            </a>
            <p className="text-xs text-gray-400 pt-1">
              Versão da política: {PRIVACY_POLICY_VERSION} · Dúvidas: {DPO_CONTACT_EMAIL}
            </p>
          </div>
        </div>
      )}

      {activeTab === 'notifications' && (
        <div className="space-y-4">
          <div className="ios-card p-5 space-y-4">
            <div>
              <h3 className="text-ios-title-3 font-bold text-gray-900 dark:text-white">Notificações Push</h3>
              <p className="text-ios-footnote text-gray-500 mt-1">
                Receba alertas mesmo com o app em segundo plano. Disponível apenas quando instalado na Tela de Início.
              </p>
            </div>
            <PushOptIn variant="card" />
            <div className="rounded-ios-lg border border-gray-200 dark:border-surface-dark-300 bg-gray-50/70 dark:bg-surface-dark-200 p-4">
              <p className="text-xs font-semibold text-gray-700 dark:text-surface-dark-700 mb-2">Tipos de notificação disponíveis:</p>
              <ul className="space-y-1 text-xs text-gray-600 dark:text-surface-dark-600">
                <li>• <strong>Nova mensagem CRM</strong> — quando um lead enviar mensagem</li>
                <li>• <strong>Novo lead</strong> — quando um contato novo entrar no funil</li>
                <li>• <strong>Nova venda registrada</strong> — confirmação de venda no PDV</li>
              </ul>
            </div>
            {isIOSDevice() && !isStandaloneDisplayMode() && (
              <div className="flex items-start gap-3 p-3 rounded-ios-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800">
                <Smartphone size={16} className="text-amber-600 shrink-0 mt-0.5" />
                <p className="text-xs text-amber-700 dark:text-amber-400">
                  No iPhone, as notificações push só funcionam quando o app está instalado na Tela de Início via Safari → Compartilhar → Adicionar à Tela de Início.
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {activeTab === 'about' && (
        <div className="space-y-4">
          <div className="ios-card p-5 space-y-4">
            <div className="text-center py-2">
              <p className="text-2xl font-bold text-gray-900 dark:text-white">iPhoneRepasse Pro</p>
              <p className="text-sm text-gray-500 mt-1">Gestão completa para lojas de iPhones</p>
              <p className="text-xs text-gray-400 mt-2">Versão {PRIVACY_POLICY_VERSION} · Build {new Date().getFullYear()}</p>
            </div>

            <div className="space-y-2">
              <button
                type="button"
                onClick={() => { void handleCheckForAppUpdate(); }}
                className="w-full flex items-center gap-3 px-4 py-3 rounded-ios-lg border border-gray-200 dark:border-surface-dark-300 hover:bg-gray-50 dark:hover:bg-surface-dark-200 transition-colors text-left"
              >
                <RefreshCw size={18} className="text-brand-500 shrink-0" />
                <div>
                  <p className="text-sm font-semibold text-gray-900 dark:text-white">Verificar atualizações</p>
                  <p className="text-xs text-gray-500">Aplica a versão mais recente do app</p>
                </div>
              </button>

              <a
                href="/#/legal/privacidade"
                className="flex items-center justify-between px-4 py-3 rounded-ios-lg border border-gray-200 dark:border-surface-dark-300 hover:bg-gray-50 dark:hover:bg-surface-dark-200 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <Shield size={18} className="text-brand-500" />
                  <span className="text-sm font-medium text-gray-900 dark:text-white">Política de Privacidade</span>
                </div>
                <ExternalLink size={14} className="text-gray-400" />
              </a>

              <a
                href="/#/legal/termos"
                className="flex items-center justify-between px-4 py-3 rounded-ios-lg border border-gray-200 dark:border-surface-dark-300 hover:bg-gray-50 dark:hover:bg-surface-dark-200 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <Info size={18} className="text-brand-500" />
                  <span className="text-sm font-medium text-gray-900 dark:text-white">Termos de Uso</span>
                </div>
                <ExternalLink size={14} className="text-gray-400" />
              </a>
            </div>

            <div className="pt-2 border-t border-gray-100 dark:border-surface-dark-300">
              <p className="text-xs text-center text-gray-400">
                Suporte: {DPO_CONTACT_EMAIL}
              </p>
            </div>
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
              <button type="button" className="ios-button-primary inline-flex items-center gap-2" onClick={() => openCreateUserModal()}>
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
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="text-xs px-2.5 py-1 rounded-full bg-brand-50 text-brand-700 border border-brand-200">
                        {ROLE_LABELS[entry.app_role]}
                      </span>
                      <button
                        type="button"
                        className="ios-button-secondary inline-flex items-center gap-1 px-3 py-1.5 text-xs"
                        onClick={() => handleOpenEditUserModal(entry)}
                      >
                        <Edit size={14} />
                        Editar
                      </button>
                      <button
                        type="button"
                        className="ios-button-secondary inline-flex items-center gap-1 px-3 py-1.5 text-xs text-red-600 border-red-200 disabled:opacity-60 disabled:cursor-not-allowed"
                        disabled={isRemovingUserId === entry.user_id || entry.user_id === user?.id}
                        onClick={() => void handleRemoveUser(entry)}
                        title={entry.user_id === user?.id ? 'Nao e permitido remover a propria conta.' : undefined}
                      >
                        <Trash2 size={14} />
                        {isRemovingUserId === entry.user_id ? 'Removendo...' : 'Remover'}
                      </button>
                    </div>
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
            <h3 className="text-ios-title-3 font-bold text-gray-900 dark:text-white">Permissões por função</h3>
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

                  <div className="table-scroll-x">
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
                                const isAdminRowLocked = targetRole === 'admin';

                                return (
                                  <td key={toggleId} className="px-4 py-3">
                                    <label className="inline-flex items-center gap-2">
                                      <input
                                        type="checkbox"
                                        checked={checked}
                                        disabled={isUpdating || disableByRule || isAdminRowLocked}
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
        open={isEditUserModalOpen}
        onClose={() => {
          if (!isUpdatingUser) {
            closeEditUserModal();
            resetEditUserForm();
          }
        }}
        title="Editar usuario"
        size="md"
        centered={false}
        onSubmit={() => void handleUpdateUser()}
        footer={(
          <div className="flex justify-end gap-2">
            <button
              type="button"
              className="ios-button-secondary"
              onClick={() => {
                closeEditUserModal();
                resetEditUserForm();
              }}
              disabled={isUpdatingUser}
            >
              Cancelar
            </button>
            <button type="submit" className="ios-button-primary" disabled={isUpdatingUser}>
              {isUpdatingUser ? 'Salvando...' : 'Salvar alteracoes'}
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
              value={editUserForm.name}
              onChange={(e) => setEditUserForm((prev) => ({ ...prev, name: e.target.value }))}
              placeholder="Nome completo"
            />
          </div>
          <div>
            <label className="ios-label">Email</label>
            <input
              type="email"
              className="ios-input"
              value={editUserForm.email}
              onChange={(e) => setEditUserForm((prev) => ({ ...prev, email: e.target.value }))}
              placeholder="usuario@empresa.com"
            />
          </div>
          <div>
            <label className="ios-label">Funcao</label>
            <select
              className="ios-input"
              value={editUserForm.role}
              onChange={(e) => setEditUserForm((prev) => ({ ...prev, role: e.target.value as AppRole }))}
            >
              {roleOptions.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
          </div>

          {editUserForm.role !== 'admin' && (
            <div className="pt-2 border-t border-gray-100 dark:border-surface-dark-300">
              <label className="ios-label">Loja vinculada</label>
              <select
                className="ios-input"
                value={editUserForm.storeId}
                onChange={(e) => setEditUserForm((prev) => ({ ...prev, storeId: e.target.value }))}
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
        </div>
      </Modal>

      <Modal
        open={isCreateUserModalOpen}
        onClose={() => {
          if (!isCreatingUser) closeCreateUserModal();
        }}
        title="Criar usuario"
        size="md"
        centered={false}
        onSubmit={() => void handleCreateUser()}
        footer={(
          <div className="flex justify-end gap-2">
            <button type="button" className="ios-button-secondary" onClick={() => closeCreateUserModal()} disabled={isCreatingUser}>
              Cancelar
            </button>
            <button type="submit" className="ios-button-primary" disabled={isCreatingUser}>
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
            <div className="space-y-4 pt-2 border-t border-gray-100 dark:border-surface-dark-300">
              <div>
                <label className="ios-label">Vincular a vendedor existente (opcional)</label>
                <select
                  className="ios-input font-medium text-brand-600"
                  value={createUserForm.sellerId}
                  onChange={(e) => {
                    const selId = e.target.value;
                    setCreateUserForm((prev) => ({ ...prev, sellerId: selId }));
                    
                    // If a seller is selected, auto-fill name if empty
                    if (selId) {
                      const sel = sellers.find(s => s.id === selId);
                      if (sel && !createUserForm.name) {
                        setCreateUserForm(prev => ({ ...prev, name: sel.name }));
                      }
                      if (sel && sel.storeId && !createUserForm.storeId) {
                        setCreateUserForm(prev => ({ ...prev, storeId: sel.storeId }));
                      }
                    }
                  }}
                >
                  <option value="">-- Criar novo registro de vendedor --</option>
                  {sellers
                    .filter(s => !s.authUserId)
                    .map((seller) => (
                      <option key={seller.id} value={seller.id}>
                        {seller.name}
                      </option>
                    ))}
                </select>
                <p className="text-[10px] text-gray-400 mt-1">
                  Selecione um vendedor se ele ja estiver cadastrado no modulo de Vendedores mas ainda nao tiver acesso.
                </p>
              </div>

              <div>
                <label className="ios-label">Loja vinculada</label>
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
            closeLogModal();
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
