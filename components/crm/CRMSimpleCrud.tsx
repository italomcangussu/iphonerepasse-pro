import React, { useEffect, useMemo, useState } from "react";
import { Pencil, Plus, RefreshCw, Save, Trash2 } from "lucide-react";
import { supabase } from "../../services/supabase";
import { assertNoError } from "../../utils/supabase";
import DesktopContextMenuHost from "../ui/DesktopContextMenu";
import type { ContextMenuAction } from "../ui/contextMenuCore";
import { useToast } from "../ui/ToastProvider";
import { useDesktopContextMenu } from "../../hooks/useDesktopContextMenu";
import CRMPageFrame from "./CRMPageFrame";
import { useCRMStore } from "./useCRMStore";

type FieldType = "text" | "textarea" | "number" | "boolean" | "json";

type CrudField = {
  key: string;
  label: string;
  type?: FieldType;
  required?: boolean;
};

type CrudColumn = {
  key: string;
  label: string;
  render?: (row: Record<string, any>) => React.ReactNode;
};

type CRMSimpleCrudProps = {
  table: string;
  title: string;
  description: string;
  fields: CrudField[];
  columns: CrudColumn[];
  defaultValues: Record<string, any>;
  orderBy?: { column: string; ascending?: boolean };
  requireStore?: boolean;
  storeColumn?: string;
};

