import React from "react";

export type CrudOption = { value: string; label: string };

/** Lista buscada no banco para o seletor (canal, etapa do funil), em vez de pedir o ID digitado. */
export type CrudLookup = {
  table: string;
  valueKey: string;
  labelKey: string;
  storeScoped?: boolean;
  /** Rótulo da opção vazia (ex.: "Todos os canais"). */
  emptyLabel: string;
};

export type FieldType = "text" | "textarea" | "number" | "boolean" | "json" | "select" | "lookup" | "datetime";

export type CrudField = {
  key: string;
  label: string;
  type?: FieldType;
  required?: boolean;
  /** Ajuda curta abaixo do campo: o que é e o formato esperado. */
  hint?: string;
  placeholder?: string;
  options?: CrudOption[];
  lookup?: CrudLookup;
};

type CRMCrudFieldProps = {
  field: CrudField;
  value: unknown;
  error?: string;
  lookupOptions?: CrudOption[];
  onChange: (value: unknown) => void;
};

/** Mantém na lista um valor já gravado que não está entre as opções conhecidas, para editar sem perder o dado. */
const withCurrentValue = (options: CrudOption[], current: string): CrudOption[] =>
  current && !options.some((option) => option.value === current) ? [...options, { value: current, label: current }] : options;

/** ISO (UTC) → valor de `datetime-local` no fuso do aparelho. */
export const isoToLocalInput = (iso: unknown): string => {
  if (typeof iso !== "string" || !iso) return "";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 16);
};

export const localInputToIso = (local: unknown): string | null => {
  if (typeof local !== "string" || !local) return null;
  const date = new Date(local);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
};

const CRMCrudField: React.FC<CRMCrudFieldProps> = ({ field, value, error, lookupOptions, onChange }) => {
  const inputId = `crm-crud-${field.key}`;
  const describedBy = error ? `${inputId}-error` : field.hint ? `${inputId}-hint` : undefined;
  const text = String(value ?? "");
  const common = { id: inputId, "aria-invalid": Boolean(error) || undefined, "aria-describedby": describedBy };

  if (field.type === "boolean") {
    return (
      <div className="flex min-h-11 items-start gap-3 md:col-span-1">
        <input
          {...common}
          type="checkbox"
          className="mt-1 h-5 w-5 shrink-0 rounded border-slate-400 text-brand-600 focus:ring-brand-500"
          checked={Boolean(value)}
          onChange={(event) => onChange(event.target.checked)}
        />
        <label htmlFor={inputId} className="min-w-0 cursor-pointer">
          <span className="block text-sm font-semibold text-slate-900 dark:text-slate-100">{field.label}</span>
          {field.hint && (
            <span id={`${inputId}-hint`} className="block text-xs text-slate-600 dark:text-slate-400">
              {field.hint}
            </span>
          )}
        </label>
      </div>
    );
  }

  const control = (() => {
    if (field.type === "textarea" || field.type === "json") {
      return (
        <textarea
          {...common}
          className={`crm-input min-h-[92px] ${field.type === "json" ? "font-mono text-sm" : ""}`}
          placeholder={field.placeholder}
          value={text}
          onChange={(event) => onChange(event.target.value)}
        />
      );
    }
    if (field.type === "select" || field.type === "lookup") {
      const base = field.type === "lookup" ? lookupOptions ?? [] : field.options ?? [];
      return (
        <select {...common} className="crm-input" value={text} onChange={(event) => onChange(event.target.value)}>
          {field.type === "lookup" && <option value="">{field.lookup?.emptyLabel}</option>}
          {withCurrentValue(base, text).map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      );
    }
    if (field.type === "datetime") {
      return (
        <input
          {...common}
          type="datetime-local"
          className="crm-input"
          value={isoToLocalInput(value)}
          onChange={(event) => onChange(localInputToIso(event.target.value) ?? "")}
        />
      );
    }
    return (
      <input
        {...common}
        type={field.type === "number" ? "number" : "text"}
        inputMode={field.type === "number" ? "numeric" : undefined}
        className="crm-input"
        placeholder={field.placeholder}
        value={text}
        onChange={(event) => onChange(event.target.value)}
      />
    );
  })();

  return (
    <div className="space-y-1">
      <label htmlFor={inputId} className="crm-field-label block">
        {field.label}
        {field.required ? " (obrigatório)" : ""}
      </label>
      {control}
      {error ? (
        <p id={`${inputId}-error`} role="alert" className="text-xs font-medium text-red-600 dark:text-red-400">
          {error}
        </p>
      ) : (
        field.hint && (
          <p id={`${inputId}-hint`} className="text-xs text-slate-600 dark:text-slate-400">
            {field.hint}
          </p>
        )
      )}
    </div>
  );
};

export default CRMCrudField;
