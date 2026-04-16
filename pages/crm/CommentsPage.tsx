import React, { useEffect, useState } from "react";
import { RefreshCw } from "lucide-react";
import { supabase } from "../../services/supabase";
import CRMPageFrame from "../../components/crm/CRMPageFrame";
import CRMStoreFilter from "../../components/crm/CRMStoreFilter";
import { useCRMStore } from "../../components/crm/useCRMStore";
import { useToast } from "../../components/ui/ToastProvider";

type CommentRow = {
  id: string;
  comment_id: string;
  actor_username: string | null;
  content: string | null;
  direction: string;
  status: string;
  media_id: string | null;
  event_created_at: string | null;
  created_at: string;
};

const CommentsPage: React.FC = () => {
  const toast = useToast();
  const { stores, selectedStoreId, setSelectedStoreId } = useCRMStore();
  const [rows, setRows] = useState<CommentRow[]>([]);
  const [loading, setLoading] = useState(true);

  const loadRows = async () => {
    if (!selectedStoreId) return;
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("crm_instagram_comment_events")
        .select("id,comment_id,actor_username,content,direction,status,media_id,event_created_at,created_at")
        .eq("store_id", selectedStoreId)
        .order("event_created_at", { ascending: false, nullsFirst: false })
        .limit(250);
      if (error) throw error;
      setRows((data || []) as CommentRow[]);
    } catch (error: any) {
      toast.error(error?.message || "Falha ao carregar comentários.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadRows();
  }, [selectedStoreId]);

  return (
    <CRMPageFrame
      title="Comentários"
      description="Monitoramento de comentários e respostas públicas do Instagram Oficial."
      actions={(
        <button type="button" className="crm-btn crm-btn-secondary" onClick={() => void loadRows()}>
          <RefreshCw size={16} />
          Atualizar
        </button>
      )}
    >
      <CRMStoreFilter stores={stores} selectedStoreId={selectedStoreId} onStoreChange={setSelectedStoreId} />

      <div className="crm-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[920px]">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="px-3 py-2 text-left text-xs font-semibold uppercase text-slate-500">Usuário</th>
                <th className="px-3 py-2 text-left text-xs font-semibold uppercase text-slate-500">Comentário</th>
                <th className="px-3 py-2 text-left text-xs font-semibold uppercase text-slate-500">Direção</th>
                <th className="px-3 py-2 text-left text-xs font-semibold uppercase text-slate-500">Status</th>
                <th className="px-3 py-2 text-left text-xs font-semibold uppercase text-slate-500">Media</th>
                <th className="px-3 py-2 text-left text-xs font-semibold uppercase text-slate-500">Data</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={6} className="px-3 py-6 text-sm text-slate-500">Carregando...</td>
                </tr>
              ) : rows.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-3 py-6 text-sm text-slate-500">Sem eventos de comentário.</td>
                </tr>
              ) : (
                rows.map((row) => (
                  <tr key={row.id} className="border-b border-slate-100">
                    <td className="px-3 py-2 text-sm text-slate-700">@{row.actor_username || "desconhecido"}</td>
                    <td className="px-3 py-2 text-sm text-slate-700">{row.content || "-"}</td>
                    <td className="px-3 py-2 text-sm text-slate-700">{row.direction}</td>
                    <td className="px-3 py-2 text-sm text-slate-700">{row.status}</td>
                    <td className="px-3 py-2 text-sm text-slate-700">{row.media_id || "-"}</td>
                    <td className="px-3 py-2 text-sm text-slate-700">
                      {new Date(row.event_created_at || row.created_at).toLocaleString("pt-BR")}
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

export default CommentsPage;
