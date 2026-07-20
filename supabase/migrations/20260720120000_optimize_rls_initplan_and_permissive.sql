-- Optimize Row Level Security for initial-load performance.
--
-- Two Supabase performance-advisor issues were slowing every authenticated read
-- on app open:
--
--   1. auth_rls_initplan — policies called auth.uid()/auth.role() (and the custom
--      STABLE helper public.current_role(), which itself runs a user_profiles
--      subquery) directly, so Postgres re-evaluated them ONCE PER ROW. Wrapping
--      each call in a scalar subquery — (select auth.uid()) — turns it into an
--      InitPlan that is evaluated a single time per statement. This is the main
--      win on the heavy join reads (sales -> sale_items -> stock_items -> costs
--      -> customers) that run during bootstrap and lazy loads.
--
--   2. multiple_permissive_policies — hot ERP tables carried an "*_admin_all"
--      policy overlapping a per-seller policy, so every SELECT executed TWO
--      permissive policies. They are collapsed here into one non-overlapping
--      policy per command.
--
-- The access matrix is preserved exactly:
--   * admin  -> full access (select/insert/update/delete)
--   * seller -> select/insert/update on operational tables (no delete)
--   * seller -> read-only where it already was; no write access is added.
--
-- Semantics are identical because public.current_role()/auth.* are STABLE within
-- a statement: evaluating them once vs. per row yields the same boolean.

-- Helper: drop every existing policy on a table so we can recreate the canonical
-- (wrapped, non-overlapping) set without depending on legacy policy names.
create or replace function private.__drop_all_policies(p_table text)
returns void
language plpgsql
as $fn$
declare
  r record;
begin
  for r in
    select policyname from pg_policies
    where schemaname = 'public' and tablename = p_table
  loop
    execute format('drop policy %I on public.%I', r.policyname, p_table);
  end loop;
end;
$fn$;

-- ---------------------------------------------------------------------------
-- Group 1 — operational tables: admin = full; seller = select/insert/update.
-- ---------------------------------------------------------------------------
do $$
declare t text;
begin
  foreach t in array array[
    'sales','sale_items','stock_items','customers','costs',
    'cost_history','parts_inventory','payment_methods','sale_trade_in_items'
  ] loop
    perform private.__drop_all_policies(t);

    execute format($f$create policy %I on public.%I for select to authenticated
      using ((select public.current_role()) = any (array['admin','seller']))$f$,
      t || '_select', t);
    execute format($f$create policy %I on public.%I for insert to authenticated
      with check ((select public.current_role()) = any (array['admin','seller']))$f$,
      t || '_insert', t);
    execute format($f$create policy %I on public.%I for update to authenticated
      using ((select public.current_role()) = any (array['admin','seller']))
      with check ((select public.current_role()) = any (array['admin','seller']))$f$,
      t || '_update', t);
    execute format($f$create policy %I on public.%I for delete to authenticated
      using ((select public.current_role()) = 'admin')$f$,
      t || '_delete', t);
  end loop;
end $$;

-- ---------------------------------------------------------------------------
-- Group 2 — device_catalog: admin = full; seller = select/insert only.
-- ---------------------------------------------------------------------------
do $$
begin
  perform private.__drop_all_policies('device_catalog');
end $$;

create policy device_catalog_select on public.device_catalog for select to authenticated
  using ((select public.current_role()) = any (array['admin','seller']));
create policy device_catalog_insert on public.device_catalog for insert to authenticated
  with check ((select public.current_role()) = any (array['admin','seller']));
create policy device_catalog_update on public.device_catalog for update to authenticated
  using ((select public.current_role()) = 'admin')
  with check ((select public.current_role()) = 'admin');
create policy device_catalog_delete on public.device_catalog for delete to authenticated
  using ((select public.current_role()) = 'admin');

-- ---------------------------------------------------------------------------
-- Group 3 — read-mostly (admin+seller can read; only admin writes).
-- ---------------------------------------------------------------------------
do $$
declare t text;
begin
  foreach t in array array[
    'business_profile','card_fee_settings','sellers','stores','warranty_public_tokens'
  ] loop
    perform private.__drop_all_policies(t);

    execute format($f$create policy %I on public.%I for select to authenticated
      using ((select public.current_role()) = any (array['admin','seller']))$f$,
      t || '_select', t);
    execute format($f$create policy %I on public.%I for insert to authenticated
      with check ((select public.current_role()) = 'admin')$f$, t || '_insert', t);
    execute format($f$create policy %I on public.%I for update to authenticated
      using ((select public.current_role()) = 'admin')
      with check ((select public.current_role()) = 'admin')$f$, t || '_update', t);
    execute format($f$create policy %I on public.%I for delete to authenticated
      using ((select public.current_role()) = 'admin')$f$, t || '_delete', t);
  end loop;
end $$;

