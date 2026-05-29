begin;

alter table public.crm_leads
  add column if not exists summary_operational text,
  add column if not exists summary_short text,
  add column if not exists last_message_content text,
  add column if not exists first_name text,
  add column if not exists sales_stage text not null default 'entrada',
  add column if not exists last_event_name text,
  add column if not exists last_event_at timestamptz;

alter table public.crm_leads drop constraint if exists chk_crm_leads_sales_stage;
alter table public.crm_leads add constraint chk_crm_leads_sales_stage check (
  sales_stage in (
    'entrada',
    'triagem',
    'qualificado',
    'cotacao',
    'negociacao',
    'interesse_confirmado',
    'reserva_pendente',
    'reservado',
    'pagamento_pendente',
    'aguardando_retirada',
    'ganho',
    'perdido'
  )
);

create index if not exists idx_crm_leads_store_sales_stage
  on public.crm_leads (store_id, sales_stage);

create index if not exists idx_crm_leads_last_event_at
  on public.crm_leads (last_event_at desc nulls last);

create index if not exists idx_crm_event_log_lead_created
  on public.crm_event_log (lead_id, created_at desc)
  where lead_id is not null;

create index if not exists idx_crm_messages_lead_outbound_created
  on public.crm_messages (lead_id, created_at desc)
  where direction = 'outbound' and sender_type in ('human', 'ai', 'ai_inbound');

create or replace function public.crm_default_sales_stage(p_funnel_stage text)
returns text
language sql
immutable
set search_path = public
as $$
  select case nullif(btrim(coalesce(p_funnel_stage, '')), '')
    when 'entrada' then 'entrada'
    when 'triagem' then 'triagem'
    when 'qualificado' then 'qualificado'
    when 'cotacao' then 'cotacao'
    when 'negociacao' then 'negociacao'
    when 'interesse_confirmado' then 'interesse_confirmado'
    when 'reserva_pendente' then 'reserva_pendente'
    when 'reservado' then 'reservado'
    when 'pagamento_pendente' then 'pagamento_pendente'
    when 'aguardando_retirada' then 'aguardando_retirada'
    when 'ganho' then 'ganho'
    when 'perdido' then 'perdido'
    when 'new_lead' then 'entrada'
    when 'qualified' then 'qualificado'
    when 'quote' then 'cotacao'
    when 'negotiation' then 'negociacao'
    when 'won' then 'ganho'
    when 'lost' then 'perdido'
    else 'entrada'
  end;
$$;

create or replace function public.crm_lead_first_name(p_name text)
returns text
language sql
immutable
set search_path = public
as $$
  select nullif(split_part(regexp_replace(btrim(coalesce(p_name, '')), '\s+', ' ', 'g'), ' ', 1), '');
$$;

create or replace function public.crm_build_lead_summary_short(
  p_name text,
  p_phone text,
  p_sales_stage text,
  p_intent text
)
returns text
language sql
stable
set search_path = public
as $$
  select nullif(concat_ws(
    ' | ',
    nullif(btrim(coalesce(p_name, '')), ''),
    nullif(btrim(coalesce(p_phone, '')), ''),
    'etapa: ' || coalesce(nullif(btrim(coalesce(p_sales_stage, '')), ''), 'entrada'),
    case when nullif(btrim(coalesce(p_intent, '')), '') is not null then 'intencao: ' || btrim(p_intent) end
  ), '');
$$;

create or replace function public.crm_build_lead_summary_operational(
  p_name text,
  p_phone text,
  p_sales_stage text,
  p_intent text,
  p_conversation_status text,
  p_last_message_content text,
  p_last_event_name text,
  p_last_event_at timestamptz,
  p_last_order_summary text,
  p_last_interaction_at timestamptz
)
returns text
language sql
stable
set search_path = public
as $$
  select nullif(concat_ws(
    ' | ',
    'lead: ' || coalesce(nullif(btrim(coalesce(p_name, '')), ''), nullif(btrim(coalesce(p_phone, '')), ''), 'sem identificacao'),
    'etapa: ' || coalesce(nullif(btrim(coalesce(p_sales_stage, '')), ''), 'entrada'),
    case when nullif(btrim(coalesce(p_intent, '')), '') is not null then 'intencao: ' || btrim(p_intent) end,
    case when nullif(btrim(coalesce(p_conversation_status, '')), '') is not null then 'status: ' || btrim(p_conversation_status) end,
    case when nullif(btrim(coalesce(p_last_message_content, '')), '') is not null then 'ultima mensagem enviada: ' || left(btrim(p_last_message_content), 240) end,
    case when nullif(btrim(coalesce(p_last_event_name, '')), '') is not null then 'ultimo evento: ' || btrim(p_last_event_name) end,
    case when p_last_event_at is not null then 'ultimo evento em: ' || to_char(p_last_event_at, 'YYYY-MM-DD"T"HH24:MI:SSOF') end,
    case when nullif(btrim(coalesce(p_last_order_summary, '')), '') is not null then 'ultima compra: ' || left(btrim(p_last_order_summary), 180) end,
    case when p_last_interaction_at is not null then 'ultima interacao em: ' || to_char(p_last_interaction_at, 'YYYY-MM-DD"T"HH24:MI:SSOF') end
  ), '');
