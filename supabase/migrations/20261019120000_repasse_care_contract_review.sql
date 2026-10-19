-- Repasse Care+ — correções da revisão jurídica do contrato (cláusulas RC-2026.11-v1).
--   * Objeto determinado: proposta exige serviços contemplados e limites de uso (regra do aparelho
--     ou texto padrão), em vez de "avaliados caso a caso" / "limites não estabelecidos".
--   * Check-up preventivo periódico configurável (serviço entregue independentemente de defeito).
--   * Contato do encarregado de dados (LGPD art. 41) impresso no contrato.
--   * Suspensão por atraso (regra do proprietário, 2026-10-19): parcela vencida há mais de
--     suspension_grace_days (padrão 5) suspende o contrato; reativar exige quitar o atraso e
--     registrar vistoria do aparelho; danos do período suspenso e avarias da vistoria ficam excluídos.

begin;

alter table public.care_settings
  add column if not exists default_usage_limits text,
  add column if not exists preventive_checkup_months integer
    check (preventive_checkup_months is null or preventive_checkup_months between 1 and 12),
  add column if not exists privacy_contact text,
  add column if not exists suspension_grace_days integer not null default 5
    check (suspension_grace_days between 1 and 60);

alter table public.care_contracts
  add column if not exists suspended_at timestamptz,
  add column if not exists suspension_reason text;

create table if not exists public.care_contract_inspections (
  id uuid primary key default gen_random_uuid(),
  contract_id uuid not null references public.care_contracts(id) on delete restrict,
  inspected_at timestamptz not null default now(),
  inspected_by uuid default auth.uid(),
  result text not null check (result in ('sem_avarias', 'avarias_excluidas')),
  findings text,
  constraint care_inspections_findings_when_damage check (result = 'sem_avarias' or char_length(btrim(coalesce(findings, ''))) > 0)
);
create index if not exists care_contract_inspections_contract_idx on public.care_contract_inspections (contract_id, inspected_at desc);
alter table public.care_contract_inspections enable row level security;
drop policy if exists care_contract_inspections_select on public.care_contract_inspections;
create policy care_contract_inspections_select on public.care_contract_inspections
  for select to authenticated using ((select public.current_role()) in ('admin', 'seller'));
revoke all on public.care_contract_inspections from anon;
revoke insert, update, delete on public.care_contract_inspections from authenticated;
drop trigger if exists care_contract_inspections_audit on public.care_contract_inspections;
create trigger care_contract_inspections_audit after insert or update or delete on public.care_contract_inspections
  for each row execute function private.care_audit();

alter table public.care_settings alter column clauses_version set default 'RC-2026.11-v1';
update public.care_settings set clauses_version = 'RC-2026.11-v1' where id;

create or replace function private.care_compute_quote(p_model text, p_condition text, p_sale_price numeric)
returns jsonb
language plpgsql
stable
set search_path = public, private
as $$
declare
  v_rule public.care_model_rules%rowtype;
  v_cond public.care_condition_rules%rowtype;
  v_pend text[] := array[]::text[];
  v_percent numeric;
  v_percent_source text;
  v_ded_modality text;
  v_ded_value numeric;
  v_ded_source text;
  v_ded_amount numeric;
  v_recurring numeric;
  v_bonuses jsonb := '[]'::jsonb;
  v_settings public.care_settings%rowtype;
  v_services text;
  v_limits text;
