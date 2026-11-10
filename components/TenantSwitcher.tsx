import React, { useState } from 'react';
import { Building2, ChevronDown, Loader2 } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from './ui/ToastProvider';

type TenantSwitcherProps = {
  compact?: boolean;
};

// Só aparece para quem tem mais de uma empresa: para os outros não há escolha.
export default function TenantSwitcher({ compact = false }: TenantSwitcherProps) {
  const { tenant, switchTenant } = useAuth();
  const toast = useToast();
  const [switchingTo, setSwitchingTo] = useState<string | null>(null);

  if (!tenant || tenant.tenants.length < 2) return null;

  const active = tenant.tenants.find((item) => item.id === tenant.activeTenantId);

  const handleChange = async (event: React.ChangeEvent<HTMLSelectElement>) => {
    const next = tenant.tenants.find((item) => item.id === event.target.value);
    if (!next || next.id === tenant.activeTenantId) return;
    setSwitchingTo(next.name);
    try {
      await switchTenant(next.id);
    } catch (error) {
      setSwitchingTo(null);
      toast.error(error instanceof Error ? error.message : 'Não foi possível trocar de empresa.');
    }
  };

  return (
    <>
      <label
        className={`relative flex items-center gap-1.5 min-h-11 rounded-full border border-gray-200 dark:border-surface-dark-300 bg-white/70 dark:bg-surface-dark-200/70 text-gray-900 dark:text-white focus-within:ring-2 focus-within:ring-brand-500 ${
          compact ? 'pl-2.5 pr-7 max-w-[44vw]' : 'pl-3 pr-8 max-w-[260px]'
        }`}
        title="Empresa que você está vendo"
      >
        <Building2 size={compact ? 16 : 15} className="shrink-0 text-brand-500" aria-hidden="true" />
        <span className="truncate text-sm font-semibold">{active?.name ?? 'Empresa'}</span>
        <ChevronDown size={14} className="absolute right-2.5 text-gray-400 pointer-events-none" aria-hidden="true" />
        <select
          aria-label="Empresa"
          value={tenant.activeTenantId}
          onChange={handleChange}
          disabled={switchingTo !== null}
          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer text-base"
        >
          {tenant.tenants.map((item) => (
            <option key={item.id} value={item.id}>
              {item.name}
            </option>
          ))}
        </select>
      </label>

      {switchingTo && (
        <div
          role="status"
          aria-live="polite"
          className="fixed inset-0 z-[100] flex flex-col items-center justify-center gap-3 bg-white/85 dark:bg-surface-dark-100/90 backdrop-blur-sm"
        >
          <Loader2 size={28} className="animate-spin text-brand-500" aria-hidden="true" />
          <p className="text-base font-semibold text-gray-900 dark:text-white">Trocando para {switchingTo}…</p>
          <p className="text-sm text-gray-500 dark:text-surface-dark-500">Estoque, vendas e clientes passam a ser desta empresa.</p>
        </div>
      )}
    </>
  );
}
