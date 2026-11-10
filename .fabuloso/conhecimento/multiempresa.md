# Multiempresa (tenants)

Leia antes de mexer em `tenant_id`, políticas RLS, `AuthContext`/`TenantSwitcher`, `pages/Companies.tsx`, `components/companies/`, `services/tenants.ts`, edge functions que resolvem a empresa ou UNIQUEs de tabelas de negócio.

- Na UI, "Empresa" = tenant; "Loja" continua sendo `stores` (HDI, HDS, GR Imports). A empresa principal tem id fixo `00000000-0000-4000-8000-000000000001`: todos os dados antigos foram para ela.
- Migration: `20261110120000_multitenancy`. Teste PGlite: `supabase/tests/pglite/multitenancy.sql`.
- Isolamento: tabelas de negócio têm `tenant_id`, preenchido pelo gatilho `zz_tenant_fill` (a partir de `user_profiles.active_tenant_id`), protegido por `zz_tenant_guard` (não muda o tenant fora das RPCs de transferência) e isolado pela política RESTRICTIVE `tenant_isolation`.
- Membros em `tenant_members` (papel por empresa). Empresa ativa em `user_profiles.active_tenant_id`, trocada só por `set_active_tenant`.
- RPCs: `my_tenant_context`, `set_active_tenant`, `create_tenant`, `rename_tenant`, `tenant_members_list`, `tenant_add_member`, `tenant_remove_member` (não remove o último admin), `tenant_transfer_catalog`, `tenant_transferable_stock`, `transfer_store_to_tenant` (loja com aparelho reservado não sai), `transfer_stock_items(p_item_ids, p_target_store_id, p_sale jsonb default null)` (só disponíveis e sem reserva; sem `p_sale` leva os custos junto).
- UNIQUEs que eram globais agora são por tenant: `customers.cpf`, `parts_inventory.name`, `sellers.email`/`auth_user_id`, `care_model_rules`, PK de `app_role_permissions`, PK de `care_condition_rules`. `PermissionsContext` faz upsert com `onConflict: 'tenant_id,role,permission_key'`.
- Edge functions resolvem a empresa via `_shared/tenant.ts`; `admin-provision-user` cria o usuário na empresa ativa de quem chama.
- Front: `services/tenants.ts` é o único acesso às RPCs; `AuthContext` expõe `tenant`, `switchTenant`, `refreshProfile`; `TenantSwitcher` fica no header do `Layout` (some com uma empresa só); tela `/settings/companies` (admin) em `pages/Companies.tsx` + `components/companies/`.
- Realtime não entrega linhas que saíram do tenant: depois de transferir, a tela mostra Banner "Recarregar".
- Gotcha JSX deste projeto: componente que recebe `key` precisa ser `React.FC<Props>`.
- Pendências conhecidas: o n8n Bia e o agente financeiro (service role) ainda enxergam todas as empresas; funções SECURITY DEFINER que recebem ids de itens dependem do id para não tocar outra empresa; teste PGlite `transactions_payee.sql` já falhava antes; teste funcional em navegador não foi feito.

## Venda de aparelhos entre empresas
- Migration `20261110150000_tenant_stock_sale`. Teste PGlite: `supabase/tests/pglite/tenant_stock_sale.sql`.
- `p_sale` = `{"account": "Conta Bancária"|"Cofre", "prices": {"<id>": valor}}`. Só vale se todos os aparelhos mudam de empresa (senão erro "A venda só vale para aparelhos que mudam de empresa"). Valores >= 0, arredondados a 2 casas (`private.stock_sale_prices` valida).
- Com venda (`private.book_stock_sale`, por grupo de origem): transactions IN categoria `Venda entre empresas` na empresa de origem e OUT `Compra entre empresas` na de destino, mesma conta e total. `stock_items.purchase_price` passa a ser o valor da venda. Os custos (`costs`) FICAM na empresa de origem. `tenant_transfers.summary` guarda `{"sale": {account,total,prices,inTransactionId,outTransactionId}}`; o retorno inclui `saleTotal` (null sem venda).
- Sem `p_sale`: comportamento antigo (aparelho e custos mudam de empresa, sem lançamento). Transferência de loja inteira não mudou.
- `tenant_transferable_stock` devolve também `cost` = `purchase_price` + soma de `costs` (a UI começa o valor da venda no custo).
- Front: `services/tenants.ts` (`StockSale`, `SaleAccount`, `StockTransferResult`, `transferStockItems` com 3º parâmetro opcional), `lib/stockSale.ts` (regras puras; valores em centavos), `components/companies/useStockSale.ts` (estado), `SaleOptions.tsx` ("Só mudar de empresa" x "Vender para a X"), integrado em `StockTransferPanel.tsx`.
- Armadilha nos testes PGlite: o snapshot `base.sql` só tem schema, a empresa principal (`00000000-0000-4000-8000-000000000001`) não existe. Todo teste que insere dados começa com `insert into public.tenants (id, name, is_primary) values (private.primary_tenant_id(), 'iPhone Repasse', true) on conflict do nothing;`.

## Liberar funcionários da principal em outras empresas
- Migration `20261110170000_tenant_shared_members`. Teste PGlite: `supabase/tests/pglite/tenant_shared_members.sql` (36 asserts).
- Coluna `tenant_members.follows_primary`: true = membro liberado a partir da principal; o papel dele acompanha o papel na principal.
- Quem libera: só admin da principal E da empresa destino (`private.assert_can_share_members`); não se libera na própria principal.
- RPCs: `tenant_shareable_members(tenant)` lista membros da principal com `access` 'shared'|'member'|null; `tenant_share_members(tenant, uuid[])` espelha via `private.mirror_primary_membership` (papel que não é admin ganha vendedor na empresa via `ensure_tenant_seller`). `tenant_members_list` devolve `follows_primary`.
- Gatilho `propagate_primary_membership` em `tenant_members` (after update of role or delete): mudou o papel na principal, atualiza todas as empresas com `follows_primary`; saiu da principal, sai das liberadas (exceto onde é o último admin) e limpa `user_profiles.active_tenant_id` se apontava para empresa que a pessoa não tem mais.
- Adicionar à mão por `tenant_add_member` desliga `follows_primary` (o papel deixa de seguir a principal). "Tirar" um liberado usa a remoção normal de membro.
- Front: seção "Funcionários da iPhone Repasse" em `components/companies/SharedMembersSection.tsx` (hook `useShareableMembers`), dentro do `CompanyMembersModal`; só aparece para quem pode criar empresas e em empresa não principal. `MemberRow` mostra "segue a iPhone Repasse".
- Armadilha nos testes PGlite: linhas de `sellers` de outra empresa são invisíveis por RLS ao usuário cuja empresa ativa é a principal; conferir como `fab.dono()`.
- Entrega: migration aplicada com `npx supabase db push --linked` (o `.env.local` não tem URL direta do banco; o MCP `apply_migration` não tem permissão).