begin
  select * into v_settings from public.care_settings where id;

  if p_condition is null then
    v_pend := v_pend || 'Condição do aparelho (Novo/Seminovo) não informada no estoque.';
  end if;
  if p_sale_price is null or p_sale_price <= 0 then
    v_pend := v_pend || 'Preço efetivo de venda ausente.';
  end if;

  if p_condition is not null then
    select * into v_cond from public.care_condition_rules where condition = p_condition;
    select * into v_rule from public.care_model_rules
    where lower(btrim(model)) = lower(btrim(p_model)) and condition = p_condition and active;
  end if;

  if p_condition is not null and v_rule.id is null then
    v_pend := v_pend || format('Sem regra Repasse Care+ ativa para %s %s (1ª parcela e quantidade de parcelas).',
                               btrim(coalesce(p_model, '?')), lower(p_condition));
  end if;

  if v_rule.recurring_percent_override is not null then
    v_percent := v_rule.recurring_percent_override;
    v_percent_source := 'MODELO_CONDICAO';
  elsif v_cond.recurring_percent is not null then
    v_percent := v_cond.recurring_percent;
    v_percent_source := 'CONDICAO';
  elsif p_condition is not null then
    v_pend := v_pend || format('Percentual das parcelas seguintes não configurado para %s.', lower(p_condition));
  end if;

  if v_rule.deductible_modality is not null then
    v_ded_modality := v_rule.deductible_modality;
    v_ded_value := v_rule.deductible_value;
    v_ded_source := 'MODELO_CONDICAO';
  elsif v_cond.deductible_modality is not null then
    v_ded_modality := v_cond.deductible_modality;
    v_ded_value := v_cond.deductible_value;
    v_ded_source := 'CONDICAO';
  elsif p_condition is not null then
    v_pend := v_pend || format('Franquia não configurada para %s.', lower(p_condition));
  end if;

  if v_percent is not null and p_sale_price > 0 then
    v_recurring := round(p_sale_price * v_percent / 100, 2);
  end if;
  -- Objeto do contrato precisa ser determinado (CC art. 122 / CDC art. 47): sem lista de serviços
  -- e sem limites de uso não há proposta.
  v_services := coalesce(nullif(btrim(v_rule.services_description), ''), nullif(btrim(v_settings.default_services_description), ''));
  v_limits := coalesce(nullif(btrim(v_rule.usage_limits), ''), nullif(btrim(v_settings.default_usage_limits), ''));
  if v_rule.id is not null and v_services is null then
    v_pend := v_pend || 'Serviços contemplados não definidos (regra do aparelho ou texto padrão das configurações).'::text;
  end if;
  if v_rule.id is not null and v_limits is null then
    v_pend := v_pend || 'Limites de utilização não definidos (regra do aparelho ou texto padrão das configurações).'::text;
  end if;

  if v_ded_modality = 'PERCENTUAL' and p_sale_price > 0 then
    v_ded_amount := round(p_sale_price * v_ded_value / 100, 2);
  elsif v_ded_modality = 'VALOR_FIXO' then
    v_ded_amount := round(v_ded_value, 2);
  end if;

  if v_rule.id is not null then
    select coalesce(jsonb_agg(jsonb_build_object(
      'benefitId', b.id, 'name', b.name, 'kind', b.kind, 'description', b.description,
      'quantity', rb.quantity, 'deliveryCondition', rb.delivery_condition, 'referenceCost', b.reference_cost
    ) order by b.name), '[]'::jsonb)
    into v_bonuses
    from public.care_model_rule_bonuses rb
    join public.care_benefits b on b.id = rb.benefit_id
    where rb.rule_id = v_rule.id;
  end if;

  return jsonb_build_object(
    'ok', cardinality(v_pend) = 0,
    'pendencias', to_jsonb(v_pend),
    'model', btrim(coalesce(p_model, '')),
    'condition', p_condition,
    'salePrice', p_sale_price,
    'modelRuleId', v_rule.id,
    'modelRuleVersion', v_rule.version,
    'conditionRuleVersion', v_cond.version,
    'firstAmount', v_rule.first_installment_amount,
    'bonuses', v_bonuses,
    'recurringPercent', v_percent,
    'recurringPercentSource', v_percent_source,
    'subsequentCount', v_rule.subsequent_installment_count,
    'recurringAmount', v_recurring,
    'subsequentTotal', case when v_recurring is not null and v_rule.id is not null
                            then v_recurring * v_rule.subsequent_installment_count end,
    'totalProgrammed', case when v_recurring is not null and v_rule.id is not null
                            then v_rule.first_installment_amount + v_recurring * v_rule.subsequent_installment_count end,
    'totalCharges', case when v_rule.id is not null then 1 + v_rule.subsequent_installment_count end,
    'deductibleModality', v_ded_modality,
    'deductibleRate', v_ded_value,
    'deductibleSource', v_ded_source,
    'deductibleBase', case when v_ded_modality = 'PERCENTUAL' then p_sale_price end,
    'deductibleAmount', v_ded_amount,
    'billingIntervalMonths', v_rule.billing_interval_months,
    'firstSubsequentDueMonths', v_rule.first_subsequent_due_months,
    'servicesDescription', v_services,
    'usageLimits', v_limits,
    'preventiveCheckupMonths', v_settings.preventive_checkup_months,
    'suspensionGraceDays', v_settings.suspension_grace_days,
    'clausesVersion', v_settings.clauses_version
  );
end;
$$;


revoke all on function private.care_compute_quote(text, text, numeric) from public, anon, authenticated;

-- Data de corte do atraso: vencida há mais que a carência, no fuso de São Paulo.
create or replace function private.care_overdue_cutoff()
returns date
language sql
stable
set search_path = public, private
as $$
  select (now() at time zone 'America/Sao_Paulo')::date - coalesce((select suspension_grace_days from public.care_settings where id), 5);
$$;

create or replace function private.care_is_delinquent(p_contract_id uuid)
returns boolean
language sql
stable
set search_path = public, private
as $$
  select exists (
    select 1 from public.care_contract_installments
    where contract_id = p_contract_id and status = 'programada' and due_date < private.care_overdue_cutoff()
  );
$$;

-- Suspende contratos ativos com parcela vencida além da carência. Idempotente; roda diariamente (pg_cron)
-- e quando a aba Repasse Care+ é aberta.
create or replace function public.care_refresh_suspensions()
returns integer
language plpgsql
security definer
set search_path = public, private
as $$
declare
  v_id uuid;
  v_count integer := 0;
