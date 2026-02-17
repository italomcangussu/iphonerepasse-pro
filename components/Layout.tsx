import React, { useEffect, useMemo, useState } from 'react';
import {
  Briefcase,
  Clock3,
  DollarSign,
  Ellipsis,
  LayoutDashboard,
  LogOut,
  MapPin,
  Moon,
  Package,
  Settings as SettingsIcon,
  ShieldCheck,
  ShoppingCart,
  Smartphone,
  Sun,
  Users
} from 'lucide-react';
import { Link, useLocation } from 'react-router-dom';
import { useData } from '../services/dataContext';
import { useTheme } from '../contexts/ThemeContext';
import { useAuth } from '../contexts/AuthContext';
import BrandLogo from './BrandLogo';

interface LayoutProps {
  children: React.ReactNode;
}

type NavGroupKey = 'operation' | 'relationship' | 'management';
type NavItem = {
  label: string;
  icon: React.ComponentType<{ size?: number; className?: string; strokeWidth?: number }>;
  path: string;
  group: NavGroupKey;
  adminOnly?: boolean;
};

const NAV_GROUP_LABEL: Record<NavGroupKey, string> = {
  operation: 'Operação',
  relationship: 'Relacionamento',
  management: 'Gestão'
};

const LAST_VISITED_STORAGE_KEY = 'app:last-visited-path';

const ALL_NAV_ITEMS: NavItem[] = [
  { label: 'Dashboard', icon: LayoutDashboard, path: '/', group: 'operation' },
  { label: 'PDV', icon: ShoppingCart, path: '/pdv', group: 'operation' },
  { label: 'Estoque', icon: Smartphone, path: '/inventory', group: 'operation' },
  { label: 'Clientes', icon: Users, path: '/clients', group: 'relationship' },
  { label: 'Garantias', icon: ShieldCheck, path: '/warranties', group: 'relationship' },
  { label: 'Devedores', icon: DollarSign, path: '/debtors', group: 'relationship', adminOnly: true },
  { label: 'Financeiro', icon: DollarSign, path: '/finance', group: 'management', adminOnly: true },
  { label: 'Estoque de Peças', icon: Package, path: '/parts-stock', group: 'management' },
  { label: 'Vendedores', icon: Briefcase, path: '/sellers', group: 'management', adminOnly: true },
  { label: 'Lojas', icon: MapPin, path: '/stores', group: 'management', adminOnly: true },
  { label: 'Configurações', icon: SettingsIcon, path: '/settings', group: 'management' }
];

