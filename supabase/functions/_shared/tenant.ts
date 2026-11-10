// Multiempresa: o service role enxerga todas as empresas, então toda leitura
// de configuração de linha única precisa dizer de qual empresa é.

export const PRIMARY_TENANT_ID = "00000000-0000-4000-8000-000000000001";

type TenantScopedTable = "stores" | "stock_items" | "sales" | "care_contracts" | "crm_leads";

// Empresa dona de um registro; sem registro, a empresa principal.
export async function tenantOf(
  supabase: any,
  table: TenantScopedTable,
  id: string | null | undefined,
): Promise<string> {
  if (!id) return PRIMARY_TENANT_ID;
  const { data } = await supabase.from(table).select("tenant_id").eq("id", id).maybeSingle();
  return (data?.tenant_id as string | undefined) ?? PRIMARY_TENANT_ID;
}