$$;

create or replace function public.crm_leads_sync_enriched_columns()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  new.first_name := public.crm_lead_first_name(new.name);
  new.sales_stage := coalesce(nullif(btrim(new.sales_stage), ''), public.crm_default_sales_stage(new.funnel_stage), 'entrada');
  return new;
end;
$$;

drop trigger if exists trg_crm_leads_sync_enriched_columns on public.crm_leads;
create trigger trg_crm_leads_sync_enriched_columns
before insert or update of name, sales_stage, funnel_stage on public.crm_leads
for each row execute function public.crm_leads_sync_enriched_columns();

create or replace function public.crm_messages_sync_lead_last_message_content()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.lead_id is not null
     and new.direction = 'outbound'
     and new.sender_type in ('human', 'ai', 'ai_inbound') then
    update public.crm_leads l
    set
      last_message_content = nullif(btrim(new.content), ''),
      last_message_at = coalesce(new.created_at, l.last_message_at, now()),
      last_interaction_at = greatest(coalesce(l.last_interaction_at, '-infinity'::timestamptz), coalesce(new.created_at, now())),
      updated_at = now()
    where l.id = new.lead_id;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_crm_messages_sync_lead_last_message_content on public.crm_messages;
create trigger trg_crm_messages_sync_lead_last_message_content
after insert on public.crm_messages
for each row execute function public.crm_messages_sync_lead_last_message_content();

create or replace function public.crm_event_log_sync_lead_last_event()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.lead_id is not null then
    update public.crm_leads l
    set
      last_event_name = new.event_type,
      last_event_at = coalesce(new.created_at, now()),
      updated_at = now()
    where l.id = new.lead_id;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_crm_event_log_sync_lead_last_event on public.crm_event_log;
create trigger trg_crm_event_log_sync_lead_last_event
after insert on public.crm_event_log
for each row execute function public.crm_event_log_sync_lead_last_event();

update public.crm_leads l
set
  first_name = public.crm_lead_first_name(l.name),
  sales_stage = public.crm_default_sales_stage(l.funnel_stage)
where l.first_name is distinct from public.crm_lead_first_name(l.name)
   or l.sales_stage is null
   or l.sales_stage = 'entrada';

update public.crm_leads l
set last_message_content = (
  select nullif(btrim(m.content), '')
  from public.crm_messages m
  where m.lead_id = l.id
    and m.direction = 'outbound'
    and m.sender_type in ('human', 'ai', 'ai_inbound')
    and nullif(btrim(coalesce(m.content, '')), '') is not null
  order by m.created_at desc
  limit 1
)
where exists (
  select 1
  from public.crm_messages m
  where m.lead_id = l.id
    and m.direction = 'outbound'
    and m.sender_type in ('human', 'ai', 'ai_inbound')
    and nullif(btrim(coalesce(m.content, '')), '') is not null
);

update public.crm_leads l
set
  last_event_name = (
    select e.event_type
    from public.crm_event_log e
    where e.lead_id = l.id
    order by e.created_at desc
    limit 1
  ),
  last_event_at = (
    select e.created_at
    from public.crm_event_log e
    where e.lead_id = l.id
    order by e.created_at desc
    limit 1
  )
where exists (
  select 1
  from public.crm_event_log e
  where e.lead_id = l.id
);

update public.crm_leads l
set
  summary_short = coalesce(
    nullif(btrim(l.summary_short), ''),
    public.crm_build_lead_summary_short(l.name, l.phone, l.sales_stage, l.intent)
  ),
  summary_operational = coalesce(
    nullif(btrim(l.summary_operational), ''),
    public.crm_build_lead_summary_operational(
      l.name,
      l.phone,
      l.sales_stage,
      l.intent,
      l.conversation_status,
      l.last_message_content,
      l.last_event_name,
      l.last_event_at,
      l.last_order_summary,
      l.last_interaction_at
    )
  );

