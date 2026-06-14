import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Briefcase,
  Calculator as CalculatorIcon,
  DollarSign,
  Ellipsis,
  HandCoins,
  LayoutDashboard,
  MapPin,
  MessageCircle,
  Megaphone,
  Moon,
  Package,
  PackageOpen,
  Settings as SettingsIcon,
  ShieldCheck,
  ShoppingCart,
  Smartphone,
  Sun,
  Users
} from 'lucide-react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { AnimatePresence, LayoutGroup, m } from 'framer-motion';
import { useData } from '../services/dataContext';
import { useTheme } from '../contexts/ThemeContext';
import { useAuth } from '../contexts/AuthContext';
import { usePermissions } from '../contexts/PermissionsContext';
import { ROLE_LABELS } from '../lib/permissions';
import { createCrmHandoff, openCRMStandaloneFallback } from '../services/crmHandoff';
import { supabase } from '../services/supabase';
import { useToast } from './ui/ToastProvider';
import { useCRMUnreadCount } from '../hooks/useCRMUnreadCount';
import { trackUxEvent } from '../services/telemetry';
import BrandLogo from './BrandLogo';
import OfflineBanner from './pwa/OfflineBanner';
import { PageTransition } from './motion';
import { iosSnappySpring } from './motion/transitions';
import { PageHeaderProvider, usePageHeader } from '../contexts/PageHeaderContext';
import { prefetchPrimaryRoute } from '../lib/routePrefetch';

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
    | 'calculator'
    | 'inventory'
    | 'in_use'
    | 'clients'
    | 'warranties'
    | 'debtors'
    | 'finance'
    | 'parts_stock'
    | 'sellers'
    | 'stores'
    | 'settings'
    | 'payable_debts'
    | 'marketing';
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
  { label: 'Em Uso', icon: PackageOpen, path: '/in-use', group: 'management', permissionKey: 'in_use' },
  { label: 'Clientes', icon: Users, path: '/clients', group: 'relationship', permissionKey: 'clients' },
  { label: 'Garantias', icon: ShieldCheck, path: '/warranties', group: 'relationship', permissionKey: 'warranties' },
  { label: 'Marketing', icon: Megaphone, path: '/marketing', group: 'relationship', permissionKey: 'marketing' },
  { label: 'Calculadora', icon: CalculatorIcon, path: '/calculator', group: 'management', permissionKey: 'calculator' },
  { label: 'Devedores', icon: DollarSign, path: '/debtors', group: 'management', permissionKey: 'debtors' },
  { label: 'Dívidas Ativas', icon: HandCoins, path: '/payable-debts', group: 'management', permissionKey: 'payable_debts' },
  { label: 'Financeiro', icon: DollarSign, path: '/finance', group: 'operation', permissionKey: 'finance' },
  { label: 'Estoque de Peças', icon: Package, path: '/parts-stock', group: 'management', permissionKey: 'parts_stock' },
  { label: 'Vendedores', icon: Briefcase, path: '/sellers', group: 'management', permissionKey: 'sellers' },
  { label: 'Lojas', icon: MapPin, path: '/stores', group: 'management', permissionKey: 'stores' },
  { label: 'Configurações', icon: SettingsIcon, path: '/settings', group: 'management', permissionKey: 'settings' }
];

const Layout: React.FC<LayoutProps> = ({ children }) => (
  <PageHeaderProvider>
    <LayoutInner>{children}</LayoutInner>
  </PageHeaderProvider>
);


