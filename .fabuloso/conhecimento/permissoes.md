# Permissões por função

Leia antes de mexer em `lib/permissions.ts`, `PermissionsContext`, políticas RLS de escrita, RPCs de cancelamento/edição ou em qualquer botão que dependa de papel.

- A matriz `app_role_permissions` é a fonte da verdade nas duas camadas (tela e banco).
- Banco: `public.has_app_permission(key, action)` (security definer; admin = true; sem linha = false) e `public.app_operational_role()` (gerente = `user_profiles.role` 'seller' + `user_access_roles.app_role` 'manager', mesma regra do `AuthContext`).
- Políticas de escrita/exclusão e as RPCs `cancel_sale` (pdv deletable), `update_sale_full` (pdv editable), `cancel_transaction` (finance deletable) e `delete_debt_cascade` (debtors|finance deletable) usam essa função. Regra: "admin OU matriz" (nada foi retirado de ninguém).
- Tabelas financeiras (`debts`, `debt_payments`, `transactions`, `creditors`, `payable_debts`, `payable_debt_payments`) trocaram a política única `*_admin_all` por quatro (`_select/_insert/_update/_delete`).
- Matriz: quem tem `permissions_privacy` editável altera gerente/vendedor, nunca a linha do admin.
- Front: nunca checar `role === 'admin'` para liberar ação de módulo; use `usePermissions().can(key, action)`. No PDV, "editable" = editar venda passada e "deletable" = cancelar venda.
- `PermissionsContext` carrega a matriz de TODOS os papéis. `DataProvider` usa `resolveFinanceAccess` (`lib/permissions.ts`) para decidir quais tabelas financeiras carregar e espera as permissões; fora do provider (testes) cai no fallback só-admin via `useOptionalPermissions`.
- Criar/editar logins (edge `admin-provision-user` / `admin-manage-user`) continua só admin, de propósito (evita escalar papel).
- Testes de página que usam `usePermissions` precisam mockar `../contexts/PermissionsContext`. Teste PGlite: `supabase/tests/pglite/app_permissions.sql`.
- Migration: `20261023120000_app_permissions_enforced_in_db`.
- Pendência: Debtors, Finance, PayableDebts, Warranties e Clients ainda não escondem botões por editable/deletable (o banco já barra).
