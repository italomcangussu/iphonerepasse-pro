create or replace function public.crm_lead_purchase_sync_trigger()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if pg_trigger_depth() > 1 then
    return new;
  end if;

  perform public.crm_refresh_lead_purchase_metrics(new.id);
  return new;
end;
$$;

