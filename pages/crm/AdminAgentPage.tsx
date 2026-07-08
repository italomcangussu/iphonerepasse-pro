import React, { useEffect, useMemo, useState } from "react";
import { RefreshCw, ShieldCheck, Trash2, UserPlus } from "lucide-react";
import { supabase } from "../../services/supabase";
import { useAsyncHandler } from "../../hooks/useAsyncHandler";
import { assertNoError } from "../../utils/supabase";
import CRMPageFrame from "../../components/crm/CRMPageFrame";
import { useToast } from "../../components/ui/ToastProvider";

interface AdminNumberRow {
  id: string;
  phone: string;
  user_id: string;
  label: string | null;
  is_active: boolean;
  created_at: string;
}

interface AdminOption {
  authUserId: string;
  name: string;
  email: string;
}

interface AuditRow {
  id: string;
  phone: string | null;
  action: string;
  status: string;
  error: string | null;
  created_at: string;
}

/** Normalize to the "+55…" form used by admin_agent_numbers (matches _shared normalizePhone). */
function normalizePhone(raw: string): string | null {
  const digits = raw.replace(/\D/g, "");
  if (!digits) return null;
  const withCountry = digits.startsWith("55") ? digits : `55${digits}`;
  return `+${withCountry}`;
}

const ACTION_LABEL: Record<string, string> = {
  transfer: "Transferência",
  transfer_cancelled: "Transferência cancelada",
  reserve_stock: "Reserva",
  reserve_stock_cancelled: "Reserva cancelada",
  chat_turn: "Conversa",
  denied: "Acesso negado",
};

