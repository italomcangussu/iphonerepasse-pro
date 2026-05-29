begin;

create or replace function public.tg_set_simulator_trade_in_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop policy if exists simulator_trade_in_values_admin_all on public.simulator_trade_in_values;
drop policy if exists simulator_trade_in_values_seller_select on public.simulator_trade_in_values;
drop policy if exists simulator_trade_in_values_select on public.simulator_trade_in_values;
drop policy if exists simulator_trade_in_values_admin_insert on public.simulator_trade_in_values;
drop policy if exists simulator_trade_in_values_admin_update on public.simulator_trade_in_values;
drop policy if exists simulator_trade_in_values_admin_delete on public.simulator_trade_in_values;

create policy simulator_trade_in_values_select on public.simulator_trade_in_values
  for select to authenticated
  using (public.current_role() in ('admin', 'seller'));

create policy simulator_trade_in_values_admin_insert on public.simulator_trade_in_values
  for insert to authenticated
  with check (public.current_role() = 'admin');

create policy simulator_trade_in_values_admin_update on public.simulator_trade_in_values
  for update to authenticated
  using (public.current_role() = 'admin')
  with check (public.current_role() = 'admin');

create policy simulator_trade_in_values_admin_delete on public.simulator_trade_in_values
  for delete to authenticated
  using (public.current_role() = 'admin');

drop policy if exists simulator_trade_in_adjustments_admin_all on public.simulator_trade_in_adjustments;
drop policy if exists simulator_trade_in_adjustments_seller_select on public.simulator_trade_in_adjustments;
drop policy if exists simulator_trade_in_adjustments_select on public.simulator_trade_in_adjustments;
drop policy if exists simulator_trade_in_adjustments_admin_insert on public.simulator_trade_in_adjustments;
drop policy if exists simulator_trade_in_adjustments_admin_update on public.simulator_trade_in_adjustments;
drop policy if exists simulator_trade_in_adjustments_admin_delete on public.simulator_trade_in_adjustments;

create policy simulator_trade_in_adjustments_select on public.simulator_trade_in_adjustments
  for select to authenticated
  using (public.current_role() in ('admin', 'seller'));

create policy simulator_trade_in_adjustments_admin_insert on public.simulator_trade_in_adjustments
  for insert to authenticated
  with check (public.current_role() = 'admin');

create policy simulator_trade_in_adjustments_admin_update on public.simulator_trade_in_adjustments
  for update to authenticated
  using (public.current_role() = 'admin')
  with check (public.current_role() = 'admin');

create policy simulator_trade_in_adjustments_admin_delete on public.simulator_trade_in_adjustments
  for delete to authenticated
  using (public.current_role() = 'admin');

commit;
