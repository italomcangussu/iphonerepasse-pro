# Multiempresa (tenants)

Leia antes de mexer em `tenant_id`, políticas RLS, `AuthContext`/`TenantSwitcher`, `pages/Companies.tsx`, `components/companies/`, `services/tenants.ts`, edge functions que resolvem a empresa ou UNIQUEs de tabelas de negócio.

- Na UI, "Empresa" = tenant; "Loja" continua sendo `stores` (HDI, HDS, GR Imports). A empresa principal tem id fixo `00000000-0000-4000-8000-000000000001`: todos os dados antigos foram para ela.
- Migration: `20261110120000_multitenancy`. Teste PGlite: `supabase/tests/pglite/multitenancy.sql`.
- Isolamento: tabelas de negócio têm `tenant_id`, preenchido pelo gatilho `zz_tenant_fill` (a partir de `user_profiles.active_tenant_id`), protegido por `zz_tenant_guard` (não muda o tenant fora das RPCs de transferência) e isolado pela política RESTRICTIVE `tenant_isolation`.
- Membros em `tenant_members` (papel por empresa). Empresa ativa em `user_profiles.active_tenant_id`, trocada só por `set_active_tenant`.
- RPCs: `my_tenant_context`, `set_active_tenant`, `create_tenant`, `rename_tenant`, `tenant_members_list`, `tenant_add_member`, `tenant_remove_member` (não remove o último admin), `tenant_transfer_catalog`, `tenant_transferable_stock`, `transfer_store_to_tenant` (loja com aparelho reservado não sai), `transfer_stock_items` (só disponíveis e sem reserva; leva os custos junto).
- UNIQUEs que eram globais agora são por tenant: `customers.cpf`, `parts_inventory.name`, `sellers.email`/`auth_user_id`, `care_model_rules`, PK de `app_role_permissions`, PK de `care_condition_rules`. `PermissionsContext` faz upsert com `onConflict: 'tenant_id,role,permission_key'`.
- Edge functions resolvem a empresa via `_shared/tenant.ts`; `admin-provision-user` cria o usuário na empresa ativa de quem chama.
- Front: `services/tenants.ts` é o único acesso às RPCs; `AuthContext` expõe `tenant`, `switchTenant`, `refreshProfile`; `TenantSwitcher` fica no header do `Layout` (some com uma empresa só); tela `/settings/companies` (admin) em `pages/Companies.tsx` + `components/companies/`.
- Realtime não entrega linhas que saíram do tenant: depois de transferir, a tela mostra Banner "Recarregar".
- Gotcha JSX deste projeto: componente que recebe `key` precisa ser `React.FC<Props>`.
- Pendências conhecidas: o n8n Bia e o agente financeiro (service role) ainda enxergam todas as empresas; funções SECURITY DEFINER que recebem ids de itens dependem do id para não tocar outra empresa; teste PGlite `transactions_payee.sql` já falhava antes; teste funcional em navegador não foi feito.
