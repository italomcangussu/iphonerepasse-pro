begin;

-- A presença de recipient_filters.lead_ids representa uma audiência fechada.
-- Mesmo uma lista inválida/vazia deve inserir zero destinatários, nunca cair
-- nos filtros genéricos e ampliar o broadcast.
create or replace function public.prepare_broadcast_recipients(p_broadcast_id uuid)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_broadcast record;
  v_inserted integer := 0;
  v_has_explicit_lead_ids boolean := false;
  v_explicit_lead_ids text[] := '{}'::text[];
begin
  select * into v_broadcast
  from public.crm_broadcasts b
  where b.id = p_broadcast_id
  limit 1;

  if not found then
    return 0;
  end if;

  v_has_explicit_lead_ids := v_broadcast.recipient_filters ? 'lead_ids';
  if v_has_explicit_lead_ids then
    select coalesce(array_agg(distinct lead_id), '{}'::text[])
      into v_explicit_lead_ids
    from (
      select nullif(btrim(value), '') as lead_id
      from jsonb_array_elements_text(
        case
          when jsonb_typeof(v_broadcast.recipient_filters -> 'lead_ids') = 'array'
            then v_broadcast.recipient_filters -> 'lead_ids'
          else '[]'::jsonb
        end
      ) as value
    ) normalized
    where lead_id is not null;
  end if;

  insert into public.crm_broadcast_recipients (broadcast_id, store_id, lead_id, channel_id, status)
  select
    v_broadcast.id,
    v_broadcast.store_id,
    l.id,
    coalesce(v_broadcast.channel_id, l.source_channel_id),
    'pending'
  from public.crm_leads l
  where l.store_id = v_broadcast.store_id
    and (
      not v_has_explicit_lead_ids
      or l.id = any (v_explicit_lead_ids)
    )
    and (
      (v_broadcast.recipient_filters ->> 'funnel_stage') is null
      or l.funnel_stage = (v_broadcast.recipient_filters ->> 'funnel_stage')
    )
    and (
      (v_broadcast.recipient_filters ? 'is_customer') = false
      or l.is_customer = ((v_broadcast.recipient_filters ->> 'is_customer')::boolean)
    )
  on conflict (broadcast_id, lead_id) do nothing;

  get diagnostics v_inserted = row_count;
  return v_inserted;
end;
$$;

notify pgrst, 'reload schema';

commit;
