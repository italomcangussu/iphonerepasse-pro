import React, { useState } from 'react';
import { 
  LayoutDashboard, Smartphone, Users, DollarSign, 
  ShoppingCart, Menu, X, ShieldCheck, Briefcase, MapPin, Edit, Sun, Moon
} from 'lucide-react';
import { Link, useLocation } from 'react-router-dom';
import { useData } from '../services/dataContext';
import { useTheme } from '../contexts/ThemeContext';

interface LayoutProps {
  children: React.ReactNode;
}

const Layout: React.FC<LayoutProps> = ({ children }) => {
  const { businessProfile } = useData();
  const { resolvedTheme, toggleTheme } = useTheme();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const location = useLocation();

  const navItems = [
    { label: 'Dashboard', icon: LayoutDashboard, path: '/' },
    { label: 'PDV', icon: ShoppingCart, path: '/pdv' },
    { label: 'Estoque', icon: Smartphone, path: '/inventory' },
    { label: 'Financeiro', icon: DollarSign, path: '/finance' },
    { label: 'Clientes', icon: Users, path: '/clients' },
    { label: 'Vendedores', icon: Briefcase, path: '/sellers' },
    { label: 'Lojas', icon: MapPin, path: '/stores' },
    { label: 'Garantias', icon: ShieldCheck, path: '/warranties' },
  ];

  const isActive = (path: string) => location.pathname === path;

  return (
    <div className="flex h-screen bg-surface-light-100 dark:bg-surface-dark-50 overflow-hidden">
      {/* Desktop Sidebar */}
      <aside className="hidden md:flex flex-col w-72 bg-white dark:bg-surface-dark-100 border-r border-gray-200 dark:border-surface-dark-200 shadow-ios">
        <div className="p-6 flex flex-col items-center border-b border-gray-200 dark:border-surface-dark-200">
          <Link to="/profile" className="flex flex-col items-center group cursor-pointer transition-transform hover:scale-105">
            {/* Logo Display */}
            {businessProfile.logoUrl ? (
              <img 
                src={businessProfile.logoUrl} 
                alt="Logo" 
                className="w-20 h-20 object-contain rounded-ios-xl mb-4 shadow-ios-md border border-gray-200 dark:border-surface-dark-300 group-hover:border-brand-500 transition-colors"
              />
            ) : (
              <div className="w-20 h-20 rounded-ios-xl bg-gray-50 dark:bg-surface-dark-200 flex items-center justify-center mb-4 shadow-ios-md border border-gray-200 dark:border-surface-dark-300">
                <img
                  src="/brand/logo-mark-dark.svg"
                  alt="iPhoneRepasse"
                  className="w-14 h-14 object-contain dark:hidden"
                />
                <img
                  src="/brand/logo-mark-light.svg"
                  alt="iPhoneRepasse"
                  className="w-14 h-14 object-contain hidden dark:block"
                />
              </div>
            )}
            
            <h1 className="text-xl font-bold tracking-tight text-center leading-tight">
              <span className="text-gray-900 dark:text-white">iPhone</span>
              <span className="text-brand-500">Repasse</span>
            </h1>
            
            <div className="flex items-center gap-1 mt-2 text-xs font-medium text-gray-500 dark:text-surface-dark-500 group-hover:text-brand-500 transition-colors bg-gray-100 dark:bg-surface-dark-200 px-3 py-1.5 rounded-full">
              <Edit size={12} />
              <span>Editar perfil</span>
            </div>
          </Link>
        </div>
        
        <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
          {navItems.map((item) => (
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
          {/* Theme Toggle */}
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
          
          <div className="bg-gray-100 dark:bg-surface-dark-200 rounded-ios-lg p-3 text-sm text-gray-600 dark:text-surface-dark-600">
            <p>Logado como: <span className="text-gray-900 dark:text-white font-semibold">Admin</span></p>
            <p className="text-xs mt-1 text-gray-500 dark:text-surface-dark-500">v2.0 Pro</p>
          </div>
        </div>
      </aside>

      {/* Mobile Header & Overlay */}
      <div className="flex-1 flex flex-col h-full overflow-hidden relative">
        <header className="md:hidden h-16 bg-white dark:bg-surface-dark-100 border-b border-gray-200 dark:border-surface-dark-200 flex items-center justify-between px-4 z-20 shadow-ios">
          <div className="flex items-center gap-3">
            {businessProfile.logoUrl ? (
              <img src={businessProfile.logoUrl} className="w-10 h-10 rounded-ios object-cover" alt="Logo" />
            ) : (
              <div className="w-10 h-10 rounded-ios bg-gray-50 dark:bg-surface-dark-200 border border-gray-200 dark:border-surface-dark-300 flex items-center justify-center">
                <img
                  src="/brand/logo-mark-dark.svg"
                  alt="iPhoneRepasse"
                  className="w-7 h-7 object-contain dark:hidden"
                />
                <img
                  src="/brand/logo-mark-light.svg"
                  alt="iPhoneRepasse"
                  className="w-7 h-7 object-contain hidden dark:block"
                />
              </div>
            )}
            <h1 className="text-lg font-bold text-gray-900 dark:text-white">
              iPhone<span className="text-brand-500">Repasse</span>
            </h1>
          </div>
          <div className="flex items-center gap-2">
            <button 
              onClick={toggleTheme}
              className="p-2 text-gray-600 dark:text-surface-dark-600 hover:text-gray-900 dark:hover:text-white"
            >
              {resolvedTheme === 'dark' ? <Sun size={20} /> : <Moon size={20} />}
            </button>
            <button 
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              className="p-2 text-gray-600 dark:text-surface-dark-600 hover:text-gray-900 dark:hover:text-white"
            >
              {isMobileMenuOpen ? <X /> : <Menu />}
            </button>
          </div>
        </header>

        {isMobileMenuOpen && (
          <div className="md:hidden absolute inset-0 z-10 bg-surface-light-100 dark:bg-surface-dark-50 pt-16">
            <div className="p-4 flex flex-col items-center border-b border-gray-200 dark:border-surface-dark-200 mb-2">
              <Link to="/profile" onClick={() => setIsMobileMenuOpen(false)} className="flex flex-col items-center">
                <div className="w-16 h-16 rounded-ios-xl bg-gray-100 dark:bg-surface-dark-200 flex items-center justify-center mb-2">
                  {businessProfile.logoUrl ? (
                    <img src={businessProfile.logoUrl} className="w-full h-full object-contain rounded-ios-xl" />
                  ) : (
                    <>
                      <img
                        src="/brand/logo-mark-dark.svg"
                        alt="iPhoneRepasse"
                        className="w-10 h-10 object-contain dark:hidden"
                      />
                      <img
                        src="/brand/logo-mark-light.svg"
                        alt="iPhoneRepasse"
                        className="w-10 h-10 object-contain hidden dark:block"
                      />
                    </>
                  )}
                </div>
                <span className="text-brand-500 text-sm flex items-center gap-1">
                  <Edit size={14} /> Editar Perfil
                </span>
              </Link>
            </div>
            <nav className="p-4 space-y-2">
              {navItems.map((item) => (
                <Link
                  key={item.path}
                  to={item.path}
                  onClick={() => setIsMobileMenuOpen(false)}
                  className={`flex items-center gap-3 px-4 py-4 rounded-ios-lg text-lg ${
                    isActive(item.path)
                      ? 'bg-brand-500 text-white shadow-ios-md'
                      : 'text-gray-600 dark:text-surface-dark-600 hover:bg-gray-100 dark:hover:bg-surface-dark-200'
                  }`}
                >
                  <item.icon size={24} />
                  <span>{item.label}</span>
                </Link>
              ))}
            </nav>
          </div>
        )}

        <main className="flex-1 overflow-y-auto p-4 md:p-8 bg-surface-light-100 dark:bg-surface-dark-50 relative">
          <div className="animate-ios-fade">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
};

export default Layout;
