-- Cash-entry (entrada em dinheiro/Pix) no estado do lead.
--
-- Muitos clientes querem dar parte em dinheiro/Pix e o restante no cartão. Antes
-- de simular, a IA agora pergunta se o cliente deseja simular com algum valor de
-- entrada. Para isso o estado precisa persistir:
--   cash_entry_asked  - a IA já perguntou sobre entrada (gate da pergunta)
--   cash_entry_intent - o cliente quer dar entrada (true/false)
--   cash_entry_amount - valor da entrada informado
--
-- Sem essas colunas o upsert_lead_state descartava silenciosamente os campos
-- (lista de colunas explícita), então a entrada negociada nunca chegava ao
-- simulador (entries=0).

alter table public.lead_state
  add column if not exists cash_entry_asked boolean not null default false,
  add column if not exists cash_entry_intent boolean,
  add column if not exists cash_entry_amount numeric(10,2);

-- Recria o upsert incluindo os 3 campos novos (mantém a normalização tolerante
-- de enums e o coalesce-preserve por campo já existentes).
create or replace function public.upsert_lead_state(p_lead_id text, p_state jsonb)
 returns jsonb
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  v_lead_id text := nullif(btrim(coalesce(p_lead_id, '')), '');
  v_state jsonb := coalesce(p_state, '{}'::jsonb);
  v_result public.lead_state%rowtype;
begin
  if v_lead_id is null then
    raise exception 'lead_id is required';
  end if;

  if v_state ? 'interest_type' then
    v_state := jsonb_set(v_state, '{interest_type}', coalesce(to_jsonb(
      case lower(btrim(coalesce(v_state ->> 'interest_type', '')))
        when 'trocar' then 'trocar'
        when 'troca' then 'trocar'
        when 'comprar' then 'comprar'
        when 'compra' then 'comprar'
        when 'vender' then 'vender'
        when 'venda' then 'vender'
        when 'avaliar' then 'avaliar'
        when 'avaliacao' then 'avaliar'
        when 'avaliação' then 'avaliar'
        when 'duvida' then 'duvida'
        when 'dúvida' then 'duvida'
        else null
      end
    ), 'null'::jsonb), true);
  end if;

  if v_state ? 'desired_condition' then
    v_state := jsonb_set(v_state, '{desired_condition}', coalesce(to_jsonb(
      case lower(btrim(coalesce(v_state ->> 'desired_condition', '')))
        when 'novo' then 'Novo'
        when 'seminovo' then 'Seminovo'
        when 'semi-novo' then 'Seminovo'
        when 'semi novo' then 'Seminovo'
        else null
      end
    ), 'null'::jsonb), true);
  end if;

  if v_state ? 'card_brand' then
    v_state := jsonb_set(v_state, '{card_brand}', coalesce(to_jsonb(
      case lower(btrim(coalesce(v_state ->> 'card_brand', '')))
        when 'visa_master' then 'visa_master'
        when 'visa' then 'visa_master'
        when 'master' then 'visa_master'
        when 'mastercard' then 'visa_master'
        when 'elo' then 'elo'
        when 'amex' then 'amex'
        when 'american express' then 'amex'
        when 'hipercard' then 'hipercard'
        else null
      end
    ), 'null'::jsonb), true);
  end if;

  if v_state ? 'tradein_rejected_reason' then
    v_state := jsonb_set(v_state, '{tradein_rejected_reason}', coalesce(to_jsonb(
      case lower(btrim(coalesce(v_state ->> 'tradein_rejected_reason', '')))
        when 'modelo_nao_aceito' then 'modelo_nao_aceito'
        else null
      end
    ), 'null'::jsonb), true);
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
    lead_id, interest_type, desired_model, desired_capacity, desired_color, desired_condition,
    has_tradein, tradein_model, tradein_model_accepted, tradein_rejected_reason, tradein_capacity,
    tradein_color, tradein_scratches, tradein_liquid_contact, tradein_side_marks, tradein_parts_swapped,
    tradein_has_box_cable, tradein_battery_pct, tradein_battery_suspect, tradein_apple_warranty,
    tradein_warranty_until, tradein_disqualified, preferred_city, stock_city, cross_city_situation,
    stock_item_id, hdi_city_needed, client_outside_ce, card_brand, simulation_done, simulation_count,
    last_simulation_total, secondary_color_simulation, proposal_accepted, reservation_intent,
    pix_data_sent, pix_paid, pix_amount, pickup_datetime, pickup_city, cadastro_solicitado,
    cadastro_nome_completo, cadastro_data_nascimento, cadastro_cpf, cadastro_contato, cadastro_completo,
    cash_entry_asked, cash_entry_intent, cash_entry_amount
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
    coalesce((v_state ->> 'cadastro_completo')::boolean, false),
    coalesce((v_state ->> 'cash_entry_asked')::boolean, false),
    case when v_state ? 'cash_entry_intent' then (v_state ->> 'cash_entry_intent')::boolean else null end,
    case when v_state ? 'cash_entry_amount' then (v_state ->> 'cash_entry_amount')::numeric(10,2) else null end
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
    cadastro_completo = case when v_state ? 'cadastro_completo' then excluded.cadastro_completo else public.lead_state.cadastro_completo end,
    -- cash_entry: preserve-on-null (como card_brand) para sobreviver a execuções
    -- paralelas/stale que mandam null. cash_entry_asked é sticky-true (uma vez
    -- perguntado, permanece). Para LIMPAR a entrada, use cash_entry_intent=false.
    cash_entry_asked = public.lead_state.cash_entry_asked or coalesce(excluded.cash_entry_asked, false),
    cash_entry_intent = coalesce(excluded.cash_entry_intent, public.lead_state.cash_entry_intent),
    cash_entry_amount = coalesce(excluded.cash_entry_amount, public.lead_state.cash_entry_amount)
  returning * into v_result;

  return to_jsonb(v_result);
end;
$function$;