create or replace function public.search_leads(
  p_store_id text,
  p_filters jsonb default '{}'::jsonb,
  p_limit integer default 50,
  p_offset integer default 0
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_limit integer := greatest(1, least(coalesce(p_limit, 50), 200));
  v_offset integer := greatest(coalesce(p_offset, 0), 0);
  v_search text := nullif(btrim(coalesce(p_filters ->> 'search', '')), '');
  v_funnel_stage text := nullif(btrim(coalesce(p_filters ->> 'funnel_stage', '')), '');
  v_sales_stage text := nullif(btrim(coalesce(p_filters ->> 'sales_stage', '')), '');
  v_source_channel_id text := nullif(btrim(coalesce(p_filters ->> 'source_channel_id', '')), '');
  v_is_customer boolean;
  v_total bigint := 0;
  v_items jsonb := '[]'::jsonb;
begin
  if p_store_id is null or btrim(p_store_id) = '' then
    return jsonb_build_object('success', false, 'error', 'store_id is required');
  end if;

  if p_filters ? 'is_customer' then
    if lower(coalesce(p_filters ->> 'is_customer', '')) in ('true', 'false') then
      v_is_customer := (p_filters ->> 'is_customer')::boolean;
    end if;
  end if;

  select count(*)
  into v_total
  from public.crm_leads l
  where l.store_id = p_store_id
    and (v_funnel_stage is null or l.funnel_stage = v_funnel_stage)
    and (v_sales_stage is null or l.sales_stage = v_sales_stage)
    and (v_source_channel_id is null or l.source_channel_id::text = v_source_channel_id)
    and (v_is_customer is null or l.is_customer = v_is_customer)
    and (
      v_search is null
      or l.name ilike '%' || v_search || '%'
      or l.first_name ilike '%' || v_search || '%'
      or l.phone ilike '%' || v_search || '%'
      or l.phone_normalized ilike '%' || regexp_replace(v_search, '[^0-9]', '', 'g') || '%'
    );

  select coalesce(jsonb_agg(to_jsonb(paged) order by paged.last_interaction_at desc nulls last), '[]'::jsonb)
  into v_items
  from (
    select
      l.id,
      l.store_id,
      l.name,
      l.first_name,
      l.phone,
      l.phone_normalized,
      l.email,
      l.source_channel_id,
      l.funnel_id,
      l.funnel_stage,
      l.sales_stage,
      l.intent,
      l.tags,
      l.is_customer,
      l.customer_id,
      l.summary_operational,
      l.summary_short,
      l.last_message_content,
      l.last_event_name,
      l.last_event_at,
      l.purchase_count,
      l.last_purchase_at,
      l.last_order_id,
      l.last_order_at,
      l.last_order_value,
      l.last_order_summary,
      l.lifetime_value,
      l.first_contact_at,
      l.last_message_at,
      l.last_interaction_at,
      l.created_at,
      l.updated_at,
      c.name as customer_name,
      conv.id as conversation_id,
      conv.status as conversation_status,
      conv.unread_count,
      conv.message_count,
      ch.name as source_channel_name,
      ch.provider as source_channel_provider
    from public.crm_leads l
    left join public.customers c on c.id = l.customer_id
    left join lateral (
      select c1.id, c1.status, c1.unread_count, c1.message_count, c1.last_message_at
      from public.crm_conversations c1
      where c1.lead_id = l.id
      order by c1.last_message_at desc nulls last, c1.created_at desc
      limit 1
    ) conv on true
    left join public.crm_channels ch on ch.id = l.source_channel_id
    where l.store_id = p_store_id
      and (v_funnel_stage is null or l.funnel_stage = v_funnel_stage)
      and (v_sales_stage is null or l.sales_stage = v_sales_stage)
      and (v_source_channel_id is null or l.source_channel_id::text = v_source_channel_id)
      and (v_is_customer is null or l.is_customer = v_is_customer)
      and (
        v_search is null
        or l.name ilike '%' || v_search || '%'
        or l.first_name ilike '%' || v_search || '%'
        or l.phone ilike '%' || v_search || '%'
        or l.phone_normalized ilike '%' || regexp_replace(v_search, '[^0-9]', '', 'g') || '%'
      )
    order by l.last_interaction_at desc nulls last
    limit v_limit
    offset v_offset
  ) paged;

  return jsonb_build_object(
    'success', true,
    'items', v_items,
    'total', v_total,
    'limit', v_limit,
    'offset', v_offset
  );
end;
$$;

grant execute on function public.search_leads(text, jsonb, integer, integer) to anon, authenticated;

commit;
