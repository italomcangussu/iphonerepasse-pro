import React, { useEffect, useState } from "react";
import { RefreshCw } from "lucide-react";
import { supabase } from "../../services/supabase";
import { useToast } from "../../components/ui/ToastProvider";
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

const AdsPage: React.FC = () => {
  const toast = useToast();
  const { selectedStoreId } = useCRMStore();
  const [groups, setGroups] = useState<AdsGroup[]>([]);
  const [loading, setLoading] = useState(true);

  const loadDashboard = async () => {
    if (!selectedStoreId) return;
    setLoading(true);
    try {
      const { data, error } = await supabase.rpc("get_crm_ads_dashboard", {
        p_store_id: selectedStoreId,
      });
      if (error) throw error;
      setGroups(Array.isArray(data?.groups) ? (data.groups as AdsGroup[]) : []);
    } catch (error: any) {
      toast.error(error?.message || "Falha ao carregar dashboard de Ads.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadDashboard();
  }, [selectedStoreId]);

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
      <div className="crm-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[920px]">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="px-3 py-2 text-left text-xs font-semibold uppercase text-slate-500">Grupo</th>
                <th className="px-3 py-2 text-left text-xs font-semibold uppercase text-slate-500">Fonte</th>
                <th className="px-3 py-2 text-left text-xs font-semibold uppercase text-slate-500">Status</th>
                <th className="px-3 py-2 text-left text-xs font-semibold uppercase text-slate-500">Atribuições</th>
                <th className="px-3 py-2 text-left text-xs font-semibold uppercase text-slate-500">Última Detecção</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={5} className="px-3 py-6 text-sm text-slate-500">Carregando...</td>
                </tr>
              ) : groups.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-3 py-6 text-sm text-slate-500">Sem grupos detectados.</td>
                </tr>
              ) : (
                groups.map((group) => (
                  <tr key={group.group_key} className="border-b border-slate-100">
                    <td className="px-3 py-2 text-sm text-slate-700">
                      {group.auto_name || group.group_key.slice(0, 8)}
                    </td>
                    <td className="px-3 py-2 text-sm text-slate-700">{group.source_app}</td>
                    <td className="px-3 py-2 text-sm text-slate-700">{group.status}</td>
                    <td className="px-3 py-2 text-sm text-slate-700">{group.attributions}</td>
                    <td className="px-3 py-2 text-sm text-slate-700">
                      {group.last_seen_at ? new Date(group.last_seen_at).toLocaleString("pt-BR") : "-"}
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
