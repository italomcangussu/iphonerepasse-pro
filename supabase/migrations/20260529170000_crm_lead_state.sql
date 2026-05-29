begin;

create table if not exists public.lead_state (
  lead_id text primary key references public.crm_leads(id) on delete cascade,
  interest_type text,
  desired_model text,
  desired_capacity text,
  desired_color text,
  desired_condition text,
  has_tradein boolean not null default false,
  tradein_model text,
  tradein_model_accepted boolean,
  tradein_rejected_reason text,
  tradein_capacity text,
  tradein_color text,
  tradein_scratches boolean,
  tradein_liquid_contact boolean,
  tradein_side_marks boolean,
  tradein_parts_swapped boolean,
  tradein_has_box_cable boolean,
  tradein_battery_pct integer,
  tradein_battery_suspect boolean not null default false,
  tradein_apple_warranty boolean,
  tradein_warranty_until text,
  tradein_disqualified boolean not null default false,
  preferred_city text,
  stock_city text,
  cross_city_situation boolean not null default false,
  stock_item_id text,
  hdi_city_needed boolean not null default false,
  client_outside_ce boolean not null default false,
  card_brand text,
  simulation_done boolean not null default false,
  simulation_count integer not null default 0,
  last_simulation_total numeric(10,2),
  secondary_color_simulation text,
  proposal_accepted boolean not null default false,
  reservation_intent boolean not null default false,
  pix_data_sent boolean not null default false,
  pix_paid boolean not null default false,
  pix_amount numeric(10,2),
  pickup_datetime timestamptz,
  pickup_city text,
  cadastro_solicitado boolean not null default false,
  cadastro_nome_completo text,
  cadastro_data_nascimento text,
  cadastro_cpf text,
  cadastro_contato text,
  cadastro_completo boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint lead_state_interest_type_check check (
    interest_type is null or interest_type in ('comprar', 'vender', 'trocar', 'avaliar', 'duvida')
  ),
  constraint lead_state_desired_condition_check check (
    desired_condition is null or desired_condition in ('Novo', 'Seminovo')
  ),
  constraint lead_state_tradein_rejected_reason_check check (
    tradein_rejected_reason is null or tradein_rejected_reason in ('modelo_nao_aceito')
  ),
  constraint lead_state_card_brand_check check (
    card_brand is null or card_brand in ('visa_master', 'elo', 'amex', 'hipercard')
  ),
  constraint lead_state_simulation_count_check check (simulation_count between 0 and 3),
  constraint lead_state_tradein_battery_pct_check check (tradein_battery_pct is null or tradein_battery_pct between 0 and 100),
  constraint lead_state_last_simulation_total_check check (last_simulation_total is null or last_simulation_total >= 0),
  constraint lead_state_pix_amount_check check (pix_amount is null or pix_amount >= 0)
);

create index if not exists idx_lead_state_stock_item_id
  on public.lead_state (stock_item_id)
  where stock_item_id is not null;

create index if not exists idx_lead_state_preferred_city
  on public.lead_state (preferred_city)
  where preferred_city is not null;

create index if not exists idx_lead_state_pickup_datetime
  on public.lead_state (pickup_datetime)
  where pickup_datetime is not null;

create or replace function public.tg_set_lead_state_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_lead_state_set_updated_at on public.lead_state;
create trigger trg_lead_state_set_updated_at
before update on public.lead_state
for each row execute function public.tg_set_lead_state_updated_at();

alter table public.lead_state enable row level security;

drop policy if exists lead_state_store_scope_select on public.lead_state;
create policy lead_state_store_scope_select on public.lead_state
  for select to authenticated
  using (
    exists (
      select 1
      from public.crm_leads l
      where l.id = lead_state.lead_id
        and public.crm_can_access_store(l.store_id)
    )
  );

drop policy if exists lead_state_store_scope_insert on public.lead_state;
create policy lead_state_store_scope_insert on public.lead_state
  for insert to authenticated
  with check (
    exists (
      select 1
      from public.crm_leads l
      where l.id = lead_state.lead_id
        and public.crm_can_access_store(l.store_id)
    )
  );

