import React, { useEffect, useState } from "react";
import { RefreshCw } from "lucide-react";
import { supabase } from "../../services/supabase";
import { useAsyncHandler } from "../../hooks/useAsyncHandler";
import { assertNoError } from "../../utils/supabase";
import CRMPageFrame from "../../components/crm/CRMPageFrame";
import { useCRMStore } from "../../components/crm/useCRMStore";

type CashbackRow = {
  lead_id: string;
  lead_name: string | null;
  lifetime_value: number;
  purchase_count: number;
  cashback_available: number;
};

const CashbackPage: React.FC = () => {
  const run = useAsyncHandler();
  const { selectedStoreId } = useCRMStore();
  const [rows, setRows] = useState<CashbackRow[]>([]);
  const [loading, setLoading] = useState(true);

  const loadCashback = async () => {
    if (!selectedStoreId) return;
    await run(async () => {
      const data = assertNoError(await supabase.rpc("get_cashback_summary", {
        p_store_id: selectedStoreId,
      }));
      setRows(Array.isArray(data) ? (data as CashbackRow[]) : []);
    }, { errorMsg: "Falha ao carregar cashback.", setLoading });
  };

  useEffect(() => {
    void loadCashback();
  }, [selectedStoreId]);

  return (
    <CRMPageFrame
      title="Cashback"
      description="Painel operacional de saldo potencial para campanhas de retenção."
      actions={(
        <button type="button" className="crm-btn crm-btn-secondary" onClick={() => void loadCashback()}>
          <RefreshCw size={16} />
          Atualizar
        </button>
      )}
    >
      <div className="crm-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[820px]">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="px-3 py-2 text-left text-xs font-semibold uppercase text-slate-500">Lead</th>
                <th className="px-3 py-2 text-left text-xs font-semibold uppercase text-slate-500">Compras</th>
                <th className="px-3 py-2 text-left text-xs font-semibold uppercase text-slate-500">LTV</th>
                <th className="px-3 py-2 text-left text-xs font-semibold uppercase text-slate-500">Cashback</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={4} className="px-3 py-6 text-sm text-slate-500">Carregando...</td>
                </tr>
              ) : rows.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-3 py-6 text-sm text-slate-500">Sem dados de cashback.</td>
                </tr>
              ) : (
                rows.map((row) => (
                  <tr key={row.lead_id} className="border-b border-slate-100">
                    <td className="px-3 py-2 text-sm text-slate-700">{row.lead_name || row.lead_id}</td>
                    <td className="px-3 py-2 text-sm text-slate-700">{row.purchase_count}</td>
                    <td className="px-3 py-2 text-sm text-slate-700">
                      {Number(row.lifetime_value || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                    </td>
                    <td className="px-3 py-2 text-sm text-slate-700">
                      {Number(row.cashback_available || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
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

export default CashbackPage;
