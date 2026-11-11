import React, { useEffect, useMemo, useRef, useState } from "react";
import { Pencil, Plus, RefreshCw, Save, Trash2 } from "lucide-react";
import { supabase } from "../../services/supabase";
import { assertNoError } from "../../utils/supabase";
import DesktopContextMenuHost from "../ui/DesktopContextMenu";
import type { ContextMenuAction } from "../ui/contextMenuCore";
import { useToast } from "../ui/ToastProvider";
import { useDesktopContextMenu } from "../../hooks/useDesktopContextMenu";
import CRMCrudField, { type CrudField, type CrudOption } from "./CRMCrudField";
import CRMPageFrame from "./CRMPageFrame";
import { useCRMStore } from "./useCRMStore";

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

type FieldErrors = Record<string, string>;

/** Texto vazio vira objeto vazio; JSON inválido devolve `undefined` para o formulário acusar em vez de gravar `{}` por cima do dado. */
function parseJsonField(value: unknown): unknown {
  if (typeof value !== "string") return value ?? {};
  if (!value.trim()) return {};
  try {
    return JSON.parse(value) ?? {};
  } catch {
    return undefined;
  }
}

function validateFields(fields: CrudField[], form: Record<string, any>): FieldErrors {
  const errors: FieldErrors = {};
  for (const field of fields) {
    if (field.required && !String(form[field.key] ?? "").trim()) {
      errors[field.key] = `Preencha ${field.label.toLowerCase()}.`;
      continue;
    }
    if (field.type === "json" && parseJsonField(form[field.key]) === undefined) {
      errors[field.key] = "Este texto não é um JSON válido. Confira chaves, aspas e vírgulas.";
    }
  }
  return errors;
}

function toPayloadValue(field: CrudField, rawValue: unknown): unknown {
  if (field.type === "boolean") return Boolean(rawValue);
  if (field.type === "number") return rawValue === "" || rawValue === null ? null : Number(rawValue);
  if (field.type === "json") return parseJsonField(rawValue);
  const clean = String(rawValue ?? "").trim();
  return clean === "" ? null : clean;
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
  const [errors, setErrors] = useState<FieldErrors>({});
  const [lookups, setLookups] = useState<Record<string, CrudOption[]>>({});
  const formRef = useRef<HTMLDivElement>(null);

  const basicFields = useMemo(() => fields.filter((field) => field.type !== "json"), [fields]);
  const advancedFields = useMemo(() => fields.filter((field) => field.type === "json"), [fields]);
  const editingLabel = useMemo(() => {
    const row = rows.find((candidate) => String(candidate.id) === editingId);
    const value = row && columns[0] ? row[columns[0].key] : null;
    return typeof value === "string" && value.trim() ? value.trim() : "registro";
  }, [columns, editingId, rows]);

  const revealForm = () => formRef.current?.scrollIntoView?.({ behavior: "smooth", block: "start" });

  const effectiveDefaults = useMemo(() => {
    const base = { ...defaultValues };
    if (requireStore) base[storeColumn] = selectedStoreId;
    return base;
  }, [defaultValues, requireStore, selectedStoreId, storeColumn]);

  const resetForm = () => {
    setEditingId(null);
    setForm(effectiveDefaults);
    setErrors({});
  };

  const startNew = () => {
    resetForm();
    revealForm();
  };

  // As telas passam `fields` como literal: a chave em texto evita buscar de novo a cada render.
  const lookupFields = fields.filter((field) => field.type === "lookup" && field.lookup);
  const lookupSignature = JSON.stringify(lookupFields.map((field) => [field.key, field.lookup]));

  useEffect(() => {
    let cancelled = false;
    const loadLookups = async () => {
      const entries = await Promise.all(
        lookupFields.map(async (field) => {
          const lookup = field.lookup!;
          let query = supabase.from(lookup.table).select(`${lookup.valueKey}, ${lookup.labelKey}`);
          if (lookup.storeScoped && selectedStoreId) query = query.eq("store_id", selectedStoreId);
          const { data } = await query;
          const options = ((data || []) as Record<string, any>[]).map((row) => ({
            value: String(row[lookup.valueKey]),
            label: String(row[lookup.labelKey] || row[lookup.valueKey]),
          }));
          return [field.key, options] as const;
        })
      );
      if (!cancelled) setLookups(Object.fromEntries(entries));
    };
    if (lookupFields.length > 0) void loadLookups();
    return () => {
      cancelled = true;
    };
  }, [lookupSignature, selectedStoreId]);

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
    setErrors((prev) => (prev[key] ? { ...prev, [key]: "" } : prev));
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
    setErrors({});
    revealForm();
  };

  const save = async () => {
    if (requireStore && !selectedStoreId) {
      toast.error("Não foi possível resolver a loja padrão do CRM.");
      return;
    }
    const nextErrors = validateFields(fields, form);
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) {
      revealForm();
      return;
    }

    setSaving(true);
    try {
      const payload: Record<string, any> = {};
      fields.forEach((field) => {
        payload[field.key] = toPayloadValue(field, form[field.key]);
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
          <button type="button" className="crm-btn crm-btn-primary" onClick={startNew}>
            <Plus size={16} />
            Novo
          </button>
        </>
      )}
    >
      <div ref={formRef} className="crm-card p-4 space-y-4 scroll-mt-4">
        <div className="flex items-center justify-between gap-3">
          <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100">
            {editingId ? `Editando: ${editingLabel}` : "Novo registro"}
          </h3>
          {editingId && (
            <button type="button" className="crm-btn crm-btn-secondary" onClick={resetForm}>
              Cancelar edição
            </button>
          )}
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-3 gap-y-4">
          {basicFields.map((field) => (
            <CRMCrudField
              key={field.key}
              field={field}
              value={form[field.key]}
              error={errors[field.key]}
              lookupOptions={lookups[field.key]}
              onChange={(value) => setField(field.key, value)}
            />
          ))}
        </div>
        {advancedFields.length > 0 && (
          <details className="rounded-xl border border-slate-200 p-3 dark:border-slate-700" open={advancedFields.some((field) => errors[field.key]) || undefined}>
            <summary className="flex min-h-6 cursor-pointer select-none items-center text-sm font-semibold text-slate-700 dark:text-slate-300">
              Avançado (opcional)
            </summary>
            <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-x-3 gap-y-4">
              {advancedFields.map((field) => (
                <CRMCrudField
                  key={field.key}
                  field={field}
                  value={form[field.key]}
                  error={errors[field.key]}
                  onChange={(value) => setField(field.key, value)}
                />
              ))}
            </div>
          </details>
        )}
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
