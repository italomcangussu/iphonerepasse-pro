-- Repasse Care+ — assistência técnica continuada vinculada ao aparelho vendido.
-- Fonte das regras: docs/REPASSE_CARE_CONTEXTO_DE_NEGOCIO.md (v1.5).
--
-- Princípios aplicados aqui (e não só na UI):
--   * Nenhum preço/percentual/franquia padrão: regra ausente = pendência, nunca zero.
--   * Hierarquia sem soma: modelo+condição → condição, por parâmetro, com a origem gravada.
--   * Contrato = snapshot comercial imutável (trigger bloqueia mudança das colunas congeladas).
--   * Ativação exige assinatura + 1ª parcela confirmada; bônus só libera com a 1ª parcela paga.
--   * Trilha de assinatura append-only e encadeada por hash (tamper-evident).
--   * OTP e token de acesso nunca em texto claro: só verificadores (geridos pelo edge function).

begin;

-- ---------------------------------------------------------------------------
-- Configuração
-- ---------------------------------------------------------------------------

create table if not exists public.care_settings (
  id boolean primary key default true check (id),
  otp_ttl_minutes integer not null default 5 check (otp_ttl_minutes between 1 and 30),
  otp_max_attempts integer not null default 5 check (otp_max_attempts between 1 and 10),
  otp_resend_cooldown_seconds integer not null default 60 check (otp_resend_cooldown_seconds between 0 and 900),
  otp_max_sends integer not null default 5 check (otp_max_sends between 1 and 20),
  signature_link_ttl_hours integer not null default 72 check (signature_link_ttl_hours between 1 and 720),
  clauses_version text not null default 'RC-2026.10-v1',
  contractor_legal_name text,
  contractor_cnpj text,
  contractor_address text,
  default_services_description text,
  updated_at timestamptz not null default now(),
  updated_by uuid default auth.uid()
);
insert into public.care_settings (id) values (true) on conflict (id) do nothing;

create table if not exists public.care_condition_rules (
  condition text primary key check (condition in ('NOVO', 'SEMINOVO')),
  recurring_percent numeric(7, 4) check (recurring_percent is null or (recurring_percent >= 0 and recurring_percent <= 100)),
  deductible_modality text check (deductible_modality is null or deductible_modality in ('PERCENTUAL', 'VALOR_FIXO')),
  deductible_value numeric(12, 4) check (deductible_value is null or deductible_value >= 0),
  version integer not null default 1,
  updated_at timestamptz not null default now(),
  updated_by uuid default auth.uid(),
  constraint care_condition_rules_deductible_pair check ((deductible_modality is null) = (deductible_value is null)),
  constraint care_condition_rules_deductible_percent check (
    deductible_modality is distinct from 'PERCENTUAL' or deductible_value <= 100
  )
);
insert into public.care_condition_rules (condition) values ('NOVO'), ('SEMINOVO')
on conflict (condition) do nothing;

create table if not exists public.care_benefits (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(btrim(name)) > 0),
  kind text not null default 'produto' check (kind in ('produto', 'servico', 'beneficio', 'kit')),
  description text,
  reference_cost numeric(12, 2) check (reference_cost is null or reference_cost >= 0),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.care_model_rules (
  id uuid primary key default gen_random_uuid(),
  model text not null check (char_length(btrim(model)) > 0),
  condition text not null check (condition in ('NOVO', 'SEMINOVO')),
  active boolean not null default true,
  first_installment_amount numeric(12, 2) not null check (first_installment_amount >= 0),
  subsequent_installment_count integer not null check (subsequent_installment_count between 0 and 120),
  recurring_percent_override numeric(7, 4)
    check (recurring_percent_override is null or (recurring_percent_override >= 0 and recurring_percent_override <= 100)),
  deductible_modality text check (deductible_modality is null or deductible_modality in ('PERCENTUAL', 'VALOR_FIXO')),
  deductible_value numeric(12, 4) check (deductible_value is null or deductible_value >= 0),
  billing_interval_months integer not null check (billing_interval_months between 1 and 12),
  first_subsequent_due_months integer not null check (first_subsequent_due_months between 0 and 12),
  services_description text,
  usage_limits text,
  notes text,
  version integer not null default 1,
  effective_from timestamptz not null default now(),
  created_at timestamptz not null default now(),
  created_by uuid default auth.uid(),
  updated_at timestamptz not null default now(),
  updated_by uuid default auth.uid(),
  constraint care_model_rules_deductible_pair check ((deductible_modality is null) = (deductible_value is null)),
  constraint care_model_rules_deductible_percent check (
    deductible_modality is distinct from 'PERCENTUAL' or deductible_value <= 100
  )
);
-- Uma regra por modelo+condição: sem sobreposição, sem desempate implícito.
create unique index if not exists care_model_rules_key
  on public.care_model_rules (lower(btrim(model)), condition);

create table if not exists public.care_model_rule_bonuses (
  rule_id uuid not null references public.care_model_rules(id) on delete cascade,
  benefit_id uuid not null references public.care_benefits(id) on delete restrict,
  quantity integer not null default 1 check (quantity > 0),
  delivery_condition text,
  primary key (rule_id, benefit_id)
);
create index if not exists care_model_rule_bonuses_benefit_idx on public.care_model_rule_bonuses (benefit_id);

-- ---------------------------------------------------------------------------
-- Contrato e derivados
-- ---------------------------------------------------------------------------

create sequence if not exists public.care_contract_number_seq;

