-- Repasse Care+: regras, snapshot, assinatura, pagamento, bônus, RLS (critérios de aceite do contexto de negócio).
create temp table u as select fab.usuario('admin-care@x.com') as adm, fab.usuario('seller-care@x.com') as sel;
grant select on u to authenticated, service_role;
insert into public.user_profiles (id, role) select adm, 'admin' from u;
insert into public.user_profiles (id, role) select sel, 'seller' from u;

insert into public.stores (id, name, city) values ('st_care', 'Loja Care', 'Fortaleza');
insert into public.customers (id, name, cpf, phone) values ('cu_care', 'Maria Care', '12345678901', '(85) 99999-0000');
insert into public.customers (id, name) values ('cu_nophone', 'Sem Fone');
insert into public.stock_items (id, type, model, condition, store_id, imei) values
  ('si_a', 'iPhone', 'iPhone 13', 'Seminovo', 'st_care', '111'),
  ('si_b', 'iPhone', 'iPhone 13', 'Seminovo', 'st_care', '222'),
  ('si_c', 'iPhone', 'iPhone 13', 'Novo', 'st_care', '333'),
  ('si_d', 'iPhone', 'iPhone 15', 'Novo', 'st_care', '444'),
  ('si_e', 'iPhone', 'iPhone 13', 'Seminovo', 'st_care', '555'),
  ('si_f', 'iPhone', 'iPhone 13', 'Seminovo', 'st_care', '666'),
  ('si_g', 'iPhone', 'iPhone 13', 'Seminovo', 'st_care', '777');
insert into public.sales (id, customer_id, store_id, total, discount) values
  ('sa_1', 'cu_care', 'st_care', 2000, 0),
  ('sa_2', 'cu_care', 'st_care', 2500, 0),
  ('sa_3', 'cu_care', 'st_care', 5000, 0),
  ('sa_4', 'cu_care', 'st_care', 6000, 0),
  ('sa_5', 'cu_care', 'st_care', 3600, 400),
  ('sa_6', 'cu_nophone', 'st_care', 2000, 0);
insert into public.sale_items (id, sale_id, stock_item_id, price) values
  ('it_1', 'sa_1', 'si_a', 2000), ('it_2', 'sa_2', 'si_b', 2500), ('it_3', 'sa_3', 'si_c', 5000),
  ('it_4', 'sa_4', 'si_d', 6000), ('it_5a', 'sa_5', 'si_e', 1000), ('it_5b', 'sa_5', 'si_f', 3000),
  ('it_6', 'sa_6', 'si_g', 2000);

-- Vendedor não configura regra comercial.
select fab.como('authenticated', (select sel from u));
select fab.espera_afetadas($$update public.care_condition_rules set recurring_percent = 9$$, 0);
select fab.espera_erro($$insert into public.care_model_rules (model, condition, first_installment_amount, subsequent_installment_count, billing_interval_months, first_subsequent_due_months) values ('iPhone 13','NOVO',1,1,1,1)$$, 'row-level security');

-- Sem regra configurada: pendência, nunca valor inventado (critérios 9, 20).
select fab.espera_linhas($$select 1 where (public.care_quote_for_sale_item('sa_1','si_a') ->> 'ok')::boolean = false$$, 1);

-- Admin configura: percentuais independentes por condição (12), franquia geral percentual (15) e exceção modelo+condição (14, 16).
select fab.como('authenticated', (select adm from u));
update public.care_condition_rules set recurring_percent = 3.5, deductible_modality = 'PERCENTUAL', deductible_value = 10 where condition = 'NOVO';
update public.care_condition_rules set recurring_percent = 4, deductible_modality = 'PERCENTUAL', deductible_value = 15 where condition = 'SEMINOVO';
insert into public.care_benefits (id, name, kind, reference_cost) values ('00000000-0000-0000-0000-0000000000b1', 'Kit capa + película premium', 'kit', 60);
insert into public.care_model_rules (id, model, condition, first_installment_amount, subsequent_installment_count, billing_interval_months, first_subsequent_due_months)
values ('00000000-0000-0000-0000-0000000000a1', 'iPhone 13', 'SEMINOVO', 199, 12, 1, 1);
insert into public.care_model_rules (id, model, condition, first_installment_amount, subsequent_installment_count, recurring_percent_override, deductible_modality, deductible_value, billing_interval_months, first_subsequent_due_months)
values ('00000000-0000-0000-0000-0000000000a2', 'iPhone 13', 'NOVO', 249, 10, 3, 'VALOR_FIXO', 300, 1, 1);
insert into public.care_model_rule_bonuses (rule_id, benefit_id) values ('00000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-0000000000b1');
-- Duas regras para a mesma chave são barradas.
select fab.espera_erro($$insert into public.care_model_rules (model, condition, first_installment_amount, subsequent_installment_count, billing_interval_months, first_subsequent_due_months) values (' iphone 13 ','SEMINOVO',1,1,1,1)$$, 'care_model_rules_key');

