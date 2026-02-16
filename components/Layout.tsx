import React, { useState } from 'react';
import {
  LayoutDashboard, Smartphone, Users, DollarSign,
  ShoppingCart, ShieldCheck, Briefcase, MapPin, Edit, Sun, Moon,
  Ellipsis, LogOut
} from 'lucide-react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useData } from '../services/dataContext';
import { useTheme } from '../contexts/ThemeContext';
import { useAuth } from '../contexts/AuthContext';
import BrandLogo from './BrandLogo';

interface LayoutProps {
  children: React.ReactNode;
}

const Layout: React.FC<LayoutProps> = ({ children }) => {
  const { businessProfile } = useData();
  const { resolvedTheme, toggleTheme } = useTheme();
  const { role, user, signOut } = useAuth();
  const [isMoreMenuOpen, setIsMoreMenuOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();

  const isAdmin = role === 'admin';

  const primaryNavItems = [
    { label: 'Dashboard', icon: LayoutDashboard, path: '/' },
    { label: 'PDV', icon: ShoppingCart, path: '/pdv' },
    { label: 'Estoque', icon: Smartphone, path: '/inventory' },
    ...(isAdmin ? [{ label: 'Financeiro', icon: DollarSign, path: '/finance' }] : []),
  ];

  const secondaryNavItems = [
    { label: 'Clientes', icon: Users, path: '/clients' },
    { label: 'Garantias', icon: ShieldCheck, path: '/warranties' },
    ...(isAdmin ? [
      { label: 'Devedores', icon: DollarSign, path: '/debtors' },
      { label: 'Vendedores', icon: Briefcase, path: '/sellers' },
      { label: 'Lojas', icon: MapPin, path: '/stores' },
    ] : []),
  ];

  const allNavItems = [...primaryNavItems, ...secondaryNavItems];

  const isActive = (path: string) => location.pathname === path;
  const isSecondaryActive = secondaryNavItems.some(item => isActive(item.path));

  return (
    <div className="flex h-screen bg-surface-light-100 dark:bg-surface-dark-50 overflow-hidden">
      {/* Desktop Sidebar */}
      <aside className="hidden md:flex flex-col w-72 bg-white dark:bg-surface-dark-100 border-r border-gray-200 dark:border-surface-dark-200 shadow-ios">
        <div className="p-6 flex flex-col items-center border-b border-gray-200 dark:border-surface-dark-200">
          <div
            onClick={isAdmin ? () => navigate('/profile') : undefined}
            className={`flex flex-col items-center group transition-transform ${isAdmin ? 'cursor-pointer hover:scale-105' : ''}`}
          >
            {businessProfile.logoUrl ? (
              <img
                src={businessProfile.logoUrl}
                alt="Logo"
                className="w-20 h-20 object-contain rounded-ios-xl mb-4 shadow-ios-md border border-gray-200 dark:border-surface-dark-300 group-hover:border-brand-500 transition-colors"
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

            {isAdmin && (
              <div className="flex items-center gap-1 mt-2 text-xs font-medium text-gray-500 dark:text-surface-dark-500 group-hover:text-brand-500 transition-colors bg-gray-100 dark:bg-surface-dark-200 px-3 py-1.5 rounded-full">
                <Edit size={12} />
                <span>Editar perfil</span>
              </div>
            )}
          </div>
        </div>

        <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
          {allNavItems.map((item) => (
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
        </nav>

        <div className="p-4 border-t border-gray-200 dark:border-surface-dark-200 space-y-3">
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
              <span className="text-gray-900 dark:text-white font-semibold">
                {role === 'admin' ? 'Admin' : 'Vendedor'}
              </span>
            </p>
            <p className="text-xs mt-1 text-gray-500 dark:text-surface-dark-500 truncate">{user?.email}</p>
            <p className="text-xs mt-1 text-gray-500 dark:text-surface-dark-500">v2.0 Pro</p>
          </div>
        </div>
      </aside>

      {/* Mobile Layout */}
      <div className="flex-1 flex flex-col h-full overflow-hidden relative">
        {/* Mobile Top Bar - Compact iOS-style navigation bar */}
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
            {isAdmin ? (
              <Link
                to="/profile"
                className="w-11 h-11 flex items-center justify-center text-gray-500 dark:text-surface-dark-500 active:bg-gray-100 dark:active:bg-surface-dark-200 rounded-full transition-colors"
                aria-label="Perfil"
              >
                <Edit size={20} />
              </Link>
            ) : (
              <button
                type="button"
                onClick={() => void signOut()}
                className="w-11 h-11 flex items-center justify-center text-gray-500 dark:text-surface-dark-500 active:bg-gray-100 dark:active:bg-surface-dark-200 rounded-full transition-colors"
                aria-label="Sair"
              >
                <LogOut size={20} />
              </button>
            )}
          </div>
        </header>

        {/* More Menu Overlay (iOS Action Sheet style) */}
        {isMoreMenuOpen && (
          <>
            <button
              type="button"
              className="md:hidden fixed inset-0 z-40 bg-black/40 backdrop-blur-sm animate-ios-fade"
              onClick={() => setIsMoreMenuOpen(false)}
              aria-label="Fechar menu"
            />
            <div className="md:hidden fixed bottom-[calc(env(safe-area-inset-bottom,0px)+84px)] left-4 right-4 z-50 animate-ios-slide-up">
              <div className="bg-white dark:bg-surface-dark-100 rounded-ios-2xl shadow-ios-xl border border-gray-200 dark:border-surface-dark-200 overflow-hidden">
                <div className="p-2">
                  {secondaryNavItems.map((item) => (
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
                      <item.icon size={22} className={isActive(item.path) ? 'text-brand-500' : 'text-gray-400 dark:text-surface-dark-400'} />
                      <span className="text-[17px] font-medium">{item.label}</span>
                    </Link>
                  ))}
                </div>
              </div>
            </div>
          </>
        )}

        {/* Main Content */}
        <main className="flex-1 overflow-y-auto bg-surface-light-100 dark:bg-surface-dark-50 relative">
          <div className="p-4 md:p-8 pb-28 md:pb-8 animate-ios-fade">
            {children}
          </div>
        </main>

        {/* iOS-style Bottom Tab Bar (mobile only) */}
        <nav className="md:hidden fixed bottom-0 left-0 right-0 z-30 glass border-t border-gray-200/60 dark:border-surface-dark-200/60 safe-area-bottom">
          <div className="flex items-center justify-around h-[50px]">
            {primaryNavItems.map((item) => (
              <Link
                key={item.path}
                to={item.path}
                className={`flex flex-col items-center justify-center w-full h-full pt-1.5 pb-0.5 transition-colors active:scale-95 ${
                  isActive(item.path)
                    ? 'text-brand-500'
                    : 'text-gray-400 dark:text-surface-dark-400'
                }`}
                aria-label={item.label}
              >
                <item.icon size={24} strokeWidth={isActive(item.path) ? 2.2 : 1.8} />
                <span className={`text-[10px] mt-0.5 leading-tight ${isActive(item.path) ? 'font-semibold' : 'font-medium'}`}>
                  {item.label}
                </span>
              </Link>
            ))}
            {/* More tab */}
            <button
              type="button"
              onClick={() => setIsMoreMenuOpen(!isMoreMenuOpen)}
              className={`flex flex-col items-center justify-center w-full h-full pt-1.5 pb-0.5 transition-colors active:scale-95 ${
                isSecondaryActive || isMoreMenuOpen
                  ? 'text-brand-500'
                  : 'text-gray-400 dark:text-surface-dark-400'
              }`}
              aria-label="Mais opções"
            >
              <Ellipsis size={24} strokeWidth={(isSecondaryActive || isMoreMenuOpen) ? 2.2 : 1.8} />
              <span className={`text-[10px] mt-0.5 leading-tight ${(isSecondaryActive || isMoreMenuOpen) ? 'font-semibold' : 'font-medium'}`}>
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
