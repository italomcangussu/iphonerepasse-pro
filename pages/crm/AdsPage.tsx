import React, { useEffect, useState } from "react";
import { RefreshCw } from "lucide-react";
import { supabase } from "../../services/supabase";
import { useAsyncHandler } from "../../hooks/useAsyncHandler";
import { assertNoError } from "../../utils/supabase";
import CRMPageFrame from "../../components/crm/CRMPageFrame";
import { useCRMStore } from "../../components/crm/useCRMStore";

type AdsGroup = {
  group_key: string;
  auto_name: string | null;
  status: string;
  source_app: string;
  first_seen_at: string | null;
  last_seen_at: string | null;
  attributions: number;
};

const ADS_STATUS_LABELS: Record<string, string> = {
  active: "Ativo",
  paused: "Pausado",
  ended: "Encerrado",
  archived: "Arquivado",
  deleted: "Excluído",
};

const formatAdsStatus = (status: string) => ADS_STATUS_LABELS[status] ?? status;

const AdsPage: React.FC = () => {
  const run = useAsyncHandler();
  const { selectedStoreId } = useCRMStore();
  const [groups, setGroups] = useState<AdsGroup[]>([]);
  const [loading, setLoading] = useState(true);

  const loadDashboard = async () => {
    if (!selectedStoreId) return;
    await run(async () => {
      const data = assertNoError(await supabase.rpc("get_crm_ads_dashboard", {
        p_store_id: selectedStoreId,
      }));
      setGroups(Array.isArray(data?.groups) ? (data.groups as AdsGroup[]) : []);
    }, { errorMsg: "Falha ao carregar dashboard de Ads.", setLoading });
  };

  useEffect(() => {
    void loadDashboard();
  }, [selectedStoreId]);

  const renderLastSeen = (value: string | null) => value ? new Date(value).toLocaleString("pt-BR") : "-";

  return (
    <CRMPageFrame
      title="Ads"
      description="Inteligência de campanhas Meta com agrupamentos e atribuições de lead."
      actions={(
        <button type="button" className="crm-btn crm-btn-secondary" onClick={() => void loadDashboard()}>
          <RefreshCw size={16} />
          Atualizar
        </button>
      )}
    >
      <div className="crm-mobile-data-list lg:hidden">
        {loading ? (
          <div className="crm-mobile-data-cell">
            <p className="crm-mobile-data-meta">Carregando...</p>
          </div>
        ) : groups.length === 0 ? (
          <div className="crm-mobile-data-cell">
            <p className="crm-mobile-data-meta">Sem grupos detectados.</p>
          </div>
        ) : (
          groups.map((group) => (
            <article key={group.group_key} className="crm-mobile-data-cell">
              <div className="min-w-0 flex-1">
                <p className="crm-mobile-data-title truncate">{group.auto_name || group.group_key.slice(0, 8)}</p>
                <div className="crm-mobile-data-meta grid gap-1">
                  <p className="truncate">Fonte: {group.source_app}</p>
                  <p className="truncate">Status: {formatAdsStatus(group.status)}</p>
                  <p className="truncate">Última detecção: {renderLastSeen(group.last_seen_at)}</p>
                </div>
              </div>
              <span className="inline-flex min-h-11 min-w-11 shrink-0 items-center justify-center rounded-full bg-brand-600 px-2 text-sm font-bold text-white">
                {group.attributions}
              </span>
            </article>
          ))
        )}
      </div>

      <div className="crm-card crm-desktop-data-table overflow-hidden lg:block">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[920px]">
            <thead className="bg-slate-50 border-b border-slate-200 dark:bg-slate-800 dark:border-slate-700">
              <tr>
                <th className="px-3 py-2 text-left text-xs font-semibold uppercase text-slate-500 dark:text-slate-400">Grupo</th>
                <th className="px-3 py-2 text-left text-xs font-semibold uppercase text-slate-500 dark:text-slate-400">Fonte</th>
                <th className="px-3 py-2 text-left text-xs font-semibold uppercase text-slate-500 dark:text-slate-400">Status</th>
                <th className="px-3 py-2 text-left text-xs font-semibold uppercase text-slate-500 dark:text-slate-400">Atribuições</th>
                <th className="px-3 py-2 text-left text-xs font-semibold uppercase text-slate-500 dark:text-slate-400">Última Detecção</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={5} className="px-3 py-6 text-sm text-slate-500 dark:text-slate-400">Carregando...</td>
                </tr>
              ) : groups.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-3 py-6 text-sm text-slate-500 dark:text-slate-400">Sem grupos detectados.</td>
                </tr>
              ) : (
                groups.map((group) => (
                  <tr key={group.group_key} className="border-b border-slate-100 dark:border-slate-800">
                    <td className="px-3 py-2 text-sm text-slate-700 dark:text-slate-300">
                      {group.auto_name || group.group_key.slice(0, 8)}
                    </td>
                    <td className="px-3 py-2 text-sm text-slate-700 dark:text-slate-300">{group.source_app}</td>
                    <td className="px-3 py-2 text-sm text-slate-700 dark:text-slate-300">{formatAdsStatus(group.status)}</td>
                    <td className="px-3 py-2 text-sm text-slate-700 dark:text-slate-300">{group.attributions}</td>
                    <td className="px-3 py-2 text-sm text-slate-700 dark:text-slate-300">
                      {renderLastSeen(group.last_seen_at)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </CRMPageFrame>
  );
};

export default AdsPage;