function parseJsonSafe(value: string): any {
  if (!value.trim()) return null;
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

const CRMSimpleCrud: React.FC<CRMSimpleCrudProps> = ({
  table,
  title,
  description,
  fields,
  columns,
  defaultValues,
  orderBy,
  requireStore = true,
  storeColumn = "store_id",
}) => {
  const toast = useToast();
  const { selectedStoreId } = useCRMStore();
  const contextMenu = useDesktopContextMenu();
  const [rows, setRows] = useState<Record<string, any>[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<Record<string, any>>(defaultValues);

  const effectiveDefaults = useMemo(() => {
    const base = { ...defaultValues };
    if (requireStore) base[storeColumn] = selectedStoreId;
    return base;
  }, [defaultValues, requireStore, selectedStoreId, storeColumn]);

  const resetForm = () => {
    setEditingId(null);
    setForm(effectiveDefaults);
  };

  const loadRows = async () => {
    if (requireStore && !selectedStoreId) return;
    setLoading(true);
    try {
      let query = supabase.from(table).select("*");
      if (requireStore) {
        query = query.eq(storeColumn, selectedStoreId);
      }
      if (orderBy) {
        query = query.order(orderBy.column, { ascending: orderBy.ascending ?? false });
      } else {
        query = query.order("created_at", { ascending: false });
      }
      const data = assertNoError(await query);
      setRows((data || []) as Record<string, any>[]);
    } catch (error: any) {
      toast.error(error?.message || `Falha ao carregar dados de ${table}.`);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadRows();
  }, [selectedStoreId, table]);

  useEffect(() => {
    if (!editingId) {
      setForm(effectiveDefaults);
    }
  }, [effectiveDefaults, editingId]);

  const setField = (key: string, value: any) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const startEdit = (row: Record<string, any>) => {
    setEditingId(String(row.id));
    const next: Record<string, any> = {};
    fields.forEach((field) => {
      const value = row[field.key];
      next[field.key] = field.type === "json" ? JSON.stringify(value ?? {}, null, 2) : value ?? "";
    });
    if (requireStore && !next[storeColumn]) next[storeColumn] = selectedStoreId;
    setForm(next);
  };

  const save = async () => {
    if (requireStore && !selectedStoreId) {
      toast.error("Não foi possível resolver a loja padrão do CRM.");
      return;
    }
    for (const field of fields) {
      if (field.required && !String(form[field.key] ?? "").trim()) {
        toast.error(`Campo obrigatório: ${field.label}`);
        return;
      }
    }

    setSaving(true);
    try {
      const payload: Record<string, any> = {};
      fields.forEach((field) => {
        const rawValue = form[field.key];
        if (field.type === "boolean") {
          payload[field.key] = Boolean(rawValue);
          return;
        }
        if (field.type === "number") {
          payload[field.key] = rawValue === "" || rawValue === null ? null : Number(rawValue);
          return;
        }
        if (field.type === "json") {
          payload[field.key] = typeof rawValue === "string" ? parseJsonSafe(rawValue) : rawValue;
          if (payload[field.key] === null) payload[field.key] = {};
          return;
        }
        if (field.type === "textarea" || field.type === "text" || !field.type) {
          const clean = String(rawValue ?? "").trim();
          payload[field.key] = clean === "" ? null : clean;
        }
      });

      if (requireStore) {
        payload[storeColumn] = selectedStoreId;
      }

      if (editingId) {
        assertNoError(await supabase.from(table).update(payload).eq("id", editingId));
        toast.success("Registro atualizado.");
      } else {
        assertNoError(await supabase.from(table).insert(payload));
        toast.success("Registro criado.");
      }

      resetForm();
      await loadRows();
    } catch (error: any) {
      toast.error(error?.message || "Falha ao salvar registro.");
    } finally {
      setSaving(false);
    }
  };

  const remove = async (row: Record<string, any>) => {
    const rowId = String(row.id || "");
    if (!rowId) return;

    const confirmed = await toast.confirm({
      title: "Remover Registro",
      description: "Deseja realmente remover este registro? Esta ação não pode ser desfeita.",
      confirmLabel: "Remover",
      variant: "danger"
    });

    if (!confirmed) return;

    try {

      assertNoError(await supabase.from(table).delete().eq("id", rowId));
      toast.success("Registro removido.");
      if (editingId === rowId) {
        resetForm();
      }
      await loadRows();
    } catch (error: any) {
      toast.error(error?.message || "Falha ao remover registro.");
    }
  };

  const getRowContextLabel = (row: Record<string, any>): string => {
    const primaryColumn = columns[0];
    const value = primaryColumn ? row[primaryColumn.key] : row.id;
    const label = typeof value === "string" || typeof value === "number" ? String(value).trim() : "";
    return label || "registro";
  };

  const buildRowContextActions = (row: Record<string, any>): ContextMenuAction[] => [
    {
      id: "edit",
      label: "Editar",
      icon: <Pencil size={16} />,
      onSelect: () => startEdit(row),
    },
    {
      id: "remove",
      label: "Remover",
      icon: <Trash2 size={16} />,
      destructive: true,
      separatorBefore: true,
      onSelect: () => void remove(row),
    },
  ];

  return (
    <CRMPageFrame
      title={title}
      description={description}
      actions={(
        <>
          <button type="button" className="crm-btn crm-btn-secondary" onClick={() => void loadRows()}>
            <RefreshCw size={16} />
            Atualizar
          </button>
          <button type="button" className="crm-btn crm-btn-primary" onClick={resetForm}>
            <Plus size={16} />
            Novo
          </button>
        </>
      )}
    >
      <div className="crm-card p-4 space-y-3">
        <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">Editor</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {fields.map((field) => (
            <label key={field.key} className="space-y-1">
              <span className="crm-field-label">
                {field.label}
                {field.required ? " *" : ""}
              </span>
              {field.type === "textarea" || field.type === "json" ? (
                <textarea
                  className="crm-input min-h-[92px]"
                  value={String(form[field.key] ?? "")}
                  onChange={(event) => setField(field.key, event.target.value)}
                />
              ) : field.type === "boolean" ? (
                <select
                  className="crm-input"
                  value={String(Boolean(form[field.key]))}
                  onChange={(event) => setField(field.key, event.target.value === "true")}
                >
                  <option value="true">Ativo</option>
                  <option value="false">Inativo</option>
                </select>
              ) : field.type === "number" ? (
                <input
                  type="number"
                  className="crm-input"
                  value={String(form[field.key] ?? "")}
                  onChange={(event) => setField(field.key, event.target.value)}
                />
              ) : (
                <input
                  className="crm-input"
                  value={String(form[field.key] ?? "")}
                  onChange={(event) => setField(field.key, event.target.value)}
                />
              )}
            </label>
          ))}
        </div>
        <button type="button" className="crm-btn crm-btn-primary" disabled={saving} onClick={() => void save()}>
          <Save size={16} />
          {saving ? "Salvando..." : editingId ? "Atualizar" : "Criar"}
        </button>
      </div>

      <div className="crm-mobile-data-list lg:hidden">
        {loading ? (
          <div className="crm-mobile-data-cell">
            <p className="crm-mobile-data-meta">Carregando...</p>
          </div>
        ) : rows.length === 0 ? (
          <div className="crm-mobile-data-cell">
            <p className="crm-mobile-data-meta">Nenhum registro.</p>
          </div>
        ) : (
          rows.map((row) => {
            const [primaryColumn, ...secondaryColumns] = columns;
            const primaryValue = primaryColumn
              ? (primaryColumn.render ? primaryColumn.render(row) : String(row[primaryColumn.key] ?? "-"))
              : String(row.id || "-");

            return (
              <article
                key={row.id}
                className="crm-mobile-data-cell"
                onContextMenu={contextMenu.bind(buildRowContextActions(row), { label: `Ações de ${getRowContextLabel(row)}` })}
              >
                <div className="min-w-0 flex-1">
                  <div className="crm-mobile-data-title truncate">{primaryValue}</div>
                  <div className="crm-mobile-data-meta space-y-1">
                    {secondaryColumns.slice(0, 3).map((column) => (
                      <p key={column.key} className="truncate">
                        <span className="font-semibold">{column.label}:</span>{" "}
                        {column.render ? column.render(row) : String(row[column.key] ?? "-")}
                      </p>
                    ))}
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <button type="button" className="crm-icon-btn" onClick={() => startEdit(row)} aria-label="Editar registro">
                    Editar
                  </button>
                  <button type="button" className="crm-icon-btn text-red-600" onClick={() => void remove(row)} aria-label="Remover registro">
                    <Trash2 size={14} />
                  </button>
                </div>
              </article>
            );
          })
        )}
      </div>

      <div className="crm-card crm-desktop-data-table overflow-hidden lg:block">
        <div className="table-scroll-x">
          <table className="w-full min-w-[920px]">
            <thead className="bg-slate-50 border-b border-slate-200 dark:bg-slate-800 dark:border-slate-700">
              <tr>
                {columns.map((column) => (
                  <th key={column.key} className="px-3 py-2 text-left text-xs font-semibold uppercase text-slate-500 dark:text-slate-400">
                    {column.label}
                  </th>
                ))}
                <th className="px-3 py-2 text-right text-xs font-semibold uppercase text-slate-500 dark:text-slate-400">Ações</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={columns.length + 1} className="px-3 py-6 text-sm text-slate-500 dark:text-slate-400">
                    Carregando...
                  </td>
                </tr>
              ) : rows.length === 0 ? (
                <tr>
                  <td colSpan={columns.length + 1} className="px-3 py-6 text-sm text-slate-500 dark:text-slate-400">
                    Nenhum registro.
                  </td>
                </tr>
              ) : (
                rows.map((row) => (
                  <tr
                    key={row.id}
                    className="border-b border-slate-100 last:border-0 dark:border-slate-800"
                    onContextMenu={contextMenu.bind(buildRowContextActions(row), { label: `Ações de ${getRowContextLabel(row)}` })}
                  >
                    {columns.map((column) => (
                      <td key={column.key} className="px-3 py-2 text-sm text-slate-700 dark:text-slate-300">
                        {column.render ? column.render(row) : String(row[column.key] ?? "-")}
                      </td>
                    ))}
                    <td className="px-3 py-2 text-right">
                      <div className="inline-flex gap-2">
                        <button type="button" className="crm-icon-btn" onClick={() => startEdit(row)}>
                          Editar
                        </button>
                        <button type="button" className="crm-icon-btn text-red-600" onClick={() => void remove(row)}>
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
      <DesktopContextMenuHost controller={contextMenu} />
    </CRMPageFrame>
  );
};

export default CRMSimpleCrud;