select fab.como('authenticated', (select sel from u));
do $$
declare q1 jsonb := public.care_quote_for_sale_item('sa_1','si_a');
        q2 jsonb := public.care_quote_for_sale_item('sa_2','si_b');
        q3 jsonb := public.care_quote_for_sale_item('sa_3','si_c');
        q4 jsonb := public.care_quote_for_sale_item('sa_4','si_d');
        q5 jsonb := public.care_quote_for_sale_item('sa_5','si_e');
        q6 jsonb := public.care_quote_for_sale_item('sa_6','si_g');
begin
  assert (q1->>'ok')::boolean, 'q1 deveria estar ok: ' || (q1->>'pendencias');
  assert (q1->>'recurringAmount')::numeric = 80.00, 'seminovo 4% de 2000 = 80';
  assert q1->>'recurringPercentSource' = 'CONDICAO', 'origem geral';
  assert (q1->>'deductibleAmount')::numeric = 300.00 and (q1->>'deductibleBase')::numeric = 2000, 'franquia 15% sobre preço efetivo';
  assert (q1->>'totalProgrammed')::numeric = 199 + 12 * 80, 'total = E + N*M';
  assert (q1->>'totalCharges')::int = 13, '1 + N cobranças';
  assert jsonb_array_length(q1->'bonuses') = 1, 'bônus da regra';
  -- Critério 4: mesmo modelo, preço diferente → parcela diferente.
  assert (q2->>'recurringAmount')::numeric = 100.00, 'seminovo 4% de 2500 = 100';
  assert (q2->>'deductibleAmount')::numeric = 375.00, 'franquia percentual acompanha o preço (22)';
  -- Critério 13/14/16/23: novo do mesmo modelo usa taxa específica e franquia fixa.
  assert (q3->>'recurringAmount')::numeric = 150.00 and q3->>'recurringPercentSource' = 'MODELO_CONDICAO', 'override 3%';
  assert (q3->>'deductibleAmount')::numeric = 300 and q3->>'deductibleSource' = 'MODELO_CONDICAO' and q3->'deductibleBase' = 'null'::jsonb, 'franquia fixa sem base';
  -- Critério 9: modelo sem regra → bloqueado.
  assert not (q4->>'ok')::boolean, 'iPhone 15 sem regra';
  -- Desconto da venda rateado: 1000 - 400*1000/4000 = 900.
  assert (q5->>'salePrice')::numeric = 900, 'preço efetivo com desconto rateado: ' || (q5->>'salePrice');
  assert not (q6->>'ok')::boolean, 'cliente sem WhatsApp bloqueia';
end $$;
select fab.espera_erro($$select public.care_create_contract('sa_4','si_d')$$, 'Contratação bloqueada');

-- Contrato com snapshot congelado.
create temp table k as select public.care_create_contract('sa_1','si_a') as id;
grant select on k to authenticated, service_role;
select fab.espera_erro($$select public.care_create_contract('sa_1','si_a')$$, 'já tem o contrato');
do $$ begin
  assert (select status from public.care_contracts where id = (select id from k)) = 'rascunho', 'nasce rascunho';
  assert (select count(*) from public.care_contract_installments where contract_id = (select id from k)) = 13, '13 parcelas';
  assert (select amount from public.care_contract_installments where contract_id = (select id from k) and sequence_number = 1) = 199, '1ª parcela fixa';
  assert (select customer_phone from public.care_contracts where id = (select id from k)) = '85999990000', 'telefone só dígitos';
  assert (select status from public.care_contract_benefits where contract_id = (select id from k)) = 'pendente', 'bônus pendente';
