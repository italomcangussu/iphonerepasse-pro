import React, { useState } from 'react';
import { 
  LayoutDashboard, Smartphone, Users, DollarSign, 
  ShoppingCart, Menu, X, ShieldCheck, Briefcase, MapPin, Edit 
} from 'lucide-react';
import { Link, useLocation } from 'react-router-dom';
import { useData } from '../services/dataContext';

interface LayoutProps {
  children: React.ReactNode;
}

const Layout: React.FC<LayoutProps> = ({ children }) => {
  const { businessProfile } = useData();
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
    <div className="flex h-screen bg-dark-900 text-slate-100 overflow-hidden">
      {/* Desktop Sidebar */}
      <aside className="hidden md:flex flex-col w-64 bg-dark-800 border-r border-dark-700">
        <div className="p-6 flex items-center justify-center border-b border-dark-700">
          <Link to="/profile" className="flex flex-col items-center group cursor-pointer transition-transform hover:scale-105">
             {/* Logo Display */}
             {businessProfile.logoUrl ? (
               <img 
                 src={businessProfile.logoUrl} 
                 alt="Logo" 
                 className="w-16 h-16 object-contain rounded-xl mb-3 shadow-lg shadow-primary-500/10 border border-dark-600 group-hover:border-primary-500 transition-colors"
               />
             ) : (
               <div className="w-16 h-16 rounded-xl bg-gradient-to-br from-primary-600 to-primary-900 flex items-center justify-center text-2xl font-bold text-white mb-3 shadow-lg shadow-primary-500/20 border border-dark-600 group-hover:border-primary-500 transition-colors">
                  {businessProfile.name.slice(0, 2).toUpperCase()}
               </div>
             )}
             
             <h1 className="text-xl font-bold tracking-tighter text-center leading-tight">
               {businessProfile.name.includes('iPhone') ? (
                 <>
                  <span className="text-white">iPhone</span>
                  <span className="text-primary-500">Repasse</span>
                 </>
               ) : (
                 <span className="text-white">{businessProfile.name}</span>
               )}
             </h1>
             
             <div className="flex items-center gap-1 mt-2 text-xs font-medium text-slate-500 group-hover:text-primary-400 transition-colors bg-dark-900 px-3 py-1 rounded-full border border-dark-700">
               <Edit size={10} />
               <span>Editar perfil</span>
             </div>
          </Link>
        </div>
        <nav className="flex-1 p-4 space-y-2 overflow-y-auto">
          {navItems.map((item) => (
            <Link
              key={item.path}
              to={item.path}
              className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 ${
                isActive(item.path)
                  ? 'bg-gradient-to-r from-primary-600 to-primary-500 text-white shadow-lg shadow-primary-500/20'
                  : 'text-slate-400 hover:bg-dark-700 hover:text-white'
              }`}
            >
              <item.icon size={20} />
              <span className="font-medium">{item.label}</span>
            </Link>
          ))}
        </nav>
        <div className="p-4 border-t border-dark-700">
          <div className="bg-dark-900 rounded-lg p-3 text-sm text-slate-400">
            <p>Logado como: <span className="text-white font-semibold">Admin</span></p>
            <p className="text-xs mt-1 text-slate-500">v1.1.0 Pro</p>
          </div>
        </div>
      </aside>

      {/* Mobile Header & Overlay */}
      <div className="flex-1 flex flex-col h-full overflow-hidden relative">
        <header className="md:hidden h-16 bg-dark-800 border-b border-dark-700 flex items-center justify-between px-4 z-20">
          <div className="flex items-center gap-2">
            {businessProfile.logoUrl && (
              <img src={businessProfile.logoUrl} className="w-8 h-8 rounded object-cover" alt="Logo" />
            )}
            <h1 className="text-lg font-bold truncate max-w-[200px] text-white">
               {businessProfile.name}
            </h1>
          </div>
          <button 
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            className="p-2 text-slate-300 hover:text-white"
          >
            {isMobileMenuOpen ? <X /> : <Menu />}
          </button>
        </header>

        {isMobileMenuOpen && (
          <div className="md:hidden absolute inset-0 z-10 bg-dark-900/95 backdrop-blur-sm pt-16">
            <div className="p-4 flex flex-col items-center border-b border-dark-700 mb-2">
                <Link to="/profile" onClick={() => setIsMobileMenuOpen(false)} className="flex flex-col items-center">
                   <div className="w-16 h-16 rounded-xl bg-dark-800 flex items-center justify-center border border-dark-600 mb-2">
                      {businessProfile.logoUrl ? (
                         <img src={businessProfile.logoUrl} className="w-full h-full object-contain rounded-xl" />
                      ) : (
                         <span className="text-xl font-bold text-white">{businessProfile.name.slice(0,2)}</span>
                      )}
                   </div>
                   <span className="text-primary-500 text-sm flex items-center gap-1"><Edit size={12} /> Editar Perfil</span>
                </Link>
            </div>
            <nav className="p-4 space-y-2">
              {navItems.map((item) => (
                <Link
                  key={item.path}
                  to={item.path}
                  onClick={() => setIsMobileMenuOpen(false)}
                  className={`flex items-center gap-3 px-4 py-4 rounded-xl text-lg ${
                    isActive(item.path)
                      ? 'bg-primary-600 text-white'
                      : 'text-slate-400 hover:bg-dark-800'
                  }`}
                >
                  <item.icon size={24} />
                  <span>{item.label}</span>
                </Link>
              ))}
            </nav>
          </div>
        )}

        <main className="flex-1 overflow-y-auto p-4 md:p-8 bg-dark-900 relative">
          {children}
        </main>
      </div>
    </div>
  );
};

export default Layout;