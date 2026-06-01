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

  const formatCurrency = (value: number) => Number(value || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

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
      <div className="crm-mobile-data-list lg:hidden">
        {loading ? (
          <div className="crm-mobile-data-cell">
            <p className="crm-mobile-data-meta">Carregando...</p>
          </div>
        ) : rows.length === 0 ? (
          <div className="crm-mobile-data-cell">
            <p className="crm-mobile-data-meta">Sem dados de cashback.</p>
          </div>
        ) : (
          rows.map((row) => (
            <article key={row.lead_id} className="crm-mobile-data-cell">
              <div className="min-w-0 flex-1">
                <p className="crm-mobile-data-title truncate">{row.lead_name || row.lead_id}</p>
                <div className="crm-mobile-data-meta grid gap-1">
                  <p>{row.purchase_count} compra(s)</p>
                  <p>LTV: {formatCurrency(row.lifetime_value)}</p>
                </div>
              </div>
              <div className="shrink-0 text-right">
                <p className="text-[13px] font-semibold text-slate-500 dark:text-slate-400">Cashback</p>
                <p className="text-[15px] font-bold text-brand-700 dark:text-brand-200">{formatCurrency(row.cashback_available)}</p>
              </div>
            </article>
          ))
        )}
      </div>

      <div className="crm-card crm-desktop-data-table overflow-hidden lg:block">
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
                      {formatCurrency(row.lifetime_value)}
                    </td>
                    <td className="px-3 py-2 text-sm text-slate-700">
                      {formatCurrency(row.cashback_available)}
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