begin
  for v_id in
    select c.id from public.care_contracts c
    where c.status = 'ativo' and private.care_is_delinquent(c.id)
    for update skip locked
  loop
    update public.care_contracts
    set status = 'suspenso', suspended_at = now(), suspension_reason = 'atraso_pagamento'
    where id = v_id;
    insert into public.care_signature_events (contract_id, event_type, source, event_data)
    values (v_id, 'contrato_suspenso', 'sistema', jsonb_build_object('motivo', 'atraso_pagamento',
            'carencia_dias', (select suspension_grace_days from public.care_settings where id)));
    v_count := v_count + 1;
  end loop;
  return v_count;
end;
$$;

create or replace function public.care_open_service_request(p_contract_id uuid, p_service_type text, p_description text)
returns uuid
language plpgsql
security definer
set search_path = public, private
as $$
declare
  v_c public.care_contracts%rowtype;
  v_id uuid;
begin
  perform private.care_assert_staff();
  select * into v_c from public.care_contracts where id = p_contract_id;
  if v_c.id is null then
    raise exception 'Contrato não encontrado.' using errcode = 'P0002';
  end if;
  -- Bloqueia já pelo atraso, mesmo antes da rotina gravar a suspensão (o raise desfaria um update aqui).
  if v_c.status = 'suspenso' or (v_c.status = 'ativo' and private.care_is_delinquent(v_c.id)) then
    raise exception 'Contrato suspenso por atraso: quite as parcelas em atraso e registre a vistoria para reativar.' using errcode = '22023';
  end if;
  if v_c.status <> 'ativo' then
    raise exception 'Acionamentos só podem ser abertos em contrato ativo.' using errcode = '22023';
  end if;
  insert into public.care_service_requests (contract_id, service_type, description, deductible_amount)
  values (p_contract_id, btrim(p_service_type), nullif(btrim(coalesce(p_description, '')), ''), v_c.deductible_amount)
  returning id into v_id;
  return v_id;
end;
$$;

-- Reativação após suspensão: exige atraso quitado e vistoria registrada. Avarias informadas na
-- vistoria ficam registradas como excluídas do contrato.
create or replace function public.care_reactivate_after_inspection(p_contract_id uuid, p_findings text)
returns jsonb
language plpgsql
security definer
set search_path = public, private
as $$
declare
  v_c public.care_contracts%rowtype;
  v_findings text := nullif(btrim(coalesce(p_findings, '')), '');
  v_result text;
begin
  perform private.care_assert_staff();
  select * into v_c from public.care_contracts where id = p_contract_id for update;
  if v_c.id is null then
    raise exception 'Contrato não encontrado.' using errcode = 'P0002';
  end if;
  if v_c.status <> 'suspenso' then
    raise exception 'Só contratos suspensos podem ser reativados por vistoria.' using errcode = '22023';
  end if;
  if exists (select 1 from public.care_contract_installments
             where contract_id = p_contract_id and status = 'programada'
               and due_date < (now() at time zone 'America/Sao_Paulo')::date) then
    raise exception 'Ainda há parcelas vencidas em aberto. Registre o pagamento antes da vistoria.' using errcode = '22023';
  end if;

  v_result := case when v_findings is null then 'sem_avarias' else 'avarias_excluidas' end;
  insert into public.care_contract_inspections (contract_id, result, findings)
  values (p_contract_id, v_result, v_findings);
  update public.care_contracts set status = 'ativo', suspended_at = null, suspension_reason = null where id = p_contract_id;
  insert into public.care_signature_events (contract_id, event_type, source, actor_user_id, event_data)
  values (p_contract_id, 'contrato_reativado', 'painel', auth.uid(),
          jsonb_build_object('vistoria', v_result, 'avarias_excluidas', v_findings, 'suspenso_desde', v_c.suspended_at));
  return jsonb_build_object('status', 'ativo', 'inspection', v_result);
end;
$$;

-- Dossiê passa a trazer as vistorias.
create or replace function public.care_contract_inspections_json(p_contract_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = public, private
as $$
  select coalesce(jsonb_agg(to_jsonb(i) order by i.inspected_at desc), '[]'::jsonb)
  from public.care_contract_inspections i where i.contract_id = p_contract_id;
$$;

revoke all on function private.care_overdue_cutoff() from public, anon, authenticated;
revoke all on function private.care_is_delinquent(uuid) from public, anon, authenticated;
revoke all on function public.care_refresh_suspensions() from public, anon;
grant execute on function public.care_refresh_suspensions() to authenticated, service_role;
revoke all on function public.care_reactivate_after_inspection(uuid, text) from public, anon;
grant execute on function public.care_reactivate_after_inspection(uuid, text) to authenticated;
revoke all on function public.care_contract_inspections_json(uuid) from public, anon;
grant execute on function public.care_contract_inspections_json(uuid) to authenticated;

-- Rotina diária (00:15 em São Paulo).
do $$
begin
  if exists (select 1 from pg_namespace where nspname = 'cron') then
    perform cron.unschedule(jobid) from cron.job where jobname = 'care-refresh-suspensions';
    perform cron.schedule('care-refresh-suspensions', '15 3 * * *', 'select public.care_refresh_suspensions()');
  end if;
end;
$$;

notify pgrst, 'reload schema';

commit;