-- ---------------------------------------------------------------------------
-- Group 4 — reference tables readable by any authenticated user; only admin writes.
-- ---------------------------------------------------------------------------
do $$
declare t text;
begin
  foreach t in array array[
    'finance_categories','crm_funnel_stages','crm_settings','app_role_permissions'
  ] loop
    perform private.__drop_all_policies(t);

    execute format($f$create policy %I on public.%I for select to authenticated
      using (true)$f$, t || '_select', t);
    execute format($f$create policy %I on public.%I for insert to authenticated
      with check ((select public.current_role()) = 'admin')$f$, t || '_insert', t);
    execute format($f$create policy %I on public.%I for update to authenticated
      using ((select public.current_role()) = 'admin')
      with check ((select public.current_role()) = 'admin')$f$, t || '_update', t);
    execute format($f$create policy %I on public.%I for delete to authenticated
      using ((select public.current_role()) = 'admin')$f$, t || '_delete', t);
  end loop;
end $$;

-- ---------------------------------------------------------------------------
-- Group 5 — auth.uid()/auth.role() based policies: wrap in (select ...) to fix
-- the initplan warnings. Structure/logic preserved (SELECT overlaps merged where
-- they existed).
-- ---------------------------------------------------------------------------

-- crm_ui_preferences: owner access (public role) + store-scoped access.
do $$ begin perform private.__drop_all_policies('crm_ui_preferences'); end $$;
create policy crm_ui_preferences_owner_access on public.crm_ui_preferences
  as permissive for all to public
  using ((select auth.role()) = 'authenticated' and user_id = (select auth.uid()))
  with check ((select auth.role()) = 'authenticated' and user_id = (select auth.uid()));
create policy crm_ui_preferences_store_scope on public.crm_ui_preferences
  as permissive for all to authenticated
  using (public.crm_can_access_store(store_id) and user_id = (select auth.uid()))
  with check (public.crm_can_access_store(store_id) and user_id = (select auth.uid()));

-- app_user_activity_logs: self-insert; admin OR self can read (merged select).
do $$ begin perform private.__drop_all_policies('app_user_activity_logs'); end $$;
create policy app_user_activity_logs_self_insert on public.app_user_activity_logs
  for insert to authenticated
  with check ((select auth.uid()) = user_id);
create policy app_user_activity_logs_select on public.app_user_activity_logs
  for select to authenticated
  using ((select public.current_role()) = 'admin' or (select auth.uid()) = user_id);

-- user_access_roles: admin full; a user may read their own rows (merged select).
do $$ begin perform private.__drop_all_policies('user_access_roles'); end $$;
create policy user_access_roles_select on public.user_access_roles
  for select to authenticated
  using ((select public.current_role()) = 'admin' or (select auth.uid()) = user_id);
create policy user_access_roles_admin_insert on public.user_access_roles
  for insert to authenticated
  with check ((select public.current_role()) = 'admin');
create policy user_access_roles_admin_update on public.user_access_roles
  for update to authenticated
  using ((select public.current_role()) = 'admin')
  with check ((select public.current_role()) = 'admin');
create policy user_access_roles_admin_delete on public.user_access_roles
  for delete to authenticated
  using ((select public.current_role()) = 'admin');

-- crm_filter_views: own rows (shared views also visible on read).
do $$ begin perform private.__drop_all_policies('crm_filter_views'); end $$;
create policy crm_filter_views_select on public.crm_filter_views
  for select to authenticated
  using ((select auth.uid()) = user_id or is_shared = true);
create policy crm_filter_views_insert on public.crm_filter_views
  for insert to authenticated
  with check ((select auth.uid()) = user_id);
create policy crm_filter_views_update on public.crm_filter_views
  for update to authenticated
  using ((select auth.uid()) = user_id);
create policy crm_filter_views_delete on public.crm_filter_views
  for delete to authenticated
  using ((select auth.uid()) = user_id);

-- push_subscriptions: users manage their own subscriptions.
do $$ begin perform private.__drop_all_policies('push_subscriptions'); end $$;
create policy "users manage own push subscriptions" on public.push_subscriptions
  as permissive for all to public
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

-- user_consents: users manage their own consents.
do $$ begin perform private.__drop_all_policies('user_consents'); end $$;
create policy user_consents_select_own on public.user_consents
  for select to authenticated
  using ((select auth.uid()) = user_id);
create policy user_consents_insert_own on public.user_consents
  for insert to authenticated
  with check ((select auth.uid()) = user_id);
create policy user_consents_update_own on public.user_consents
  for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

-- account_deletion_requests: users manage their own request.
do $$ begin perform private.__drop_all_policies('account_deletion_requests'); end $$;
create policy deletion_requests_own on public.account_deletion_requests
  as permissive for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

-- user_profiles: admin full; a user may read their own profile (merged select).
-- Read on every auth bootstrap, and public.current_role() resolves against it,
-- so wrapping the role check here matters for login latency. Key column is `id`.
do $$ begin perform private.__drop_all_policies('user_profiles'); end $$;
create policy user_profiles_select on public.user_profiles
  for select to authenticated
  using ((select public.current_role()) = 'admin' or (select auth.uid()) = id);
create policy user_profiles_admin_insert on public.user_profiles
  for insert to authenticated
  with check ((select public.current_role()) = 'admin');
create policy user_profiles_admin_update on public.user_profiles
  for update to authenticated
  using ((select public.current_role()) = 'admin')
  with check ((select public.current_role()) = 'admin');
create policy user_profiles_admin_delete on public.user_profiles
  for delete to authenticated
  using ((select public.current_role()) = 'admin');

drop function private.__drop_all_policies(text);
