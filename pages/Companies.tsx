import React, { useCallback, useEffect, useState } from 'react';
import { Plus } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import Banner from '../components/ui/Banner';
import IOSButton from '../components/ui/IOSButton';
import { useToast } from '../components/ui/ToastProvider';
import { useAsyncHandler } from '../hooks/useAsyncHandler';
import CompanyRow from '../components/companies/CompanyRow';
import CompanyNameModal from '../components/companies/CompanyNameModal';
import CompanyMembersModal from '../components/companies/CompanyMembersModal';
import TransferSection from '../components/companies/TransferSection';
import { createTenant, fetchTransferCatalog, renameTenant, type TenantSummary, type TransferTenant } from '../services/tenants';

// null = criar; empresa = renomear.
type NameTarget = { company: TenantSummary | null };

const useTransferCatalog = () => {
  const [catalog, setCatalog] = useState<TransferTenant[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    setError(null);
    try {
      setCatalog(await fetchTransferCatalog());
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Não foi possível carregar as lojas.');
    }
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  return { catalog, error, reload };
};

export default function Companies() {
  const { tenant, user, refreshProfile, switchTenant } = useAuth();
  const toast = useToast();
  const run = useAsyncHandler();
  const { catalog, error, reload } = useTransferCatalog();
  const [needsReload, setNeedsReload] = useState(false);
  const [nameTarget, setNameTarget] = useState<NameTarget | null>(null);
  const [isSavingName, setIsSavingName] = useState(false);
  const [membersOf, setMembersOf] = useState<TenantSummary | null>(null);

  const companies = tenant?.tenants ?? [];
  const canCreate = tenant?.canCreateTenants ?? false;
  const renaming = nameTarget?.company ?? null;

  const saveName = async (name: string) => {
    await run(
      async () => {
        if (renaming) {
          await renameTenant(renaming.id, name);
          toast.success(`Nome alterado para ${name}.`);
        } else {
          const created = await createTenant(name);
          toast.success(`${created.name} criada. Agora adicione quem vai administrar.`);
          setMembersOf({ id: created.id, name: created.name, role: 'admin', isPrimary: false });
        }
        setNameTarget(null);
        await Promise.all([refreshProfile(), reload()]);
      },
      { setLoading: setIsSavingName },
    );
  };

  const handleTransferred = () => {
    setNeedsReload(true);
    void reload();
  };

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-[28px] font-bold tracking-tight text-gray-900 dark:text-white md:text-ios-large">Empresas</h2>
          <p className="mt-0.5 text-ios-subhead text-gray-500 dark:text-surface-dark-500">
            Cada empresa tem lojas, estoque, vendas e equipe próprios. Troque de empresa no topo da tela.
          </p>
        </div>
        {canCreate && (
          <IOSButton type="button" variant="primary" leftIcon={<Plus size={18} />} onClick={() => setNameTarget({ company: null })} className="min-h-12">
            Nova empresa
          </IOSButton>
        )}
      </div>

      {needsReload && (
        <Banner
          kind="info"
          title="Transferência feita"
          message="Recarregue para ver o estoque e as lojas atualizados nesta tela e no resto do app."
          action={{ label: 'Recarregar', onClick: () => window.location.reload() }}
          onClose={() => setNeedsReload(false)}
        />
      )}

      <section aria-labelledby="companies-title" className="ios-card p-4 md:p-5">
        <h3 id="companies-title" className="text-ios-caption font-bold uppercase tracking-wide text-gray-500 dark:text-surface-dark-500">
          Suas empresas
        </h3>
        <ul className="mt-3 space-y-2">
          {companies.map((company) => (
            <CompanyRow
              key={company.id}
              company={company}
              isActive={company.id === tenant?.activeTenantId}
              onView={() => void switchTenant(company.id)}
              onMembers={() => setMembersOf(company)}
              onRename={() => setNameTarget({ company })}
            />
          ))}
        </ul>
        {companies.length === 1 && canCreate && (
          <p className="mt-3 text-ios-caption text-gray-500 dark:text-surface-dark-500">
            Crie outra empresa para separar lojas e estoque. O seletor de empresa aparece no topo quando houver mais de uma.
          </p>
        )}
      </section>

      <TransferSection catalog={catalog} error={error} canCreate={canCreate} onRetry={() => void reload()} onTransferred={handleTransferred} />

      <CompanyNameModal
        open={nameTarget !== null}
        isRename={renaming !== null}
        initialName={renaming?.name ?? ''}
        saving={isSavingName}
        onClose={() => setNameTarget(null)}
        onSave={(name) => void saveName(name)}
      />

      <CompanyMembersModal
        company={membersOf}
        currentUserId={user?.id ?? null}
        canShareFromPrimary={canCreate}
        onClose={() => setMembersOf(null)}
      />
    </div>
  );
}