const LayoutInner: React.FC<LayoutProps> = ({ children }) => {
  const { businessProfile } = useData();
  const { resolvedTheme, toggleTheme } = useTheme();
  const { role, user } = useAuth();
  const { can } = usePermissions();
  const location = useLocation();
  const mainRef = useRef<HTMLElement>(null);
  const [isMoreMenuOpen, setIsMoreMenuOpen] = useState(false);
  const [isOpeningCrm, setIsOpeningCrm] = useState(false);
  const { header } = usePageHeader();

  const toast = useToast();
  const navigate = useNavigate();
  const crmUnread = useCRMUnreadCount();

  const pathnameRef = useRef(location.pathname);
  useEffect(() => { pathnameRef.current = location.pathname; }, [location.pathname]);

  // Toast: new inbound CRM message when not on conversations page
  useEffect(() => {
    const channel = supabase
      .channel('layout-crm-toast')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'crm_messages', filter: 'direction=eq.inbound' },
        (payload) => {
          if (pathnameRef.current === '/crm/conversations') return;
          const msg = payload.new as { content: string | null; conversation_id: string };
          const preview = (msg.content || 'Nova mensagem').slice(0, 60);
          toast.info(preview, {
            title: 'Nova mensagem CRM',
            durationMs: 5000,
            action: {
              label: 'Ver',
              onClick: () => navigate('/crm/conversations'),
              dismissOnClick: true,
            },
          });
        }
      )
      .subscribe();
    return () => { void supabase.removeChannel(channel); };
  }, [toast, navigate]);

  // Toast: new sale recorded by any user when not on PDV
  useEffect(() => {
    const channel = supabase
      .channel('layout-sales-toast')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'sales' }, (payload) => {
        if (pathnameRef.current.startsWith('/pdv')) return;
        const sale = payload.new as { total?: number };
        const amount = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(
          Number(sale.total || 0)
        );
        toast.success(`Nova venda — ${amount}`, { durationMs: 4000 });
      })
      .subscribe();
    return () => { void supabase.removeChannel(channel); };
  }, [toast]);

  const navItems = useMemo(
    () => ALL_NAV_ITEMS.filter((item) => can(item.permissionKey, 'visible')),
    [can]
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
    const ua = window.navigator.userAgent;
    const isIPadOS =
      /iPad/.test(ua) ||
      (/Macintosh/.test(ua) && window.navigator.maxTouchPoints > 1);
    if (!isIPadOS) return;

    const canScrollVertically = (element: HTMLElement, deltaY: number) => {
      const style = window.getComputedStyle(element);
      if (!/(auto|scroll|overlay)/.test(style.overflowY)) return false;
      if (element.scrollHeight <= element.clientHeight) return false;
      if (deltaY > 0) return element.scrollTop + element.clientHeight < element.scrollHeight;
      if (deltaY < 0) return element.scrollTop > 0;
      return false;
    };

    const hasScrollableAncestorBeforeMain = (target: EventTarget | null, deltaY: number) => {
      if (!(target instanceof Element)) return false;
      const main = mainRef.current;
      let current: Element | null = target;
      while (current && current !== main && current !== document.body) {
        if (current instanceof HTMLElement && canScrollVertically(current, deltaY)) return true;
        current = current.parentElement;
      }
      return false;
    };

    const handleWheel = (event: WheelEvent) => {
      const main = mainRef.current;
      if (!main || !event.cancelable || Math.abs(event.deltaY) <= Math.abs(event.deltaX)) return;
      if (window.innerWidth < 1280) return;
      if (event.target instanceof Element && event.target.closest('[role="dialog"]')) return;
      if (hasScrollableAncestorBeforeMain(event.target, event.deltaY)) return;
      if (!canScrollVertically(main, event.deltaY)) return;

      event.preventDefault();
      main.scrollBy({ top: event.deltaY, behavior: 'auto' });
    };

    window.addEventListener('wheel', handleWheel, { passive: false });
    return () => window.removeEventListener('wheel', handleWheel);
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const ua = window.navigator.userAgent;
    const isIPadOS =
      /iPad/.test(ua) ||
      (/Macintosh/.test(ua) && window.navigator.maxTouchPoints > 1);
    if (!isIPadOS) return;

    const focusableSelector = [
      'a[href]',
      'button:not([disabled])',
      'input:not([disabled]):not([type="hidden"])',
      'select:not([disabled])',
      'textarea:not([disabled])',
      'summary',
      '[role="button"]',
      '[role="combobox"]',
      '[tabindex]:not([tabindex="-1"])'
    ].join(',');

    const isInteractiveTarget = (element: HTMLElement) => {
      if (element.hasAttribute('disabled') || element.getAttribute('aria-disabled') === 'true') return false;
      if (element.closest('[role="dialog"]')) return false;
      return Boolean(element.closest('a[href],button,select,summary,[role="button"],[role="combobox"]'));
    };

    const getFocusableElements = () => {
      const main = mainRef.current;
      if (!main) return [];
      return Array.from(main.querySelectorAll(focusableSelector)).filter((element): element is HTMLElement => {
        if (!(element instanceof HTMLElement)) return false;
        if (element.hasAttribute('disabled') || element.getAttribute('aria-hidden') === 'true') return false;
        const style = window.getComputedStyle(element);
        return style.display !== 'none' && style.visibility !== 'hidden';
      });
    };

    const focusElement = (element: HTMLElement) => {
      element.focus();
      element.scrollIntoView({ block: 'nearest', inline: 'nearest' });
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (window.innerWidth < 1280) return;
      if (event.target instanceof Element && event.target.closest('[role="dialog"]')) return;

      if (event.key === 'Tab') {
        const focusable = getFocusableElements();
        if (focusable.length === 0) return;

        const active = document.activeElement instanceof HTMLElement ? document.activeElement : null;
        const activeIndex = active ? focusable.indexOf(active) : -1;
        const nextIndex = event.shiftKey
          ? activeIndex <= 0 ? focusable.length - 1 : activeIndex - 1
          : activeIndex < 0 || activeIndex >= focusable.length - 1 ? 0 : activeIndex + 1;

        event.preventDefault();
        focusElement(focusable[nextIndex]);
        return;
      }

      if (event.key !== 'Enter') return;
      const active = document.activeElement;
      if (!(active instanceof HTMLElement) || !isInteractiveTarget(active)) return;

      event.preventDefault();
      active.click();
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

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
    <div className="app-shell-bg flex min-h-[100svh] w-full max-w-full overflow-x-clip xl:h-[100dvh] xl:overflow-y-hidden">
      <OfflineBanner />
      <aside className="hidden xl:flex flex-col w-72 bg-white dark:bg-surface-dark-100 border-r border-gray-200 dark:border-surface-dark-200 shadow-ios">
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
            <div className="relative shrink-0">
              <MessageCircle size={20} />
              {crmUnread > 0 && (
                <span className="absolute -top-1.5 -right-1.5 min-w-[16px] h-4 px-0.5 flex items-center justify-center rounded-full bg-red-500 text-white text-[10px] font-bold leading-none">
                  {crmUnread > 99 ? '99+' : crmUnread}
                </span>
              )}
            </div>
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

      <div className="flex-1 flex flex-col min-w-0 max-w-full overflow-x-clip relative xl:h-full xl:overflow-y-hidden">
        <header className="xl:hidden sticky top-0 h-[calc(52px+env(safe-area-inset-top,0px))] liquid-glass-thin border-b border-gray-200/40 dark:border-surface-dark-200/40 flex items-center justify-between px-3 sm:px-4 z-20 safe-area-top">
          <div className="flex items-center gap-2 min-w-0 flex-1 pr-2">
            {businessProfile.logoUrl ? (
              <img src={businessProfile.logoUrl} className="w-7 h-7 sm:w-8 sm:h-8 rounded-ios object-cover shrink-0" alt="Logo" loading="eager" decoding="async" />
            ) : (
              <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-ios bg-gray-50 dark:bg-surface-dark-200 border border-gray-200 dark:border-surface-dark-300 flex items-center justify-center shrink-0">
                <BrandLogo variant="mark" className="w-5 h-5 object-contain" />
              </div>
            )}
            <h1 className="min-w-0 text-[clamp(13px,4.2vw,17px)] font-semibold text-gray-900 dark:text-white tracking-tight whitespace-nowrap leading-none">
              iPhone<span className="text-brand-500">Repasse</span>
            </h1>
          </div>
          <div className="flex items-center gap-0.5 shrink-0">
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

        <header className="hidden xl:flex h-12 liquid-glass-thin border-b border-gray-200/40 dark:border-surface-dark-200/40 items-center justify-between px-6 z-10">
          {/* Page title injected by CRMPageFrame via context */}
          <div className="flex items-center gap-3 min-w-0">
            {header.title && (
              <h1 className="text-sm font-bold tracking-tight text-gray-900 dark:text-white truncate">{header.title}</h1>
            )}
            {header.actions && (
              <div className="flex items-center gap-2">{header.actions}</div>
            )}
          </div>
          <div className="flex items-center gap-1 shrink-0">
            <button
              onClick={toggleTheme}
              className="w-9 h-9 flex items-center justify-center text-gray-500 dark:text-surface-dark-500 hover:bg-gray-100 dark:hover:bg-surface-dark-200 rounded-full transition-colors"
              aria-label={resolvedTheme === 'dark' ? 'Ativar modo claro' : 'Ativar modo escuro'}
            >
              {resolvedTheme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
            </button>
            {can('settings', 'visible') && (
              <Link
                to="/settings"
                className="w-9 h-9 flex items-center justify-center text-gray-500 dark:text-surface-dark-500 hover:bg-gray-100 dark:hover:bg-surface-dark-200 rounded-full transition-colors"
                aria-label="Configurações"
              >
                <SettingsIcon size={18} />
              </Link>
            )}
          </div>
        </header>

        <AnimatePresence>
          {isMoreMenuOpen && (
            <>
              <m.button
                type="button"
                className="xl:hidden fixed inset-0 z-40 liquid-glass-strong"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.2 }}
                onClick={() => setIsMoreMenuOpen(false)}
                aria-label="Fechar menu"
              />
              <m.div
                className="xl:hidden fixed bottom-[calc(env(safe-area-inset-bottom,0px)+84px)] left-4 right-4 z-50"
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
                        className="text-center px-2 py-2 rounded-ios-lg bg-gray-100 dark:bg-surface-dark-200 text-xs font-semibold text-gray-700 dark:text-surface-dark-700 cursor-pointer hover:bg-gray-200 dark:hover:bg-surface-dark-300 transition-colors"
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

        <main ref={mainRef} className="flex-1 min-w-0 max-w-full overflow-x-clip xl:overflow-y-auto bg-surface-light-100 dark:bg-surface-dark-50 relative" style={{ overscrollBehaviorY: 'contain' }}>
          <PageTransition>
            <div className="px-4 pt-2 pb-[calc(8rem+env(safe-area-inset-bottom,0px))] md:px-6 md:pt-3 xl:px-8 xl:pt-4 xl:pb-8">
              {children}
            </div>
          </PageTransition>
        </main>

        <nav className="xl:hidden fixed bottom-0 left-0 right-0 z-30 liquid-glass border-t border-gray-200/40 dark:border-surface-dark-200/40 safe-area-bottom">
          <LayoutGroup id="tab-bar">
            <div className="flex items-center justify-around h-[50px] relative">
              {operationItems.map((item) => {
                const active = isActive(item.path);
                return (
                  <Link
                    key={item.path}
                    to={item.path}
                    onPointerEnter={() => prefetchPrimaryRoute(item.path)}
                    onFocus={() => prefetchPrimaryRoute(item.path)}
                    onTouchStart={() => prefetchPrimaryRoute(item.path)}
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
