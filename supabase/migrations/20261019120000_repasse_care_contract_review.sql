-- Repasse Care+ — correções da revisão jurídica do contrato (cláusulas RC-2026.11-v1).
--   * Objeto determinado: proposta exige serviços contemplados e limites de uso (regra do aparelho
--     ou texto padrão), em vez de "avaliados caso a caso" / "limites não estabelecidos".
--   * Check-up preventivo periódico configurável (serviço entregue independentemente de defeito).
--   * Contato do encarregado de dados (LGPD art. 41) impresso no contrato.

begin;

alter table public.care_settings
  add column if not exists default_usage_limits text,
  add column if not exists preventive_checkup_months integer
    check (preventive_checkup_months is null or preventive_checkup_months between 1 and 12),
  add column if not exists privacy_contact text;

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
    'clausesVersion', v_settings.clauses_version
  );
end;
$$;


revoke all on function private.care_compute_quote(text, text, numeric) from public, anon, authenticated;

notify pgrst, 'reload schema';

commit;