const Layout: React.FC<LayoutProps> = ({ children }) => {
  const { businessProfile } = useData();
  const { resolvedTheme, toggleTheme } = useTheme();
  const { role, user, signOut } = useAuth();
  const location = useLocation();
  const [isMoreMenuOpen, setIsMoreMenuOpen] = useState(false);
  const [lastVisitedPath, setLastVisitedPath] = useState<string | null>(null);

  const isAdmin = role === 'admin';
  const navItems = useMemo(
    () => ALL_NAV_ITEMS.filter((item) => !item.adminOnly || isAdmin),
    [isAdmin]
  );

  const navByPath = useMemo(() => {
    const map = new Map<string, NavItem>();
    navItems.forEach((item) => map.set(item.path, item));
    return map;
  }, [navItems]);

  const groupedNavItems = useMemo(
    () =>
      (Object.keys(NAV_GROUP_LABEL) as NavGroupKey[]).map((group) => ({
        group,
        label: NAV_GROUP_LABEL[group],
        items: navItems.filter((item) => item.group === group)
      })),
    [navItems]
  );

  const operationItems = navItems.filter((item) => item.group === 'operation');
  const moreMenuGroups = groupedNavItems.filter((group) => group.group !== 'operation');
  const quickActions = [
    { label: 'Nova venda', path: '/pdv' },
    { label: 'Novo aparelho', path: '/inventory' },
    { label: 'Novo cliente', path: '/clients' }
  ];

  const isActive = (path: string) => location.pathname === path;
  const isMoreActive = moreMenuGroups.some((group) => group.items.some((item) => isActive(item.path)));
  const lastVisitedItem = lastVisitedPath ? navByPath.get(lastVisitedPath) : undefined;

  useEffect(() => {
    setIsMoreMenuOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const previousPath = window.localStorage.getItem(LAST_VISITED_STORAGE_KEY);
    if (previousPath && previousPath !== location.pathname) {
      setLastVisitedPath(previousPath);
    }
    window.localStorage.setItem(LAST_VISITED_STORAGE_KEY, location.pathname);
  }, [location.pathname]);

  return (
    <div className="flex h-screen bg-surface-light-100 dark:bg-surface-dark-50 overflow-hidden">
      <aside className="hidden md:flex flex-col w-72 bg-white dark:bg-surface-dark-100 border-r border-gray-200 dark:border-surface-dark-200 shadow-ios">
        <div className="p-6 flex flex-col items-center border-b border-gray-200 dark:border-surface-dark-200">
          <div className="flex flex-col items-center group transition-transform">
            {businessProfile.logoUrl ? (
              <img
                src={businessProfile.logoUrl}
                alt="Logo"
                className="w-20 h-20 object-contain rounded-ios-xl mb-4 shadow-ios-md border border-gray-200 dark:border-surface-dark-300"
              />
            ) : (
              <div className="w-20 h-20 rounded-ios-xl bg-gray-50 dark:bg-surface-dark-200 flex items-center justify-center mb-4 shadow-ios-md border border-gray-200 dark:border-surface-dark-300">
                <BrandLogo variant="mark" className="w-14 h-14 object-contain" />
              </div>
            )}
            <h1 className="text-xl font-bold tracking-tight text-center leading-tight">
              <span className="text-gray-900 dark:text-white">iPhone</span>
              <span className="text-brand-500">Repasse</span>
            </h1>
          </div>
        </div>

        <nav className="flex-1 p-4 space-y-5 overflow-y-auto">
          {groupedNavItems.map((group) => (
            <div key={group.group}>
              <p className="ios-section-header px-2">{group.label}</p>
              <div className="space-y-1 mt-1">
                {group.items.map((item) => (
                  <Link
                    key={item.path}
                    to={item.path}
                    className={`flex items-center gap-3 px-4 py-3 rounded-ios-lg transition-all duration-200 ${
                      isActive(item.path)
                        ? 'bg-brand-500 text-white shadow-ios-md'
                        : 'text-gray-600 dark:text-surface-dark-600 hover:bg-gray-100 dark:hover:bg-surface-dark-200 hover:text-gray-900 dark:hover:text-white'
                    }`}
                  >
                    <item.icon size={20} />
                    <span className="font-medium">{item.label}</span>
                  </Link>
                ))}
              </div>
            </div>
          ))}
        </nav>

        <div className="p-4 border-t border-gray-200 dark:border-surface-dark-200 space-y-3">
          {lastVisitedItem && !isActive(lastVisitedItem.path) && (
            <Link
              to={lastVisitedItem.path}
              className="w-full flex items-center gap-3 px-4 py-3 rounded-ios-lg border border-gray-200 dark:border-surface-dark-300 hover:bg-gray-50 dark:hover:bg-surface-dark-200 transition-colors"
            >
              <Clock3 size={18} className="text-brand-500" />
              <div className="min-w-0">
                <p className="text-xs uppercase tracking-wide text-gray-500 dark:text-surface-dark-500">Última visita</p>
                <p className="text-sm font-semibold text-gray-900 dark:text-white truncate">{lastVisitedItem.label}</p>
              </div>
            </Link>
          )}

          <button
            onClick={toggleTheme}
            className="w-full flex items-center gap-3 px-4 py-3 rounded-ios-lg bg-gray-100 dark:bg-surface-dark-200 text-gray-700 dark:text-surface-dark-700 hover:bg-gray-200 dark:hover:bg-surface-dark-300 transition-colors"
          >
            {resolvedTheme === 'dark' ? (
              <>
                <Sun size={20} className="text-accent-500" />
                <span className="font-medium">Modo Claro</span>
              </>
            ) : (
              <>
                <Moon size={20} className="text-brand-500" />
                <span className="font-medium">Modo Escuro</span>
              </>
            )}
          </button>

          <button
            onClick={() => void signOut()}
            className="w-full flex items-center gap-3 px-4 py-3 rounded-ios-lg bg-red-50 dark:bg-red-900/20 text-red-600 hover:bg-red-100 dark:hover:bg-red-900/30 transition-colors"
          >
            <LogOut size={20} />
            <span className="font-medium">Sair</span>
          </button>

          <div className="bg-gray-100 dark:bg-surface-dark-200 rounded-ios-lg p-3 text-sm text-gray-600 dark:text-surface-dark-600">
            <p>
              Logado como:{' '}
              <span className="text-gray-900 dark:text-white font-semibold">{isAdmin ? 'Admin' : 'Vendedor'}</span>
            </p>
            <p className="text-xs mt-1 text-gray-500 dark:text-surface-dark-500 truncate">{user?.email}</p>
            <p className="text-xs mt-1 text-gray-500 dark:text-surface-dark-500">v2.1 Pro</p>
          </div>
        </div>
      </aside>

      <div className="flex-1 flex flex-col h-full overflow-hidden relative">
        <header className="md:hidden h-[52px] glass border-b border-gray-200/60 dark:border-surface-dark-200/60 flex items-center justify-between px-4 z-20 safe-area-top">
          <div className="flex items-center gap-2.5">
            {businessProfile.logoUrl ? (
              <img src={businessProfile.logoUrl} className="w-8 h-8 rounded-ios object-cover" alt="Logo" />
            ) : (
              <div className="w-8 h-8 rounded-ios bg-gray-50 dark:bg-surface-dark-200 border border-gray-200 dark:border-surface-dark-300 flex items-center justify-center">
                <BrandLogo variant="mark" className="w-5 h-5 object-contain" />
              </div>
            )}
            <h1 className="text-[17px] font-semibold text-gray-900 dark:text-white tracking-tight">
              iPhone<span className="text-brand-500">Repasse</span>
            </h1>
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={toggleTheme}
              className="w-11 h-11 flex items-center justify-center text-gray-500 dark:text-surface-dark-500 active:bg-gray-100 dark:active:bg-surface-dark-200 rounded-full transition-colors"
              aria-label={resolvedTheme === 'dark' ? 'Ativar modo claro' : 'Ativar modo escuro'}
            >
              {resolvedTheme === 'dark' ? <Sun size={22} /> : <Moon size={22} />}
            </button>
            <Link
              to="/settings"
              className="w-11 h-11 flex items-center justify-center text-gray-500 dark:text-surface-dark-500 active:bg-gray-100 dark:active:bg-surface-dark-200 rounded-full transition-colors"
              aria-label="Configurações"
            >
              <SettingsIcon size={20} />
            </Link>
          </div>
        </header>

        <header className="hidden md:flex h-14 glass border-b border-gray-200/60 dark:border-surface-dark-200/60 items-center justify-end px-6 z-10">
          <Link
            to="/settings"
            className="w-11 h-11 flex items-center justify-center text-gray-500 dark:text-surface-dark-500 hover:bg-gray-100 dark:hover:bg-surface-dark-200 rounded-full transition-colors"
            aria-label="Configurações"
          >
            <SettingsIcon size={20} />
          </Link>
        </header>

        {isMoreMenuOpen && (
          <>
            <button
              type="button"
              className="md:hidden fixed inset-0 z-40 bg-black/40 backdrop-blur-sm animate-ios-fade"
              onClick={() => setIsMoreMenuOpen(false)}
              aria-label="Fechar menu"
            />
            <div className="md:hidden fixed bottom-[calc(env(safe-area-inset-bottom,0px)+84px)] left-4 right-4 z-50 animate-ios-slide-up">
              <div className="bg-white dark:bg-surface-dark-100 rounded-ios-2xl shadow-ios-xl border border-gray-200 dark:border-surface-dark-200 overflow-hidden max-h-[70vh]">
                <div className="p-3 border-b border-gray-200 dark:border-surface-dark-300 sticky top-0 bg-white dark:bg-surface-dark-100 z-10">
                  <p className="text-xs uppercase tracking-wide text-gray-500 dark:text-surface-dark-500 mb-2">Ações rápidas</p>
                  <div className="grid grid-cols-3 gap-2">
                    {quickActions.map((action) => (
                      <Link
                        key={action.path}
                        to={action.path}
                        onClick={() => setIsMoreMenuOpen(false)}
                        className="text-center px-2 py-2 rounded-ios-lg bg-gray-100 dark:bg-surface-dark-200 text-xs font-semibold text-gray-700 dark:text-surface-dark-700"
                      >
                        {action.label}
                      </Link>
                    ))}
                  </div>
                </div>

                <div className="max-h-[56vh] overflow-y-auto p-2">
                  {moreMenuGroups.map((group) => (
                    <div key={group.group} className="mb-3">
                      <p className="ios-section-header px-2">{group.label}</p>
                      <div className="space-y-1">
                        {group.items.map((item) => (
                          <Link
                            key={item.path}
                            to={item.path}
                            onClick={() => setIsMoreMenuOpen(false)}
                            className={`flex items-center gap-3 px-4 py-3.5 rounded-ios-lg transition-colors active:scale-[0.98] ${
                              isActive(item.path)
                                ? 'bg-brand-50 dark:bg-brand-900/20 text-brand-500'
                                : 'text-gray-700 dark:text-surface-dark-700 active:bg-gray-100 dark:active:bg-surface-dark-200'
                            }`}
                          >
                            <item.icon
                              size={22}
                              className={isActive(item.path) ? 'text-brand-500' : 'text-gray-400 dark:text-surface-dark-400'}
                            />
                            <span className="text-[17px] font-medium">{item.label}</span>
                          </Link>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </>
        )}

        <main className="flex-1 overflow-y-auto bg-surface-light-100 dark:bg-surface-dark-50 relative">
          <div className="p-4 md:p-8 pb-28 md:pb-8 animate-ios-fade">{children}</div>
        </main>

        <nav className="md:hidden fixed bottom-0 left-0 right-0 z-30 glass border-t border-gray-200/60 dark:border-surface-dark-200/60 safe-area-bottom">
          <div className="flex items-center justify-around h-[50px]">
            {operationItems.map((item) => (
              <Link
                key={item.path}
                to={item.path}
                className={`flex flex-col items-center justify-center w-full h-full pt-1.5 pb-0.5 transition-colors active:scale-95 ${
                  isActive(item.path) ? 'text-brand-500' : 'text-gray-400 dark:text-surface-dark-400'
                }`}
                aria-label={item.label}
              >
                <item.icon size={24} strokeWidth={isActive(item.path) ? 2.2 : 1.8} />
                <span className={`text-[10px] mt-0.5 leading-tight ${isActive(item.path) ? 'font-semibold' : 'font-medium'}`}>
                  {item.label}
                </span>
              </Link>
            ))}
            <button
              type="button"
              onClick={() => setIsMoreMenuOpen((prev) => !prev)}
              className={`flex flex-col items-center justify-center w-full h-full pt-1.5 pb-0.5 transition-colors active:scale-95 ${
                isMoreActive || isMoreMenuOpen ? 'text-brand-500' : 'text-gray-400 dark:text-surface-dark-400'
              }`}
              aria-label="Mais opções"
            >
              <Ellipsis size={24} strokeWidth={isMoreActive || isMoreMenuOpen ? 2.2 : 1.8} />
              <span className={`text-[10px] mt-0.5 leading-tight ${isMoreActive || isMoreMenuOpen ? 'font-semibold' : 'font-medium'}`}>
                Mais
              </span>
            </button>
          </div>
        </nav>
      </div>
    </div>
  );
};

export default Layout;