end $$;
select fab.espera_erro($$update public.care_contracts set status = 'ativo'$$, 'permission denied');

-- Critério 5/18/24: mudar regra depois não altera contrato.
select fab.como('authenticated', (select adm from u));
update public.care_condition_rules set recurring_percent = 9, deductible_value = 50 where condition = 'SEMINOVO';
do $$ begin
  assert (select recurring_amount from public.care_contracts where id = (select id from k)) = 80, 'snapshot preservado';
  assert (select deductible_amount from public.care_contracts where id = (select id from k)) = 300, 'franquia preservada';
  assert (select recurring_percent from public.care_condition_rules where condition = 'NOVO') = 3.5, 'novo não muda junto (18)';
  assert (select version from public.care_condition_rules where condition = 'SEMINOVO') = 3, 'regra versionada';
  assert (select count(*) from public.care_audit_log where entity = 'care_condition_rules') >= 3, 'auditoria das alterações';
end $$;
select fab.dono();
select fab.espera_erro($$update public.care_contracts set recurring_amount = 1 where id = (select id from k)$$, 'imutáveis');

-- Pagamento antes da assinatura não ativa; bônus continua pendente.
select fab.como('authenticated', (select sel from u));
select fab.espera_erro($$select public.care_confirm_installment_payment((select id from public.care_contract_installments where contract_id = (select id from k) and sequence_number = 1), 'Pix', 'Conta Bancária')$$, 'contrato emitido');

-- Emissão + sessão + assinatura (service_role).
select fab.como('service_role');
create temp table d as select public.care_register_document((select id from k), 'k/v1.pdf', repeat('a', 64), 1234, 'ACEITE-v1', (select adm from u)) as r;
create temp table s as select public.care_open_signature_session((select id from k), repeat('b', 64), now() + interval '1 day', (select adm from u)) as id;
select fab.espera_erro($$select public.care_sign_session((select id from s), repeat('a', 64), '1.1.1.1', 'ua', '{}'::jsonb)$$, 'não está pronta');
update public.care_signature_sessions set status = 'aceita', accepted_at = now(), acceptance_text_version = 'ACEITE-v1' where id = (select id from s);
select fab.espera_erro($$select public.care_sign_session((select id from s), repeat('c', 64), '1.1.1.1', 'ua', '{}'::jsonb)$$, 'documento mudou');
select public.care_sign_session((select id from s), repeat('a', 64), '1.1.1.1', 'ua', '{"permission":"nao_compartilhada"}'::jsonb);
do $$ begin
  assert (public.care_sign_session((select id from s), repeat('a', 64), '1.1.1.1', 'ua', '{}'::jsonb) ->> 'alreadySigned')::boolean, 'idempotente';
  assert (select status from public.care_contracts where id = (select id from k)) = 'assinado_aguardando_primeiro_pagamento', 'assinado sem pagamento';
  assert (select status from public.care_contract_benefits where contract_id = (select id from k)) = 'pendente', 'critério 32';
  assert (select geo_lat from public.care_signature_events where event_type = 'contrato_assinado') is null, 'critério 30: sem coordenada fictícia';
end $$;
select fab.espera_erro($$update public.care_contract_documents set sha256 = repeat('d', 64)$$, 'imutável');
select fab.espera_erro($$update public.care_signature_events set event_type = 'x'$$, 'somente-adição');
select fab.espera_erro($$delete from public.care_signature_events$$, 'somente-adição');
select fab.espera_erro($$insert into public.care_signature_events (contract_id, event_type, source, geo_permission, geo_lat) values ((select id from k), 'x', 'sistema', 'nao_compartilhada', 1)$$, 'geo_only_when_granted');

-- 1ª parcela confirmada: ativa, libera bônus, agenda vencimentos; repetição não duplica (critério 8).
select fab.como('authenticated', (select sel from u));
select public.care_confirm_installment_payment((select id from public.care_contract_installments where contract_id = (select id from k) and sequence_number = 1), 'Pix', 'Conta Bancária', 'e2e-1');
do $$ begin
  assert (public.care_confirm_installment_payment((select id from public.care_contract_installments where contract_id = (select id from k) and sequence_number = 1), 'Pix', 'Conta Bancária') ->> 'alreadyPaid')::boolean, 'idempotente';
  assert (select status from public.care_contracts where id = (select id from k)) = 'ativo', 'ativo';
  assert (select status from public.care_contract_benefits where contract_id = (select id from k)) = 'liberado', 'bônus liberado';
  assert (select count(*) from public.care_contract_installments where contract_id = (select id from k) and kind = 'recorrente' and due_date is null) = 0, 'vencimentos';