drop policy if exists lead_state_store_scope_update on public.lead_state;
create policy lead_state_store_scope_update on public.lead_state
  for update to authenticated
  using (
    exists (
      select 1
      from public.crm_leads l
      where l.id = lead_state.lead_id
        and public.crm_can_access_store(l.store_id)
    )
  )
  with check (
    exists (
      select 1
      from public.crm_leads l
      where l.id = lead_state.lead_id
        and public.crm_can_access_store(l.store_id)
    )
  );

grant select, insert, update on public.lead_state to authenticated;

create or replace function public.get_lead_state(p_lead_id text)
returns jsonb
language sql
security definer
set search_path = public
as $$
  select coalesce(to_jsonb(ls), '{}'::jsonb)
  from public.lead_state ls
  where ls.lead_id = p_lead_id
    and (
      auth.role() = 'service_role'
      or exists (
        select 1
        from public.crm_leads l
        where l.id = ls.lead_id
          and public.crm_can_access_store(l.store_id)
      )
    )
  limit 1;
$$;

create or replace function public.upsert_lead_state(
  p_lead_id text,
  p_state jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_lead_id text := nullif(btrim(coalesce(p_lead_id, '')), '');
  v_state jsonb := coalesce(p_state, '{}'::jsonb);
  v_result public.lead_state%rowtype;
begin
  if v_lead_id is null then
    raise exception 'lead_id is required';
  end if;

  if not (
    auth.role() = 'service_role'
    or exists (
      select 1
      from public.crm_leads l
      where l.id = v_lead_id
        and public.crm_can_access_store(l.store_id)
    )
  ) then
    raise exception 'lead not found or access denied';
  end if;

  insert into public.lead_state (
    lead_id,
    interest_type,
    desired_model,
    desired_capacity,
    desired_color,
    desired_condition,
    has_tradein,
    tradein_model,
    tradein_model_accepted,
    tradein_rejected_reason,
    tradein_capacity,
    tradein_color,
    tradein_scratches,
    tradein_liquid_contact,
    tradein_side_marks,
    tradein_parts_swapped,
    tradein_has_box_cable,
    tradein_battery_pct,
    tradein_battery_suspect,
    tradein_apple_warranty,
    tradein_warranty_until,
    tradein_disqualified,
    preferred_city,
    stock_city,
    cross_city_situation,
    stock_item_id,
    hdi_city_needed,
    client_outside_ce,
    card_brand,
    simulation_done,
    simulation_count,
    last_simulation_total,
    secondary_color_simulation,
    proposal_accepted,
    reservation_intent,
    pix_data_sent,
    pix_paid,
    pix_amount,
    pickup_datetime,
    pickup_city,
    cadastro_solicitado,
    cadastro_nome_completo,
    cadastro_data_nascimento,
    cadastro_cpf,
    cadastro_contato,
    cadastro_completo
  )
  values (
    v_lead_id,
    nullif(btrim(v_state ->> 'interest_type'), ''),
    nullif(btrim(v_state ->> 'desired_model'), ''),
    nullif(btrim(v_state ->> 'desired_capacity'), ''),
    nullif(btrim(v_state ->> 'desired_color'), ''),
    nullif(btrim(v_state ->> 'desired_condition'), ''),
    coalesce((v_state ->> 'has_tradein')::boolean, false),
    nullif(btrim(v_state ->> 'tradein_model'), ''),
    case when v_state ? 'tradein_model_accepted' then (v_state ->> 'tradein_model_accepted')::boolean else null end,
    nullif(btrim(v_state ->> 'tradein_rejected_reason'), ''),
    nullif(btrim(v_state ->> 'tradein_capacity'), ''),
    nullif(btrim(v_state ->> 'tradein_color'), ''),
    case when v_state ? 'tradein_scratches' then (v_state ->> 'tradein_scratches')::boolean else null end,
    case when v_state ? 'tradein_liquid_contact' then (v_state ->> 'tradein_liquid_contact')::boolean else null end,
    case when v_state ? 'tradein_side_marks' then (v_state ->> 'tradein_side_marks')::boolean else null end,
    case when v_state ? 'tradein_parts_swapped' then (v_state ->> 'tradein_parts_swapped')::boolean else null end,
    case when v_state ? 'tradein_has_box_cable' then (v_state ->> 'tradein_has_box_cable')::boolean else null end,
    case when v_state ? 'tradein_battery_pct' then (v_state ->> 'tradein_battery_pct')::integer else null end,
    coalesce((v_state ->> 'tradein_battery_suspect')::boolean, false),
    case when v_state ? 'tradein_apple_warranty' then (v_state ->> 'tradein_apple_warranty')::boolean else null end,
    nullif(btrim(v_state ->> 'tradein_warranty_until'), ''),
    coalesce((v_state ->> 'tradein_disqualified')::boolean, false),
    nullif(btrim(v_state ->> 'preferred_city'), ''),
    nullif(btrim(v_state ->> 'stock_city'), ''),
    coalesce((v_state ->> 'cross_city_situation')::boolean, false),
    nullif(btrim(v_state ->> 'stock_item_id'), ''),
    coalesce((v_state ->> 'hdi_city_needed')::boolean, false),
    coalesce((v_state ->> 'client_outside_ce')::boolean, false),
    nullif(btrim(v_state ->> 'card_brand'), ''),
    coalesce((v_state ->> 'simulation_done')::boolean, false),
    coalesce((v_state ->> 'simulation_count')::integer, 0),
    case when v_state ? 'last_simulation_total' then (v_state ->> 'last_simulation_total')::numeric(10,2) else null end,
    nullif(btrim(v_state ->> 'secondary_color_simulation'), ''),
    coalesce((v_state ->> 'proposal_accepted')::boolean, false),
    coalesce((v_state ->> 'reservation_intent')::boolean, false),
    coalesce((v_state ->> 'pix_data_sent')::boolean, false),
    coalesce((v_state ->> 'pix_paid')::boolean, false),
    case when v_state ? 'pix_amount' then (v_state ->> 'pix_amount')::numeric(10,2) else null end,
    case when v_state ? 'pickup_datetime' then (v_state ->> 'pickup_datetime')::timestamptz else null end,
    nullif(btrim(v_state ->> 'pickup_city'), ''),
    coalesce((v_state ->> 'cadastro_solicitado')::boolean, false),
    nullif(btrim(v_state ->> 'cadastro_nome_completo'), ''),
    nullif(btrim(v_state ->> 'cadastro_data_nascimento'), ''),
    nullif(regexp_replace(coalesce(v_state ->> 'cadastro_cpf', ''), '[^0-9]', '', 'g'), ''),
    nullif(btrim(v_state ->> 'cadastro_contato'), ''),
    coalesce((v_state ->> 'cadastro_completo')::boolean, false)
  )
  on conflict (lead_id) do update
  set
    interest_type = coalesce(excluded.interest_type, public.lead_state.interest_type),
    desired_model = coalesce(excluded.desired_model, public.lead_state.desired_model),
    desired_capacity = coalesce(excluded.desired_capacity, public.lead_state.desired_capacity),
    desired_color = coalesce(excluded.desired_color, public.lead_state.desired_color),
    desired_condition = coalesce(excluded.desired_condition, public.lead_state.desired_condition),
    has_tradein = case when v_state ? 'has_tradein' then excluded.has_tradein else public.lead_state.has_tradein end,
    tradein_model = coalesce(excluded.tradein_model, public.lead_state.tradein_model),
    tradein_model_accepted = case when v_state ? 'tradein_model_accepted' then excluded.tradein_model_accepted else public.lead_state.tradein_model_accepted end,
    tradein_rejected_reason = coalesce(excluded.tradein_rejected_reason, public.lead_state.tradein_rejected_reason),
    tradein_capacity = coalesce(excluded.tradein_capacity, public.lead_state.tradein_capacity),
    tradein_color = coalesce(excluded.tradein_color, public.lead_state.tradein_color),
    tradein_scratches = case when v_state ? 'tradein_scratches' then excluded.tradein_scratches else public.lead_state.tradein_scratches end,
    tradein_liquid_contact = case when v_state ? 'tradein_liquid_contact' then excluded.tradein_liquid_contact else public.lead_state.tradein_liquid_contact end,
    tradein_side_marks = case when v_state ? 'tradein_side_marks' then excluded.tradein_side_marks else public.lead_state.tradein_side_marks end,
    tradein_parts_swapped = case when v_state ? 'tradein_parts_swapped' then excluded.tradein_parts_swapped else public.lead_state.tradein_parts_swapped end,
    tradein_has_box_cable = case when v_state ? 'tradein_has_box_cable' then excluded.tradein_has_box_cable else public.lead_state.tradein_has_box_cable end,
    tradein_battery_pct = case when v_state ? 'tradein_battery_pct' then excluded.tradein_battery_pct else public.lead_state.tradein_battery_pct end,
    tradein_battery_suspect = case when v_state ? 'tradein_battery_suspect' then excluded.tradein_battery_suspect else public.lead_state.tradein_battery_suspect end,
    tradein_apple_warranty = case when v_state ? 'tradein_apple_warranty' then excluded.tradein_apple_warranty else public.lead_state.tradein_apple_warranty end,
    tradein_warranty_until = coalesce(excluded.tradein_warranty_until, public.lead_state.tradein_warranty_until),
    tradein_disqualified = case when v_state ? 'tradein_disqualified' then excluded.tradein_disqualified else public.lead_state.tradein_disqualified end,
    preferred_city = coalesce(excluded.preferred_city, public.lead_state.preferred_city),
    stock_city = coalesce(excluded.stock_city, public.lead_state.stock_city),
    cross_city_situation = case when v_state ? 'cross_city_situation' then excluded.cross_city_situation else public.lead_state.cross_city_situation end,
    stock_item_id = coalesce(excluded.stock_item_id, public.lead_state.stock_item_id),
    hdi_city_needed = case when v_state ? 'hdi_city_needed' then excluded.hdi_city_needed else public.lead_state.hdi_city_needed end,
    client_outside_ce = case when v_state ? 'client_outside_ce' then excluded.client_outside_ce else public.lead_state.client_outside_ce end,
    card_brand = coalesce(excluded.card_brand, public.lead_state.card_brand),
    simulation_done = case when v_state ? 'simulation_done' then excluded.simulation_done else public.lead_state.simulation_done end,
    simulation_count = case when v_state ? 'simulation_count' then excluded.simulation_count else public.lead_state.simulation_count end,
    last_simulation_total = case when v_state ? 'last_simulation_total' then excluded.last_simulation_total else public.lead_state.last_simulation_total end,
    secondary_color_simulation = coalesce(excluded.secondary_color_simulation, public.lead_state.secondary_color_simulation),
    proposal_accepted = case when v_state ? 'proposal_accepted' then excluded.proposal_accepted else public.lead_state.proposal_accepted end,
    reservation_intent = case when v_state ? 'reservation_intent' then excluded.reservation_intent else public.lead_state.reservation_intent end,
    pix_data_sent = case when v_state ? 'pix_data_sent' then excluded.pix_data_sent else public.lead_state.pix_data_sent end,
    pix_paid = case when v_state ? 'pix_paid' then excluded.pix_paid else public.lead_state.pix_paid end,
    pix_amount = case when v_state ? 'pix_amount' then excluded.pix_amount else public.lead_state.pix_amount end,
    pickup_datetime = case when v_state ? 'pickup_datetime' then excluded.pickup_datetime else public.lead_state.pickup_datetime end,
    pickup_city = coalesce(excluded.pickup_city, public.lead_state.pickup_city),
    cadastro_solicitado = case when v_state ? 'cadastro_solicitado' then excluded.cadastro_solicitado else public.lead_state.cadastro_solicitado end,
    cadastro_nome_completo = coalesce(excluded.cadastro_nome_completo, public.lead_state.cadastro_nome_completo),
    cadastro_data_nascimento = coalesce(excluded.cadastro_data_nascimento, public.lead_state.cadastro_data_nascimento),
    cadastro_cpf = coalesce(excluded.cadastro_cpf, public.lead_state.cadastro_cpf),
    cadastro_contato = coalesce(excluded.cadastro_contato, public.lead_state.cadastro_contato),
    cadastro_completo = case when v_state ? 'cadastro_completo' then excluded.cadastro_completo else public.lead_state.cadastro_completo end
  returning * into v_result;

  return to_jsonb(v_result);
end;
$$;

revoke all on function public.get_lead_state(text) from public, anon, authenticated;
revoke all on function public.upsert_lead_state(text, jsonb) from public, anon, authenticated;
grant execute on function public.get_lead_state(text) to service_role;
grant execute on function public.upsert_lead_state(text, jsonb) to service_role;

commit;