create table if not exists public.care_contracts (
  id uuid primary key default gen_random_uuid(),
  contract_number bigint not null default nextval('public.care_contract_number_seq') unique,
  status text not null default 'rascunho' check (status in (
    'rascunho', 'aguardando_assinatura', 'assinado_aguardando_primeiro_pagamento', 'ativo',
    'assinatura_expirada', 'assinatura_recusada', 'suspenso', 'encerrado', 'cancelado'
  )),
  sale_id text not null references public.sales(id) on delete restrict,
  sale_item_id text not null references public.sale_items(id) on delete restrict,
  stock_item_id text not null references public.stock_items(id) on delete restrict,
  customer_id text not null references public.customers(id) on delete restrict,
  store_id text references public.stores(id) on delete set null,
  seller_id text references public.sellers(id) on delete set null,
  created_by uuid default auth.uid(),
  -- snapshot comercial (imutável)
  customer_name text not null,
  customer_cpf text,
  customer_phone text not null,
  device_type text,
  device_model text not null,
  device_capacity text,
  device_color text,
  device_imei text,
  condition text not null check (condition in ('NOVO', 'SEMINOVO')),
  sale_price numeric(12, 2) not null check (sale_price > 0),
  first_amount numeric(12, 2) not null check (first_amount >= 0),
  recurring_percent numeric(7, 4) not null check (recurring_percent >= 0),
  recurring_percent_source text not null check (recurring_percent_source in ('MODELO_CONDICAO', 'CONDICAO')),
  subsequent_count integer not null check (subsequent_count >= 0),
  recurring_amount numeric(12, 2) not null check (recurring_amount >= 0),
  subsequent_total numeric(12, 2) not null check (subsequent_total >= 0),
  total_programmed numeric(12, 2) not null check (total_programmed >= 0),
  deductible_modality text not null check (deductible_modality in ('PERCENTUAL', 'VALOR_FIXO')),
  deductible_rate numeric(12, 4) not null check (deductible_rate >= 0),
  deductible_source text not null check (deductible_source in ('MODELO_CONDICAO', 'CONDICAO')),
  deductible_base numeric(12, 2),
  deductible_amount numeric(12, 2) not null check (deductible_amount >= 0),
  billing_interval_months integer not null,
  first_subsequent_due_months integer not null,
  services_description text,
  usage_limits text,
  model_rule_id uuid references public.care_model_rules(id) on delete set null,
  model_rule_version integer not null,
  condition_rule_version integer not null,
  clauses_version text not null,
  quote_snapshot jsonb not null,
  -- ciclo de vida
  signed_at timestamptz,
  first_payment_confirmed_at timestamptz,
  activated_at timestamptz,
  cancelled_at timestamptz,
  cancelled_by uuid,
  cancel_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists care_contracts_sale_idx on public.care_contracts (sale_id);
create index if not exists care_contracts_sale_item_idx on public.care_contracts (sale_item_id);
create index if not exists care_contracts_stock_item_idx on public.care_contracts (stock_item_id);
create index if not exists care_contracts_customer_idx on public.care_contracts (customer_id);
create index if not exists care_contracts_store_idx on public.care_contracts (store_id);
create index if not exists care_contracts_seller_idx on public.care_contracts (seller_id);
create index if not exists care_contracts_model_rule_idx on public.care_contracts (model_rule_id);
create index if not exists care_contracts_status_idx on public.care_contracts (status, created_at desc);
-- Um aparelho vendido tem no máximo um contrato vivo.
create unique index if not exists care_contracts_one_live_per_item
  on public.care_contracts (sale_item_id)
  where status not in ('cancelado', 'assinatura_recusada', 'assinatura_expirada', 'encerrado');

create table if not exists public.care_contract_installments (
  id uuid primary key default gen_random_uuid(),
  contract_id uuid not null references public.care_contracts(id) on delete restrict,
  sequence_number integer not null check (sequence_number >= 1),
  kind text not null check (kind in ('primeira', 'recorrente')),
  amount numeric(12, 2) not null check (amount >= 0),
  due_date date,
  status text not null default 'programada' check (status in ('programada', 'paga', 'cancelada')),
  paid_at timestamptz,
  payment_method text,
  payment_account text,
  payment_reference text,
  transaction_id text references public.transactions(id) on delete set null,
  confirmed_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (contract_id, sequence_number),
  constraint care_installments_kind_sequence check ((kind = 'primeira') = (sequence_number = 1))
);
create index if not exists care_installments_transaction_idx on public.care_contract_installments (transaction_id);
create index if not exists care_installments_due_idx on public.care_contract_installments (status, due_date);

create table if not exists public.care_contract_benefits (
  id uuid primary key default gen_random_uuid(),
  contract_id uuid not null references public.care_contracts(id) on delete restrict,
  benefit_id uuid references public.care_benefits(id) on delete set null,
  name text not null,
  kind text not null,
  description text,
  quantity integer not null default 1,
  delivery_condition text,
  reference_cost numeric(12, 2),
  status text not null default 'pendente' check (status in ('pendente', 'liberado', 'entregue', 'cancelado')),
  released_at timestamptz,
  delivered_at timestamptz,
  delivered_by uuid,
  delivery_notes text,
  created_at timestamptz not null default now()
);
create index if not exists care_contract_benefits_contract_idx on public.care_contract_benefits (contract_id);
create index if not exists care_contract_benefits_benefit_idx on public.care_contract_benefits (benefit_id);

create sequence if not exists public.care_service_request_number_seq;

create table if not exists public.care_service_requests (
  id uuid primary key default gen_random_uuid(),
  request_number bigint not null default nextval('public.care_service_request_number_seq') unique,
  contract_id uuid not null references public.care_contracts(id) on delete restrict,
  service_type text not null check (char_length(btrim(service_type)) > 0),
  description text,
  status text not null default 'solicitado' check (status in (
    'solicitado', 'em_analise', 'aprovado', 'reprovado', 'em_execucao', 'concluido', 'cancelado'
  )),
  deductible_amount numeric(12, 2) check (deductible_amount is null or deductible_amount >= 0),
  deductible_paid boolean not null default false,
  actual_cost numeric(12, 2) check (actual_cost is null or actual_cost >= 0),
  parts_cost numeric(12, 2) check (parts_cost is null or parts_cost >= 0),
  decision_notes text,
  opened_by uuid default auth.uid(),
  decided_by uuid,
  opened_at timestamptz not null default now(),
  decided_at timestamptz,
  completed_at timestamptz,
  updated_at timestamptz not null default now()
);
create index if not exists care_service_requests_contract_idx on public.care_service_requests (contract_id);
create index if not exists care_service_requests_status_idx on public.care_service_requests (status, opened_at desc);

-- ---------------------------------------------------------------------------
-- Documento, sessão de assinatura e trilha de evidências
-- ---------------------------------------------------------------------------

create table if not exists public.care_contract_documents (
  id uuid primary key default gen_random_uuid(),
  contract_id uuid not null references public.care_contracts(id) on delete restrict,
  version integer not null check (version >= 1),
  storage_path text not null,
  sha256 text not null check (sha256 ~ '^[0-9a-f]{64}$'),
  size_bytes integer not null check (size_bytes > 0),
  clauses_version text not null,
  acceptance_text_version text not null,
  status text not null default 'emitido' check (status in ('emitido', 'substituido', 'assinado')),
  issued_at timestamptz not null default now(),
  issued_by uuid,
  signed_at timestamptz,
  signed_pdf_path text,
  signed_pdf_sha256 text check (signed_pdf_sha256 is null or signed_pdf_sha256 ~ '^[0-9a-f]{64}$'),
  evidence_path text,
  evidence_sha256 text check (evidence_sha256 is null or evidence_sha256 ~ '^[0-9a-f]{64}$'),
  unique (contract_id, version)
);

create table if not exists public.care_signature_sessions (
  id uuid primary key default gen_random_uuid(),
  contract_id uuid not null references public.care_contracts(id) on delete restrict,
  document_id uuid not null references public.care_contract_documents(id) on delete restrict,
  access_token_hash text not null unique check (access_token_hash ~ '^[0-9a-f]{64}$'),
  phone text not null,
  status text not null default 'aberta' check (status in ('aberta', 'aceita', 'assinada', 'expirada', 'revogada', 'bloqueada')),
  link_expires_at timestamptz not null,
  otp_verifier text,
  otp_expires_at timestamptz,
  otp_attempts integer not null default 0,
  otp_sends integer not null default 0,
  otp_last_sent_at timestamptz,
  accepted_at timestamptz,
  acceptance_text_version text,
  signed_at timestamptz,
  created_by uuid,
  created_at timestamptz not null default now()
);
create index if not exists care_signature_sessions_contract_idx on public.care_signature_sessions (contract_id);
create index if not exists care_signature_sessions_document_idx on public.care_signature_sessions (document_id);
create unique index if not exists care_signature_sessions_one_open
  on public.care_signature_sessions (contract_id) where status in ('aberta', 'aceita');

create table if not exists public.care_signature_events (
  id bigint generated always as identity primary key,
  contract_id uuid not null references public.care_contracts(id) on delete restrict,
  session_id uuid references public.care_signature_sessions(id) on delete restrict,
  document_id uuid references public.care_contract_documents(id) on delete restrict,
  event_type text not null,
  occurred_at timestamptz not null default now(),
  source text not null check (source in ('assinante', 'sistema', 'painel', 'provedor_whatsapp')),
  actor_user_id uuid,
  source_ip text,
  user_agent text,
  whatsapp_message_id text,
  geo_permission text check (geo_permission is null or geo_permission in ('concedida', 'nao_compartilhada', 'indisponivel', 'nao_solicitada')),
  geo_lat numeric(9, 6),
  geo_lon numeric(9, 6),
  geo_accuracy_m numeric(10, 2),
  geo_captured_at timestamptz,
  event_data jsonb not null default '{}'::jsonb,
  prev_hash text,
  evidence_hash text not null default '',
  constraint care_signature_events_geo_only_when_granted check (
    geo_lat is null or geo_permission = 'concedida'
  )
);
create index if not exists care_signature_events_contract_idx on public.care_signature_events (contract_id, id);
create index if not exists care_signature_events_session_idx on public.care_signature_events (session_id);
create index if not exists care_signature_events_document_idx on public.care_signature_events (document_id);

create table if not exists public.care_audit_log (
  id bigint generated always as identity primary key,
  actor_id uuid default auth.uid(),
  action text not null,
  entity text not null,
  entity_id text,
  before jsonb,
  after jsonb,
  created_at timestamptz not null default now()
);
create index if not exists care_audit_log_entity_idx on public.care_audit_log (entity, entity_id, created_at desc);
create index if not exists care_audit_log_actor_idx on public.care_audit_log (actor_id);

-- ---------------------------------------------------------------------------
-- Gatilhos: versão, auditoria, imutabilidade, cadeia de hash
-- ---------------------------------------------------------------------------

create schema if not exists private;

create or replace function private.care_bump_version()
returns trigger
language plpgsql
set search_path = public, private
as $$
begin
  new.version := old.version + 1;
  new.updated_at := now();
  new.updated_by := auth.uid();
  return new;
end;
$$;

drop trigger if exists care_condition_rules_version on public.care_condition_rules;
create trigger care_condition_rules_version before update on public.care_condition_rules
  for each row when (old.* is distinct from new.*) execute function private.care_bump_version();

drop trigger if exists care_model_rules_version on public.care_model_rules;
create trigger care_model_rules_version before update on public.care_model_rules
  for each row when (old.* is distinct from new.*) execute function private.care_bump_version();

-- Mudança no kit de bônus é mudança da regra: gera nova versão dela.
create or replace function private.care_bonus_touch_rule()
returns trigger
language plpgsql
security definer
set search_path = public, private
as $$
begin
  update public.care_model_rules
  set updated_at = now()
  where id = coalesce(new.rule_id, old.rule_id);
  return null;
end;
$$;

drop trigger if exists care_model_rule_bonuses_touch on public.care_model_rule_bonuses;
create trigger care_model_rule_bonuses_touch after insert or update or delete on public.care_model_rule_bonuses
  for each row execute function private.care_bonus_touch_rule();

create or replace function private.care_touch_updated_at()
returns trigger
language plpgsql
set search_path = public, private
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists care_benefits_touch on public.care_benefits;
create trigger care_benefits_touch before update on public.care_benefits
  for each row execute function private.care_touch_updated_at();
drop trigger if exists care_settings_touch on public.care_settings;
create trigger care_settings_touch before update on public.care_settings
  for each row execute function private.care_touch_updated_at();

create or replace function private.care_audit()
returns trigger
language plpgsql
security definer
set search_path = public, private
as $$
declare
  v_id text;
begin
  v_id := coalesce(to_jsonb(new) ->> 'id', to_jsonb(old) ->> 'id',
                   to_jsonb(new) ->> 'condition', to_jsonb(old) ->> 'condition',
                   to_jsonb(new) ->> 'rule_id', to_jsonb(old) ->> 'rule_id');
  insert into public.care_audit_log (action, entity, entity_id, before, after)
  values (
    lower(tg_op),
    tg_table_name,
    v_id,
    case when tg_op in ('UPDATE', 'DELETE') then to_jsonb(old) end,
    case when tg_op in ('INSERT', 'UPDATE') then to_jsonb(new) end
  );
  return null;
end;
$$;

do $$
declare
  t text;
begin
  foreach t in array array[
    'care_settings', 'care_condition_rules', 'care_benefits', 'care_model_rules',
    'care_model_rule_bonuses', 'care_contracts', 'care_contract_installments',
    'care_contract_benefits', 'care_service_requests'
  ] loop
    execute format('drop trigger if exists %I on public.%I', t || '_audit', t);
    execute format(
      'create trigger %I after insert or update or delete on public.%I for each row execute function private.care_audit()',
      t || '_audit', t
    );
  end loop;
end;
$$;

-- O contrato congela a proposta: qualquer mudança comercial exige um contrato novo.
create or replace function private.care_contract_guard_snapshot()
returns trigger
language plpgsql
set search_path = public, private
as $$
begin
  if (old.sale_id, old.sale_item_id, old.stock_item_id, old.customer_id, old.customer_name,
      old.customer_cpf, old.customer_phone, old.device_model, old.device_capacity, old.device_color,
      old.device_imei, old.condition, old.sale_price, old.first_amount, old.recurring_percent,
      old.recurring_percent_source, old.subsequent_count, old.recurring_amount, old.subsequent_total,
      old.total_programmed, old.deductible_modality, old.deductible_rate, old.deductible_source,
      old.deductible_base, old.deductible_amount, old.billing_interval_months,
      old.first_subsequent_due_months, old.services_description, old.usage_limits,
      old.model_rule_version, old.condition_rule_version, old.clauses_version, old.quote_snapshot,
      old.contract_number, old.created_at)
     is distinct from
     (new.sale_id, new.sale_item_id, new.stock_item_id, new.customer_id, new.customer_name,
      new.customer_cpf, new.customer_phone, new.device_model, new.device_capacity, new.device_color,
      new.device_imei, new.condition, new.sale_price, new.first_amount, new.recurring_percent,
      new.recurring_percent_source, new.subsequent_count, new.recurring_amount, new.subsequent_total,
      new.total_programmed, new.deductible_modality, new.deductible_rate, new.deductible_source,
      new.deductible_base, new.deductible_amount, new.billing_interval_months,
      new.first_subsequent_due_months, new.services_description, new.usage_limits,
      new.model_rule_version, new.condition_rule_version, new.clauses_version, new.quote_snapshot,
      new.contract_number, new.created_at) then
    raise exception 'As condições contratadas são imutáveis. Cancele e gere um novo contrato.'
      using errcode = '55000';
  end if;
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists care_contracts_guard on public.care_contracts;
create trigger care_contracts_guard before update on public.care_contracts
  for each row execute function private.care_contract_guard_snapshot();

create or replace function private.care_document_guard()
returns trigger
language plpgsql
set search_path = public, private
as $$
begin
  if tg_op = 'DELETE' then
    raise exception 'Documentos contratuais não podem ser apagados.' using errcode = '55000';
  end if;
  if (old.contract_id, old.version, old.storage_path, old.sha256, old.size_bytes, old.clauses_version,
      old.acceptance_text_version, old.issued_at)
     is distinct from
     (new.contract_id, new.version, new.storage_path, new.sha256, new.size_bytes, new.clauses_version,
      new.acceptance_text_version, new.issued_at) then
    raise exception 'O PDF emitido é imutável.' using errcode = '55000';
  end if;
  if old.status = 'assinado' and new.status <> 'assinado' then
    raise exception 'Documento assinado não muda de estado.' using errcode = '55000';
  end if;
  if (old.signed_pdf_sha256 is not null and new.signed_pdf_sha256 is distinct from old.signed_pdf_sha256)
     or (old.evidence_sha256 is not null and new.evidence_sha256 is distinct from old.evidence_sha256) then
    raise exception 'Artefatos de assinatura são imutáveis.' using errcode = '55000';
  end if;
  return new;
end;
$$;

drop trigger if exists care_contract_documents_guard on public.care_contract_documents;
create trigger care_contract_documents_guard before update or delete on public.care_contract_documents
  for each row execute function private.care_document_guard();

create or replace function private.care_events_chain()
returns trigger
language plpgsql
set search_path = public, private
as $$
declare
  v_prev text;
begin
  -- Serializa a cadeia por contrato para que dois eventos simultâneos não compartilhem o elo anterior.
  perform pg_advisory_xact_lock(hashtext('care_events:' || new.contract_id::text));
  select e.evidence_hash into v_prev
  from public.care_signature_events e
  where e.contract_id = new.contract_id
  order by e.id desc
  limit 1;

  new.occurred_at := now();
  new.prev_hash := v_prev;
  new.evidence_hash := encode(sha256(convert_to(
    coalesce(v_prev, '') || '|' || new.contract_id::text || '|' || coalesce(new.session_id::text, '') || '|' ||
    coalesce(new.document_id::text, '') || '|' || new.event_type || '|' ||
    to_char(new.occurred_at at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"') || '|' || new.source || '|' ||
    coalesce(new.actor_user_id::text, '') || '|' || coalesce(new.source_ip, '') || '|' ||
    coalesce(new.user_agent, '') || '|' || coalesce(new.whatsapp_message_id, '') || '|' ||
    coalesce(new.geo_permission, '') || '|' || coalesce(new.geo_lat::text, '') || '|' ||
    coalesce(new.geo_lon::text, '') || '|' || coalesce(new.geo_accuracy_m::text, '') || '|' ||
    new.event_data::text,
    'UTF8')), 'hex');
  return new;
end;
$$;

drop trigger if exists care_signature_events_chain on public.care_signature_events;
create trigger care_signature_events_chain before insert on public.care_signature_events
  for each row execute function private.care_events_chain();

create or replace function private.care_append_only()
returns trigger
language plpgsql
set search_path = public, private
as $$
begin
  raise exception 'Registro somente-adição: correções entram como novo evento.' using errcode = '55000';
end;
$$;

drop trigger if exists care_signature_events_append_only on public.care_signature_events;
create trigger care_signature_events_append_only before update or delete on public.care_signature_events
  for each row execute function private.care_append_only();
drop trigger if exists care_audit_log_append_only on public.care_audit_log;
create trigger care_audit_log_append_only before update or delete on public.care_audit_log
  for each row execute function private.care_append_only();

-- ---------------------------------------------------------------------------
-- Regras puras: resolução e cálculo
-- ---------------------------------------------------------------------------

create or replace function private.care_condition_from_stock(p_condition text)
returns text
language sql
immutable
as $$
  select case lower(btrim(coalesce(p_condition, '')))
    when 'novo' then 'NOVO'
    when 'seminovo' then 'SEMINOVO'
    else null
  end;
$$;

-- Calcula a proposta a partir de modelo + condição + preço efetivo.
-- Devolve sempre um jsonb; `pendencias` lista o que impede contratar (nunca preenche com zero).
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
    'servicesDescription', coalesce(nullif(btrim(v_rule.services_description), ''), v_settings.default_services_description),
    'usageLimits', v_rule.usage_limits,
    'clausesVersion', v_settings.clauses_version
  );
end;
$$;

create or replace function private.care_assert_staff()
returns text
language plpgsql
stable
set search_path = public, private
as $$
declare
  v_role text := public.current_role();
begin
  if v_role is null or v_role not in ('admin', 'seller') then
    raise exception 'Acesso negado.' using errcode = '42501';
  end if;
  return v_role;
end;
$$;

create or replace function private.care_assert_admin()
returns void
language plpgsql
stable
set search_path = public, private
as $$
begin
  if public.current_role() is distinct from 'admin' then
    raise exception 'Apenas administradores podem executar esta ação.' using errcode = '42501';
  end if;
end;
$$;

-- Simulador comercial: não grava nada.
create or replace function public.care_simulate(p_model text, p_condition text, p_sale_price numeric)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, private
as $$
begin
  perform private.care_assert_staff();
  return private.care_compute_quote(p_model, upper(btrim(p_condition)), p_sale_price);
end;
$$;

-- Proposta para um aparelho de uma venda real: preço efetivo = preço do item com o desconto
-- da venda rateado proporcionalmente (o desconto é registrado no nível da venda).
create or replace function public.care_quote_for_sale_item(p_sale_id text, p_stock_item_id text)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, private
as $$
declare
  v_item record;
  v_items_total numeric;
  v_price numeric;
  v_condition text;
  v_quote jsonb;
  v_existing record;
  v_pend jsonb;
begin
  perform private.care_assert_staff();

  select si.id as sale_item_id, si.price, s.discount, s.customer_id, s.store_id, s.seller_id,
         st.model, st.type, st.capacity, st.color, st.imei, st.condition,
         c.name as customer_name, c.cpf as customer_cpf, c.phone as customer_phone
  into v_item
  from public.sale_items si
  join public.sales s on s.id = si.sale_id
  join public.stock_items st on st.id = si.stock_item_id
  left join public.customers c on c.id = s.customer_id
  where si.sale_id = p_sale_id and si.stock_item_id = p_stock_item_id
  limit 1;

  if v_item.sale_item_id is null then
    raise exception 'Aparelho não encontrado nesta venda.' using errcode = 'P0002';
  end if;

  select sum(price) into v_items_total from public.sale_items where sale_id = p_sale_id;
  v_price := v_item.price;
  if coalesce(v_item.discount, 0) > 0 and coalesce(v_items_total, 0) > 0 then
    v_price := greatest(round(v_item.price - v_item.discount * v_item.price / v_items_total, 2), 0);
  end if;

  v_condition := private.care_condition_from_stock(v_item.condition);
  v_quote := private.care_compute_quote(v_item.model, v_condition, v_price);
  v_pend := v_quote -> 'pendencias';

  if v_item.customer_id is null then
    v_pend := v_pend || to_jsonb('Venda sem cliente identificado.'::text);
  elsif nullif(regexp_replace(coalesce(v_item.customer_phone, ''), '\D', '', 'g'), '') is null then
    v_pend := v_pend || to_jsonb('Cliente sem WhatsApp cadastrado para receber o link de assinatura.'::text);
  end if;

  select id, status, contract_number into v_existing
  from public.care_contracts
  where sale_item_id = v_item.sale_item_id
    and status not in ('cancelado', 'assinatura_recusada', 'assinatura_expirada', 'encerrado')
  limit 1;
  if v_existing.id is not null then
    v_pend := v_pend || to_jsonb(format('Este aparelho já tem o contrato nº %s.', v_existing.contract_number));
  end if;

  return v_quote || jsonb_build_object(
    'ok', jsonb_array_length(v_pend) = 0,
    'pendencias', v_pend,
    'saleId', p_sale_id,
    'saleItemId', v_item.sale_item_id,
    'stockItemId', p_stock_item_id,
    'itemListPrice', v_item.price,
    'saleDiscountShare', v_item.price - v_price,
    'device', jsonb_build_object('type', v_item.type, 'model', v_item.model, 'capacity', v_item.capacity,
                                 'color', v_item.color, 'imei', v_item.imei, 'stockCondition', v_item.condition),
    'customer', jsonb_build_object('id', v_item.customer_id, 'name', v_item.customer_name,
                                   'cpf', v_item.customer_cpf, 'phone', v_item.customer_phone),
    'existingContract', case when v_existing.id is null then null else jsonb_build_object(
      'id', v_existing.id, 'status', v_existing.status, 'contractNumber', v_existing.contract_number) end
  );
end;
$$;

create or replace function public.care_create_contract(p_sale_id text, p_stock_item_id text)
returns uuid
language plpgsql
security definer
set search_path = public, private
as $$
declare
  v_quote jsonb;
  v_sale record;
  v_id uuid;
  v_n integer;
  v_k integer;
begin
  perform private.care_assert_staff();
  v_quote := public.care_quote_for_sale_item(p_sale_id, p_stock_item_id);
  if not (v_quote ->> 'ok')::boolean then
    raise exception 'Contratação bloqueada: %', array_to_string(array(select jsonb_array_elements_text(v_quote -> 'pendencias')), ' ')
      using errcode = '22023';
  end if;

  select store_id, seller_id into v_sale from public.sales where id = p_sale_id;

  insert into public.care_contracts (
    sale_id, sale_item_id, stock_item_id, customer_id, store_id, seller_id,
    customer_name, customer_cpf, customer_phone,
    device_type, device_model, device_capacity, device_color, device_imei, condition,
    sale_price, first_amount, recurring_percent, recurring_percent_source, subsequent_count,
    recurring_amount, subsequent_total, total_programmed,
    deductible_modality, deductible_rate, deductible_source, deductible_base, deductible_amount,
    billing_interval_months, first_subsequent_due_months, services_description, usage_limits,
    model_rule_id, model_rule_version, condition_rule_version, clauses_version, quote_snapshot
  ) values (
    p_sale_id, v_quote ->> 'saleItemId', p_stock_item_id, v_quote -> 'customer' ->> 'id', v_sale.store_id, v_sale.seller_id,
    v_quote -> 'customer' ->> 'name', nullif(v_quote -> 'customer' ->> 'cpf', ''),
    regexp_replace(v_quote -> 'customer' ->> 'phone', '\D', '', 'g'),
    v_quote -> 'device' ->> 'type', v_quote -> 'device' ->> 'model', v_quote -> 'device' ->> 'capacity',
    v_quote -> 'device' ->> 'color', nullif(v_quote -> 'device' ->> 'imei', ''), v_quote ->> 'condition',
    (v_quote ->> 'salePrice')::numeric, (v_quote ->> 'firstAmount')::numeric,
    (v_quote ->> 'recurringPercent')::numeric, v_quote ->> 'recurringPercentSource',
    (v_quote ->> 'subsequentCount')::integer, (v_quote ->> 'recurringAmount')::numeric,
    (v_quote ->> 'subsequentTotal')::numeric, (v_quote ->> 'totalProgrammed')::numeric,
    v_quote ->> 'deductibleModality', (v_quote ->> 'deductibleRate')::numeric, v_quote ->> 'deductibleSource',
    (v_quote ->> 'deductibleBase')::numeric, (v_quote ->> 'deductibleAmount')::numeric,
    (v_quote ->> 'billingIntervalMonths')::integer, (v_quote ->> 'firstSubsequentDueMonths')::integer,
    v_quote ->> 'servicesDescription', v_quote ->> 'usageLimits',
    (v_quote ->> 'modelRuleId')::uuid, (v_quote ->> 'modelRuleVersion')::integer,
    (v_quote ->> 'conditionRuleVersion')::integer, v_quote ->> 'clausesVersion', v_quote
  ) returning id into v_id;

  insert into public.care_contract_installments (contract_id, sequence_number, kind, amount, due_date)
  values (v_id, 1, 'primeira', (v_quote ->> 'firstAmount')::numeric, current_date);

  v_n := (v_quote ->> 'subsequentCount')::integer;
  for v_k in 1..v_n loop
    insert into public.care_contract_installments (contract_id, sequence_number, kind, amount)
    values (v_id, v_k + 1, 'recorrente', (v_quote ->> 'recurringAmount')::numeric);
  end loop;

  insert into public.care_contract_benefits (
    contract_id, benefit_id, name, kind, description, quantity, delivery_condition, reference_cost
  )
  select v_id, (b ->> 'benefitId')::uuid, b ->> 'name', b ->> 'kind', b ->> 'description',
         (b ->> 'quantity')::integer, b ->> 'deliveryCondition', (b ->> 'referenceCost')::numeric
  from jsonb_array_elements(v_quote -> 'bonuses') b;

  return v_id;
end;
$$;

-- Ativa quando (e só quando) há assinatura e 1ª parcela confirmada. Idempotente.
create or replace function private.care_try_activate(p_contract_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public, private
as $$
declare
  v_c public.care_contracts%rowtype;
  v_activation date;
begin
  select * into v_c from public.care_contracts where id = p_contract_id for update;
  if v_c.status = 'ativo' then
    return true;
  end if;
  if v_c.signed_at is null or v_c.first_payment_confirmed_at is null
     or v_c.status <> 'assinado_aguardando_primeiro_pagamento' then
    return false;
  end if;

  v_activation := (now() at time zone 'America/Sao_Paulo')::date;
  update public.care_contracts set status = 'ativo', activated_at = now() where id = p_contract_id;

  update public.care_contract_installments
  set due_date = (v_activation
                  + make_interval(months => v_c.first_subsequent_due_months
                                            + (sequence_number - 2) * v_c.billing_interval_months))::date,
      updated_at = now()
  where contract_id = p_contract_id and kind = 'recorrente' and due_date is null;

  update public.care_contract_benefits
  set status = 'liberado', released_at = now()
  where contract_id = p_contract_id and status = 'pendente';
  return true;
end;
$$;

create or replace function public.care_confirm_installment_payment(
  p_installment_id uuid,
  p_payment_method text,
  p_account text,
  p_reference text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, private
as $$
declare
  v_inst public.care_contract_installments%rowtype;
  v_c public.care_contracts%rowtype;
  v_trx text;
begin
  perform private.care_assert_staff();
  if p_account not in ('Conta Bancária', 'Cofre') then
    raise exception 'Conta inválida (Conta Bancária ou Cofre).' using errcode = '22023';
  end if;
  if nullif(btrim(coalesce(p_payment_method, '')), '') is null then
    raise exception 'Informe a forma de pagamento.' using errcode = '22023';
  end if;

  select * into v_inst from public.care_contract_installments where id = p_installment_id for update;
  if v_inst.id is null then
    raise exception 'Parcela não encontrada.' using errcode = 'P0002';
  end if;
  -- Idempotência: confirmação repetida não gera receita nem bônus em dobro.
  if v_inst.status = 'paga' then
    return jsonb_build_object('alreadyPaid', true, 'installmentId', v_inst.id, 'transactionId', v_inst.transaction_id);
  end if;
  if v_inst.status = 'cancelada' then
    raise exception 'Parcela cancelada não pode ser paga.' using errcode = '22023';
  end if;

  select * into v_c from public.care_contracts where id = v_inst.contract_id for update;
  if v_inst.kind = 'primeira' and v_c.status not in ('aguardando_assinatura', 'assinado_aguardando_primeiro_pagamento') then
    raise exception 'A 1ª parcela só é registrada em contrato emitido e não cancelado.' using errcode = '22023';
  end if;
  if v_inst.kind = 'recorrente' and v_c.status not in ('ativo', 'suspenso') then
    raise exception 'Parcelas seguintes só são registradas em contrato ativo ou suspenso.' using errcode = '22023';
  end if;

  v_trx := 'trx_' || replace(gen_random_uuid()::text, '-', '');
  insert into public.transactions (id, type, category, amount, date, description, account)
  values (
    v_trx, 'IN', 'Repasse Care+', v_inst.amount, now(),
    format('Repasse Care+ contrato nº %s — parcela %s/%s (%s)', v_c.contract_number, v_inst.sequence_number,
           v_c.subsequent_count + 1, btrim(p_payment_method)),
    p_account
  );

  update public.care_contract_installments
  set status = 'paga', paid_at = now(), payment_method = btrim(p_payment_method), payment_account = p_account,
      payment_reference = nullif(btrim(coalesce(p_reference, '')), ''), transaction_id = v_trx,
      confirmed_by = auth.uid(), updated_at = now()
  where id = v_inst.id;

  if v_inst.kind = 'primeira' then
    update public.care_contracts set first_payment_confirmed_at = now() where id = v_c.id;
    perform private.care_try_activate(v_c.id);
  end if;

  return jsonb_build_object('alreadyPaid', false, 'installmentId', v_inst.id, 'transactionId', v_trx);
end;
$$;

create or replace function public.care_deliver_benefit(p_benefit_id uuid, p_notes text default null)
returns void
language plpgsql
security definer
set search_path = public, private
as $$
declare
  v_b public.care_contract_benefits%rowtype;
begin
  perform private.care_assert_staff();
  select * into v_b from public.care_contract_benefits where id = p_benefit_id for update;
  if v_b.id is null then
    raise exception 'Bônus não encontrado.' using errcode = 'P0002';
  end if;
  if v_b.status = 'entregue' then
    raise exception 'Este bônus já foi entregue em %.', to_char(v_b.delivered_at at time zone 'America/Sao_Paulo', 'DD/MM/YYYY HH24:MI')
      using errcode = '22023';
  end if;
  if v_b.status <> 'liberado' then
    raise exception 'O bônus só pode ser entregue depois da confirmação da 1ª parcela.' using errcode = '22023';
  end if;
  update public.care_contract_benefits
  set status = 'entregue', delivered_at = now(), delivered_by = auth.uid(),
      delivery_notes = nullif(btrim(coalesce(p_notes, '')), '')
  where id = p_benefit_id;
end;
$$;

create or replace function public.care_cancel_contract(p_contract_id uuid, p_reason text)
returns void
language plpgsql
security definer
set search_path = public, private
as $$
declare
  v_role text;
  v_c public.care_contracts%rowtype;
begin
  v_role := private.care_assert_staff();
  if nullif(btrim(coalesce(p_reason, '')), '') is null then
    raise exception 'Informe o motivo do cancelamento.' using errcode = '22023';
  end if;
  select * into v_c from public.care_contracts where id = p_contract_id for update;
  if v_c.id is null then
    raise exception 'Contrato não encontrado.' using errcode = 'P0002';
  end if;
  if v_c.status in ('cancelado', 'encerrado') then
    return;
  end if;
  if v_role <> 'admin' and v_c.status not in ('rascunho', 'aguardando_assinatura') then
    raise exception 'Contrato assinado só pode ser cancelado por um administrador.' using errcode = '42501';
  end if;

  update public.care_contracts
  set status = 'cancelado', cancelled_at = now(), cancelled_by = auth.uid(), cancel_reason = btrim(p_reason)
  where id = p_contract_id;
  update public.care_contract_installments set status = 'cancelada', updated_at = now()
  where contract_id = p_contract_id and status = 'programada';
  update public.care_contract_benefits set status = 'cancelado'
  where contract_id = p_contract_id and status in ('pendente', 'liberado');
  update public.care_signature_sessions set status = 'revogada', otp_verifier = null
  where contract_id = p_contract_id and status in ('aberta', 'aceita');
  insert into public.care_signature_events (contract_id, event_type, source, actor_user_id, event_data)
  values (p_contract_id, 'contrato_cancelado', 'painel', auth.uid(), jsonb_build_object('motivo', btrim(p_reason)));
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
  if v_c.status <> 'ativo' then
    raise exception 'Acionamentos só podem ser abertos em contrato ativo.' using errcode = '22023';
  end if;
  insert into public.care_service_requests (contract_id, service_type, description, deductible_amount)
  values (p_contract_id, btrim(p_service_type), nullif(btrim(coalesce(p_description, '')), ''), v_c.deductible_amount)
  returning id into v_id;
  return v_id;
end;
$$;

create or replace function public.care_update_service_request(
  p_request_id uuid,
  p_status text,
  p_notes text default null,
  p_actual_cost numeric default null,
  p_parts_cost numeric default null,
  p_deductible_paid boolean default null
)
returns void
language plpgsql
security definer
set search_path = public, private
as $$
declare
  v_role text;
  v_r public.care_service_requests%rowtype;
begin
  v_role := private.care_assert_staff();
  select * into v_r from public.care_service_requests where id = p_request_id for update;
  if v_r.id is null then
    raise exception 'Acionamento não encontrado.' using errcode = 'P0002';
  end if;
  if p_status not in ('solicitado', 'em_analise', 'aprovado', 'reprovado', 'em_execucao', 'concluido', 'cancelado') then
    raise exception 'Status inválido.' using errcode = '22023';
  end if;
  -- Aprovação nunca é automática nem do vendedor: decisão de cobertura é administrativa.
  if p_status in ('aprovado', 'reprovado') and v_role <> 'admin' then
    raise exception 'Apenas administradores aprovam ou reprovam acionamentos.' using errcode = '42501';
  end if;
  if p_status in ('em_execucao', 'concluido') and v_r.status not in ('aprovado', 'em_execucao') then
    raise exception 'O acionamento precisa estar aprovado antes da execução.' using errcode = '22023';
  end if;

  update public.care_service_requests
  set status = p_status,
      decision_notes = coalesce(nullif(btrim(coalesce(p_notes, '')), ''), decision_notes),
      actual_cost = coalesce(p_actual_cost, actual_cost),
      parts_cost = coalesce(p_parts_cost, parts_cost),
      deductible_paid = coalesce(p_deductible_paid, deductible_paid),
      decided_by = case when p_status in ('aprovado', 'reprovado') then auth.uid() else decided_by end,
      decided_at = case when p_status in ('aprovado', 'reprovado') then now() else decided_at end,
      completed_at = case when p_status = 'concluido' then now() else completed_at end,
      updated_at = now()
  where id = p_request_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- Assinatura (só service_role: chamadas pelos edge functions)
-- ---------------------------------------------------------------------------

create or replace function public.care_register_document(
  p_contract_id uuid,
  p_storage_path text,
  p_sha256 text,
  p_size_bytes integer,
  p_acceptance_text_version text,
  p_actor uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public, private
as $$
declare
  v_c public.care_contracts%rowtype;
  v_version integer;
  v_doc uuid;
begin
  select * into v_c from public.care_contracts where id = p_contract_id for update;
  if v_c.id is null then
    raise exception 'Contrato não encontrado.' using errcode = 'P0002';
  end if;
  if v_c.status not in ('rascunho', 'aguardando_assinatura') then
    raise exception 'Contrato não aceita novo documento no estado %.', v_c.status using errcode = '22023';
  end if;

  -- Documento novo invalida sessões e versões anteriores.
  update public.care_signature_sessions set status = 'revogada', otp_verifier = null
  where contract_id = p_contract_id and status in ('aberta', 'aceita');
  update public.care_contract_documents set status = 'substituido'
  where contract_id = p_contract_id and status = 'emitido';

  select coalesce(max(version), 0) + 1 into v_version from public.care_contract_documents where contract_id = p_contract_id;
  insert into public.care_contract_documents (
    contract_id, version, storage_path, sha256, size_bytes, clauses_version, acceptance_text_version, issued_by
  ) values (
    p_contract_id, v_version, p_storage_path, lower(p_sha256), p_size_bytes, v_c.clauses_version,
    p_acceptance_text_version, p_actor
  ) returning id into v_doc;

  update public.care_contracts set status = 'aguardando_assinatura' where id = p_contract_id and status = 'rascunho';
  insert into public.care_signature_events (contract_id, document_id, event_type, source, actor_user_id, event_data)
  values (p_contract_id, v_doc, 'documento_emitido', 'sistema', p_actor,
          jsonb_build_object('versao', v_version, 'sha256', lower(p_sha256), 'tamanho_bytes', p_size_bytes,
                             'versao_clausulas', v_c.clauses_version, 'versao_aceite', p_acceptance_text_version));
  return jsonb_build_object('documentId', v_doc, 'version', v_version);
end;
$$;

create or replace function public.care_open_signature_session(
  p_contract_id uuid,
  p_access_token_hash text,
  p_link_expires_at timestamptz,
  p_actor uuid
)
returns uuid
language plpgsql
security definer
set search_path = public, private
as $$
declare
  v_c public.care_contracts%rowtype;
  v_doc uuid;
  v_session uuid;
begin
  select * into v_c from public.care_contracts where id = p_contract_id for update;
  if v_c.status <> 'aguardando_assinatura' then
    raise exception 'Contrato não está aguardando assinatura.' using errcode = '22023';
  end if;
  select id into v_doc from public.care_contract_documents
  where contract_id = p_contract_id and status = 'emitido' order by version desc limit 1;
  if v_doc is null then
    raise exception 'Emita o documento antes de abrir a sessão de assinatura.' using errcode = '22023';
  end if;

  update public.care_signature_sessions set status = 'revogada', otp_verifier = null
  where contract_id = p_contract_id and status in ('aberta', 'aceita');

  insert into public.care_signature_sessions (contract_id, document_id, access_token_hash, phone, link_expires_at, created_by)
  values (p_contract_id, v_doc, lower(p_access_token_hash), v_c.customer_phone, p_link_expires_at, p_actor)
  returning id into v_session;

  insert into public.care_signature_events (contract_id, session_id, document_id, event_type, source, actor_user_id, event_data)
  values (p_contract_id, v_session, v_doc, 'sessao_criada', 'sistema', p_actor,
          jsonb_build_object('link_expira_em', p_link_expires_at, 'telefone', v_c.customer_phone));
  return v_session;
end;
$$;

-- Consome uma tentativa de OTP sob lock da sessão: requisições paralelas não burlam o limite.
-- Devolve o verificador para comparação no servidor; bloqueia a sessão ao esgotar as tentativas.
create or replace function public.care_consume_otp_attempt(p_session_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, private
as $$
declare
  v_s public.care_signature_sessions%rowtype;
  v_max integer;
begin
  select otp_max_attempts into v_max from public.care_settings where id;
  select * into v_s from public.care_signature_sessions where id = p_session_id for update;
  if v_s.id is null then
    raise exception 'Sessão de assinatura não encontrada.' using errcode = 'P0002';
  end if;
  if v_s.status = 'assinada' then
    return jsonb_build_object('state', 'assinada');
  end if;
  if v_s.status <> 'aceita' or v_s.otp_verifier is null then
    return jsonb_build_object('state', 'sem_codigo');
  end if;
  if v_s.otp_expires_at <= now() then
    update public.care_signature_sessions set otp_verifier = null where id = v_s.id;
    return jsonb_build_object('state', 'expirado');
  end if;
  if v_s.otp_attempts >= v_max then
    update public.care_signature_sessions set status = 'bloqueada', otp_verifier = null where id = v_s.id;
    return jsonb_build_object('state', 'bloqueada');
  end if;
  update public.care_signature_sessions set otp_attempts = otp_attempts + 1 where id = v_s.id;
  return jsonb_build_object('state', 'ok', 'verifier', v_s.otp_verifier, 'attempt', v_s.otp_attempts + 1, 'maxAttempts', v_max);
end;
$$;

-- Registra a assinatura de forma atômica e idempotente (double submit devolve o mesmo resultado).
create or replace function public.care_sign_session(
  p_session_id uuid,
  p_document_sha256 text,
  p_source_ip text,
  p_user_agent text,
  p_geo jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public, private
as $$
declare
  v_s public.care_signature_sessions%rowtype;
  v_doc public.care_contract_documents%rowtype;
  v_c public.care_contracts%rowtype;
  v_activated boolean;
  v_perm text := coalesce(nullif(p_geo ->> 'permission', ''), 'nao_solicitada');
begin
  select * into v_s from public.care_signature_sessions where id = p_session_id for update;
  if v_s.id is null then
    raise exception 'Sessão de assinatura não encontrada.' using errcode = 'P0002';
  end if;
  if v_s.status = 'assinada' then
    return jsonb_build_object('alreadySigned', true, 'contractId', v_s.contract_id, 'signedAt', v_s.signed_at);
  end if;
  if v_s.status <> 'aceita' then
    raise exception 'Sessão não está pronta para assinatura (%).', v_s.status using errcode = '22023';
  end if;
  if v_s.link_expires_at <= now() then
    raise exception 'Link de assinatura expirado.' using errcode = '22023';
  end if;

  select * into v_doc from public.care_contract_documents where id = v_s.document_id for update;
  if v_doc.status <> 'emitido' or v_doc.sha256 <> lower(p_document_sha256) then
    raise exception 'O documento mudou desde a abertura da sessão. Solicite um novo link.' using errcode = '22023';
  end if;
  select * into v_c from public.care_contracts where id = v_s.contract_id for update;
  if v_c.status <> 'aguardando_assinatura' then
    raise exception 'Contrato não está aguardando assinatura (%).', v_c.status using errcode = '22023';
  end if;

  update public.care_signature_sessions set status = 'assinada', signed_at = now(), otp_verifier = null where id = v_s.id;
  update public.care_contract_documents set status = 'assinado', signed_at = now() where id = v_doc.id;
  update public.care_contracts set status = 'assinado_aguardando_primeiro_pagamento', signed_at = now() where id = v_c.id;

  insert into public.care_signature_events (
    contract_id, session_id, document_id, event_type, source, source_ip, user_agent,
    geo_permission, geo_lat, geo_lon, geo_accuracy_m, geo_captured_at, event_data
  ) values (
    v_c.id, v_s.id, v_doc.id, 'contrato_assinado', 'assinante', p_source_ip, p_user_agent,
    v_perm,
    case when v_perm = 'concedida' then (p_geo ->> 'lat')::numeric end,
    case when v_perm = 'concedida' then (p_geo ->> 'lon')::numeric end,
    case when v_perm = 'concedida' then (p_geo ->> 'accuracy')::numeric end,
    case when v_perm = 'concedida' then (p_geo ->> 'capturedAt')::timestamptz end,
    jsonb_build_object('documento_sha256', v_doc.sha256, 'documento_versao', v_doc.version,
                       'versao_aceite', v_s.acceptance_text_version, 'metodo', 'otp_whatsapp_6_digitos',
                       'telefone', v_s.phone)
  );

  v_activated := private.care_try_activate(v_c.id);
  return jsonb_build_object('alreadySigned', false, 'contractId', v_c.id, 'activated', v_activated,
                            'documentId', v_doc.id);
end;
$$;

-- ---------------------------------------------------------------------------
-- Leitura agregada: dossiê e painel
-- ---------------------------------------------------------------------------

create or replace function public.care_contract_dossier(p_contract_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, private
as $$
declare
  v_role text;
begin
  v_role := private.care_assert_staff();
  return jsonb_build_object(
    'contract', (select to_jsonb(c) from public.care_contracts c where c.id = p_contract_id),
    'installments', (select coalesce(jsonb_agg(to_jsonb(i) order by i.sequence_number), '[]'::jsonb)
                     from public.care_contract_installments i where i.contract_id = p_contract_id),
    'benefits', (select coalesce(jsonb_agg(to_jsonb(b) order by b.created_at), '[]'::jsonb)
                 from public.care_contract_benefits b where b.contract_id = p_contract_id),
    'documents', (select coalesce(jsonb_agg(to_jsonb(d) order by d.version), '[]'::jsonb)
                  from public.care_contract_documents d where d.contract_id = p_contract_id),
    'sessions', (select coalesce(jsonb_agg(jsonb_build_object(
                   'id', s.id, 'documentId', s.document_id, 'status', s.status, 'phone', s.phone,
                   'linkExpiresAt', s.link_expires_at, 'otpAttempts', s.otp_attempts, 'otpSends', s.otp_sends,
                   'acceptedAt', s.accepted_at, 'signedAt', s.signed_at, 'createdAt', s.created_at
                 ) order by s.created_at), '[]'::jsonb)
                 from public.care_signature_sessions s where s.contract_id = p_contract_id),
    -- Trilha de auditoria completa é do administrador (segregação venda × auditoria).
    'events', case when v_role = 'admin' then
                (select coalesce(jsonb_agg(to_jsonb(e) order by e.id), '[]'::jsonb)
                 from public.care_signature_events e where e.contract_id = p_contract_id)
              end,
    'serviceRequests', (select coalesce(jsonb_agg(to_jsonb(r) order by r.opened_at desc), '[]'::jsonb)
                        from public.care_service_requests r where r.contract_id = p_contract_id)
  );
end;
$$;

-- Confere a cadeia de hash dos eventos (recalcula cada elo).
create or replace function public.care_verify_event_chain(p_contract_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, private
as $$
declare
  e record;
  v_prev text := null;
  v_calc text;
  v_count integer := 0;
begin
  perform private.care_assert_admin();
  for e in select * from public.care_signature_events where contract_id = p_contract_id order by id loop
    v_count := v_count + 1;
    v_calc := encode(sha256(convert_to(
      coalesce(v_prev, '') || '|' || e.contract_id::text || '|' || coalesce(e.session_id::text, '') || '|' ||
      coalesce(e.document_id::text, '') || '|' || e.event_type || '|' ||
      to_char(e.occurred_at at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"') || '|' || e.source || '|' ||
      coalesce(e.actor_user_id::text, '') || '|' || coalesce(e.source_ip, '') || '|' ||
      coalesce(e.user_agent, '') || '|' || coalesce(e.whatsapp_message_id, '') || '|' ||
      coalesce(e.geo_permission, '') || '|' || coalesce(e.geo_lat::text, '') || '|' ||
      coalesce(e.geo_lon::text, '') || '|' || coalesce(e.geo_accuracy_m::text, '') || '|' ||
      e.event_data::text,
      'UTF8')), 'hex');
    if e.prev_hash is distinct from v_prev or e.evidence_hash <> v_calc then
      return jsonb_build_object('ok', false, 'events', v_count, 'brokenAtEventId', e.id);
    end if;
    v_prev := e.evidence_hash;
  end loop;
  return jsonb_build_object('ok', true, 'events', v_count, 'lastHash', v_prev);
end;
$$;

create or replace function public.care_dashboard(p_from date, p_to date)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, private
as $$
declare
  v_from timestamptz := (p_from::timestamp at time zone 'America/Sao_Paulo');
  v_to timestamptz := ((p_to + 1)::timestamp at time zone 'America/Sao_Paulo');
  v_today date := (now() at time zone 'America/Sao_Paulo')::date;
begin
  perform private.care_assert_admin();
  return jsonb_build_object(
    'period', jsonb_build_object('from', p_from, 'to', p_to),
    'statusCounts', (select coalesce(jsonb_object_agg(status, n), '{}'::jsonb)
                     from (select status, count(*) n from public.care_contracts group by status) x),
    'devicesSold', (select count(*) from public.sale_items si join public.sales s on s.id = si.sale_id
                    join public.stock_items st on st.id = si.stock_item_id
                    where s.date >= v_from and s.date < v_to and st.type = 'iPhone'),
    'contractsCreated', (select count(*) from public.care_contracts
                         where created_at >= v_from and created_at < v_to and status <> 'cancelado'),
    'contractsSigned', (select count(*) from public.care_contracts where signed_at >= v_from and signed_at < v_to),
    'firstInstallmentRevenue', (select coalesce(sum(amount), 0) from public.care_contract_installments
                                where kind = 'primeira' and status = 'paga' and paid_at >= v_from and paid_at < v_to),
    'recurringRevenue', (select coalesce(sum(amount), 0) from public.care_contract_installments
                         where kind = 'recorrente' and status = 'paga' and paid_at >= v_from and paid_at < v_to),
    'contractedTotalActive', (select coalesce(sum(total_programmed), 0) from public.care_contracts
                              where status in ('ativo', 'suspenso', 'assinado_aguardando_primeiro_pagamento')),
    'receivedTotalActive', (select coalesce(sum(i.amount), 0) from public.care_contract_installments i
                            join public.care_contracts c on c.id = i.contract_id
                            where i.status = 'paga' and c.status in ('ativo', 'suspenso', 'encerrado')),
    'overdueAmount', (select coalesce(sum(i.amount), 0) from public.care_contract_installments i
                      join public.care_contracts c on c.id = i.contract_id
                      where i.status = 'programada' and i.due_date < v_today and c.status in ('ativo', 'suspenso')),
    'overdueCount', (select count(*) from public.care_contract_installments i
                     join public.care_contracts c on c.id = i.contract_id
                     where i.status = 'programada' and i.due_date < v_today and c.status in ('ativo', 'suspenso')),
    'benefits', (select jsonb_build_object(
                   'pendentes', count(*) filter (where status = 'pendente'),
                   'liberados', count(*) filter (where status = 'liberado'),
                   'entregues', count(*) filter (where status = 'entregue'),
                   'custoEntregue', coalesce(sum(coalesce(reference_cost, 0) * quantity) filter (where status = 'entregue'), 0))
                 from public.care_contract_benefits),
    'serviceRequests', (select jsonb_build_object(
                          'abertos', count(*) filter (where status in ('solicitado', 'em_analise', 'aprovado', 'em_execucao')),
                          'concluidos', count(*) filter (where status = 'concluido'),
                          'reprovados', count(*) filter (where status = 'reprovado'),
                          'receitaFranquias', coalesce(sum(deductible_amount) filter (where status = 'concluido' and deductible_paid), 0),
                          'custoReparos', coalesce(sum(coalesce(actual_cost, 0) + coalesce(parts_cost, 0)) filter (where status = 'concluido'), 0))
                        from public.care_service_requests),
    'byModel', (select coalesce(jsonb_agg(m order by m ->> 'model'), '[]'::jsonb) from (
                  select jsonb_build_object(
                    'model', c.device_model, 'condition', c.condition,
                    'contracts', count(*),
                    'active', count(*) filter (where c.status = 'ativo'),
                    'contracted', coalesce(sum(c.total_programmed), 0),
                    'received', coalesce((select sum(i.amount) from public.care_contract_installments i
                                          join public.care_contracts c2 on c2.id = i.contract_id
                                          where i.status = 'paga' and c2.device_model = c.device_model
                                            and c2.condition = c.condition), 0),
                    'serviceRequests', coalesce((select count(*) from public.care_service_requests r
                                                 join public.care_contracts c3 on c3.id = r.contract_id
                                                 where c3.device_model = c.device_model and c3.condition = c.condition), 0)
                  ) m
                  from public.care_contracts c
                  where c.status <> 'cancelado'
                  group by c.device_model, c.condition
                ) x)
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- RLS e privilégios
-- ---------------------------------------------------------------------------

alter table public.care_settings enable row level security;
alter table public.care_condition_rules enable row level security;
alter table public.care_benefits enable row level security;
alter table public.care_model_rules enable row level security;
alter table public.care_model_rule_bonuses enable row level security;
alter table public.care_contracts enable row level security;
alter table public.care_contract_installments enable row level security;
alter table public.care_contract_benefits enable row level security;
alter table public.care_service_requests enable row level security;
alter table public.care_contract_documents enable row level security;
alter table public.care_signature_sessions enable row level security;
alter table public.care_signature_events enable row level security;
alter table public.care_audit_log enable row level security;

do $$
declare
  t text;
begin
  -- Leitura da equipe (admin/vendedor).
  foreach t in array array[
    'care_settings', 'care_condition_rules', 'care_benefits', 'care_model_rules', 'care_model_rule_bonuses',
    'care_contracts', 'care_contract_installments', 'care_contract_benefits', 'care_service_requests',
    'care_contract_documents'
  ] loop
    execute format('drop policy if exists %I on public.%I', t || '_select', t);
    execute format(
      'create policy %I on public.%I for select to authenticated using ((select public.current_role()) in (''admin'', ''seller''))',
      t || '_select', t);
  end loop;

  -- Configuração comercial: escrita só do administrador.
  foreach t in array array['care_benefits', 'care_model_rules', 'care_model_rule_bonuses'] loop
    execute format('drop policy if exists %I on public.%I', t || '_admin_insert', t);
    execute format(
      'create policy %I on public.%I for insert to authenticated with check ((select public.current_role()) = ''admin'')',
      t || '_admin_insert', t);
    execute format('drop policy if exists %I on public.%I', t || '_admin_delete', t);
    execute format(
      'create policy %I on public.%I for delete to authenticated using ((select public.current_role()) = ''admin'')',
      t || '_admin_delete', t);
  end loop;
  foreach t in array array['care_settings', 'care_condition_rules', 'care_benefits', 'care_model_rules', 'care_model_rule_bonuses'] loop
    execute format('drop policy if exists %I on public.%I', t || '_admin_update', t);
    execute format(
      'create policy %I on public.%I for update to authenticated using ((select public.current_role()) = ''admin'') with check ((select public.current_role()) = ''admin'')',
      t || '_admin_update', t);
  end loop;
end;
$$;

drop policy if exists care_audit_log_admin_select on public.care_audit_log;
create policy care_audit_log_admin_select on public.care_audit_log
  for select to authenticated using ((select public.current_role()) = 'admin');
drop policy if exists care_signature_events_admin_select on public.care_signature_events;
create policy care_signature_events_admin_select on public.care_signature_events
  for select to authenticated using ((select public.current_role()) = 'admin');
-- care_signature_sessions: sem política → só service_role (verificadores de token/OTP nunca saem do servidor).

revoke all on public.care_settings, public.care_condition_rules, public.care_benefits, public.care_model_rules,
  public.care_model_rule_bonuses, public.care_contracts, public.care_contract_installments,
  public.care_contract_benefits, public.care_service_requests, public.care_contract_documents,
  public.care_signature_sessions, public.care_signature_events, public.care_audit_log from anon;
revoke insert, update, delete on public.care_contracts, public.care_contract_installments,
  public.care_contract_benefits, public.care_service_requests, public.care_contract_documents,
  public.care_signature_sessions, public.care_signature_events, public.care_audit_log from authenticated;
revoke all on public.care_signature_sessions from authenticated;

revoke all on function public.care_simulate(text, text, numeric) from public, anon;
revoke all on function public.care_quote_for_sale_item(text, text) from public, anon;
revoke all on function public.care_create_contract(text, text) from public, anon;
revoke all on function public.care_confirm_installment_payment(uuid, text, text, text) from public, anon;
revoke all on function public.care_deliver_benefit(uuid, text) from public, anon;
revoke all on function public.care_cancel_contract(uuid, text) from public, anon;
revoke all on function public.care_open_service_request(uuid, text, text) from public, anon;
revoke all on function public.care_update_service_request(uuid, text, text, numeric, numeric, boolean) from public, anon;
revoke all on function public.care_contract_dossier(uuid) from public, anon;
revoke all on function public.care_verify_event_chain(uuid) from public, anon;
revoke all on function public.care_dashboard(date, date) from public, anon;
grant execute on function public.care_simulate(text, text, numeric) to authenticated;
grant execute on function public.care_quote_for_sale_item(text, text) to authenticated;
grant execute on function public.care_create_contract(text, text) to authenticated;
grant execute on function public.care_confirm_installment_payment(uuid, text, text, text) to authenticated;
grant execute on function public.care_deliver_benefit(uuid, text) to authenticated;
grant execute on function public.care_cancel_contract(uuid, text) to authenticated;
grant execute on function public.care_open_service_request(uuid, text, text) to authenticated;
grant execute on function public.care_update_service_request(uuid, text, text, numeric, numeric, boolean) to authenticated;
grant execute on function public.care_contract_dossier(uuid) to authenticated;
grant execute on function public.care_verify_event_chain(uuid) to authenticated;
grant execute on function public.care_dashboard(date, date) to authenticated;

revoke all on function public.care_register_document(uuid, text, text, integer, text, uuid) from public, anon, authenticated;
revoke all on function public.care_open_signature_session(uuid, text, timestamptz, uuid) from public, anon, authenticated;
revoke all on function public.care_sign_session(uuid, text, text, text, jsonb) from public, anon, authenticated;
revoke all on function public.care_consume_otp_attempt(uuid) from public, anon, authenticated;
grant execute on function public.care_consume_otp_attempt(uuid) to service_role;
grant execute on function public.care_register_document(uuid, text, text, integer, text, uuid) to service_role;
grant execute on function public.care_open_signature_session(uuid, text, timestamptz, uuid) to service_role;
grant execute on function public.care_sign_session(uuid, text, text, text, jsonb) to service_role;

revoke all on function private.care_try_activate(uuid) from public, anon, authenticated;
revoke all on function private.care_compute_quote(text, text, numeric) from public, anon, authenticated;

-- Contratos, PDFs assinados e dossiês: bucket privado, acesso só por URL assinada emitida no servidor.
insert into storage.buckets (id, name, public)
values ('care-contracts', 'care-contracts', false)
on conflict (id) do nothing;

notify pgrst, 'reload schema';

commit;
