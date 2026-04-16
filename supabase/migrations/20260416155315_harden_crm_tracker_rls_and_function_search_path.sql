-- Security hardening:
-- 1) enable RLS on crm_follow_up_tracker with the same store scope as crm_leads
-- 2) pin mutable functions to search_path = public

alter table if exists public.crm_follow_up_tracker enable row level security;

drop policy if exists crm_follow_up_tracker_store_scope on public.crm_follow_up_tracker;
create policy crm_follow_up_tracker_store_scope on public.crm_follow_up_tracker
  for all to authenticated
  using (
    exists (
      select 1
      from public.crm_leads cl
      where cl.id = crm_follow_up_tracker.lead_id
        and public.crm_can_access_store(cl.store_id)
    )
  )
  with check (
    exists (
      select 1
      from public.crm_leads cl
      where cl.id = crm_follow_up_tracker.lead_id
        and public.crm_can_access_store(cl.store_id)
    )
  );

do $$
declare
  fn_name text;
  fn regprocedure;
begin
  foreach fn_name in array array[
    'public.app_set_updated_at()',
    'public.compare_phones(text,text)',
    'public.crm_after_message_insert()',
    'public.crm_identity_fallback_phone(text,text)',
    'public.crm_jsonb_to_text_array(jsonb)',
    'public.crm_set_updated_at()',
    'public.crm_sync_lead_store_to_related_tables()',
    'public.crm_ui_preferences_set_updated_at()',
    'public.customer_ids_by_normalized_cpf(text)',
    'public.generate_composite_lead_id()',
    'public.increment_unread_count(uuid,timestamptz)',
    'public.is_valid_card_fee_rates(jsonb)',
    'public.normalize_phone(text)',
    'public.tg_set_card_fee_settings_updated_at()',
    'public.tg_set_device_catalog_updated_at()',
    'public.tg_set_parts_inventory_updated_at()',
    'public.trigger_new_lead_avatar()'
  ]
  loop
    fn := to_regprocedure(fn_name);
    if fn is not null then
      execute format('alter function %s set search_path = public', fn);
    end if;
  end loop;
end;
$$;