end $$;
select fab.dono();
do $$ begin
  assert (select count(*) from public.transactions where category = 'Repasse Care+') = 1, 'uma receita só (11: separada da venda)';
  assert (select sale_id from public.transactions where category = 'Repasse Care+') is null, 'não mistura com a venda';
end $$;

select fab.como('authenticated', (select sel from u));
select public.care_deliver_benefit((select id from public.care_contract_benefits where contract_id = (select id from k)), 'entregue no balcão');
select fab.espera_erro($$select public.care_deliver_benefit((select id from public.care_contract_benefits where contract_id = (select id from k)))$$, 'já foi entregue');
select fab.espera_erro($$select public.care_cancel_contract((select id from k), 'teste')$$, 'administrador');
do $$ begin
  assert (public.care_contract_dossier((select id from k)) -> 'events') = 'null'::jsonb, 'vendedor não vê trilha';
end $$;
select fab.espera_linhas($$select * from public.care_signature_events$$, 0);

-- Acionamento: vendedor abre, só admin aprova; nada aprovado automaticamente.
create temp table r as select public.care_open_service_request((select id from k), 'Troca de tela', 'tela trincada') as id;
grant select on r to authenticated;
select fab.espera_erro($$select public.care_update_service_request((select id from r), 'aprovado')$$, 'administradores');
select fab.espera_erro($$select public.care_update_service_request((select id from r), 'concluido')$$, 'aprovado antes');
select fab.como('authenticated', (select adm from u));
select public.care_update_service_request((select id from r), 'aprovado', 'ok');
do $$ begin
  assert (select deductible_amount from public.care_service_requests where id = (select id from r)) = 300, 'franquia do contrato';
  assert (public.care_verify_event_chain((select id from k)) ->> 'ok')::boolean, 'cadeia íntegra';
  assert (public.care_contract_dossier((select id from k)) -> 'events') <> 'null'::jsonb, 'admin vê trilha';
  assert (public.care_dashboard(current_date - 30, current_date) ->> 'firstInstallmentRevenue')::numeric = 199, 'painel';
end $$;

select fab.como('anon');
select fab.espera_erro($$select * from public.care_contracts$$, 'permission denied');
select fab.espera_erro($$select public.care_simulate('iPhone 13','NOVO',1000)$$, 'permission denied');

-- OTP: tentativa consumida sob lock; esgotou → sessão bloqueada; anon/authenticated não chamam.
select fab.dono();
select fab.como('authenticated', (select sel from u));
select fab.espera_erro($$select public.care_consume_otp_attempt(gen_random_uuid())$$, 'permission denied');
create temp table k2 as select public.care_create_contract('sa_2','si_b') as id;
grant select on k2 to service_role;
select fab.como('service_role');
select public.care_register_document((select id from k2), 'k2/v1.pdf', repeat('e', 64), 10, 'ACEITE-v1', null);
create temp table s2 as select public.care_open_signature_session((select id from k2), repeat('f', 64), now() + interval '1 day', null) as id;
do $$ begin
  assert public.care_consume_otp_attempt((select id from s2)) ->> 'state' = 'sem_codigo', 'sem código antes do envio';
end $$;
update public.care_signature_sessions set status = 'aceita', otp_verifier = 'v', otp_expires_at = now() + interval '5 min' where id = (select id from s2);
do $$
declare i int;
begin
  for i in 1..5 loop
    assert public.care_consume_otp_attempt((select id from s2)) ->> 'state' = 'ok', 'tentativa ' || i;
  end loop;
  assert public.care_consume_otp_attempt((select id from s2)) ->> 'state' = 'bloqueada', '6ª tentativa bloqueia';
  assert (select status from public.care_signature_sessions where id = (select id from s2)) = 'bloqueada', 'sessão bloqueada';
  assert (select otp_verifier from public.care_signature_sessions where id = (select id from s2)) is null, 'verificador descartado';
end $$;