const AdminAgentPage: React.FC = () => {
  const run = useAsyncHandler();
  const toast = useToast();
  const [rows, setRows] = useState<AdminNumberRow[]>([]);
  const [admins, setAdmins] = useState<AdminOption[]>([]);
  const [audit, setAudit] = useState<AuditRow[]>([]);
  const [loading, setLoading] = useState(true);

  const [phone, setPhone] = useState("");
  const [userId, setUserId] = useState("");
  const [label, setLabel] = useState("");
  const [saving, setSaving] = useState(false);

  const adminById = useMemo(() => {
    const map = new Map<string, AdminOption>();
    admins.forEach((a) => map.set(a.authUserId, a));
    return map;
  }, [admins]);

  const loadAll = async () => {
    await run(async () => {
      const [numbersRes, profilesRes, sellersRes, auditRes] = await Promise.all([
        supabase.from("admin_agent_numbers").select("id, phone, user_id, label, is_active, created_at").order("created_at", { ascending: false }),
        supabase.from("user_profiles").select("id, role").eq("role", "admin"),
        supabase.from("sellers").select("name, email, auth_user_id"),
        supabase.from("admin_agent_audit_log").select("id, phone, action, status, error, created_at").order("created_at", { ascending: false }).limit(15),
      ]);

      setRows((assertNoError(numbersRes) as AdminNumberRow[]) || []);

      const adminIds = new Set(
        ((assertNoError(profilesRes) as { id: string }[]) || []).map((p) => p.id),
      );
      const sellers = (assertNoError(sellersRes) as { name: string; email: string; auth_user_id: string }[]) || [];
      setAdmins(
        sellers
          .filter((s) => adminIds.has(s.auth_user_id))
          .map((s) => ({ authUserId: s.auth_user_id, name: s.name, email: s.email })),
      );

      setAudit((assertNoError(auditRes) as AuditRow[]) || []);
    }, { errorMsg: "Falha ao carregar dados do assistente.", setLoading });
  };

  useEffect(() => {
    void loadAll();
  }, []);

  const addNumber = async () => {
    const normalized = normalizePhone(phone);
    if (!normalized) {
      toast.error("Informe um telefone válido.");
      return;
    }
    if (!userId) {
      toast.error("Selecione o administrador vinculado.");
      return;
    }
    await run(async () => {
      const resolvedLabel = label.trim() || adminById.get(userId)?.name || null;
      const { error } = await supabase.from("admin_agent_numbers").insert({
        phone: normalized,
        user_id: userId,
        label: resolvedLabel,
        is_active: true,
      });
      if (error) {
        toast.error(
          error.code === "23505"
            ? "Este telefone já está cadastrado."
            : `Erro: ${error.message}`,
        );
        return;
      }
      toast.success("Número autorizado.");
      setPhone("");
      setUserId("");
      setLabel("");
      await loadAll();
    }, { setLoading: setSaving });
  };

  const toggleActive = async (row: AdminNumberRow) => {
    await run(async () => {
      assertNoError(
        await supabase.from("admin_agent_numbers")
          .update({ is_active: !row.is_active, updated_at: new Date().toISOString() })
          .eq("id", row.id),
      );
      await loadAll();
    });
  };

  const removeNumber = async (row: AdminNumberRow) => {
    if (!confirm(`Remover ${row.label || row.phone} da lista de administradores?`)) return;
    await run(async () => {
      assertNoError(await supabase.from("admin_agent_numbers").delete().eq("id", row.id));
      toast.success("Número removido.");
      await loadAll();
    });
  };

  return (
    <CRMPageFrame
      title="Assistente Financeiro"
      description="Administradores reconhecidos pelo número de WhatsApp podem consultar saldos/dívidas, transferir entre Conta e Cofre e reservar aparelhos conversando com o agente no canal interno."
      actions={(
        <button type="button" className="crm-btn crm-btn-secondary" onClick={() => void loadAll()}>
          <RefreshCw size={16} />
          Atualizar
        </button>
      )}
    >
      <div className="space-y-6">
        <div className="ios-card p-4 border border-blue-200 bg-blue-50/60 dark:bg-surface-dark-200 dark:border-surface-dark-300">
          <div className="flex items-start gap-2 text-ios-subhead text-blue-900 dark:text-blue-200">
            <ShieldCheck size={18} className="mt-0.5 shrink-0" />
            <p>
              Só números listados aqui conseguem operar o assistente. Marque o canal interno em
              <strong> Canais → Console financeiro</strong> e conecte um número dedicado. Transferências e reservas
              sempre pedem confirmação (SIM/NÃO) antes de executar.
            </p>
          </div>
        </div>

        {/* Add form */}
        <div className="ios-card p-4 border border-gray-200 dark:border-surface-dark-300 space-y-3">
          <h3 className="text-ios-subhead font-semibold text-gray-900 dark:text-white flex items-center gap-2">
            <UserPlus size={16} className="text-brand-500" /> Autorizar novo número
          </h3>
          <div className="grid gap-3 md:grid-cols-3">
            <div>
              <label className="ios-label" htmlFor="aa-phone">Telefone (WhatsApp)</label>
              <input
                id="aa-phone"
                className="ios-input"
                placeholder="(88) 99999-8888"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
              />
            </div>
            <div>
              <label className="ios-label" htmlFor="aa-admin">Administrador</label>
              <select id="aa-admin" className="ios-input" value={userId} onChange={(e) => setUserId(e.target.value)}>
                <option value="">Selecione…</option>
                {admins.map((a) => (
                  <option key={a.authUserId} value={a.authUserId}>
                    {a.name} ({a.email})
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="ios-label" htmlFor="aa-label">Apelido (opcional)</label>
              <input
                id="aa-label"
                className="ios-input"
                placeholder="Ex.: Ítalo (dono)"
                value={label}
                onChange={(e) => setLabel(e.target.value)}
              />
            </div>
          </div>
          {admins.length === 0 && !loading && (
            <p className="text-xs text-amber-600">
              Nenhum usuário administrador encontrado. Cadastre um administrador em Vendedores/Usuários primeiro.
            </p>
          )}
          <button type="button" className="crm-btn crm-btn-primary" disabled={saving} onClick={() => void addNumber()}>
            {saving ? "Salvando…" : "Autorizar"}
          </button>
        </div>

        {/* List */}
        <div className="ios-card border border-gray-200 dark:border-surface-dark-300 overflow-hidden">
          {loading ? (
            <div className="p-4 text-ios-subhead text-gray-500">Carregando…</div>
          ) : rows.length === 0 ? (
            <div className="p-4 text-ios-subhead text-gray-500">Nenhum número autorizado ainda.</div>
          ) : (
            <ul className="divide-y divide-gray-100 dark:divide-surface-dark-300">
              {rows.map((row) => (
                <li key={row.id} className="flex items-center justify-between gap-3 p-4">
                  <div className="min-w-0">
                    <p className="text-ios-subhead font-medium text-gray-900 dark:text-white truncate">
                      {row.label || adminById.get(row.user_id)?.name || "—"}
                    </p>
                    <p className="text-xs text-gray-500 dark:text-surface-dark-500">
                      {row.phone}
                      {adminById.get(row.user_id) ? ` · ${adminById.get(row.user_id)!.email}` : ""}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      type="button"
                      className={`crm-btn ${row.is_active ? "crm-btn-secondary" : "crm-btn-primary"}`}
                      onClick={() => void toggleActive(row)}
                    >
                      {row.is_active ? "Ativo" : "Inativo"}
                    </button>
                    <button
                      type="button"
                      aria-label="Remover"
                      className="p-2 rounded-ios text-red-600 hover:bg-red-50 dark:hover:bg-surface-dark-300"
                      onClick={() => void removeNumber(row)}
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Recent activity */}
        {audit.length > 0 && (
          <div className="ios-card border border-gray-200 dark:border-surface-dark-300 overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-100 dark:border-surface-dark-300">
              <h3 className="text-ios-subhead font-semibold text-gray-900 dark:text-white">Atividade recente</h3>
            </div>
            <ul className="divide-y divide-gray-100 dark:divide-surface-dark-300">
              {audit.map((a) => (
                <li key={a.id} className="flex items-center justify-between gap-3 px-4 py-3 text-xs">
                  <span className="text-gray-700 dark:text-surface-dark-600">
                    {ACTION_LABEL[a.action] || a.action}
                    {a.phone ? ` · ${a.phone}` : ""}
                  </span>
                  <span className={a.status === "ok" ? "text-green-600" : a.status === "denied" ? "text-amber-600" : "text-red-600"}>
                    {new Date(a.created_at).toLocaleString("pt-BR")}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </CRMPageFrame>
  );
};

export default AdminAgentPage;
