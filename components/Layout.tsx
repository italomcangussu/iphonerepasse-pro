import React, { useEffect, useMemo, useState } from 'react';
import {
  Briefcase,
  DollarSign,
  Ellipsis,
  LayoutDashboard,
  MapPin,
  MessageCircle,
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
import { AnimatePresence, LayoutGroup, m } from 'framer-motion';
import { useData } from '../services/dataContext';
import { useTheme } from '../contexts/ThemeContext';
import { useAuth } from '../contexts/AuthContext';
import { usePermissions } from '../contexts/PermissionsContext';
import { ROLE_LABELS } from '../lib/permissions';
import { createCrmHandoff, openCRMStandaloneFallback } from '../services/crmHandoff';
import { trackUxEvent } from '../services/telemetry';
import BrandLogo from './BrandLogo';
import { PageTransition } from './motion';
import { iosSnappySpring } from './motion/transitions';

interface LayoutProps {
  children: React.ReactNode;
}

type NavGroupKey = 'operation' | 'relationship' | 'management';
type NavItem = {
  label: string;
  icon: React.ComponentType<{ size?: number; className?: string; strokeWidth?: number }>;
  path: string;
  group: NavGroupKey;
  permissionKey:
    | 'dashboard'
    | 'pdv'
    | 'inventory'
    | 'clients'
    | 'warranties'
    | 'debtors'
    | 'finance'
    | 'parts_stock'
    | 'sellers'
    | 'stores'
    | 'settings';
  adminOnly?: boolean;
};

const NAV_GROUP_LABEL: Record<NavGroupKey, string> = {
  operation: 'Operação',
  relationship: 'Relacionamento',
  management: 'Gestão'
};

const LAST_VISITED_STORAGE_KEY = 'app:last-visited-path';
export const PREVIOUS_VISITED_ITEM_KEY = 'app:previous-visited-item';

const ALL_NAV_ITEMS: NavItem[] = [
  { label: 'Dashboard', icon: LayoutDashboard, path: '/', group: 'operation', permissionKey: 'dashboard' },
  { label: 'PDV', icon: ShoppingCart, path: '/pdv', group: 'operation', permissionKey: 'pdv' },
  { label: 'Estoque', icon: Smartphone, path: '/inventory', group: 'operation', permissionKey: 'inventory' },
  { label: 'Clientes', icon: Users, path: '/clients', group: 'relationship', permissionKey: 'clients' },
  { label: 'Garantias', icon: ShieldCheck, path: '/warranties', group: 'relationship', permissionKey: 'warranties' },
  { label: 'Devedores', icon: DollarSign, path: '/debtors', group: 'relationship', permissionKey: 'debtors', adminOnly: true },
  { label: 'Financeiro', icon: DollarSign, path: '/finance', group: 'management', permissionKey: 'finance', adminOnly: true },
  { label: 'Estoque de Peças', icon: Package, path: '/parts-stock', group: 'management', permissionKey: 'parts_stock' },
  { label: 'Vendedores', icon: Briefcase, path: '/sellers', group: 'management', permissionKey: 'sellers', adminOnly: true },
  { label: 'Lojas', icon: MapPin, path: '/stores', group: 'management', permissionKey: 'stores', adminOnly: true },
  { label: 'Configurações', icon: SettingsIcon, path: '/settings', group: 'management', permissionKey: 'settings' }
];

const Layout: React.FC<LayoutProps> = ({ children }) => {
  const { businessProfile } = useData();
  const { resolvedTheme, toggleTheme } = useTheme();
  const { role, user } = useAuth();
  const { can } = usePermissions();
  const location = useLocation();
  const [isMoreMenuOpen, setIsMoreMenuOpen] = useState(false);
  const [isOpeningCrm, setIsOpeningCrm] = useState(false);

  const isAdmin = role === 'admin';
  const navItems = useMemo(
    () => ALL_NAV_ITEMS.filter((item) => (!item.adminOnly || isAdmin) && can(item.permissionKey, 'visible')),
    [isAdmin, can]
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
  const quickActions = useMemo(
    () =>
      [
        { label: 'Nova venda', path: '/pdv/nova-venda', permissionKey: 'pdv' as const },
        { label: 'Novo aparelho', path: '/inventory', permissionKey: 'inventory' as const },
        { label: 'Novo cliente', path: '/clients', permissionKey: 'clients' as const },
      ].filter((action) => can(action.permissionKey, 'visible')),
    [can]
  );

  const isActive = (path: string) => location.pathname === path;
  const isMoreActive = moreMenuGroups.some((group) => group.items.some((item) => isActive(item.path)));

  useEffect(() => {
    setIsMoreMenuOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const previousPath = window.localStorage.getItem(LAST_VISITED_STORAGE_KEY);
    if (previousPath && previousPath !== location.pathname) {
      const prevItem = navByPath.get(previousPath);
      if (prevItem) {
        window.localStorage.setItem(
          PREVIOUS_VISITED_ITEM_KEY,
          JSON.stringify({ path: previousPath, label: prevItem.label })
        );
      }
    }
    window.localStorage.setItem(LAST_VISITED_STORAGE_KEY, location.pathname);
  }, [location.pathname, navByPath]);

  useEffect(() => {
    trackUxEvent({
      name: 'navigation_view',
      screen: location.pathname,
      role: role || undefined,
      metadata: { section: navByPath.get(location.pathname)?.label || 'Unknown' },
      ts: new Date().toISOString(),
    });
  }, [location.pathname, navByPath, role]);

  const openCRMPlus = async () => {
    if (isOpeningCrm) return;
    setIsOpeningCrm(true);
    try {
      const currentPath = location.pathname;
      const targetPath = currentPath === '/crm'
        ? '/'
        : currentPath.startsWith('/crm/')
          ? currentPath.replace('/crm', '')
          : '/';
      const redirectUrl = await createCrmHandoff(targetPath);
      window.location.assign(redirectUrl);
    } catch {
      openCRMStandaloneFallback();
    } finally {
      setIsOpeningCrm(false);
    }
  };

  return (
    <div className="app-shell-bg flex h-screen overflow-hidden">
      <aside className="hidden md:flex flex-col w-72 bg-white dark:bg-surface-dark-100 border-r border-gray-200 dark:border-surface-dark-200 shadow-ios">
        <div className="px-5 py-4 flex items-center gap-3 border-b border-gray-200 dark:border-surface-dark-200">
          {businessProfile.logoUrl ? (
            <img
              src={businessProfile.logoUrl}
              alt="Logo"
              className="w-11 h-11 object-contain rounded-ios-lg shadow-ios-sm border border-gray-200 dark:border-surface-dark-300 shrink-0"
            />
          ) : (
            <div className="w-11 h-11 rounded-ios-lg bg-gray-50 dark:bg-surface-dark-200 flex items-center justify-center shadow-ios-sm border border-gray-200 dark:border-surface-dark-300 shrink-0">
              <BrandLogo variant="mark" className="w-8 h-8 object-contain" />
            </div>
          )}
          <h1 className="text-lg font-bold tracking-tight leading-tight truncate">
            <span className="text-gray-900 dark:text-white">iPhone</span>
            <span className="text-brand-500">Repasse</span>
          </h1>
        </div>

        <nav className="flex-1 p-4 space-y-5 overflow-y-auto">
          <LayoutGroup id="sidebar-nav">
            {groupedNavItems.map((group) => (
              <div key={group.group}>
                <p className="ios-section-header px-2">{group.label}</p>
                <div className="space-y-1 mt-1">
                  {group.items.map((item) => {
                    const active = isActive(item.path);
                    return (
                      <Link
                        key={item.path}
                        to={item.path}
                        data-testid={`nav-link-${item.permissionKey}`}
                        className={`relative flex items-center gap-3 px-4 py-3 rounded-ios-lg transition-colors duration-200 ${
                          active
                            ? 'text-white'
                            : 'text-gray-600 dark:text-surface-dark-600 hover:bg-gray-100 dark:hover:bg-surface-dark-200 hover:text-gray-900 dark:hover:text-white'
                        }`}
                      >
                        {active && (
                          <m.span
                            layoutId="sidebar-active-pill"
                            aria-hidden="true"
                            className="absolute inset-0 rounded-ios-lg bg-brand-500 shadow-ios26-md z-0"
                            transition={iosSnappySpring}
                          />
                        )}
                        <item.icon size={20} className="relative z-10" />
                        <span className="font-medium relative z-10">{item.label}</span>
                      </Link>
                    );
                  })}
                </div>
              </div>
            ))}
          </LayoutGroup>
        </nav>

        <div className="p-4 border-t border-gray-200 dark:border-surface-dark-200 space-y-3">
          <button
            onClick={() => void openCRMPlus()}
            data-testid="open-crm-plus"
            className="w-full flex items-center gap-3 px-4 py-3 rounded-ios-lg bg-brand-50 dark:bg-brand-900/25 text-brand-700 dark:text-brand-300 hover:bg-brand-100 dark:hover:bg-brand-900/35 transition-colors"
          >
            <MessageCircle size={20} />
            <span className="font-medium">{isOpeningCrm ? 'Abrindo CRM Plus...' : 'Abrir CRM Plus'}</span>
          </button>

          <div className="px-2 text-xs text-gray-500 dark:text-surface-dark-500">
            <p className="truncate">
              <span className="font-semibold text-gray-700 dark:text-surface-dark-700">{ROLE_LABELS[role || 'seller']}</span>
              <span className="mx-1">·</span>v2.1 Pro
            </p>
            <p className="truncate text-[11px]">{user?.email}</p>
          </div>
        </div>
      </aside>

      <div className="flex-1 flex flex-col h-full overflow-hidden relative">
        <header className="md:hidden h-[52px] liquid-glass-thin border-b border-gray-200/40 dark:border-surface-dark-200/40 flex items-center justify-between px-4 z-20 safe-area-top">
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
            {can('settings', 'visible') && (
              <Link
                to="/settings"
                className="w-11 h-11 flex items-center justify-center text-gray-500 dark:text-surface-dark-500 active:bg-gray-100 dark:active:bg-surface-dark-200 rounded-full transition-colors"
                aria-label="Configurações"
              >
                <SettingsIcon size={20} />
              </Link>
            )}
          </div>
        </header>

        <header className="hidden md:flex h-14 liquid-glass-thin border-b border-gray-200/40 dark:border-surface-dark-200/40 items-center justify-end px-6 z-10">
          {can('settings', 'visible') && (
            <Link
              to="/settings"
              className="w-11 h-11 flex items-center justify-center text-gray-500 dark:text-surface-dark-500 hover:bg-gray-100 dark:hover:bg-surface-dark-200 rounded-full transition-colors"
              aria-label="Configurações"
            >
              <SettingsIcon size={20} />
            </Link>
          )}
        </header>

        <AnimatePresence>
          {isMoreMenuOpen && (
            <>
              <m.button
                type="button"
                className="md:hidden fixed inset-0 z-40 liquid-glass-strong"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.2 }}
                onClick={() => setIsMoreMenuOpen(false)}
                aria-label="Fechar menu"
              />
              <m.div
                className="md:hidden fixed bottom-[calc(env(safe-area-inset-bottom,0px)+84px)] left-4 right-4 z-50"
                initial={{ y: 24, opacity: 0, scale: 0.98 }}
                animate={{ y: 0, opacity: 1, scale: 1 }}
                exit={{ y: 24, opacity: 0, scale: 0.98, transition: { duration: 0.18, ease: [0.32, 0.72, 0, 1] } }}
                transition={iosSnappySpring}
              >
                <div className="bg-white dark:bg-surface-dark-100 rounded-ios-2xl shadow-ios26-lg border border-gray-200/70 dark:border-surface-dark-200 overflow-hidden max-h-[70vh]">
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
            </m.div>
          </>
          )}
        </AnimatePresence>

        <main className="flex-1 overflow-y-auto bg-surface-light-100 dark:bg-surface-dark-50 relative">
          <PageTransition>
            <div className="p-4 md:p-8 pb-28 md:pb-8">{children}</div>
          </PageTransition>
        </main>

        <nav className="md:hidden fixed bottom-0 left-0 right-0 z-30 liquid-glass border-t border-gray-200/40 dark:border-surface-dark-200/40 safe-area-bottom">
          <LayoutGroup id="tab-bar">
            <div className="flex items-center justify-around h-[50px] relative">
              {operationItems.map((item) => {
                const active = isActive(item.path);
                return (
                  <Link
                    key={item.path}
                    to={item.path}
                    className={`relative flex flex-col items-center justify-center w-full h-full pt-1.5 pb-0.5 transition-colors active:scale-95 ${
                      active ? 'text-brand-500' : 'text-gray-400 dark:text-surface-dark-400'
                    }`}
                    aria-label={item.label}
                  >
                    {active && (
                      <m.span
                        layoutId="tab-active-pill"
                        aria-hidden="true"
                        className="absolute top-1 left-1/2 -translate-x-1/2 w-12 h-7 rounded-full bg-brand-500/10 dark:bg-brand-500/20"
                        transition={iosSnappySpring}
                      />
                    )}
                    <item.icon size={24} strokeWidth={active ? 2.2 : 1.8} className="relative z-10" />
                    <span className={`text-[10px] mt-0.5 leading-tight relative z-10 ${active ? 'font-semibold' : 'font-medium'}`}>
                      {item.label}
                    </span>
                  </Link>
                );
              })}
              <button
                type="button"
                onClick={() => setIsMoreMenuOpen((prev) => !prev)}
                className={`relative flex flex-col items-center justify-center w-full h-full pt-1.5 pb-0.5 transition-colors active:scale-95 ${
                  isMoreActive || isMoreMenuOpen ? 'text-brand-500' : 'text-gray-400 dark:text-surface-dark-400'
                }`}
                aria-label="Mais opções"
              >
                {(isMoreActive || isMoreMenuOpen) && (
                  <m.span
                    layoutId="tab-active-pill"
                    aria-hidden="true"
                    className="absolute top-1 left-1/2 -translate-x-1/2 w-12 h-7 rounded-full bg-brand-500/10 dark:bg-brand-500/20"
                    transition={iosSnappySpring}
                  />
                )}
                <Ellipsis size={24} strokeWidth={isMoreActive || isMoreMenuOpen ? 2.2 : 1.8} className="relative z-10" />
                <span className={`text-[10px] mt-0.5 leading-tight relative z-10 ${isMoreActive || isMoreMenuOpen ? 'font-semibold' : 'font-medium'}`}>
                  Mais
                </span>
              </button>
            </div>
          </LayoutGroup>
        </nav>
      </div>
    </div>
  );
};

export default Layout;
