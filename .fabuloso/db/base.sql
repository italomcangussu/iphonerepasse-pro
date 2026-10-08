-- base.sql — DDL do schema remoto. Gerado por `fabuloso.mjs db`; não edite.
-- É a base do banco de teste em PGlite (`fabuloso.mjs pg`): schema real do remoto + migrations locais pendentes.
--@@ meta {"versao":1,"postgres":"17.6","schemas":["private","public"],"extensoes":[{"nome":"pg_cron","schema":"pg_catalog"},{"nome":"pg_stat_statements","schema":"extensions"},{"nome":"pgcrypto","schema":"extensions"},{"nome":"supabase_vault","schema":"vault"},{"nome":"uuid-ossp","schema":"extensions"}],"papeis":["anon","authenticated","authenticator","cli_login_postgres","dashboard_user","pgbouncer","postgres","service_role","supabase_auth_admin","supabase_etl_admin","supabase_privileged_role","supabase_read_only_user","supabase_realtime_admin","supabase_replication_admin","supabase_storage_admin"],"migracoes":["20260211124957","20260215173500","20260215175000","20260215213000","20260215232000","20260215235900","20260216090000","20260216103000","20260216123000","20260216150000","20260217103000","20260415183000","20260416113000","20260416143000","20260416154712","20260416155315","20260416162000","20260416162500","20260416170000","20260416174500","20260416191500","20260416220000","20260416230000","20260416231005","20260416233000","20260416234500","20260417125800","20260417141000","20260417194000","20260418123000","20260419093000","20260423120000","20260423193000","20260424140000","20260424150500","20260424160000","20260427000000","20260427133537","20260427133613","20260427200000","20260427210000","20260427220000","20260428000000","20260429000000","20260501000000","20260501090000","20260501120000","20260501121000","20260501130000","20260504130000","20260505161000","20260506164000","20260511125000","20260511161000","20260512090000","20260512120000","20260513205700","20260514155038","20260514160527","20260517120000","20260522170000","20260522170800","20260522174438","20260522180000","20260528130000","20260528133000","20260528160809","20260528161909","20260529130000","20260529143000","20260529162000","20260529163500","20260529170000","20260529171500","20260529173000","20260529174000","20260529174500","20260529175500","20260530120000","20260603120000","20260605120000","20260605134001","20260610150000","20260610154500","20260610161000","20260610162000","20260610162500","20260610175934","20260611181129","20260612143000","20260612144500","20260613134500","20260613150000","20260614160000","20260615120000","20260618150801","20260620230000","20260623160000","20260626120000","20260626120500","20260628120000","20260628130410","20260628140000","20260630182641","20260701130000","20260705120000","20260706151306","20260706153746","20260706190511","20260707143741","20260708120000","20260708150000","20260708154341","20260709150921","20260709151958","20260709153400","20260709153855","20260709154413","20260709154855","20260709160000","20260709160207","20260709161802","20260709162311","20260709163219","20260718120000","20260720120000","20260723120000","20260723150000","20260727190000","20260727205026","20260729170000","20260803120000","20260803132923","20260822120000","20260825160000","20260825200000","20260911011922","20260911113452","20260911113505","20260911113527","20260921181308","20260927205115","20260928212451","20260929131000"]}
--@@ 10 schema private
create schema if not exists private;
--@@ 30 sequencia public.app_user_activity_logs_id_seq
create sequence if not exists public.app_user_activity_logs_id_seq as bigint increment by 1 minvalue 1 maxvalue 9223372036854775807 start with 1 cache 1;
--@@ 30 sequencia public.sales_sale_number_seq
create sequence if not exists public.sales_sale_number_seq as bigint increment by 1 minvalue 1 maxvalue 9223372036854775807 start with 1 cache 1;
--@@ 40 tabela public.account_deletion_requests
create table public.account_deletion_requests (
  id uuid not null,
  user_id uuid not null,
  requested_at timestamp with time zone not null,
  scheduled_delete_at timestamp with time zone not null,
  cancelled_at timestamp with time zone,
  completed_at timestamp with time zone,
  reason text
);
--@@ 40 tabela public.admin_agent_audit_log
create table public.admin_agent_audit_log (
  id uuid not null,
  phone text,
  user_id uuid,
  action text not null,
  params jsonb not null,
  result jsonb,
  status text not null,
  error text,
  created_at timestamp with time zone not null
);
--@@ 40 tabela public.admin_agent_numbers
create table public.admin_agent_numbers (
  id uuid not null,
  phone text not null,
  user_id uuid not null,
  label text,
  is_active boolean not null,
  created_at timestamp with time zone not null,
  updated_at timestamp with time zone not null
);
--@@ 40 tabela public.admin_agent_pending_actions
create table public.admin_agent_pending_actions (
  id uuid not null,
  phone text not null,
  user_id uuid not null,
  channel_id text,
  conversation_id text,
  action text not null,
  params jsonb not null,
  summary text not null,
  status text not null,
  expires_at timestamp with time zone not null,
  created_at timestamp with time zone not null,
  resolved_at timestamp with time zone
);
--@@ 40 tabela public.ai_turn_events
create table public.ai_turn_events (
  id uuid not null,
  turn_id text not null,
  conversation_id uuid,
  lead_id text not null,
  store_id text not null,
  action text not null,
  outcome text,
  duration_ms integer,
  stage_timings jsonb not null,
  metadata jsonb not null,
  created_at timestamp with time zone not null
);
--@@ 40 tabela public.app_role_permissions
create table public.app_role_permissions (
  role text not null,
  permission_key text not null,
  label text not null,
  is_visible boolean not null,
  is_editable boolean not null,
  is_deletable boolean not null,
  created_at timestamp with time zone not null,
  updated_at timestamp with time zone not null
);
--@@ 40 tabela public.app_user_activity_logs
create table public.app_user_activity_logs (
  id bigint not null,
  user_id uuid not null,
  user_email text,
  app_role text not null,
  category text not null,
  action text not null,
  screen text,
  metadata jsonb not null,
  occurred_at timestamp with time zone not null
);
--@@ 40 tabela public.business_profile
create table public.business_profile (
  id text not null,
  name text not null,
  cnpj text,
  phone text,
  email text,
  address text,
  instagram text,
  logo_url text,
  primary_color text,
  created_at timestamp with time zone,
  updated_at timestamp with time zone
);
--@@ 40 tabela public.card_fee_settings
create table public.card_fee_settings (
  id text not null,
  visa_master_rates jsonb not null,
  other_rates jsonb not null,
  created_at timestamp with time zone not null,
  updated_at timestamp with time zone not null,
  debit_rate numeric not null
);
--@@ 40 tabela public.cost_history
create table public.cost_history (
  id text not null,
  model text not null,
  description text not null,
  amount numeric not null,
  count integer,
  last_used timestamp with time zone,
  created_at timestamp with time zone,
  updated_at timestamp with time zone
);
--@@ 40 tabela public.costs
create table public.costs (
  id text not null,
  stock_item_id text,
  description text not null,
  amount numeric not null,
  date timestamp with time zone,
  created_at timestamp with time zone,
  part_id text,
  part_quantity numeric
);
--@@ 40 tabela public.creditors
create table public.creditors (
  id text not null,
  name text not null,
  document text,
  document_type text,
  phone text,
  email text,
  notes text,
  created_at timestamp with time zone not null,
  updated_at timestamp with time zone not null
);
--@@ 40 tabela public.crm_ai_agent_configs
create table public.crm_ai_agent_configs (
  id uuid not null,
  store_id text not null,
  name text not null,
  model text not null,
  system_prompt text,
  config jsonb not null,
  is_active boolean not null,
  created_at timestamp with time zone not null,
  updated_at timestamp with time zone not null,
  endpoint_url text,
  behavior_modes text[] not null,
  auto_send_response boolean not null,
  require_human_approval boolean not null,
  trigger_conditions jsonb not null,
  channel_ids uuid[] not null,
  total_invocations integer not null,
  total_successes integer not null,
  total_failures integer not null,
  routing_mode text not null,
  routing_priority integer not null,
  traffic_weight integer not null
);
--@@ 40 tabela public.crm_ai_agent_invocations
create table public.crm_ai_agent_invocations (
  id uuid not null,
  store_id text not null,
  agent_config_id uuid,
  routing_rule_id uuid,
  source text not null,
  status text not null,
  routing_reason text,
  metadata jsonb not null,
  created_at timestamp with time zone not null
);
--@@ 40 tabela public.crm_ai_entry_settings
create table public.crm_ai_entry_settings (
  id uuid not null,
  store_id text not null,
  is_enabled boolean not null,
  fallback_mode text not null,
  reopen_hours integer not null,
  business_hours jsonb not null,
  special_business_hours jsonb not null,
  rules jsonb not null,
  created_at timestamp with time zone not null,
  updated_at timestamp with time zone not null
);
--@@ 40 tabela public.crm_attendance_scripts
create table public.crm_attendance_scripts (
  id uuid not null,
  store_id text not null,
  name text not null,
  context text not null,
  script_content text not null,
  is_active boolean not null,
  created_at timestamp with time zone not null,
  updated_at timestamp with time zone not null
);
--@@ 40 tabela public.crm_auth_handoffs
create table public.crm_auth_handoffs (
  id uuid not null,
  code text not null,
  user_id uuid not null,
  store_id text,
  access_token text not null,
  refresh_token text not null,
  target_path text,
  expires_at timestamp with time zone not null,
  consumed_at timestamp with time zone,
  created_at timestamp with time zone not null
);
--@@ 40 tabela public.crm_automation_rules
create table public.crm_automation_rules (
  id uuid not null,
  store_id text not null,
  channel_id uuid,
  description text not null,
  trigger_type text not null,
  message_content text not null,
  delay_minutes integer not null,
  funnel_stage text,
  switch_to_human_handling boolean not null,
  message_variants jsonb not null,
  metrics jsonb not null,
  is_active boolean not null,
  created_by uuid,
  created_at timestamp with time zone not null,
  updated_at timestamp with time zone not null
);
--@@ 40 tabela public.crm_broadcast_recipients
create table public.crm_broadcast_recipients (
  id uuid not null,
  broadcast_id uuid not null,
  store_id text not null,
  lead_id text not null,
  conversation_id uuid,
  channel_id uuid,
  status text not null,
  error_message text,
  provider_message_id text,
  sent_at timestamp with time zone,
  created_at timestamp with time zone not null
);
--@@ 40 tabela public.crm_broadcasts
create table public.crm_broadcasts (
  id uuid not null,
  store_id text not null,
  channel_id uuid,
  name text not null,
  message_template text not null,
  recipient_filters jsonb not null,
  status text not null,
  scheduled_for timestamp with time zone,
  sent_at timestamp with time zone,
  created_by uuid,
  created_at timestamp with time zone not null,
  updated_at timestamp with time zone not null
);
--@@ 40 tabela public.crm_channel_store_links
create table public.crm_channel_store_links (
  id uuid not null,
  channel_id uuid not null,
  store_id text not null,
  is_active boolean not null,
  created_at timestamp with time zone not null,
  updated_at timestamp with time zone not null
);
--@@ 40 tabela public.crm_channels
create table public.crm_channels (
  id uuid not null,
  store_id text not null,
  name text not null,
  phone_number text not null,
  api_endpoint text,
  api_key text,
  is_active boolean,
  created_at timestamp with time zone,
  updated_at timestamp with time zone,
  provider text not null,
  uaz_subdomain text not null,
  webhook_secret text,
  instagram_verify_token text,
  instagram_ig_user_id text,
  instagram_username text,
  instagram_access_token text,
  use_for_manual boolean not null,
  use_for_automation boolean not null,
  inbound_funnel_id uuid,
  inbound_funnel_stage text,
  uaz_instance_token text,
  uaz_admin_token text,
  uaz_instance_name text,
  uaz_webhook_id text,
  uaz_connection_status text not null,
  uaz_last_status jsonb not null,
  uaz_last_status_at timestamp with time zone,
  ai_resume_webhook_url text,
  ai_entry_mode text not null,
  is_admin_console boolean not null
);
--@@ 40 tabela public.crm_conversations
create table public.crm_conversations (
  id uuid not null,
  store_id text not null,
  lead_id text not null,
  channel_id uuid,
  talk_id text,
  status text,
  assigned_to uuid,
  ai_enabled boolean,
  unread_count integer,
  message_count integer,
  last_message_at timestamp with time zone,
  last_customer_message_at timestamp with time zone,
  last_response_at timestamp with time zone,
  created_at timestamp with time zone,
  updated_at timestamp with time zone,
  is_group boolean not null,
  group_name text,
  group_avatar_url text
);
--@@ 40 tabela public.crm_custom_fields
create table public.crm_custom_fields (
  id uuid not null,
  store_id text not null,
  key text not null,
  label text not null,
  field_type text not null,
  options jsonb not null,
  is_required boolean not null,
  is_active boolean not null,
  created_at timestamp with time zone not null,
  updated_at timestamp with time zone not null
);
--@@ 40 tabela public.crm_dispatch_runtime
create table public.crm_dispatch_runtime (
  id text not null,
  worker_name text not null,
  last_run_at timestamp with time zone,
  lock_until timestamp with time zone,
  metadata jsonb not null,
  updated_at timestamp with time zone not null
);
--@@ 40 tabela public.crm_event_log
create table public.crm_event_log (
  id uuid not null,
  store_id text not null,
  event_type text not null,
  payload jsonb,
  is_outbound boolean,
  created_at timestamp with time zone,
  webhook_url text,
  sent boolean,
  sent_at timestamp with time zone,
  error_message text,
  retry_count integer,
  processed boolean,
  processed_at timestamp with time zone,
  subscription_id uuid,
  channel_id uuid,
  lead_id text,
  conversation_id uuid
);
--@@ 40 tabela public.crm_filter_views
create table public.crm_filter_views (
  id uuid not null,
  user_id uuid not null,
  store_id text,
  name text not null,
  filters_json jsonb not null,
  is_shared boolean not null,
  created_at timestamp with time zone not null,
  updated_at timestamp with time zone not null
);
--@@ 40 tabela public.crm_follow_up_tracker
create table public.crm_follow_up_tracker (
  id uuid not null,
  lead_id text not null,
  automation_rule_id uuid,
  attempt_count integer,
  last_attempt_at timestamp with time zone,
  next_attempt_at timestamp with time zone,
  max_attempts integer,
  is_completed boolean,
  completed_at timestamp with time zone,
  completion_reason text,
  created_at timestamp with time zone
);
--@@ 40 tabela public.crm_funnel_stages
create table public.crm_funnel_stages (
  id text not null,
  funnel_type text not null,
  name text not null,
  color text not null,
  "order" integer not null,
  is_won boolean,
  is_lost boolean,
  is_active boolean,
  created_at timestamp with time zone,
  updated_at timestamp with time zone
);
--@@ 40 tabela public.crm_funnels
create table public.crm_funnels (
  id uuid not null,
  store_id text not null,
  channel_id uuid,
  name text not null,
  description text,
  stages jsonb not null,
  funnel_type text not null,
  is_default boolean,
  is_active boolean,
  created_at timestamp with time zone,
  updated_at timestamp with time zone
);
--@@ 40 tabela public.crm_instagram_comment_events
create table public.crm_instagram_comment_events (
  id uuid not null,
  store_id text not null,
  channel_id uuid not null,
  lead_id text,
  conversation_id uuid,
  source_message_id uuid,
  comment_id text not null,
  parent_comment_id text,
  media_id text,
  media_surface text,
  actor_igscoped_id text,
  actor_username text,
  direction text not null,
  event_type text not null,
  reply_mode text,
  status text not null,
  content text,
  provider_message_id text,
  external_id text,
  webhook_payload jsonb,
  metadata jsonb not null,
  provider_error jsonb,
  event_created_at timestamp with time zone,
  created_at timestamp with time zone not null,
  updated_at timestamp with time zone not null
);
--@@ 40 tabela public.crm_instagram_media_snapshots
create table public.crm_instagram_media_snapshots (
  id uuid not null,
  store_id text not null,
  channel_id uuid not null,
  media_id text not null,
  media_type text,
  surface text,
  caption text,
  permalink text,
  media_url text,
  thumbnail_url text,
  metadata jsonb not null,
  created_at timestamp with time zone not null,
  updated_at timestamp with time zone not null
);
--@@ 40 tabela public.crm_lead_custom_field_values
create table public.crm_lead_custom_field_values (
  id uuid not null,
  store_id text not null,
  lead_id text not null,
  field_id uuid not null,
  value jsonb not null,
  created_at timestamp with time zone not null,
  updated_at timestamp with time zone not null
);
--@@ 40 tabela public.crm_lead_identities
create table public.crm_lead_identities (
  id uuid not null,
  lead_id text not null,
  store_id text not null,
  identity_type text not null,
  identity_value text not null,
  identity_value_normalized text generated always as (lower(btrim(identity_value))) stored,
  is_primary boolean not null,
  metadata jsonb not null,
  created_at timestamp with time zone not null,
  updated_at timestamp with time zone not null
);
--@@ 40 tabela public.crm_lead_stage_history
create table public.crm_lead_stage_history (
  id uuid not null,
  lead_id text not null,
  from_stage text,
  to_stage text,
  changed_by uuid,
  notes text,
  created_at timestamp with time zone,
  store_id text
);
--@@ 40 tabela public.crm_leads
create table public.crm_leads (
  id text not null,
  store_id text not null,
  customer_id text,
  phone text not null,
  name text,
  email text,
  avatar_url text,
  avatar_lead_updated boolean,
  contact_id text,
  entity_id text,
  source_channel_id uuid,
  utm_source text,
  utm_campaign text,
  utm_medium text,
  utm_content text,
  utm_term text,
  first_message text,
  funnel_id uuid,
  funnel_stage text,
  lifetime_value numeric,
  is_customer boolean,
  tags text[],
  intent text,
  last_auto_followup_at timestamp with time zone,
  first_contact_at timestamp with time zone,
  last_message_at timestamp with time zone,
  last_interaction_at timestamp with time zone,
  created_at timestamp with time zone,
  updated_at timestamp with time zone,
  phone_normalized text generated always as (normalize_phone(phone)) stored,
  purchase_count integer not null,
  last_purchase_at timestamp with time zone,
  last_order_id text,
  last_order_at timestamp with time zone,
  last_order_value numeric,
  last_order_summary text,
  source text,
  source_campaign_id text,
  source_campaign_title text,
  conversation_status text,
  attendance_owner text,
  handoff_at timestamp with time zone,
  human_started_at timestamp with time zone,
  last_agent_type text,
  summary_operational text,
  summary_short text,
  last_message_content text,
  first_name text,
  sales_stage text not null,
  last_event_name text,
  last_event_at timestamp with time zone,
  source_ad_context jsonb,
  avatar_last_checked_at timestamp with time zone,
  avatar_refreshed_at timestamp with time zone,
  avatar_storage_path text,
  avatar_content_hash text,
  avatar_missing_count integer not null,
  avatar_missing_since timestamp with time zone
);
--@@ 40 tabela public.crm_message_templates
create table public.crm_message_templates (
  id uuid not null,
  store_id text not null,
  channel_id uuid,
  name text not null,
  category text not null,
  content text not null,
  variables jsonb not null,
  is_active boolean not null,
  created_at timestamp with time zone not null,
  updated_at timestamp with time zone not null
);
--@@ 40 tabela public.crm_messages
create table public.crm_messages (
  id uuid not null,
  conversation_id uuid not null,
  store_id text,
  channel_id uuid,
  direction text not null,
  sender_type text not null,
  content text,
  media_url text,
  media_type text,
  external_id text,
  webhook_payload jsonb,
  status text,
  error_message text,
  sent_at timestamp with time zone,
  delivered_at timestamp with time zone,
  read_at timestamp with time zone,
  created_at timestamp with time zone,
  lead_id text,
  provider_message_id text,
  event_origin text,
  provider_error jsonb,
  reply_to_provider_message_id text,
  reply_preview_text text,
  reaction_target_provider_message_id text,
  reaction_emoji text,
  sender_user_id uuid,
  sender_display_name text
);
--@@ 40 tabela public.crm_meta_ads_attributions
create table public.crm_meta_ads_attributions (
  id uuid not null,
  store_id text not null,
  lead_id text,
  message_id uuid,
  group_key uuid not null,
  source_app text not null,
  raw_source_id text,
  detected_at timestamp with time zone not null,
  metadata jsonb not null,
  created_at timestamp with time zone not null
);
--@@ 40 tabela public.crm_meta_ads_groups
create table public.crm_meta_ads_groups (
  id uuid not null,
  store_id text not null,
  group_key uuid not null,
  creative_signature text not null,
  source_app text not null,
  auto_name text,
  status text not null,
  sample_title text,
  sample_body text,
  sample_media_url text,
  sample_source_url text,
  sample_thumbnail_url text,
  first_seen_at timestamp with time zone,
  last_seen_at timestamp with time zone,
  total_attributions integer not null,
  metrics jsonb not null,
  created_at timestamp with time zone not null,
  updated_at timestamp with time zone not null
);
--@@ 40 tabela public.crm_public_registration_links
create table public.crm_public_registration_links (
  id uuid not null,
  store_id text not null,
  lead_id text not null,
  token text not null,
  slug text not null,
  utm_source text,
  utm_campaign text,
  is_active boolean not null,
  expires_at timestamp with time zone,
  metadata jsonb not null,
  created_at timestamp with time zone not null,
  updated_at timestamp with time zone not null
);
--@@ 40 tabela public.crm_scheduled_messages
create table public.crm_scheduled_messages (
  id uuid not null,
  lead_id text not null,
  conversation_id uuid,
  automation_rule_id uuid,
  channel_id uuid,
  message_content text,
  media_url text,
  media_type text,
  scheduled_for timestamp with time zone not null,
  status text,
  error_message text,
  retry_count integer,
  sent_at timestamp with time zone,
  message_id text,
  created_at timestamp with time zone,
  store_id text,
  metadata jsonb,
  updated_at timestamp with time zone
);
--@@ 40 tabela public.crm_settings
create table public.crm_settings (
  id text not null,
  value_bool boolean not null,
  updated_at timestamp with time zone not null,
  value_text text
);
--@@ 40 tabela public.crm_uaz_avatar_jobs
create table public.crm_uaz_avatar_jobs (
  id uuid not null,
  store_id text not null,
  lead_id text not null,
  channel_id uuid not null,
  conversation_id uuid,
  talk_id text not null,
  status text not null,
  attempts integer not null,
  force_refresh boolean not null,
  available_at timestamp with time zone not null,
  lease_expires_at timestamp with time zone,
  last_error_code text,
  created_at timestamp with time zone not null,
  updated_at timestamp with time zone not null
);
--@@ 40 tabela public.crm_ui_preferences
create table public.crm_ui_preferences (
  id uuid not null,
  store_id text not null,
  user_id uuid not null,
  last_page text,
  last_tab text,
  saved_filters jsonb not null,
  density text not null,
  created_at timestamp with time zone not null,
  updated_at timestamp with time zone not null
);
--@@ 40 tabela public.crm_utm_config
create table public.crm_utm_config (
  id uuid not null,
  store_id text not null,
  source_key text not null,
  campaign_key text not null,
  medium_key text,
  default_channel_id uuid,
  is_active boolean not null,
  created_at timestamp with time zone not null,
  updated_at timestamp with time zone not null
);
--@@ 40 tabela public.crm_webhook_subscriptions
create table public.crm_webhook_subscriptions (
  id uuid not null,
  store_id text,
  name text not null,
  url text not null,
  secret text,
  subscribed_events text[] not null,
  is_active boolean not null,
  failure_count integer not null,
  last_success_at timestamp with time zone,
  last_error_at timestamp with time zone,
  last_error_message text,
  created_at timestamp with time zone not null,
  updated_at timestamp with time zone not null
);
--@@ 40 tabela public.customers
create table public.customers (
  id text not null,
  name text not null,
  cpf text,
  phone text,
  email text,
  birth_date text,
  purchases integer,
  total_spent numeric,
  created_at timestamp with time zone,
  updated_at timestamp with time zone,
  alternative_phone text
);
--@@ 40 tabela public.debt_payments
create table public.debt_payments (
  id text not null,
  debt_id text not null,
  amount numeric not null,
  payment_method text not null,
  account text not null,
  paid_at timestamp with time zone not null,
  notes text,
  created_at timestamp with time zone not null
);
--@@ 40 tabela public.debts
create table public.debts (
  id text not null,
  customer_id text not null,
  sale_id text,
  original_amount numeric not null,
  remaining_amount numeric not null,
  status text not null,
  due_date date,
  notes text,
  source text not null,
  created_at timestamp with time zone not null,
  updated_at timestamp with time zone not null,
  installments_total integer not null,
  first_due_date date,
  custom_badge text,
  entry_account text
);
--@@ 40 tabela public.device_catalog
create table public.device_catalog (
  id text not null,
  type text not null,
  model text not null,
  color text not null,
  created_by uuid,
  created_at timestamp with time zone not null,
  updated_at timestamp with time zone not null
);
--@@ 40 tabela public.finance_categories
create table public.finance_categories (
  id text not null,
  name text not null,
  type text not null,
  is_default boolean not null,
  created_at timestamp with time zone not null,
  updated_at timestamp with time zone not null
);
--@@ 40 tabela public.lead_state
create table public.lead_state (
  lead_id text not null,
  interest_type text,
  desired_model text,
  desired_capacity text,
  desired_color text,
  desired_condition text,
  has_tradein boolean not null,
  tradein_model text,
  tradein_model_accepted boolean,
  tradein_rejected_reason text,
  tradein_capacity text,
  tradein_color text,
  tradein_scratches boolean,
  tradein_liquid_contact boolean,
  tradein_side_marks boolean,
  tradein_parts_swapped boolean,
  tradein_has_box_cable text,
  tradein_battery_pct integer,
  tradein_battery_suspect boolean not null,
  tradein_apple_warranty boolean,
  tradein_warranty_until text,
  tradein_disqualified boolean not null,
  preferred_city text,
  stock_city text,
  cross_city_situation boolean not null,
  stock_item_id text,
  hdi_city_needed boolean not null,
  client_outside_ce boolean not null,
  card_brand text,
  simulation_done boolean not null,
  simulation_count integer not null,
  last_simulation_total numeric(10,2),
  secondary_color_simulation text,
  proposal_accepted boolean not null,
  reservation_intent boolean not null,
  pix_data_sent boolean not null,
  pix_paid boolean not null,
  pix_amount numeric(10,2),
  pickup_datetime timestamp with time zone,
  pickup_city text,
  cadastro_solicitado boolean not null,
  cadastro_nome_completo text,
  cadastro_data_nascimento text,
  cadastro_cpf text,
  cadastro_contato text,
  cadastro_completo boolean not null,
  created_at timestamp with time zone not null,
  updated_at timestamp with time zone not null,
  commerce_state jsonb not null,
  tradein_assessment jsonb not null,
  quote_versions jsonb not null,
  state_version bigint not null,
  cash_entry_asked boolean not null,
  cash_entry_intent boolean,
  cash_entry_amount numeric(10,2),
  tradein_asked boolean not null
);
--@@ 40 tabela public.parts_inventory
create table public.parts_inventory (
  id text not null,
  name text not null,
  quantity integer not null,
  unit_cost numeric not null,
  created_at timestamp with time zone not null,
  updated_at timestamp with time zone not null
);
--@@ 40 tabela public.payable_debt_payments
create table public.payable_debt_payments (
  id text not null,
  payable_debt_id text not null,
  amount numeric not null,
  payment_method text not null,
  account text not null,
  paid_at timestamp with time zone not null,
  notes text,
  attachment_path text,
  attachment_mime text,
  attachment_name text,
  attachment_size integer,
  created_at timestamp with time zone not null
);
--@@ 40 tabela public.payable_debts
create table public.payable_debts (
  id text not null,
  creditor_id text not null,
  creditor_name text not null,
  creditor_document text,
  creditor_phone text,
  original_amount numeric not null,
  remaining_amount numeric not null,
  status text not null,
  due_date date,
  first_due_date date,
  installments_total integer not null,
  notes text,
  source text not null,
  created_at timestamp with time zone not null,
  updated_at timestamp with time zone not null,
  sale_id text,
  entry_account text
);
--@@ 40 tabela public.payment_methods
create table public.payment_methods (
  id text not null,
  sale_id text,
  type text not null,
  amount numeric not null,
  installments integer,
  created_at timestamp with time zone,
  debt_due_date date,
  debt_notes text,
  account text,
  card_brand text,
  customer_amount numeric,
  fee_rate numeric,
  fee_amount numeric,
  debt_installments integer,
  source text,
  reservation_id text,
  reservation_deposit_transaction_id text
);
--@@ 40 tabela public.push_subscriptions
create table public.push_subscriptions (
  id uuid not null,
  user_id uuid not null,
  store_id text,
  endpoint text not null,
  p256dh text not null,
  auth text not null,
  user_agent text,
  platform text,
  topics text[] not null,
  is_active boolean not null,
  last_seen_at timestamp with time zone not null,
  last_error_at timestamp with time zone,
  last_error_message text,
  created_at timestamp with time zone not null,
  product text not null
);
--@@ 40 tabela public.reservation_message_settings
create table public.reservation_message_settings (
  id text not null,
  template text not null,
  send_by_default boolean not null,
  created_at timestamp with time zone not null,
  updated_at timestamp with time zone not null
);
--@@ 40 tabela public.sale_items
create table public.sale_items (
  id text not null,
  sale_id text,
  stock_item_id text,
  price numeric not null,
  created_at timestamp with time zone,
  original_price numeric
);
--@@ 40 tabela public.sale_trade_in_items
create table public.sale_trade_in_items (
  id text not null,
  sale_id text not null,
  stock_item_id text,
  model text not null,
  capacity text,
  color text,
  imei text,
  condition text,
  received_value numeric not null,
  created_at timestamp with time zone not null,
  updated_at timestamp with time zone not null
);
--@@ 40 tabela public.sales
create table public.sales (
  id text not null,
  customer_id text,
  seller_id text,
  total numeric not null,
  discount numeric,
  date timestamp with time zone,
  warranty_expires_at timestamp with time zone,
  trade_in_id text,
  trade_in_value numeric,
  created_at timestamp with time zone,
  updated_at timestamp with time zone,
  discount_type text,
  discount_percent numeric,
  original_subtotal numeric not null,
  negotiated_subtotal numeric not null,
  store_id text,
  client_payment_amount numeric,
  client_payment_mode text,
  client_payment_account text,
  client_payment_method text,
  client_payment_notes text,
  client_payment_due_date date,
  commission numeric not null,
  sale_number bigint not null,
  crm_lead_id text
);
--@@ 40 tabela public.sellers
create table public.sellers (
  id text not null,
  name text not null,
  total_sales numeric,
  created_at timestamp with time zone,
  updated_at timestamp with time zone,
  email text,
  auth_user_id uuid,
  store_id text
);
--@@ 40 tabela public.simulator_trade_in_adjustments
create table public.simulator_trade_in_adjustments (
  id uuid not null,
  label text not null,
  model text,
  capacity text,
  amount_delta numeric(12,2) not null,
  is_active boolean not null,
  created_at timestamp with time zone not null,
  updated_at timestamp with time zone not null
);
--@@ 40 tabela public.simulator_trade_in_values
create table public.simulator_trade_in_values (
  id uuid not null,
  model text not null,
  capacity text not null,
  base_value numeric(12,2) not null,
  is_active boolean not null,
  created_at timestamp with time zone not null,
  updated_at timestamp with time zone not null
);
--@@ 40 tabela public.stock_items
create table public.stock_items (
  id text not null,
  type text not null,
  model text not null,
  color text,
  capacity text,
  imei text,
  condition text not null,
  status text not null,
  battery_health integer,
  store_id text,
  purchase_price numeric,
  sell_price numeric,
  max_discount numeric,
  warranty_type text,
  warranty_end date,
  origin text,
  notes text,
  entry_date timestamp with time zone,
  photos text[],
  created_at timestamp with time zone,
  updated_at timestamp with time zone,
  has_box boolean not null,
  observations text,
  sim_type text,
  ram text
);
--@@ 40 tabela public.stock_reservations
create table public.stock_reservations (
  id text not null,
  stock_item_id text not null,
  customer_name text not null,
  customer_phone text not null,
  reserved_at timestamp with time zone not null,
  expires_at timestamp with time zone,
  deposit_amount numeric(10,2),
  deposit_payment_method text,
  notes text,
  status text not null,
  released_at timestamp with time zone,
  sold_at timestamp with time zone,
  created_at timestamp with time zone not null,
  updated_at timestamp with time zone not null,
  deposit_transaction_id text,
  deposit_refund_transaction_id text,
  deposit_refunded_at timestamp with time zone,
  deposit_retained_at timestamp with time zone,
  sold_sale_id text,
  seller_id text,
  created_by uuid,
  seller_name text
);
--@@ 40 tabela public.stores
create table public.stores (
  id text not null,
  name text not null,
  city text not null,
  created_at timestamp with time zone,
  updated_at timestamp with time zone
);
--@@ 40 tabela public.transactions
create table public.transactions (
  id text not null,
  type text not null,
  category text not null,
  amount numeric not null,
  date timestamp with time zone,
  description text,
  account text not null,
  sale_id text,
  created_at timestamp with time zone,
  updated_at timestamp with time zone,
  debt_payment_id text,
  payable_debt_payment_id text,
  payable_debt_id text,
  transfer_group_id text,
  debt_id text
);
--@@ 40 tabela public.user_access_roles
create table public.user_access_roles (
  user_id uuid not null,
  app_role text not null,
  display_name text not null,
  email text not null,
  created_by uuid,
  created_at timestamp with time zone not null,
  updated_at timestamp with time zone not null
);
--@@ 40 tabela public.user_consents
create table public.user_consents (
  id uuid not null,
  user_id uuid not null,
  consent_key text not null,
  granted boolean not null,
  policy_version text not null,
  granted_at timestamp with time zone not null,
  revoked_at timestamp with time zone,
  user_agent text
);
--@@ 40 tabela public.user_profiles
create table public.user_profiles (
  id uuid not null,
  role text not null,
  seller_id text,
  created_at timestamp with time zone not null,
  updated_at timestamp with time zone not null
);
--@@ 40 tabela public.warranty_public_tokens
create table public.warranty_public_tokens (
  id uuid not null,
  sale_id text not null,
  token_hash text not null,
  expires_at timestamp with time zone not null,
  revoked_at timestamp with time zone,
  created_by uuid,
  created_at timestamp with time zone not null,
  last_accessed_at timestamp with time zone
);
--@@ 45 funcao private.admin_agent_assert_admin(p_actor uuid)
CREATE OR REPLACE FUNCTION private.admin_agent_assert_admin(p_actor uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'private'
AS $function$
begin
  if p_actor is null or not exists (
    select 1 from public.user_profiles up
    where up.id = p_actor and up.role = 'admin'
  ) then
    raise exception 'Ator não é administrador autorizado.'
      using errcode = '42501';
  end if;
end;
$function$;
--@@ 45 funcao private.customers_normalize_birth_date()
CREATE OR REPLACE FUNCTION private.customers_normalize_birth_date()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public', 'private'
AS $function$
begin
  new.birth_date := private.normalize_birth_day_month(new.birth_date);
  return new;
end;
$function$;
--@@ 45 funcao private.normalize_birth_day_month(p_value text)
CREATE OR REPLACE FUNCTION private.normalize_birth_day_month(p_value text)
 RETURNS text
 LANGUAGE plpgsql
 IMMUTABLE
 SET search_path TO 'public', 'private'
AS $function$
declare
  v text := nullif(btrim(coalesce(p_value, '')), '');
  v_day int;
  v_month int;
  v_max int[] := array[31, 29, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
begin
  if v is null then
    return null;
  end if;

  if v ~ '^\d{4}-\d{2}-\d{2}' then          -- YYYY-MM-DD (ano ignorado)
    v_month := substr(v, 6, 2)::int;
    v_day := substr(v, 9, 2)::int;
  elsif v ~ '^\d{2}-\d{2}$' then             -- MM-DD
    v_month := substr(v, 1, 2)::int;
    v_day := substr(v, 4, 2)::int;
  elsif v ~ '^\d{1,2}/\d{1,2}(/\d{2,4})?$' then  -- DD/MM[/AAAA]
    v_day := split_part(v, '/', 1)::int;
    v_month := split_part(v, '/', 2)::int;
  else
    raise exception 'Data de nascimento inválida: use DD/MM.' using errcode = '22007';
  end if;

  if v_month < 1 or v_month > 12 or v_day < 1 or v_day > v_max[v_month] then
    raise exception 'Data de nascimento inválida: use DD/MM.' using errcode = '22007';
  end if;

  return lpad(v_month::text, 2, '0') || '-' || lpad(v_day::text, 2, '0');
end;
$function$;
--@@ 45 funcao private.transfer_between_accounts_impl(p_amount numeric, p_from
CREATE OR REPLACE FUNCTION private.transfer_between_accounts_impl(p_amount numeric, p_from text, p_to text)
 RETURNS SETOF transactions
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_from text := nullif(pg_catalog.btrim(p_from), '');
  v_to text := nullif(pg_catalog.btrim(p_to), '');
  v_transfer_group_id text := 'trf_' || pg_catalog.replace(pg_catalog.gen_random_uuid()::text, '-', '');
  v_transfer_date timestamptz := pg_catalog.now();
  v_balance numeric;
begin
  if public.current_role() is distinct from 'admin' then
    raise exception 'Apenas administradores podem transferir entre contas.'
      using errcode = '42501';
  end if;

  if p_amount is null or p_amount <= 0 then
    raise exception 'Informe um valor valido.'
      using errcode = '22023';
  end if;

  if v_from not in ('Conta Bancária', 'Cofre') or v_to not in ('Conta Bancária', 'Cofre') then
    raise exception 'Conta de transferencia invalida.'
      using errcode = '22023';
  end if;

  if v_from = v_to then
    raise exception 'Selecione contas diferentes para transferir.'
      using errcode = '22023';
  end if;

  -- Serialize consumers of the same source balance until commit or rollback.
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('finance-transfer:' || v_from, 0));

  select coalesce(
      pg_catalog.sum(case when trx.type = 'IN' then trx.amount else -trx.amount end),
      0
    )
    into v_balance
    from public.transactions as trx
    where trx.account = v_from;

  if v_balance < p_amount - 0.001 then
    raise exception 'Saldo insuficiente em %.', v_from
      using errcode = '22023';
  end if;

  return query
  insert into public.transactions (
    id, type, category, amount, date, description, account, transfer_group_id
  )
  values
    (
      'trx_' || pg_catalog.replace(pg_catalog.gen_random_uuid()::text, '-', ''),
      'OUT',
      'Transferência',
      p_amount,
      v_transfer_date,
      'Transferência para ' || v_to,
      v_from,
      v_transfer_group_id
    ),
    (
      'trx_' || pg_catalog.replace(pg_catalog.gen_random_uuid()::text, '-', ''),
      'IN',
      'Transferência',
      p_amount,
      v_transfer_date,
      'Transferência de ' || v_from,
      v_to,
      v_transfer_group_id
    )
  returning *;
end;
$function$;
--@@ 45 funcao public."current_role"()
CREATE OR REPLACE FUNCTION public."current_role"()
 RETURNS text
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select up.role
  from public.user_profiles up
  where up.id = auth.uid()
  limit 1;
$function$;
--@@ 45 funcao public.add_lead_note(p_lead_id text, p_note text, p_created_by 
CREATE OR REPLACE FUNCTION public.add_lead_note(p_lead_id text, p_note text, p_created_by uuid DEFAULT NULL::uuid)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_conversation_id uuid;
  v_store_id text;
  v_message_id uuid;
begin
  if p_lead_id is null or btrim(p_note) = '' then
    raise exception 'lead_id and note are required';
  end if;

  select l.store_id into v_store_id
  from public.crm_leads l
  where l.id = p_lead_id
  limit 1;

  if v_store_id is null then
    raise exception 'Lead not found';
  end if;

  select c.id into v_conversation_id
  from public.crm_conversations c
  where c.lead_id = p_lead_id
  order by c.updated_at desc nulls last
  limit 1;

  if v_conversation_id is null then
    insert into public.crm_conversations (store_id, lead_id, status, ai_enabled)
    values (v_store_id, p_lead_id, 'open', true)
    returning id into v_conversation_id;
  end if;

  insert into public.crm_messages (
    conversation_id,
    lead_id,
    store_id,
    direction,
    sender_type,
    content,
    status,
    webhook_payload
  )
  values (
    v_conversation_id,
    p_lead_id,
    v_store_id,
    'outbound',
    'system',
    p_note,
    'sent',
    jsonb_build_object('source', 'add_lead_note', 'created_by', p_created_by)
  )
  returning id into v_message_id;

  return v_message_id;
end;
$function$;
--@@ 45 funcao public.admin_agent_account_balances()
CREATE OR REPLACE FUNCTION public.admin_agent_account_balances()
 RETURNS jsonb
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select coalesce(
    jsonb_object_agg(account, balance),
    '{}'::jsonb
  )
  from (
    select
      account,
      round(
        sum(case when type = 'IN' then amount else -amount end)::numeric,
        2
      ) as balance
    from public.transactions
    where account is not null
    group by account
  ) t;
$function$;
--@@ 45 funcao public.admin_agent_create_creditor(p_actor uuid, p_payload json
CREATE OR REPLACE FUNCTION public.admin_agent_create_creditor(p_actor uuid, p_payload jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'private'
AS $function$
declare
  v_id text := coalesce(nullif(btrim(p_payload->>'id'), ''), 'crd_' || replace(gen_random_uuid()::text, '-', ''));
  v_name text := nullif(btrim(p_payload->>'name'), '');
  v_doc text := nullif(btrim(p_payload->>'document'), '');
  v_doc_type text := nullif(btrim(p_payload->>'documentType'), '');
  v_existing public.creditors%rowtype;
begin
  perform private.admin_agent_assert_admin(p_actor);

  if v_name is null then
    raise exception 'Nome do credor é obrigatório.' using errcode = '22023';
  end if;
  if v_doc_type is not null and v_doc_type not in ('CPF', 'CNPJ') then
    raise exception 'Tipo de documento inválido (CPF ou CNPJ).' using errcode = '22023';
  end if;

  if v_doc is not null then
    select * into v_existing from public.creditors where document = v_doc limit 1;
    if v_existing.id is not null then
      return jsonb_build_object('id', v_existing.id, 'name', v_existing.name, 'existed', true);
    end if;
  end if;

  insert into public.creditors (id, name, document, document_type, phone, email, notes)
  values (
    v_id,
    v_name,
    v_doc,
    v_doc_type,
    nullif(btrim(p_payload->>'phone'), ''),
    nullif(btrim(p_payload->>'email'), ''),
    nullif(btrim(p_payload->>'notes'), '')
  );

  return jsonb_build_object('id', v_id, 'name', v_name, 'existed', false);
end;
$function$;
--@@ 45 funcao public.admin_agent_create_customer(p_actor uuid, p_payload json
CREATE OR REPLACE FUNCTION public.admin_agent_create_customer(p_actor uuid, p_payload jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'private'
AS $function$
declare
  v_id text := coalesce(nullif(btrim(p_payload->>'id'), ''), 'cust_' || replace(gen_random_uuid()::text, '-', ''));
  v_name text := nullif(btrim(p_payload->>'name'), '');
  v_cpf text := nullif(regexp_replace(coalesce(p_payload->>'cpf', ''), '\D', '', 'g'), '');
  v_phone text := nullif(btrim(p_payload->>'phone'), '');
  v_phone_digits text := nullif(regexp_replace(coalesce(p_payload->>'phone', ''), '\D', '', 'g'), '');
  v_existing public.customers%rowtype;
begin
  perform private.admin_agent_assert_admin(p_actor);

  if v_name is null then
    raise exception 'Nome do cliente é obrigatório.' using errcode = '22023';
  end if;
  if v_phone is null then
    raise exception 'Telefone do cliente é obrigatório.' using errcode = '22023';
  end if;

  if v_cpf is not null then
    select * into v_existing from public.customers
    where nullif(regexp_replace(coalesce(cpf, ''), '\D', '', 'g'), '') = v_cpf
    limit 1;
  end if;
  if v_existing.id is null and v_phone_digits is not null then
    select * into v_existing from public.customers
    where regexp_replace(coalesce(phone, ''), '\D', '', 'g') = v_phone_digits
    limit 1;
  end if;
  if v_existing.id is not null then
    return jsonb_build_object('id', v_existing.id, 'name', v_existing.name, 'existed', true);
  end if;

  insert into public.customers (id, name, cpf, phone, alternative_phone, email, birth_date, purchases, total_spent)
  values (
    v_id,
    v_name,
    v_cpf,
    v_phone,
    nullif(btrim(p_payload->>'alternativePhone'), ''),
    coalesce(nullif(btrim(p_payload->>'email'), ''), ''),
    private.normalize_birth_day_month(p_payload->>'birthDate'),
    0,
    0
  );

  return jsonb_build_object('id', v_id, 'name', v_name, 'existed', false);
end;
$function$;
--@@ 45 funcao public.admin_agent_create_sale(p_actor uuid, p_payload jsonb)
CREATE OR REPLACE FUNCTION public.admin_agent_create_sale(p_actor uuid, p_payload jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'private'
AS $function$
declare
  v_sale_id text := p_payload->>'id';
  v_existing public.sales%rowtype;
  v_result jsonb;
begin
  perform private.admin_agent_assert_admin(p_actor);

  if coalesce(v_sale_id, '') = '' then
    raise exception 'ID da venda é obrigatório.' using errcode = '22023';
  end if;

  select * into v_existing from public.sales where id = v_sale_id for update;
  if found then
    delete from public.debt_payments where debt_id in (select id from public.debts where sale_id = v_sale_id);
    delete from public.debts where sale_id = v_sale_id;
    delete from public.payable_debt_payments where payable_debt_id in (select id from public.payable_debts where sale_id = v_sale_id);
    delete from public.payable_debts where sale_id = v_sale_id;
    delete from public.transactions where sale_id = v_sale_id;
    delete from public.sale_trade_in_items where sale_id = v_sale_id;
    delete from public.payment_methods where sale_id = v_sale_id;
    delete from public.sale_items where sale_id = v_sale_id;
    delete from public.sales where id = v_sale_id;
  end if;

  perform public.pdv_insert_sale_full_payload(p_payload);
  v_result := public.pdv_hydrate_sale_json(v_sale_id);

  return v_result;
end;
$function$;
--@@ 45 funcao public.admin_agent_create_stock_item(p_actor uuid, p_payload js
CREATE OR REPLACE FUNCTION public.admin_agent_create_stock_item(p_actor uuid, p_payload jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'private'
AS $function$
declare
  v_id text := coalesce(nullif(btrim(p_payload->>'id'), ''), 'stk_' || replace(gen_random_uuid()::text, '-', ''));
  v_store text := coalesce(nullif(btrim(p_payload->>'storeId'), ''), public.resolve_crm_default_store_id());
  v_purchase numeric := nullif(btrim(p_payload->>'purchasePrice'), '')::numeric;
  v_sell numeric := nullif(btrim(p_payload->>'sellPrice'), '')::numeric;
begin
  perform private.admin_agent_assert_admin(p_actor);

  if coalesce(nullif(btrim(p_payload->>'model'), ''), '') = '' then
    raise exception 'Modelo do aparelho é obrigatório.' using errcode = '22023';
  end if;
  if coalesce(nullif(btrim(p_payload->>'imei'), ''), '') = '' then
    raise exception 'IMEI/Serial do aparelho é obrigatório.' using errcode = '22023';
  end if;
  if v_purchase is null or v_purchase < 0 then
    raise exception 'Preço de compra inválido.' using errcode = '22023';
  end if;
  if v_sell is null or v_sell < 0 then
    raise exception 'Preço de venda inválido.' using errcode = '22023';
  end if;
  if v_store is null then
    raise exception 'Loja não resolvida para o cadastro.' using errcode = '22023';
  end if;

  insert into public.stock_items (
    id, type, model, color, has_box, capacity, imei, condition, status,
    sim_type, battery_health, store_id, purchase_price, sell_price,
    max_discount, warranty_type, warranty_end, origin, notes, observations,
    entry_date, photos
  ) values (
    v_id,
    coalesce(nullif(btrim(p_payload->>'type'), ''), 'iPhone'),
    btrim(p_payload->>'model'),
    coalesce(nullif(btrim(p_payload->>'color'), ''), ''),
    coalesce((p_payload->>'hasBox')::boolean, false),
    coalesce(nullif(btrim(p_payload->>'capacity'), ''), ''),
    btrim(p_payload->>'imei'),
    coalesce(nullif(btrim(p_payload->>'condition'), ''), 'Seminovo'),
    coalesce(nullif(btrim(p_payload->>'status'), ''), 'Disponível'),
    coalesce(nullif(btrim(p_payload->>'simType'), ''), 'Physical'),
    nullif(btrim(p_payload->>'batteryHealth'), '')::numeric,
    v_store,
    v_purchase,
    v_sell,
    coalesce(nullif(btrim(p_payload->>'maxDiscount'), '')::numeric, 0),
    coalesce(nullif(btrim(p_payload->>'warrantyType'), ''), 'Loja'),
    nullif(btrim(p_payload->>'warrantyEnd'), '')::timestamptz,
    coalesce(nullif(btrim(p_payload->>'origin'), ''), 'Cadastro via assistente'),
    nullif(btrim(p_payload->>'notes'), ''),
    nullif(btrim(p_payload->>'observations'), ''),
    coalesce(nullif(btrim(p_payload->>'entryDate'), '')::timestamptz, now()),
    coalesce(
      array(select jsonb_array_elements_text(coalesce(p_payload->'photos', '[]'::jsonb))),
      array[]::text[]
    )
  );

  return jsonb_build_object(
    'id', v_id,
    'model', btrim(p_payload->>'model'),
    'storeId', v_store,
    'sellPrice', v_sell
  );
end;
$function$;
--@@ 45 funcao public.admin_agent_delete_stock_item(p_actor uuid, p_id text)
CREATE OR REPLACE FUNCTION public.admin_agent_delete_stock_item(p_actor uuid, p_id text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'private'
AS $function$
declare
  v_item public.stock_items%rowtype;
begin
  perform private.admin_agent_assert_admin(p_actor);

  select * into v_item from public.stock_items where id = p_id;
  if not found then
    raise exception 'Aparelho não encontrado.' using errcode = '22023';
  end if;
  if v_item.status = 'Vendido' then
    raise exception 'Não é possível excluir um aparelho já vendido.' using errcode = '22023';
  end if;
  if exists (select 1 from public.sale_items where stock_item_id = p_id) then
    raise exception 'Aparelho vinculado a uma venda; não pode ser excluído.' using errcode = '22023';
  end if;
  if exists (
    select 1 from public.stock_reservations where stock_item_id = p_id and status = 'active'
  ) then
    raise exception 'Aparelho tem reserva ativa; libere a reserva antes de excluir.' using errcode = '22023';
  end if;

  delete from public.costs where stock_item_id = p_id;
  delete from public.stock_items where id = p_id;

  return jsonb_build_object('id', p_id, 'deleted', true, 'model', v_item.model);
end;
$function$;
--@@ 45 funcao public.admin_agent_delete_transaction(p_actor uuid, p_id text)
CREATE OR REPLACE FUNCTION public.admin_agent_delete_transaction(p_actor uuid, p_id text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'private'
AS $function$
declare
  v_trx public.transactions%rowtype;
begin
  perform private.admin_agent_assert_admin(p_actor);

  select * into v_trx from public.transactions where id = p_id;
  if not found then
    raise exception 'Lançamento não encontrado.' using errcode = '22023';
  end if;
  if v_trx.sale_id is not null
     or v_trx.debt_payment_id is not null
     or v_trx.payable_debt_payment_id is not null
     or v_trx.payable_debt_id is not null
     or v_trx.transfer_group_id is not null then
    raise exception 'Só é possível excluir lançamentos manuais (este é gerado por venda/dívida/transferência).' using errcode = '22023';
  end if;

  delete from public.transactions where id = p_id;

  return jsonb_build_object('id', p_id, 'deleted', true, 'amount', v_trx.amount, 'type', v_trx.type);
end;
$function$;
--@@ 45 funcao public.admin_agent_financial_summary(p_from timestamp with time
CREATE OR REPLACE FUNCTION public.admin_agent_financial_summary(p_from timestamp with time zone, p_to timestamp with time zone)
 RETURNS jsonb
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  with scoped as (
    select type, category, amount
    from public.transactions
    where date >= p_from and date < p_to
  )
  select jsonb_build_object(
    'income',
      coalesce((select round(sum(amount)::numeric, 2) from scoped where type = 'IN'), 0),
    'expense',
      coalesce((select round(sum(amount)::numeric, 2) from scoped where type = 'OUT'), 0),
    'net',
      coalesce((
        select round(sum(case when type = 'IN' then amount else -amount end)::numeric, 2)
        from scoped
      ), 0),
    'count', (select count(*) from scoped),
    'topExpenseCategories', coalesce((
      select jsonb_agg(row_to_json(t))
      from (
        select category, round(sum(amount)::numeric, 2) as total
        from scoped
        where type = 'OUT'
        group by category
        order by sum(amount) desc
        limit 5
      ) t
    ), '[]'::jsonb)
  );
$function$;
--@@ 45 funcao public.admin_agent_inventory_summary()
CREATE OR REPLACE FUNCTION public.admin_agent_inventory_summary()
 RETURNS jsonb
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  with instock as (
    select purchase_price, sell_price
    from public.stock_items
    where status in ('Disponível', 'Reservado', 'Em Preparação', 'Em Uso')
  )
  select jsonb_build_object(
    'available', (select count(*) from public.stock_items where status = 'Disponível'),
    'reserved', (select count(*) from public.stock_items where status = 'Reservado'),
    'inPreparation', (select count(*) from public.stock_items where status = 'Em Preparação'),
    'inStockCount', (select count(*) from instock),
    'totalPurchaseValue', coalesce((select round(sum(purchase_price)::numeric, 2) from instock), 0),
    'totalSellValue', coalesce((select round(sum(sell_price)::numeric, 2) from instock), 0)
  );
$function$;
--@@ 45 funcao public.admin_agent_pay_payable_debt(p_actor uuid, p_payable_deb
CREATE OR REPLACE FUNCTION public.admin_agent_pay_payable_debt(p_actor uuid, p_payable_debt_id text, p_amount numeric, p_method text, p_account text, p_notes text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'private'
AS $function$
declare
  v_id text := 'pdpm_' || replace(gen_random_uuid()::text, '-', '');
  v_method text := btrim(coalesce(p_method, ''));
  v_account text := coalesce(nullif(btrim(coalesce(p_account, '')), ''), 'Conta Bancária');
  v_debt public.payable_debts%rowtype;
begin
  perform private.admin_agent_assert_admin(p_actor);

  if p_amount is null or p_amount <= 0 then
    raise exception 'Informe um valor válido.' using errcode = '22023';
  end if;
  if v_method not in ('Pix', 'Dinheiro', 'Cartão') then
    raise exception 'Forma inválida (Pix, Dinheiro ou Cartão).' using errcode = '22023';
  end if;
  if v_account not in ('Conta Bancária', 'Cofre') then
    raise exception 'Conta inválida (Conta Bancária ou Cofre).' using errcode = '22023';
  end if;

  select * into v_debt from public.payable_debts where id = p_payable_debt_id;
  if not found then
    raise exception 'Conta a pagar não encontrada.' using errcode = '22023';
  end if;

  insert into public.payable_debt_payments (id, payable_debt_id, amount, payment_method, account, paid_at, notes)
  values (v_id, p_payable_debt_id, p_amount, v_method, v_account, now(), nullif(btrim(coalesce(p_notes, '')), ''));

  select * into v_debt from public.payable_debts where id = p_payable_debt_id;
  return jsonb_build_object(
    'paymentId', v_id,
    'payableDebtId', p_payable_debt_id,
    'amount', p_amount,
    'remaining', v_debt.remaining_amount,
    'status', v_debt.status
  );
end;
$function$;
--@@ 45 funcao public.admin_agent_receive_debt_payment(p_actor uuid, p_debt_id
CREATE OR REPLACE FUNCTION public.admin_agent_receive_debt_payment(p_actor uuid, p_debt_id text, p_amount numeric, p_method text, p_account text, p_notes text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'private'
AS $function$
declare
  v_id text := 'dpm_' || replace(gen_random_uuid()::text, '-', '');
  v_method text := btrim(coalesce(p_method, ''));
  v_account text := coalesce(nullif(btrim(coalesce(p_account, '')), ''), 'Conta Bancária');
  v_debt public.debts%rowtype;
begin
  perform private.admin_agent_assert_admin(p_actor);

  if p_amount is null or p_amount <= 0 then
    raise exception 'Informe um valor válido.' using errcode = '22023';
  end if;
  if v_method not in ('Pix', 'Dinheiro', 'Cartão') then
    raise exception 'Forma inválida (Pix, Dinheiro ou Cartão).' using errcode = '22023';
  end if;
  if v_account not in ('Conta Bancária', 'Cofre') then
    raise exception 'Conta inválida (Conta Bancária ou Cofre).' using errcode = '22023';
  end if;

  select * into v_debt from public.debts where id = p_debt_id;
  if not found then
    raise exception 'Dívida não encontrada.' using errcode = '22023';
  end if;

  insert into public.debt_payments (id, debt_id, amount, payment_method, account, paid_at, notes)
  values (v_id, p_debt_id, p_amount, v_method, v_account, now(), nullif(btrim(coalesce(p_notes, '')), ''));

  select * into v_debt from public.debts where id = p_debt_id;
  return jsonb_build_object(
    'paymentId', v_id,
    'debtId', p_debt_id,
    'amount', p_amount,
    'remaining', v_debt.remaining_amount,
    'status', v_debt.status
  );
end;
$function$;
--@@ 45 funcao public.admin_agent_register_transaction(p_actor uuid, p_type te
CREATE OR REPLACE FUNCTION public.admin_agent_register_transaction(p_actor uuid, p_type text, p_category text, p_amount numeric, p_account text, p_description text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'private'
AS $function$
declare
  v_id text := 'trx_' || replace(gen_random_uuid()::text, '-', '');
  v_type text := upper(btrim(coalesce(p_type, '')));
  v_account text := nullif(btrim(coalesce(p_account, '')), '');
  v_category text := nullif(btrim(coalesce(p_category, '')), '');
begin
  perform private.admin_agent_assert_admin(p_actor);

  if p_amount is null or p_amount <= 0 then
    raise exception 'Informe um valor válido.' using errcode = '22023';
  end if;
  if v_type not in ('IN', 'OUT') then
    raise exception 'Tipo inválido (use IN ou OUT).' using errcode = '22023';
  end if;
  if v_account not in ('Conta Bancária', 'Cofre') then
    raise exception 'Conta inválida (Conta Bancária ou Cofre).' using errcode = '22023';
  end if;

  insert into public.transactions (id, type, category, amount, date, description, account)
  values (
    v_id,
    v_type,
    coalesce(v_category, case when v_type = 'IN' then 'Aporte' else 'Retirada' end),
    p_amount,
    now(),
    coalesce(nullif(btrim(p_description), ''), 'Lançamento via assistente financeiro'),
    v_account
  );

  return jsonb_build_object(
    'transactionId', v_id,
    'type', v_type,
    'amount', p_amount,
    'account', v_account
  );
end;
$function$;
--@@ 45 funcao public.admin_agent_release_reservation(p_actor uuid, p_stock_it
CREATE OR REPLACE FUNCTION public.admin_agent_release_reservation(p_actor uuid, p_stock_item_id text, p_refund_deposit boolean DEFAULT false)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'private'
AS $function$
declare
  v_reservation public.stock_reservations%rowtype;
begin
  perform private.admin_agent_assert_admin(p_actor);
  v_reservation := public.release_stock_reservation(p_stock_item_id, coalesce(p_refund_deposit, false));
  return to_jsonb(v_reservation);
end;
$function$;
--@@ 45 funcao public.admin_agent_reserve_stock(p_actor uuid, p_stock_item_id 
CREATE OR REPLACE FUNCTION public.admin_agent_reserve_stock(p_actor uuid, p_stock_item_id text, p_payload jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'private'
AS $function$
declare
  v_reservation public.stock_reservations%rowtype;
begin
  perform private.admin_agent_assert_admin(p_actor);
  v_reservation := public.reserve_stock_item(p_stock_item_id, p_payload);
  return to_jsonb(v_reservation);
end;
$function$;
--@@ 45 funcao public.admin_agent_sales_summary(p_from timestamp with time zon
CREATE OR REPLACE FUNCTION public.admin_agent_sales_summary(p_from timestamp with time zone, p_to timestamp with time zone)
 RETURNS jsonb
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  with scoped as (
    select total
    from public.sales
    where date >= p_from and date < p_to
  )
  select jsonb_build_object(
    'count', (select count(*) from scoped),
    'revenue', coalesce((select round(sum(total)::numeric, 2) from scoped), 0),
    'avgTicket', coalesce((select round(avg(total)::numeric, 2) from scoped), 0)
  );
$function$;
--@@ 45 funcao public.admin_agent_transfer(p_actor uuid, p_amount numeric, p_f
CREATE OR REPLACE FUNCTION public.admin_agent_transfer(p_actor uuid, p_amount numeric, p_from text, p_to text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'private'
AS $function$
declare
  v_from text := nullif(btrim(p_from), '');
  v_to text := nullif(btrim(p_to), '');
  v_group text := 'trf_' || replace(gen_random_uuid()::text, '-', '');
  v_when timestamptz := now();
  v_out text := 'trx_' || replace(gen_random_uuid()::text, '-', '');
  v_in text := 'trx_' || replace(gen_random_uuid()::text, '-', '');
begin
  perform private.admin_agent_assert_admin(p_actor);

  if p_amount is null or p_amount <= 0 then
    raise exception 'Informe um valor válido.' using errcode = '22023';
  end if;
  if v_from not in ('Conta Bancária', 'Cofre')
     or v_to not in ('Conta Bancária', 'Cofre') then
    raise exception 'Conta de transferência inválida.' using errcode = '22023';
  end if;
  if v_from = v_to then
    raise exception 'Selecione contas diferentes para transferir.'
      using errcode = '22023';
  end if;

  insert into public.transactions
    (id, type, category, amount, date, description, account, transfer_group_id)
  values
    (v_out, 'OUT', 'Serviço', p_amount, v_when,
     'Transferência para ' || v_to, v_from, v_group),
    (v_in, 'IN', 'Aporte', p_amount, v_when,
     'Transferência de ' || v_from, v_to, v_group);

  return jsonb_build_object(
    'transferGroupId', v_group,
    'outTransactionId', v_out,
    'inTransactionId', v_in,
    'amount', p_amount,
    'from', v_from,
    'to', v_to
  );
end;
$function$;
--@@ 45 funcao public.admin_agent_update_customer(p_actor uuid, p_id text, p_p
CREATE OR REPLACE FUNCTION public.admin_agent_update_customer(p_actor uuid, p_id text, p_patch jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'private'
AS $function$
declare
  v_cust public.customers%rowtype;
begin
  perform private.admin_agent_assert_admin(p_actor);

  select * into v_cust from public.customers where id = p_id;
  if not found then
    raise exception 'Cliente não encontrado.' using errcode = '22023';
  end if;

  update public.customers set
    name = case when p_patch ? 'name' then coalesce(nullif(btrim(p_patch->>'name'), ''), name) else name end,
    cpf = case when p_patch ? 'cpf' then nullif(regexp_replace(coalesce(p_patch->>'cpf', ''), '\D', '', 'g'), '') else cpf end,
    phone = case when p_patch ? 'phone' then coalesce(nullif(btrim(p_patch->>'phone'), ''), phone) else phone end,
    alternative_phone = case when p_patch ? 'alternativePhone' then nullif(btrim(p_patch->>'alternativePhone'), '') else alternative_phone end,
    email = case when p_patch ? 'email' then coalesce(p_patch->>'email', email) else email end,
    birth_date = case when p_patch ? 'birthDate' then private.normalize_birth_day_month(p_patch->>'birthDate') else birth_date end
  where id = p_id;

  select * into v_cust from public.customers where id = p_id;
  return jsonb_build_object('id', p_id, 'name', v_cust.name, 'phone', v_cust.phone);
end;
$function$;
--@@ 45 funcao public.admin_agent_update_stock_item(p_actor uuid, p_id text, p
CREATE OR REPLACE FUNCTION public.admin_agent_update_stock_item(p_actor uuid, p_id text, p_patch jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'private'
AS $function$
declare
  v_item public.stock_items%rowtype;
begin
  perform private.admin_agent_assert_admin(p_actor);

  select * into v_item from public.stock_items where id = p_id;
  if not found then
    raise exception 'Aparelho não encontrado.' using errcode = '22023';
  end if;

  update public.stock_items set
    model = case when p_patch ? 'model' then coalesce(nullif(btrim(p_patch->>'model'), ''), model) else model end,
    imei = case when p_patch ? 'imei' then coalesce(nullif(btrim(p_patch->>'imei'), ''), imei) else imei end,
    color = case when p_patch ? 'color' then coalesce(p_patch->>'color', color) else color end,
    capacity = case when p_patch ? 'capacity' then coalesce(p_patch->>'capacity', capacity) else capacity end,
    condition = case when p_patch ? 'condition' then coalesce(nullif(btrim(p_patch->>'condition'), ''), condition) else condition end,
    status = case when p_patch ? 'status' then coalesce(nullif(btrim(p_patch->>'status'), ''), status) else status end,
    has_box = case when p_patch ? 'hasBox' then coalesce((p_patch->>'hasBox')::boolean, has_box) else has_box end,
    battery_health = case when p_patch ? 'batteryHealth' then nullif(btrim(p_patch->>'batteryHealth'), '')::numeric else battery_health end,
    purchase_price = case when p_patch ? 'purchasePrice' then coalesce(nullif(btrim(p_patch->>'purchasePrice'), '')::numeric, purchase_price) else purchase_price end,
    sell_price = case when p_patch ? 'sellPrice' then coalesce(nullif(btrim(p_patch->>'sellPrice'), '')::numeric, sell_price) else sell_price end,
    max_discount = case when p_patch ? 'maxDiscount' then coalesce(nullif(btrim(p_patch->>'maxDiscount'), '')::numeric, max_discount) else max_discount end,
    warranty_type = case when p_patch ? 'warrantyType' then coalesce(nullif(btrim(p_patch->>'warrantyType'), ''), warranty_type) else warranty_type end,
    warranty_end = case when p_patch ? 'warrantyEnd' then nullif(btrim(p_patch->>'warrantyEnd'), '')::timestamptz else warranty_end end,
    notes = case when p_patch ? 'notes' then nullif(btrim(p_patch->>'notes'), '') else notes end,
    observations = case when p_patch ? 'observations' then nullif(btrim(p_patch->>'observations'), '') else observations end,
    updated_at = now()
  where id = p_id;

  select * into v_item from public.stock_items where id = p_id;
  return jsonb_build_object(
    'id', p_id,
    'model', v_item.model,
    'status', v_item.status,
    'sellPrice', v_item.sell_price
  );
end;
$function$;
--@@ 45 funcao public.admin_agent_update_transaction(p_actor uuid, p_id text, 
CREATE OR REPLACE FUNCTION public.admin_agent_update_transaction(p_actor uuid, p_id text, p_patch jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'private'
AS $function$
declare
  v_trx public.transactions%rowtype;
  v_account text;
  v_amount numeric;
begin
  perform private.admin_agent_assert_admin(p_actor);

  select * into v_trx from public.transactions where id = p_id;
  if not found then
    raise exception 'Lançamento não encontrado.' using errcode = '22023';
  end if;
  if v_trx.sale_id is not null
     or v_trx.debt_payment_id is not null
     or v_trx.payable_debt_payment_id is not null
     or v_trx.payable_debt_id is not null
     or v_trx.transfer_group_id is not null then
    raise exception 'Só é possível editar lançamentos manuais (este é gerado por venda/dívida/transferência).' using errcode = '22023';
  end if;

  if p_patch ? 'account' then
    v_account := nullif(btrim(p_patch->>'account'), '');
    if v_account not in ('Conta Bancária', 'Cofre') then
      raise exception 'Conta inválida (Conta Bancária ou Cofre).' using errcode = '22023';
    end if;
  end if;
  if p_patch ? 'amount' then
    v_amount := nullif(btrim(p_patch->>'amount'), '')::numeric;
    if v_amount is null or v_amount <= 0 then
      raise exception 'Valor inválido.' using errcode = '22023';
    end if;
  end if;

  update public.transactions set
    category = case when p_patch ? 'category' then coalesce(nullif(btrim(p_patch->>'category'), ''), category) else category end,
    amount = case when p_patch ? 'amount' then v_amount else amount end,
    description = case when p_patch ? 'description' then coalesce(p_patch->>'description', description) else description end,
    account = case when p_patch ? 'account' then v_account else account end,
    date = case when p_patch ? 'date' then coalesce(nullif(btrim(p_patch->>'date'), '')::timestamptz, date) else date end
  where id = p_id;

  select * into v_trx from public.transactions where id = p_id;
  return jsonb_build_object(
    'id', p_id, 'type', v_trx.type, 'amount', v_trx.amount,
    'account', v_trx.account, 'category', v_trx.category
  );
end;
$function$;
--@@ 45 funcao public.admin_agent_upsert_device_catalog(p_actor uuid, p_payloa
CREATE OR REPLACE FUNCTION public.admin_agent_upsert_device_catalog(p_actor uuid, p_payload jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'private'
AS $function$
declare
  v_id text := 'dvc_' || replace(gen_random_uuid()::text, '-', '');
  v_type text := nullif(btrim(p_payload->>'type'), '');
  v_model text := nullif(btrim(p_payload->>'model'), '');
  v_color text := coalesce(nullif(btrim(p_payload->>'color'), ''), '');
begin
  perform private.admin_agent_assert_admin(p_actor);

  if v_type not in ('iPhone', 'iPad', 'Macbook', 'Apple Watch', 'Acessório') then
    raise exception 'Tipo inválido (iPhone, iPad, Macbook, Apple Watch ou Acessório).' using errcode = '22023';
  end if;
  if v_model is null then
    raise exception 'Modelo é obrigatório.' using errcode = '22023';
  end if;

  insert into public.device_catalog (id, type, model, color)
  values (v_id, v_type, v_model, v_color)
  on conflict (type, model, color) do update set updated_at = now()
  returning id into v_id;

  return jsonb_build_object('id', v_id, 'type', v_type, 'model', v_model, 'color', v_color);
end;
$function$;
--@@ 45 funcao public.admin_agent_upsert_finance_category(p_actor uuid, p_payl
CREATE OR REPLACE FUNCTION public.admin_agent_upsert_finance_category(p_actor uuid, p_payload jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'private'
AS $function$
declare
  v_name text := nullif(btrim(p_payload->>'name'), '');
  v_type text := upper(nullif(btrim(p_payload->>'type'), ''));
  v_is_default boolean := coalesce((p_payload->>'isDefault')::boolean, false);
  v_id text;
begin
  perform private.admin_agent_assert_admin(p_actor);

  if v_name is null then
    raise exception 'Nome da categoria é obrigatório.' using errcode = '22023';
  end if;
  if v_type not in ('IN', 'OUT') then
    raise exception 'Tipo inválido (IN = receita, OUT = despesa).' using errcode = '22023';
  end if;

  select id into v_id from public.finance_categories
  where lower(name) = lower(v_name) and type = v_type
  limit 1;

  if v_id is null then
    v_id := 'cat_' || replace(gen_random_uuid()::text, '-', '');
    insert into public.finance_categories (id, name, type, is_default)
    values (v_id, v_name, v_type, v_is_default);
    return jsonb_build_object('id', v_id, 'name', v_name, 'type', v_type, 'created', true);
  else
    update public.finance_categories
    set name = v_name, is_default = v_is_default
    where id = v_id;
    return jsonb_build_object('id', v_id, 'name', v_name, 'type', v_type, 'created', false);
  end if;
end;
$function$;
--@@ 45 funcao public.app_set_updated_at()
CREATE OR REPLACE FUNCTION public.app_set_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
begin
  new.updated_at = now();
  return new;
end;
$function$;
--@@ 45 funcao public.bulk_update_leads(p_store_id text, p_filters jsonb, p_pa
CREATE OR REPLACE FUNCTION public.bulk_update_leads(p_store_id text, p_filters jsonb, p_patch jsonb)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_updated integer := 0;
  v_stage text := nullif(btrim(coalesce(p_patch ->> 'funnel_stage', '')), '');
  v_intent text := nullif(btrim(coalesce(p_patch ->> 'intent', '')), '');
  v_customer boolean;
begin
  if p_store_id is null or btrim(p_store_id) = '' then
    return 0;
  end if;

  if p_patch ? 'is_customer' then
    v_customer := (p_patch ->> 'is_customer')::boolean;
  end if;

  update public.crm_leads l
  set
    funnel_stage = coalesce(v_stage, l.funnel_stage),
    intent = coalesce(v_intent, l.intent),
    is_customer = coalesce(v_customer, l.is_customer),
    updated_at = now(),
    last_interaction_at = now()
  where l.store_id = p_store_id
    and (
      (p_filters ->> 'funnel_stage') is null
      or l.funnel_stage = (p_filters ->> 'funnel_stage')
    )
    and (
      (p_filters ->> 'source_channel_id') is null
      or l.source_channel_id::text = (p_filters ->> 'source_channel_id')
    )
    and (
      (p_filters ->> 'search') is null
      or l.name ilike '%' || (p_filters ->> 'search') || '%'
      or l.phone ilike '%' || (p_filters ->> 'search') || '%'
    );

  get diagnostics v_updated = row_count;
  return v_updated;
end;
$function$;
--@@ 45 funcao public.cancel_broadcast(p_broadcast_id uuid)
CREATE OR REPLACE FUNCTION public.cancel_broadcast(p_broadcast_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  update public.crm_broadcasts
  set status = 'canceled', updated_at = now()
  where id = p_broadcast_id;

  if not found then
    return jsonb_build_object('success', false, 'error', 'Broadcast não encontrado');
  end if;

  update public.crm_broadcast_recipients
  set status = 'skipped', error_message = 'broadcast_canceled'
  where broadcast_id = p_broadcast_id
    and status = 'pending';

  return jsonb_build_object('success', true, 'broadcast_id', p_broadcast_id);
end;
$function$;
--@@ 45 funcao public.cancel_sale(p_sale_id text)
CREATE OR REPLACE FUNCTION public.cancel_sale(p_sale_id text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_sale public.sales%rowtype;
  v_trade_in_stock_ids text[] := array[]::text[];
  v_resold_labels text;
  v_sold_reservation_ids text[] := array[]::text[];
  v_reserved_stock_ids text[] := array[]::text[];
begin
  if public.current_role() <> 'admin' then
    raise exception 'Apenas administradores podem cancelar vendas.'
      using errcode = '42501';
  end if;

  select *
  into v_sale
  from public.sales
  where id = p_sale_id
  for update;

  if not found then
    raise exception 'Venda não encontrada: %', p_sale_id
      using errcode = 'P0002';
  end if;

  select coalesce(array_agg(distinct stock_item_id) filter (where stock_item_id is not null), array[]::text[])
  into v_trade_in_stock_ids
  from public.sale_trade_in_items
  where sale_id = p_sale_id;

  if v_sale.trade_in_id is not null then
    select array_agg(distinct stock_item_id)
    into v_trade_in_stock_ids
    from unnest(v_trade_in_stock_ids || array[v_sale.trade_in_id]) as t(stock_item_id);
  end if;

  if cardinality(v_trade_in_stock_ids) > 0 then
    select string_agg(coalesce(nullif(si.imei, ''), sti.model, resold.stock_item_id), ', ')
    into v_resold_labels
    from (
      select distinct stock_item_id
      from public.sale_items
      where stock_item_id = any(v_trade_in_stock_ids)
        and sale_id <> p_sale_id
    ) resold
    left join public.stock_items si on si.id = resold.stock_item_id
    left join public.sale_trade_in_items sti
      on sti.sale_id = p_sale_id
     and sti.stock_item_id = resold.stock_item_id;

    if v_resold_labels is not null then
      raise exception 'Não é possível cancelar a venda: trade-in já revendido (%).', v_resold_labels
        using errcode = 'P0001';
    end if;
  end if;

  -- Capturar as reservas consumidas por esta venda ANTES do delete: o FK
  -- sold_sale_id é `on delete set null`, então o delete zera essa referência.
  select coalesce(array_agg(id), array[]::text[]),
         coalesce(array_agg(stock_item_id), array[]::text[])
  into v_sold_reservation_ids, v_reserved_stock_ids
  from public.stock_reservations
  where sold_sale_id = p_sale_id
    and status = 'sold';

  -- The sales delete trigger reverts debts, transactions, payable debts,
  -- customer/seller totals and sold stock status in the same transaction.
  delete from public.sales where id = p_sale_id;

  if cardinality(v_trade_in_stock_ids) > 0 then
    delete from public.stock_items si
    where si.id = any(v_trade_in_stock_ids)
      and not exists (
        select 1
        from public.sale_items sold_item
        where sold_item.stock_item_id = si.id
      );
  end if;

  -- Religar as reservas consumidas: reserva volta a 'active' e o aparelho a
  -- 'Reservado' (sobrepondo o 'Disponível' aplicado pelo trigger de exclusão).
  -- O sinal permanece intacto; estorno/retenção fica para a liberação.
  if cardinality(v_sold_reservation_ids) > 0 then
    update public.stock_reservations
       set status = 'active',
           sold_at = null,
           sold_sale_id = null,
           released_at = null
     where id = any(v_sold_reservation_ids);

    update public.stock_items
       set status = 'Reservado',
           updated_at = now()
     where id = any(v_reserved_stock_ids);
  end if;
end;
$function$;
--@@ 45 funcao public.cancel_transaction(p_transaction_id text)
CREATE OR REPLACE FUNCTION public.cancel_transaction(p_transaction_id text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_trx public.transactions%rowtype;
begin
  if public.current_role() <> 'admin' then
    raise exception 'Apenas administradores podem cancelar lançamentos.'
      using errcode = '42501';
  end if;

  select * into v_trx
  from public.transactions
  where id = p_transaction_id
  for update;

  if not found then
    raise exception 'Lançamento não encontrado: %', p_transaction_id
      using errcode = 'P0002';
  end if;

  if v_trx.payable_debt_id is not null then
    raise exception 'Este lançamento é uma entrada de dívida ativa. Para revertê-lo, exclua a dívida correspondente na página Dívidas Ativas.'
      using errcode = '23503';
  end if;

  if v_trx.debt_id is not null then
    raise exception 'Este lançamento é a saída de um devedor. Para revertê-lo, exclua o devedor correspondente na página Devedores.'
      using errcode = '23503';
  end if;

  if v_trx.debt_payment_id is not null then
    delete from public.debt_payments where id = v_trx.debt_payment_id;
  end if;

  if v_trx.payable_debt_payment_id is not null then
    update public.transactions
      set payable_debt_payment_id = null
    where id = p_transaction_id;

    delete from public.payable_debt_payments where id = v_trx.payable_debt_payment_id;
  end if;

  if v_trx.transfer_group_id is not null then
    delete from public.transactions
    where transfer_group_id = v_trx.transfer_group_id
      and id <> p_transaction_id;
  end if;

  delete from public.transactions where id = p_transaction_id;
end;
$function$;
--@@ 45 funcao public.claim_crm_uaz_avatar_jobs(p_limit integer, p_lease_secon
CREATE OR REPLACE FUNCTION public.claim_crm_uaz_avatar_jobs(p_limit integer DEFAULT 3, p_lease_seconds integer DEFAULT 120)
 RETURNS SETOF crm_uaz_avatar_jobs
 LANGUAGE plpgsql
 SET search_path TO 'public', 'pg_temp'
AS $function$
begin
  if p_limit < 1 or p_limit > 20 then
    raise exception 'Avatar job claim limit must be between 1 and 20.';
  end if;
  if p_lease_seconds < 30 or p_lease_seconds > 600 then
    raise exception 'Avatar job lease must be between 30 and 600 seconds.';
  end if;

  return query
  with due as (
    select job.id
    from public.crm_uaz_avatar_jobs job
    where (
      (job.status in ('pending', 'retry') and job.available_at <= now())
      or (job.status = 'processing' and job.lease_expires_at <= now())
    )
    order by job.available_at, job.created_at
    limit p_limit
    for update skip locked
  )
  update public.crm_uaz_avatar_jobs job
  set
    status = 'processing',
    attempts = job.attempts + 1,
    lease_expires_at = now() + make_interval(secs => p_lease_seconds),
    updated_at = now()
  from due
  where job.id = due.id
  returning job.*;
end;
$function$;
--@@ 45 funcao public.cleanup_stale_push_subscriptions(p_inactive_retention_da
CREATE OR REPLACE FUNCTION public.cleanup_stale_push_subscriptions(p_inactive_retention_days integer DEFAULT 30, p_active_stale_days integer DEFAULT 120)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_deleted integer;
begin
  -- Retire active devices that have gone silent past the stale window so the
  -- next send stops paying for them; they become eligible for deletion below.
  update public.push_subscriptions
     set is_active = false,
         last_error_at = now(),
         last_error_message = 'auto-deactivated: stale device'
   where is_active = true
     and last_seen_at < now() - make_interval(days => p_active_stale_days);

  -- Delete long-inactive rows. Use the most recent activity signal available.
  delete from public.push_subscriptions
   where is_active = false
     and coalesce(last_error_at, last_seen_at, created_at)
         < now() - make_interval(days => p_inactive_retention_days);

  get diagnostics v_deleted = row_count;
  return v_deleted;
end;
$function$;
--@@ 45 funcao public.compare_phones(phone1 text, phone2 text)
CREATE OR REPLACE FUNCTION public.compare_phones(phone1 text, phone2 text)
 RETURNS boolean
 LANGUAGE plpgsql
 IMMUTABLE
 SET search_path TO 'public'
AS $function$
DECLARE
  norm1 TEXT;
  norm2 TEXT;
BEGIN
  norm1 := public.normalize_phone(phone1);
  norm2 := public.normalize_phone(phone2);

  IF norm1 IS NULL OR norm2 IS NULL THEN
    RETURN FALSE;
  END IF;

  IF norm1 = norm2 THEN
    RETURN TRUE;
  END IF;

  IF length(norm1) >= 8 AND length(norm2) >= 8 THEN
    RETURN right(norm1, 8) = right(norm2, 8);
  END IF;

  RETURN FALSE;
END;
$function$;
--@@ 45 funcao public.complete_crm_uaz_avatar_job(p_job_id uuid, p_store_id te
CREATE OR REPLACE FUNCTION public.complete_crm_uaz_avatar_job(p_job_id uuid, p_store_id text, p_attempt integer, p_status text, p_error_code text DEFAULT NULL::text, p_available_at timestamp with time zone DEFAULT NULL::timestamp with time zone)
 RETURNS boolean
 LANGUAGE plpgsql
 SET search_path TO 'public', 'pg_temp'
AS $function$
begin
  if p_status not in ('retry', 'completed', 'failed') then
    raise exception 'Invalid avatar job completion status.';
  end if;
  if p_status = 'retry' and p_available_at is null then
    raise exception 'Retry jobs require available_at.';
  end if;

  update public.crm_uaz_avatar_jobs
  set
    status = p_status,
    available_at = coalesce(p_available_at, available_at),
    lease_expires_at = null,
    force_refresh = case when p_status = 'completed' then false else force_refresh end,
    last_error_code = p_error_code,
    updated_at = now()
  where store_id = p_store_id
    and id = p_job_id
    and status = 'processing'
    and attempts = p_attempt;

  return found;
end;
$function$;
--@@ 45 funcao public.create_sale_full(p_payload jsonb)
CREATE OR REPLACE FUNCTION public.create_sale_full(p_payload jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_sale_id text := p_payload->>'id';
  v_existing public.sales%rowtype;
  v_result jsonb;
begin
  if public.current_role() not in ('admin', 'seller') then
    raise exception 'Usuário sem permissão para criar venda.' using errcode = '42501';
  end if;

  if coalesce(v_sale_id, '') = '' then
    raise exception 'ID da venda é obrigatório.' using errcode = '22023';
  end if;

  select * into v_existing from public.sales where id = v_sale_id for update;

  if found then
    delete from public.debt_payments where debt_id in (select id from public.debts where sale_id = v_sale_id);
    delete from public.debts where sale_id = v_sale_id;
    delete from public.payable_debt_payments where payable_debt_id in (select id from public.payable_debts where sale_id = v_sale_id);
    delete from public.payable_debts where sale_id = v_sale_id;
    delete from public.transactions where sale_id = v_sale_id;
    delete from public.sale_trade_in_items where sale_id = v_sale_id;
    delete from public.payment_methods where sale_id = v_sale_id;
    delete from public.sale_items where sale_id = v_sale_id;
    delete from public.sales where id = v_sale_id;
  end if;

  perform public.pdv_insert_sale_full_payload(p_payload);

  v_result := public.pdv_hydrate_sale_json(v_sale_id);

  return v_result;
end;
$function$;
--@@ 45 funcao public.crm_ad_creative_signature(p_source_campaign_id text, p_s
CREATE OR REPLACE FUNCTION public.crm_ad_creative_signature(p_source_campaign_id text, p_source_campaign_title text, p_source_ad_context jsonb)
 RETURNS text
 LANGUAGE sql
 IMMUTABLE
AS $function$
  select nullif(trim(coalesce(
    nullif(trim(p_source_campaign_id), ''),
    nullif(trim(p_source_ad_context->>'campaign_id'), ''),
    lower(nullif(trim(p_source_campaign_title), '')),
    lower(nullif(trim(p_source_ad_context->>'campaign_title'), '')),
    nullif(trim(p_source_ad_context->>'source_url'), ''),
    nullif(trim(p_source_ad_context->>'image_url'), '')
  )), '');
$function$;
--@@ 45 funcao public.crm_ad_source_app(p_source text, p_ctx jsonb)
CREATE OR REPLACE FUNCTION public.crm_ad_source_app(p_source text, p_ctx jsonb)
 RETURNS text
 LANGUAGE sql
 IMMUTABLE
AS $function$
  select case
    when coalesce(lower(p_source), lower(p_ctx->>'source'), '') ~ '(meta|face|fb)'
      then 'facebook'
    else 'instagram'
  end;
$function$;
--@@ 45 funcao public.crm_ads_is_probable_image_url(p_url text)
CREATE OR REPLACE FUNCTION public.crm_ads_is_probable_image_url(p_url text)
 RETURNS boolean
 LANGUAGE sql
 IMMUTABLE
AS $function$
  select nullif(btrim(coalesce(p_url, '')), '') is not null
    and lower(btrim(p_url)) ~ '^https?://'
    and lower(btrim(p_url)) !~ '(instagram\.com/(p|reel|stories)/|facebook\.com/|fb\.watch|wa\.me/)';
$function$;
--@@ 45 funcao public.crm_after_message_insert()
CREATE OR REPLACE FUNCTION public.crm_after_message_insert()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
begin
  update public.crm_conversations
  set
    message_count = coalesce(message_count, 0) + 1,
    unread_count = case
      when new.direction = 'inbound' then coalesce(unread_count, 0) + 1
      else coalesce(unread_count, 0)
    end,
    last_message_at = coalesce(new.created_at, now()),
    last_customer_message_at = case
      when new.direction = 'inbound' then coalesce(new.created_at, now())
      else last_customer_message_at
    end,
    last_response_at = case
      when new.direction = 'outbound' then coalesce(new.created_at, now())
      else last_response_at
    end,
    updated_at = now()
  where id = new.conversation_id;

  update public.crm_leads
  set
    last_message_at = coalesce(new.created_at, now()),
    last_interaction_at = coalesce(new.created_at, now()),
    updated_at = now()
  where id = new.lead_id;

  return new;
end;
$function$;
--@@ 45 funcao public.crm_apply_channel_to_conversation(p_conversation_id uuid
CREATE OR REPLACE FUNCTION public.crm_apply_channel_to_conversation(p_conversation_id uuid, p_channel_id uuid, p_changed_by uuid DEFAULT NULL::uuid, p_reason text DEFAULT NULL::text)
 RETURNS TABLE(conversation_id uuid, lead_id text, from_channel_id uuid, to_channel_id uuid, from_funnel_id uuid, to_funnel_id uuid, from_stage text, to_stage text, channel_changed boolean, stage_changed boolean)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_now timestamptz := now();
  v_conversation public.crm_conversations%rowtype;
  v_lead public.crm_leads%rowtype;
  v_channel record;
  v_target_funnel_id uuid;
  v_target_stage text;
  v_channel_changed boolean := false;
  v_stage_changed boolean := false;
begin
  if p_conversation_id is null then
    raise exception 'conversation_id is required';
  end if;

  if p_channel_id is null then
    raise exception 'channel_id is required';
  end if;

  select * into v_conversation
  from public.crm_conversations
  where id = p_conversation_id
  for update;

  if not found then
    raise exception 'Conversation not found: %', p_conversation_id;
  end if;

  select * into v_lead
  from public.crm_leads
  where id = v_conversation.lead_id
  for update;

  if not found then
    raise exception 'Lead not found for conversation: %', p_conversation_id;
  end if;

  select c.id, c.store_id, c.inbound_funnel_id, c.inbound_funnel_stage
  into v_channel
  from public.crm_channels c
  where c.id = p_channel_id
  limit 1;

  if not found then
    raise exception 'Channel not found: %', p_channel_id;
  end if;

  if v_channel.store_id <> v_lead.store_id then
    raise exception 'Channel store mismatch for conversation/lead';
  end if;

  v_target_funnel_id := coalesce(v_channel.inbound_funnel_id, v_lead.funnel_id);
  v_target_stage := coalesce(nullif(btrim(v_channel.inbound_funnel_stage), ''), v_lead.funnel_stage, 'new_lead');

  if v_conversation.channel_id is distinct from p_channel_id then
    update public.crm_conversations
    set channel_id = p_channel_id,
        updated_at = v_now
    where id = p_conversation_id;
    v_channel_changed := true;
  end if;

  if v_lead.funnel_id is distinct from v_target_funnel_id
     or v_lead.funnel_stage is distinct from v_target_stage then
    update public.crm_leads
    set
      funnel_id = v_target_funnel_id,
      funnel_stage = v_target_stage,
      updated_at = v_now,
      last_interaction_at = greatest(coalesce(last_interaction_at, v_now), v_now)
    where id = v_lead.id;

    insert into public.crm_lead_stage_history (
      lead_id,
      store_id,
      from_stage,
      to_stage,
      changed_by,
      notes,
      created_at
    )
    values (
      v_lead.id,
      v_lead.store_id,
      v_lead.funnel_stage,
      v_target_stage,
      p_changed_by,
      coalesce(nullif(btrim(p_reason), ''), 'channel_switch'),
      v_now
    );

    v_stage_changed := true;
  end if;

  insert into public.crm_event_log (
    store_id,
    event_type,
    payload,
    is_outbound,
    channel_id,
    lead_id,
    conversation_id,
    created_at
  )
  values (
    v_lead.store_id,
    'crm_channel_applied_to_conversation',
    jsonb_build_object(
      'conversation_id', p_conversation_id,
      'lead_id', v_lead.id,
      'from_channel_id', v_conversation.channel_id,
      'to_channel_id', p_channel_id,
      'from_funnel_id', v_lead.funnel_id,
      'to_funnel_id', v_target_funnel_id,
      'from_stage', v_lead.funnel_stage,
      'to_stage', v_target_stage,
      'reason', coalesce(nullif(btrim(p_reason), ''), 'manual_or_webhook_switch')
    ),
    false,
    p_channel_id,
    v_lead.id,
    p_conversation_id,
    v_now
  );

  return query
  select
    p_conversation_id,
    v_lead.id,
    v_conversation.channel_id,
    p_channel_id,
    v_lead.funnel_id,
    v_target_funnel_id,
    v_lead.funnel_stage,
    v_target_stage,
    v_channel_changed,
    v_stage_changed;
end;
$function$;
--@@ 45 funcao public.crm_backfill_sale_ads_origin_from_phone_match(p_sale_id 
CREATE OR REPLACE FUNCTION public.crm_backfill_sale_ads_origin_from_phone_match(p_sale_id text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_sale public.sales%rowtype;
  v_customer public.customers%rowtype;
  v_canonical public.crm_leads%rowtype;
  v_ad record;
begin
  if nullif(btrim(coalesce(p_sale_id, '')), '') is null then
    return;
  end if;

  select * into v_sale
  from public.sales
  where id = p_sale_id;

  if not found or v_sale.crm_lead_id is null or v_sale.customer_id is null then
    return;
  end if;

  select * into v_customer
  from public.customers
  where id = v_sale.customer_id;

  if not found then
    return;
  end if;

  select * into v_canonical
  from public.crm_leads
  where id = v_sale.crm_lead_id
  for update;

  if not found then
    return;
  end if;

  if coalesce(v_canonical.source, '') in ('meta_ads', 'instagram_ads', 'click_to_whatsapp')
     or v_canonical.source_ad_context is not null then
    perform public.crm_upsert_ad_attribution(v_canonical.id);
    return;
  end if;

  select distinct on (l.id)
    l.id as ad_lead_id,
    l.name as ad_lead_name,
    l.phone_normalized as ad_phone_normalized,
    l.source,
    l.source_campaign_id,
    l.source_campaign_title,
    l.source_ad_context,
    a.id as attribution_id,
    a.message_id,
    a.group_key,
    a.detected_at as ad_detected_at
  into v_ad
  from public.crm_leads l
  join public.crm_meta_ads_attributions a on a.lead_id = l.id
  where l.store_id = v_canonical.store_id
    and l.id <> v_canonical.id
    and (
      coalesce(l.source, '') in ('meta_ads', 'instagram_ads', 'click_to_whatsapp')
      or l.source_ad_context is not null
    )
    and public.crm_br_phone_match_key(coalesce(l.phone_normalized, l.phone, l.id)) in (
      public.crm_br_phone_match_key(coalesce(public.normalize_phone(v_customer.phone), v_customer.phone)),
      public.crm_br_phone_match_key(coalesce(public.normalize_phone(v_customer.alternative_phone), v_customer.alternative_phone))
    )
    and a.detected_at <= coalesce(v_sale.date, now())
  order by l.id, a.detected_at asc nulls last, a.id asc;

  if v_ad.ad_lead_id is null then
    return;
  end if;

  update public.crm_leads l
  set
    source = v_ad.source,
    source_campaign_id = coalesce(l.source_campaign_id, v_ad.source_campaign_id),
    source_campaign_title = coalesce(l.source_campaign_title, v_ad.source_campaign_title),
    source_ad_context = jsonb_strip_nulls(
      coalesce(v_ad.source_ad_context, '{}'::jsonb)
      || jsonb_build_object(
        'is_from_ad', true,
        'source', v_ad.source,
        'campaign_id', v_ad.source_campaign_id,
        'campaign_title', v_ad.source_campaign_title,
        'detected_at', v_ad.ad_detected_at,
        'message_id', v_ad.message_id,
        'backfilled_from_lead_id', v_ad.ad_lead_id,
        'backfilled_from_lead_name', v_ad.ad_lead_name,
        'backfilled_from_phone', v_ad.ad_phone_normalized,
        'backfill_reason', 'automatic_br_phone_equivalent_sale',
        'backfill_sale_id', v_sale.id,
        'backfill_sale_number', v_sale.sale_number,
        'backfill_customer_id', v_customer.id,
        'backfill_customer_name', v_customer.name,
        'backfill_customer_phone', v_customer.phone
      )
    ),
    updated_at = now()
  where l.id = v_canonical.id
    and coalesce(l.source, '') not in ('meta_ads', 'instagram_ads', 'click_to_whatsapp')
    and l.source_ad_context is null;

  perform public.crm_upsert_ad_attribution(v_canonical.id);

  update public.crm_meta_ads_attributions ca
  set
    -- Preserve the unique owner of the inbound message. The canonical lead
    -- already retains this provenance in source_ad_context and metadata.
    message_id = case
      when ca.message_id is not null then ca.message_id
      when v_ad.message_id is not null
        and not exists (
          select 1
          from public.crm_meta_ads_attributions other
          where other.message_id = v_ad.message_id
            and other.id <> ca.id
        ) then v_ad.message_id
      else null
    end,
    detected_at = coalesce(v_ad.ad_detected_at, ca.detected_at),
    metadata = jsonb_strip_nulls(
      coalesce(ca.metadata, '{}'::jsonb)
      || jsonb_build_object(
        'backfill_reason', 'automatic_br_phone_equivalent_sale',
        'backfilled_from_lead_id', v_ad.ad_lead_id,
        'backfill_sale_id', v_sale.id,
        'backfill_sale_number', v_sale.sale_number,
        'source_detected_at', v_ad.ad_detected_at,
        'source_message_id', v_ad.message_id
      )
    )
  where ca.lead_id = v_canonical.id
    and ca.group_key = v_ad.group_key;
end;
$function$;
--@@ 45 funcao public.crm_br_phone_match_key(p_phone text)
CREATE OR REPLACE FUNCTION public.crm_br_phone_match_key(p_phone text)
 RETURNS text
 LANGUAGE sql
 IMMUTABLE
AS $function$
  with digits as (
    select regexp_replace(coalesce(p_phone, ''), '\D', '', 'g') as value
  ),
  local_phone as (
    select case
      when value ~ '^55[0-9]{10,11}$' then substring(value from 3)
      else value
    end as value
    from digits
  )
  select nullif(
    case
      when value ~ '^[0-9]{2}9[0-9]{8}$'
        then substring(value from 1 for 2) || substring(value from 4)
      else value
    end,
    ''
  )
  from local_phone;
$function$;
--@@ 45 funcao public.crm_build_lead_summary_operational(p_name text, p_phone 
CREATE OR REPLACE FUNCTION public.crm_build_lead_summary_operational(p_name text, p_phone text, p_sales_stage text, p_intent text, p_conversation_status text, p_last_message_content text, p_last_event_name text, p_last_event_at timestamp with time zone, p_last_order_summary text, p_last_interaction_at timestamp with time zone)
 RETURNS text
 LANGUAGE sql
 STABLE
 SET search_path TO 'public'
AS $function$
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
$function$;
--@@ 45 funcao public.crm_build_lead_summary_short(p_name text, p_phone text, 
CREATE OR REPLACE FUNCTION public.crm_build_lead_summary_short(p_name text, p_phone text, p_sales_stage text, p_intent text)
 RETURNS text
 LANGUAGE sql
 STABLE
 SET search_path TO 'public'
AS $function$
  select nullif(concat_ws(
    ' | ',
    nullif(btrim(coalesce(p_name, '')), ''),
    nullif(btrim(coalesce(p_phone, '')), ''),
    'etapa: ' || coalesce(nullif(btrim(coalesce(p_sales_stage, '')), ''), 'entrada'),
    case when nullif(btrim(coalesce(p_intent, '')), '') is not null then 'intencao: ' || btrim(p_intent) end
  ), '');
$function$;
--@@ 45 funcao public.crm_can_access_store(p_store_id text)
CREATE OR REPLACE FUNCTION public.crm_can_access_store(p_store_id text)
 RETURNS boolean
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_centralized boolean;
begin
  if public.current_role() = 'admin' then
    return true;
  end if;

  if public.current_role() = 'seller' then
    select value_bool
      into v_centralized
    from public.crm_settings
    where id = 'centralized_service'
    limit 1;

    if coalesce(v_centralized, true) is true then
      return true;
    end if;

    return p_store_id is not null and p_store_id = public.current_store_id();
  end if;

  return false;
end;
$function$;
--@@ 45 funcao public.crm_default_sales_stage(p_funnel_stage text)
CREATE OR REPLACE FUNCTION public.crm_default_sales_stage(p_funnel_stage text)
 RETURNS text
 LANGUAGE sql
 IMMUTABLE
 SET search_path TO 'public'
AS $function$
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
$function$;
--@@ 45 funcao public.crm_event_log_sync_lead_last_event()
CREATE OR REPLACE FUNCTION public.crm_event_log_sync_lead_last_event()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
$function$;
--@@ 45 funcao public.crm_fanout_event_log(p_limit integer)
CREATE OR REPLACE FUNCTION public.crm_fanout_event_log(p_limit integer DEFAULT 100)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_event record;
  v_sub record;
  v_count integer := 0;
begin
  for v_event in
    select *
    from public.crm_event_log e
    where e.is_outbound = true
      and coalesce(e.sent, false) = false
      and e.subscription_id is null
    order by e.created_at asc
    limit greatest(coalesce(p_limit, 100), 1)
  loop
    for v_sub in
      select s.*
      from public.crm_webhook_subscriptions s
      where s.is_active = true
        and (s.store_id is null or s.store_id = v_event.store_id)
        and (
          cardinality(s.subscribed_events) = 0
          or v_event.event_type = any(s.subscribed_events)
        )
    loop
      insert into public.crm_event_log (
        store_id,
        event_type,
        payload,
        is_outbound,
        webhook_url,
        sent,
        retry_count,
        processed,
        subscription_id,
        channel_id,
        lead_id,
        conversation_id,
        created_at
      )
      values (
        v_event.store_id,
        v_event.event_type,
        v_event.payload,
        true,
        v_sub.url,
        false,
        0,
        false,
        v_sub.id,
        v_event.channel_id,
        v_event.lead_id,
        v_event.conversation_id,
        v_event.created_at
      );
      v_count := v_count + 1;
    end loop;

    update public.crm_event_log
    set processed = true,
        processed_at = now()
    where id = v_event.id;
  end loop;

  return v_count;
end;
$function$;
--@@ 45 funcao public.crm_identity_fallback_phone(p_identity_type text, p_iden
CREATE OR REPLACE FUNCTION public.crm_identity_fallback_phone(p_identity_type text, p_identity_value text)
 RETURNS text
 LANGUAGE sql
 IMMUTABLE
 SET search_path TO 'public'
AS $function$
  select '+55' || substr(translate(md5(lower(coalesce(p_identity_type, '') || ':' || coalesce(p_identity_value, ''))), 'abcdef', '123456'), 1, 10);
$function$;
--@@ 45 funcao public.crm_jsonb_to_text_array(p_value jsonb)
CREATE OR REPLACE FUNCTION public.crm_jsonb_to_text_array(p_value jsonb)
 RETURNS text[]
 LANGUAGE sql
 IMMUTABLE
 SET search_path TO 'public'
AS $function$
  select coalesce(
    array(
      select distinct trimmed
      from (
        select btrim(value) as trimmed
        from jsonb_array_elements_text(
          case
            when jsonb_typeof(coalesce(p_value, '[]'::jsonb)) = 'array' then coalesce(p_value, '[]'::jsonb)
            else '[]'::jsonb
          end
        ) as value
      ) normalized
      where trimmed <> ''
    ),
    array[]::text[]
  );
$function$;
--@@ 45 funcao public.crm_lead_first_name(p_name text)
CREATE OR REPLACE FUNCTION public.crm_lead_first_name(p_name text)
 RETURNS text
 LANGUAGE sql
 IMMUTABLE
 SET search_path TO 'public'
AS $function$
  select nullif(split_part(regexp_replace(btrim(coalesce(p_name, '')), '\s+', ' ', 'g'), ' ', 1), '');
$function$;
--@@ 45 funcao public.crm_lead_purchase_sync_trigger()
CREATE OR REPLACE FUNCTION public.crm_lead_purchase_sync_trigger()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if pg_trigger_depth() > 1 then
    return new;
  end if;

  perform public.crm_refresh_lead_purchase_metrics(new.id);
  return new;
end;
$function$;
--@@ 45 funcao public.crm_leads_sync_enriched_columns()
CREATE OR REPLACE FUNCTION public.crm_leads_sync_enriched_columns()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  new.first_name := public.crm_lead_first_name(new.name);
  new.sales_stage := coalesce(nullif(btrim(new.sales_stage), ''), public.crm_default_sales_stage(new.funnel_stage), 'entrada');
  return new;
end;
$function$;
--@@ 45 funcao public.crm_messages_sync_lead_last_message_content()
CREATE OR REPLACE FUNCTION public.crm_messages_sync_lead_last_message_content()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
$function$;
--@@ 45 funcao public.crm_refresh_lead_purchase_metrics(p_lead_id text)
CREATE OR REPLACE FUNCTION public.crm_refresh_lead_purchase_metrics(p_lead_id text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_lead public.crm_leads%rowtype;
  v_customer_id text;
  v_purchase_count integer := 0;
  v_last_purchase_at timestamptz;
  v_lifetime_value numeric := 0;
  v_last_order_id text;
  v_last_order_at timestamptz;
  v_last_order_value numeric;
  v_last_order_summary text;
begin
  if p_lead_id is null or btrim(p_lead_id) = '' then
    return;
  end if;

  select * into v_lead
  from public.crm_leads
  where id = p_lead_id
  for update;

  if not found then
    return;
  end if;

  v_customer_id := v_lead.customer_id;

  if v_customer_id is null then
    with candidate as (
      select c.id,
             row_number() over (order by c.updated_at desc nulls last, c.created_at desc nulls last, c.id) as rn,
             count(*) over () as total_rows
      from public.customers c
      where public.normalize_phone(c.phone) = v_lead.phone_normalized
         or public.normalize_phone(c.alternative_phone) = v_lead.phone_normalized
    )
    select id into v_customer_id
    from candidate
    where total_rows = 1 and rn = 1;
  end if;

  if v_customer_id is not null or exists (select 1 from public.sales s where s.crm_lead_id = p_lead_id) then
    with sale_scope as (
      select distinct s.*
      from public.sales s
      where s.crm_lead_id = p_lead_id
         or (v_customer_id is not null and s.customer_id = v_customer_id)
    )
    select
      count(*)::integer,
      max(s.date),
      coalesce(sum(s.total), 0),
      (array_agg(s.id order by s.date desc nulls last, s.created_at desc nulls last, s.id desc))[1],
      (array_agg(s.date order by s.date desc nulls last, s.created_at desc nulls last, s.id desc))[1],
      (array_agg(s.total order by s.date desc nulls last, s.created_at desc nulls last, s.id desc))[1]
    into
      v_purchase_count,
      v_last_purchase_at,
      v_lifetime_value,
      v_last_order_id,
      v_last_order_at,
      v_last_order_value
    from sale_scope s;

    if v_last_order_id is not null then
      select string_agg(distinct coalesce(si_model.model, 'Item'), ', ' order by coalesce(si_model.model, 'Item'))
      into v_last_order_summary
      from public.sale_items si
      left join public.stock_items si_model on si_model.id = si.stock_item_id
      where si.sale_id = v_last_order_id;
    end if;
  end if;

  update public.crm_leads
  set
    customer_id = coalesce(v_customer_id, customer_id),
    is_customer = (
      coalesce(v_customer_id, customer_id) is not null
      or coalesce(v_purchase_count, 0) > 0
      or coalesce(v_lifetime_value, 0) > 0
    ),
    purchase_count = coalesce(v_purchase_count, 0),
    last_purchase_at = v_last_purchase_at,
    last_order_id = v_last_order_id,
    last_order_at = v_last_order_at,
    last_order_value = v_last_order_value,
    last_order_summary = v_last_order_summary,
    lifetime_value = coalesce(v_lifetime_value, 0),
    updated_at = now()
  where id = p_lead_id;
end;
$function$;
--@@ 45 funcao public.crm_refresh_purchase_metrics_for_customer(p_customer_id 
CREATE OR REPLACE FUNCTION public.crm_refresh_purchase_metrics_for_customer(p_customer_id text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  r record;
  v_customer_phone text;
  v_customer_alternative_phone text;
begin
  if p_customer_id is null or btrim(p_customer_id) = '' then
    return;
  end if;

  select public.normalize_phone(c.phone), public.normalize_phone(c.alternative_phone)
    into v_customer_phone, v_customer_alternative_phone
  from public.customers c
  where c.id = p_customer_id
  limit 1;

  for r in
    select l.id
    from public.crm_leads l
    where l.customer_id = p_customer_id
       or (l.customer_id is null and v_customer_phone is not null and l.phone_normalized = v_customer_phone)
       or (l.customer_id is null and v_customer_alternative_phone is not null and l.phone_normalized = v_customer_alternative_phone)
       or exists (
         select 1 from public.sales s
         where s.customer_id = p_customer_id
           and s.crm_lead_id = l.id
       )
  loop
    perform public.crm_refresh_lead_purchase_metrics(r.id);
  end loop;
end;
$function$;
--@@ 45 funcao public.crm_sales_purchase_sync_trigger()
CREATE OR REPLACE FUNCTION public.crm_sales_purchase_sync_trigger()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if tg_op in ('INSERT', 'UPDATE') then
    if new.customer_id is not null then
      perform public.crm_refresh_purchase_metrics_for_customer(new.customer_id);
    end if;

    if new.crm_lead_id is not null then
      perform public.crm_refresh_lead_purchase_metrics(new.crm_lead_id);
    end if;

    if tg_op = 'UPDATE' then
      if old.customer_id is not null and old.customer_id is distinct from new.customer_id then
        perform public.crm_refresh_purchase_metrics_for_customer(old.customer_id);
      end if;

      if old.crm_lead_id is not null and old.crm_lead_id is distinct from new.crm_lead_id then
        perform public.crm_refresh_lead_purchase_metrics(old.crm_lead_id);
      end if;
    end if;
    return new;
  end if;

  if tg_op = 'DELETE' then
    if old.customer_id is not null then
      perform public.crm_refresh_purchase_metrics_for_customer(old.customer_id);
    end if;

    if old.crm_lead_id is not null then
      perform public.crm_refresh_lead_purchase_metrics(old.crm_lead_id);
    end if;
    return old;
  end if;

  return null;
end;
$function$;
--@@ 45 funcao public.crm_set_default_funnel_fields()
CREATE OR REPLACE FUNCTION public.crm_set_default_funnel_fields()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_sales_funnel_id UUID;
BEGIN
  IF NEW.funnel_stage IS NULL OR btrim(NEW.funnel_stage) = '' THEN
    NEW.funnel_stage := 'new_lead';
  END IF;

  IF NEW.funnel_id IS NULL THEN
    SELECT id INTO v_sales_funnel_id
    FROM public.crm_funnels
    WHERE store_id = NEW.store_id
      AND funnel_type = 'sales'
    ORDER BY is_default DESC, created_at ASC
    LIMIT 1;

    NEW.funnel_id := v_sales_funnel_id;
  END IF;

  RETURN NEW;
END;
$function$;
--@@ 45 funcao public.crm_set_updated_at()
CREATE OR REPLACE FUNCTION public.crm_set_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
begin
  new.updated_at := now();
  return new;
end;
$function$;
--@@ 45 funcao public.crm_sync_lead_attendance_from_conversation()
CREATE OR REPLACE FUNCTION public.crm_sync_lead_attendance_from_conversation()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_status text;
  v_owner text;
  v_last_agent text;
begin
  v_status := case
    when new.status = 'ai_handling' then 'em_atendimento_ia'
    when new.status = 'human_handling' then 'em_atendimento_humano'
    when new.status = 'closed' then 'encerrado'
    else null
  end;

  v_owner := case
    when new.status = 'ai_handling' then 'ia'
    when new.status = 'human_handling' then 'humano_loja'
    else null
  end;

  v_last_agent := case
    when new.status = 'ai_handling' then 'alana'
    when new.status = 'human_handling' then 'humano'
    else null
  end;

  update public.crm_leads l
  set
    conversation_status = coalesce(v_status, l.conversation_status),
    attendance_owner = coalesce(v_owner, l.attendance_owner),
    handoff_at = case
      when new.status = 'human_handling' and tg_op = 'UPDATE' and old.status = 'ai_handling' then coalesce(l.handoff_at, now())
      when new.status = 'ai_handling' then now()
      else l.handoff_at
    end,
    human_started_at = case
      when new.status = 'human_handling' then coalesce(l.human_started_at, now())
      else l.human_started_at
    end,
    last_agent_type = coalesce(v_last_agent, l.last_agent_type),
    updated_at = now()
  where l.id = new.lead_id;

  return new;
end;
$function$;
--@@ 45 funcao public.crm_sync_lead_store_to_related_tables()
CREATE OR REPLACE FUNCTION public.crm_sync_lead_store_to_related_tables()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
declare
  v_store_id text;
begin
  if tg_table_name = 'crm_conversations' then
    select l.store_id into v_store_id from public.crm_leads l where l.id = new.lead_id limit 1;
    if v_store_id is null then
      raise exception 'Lead not found for conversation: %', new.lead_id;
    end if;
    new.store_id := v_store_id;
    return new;
  end if;

  if tg_table_name = 'crm_messages' then
    if new.conversation_id is null then
      return new;
    end if;

    select c.store_id, c.lead_id, c.channel_id
      into v_store_id, new.lead_id, new.channel_id
    from public.crm_conversations c
    where c.id = new.conversation_id
    limit 1;

    if v_store_id is null then
      raise exception 'Conversation not found for message: %', new.conversation_id;
    end if;

    new.store_id := v_store_id;
    return new;
  end if;

  if tg_table_name = 'crm_lead_stage_history' then
    select l.store_id into v_store_id from public.crm_leads l where l.id = new.lead_id limit 1;
    new.store_id := v_store_id;
    return new;
  end if;

  if tg_table_name = 'crm_scheduled_messages' then
    select l.store_id into v_store_id from public.crm_leads l where l.id = new.lead_id limit 1;
    new.store_id := v_store_id;
    return new;
  end if;

  return new;
end;
$function$;
--@@ 45 funcao public.crm_trg_attribute_lead_ad()
CREATE OR REPLACE FUNCTION public.crm_trg_attribute_lead_ad()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  perform public.crm_upsert_ad_attribution(new.id);
  return null;
end;
$function$;
--@@ 45 funcao public.crm_ui_preferences_set_updated_at()
CREATE OR REPLACE FUNCTION public.crm_ui_preferences_set_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$function$;
--@@ 45 funcao public.crm_upsert_ad_attribution(p_lead_id text)
CREATE OR REPLACE FUNCTION public.crm_upsert_ad_attribution(p_lead_id text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  l public.crm_leads%rowtype;
  v_ctx jsonb;
  v_sig text;
  v_app text;
  v_group_key uuid;
  v_detected_at timestamptz;
begin
  select * into l from public.crm_leads where id = p_lead_id;
  if not found then
    return;
  end if;

  v_ctx := l.source_ad_context;

  -- Only leads that actually came from a paid ad.
  if not (
       coalesce(l.source, '') in ('meta_ads', 'instagram_ads', 'click_to_whatsapp')
       or (v_ctx is not null and coalesce((v_ctx->>'is_from_ad')::boolean, false))
     ) then
    return;
  end if;

  v_sig := public.crm_ad_creative_signature(
    l.source_campaign_id, l.source_campaign_title, v_ctx
  );
  if v_sig is null then
    return;
  end if;

  v_app := public.crm_ad_source_app(l.source, v_ctx);
  v_detected_at := coalesce(l.first_contact_at, l.created_at, now());

  insert into public.crm_meta_ads_groups as g (
    store_id, creative_signature, source_app, auto_name, status,
    sample_title, sample_body, sample_media_url, sample_thumbnail_url,
    sample_source_url, first_seen_at, last_seen_at
  ) values (
    l.store_id, v_sig, v_app,
    coalesce(l.source_campaign_title, v_ctx->>'campaign_title'),
    'pending_review',
    coalesce(l.source_campaign_title, v_ctx->>'campaign_title'),
    v_ctx->>'campaign_body',
    v_ctx->>'image_url',
    coalesce(v_ctx->>'thumbnail_url', v_ctx->>'image_url'),
    v_ctx->>'source_url',
    v_detected_at, v_detected_at
  )
  on conflict (store_id, creative_signature) do update set
    last_seen_at         = greatest(coalesce(g.last_seen_at, excluded.last_seen_at), excluded.last_seen_at),
    first_seen_at        = least(coalesce(g.first_seen_at, excluded.first_seen_at), excluded.first_seen_at),
    auto_name            = coalesce(g.auto_name, excluded.auto_name),
    sample_title         = coalesce(g.sample_title, excluded.sample_title),
    sample_body          = coalesce(g.sample_body, excluded.sample_body),
    sample_media_url     = coalesce(g.sample_media_url, excluded.sample_media_url),
    sample_thumbnail_url = coalesce(g.sample_thumbnail_url, excluded.sample_thumbnail_url),
    sample_source_url    = coalesce(g.sample_source_url, excluded.sample_source_url),
    updated_at           = now()
  returning g.group_key into v_group_key;

  -- At most one attribution per (group, lead).
  if not exists (
    select 1 from public.crm_meta_ads_attributions a
    where a.group_key = v_group_key and a.lead_id = l.id
  ) then
    insert into public.crm_meta_ads_attributions (
      store_id, lead_id, group_key, source_app, raw_source_id, detected_at
    ) values (
      l.store_id, l.id, v_group_key, v_app,
      coalesce(l.source_campaign_id, v_ctx->>'campaign_id'),
      v_detected_at
    );

    update public.crm_meta_ads_groups
       set total_attributions = total_attributions + 1,
           updated_at = now()
     where group_key = v_group_key;
  end if;
end;
$function$;
--@@ 45 funcao public.crm_upsert_lead_by_identity(p_store_id text, p_identity_
CREATE OR REPLACE FUNCTION public.crm_upsert_lead_by_identity(p_store_id text, p_identity_type text, p_identity_value text, p_name text DEFAULT NULL::text, p_channel_id uuid DEFAULT NULL::uuid, p_phone text DEFAULT NULL::text, p_email text DEFAULT NULL::text, p_contact_id text DEFAULT NULL::text, p_entity_id text DEFAULT NULL::text, p_first_message text DEFAULT NULL::text, p_utm_source text DEFAULT NULL::text, p_utm_campaign text DEFAULT NULL::text, p_utm_medium text DEFAULT NULL::text, p_utm_content text DEFAULT NULL::text, p_utm_term text DEFAULT NULL::text, p_intent text DEFAULT NULL::text)
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_store_id text := nullif(btrim(coalesce(p_store_id, '')), '');
  v_identity_type text := lower(nullif(btrim(coalesce(p_identity_type, '')), ''));
  v_identity_value text := nullif(btrim(coalesce(p_identity_value, '')), '');
  v_lead_id text;
  v_phone text;
  v_has_primary boolean;
begin
  if v_store_id is null then
    raise exception 'store_id is required';
  end if;

  if v_identity_type is null or v_identity_type not in ('phone', 'email', 'instagram_igsid', 'instagram_username') then
    raise exception 'Unsupported identity_type: %', coalesce(v_identity_type, '<null>');
  end if;

  if v_identity_value is null then
    raise exception 'identity_value is required';
  end if;

  select li.lead_id
    into v_lead_id
  from public.crm_lead_identities li
  where li.store_id = v_store_id
    and li.identity_type = v_identity_type
    and li.identity_value_normalized = lower(v_identity_value)
  limit 1;

  if v_lead_id is null then
    v_phone := case
      when v_identity_type = 'phone' then v_identity_value
      else coalesce(nullif(btrim(coalesce(p_phone, '')), ''), public.crm_identity_fallback_phone(v_identity_type, v_identity_value))
    end;

    v_lead_id := public.upsert_crm_lead(
      v_store_id,
      v_phone,
      p_name,
      p_contact_id,
      p_entity_id,
      p_channel_id,
      p_email,
      p_utm_source,
      p_utm_campaign,
      p_utm_medium,
      p_utm_content,
      p_utm_term,
      p_first_message,
      p_intent
    );
  else
    update public.crm_leads
    set
      name = coalesce(nullif(btrim(public.crm_leads.name), ''), nullif(btrim(p_name), ''), public.crm_leads.name),
      email = coalesce(nullif(btrim(public.crm_leads.email), ''), nullif(btrim(p_email), ''), public.crm_leads.email),
      source_channel_id = coalesce(p_channel_id, public.crm_leads.source_channel_id),
      updated_at = now(),
      last_message_at = now(),
      last_interaction_at = now()
    where id = v_lead_id;
  end if;

  select exists (
    select 1
    from public.crm_lead_identities li
    where li.lead_id = v_lead_id
      and li.identity_type = v_identity_type
      and li.is_primary = true
  )
  into v_has_primary;

  insert into public.crm_lead_identities (
    lead_id,
    store_id,
    identity_type,
    identity_value,
    is_primary,
    metadata
  )
  values (
    v_lead_id,
    v_store_id,
    v_identity_type,
    v_identity_value,
    not v_has_primary,
    jsonb_build_object('source', 'crm_upsert_lead_by_identity', 'updated_at', now())
  )
  on conflict (store_id, identity_type, identity_value_normalized)
  do update
  set
    lead_id = excluded.lead_id,
    identity_value = excluded.identity_value,
    metadata = coalesce(public.crm_lead_identities.metadata, '{}'::jsonb) || jsonb_build_object('updated_at', now()),
    updated_at = now();

  perform public.crm_refresh_lead_purchase_metrics(v_lead_id);
  return v_lead_id;
end;
$function$;
--@@ 45 funcao public.crm_upsert_lead_by_identity_rpc(p_store_id text, p_ident
CREATE OR REPLACE FUNCTION public.crm_upsert_lead_by_identity_rpc(p_store_id text, p_identity_type text, p_identity_value text, p_name text DEFAULT NULL::text, p_channel_id uuid DEFAULT NULL::uuid, p_phone text DEFAULT NULL::text, p_email text DEFAULT NULL::text, p_contact_id text DEFAULT NULL::text, p_entity_id text DEFAULT NULL::text, p_first_message text DEFAULT NULL::text, p_utm_source text DEFAULT NULL::text, p_utm_campaign text DEFAULT NULL::text, p_utm_medium text DEFAULT NULL::text, p_utm_content text DEFAULT NULL::text, p_utm_term text DEFAULT NULL::text, p_intent text DEFAULT NULL::text)
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  return public.crm_upsert_lead_by_identity(
    p_store_id,
    p_identity_type,
    p_identity_value,
    p_name,
    p_channel_id,
    p_phone,
    p_email,
    p_contact_id,
    p_entity_id,
    p_first_message,
    p_utm_source,
    p_utm_campaign,
    p_utm_medium,
    p_utm_content,
    p_utm_term,
    p_intent
  );
end;
$function$;
--@@ 45 funcao public.current_store_id()
CREATE OR REPLACE FUNCTION public.current_store_id()
 RETURNS text
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select s.store_id
  from public.user_profiles up
  join public.sellers s on s.id = up.seller_id
  where up.id = auth.uid()
  limit 1;
$function$;
--@@ 45 funcao public.customer_ids_by_normalized_cpf(input_cpf text)
CREATE OR REPLACE FUNCTION public.customer_ids_by_normalized_cpf(input_cpf text)
 RETURNS TABLE(id text, name text, cpf text)
 LANGUAGE sql
 STABLE
 SET search_path TO 'public'
AS $function$
  select
    c.id,
    c.name,
    c.cpf
  from public.customers c
  where regexp_replace(coalesce(c.cpf, ''), '\D', '', 'g') = regexp_replace(coalesce(input_cpf, ''), '\D', '', 'g');
$function$;
--@@ 45 funcao public.delete_debt_cascade(p_debt_id text)
CREATE OR REPLACE FUNCTION public.delete_debt_cascade(p_debt_id text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if public.current_role() <> 'admin' then
    raise exception 'Only admins can delete debts.' using errcode = '42501';
  end if;

  perform 1
  from public.debts
  where id = p_debt_id
  for update;

  if not found then
    raise exception 'Dívida não encontrada.';
  end if;

  delete from public.debt_payments
  where debt_id = p_debt_id;

  delete from public.debts
  where id = p_debt_id;
end;
$function$;
--@@ 45 funcao public.enqueue_crm_uaz_avatar_job(p_store_id text, p_lead_id te
CREATE OR REPLACE FUNCTION public.enqueue_crm_uaz_avatar_job(p_store_id text, p_lead_id text, p_channel_id uuid, p_conversation_id uuid, p_talk_id text, p_force boolean DEFAULT false)
 RETURNS uuid
 LANGUAGE plpgsql
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare
  v_job_id uuid;
begin
  if nullif(btrim(p_store_id), '') is null
    or nullif(btrim(p_lead_id), '') is null
    or p_channel_id is null
    or nullif(btrim(p_talk_id), '') is null then
    raise exception 'Avatar job requires store, lead, channel and talk id.';
  end if;

  insert into public.crm_uaz_avatar_jobs (
    store_id,
    lead_id,
    channel_id,
    conversation_id,
    talk_id,
    status,
    attempts,
    force_refresh,
    available_at,
    lease_expires_at,
    last_error_code,
    updated_at
  )
  select
    p_store_id,
    p_lead_id,
    p_channel_id,
    p_conversation_id,
    btrim(p_talk_id),
    'pending',
    0,
    p_force,
    now(),
    null,
    null,
    now()
  from public.crm_leads lead
  join public.crm_channels channel
    on channel.id = p_channel_id
   and channel.store_id = p_store_id
   and channel.provider = 'uazapi'
   and channel.is_active is true
  where lead.id = p_lead_id
    and lead.store_id = p_store_id
    and (
      p_force
      or lead.avatar_last_checked_at is null
      or lead.avatar_last_checked_at <= now() - interval '24 hours'
    )
  on conflict (lead_id) do update
  set
    store_id = excluded.store_id,
    channel_id = excluded.channel_id,
    conversation_id = excluded.conversation_id,
    talk_id = excluded.talk_id,
    status = case
      when crm_uaz_avatar_jobs.status = 'processing'
        and crm_uaz_avatar_jobs.lease_expires_at > now()
        then crm_uaz_avatar_jobs.status
      else 'pending'
    end,
    attempts = case
      when crm_uaz_avatar_jobs.status = 'processing'
        and crm_uaz_avatar_jobs.lease_expires_at > now()
        then crm_uaz_avatar_jobs.attempts
      else 0
    end,
    force_refresh = crm_uaz_avatar_jobs.force_refresh or excluded.force_refresh,
    available_at = case
      when crm_uaz_avatar_jobs.status = 'processing'
        and crm_uaz_avatar_jobs.lease_expires_at > now()
        then crm_uaz_avatar_jobs.available_at
      else now()
    end,
    lease_expires_at = case
      when crm_uaz_avatar_jobs.status = 'processing'
        and crm_uaz_avatar_jobs.lease_expires_at > now()
        then crm_uaz_avatar_jobs.lease_expires_at
      else null
    end,
    last_error_code = null,
    updated_at = now()
  returning id into v_job_id;

  return v_job_id;
end;
$function$;
--@@ 45 funcao public.generate_composite_lead_id()
CREATE OR REPLACE FUNCTION public.generate_composite_lead_id()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
BEGIN
    -- Format: numbers_only_phone-store_id_uuid
    -- Example: 558599640050-22222222-2222-2222-2222-222222222222
    
    IF NEW.id IS NULL OR NEW.id = '' THEN
         NEW.id := regexp_replace(NEW.phone, '\D', '', 'g') || '-' || NEW.store_id;
    END IF;
    RETURN NEW;
END;
$function$;
--@@ 45 funcao public.get_broadcast_stats(p_broadcast_id uuid)
CREATE OR REPLACE FUNCTION public.get_broadcast_stats(p_broadcast_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_total integer := 0;
  v_sent integer := 0;
  v_failed integer := 0;
  v_pending integer := 0;
begin
  select
    count(*)::integer,
    count(*) filter (where status = 'sent')::integer,
    count(*) filter (where status = 'failed')::integer,
    count(*) filter (where status = 'pending')::integer
  into v_total, v_sent, v_failed, v_pending
  from public.crm_broadcast_recipients
  where broadcast_id = p_broadcast_id;

  return jsonb_build_object(
    'total', v_total,
    'sent', v_sent,
    'failed', v_failed,
    'pending', v_pending
  );
end;
$function$;
--@@ 45 funcao public.get_cashback_summary(p_store_id text)
CREATE OR REPLACE FUNCTION public.get_cashback_summary(p_store_id text)
 RETURNS TABLE(lead_id text, lead_name text, lifetime_value numeric, purchase_count integer, cashback_available numeric)
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select
    l.id,
    l.name,
    coalesce(l.lifetime_value, 0),
    coalesce(l.purchase_count, 0),
    round(coalesce(l.lifetime_value, 0) * 0.03, 2) as cashback_available
  from public.crm_leads l
  where l.store_id = p_store_id
    and l.is_customer = true
  order by l.lifetime_value desc nulls last
  limit 300;
$function$;
--@@ 45 funcao public.get_crm_ads_dashboard(p_store_id text)
CREATE OR REPLACE FUNCTION public.get_crm_ads_dashboard(p_store_id text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_groups jsonb;
  v_summary jsonb;
begin
  with attr_lead as (
    select
      a.group_key,
      a.store_id,
      a.lead_id,
      count(a.id)::int as attributions,
      max(a.detected_at) as lead_last_detected_at,
      bool_or(coalesce(l.purchase_count, 0) > 0 or l.sales_stage = 'ganho') as legacy_is_buyer,
      max(coalesce(l.lifetime_value, 0)) as legacy_lifetime_value,
      max(l.customer_id) as lead_customer_id,
      max(l.phone_normalized) as lead_phone_normalized
    from public.crm_meta_ads_attributions a
    join public.crm_leads l on l.id = a.lead_id and l.store_id = a.store_id
    where a.store_id = p_store_id
      and a.lead_id is not null
    group by a.group_key, a.store_id, a.lead_id
  ),
  candidate_sales as (
    select distinct on (al.group_key, al.lead_id, s.id)
      al.group_key,
      al.lead_id,
      s.id as sale_id,
      s.store_id as sale_store_id,
      s.customer_id,
      s.sale_number,
      s.total as sale_total,
      s.date as sale_date,
      case
        when s.crm_lead_id = al.lead_id then 'direct_sale'
        when al.lead_customer_id is not null and s.customer_id = al.lead_customer_id then 'customer_id_sale'
        else 'phone_customer_sale'
      end as conversion_source,
      case
        when s.crm_lead_id = al.lead_id then 1
        when al.lead_customer_id is not null and s.customer_id = al.lead_customer_id then 2
        else 3
      end as conversion_rank
    from attr_lead al
    join public.customers c on (
      (al.lead_customer_id is not null and c.id = al.lead_customer_id)
      or (
        al.lead_phone_normalized is not null
        and (
          public.normalize_phone(c.phone) = al.lead_phone_normalized
          or public.normalize_phone(c.alternative_phone) = al.lead_phone_normalized
        )
      )
    )
    join public.sales s on s.customer_id = c.id
    order by al.group_key, al.lead_id, s.id,
      case
        when s.crm_lead_id = al.lead_id then 1
        when al.lead_customer_id is not null and s.customer_id = al.lead_customer_id then 2
        else 3
      end
  ),
  real_sales_by_lead as (
    select
      cs.group_key,
      cs.lead_id,
      count(distinct cs.sale_id)::int as real_sale_count,
      coalesce(sum(cs.sale_total), 0) as real_revenue,
      max(cs.sale_date) as last_sale_at
    from candidate_sales cs
    group by cs.group_key, cs.lead_id
  ),
  lead_stats as (
    select
      al.group_key,
      al.lead_id,
      al.attributions,
      al.lead_last_detected_at,
      coalesce(rs.real_sale_count, 0) as direct_sale_count,
      coalesce(rs.real_revenue, 0) as direct_revenue,
      case
        when coalesce(rs.real_sale_count, 0) > 0 then 0
        when al.legacy_is_buyer then al.legacy_lifetime_value
        else 0
      end as fallback_revenue,
      (coalesce(rs.real_sale_count, 0) > 0 or al.legacy_is_buyer) as is_buyer,
      (coalesce(rs.real_sale_count, 0) > 0) as is_real_buyer
    from attr_lead al
    left join real_sales_by_lead rs on rs.group_key = al.group_key and rs.lead_id = al.lead_id
  ),
  conversion_rows as (
    select
      cs.group_key,
      l.id as lead_id,
      coalesce(l.name, l.phone) as lead_name,
      l.phone as lead_phone,
      l.sales_stage as lead_stage,
      cs.customer_id,
      c.name as customer_name,
      c.phone as customer_phone,
      cs.sale_id,
      cs.sale_store_id,
      cs.sale_number,
      cs.sale_total,
      cs.sale_date,
      coalesce(items.items_count, 0)::int as items_count,
      coalesce(items.product_models, array[]::text[]) as product_models,
      cs.conversion_source
    from candidate_sales cs
    join public.crm_leads l on l.id = cs.lead_id and l.store_id = p_store_id
    left join public.customers c on c.id = cs.customer_id
    left join lateral (
      select
        count(si.id)::int as items_count,
        array_remove(array_agg(distinct nullif(btrim(concat_ws(' ', sti.model, sti.capacity)), '')), null) as product_models
      from public.sale_items si
      left join public.stock_items sti on sti.id = si.stock_item_id
      where si.sale_id = cs.sale_id
    ) items on true
  ),
  conversion_details as (
    select
      c.group_key,
      coalesce(jsonb_agg(row_to_json(c) order by c.sale_date desc nulls last, c.sale_number desc nulls last), '[]'::jsonb) as conversions
    from conversion_rows c
    group by c.group_key
  ),
  group_stats as (
    select
      ls.group_key,
      sum(ls.attributions)::int as attributions,
      count(*)::int as leads,
      count(*) filter (where ls.is_buyer)::int as customers,
      count(*) filter (where ls.is_real_buyer)::int as real_customers,
      coalesce(sum(ls.direct_revenue), 0) + coalesce(sum(ls.fallback_revenue), 0) as revenue,
      coalesce(sum(ls.direct_revenue), 0) as direct_revenue,
      coalesce(sum(ls.fallback_revenue), 0) as fallback_revenue,
      max(ls.lead_last_detected_at) as last_attribution_at
    from lead_stats ls
    group by ls.group_key
  ),
  recovered_group_media as (
    select distinct on (a.group_key)
      a.group_key,
      media.url as creative_image_url
    from public.crm_meta_ads_attributions a
    left join public.crm_leads l on l.id = a.lead_id
    left join public.crm_messages m on m.id::text = coalesce(a.message_id::text, l.source_ad_context->>'message_id')
    cross join lateral (
      values
        (nullif(btrim(l.source_ad_context->>'thumbnail_url'), ''), 1),
        (nullif(btrim(l.source_ad_context->>'image_url'), ''), 2),
        (nullif(btrim(l.source_ad_context->>'media_url'), ''), 3),
        (nullif(btrim(l.source_ad_context->>'thumbnailURL'), ''), 4),
        (nullif(btrim(l.source_ad_context->>'mediaURL'), ''), 5),
        (nullif(btrim(l.source_ad_context->>'originalImageURL'), ''), 6),
        (nullif(btrim(m.webhook_payload #>> '{message,content,contextInfo,externalAdReply,thumbnailURL}'), ''), 7),
        (nullif(btrim(m.webhook_payload #>> '{message,content,contextInfo,externalAdReply,mediaURL}'), ''), 8),
        (nullif(btrim(m.webhook_payload #>> '{message,content,contextInfo,externalAdReply,originalImageURL}'), ''), 9),
        (nullif(btrim(m.webhook_payload #>> '{message,contextInfo,externalAdReply,thumbnailURL}'), ''), 10),
        (nullif(btrim(m.webhook_payload #>> '{message,contextInfo,externalAdReply,mediaURL}'), ''), 11)
    ) as media(url, priority)
    where a.store_id = p_store_id
      and public.crm_ads_is_probable_image_url(media.url)
    order by a.group_key, media.priority asc, a.detected_at asc nulls last, a.id asc
  ),
  recovered_group_source as (
    select distinct on (a.group_key)
      a.group_key,
      source.url as creative_source_url
    from public.crm_meta_ads_attributions a
    left join public.crm_leads l on l.id = a.lead_id
    left join public.crm_messages m on m.id::text = coalesce(a.message_id::text, l.source_ad_context->>'message_id')
    cross join lateral (
      values
        (nullif(btrim(l.source_ad_context->>'source_url'), ''), 1),
        (nullif(btrim(l.source_ad_context->>'sourceURL'), ''), 2),
        (nullif(btrim(m.webhook_payload #>> '{message,content,contextInfo,externalAdReply,sourceURL}'), ''), 3),
        (nullif(btrim(m.webhook_payload #>> '{message,contextInfo,externalAdReply,sourceURL}'), ''), 4)
    ) as source(url, priority)
    where a.store_id = p_store_id
      and nullif(source.url, '') is not null
      and lower(source.url) ~ '^https?://'
    order by a.group_key, source.priority asc, a.detected_at asc nulls last, a.id asc
  ),
  group_rows as (
    select
      g.group_key,
      g.auto_name,
      g.status,
      g.source_app,
      g.sample_title,
      g.sample_body,
      g.sample_media_url,
      g.sample_thumbnail_url,
      g.sample_source_url,
      coalesce(
        case when public.crm_ads_is_probable_image_url(g.sample_thumbnail_url) then g.sample_thumbnail_url end,
        case when public.crm_ads_is_probable_image_url(g.sample_media_url) then g.sample_media_url end,
        rgm.creative_image_url
      ) as creative_image_url,
      coalesce(g.sample_source_url, rgs.creative_source_url) as creative_source_url,
      g.first_seen_at,
      g.last_seen_at,
      coalesce(gs.attributions, 0) as attributions,
      coalesce(gs.leads, 0) as leads,
      coalesce(gs.customers, 0) as customers,
      coalesce(gs.real_customers, 0) as real_customers,
      coalesce(gs.revenue, 0) as revenue,
      coalesce(gs.direct_revenue, 0) as direct_revenue,
      coalesce(gs.fallback_revenue, 0) as fallback_revenue,
      gs.last_attribution_at,
      case when coalesce(gs.leads, 0) > 0 then round(gs.customers::numeric / gs.leads, 4) else 0 end as assisted_conversion_rate,
      case when coalesce(gs.leads, 0) > 0 then round(gs.real_customers::numeric / gs.leads, 4) else 0 end as real_conversion_rate,
      case when coalesce(gs.leads, 0) > 0 then round(gs.real_customers::numeric / gs.leads, 4) else 0 end as conversion_rate,
      case when coalesce(gs.leads, 0) = 0 then 0 else least(round(gs.real_customers::numeric / gs.leads / 0.30 * 100)::int, 100) end as score,
      case
        when coalesce(gs.leads, 0) < 3 then 'novo'
        when gs.real_customers::numeric / gs.leads >= 0.25 then 'A'
        when gs.real_customers::numeric / gs.leads >= 0.15 then 'B'
        when gs.real_customers::numeric / gs.leads >= 0.07 then 'C'
        when gs.real_customers > 0 then 'D'
        else 'E'
      end as grade,
      coalesce(cd.conversions, '[]'::jsonb) as conversions,
      (coalesce(gs.last_attribution_at, g.last_seen_at) >= now() - interval '7 days') as is_active
    from public.crm_meta_ads_groups g
    left join group_stats gs on gs.group_key = g.group_key
    left join conversion_details cd on cd.group_key = g.group_key
    left join recovered_group_media rgm on rgm.group_key = g.group_key
    left join recovered_group_source rgs on rgs.group_key = g.group_key
    where g.store_id = p_store_id
      and g.status <> 'ignored'
    order by score desc, g.last_seen_at desc nulls last
    limit 200
  ),
  groups_payload as (
    select coalesce(jsonb_agg(row_to_json(gr) order by gr.score desc, gr.last_seen_at desc nulls last), '[]'::jsonb) as groups
    from group_rows gr
  ),
  summary_payload as (
    select jsonb_build_object(
      'active_campaigns', (
        select count(*)::int
        from public.crm_meta_ads_groups g
        where g.store_id = p_store_id
          and g.status <> 'ignored'
          and coalesce(
                (select max(a.detected_at) from public.crm_meta_ads_attributions a where a.group_key = g.group_key),
                g.last_seen_at
              ) >= now() - interval '7 days'
      ),
      'total_campaigns', (
        select count(*)::int
        from public.crm_meta_ads_groups g
        where g.store_id = p_store_id
          and g.status <> 'ignored'
      ),
      'total_leads', count(*)::int,
      'total_customers', count(*) filter (where t.is_buyer)::int,
      'real_customers', count(*) filter (where t.is_real_buyer)::int,
      'total_revenue', coalesce(sum(t.direct_revenue + t.fallback_revenue) filter (where t.is_buyer), 0),
      'direct_revenue', coalesce(sum(t.direct_revenue) filter (where t.is_real_buyer), 0),
      'fallback_revenue', coalesce(sum(t.fallback_revenue) filter (where t.is_buyer), 0),
      'assisted_conversion_rate', case
        when count(*) > 0 then round(count(*) filter (where t.is_buyer)::numeric / count(*), 4)
        else 0
      end,
      'real_conversion_rate', case
        when count(*) > 0 then round(count(*) filter (where t.is_real_buyer)::numeric / count(*), 4)
        else 0
      end,
      'conversion_rate', case
        when count(*) > 0 then round(count(*) filter (where t.is_real_buyer)::numeric / count(*), 4)
        else 0
      end
    ) as summary
    from lead_stats t
  )
  select gp.groups, sp.summary
    into v_groups, v_summary
  from groups_payload gp
  cross join summary_payload sp;

  return jsonb_build_object(
    'summary', coalesce(v_summary, jsonb_build_object(
      'active_campaigns', 0,
      'total_campaigns', 0,
      'total_leads', 0,
      'total_customers', 0,
      'real_customers', 0,
      'total_revenue', 0,
      'direct_revenue', 0,
      'fallback_revenue', 0,
      'assisted_conversion_rate', 0,
      'real_conversion_rate', 0,
      'conversion_rate', 0
    )),
    'groups', coalesce(v_groups, '[]'::jsonb)
  );
end;
$function$;
--@@ 45 funcao public.get_crm_statistics(p_store_id text)
CREATE OR REPLACE FUNCTION public.get_crm_statistics(p_store_id text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_total_leads bigint := 0;
  v_total_customers bigint := 0;
  v_open_conversations bigint := 0;
  v_sent_24h bigint := 0;
  v_inbound_24h bigint := 0;
  v_pipeline_value numeric := 0;
begin
  select count(*) into v_total_leads from public.crm_leads l where l.store_id = p_store_id;
  select count(*) into v_total_customers from public.crm_leads l where l.store_id = p_store_id and l.is_customer = true;

  select count(*) into v_open_conversations
  from public.crm_conversations c
  where c.store_id = p_store_id and c.status in ('open', 'ai_handling', 'human_handling');

  select count(*) into v_sent_24h
  from public.crm_messages m
  where m.store_id = p_store_id
    and m.direction = 'outbound'
    and m.created_at >= now() - interval '24 hours';

  select count(*) into v_inbound_24h
  from public.crm_messages m
  where m.store_id = p_store_id
    and m.direction = 'inbound'
    and m.created_at >= now() - interval '24 hours';

  select coalesce(sum(l.last_order_value), 0)
    into v_pipeline_value
  from public.crm_leads l
  where l.store_id = p_store_id
    and coalesce(l.funnel_stage, '') not in ('lost', 'won');

  return jsonb_build_object(
    'total_leads', v_total_leads,
    'total_customers', v_total_customers,
    'open_conversations', v_open_conversations,
    'sent_messages_24h', v_sent_24h,
    'inbound_messages_24h', v_inbound_24h,
    'conversion_rate', case when v_total_leads = 0 then 0 else round((v_total_customers::numeric / v_total_leads::numeric) * 100, 1) end,
    'pipeline_value', coalesce(v_pipeline_value, 0)
  );
end;
$function$;
--@@ 45 funcao public.get_lead_custom_values(p_lead_id text)
CREATE OR REPLACE FUNCTION public.get_lead_custom_values(p_lead_id text)
 RETURNS jsonb
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select coalesce(
    jsonb_object_agg(cf.key, v.value),
    '{}'::jsonb
  )
  from public.crm_lead_custom_field_values v
  join public.crm_custom_fields cf on cf.id = v.field_id
  where v.lead_id = p_lead_id;
$function$;
--@@ 45 funcao public.get_lead_full_data(p_lead_id text)
CREATE OR REPLACE FUNCTION public.get_lead_full_data(p_lead_id text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_lead jsonb;
  v_conversations jsonb;
  v_stage_history jsonb;
  v_traceability jsonb;
begin
  if p_lead_id is null or btrim(p_lead_id) = '' then
    return jsonb_build_object('success', false, 'error', 'lead_id is required');
  end if;

  select to_jsonb(l)
  into v_lead
  from public.crm_leads l
  where l.id = p_lead_id
  limit 1;

  if v_lead is null then
    return jsonb_build_object('success', false, 'error', 'Lead not found', 'lead_id', p_lead_id);
  end if;

  select coalesce(jsonb_agg(
    to_jsonb(conv) || jsonb_build_object(
      'messages', coalesce(msg.messages, '[]'::jsonb)
    )
    order by conv.last_message_at desc nulls last
  ), '[]'::jsonb)
  into v_conversations
  from (
    select c.*
    from public.crm_conversations c
    where c.lead_id = p_lead_id
    order by c.last_message_at desc nulls last, c.created_at desc, c.id desc
    limit 1
  ) conv
  left join lateral (
    select coalesce(jsonb_agg(to_jsonb(m) - 'webhook_payload' order by m.created_at desc), '[]'::jsonb) as messages
    from (
      select m.*
      from public.crm_messages m
      where m.conversation_id = conv.id
      order by m.created_at desc, m.id desc
      limit 1
    ) m
  ) msg on true;

  select coalesce(jsonb_agg(to_jsonb(h) order by h.created_at desc), '[]'::jsonb)
  into v_stage_history
  from (
    select h.*
    from public.crm_lead_stage_history h
    where h.lead_id = p_lead_id
    order by h.created_at desc nulls last, h.id desc
    limit 1
  ) h;

  with lead_row as (
    select l.*, c.name as customer_name, c.phone as customer_phone, c.alternative_phone as customer_alternative_phone
    from public.crm_leads l
    left join public.customers c on c.id = l.customer_id
    where l.id = p_lead_id
  ),
  ad_row as (
    select
      a.group_key,
      a.source_app,
      a.raw_source_id,
      a.detected_at,
      g.auto_name,
      g.sample_title,
      g.sample_body,
      g.sample_media_url,
      g.sample_thumbnail_url,
      g.sample_source_url
    from public.crm_meta_ads_attributions a
    left join public.crm_meta_ads_groups g on g.group_key = a.group_key
    where a.lead_id = p_lead_id
    order by a.detected_at desc nulls last, a.id desc
    limit 1
  ),
  direct_sales as (
    select s.*
    from public.sales s
    where s.crm_lead_id = p_lead_id
    order by s.date desc nulls last, s.created_at desc nulls last, s.id desc
    limit 10
  ),
  inferred_sales as (
    select s.*
    from public.sales s
    join lead_row l on l.customer_id is not null and s.customer_id = l.customer_id
    where s.crm_lead_id is distinct from p_lead_id
    order by s.date desc nulls last, s.created_at desc nulls last, s.id desc
    limit 10
  ),
  direct_summary as (
    select
      count(*)::int as direct_count,
      coalesce(sum(s.total), 0) as direct_revenue,
      coalesce(jsonb_agg(to_jsonb(s) order by s.date desc nulls last, s.created_at desc nulls last), '[]'::jsonb) as direct
    from direct_sales s
  ),
  inferred_summary as (
    select
      count(*)::int as inferred_count,
      coalesce(sum(s.total), 0) as inferred_revenue,
      coalesce(jsonb_agg(to_jsonb(s) order by s.date desc nulls last, s.created_at desc nulls last), '[]'::jsonb) as inferred
    from inferred_sales s
  )
  select jsonb_build_object(
    'customer_link', jsonb_build_object(
      'customer_id', l.customer_id,
      'customer_name', l.customer_name,
      'source', case
        when l.customer_id is not null then 'explicit_customer_id'
        when exists (
          select 1 from public.customers c
          where public.normalize_phone(c.phone) = l.phone_normalized
        ) then 'phone_match'
        when exists (
          select 1 from public.customers c
          where public.normalize_phone(c.alternative_phone) = l.phone_normalized
        ) then 'alternative_phone_match'
        else 'unmatched'
      end,
      'confidence', case
        when l.customer_id is not null then 'direct'
        when exists (
          select 1 from public.customers c
          where public.normalize_phone(c.phone) = l.phone_normalized
        ) then 'high'
        when exists (
          select 1 from public.customers c
          where public.normalize_phone(c.alternative_phone) = l.phone_normalized
        ) then 'medium'
        else 'none'
      end
    ),
    'ads', jsonb_build_object(
      'is_ad_lead', (
        coalesce(l.source, '') in ('meta_ads', 'instagram_ads', 'click_to_whatsapp')
        or l.source_ad_context is not null
        or ad.group_key is not null
      ),
      'source', l.source,
      'campaign_id', coalesce(l.source_campaign_id, l.source_ad_context->>'campaign_id', ad.raw_source_id),
      'campaign_title', coalesce(l.source_campaign_title, l.source_ad_context->>'campaign_title', ad.auto_name, ad.sample_title),
      'campaign_body', coalesce(l.source_ad_context->>'campaign_body', ad.sample_body),
      'group_key', ad.group_key,
      'source_app', ad.source_app,
      'sample_media_url', ad.sample_media_url,
      'sample_thumbnail_url', ad.sample_thumbnail_url,
      'sample_source_url', ad.sample_source_url
    ),
    'sales', jsonb_build_object(
      'direct', ds.direct,
      'inferred_by_customer', ins.inferred,
      'direct_revenue', ds.direct_revenue,
      'inferred_revenue', ins.inferred_revenue,
      'purchase_count', ds.direct_count + ins.inferred_count,
      'last_sale', (
        select to_jsonb(x)
        from (
          select * from direct_sales
          union all
          select * from inferred_sales
          order by date desc nulls last, created_at desc nulls last, id desc
          limit 1
        ) x
      )
    )
  )
  into v_traceability
  from lead_row l
  left join ad_row ad on true
  cross join direct_summary ds
  cross join inferred_summary ins;

  return jsonb_build_object(
    'success', true,
    'lead', v_lead,
    'conversations', coalesce(v_conversations, '[]'::jsonb),
    'stage_history', coalesce(v_stage_history, '[]'::jsonb),
    'traceability', coalesce(v_traceability, '{}'::jsonb)
  );
end;
$function$;
--@@ 45 funcao public.get_lead_state(p_lead_id text)
CREATE OR REPLACE FUNCTION public.get_lead_state(p_lead_id text)
 RETURNS jsonb
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
$function$;
--@@ 45 funcao public.get_store_custom_fields(p_store_id text)
CREATE OR REPLACE FUNCTION public.get_store_custom_fields(p_store_id text)
 RETURNS SETOF crm_custom_fields
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select *
  from public.crm_custom_fields
  where store_id = p_store_id
    and is_active = true
  order by created_at asc;
$function$;
--@@ 45 funcao public.handle_debt_after_delete()
CREATE OR REPLACE FUNCTION public.handle_debt_after_delete()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  delete from public.transactions
  where debt_id = old.id;
  return old;
end;
$function$;
--@@ 45 funcao public.handle_debt_after_insert()
CREATE OR REPLACE FUNCTION public.handle_debt_after_insert()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_customer_name text;
begin
  -- `sale_id is null` é defesa em profundidade: dívida ligada a uma venda
  -- nunca gera saída, mesmo que algum caminho futuro grave source='manual'.
  if new.source = 'manual' and new.sale_id is null and new.entry_account is not null then
    select name into v_customer_name
    from public.customers
    where id = new.customer_id;

    insert into public.transactions (
      id, type, category, amount, date, description, account, debt_id
    )
    values (
      'trx_' || replace(gen_random_uuid()::text, '-', ''),
      'OUT',
      'Saída de devedor',
      new.original_amount,
      now(),
      'Saída devedor - ' || coalesce(v_customer_name, 'Cliente'),
      new.entry_account,
      new.id
    );
  end if;
  return new;
end;
$function$;
--@@ 45 funcao public.handle_debt_after_update()
CREATE OR REPLACE FUNCTION public.handle_debt_after_update()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if new.original_amount is distinct from old.original_amount then
    update public.transactions
      set amount = new.original_amount
    where debt_id = new.id;
  end if;
  return new;
end;
$function$;
--@@ 45 funcao public.handle_debt_payment_after_delete()
CREATE OR REPLACE FUNCTION public.handle_debt_payment_after_delete()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_debt public.debts%rowtype;
  v_restored_remaining numeric;
  v_new_status text;
begin
  select *
  into v_debt
  from public.debts
  where id = old.debt_id
  for update;

  if not found then
    return old;
  end if;

  v_restored_remaining := coalesce(v_debt.remaining_amount, 0) + coalesce(old.amount, 0);
  if v_restored_remaining > coalesce(v_debt.original_amount, 0) then
    v_restored_remaining := coalesce(v_debt.original_amount, 0);
  end if;

  if v_restored_remaining <= 0 then
    v_new_status := 'Quitada';
  elsif v_restored_remaining >= coalesce(v_debt.original_amount, 0) then
    v_new_status := 'Aberta';
  else
    v_new_status := 'Parcial';
  end if;

  update public.debts
  set remaining_amount = v_restored_remaining,
      status = v_new_status,
      updated_at = now()
  where id = v_debt.id;

  return old;
end;
$function$;
--@@ 45 funcao public.handle_debt_payment_after_insert()
CREATE OR REPLACE FUNCTION public.handle_debt_payment_after_insert()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_debt public.debts%rowtype;
  v_new_remaining numeric;
  v_new_status text;
  v_account text;
  v_customer_name text;
begin
  select *
  into v_debt
  from public.debts
  where id = new.debt_id
  for update;

  if not found then
    raise exception 'Debt not found for payment: %', new.debt_id;
  end if;

  if new.amount > coalesce(v_debt.remaining_amount, 0) then
    raise exception 'Payment amount (%) exceeds remaining debt amount (%)', new.amount, v_debt.remaining_amount;
  end if;

  v_new_remaining := coalesce(v_debt.remaining_amount, 0) - coalesce(new.amount, 0);
  if v_new_remaining = 0 then
    v_new_status := 'Quitada';
  else
    v_new_status := 'Parcial';
  end if;

  update public.debts
  set remaining_amount = v_new_remaining,
      status = v_new_status,
      updated_at = now()
  where id = v_debt.id;

  v_account := coalesce(nullif(new.account, 'Caixa'), 'Conta Bancária');

  select name into v_customer_name from public.customers where id = v_debt.customer_id;

  insert into public.transactions (
    id,
    type,
    category,
    amount,
    date,
    description,
    account,
    sale_id,
    debt_payment_id
  )
  values (
    'trx_' || replace(gen_random_uuid()::text, '-', ''),
    'IN',
    'Venda',
    coalesce(new.amount, 0),
    coalesce(new.paid_at, now()),
    'Quitação de dívida - ' || coalesce(nullif(v_customer_name, ''), coalesce(v_debt.id, '')),
    v_account,
    v_debt.sale_id,
    new.id
  );

  return new;
end;
$function$;
--@@ 45 funcao public.handle_payable_debt_after_delete()
CREATE OR REPLACE FUNCTION public.handle_payable_debt_after_delete()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  delete from public.transactions
  where payable_debt_id = old.id;
  return old;
end;
$function$;
--@@ 45 funcao public.handle_payable_debt_after_insert()
CREATE OR REPLACE FUNCTION public.handle_payable_debt_after_insert()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  -- Apenas dívidas manuais com conta informada geram entrada no caixa/banco
  if new.source = 'manual' and new.entry_account is not null then
    insert into public.transactions (
      id,
      type,
      category,
      amount,
      date,
      description,
      account,
      payable_debt_id
    )
    values (
      'trx_' || replace(gen_random_uuid()::text, '-', ''),
      'IN',
      'Entrada de dívida ativa',
      new.original_amount,
      now(),
      'Entrada dívida ativa - ' || new.creditor_name,
      new.entry_account,
      new.id
    );
  end if;
  return new;
end;
$function$;
--@@ 45 funcao public.handle_payable_debt_after_update()
CREATE OR REPLACE FUNCTION public.handle_payable_debt_after_update()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if new.original_amount is distinct from old.original_amount then
    update public.transactions
      set amount = new.original_amount
    where payable_debt_id = new.id;
  end if;
  return new;
end;
$function$;
--@@ 45 funcao public.handle_payable_debt_payment_after_delete()
CREATE OR REPLACE FUNCTION public.handle_payable_debt_payment_after_delete()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_debt public.payable_debts%rowtype;
  v_restored_remaining numeric;
  v_new_status text;
begin
  select *
  into v_debt
  from public.payable_debts
  where id = old.payable_debt_id
  for update;

  if not found then
    return old;
  end if;

  v_restored_remaining := coalesce(v_debt.remaining_amount, 0) + coalesce(old.amount, 0);
  if v_restored_remaining > coalesce(v_debt.original_amount, 0) then
    v_restored_remaining := coalesce(v_debt.original_amount, 0);
  end if;

  if v_restored_remaining <= 0 then
    v_new_status := 'Quitada';
  elsif v_restored_remaining >= coalesce(v_debt.original_amount, 0) then
    v_new_status := 'Aberta';
  else
    v_new_status := 'Parcial';
  end if;

  update public.payable_debts
  set remaining_amount = v_restored_remaining,
      status = v_new_status,
      updated_at = now()
  where id = v_debt.id;

  return old;
end;
$function$;
--@@ 45 funcao public.handle_payable_debt_payment_after_insert()
CREATE OR REPLACE FUNCTION public.handle_payable_debt_payment_after_insert()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_debt public.payable_debts%rowtype;
  v_new_remaining numeric;
  v_new_status text;
begin
  select *
  into v_debt
  from public.payable_debts
  where id = new.payable_debt_id
  for update;

  if not found then
    raise exception 'Payable debt not found for payment: %', new.payable_debt_id;
  end if;

  if new.amount > coalesce(v_debt.remaining_amount, 0) then
    raise exception 'Payment amount (%) exceeds remaining payable debt amount (%)', new.amount, v_debt.remaining_amount;
  end if;

  v_new_remaining := coalesce(v_debt.remaining_amount, 0) - coalesce(new.amount, 0);
  if v_new_remaining = 0 then
    v_new_status := 'Quitada';
  else
    v_new_status := 'Parcial';
  end if;

  update public.payable_debts
  set remaining_amount = v_new_remaining,
      status = v_new_status,
      updated_at = now()
  where id = v_debt.id;

  insert into public.transactions (
    id,
    type,
    category,
    amount,
    date,
    description,
    account,
    payable_debt_payment_id
  )
  values (
    'trx_' || replace(gen_random_uuid()::text, '-', ''),
    'OUT',
    'Pagamento de dívida ativa',
    coalesce(new.amount, 0),
    coalesce(new.paid_at, now()),
    'Pagamento dívida ativa - ' || coalesce(v_debt.creditor_name, v_debt.id),
    new.account,
    new.id
  );

  return new;
end;
$function$;
--@@ 45 funcao public.handle_payment_method_after_insert()
CREATE OR REPLACE FUNCTION public.handle_payment_method_after_insert()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_sale public.sales%rowtype;
  v_description text;
  v_account text;
begin
  if new.sale_id is null then
    return new;
  end if;

  select *
  into v_sale
  from public.sales
  where id = new.sale_id;

  if not found then
    return new;
  end if;

  v_account := coalesce(nullif(new.account, 'Caixa'), 'Conta Bancária');

  if new.type = 'Devedor' then
    insert into public.debts (
      id,
      customer_id,
      sale_id,
      original_amount,
      remaining_amount,
      status,
      due_date,
      first_due_date,
      installments_total,
      notes,
      source
    )
    values (
      'debt_' || replace(gen_random_uuid()::text, '-', ''),
      v_sale.customer_id,
      new.sale_id,
      coalesce(new.amount, 0),
      coalesce(new.amount, 0),
      'Aberta',
      new.debt_due_date,
      new.debt_due_date,
      greatest(1, coalesce(new.debt_installments, 1)),
      new.debt_notes,
      'pdv'
    );
  else
    if new.type in ('Cartão', 'Cartão Débito') then
      v_description := 'Venda (' || coalesce(new.type, '') || ') liquido='
        || coalesce(new.amount, 0)::text
        || ' bruto=' || coalesce(new.customer_amount, new.amount, 0)::text
        || ' taxa=' || coalesce(new.fee_amount, 0)::text
        || ' - ' || coalesce(new.sale_id, '');
    else
      v_description := 'Venda (' || coalesce(new.type, '') || ') - ' || coalesce(new.sale_id, '');
    end if;

    insert into public.transactions (id, type, category, amount, date, description, account, sale_id)
    values (
      'trx_' || replace(gen_random_uuid()::text, '-', ''),
      'IN',
      'Venda',
      coalesce(new.amount, 0),
      coalesce(v_sale.date, now()),
      v_description,
      v_account,
      new.sale_id
    );
  end if;

  return new;
end;
$function$;
--@@ 45 funcao public.handle_sale_after_delete_cleanup()
CREATE OR REPLACE FUNCTION public.handle_sale_after_delete_cleanup()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  -- Delete the legacy trade_in_id stock item only if it was not resold in another sale.
  if old.trade_in_id is not null then
    delete from public.stock_items
    where id = old.trade_in_id
      and not exists (
        select 1
        from public.sale_items
        where stock_item_id = old.trade_in_id
      );
  end if;

  return old;
end;
$function$;
--@@ 45 funcao public.handle_sale_after_insert()
CREATE OR REPLACE FUNCTION public.handle_sale_after_insert()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_trade_in_value numeric := coalesce(new.trade_in_value, 0);
  v_gross_total numeric := coalesce(new.total, 0) + v_trade_in_value;
begin
  if v_trade_in_value > 0 then
    insert into public.transactions (id, type, category, amount, date, description, account, sale_id)
    values (
      'trx_' || replace(gen_random_uuid()::text, '-', ''),
      'IN',
      'Venda',
      v_trade_in_value,
      coalesce(new.date, now()),
      'Venda (Trade-in) - ' || coalesce(new.id, ''),
      'Conta Bancária',
      new.id
    );

    insert into public.transactions (id, type, category, amount, date, description, account, sale_id)
    values (
      'trx_' || replace(gen_random_uuid()::text, '-', ''),
      'OUT',
      'Compra',
      v_trade_in_value,
      coalesce(new.date, now()),
      'Entrada (Troca) - ' || coalesce(new.id, ''),
      'Conta Bancária',
      new.id
    );
  end if;

  if new.seller_id is not null then
    update public.sellers
    set total_sales = coalesce(total_sales, 0) + v_gross_total,
        updated_at = now()
    where id = new.seller_id;
  end if;

  if new.customer_id is not null then
    update public.customers
    set purchases = coalesce(purchases, 0) + 1,
        total_spent = coalesce(total_spent, 0) + v_gross_total,
        updated_at = now()
    where id = new.customer_id;
  end if;

  return new;
end;
$function$;
--@@ 45 funcao public.handle_sale_before_delete()
CREATE OR REPLACE FUNCTION public.handle_sale_before_delete()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_gross_total numeric := coalesce(old.total, 0) + coalesce(old.trade_in_value, 0);
begin
  -- 1. Delete debt_payments that belong to debts from this sale.
  delete from public.debt_payments
  where debt_id in (
    select id from public.debts where sale_id = old.id
  );

  -- 2. Delete customer debts created by this sale (Devedor payment methods).
  delete from public.debts where sale_id = old.id;

  -- 3. Delete payable debt payments for store debts created by this sale.
  delete from public.payable_debt_payments
  where payable_debt_id in (
    select id from public.payable_debts where sale_id = old.id
  );

  -- 4. Delete store payable debts created by trade-in client payment.
  delete from public.payable_debts where sale_id = old.id;

  -- 5. Reverte reservas consumidas por esta venda ANTES de apagar as
  --    transações: o lançamento do sinal (sale_id null) permanece no
  --    caixa e a reserva volta a valer, evitando contagem em dobro na
  --    revenda do aparelho.
  update public.stock_reservations
     set status = 'active',
         sold_at = null,
         sold_sale_id = null,
         released_at = null
   where sold_sale_id = old.id
     and status = 'sold';

  -- 6. Delete all direct transactions linked to this sale.
  delete from public.transactions where sale_id = old.id;

  -- 7. Restore sold stock items back to 'Disponível'.
  update public.stock_items
  set status = 'Disponível',
      updated_at = now()
  where id in (
    select stock_item_id from public.sale_items where sale_id = old.id
  );

  -- 7.b Aparelhos cuja reserva foi revertida voltam para 'Reservado'.
  update public.stock_items si
  set status = 'Reservado',
      updated_at = now()
  where si.id in (
    select sr.stock_item_id
    from public.stock_reservations sr
    where sr.status = 'active'
      and sr.stock_item_id in (
        select stock_item_id from public.sale_items where sale_id = old.id
      )
  );

  -- 8. Decrement seller.total_sales (floor at 0).
  if old.seller_id is not null then
    update public.sellers
    set total_sales = greatest(0, coalesce(total_sales, 0) - v_gross_total),
        updated_at = now()
    where id = old.seller_id;
  end if;

  -- 9. Decrement customer.purchases (-1) and customer.total_spent (floor at 0).
  if old.customer_id is not null then
    update public.customers
    set purchases   = greatest(0, coalesce(purchases, 0) - 1),
        total_spent = greatest(0, coalesce(total_spent, 0) - v_gross_total),
        updated_at  = now()
    where id = old.customer_id;
  end if;

  return old;
end;
$function$;
--@@ 45 funcao public.handle_sale_item_after_insert()
CREATE OR REPLACE FUNCTION public.handle_sale_item_after_insert()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  update public.stock_items
  set status = 'Vendido'
  where id = new.stock_item_id
    and status is distinct from 'Vendido';

  return new;
end;
$function$;
--@@ 45 funcao public.handle_transaction_after_delete()
CREATE OR REPLACE FUNCTION public.handle_transaction_after_delete()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if old.debt_payment_id is not null then
    delete from public.debt_payments where id = old.debt_payment_id;
  end if;
  if old.payable_debt_payment_id is not null then
    delete from public.payable_debt_payments where id = old.payable_debt_payment_id;
  end if;
  return old;
end;
$function$;
--@@ 45 funcao public.increment_unread_count(p_conversation_id uuid, p_last_cu
CREATE OR REPLACE FUNCTION public.increment_unread_count(p_conversation_id uuid, p_last_customer_message_at timestamp with time zone)
 RETURNS void
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
BEGIN
    UPDATE crm_conversations
    SET 
        unread_count = unread_count + 1,
        message_count = message_count + 1,
        last_customer_message_at = p_last_customer_message_at,
        last_message_at = p_last_customer_message_at,
        updated_at = now()
    WHERE id = p_conversation_id;
END;
$function$;
--@@ 45 funcao public.is_valid_card_fee_rates(input jsonb)
CREATE OR REPLACE FUNCTION public.is_valid_card_fee_rates(input jsonb)
 RETURNS boolean
 LANGUAGE sql
 IMMUTABLE
 SET search_path TO 'public'
AS $function$
  select
    jsonb_typeof(input) = 'array'
    and jsonb_array_length(input) = 18
    and not exists (
      select 1
      from jsonb_array_elements(input) as e(value)
      where jsonb_typeof(e.value) <> 'number'
         or (e.value::text)::numeric < 0
         or (e.value::text)::numeric >= 100
    );
$function$;
--@@ 45 funcao public.mark_lead_as_customer(p_lead_id text, p_customer_id text
CREATE OR REPLACE FUNCTION public.mark_lead_as_customer(p_lead_id text, p_customer_id text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_customer_id text := nullif(btrim(coalesce(p_customer_id, '')), '');
begin
  if p_lead_id is null or btrim(p_lead_id) = '' then
    return jsonb_build_object('success', false, 'error', 'lead_id is required');
  end if;

  if v_customer_id is not null and not exists (
    select 1 from public.customers c where c.id = v_customer_id
  ) then
    return jsonb_build_object('success', false, 'error', 'Customer not found', 'customer_id', v_customer_id);
  end if;

  update public.crm_leads
  set
    customer_id = coalesce(v_customer_id, customer_id),
    is_customer = true,
    updated_at = now(),
    last_interaction_at = now()
  where id = p_lead_id;

  if not found then
    return jsonb_build_object('success', false, 'error', 'Lead not found', 'lead_id', p_lead_id);
  end if;

  perform public.crm_refresh_lead_purchase_metrics(p_lead_id);
  return jsonb_build_object('success', true, 'lead_id', p_lead_id);
end;
$function$;
--@@ 45 funcao public.move_crm_lead_stage(p_lead_id text, p_to_stage text, p_t
CREATE OR REPLACE FUNCTION public.move_crm_lead_stage(p_lead_id text, p_to_stage text, p_to_funnel_id uuid DEFAULT NULL::uuid, p_changed_by uuid DEFAULT NULL::uuid, p_notes text DEFAULT NULL::text)
 RETURNS TABLE(lead_id text, from_stage text, to_stage text, from_funnel_id uuid, to_funnel_id uuid, changed_at timestamp with time zone, history_logged boolean, was_noop boolean)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_lead public.crm_leads%rowtype;
  v_changed_at timestamptz := now();
  v_target_stage text;
  v_target_funnel_id uuid;
  v_history_logged boolean := false;
  v_was_noop boolean := false;
begin
  if p_lead_id is null or btrim(p_lead_id) = '' then
    raise exception 'lead_id is required';
  end if;

  v_target_stage := coalesce(nullif(btrim(p_to_stage), ''), 'new_lead');

  select * into v_lead
  from public.crm_leads l
  where l.id = p_lead_id
  for update;

  if not found then
    raise exception 'Lead not found: %', p_lead_id;
  end if;

  v_target_funnel_id := coalesce(p_to_funnel_id, v_lead.funnel_id);

  if v_lead.funnel_stage is not distinct from v_target_stage
     and v_lead.funnel_id is not distinct from v_target_funnel_id then
    v_was_noop := true;
  else
    update public.crm_leads
    set
      funnel_stage = v_target_stage,
      funnel_id = v_target_funnel_id,
      updated_at = v_changed_at,
      last_interaction_at = greatest(coalesce(last_interaction_at, v_changed_at), v_changed_at)
    where id = p_lead_id;

    insert into public.crm_lead_stage_history (
      lead_id,
      store_id,
      from_stage,
      to_stage,
      changed_by,
      notes,
      created_at
    )
    values (
      p_lead_id,
      v_lead.store_id,
      v_lead.funnel_stage,
      v_target_stage,
      p_changed_by,
      p_notes,
      v_changed_at
    );

    v_history_logged := true;
  end if;

  return query
  select
    p_lead_id,
    v_lead.funnel_stage,
    v_target_stage,
    v_lead.funnel_id,
    v_target_funnel_id,
    v_changed_at,
    v_history_logged,
    v_was_noop;
end;
$function$;
--@@ 45 funcao public.normalize_phone(phone text)
CREATE OR REPLACE FUNCTION public.normalize_phone(phone text)
 RETURNS text
 LANGUAGE plpgsql
 IMMUTABLE
 SET search_path TO 'public'
AS $function$
declare
  v_digits text;
begin
  v_digits := regexp_replace(coalesce(phone, ''), '[^0-9]', '', 'g');
  if v_digits = '' then
    return null;
  end if;

  if left(v_digits, 2) <> '55' then
    v_digits := '55' || v_digits;
  end if;

  return '+' || v_digits;
end;
$function$;
--@@ 45 funcao public.pdv_apply_reservation_deposit_payments(p_sale_id text, p
CREATE OR REPLACE FUNCTION public.pdv_apply_reservation_deposit_payments(p_sale_id text, p_sale_date timestamp with time zone)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_expected_count integer;
  v_valid_count integer;
begin
  if exists (
    select 1
    from public.sale_items si
    join public.stock_reservations sr
      on sr.stock_item_id = si.stock_item_id
     and sr.status = 'active'
     and coalesce(sr.deposit_amount, 0) > 0
     and sr.deposit_transaction_id is not null
    where si.sale_id = p_sale_id
      and not exists (
        select 1
        from public.payment_methods pm
        where pm.sale_id = p_sale_id
          and pm.source = 'reservation_deposit'
          and pm.reservation_id = sr.id
      )
  ) then
    raise exception 'Aparelho com reserva ativa com sinal pago: inclua o pagamento "Sinal já pago" na venda ou libere a reserva (estornando ou retendo o sinal) antes de vender.';
  end if;

  -- Reservas sem sinal: nada a validar no caixa (não houve dinheiro), mas a
  -- reserva foi consumida por esta venda e precisa constar como tal para que
  -- o cancelamento saiba devolvê-la.
  update public.stock_reservations sr
     set status = 'sold',
         sold_at = coalesce(sr.sold_at, p_sale_date, now()),
         sold_sale_id = p_sale_id,
         released_at = null
   where sr.status = 'active'
     and coalesce(sr.deposit_amount, 0) = 0
     and exists (
       select 1
       from public.sale_items si
       where si.sale_id = p_sale_id
         and si.stock_item_id = sr.stock_item_id
     );

  select count(*)
    into v_expected_count
    from public.payment_methods pm
    where pm.sale_id = p_sale_id
      and pm.source = 'reservation_deposit';

  if coalesce(v_expected_count, 0) = 0 then
    return;
  end if;

  if exists (
    select 1
    from public.payment_methods pm
    where pm.sale_id = p_sale_id
      and pm.source = 'reservation_deposit'
      and (pm.reservation_id is null or pm.reservation_deposit_transaction_id is null)
  ) then
    raise exception 'Pagamento de sinal da reserva sem vinculo com a reserva.';
  end if;

  select count(*)
    into v_valid_count
    from public.payment_methods pm
    join public.stock_reservations sr
      on sr.id = pm.reservation_id
    join public.sale_items si
      on si.sale_id = pm.sale_id
     and si.stock_item_id = sr.stock_item_id
    where pm.sale_id = p_sale_id
      and pm.source = 'reservation_deposit'
      and pm.reservation_deposit_transaction_id = sr.deposit_transaction_id
      and coalesce(pm.amount, 0) = coalesce(sr.deposit_amount, 0)
      and sr.deposit_refunded_at is null
      and sr.deposit_retained_at is null
      and (
        sr.status = 'active'
        or (sr.status = 'sold' and sr.sold_sale_id = p_sale_id)
      );

  if v_valid_count <> v_expected_count then
    raise exception 'Sinal de reserva invalido para a venda.';
  end if;

  update public.stock_reservations sr
     set status = 'sold',
         sold_at = coalesce(sr.sold_at, p_sale_date, now()),
         sold_sale_id = p_sale_id,
         released_at = null
   where sr.id in (
     select distinct pm.reservation_id
     from public.payment_methods pm
     join public.sale_items si
       on si.sale_id = pm.sale_id
     where pm.sale_id = p_sale_id
       and pm.source = 'reservation_deposit'
       and si.stock_item_id = sr.stock_item_id
   );
end;
$function$;
--@@ 45 funcao public.pdv_assert_sale_payload(p_payload jsonb)
CREATE OR REPLACE FUNCTION public.pdv_assert_sale_payload(p_payload jsonb)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_total numeric := coalesce((p_payload->>'total')::numeric, 0);
  v_payment_total numeric := 0;
begin
  if coalesce(p_payload->>'id', '') = '' then
    raise exception 'ID da venda é obrigatório.' using errcode = '22023';
  end if;

  if coalesce(p_payload->>'customerId', '') = '' then
    raise exception 'Cliente é obrigatório.' using errcode = '22023';
  end if;

  if coalesce(p_payload->>'sellerId', '') = '' then
    raise exception 'Vendedor é obrigatório.' using errcode = '22023';
  end if;

  if jsonb_array_length(coalesce(p_payload->'items', '[]'::jsonb)) = 0 then
    raise exception 'A venda precisa ter ao menos um item.' using errcode = '22023';
  end if;

  select coalesce(sum(coalesce((payment->>'amount')::numeric, 0)), 0)
  into v_payment_total
  from jsonb_array_elements(coalesce(p_payload->'paymentMethods', '[]'::jsonb)) payment;

  if abs(v_payment_total - v_total) > 0.01 then
    raise exception 'A soma dos pagamentos deve ser igual ao total da venda.' using errcode = '22023';
  end if;
end;
$function$;
--@@ 45 funcao public.pdv_create_sale_financial_side_effects(p_sale_id text)
CREATE OR REPLACE FUNCTION public.pdv_create_sale_financial_side_effects(p_sale_id text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_sale public.sales%rowtype;
  v_payment public.payment_methods%rowtype;
  v_account text;
  v_seller_name text;
  v_customer_name text;
begin
  select * into v_sale from public.sales where id = p_sale_id;
  if not found then
    raise exception 'Venda nao encontrada: %', p_sale_id using errcode = 'P0002';
  end if;

  select name into v_customer_name from public.customers where id = v_sale.customer_id;

  if coalesce(v_sale.trade_in_value, 0) > 0 then
    insert into public.transactions (id, type, category, amount, date, description, account, sale_id)
    values
      ('trx_' || replace(gen_random_uuid()::text, '-', ''), 'IN', 'Venda', v_sale.trade_in_value, coalesce(v_sale.date, now()), 'Venda (Trade-in) - ' || coalesce(nullif(v_customer_name, ''), v_sale.id), 'Conta Bancária', v_sale.id),
      ('trx_' || replace(gen_random_uuid()::text, '-', ''), 'OUT', 'Compra', v_sale.trade_in_value, coalesce(v_sale.date, now()), 'Entrada (Troca) - ' || coalesce(nullif(v_customer_name, ''), v_sale.id), 'Conta Bancária', v_sale.id);
  end if;

  for v_payment in select * from public.payment_methods where sale_id = p_sale_id loop
    if v_payment.source = 'reservation_deposit' then
      continue;
    end if;

    v_account := coalesce(nullif(v_payment.account, 'Caixa'), 'Conta Bancária');

    if v_payment.type = 'Devedor' then
      insert into public.debts (
        id, customer_id, sale_id, original_amount, remaining_amount, status,
        due_date, first_due_date, installments_total, notes, source
      ) values (
        'debt_' || replace(gen_random_uuid()::text, '-', ''),
        v_sale.customer_id,
        p_sale_id,
        coalesce(v_payment.amount, 0),
        coalesce(v_payment.amount, 0),
        'Aberta',
        v_payment.debt_due_date,
        v_payment.debt_due_date,
        greatest(1, coalesce(v_payment.debt_installments, 1)),
        v_payment.debt_notes,
        'pdv'
      );
    else
      insert into public.transactions (id, type, category, amount, date, description, account, sale_id)
      values (
        'trx_' || replace(gen_random_uuid()::text, '-', ''),
        'IN',
        'Venda',
        coalesce(v_payment.amount, 0),
        coalesce(v_sale.date, now()),
        case
          when v_payment.type in ('Cartão', 'Cartão Débito')
            then 'Venda (' || coalesce(v_payment.type, '') || ') liquido=' || coalesce(v_payment.amount, 0)::text || ' bruto=' || coalesce(v_payment.customer_amount, v_payment.amount, 0)::text || ' taxa=' || coalesce(v_payment.fee_amount, 0)::text || ' - ' || coalesce(nullif(v_customer_name, ''), p_sale_id)
          else 'Venda (' || coalesce(v_payment.type, '') || ') - ' || coalesce(nullif(v_customer_name, ''), p_sale_id)
        end,
        v_account,
        p_sale_id
      );
    end if;
  end loop;

  if coalesce(v_sale.commission, 0) > 0 then
    select name into v_seller_name from public.sellers where id = v_sale.seller_id;

    insert into public.transactions (id, type, category, amount, date, description, account, sale_id)
    values (
      'trx_' || replace(gen_random_uuid()::text, '-', ''),
      'OUT',
      'Comissão',
      v_sale.commission,
      coalesce(v_sale.date, now()),
      coalesce('Comissão recebida pelo vendedor ' || nullif(v_seller_name, ''), 'Comissão de venda - ' || v_sale.id),
      'Conta Bancária',
      v_sale.id
    );
  end if;
end;
$function$;
--@@ 45 funcao public.pdv_create_sale_trade_in_rows(p_sale_id text, p_payload 
CREATE OR REPLACE FUNCTION public.pdv_create_sale_trade_in_rows(p_sale_id text, p_payload jsonb, p_sale_date timestamp with time zone)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_row jsonb;
  v_snapshot jsonb;
  v_stock_item_id text;
  v_first_stock_item_id text;
begin
  for v_row in select * from jsonb_array_elements(coalesce(p_payload->'tradeIns', '[]'::jsonb)) loop
    v_snapshot := coalesce(v_row->'stockSnapshot', '{}'::jsonb);
    v_stock_item_id := nullif(v_row->>'stockItemId', '');

    if v_snapshot <> '{}'::jsonb then
      v_stock_item_id := coalesce(v_stock_item_id, nullif(v_snapshot->>'id', ''), 'stk_' || replace(gen_random_uuid()::text, '-', ''));

      insert into public.stock_items (
        id, type, model, color, has_box, capacity, imei, condition, status,
        sim_type, battery_health, store_id, purchase_price, sell_price,
        max_discount, warranty_type, warranty_end, origin, notes,
        observations, entry_date, photos
      ) values (
        v_stock_item_id,
        coalesce(nullif(v_snapshot->>'type', ''), 'iPhone'),
        coalesce(nullif(v_snapshot->>'model', ''), nullif(v_row->>'model', ''), 'Trade-in'),
        coalesce(nullif(v_snapshot->>'color', ''), nullif(v_row->>'color', ''), ''),
        coalesce((v_snapshot->>'hasBox')::boolean, false),
        coalesce(nullif(v_snapshot->>'capacity', ''), nullif(v_row->>'capacity', ''), ''),
        coalesce(nullif(v_snapshot->>'imei', ''), nullif(v_row->>'imei', ''), ''),
        coalesce(nullif(v_snapshot->>'condition', ''), nullif(v_row->>'condition', ''), 'Seminovo'),
        coalesce(nullif(v_snapshot->>'status', ''), 'Em Preparação'),
        coalesce(nullif(v_snapshot->>'simType', ''), 'Physical'),
        nullif(v_snapshot->>'batteryHealth', '')::numeric,
        nullif(coalesce(v_snapshot->>'storeId', p_payload->>'storeId'), ''),
        coalesce(nullif(v_snapshot->>'purchasePrice', '')::numeric, coalesce((v_row->>'receivedValue')::numeric, 0)),
        coalesce(nullif(v_snapshot->>'sellPrice', '')::numeric, 0),
        coalesce(nullif(v_snapshot->>'maxDiscount', '')::numeric, 0),
        coalesce(nullif(v_snapshot->>'warrantyType', ''), 'Loja'),
        nullif(v_snapshot->>'warrantyEnd', '')::timestamptz,
        coalesce(nullif(v_snapshot->>'origin', ''), 'Trade-in PDV'),
        coalesce(nullif(v_snapshot->>'notes', ''), nullif(v_snapshot->>'observations', ''), ''),
        coalesce(nullif(v_snapshot->>'observations', ''), nullif(v_snapshot->>'notes', ''), ''),
        coalesce(nullif(v_snapshot->>'entryDate', '')::timestamptz, p_sale_date),
        coalesce(
          array(select jsonb_array_elements_text(coalesce(v_snapshot->'photos', '[]'::jsonb))),
          array[]::text[]
        )
      )
      on conflict (id) do update
      set type = excluded.type,
          model = excluded.model,
          color = excluded.color,
          has_box = excluded.has_box,
          capacity = excluded.capacity,
          imei = excluded.imei,
          condition = excluded.condition,
          status = excluded.status,
          sim_type = excluded.sim_type,
          battery_health = excluded.battery_health,
          store_id = excluded.store_id,
          purchase_price = excluded.purchase_price,
          sell_price = excluded.sell_price,
          max_discount = excluded.max_discount,
          warranty_type = excluded.warranty_type,
          warranty_end = excluded.warranty_end,
          origin = excluded.origin,
          notes = excluded.notes,
          observations = excluded.observations,
          entry_date = excluded.entry_date,
          photos = excluded.photos,
          updated_at = now();
    end if;

    if v_first_stock_item_id is null then
      v_first_stock_item_id := v_stock_item_id;
    end if;

    insert into public.sale_trade_in_items (
      id, sale_id, stock_item_id, model, capacity, color, imei, condition, received_value
    ) values (
      coalesce(nullif(v_row->>'id', ''), 'sti_' || replace(gen_random_uuid()::text, '-', '')),
      p_sale_id,
      v_stock_item_id,
      coalesce(nullif(v_row->>'model', ''), nullif(v_snapshot->>'model', ''), 'Trade-in'),
      nullif(coalesce(v_row->>'capacity', v_snapshot->>'capacity'), ''),
      nullif(coalesce(v_row->>'color', v_snapshot->>'color'), ''),
      nullif(coalesce(v_row->>'imei', v_snapshot->>'imei'), ''),
      nullif(coalesce(v_row->>'condition', v_snapshot->>'condition'), ''),
      coalesce((v_row->>'receivedValue')::numeric, 0)
    );
  end loop;

  if v_first_stock_item_id is not null then
    update public.sales
    set trade_in_id = v_first_stock_item_id
    where id = p_sale_id;
  end if;
end;
$function$;
--@@ 45 funcao public.pdv_hydrate_sale_json(p_sale_id text)
CREATE OR REPLACE FUNCTION public.pdv_hydrate_sale_json(p_sale_id text)
 RETURNS jsonb
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select to_jsonb(s)
    || jsonb_build_object(
      'sale_items', coalesce((
        select jsonb_agg(to_jsonb(si) || jsonb_build_object('stock_item', to_jsonb(st)))
        from public.sale_items si
        left join public.stock_items st on st.id = si.stock_item_id
        where si.sale_id = s.id
      ), '[]'::jsonb),
      'payment_methods', coalesce((
        select jsonb_agg(to_jsonb(pm))
        from public.payment_methods pm
        where pm.sale_id = s.id
      ), '[]'::jsonb),
      'sale_trade_in_items', coalesce((
        select jsonb_agg(to_jsonb(sti))
        from public.sale_trade_in_items sti
        where sti.sale_id = s.id
      ), '[]'::jsonb)
    )
  from public.sales s
  where s.id = p_sale_id;
$function$;
--@@ 45 funcao public.pdv_insert_sale_full_payload(p_payload jsonb)
CREATE OR REPLACE FUNCTION public.pdv_insert_sale_full_payload(p_payload jsonb)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_sale_id text := p_payload->>'id';
  v_sale_date timestamptz := coalesce((p_payload->>'date')::timestamptz, now());
  v_trade_in_value numeric := 0;
  v_gross_total numeric := 0;
  v_client_payment jsonb := coalesce(p_payload->'clientPayment', '{}'::jsonb);
  v_client_payment_amount numeric := coalesce((v_client_payment->>'amount')::numeric, 0);
  v_client_payment_mode text := nullif(v_client_payment->>'mode', '');
  v_row jsonb;
  v_customer public.customers%rowtype;
  v_creditor_id text;
begin
  perform public.pdv_assert_sale_payload(p_payload);

  select coalesce(sum(coalesce((trade_in->>'receivedValue')::numeric, 0)), 0)
  into v_trade_in_value
  from jsonb_array_elements(coalesce(p_payload->'tradeIns', '[]'::jsonb)) trade_in;

  v_gross_total := coalesce((p_payload->>'total')::numeric, 0) + v_trade_in_value;

  insert into public.sales (
    id, customer_id, seller_id, store_id, crm_lead_id, total, discount, discount_type,
    discount_percent, original_subtotal, negotiated_subtotal, commission, date,
    warranty_expires_at, trade_in_id, trade_in_value, client_payment_amount,
    client_payment_mode, client_payment_account, client_payment_method,
    client_payment_notes, client_payment_due_date
  ) values (
    v_sale_id,
    p_payload->>'customerId',
    p_payload->>'sellerId',
    nullif(p_payload->>'storeId', ''),
    nullif(p_payload->>'crmLeadId', ''),
    coalesce((p_payload->>'total')::numeric, 0),
    coalesce((p_payload->>'discount')::numeric, 0),
    nullif(p_payload->>'discountType', ''),
    nullif(p_payload->>'discountPercent', '')::numeric,
    coalesce((p_payload->>'originalSubtotal')::numeric, 0),
    coalesce((p_payload->>'negotiatedSubtotal')::numeric, 0),
    coalesce((p_payload->>'commission')::numeric, 0),
    v_sale_date,
    nullif(p_payload->>'warrantyExpiresAt', '')::timestamptz,
    null,
    v_trade_in_value,
    nullif(v_client_payment_amount, 0),
    v_client_payment_mode,
    nullif(v_client_payment->>'account', ''),
    nullif(v_client_payment->>'method', ''),
    nullif(v_client_payment->>'notes', ''),
    nullif(v_client_payment->>'dueDate', '')::date
  );

  for v_row in select * from jsonb_array_elements(coalesce(p_payload->'items', '[]'::jsonb)) loop
    insert into public.sale_items (id, sale_id, stock_item_id, price, original_price)
    values (
      'si_' || replace(gen_random_uuid()::text, '-', ''),
      v_sale_id,
      v_row->>'stockItemId',
      coalesce((v_row->>'price')::numeric, 0),
      coalesce((v_row->>'originalPrice')::numeric, coalesce((v_row->>'price')::numeric, 0))
    );

    update public.stock_items
    set status = 'Vendido',
        warranty_end = coalesce(nullif(v_row->>'warrantyExpiresAt', '')::timestamptz, warranty_end),
        updated_at = now()
    where id = v_row->>'stockItemId';
  end loop;

  for v_row in select * from jsonb_array_elements(coalesce(p_payload->'paymentMethods', '[]'::jsonb)) loop
    insert into public.payment_methods (
      id, sale_id, type, amount, account, installments, card_brand,
      customer_amount, fee_rate, fee_amount, debt_due_date, debt_installments, debt_notes,
      source, reservation_id, reservation_deposit_transaction_id
    ) values (
      'pm_' || replace(gen_random_uuid()::text, '-', ''),
      v_sale_id,
      v_row->>'type',
      coalesce((v_row->>'amount')::numeric, 0),
      nullif(v_row->>'account', ''),
      nullif(v_row->>'installments', '')::integer,
      nullif(v_row->>'cardBrand', ''),
      nullif(v_row->>'customerAmount', '')::numeric,
      nullif(v_row->>'feeRate', '')::numeric,
      nullif(v_row->>'feeAmount', '')::numeric,
      nullif(v_row->>'debtDueDate', '')::date,
      nullif(v_row->>'debtInstallments', '')::integer,
      nullif(v_row->>'debtNotes', ''),
      coalesce(nullif(v_row->>'source', ''), 'pdv'),
      nullif(v_row->>'reservationId', ''),
      nullif(v_row->>'reservationDepositTransactionId', '')
    );
  end loop;

  perform public.pdv_create_sale_trade_in_rows(v_sale_id, p_payload, v_sale_date);
  perform public.pdv_apply_reservation_deposit_payments(v_sale_id, v_sale_date);
  perform public.pdv_create_sale_financial_side_effects(v_sale_id);

  if v_client_payment_amount > 0 and v_client_payment_mode = 'immediate' then
    insert into public.transactions (id, type, category, amount, date, description, account, sale_id)
    values (
      'trx_' || replace(gen_random_uuid()::text, '-', ''),
      'OUT',
      'Pagamento de trade-in ao cliente',
      v_client_payment_amount,
      v_sale_date,
      'Diferenca trade-in - Venda #' || upper(right(v_sale_id, 6)),
      coalesce(nullif(v_client_payment->>'account', ''), 'Conta Bancária'),
      v_sale_id
    );
  elsif v_client_payment_amount > 0 and v_client_payment_mode = 'payable_debt' then
    select * into v_customer from public.customers where id = p_payload->>'customerId';

    select id into v_creditor_id
    from public.creditors
    where document is not null and document = v_customer.cpf
    limit 1;

    if v_creditor_id is null then
      v_creditor_id := 'crd_' || replace(gen_random_uuid()::text, '-', '');
      insert into public.creditors (id, name, document, document_type, phone, email, notes)
      values (
        v_creditor_id,
        coalesce(v_customer.name, 'Cliente'),
        v_customer.cpf,
        case when v_customer.cpf is null then null else 'CPF' end,
        v_customer.phone,
        v_customer.email,
        'Criado automaticamente por diferenca de trade-in no PDV'
      );
    end if;

    insert into public.payable_debts (
      id, creditor_id, creditor_name, creditor_document, creditor_phone,
      original_amount, remaining_amount, status, due_date, first_due_date,
      installments_total, notes, source, sale_id
    ) values (
      'pdbt_' || replace(gen_random_uuid()::text, '-', ''),
      v_creditor_id,
      coalesce(v_customer.name, 'Cliente'),
      v_customer.cpf,
      v_customer.phone,
      v_client_payment_amount,
      v_client_payment_amount,
      'Aberta',
      nullif(v_client_payment->>'dueDate', '')::date,
      nullif(v_client_payment->>'dueDate', '')::date,
      1,
      nullif(v_client_payment->>'notes', ''),
      'pdv',
      v_sale_id
    );
  end if;

  update public.sellers
  set total_sales = coalesce(total_sales, 0) + v_gross_total,
      updated_at = now()
  where id = p_payload->>'sellerId';

  update public.customers
  set purchases = coalesce(purchases, 0) + 1,
      total_spent = coalesce(total_spent, 0) + v_gross_total,
      updated_at = now()
  where id = p_payload->>'customerId';
end;
$function$;
--@@ 45 funcao public.pdv_rebuild_sale_full_payload(p_sale_id text, p_payload 
CREATE OR REPLACE FUNCTION public.pdv_rebuild_sale_full_payload(p_sale_id text, p_payload jsonb)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_existing public.sales%rowtype;
  v_sale_date timestamptz := coalesce((p_payload->>'date')::timestamptz, now());
  v_trade_in_value numeric := 0;
  v_old_gross_total numeric := 0;
  v_new_gross_total numeric := 0;
  v_client_payment jsonb := coalesce(p_payload->'clientPayment', '{}'::jsonb);
  v_client_payment_amount numeric := coalesce((v_client_payment->>'amount')::numeric, 0);
  v_client_payment_mode text := nullif(v_client_payment->>'mode', '');
  v_previous_stock_ids text[] := array[]::text[];
  v_row jsonb;
  v_customer public.customers%rowtype;
  v_creditor_id text;
  v_reservation public.stock_reservations%rowtype;
begin
  perform public.pdv_assert_sale_payload(p_payload);

  select * into v_existing from public.sales where id = p_sale_id for update;
  if not found then
    raise exception 'Venda nao encontrada: %', p_sale_id using errcode = 'P0002';
  end if;

  -- Guarda: a reconstrução apaga e recria dívidas e transações da venda.
  -- Se já houve pagamentos recebidos (quitações no Cofre/Conta), eles
  -- seriam apagados do extrato silenciosamente — o saldo cairia sem
  -- nenhum registro. Exigir o estorno explícito antes da edição.
  if exists (
    select 1
    from public.debt_payments dp
    join public.debts d on d.id = dp.debt_id
    where d.sale_id = p_sale_id
  ) then
    raise exception 'Esta venda possui pagamentos de dívida já recebidos. Estorne os pagamentos no Financeiro (extrato) antes de editar a venda.';
  end if;

  if exists (
    select 1
    from public.payable_debt_payments pdp
    join public.payable_debts pd on pd.id = pdp.payable_debt_id
    where pd.sale_id = p_sale_id
  ) then
    raise exception 'Esta venda possui pagamentos de dívida ativa já realizados. Estorne-os antes de editar a venda.';
  end if;

  select coalesce(array_agg(stock_item_id), array[]::text[])
  into v_previous_stock_ids
  from public.sale_items
  where sale_id = p_sale_id;

  v_old_gross_total := coalesce(v_existing.total, 0) + coalesce(v_existing.trade_in_value, 0);

  select coalesce(sum(coalesce((trade_in->>'receivedValue')::numeric, 0)), 0)
  into v_trade_in_value
  from jsonb_array_elements(coalesce(p_payload->'tradeIns', '[]'::jsonb)) trade_in;

  v_new_gross_total := coalesce((p_payload->>'total')::numeric, 0) + v_trade_in_value;

  delete from public.debt_payments where debt_id in (select id from public.debts where sale_id = p_sale_id);
  delete from public.debts where sale_id = p_sale_id;
  delete from public.payable_debt_payments where payable_debt_id in (select id from public.payable_debts where sale_id = p_sale_id);
  delete from public.payable_debts where sale_id = p_sale_id;
  delete from public.transactions where sale_id = p_sale_id;
  delete from public.sale_trade_in_items where sale_id = p_sale_id;
  delete from public.payment_methods where sale_id = p_sale_id;
  delete from public.sale_items where sale_id = p_sale_id;

  update public.stock_items
  set status = 'Disponível',
      updated_at = now()
  where id = any(v_previous_stock_ids)
    and not exists (
      select 1
      from public.sale_items si
      where si.stock_item_id = public.stock_items.id
    );

  update public.sales
  set customer_id = p_payload->>'customerId',
      seller_id = p_payload->>'sellerId',
      store_id = nullif(p_payload->>'storeId', ''),
      total = coalesce((p_payload->>'total')::numeric, 0),
      discount = coalesce((p_payload->>'discount')::numeric, 0),
      discount_type = nullif(p_payload->>'discountType', ''),
      discount_percent = nullif(p_payload->>'discountPercent', '')::numeric,
      original_subtotal = coalesce((p_payload->>'originalSubtotal')::numeric, 0),
      negotiated_subtotal = coalesce((p_payload->>'negotiatedSubtotal')::numeric, 0),
      commission = coalesce((p_payload->>'commission')::numeric, coalesce(v_existing.commission, 0)),
      date = v_sale_date,
      warranty_expires_at = nullif(p_payload->>'warrantyExpiresAt', '')::timestamptz,
      trade_in_id = null,
      trade_in_value = v_trade_in_value,
      client_payment_amount = nullif(v_client_payment_amount, 0),
      client_payment_mode = v_client_payment_mode,
      client_payment_account = nullif(v_client_payment->>'account', ''),
      client_payment_method = nullif(v_client_payment->>'method', ''),
      client_payment_notes = nullif(v_client_payment->>'notes', ''),
      client_payment_due_date = nullif(v_client_payment->>'dueDate', '')::date
  where id = p_sale_id;

  for v_row in select * from jsonb_array_elements(coalesce(p_payload->'items', '[]'::jsonb)) loop
    insert into public.sale_items (id, sale_id, stock_item_id, price, original_price)
    values (
      'si_' || replace(gen_random_uuid()::text, '-', ''),
      p_sale_id,
      v_row->>'stockItemId',
      coalesce((v_row->>'price')::numeric, 0),
      coalesce((v_row->>'originalPrice')::numeric, coalesce((v_row->>'price')::numeric, 0))
    );

    update public.stock_items
    set status = 'Vendido',
        warranty_end = coalesce(nullif(v_row->>'warrantyExpiresAt', '')::timestamptz, warranty_end),
        updated_at = now()
    where id = v_row->>'stockItemId';
  end loop;

  for v_row in select * from jsonb_array_elements(coalesce(p_payload->'paymentMethods', '[]'::jsonb)) loop
    insert into public.payment_methods (
      id, sale_id, type, amount, account, installments, card_brand,
      customer_amount, fee_rate, fee_amount, debt_due_date, debt_installments, debt_notes,
      source, reservation_id, reservation_deposit_transaction_id
    ) values (
      'pm_' || replace(gen_random_uuid()::text, '-', ''),
      p_sale_id,
      v_row->>'type',
      coalesce((v_row->>'amount')::numeric, 0),
      nullif(v_row->>'account', ''),
      nullif(v_row->>'installments', '')::integer,
      nullif(v_row->>'cardBrand', ''),
      nullif(v_row->>'customerAmount', '')::numeric,
      nullif(v_row->>'feeRate', '')::numeric,
      nullif(v_row->>'feeAmount', '')::numeric,
      nullif(v_row->>'debtDueDate', '')::date,
      nullif(v_row->>'debtInstallments', '')::integer,
      nullif(v_row->>'debtNotes', ''),
      coalesce(nullif(v_row->>'source', ''), 'pdv'),
      nullif(v_row->>'reservationId', ''),
      nullif(v_row->>'reservationDepositTransactionId', '')
    );
  end loop;

  -- Reservas consumidas por esta venda cujo pagamento de sinal saiu do
  -- payload: se o aparelho saiu da venda, a reserva volta a 'active'
  -- (o sinal permanece no caixa, como antes da venda); se o aparelho
  -- continua na venda sem o pagamento do sinal, a edição duplicaria o
  -- valor do sinal no caixa — bloquear.
  -- Exceção: reservas sem sinal (deposit_amount = 0) não movimentaram caixa,
  -- logo nada deve ser exigido nem duplicado se o aparelho continuar na venda.
  for v_reservation in
    select sr.*
    from public.stock_reservations sr
    where sr.sold_sale_id = p_sale_id
      and sr.status = 'sold'
      and not exists (
        select 1
        from public.payment_methods pm
        where pm.sale_id = p_sale_id
          and pm.source = 'reservation_deposit'
          and pm.reservation_id = sr.id
      )
  loop
    if exists (
      select 1
      from public.sale_items si
      where si.sale_id = p_sale_id
        and si.stock_item_id = v_reservation.stock_item_id
    ) then
      if coalesce(v_reservation.deposit_amount, 0) > 0 then
        raise exception 'Este aparelho foi vendido usando o sinal de uma reserva. Mantenha o pagamento do sinal ("Sinal já pago") na edição da venda.';
      end if;
      continue;
    end if;

    update public.stock_reservations
       set status = 'active',
           sold_at = null,
           sold_sale_id = null,
           released_at = null
     where id = v_reservation.id;

    update public.stock_items
       set status = 'Reservado',
           updated_at = now()
     where id = v_reservation.stock_item_id;
  end loop;

  perform public.pdv_create_sale_trade_in_rows(p_sale_id, p_payload, v_sale_date);
  perform public.pdv_apply_reservation_deposit_payments(p_sale_id, v_sale_date);
  perform public.pdv_create_sale_financial_side_effects(p_sale_id);

  if v_client_payment_amount > 0 and v_client_payment_mode = 'immediate' then
    insert into public.transactions (id, type, category, amount, date, description, account, sale_id)
    values (
      'trx_' || replace(gen_random_uuid()::text, '-', ''),
      'OUT',
      'Pagamento de trade-in ao cliente',
      v_client_payment_amount,
      v_sale_date,
      'Diferenca trade-in - Venda #' || upper(right(p_sale_id, 6)),
      coalesce(nullif(v_client_payment->>'account', ''), 'Conta Bancária'),
      p_sale_id
    );
  elsif v_client_payment_amount > 0 and v_client_payment_mode = 'payable_debt' then
    select * into v_customer from public.customers where id = p_payload->>'customerId';

    select id into v_creditor_id
    from public.creditors
    where document is not null and document = v_customer.cpf
    limit 1;

    if v_creditor_id is null then
      v_creditor_id := 'crd_' || replace(gen_random_uuid()::text, '-', '');
      insert into public.creditors (id, name, document, document_type, phone, email, notes)
      values (
        v_creditor_id,
        coalesce(v_customer.name, 'Cliente'),
        v_customer.cpf,
        case when v_customer.cpf is null then null else 'CPF' end,
        v_customer.phone,
        v_customer.email,
        'Criado automaticamente por diferenca de trade-in no PDV'
      );
    end if;

    insert into public.payable_debts (
      id, creditor_id, creditor_name, creditor_document, creditor_phone,
      original_amount, remaining_amount, status, due_date, first_due_date,
      installments_total, notes, source, sale_id
    ) values (
      'pdbt_' || replace(gen_random_uuid()::text, '-', ''),
      v_creditor_id,
      coalesce(v_customer.name, 'Cliente'),
      v_customer.cpf,
      v_customer.phone,
      v_client_payment_amount,
      v_client_payment_amount,
      'Aberta',
      nullif(v_client_payment->>'dueDate', '')::date,
      nullif(v_client_payment->>'dueDate', '')::date,
      1,
      nullif(v_client_payment->>'notes', ''),
      'pdv',
      p_sale_id
    );
  end if;

  if v_existing.seller_id = p_payload->>'sellerId' then
    update public.sellers
    set total_sales = greatest(0, coalesce(total_sales, 0) + v_new_gross_total - v_old_gross_total),
        updated_at = now()
    where id = p_payload->>'sellerId';
  else
    update public.sellers
    set total_sales = greatest(0, coalesce(total_sales, 0) - v_old_gross_total),
        updated_at = now()
    where id = v_existing.seller_id;

    update public.sellers
    set total_sales = coalesce(total_sales, 0) + v_new_gross_total,
        updated_at = now()
    where id = p_payload->>'sellerId';
  end if;

  if v_existing.customer_id = p_payload->>'customerId' then
    update public.customers
    set total_spent = greatest(0, coalesce(total_spent, 0) + v_new_gross_total - v_old_gross_total),
        updated_at = now()
    where id = p_payload->>'customerId';
  else
    update public.customers
    set purchases = greatest(0, coalesce(purchases, 0) - 1),
        total_spent = greatest(0, coalesce(total_spent, 0) - v_old_gross_total),
        updated_at = now()
    where id = v_existing.customer_id;

    update public.customers
    set purchases = coalesce(purchases, 0) + 1,
        total_spent = coalesce(total_spent, 0) + v_new_gross_total,
        updated_at = now()
    where id = p_payload->>'customerId';
  end if;
end;
$function$;
--@@ 45 funcao public.prepare_broadcast_recipients(p_broadcast_id uuid)
CREATE OR REPLACE FUNCTION public.prepare_broadcast_recipients(p_broadcast_id uuid)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
$function$;
--@@ 45 funcao public.preview_campaign_audience(p_store_id text, p_filters jso
CREATE OR REPLACE FUNCTION public.preview_campaign_audience(p_store_id text, p_filters jsonb DEFAULT '{}'::jsonb, p_limit integer DEFAULT 100)
 RETURNS TABLE(lead_id text, name text, phone text, funnel_stage text, is_customer boolean)
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select
    l.id,
    l.name,
    l.phone,
    l.funnel_stage,
    l.is_customer
  from public.crm_leads l
  where l.store_id = p_store_id
    and (
      (p_filters ->> 'funnel_stage') is null
      or l.funnel_stage = (p_filters ->> 'funnel_stage')
    )
    and (
      (p_filters ? 'is_customer') = false
      or l.is_customer = ((p_filters ->> 'is_customer')::boolean)
    )
  order by l.last_interaction_at desc nulls last
  limit greatest(coalesce(p_limit, 100), 1);
$function$;
--@@ 45 funcao public.record_ai_turn_event(p_turn_id text, p_lead_id text, p_c
CREATE OR REPLACE FUNCTION public.record_ai_turn_event(p_turn_id text, p_lead_id text, p_conversation_id uuid, p_action text, p_outcome text DEFAULT NULL::text, p_duration_ms integer DEFAULT NULL::integer, p_stage_timings jsonb DEFAULT '{}'::jsonb, p_metadata jsonb DEFAULT '{}'::jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_store_id text;
  v_result public.ai_turn_events%rowtype;
begin
  select store_id into v_store_id
  from public.crm_leads
  where id = p_lead_id;

  if v_store_id is null then
    raise exception 'lead not found';
  end if;

  if not (auth.role() = 'service_role' or public.crm_can_access_store(v_store_id)) then
    raise exception 'lead not found or access denied';
  end if;

  insert into public.ai_turn_events (
    turn_id,
    conversation_id,
    lead_id,
    store_id,
    action,
    outcome,
    duration_ms,
    stage_timings,
    metadata
  )
  values (
    nullif(btrim(coalesce(p_turn_id, '')), ''),
    p_conversation_id,
    p_lead_id,
    v_store_id,
    nullif(btrim(coalesce(p_action, '')), ''),
    nullif(btrim(coalesce(p_outcome, '')), ''),
    p_duration_ms,
    coalesce(p_stage_timings, '{}'::jsonb),
    coalesce(p_metadata, '{}'::jsonb)
  )
  on conflict (turn_id, action) do update
  set outcome = excluded.outcome,
      duration_ms = excluded.duration_ms,
      stage_timings = excluded.stage_timings,
      metadata = excluded.metadata
  returning * into v_result;

  return to_jsonb(v_result);
end;
$function$;
--@@ 45 funcao public.release_stock_reservation(p_stock_item_id text, p_refund
CREATE OR REPLACE FUNCTION public.release_stock_reservation(p_stock_item_id text, p_refund_deposit boolean DEFAULT false)
 RETURNS stock_reservations
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_stock_item public.stock_items%rowtype;
  v_reservation public.stock_reservations%rowtype;
  v_saved_reservation public.stock_reservations%rowtype;
  v_refund_transaction_id text;
  v_refund_account text;
begin
  select *
    into v_stock_item
    from public.stock_items
    where id = p_stock_item_id
    for update;

  if not found then
    raise exception 'Aparelho nao encontrado no estoque.';
  end if;

  select *
    into v_reservation
    from public.stock_reservations
    where stock_item_id = p_stock_item_id
      and status = 'active'
    for update;

  if not found then
    raise exception 'Reserva ativa nao encontrada para o aparelho.';
  end if;

  if p_refund_deposit and coalesce(v_reservation.deposit_amount, 0) > 0 then
    select account
      into v_refund_account
      from public.transactions
      where id = v_reservation.deposit_transaction_id;

    -- Sem o lançamento de entrada do sinal, criar a saída de estorno
    -- geraria um OUT órfão (dinheiro saindo sem nunca ter entrado no
    -- extrato) — principal vetor de saldo negativo no Cofre.
    if v_refund_account is null then
      raise exception 'O lançamento de entrada do sinal desta reserva não existe mais no financeiro. Libere sem devolver e registre a devolução manualmente.';
    end if;

    v_refund_transaction_id := 'trx_' || replace(gen_random_uuid()::text, '-', '');

    insert into public.transactions (id, type, category, amount, date, description, account, sale_id)
    values (
      v_refund_transaction_id,
      'OUT',
      'Estorno de reserva',
      coalesce(v_reservation.deposit_amount, 0),
      now(),
      'Estorno de reserva - ' || v_reservation.customer_name,
      v_refund_account,
      null
    );

    update public.stock_reservations
       set status = 'released',
           released_at = now(),
           sold_at = null,
           deposit_refund_transaction_id = v_refund_transaction_id,
           deposit_refunded_at = now(),
           deposit_retained_at = null,
           sold_sale_id = null
     where id = v_reservation.id
     returning * into v_saved_reservation;
  else
    update public.stock_reservations
       set status = 'released',
           released_at = now(),
           sold_at = null,
           deposit_refund_transaction_id = null,
           deposit_refunded_at = null,
           deposit_retained_at = case
             when coalesce(deposit_amount, 0) > 0 then now()
             else null
           end,
           sold_sale_id = null
     where id = v_reservation.id
     returning * into v_saved_reservation;
  end if;

  update public.stock_items
     set status = 'Disponível'
   where id = p_stock_item_id;

  return v_saved_reservation;
end;
$function$;
--@@ 45 funcao public.remove_stock_item_cost(p_cost_id text)
CREATE OR REPLACE FUNCTION public.remove_stock_item_cost(p_cost_id text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_cost public.costs%rowtype;
begin
  -- A função é security definer (precisa mexer em parts_inventory), então o
  -- papel é conferido à mão. Paridade com o RLS de `costs`, onde admin e
  -- vendedor já podem inserir e atualizar custos: quem lança o custo pode
  -- desfazer o lançamento. Qualquer outro papel não passa daqui.
  if public.current_role() not in ('admin', 'seller') then
    raise exception 'Sem permissão para remover custos do aparelho.'
      using errcode = '42501';
  end if;

  select * into v_cost
  from public.costs
  where id = p_cost_id
  for update;

  if not found then
    -- Idempotente: excluir duas vezes (duplo toque, retry de rede) não é erro.
    return;
  end if;

  -- Devolve a peça ao estoque antes de apagar o custo que a consumiu.
  if v_cost.part_id is not null and coalesce(v_cost.part_quantity, 0) > 0 then
    update public.parts_inventory
       set quantity = quantity + v_cost.part_quantity
     where id = v_cost.part_id;
  end if;

  delete from public.costs where id = p_cost_id;
end;
$function$;
--@@ 45 funcao public.reservation_deposit_account(p_method text)
CREATE OR REPLACE FUNCTION public.reservation_deposit_account(p_method text)
 RETURNS text
 LANGUAGE sql
 IMMUTABLE
 SET search_path TO 'public'
AS $function$
  select case
    when p_method = 'Dinheiro' then 'Cofre'
    else 'Conta Bancária'
  end
$function$;
--@@ 45 funcao public.reserve_stock_item(p_stock_item_id text, p_payload jsonb
CREATE OR REPLACE FUNCTION public.reserve_stock_item(p_stock_item_id text, p_payload jsonb)
 RETURNS stock_reservations
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_stock_item public.stock_items%rowtype;
  v_existing_reservation public.stock_reservations%rowtype;
  v_saved_reservation public.stock_reservations%rowtype;
  v_deposit_transaction_id text;
  v_customer_name text := btrim(coalesce(p_payload ->> 'customerName', ''));
  v_customer_phone text := btrim(coalesce(p_payload ->> 'customerPhone', ''));
  v_expires_at timestamptz := nullif(p_payload ->> 'expiresAt', '')::timestamptz;
  v_deposit_amount numeric(10,2) := nullif(p_payload ->> 'depositAmount', '')::numeric(10,2);
  v_deposit_payment_method text := nullif(btrim(coalesce(p_payload ->> 'depositPaymentMethod', '')), '');
  v_notes text := nullif(btrim(coalesce(p_payload ->> 'notes', '')), '');
  v_seller_id text := nullif(btrim(coalesce(p_payload ->> 'sellerId', '')), '');
  v_seller_name text := nullif(btrim(coalesce(p_payload ->> 'sellerName', '')), '');
  v_created_by uuid := auth.uid();
  v_description text;
begin
  if v_customer_name = '' then
    raise exception 'Informe o cliente da reserva.';
  end if;

  if v_customer_phone = '' then
    raise exception 'Informe o telefone da reserva.';
  end if;

  if v_deposit_amount is not null and v_deposit_amount < 0 then
    raise exception 'Valor do sinal invalido.';
  end if;

  if coalesce(v_deposit_amount, 0) = 0 then
    v_deposit_amount := null;
    v_deposit_payment_method := null;
  elsif v_deposit_payment_method is null then
    raise exception 'Informe a forma do sinal.';
  end if;

  -- Se seller_id não foi passado no payload, tentar resolver via auth.uid()
  if v_seller_id is null and v_created_by is not null then
    select up.seller_id into v_seller_id
    from public.user_profiles up
    where up.id = v_created_by;
  end if;

  -- Se seller_name não foi passado, resolver do seller ou do user_access_roles
  if v_seller_name is null and v_seller_id is not null then
    select s.name into v_seller_name
    from public.sellers s
    where s.id = v_seller_id;
  end if;

  if v_seller_name is null and v_created_by is not null then
    select uar.display_name into v_seller_name
    from public.user_access_roles uar
    where uar.user_id = v_created_by;
  end if;

  select *
    into v_stock_item
    from public.stock_items
    where id = p_stock_item_id
    for update;

  if not found then
    raise exception 'Aparelho nao encontrado no estoque.';
  end if;

  if v_stock_item.status not in ('Disponivel', 'Disponível', 'Reservado') then
    raise exception 'Aparelho esta em % e nao pode ser reservado.', v_stock_item.status;
  end if;

  select *
    into v_existing_reservation
    from public.stock_reservations
    where stock_item_id = p_stock_item_id
      and status = 'active'
    for update;

  if found then
    update public.stock_reservations
       set customer_name = v_customer_name,
           customer_phone = v_customer_phone,
           expires_at = v_expires_at,
           deposit_amount = v_deposit_amount,
           deposit_payment_method = v_deposit_payment_method,
           notes = v_notes,
           seller_id = coalesce(v_seller_id, seller_id),
           seller_name = coalesce(v_seller_name, seller_name),
           released_at = null,
           sold_at = null,
           deposit_refund_transaction_id = null,
           deposit_refunded_at = null,
           deposit_retained_at = null,
           sold_sale_id = null
     where id = v_existing_reservation.id
     returning * into v_saved_reservation;
  else
    insert into public.stock_reservations (
      id,
      stock_item_id,
      customer_name,
      customer_phone,
      expires_at,
      deposit_amount,
      deposit_payment_method,
      notes,
      status,
      seller_id,
      created_by,
      seller_name,
      released_at,
      sold_at,
      deposit_refund_transaction_id,
      deposit_refunded_at,
      deposit_retained_at,
      sold_sale_id
    )
    values (
      'res_' || replace(gen_random_uuid()::text, '-', ''),
      p_stock_item_id,
      v_customer_name,
      v_customer_phone,
      v_expires_at,
      v_deposit_amount,
      v_deposit_payment_method,
      v_notes,
      'active',
      v_seller_id,
      v_created_by,
      v_seller_name,
      null,
      null,
      null,
      null,
      null,
      null
    )
    returning * into v_saved_reservation;
  end if;

  v_description := 'Adiantamento de reserva - ' || v_customer_name;

  if v_deposit_amount is not null then
    if v_saved_reservation.deposit_transaction_id is not null then
      update public.transactions
         set type = 'IN',
             category = 'Adiantamento de reserva',
             amount = v_deposit_amount,
             date = case
               when v_existing_reservation.deposit_amount is distinct from v_deposit_amount
                 or v_existing_reservation.deposit_payment_method is distinct from v_deposit_payment_method
               then now()
               else date
             end,
             description = v_description,
             account = public.reservation_deposit_account(v_deposit_payment_method),
             sale_id = null
       where id = v_saved_reservation.deposit_transaction_id;

      v_deposit_transaction_id := v_saved_reservation.deposit_transaction_id;
    else
      v_deposit_transaction_id := 'trx_' || replace(gen_random_uuid()::text, '-', '');

      insert into public.transactions (id, type, category, amount, date, description, account, sale_id)
      values (
        v_deposit_transaction_id,
        'IN',
        'Adiantamento de reserva',
        v_deposit_amount,
        now(),
        v_description,
        public.reservation_deposit_account(v_deposit_payment_method),
        null
      );
    end if;

    update public.stock_reservations
       set deposit_transaction_id = v_deposit_transaction_id
     where id = v_saved_reservation.id
     returning * into v_saved_reservation;
  else
    if v_saved_reservation.deposit_transaction_id is not null then
      v_deposit_transaction_id := v_saved_reservation.deposit_transaction_id;

      update public.stock_reservations
         set deposit_transaction_id = null
       where id = v_saved_reservation.id
       returning * into v_saved_reservation;

      delete from public.transactions
      where id = v_deposit_transaction_id
        and sale_id is null
        and category = 'Adiantamento de reserva';
    end if;
  end if;

  update public.stock_items
     set status = 'Reservado'
   where id = p_stock_item_id;

  return v_saved_reservation;
end;
$function$;
--@@ 45 funcao public.resolve_crm_default_store_id()
CREATE OR REPLACE FUNCTION public.resolve_crm_default_store_id()
 RETURNS text
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select coalesce(
    (
      select nullif(btrim(value_text), '')
      from public.crm_settings
      where id = 'default_crm_store_id'
        and exists (
          select 1
          from public.stores s
          where s.id = nullif(btrim(public.crm_settings.value_text), '')
        )
      limit 1
    ),
    (
      select id
      from public.stores
      order by name asc, id asc
      limit 1
    )
  );
$function$;
--@@ 45 funcao public.resolve_crm_lead_for_sale(p_customer_id text, p_store_id
CREATE OR REPLACE FUNCTION public.resolve_crm_lead_for_sale(p_customer_id text, p_store_id text DEFAULT NULL::text, p_explicit_lead_id text DEFAULT NULL::text, p_conservative boolean DEFAULT false)
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_customer public.customers%rowtype;
  v_store_id text := nullif(btrim(coalesce(p_store_id, '')), '');
  v_explicit_lead_id text := nullif(btrim(coalesce(p_explicit_lead_id, '')), '');
  v_phone text;
  v_alternative_phone text;
  v_phone_key text;
  v_alternative_phone_key text;
  v_candidate text;
  v_tie_count integer := 0;
begin
  if nullif(btrim(coalesce(p_customer_id, '')), '') is null then
    return null;
  end if;

  select * into v_customer
  from public.customers
  where id = p_customer_id
  limit 1;

  if not found then
    return null;
  end if;

  v_phone := public.normalize_phone(v_customer.phone);
  v_alternative_phone := public.normalize_phone(v_customer.alternative_phone);
  v_phone_key := public.crm_br_phone_match_key(coalesce(v_phone, v_customer.phone));
  v_alternative_phone_key := public.crm_br_phone_match_key(coalesce(v_alternative_phone, v_customer.alternative_phone));

  if v_explicit_lead_id is not null then
    select l.id into v_candidate
    from public.crm_leads l
    where l.id = v_explicit_lead_id
      and (
        l.customer_id is null
        or l.customer_id = p_customer_id
        or (v_phone is not null and l.phone_normalized = v_phone)
        or (v_alternative_phone is not null and l.phone_normalized = v_alternative_phone)
        or (v_phone_key is not null and public.crm_br_phone_match_key(coalesce(l.phone_normalized, l.phone, l.id)) = v_phone_key)
        or (v_alternative_phone_key is not null and public.crm_br_phone_match_key(coalesce(l.phone_normalized, l.phone, l.id)) = v_alternative_phone_key)
      )
    limit 1;

    if v_candidate is not null then
      return v_candidate;
    end if;
  end if;

  with candidates as (
    select
      l.id,
      case
        when l.customer_id = p_customer_id then 1
        when v_phone is not null and l.phone_normalized = v_phone then 2
        when v_alternative_phone is not null and l.phone_normalized = v_alternative_phone then 3
        when v_phone_key is not null and public.crm_br_phone_match_key(coalesce(l.phone_normalized, l.phone, l.id)) = v_phone_key then 4
        when v_alternative_phone_key is not null and public.crm_br_phone_match_key(coalesce(l.phone_normalized, l.phone, l.id)) = v_alternative_phone_key then 5
        else 9
      end as match_rank,
      case
        when exists (
          select 1
          from public.crm_meta_ads_attributions a
          where a.lead_id = l.id
            and a.store_id = l.store_id
        )
          or coalesce(l.source, '') in ('meta_ads', 'instagram_ads', 'click_to_whatsapp')
          or l.source_ad_context is not null
          or l.source_campaign_id is not null
          or l.source_campaign_title is not null
        then 0 else 1
      end as ads_rank,
      case when v_store_id is not null and l.store_id = v_store_id then 0 else 1 end as store_rank,
      coalesce(l.last_interaction_at, l.last_message_at, l.updated_at, l.created_at) as activity_at,
      l.created_at
    from public.crm_leads l
    where l.customer_id = p_customer_id
       or (v_phone is not null and l.phone_normalized = v_phone)
       or (v_alternative_phone is not null and l.phone_normalized = v_alternative_phone)
       or (v_phone_key is not null and public.crm_br_phone_match_key(coalesce(l.phone_normalized, l.phone, l.id)) = v_phone_key)
       or (v_alternative_phone_key is not null and public.crm_br_phone_match_key(coalesce(l.phone_normalized, l.phone, l.id)) = v_alternative_phone_key)
  ),
  ranked as (
    select
      c.*,
      row_number() over (
        order by c.match_rank asc, c.ads_rank asc, c.store_rank asc, c.activity_at desc nulls last, c.created_at desc nulls last, c.id desc
      ) as rn,
      count(*) over (
        partition by c.match_rank, c.ads_rank, c.store_rank, c.activity_at, c.created_at
      ) as same_rank_count
    from candidates c
  )
  select id, same_rank_count
    into v_candidate, v_tie_count
  from ranked
  where rn = 1;

  if p_conservative and coalesce(v_tie_count, 0) > 1 then
    return null;
  end if;

  return v_candidate;
end;
$function$;
--@@ 45 funcao public.sales_backfill_ads_origin_from_phone_match()
CREATE OR REPLACE FUNCTION public.sales_backfill_ads_origin_from_phone_match()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if tg_op in ('INSERT', 'UPDATE') then
    perform public.crm_backfill_sale_ads_origin_from_phone_match(new.id);
    return new;
  end if;

  return null;
end;
$function$;
--@@ 45 funcao public.sales_set_crm_lead_id()
CREATE OR REPLACE FUNCTION public.sales_set_crm_lead_id()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  new.crm_lead_id := public.resolve_crm_lead_for_sale(
    new.customer_id,
    new.store_id,
    new.crm_lead_id,
    false
  );
  return new;
end;
$function$;
--@@ 45 funcao public.search_crm_messages(p_store_id text, p_query text, p_lim
CREATE OR REPLACE FUNCTION public.search_crm_messages(p_store_id text, p_query text, p_limit integer DEFAULT 20)
 RETURNS TABLE(conversation_id uuid, message_id uuid, snippet text, rank real)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select
    m.conversation_id,
    m.id                                          as message_id,
    ts_headline(
      'portuguese',
      coalesce(m.content, ''),
      plainto_tsquery('portuguese', p_query),
      'MaxFragments=1, MaxWords=15, MinWords=5, StartSel=<mark>, StopSel=</mark>'
    )                                             as snippet,
    ts_rank(to_tsvector('portuguese', coalesce(m.content, '')), plainto_tsquery('portuguese', p_query)) as rank
  from public.crm_messages m
  where
    m.store_id = p_store_id
    and to_tsvector('portuguese', coalesce(m.content, '')) @@ plainto_tsquery('portuguese', p_query)
  order by rank desc
  limit p_limit;
$function$;
--@@ 45 funcao public.search_leads(p_store_id text, p_filters jsonb, p_limit i
CREATE OR REPLACE FUNCTION public.search_leads(p_store_id text, p_filters jsonb DEFAULT '{}'::jsonb, p_limit integer DEFAULT 50, p_offset integer DEFAULT 0)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
      l.source,
      l.source_campaign_title,
      l.source_ad_context,
      l.funnel_id,
      l.funnel_stage,
      l.sales_stage,
      l.attendance_owner,
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
      ch.provider as source_channel_provider,
      coalesce(sh.stage_history, '[]'::jsonb) as stage_history
    from public.crm_leads l
    left join public.customers c on c.id = l.customer_id
    left join lateral (
      select c1.id, c1.status, c1.unread_count, c1.message_count, c1.last_message_at
      from public.crm_conversations c1
      where c1.lead_id = l.id
      order by c1.last_message_at desc nulls last, c1.created_at desc
      limit 1
    ) conv on true
    left join lateral (
      select coalesce(jsonb_agg(to_jsonb(h) order by h.created_at desc nulls last, h.id desc), '[]'::jsonb) as stage_history
      from (
        select h.*
        from public.crm_lead_stage_history h
        where h.lead_id = l.id
        order by h.created_at desc nulls last, h.id desc
        limit 1
      ) h
    ) sh on true
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
$function$;
--@@ 45 funcao public.set_lead_custom_field(p_lead_id text, p_field_id uuid, p
CREATE OR REPLACE FUNCTION public.set_lead_custom_field(p_lead_id text, p_field_id uuid, p_value jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_store_id text;
begin
  if p_lead_id is null or p_field_id is null then
    return jsonb_build_object('success', false, 'error', 'lead_id e field_id são obrigatórios');
  end if;

  select l.store_id into v_store_id
  from public.crm_leads l
  where l.id = p_lead_id
  limit 1;

  if v_store_id is null then
    return jsonb_build_object('success', false, 'error', 'Lead não encontrado');
  end if;

  insert into public.crm_lead_custom_field_values (store_id, lead_id, field_id, value)
  values (v_store_id, p_lead_id, p_field_id, coalesce(p_value, '{}'::jsonb))
  on conflict (lead_id, field_id)
  do update set
    value = excluded.value,
    updated_at = now();

  return jsonb_build_object('success', true, 'lead_id', p_lead_id, 'field_id', p_field_id);
end;
$function$;
--@@ 45 funcao public.sync_crm_campaign_tag_mappings(p_store_id text, p_mappin
CREATE OR REPLACE FUNCTION public.sync_crm_campaign_tag_mappings(p_store_id text, p_mappings jsonb DEFAULT '{}'::jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_key text;
  v_value jsonb;
  v_source text;
  v_campaign text;
  v_medium text;
begin
  for v_key, v_value in select * from jsonb_each(coalesce(p_mappings, '{}'::jsonb))
  loop
    v_source := nullif(btrim(coalesce(v_value ->> 'source_key', v_key)), '');
    v_campaign := nullif(btrim(coalesce(v_value ->> 'campaign_key', v_key)), '');
    v_medium := nullif(btrim(coalesce(v_value ->> 'medium_key', '')), '');

    if v_source is null or v_campaign is null then
      continue;
    end if;

    insert into public.crm_utm_config (store_id, source_key, campaign_key, medium_key, is_active)
    values (p_store_id, v_source, v_campaign, v_medium, true)
    on conflict (store_id, source_key, campaign_key)
    do update set
      medium_key = excluded.medium_key,
      is_active = true,
      updated_at = now();
  end loop;

  return jsonb_build_object('success', true);
end;
$function$;
--@@ 45 funcao public.test_webhook_subscription(p_subscription_id uuid)
CREATE OR REPLACE FUNCTION public.test_webhook_subscription(p_subscription_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_sub record;
begin
  select * into v_sub
  from public.crm_webhook_subscriptions s
  where s.id = p_subscription_id
  limit 1;

  if not found then
    return jsonb_build_object('success', false, 'error', 'Webhook subscription não encontrada');
  end if;

  insert into public.crm_event_log (
    store_id,
    event_type,
    payload,
    is_outbound,
    webhook_url,
    sent,
    retry_count,
    processed,
    subscription_id
  )
  values (
    coalesce(v_sub.store_id, ''),
    'crm_webhook_test',
    jsonb_build_object('subscription_id', p_subscription_id, 'message', 'test ping'),
    true,
    v_sub.url,
    false,
    0,
    false,
    p_subscription_id
  );

  return jsonb_build_object('success', true, 'subscription_id', p_subscription_id);
end;
$function$;
--@@ 45 funcao public.tg_set_card_fee_settings_updated_at()
CREATE OR REPLACE FUNCTION public.tg_set_card_fee_settings_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
begin
  new.updated_at = now();
  return new;
end;
$function$;
--@@ 45 funcao public.tg_set_creditors_updated_at()
CREATE OR REPLACE FUNCTION public.tg_set_creditors_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
begin
  new.updated_at = now();
  return new;
end;
$function$;
--@@ 45 funcao public.tg_set_device_catalog_updated_at()
CREATE OR REPLACE FUNCTION public.tg_set_device_catalog_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
begin
  new.updated_at = now();
  return new;
end;
$function$;
--@@ 45 funcao public.tg_set_finance_categories_updated_at()
CREATE OR REPLACE FUNCTION public.tg_set_finance_categories_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
begin
  new.updated_at = now();
  return new;
end;
$function$;
--@@ 45 funcao public.tg_set_lead_state_updated_at()
CREATE OR REPLACE FUNCTION public.tg_set_lead_state_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
begin
  new.updated_at = now();
  return new;
end;
$function$;
--@@ 45 funcao public.tg_set_parts_inventory_updated_at()
CREATE OR REPLACE FUNCTION public.tg_set_parts_inventory_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
begin
  new.updated_at = now();
  return new;
end;
$function$;
--@@ 45 funcao public.tg_set_payable_debts_updated_at()
CREATE OR REPLACE FUNCTION public.tg_set_payable_debts_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
begin
  new.updated_at = now();
  return new;
end;
$function$;
--@@ 45 funcao public.tg_set_simulator_trade_in_updated_at()
CREATE OR REPLACE FUNCTION public.tg_set_simulator_trade_in_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
begin
  new.updated_at = now();
  return new;
end;
$function$;
--@@ 45 funcao public.tg_set_stock_reservations_updated_at()
CREATE OR REPLACE FUNCTION public.tg_set_stock_reservations_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
begin
  new.updated_at = now();
  return new;
end;
$function$;
--@@ 45 funcao public.touch_reservation_message_settings()
CREATE OR REPLACE FUNCTION public.touch_reservation_message_settings()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
begin
  new.updated_at := now();
  return new;
end;
$function$;
--@@ 45 funcao public.transfer_between_accounts(p_amount numeric, p_from text,
CREATE OR REPLACE FUNCTION public.transfer_between_accounts(p_amount numeric, p_from text, p_to text)
 RETURNS SETOF transactions
 LANGUAGE sql
 SET search_path TO ''
AS $function$
  select *
  from private.transfer_between_accounts_impl(p_amount, p_from, p_to);
$function$;
--@@ 45 funcao public.transfer_lead_store(p_lead_id text, p_to_store_id text)
CREATE OR REPLACE FUNCTION public.transfer_lead_store(p_lead_id text, p_to_store_id text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_from_store text;
begin
  select l.store_id into v_from_store
  from public.crm_leads l
  where l.id = p_lead_id
  limit 1;

  if v_from_store is null then
    return jsonb_build_object('success', false, 'error', 'Lead não encontrado');
  end if;

  update public.crm_leads
  set store_id = p_to_store_id,
      updated_at = now()
  where id = p_lead_id;

  update public.crm_conversations
  set store_id = p_to_store_id,
      updated_at = now()
  where lead_id = p_lead_id;

  update public.crm_messages
  set store_id = p_to_store_id
  where lead_id = p_lead_id;

  update public.crm_event_log
  set store_id = p_to_store_id
  where lead_id = p_lead_id;

  return jsonb_build_object('success', true, 'from_store_id', v_from_store, 'to_store_id', p_to_store_id);
end;
$function$;
--@@ 45 funcao public.trigger_new_lead_avatar()
CREATE OR REPLACE FUNCTION public.trigger_new_lead_avatar()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  payload json;
BEGIN
  IF (TG_OP = 'INSERT') OR (TG_OP = 'UPDATE' AND OLD.avatar_lead_updated IS FALSE) THEN
    IF to_regnamespace('net') IS NOT NULL THEN
      payload := json_build_object(
        'type', 'trigger_n8n',
        'record', row_to_json(NEW)
      );

      BEGIN
        PERFORM net.http_post(
          url := 'https://ykomvluckfljaidfuicn.supabase.co/functions/v1/crm-lead-profile',
          headers := '{"Content-Type": "application/json"}',
          body := payload
        );
      EXCEPTION WHEN OTHERS THEN
        -- Do not block lead creation if integration is unavailable
        NULL;
      END;
    END IF;
  END IF;

  RETURN NEW;
END;
$function$;
--@@ 45 funcao public.update_campaign_delivery_metrics(p_group_key uuid, p_pay
CREATE OR REPLACE FUNCTION public.update_campaign_delivery_metrics(p_group_key uuid, p_payload jsonb DEFAULT '{}'::jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  update public.crm_meta_ads_groups g
  set
    metrics = coalesce(g.metrics, '{}'::jsonb) || coalesce(p_payload, '{}'::jsonb),
    updated_at = now()
  where g.group_key = p_group_key;

  if not found then
    return jsonb_build_object('success', false, 'error', 'Grupo não encontrado');
  end if;

  return jsonb_build_object('success', true, 'group_key', p_group_key);
end;
$function$;
--@@ 45 funcao public.update_lead_basic_data(p_lead_id text, p_name text, p_em
CREATE OR REPLACE FUNCTION public.update_lead_basic_data(p_lead_id text, p_name text DEFAULT NULL::text, p_email text DEFAULT NULL::text, p_tags jsonb DEFAULT NULL::jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_tags text[];
begin
  if p_lead_id is null or btrim(p_lead_id) = '' then
    return jsonb_build_object('success', false, 'error', 'lead_id is required');
  end if;

  if p_tags is not null then
    v_tags := public.crm_jsonb_to_text_array(p_tags);
  end if;

  update public.crm_leads
  set
    name = case
      when p_name is null then name
      when btrim(p_name) = '' then null
      else btrim(p_name)
    end,
    email = case
      when p_email is null then email
      when btrim(p_email) = '' then null
      else btrim(p_email)
    end,
    tags = case
      when p_tags is null then tags
      else v_tags
    end,
    updated_at = now(),
    last_interaction_at = now()
  where id = p_lead_id;

  if not found then
    return jsonb_build_object('success', false, 'error', 'Lead not found', 'lead_id', p_lead_id);
  end if;

  return jsonb_build_object('success', true, 'lead_id', p_lead_id);
end;
$function$;
--@@ 45 funcao public.update_lead_funnel(p_lead_id text, p_funnel_stage text, 
CREATE OR REPLACE FUNCTION public.update_lead_funnel(p_lead_id text, p_funnel_stage text DEFAULT NULL::text, p_intent text DEFAULT NULL::text, p_reason text DEFAULT NULL::text, p_funnel_id uuid DEFAULT NULL::uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_stage_changed boolean := false;
begin
  if p_lead_id is null or btrim(p_lead_id) = '' then
    return jsonb_build_object('success', false, 'error', 'lead_id is required');
  end if;

  if p_funnel_stage is not null or p_funnel_id is not null then
    perform *
    from public.move_crm_lead_stage(
      p_lead_id => p_lead_id,
      p_to_stage => coalesce(p_funnel_stage, 'new_lead'),
      p_to_funnel_id => p_funnel_id,
      p_changed_by => null,
      p_notes => p_reason
    );

    v_stage_changed := true;
  end if;

  if p_intent is not null then
    update public.crm_leads
    set
      intent = nullif(btrim(p_intent), ''),
      updated_at = now(),
      last_interaction_at = now()
    where id = p_lead_id;

    if not found then
      return jsonb_build_object('success', false, 'error', 'Lead not found', 'lead_id', p_lead_id);
    end if;
  end if;

  return jsonb_build_object('success', true, 'lead_id', p_lead_id, 'stage_changed', v_stage_changed);
end;
$function$;
--@@ 45 funcao public.update_lead_memory(p_lead_id text, p_summary_short text,
CREATE OR REPLACE FUNCTION public.update_lead_memory(p_lead_id text, p_summary_short text DEFAULT NULL::text, p_summary_operational text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_lead public.crm_leads%rowtype;
begin
  if p_lead_id is null or btrim(p_lead_id) = '' then
    raise exception 'lead_id is required';
  end if;

  update public.crm_leads
  set
    summary_short = case
      when nullif(btrim(coalesce(p_summary_short, '')), '') is not null then btrim(p_summary_short)
      else summary_short
    end,
    summary_operational = case
      when nullif(btrim(coalesce(p_summary_operational, '')), '') is not null then btrim(p_summary_operational)
      else summary_operational
    end,
    updated_at = now()
  where id = p_lead_id
  returning * into v_lead;

  if v_lead.id is null then
    raise exception 'Lead not found: %', p_lead_id;
  end if;

  return jsonb_build_object(
    'lead_id', v_lead.id,
    'summary_short', v_lead.summary_short,
    'summary_operational', v_lead.summary_operational
  );
end;
$function$;
--@@ 45 funcao public.update_sale_full(p_sale_id text, p_payload jsonb)
CREATE OR REPLACE FUNCTION public.update_sale_full(p_sale_id text, p_payload jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_existing public.sales%rowtype;
  v_result jsonb;
begin
  if public.current_role() <> 'admin' then
    raise exception 'Apenas administradores podem editar vendas.' using errcode = '42501';
  end if;

  select * into v_existing from public.sales where id = p_sale_id for update;
  if not found then
    raise exception 'Venda não encontrada: %', p_sale_id using errcode = 'P0002';
  end if;

  perform public.pdv_rebuild_sale_full_payload(p_sale_id, p_payload);

  v_result := public.pdv_hydrate_sale_json(p_sale_id);

  return v_result;
end;
$function$;
--@@ 45 funcao public.upsert_crm_lead(p_store_id text, p_phone text, p_name te
CREATE OR REPLACE FUNCTION public.upsert_crm_lead(p_store_id text, p_phone text, p_name text DEFAULT NULL::text, p_contact_id text DEFAULT NULL::text, p_entity_id text DEFAULT NULL::text, p_channel_id uuid DEFAULT NULL::uuid, p_email text DEFAULT NULL::text, p_utm_source text DEFAULT NULL::text, p_utm_campaign text DEFAULT NULL::text, p_utm_medium text DEFAULT NULL::text, p_utm_content text DEFAULT NULL::text, p_utm_term text DEFAULT NULL::text, p_first_message text DEFAULT NULL::text, p_intent text DEFAULT NULL::text)
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_store_id text := nullif(btrim(coalesce(p_store_id, '')), '');
  v_phone_normalized text;
  v_funnel_id uuid;
  v_lead_id text;
  v_existing_lead_id text;
begin
  if v_store_id is null then
    raise exception 'store_id is required';
  end if;

  v_phone_normalized := public.normalize_phone(p_phone);
  if v_phone_normalized is null or btrim(v_phone_normalized) = '' then
    raise exception 'phone is required';
  end if;

  select f.id into v_funnel_id
  from public.crm_funnels f
  where f.store_id = v_store_id
    and f.funnel_type = 'sales'
    and coalesce(f.is_active, true) = true
  order by coalesce(f.is_default, false) desc, f.created_at asc
  limit 1;

  select l.id
    into v_existing_lead_id
  from public.crm_leads l
  where l.store_id = v_store_id
    and l.phone_normalized = v_phone_normalized
  order by l.updated_at desc nulls last, l.created_at desc nulls last, l.id
  limit 1
  for update;

  if v_existing_lead_id is null then
    insert into public.crm_leads (
      id,
      store_id,
      phone,
      name,
      email,
      contact_id,
      entity_id,
      source_channel_id,
      utm_source,
      utm_campaign,
      utm_medium,
      utm_content,
      utm_term,
      first_message,
      intent,
      funnel_id,
      funnel_stage,
      first_contact_at,
      last_message_at,
      last_interaction_at,
      updated_at
    )
    values (
      v_phone_normalized || '-' || v_store_id,
      v_store_id,
      v_phone_normalized,
      nullif(btrim(p_name), ''),
      nullif(btrim(p_email), ''),
      p_contact_id,
      p_entity_id,
      p_channel_id,
      nullif(btrim(p_utm_source), ''),
      nullif(btrim(p_utm_campaign), ''),
      nullif(btrim(p_utm_medium), ''),
      nullif(btrim(p_utm_content), ''),
      nullif(btrim(p_utm_term), ''),
      nullif(btrim(p_first_message), ''),
      nullif(btrim(p_intent), ''),
      v_funnel_id,
      'new_lead',
      now(),
      now(),
      now(),
      now()
    )
    returning id into v_lead_id;
  else
    update public.crm_leads
    set
      phone = v_phone_normalized,
      name = coalesce(nullif(btrim(public.crm_leads.name), ''), nullif(btrim(p_name), ''), public.crm_leads.name),
      email = coalesce(nullif(btrim(public.crm_leads.email), ''), nullif(btrim(p_email), ''), public.crm_leads.email),
      contact_id = coalesce(p_contact_id, public.crm_leads.contact_id),
      entity_id = coalesce(p_entity_id, public.crm_leads.entity_id),
      source_channel_id = coalesce(p_channel_id, public.crm_leads.source_channel_id),
      utm_source = coalesce(nullif(btrim(public.crm_leads.utm_source), ''), nullif(btrim(p_utm_source), ''), public.crm_leads.utm_source),
      utm_campaign = coalesce(nullif(btrim(public.crm_leads.utm_campaign), ''), nullif(btrim(p_utm_campaign), ''), public.crm_leads.utm_campaign),
      utm_medium = coalesce(nullif(btrim(public.crm_leads.utm_medium), ''), nullif(btrim(p_utm_medium), ''), public.crm_leads.utm_medium),
      utm_content = coalesce(nullif(btrim(public.crm_leads.utm_content), ''), nullif(btrim(p_utm_content), ''), public.crm_leads.utm_content),
      utm_term = coalesce(nullif(btrim(public.crm_leads.utm_term), ''), nullif(btrim(p_utm_term), ''), public.crm_leads.utm_term),
      first_message = coalesce(nullif(btrim(public.crm_leads.first_message), ''), nullif(btrim(p_first_message), ''), public.crm_leads.first_message),
      intent = coalesce(nullif(btrim(p_intent), ''), public.crm_leads.intent),
      funnel_id = coalesce(public.crm_leads.funnel_id, v_funnel_id),
      funnel_stage = coalesce(nullif(public.crm_leads.funnel_stage, ''), 'new_lead'),
      last_message_at = now(),
      last_interaction_at = now(),
      updated_at = now()
    where id = v_existing_lead_id
    returning id into v_lead_id;
  end if;

  perform public.crm_refresh_lead_purchase_metrics(v_lead_id);
  return v_lead_id;
end;
$function$;
--@@ 45 funcao public.upsert_lead_state(p_lead_id text, p_state jsonb)
CREATE OR REPLACE FUNCTION public.upsert_lead_state(p_lead_id text, p_state jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
    has_tradein, tradein_asked, tradein_model, tradein_model_accepted, tradein_rejected_reason, tradein_capacity,
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
    coalesce((v_state ->> 'tradein_asked')::boolean, false),
    nullif(btrim(v_state ->> 'tradein_model'), ''),
    case when v_state ? 'tradein_model_accepted' then (v_state ->> 'tradein_model_accepted')::boolean else null end,
    nullif(btrim(v_state ->> 'tradein_rejected_reason'), ''),
    nullif(btrim(v_state ->> 'tradein_capacity'), ''),
    nullif(btrim(v_state ->> 'tradein_color'), ''),
    case when v_state ? 'tradein_scratches' then (v_state ->> 'tradein_scratches')::boolean else null end,
    case when v_state ? 'tradein_liquid_contact' then (v_state ->> 'tradein_liquid_contact')::boolean else null end,
    case when v_state ? 'tradein_side_marks' then (v_state ->> 'tradein_side_marks')::boolean else null end,
    case when v_state ? 'tradein_parts_swapped' then (v_state ->> 'tradein_parts_swapped')::boolean else null end,
    -- caixa/cabo: texto livre (aceita "somente caixa", "so o cabo", etc.)
    nullif(btrim(v_state ->> 'tradein_has_box_cable'), ''),
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
    -- trade-in asked: latch sticky-true (uma vez perguntado, permanece). Preserve
    -- contra execucoes paralelas/stale que mandem false.
    tradein_asked = public.lead_state.tradein_asked or coalesce(excluded.tradein_asked, false),
    tradein_model = coalesce(excluded.tradein_model, public.lead_state.tradein_model),
    tradein_model_accepted = case when v_state ? 'tradein_model_accepted' then excluded.tradein_model_accepted else public.lead_state.tradein_model_accepted end,
    tradein_rejected_reason = coalesce(excluded.tradein_rejected_reason, public.lead_state.tradein_rejected_reason),
    tradein_capacity = coalesce(excluded.tradein_capacity, public.lead_state.tradein_capacity),
    tradein_color = coalesce(excluded.tradein_color, public.lead_state.tradein_color),
    tradein_scratches = case when v_state ? 'tradein_scratches' then excluded.tradein_scratches else public.lead_state.tradein_scratches end,
    tradein_liquid_contact = case when v_state ? 'tradein_liquid_contact' then excluded.tradein_liquid_contact else public.lead_state.tradein_liquid_contact end,
    tradein_side_marks = case when v_state ? 'tradein_side_marks' then excluded.tradein_side_marks else public.lead_state.tradein_side_marks end,
    tradein_parts_swapped = case when v_state ? 'tradein_parts_swapped' then excluded.tradein_parts_swapped else public.lead_state.tradein_parts_swapped end,
    -- caixa/cabo: texto livre, coalesce-preserve (null preserva o anterior)
    tradein_has_box_cable = coalesce(excluded.tradein_has_box_cable, public.lead_state.tradein_has_box_cable),
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
    cash_entry_asked = public.lead_state.cash_entry_asked or coalesce(excluded.cash_entry_asked, false),
    cash_entry_intent = coalesce(excluded.cash_entry_intent, public.lead_state.cash_entry_intent),
    cash_entry_amount = coalesce(excluded.cash_entry_amount, public.lead_state.cash_entry_amount)
  returning * into v_result;

  return to_jsonb(v_result);
end;
$function$;
--@@ 45 funcao public.upsert_repasse_commerce_state(p_lead_id text, p_expected
CREATE OR REPLACE FUNCTION public.upsert_repasse_commerce_state(p_lead_id text, p_expected_version bigint, p_state jsonb, p_tradein jsonb DEFAULT '{}'::jsonb, p_quotes jsonb DEFAULT '[]'::jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_row public.lead_state%rowtype;
  v_current_version bigint;
begin
  if nullif(btrim(coalesce(p_lead_id, '')), '') is null then
    raise exception 'lead_id is required';
  end if;

  if not (
    auth.role() = 'service_role'
    or exists (
      select 1
      from public.crm_leads l
      where l.id = p_lead_id
        and public.crm_can_access_store(l.store_id)
    )
  ) then
    raise exception 'lead not found or access denied';
  end if;

  insert into public.lead_state (lead_id)
  values (p_lead_id)
  on conflict (lead_id) do nothing;

  select state_version
  into v_current_version
  from public.lead_state
  where lead_id = p_lead_id
  for update;

  if p_expected_version is not null and p_expected_version <> v_current_version then
    raise exception 'stale commerce state version: expected %, current %', p_expected_version, v_current_version
      using errcode = '40001';
  end if;

  update public.lead_state
  set commerce_state = coalesce(p_state, '{}'::jsonb),
      tradein_assessment = coalesce(p_tradein, '{}'::jsonb),
      quote_versions = coalesce(p_quotes, '[]'::jsonb),
      state_version = state_version + 1
  where lead_id = p_lead_id
  returning * into v_row;

  return to_jsonb(v_row);
end;
$function$;
--@@ 50 default public.account_deletion_requests.id
alter table public.account_deletion_requests alter column id set default gen_random_uuid();
--@@ 50 default public.account_deletion_requests.requested_at
alter table public.account_deletion_requests alter column requested_at set default now();
--@@ 50 default public.account_deletion_requests.scheduled_delete_at
alter table public.account_deletion_requests alter column scheduled_delete_at set default (now() + '30 days'::interval);
--@@ 50 default public.admin_agent_audit_log.created_at
alter table public.admin_agent_audit_log alter column created_at set default now();
--@@ 50 default public.admin_agent_audit_log.id
alter table public.admin_agent_audit_log alter column id set default gen_random_uuid();
--@@ 50 default public.admin_agent_audit_log.params
alter table public.admin_agent_audit_log alter column params set default '{}'::jsonb;
--@@ 50 default public.admin_agent_audit_log.status
alter table public.admin_agent_audit_log alter column status set default 'ok'::text;
--@@ 50 default public.admin_agent_numbers.created_at
alter table public.admin_agent_numbers alter column created_at set default now();
--@@ 50 default public.admin_agent_numbers.id
alter table public.admin_agent_numbers alter column id set default gen_random_uuid();
--@@ 50 default public.admin_agent_numbers.is_active
alter table public.admin_agent_numbers alter column is_active set default true;
--@@ 50 default public.admin_agent_numbers.updated_at
alter table public.admin_agent_numbers alter column updated_at set default now();
--@@ 50 default public.admin_agent_pending_actions.created_at
alter table public.admin_agent_pending_actions alter column created_at set default now();
--@@ 50 default public.admin_agent_pending_actions.id
alter table public.admin_agent_pending_actions alter column id set default gen_random_uuid();
--@@ 50 default public.admin_agent_pending_actions.params
alter table public.admin_agent_pending_actions alter column params set default '{}'::jsonb;
--@@ 50 default public.admin_agent_pending_actions.status
alter table public.admin_agent_pending_actions alter column status set default 'pending'::text;
--@@ 50 default public.ai_turn_events.created_at
alter table public.ai_turn_events alter column created_at set default now();
--@@ 50 default public.ai_turn_events.id
alter table public.ai_turn_events alter column id set default gen_random_uuid();
--@@ 50 default public.ai_turn_events.metadata
alter table public.ai_turn_events alter column metadata set default '{}'::jsonb;
--@@ 50 default public.ai_turn_events.stage_timings
alter table public.ai_turn_events alter column stage_timings set default '{}'::jsonb;
--@@ 50 default public.app_role_permissions.created_at
alter table public.app_role_permissions alter column created_at set default now();
--@@ 50 default public.app_role_permissions.is_deletable
alter table public.app_role_permissions alter column is_deletable set default false;
--@@ 50 default public.app_role_permissions.is_editable
alter table public.app_role_permissions alter column is_editable set default false;
--@@ 50 default public.app_role_permissions.is_visible
alter table public.app_role_permissions alter column is_visible set default false;
--@@ 50 default public.app_role_permissions.updated_at
alter table public.app_role_permissions alter column updated_at set default now();
--@@ 50 default public.app_user_activity_logs.id
alter table public.app_user_activity_logs alter column id set default nextval('app_user_activity_logs_id_seq'::regclass);
--@@ 50 default public.app_user_activity_logs.metadata
alter table public.app_user_activity_logs alter column metadata set default '{}'::jsonb;
--@@ 50 default public.app_user_activity_logs.occurred_at
alter table public.app_user_activity_logs alter column occurred_at set default now();
--@@ 50 default public.business_profile.created_at
alter table public.business_profile alter column created_at set default now();
--@@ 50 default public.business_profile.updated_at
alter table public.business_profile alter column updated_at set default now();
--@@ 50 default public.card_fee_settings.created_at
alter table public.card_fee_settings alter column created_at set default now();
--@@ 50 default public.card_fee_settings.debit_rate
alter table public.card_fee_settings alter column debit_rate set default 1.87;
--@@ 50 default public.card_fee_settings.id
alter table public.card_fee_settings alter column id set default 'default'::text;
--@@ 50 default public.card_fee_settings.updated_at
alter table public.card_fee_settings alter column updated_at set default now();
--@@ 50 default public.cost_history.count
alter table public.cost_history alter column count set default 1;
--@@ 50 default public.cost_history.created_at
alter table public.cost_history alter column created_at set default now();
--@@ 50 default public.cost_history.last_used
alter table public.cost_history alter column last_used set default now();
--@@ 50 default public.cost_history.updated_at
alter table public.cost_history alter column updated_at set default now();
--@@ 50 default public.costs.created_at
alter table public.costs alter column created_at set default now();
--@@ 50 default public.costs.date
alter table public.costs alter column date set default now();
--@@ 50 default public.creditors.created_at
alter table public.creditors alter column created_at set default now();
--@@ 50 default public.creditors.updated_at
alter table public.creditors alter column updated_at set default now();
--@@ 50 default public.crm_ai_agent_configs.auto_send_response
alter table public.crm_ai_agent_configs alter column auto_send_response set default false;
--@@ 50 default public.crm_ai_agent_configs.behavior_modes
alter table public.crm_ai_agent_configs alter column behavior_modes set default '{}'::text[];
--@@ 50 default public.crm_ai_agent_configs.channel_ids
alter table public.crm_ai_agent_configs alter column channel_ids set default '{}'::uuid[];
--@@ 50 default public.crm_ai_agent_configs.config
alter table public.crm_ai_agent_configs alter column config set default '{}'::jsonb;
--@@ 50 default public.crm_ai_agent_configs.created_at
alter table public.crm_ai_agent_configs alter column created_at set default now();
--@@ 50 default public.crm_ai_agent_configs.id
alter table public.crm_ai_agent_configs alter column id set default gen_random_uuid();
--@@ 50 default public.crm_ai_agent_configs.is_active
alter table public.crm_ai_agent_configs alter column is_active set default false;
--@@ 50 default public.crm_ai_agent_configs.model
alter table public.crm_ai_agent_configs alter column model set default 'gpt-4.1-mini'::text;
--@@ 50 default public.crm_ai_agent_configs.require_human_approval
alter table public.crm_ai_agent_configs alter column require_human_approval set default true;
--@@ 50 default public.crm_ai_agent_configs.routing_mode
alter table public.crm_ai_agent_configs alter column routing_mode set default 'priority'::text;
--@@ 50 default public.crm_ai_agent_configs.routing_priority
alter table public.crm_ai_agent_configs alter column routing_priority set default 100;
--@@ 50 default public.crm_ai_agent_configs.total_failures
alter table public.crm_ai_agent_configs alter column total_failures set default 0;
--@@ 50 default public.crm_ai_agent_configs.total_invocations
alter table public.crm_ai_agent_configs alter column total_invocations set default 0;
--@@ 50 default public.crm_ai_agent_configs.total_successes
alter table public.crm_ai_agent_configs alter column total_successes set default 0;
--@@ 50 default public.crm_ai_agent_configs.traffic_weight
alter table public.crm_ai_agent_configs alter column traffic_weight set default 100;
--@@ 50 default public.crm_ai_agent_configs.trigger_conditions
alter table public.crm_ai_agent_configs alter column trigger_conditions set default '{}'::jsonb;
--@@ 50 default public.crm_ai_agent_configs.updated_at
alter table public.crm_ai_agent_configs alter column updated_at set default now();
--@@ 50 default public.crm_ai_agent_invocations.created_at
alter table public.crm_ai_agent_invocations alter column created_at set default now();
--@@ 50 default public.crm_ai_agent_invocations.id
alter table public.crm_ai_agent_invocations alter column id set default gen_random_uuid();
--@@ 50 default public.crm_ai_agent_invocations.metadata
alter table public.crm_ai_agent_invocations alter column metadata set default '{}'::jsonb;
--@@ 50 default public.crm_ai_agent_invocations.source
alter table public.crm_ai_agent_invocations alter column source set default 'inbound'::text;
--@@ 50 default public.crm_ai_agent_invocations.status
alter table public.crm_ai_agent_invocations alter column status set default 'success'::text;
--@@ 50 default public.crm_ai_entry_settings.business_hours
alter table public.crm_ai_entry_settings alter column business_hours set default '{}'::jsonb;
--@@ 50 default public.crm_ai_entry_settings.created_at
alter table public.crm_ai_entry_settings alter column created_at set default now();
--@@ 50 default public.crm_ai_entry_settings.fallback_mode
alter table public.crm_ai_entry_settings alter column fallback_mode set default 'keep_current'::text;
--@@ 50 default public.crm_ai_entry_settings.id
alter table public.crm_ai_entry_settings alter column id set default gen_random_uuid();
--@@ 50 default public.crm_ai_entry_settings.is_enabled
alter table public.crm_ai_entry_settings alter column is_enabled set default false;
--@@ 50 default public.crm_ai_entry_settings.reopen_hours
alter table public.crm_ai_entry_settings alter column reopen_hours set default 24;
--@@ 50 default public.crm_ai_entry_settings.rules
alter table public.crm_ai_entry_settings alter column rules set default '[]'::jsonb;
--@@ 50 default public.crm_ai_entry_settings.special_business_hours
alter table public.crm_ai_entry_settings alter column special_business_hours set default '{}'::jsonb;
--@@ 50 default public.crm_ai_entry_settings.updated_at
alter table public.crm_ai_entry_settings alter column updated_at set default now();
--@@ 50 default public.crm_attendance_scripts.context
alter table public.crm_attendance_scripts alter column context set default 'general'::text;
--@@ 50 default public.crm_attendance_scripts.created_at
alter table public.crm_attendance_scripts alter column created_at set default now();
--@@ 50 default public.crm_attendance_scripts.id
alter table public.crm_attendance_scripts alter column id set default gen_random_uuid();
--@@ 50 default public.crm_attendance_scripts.is_active
alter table public.crm_attendance_scripts alter column is_active set default true;
--@@ 50 default public.crm_attendance_scripts.updated_at
alter table public.crm_attendance_scripts alter column updated_at set default now();
--@@ 50 default public.crm_auth_handoffs.created_at
alter table public.crm_auth_handoffs alter column created_at set default now();
--@@ 50 default public.crm_auth_handoffs.id
alter table public.crm_auth_handoffs alter column id set default gen_random_uuid();
--@@ 50 default public.crm_automation_rules.created_at
alter table public.crm_automation_rules alter column created_at set default now();
--@@ 50 default public.crm_automation_rules.delay_minutes
alter table public.crm_automation_rules alter column delay_minutes set default 0;
--@@ 50 default public.crm_automation_rules.id
alter table public.crm_automation_rules alter column id set default gen_random_uuid();
--@@ 50 default public.crm_automation_rules.is_active
alter table public.crm_automation_rules alter column is_active set default true;
--@@ 50 default public.crm_automation_rules.message_variants
alter table public.crm_automation_rules alter column message_variants set default '{}'::jsonb;
--@@ 50 default public.crm_automation_rules.metrics
alter table public.crm_automation_rules alter column metrics set default '{}'::jsonb;
--@@ 50 default public.crm_automation_rules.switch_to_human_handling
alter table public.crm_automation_rules alter column switch_to_human_handling set default false;
--@@ 50 default public.crm_automation_rules.updated_at
alter table public.crm_automation_rules alter column updated_at set default now();
--@@ 50 default public.crm_broadcast_recipients.created_at
alter table public.crm_broadcast_recipients alter column created_at set default now();
--@@ 50 default public.crm_broadcast_recipients.id
alter table public.crm_broadcast_recipients alter column id set default gen_random_uuid();
--@@ 50 default public.crm_broadcast_recipients.status
alter table public.crm_broadcast_recipients alter column status set default 'pending'::text;
--@@ 50 default public.crm_broadcasts.created_at
alter table public.crm_broadcasts alter column created_at set default now();
--@@ 50 default public.crm_broadcasts.id
alter table public.crm_broadcasts alter column id set default gen_random_uuid();
--@@ 50 default public.crm_broadcasts.recipient_filters
alter table public.crm_broadcasts alter column recipient_filters set default '{}'::jsonb;
--@@ 50 default public.crm_broadcasts.status
alter table public.crm_broadcasts alter column status set default 'draft'::text;
--@@ 50 default public.crm_broadcasts.updated_at
alter table public.crm_broadcasts alter column updated_at set default now();
--@@ 50 default public.crm_channel_store_links.created_at
alter table public.crm_channel_store_links alter column created_at set default now();
--@@ 50 default public.crm_channel_store_links.id
alter table public.crm_channel_store_links alter column id set default gen_random_uuid();
--@@ 50 default public.crm_channel_store_links.is_active
alter table public.crm_channel_store_links alter column is_active set default true;
--@@ 50 default public.crm_channel_store_links.updated_at
alter table public.crm_channel_store_links alter column updated_at set default now();
--@@ 50 default public.crm_channels.ai_entry_mode
alter table public.crm_channels alter column ai_entry_mode set default 'inherit'::text;
--@@ 50 default public.crm_channels.created_at
alter table public.crm_channels alter column created_at set default now();
--@@ 50 default public.crm_channels.id
alter table public.crm_channels alter column id set default gen_random_uuid();
--@@ 50 default public.crm_channels.is_active
alter table public.crm_channels alter column is_active set default true;
--@@ 50 default public.crm_channels.is_admin_console
alter table public.crm_channels alter column is_admin_console set default false;
--@@ 50 default public.crm_channels.provider
alter table public.crm_channels alter column provider set default 'uazapi'::text;
--@@ 50 default public.crm_channels.uaz_connection_status
alter table public.crm_channels alter column uaz_connection_status set default 'unknown'::text;
--@@ 50 default public.crm_channels.uaz_last_status
alter table public.crm_channels alter column uaz_last_status set default '{}'::jsonb;
--@@ 50 default public.crm_channels.uaz_subdomain
alter table public.crm_channels alter column uaz_subdomain set default 'api'::text;
--@@ 50 default public.crm_channels.updated_at
alter table public.crm_channels alter column updated_at set default now();
--@@ 50 default public.crm_channels.use_for_automation
alter table public.crm_channels alter column use_for_automation set default true;
--@@ 50 default public.crm_channels.use_for_manual
alter table public.crm_channels alter column use_for_manual set default true;
--@@ 50 default public.crm_conversations.ai_enabled
alter table public.crm_conversations alter column ai_enabled set default true;
--@@ 50 default public.crm_conversations.created_at
alter table public.crm_conversations alter column created_at set default now();
--@@ 50 default public.crm_conversations.id
alter table public.crm_conversations alter column id set default gen_random_uuid();
--@@ 50 default public.crm_conversations.is_group
alter table public.crm_conversations alter column is_group set default false;
--@@ 50 default public.crm_conversations.message_count
alter table public.crm_conversations alter column message_count set default 0;
--@@ 50 default public.crm_conversations.status
alter table public.crm_conversations alter column status set default 'open'::text;
--@@ 50 default public.crm_conversations.unread_count
alter table public.crm_conversations alter column unread_count set default 0;
--@@ 50 default public.crm_conversations.updated_at
alter table public.crm_conversations alter column updated_at set default now();
--@@ 50 default public.crm_custom_fields.created_at
alter table public.crm_custom_fields alter column created_at set default now();
--@@ 50 default public.crm_custom_fields.field_type
alter table public.crm_custom_fields alter column field_type set default 'text'::text;
--@@ 50 default public.crm_custom_fields.id
alter table public.crm_custom_fields alter column id set default gen_random_uuid();
--@@ 50 default public.crm_custom_fields.is_active
alter table public.crm_custom_fields alter column is_active set default true;
--@@ 50 default public.crm_custom_fields.is_required
alter table public.crm_custom_fields alter column is_required set default false;
--@@ 50 default public.crm_custom_fields.options
alter table public.crm_custom_fields alter column options set default '{}'::jsonb;
--@@ 50 default public.crm_custom_fields.updated_at
alter table public.crm_custom_fields alter column updated_at set default now();
--@@ 50 default public.crm_dispatch_runtime.metadata
alter table public.crm_dispatch_runtime alter column metadata set default '{}'::jsonb;
--@@ 50 default public.crm_dispatch_runtime.updated_at
alter table public.crm_dispatch_runtime alter column updated_at set default now();
--@@ 50 default public.crm_event_log.created_at
alter table public.crm_event_log alter column created_at set default now();
--@@ 50 default public.crm_event_log.id
alter table public.crm_event_log alter column id set default gen_random_uuid();
--@@ 50 default public.crm_event_log.is_outbound
alter table public.crm_event_log alter column is_outbound set default false;
--@@ 50 default public.crm_event_log.processed
alter table public.crm_event_log alter column processed set default false;
--@@ 50 default public.crm_event_log.retry_count
alter table public.crm_event_log alter column retry_count set default 0;
--@@ 50 default public.crm_event_log.sent
alter table public.crm_event_log alter column sent set default false;
--@@ 50 default public.crm_filter_views.created_at
alter table public.crm_filter_views alter column created_at set default now();
--@@ 50 default public.crm_filter_views.filters_json
alter table public.crm_filter_views alter column filters_json set default '{}'::jsonb;
--@@ 50 default public.crm_filter_views.id
alter table public.crm_filter_views alter column id set default gen_random_uuid();
--@@ 50 default public.crm_filter_views.is_shared
alter table public.crm_filter_views alter column is_shared set default false;
--@@ 50 default public.crm_filter_views.updated_at
alter table public.crm_filter_views alter column updated_at set default now();
--@@ 50 default public.crm_follow_up_tracker.attempt_count
alter table public.crm_follow_up_tracker alter column attempt_count set default 0;
--@@ 50 default public.crm_follow_up_tracker.created_at
alter table public.crm_follow_up_tracker alter column created_at set default now();
--@@ 50 default public.crm_follow_up_tracker.id
alter table public.crm_follow_up_tracker alter column id set default gen_random_uuid();
--@@ 50 default public.crm_follow_up_tracker.is_completed
alter table public.crm_follow_up_tracker alter column is_completed set default false;
--@@ 50 default public.crm_funnel_stages."order"
alter table public.crm_funnel_stages alter column "order" set default 0;
--@@ 50 default public.crm_funnel_stages.color
alter table public.crm_funnel_stages alter column color set default '#64748B'::text;
--@@ 50 default public.crm_funnel_stages.created_at
alter table public.crm_funnel_stages alter column created_at set default now();
--@@ 50 default public.crm_funnel_stages.is_active
alter table public.crm_funnel_stages alter column is_active set default true;
--@@ 50 default public.crm_funnel_stages.is_lost
alter table public.crm_funnel_stages alter column is_lost set default false;
--@@ 50 default public.crm_funnel_stages.is_won
alter table public.crm_funnel_stages alter column is_won set default false;
--@@ 50 default public.crm_funnel_stages.updated_at
alter table public.crm_funnel_stages alter column updated_at set default now();
--@@ 50 default public.crm_funnels.created_at
alter table public.crm_funnels alter column created_at set default now();
--@@ 50 default public.crm_funnels.funnel_type
alter table public.crm_funnels alter column funnel_type set default 'sales'::text;
--@@ 50 default public.crm_funnels.id
alter table public.crm_funnels alter column id set default gen_random_uuid();
--@@ 50 default public.crm_funnels.is_active
alter table public.crm_funnels alter column is_active set default true;
--@@ 50 default public.crm_funnels.is_default
alter table public.crm_funnels alter column is_default set default false;
--@@ 50 default public.crm_funnels.stages
alter table public.crm_funnels alter column stages set default '[]'::jsonb;
--@@ 50 default public.crm_funnels.updated_at
alter table public.crm_funnels alter column updated_at set default now();
--@@ 50 default public.crm_instagram_comment_events.created_at
alter table public.crm_instagram_comment_events alter column created_at set default now();
--@@ 50 default public.crm_instagram_comment_events.direction
alter table public.crm_instagram_comment_events alter column direction set default 'inbound'::text;
--@@ 50 default public.crm_instagram_comment_events.event_type
alter table public.crm_instagram_comment_events alter column event_type set default 'comment'::text;
--@@ 50 default public.crm_instagram_comment_events.id
alter table public.crm_instagram_comment_events alter column id set default gen_random_uuid();
--@@ 50 default public.crm_instagram_comment_events.metadata
alter table public.crm_instagram_comment_events alter column metadata set default '{}'::jsonb;
--@@ 50 default public.crm_instagram_comment_events.status
alter table public.crm_instagram_comment_events alter column status set default 'received'::text;
--@@ 50 default public.crm_instagram_comment_events.updated_at
alter table public.crm_instagram_comment_events alter column updated_at set default now();
--@@ 50 default public.crm_instagram_media_snapshots.created_at
alter table public.crm_instagram_media_snapshots alter column created_at set default now();
--@@ 50 default public.crm_instagram_media_snapshots.id
alter table public.crm_instagram_media_snapshots alter column id set default gen_random_uuid();
--@@ 50 default public.crm_instagram_media_snapshots.metadata
alter table public.crm_instagram_media_snapshots alter column metadata set default '{}'::jsonb;
--@@ 50 default public.crm_instagram_media_snapshots.updated_at
alter table public.crm_instagram_media_snapshots alter column updated_at set default now();
--@@ 50 default public.crm_lead_custom_field_values.created_at
alter table public.crm_lead_custom_field_values alter column created_at set default now();
--@@ 50 default public.crm_lead_custom_field_values.id
alter table public.crm_lead_custom_field_values alter column id set default gen_random_uuid();
--@@ 50 default public.crm_lead_custom_field_values.updated_at
alter table public.crm_lead_custom_field_values alter column updated_at set default now();
--@@ 50 default public.crm_lead_identities.created_at
alter table public.crm_lead_identities alter column created_at set default now();
--@@ 50 default public.crm_lead_identities.id
alter table public.crm_lead_identities alter column id set default gen_random_uuid();
--@@ 50 default public.crm_lead_identities.is_primary
alter table public.crm_lead_identities alter column is_primary set default false;
--@@ 50 default public.crm_lead_identities.metadata
alter table public.crm_lead_identities alter column metadata set default '{}'::jsonb;
--@@ 50 default public.crm_lead_identities.updated_at
alter table public.crm_lead_identities alter column updated_at set default now();
--@@ 50 default public.crm_lead_stage_history.created_at
alter table public.crm_lead_stage_history alter column created_at set default now();
--@@ 50 default public.crm_lead_stage_history.id
alter table public.crm_lead_stage_history alter column id set default gen_random_uuid();
--@@ 50 default public.crm_leads.avatar_lead_updated
alter table public.crm_leads alter column avatar_lead_updated set default false;
--@@ 50 default public.crm_leads.avatar_missing_count
alter table public.crm_leads alter column avatar_missing_count set default 0;
--@@ 50 default public.crm_leads.created_at
alter table public.crm_leads alter column created_at set default now();
--@@ 50 default public.crm_leads.first_contact_at
alter table public.crm_leads alter column first_contact_at set default now();
--@@ 50 default public.crm_leads.funnel_stage
alter table public.crm_leads alter column funnel_stage set default 'new_lead'::text;
--@@ 50 default public.crm_leads.is_customer
alter table public.crm_leads alter column is_customer set default false;
--@@ 50 default public.crm_leads.lifetime_value
alter table public.crm_leads alter column lifetime_value set default 0;
--@@ 50 default public.crm_leads.purchase_count
alter table public.crm_leads alter column purchase_count set default 0;
--@@ 50 default public.crm_leads.sales_stage
alter table public.crm_leads alter column sales_stage set default 'entrada'::text;
--@@ 50 default public.crm_leads.tags
alter table public.crm_leads alter column tags set default '{}'::text[];
--@@ 50 default public.crm_leads.updated_at
alter table public.crm_leads alter column updated_at set default now();
--@@ 50 default public.crm_message_templates.category
alter table public.crm_message_templates alter column category set default 'general'::text;
--@@ 50 default public.crm_message_templates.created_at
alter table public.crm_message_templates alter column created_at set default now();
--@@ 50 default public.crm_message_templates.id
alter table public.crm_message_templates alter column id set default gen_random_uuid();
--@@ 50 default public.crm_message_templates.is_active
alter table public.crm_message_templates alter column is_active set default true;
--@@ 50 default public.crm_message_templates.updated_at
alter table public.crm_message_templates alter column updated_at set default now();
--@@ 50 default public.crm_message_templates.variables
alter table public.crm_message_templates alter column variables set default '{}'::jsonb;
--@@ 50 default public.crm_messages.created_at
alter table public.crm_messages alter column created_at set default now();
--@@ 50 default public.crm_messages.id
alter table public.crm_messages alter column id set default gen_random_uuid();
--@@ 50 default public.crm_messages.status
alter table public.crm_messages alter column status set default 'pending'::text;
--@@ 50 default public.crm_meta_ads_attributions.created_at
alter table public.crm_meta_ads_attributions alter column created_at set default now();
--@@ 50 default public.crm_meta_ads_attributions.detected_at
alter table public.crm_meta_ads_attributions alter column detected_at set default now();
--@@ 50 default public.crm_meta_ads_attributions.id
alter table public.crm_meta_ads_attributions alter column id set default gen_random_uuid();
--@@ 50 default public.crm_meta_ads_attributions.metadata
alter table public.crm_meta_ads_attributions alter column metadata set default '{}'::jsonb;
--@@ 50 default public.crm_meta_ads_attributions.source_app
alter table public.crm_meta_ads_attributions alter column source_app set default 'instagram'::text;
--@@ 50 default public.crm_meta_ads_groups.created_at
alter table public.crm_meta_ads_groups alter column created_at set default now();
--@@ 50 default public.crm_meta_ads_groups.group_key
alter table public.crm_meta_ads_groups alter column group_key set default gen_random_uuid();
--@@ 50 default public.crm_meta_ads_groups.id
alter table public.crm_meta_ads_groups alter column id set default gen_random_uuid();
--@@ 50 default public.crm_meta_ads_groups.metrics
alter table public.crm_meta_ads_groups alter column metrics set default '{}'::jsonb;
--@@ 50 default public.crm_meta_ads_groups.source_app
alter table public.crm_meta_ads_groups alter column source_app set default 'instagram'::text;
--@@ 50 default public.crm_meta_ads_groups.status
alter table public.crm_meta_ads_groups alter column status set default 'pending_review'::text;
--@@ 50 default public.crm_meta_ads_groups.total_attributions
alter table public.crm_meta_ads_groups alter column total_attributions set default 0;
--@@ 50 default public.crm_meta_ads_groups.updated_at
alter table public.crm_meta_ads_groups alter column updated_at set default now();
--@@ 50 default public.crm_public_registration_links.created_at
alter table public.crm_public_registration_links alter column created_at set default now();
--@@ 50 default public.crm_public_registration_links.id
alter table public.crm_public_registration_links alter column id set default gen_random_uuid();
--@@ 50 default public.crm_public_registration_links.is_active
alter table public.crm_public_registration_links alter column is_active set default true;
--@@ 50 default public.crm_public_registration_links.metadata
alter table public.crm_public_registration_links alter column metadata set default '{}'::jsonb;
--@@ 50 default public.crm_public_registration_links.updated_at
alter table public.crm_public_registration_links alter column updated_at set default now();
--@@ 50 default public.crm_scheduled_messages.created_at
alter table public.crm_scheduled_messages alter column created_at set default now();
--@@ 50 default public.crm_scheduled_messages.id
alter table public.crm_scheduled_messages alter column id set default gen_random_uuid();
--@@ 50 default public.crm_scheduled_messages.metadata
alter table public.crm_scheduled_messages alter column metadata set default '{}'::jsonb;
--@@ 50 default public.crm_scheduled_messages.retry_count
alter table public.crm_scheduled_messages alter column retry_count set default 0;
--@@ 50 default public.crm_scheduled_messages.status
alter table public.crm_scheduled_messages alter column status set default 'pending'::text;
--@@ 50 default public.crm_scheduled_messages.updated_at
alter table public.crm_scheduled_messages alter column updated_at set default now();
--@@ 50 default public.crm_settings.id
alter table public.crm_settings alter column id set default 'centralized_service'::text;
--@@ 50 default public.crm_settings.updated_at
alter table public.crm_settings alter column updated_at set default now();
--@@ 50 default public.crm_settings.value_bool
alter table public.crm_settings alter column value_bool set default false;
--@@ 50 default public.crm_uaz_avatar_jobs.attempts
alter table public.crm_uaz_avatar_jobs alter column attempts set default 0;
--@@ 50 default public.crm_uaz_avatar_jobs.available_at
alter table public.crm_uaz_avatar_jobs alter column available_at set default now();
--@@ 50 default public.crm_uaz_avatar_jobs.created_at
alter table public.crm_uaz_avatar_jobs alter column created_at set default now();
--@@ 50 default public.crm_uaz_avatar_jobs.force_refresh
alter table public.crm_uaz_avatar_jobs alter column force_refresh set default false;
--@@ 50 default public.crm_uaz_avatar_jobs.id
alter table public.crm_uaz_avatar_jobs alter column id set default gen_random_uuid();
--@@ 50 default public.crm_uaz_avatar_jobs.status
alter table public.crm_uaz_avatar_jobs alter column status set default 'pending'::text;
--@@ 50 default public.crm_uaz_avatar_jobs.updated_at
alter table public.crm_uaz_avatar_jobs alter column updated_at set default now();
--@@ 50 default public.crm_ui_preferences.created_at
alter table public.crm_ui_preferences alter column created_at set default now();
--@@ 50 default public.crm_ui_preferences.density
alter table public.crm_ui_preferences alter column density set default 'comfortable'::text;
--@@ 50 default public.crm_ui_preferences.id
alter table public.crm_ui_preferences alter column id set default gen_random_uuid();
--@@ 50 default public.crm_ui_preferences.saved_filters
alter table public.crm_ui_preferences alter column saved_filters set default '{}'::jsonb;
--@@ 50 default public.crm_ui_preferences.updated_at
alter table public.crm_ui_preferences alter column updated_at set default now();
--@@ 50 default public.crm_utm_config.created_at
alter table public.crm_utm_config alter column created_at set default now();
--@@ 50 default public.crm_utm_config.id
alter table public.crm_utm_config alter column id set default gen_random_uuid();
--@@ 50 default public.crm_utm_config.is_active
alter table public.crm_utm_config alter column is_active set default true;
--@@ 50 default public.crm_utm_config.updated_at
alter table public.crm_utm_config alter column updated_at set default now();
--@@ 50 default public.crm_webhook_subscriptions.created_at
alter table public.crm_webhook_subscriptions alter column created_at set default now();
--@@ 50 default public.crm_webhook_subscriptions.failure_count
alter table public.crm_webhook_subscriptions alter column failure_count set default 0;
--@@ 50 default public.crm_webhook_subscriptions.id
alter table public.crm_webhook_subscriptions alter column id set default gen_random_uuid();
--@@ 50 default public.crm_webhook_subscriptions.is_active
alter table public.crm_webhook_subscriptions alter column is_active set default true;
--@@ 50 default public.crm_webhook_subscriptions.subscribed_events
alter table public.crm_webhook_subscriptions alter column subscribed_events set default '{}'::text[];
--@@ 50 default public.crm_webhook_subscriptions.updated_at
alter table public.crm_webhook_subscriptions alter column updated_at set default now();
--@@ 50 default public.customers.created_at
alter table public.customers alter column created_at set default now();
--@@ 50 default public.customers.purchases
alter table public.customers alter column purchases set default 0;
--@@ 50 default public.customers.total_spent
alter table public.customers alter column total_spent set default 0;
--@@ 50 default public.customers.updated_at
alter table public.customers alter column updated_at set default now();
--@@ 50 default public.debt_payments.created_at
alter table public.debt_payments alter column created_at set default now();
--@@ 50 default public.debt_payments.paid_at
alter table public.debt_payments alter column paid_at set default now();
--@@ 50 default public.debts.created_at
alter table public.debts alter column created_at set default now();
--@@ 50 default public.debts.installments_total
alter table public.debts alter column installments_total set default 1;
--@@ 50 default public.debts.source
alter table public.debts alter column source set default 'manual'::text;
--@@ 50 default public.debts.status
alter table public.debts alter column status set default 'Aberta'::text;
--@@ 50 default public.debts.updated_at
alter table public.debts alter column updated_at set default now();
--@@ 50 default public.device_catalog.color
alter table public.device_catalog alter column color set default ''::text;
--@@ 50 default public.device_catalog.created_at
alter table public.device_catalog alter column created_at set default now();
--@@ 50 default public.device_catalog.created_by
alter table public.device_catalog alter column created_by set default auth.uid();
--@@ 50 default public.device_catalog.updated_at
alter table public.device_catalog alter column updated_at set default now();
--@@ 50 default public.finance_categories.created_at
alter table public.finance_categories alter column created_at set default now();
--@@ 50 default public.finance_categories.is_default
alter table public.finance_categories alter column is_default set default false;
--@@ 50 default public.finance_categories.updated_at
alter table public.finance_categories alter column updated_at set default now();
--@@ 50 default public.lead_state.cadastro_completo
alter table public.lead_state alter column cadastro_completo set default false;
--@@ 50 default public.lead_state.cadastro_solicitado
alter table public.lead_state alter column cadastro_solicitado set default false;
--@@ 50 default public.lead_state.cash_entry_asked
alter table public.lead_state alter column cash_entry_asked set default false;
--@@ 50 default public.lead_state.client_outside_ce
alter table public.lead_state alter column client_outside_ce set default false;
--@@ 50 default public.lead_state.commerce_state
alter table public.lead_state alter column commerce_state set default '{}'::jsonb;
--@@ 50 default public.lead_state.created_at
alter table public.lead_state alter column created_at set default now();
--@@ 50 default public.lead_state.cross_city_situation
alter table public.lead_state alter column cross_city_situation set default false;
--@@ 50 default public.lead_state.has_tradein
alter table public.lead_state alter column has_tradein set default false;
--@@ 50 default public.lead_state.hdi_city_needed
alter table public.lead_state alter column hdi_city_needed set default false;
--@@ 50 default public.lead_state.pix_data_sent
alter table public.lead_state alter column pix_data_sent set default false;
--@@ 50 default public.lead_state.pix_paid
alter table public.lead_state alter column pix_paid set default false;
--@@ 50 default public.lead_state.proposal_accepted
alter table public.lead_state alter column proposal_accepted set default false;
--@@ 50 default public.lead_state.quote_versions
alter table public.lead_state alter column quote_versions set default '[]'::jsonb;
--@@ 50 default public.lead_state.reservation_intent
alter table public.lead_state alter column reservation_intent set default false;
--@@ 50 default public.lead_state.simulation_count
alter table public.lead_state alter column simulation_count set default 0;
--@@ 50 default public.lead_state.simulation_done
alter table public.lead_state alter column simulation_done set default false;
--@@ 50 default public.lead_state.state_version
alter table public.lead_state alter column state_version set default 0;
--@@ 50 default public.lead_state.tradein_asked
alter table public.lead_state alter column tradein_asked set default false;
--@@ 50 default public.lead_state.tradein_assessment
alter table public.lead_state alter column tradein_assessment set default '{}'::jsonb;
--@@ 50 default public.lead_state.tradein_battery_suspect
alter table public.lead_state alter column tradein_battery_suspect set default false;
--@@ 50 default public.lead_state.tradein_disqualified
alter table public.lead_state alter column tradein_disqualified set default false;
--@@ 50 default public.lead_state.updated_at
alter table public.lead_state alter column updated_at set default now();
--@@ 50 default public.parts_inventory.created_at
alter table public.parts_inventory alter column created_at set default now();
--@@ 50 default public.parts_inventory.updated_at
alter table public.parts_inventory alter column updated_at set default now();
--@@ 50 default public.payable_debt_payments.created_at
alter table public.payable_debt_payments alter column created_at set default now();
--@@ 50 default public.payable_debt_payments.paid_at
alter table public.payable_debt_payments alter column paid_at set default now();
--@@ 50 default public.payable_debts.created_at
alter table public.payable_debts alter column created_at set default now();
--@@ 50 default public.payable_debts.installments_total
alter table public.payable_debts alter column installments_total set default 1;
--@@ 50 default public.payable_debts.source
alter table public.payable_debts alter column source set default 'manual'::text;
--@@ 50 default public.payable_debts.status
alter table public.payable_debts alter column status set default 'Aberta'::text;
--@@ 50 default public.payable_debts.updated_at
alter table public.payable_debts alter column updated_at set default now();
--@@ 50 default public.payment_methods.created_at
alter table public.payment_methods alter column created_at set default now();
--@@ 50 default public.push_subscriptions.created_at
alter table public.push_subscriptions alter column created_at set default now();
--@@ 50 default public.push_subscriptions.id
alter table public.push_subscriptions alter column id set default gen_random_uuid();
--@@ 50 default public.push_subscriptions.is_active
alter table public.push_subscriptions alter column is_active set default true;
--@@ 50 default public.push_subscriptions.last_seen_at
alter table public.push_subscriptions alter column last_seen_at set default now();
--@@ 50 default public.push_subscriptions.product
alter table public.push_subscriptions alter column product set default 'erp'::text;
--@@ 50 default public.push_subscriptions.topics
alter table public.push_subscriptions alter column topics set default '{crm_inbox,new_lead,sale}'::text[];
--@@ 50 default public.reservation_message_settings.created_at
alter table public.reservation_message_settings alter column created_at set default now();
--@@ 50 default public.reservation_message_settings.id
alter table public.reservation_message_settings alter column id set default 'default'::text;
--@@ 50 default public.reservation_message_settings.send_by_default
alter table public.reservation_message_settings alter column send_by_default set default true;
--@@ 50 default public.reservation_message_settings.template
alter table public.reservation_message_settings alter column template set default ''::text;
--@@ 50 default public.reservation_message_settings.updated_at
alter table public.reservation_message_settings alter column updated_at set default now();
--@@ 50 default public.sale_items.created_at
alter table public.sale_items alter column created_at set default now();
--@@ 50 default public.sale_trade_in_items.created_at
alter table public.sale_trade_in_items alter column created_at set default now();
--@@ 50 default public.sale_trade_in_items.received_value
alter table public.sale_trade_in_items alter column received_value set default 0;
--@@ 50 default public.sale_trade_in_items.updated_at
alter table public.sale_trade_in_items alter column updated_at set default now();
--@@ 50 default public.sales.commission
alter table public.sales alter column commission set default 0;
--@@ 50 default public.sales.created_at
alter table public.sales alter column created_at set default now();
--@@ 50 default public.sales.date
alter table public.sales alter column date set default now();
--@@ 50 default public.sales.discount
alter table public.sales alter column discount set default 0;
--@@ 50 default public.sales.negotiated_subtotal
alter table public.sales alter column negotiated_subtotal set default 0;
--@@ 50 default public.sales.original_subtotal
alter table public.sales alter column original_subtotal set default 0;
--@@ 50 default public.sales.sale_number
alter table public.sales alter column sale_number set default nextval('sales_sale_number_seq'::regclass);
--@@ 50 default public.sales.total
alter table public.sales alter column total set default 0;
--@@ 50 default public.sales.trade_in_value
alter table public.sales alter column trade_in_value set default 0;
--@@ 50 default public.sales.updated_at
alter table public.sales alter column updated_at set default now();
--@@ 50 default public.sellers.created_at
alter table public.sellers alter column created_at set default now();
--@@ 50 default public.sellers.total_sales
alter table public.sellers alter column total_sales set default 0;
--@@ 50 default public.sellers.updated_at
alter table public.sellers alter column updated_at set default now();
--@@ 50 default public.simulator_trade_in_adjustments.created_at
alter table public.simulator_trade_in_adjustments alter column created_at set default now();
--@@ 50 default public.simulator_trade_in_adjustments.id
alter table public.simulator_trade_in_adjustments alter column id set default gen_random_uuid();
--@@ 50 default public.simulator_trade_in_adjustments.is_active
alter table public.simulator_trade_in_adjustments alter column is_active set default true;
--@@ 50 default public.simulator_trade_in_adjustments.updated_at
alter table public.simulator_trade_in_adjustments alter column updated_at set default now();
--@@ 50 default public.simulator_trade_in_values.created_at
alter table public.simulator_trade_in_values alter column created_at set default now();
--@@ 50 default public.simulator_trade_in_values.id
alter table public.simulator_trade_in_values alter column id set default gen_random_uuid();
--@@ 50 default public.simulator_trade_in_values.is_active
alter table public.simulator_trade_in_values alter column is_active set default true;
--@@ 50 default public.simulator_trade_in_values.updated_at
alter table public.simulator_trade_in_values alter column updated_at set default now();
--@@ 50 default public.stock_items.created_at
alter table public.stock_items alter column created_at set default now();
--@@ 50 default public.stock_items.entry_date
alter table public.stock_items alter column entry_date set default now();
--@@ 50 default public.stock_items.has_box
alter table public.stock_items alter column has_box set default false;
--@@ 50 default public.stock_items.max_discount
alter table public.stock_items alter column max_discount set default 0;
--@@ 50 default public.stock_items.photos
alter table public.stock_items alter column photos set default '{}'::text[];
--@@ 50 default public.stock_items.purchase_price
alter table public.stock_items alter column purchase_price set default 0;
--@@ 50 default public.stock_items.sell_price
alter table public.stock_items alter column sell_price set default 0;
--@@ 50 default public.stock_items.status
alter table public.stock_items alter column status set default 'Disponível'::text;
--@@ 50 default public.stock_items.updated_at
alter table public.stock_items alter column updated_at set default now();
--@@ 50 default public.stock_items.warranty_type
alter table public.stock_items alter column warranty_type set default 'Loja'::text;
--@@ 50 default public.stock_reservations.created_at
alter table public.stock_reservations alter column created_at set default now();
--@@ 50 default public.stock_reservations.reserved_at
alter table public.stock_reservations alter column reserved_at set default now();
--@@ 50 default public.stock_reservations.status
alter table public.stock_reservations alter column status set default 'active'::text;
--@@ 50 default public.stock_reservations.updated_at
alter table public.stock_reservations alter column updated_at set default now();
--@@ 50 default public.stores.created_at
alter table public.stores alter column created_at set default now();
--@@ 50 default public.stores.updated_at
alter table public.stores alter column updated_at set default now();
--@@ 50 default public.transactions.amount
alter table public.transactions alter column amount set default 0;
--@@ 50 default public.transactions.created_at
alter table public.transactions alter column created_at set default now();
--@@ 50 default public.transactions.date
alter table public.transactions alter column date set default now();
--@@ 50 default public.transactions.updated_at
alter table public.transactions alter column updated_at set default now();
--@@ 50 default public.user_access_roles.created_at
alter table public.user_access_roles alter column created_at set default now();
--@@ 50 default public.user_access_roles.updated_at
alter table public.user_access_roles alter column updated_at set default now();
--@@ 50 default public.user_consents.granted_at
alter table public.user_consents alter column granted_at set default now();
--@@ 50 default public.user_consents.id
alter table public.user_consents alter column id set default gen_random_uuid();
--@@ 50 default public.user_profiles.created_at
alter table public.user_profiles alter column created_at set default now();
--@@ 50 default public.user_profiles.updated_at
alter table public.user_profiles alter column updated_at set default now();
--@@ 50 default public.warranty_public_tokens.created_at
alter table public.warranty_public_tokens alter column created_at set default now();
--@@ 50 default public.warranty_public_tokens.id
alter table public.warranty_public_tokens alter column id set default gen_random_uuid();
--@@ 51 sequencia-dona public.app_user_activity_logs_id_seq
alter sequence public.app_user_activity_logs_id_seq owned by public.app_user_activity_logs.id;
--@@ 51 sequencia-dona public.sales_sale_number_seq
alter sequence public.sales_sale_number_seq owned by public.sales.sale_number;
--@@ 55 restricao public.account_deletion_requests.account_deletion_requests_pkey
alter table public.account_deletion_requests add constraint account_deletion_requests_pkey PRIMARY KEY (id);
--@@ 55 restricao public.account_deletion_requests.account_deletion_requests_user
alter table public.account_deletion_requests add constraint account_deletion_requests_user_id_key UNIQUE (user_id);
--@@ 55 restricao public.admin_agent_audit_log.admin_agent_audit_log_pkey
alter table public.admin_agent_audit_log add constraint admin_agent_audit_log_pkey PRIMARY KEY (id);
--@@ 55 restricao public.admin_agent_audit_log.admin_agent_audit_log_status_check
alter table public.admin_agent_audit_log add constraint admin_agent_audit_log_status_check CHECK ((status = ANY (ARRAY['ok'::text, 'error'::text, 'denied'::text])));
--@@ 55 restricao public.admin_agent_numbers.admin_agent_numbers_phone_key
alter table public.admin_agent_numbers add constraint admin_agent_numbers_phone_key UNIQUE (phone);
--@@ 55 restricao public.admin_agent_numbers.admin_agent_numbers_pkey
alter table public.admin_agent_numbers add constraint admin_agent_numbers_pkey PRIMARY KEY (id);
--@@ 55 restricao public.admin_agent_pending_actions.admin_agent_pending_actions_
alter table public.admin_agent_pending_actions add constraint admin_agent_pending_actions_pkey PRIMARY KEY (id);
--@@ 55 restricao public.admin_agent_pending_actions.admin_agent_pending_actions_
alter table public.admin_agent_pending_actions add constraint admin_agent_pending_actions_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'confirmed'::text, 'cancelled'::text, 'expired'::text])));
--@@ 55 restricao public.ai_turn_events.ai_turn_events_duration_ms_check
alter table public.ai_turn_events add constraint ai_turn_events_duration_ms_check CHECK (((duration_ms IS NULL) OR (duration_ms >= 0)));
--@@ 55 restricao public.ai_turn_events.ai_turn_events_pkey
alter table public.ai_turn_events add constraint ai_turn_events_pkey PRIMARY KEY (id);
--@@ 55 restricao public.ai_turn_events.ai_turn_events_turn_id_action_key
alter table public.ai_turn_events add constraint ai_turn_events_turn_id_action_key UNIQUE (turn_id, action);
--@@ 55 restricao public.app_role_permissions.app_role_permissions_pkey
alter table public.app_role_permissions add constraint app_role_permissions_pkey PRIMARY KEY (role, permission_key);
--@@ 55 restricao public.app_role_permissions.app_role_permissions_role_check
alter table public.app_role_permissions add constraint app_role_permissions_role_check CHECK ((role = ANY (ARRAY['admin'::text, 'manager'::text, 'seller'::text])));
--@@ 55 restricao public.app_user_activity_logs.app_user_activity_logs_app_role_c
alter table public.app_user_activity_logs add constraint app_user_activity_logs_app_role_check CHECK ((app_role = ANY (ARRAY['admin'::text, 'manager'::text, 'seller'::text])));
--@@ 55 restricao public.app_user_activity_logs.app_user_activity_logs_pkey
alter table public.app_user_activity_logs add constraint app_user_activity_logs_pkey PRIMARY KEY (id);
--@@ 55 restricao public.business_profile.business_profile_pkey
alter table public.business_profile add constraint business_profile_pkey PRIMARY KEY (id);
--@@ 55 restricao public.card_fee_settings.card_fee_settings_debit_rate_check
alter table public.card_fee_settings add constraint card_fee_settings_debit_rate_check CHECK (((debit_rate >= (0)::numeric) AND (debit_rate < (100)::numeric)));
--@@ 55 restricao public.card_fee_settings.card_fee_settings_id_check
alter table public.card_fee_settings add constraint card_fee_settings_id_check CHECK ((id = 'default'::text));
--@@ 55 restricao public.card_fee_settings.card_fee_settings_other_rates_check
alter table public.card_fee_settings add constraint card_fee_settings_other_rates_check CHECK (is_valid_card_fee_rates(other_rates));
--@@ 55 restricao public.card_fee_settings.card_fee_settings_pkey
alter table public.card_fee_settings add constraint card_fee_settings_pkey PRIMARY KEY (id);
--@@ 55 restricao public.card_fee_settings.card_fee_settings_visa_master_rates_ch
alter table public.card_fee_settings add constraint card_fee_settings_visa_master_rates_check CHECK (is_valid_card_fee_rates(visa_master_rates));
--@@ 55 restricao public.cost_history.cost_history_pkey
alter table public.cost_history add constraint cost_history_pkey PRIMARY KEY (id);
--@@ 55 restricao public.costs.costs_part_quantity_check
alter table public.costs add constraint costs_part_quantity_check CHECK (((part_quantity IS NULL) OR (part_quantity > (0)::numeric)));
--@@ 55 restricao public.costs.costs_pkey
alter table public.costs add constraint costs_pkey PRIMARY KEY (id);
--@@ 55 restricao public.creditors.creditors_document_type_check
alter table public.creditors add constraint creditors_document_type_check CHECK ((document_type = ANY (ARRAY['CPF'::text, 'CNPJ'::text])));
--@@ 55 restricao public.creditors.creditors_pkey
alter table public.creditors add constraint creditors_pkey PRIMARY KEY (id);
--@@ 55 restricao public.crm_ai_agent_configs.crm_ai_agent_configs_pkey
alter table public.crm_ai_agent_configs add constraint crm_ai_agent_configs_pkey PRIMARY KEY (id);
--@@ 55 restricao public.crm_ai_agent_invocations.crm_ai_agent_invocations_pkey
alter table public.crm_ai_agent_invocations add constraint crm_ai_agent_invocations_pkey PRIMARY KEY (id);
--@@ 55 restricao public.crm_ai_agent_invocations.crm_ai_agent_invocations_source
alter table public.crm_ai_agent_invocations add constraint crm_ai_agent_invocations_source_check CHECK ((source = ANY (ARRAY['manual_test'::text, 'inbound'::text, 'manual_handoff'::text])));
--@@ 55 restricao public.crm_ai_agent_invocations.crm_ai_agent_invocations_status
alter table public.crm_ai_agent_invocations add constraint crm_ai_agent_invocations_status_check CHECK ((status = ANY (ARRAY['success'::text, 'failure'::text])));
--@@ 55 restricao public.crm_ai_entry_settings.crm_ai_entry_settings_fallback_mod
alter table public.crm_ai_entry_settings add constraint crm_ai_entry_settings_fallback_mode_check CHECK ((fallback_mode = ANY (ARRAY['keep_current'::text, 'force_human'::text, 'force_ai'::text])));
--@@ 55 restricao public.crm_ai_entry_settings.crm_ai_entry_settings_pkey
alter table public.crm_ai_entry_settings add constraint crm_ai_entry_settings_pkey PRIMARY KEY (id);
--@@ 55 restricao public.crm_ai_entry_settings.crm_ai_entry_settings_reopen_hours
alter table public.crm_ai_entry_settings add constraint crm_ai_entry_settings_reopen_hours_check CHECK (((reopen_hours >= 1) AND (reopen_hours <= 720)));
--@@ 55 restricao public.crm_ai_entry_settings.crm_ai_entry_settings_store_id_key
alter table public.crm_ai_entry_settings add constraint crm_ai_entry_settings_store_id_key UNIQUE (store_id);
--@@ 55 restricao public.crm_attendance_scripts.crm_attendance_scripts_pkey
alter table public.crm_attendance_scripts add constraint crm_attendance_scripts_pkey PRIMARY KEY (id);
--@@ 55 restricao public.crm_auth_handoffs.crm_auth_handoffs_code_key
alter table public.crm_auth_handoffs add constraint crm_auth_handoffs_code_key UNIQUE (code);
--@@ 55 restricao public.crm_auth_handoffs.crm_auth_handoffs_pkey
alter table public.crm_auth_handoffs add constraint crm_auth_handoffs_pkey PRIMARY KEY (id);
--@@ 55 restricao public.crm_automation_rules.crm_automation_rules_pkey
alter table public.crm_automation_rules add constraint crm_automation_rules_pkey PRIMARY KEY (id);
--@@ 55 restricao public.crm_broadcast_recipients.crm_broadcast_recipients_broadc
alter table public.crm_broadcast_recipients add constraint crm_broadcast_recipients_broadcast_id_lead_id_key UNIQUE (broadcast_id, lead_id);
--@@ 55 restricao public.crm_broadcast_recipients.crm_broadcast_recipients_pkey
alter table public.crm_broadcast_recipients add constraint crm_broadcast_recipients_pkey PRIMARY KEY (id);
--@@ 55 restricao public.crm_broadcast_recipients.crm_broadcast_recipients_status
alter table public.crm_broadcast_recipients add constraint crm_broadcast_recipients_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'sent'::text, 'failed'::text, 'skipped'::text])));
--@@ 55 restricao public.crm_broadcasts.crm_broadcasts_pkey
alter table public.crm_broadcasts add constraint crm_broadcasts_pkey PRIMARY KEY (id);
--@@ 55 restricao public.crm_broadcasts.crm_broadcasts_status_check
alter table public.crm_broadcasts add constraint crm_broadcasts_status_check CHECK ((status = ANY (ARRAY['draft'::text, 'scheduled'::text, 'processing'::text, 'completed'::text, 'failed'::text, 'canceled'::text])));
--@@ 55 restricao public.crm_channel_store_links.crm_channel_store_links_channel_
alter table public.crm_channel_store_links add constraint crm_channel_store_links_channel_id_store_id_key UNIQUE (channel_id, store_id);
--@@ 55 restricao public.crm_channel_store_links.crm_channel_store_links_pkey
alter table public.crm_channel_store_links add constraint crm_channel_store_links_pkey PRIMARY KEY (id);
--@@ 55 restricao public.crm_channels.chk_crm_channels_ai_entry_mode
alter table public.crm_channels add constraint chk_crm_channels_ai_entry_mode CHECK ((ai_entry_mode = ANY (ARRAY['inherit'::text, 'force_ai'::text, 'force_human'::text])));
--@@ 55 restricao public.crm_channels.crm_channels_pkey
alter table public.crm_channels add constraint crm_channels_pkey PRIMARY KEY (id);
--@@ 55 restricao public.crm_channels.crm_channels_provider_check
alter table public.crm_channels add constraint crm_channels_provider_check CHECK ((provider = ANY (ARRAY['uazapi'::text, 'instagram_official'::text])));
--@@ 55 restricao public.crm_channels.crm_channels_uaz_connection_status_check
alter table public.crm_channels add constraint crm_channels_uaz_connection_status_check CHECK ((uaz_connection_status = ANY (ARRAY['unknown'::text, 'connecting'::text, 'connected'::text, 'disconnected'::text, 'error'::text])));
--@@ 55 restricao public.crm_channels.crm_channels_uaz_subdomain_check
alter table public.crm_channels add constraint crm_channels_uaz_subdomain_check CHECK ((uaz_subdomain ~ '^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$'::text));
--@@ 55 restricao public.crm_conversations.crm_conversations_pkey
alter table public.crm_conversations add constraint crm_conversations_pkey PRIMARY KEY (id);
--@@ 55 restricao public.crm_custom_fields.chk_crm_custom_fields_type
alter table public.crm_custom_fields add constraint chk_crm_custom_fields_type CHECK ((field_type = ANY (ARRAY['text'::text, 'number'::text, 'boolean'::text, 'date'::text, 'select'::text, 'json'::text])));
--@@ 55 restricao public.crm_custom_fields.crm_custom_fields_pkey
alter table public.crm_custom_fields add constraint crm_custom_fields_pkey PRIMARY KEY (id);
--@@ 55 restricao public.crm_custom_fields.crm_custom_fields_store_id_key_key
alter table public.crm_custom_fields add constraint crm_custom_fields_store_id_key_key UNIQUE (store_id, key);
--@@ 55 restricao public.crm_dispatch_runtime.crm_dispatch_runtime_pkey
alter table public.crm_dispatch_runtime add constraint crm_dispatch_runtime_pkey PRIMARY KEY (id);
--@@ 55 restricao public.crm_dispatch_runtime.crm_dispatch_runtime_worker_name_ke
alter table public.crm_dispatch_runtime add constraint crm_dispatch_runtime_worker_name_key UNIQUE (worker_name);
--@@ 55 restricao public.crm_event_log.crm_event_log_pkey
alter table public.crm_event_log add constraint crm_event_log_pkey PRIMARY KEY (id);
--@@ 55 restricao public.crm_filter_views.crm_filter_views_pkey
alter table public.crm_filter_views add constraint crm_filter_views_pkey PRIMARY KEY (id);
--@@ 55 restricao public.crm_follow_up_tracker.crm_follow_up_tracker_pkey
alter table public.crm_follow_up_tracker add constraint crm_follow_up_tracker_pkey PRIMARY KEY (id);
--@@ 55 restricao public.crm_funnel_stages.crm_funnel_stages_pkey
alter table public.crm_funnel_stages add constraint crm_funnel_stages_pkey PRIMARY KEY (id);
--@@ 55 restricao public.crm_funnel_stages.valid_crm_stage_funnel_type
alter table public.crm_funnel_stages add constraint valid_crm_stage_funnel_type CHECK ((funnel_type = ANY (ARRAY['sales'::text, 'post_sale'::text])));
--@@ 55 restricao public.crm_funnels.crm_funnels_pkey
alter table public.crm_funnels add constraint crm_funnels_pkey PRIMARY KEY (id);
--@@ 55 restricao public.crm_funnels.valid_crm_funnel_type
alter table public.crm_funnels add constraint valid_crm_funnel_type CHECK ((funnel_type = ANY (ARRAY['sales'::text, 'post_sale'::text])));
--@@ 55 restricao public.crm_instagram_comment_events.chk_crm_instagram_comment_d
alter table public.crm_instagram_comment_events add constraint chk_crm_instagram_comment_direction CHECK ((direction = ANY (ARRAY['inbound'::text, 'outbound'::text])));
--@@ 55 restricao public.crm_instagram_comment_events.chk_crm_instagram_comment_s
alter table public.crm_instagram_comment_events add constraint chk_crm_instagram_comment_status CHECK ((status = ANY (ARRAY['received'::text, 'queued'::text, 'replied'::text, 'failed'::text])));
--@@ 55 restricao public.crm_instagram_comment_events.crm_instagram_comment_event
alter table public.crm_instagram_comment_events add constraint crm_instagram_comment_events_pkey PRIMARY KEY (id);
--@@ 55 restricao public.crm_instagram_media_snapshots.crm_instagram_media_snapsh
alter table public.crm_instagram_media_snapshots add constraint crm_instagram_media_snapshots_channel_id_media_id_key UNIQUE (channel_id, media_id);
--@@ 55 restricao public.crm_instagram_media_snapshots.crm_instagram_media_snapsh
alter table public.crm_instagram_media_snapshots add constraint crm_instagram_media_snapshots_pkey PRIMARY KEY (id);
--@@ 55 restricao public.crm_lead_custom_field_values.crm_lead_custom_field_value
alter table public.crm_lead_custom_field_values add constraint crm_lead_custom_field_values_lead_id_field_id_key UNIQUE (lead_id, field_id);
--@@ 55 restricao public.crm_lead_custom_field_values.crm_lead_custom_field_value
alter table public.crm_lead_custom_field_values add constraint crm_lead_custom_field_values_pkey PRIMARY KEY (id);
--@@ 55 restricao public.crm_lead_identities.chk_crm_lead_identities_type
alter table public.crm_lead_identities add constraint chk_crm_lead_identities_type CHECK ((identity_type = ANY (ARRAY['phone'::text, 'email'::text, 'instagram_igsid'::text, 'instagram_username'::text])));
--@@ 55 restricao public.crm_lead_identities.crm_lead_identities_pkey
alter table public.crm_lead_identities add constraint crm_lead_identities_pkey PRIMARY KEY (id);
--@@ 55 restricao public.crm_lead_stage_history.crm_lead_stage_history_pkey
alter table public.crm_lead_stage_history add constraint crm_lead_stage_history_pkey PRIMARY KEY (id);
--@@ 55 restricao public.crm_leads.chk_crm_leads_attendance_owner
alter table public.crm_leads add constraint chk_crm_leads_attendance_owner CHECK (((attendance_owner IS NULL) OR (attendance_owner = ANY (ARRAY['ia'::text, 'humano_loja'::text, 'tecnico_especialista'::text]))));
--@@ 55 restricao public.crm_leads.chk_crm_leads_conversation_status
alter table public.crm_leads add constraint chk_crm_leads_conversation_status CHECK (((conversation_status IS NULL) OR (conversation_status = ANY (ARRAY['em_atendimento_ia'::text, 'em_atendimento_humano'::text, 'transferencia_pendente'::text, 'encerrado'::text]))));
--@@ 55 restricao public.crm_leads.chk_crm_leads_last_agent_type
alter table public.crm_leads add constraint chk_crm_leads_last_agent_type CHECK (((last_agent_type IS NULL) OR (last_agent_type = ANY (ARRAY['classifier'::text, 'alana'::text, 'evento'::text, 'humano'::text]))));
--@@ 55 restricao public.crm_leads.chk_crm_leads_sales_stage
alter table public.crm_leads add constraint chk_crm_leads_sales_stage CHECK ((sales_stage = ANY (ARRAY['entrada'::text, 'triagem'::text, 'qualificado'::text, 'cotacao'::text, 'negociacao'::text, 'interesse_confirmado'::text, 'reserva_pendente'::text, 'reservado'::text, 'pagamento_pendente'::text, 'aguardando_retirada'::text, 'ganho'::text, 'perdido'::text])));
--@@ 55 restricao public.crm_leads.crm_leads_avatar_missing_count_nonnegative
alter table public.crm_leads add constraint crm_leads_avatar_missing_count_nonnegative CHECK ((avatar_missing_count >= 0));
--@@ 55 restricao public.crm_leads.crm_leads_pkey
alter table public.crm_leads add constraint crm_leads_pkey PRIMARY KEY (id);
--@@ 55 restricao public.crm_leads.unique_lead_per_store
alter table public.crm_leads add constraint unique_lead_per_store UNIQUE (phone, store_id);
--@@ 55 restricao public.crm_message_templates.crm_message_templates_pkey
alter table public.crm_message_templates add constraint crm_message_templates_pkey PRIMARY KEY (id);
--@@ 55 restricao public.crm_messages.crm_messages_pkey
alter table public.crm_messages add constraint crm_messages_pkey PRIMARY KEY (id);
--@@ 55 restricao public.crm_messages.crm_messages_sender_type_check
alter table public.crm_messages add constraint crm_messages_sender_type_check CHECK ((sender_type = ANY (ARRAY['customer'::text, 'human'::text, 'ai'::text, 'ai_inbound'::text, 'system'::text])));
--@@ 55 restricao public.crm_meta_ads_attributions.chk_crm_meta_ads_attr_source_a
alter table public.crm_meta_ads_attributions add constraint chk_crm_meta_ads_attr_source_app CHECK ((source_app = ANY (ARRAY['instagram'::text, 'facebook'::text])));
--@@ 55 restricao public.crm_meta_ads_attributions.crm_meta_ads_attributions_mess
alter table public.crm_meta_ads_attributions add constraint crm_meta_ads_attributions_message_id_key UNIQUE (message_id);
--@@ 55 restricao public.crm_meta_ads_attributions.crm_meta_ads_attributions_pkey
alter table public.crm_meta_ads_attributions add constraint crm_meta_ads_attributions_pkey PRIMARY KEY (id);
--@@ 55 restricao public.crm_meta_ads_groups.chk_crm_meta_ads_source_app
alter table public.crm_meta_ads_groups add constraint chk_crm_meta_ads_source_app CHECK ((source_app = ANY (ARRAY['instagram'::text, 'facebook'::text])));
--@@ 55 restricao public.crm_meta_ads_groups.chk_crm_meta_ads_status
alter table public.crm_meta_ads_groups add constraint chk_crm_meta_ads_status CHECK ((status = ANY (ARRAY['pending_review'::text, 'approved'::text, 'ignored'::text, 'merged'::text])));
--@@ 55 restricao public.crm_meta_ads_groups.crm_meta_ads_groups_group_key_key
alter table public.crm_meta_ads_groups add constraint crm_meta_ads_groups_group_key_key UNIQUE (group_key);
--@@ 55 restricao public.crm_meta_ads_groups.crm_meta_ads_groups_pkey
alter table public.crm_meta_ads_groups add constraint crm_meta_ads_groups_pkey PRIMARY KEY (id);
--@@ 55 restricao public.crm_meta_ads_groups.crm_meta_ads_groups_store_id_creativ
alter table public.crm_meta_ads_groups add constraint crm_meta_ads_groups_store_id_creative_signature_key UNIQUE (store_id, creative_signature);
--@@ 55 restricao public.crm_public_registration_links.crm_public_registration_li
alter table public.crm_public_registration_links add constraint crm_public_registration_links_pkey PRIMARY KEY (id);
--@@ 55 restricao public.crm_public_registration_links.crm_public_registration_li
alter table public.crm_public_registration_links add constraint crm_public_registration_links_token_key UNIQUE (token);
--@@ 55 restricao public.crm_scheduled_messages.crm_scheduled_messages_pkey
alter table public.crm_scheduled_messages add constraint crm_scheduled_messages_pkey PRIMARY KEY (id);
--@@ 55 restricao public.crm_settings.crm_settings_pkey
alter table public.crm_settings add constraint crm_settings_pkey PRIMARY KEY (id);
--@@ 55 restricao public.crm_uaz_avatar_jobs.crm_uaz_avatar_jobs_attempts_check
alter table public.crm_uaz_avatar_jobs add constraint crm_uaz_avatar_jobs_attempts_check CHECK ((attempts >= 0));
--@@ 55 restricao public.crm_uaz_avatar_jobs.crm_uaz_avatar_jobs_lead_id_key
alter table public.crm_uaz_avatar_jobs add constraint crm_uaz_avatar_jobs_lead_id_key UNIQUE (lead_id);
--@@ 55 restricao public.crm_uaz_avatar_jobs.crm_uaz_avatar_jobs_pkey
alter table public.crm_uaz_avatar_jobs add constraint crm_uaz_avatar_jobs_pkey PRIMARY KEY (id);
--@@ 55 restricao public.crm_uaz_avatar_jobs.crm_uaz_avatar_jobs_status_check
alter table public.crm_uaz_avatar_jobs add constraint crm_uaz_avatar_jobs_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'processing'::text, 'retry'::text, 'completed'::text, 'failed'::text])));
--@@ 55 restricao public.crm_ui_preferences.crm_ui_preferences_density_check
alter table public.crm_ui_preferences add constraint crm_ui_preferences_density_check CHECK ((density = ANY (ARRAY['comfortable'::text, 'compact'::text])));
--@@ 55 restricao public.crm_ui_preferences.crm_ui_preferences_pkey
alter table public.crm_ui_preferences add constraint crm_ui_preferences_pkey PRIMARY KEY (id);
--@@ 55 restricao public.crm_ui_preferences.crm_ui_preferences_store_user_unique
alter table public.crm_ui_preferences add constraint crm_ui_preferences_store_user_unique UNIQUE (store_id, user_id);
--@@ 55 restricao public.crm_utm_config.crm_utm_config_pkey
alter table public.crm_utm_config add constraint crm_utm_config_pkey PRIMARY KEY (id);
--@@ 55 restricao public.crm_utm_config.crm_utm_config_store_id_source_key_campai
alter table public.crm_utm_config add constraint crm_utm_config_store_id_source_key_campaign_key_key UNIQUE (store_id, source_key, campaign_key);
--@@ 55 restricao public.crm_webhook_subscriptions.crm_webhook_subscriptions_pkey
alter table public.crm_webhook_subscriptions add constraint crm_webhook_subscriptions_pkey PRIMARY KEY (id);
--@@ 55 restricao public.customers.customers_birth_date_day_month_check
alter table public.customers add constraint customers_birth_date_day_month_check CHECK (((birth_date IS NULL) OR (birth_date = private.normalize_birth_day_month(birth_date))));
--@@ 55 restricao public.customers.customers_cpf_key
alter table public.customers add constraint customers_cpf_key UNIQUE (cpf);
--@@ 55 restricao public.customers.customers_pkey
alter table public.customers add constraint customers_pkey PRIMARY KEY (id);
--@@ 55 restricao public.debt_payments.debt_payments_account_check
alter table public.debt_payments add constraint debt_payments_account_check CHECK ((account = ANY (ARRAY['Conta Bancária'::text, 'Cofre'::text, 'Devedores'::text])));
--@@ 55 restricao public.debt_payments.debt_payments_amount_check
alter table public.debt_payments add constraint debt_payments_amount_check CHECK ((amount > (0)::numeric));
--@@ 55 restricao public.debt_payments.debt_payments_payment_method_check
alter table public.debt_payments add constraint debt_payments_payment_method_check CHECK ((payment_method = ANY (ARRAY['Pix'::text, 'Dinheiro'::text, 'Cartão'::text, 'Cartão Débito'::text])));
--@@ 55 restricao public.debt_payments.debt_payments_pkey
alter table public.debt_payments add constraint debt_payments_pkey PRIMARY KEY (id);
--@@ 55 restricao public.debts.debts_entry_account_check
alter table public.debts add constraint debts_entry_account_check CHECK ((entry_account = ANY (ARRAY['Conta Bancária'::text, 'Cofre'::text])));
--@@ 55 restricao public.debts.debts_installments_total_check
alter table public.debts add constraint debts_installments_total_check CHECK ((installments_total >= 1));
--@@ 55 restricao public.debts.debts_original_amount_check
alter table public.debts add constraint debts_original_amount_check CHECK ((original_amount > (0)::numeric));
--@@ 55 restricao public.debts.debts_pkey
alter table public.debts add constraint debts_pkey PRIMARY KEY (id);
--@@ 55 restricao public.debts.debts_remaining_amount_check
alter table public.debts add constraint debts_remaining_amount_check CHECK ((remaining_amount >= (0)::numeric));
--@@ 55 restricao public.debts.debts_source_check
alter table public.debts add constraint debts_source_check CHECK ((source = ANY (ARRAY['manual'::text, 'pdv'::text, 'import_anexo'::text])));
--@@ 55 restricao public.debts.debts_status_check
alter table public.debts add constraint debts_status_check CHECK ((status = ANY (ARRAY['Aberta'::text, 'Parcial'::text, 'Quitada'::text])));
--@@ 55 restricao public.device_catalog.device_catalog_model_check
alter table public.device_catalog add constraint device_catalog_model_check CHECK ((char_length(TRIM(BOTH FROM model)) > 0));
--@@ 55 restricao public.device_catalog.device_catalog_pkey
alter table public.device_catalog add constraint device_catalog_pkey PRIMARY KEY (id);
--@@ 55 restricao public.device_catalog.device_catalog_type_check
alter table public.device_catalog add constraint device_catalog_type_check CHECK ((type = ANY (ARRAY['iPhone'::text, 'iPad'::text, 'Macbook'::text, 'Apple Watch'::text, 'Acessório'::text])));
--@@ 55 restricao public.device_catalog.device_catalog_type_model_color_key
alter table public.device_catalog add constraint device_catalog_type_model_color_key UNIQUE (type, model, color);
--@@ 55 restricao public.finance_categories.finance_categories_pkey
alter table public.finance_categories add constraint finance_categories_pkey PRIMARY KEY (id);
--@@ 55 restricao public.finance_categories.finance_categories_type_check
alter table public.finance_categories add constraint finance_categories_type_check CHECK ((type = ANY (ARRAY['IN'::text, 'OUT'::text])));
--@@ 55 restricao public.lead_state.lead_state_card_brand_check
alter table public.lead_state add constraint lead_state_card_brand_check CHECK (((card_brand IS NULL) OR (card_brand = ANY (ARRAY['visa_master'::text, 'elo'::text, 'amex'::text, 'hipercard'::text]))));
--@@ 55 restricao public.lead_state.lead_state_desired_condition_check
alter table public.lead_state add constraint lead_state_desired_condition_check CHECK (((desired_condition IS NULL) OR (desired_condition = ANY (ARRAY['Novo'::text, 'Seminovo'::text]))));
--@@ 55 restricao public.lead_state.lead_state_interest_type_check
alter table public.lead_state add constraint lead_state_interest_type_check CHECK (((interest_type IS NULL) OR (interest_type = ANY (ARRAY['comprar'::text, 'vender'::text, 'trocar'::text, 'avaliar'::text, 'duvida'::text]))));
--@@ 55 restricao public.lead_state.lead_state_last_simulation_total_check
alter table public.lead_state add constraint lead_state_last_simulation_total_check CHECK (((last_simulation_total IS NULL) OR (last_simulation_total >= (0)::numeric)));
--@@ 55 restricao public.lead_state.lead_state_pix_amount_check
alter table public.lead_state add constraint lead_state_pix_amount_check CHECK (((pix_amount IS NULL) OR (pix_amount >= (0)::numeric)));
--@@ 55 restricao public.lead_state.lead_state_pkey
alter table public.lead_state add constraint lead_state_pkey PRIMARY KEY (lead_id);
--@@ 55 restricao public.lead_state.lead_state_simulation_count_check
alter table public.lead_state add constraint lead_state_simulation_count_check CHECK (((simulation_count >= 0) AND (simulation_count <= 3)));
--@@ 55 restricao public.lead_state.lead_state_tradein_battery_pct_check
alter table public.lead_state add constraint lead_state_tradein_battery_pct_check CHECK (((tradein_battery_pct IS NULL) OR ((tradein_battery_pct >= 0) AND (tradein_battery_pct <= 100))));
--@@ 55 restricao public.lead_state.lead_state_tradein_rejected_reason_check
alter table public.lead_state add constraint lead_state_tradein_rejected_reason_check CHECK (((tradein_rejected_reason IS NULL) OR (tradein_rejected_reason = 'modelo_nao_aceito'::text)));
--@@ 55 restricao public.parts_inventory.parts_inventory_name_check
alter table public.parts_inventory add constraint parts_inventory_name_check CHECK ((char_length(TRIM(BOTH FROM name)) > 0));
--@@ 55 restricao public.parts_inventory.parts_inventory_name_key
alter table public.parts_inventory add constraint parts_inventory_name_key UNIQUE (name);
--@@ 55 restricao public.parts_inventory.parts_inventory_pkey
alter table public.parts_inventory add constraint parts_inventory_pkey PRIMARY KEY (id);
--@@ 55 restricao public.parts_inventory.parts_inventory_quantity_check
alter table public.parts_inventory add constraint parts_inventory_quantity_check CHECK ((quantity >= 0));
--@@ 55 restricao public.parts_inventory.parts_inventory_unit_cost_check
alter table public.parts_inventory add constraint parts_inventory_unit_cost_check CHECK ((unit_cost >= (0)::numeric));
--@@ 55 restricao public.payable_debt_payments.payable_debt_payments_account_chec
alter table public.payable_debt_payments add constraint payable_debt_payments_account_check CHECK ((account = ANY (ARRAY['Conta Bancária'::text, 'Cofre'::text])));
--@@ 55 restricao public.payable_debt_payments.payable_debt_payments_amount_check
alter table public.payable_debt_payments add constraint payable_debt_payments_amount_check CHECK ((amount > (0)::numeric));
--@@ 55 restricao public.payable_debt_payments.payable_debt_payments_payment_meth
alter table public.payable_debt_payments add constraint payable_debt_payments_payment_method_check CHECK ((payment_method = ANY (ARRAY['Pix'::text, 'Dinheiro'::text, 'Cartão'::text, 'Cartão Débito'::text])));
--@@ 55 restricao public.payable_debt_payments.payable_debt_payments_pkey
alter table public.payable_debt_payments add constraint payable_debt_payments_pkey PRIMARY KEY (id);
--@@ 55 restricao public.payable_debts.payable_debts_entry_account_check
alter table public.payable_debts add constraint payable_debts_entry_account_check CHECK ((entry_account = ANY (ARRAY['Conta Bancária'::text, 'Cofre'::text])));
--@@ 55 restricao public.payable_debts.payable_debts_installments_total_check
alter table public.payable_debts add constraint payable_debts_installments_total_check CHECK ((installments_total >= 1));
--@@ 55 restricao public.payable_debts.payable_debts_original_amount_check
alter table public.payable_debts add constraint payable_debts_original_amount_check CHECK ((original_amount > (0)::numeric));
--@@ 55 restricao public.payable_debts.payable_debts_pkey
alter table public.payable_debts add constraint payable_debts_pkey PRIMARY KEY (id);
--@@ 55 restricao public.payable_debts.payable_debts_remaining_amount_check
alter table public.payable_debts add constraint payable_debts_remaining_amount_check CHECK ((remaining_amount >= (0)::numeric));
--@@ 55 restricao public.payable_debts.payable_debts_source_check
alter table public.payable_debts add constraint payable_debts_source_check CHECK ((source = ANY (ARRAY['manual'::text, 'import_anexo'::text, 'pdv'::text])));
--@@ 55 restricao public.payable_debts.payable_debts_status_check
alter table public.payable_debts add constraint payable_debts_status_check CHECK ((status = ANY (ARRAY['Aberta'::text, 'Parcial'::text, 'Quitada'::text])));
--@@ 55 restricao public.payment_methods.payment_methods_account_check
alter table public.payment_methods add constraint payment_methods_account_check CHECK (((account = ANY (ARRAY['Conta Bancária'::text, 'Cofre'::text, 'Devedores'::text])) OR (account IS NULL)));
--@@ 55 restricao public.payment_methods.payment_methods_card_brand_check
alter table public.payment_methods add constraint payment_methods_card_brand_check CHECK (((card_brand = ANY (ARRAY['visa_master'::text, 'outras'::text])) OR (card_brand IS NULL)));
--@@ 55 restricao public.payment_methods.payment_methods_customer_amount_check
alter table public.payment_methods add constraint payment_methods_customer_amount_check CHECK (((customer_amount IS NULL) OR (customer_amount >= (0)::numeric)));
--@@ 55 restricao public.payment_methods.payment_methods_debt_installments_check
alter table public.payment_methods add constraint payment_methods_debt_installments_check CHECK (((debt_installments IS NULL) OR (debt_installments >= 1)));
--@@ 55 restricao public.payment_methods.payment_methods_fee_amount_check
alter table public.payment_methods add constraint payment_methods_fee_amount_check CHECK (((fee_amount IS NULL) OR (fee_amount >= (0)::numeric)));
--@@ 55 restricao public.payment_methods.payment_methods_fee_rate_check
alter table public.payment_methods add constraint payment_methods_fee_rate_check CHECK (((fee_rate IS NULL) OR ((fee_rate >= (0)::numeric) AND (fee_rate < (100)::numeric))));
--@@ 55 restricao public.payment_methods.payment_methods_pkey
alter table public.payment_methods add constraint payment_methods_pkey PRIMARY KEY (id);
--@@ 55 restricao public.payment_methods.payment_methods_source_check
alter table public.payment_methods add constraint payment_methods_source_check CHECK (((source IS NULL) OR (source = ANY (ARRAY['pdv'::text, 'reservation_deposit'::text]))));
--@@ 55 restricao public.payment_methods.payment_methods_type_check
alter table public.payment_methods add constraint payment_methods_type_check CHECK ((type = ANY (ARRAY['Pix'::text, 'Dinheiro'::text, 'Cartão'::text, 'Cartão Débito'::text, 'Devedor'::text])));
--@@ 55 restricao public.push_subscriptions.push_subscriptions_endpoint_key
alter table public.push_subscriptions add constraint push_subscriptions_endpoint_key UNIQUE (endpoint);
--@@ 55 restricao public.push_subscriptions.push_subscriptions_pkey
alter table public.push_subscriptions add constraint push_subscriptions_pkey PRIMARY KEY (id);
--@@ 55 restricao public.push_subscriptions.push_subscriptions_platform_check
alter table public.push_subscriptions add constraint push_subscriptions_platform_check CHECK ((platform = ANY (ARRAY['ios'::text, 'android'::text, 'desktop'::text])));
--@@ 55 restricao public.push_subscriptions.push_subscriptions_product_check
alter table public.push_subscriptions add constraint push_subscriptions_product_check CHECK ((product = ANY (ARRAY['erp'::text, 'crmplus'::text])));
--@@ 55 restricao public.reservation_message_settings.reservation_message_setting
alter table public.reservation_message_settings add constraint reservation_message_settings_id_check CHECK ((id = 'default'::text));
--@@ 55 restricao public.reservation_message_settings.reservation_message_setting
alter table public.reservation_message_settings add constraint reservation_message_settings_pkey PRIMARY KEY (id);
--@@ 55 restricao public.sale_items.sale_items_original_price_check
alter table public.sale_items add constraint sale_items_original_price_check CHECK (((original_price IS NULL) OR (original_price >= (0)::numeric)));
--@@ 55 restricao public.sale_items.sale_items_pkey
alter table public.sale_items add constraint sale_items_pkey PRIMARY KEY (id);
--@@ 55 restricao public.sale_trade_in_items.sale_trade_in_items_pkey
alter table public.sale_trade_in_items add constraint sale_trade_in_items_pkey PRIMARY KEY (id);
--@@ 55 restricao public.sale_trade_in_items.sale_trade_in_items_received_value_c
alter table public.sale_trade_in_items add constraint sale_trade_in_items_received_value_check CHECK ((received_value >= (0)::numeric));
--@@ 55 restricao public.sales.sales_client_payment_mode_check
alter table public.sales add constraint sales_client_payment_mode_check CHECK (((client_payment_mode IS NULL) OR (client_payment_mode = ANY (ARRAY['immediate'::text, 'payable_debt'::text]))));
--@@ 55 restricao public.sales.sales_discount_percent_check
alter table public.sales add constraint sales_discount_percent_check CHECK (((discount_percent IS NULL) OR ((discount_percent >= (0)::numeric) AND (discount_percent <= (100)::numeric))));
--@@ 55 restricao public.sales.sales_discount_type_check
alter table public.sales add constraint sales_discount_type_check CHECK (((discount_type = ANY (ARRAY['amount'::text, 'percent'::text])) OR (discount_type IS NULL)));
--@@ 55 restricao public.sales.sales_negotiated_subtotal_check
alter table public.sales add constraint sales_negotiated_subtotal_check CHECK ((negotiated_subtotal >= (0)::numeric));
--@@ 55 restricao public.sales.sales_original_subtotal_check
alter table public.sales add constraint sales_original_subtotal_check CHECK ((original_subtotal >= (0)::numeric));
--@@ 55 restricao public.sales.sales_pkey
alter table public.sales add constraint sales_pkey PRIMARY KEY (id);
--@@ 55 restricao public.sellers.sellers_auth_user_id_key
alter table public.sellers add constraint sellers_auth_user_id_key UNIQUE (auth_user_id);
--@@ 55 restricao public.sellers.sellers_email_key
alter table public.sellers add constraint sellers_email_key UNIQUE (email);
--@@ 55 restricao public.sellers.sellers_pkey
alter table public.sellers add constraint sellers_pkey PRIMARY KEY (id);
--@@ 55 restricao public.simulator_trade_in_adjustments.simulator_trade_in_adjust
alter table public.simulator_trade_in_adjustments add constraint simulator_trade_in_adjustments_capacity_not_blank CHECK (((capacity IS NULL) OR (btrim(capacity) <> ''::text)));
--@@ 55 restricao public.simulator_trade_in_adjustments.simulator_trade_in_adjust
alter table public.simulator_trade_in_adjustments add constraint simulator_trade_in_adjustments_label_check CHECK ((btrim(label) <> ''::text));
--@@ 55 restricao public.simulator_trade_in_adjustments.simulator_trade_in_adjust
alter table public.simulator_trade_in_adjustments add constraint simulator_trade_in_adjustments_model_not_blank CHECK (((model IS NULL) OR (btrim(model) <> ''::text)));
--@@ 55 restricao public.simulator_trade_in_adjustments.simulator_trade_in_adjust
alter table public.simulator_trade_in_adjustments add constraint simulator_trade_in_adjustments_pkey PRIMARY KEY (id);
--@@ 55 restricao public.simulator_trade_in_values.simulator_trade_in_values_base
alter table public.simulator_trade_in_values add constraint simulator_trade_in_values_base_value_check CHECK ((base_value >= (0)::numeric));
--@@ 55 restricao public.simulator_trade_in_values.simulator_trade_in_values_capa
alter table public.simulator_trade_in_values add constraint simulator_trade_in_values_capacity_check CHECK ((btrim(capacity) <> ''::text));
--@@ 55 restricao public.simulator_trade_in_values.simulator_trade_in_values_mode
alter table public.simulator_trade_in_values add constraint simulator_trade_in_values_model_check CHECK ((btrim(model) <> ''::text));
--@@ 55 restricao public.simulator_trade_in_values.simulator_trade_in_values_pkey
alter table public.simulator_trade_in_values add constraint simulator_trade_in_values_pkey PRIMARY KEY (id);
--@@ 55 restricao public.stock_items.stock_items_pkey
alter table public.stock_items add constraint stock_items_pkey PRIMARY KEY (id);
--@@ 55 restricao public.stock_reservations.stock_reservations_deposit_amount_che
alter table public.stock_reservations add constraint stock_reservations_deposit_amount_check CHECK (((deposit_amount IS NULL) OR (deposit_amount >= (0)::numeric)));
--@@ 55 restricao public.stock_reservations.stock_reservations_pkey
alter table public.stock_reservations add constraint stock_reservations_pkey PRIMARY KEY (id);
--@@ 55 restricao public.stock_reservations.stock_reservations_status_check
alter table public.stock_reservations add constraint stock_reservations_status_check CHECK ((status = ANY (ARRAY['active'::text, 'released'::text, 'sold'::text])));
--@@ 55 restricao public.stores.stores_pkey
alter table public.stores add constraint stores_pkey PRIMARY KEY (id);
--@@ 55 restricao public.transactions.transactions_account_check
alter table public.transactions add constraint transactions_account_check CHECK ((account = ANY (ARRAY['Conta Bancária'::text, 'Cofre'::text, 'Devedores'::text])));
--@@ 55 restricao public.transactions.transactions_pkey
alter table public.transactions add constraint transactions_pkey PRIMARY KEY (id);
--@@ 55 restricao public.user_access_roles.user_access_roles_app_role_check
alter table public.user_access_roles add constraint user_access_roles_app_role_check CHECK ((app_role = ANY (ARRAY['admin'::text, 'manager'::text, 'seller'::text])));
--@@ 55 restricao public.user_access_roles.user_access_roles_pkey
alter table public.user_access_roles add constraint user_access_roles_pkey PRIMARY KEY (user_id);
--@@ 55 restricao public.user_consents.user_consents_pkey
alter table public.user_consents add constraint user_consents_pkey PRIMARY KEY (id);
--@@ 55 restricao public.user_consents.user_consents_user_key
alter table public.user_consents add constraint user_consents_user_key UNIQUE (user_id, consent_key, policy_version);
--@@ 55 restricao public.user_profiles.user_profiles_pkey
alter table public.user_profiles add constraint user_profiles_pkey PRIMARY KEY (id);
--@@ 55 restricao public.user_profiles.user_profiles_role_check
alter table public.user_profiles add constraint user_profiles_role_check CHECK ((role = ANY (ARRAY['admin'::text, 'seller'::text])));
--@@ 55 restricao public.user_profiles.user_profiles_seller_id_key
alter table public.user_profiles add constraint user_profiles_seller_id_key UNIQUE (seller_id);
--@@ 55 restricao public.warranty_public_tokens.warranty_public_tokens_pkey
alter table public.warranty_public_tokens add constraint warranty_public_tokens_pkey PRIMARY KEY (id);
--@@ 55 restricao public.warranty_public_tokens.warranty_public_tokens_token_hash
alter table public.warranty_public_tokens add constraint warranty_public_tokens_token_hash_key UNIQUE (token_hash);
--@@ 65 indice public.crm_channels_store_instagram_ig_user_unique
CREATE UNIQUE INDEX crm_channels_store_instagram_ig_user_unique ON public.crm_channels USING btree (store_id, instagram_ig_user_id) WHERE ((provider = 'instagram_official'::text) AND (instagram_ig_user_id IS NOT NULL) AND (btrim(instagram_ig_user_id) <> ''::text));
--@@ 65 indice public.crm_lead_identities_store_type_value_unique
CREATE UNIQUE INDEX crm_lead_identities_store_type_value_unique ON public.crm_lead_identities USING btree (store_id, identity_type, identity_value_normalized);
--@@ 65 indice public.crm_messages_channel_provider_message_unique
CREATE UNIQUE INDEX crm_messages_channel_provider_message_unique ON public.crm_messages USING btree (channel_id, provider_message_id) WHERE (provider_message_id IS NOT NULL);
--@@ 65 indice public.crm_uaz_avatar_jobs_due_idx
CREATE INDEX crm_uaz_avatar_jobs_due_idx ON public.crm_uaz_avatar_jobs USING btree (available_at, created_at) WHERE (status = ANY (ARRAY['pending'::text, 'retry'::text]));
--@@ 65 indice public.crm_uaz_avatar_jobs_expired_lease_idx
CREATE INDEX crm_uaz_avatar_jobs_expired_lease_idx ON public.crm_uaz_avatar_jobs USING btree (lease_expires_at) WHERE (status = 'processing'::text);
--@@ 65 indice public.crm_uaz_avatar_jobs_store_idx
CREATE INDEX crm_uaz_avatar_jobs_store_idx ON public.crm_uaz_avatar_jobs USING btree (store_id);
--@@ 65 indice public.customers_cpf_normalized_idx
CREATE INDEX customers_cpf_normalized_idx ON public.customers USING btree (regexp_replace(COALESCE(cpf, ''::text), '\D'::text, ''::text, 'g'::text));
--@@ 65 indice public.deletion_requests_scheduled_idx
CREATE INDEX deletion_requests_scheduled_idx ON public.account_deletion_requests USING btree (scheduled_delete_at) WHERE ((cancelled_at IS NULL) AND (completed_at IS NULL));
--@@ 65 indice public.device_catalog_type_model_idx
CREATE INDEX device_catalog_type_model_idx ON public.device_catalog USING btree (type, model);
--@@ 65 indice public.idx_admin_agent_audit_created
CREATE INDEX idx_admin_agent_audit_created ON public.admin_agent_audit_log USING btree (created_at DESC);
--@@ 65 indice public.idx_admin_agent_numbers_active
CREATE INDEX idx_admin_agent_numbers_active ON public.admin_agent_numbers USING btree (phone) WHERE is_active;
--@@ 65 indice public.idx_admin_agent_pending_phone
CREATE INDEX idx_admin_agent_pending_phone ON public.admin_agent_pending_actions USING btree (phone, status);
--@@ 65 indice public.idx_ai_turn_events_conversation_created
CREATE INDEX idx_ai_turn_events_conversation_created ON public.ai_turn_events USING btree (conversation_id, created_at DESC) WHERE (conversation_id IS NOT NULL);
--@@ 65 indice public.idx_ai_turn_events_lead_created
CREATE INDEX idx_ai_turn_events_lead_created ON public.ai_turn_events USING btree (lead_id, created_at DESC);
--@@ 65 indice public.idx_app_user_activity_logs_category_date
CREATE INDEX idx_app_user_activity_logs_category_date ON public.app_user_activity_logs USING btree (category, occurred_at DESC);
--@@ 65 indice public.idx_app_user_activity_logs_user_date
CREATE INDEX idx_app_user_activity_logs_user_date ON public.app_user_activity_logs USING btree (user_id, occurred_at DESC);
--@@ 65 indice public.idx_costs_part_id
CREATE INDEX idx_costs_part_id ON public.costs USING btree (part_id);
--@@ 65 indice public.idx_costs_stock_item_id
CREATE INDEX idx_costs_stock_item_id ON public.costs USING btree (stock_item_id);
--@@ 65 indice public.idx_creditors_name
CREATE INDEX idx_creditors_name ON public.creditors USING btree (name);
--@@ 65 indice public.idx_crm_ai_agent_configs_store_active
CREATE INDEX idx_crm_ai_agent_configs_store_active ON public.crm_ai_agent_configs USING btree (store_id, is_active);
--@@ 65 indice public.idx_crm_ai_agent_invocations_agent_created
CREATE INDEX idx_crm_ai_agent_invocations_agent_created ON public.crm_ai_agent_invocations USING btree (agent_config_id, created_at DESC);
--@@ 65 indice public.idx_crm_ai_agent_invocations_store_created
CREATE INDEX idx_crm_ai_agent_invocations_store_created ON public.crm_ai_agent_invocations USING btree (store_id, created_at DESC);
--@@ 65 indice public.idx_crm_ai_entry_settings_store_id
CREATE INDEX idx_crm_ai_entry_settings_store_id ON public.crm_ai_entry_settings USING btree (store_id);
--@@ 65 indice public.idx_crm_attendance_scripts_store_active
CREATE INDEX idx_crm_attendance_scripts_store_active ON public.crm_attendance_scripts USING btree (store_id, is_active);
--@@ 65 indice public.idx_crm_auth_handoffs_code_expires
CREATE INDEX idx_crm_auth_handoffs_code_expires ON public.crm_auth_handoffs USING btree (code, expires_at);
--@@ 65 indice public.idx_crm_automation_rules_store_active
CREATE INDEX idx_crm_automation_rules_store_active ON public.crm_automation_rules USING btree (store_id, is_active);
--@@ 65 indice public.idx_crm_broadcast_recipients_status
CREATE INDEX idx_crm_broadcast_recipients_status ON public.crm_broadcast_recipients USING btree (broadcast_id, status);
--@@ 65 indice public.idx_crm_broadcasts_status_schedule
CREATE INDEX idx_crm_broadcasts_status_schedule ON public.crm_broadcasts USING btree (status, scheduled_for);
--@@ 65 indice public.idx_crm_channel_store_links_store_active
CREATE INDEX idx_crm_channel_store_links_store_active ON public.crm_channel_store_links USING btree (store_id, is_active);
--@@ 65 indice public.idx_crm_channels_ai_resume_webhook
CREATE INDEX idx_crm_channels_ai_resume_webhook ON public.crm_channels USING btree (store_id) WHERE ((ai_resume_webhook_url IS NOT NULL) AND (btrim(ai_resume_webhook_url) <> ''::text));
--@@ 65 indice public.idx_crm_channels_provider_store
CREATE INDEX idx_crm_channels_provider_store ON public.crm_channels USING btree (provider, store_id);
--@@ 65 indice public.idx_crm_channels_store_automation_active
CREATE INDEX idx_crm_channels_store_automation_active ON public.crm_channels USING btree (store_id, provider) WHERE ((is_active = true) AND (use_for_automation = true));
--@@ 65 indice public.idx_crm_channels_store_id
CREATE INDEX idx_crm_channels_store_id ON public.crm_channels USING btree (store_id);
--@@ 65 indice public.idx_crm_channels_store_manual_active
CREATE INDEX idx_crm_channels_store_manual_active ON public.crm_channels USING btree (store_id, provider) WHERE ((is_active = true) AND (use_for_manual = true));
--@@ 65 indice public.idx_crm_conversations_channel_last
CREATE INDEX idx_crm_conversations_channel_last ON public.crm_conversations USING btree (channel_id, last_message_at DESC NULLS LAST) WHERE (channel_id IS NOT NULL);
--@@ 65 indice public.idx_crm_conversations_group
CREATE INDEX idx_crm_conversations_group ON public.crm_conversations USING btree (store_id, is_group, last_message_at DESC NULLS LAST) WHERE (is_group = true);
--@@ 65 indice public.idx_crm_conversations_lead
CREATE INDEX idx_crm_conversations_lead ON public.crm_conversations USING btree (lead_id);
--@@ 65 indice public.idx_crm_conversations_store
CREATE INDEX idx_crm_conversations_store ON public.crm_conversations USING btree (store_id);
--@@ 65 indice public.idx_crm_conversations_store_status_last
CREATE INDEX idx_crm_conversations_store_status_last ON public.crm_conversations USING btree (store_id, status, last_message_at DESC NULLS LAST);
--@@ 65 indice public.idx_crm_custom_fields_store_active
CREATE INDEX idx_crm_custom_fields_store_active ON public.crm_custom_fields USING btree (store_id, is_active);
--@@ 65 indice public.idx_crm_custom_values_lead
CREATE INDEX idx_crm_custom_values_lead ON public.crm_lead_custom_field_values USING btree (lead_id);
--@@ 65 indice public.idx_crm_event_log_lead_created
CREATE INDEX idx_crm_event_log_lead_created ON public.crm_event_log USING btree (lead_id, created_at DESC) WHERE (lead_id IS NOT NULL);
--@@ 65 indice public.idx_crm_event_log_pending
CREATE INDEX idx_crm_event_log_pending ON public.crm_event_log USING btree (created_at) WHERE ((is_outbound = true) AND (sent = false));
--@@ 65 indice public.idx_crm_filter_views_shared
CREATE INDEX idx_crm_filter_views_shared ON public.crm_filter_views USING btree (is_shared) WHERE (is_shared = true);
--@@ 65 indice public.idx_crm_filter_views_user
CREATE INDEX idx_crm_filter_views_user ON public.crm_filter_views USING btree (user_id);
--@@ 65 indice public.idx_crm_funnel_stages_type_order
CREATE INDEX idx_crm_funnel_stages_type_order ON public.crm_funnel_stages USING btree (funnel_type, "order");
--@@ 65 indice public.idx_crm_funnels_store
CREATE INDEX idx_crm_funnels_store ON public.crm_funnels USING btree (store_id);
--@@ 65 indice public.idx_crm_funnels_type
CREATE INDEX idx_crm_funnels_type ON public.crm_funnels USING btree (funnel_type);
--@@ 65 indice public.idx_crm_ig_comment_events_store_created
CREATE INDEX idx_crm_ig_comment_events_store_created ON public.crm_instagram_comment_events USING btree (store_id, event_created_at DESC NULLS LAST);
--@@ 65 indice public.idx_crm_lead_identities_lead
CREATE INDEX idx_crm_lead_identities_lead ON public.crm_lead_identities USING btree (lead_id);
--@@ 65 indice public.idx_crm_lead_stage_history_lead
CREATE INDEX idx_crm_lead_stage_history_lead ON public.crm_lead_stage_history USING btree (lead_id, created_at DESC);
--@@ 65 indice public.idx_crm_leads_br_phone_match_key
CREATE INDEX idx_crm_leads_br_phone_match_key ON public.crm_leads USING btree (crm_br_phone_match_key(COALESCE(phone_normalized, phone, id)));
--@@ 65 indice public.idx_crm_leads_is_customer
CREATE INDEX idx_crm_leads_is_customer ON public.crm_leads USING btree (store_id, is_customer);
--@@ 65 indice public.idx_crm_leads_last_event_at
CREATE INDEX idx_crm_leads_last_event_at ON public.crm_leads USING btree (last_event_at DESC NULLS LAST);
--@@ 65 indice public.idx_crm_leads_last_purchase_at
CREATE INDEX idx_crm_leads_last_purchase_at ON public.crm_leads USING btree (last_purchase_at DESC NULLS LAST);
--@@ 65 indice public.idx_crm_leads_phone
CREATE INDEX idx_crm_leads_phone ON public.crm_leads USING btree (phone);
--@@ 65 indice public.idx_crm_leads_source
CREATE INDEX idx_crm_leads_source ON public.crm_leads USING btree (source) WHERE (source IS NOT NULL);
--@@ 65 indice public.idx_crm_leads_source_campaign
CREATE INDEX idx_crm_leads_source_campaign ON public.crm_leads USING btree (source_campaign_id) WHERE (source_campaign_id IS NOT NULL);
--@@ 65 indice public.idx_crm_leads_source_channel_id
CREATE INDEX idx_crm_leads_source_channel_id ON public.crm_leads USING btree (source_channel_id);
--@@ 65 indice public.idx_crm_leads_store
CREATE INDEX idx_crm_leads_store ON public.crm_leads USING btree (store_id);
--@@ 65 indice public.idx_crm_leads_store_phone_normalized
CREATE INDEX idx_crm_leads_store_phone_normalized ON public.crm_leads USING btree (store_id, phone_normalized) WHERE (phone_normalized IS NOT NULL);
--@@ 65 indice public.idx_crm_leads_store_sales_stage
CREATE INDEX idx_crm_leads_store_sales_stage ON public.crm_leads USING btree (store_id, sales_stage);
--@@ 65 indice public.idx_crm_message_templates_store_active
CREATE INDEX idx_crm_message_templates_store_active ON public.crm_message_templates USING btree (store_id, is_active);
--@@ 65 indice public.idx_crm_messages_channel_provider_lookup
CREATE INDEX idx_crm_messages_channel_provider_lookup ON public.crm_messages USING btree (channel_id, provider_message_id) WHERE (provider_message_id IS NOT NULL);
--@@ 65 indice public.idx_crm_messages_content_fts
CREATE INDEX idx_crm_messages_content_fts ON public.crm_messages USING gin (to_tsvector('portuguese'::regconfig, COALESCE(content, ''::text)));
--@@ 65 indice public.idx_crm_messages_conversation
CREATE INDEX idx_crm_messages_conversation ON public.crm_messages USING btree (conversation_id);
--@@ 65 indice public.idx_crm_messages_conversation_created
CREATE INDEX idx_crm_messages_conversation_created ON public.crm_messages USING btree (conversation_id, created_at);
--@@ 65 indice public.idx_crm_messages_lead_outbound_created
CREATE INDEX idx_crm_messages_lead_outbound_created ON public.crm_messages USING btree (lead_id, created_at DESC) WHERE ((direction = 'outbound'::text) AND (sender_type = ANY (ARRAY['human'::text, 'ai'::text, 'ai_inbound'::text])));
--@@ 65 indice public.idx_crm_messages_reaction_provider_target
CREATE INDEX idx_crm_messages_reaction_provider_target ON public.crm_messages USING btree (conversation_id, reaction_target_provider_message_id) WHERE (reaction_target_provider_message_id IS NOT NULL);
--@@ 65 indice public.idx_crm_messages_reply_provider_target
CREATE INDEX idx_crm_messages_reply_provider_target ON public.crm_messages USING btree (conversation_id, reply_to_provider_message_id) WHERE (reply_to_provider_message_id IS NOT NULL);
--@@ 65 indice public.idx_crm_messages_sender_user
CREATE INDEX idx_crm_messages_sender_user ON public.crm_messages USING btree (sender_user_id) WHERE (sender_user_id IS NOT NULL);
--@@ 65 indice public.idx_crm_messages_store_created
CREATE INDEX idx_crm_messages_store_created ON public.crm_messages USING btree (store_id, created_at DESC);
--@@ 65 indice public.idx_crm_meta_ads_attr_store_group
CREATE INDEX idx_crm_meta_ads_attr_store_group ON public.crm_meta_ads_attributions USING btree (store_id, group_key, detected_at DESC);
--@@ 65 indice public.idx_crm_meta_ads_groups_store_status
CREATE INDEX idx_crm_meta_ads_groups_store_status ON public.crm_meta_ads_groups USING btree (store_id, status, last_seen_at DESC NULLS LAST);
--@@ 65 indice public.idx_crm_public_reg_links_store_lead_created
CREATE INDEX idx_crm_public_reg_links_store_lead_created ON public.crm_public_registration_links USING btree (store_id, lead_id, created_at DESC);
--@@ 65 indice public.idx_crm_scheduled_messages_pending
CREATE INDEX idx_crm_scheduled_messages_pending ON public.crm_scheduled_messages USING btree (scheduled_for) WHERE (status = ANY (ARRAY['pending'::text, 'scheduled'::text]));
--@@ 65 indice public.idx_crm_ui_preferences_store_user
CREATE INDEX idx_crm_ui_preferences_store_user ON public.crm_ui_preferences USING btree (store_id, user_id);
--@@ 65 indice public.idx_crm_utm_config_store_active
CREATE INDEX idx_crm_utm_config_store_active ON public.crm_utm_config USING btree (store_id, is_active);
--@@ 65 indice public.idx_crm_webhook_subscriptions_store
CREATE INDEX idx_crm_webhook_subscriptions_store ON public.crm_webhook_subscriptions USING btree (store_id, is_active);
--@@ 65 indice public.idx_debt_payments_debt_id
CREATE INDEX idx_debt_payments_debt_id ON public.debt_payments USING btree (debt_id);
--@@ 65 indice public.idx_debt_payments_paid_at
CREATE INDEX idx_debt_payments_paid_at ON public.debt_payments USING btree (paid_at);
--@@ 65 indice public.idx_debts_customer_id
CREATE INDEX idx_debts_customer_id ON public.debts USING btree (customer_id);
--@@ 65 indice public.idx_debts_due_date
CREATE INDEX idx_debts_due_date ON public.debts USING btree (due_date);
--@@ 65 indice public.idx_debts_sale_id
CREATE INDEX idx_debts_sale_id ON public.debts USING btree (sale_id);
--@@ 65 indice public.idx_debts_status
CREATE INDEX idx_debts_status ON public.debts USING btree (status);
--@@ 65 indice public.idx_lead_state_pickup_datetime
CREATE INDEX idx_lead_state_pickup_datetime ON public.lead_state USING btree (pickup_datetime) WHERE (pickup_datetime IS NOT NULL);
--@@ 65 indice public.idx_lead_state_preferred_city
CREATE INDEX idx_lead_state_preferred_city ON public.lead_state USING btree (preferred_city) WHERE (preferred_city IS NOT NULL);
--@@ 65 indice public.idx_lead_state_stock_item_id
CREATE INDEX idx_lead_state_stock_item_id ON public.lead_state USING btree (stock_item_id) WHERE (stock_item_id IS NOT NULL);
--@@ 65 indice public.idx_payable_debt_payments_debt_id
CREATE INDEX idx_payable_debt_payments_debt_id ON public.payable_debt_payments USING btree (payable_debt_id);
--@@ 65 indice public.idx_payable_debt_payments_paid_at
CREATE INDEX idx_payable_debt_payments_paid_at ON public.payable_debt_payments USING btree (paid_at);
--@@ 65 indice public.idx_payable_debts_creditor_id
CREATE INDEX idx_payable_debts_creditor_id ON public.payable_debts USING btree (creditor_id);
--@@ 65 indice public.idx_payable_debts_due_date
CREATE INDEX idx_payable_debts_due_date ON public.payable_debts USING btree (due_date);
--@@ 65 indice public.idx_payable_debts_sale_id
CREATE INDEX idx_payable_debts_sale_id ON public.payable_debts USING btree (sale_id);
--@@ 65 indice public.idx_payable_debts_status
CREATE INDEX idx_payable_debts_status ON public.payable_debts USING btree (status);
--@@ 65 indice public.idx_payment_methods_reservation_deposit_transaction_id
CREATE INDEX idx_payment_methods_reservation_deposit_transaction_id ON public.payment_methods USING btree (reservation_deposit_transaction_id);
--@@ 65 indice public.idx_payment_methods_reservation_id
CREATE INDEX idx_payment_methods_reservation_id ON public.payment_methods USING btree (reservation_id);
--@@ 65 indice public.idx_payment_methods_sale_id
CREATE INDEX idx_payment_methods_sale_id ON public.payment_methods USING btree (sale_id);
--@@ 65 indice public.idx_sale_items_sale_id
CREATE INDEX idx_sale_items_sale_id ON public.sale_items USING btree (sale_id);
--@@ 65 indice public.idx_sale_items_stock_item_id
CREATE INDEX idx_sale_items_stock_item_id ON public.sale_items USING btree (stock_item_id);
--@@ 65 indice public.idx_sale_trade_in_items_sale_id
CREATE INDEX idx_sale_trade_in_items_sale_id ON public.sale_trade_in_items USING btree (sale_id);
--@@ 65 indice public.idx_sale_trade_in_items_stock_item_id
CREATE INDEX idx_sale_trade_in_items_stock_item_id ON public.sale_trade_in_items USING btree (stock_item_id);
--@@ 65 indice public.idx_sales_crm_lead_id
CREATE INDEX idx_sales_crm_lead_id ON public.sales USING btree (crm_lead_id) WHERE (crm_lead_id IS NOT NULL);
--@@ 65 indice public.idx_sales_customer_id
CREATE INDEX idx_sales_customer_id ON public.sales USING btree (customer_id);
--@@ 65 indice public.idx_sales_customer_store_date
CREATE INDEX idx_sales_customer_store_date ON public.sales USING btree (customer_id, store_id, date DESC NULLS LAST) WHERE (customer_id IS NOT NULL);
--@@ 65 indice public.idx_sales_seller_id
CREATE INDEX idx_sales_seller_id ON public.sales USING btree (seller_id);
--@@ 65 indice public.idx_sales_store_id
CREATE INDEX idx_sales_store_id ON public.sales USING btree (store_id);
--@@ 65 indice public.idx_sales_trade_in_id
CREATE INDEX idx_sales_trade_in_id ON public.sales USING btree (trade_in_id);
--@@ 65 indice public.idx_sellers_store_id
CREATE INDEX idx_sellers_store_id ON public.sellers USING btree (store_id);
--@@ 65 indice public.idx_stock_items_store_id
CREATE INDEX idx_stock_items_store_id ON public.stock_items USING btree (store_id);
--@@ 65 indice public.idx_stock_reservations_deposit_transaction_id
CREATE INDEX idx_stock_reservations_deposit_transaction_id ON public.stock_reservations USING btree (deposit_transaction_id);
--@@ 65 indice public.idx_stock_reservations_expires_at
CREATE INDEX idx_stock_reservations_expires_at ON public.stock_reservations USING btree (expires_at) WHERE ((status = 'active'::text) AND (expires_at IS NOT NULL));
--@@ 65 indice public.idx_stock_reservations_one_active
CREATE UNIQUE INDEX idx_stock_reservations_one_active ON public.stock_reservations USING btree (stock_item_id) WHERE (status = 'active'::text);
--@@ 65 indice public.idx_stock_reservations_seller_id
CREATE INDEX idx_stock_reservations_seller_id ON public.stock_reservations USING btree (seller_id);
--@@ 65 indice public.idx_stock_reservations_sold_sale_id
CREATE INDEX idx_stock_reservations_sold_sale_id ON public.stock_reservations USING btree (sold_sale_id);
--@@ 65 indice public.idx_stock_reservations_stock_item_id
CREATE INDEX idx_stock_reservations_stock_item_id ON public.stock_reservations USING btree (stock_item_id);
--@@ 65 indice public.idx_transactions_date_created_at
CREATE INDEX idx_transactions_date_created_at ON public.transactions USING btree (date DESC, created_at DESC);
--@@ 65 indice public.idx_transactions_debt_id
CREATE INDEX idx_transactions_debt_id ON public.transactions USING btree (debt_id);
--@@ 65 indice public.idx_transactions_debt_payment_id
CREATE INDEX idx_transactions_debt_payment_id ON public.transactions USING btree (debt_payment_id);
--@@ 65 indice public.idx_transactions_payable_debt_id
CREATE INDEX idx_transactions_payable_debt_id ON public.transactions USING btree (payable_debt_id);
--@@ 65 indice public.idx_transactions_payable_debt_payment_id
CREATE INDEX idx_transactions_payable_debt_payment_id ON public.transactions USING btree (payable_debt_payment_id);
--@@ 65 indice public.idx_transactions_sale_id
CREATE INDEX idx_transactions_sale_id ON public.transactions USING btree (sale_id);
--@@ 65 indice public.idx_transactions_transfer_group_id
CREATE INDEX idx_transactions_transfer_group_id ON public.transactions USING btree (transfer_group_id) WHERE (transfer_group_id IS NOT NULL);
--@@ 65 indice public.idx_warranty_public_tokens_expires_at
CREATE INDEX idx_warranty_public_tokens_expires_at ON public.warranty_public_tokens USING btree (expires_at);
--@@ 65 indice public.idx_warranty_public_tokens_sale_id
CREATE INDEX idx_warranty_public_tokens_sale_id ON public.warranty_public_tokens USING btree (sale_id);
--@@ 65 indice public.parts_inventory_name_idx
CREATE INDEX parts_inventory_name_idx ON public.parts_inventory USING btree (name);
--@@ 65 indice public.push_subscriptions_product_active_idx
CREATE INDEX push_subscriptions_product_active_idx ON public.push_subscriptions USING btree (product) WHERE (is_active = true);
--@@ 65 indice public.push_subscriptions_store_active_idx
CREATE INDEX push_subscriptions_store_active_idx ON public.push_subscriptions USING btree (store_id) WHERE (is_active = true);
--@@ 65 indice public.push_subscriptions_store_product_active_idx
CREATE INDEX push_subscriptions_store_product_active_idx ON public.push_subscriptions USING btree (store_id, product) WHERE (is_active = true);
--@@ 65 indice public.push_subscriptions_store_topics_idx
CREATE INDEX push_subscriptions_store_topics_idx ON public.push_subscriptions USING gin (topics) WHERE (is_active = true);
--@@ 65 indice public.push_subscriptions_user_active_idx
CREATE INDEX push_subscriptions_user_active_idx ON public.push_subscriptions USING btree (user_id) WHERE (is_active = true);
--@@ 65 indice public.sales_sale_number_key
CREATE UNIQUE INDEX sales_sale_number_key ON public.sales USING btree (sale_number);
--@@ 65 indice public.simulator_trade_in_adjustments_lookup_idx
CREATE INDEX simulator_trade_in_adjustments_lookup_idx ON public.simulator_trade_in_adjustments USING btree (lower(btrim(COALESCE(model, ''::text))), lower(btrim(COALESCE(capacity, ''::text)))) WHERE is_active;
--@@ 65 indice public.simulator_trade_in_values_active_unique
CREATE UNIQUE INDEX simulator_trade_in_values_active_unique ON public.simulator_trade_in_values USING btree (lower(btrim(model)), lower(btrim(capacity))) WHERE is_active;
--@@ 65 indice public.simulator_trade_in_values_lookup_idx
CREATE INDEX simulator_trade_in_values_lookup_idx ON public.simulator_trade_in_values USING btree (lower(btrim(model)), lower(btrim(capacity)));
--@@ 65 indice public.unique_crm_conversations_store_lead
CREATE UNIQUE INDEX unique_crm_conversations_store_lead ON public.crm_conversations USING btree (store_id, lead_id);
--@@ 65 indice public.unique_crm_funnel_default_per_type
CREATE UNIQUE INDEX unique_crm_funnel_default_per_type ON public.crm_funnels USING btree (store_id, funnel_type) WHERE (is_default = true);
--@@ 65 indice public.unique_lead_per_store_phone
CREATE UNIQUE INDEX unique_lead_per_store_phone ON public.crm_leads USING btree (store_id, phone_normalized) WHERE (phone_normalized IS NOT NULL);
--@@ 65 indice public.user_consents_key_idx
CREATE INDEX user_consents_key_idx ON public.user_consents USING btree (user_id, consent_key);
--@@ 65 indice public.user_consents_user_id_idx
CREATE INDEX user_consents_user_id_idx ON public.user_consents USING btree (user_id);
--@@ 70 fk public.account_deletion_requests.account_deletion_requests_user
alter table public.account_deletion_requests add constraint account_deletion_requests_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
--@@ 70 fk public.admin_agent_audit_log.admin_agent_audit_log_user_id_fkey
alter table public.admin_agent_audit_log add constraint admin_agent_audit_log_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE SET NULL;
--@@ 70 fk public.admin_agent_numbers.admin_agent_numbers_user_id_fkey
alter table public.admin_agent_numbers add constraint admin_agent_numbers_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
--@@ 70 fk public.admin_agent_pending_actions.admin_agent_pending_actions_
alter table public.admin_agent_pending_actions add constraint admin_agent_pending_actions_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
--@@ 70 fk public.ai_turn_events.ai_turn_events_conversation_id_fkey
alter table public.ai_turn_events add constraint ai_turn_events_conversation_id_fkey FOREIGN KEY (conversation_id) REFERENCES crm_conversations(id) ON DELETE SET NULL;
--@@ 70 fk public.ai_turn_events.ai_turn_events_lead_id_fkey
alter table public.ai_turn_events add constraint ai_turn_events_lead_id_fkey FOREIGN KEY (lead_id) REFERENCES crm_leads(id) ON DELETE CASCADE;
--@@ 70 fk public.ai_turn_events.ai_turn_events_store_id_fkey
alter table public.ai_turn_events add constraint ai_turn_events_store_id_fkey FOREIGN KEY (store_id) REFERENCES stores(id) ON DELETE CASCADE;
--@@ 70 fk public.app_user_activity_logs.app_user_activity_logs_user_id_fk
alter table public.app_user_activity_logs add constraint app_user_activity_logs_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
--@@ 70 fk public.costs.costs_part_id_fkey
alter table public.costs add constraint costs_part_id_fkey FOREIGN KEY (part_id) REFERENCES parts_inventory(id) ON DELETE SET NULL;
--@@ 70 fk public.costs.costs_stock_item_id_fkey
alter table public.costs add constraint costs_stock_item_id_fkey FOREIGN KEY (stock_item_id) REFERENCES stock_items(id) ON DELETE CASCADE;
--@@ 70 fk public.crm_ai_agent_configs.crm_ai_agent_configs_store_id_fkey
alter table public.crm_ai_agent_configs add constraint crm_ai_agent_configs_store_id_fkey FOREIGN KEY (store_id) REFERENCES stores(id) ON DELETE CASCADE;
--@@ 70 fk public.crm_ai_agent_invocations.crm_ai_agent_invocations_agent_
alter table public.crm_ai_agent_invocations add constraint crm_ai_agent_invocations_agent_config_id_fkey FOREIGN KEY (agent_config_id) REFERENCES crm_ai_agent_configs(id) ON DELETE SET NULL;
--@@ 70 fk public.crm_ai_agent_invocations.crm_ai_agent_invocations_store_
alter table public.crm_ai_agent_invocations add constraint crm_ai_agent_invocations_store_id_fkey FOREIGN KEY (store_id) REFERENCES stores(id) ON DELETE CASCADE;
--@@ 70 fk public.crm_ai_entry_settings.crm_ai_entry_settings_store_id_fke
alter table public.crm_ai_entry_settings add constraint crm_ai_entry_settings_store_id_fkey FOREIGN KEY (store_id) REFERENCES stores(id) ON DELETE CASCADE;
--@@ 70 fk public.crm_attendance_scripts.crm_attendance_scripts_store_id_f
alter table public.crm_attendance_scripts add constraint crm_attendance_scripts_store_id_fkey FOREIGN KEY (store_id) REFERENCES stores(id) ON DELETE CASCADE;
--@@ 70 fk public.crm_automation_rules.crm_automation_rules_channel_id_fke
alter table public.crm_automation_rules add constraint crm_automation_rules_channel_id_fkey FOREIGN KEY (channel_id) REFERENCES crm_channels(id) ON DELETE SET NULL;
--@@ 70 fk public.crm_automation_rules.crm_automation_rules_store_id_fkey
alter table public.crm_automation_rules add constraint crm_automation_rules_store_id_fkey FOREIGN KEY (store_id) REFERENCES stores(id) ON DELETE CASCADE;
--@@ 70 fk public.crm_broadcast_recipients.crm_broadcast_recipients_broadc
alter table public.crm_broadcast_recipients add constraint crm_broadcast_recipients_broadcast_id_fkey FOREIGN KEY (broadcast_id) REFERENCES crm_broadcasts(id) ON DELETE CASCADE;
--@@ 70 fk public.crm_broadcast_recipients.crm_broadcast_recipients_channe
alter table public.crm_broadcast_recipients add constraint crm_broadcast_recipients_channel_id_fkey FOREIGN KEY (channel_id) REFERENCES crm_channels(id) ON DELETE SET NULL;
--@@ 70 fk public.crm_broadcast_recipients.crm_broadcast_recipients_conver
alter table public.crm_broadcast_recipients add constraint crm_broadcast_recipients_conversation_id_fkey FOREIGN KEY (conversation_id) REFERENCES crm_conversations(id) ON DELETE SET NULL;
--@@ 70 fk public.crm_broadcast_recipients.crm_broadcast_recipients_lead_i
alter table public.crm_broadcast_recipients add constraint crm_broadcast_recipients_lead_id_fkey FOREIGN KEY (lead_id) REFERENCES crm_leads(id) ON DELETE CASCADE;
--@@ 70 fk public.crm_broadcasts.crm_broadcasts_channel_id_fkey
alter table public.crm_broadcasts add constraint crm_broadcasts_channel_id_fkey FOREIGN KEY (channel_id) REFERENCES crm_channels(id) ON DELETE SET NULL;
--@@ 70 fk public.crm_broadcasts.crm_broadcasts_store_id_fkey
alter table public.crm_broadcasts add constraint crm_broadcasts_store_id_fkey FOREIGN KEY (store_id) REFERENCES stores(id) ON DELETE CASCADE;
--@@ 70 fk public.crm_channel_store_links.crm_channel_store_links_channel_
alter table public.crm_channel_store_links add constraint crm_channel_store_links_channel_id_fkey FOREIGN KEY (channel_id) REFERENCES crm_channels(id) ON DELETE CASCADE;
--@@ 70 fk public.crm_channel_store_links.crm_channel_store_links_store_id
alter table public.crm_channel_store_links add constraint crm_channel_store_links_store_id_fkey FOREIGN KEY (store_id) REFERENCES stores(id) ON DELETE CASCADE;
--@@ 70 fk public.crm_channels.crm_channels_inbound_funnel_id_fkey
alter table public.crm_channels add constraint crm_channels_inbound_funnel_id_fkey FOREIGN KEY (inbound_funnel_id) REFERENCES crm_funnels(id) ON DELETE SET NULL;
--@@ 70 fk public.crm_conversations.crm_conversations_channel_id_fkey
alter table public.crm_conversations add constraint crm_conversations_channel_id_fkey FOREIGN KEY (channel_id) REFERENCES crm_channels(id) ON DELETE SET NULL;
--@@ 70 fk public.crm_conversations.crm_conversations_lead_id_fkey
alter table public.crm_conversations add constraint crm_conversations_lead_id_fkey FOREIGN KEY (lead_id) REFERENCES crm_leads(id) ON DELETE CASCADE;
--@@ 70 fk public.crm_custom_fields.crm_custom_fields_store_id_fkey
alter table public.crm_custom_fields add constraint crm_custom_fields_store_id_fkey FOREIGN KEY (store_id) REFERENCES stores(id) ON DELETE CASCADE;
--@@ 70 fk public.crm_event_log.crm_event_log_channel_id_fkey
alter table public.crm_event_log add constraint crm_event_log_channel_id_fkey FOREIGN KEY (channel_id) REFERENCES crm_channels(id) ON DELETE SET NULL;
--@@ 70 fk public.crm_event_log.crm_event_log_conversation_id_fkey
alter table public.crm_event_log add constraint crm_event_log_conversation_id_fkey FOREIGN KEY (conversation_id) REFERENCES crm_conversations(id) ON DELETE SET NULL;
--@@ 70 fk public.crm_event_log.crm_event_log_lead_id_fkey
alter table public.crm_event_log add constraint crm_event_log_lead_id_fkey FOREIGN KEY (lead_id) REFERENCES crm_leads(id) ON DELETE SET NULL;
--@@ 70 fk public.crm_event_log.crm_event_log_subscription_id_fkey
alter table public.crm_event_log add constraint crm_event_log_subscription_id_fkey FOREIGN KEY (subscription_id) REFERENCES crm_webhook_subscriptions(id) ON DELETE SET NULL;
--@@ 70 fk public.crm_filter_views.crm_filter_views_user_id_fkey
alter table public.crm_filter_views add constraint crm_filter_views_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
--@@ 70 fk public.crm_follow_up_tracker.crm_follow_up_tracker_lead_id_fkey
alter table public.crm_follow_up_tracker add constraint crm_follow_up_tracker_lead_id_fkey FOREIGN KEY (lead_id) REFERENCES crm_leads(id) ON DELETE CASCADE;
--@@ 70 fk public.crm_instagram_comment_events.crm_instagram_comment_event
alter table public.crm_instagram_comment_events add constraint crm_instagram_comment_events_channel_id_fkey FOREIGN KEY (channel_id) REFERENCES crm_channels(id) ON DELETE CASCADE;
--@@ 70 fk public.crm_instagram_comment_events.crm_instagram_comment_event
alter table public.crm_instagram_comment_events add constraint crm_instagram_comment_events_conversation_id_fkey FOREIGN KEY (conversation_id) REFERENCES crm_conversations(id) ON DELETE SET NULL;
--@@ 70 fk public.crm_instagram_comment_events.crm_instagram_comment_event
alter table public.crm_instagram_comment_events add constraint crm_instagram_comment_events_lead_id_fkey FOREIGN KEY (lead_id) REFERENCES crm_leads(id) ON DELETE SET NULL;
--@@ 70 fk public.crm_instagram_comment_events.crm_instagram_comment_event
alter table public.crm_instagram_comment_events add constraint crm_instagram_comment_events_source_message_id_fkey FOREIGN KEY (source_message_id) REFERENCES crm_messages(id) ON DELETE SET NULL;
--@@ 70 fk public.crm_instagram_comment_events.crm_instagram_comment_event
alter table public.crm_instagram_comment_events add constraint crm_instagram_comment_events_store_id_fkey FOREIGN KEY (store_id) REFERENCES stores(id) ON DELETE CASCADE;
--@@ 70 fk public.crm_instagram_media_snapshots.crm_instagram_media_snapsh
alter table public.crm_instagram_media_snapshots add constraint crm_instagram_media_snapshots_channel_id_fkey FOREIGN KEY (channel_id) REFERENCES crm_channels(id) ON DELETE CASCADE;
--@@ 70 fk public.crm_instagram_media_snapshots.crm_instagram_media_snapsh
alter table public.crm_instagram_media_snapshots add constraint crm_instagram_media_snapshots_store_id_fkey FOREIGN KEY (store_id) REFERENCES stores(id) ON DELETE CASCADE;
--@@ 70 fk public.crm_lead_custom_field_values.crm_lead_custom_field_value
alter table public.crm_lead_custom_field_values add constraint crm_lead_custom_field_values_field_id_fkey FOREIGN KEY (field_id) REFERENCES crm_custom_fields(id) ON DELETE CASCADE;
--@@ 70 fk public.crm_lead_custom_field_values.crm_lead_custom_field_value
alter table public.crm_lead_custom_field_values add constraint crm_lead_custom_field_values_lead_id_fkey FOREIGN KEY (lead_id) REFERENCES crm_leads(id) ON DELETE CASCADE;
--@@ 70 fk public.crm_lead_custom_field_values.crm_lead_custom_field_value
alter table public.crm_lead_custom_field_values add constraint crm_lead_custom_field_values_store_id_fkey FOREIGN KEY (store_id) REFERENCES stores(id) ON DELETE CASCADE;
--@@ 70 fk public.crm_lead_identities.crm_lead_identities_lead_id_fkey
alter table public.crm_lead_identities add constraint crm_lead_identities_lead_id_fkey FOREIGN KEY (lead_id) REFERENCES crm_leads(id) ON DELETE CASCADE;
--@@ 70 fk public.crm_lead_stage_history.crm_lead_stage_history_lead_id_fk
alter table public.crm_lead_stage_history add constraint crm_lead_stage_history_lead_id_fkey FOREIGN KEY (lead_id) REFERENCES crm_leads(id) ON DELETE CASCADE;
--@@ 70 fk public.crm_leads.crm_leads_source_channel_id_fkey
alter table public.crm_leads add constraint crm_leads_source_channel_id_fkey FOREIGN KEY (source_channel_id) REFERENCES crm_channels(id) ON DELETE SET NULL;
--@@ 70 fk public.crm_message_templates.crm_message_templates_channel_id_f
alter table public.crm_message_templates add constraint crm_message_templates_channel_id_fkey FOREIGN KEY (channel_id) REFERENCES crm_channels(id) ON DELETE SET NULL;
--@@ 70 fk public.crm_message_templates.crm_message_templates_store_id_fke
alter table public.crm_message_templates add constraint crm_message_templates_store_id_fkey FOREIGN KEY (store_id) REFERENCES stores(id) ON DELETE CASCADE;
--@@ 70 fk public.crm_messages.crm_messages_conversation_id_fkey
alter table public.crm_messages add constraint crm_messages_conversation_id_fkey FOREIGN KEY (conversation_id) REFERENCES crm_conversations(id) ON DELETE CASCADE;
--@@ 70 fk public.crm_messages.crm_messages_lead_id_fkey
alter table public.crm_messages add constraint crm_messages_lead_id_fkey FOREIGN KEY (lead_id) REFERENCES crm_leads(id) ON DELETE SET NULL;
--@@ 70 fk public.crm_messages.crm_messages_sender_user_id_fkey
alter table public.crm_messages add constraint crm_messages_sender_user_id_fkey FOREIGN KEY (sender_user_id) REFERENCES auth.users(id) ON DELETE SET NULL;
--@@ 70 fk public.crm_meta_ads_attributions.crm_meta_ads_attributions_grou
alter table public.crm_meta_ads_attributions add constraint crm_meta_ads_attributions_group_key_fkey FOREIGN KEY (group_key) REFERENCES crm_meta_ads_groups(group_key) ON DELETE CASCADE;
--@@ 70 fk public.crm_meta_ads_attributions.crm_meta_ads_attributions_lead
alter table public.crm_meta_ads_attributions add constraint crm_meta_ads_attributions_lead_id_fkey FOREIGN KEY (lead_id) REFERENCES crm_leads(id) ON DELETE SET NULL;
--@@ 70 fk public.crm_meta_ads_attributions.crm_meta_ads_attributions_mess
alter table public.crm_meta_ads_attributions add constraint crm_meta_ads_attributions_message_id_fkey FOREIGN KEY (message_id) REFERENCES crm_messages(id) ON DELETE SET NULL;
--@@ 70 fk public.crm_meta_ads_attributions.crm_meta_ads_attributions_stor
alter table public.crm_meta_ads_attributions add constraint crm_meta_ads_attributions_store_id_fkey FOREIGN KEY (store_id) REFERENCES stores(id) ON DELETE CASCADE;
--@@ 70 fk public.crm_meta_ads_groups.crm_meta_ads_groups_store_id_fkey
alter table public.crm_meta_ads_groups add constraint crm_meta_ads_groups_store_id_fkey FOREIGN KEY (store_id) REFERENCES stores(id) ON DELETE CASCADE;
--@@ 70 fk public.crm_public_registration_links.crm_public_registration_li
alter table public.crm_public_registration_links add constraint crm_public_registration_links_lead_id_fkey FOREIGN KEY (lead_id) REFERENCES crm_leads(id) ON DELETE CASCADE;
--@@ 70 fk public.crm_public_registration_links.crm_public_registration_li
alter table public.crm_public_registration_links add constraint crm_public_registration_links_store_id_fkey FOREIGN KEY (store_id) REFERENCES stores(id) ON DELETE CASCADE;
--@@ 70 fk public.crm_scheduled_messages.crm_scheduled_messages_conversati
alter table public.crm_scheduled_messages add constraint crm_scheduled_messages_conversation_id_fkey FOREIGN KEY (conversation_id) REFERENCES crm_conversations(id) ON DELETE CASCADE;
--@@ 70 fk public.crm_scheduled_messages.crm_scheduled_messages_lead_id_fk
alter table public.crm_scheduled_messages add constraint crm_scheduled_messages_lead_id_fkey FOREIGN KEY (lead_id) REFERENCES crm_leads(id) ON DELETE CASCADE;
--@@ 70 fk public.crm_uaz_avatar_jobs.crm_uaz_avatar_jobs_channel_id_fkey
alter table public.crm_uaz_avatar_jobs add constraint crm_uaz_avatar_jobs_channel_id_fkey FOREIGN KEY (channel_id) REFERENCES crm_channels(id) ON DELETE CASCADE;
--@@ 70 fk public.crm_uaz_avatar_jobs.crm_uaz_avatar_jobs_conversation_id_
alter table public.crm_uaz_avatar_jobs add constraint crm_uaz_avatar_jobs_conversation_id_fkey FOREIGN KEY (conversation_id) REFERENCES crm_conversations(id) ON DELETE SET NULL;
--@@ 70 fk public.crm_uaz_avatar_jobs.crm_uaz_avatar_jobs_lead_id_fkey
alter table public.crm_uaz_avatar_jobs add constraint crm_uaz_avatar_jobs_lead_id_fkey FOREIGN KEY (lead_id) REFERENCES crm_leads(id) ON DELETE CASCADE;
--@@ 70 fk public.crm_uaz_avatar_jobs.crm_uaz_avatar_jobs_store_id_fkey
alter table public.crm_uaz_avatar_jobs add constraint crm_uaz_avatar_jobs_store_id_fkey FOREIGN KEY (store_id) REFERENCES stores(id) ON DELETE CASCADE;
--@@ 70 fk public.crm_utm_config.crm_utm_config_default_channel_id_fkey
alter table public.crm_utm_config add constraint crm_utm_config_default_channel_id_fkey FOREIGN KEY (default_channel_id) REFERENCES crm_channels(id) ON DELETE SET NULL;
--@@ 70 fk public.crm_utm_config.crm_utm_config_store_id_fkey
alter table public.crm_utm_config add constraint crm_utm_config_store_id_fkey FOREIGN KEY (store_id) REFERENCES stores(id) ON DELETE CASCADE;
--@@ 70 fk public.debt_payments.debt_payments_debt_id_fkey
alter table public.debt_payments add constraint debt_payments_debt_id_fkey FOREIGN KEY (debt_id) REFERENCES debts(id) ON DELETE CASCADE;
--@@ 70 fk public.debts.debts_customer_id_fkey
alter table public.debts add constraint debts_customer_id_fkey FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE RESTRICT;
--@@ 70 fk public.debts.debts_sale_id_fkey
alter table public.debts add constraint debts_sale_id_fkey FOREIGN KEY (sale_id) REFERENCES sales(id) ON DELETE SET NULL;
--@@ 70 fk public.device_catalog.device_catalog_created_by_fkey
alter table public.device_catalog add constraint device_catalog_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE SET NULL;
--@@ 70 fk public.lead_state.lead_state_lead_id_fkey
alter table public.lead_state add constraint lead_state_lead_id_fkey FOREIGN KEY (lead_id) REFERENCES crm_leads(id) ON DELETE CASCADE;
--@@ 70 fk public.payable_debt_payments.payable_debt_payments_payable_debt
alter table public.payable_debt_payments add constraint payable_debt_payments_payable_debt_id_fkey FOREIGN KEY (payable_debt_id) REFERENCES payable_debts(id) ON DELETE CASCADE;
--@@ 70 fk public.payable_debts.payable_debts_creditor_id_fkey
alter table public.payable_debts add constraint payable_debts_creditor_id_fkey FOREIGN KEY (creditor_id) REFERENCES creditors(id) ON DELETE RESTRICT;
--@@ 70 fk public.payable_debts.payable_debts_sale_id_fkey
alter table public.payable_debts add constraint payable_debts_sale_id_fkey FOREIGN KEY (sale_id) REFERENCES sales(id) ON DELETE SET NULL;
--@@ 70 fk public.payment_methods.payment_methods_reservation_deposit_tran
alter table public.payment_methods add constraint payment_methods_reservation_deposit_transaction_id_fkey FOREIGN KEY (reservation_deposit_transaction_id) REFERENCES transactions(id) ON DELETE SET NULL;
--@@ 70 fk public.payment_methods.payment_methods_reservation_id_fkey
alter table public.payment_methods add constraint payment_methods_reservation_id_fkey FOREIGN KEY (reservation_id) REFERENCES stock_reservations(id) ON DELETE SET NULL;
--@@ 70 fk public.payment_methods.payment_methods_sale_id_fkey
alter table public.payment_methods add constraint payment_methods_sale_id_fkey FOREIGN KEY (sale_id) REFERENCES sales(id) ON DELETE CASCADE;
--@@ 70 fk public.push_subscriptions.push_subscriptions_store_id_fkey
alter table public.push_subscriptions add constraint push_subscriptions_store_id_fkey FOREIGN KEY (store_id) REFERENCES stores(id) ON DELETE SET NULL;
--@@ 70 fk public.push_subscriptions.push_subscriptions_user_id_fkey
alter table public.push_subscriptions add constraint push_subscriptions_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
--@@ 70 fk public.sale_items.sale_items_sale_id_fkey
alter table public.sale_items add constraint sale_items_sale_id_fkey FOREIGN KEY (sale_id) REFERENCES sales(id) ON DELETE CASCADE;
--@@ 70 fk public.sale_items.sale_items_stock_item_id_fkey
alter table public.sale_items add constraint sale_items_stock_item_id_fkey FOREIGN KEY (stock_item_id) REFERENCES stock_items(id);
--@@ 70 fk public.sale_trade_in_items.sale_trade_in_items_sale_id_fkey
alter table public.sale_trade_in_items add constraint sale_trade_in_items_sale_id_fkey FOREIGN KEY (sale_id) REFERENCES sales(id) ON DELETE CASCADE;
--@@ 70 fk public.sale_trade_in_items.sale_trade_in_items_stock_item_id_fk
alter table public.sale_trade_in_items add constraint sale_trade_in_items_stock_item_id_fkey FOREIGN KEY (stock_item_id) REFERENCES stock_items(id) ON DELETE SET NULL;
--@@ 70 fk public.sales.sales_crm_lead_id_fkey
alter table public.sales add constraint sales_crm_lead_id_fkey FOREIGN KEY (crm_lead_id) REFERENCES crm_leads(id) ON DELETE SET NULL;
--@@ 70 fk public.sales.sales_customer_id_fkey
alter table public.sales add constraint sales_customer_id_fkey FOREIGN KEY (customer_id) REFERENCES customers(id);
--@@ 70 fk public.sales.sales_seller_id_fkey
alter table public.sales add constraint sales_seller_id_fkey FOREIGN KEY (seller_id) REFERENCES sellers(id);
--@@ 70 fk public.sales.sales_store_id_fkey
alter table public.sales add constraint sales_store_id_fkey FOREIGN KEY (store_id) REFERENCES stores(id) ON DELETE SET NULL;
--@@ 70 fk public.sales.sales_trade_in_id_fkey
alter table public.sales add constraint sales_trade_in_id_fkey FOREIGN KEY (trade_in_id) REFERENCES stock_items(id) ON DELETE SET NULL;
--@@ 70 fk public.sellers.sellers_auth_user_id_fkey
alter table public.sellers add constraint sellers_auth_user_id_fkey FOREIGN KEY (auth_user_id) REFERENCES auth.users(id);
--@@ 70 fk public.sellers.sellers_store_id_fkey
alter table public.sellers add constraint sellers_store_id_fkey FOREIGN KEY (store_id) REFERENCES stores(id) ON DELETE SET NULL;
--@@ 70 fk public.stock_items.stock_items_store_id_fkey
alter table public.stock_items add constraint stock_items_store_id_fkey FOREIGN KEY (store_id) REFERENCES stores(id);
--@@ 70 fk public.stock_reservations.stock_reservations_created_by_fkey
alter table public.stock_reservations add constraint stock_reservations_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE SET NULL;
--@@ 70 fk public.stock_reservations.stock_reservations_deposit_refund_tra
alter table public.stock_reservations add constraint stock_reservations_deposit_refund_transaction_id_fkey FOREIGN KEY (deposit_refund_transaction_id) REFERENCES transactions(id) ON DELETE SET NULL;
--@@ 70 fk public.stock_reservations.stock_reservations_deposit_transactio
alter table public.stock_reservations add constraint stock_reservations_deposit_transaction_id_fkey FOREIGN KEY (deposit_transaction_id) REFERENCES transactions(id) ON DELETE SET NULL;
--@@ 70 fk public.stock_reservations.stock_reservations_seller_id_fkey
alter table public.stock_reservations add constraint stock_reservations_seller_id_fkey FOREIGN KEY (seller_id) REFERENCES sellers(id) ON DELETE SET NULL;
--@@ 70 fk public.stock_reservations.stock_reservations_sold_sale_id_fkey
alter table public.stock_reservations add constraint stock_reservations_sold_sale_id_fkey FOREIGN KEY (sold_sale_id) REFERENCES sales(id) ON DELETE SET NULL;
--@@ 70 fk public.stock_reservations.stock_reservations_stock_item_id_fkey
alter table public.stock_reservations add constraint stock_reservations_stock_item_id_fkey FOREIGN KEY (stock_item_id) REFERENCES stock_items(id) ON DELETE CASCADE;
--@@ 70 fk public.transactions.transactions_debt_payment_fk
alter table public.transactions add constraint transactions_debt_payment_fk FOREIGN KEY (debt_payment_id) REFERENCES debt_payments(id) ON DELETE CASCADE;
--@@ 70 fk public.transactions.transactions_payable_debt_payment_fk
alter table public.transactions add constraint transactions_payable_debt_payment_fk FOREIGN KEY (payable_debt_payment_id) REFERENCES payable_debt_payments(id) ON DELETE CASCADE;
--@@ 70 fk public.transactions.transactions_sale_id_fkey
alter table public.transactions add constraint transactions_sale_id_fkey FOREIGN KEY (sale_id) REFERENCES sales(id) ON DELETE SET NULL;
--@@ 70 fk public.user_access_roles.user_access_roles_created_by_fkey
alter table public.user_access_roles add constraint user_access_roles_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE SET NULL;
--@@ 70 fk public.user_access_roles.user_access_roles_user_id_fkey
alter table public.user_access_roles add constraint user_access_roles_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
--@@ 70 fk public.user_consents.user_consents_user_id_fkey
alter table public.user_consents add constraint user_consents_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
--@@ 70 fk public.user_profiles.user_profiles_id_fkey
alter table public.user_profiles add constraint user_profiles_id_fkey FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE;
--@@ 70 fk public.user_profiles.user_profiles_seller_id_fkey
alter table public.user_profiles add constraint user_profiles_seller_id_fkey FOREIGN KEY (seller_id) REFERENCES sellers(id) ON DELETE SET NULL;
--@@ 70 fk public.warranty_public_tokens.warranty_public_tokens_created_by
alter table public.warranty_public_tokens add constraint warranty_public_tokens_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE SET NULL;
--@@ 70 fk public.warranty_public_tokens.warranty_public_tokens_sale_id_fk
alter table public.warranty_public_tokens add constraint warranty_public_tokens_sale_id_fkey FOREIGN KEY (sale_id) REFERENCES sales(id) ON DELETE CASCADE;
--@@ 75 gatilho public.app_role_permissions.trg_app_role_permissions_set_update
CREATE TRIGGER trg_app_role_permissions_set_updated_at BEFORE UPDATE ON public.app_role_permissions FOR EACH ROW EXECUTE FUNCTION app_set_updated_at();
--@@ 75 gatilho public.card_fee_settings.set_card_fee_settings_updated_at
CREATE TRIGGER set_card_fee_settings_updated_at BEFORE UPDATE ON public.card_fee_settings FOR EACH ROW EXECUTE FUNCTION tg_set_card_fee_settings_updated_at();
--@@ 75 gatilho public.creditors.set_creditors_updated_at
CREATE TRIGGER set_creditors_updated_at BEFORE UPDATE ON public.creditors FOR EACH ROW EXECUTE FUNCTION tg_set_creditors_updated_at();
--@@ 75 gatilho public.crm_ai_agent_configs.trg_crm_ai_agent_configs_set_update
CREATE TRIGGER trg_crm_ai_agent_configs_set_updated_at BEFORE UPDATE ON public.crm_ai_agent_configs FOR EACH ROW EXECUTE FUNCTION crm_set_updated_at();
--@@ 75 gatilho public.crm_attendance_scripts.trg_crm_attendance_scripts_set_up
CREATE TRIGGER trg_crm_attendance_scripts_set_updated_at BEFORE UPDATE ON public.crm_attendance_scripts FOR EACH ROW EXECUTE FUNCTION crm_set_updated_at();
--@@ 75 gatilho public.crm_automation_rules.trg_crm_automation_rules_set_update
CREATE TRIGGER trg_crm_automation_rules_set_updated_at BEFORE UPDATE ON public.crm_automation_rules FOR EACH ROW EXECUTE FUNCTION crm_set_updated_at();
--@@ 75 gatilho public.crm_broadcasts.trg_crm_broadcasts_set_updated_at
CREATE TRIGGER trg_crm_broadcasts_set_updated_at BEFORE UPDATE ON public.crm_broadcasts FOR EACH ROW EXECUTE FUNCTION crm_set_updated_at();
--@@ 75 gatilho public.crm_channel_store_links.trg_crm_channel_store_links_set_
CREATE TRIGGER trg_crm_channel_store_links_set_updated_at BEFORE UPDATE ON public.crm_channel_store_links FOR EACH ROW EXECUTE FUNCTION crm_set_updated_at();
--@@ 75 gatilho public.crm_channels.trg_crm_channels_set_updated_at
CREATE TRIGGER trg_crm_channels_set_updated_at BEFORE UPDATE ON public.crm_channels FOR EACH ROW EXECUTE FUNCTION crm_set_updated_at();
--@@ 75 gatilho public.crm_conversations.trg_crm_conversations_set_updated_at
CREATE TRIGGER trg_crm_conversations_set_updated_at BEFORE UPDATE ON public.crm_conversations FOR EACH ROW EXECUTE FUNCTION crm_set_updated_at();
--@@ 75 gatilho public.crm_conversations.trg_crm_conversations_sync_store
CREATE TRIGGER trg_crm_conversations_sync_store BEFORE INSERT OR UPDATE OF lead_id ON public.crm_conversations FOR EACH ROW EXECUTE FUNCTION crm_sync_lead_store_to_related_tables();
--@@ 75 gatilho public.crm_conversations.trg_crm_sync_lead_attendance_from_conv
CREATE TRIGGER trg_crm_sync_lead_attendance_from_conversation AFTER INSERT OR UPDATE OF status, ai_enabled ON public.crm_conversations FOR EACH ROW EXECUTE FUNCTION crm_sync_lead_attendance_from_conversation();
--@@ 75 gatilho public.crm_custom_fields.trg_crm_custom_fields_set_updated_at
CREATE TRIGGER trg_crm_custom_fields_set_updated_at BEFORE UPDATE ON public.crm_custom_fields FOR EACH ROW EXECUTE FUNCTION crm_set_updated_at();
--@@ 75 gatilho public.crm_dispatch_runtime.trg_crm_dispatch_runtime_set_update
CREATE TRIGGER trg_crm_dispatch_runtime_set_updated_at BEFORE UPDATE ON public.crm_dispatch_runtime FOR EACH ROW EXECUTE FUNCTION crm_set_updated_at();
--@@ 75 gatilho public.crm_event_log.trg_crm_event_log_sync_lead_last_event
CREATE TRIGGER trg_crm_event_log_sync_lead_last_event AFTER INSERT ON public.crm_event_log FOR EACH ROW EXECUTE FUNCTION crm_event_log_sync_lead_last_event();
--@@ 75 gatilho public.crm_funnel_stages.trg_crm_funnel_stages_set_updated_at
CREATE TRIGGER trg_crm_funnel_stages_set_updated_at BEFORE UPDATE ON public.crm_funnel_stages FOR EACH ROW EXECUTE FUNCTION crm_set_updated_at();
--@@ 75 gatilho public.crm_funnels.trg_crm_funnels_set_updated_at
CREATE TRIGGER trg_crm_funnels_set_updated_at BEFORE UPDATE ON public.crm_funnels FOR EACH ROW EXECUTE FUNCTION crm_set_updated_at();
--@@ 75 gatilho public.crm_instagram_comment_events.trg_crm_ig_comments_set_upd
CREATE TRIGGER trg_crm_ig_comments_set_updated_at BEFORE UPDATE ON public.crm_instagram_comment_events FOR EACH ROW EXECUTE FUNCTION crm_set_updated_at();
--@@ 75 gatilho public.crm_instagram_media_snapshots.trg_crm_ig_media_set_updat
CREATE TRIGGER trg_crm_ig_media_set_updated_at BEFORE UPDATE ON public.crm_instagram_media_snapshots FOR EACH ROW EXECUTE FUNCTION crm_set_updated_at();
--@@ 75 gatilho public.crm_lead_custom_field_values.trg_crm_custom_values_set_u
CREATE TRIGGER trg_crm_custom_values_set_updated_at BEFORE UPDATE ON public.crm_lead_custom_field_values FOR EACH ROW EXECUTE FUNCTION crm_set_updated_at();
--@@ 75 gatilho public.crm_lead_identities.trg_crm_lead_identities_set_updated_
CREATE TRIGGER trg_crm_lead_identities_set_updated_at BEFORE UPDATE ON public.crm_lead_identities FOR EACH ROW EXECUTE FUNCTION crm_set_updated_at();
--@@ 75 gatilho public.crm_lead_stage_history.trg_crm_stage_history_sync_store
CREATE TRIGGER trg_crm_stage_history_sync_store BEFORE INSERT OR UPDATE OF lead_id ON public.crm_lead_stage_history FOR EACH ROW EXECUTE FUNCTION crm_sync_lead_store_to_related_tables();
--@@ 75 gatilho public.crm_leads.on_lead_created_or_updated
CREATE TRIGGER on_lead_created_or_updated AFTER INSERT OR UPDATE ON public.crm_leads FOR EACH ROW EXECUTE FUNCTION trigger_new_lead_avatar();
--@@ 75 gatilho public.crm_leads.set_composite_lead_id
CREATE TRIGGER set_composite_lead_id BEFORE INSERT ON public.crm_leads FOR EACH ROW EXECUTE FUNCTION generate_composite_lead_id();
--@@ 75 gatilho public.crm_leads.tr_crm_set_default_funnel_fields
CREATE TRIGGER tr_crm_set_default_funnel_fields BEFORE INSERT ON public.crm_leads FOR EACH ROW EXECUTE FUNCTION crm_set_default_funnel_fields();
--@@ 75 gatilho public.crm_leads.trg_crm_attribute_lead_ad
CREATE TRIGGER trg_crm_attribute_lead_ad AFTER INSERT OR UPDATE OF source, source_ad_context, source_campaign_id, source_campaign_title ON public.crm_leads FOR EACH ROW EXECUTE FUNCTION crm_trg_attribute_lead_ad();
--@@ 75 gatilho public.crm_leads.trg_crm_lead_purchase_sync
CREATE TRIGGER trg_crm_lead_purchase_sync AFTER INSERT OR UPDATE OF customer_id, phone ON public.crm_leads FOR EACH ROW EXECUTE FUNCTION crm_lead_purchase_sync_trigger();
--@@ 75 gatilho public.crm_leads.trg_crm_leads_set_updated_at
CREATE TRIGGER trg_crm_leads_set_updated_at BEFORE UPDATE ON public.crm_leads FOR EACH ROW EXECUTE FUNCTION crm_set_updated_at();
--@@ 75 gatilho public.crm_leads.trg_crm_leads_sync_enriched_columns
CREATE TRIGGER trg_crm_leads_sync_enriched_columns BEFORE INSERT OR UPDATE OF name, sales_stage, funnel_stage ON public.crm_leads FOR EACH ROW EXECUTE FUNCTION crm_leads_sync_enriched_columns();
--@@ 75 gatilho public.crm_message_templates.trg_crm_message_templates_set_upda
CREATE TRIGGER trg_crm_message_templates_set_updated_at BEFORE UPDATE ON public.crm_message_templates FOR EACH ROW EXECUTE FUNCTION crm_set_updated_at();
--@@ 75 gatilho public.crm_messages.trg_crm_messages_after_insert
CREATE TRIGGER trg_crm_messages_after_insert AFTER INSERT ON public.crm_messages FOR EACH ROW EXECUTE FUNCTION crm_after_message_insert();
--@@ 75 gatilho public.crm_messages.trg_crm_messages_sync_lead_last_message_con
CREATE TRIGGER trg_crm_messages_sync_lead_last_message_content AFTER INSERT ON public.crm_messages FOR EACH ROW EXECUTE FUNCTION crm_messages_sync_lead_last_message_content();
--@@ 75 gatilho public.crm_messages.trg_crm_messages_sync_store
CREATE TRIGGER trg_crm_messages_sync_store BEFORE INSERT OR UPDATE OF conversation_id ON public.crm_messages FOR EACH ROW EXECUTE FUNCTION crm_sync_lead_store_to_related_tables();
--@@ 75 gatilho public.crm_meta_ads_groups.trg_crm_meta_ads_groups_set_updated_
CREATE TRIGGER trg_crm_meta_ads_groups_set_updated_at BEFORE UPDATE ON public.crm_meta_ads_groups FOR EACH ROW EXECUTE FUNCTION crm_set_updated_at();
--@@ 75 gatilho public.crm_public_registration_links.trg_crm_public_reg_links_s
CREATE TRIGGER trg_crm_public_reg_links_set_updated_at BEFORE UPDATE ON public.crm_public_registration_links FOR EACH ROW EXECUTE FUNCTION crm_set_updated_at();
--@@ 75 gatilho public.crm_scheduled_messages.trg_crm_scheduled_messages_set_up
CREATE TRIGGER trg_crm_scheduled_messages_set_updated_at BEFORE UPDATE ON public.crm_scheduled_messages FOR EACH ROW EXECUTE FUNCTION crm_set_updated_at();
--@@ 75 gatilho public.crm_scheduled_messages.trg_crm_scheduled_sync_store
CREATE TRIGGER trg_crm_scheduled_sync_store BEFORE INSERT OR UPDATE OF lead_id ON public.crm_scheduled_messages FOR EACH ROW EXECUTE FUNCTION crm_sync_lead_store_to_related_tables();
--@@ 75 gatilho public.crm_ui_preferences.crm_ui_preferences_updated_at
CREATE TRIGGER crm_ui_preferences_updated_at BEFORE UPDATE ON public.crm_ui_preferences FOR EACH ROW EXECUTE FUNCTION crm_ui_preferences_set_updated_at();
--@@ 75 gatilho public.crm_ui_preferences.trg_crm_ui_preferences_set_updated_at
CREATE TRIGGER trg_crm_ui_preferences_set_updated_at BEFORE UPDATE ON public.crm_ui_preferences FOR EACH ROW EXECUTE FUNCTION crm_set_updated_at();
--@@ 75 gatilho public.crm_utm_config.trg_crm_utm_config_set_updated_at
CREATE TRIGGER trg_crm_utm_config_set_updated_at BEFORE UPDATE ON public.crm_utm_config FOR EACH ROW EXECUTE FUNCTION crm_set_updated_at();
--@@ 75 gatilho public.crm_webhook_subscriptions.trg_crm_webhook_subscriptions_
CREATE TRIGGER trg_crm_webhook_subscriptions_set_updated_at BEFORE UPDATE ON public.crm_webhook_subscriptions FOR EACH ROW EXECUTE FUNCTION crm_set_updated_at();
--@@ 75 gatilho public.customers.customers_normalize_birth_date
CREATE TRIGGER customers_normalize_birth_date BEFORE INSERT OR UPDATE OF birth_date ON public.customers FOR EACH ROW EXECUTE FUNCTION private.customers_normalize_birth_date();
--@@ 75 gatilho public.debt_payments.trg_debt_payments_after_delete
CREATE TRIGGER trg_debt_payments_after_delete AFTER DELETE ON public.debt_payments FOR EACH ROW EXECUTE FUNCTION handle_debt_payment_after_delete();
--@@ 75 gatilho public.debt_payments.trg_debt_payments_after_insert
CREATE TRIGGER trg_debt_payments_after_insert AFTER INSERT ON public.debt_payments FOR EACH ROW EXECUTE FUNCTION handle_debt_payment_after_insert();
--@@ 75 gatilho public.debts.trg_debts_after_delete
CREATE TRIGGER trg_debts_after_delete AFTER DELETE ON public.debts FOR EACH ROW EXECUTE FUNCTION handle_debt_after_delete();
--@@ 75 gatilho public.debts.trg_debts_after_insert
CREATE TRIGGER trg_debts_after_insert AFTER INSERT ON public.debts FOR EACH ROW EXECUTE FUNCTION handle_debt_after_insert();
--@@ 75 gatilho public.debts.trg_debts_after_update
CREATE TRIGGER trg_debts_after_update AFTER UPDATE ON public.debts FOR EACH ROW EXECUTE FUNCTION handle_debt_after_update();
--@@ 75 gatilho public.device_catalog.set_device_catalog_updated_at
CREATE TRIGGER set_device_catalog_updated_at BEFORE UPDATE ON public.device_catalog FOR EACH ROW EXECUTE FUNCTION tg_set_device_catalog_updated_at();
--@@ 75 gatilho public.finance_categories.set_finance_categories_updated_at
CREATE TRIGGER set_finance_categories_updated_at BEFORE UPDATE ON public.finance_categories FOR EACH ROW EXECUTE FUNCTION tg_set_finance_categories_updated_at();
--@@ 75 gatilho public.lead_state.trg_lead_state_set_updated_at
CREATE TRIGGER trg_lead_state_set_updated_at BEFORE UPDATE ON public.lead_state FOR EACH ROW EXECUTE FUNCTION tg_set_lead_state_updated_at();
--@@ 75 gatilho public.parts_inventory.set_parts_inventory_updated_at
CREATE TRIGGER set_parts_inventory_updated_at BEFORE UPDATE ON public.parts_inventory FOR EACH ROW EXECUTE FUNCTION tg_set_parts_inventory_updated_at();
--@@ 75 gatilho public.payable_debt_payments.trg_payable_debt_payments_after_de
CREATE TRIGGER trg_payable_debt_payments_after_delete AFTER DELETE ON public.payable_debt_payments FOR EACH ROW EXECUTE FUNCTION handle_payable_debt_payment_after_delete();
--@@ 75 gatilho public.payable_debt_payments.trg_payable_debt_payments_after_in
CREATE TRIGGER trg_payable_debt_payments_after_insert AFTER INSERT ON public.payable_debt_payments FOR EACH ROW EXECUTE FUNCTION handle_payable_debt_payment_after_insert();
--@@ 75 gatilho public.payable_debts.set_payable_debts_updated_at
CREATE TRIGGER set_payable_debts_updated_at BEFORE UPDATE ON public.payable_debts FOR EACH ROW EXECUTE FUNCTION tg_set_payable_debts_updated_at();
--@@ 75 gatilho public.payable_debts.trg_payable_debts_after_delete
CREATE TRIGGER trg_payable_debts_after_delete AFTER DELETE ON public.payable_debts FOR EACH ROW EXECUTE FUNCTION handle_payable_debt_after_delete();
--@@ 75 gatilho public.payable_debts.trg_payable_debts_after_insert
CREATE TRIGGER trg_payable_debts_after_insert AFTER INSERT ON public.payable_debts FOR EACH ROW EXECUTE FUNCTION handle_payable_debt_after_insert();
--@@ 75 gatilho public.payable_debts.trg_payable_debts_after_update
CREATE TRIGGER trg_payable_debts_after_update AFTER UPDATE ON public.payable_debts FOR EACH ROW EXECUTE FUNCTION handle_payable_debt_after_update();
--@@ 75 gatilho public.reservation_message_settings.reservation_message_setting
CREATE TRIGGER reservation_message_settings_touch BEFORE UPDATE ON public.reservation_message_settings FOR EACH ROW EXECUTE FUNCTION touch_reservation_message_settings();
--@@ 75 gatilho public.sale_items.trg_sale_items_after_insert
CREATE TRIGGER trg_sale_items_after_insert AFTER INSERT ON public.sale_items FOR EACH ROW EXECUTE FUNCTION handle_sale_item_after_insert();
--@@ 75 gatilho public.sales.trg_crm_sales_purchase_sync
CREATE TRIGGER trg_crm_sales_purchase_sync AFTER INSERT OR DELETE OR UPDATE ON public.sales FOR EACH ROW EXECUTE FUNCTION crm_sales_purchase_sync_trigger();
--@@ 75 gatilho public.sales.trg_sales_after_delete_cleanup
CREATE TRIGGER trg_sales_after_delete_cleanup AFTER DELETE ON public.sales FOR EACH ROW EXECUTE FUNCTION handle_sale_after_delete_cleanup();
--@@ 75 gatilho public.sales.trg_sales_backfill_ads_origin_from_phone_match
CREATE TRIGGER trg_sales_backfill_ads_origin_from_phone_match AFTER INSERT OR UPDATE OF customer_id, store_id, crm_lead_id, date ON public.sales FOR EACH ROW EXECUTE FUNCTION sales_backfill_ads_origin_from_phone_match();
--@@ 75 gatilho public.sales.trg_sales_before_delete
CREATE TRIGGER trg_sales_before_delete BEFORE DELETE ON public.sales FOR EACH ROW EXECUTE FUNCTION handle_sale_before_delete();
--@@ 75 gatilho public.sales.trg_sales_set_crm_lead_id
CREATE TRIGGER trg_sales_set_crm_lead_id BEFORE INSERT OR UPDATE OF customer_id, store_id, crm_lead_id ON public.sales FOR EACH ROW EXECUTE FUNCTION sales_set_crm_lead_id();
--@@ 75 gatilho public.simulator_trade_in_adjustments.set_simulator_trade_in_ad
CREATE TRIGGER set_simulator_trade_in_adjustments_updated_at BEFORE UPDATE ON public.simulator_trade_in_adjustments FOR EACH ROW EXECUTE FUNCTION tg_set_simulator_trade_in_updated_at();
--@@ 75 gatilho public.simulator_trade_in_values.set_simulator_trade_in_values_
CREATE TRIGGER set_simulator_trade_in_values_updated_at BEFORE UPDATE ON public.simulator_trade_in_values FOR EACH ROW EXECUTE FUNCTION tg_set_simulator_trade_in_updated_at();
--@@ 75 gatilho public.stock_reservations.trg_stock_reservations_set_updated_at
CREATE TRIGGER trg_stock_reservations_set_updated_at BEFORE UPDATE ON public.stock_reservations FOR EACH ROW EXECUTE FUNCTION tg_set_stock_reservations_updated_at();
--@@ 75 gatilho public.transactions.trg_transactions_after_delete
CREATE TRIGGER trg_transactions_after_delete AFTER DELETE ON public.transactions FOR EACH ROW EXECUTE FUNCTION handle_transaction_after_delete();
--@@ 75 gatilho public.user_access_roles.trg_user_access_roles_set_updated_at
CREATE TRIGGER trg_user_access_roles_set_updated_at BEFORE UPDATE ON public.user_access_roles FOR EACH ROW EXECUTE FUNCTION app_set_updated_at();
--@@ 80 rls public.account_deletion_requests
alter table public.account_deletion_requests enable row level security;
--@@ 80 rls public.admin_agent_audit_log
alter table public.admin_agent_audit_log enable row level security;
--@@ 80 rls public.admin_agent_numbers
alter table public.admin_agent_numbers enable row level security;
--@@ 80 rls public.admin_agent_pending_actions
alter table public.admin_agent_pending_actions enable row level security;
--@@ 80 rls public.ai_turn_events
alter table public.ai_turn_events enable row level security;
--@@ 80 rls public.app_role_permissions
alter table public.app_role_permissions enable row level security;
--@@ 80 rls public.app_user_activity_logs
alter table public.app_user_activity_logs enable row level security;
--@@ 80 rls public.business_profile
alter table public.business_profile enable row level security;
--@@ 80 rls public.card_fee_settings
alter table public.card_fee_settings enable row level security;
--@@ 80 rls public.cost_history
alter table public.cost_history enable row level security;
--@@ 80 rls public.costs
alter table public.costs enable row level security;
--@@ 80 rls public.creditors
alter table public.creditors enable row level security;
--@@ 80 rls public.crm_ai_agent_configs
alter table public.crm_ai_agent_configs enable row level security;
--@@ 80 rls public.crm_ai_agent_invocations
alter table public.crm_ai_agent_invocations enable row level security;
--@@ 80 rls public.crm_ai_entry_settings
alter table public.crm_ai_entry_settings enable row level security;
--@@ 80 rls public.crm_attendance_scripts
alter table public.crm_attendance_scripts enable row level security;
--@@ 80 rls public.crm_auth_handoffs
alter table public.crm_auth_handoffs enable row level security;
--@@ 80 rls public.crm_automation_rules
alter table public.crm_automation_rules enable row level security;
--@@ 80 rls public.crm_broadcast_recipients
alter table public.crm_broadcast_recipients enable row level security;
--@@ 80 rls public.crm_broadcasts
alter table public.crm_broadcasts enable row level security;
--@@ 80 rls public.crm_channel_store_links
alter table public.crm_channel_store_links enable row level security;
--@@ 80 rls public.crm_channels
alter table public.crm_channels enable row level security;
--@@ 80 rls public.crm_conversations
alter table public.crm_conversations enable row level security;
--@@ 80 rls public.crm_custom_fields
alter table public.crm_custom_fields enable row level security;
--@@ 80 rls public.crm_dispatch_runtime
alter table public.crm_dispatch_runtime enable row level security;
--@@ 80 rls public.crm_event_log
alter table public.crm_event_log enable row level security;
--@@ 80 rls public.crm_filter_views
alter table public.crm_filter_views enable row level security;
--@@ 80 rls public.crm_follow_up_tracker
alter table public.crm_follow_up_tracker enable row level security;
--@@ 80 rls public.crm_funnel_stages
alter table public.crm_funnel_stages enable row level security;
--@@ 80 rls public.crm_funnels
alter table public.crm_funnels enable row level security;
--@@ 80 rls public.crm_instagram_comment_events
alter table public.crm_instagram_comment_events enable row level security;
--@@ 80 rls public.crm_instagram_media_snapshots
alter table public.crm_instagram_media_snapshots enable row level security;
--@@ 80 rls public.crm_lead_custom_field_values
alter table public.crm_lead_custom_field_values enable row level security;
--@@ 80 rls public.crm_lead_identities
alter table public.crm_lead_identities enable row level security;
--@@ 80 rls public.crm_lead_stage_history
alter table public.crm_lead_stage_history enable row level security;
--@@ 80 rls public.crm_leads
alter table public.crm_leads enable row level security;
--@@ 80 rls public.crm_message_templates
alter table public.crm_message_templates enable row level security;
--@@ 80 rls public.crm_messages
alter table public.crm_messages enable row level security;
--@@ 80 rls public.crm_meta_ads_attributions
alter table public.crm_meta_ads_attributions enable row level security;
--@@ 80 rls public.crm_meta_ads_groups
alter table public.crm_meta_ads_groups enable row level security;
--@@ 80 rls public.crm_public_registration_links
alter table public.crm_public_registration_links enable row level security;
--@@ 80 rls public.crm_scheduled_messages
alter table public.crm_scheduled_messages enable row level security;
--@@ 80 rls public.crm_settings
alter table public.crm_settings enable row level security;
--@@ 80 rls public.crm_uaz_avatar_jobs
alter table public.crm_uaz_avatar_jobs enable row level security;
--@@ 80 rls public.crm_ui_preferences
alter table public.crm_ui_preferences enable row level security;
--@@ 80 rls public.crm_utm_config
alter table public.crm_utm_config enable row level security;
--@@ 80 rls public.crm_webhook_subscriptions
alter table public.crm_webhook_subscriptions enable row level security;
--@@ 80 rls public.customers
alter table public.customers enable row level security;
--@@ 80 rls public.debt_payments
alter table public.debt_payments enable row level security;
--@@ 80 rls public.debts
alter table public.debts enable row level security;
--@@ 80 rls public.device_catalog
alter table public.device_catalog enable row level security;
--@@ 80 rls public.finance_categories
alter table public.finance_categories enable row level security;
--@@ 80 rls public.lead_state
alter table public.lead_state enable row level security;
--@@ 80 rls public.parts_inventory
alter table public.parts_inventory enable row level security;
--@@ 80 rls public.payable_debt_payments
alter table public.payable_debt_payments enable row level security;
--@@ 80 rls public.payable_debts
alter table public.payable_debts enable row level security;
--@@ 80 rls public.payment_methods
alter table public.payment_methods enable row level security;
--@@ 80 rls public.push_subscriptions
alter table public.push_subscriptions enable row level security;
--@@ 80 rls public.reservation_message_settings
alter table public.reservation_message_settings enable row level security;
--@@ 80 rls public.sale_items
alter table public.sale_items enable row level security;
--@@ 80 rls public.sale_trade_in_items
alter table public.sale_trade_in_items enable row level security;
--@@ 80 rls public.sales
alter table public.sales enable row level security;
--@@ 80 rls public.sellers
alter table public.sellers enable row level security;
--@@ 80 rls public.simulator_trade_in_adjustments
alter table public.simulator_trade_in_adjustments enable row level security;
--@@ 80 rls public.simulator_trade_in_values
alter table public.simulator_trade_in_values enable row level security;
--@@ 80 rls public.stock_items
alter table public.stock_items enable row level security;
--@@ 80 rls public.stock_reservations
alter table public.stock_reservations enable row level security;
--@@ 80 rls public.stores
alter table public.stores enable row level security;
--@@ 80 rls public.transactions
alter table public.transactions enable row level security;
--@@ 80 rls public.user_access_roles
alter table public.user_access_roles enable row level security;
--@@ 80 rls public.user_consents
alter table public.user_consents enable row level security;
--@@ 80 rls public.user_profiles
alter table public.user_profiles enable row level security;
--@@ 80 rls public.warranty_public_tokens
alter table public.warranty_public_tokens enable row level security;
--@@ 82 politica public.account_deletion_requests.deletion_requests_own
create policy deletion_requests_own on public.account_deletion_requests as permissive for all to authenticated using ((( SELECT auth.uid() AS uid) = user_id)) with check ((( SELECT auth.uid() AS uid) = user_id));
--@@ 82 politica public.admin_agent_audit_log.admin_agent_audit_admin_read
create policy admin_agent_audit_admin_read on public.admin_agent_audit_log as permissive for select to public using (("current_role"() = 'admin'::text));
--@@ 82 politica public.admin_agent_numbers.admin_agent_numbers_admin_all
create policy admin_agent_numbers_admin_all on public.admin_agent_numbers as permissive for all to public using (("current_role"() = 'admin'::text)) with check (("current_role"() = 'admin'::text));
--@@ 82 politica public.ai_turn_events.ai_turn_events_store_scope_select
create policy ai_turn_events_store_scope_select on public.ai_turn_events as permissive for select to authenticated using (crm_can_access_store(store_id));
--@@ 82 politica public.app_role_permissions.app_role_permissions_delete
create policy app_role_permissions_delete on public.app_role_permissions as permissive for delete to authenticated using ((( SELECT "current_role"() AS "current_role") = 'admin'::text));
--@@ 82 politica public.app_role_permissions.app_role_permissions_insert
create policy app_role_permissions_insert on public.app_role_permissions as permissive for insert to authenticated with check ((( SELECT "current_role"() AS "current_role") = 'admin'::text));
--@@ 82 politica public.app_role_permissions.app_role_permissions_select
create policy app_role_permissions_select on public.app_role_permissions as permissive for select to authenticated using (true);
--@@ 82 politica public.app_role_permissions.app_role_permissions_update
create policy app_role_permissions_update on public.app_role_permissions as permissive for update to authenticated using ((( SELECT "current_role"() AS "current_role") = 'admin'::text)) with check ((( SELECT "current_role"() AS "current_role") = 'admin'::text));
--@@ 82 politica public.app_user_activity_logs.app_user_activity_logs_select
create policy app_user_activity_logs_select on public.app_user_activity_logs as permissive for select to authenticated using (((( SELECT "current_role"() AS "current_role") = 'admin'::text) OR (( SELECT auth.uid() AS uid) = user_id)));
--@@ 82 politica public.app_user_activity_logs.app_user_activity_logs_self_inser
create policy app_user_activity_logs_self_insert on public.app_user_activity_logs as permissive for insert to authenticated with check ((( SELECT auth.uid() AS uid) = user_id));
--@@ 82 politica public.business_profile.business_profile_delete
create policy business_profile_delete on public.business_profile as permissive for delete to authenticated using ((( SELECT "current_role"() AS "current_role") = 'admin'::text));
--@@ 82 politica public.business_profile.business_profile_insert
create policy business_profile_insert on public.business_profile as permissive for insert to authenticated with check ((( SELECT "current_role"() AS "current_role") = 'admin'::text));
--@@ 82 politica public.business_profile.business_profile_select
create policy business_profile_select on public.business_profile as permissive for select to authenticated using ((( SELECT "current_role"() AS "current_role") = ANY (ARRAY['admin'::text, 'seller'::text])));
--@@ 82 politica public.business_profile.business_profile_update
create policy business_profile_update on public.business_profile as permissive for update to authenticated using ((( SELECT "current_role"() AS "current_role") = 'admin'::text)) with check ((( SELECT "current_role"() AS "current_role") = 'admin'::text));
--@@ 82 politica public.card_fee_settings.card_fee_settings_delete
create policy card_fee_settings_delete on public.card_fee_settings as permissive for delete to authenticated using ((( SELECT "current_role"() AS "current_role") = 'admin'::text));
--@@ 82 politica public.card_fee_settings.card_fee_settings_insert
create policy card_fee_settings_insert on public.card_fee_settings as permissive for insert to authenticated with check ((( SELECT "current_role"() AS "current_role") = 'admin'::text));
--@@ 82 politica public.card_fee_settings.card_fee_settings_select
create policy card_fee_settings_select on public.card_fee_settings as permissive for select to authenticated using ((( SELECT "current_role"() AS "current_role") = ANY (ARRAY['admin'::text, 'seller'::text])));
--@@ 82 politica public.card_fee_settings.card_fee_settings_update
create policy card_fee_settings_update on public.card_fee_settings as permissive for update to authenticated using ((( SELECT "current_role"() AS "current_role") = 'admin'::text)) with check ((( SELECT "current_role"() AS "current_role") = 'admin'::text));
--@@ 82 politica public.cost_history.cost_history_delete
create policy cost_history_delete on public.cost_history as permissive for delete to authenticated using ((( SELECT "current_role"() AS "current_role") = 'admin'::text));
--@@ 82 politica public.cost_history.cost_history_insert
create policy cost_history_insert on public.cost_history as permissive for insert to authenticated with check ((( SELECT "current_role"() AS "current_role") = ANY (ARRAY['admin'::text, 'seller'::text])));
--@@ 82 politica public.cost_history.cost_history_select
create policy cost_history_select on public.cost_history as permissive for select to authenticated using ((( SELECT "current_role"() AS "current_role") = ANY (ARRAY['admin'::text, 'seller'::text])));
--@@ 82 politica public.cost_history.cost_history_update
create policy cost_history_update on public.cost_history as permissive for update to authenticated using ((( SELECT "current_role"() AS "current_role") = ANY (ARRAY['admin'::text, 'seller'::text]))) with check ((( SELECT "current_role"() AS "current_role") = ANY (ARRAY['admin'::text, 'seller'::text])));
--@@ 82 politica public.costs.costs_delete
create policy costs_delete on public.costs as permissive for delete to authenticated using ((( SELECT "current_role"() AS "current_role") = 'admin'::text));
--@@ 82 politica public.costs.costs_insert
create policy costs_insert on public.costs as permissive for insert to authenticated with check ((( SELECT "current_role"() AS "current_role") = ANY (ARRAY['admin'::text, 'seller'::text])));
--@@ 82 politica public.costs.costs_select
create policy costs_select on public.costs as permissive for select to authenticated using ((( SELECT "current_role"() AS "current_role") = ANY (ARRAY['admin'::text, 'seller'::text])));
--@@ 82 politica public.costs.costs_update
create policy costs_update on public.costs as permissive for update to authenticated using ((( SELECT "current_role"() AS "current_role") = ANY (ARRAY['admin'::text, 'seller'::text]))) with check ((( SELECT "current_role"() AS "current_role") = ANY (ARRAY['admin'::text, 'seller'::text])));
--@@ 82 politica public.creditors.creditors_admin_all
create policy creditors_admin_all on public.creditors as permissive for all to authenticated using (("current_role"() = 'admin'::text)) with check (("current_role"() = 'admin'::text));
--@@ 82 politica public.crm_ai_agent_configs.crm_ai_agent_configs_store_scope
create policy crm_ai_agent_configs_store_scope on public.crm_ai_agent_configs as permissive for all to authenticated using (crm_can_access_store(store_id)) with check (crm_can_access_store(store_id));
--@@ 82 politica public.crm_ai_agent_invocations.crm_ai_agent_invocations_store_
create policy crm_ai_agent_invocations_store_insert on public.crm_ai_agent_invocations as permissive for insert to authenticated with check (crm_can_access_store(store_id));
--@@ 82 politica public.crm_ai_agent_invocations.crm_ai_agent_invocations_store_
create policy crm_ai_agent_invocations_store_read on public.crm_ai_agent_invocations as permissive for select to authenticated using (crm_can_access_store(store_id));
--@@ 82 politica public.crm_ai_entry_settings.crm_ai_entry_settings_store_scope
create policy crm_ai_entry_settings_store_scope on public.crm_ai_entry_settings as permissive for all to authenticated using (crm_can_access_store(store_id)) with check (crm_can_access_store(store_id));
--@@ 82 politica public.crm_attendance_scripts.crm_attendance_scripts_store_scop
create policy crm_attendance_scripts_store_scope on public.crm_attendance_scripts as permissive for all to authenticated using (crm_can_access_store(store_id)) with check (crm_can_access_store(store_id));
--@@ 82 politica public.crm_auth_handoffs.crm_auth_handoffs_block_all
create policy crm_auth_handoffs_block_all on public.crm_auth_handoffs as permissive for all to authenticated using (false) with check (false);
--@@ 82 politica public.crm_automation_rules.crm_automation_rules_store_scope
create policy crm_automation_rules_store_scope on public.crm_automation_rules as permissive for all to authenticated using (crm_can_access_store(store_id)) with check (crm_can_access_store(store_id));
--@@ 82 politica public.crm_broadcast_recipients.crm_broadcast_recipients_store_
create policy crm_broadcast_recipients_store_scope on public.crm_broadcast_recipients as permissive for all to authenticated using (crm_can_access_store(store_id)) with check (crm_can_access_store(store_id));
--@@ 82 politica public.crm_broadcasts.crm_broadcasts_store_scope
create policy crm_broadcasts_store_scope on public.crm_broadcasts as permissive for all to authenticated using (crm_can_access_store(store_id)) with check (crm_can_access_store(store_id));
--@@ 82 politica public.crm_channel_store_links.crm_channel_store_links_scope
create policy crm_channel_store_links_scope on public.crm_channel_store_links as permissive for all to authenticated using (crm_can_access_store(store_id)) with check (crm_can_access_store(store_id));
--@@ 82 politica public.crm_channels.crm_channels_store_scope
create policy crm_channels_store_scope on public.crm_channels as permissive for all to authenticated using ((crm_can_access_store(store_id) OR (EXISTS ( SELECT 1
   FROM crm_channel_store_links l
  WHERE ((l.channel_id = crm_channels.id) AND (l.is_active = true) AND crm_can_access_store(l.store_id)))))) with check (crm_can_access_store(store_id));
--@@ 82 politica public.crm_conversations.crm_conversations_store_scope
create policy crm_conversations_store_scope on public.crm_conversations as permissive for all to authenticated using (crm_can_access_store(store_id)) with check (crm_can_access_store(store_id));
--@@ 82 politica public.crm_custom_fields.crm_custom_fields_store_scope
create policy crm_custom_fields_store_scope on public.crm_custom_fields as permissive for all to authenticated using (crm_can_access_store(store_id)) with check (crm_can_access_store(store_id));
--@@ 82 politica public.crm_dispatch_runtime.crm_dispatch_runtime_admin_scope
create policy crm_dispatch_runtime_admin_scope on public.crm_dispatch_runtime as permissive for all to authenticated using (("current_role"() = 'admin'::text)) with check (("current_role"() = 'admin'::text));
--@@ 82 politica public.crm_event_log.crm_event_log_store_scope
create policy crm_event_log_store_scope on public.crm_event_log as permissive for all to authenticated using (crm_can_access_store(store_id)) with check (crm_can_access_store(store_id));
--@@ 82 politica public.crm_filter_views.crm_filter_views_delete
create policy crm_filter_views_delete on public.crm_filter_views as permissive for delete to authenticated using ((( SELECT auth.uid() AS uid) = user_id));
--@@ 82 politica public.crm_filter_views.crm_filter_views_insert
create policy crm_filter_views_insert on public.crm_filter_views as permissive for insert to authenticated with check ((( SELECT auth.uid() AS uid) = user_id));
--@@ 82 politica public.crm_filter_views.crm_filter_views_select
create policy crm_filter_views_select on public.crm_filter_views as permissive for select to authenticated using (((( SELECT auth.uid() AS uid) = user_id) OR (is_shared = true)));
--@@ 82 politica public.crm_filter_views.crm_filter_views_update
create policy crm_filter_views_update on public.crm_filter_views as permissive for update to authenticated using ((( SELECT auth.uid() AS uid) = user_id));
--@@ 82 politica public.crm_follow_up_tracker.crm_follow_up_tracker_store_scope
create policy crm_follow_up_tracker_store_scope on public.crm_follow_up_tracker as permissive for all to authenticated using ((EXISTS ( SELECT 1
   FROM crm_leads cl
  WHERE ((cl.id = crm_follow_up_tracker.lead_id) AND crm_can_access_store(cl.store_id))))) with check ((EXISTS ( SELECT 1
   FROM crm_leads cl
  WHERE ((cl.id = crm_follow_up_tracker.lead_id) AND crm_can_access_store(cl.store_id)))));
--@@ 82 politica public.crm_funnel_stages.crm_funnel_stages_delete
create policy crm_funnel_stages_delete on public.crm_funnel_stages as permissive for delete to authenticated using ((( SELECT "current_role"() AS "current_role") = 'admin'::text));
--@@ 82 politica public.crm_funnel_stages.crm_funnel_stages_insert
create policy crm_funnel_stages_insert on public.crm_funnel_stages as permissive for insert to authenticated with check ((( SELECT "current_role"() AS "current_role") = 'admin'::text));
--@@ 82 politica public.crm_funnel_stages.crm_funnel_stages_select
create policy crm_funnel_stages_select on public.crm_funnel_stages as permissive for select to authenticated using (true);
--@@ 82 politica public.crm_funnel_stages.crm_funnel_stages_update
create policy crm_funnel_stages_update on public.crm_funnel_stages as permissive for update to authenticated using ((( SELECT "current_role"() AS "current_role") = 'admin'::text)) with check ((( SELECT "current_role"() AS "current_role") = 'admin'::text));
--@@ 82 politica public.crm_funnels.crm_funnels_store_scope
create policy crm_funnels_store_scope on public.crm_funnels as permissive for all to authenticated using (crm_can_access_store(store_id)) with check (crm_can_access_store(store_id));
--@@ 82 politica public.crm_instagram_comment_events.crm_ig_comments_store_scope
create policy crm_ig_comments_store_scope on public.crm_instagram_comment_events as permissive for all to authenticated using (crm_can_access_store(store_id)) with check (crm_can_access_store(store_id));
--@@ 82 politica public.crm_instagram_media_snapshots.crm_ig_media_store_scope
create policy crm_ig_media_store_scope on public.crm_instagram_media_snapshots as permissive for all to authenticated using (crm_can_access_store(store_id)) with check (crm_can_access_store(store_id));
--@@ 82 politica public.crm_lead_custom_field_values.crm_custom_values_store_sco
create policy crm_custom_values_store_scope on public.crm_lead_custom_field_values as permissive for all to authenticated using (crm_can_access_store(store_id)) with check (crm_can_access_store(store_id));
--@@ 82 politica public.crm_lead_identities.crm_lead_identities_store_scope
create policy crm_lead_identities_store_scope on public.crm_lead_identities as permissive for all to authenticated using (crm_can_access_store(store_id)) with check (crm_can_access_store(store_id));
--@@ 82 politica public.crm_lead_stage_history.crm_stage_history_store_scope
create policy crm_stage_history_store_scope on public.crm_lead_stage_history as permissive for all to authenticated using (crm_can_access_store(store_id)) with check (crm_can_access_store(store_id));
--@@ 82 politica public.crm_leads.crm_leads_store_scope
create policy crm_leads_store_scope on public.crm_leads as permissive for all to authenticated using (crm_can_access_store(store_id)) with check (crm_can_access_store(store_id));
--@@ 82 politica public.crm_message_templates.crm_message_templates_store_scope
create policy crm_message_templates_store_scope on public.crm_message_templates as permissive for all to authenticated using (crm_can_access_store(store_id)) with check (crm_can_access_store(store_id));
--@@ 82 politica public.crm_messages.crm_messages_store_scope
create policy crm_messages_store_scope on public.crm_messages as permissive for all to authenticated using (crm_can_access_store(store_id)) with check (crm_can_access_store(store_id));
--@@ 82 politica public.crm_meta_ads_attributions.crm_meta_ads_attr_store_scope
create policy crm_meta_ads_attr_store_scope on public.crm_meta_ads_attributions as permissive for all to authenticated using (crm_can_access_store(store_id)) with check (crm_can_access_store(store_id));
--@@ 82 politica public.crm_meta_ads_groups.crm_meta_ads_groups_store_scope
create policy crm_meta_ads_groups_store_scope on public.crm_meta_ads_groups as permissive for all to authenticated using (crm_can_access_store(store_id)) with check (crm_can_access_store(store_id));
--@@ 82 politica public.crm_public_registration_links.crm_public_reg_links_store
create policy crm_public_reg_links_store_scope on public.crm_public_registration_links as permissive for all to authenticated using (crm_can_access_store(store_id)) with check (crm_can_access_store(store_id));
--@@ 82 politica public.crm_scheduled_messages.crm_scheduled_messages_store_scop
create policy crm_scheduled_messages_store_scope on public.crm_scheduled_messages as permissive for all to authenticated using (crm_can_access_store(store_id)) with check (crm_can_access_store(store_id));
--@@ 82 politica public.crm_settings.crm_settings_delete
create policy crm_settings_delete on public.crm_settings as permissive for delete to authenticated using ((( SELECT "current_role"() AS "current_role") = 'admin'::text));
--@@ 82 politica public.crm_settings.crm_settings_insert
create policy crm_settings_insert on public.crm_settings as permissive for insert to authenticated with check ((( SELECT "current_role"() AS "current_role") = 'admin'::text));
--@@ 82 politica public.crm_settings.crm_settings_select
create policy crm_settings_select on public.crm_settings as permissive for select to authenticated using (true);
--@@ 82 politica public.crm_settings.crm_settings_update
create policy crm_settings_update on public.crm_settings as permissive for update to authenticated using ((( SELECT "current_role"() AS "current_role") = 'admin'::text)) with check ((( SELECT "current_role"() AS "current_role") = 'admin'::text));
--@@ 82 politica public.crm_ui_preferences.crm_ui_preferences_owner_access
create policy crm_ui_preferences_owner_access on public.crm_ui_preferences as permissive for all to public using (((( SELECT auth.role() AS role) = 'authenticated'::text) AND (user_id = ( SELECT auth.uid() AS uid)))) with check (((( SELECT auth.role() AS role) = 'authenticated'::text) AND (user_id = ( SELECT auth.uid() AS uid))));
--@@ 82 politica public.crm_ui_preferences.crm_ui_preferences_store_scope
create policy crm_ui_preferences_store_scope on public.crm_ui_preferences as permissive for all to authenticated using ((crm_can_access_store(store_id) AND (user_id = ( SELECT auth.uid() AS uid)))) with check ((crm_can_access_store(store_id) AND (user_id = ( SELECT auth.uid() AS uid))));
--@@ 82 politica public.crm_utm_config.crm_utm_config_store_scope
create policy crm_utm_config_store_scope on public.crm_utm_config as permissive for all to authenticated using (crm_can_access_store(store_id)) with check (crm_can_access_store(store_id));
--@@ 82 politica public.crm_webhook_subscriptions.crm_webhook_subscriptions_stor
create policy crm_webhook_subscriptions_store_scope on public.crm_webhook_subscriptions as permissive for all to authenticated using (((store_id IS NULL) OR crm_can_access_store(store_id))) with check (((store_id IS NULL) OR crm_can_access_store(store_id)));
--@@ 82 politica public.customers.customers_delete
create policy customers_delete on public.customers as permissive for delete to authenticated using ((( SELECT "current_role"() AS "current_role") = 'admin'::text));
--@@ 82 politica public.customers.customers_insert
create policy customers_insert on public.customers as permissive for insert to authenticated with check ((( SELECT "current_role"() AS "current_role") = ANY (ARRAY['admin'::text, 'seller'::text])));
--@@ 82 politica public.customers.customers_select
create policy customers_select on public.customers as permissive for select to authenticated using ((( SELECT "current_role"() AS "current_role") = ANY (ARRAY['admin'::text, 'seller'::text])));
--@@ 82 politica public.customers.customers_update
create policy customers_update on public.customers as permissive for update to authenticated using ((( SELECT "current_role"() AS "current_role") = ANY (ARRAY['admin'::text, 'seller'::text]))) with check ((( SELECT "current_role"() AS "current_role") = ANY (ARRAY['admin'::text, 'seller'::text])));
--@@ 82 politica public.debt_payments.debt_payments_admin_all
create policy debt_payments_admin_all on public.debt_payments as permissive for all to authenticated using (("current_role"() = 'admin'::text)) with check (("current_role"() = 'admin'::text));
--@@ 82 politica public.debts.debts_admin_all
create policy debts_admin_all on public.debts as permissive for all to authenticated using (("current_role"() = 'admin'::text)) with check (("current_role"() = 'admin'::text));
--@@ 82 politica public.device_catalog.device_catalog_delete
create policy device_catalog_delete on public.device_catalog as permissive for delete to authenticated using ((( SELECT "current_role"() AS "current_role") = 'admin'::text));
--@@ 82 politica public.device_catalog.device_catalog_insert
create policy device_catalog_insert on public.device_catalog as permissive for insert to authenticated with check ((( SELECT "current_role"() AS "current_role") = ANY (ARRAY['admin'::text, 'seller'::text])));
--@@ 82 politica public.device_catalog.device_catalog_select
create policy device_catalog_select on public.device_catalog as permissive for select to authenticated using ((( SELECT "current_role"() AS "current_role") = ANY (ARRAY['admin'::text, 'seller'::text])));
--@@ 82 politica public.device_catalog.device_catalog_update
create policy device_catalog_update on public.device_catalog as permissive for update to authenticated using ((( SELECT "current_role"() AS "current_role") = 'admin'::text)) with check ((( SELECT "current_role"() AS "current_role") = 'admin'::text));
--@@ 82 politica public.finance_categories.finance_categories_delete
create policy finance_categories_delete on public.finance_categories as permissive for delete to authenticated using ((( SELECT "current_role"() AS "current_role") = 'admin'::text));
--@@ 82 politica public.finance_categories.finance_categories_insert
create policy finance_categories_insert on public.finance_categories as permissive for insert to authenticated with check ((( SELECT "current_role"() AS "current_role") = 'admin'::text));
--@@ 82 politica public.finance_categories.finance_categories_select
create policy finance_categories_select on public.finance_categories as permissive for select to authenticated using (true);
--@@ 82 politica public.finance_categories.finance_categories_update
create policy finance_categories_update on public.finance_categories as permissive for update to authenticated using ((( SELECT "current_role"() AS "current_role") = 'admin'::text)) with check ((( SELECT "current_role"() AS "current_role") = 'admin'::text));
--@@ 82 politica public.lead_state.lead_state_store_scope_insert
create policy lead_state_store_scope_insert on public.lead_state as permissive for insert to authenticated with check ((EXISTS ( SELECT 1
   FROM crm_leads l
  WHERE ((l.id = lead_state.lead_id) AND crm_can_access_store(l.store_id)))));
--@@ 82 politica public.lead_state.lead_state_store_scope_select
create policy lead_state_store_scope_select on public.lead_state as permissive for select to authenticated using ((EXISTS ( SELECT 1
   FROM crm_leads l
  WHERE ((l.id = lead_state.lead_id) AND crm_can_access_store(l.store_id)))));
--@@ 82 politica public.lead_state.lead_state_store_scope_update
create policy lead_state_store_scope_update on public.lead_state as permissive for update to authenticated using ((EXISTS ( SELECT 1
   FROM crm_leads l
  WHERE ((l.id = lead_state.lead_id) AND crm_can_access_store(l.store_id))))) with check ((EXISTS ( SELECT 1
   FROM crm_leads l
  WHERE ((l.id = lead_state.lead_id) AND crm_can_access_store(l.store_id)))));
--@@ 82 politica public.parts_inventory.parts_inventory_delete
create policy parts_inventory_delete on public.parts_inventory as permissive for delete to authenticated using ((( SELECT "current_role"() AS "current_role") = 'admin'::text));
--@@ 82 politica public.parts_inventory.parts_inventory_insert
create policy parts_inventory_insert on public.parts_inventory as permissive for insert to authenticated with check ((( SELECT "current_role"() AS "current_role") = ANY (ARRAY['admin'::text, 'seller'::text])));
--@@ 82 politica public.parts_inventory.parts_inventory_select
create policy parts_inventory_select on public.parts_inventory as permissive for select to authenticated using ((( SELECT "current_role"() AS "current_role") = ANY (ARRAY['admin'::text, 'seller'::text])));
--@@ 82 politica public.parts_inventory.parts_inventory_update
create policy parts_inventory_update on public.parts_inventory as permissive for update to authenticated using ((( SELECT "current_role"() AS "current_role") = ANY (ARRAY['admin'::text, 'seller'::text]))) with check ((( SELECT "current_role"() AS "current_role") = ANY (ARRAY['admin'::text, 'seller'::text])));
--@@ 82 politica public.payable_debt_payments.payable_debt_payments_admin_all
create policy payable_debt_payments_admin_all on public.payable_debt_payments as permissive for all to authenticated using (("current_role"() = 'admin'::text)) with check (("current_role"() = 'admin'::text));
--@@ 82 politica public.payable_debts.payable_debts_admin_all
create policy payable_debts_admin_all on public.payable_debts as permissive for all to authenticated using (("current_role"() = 'admin'::text)) with check (("current_role"() = 'admin'::text));
--@@ 82 politica public.payment_methods.payment_methods_delete
create policy payment_methods_delete on public.payment_methods as permissive for delete to authenticated using ((( SELECT "current_role"() AS "current_role") = 'admin'::text));
--@@ 82 politica public.payment_methods.payment_methods_insert
create policy payment_methods_insert on public.payment_methods as permissive for insert to authenticated with check ((( SELECT "current_role"() AS "current_role") = ANY (ARRAY['admin'::text, 'seller'::text])));
--@@ 82 politica public.payment_methods.payment_methods_select
create policy payment_methods_select on public.payment_methods as permissive for select to authenticated using ((( SELECT "current_role"() AS "current_role") = ANY (ARRAY['admin'::text, 'seller'::text])));
--@@ 82 politica public.payment_methods.payment_methods_update
create policy payment_methods_update on public.payment_methods as permissive for update to authenticated using ((( SELECT "current_role"() AS "current_role") = ANY (ARRAY['admin'::text, 'seller'::text]))) with check ((( SELECT "current_role"() AS "current_role") = ANY (ARRAY['admin'::text, 'seller'::text])));
--@@ 82 politica public.push_subscriptions."users manage own push subscriptions"
create policy "users manage own push subscriptions" on public.push_subscriptions as permissive for all to public using ((( SELECT auth.uid() AS uid) = user_id)) with check ((( SELECT auth.uid() AS uid) = user_id));
--@@ 82 politica public.reservation_message_settings.reservation_message_setting
create policy reservation_message_settings_admin_all on public.reservation_message_settings as permissive for all to authenticated using (("current_role"() = 'admin'::text)) with check (("current_role"() = 'admin'::text));
--@@ 82 politica public.reservation_message_settings.reservation_message_setting
create policy reservation_message_settings_read on public.reservation_message_settings as permissive for select to authenticated using (true);
--@@ 82 politica public.sale_items.sale_items_delete
create policy sale_items_delete on public.sale_items as permissive for delete to authenticated using ((( SELECT "current_role"() AS "current_role") = 'admin'::text));
--@@ 82 politica public.sale_items.sale_items_insert
create policy sale_items_insert on public.sale_items as permissive for insert to authenticated with check ((( SELECT "current_role"() AS "current_role") = ANY (ARRAY['admin'::text, 'seller'::text])));
--@@ 82 politica public.sale_items.sale_items_select
create policy sale_items_select on public.sale_items as permissive for select to authenticated using ((( SELECT "current_role"() AS "current_role") = ANY (ARRAY['admin'::text, 'seller'::text])));
--@@ 82 politica public.sale_items.sale_items_update
create policy sale_items_update on public.sale_items as permissive for update to authenticated using ((( SELECT "current_role"() AS "current_role") = ANY (ARRAY['admin'::text, 'seller'::text]))) with check ((( SELECT "current_role"() AS "current_role") = ANY (ARRAY['admin'::text, 'seller'::text])));
--@@ 82 politica public.sale_trade_in_items.sale_trade_in_items_delete
create policy sale_trade_in_items_delete on public.sale_trade_in_items as permissive for delete to authenticated using ((( SELECT "current_role"() AS "current_role") = 'admin'::text));
--@@ 82 politica public.sale_trade_in_items.sale_trade_in_items_insert
create policy sale_trade_in_items_insert on public.sale_trade_in_items as permissive for insert to authenticated with check ((( SELECT "current_role"() AS "current_role") = ANY (ARRAY['admin'::text, 'seller'::text])));
--@@ 82 politica public.sale_trade_in_items.sale_trade_in_items_select
create policy sale_trade_in_items_select on public.sale_trade_in_items as permissive for select to authenticated using ((( SELECT "current_role"() AS "current_role") = ANY (ARRAY['admin'::text, 'seller'::text])));
--@@ 82 politica public.sale_trade_in_items.sale_trade_in_items_update
create policy sale_trade_in_items_update on public.sale_trade_in_items as permissive for update to authenticated using ((( SELECT "current_role"() AS "current_role") = ANY (ARRAY['admin'::text, 'seller'::text]))) with check ((( SELECT "current_role"() AS "current_role") = ANY (ARRAY['admin'::text, 'seller'::text])));
--@@ 82 politica public.sales.sales_delete
create policy sales_delete on public.sales as permissive for delete to authenticated using ((( SELECT "current_role"() AS "current_role") = 'admin'::text));
--@@ 82 politica public.sales.sales_insert
create policy sales_insert on public.sales as permissive for insert to authenticated with check ((( SELECT "current_role"() AS "current_role") = ANY (ARRAY['admin'::text, 'seller'::text])));
--@@ 82 politica public.sales.sales_select
create policy sales_select on public.sales as permissive for select to authenticated using ((( SELECT "current_role"() AS "current_role") = ANY (ARRAY['admin'::text, 'seller'::text])));
--@@ 82 politica public.sales.sales_update
create policy sales_update on public.sales as permissive for update to authenticated using ((( SELECT "current_role"() AS "current_role") = ANY (ARRAY['admin'::text, 'seller'::text]))) with check ((( SELECT "current_role"() AS "current_role") = ANY (ARRAY['admin'::text, 'seller'::text])));
--@@ 82 politica public.sellers.sellers_delete
create policy sellers_delete on public.sellers as permissive for delete to authenticated using ((( SELECT "current_role"() AS "current_role") = 'admin'::text));
--@@ 82 politica public.sellers.sellers_insert
create policy sellers_insert on public.sellers as permissive for insert to authenticated with check ((( SELECT "current_role"() AS "current_role") = 'admin'::text));
--@@ 82 politica public.sellers.sellers_select
create policy sellers_select on public.sellers as permissive for select to authenticated using ((( SELECT "current_role"() AS "current_role") = ANY (ARRAY['admin'::text, 'seller'::text])));
--@@ 82 politica public.sellers.sellers_update
create policy sellers_update on public.sellers as permissive for update to authenticated using ((( SELECT "current_role"() AS "current_role") = 'admin'::text)) with check ((( SELECT "current_role"() AS "current_role") = 'admin'::text));
--@@ 82 politica public.simulator_trade_in_adjustments.simulator_trade_in_adjust
create policy simulator_trade_in_adjustments_admin_delete on public.simulator_trade_in_adjustments as permissive for delete to authenticated using (("current_role"() = 'admin'::text));
--@@ 82 politica public.simulator_trade_in_adjustments.simulator_trade_in_adjust
create policy simulator_trade_in_adjustments_admin_insert on public.simulator_trade_in_adjustments as permissive for insert to authenticated with check (("current_role"() = 'admin'::text));
--@@ 82 politica public.simulator_trade_in_adjustments.simulator_trade_in_adjust
create policy simulator_trade_in_adjustments_admin_update on public.simulator_trade_in_adjustments as permissive for update to authenticated using (("current_role"() = 'admin'::text)) with check (("current_role"() = 'admin'::text));
--@@ 82 politica public.simulator_trade_in_adjustments.simulator_trade_in_adjust
create policy simulator_trade_in_adjustments_select on public.simulator_trade_in_adjustments as permissive for select to authenticated using (("current_role"() = ANY (ARRAY['admin'::text, 'seller'::text])));
--@@ 82 politica public.simulator_trade_in_values.simulator_trade_in_values_admi
create policy simulator_trade_in_values_admin_delete on public.simulator_trade_in_values as permissive for delete to authenticated using (("current_role"() = 'admin'::text));
--@@ 82 politica public.simulator_trade_in_values.simulator_trade_in_values_admi
create policy simulator_trade_in_values_admin_insert on public.simulator_trade_in_values as permissive for insert to authenticated with check (("current_role"() = 'admin'::text));
--@@ 82 politica public.simulator_trade_in_values.simulator_trade_in_values_admi
create policy simulator_trade_in_values_admin_update on public.simulator_trade_in_values as permissive for update to authenticated using (("current_role"() = 'admin'::text)) with check (("current_role"() = 'admin'::text));
--@@ 82 politica public.simulator_trade_in_values.simulator_trade_in_values_sele
create policy simulator_trade_in_values_select on public.simulator_trade_in_values as permissive for select to authenticated using (("current_role"() = ANY (ARRAY['admin'::text, 'seller'::text])));
--@@ 82 politica public.stock_items.stock_items_delete
create policy stock_items_delete on public.stock_items as permissive for delete to authenticated using ((( SELECT "current_role"() AS "current_role") = 'admin'::text));
--@@ 82 politica public.stock_items.stock_items_insert
create policy stock_items_insert on public.stock_items as permissive for insert to authenticated with check ((( SELECT "current_role"() AS "current_role") = ANY (ARRAY['admin'::text, 'seller'::text])));
--@@ 82 politica public.stock_items.stock_items_select
create policy stock_items_select on public.stock_items as permissive for select to authenticated using ((( SELECT "current_role"() AS "current_role") = ANY (ARRAY['admin'::text, 'seller'::text])));
--@@ 82 politica public.stock_items.stock_items_update
create policy stock_items_update on public.stock_items as permissive for update to authenticated using ((( SELECT "current_role"() AS "current_role") = ANY (ARRAY['admin'::text, 'seller'::text]))) with check ((( SELECT "current_role"() AS "current_role") = ANY (ARRAY['admin'::text, 'seller'::text])));
--@@ 82 politica public.stock_reservations.stock_reservations_store_scope_insert
create policy stock_reservations_store_scope_insert on public.stock_reservations as permissive for insert to authenticated with check ((EXISTS ( SELECT 1
   FROM stock_items si
  WHERE ((si.id = stock_reservations.stock_item_id) AND crm_can_access_store(si.store_id)))));
--@@ 82 politica public.stock_reservations.stock_reservations_store_scope_select
create policy stock_reservations_store_scope_select on public.stock_reservations as permissive for select to authenticated using ((EXISTS ( SELECT 1
   FROM stock_items si
  WHERE ((si.id = stock_reservations.stock_item_id) AND crm_can_access_store(si.store_id)))));
--@@ 82 politica public.stock_reservations.stock_reservations_store_scope_update
create policy stock_reservations_store_scope_update on public.stock_reservations as permissive for update to authenticated using ((EXISTS ( SELECT 1
   FROM stock_items si
  WHERE ((si.id = stock_reservations.stock_item_id) AND crm_can_access_store(si.store_id))))) with check ((EXISTS ( SELECT 1
   FROM stock_items si
  WHERE ((si.id = stock_reservations.stock_item_id) AND crm_can_access_store(si.store_id)))));
--@@ 82 politica public.stores.stores_delete
create policy stores_delete on public.stores as permissive for delete to authenticated using ((( SELECT "current_role"() AS "current_role") = 'admin'::text));
--@@ 82 politica public.stores.stores_insert
create policy stores_insert on public.stores as permissive for insert to authenticated with check ((( SELECT "current_role"() AS "current_role") = 'admin'::text));
--@@ 82 politica public.stores.stores_select
create policy stores_select on public.stores as permissive for select to authenticated using ((( SELECT "current_role"() AS "current_role") = ANY (ARRAY['admin'::text, 'seller'::text])));
--@@ 82 politica public.stores.stores_update
create policy stores_update on public.stores as permissive for update to authenticated using ((( SELECT "current_role"() AS "current_role") = 'admin'::text)) with check ((( SELECT "current_role"() AS "current_role") = 'admin'::text));
--@@ 82 politica public.transactions.transactions_admin_all
create policy transactions_admin_all on public.transactions as permissive for all to authenticated using (("current_role"() = 'admin'::text)) with check (("current_role"() = 'admin'::text));
--@@ 82 politica public.user_access_roles.user_access_roles_admin_delete
create policy user_access_roles_admin_delete on public.user_access_roles as permissive for delete to authenticated using ((( SELECT "current_role"() AS "current_role") = 'admin'::text));
--@@ 82 politica public.user_access_roles.user_access_roles_admin_insert
create policy user_access_roles_admin_insert on public.user_access_roles as permissive for insert to authenticated with check ((( SELECT "current_role"() AS "current_role") = 'admin'::text));
--@@ 82 politica public.user_access_roles.user_access_roles_admin_update
create policy user_access_roles_admin_update on public.user_access_roles as permissive for update to authenticated using ((( SELECT "current_role"() AS "current_role") = 'admin'::text)) with check ((( SELECT "current_role"() AS "current_role") = 'admin'::text));
--@@ 82 politica public.user_access_roles.user_access_roles_select
create policy user_access_roles_select on public.user_access_roles as permissive for select to authenticated using (((( SELECT "current_role"() AS "current_role") = 'admin'::text) OR (( SELECT auth.uid() AS uid) = user_id)));
--@@ 82 politica public.user_consents.user_consents_insert_own
create policy user_consents_insert_own on public.user_consents as permissive for insert to authenticated with check ((( SELECT auth.uid() AS uid) = user_id));
--@@ 82 politica public.user_consents.user_consents_select_own
create policy user_consents_select_own on public.user_consents as permissive for select to authenticated using ((( SELECT auth.uid() AS uid) = user_id));
--@@ 82 politica public.user_consents.user_consents_update_own
create policy user_consents_update_own on public.user_consents as permissive for update to authenticated using ((( SELECT auth.uid() AS uid) = user_id)) with check ((( SELECT auth.uid() AS uid) = user_id));
--@@ 82 politica public.user_profiles.user_profiles_admin_delete
create policy user_profiles_admin_delete on public.user_profiles as permissive for delete to authenticated using ((( SELECT "current_role"() AS "current_role") = 'admin'::text));
--@@ 82 politica public.user_profiles.user_profiles_admin_insert
create policy user_profiles_admin_insert on public.user_profiles as permissive for insert to authenticated with check ((( SELECT "current_role"() AS "current_role") = 'admin'::text));
--@@ 82 politica public.user_profiles.user_profiles_admin_update
create policy user_profiles_admin_update on public.user_profiles as permissive for update to authenticated using ((( SELECT "current_role"() AS "current_role") = 'admin'::text)) with check ((( SELECT "current_role"() AS "current_role") = 'admin'::text));
--@@ 82 politica public.user_profiles.user_profiles_select
create policy user_profiles_select on public.user_profiles as permissive for select to authenticated using (((( SELECT "current_role"() AS "current_role") = 'admin'::text) OR (( SELECT auth.uid() AS uid) = id)));
--@@ 82 politica public.warranty_public_tokens.warranty_public_tokens_delete
create policy warranty_public_tokens_delete on public.warranty_public_tokens as permissive for delete to authenticated using ((( SELECT "current_role"() AS "current_role") = 'admin'::text));
--@@ 82 politica public.warranty_public_tokens.warranty_public_tokens_insert
create policy warranty_public_tokens_insert on public.warranty_public_tokens as permissive for insert to authenticated with check ((( SELECT "current_role"() AS "current_role") = 'admin'::text));
--@@ 82 politica public.warranty_public_tokens.warranty_public_tokens_select
create policy warranty_public_tokens_select on public.warranty_public_tokens as permissive for select to authenticated using ((( SELECT "current_role"() AS "current_role") = ANY (ARRAY['admin'::text, 'seller'::text])));
--@@ 82 politica public.warranty_public_tokens.warranty_public_tokens_update
create policy warranty_public_tokens_update on public.warranty_public_tokens as permissive for update to authenticated using ((( SELECT "current_role"() AS "current_role") = 'admin'::text)) with check ((( SELECT "current_role"() AS "current_role") = 'admin'::text));
--@@ 82 politica storage.objects."Auth Delete CRM Media"
create policy "Auth Delete CRM Media" on storage.objects as permissive for delete to authenticated using ((bucket_id = 'crm-media'::text));
--@@ 82 politica storage.objects."Auth Delete DevImages"
create policy "Auth Delete DevImages" on storage.objects as permissive for delete to authenticated using ((bucket_id = 'device-images'::text));
--@@ 82 politica storage.objects."Auth Delete Logos"
create policy "Auth Delete Logos" on storage.objects as permissive for delete to authenticated using ((bucket_id = 'logos'::text));
--@@ 82 politica storage.objects."Auth Delete PayableDebtReceipts"
create policy "Auth Delete PayableDebtReceipts" on storage.objects as permissive for delete to authenticated using (((bucket_id = 'payable-debt-receipts'::text) AND ("current_role"() = 'admin'::text)));
--@@ 82 politica storage.objects."Auth Read DevImages"
create policy "Auth Read DevImages" on storage.objects as permissive for select to authenticated using ((bucket_id = 'device-images'::text));
--@@ 82 politica storage.objects."Auth Read Logos"
create policy "Auth Read Logos" on storage.objects as permissive for select to authenticated using ((bucket_id = 'logos'::text));
--@@ 82 politica storage.objects."Auth Read PayableDebtReceipts"
create policy "Auth Read PayableDebtReceipts" on storage.objects as permissive for select to authenticated using (((bucket_id = 'payable-debt-receipts'::text) AND ("current_role"() = 'admin'::text)));
--@@ 82 politica storage.objects."Auth Update CRM Media"
create policy "Auth Update CRM Media" on storage.objects as permissive for update to authenticated using ((bucket_id = 'crm-media'::text)) with check ((bucket_id = 'crm-media'::text));
--@@ 82 politica storage.objects."Auth Update DevImages"
create policy "Auth Update DevImages" on storage.objects as permissive for update to authenticated using ((bucket_id = 'device-images'::text)) with check ((bucket_id = 'device-images'::text));
--@@ 82 politica storage.objects."Auth Update Logos"
create policy "Auth Update Logos" on storage.objects as permissive for update to authenticated using ((bucket_id = 'logos'::text)) with check ((bucket_id = 'logos'::text));
--@@ 82 politica storage.objects."Auth Upload CRM Media"
create policy "Auth Upload CRM Media" on storage.objects as permissive for insert to authenticated with check ((bucket_id = 'crm-media'::text));
--@@ 82 politica storage.objects."Auth Upload DevImages"
create policy "Auth Upload DevImages" on storage.objects as permissive for insert to authenticated with check ((bucket_id = 'device-images'::text));
--@@ 82 politica storage.objects."Auth Upload Logos"
create policy "Auth Upload Logos" on storage.objects as permissive for insert to authenticated with check ((bucket_id = 'logos'::text));
--@@ 82 politica storage.objects."Auth Upload PayableDebtReceipts"
create policy "Auth Upload PayableDebtReceipts" on storage.objects as permissive for insert to authenticated with check (((bucket_id = 'payable-debt-receipts'::text) AND ("current_role"() = 'admin'::text)));
--@@ 82 politica storage.objects."Service role full access on receipts"
create policy "Service role full access on receipts" on storage.objects as permissive for all to service_role using ((bucket_id = 'receipts'::text)) with check ((bucket_id = 'receipts'::text));
--@@ 88 grant-schema private
grant usage on schema private to authenticated, service_role;
--@@ 88 grant-schema public
grant usage on schema public to anon, authenticated, service_role;
--@@ 89 revoke-funcao "current_role"()
revoke all on routine "current_role"() from public, anon, authenticated, service_role;
--@@ 89 revoke-funcao add_lead_note(text,text,uuid)
revoke all on routine add_lead_note(text,text,uuid) from public, anon, authenticated, service_role;
--@@ 89 revoke-funcao admin_agent_account_balances()
revoke all on routine admin_agent_account_balances() from public, anon, authenticated, service_role;
--@@ 89 revoke-funcao admin_agent_create_creditor(uuid,jsonb)
revoke all on routine admin_agent_create_creditor(uuid,jsonb) from public, anon, authenticated, service_role;
--@@ 89 revoke-funcao admin_agent_create_customer(uuid,jsonb)
revoke all on routine admin_agent_create_customer(uuid,jsonb) from public, anon, authenticated, service_role;
--@@ 89 revoke-funcao admin_agent_create_sale(uuid,jsonb)
revoke all on routine admin_agent_create_sale(uuid,jsonb) from public, anon, authenticated, service_role;
--@@ 89 revoke-funcao admin_agent_create_stock_item(uuid,jsonb)
revoke all on routine admin_agent_create_stock_item(uuid,jsonb) from public, anon, authenticated, service_role;
--@@ 89 revoke-funcao admin_agent_delete_stock_item(uuid,text)
revoke all on routine admin_agent_delete_stock_item(uuid,text) from public, anon, authenticated, service_role;
--@@ 89 revoke-funcao admin_agent_delete_transaction(uuid,text)
revoke all on routine admin_agent_delete_transaction(uuid,text) from public, anon, authenticated, service_role;
--@@ 89 revoke-funcao admin_agent_financial_summary(timestamp with time zone,timestam
revoke all on routine admin_agent_financial_summary(timestamp with time zone,timestamp with time zone) from public, anon, authenticated, service_role;
--@@ 89 revoke-funcao admin_agent_inventory_summary()
revoke all on routine admin_agent_inventory_summary() from public, anon, authenticated, service_role;
--@@ 89 revoke-funcao admin_agent_pay_payable_debt(uuid,text,numeric,text,text,text)
revoke all on routine admin_agent_pay_payable_debt(uuid,text,numeric,text,text,text) from public, anon, authenticated, service_role;
--@@ 89 revoke-funcao admin_agent_receive_debt_payment(uuid,text,numeric,text,text,te
revoke all on routine admin_agent_receive_debt_payment(uuid,text,numeric,text,text,text) from public, anon, authenticated, service_role;
--@@ 89 revoke-funcao admin_agent_register_transaction(uuid,text,text,numeric,text,te
revoke all on routine admin_agent_register_transaction(uuid,text,text,numeric,text,text) from public, anon, authenticated, service_role;
--@@ 89 revoke-funcao admin_agent_release_reservation(uuid,text,boolean)
revoke all on routine admin_agent_release_reservation(uuid,text,boolean) from public, anon, authenticated, service_role;
--@@ 89 revoke-funcao admin_agent_reserve_stock(uuid,text,jsonb)
revoke all on routine admin_agent_reserve_stock(uuid,text,jsonb) from public, anon, authenticated, service_role;
--@@ 89 revoke-funcao admin_agent_sales_summary(timestamp with time zone,timestamp wi
revoke all on routine admin_agent_sales_summary(timestamp with time zone,timestamp with time zone) from public, anon, authenticated, service_role;
--@@ 89 revoke-funcao admin_agent_transfer(uuid,numeric,text,text)
revoke all on routine admin_agent_transfer(uuid,numeric,text,text) from public, anon, authenticated, service_role;
--@@ 89 revoke-funcao admin_agent_update_customer(uuid,text,jsonb)
revoke all on routine admin_agent_update_customer(uuid,text,jsonb) from public, anon, authenticated, service_role;
--@@ 89 revoke-funcao admin_agent_update_stock_item(uuid,text,jsonb)
revoke all on routine admin_agent_update_stock_item(uuid,text,jsonb) from public, anon, authenticated, service_role;
--@@ 89 revoke-funcao admin_agent_update_transaction(uuid,text,jsonb)
revoke all on routine admin_agent_update_transaction(uuid,text,jsonb) from public, anon, authenticated, service_role;
--@@ 89 revoke-funcao admin_agent_upsert_device_catalog(uuid,jsonb)
revoke all on routine admin_agent_upsert_device_catalog(uuid,jsonb) from public, anon, authenticated, service_role;
--@@ 89 revoke-funcao admin_agent_upsert_finance_category(uuid,jsonb)
revoke all on routine admin_agent_upsert_finance_category(uuid,jsonb) from public, anon, authenticated, service_role;
--@@ 89 revoke-funcao app_set_updated_at()
revoke all on routine app_set_updated_at() from public, anon, authenticated, service_role;
--@@ 89 revoke-funcao bulk_update_leads(text,jsonb,jsonb)
revoke all on routine bulk_update_leads(text,jsonb,jsonb) from public, anon, authenticated, service_role;
--@@ 89 revoke-funcao cancel_broadcast(uuid)
revoke all on routine cancel_broadcast(uuid) from public, anon, authenticated, service_role;
--@@ 89 revoke-funcao cancel_sale(text)
revoke all on routine cancel_sale(text) from public, anon, authenticated, service_role;
--@@ 89 revoke-funcao cancel_transaction(text)
revoke all on routine cancel_transaction(text) from public, anon, authenticated, service_role;
--@@ 89 revoke-funcao claim_crm_uaz_avatar_jobs(integer,integer)
revoke all on routine claim_crm_uaz_avatar_jobs(integer,integer) from public, anon, authenticated, service_role;
--@@ 89 revoke-funcao cleanup_stale_push_subscriptions(integer,integer)
revoke all on routine cleanup_stale_push_subscriptions(integer,integer) from public, anon, authenticated, service_role;
--@@ 89 revoke-funcao compare_phones(text,text)
revoke all on routine compare_phones(text,text) from public, anon, authenticated, service_role;
--@@ 89 revoke-funcao complete_crm_uaz_avatar_job(uuid,text,integer,text,text,timesta
revoke all on routine complete_crm_uaz_avatar_job(uuid,text,integer,text,text,timestamp with time zone) from public, anon, authenticated, service_role;
--@@ 89 revoke-funcao create_sale_full(jsonb)
revoke all on routine create_sale_full(jsonb) from public, anon, authenticated, service_role;
--@@ 89 revoke-funcao crm_ad_creative_signature(text,text,jsonb)
revoke all on routine crm_ad_creative_signature(text,text,jsonb) from public, anon, authenticated, service_role;
--@@ 89 revoke-funcao crm_ad_source_app(text,jsonb)
revoke all on routine crm_ad_source_app(text,jsonb) from public, anon, authenticated, service_role;
--@@ 89 revoke-funcao crm_ads_is_probable_image_url(text)
revoke all on routine crm_ads_is_probable_image_url(text) from public, anon, authenticated, service_role;
--@@ 89 revoke-funcao crm_after_message_insert()
revoke all on routine crm_after_message_insert() from public, anon, authenticated, service_role;
--@@ 89 revoke-funcao crm_apply_channel_to_conversation(uuid,uuid,uuid,text)
revoke all on routine crm_apply_channel_to_conversation(uuid,uuid,uuid,text) from public, anon, authenticated, service_role;
--@@ 89 revoke-funcao crm_backfill_sale_ads_origin_from_phone_match(text)
revoke all on routine crm_backfill_sale_ads_origin_from_phone_match(text) from public, anon, authenticated, service_role;
--@@ 89 revoke-funcao crm_br_phone_match_key(text)
revoke all on routine crm_br_phone_match_key(text) from public, anon, authenticated, service_role;
--@@ 89 revoke-funcao crm_build_lead_summary_operational(text,text,text,text,text,tex
revoke all on routine crm_build_lead_summary_operational(text,text,text,text,text,text,text,timestamp with time zone,text,timestamp with time zone) from public, anon, authenticated, service_role;
--@@ 89 revoke-funcao crm_build_lead_summary_short(text,text,text,text)
revoke all on routine crm_build_lead_summary_short(text,text,text,text) from public, anon, authenticated, service_role;
--@@ 89 revoke-funcao crm_can_access_store(text)
revoke all on routine crm_can_access_store(text) from public, anon, authenticated, service_role;
--@@ 89 revoke-funcao crm_default_sales_stage(text)
revoke all on routine crm_default_sales_stage(text) from public, anon, authenticated, service_role;
--@@ 89 revoke-funcao crm_event_log_sync_lead_last_event()
revoke all on routine crm_event_log_sync_lead_last_event() from public, anon, authenticated, service_role;
--@@ 89 revoke-funcao crm_fanout_event_log(integer)
revoke all on routine crm_fanout_event_log(integer) from public, anon, authenticated, service_role;
--@@ 89 revoke-funcao crm_identity_fallback_phone(text,text)
revoke all on routine crm_identity_fallback_phone(text,text) from public, anon, authenticated, service_role;
--@@ 89 revoke-funcao crm_jsonb_to_text_array(jsonb)
revoke all on routine crm_jsonb_to_text_array(jsonb) from public, anon, authenticated, service_role;
--@@ 89 revoke-funcao crm_lead_first_name(text)
revoke all on routine crm_lead_first_name(text) from public, anon, authenticated, service_role;
--@@ 89 revoke-funcao crm_lead_purchase_sync_trigger()
revoke all on routine crm_lead_purchase_sync_trigger() from public, anon, authenticated, service_role;
--@@ 89 revoke-funcao crm_leads_sync_enriched_columns()
revoke all on routine crm_leads_sync_enriched_columns() from public, anon, authenticated, service_role;
--@@ 89 revoke-funcao crm_messages_sync_lead_last_message_content()
revoke all on routine crm_messages_sync_lead_last_message_content() from public, anon, authenticated, service_role;
--@@ 89 revoke-funcao crm_refresh_lead_purchase_metrics(text)
revoke all on routine crm_refresh_lead_purchase_metrics(text) from public, anon, authenticated, service_role;
--@@ 89 revoke-funcao crm_refresh_purchase_metrics_for_customer(text)
revoke all on routine crm_refresh_purchase_metrics_for_customer(text) from public, anon, authenticated, service_role;
--@@ 89 revoke-funcao crm_sales_purchase_sync_trigger()
revoke all on routine crm_sales_purchase_sync_trigger() from public, anon, authenticated, service_role;
--@@ 89 revoke-funcao crm_set_default_funnel_fields()
revoke all on routine crm_set_default_funnel_fields() from public, anon, authenticated, service_role;
--@@ 89 revoke-funcao crm_set_updated_at()
revoke all on routine crm_set_updated_at() from public, anon, authenticated, service_role;
--@@ 89 revoke-funcao crm_sync_lead_attendance_from_conversation()
revoke all on routine crm_sync_lead_attendance_from_conversation() from public, anon, authenticated, service_role;
--@@ 89 revoke-funcao crm_sync_lead_store_to_related_tables()
revoke all on routine crm_sync_lead_store_to_related_tables() from public, anon, authenticated, service_role;
--@@ 89 revoke-funcao crm_trg_attribute_lead_ad()
revoke all on routine crm_trg_attribute_lead_ad() from public, anon, authenticated, service_role;
--@@ 89 revoke-funcao crm_ui_preferences_set_updated_at()
revoke all on routine crm_ui_preferences_set_updated_at() from public, anon, authenticated, service_role;
--@@ 89 revoke-funcao crm_upsert_ad_attribution(text)
revoke all on routine crm_upsert_ad_attribution(text) from public, anon, authenticated, service_role;
--@@ 89 revoke-funcao crm_upsert_lead_by_identity(text,text,text,text,uuid,text,text,
revoke all on routine crm_upsert_lead_by_identity(text,text,text,text,uuid,text,text,text,text,text,text,text,text,text,text,text) from public, anon, authenticated, service_role;
--@@ 89 revoke-funcao crm_upsert_lead_by_identity_rpc(text,text,text,text,uuid,text,t
revoke all on routine crm_upsert_lead_by_identity_rpc(text,text,text,text,uuid,text,text,text,text,text,text,text,text,text,text,text) from public, anon, authenticated, service_role;
--@@ 89 revoke-funcao current_store_id()
revoke all on routine current_store_id() from public, anon, authenticated, service_role;
--@@ 89 revoke-funcao customer_ids_by_normalized_cpf(text)
revoke all on routine customer_ids_by_normalized_cpf(text) from public, anon, authenticated, service_role;
--@@ 89 revoke-funcao delete_debt_cascade(text)
revoke all on routine delete_debt_cascade(text) from public, anon, authenticated, service_role;
--@@ 89 revoke-funcao enqueue_crm_uaz_avatar_job(text,text,uuid,uuid,text,boolean)
revoke all on routine enqueue_crm_uaz_avatar_job(text,text,uuid,uuid,text,boolean) from public, anon, authenticated, service_role;
--@@ 89 revoke-funcao generate_composite_lead_id()
revoke all on routine generate_composite_lead_id() from public, anon, authenticated, service_role;
--@@ 89 revoke-funcao get_broadcast_stats(uuid)
revoke all on routine get_broadcast_stats(uuid) from public, anon, authenticated, service_role;
--@@ 89 revoke-funcao get_cashback_summary(text)
revoke all on routine get_cashback_summary(text) from public, anon, authenticated, service_role;
--@@ 89 revoke-funcao get_crm_ads_dashboard(text)
revoke all on routine get_crm_ads_dashboard(text) from public, anon, authenticated, service_role;
--@@ 89 revoke-funcao get_crm_statistics(text)
revoke all on routine get_crm_statistics(text) from public, anon, authenticated, service_role;
--@@ 89 revoke-funcao get_lead_custom_values(text)
revoke all on routine get_lead_custom_values(text) from public, anon, authenticated, service_role;
--@@ 89 revoke-funcao get_lead_full_data(text)
revoke all on routine get_lead_full_data(text) from public, anon, authenticated, service_role;
--@@ 89 revoke-funcao get_lead_state(text)
revoke all on routine get_lead_state(text) from public, anon, authenticated, service_role;
--@@ 89 revoke-funcao get_store_custom_fields(text)
revoke all on routine get_store_custom_fields(text) from public, anon, authenticated, service_role;
--@@ 89 revoke-funcao handle_debt_after_delete()
revoke all on routine handle_debt_after_delete() from public, anon, authenticated, service_role;
--@@ 89 revoke-funcao handle_debt_after_insert()
revoke all on routine handle_debt_after_insert() from public, anon, authenticated, service_role;
--@@ 89 revoke-funcao handle_debt_after_update()
revoke all on routine handle_debt_after_update() from public, anon, authenticated, service_role;
--@@ 89 revoke-funcao handle_debt_payment_after_delete()
revoke all on routine handle_debt_payment_after_delete() from public, anon, authenticated, service_role;
--@@ 89 revoke-funcao handle_debt_payment_after_insert()
revoke all on routine handle_debt_payment_after_insert() from public, anon, authenticated, service_role;
--@@ 89 revoke-funcao handle_payable_debt_after_delete()
revoke all on routine handle_payable_debt_after_delete() from public, anon, authenticated, service_role;
--@@ 89 revoke-funcao handle_payable_debt_after_insert()
revoke all on routine handle_payable_debt_after_insert() from public, anon, authenticated, service_role;
--@@ 89 revoke-funcao handle_payable_debt_after_update()
revoke all on routine handle_payable_debt_after_update() from public, anon, authenticated, service_role;
--@@ 89 revoke-funcao handle_payable_debt_payment_after_delete()
revoke all on routine handle_payable_debt_payment_after_delete() from public, anon, authenticated, service_role;
--@@ 89 revoke-funcao handle_payable_debt_payment_after_insert()
revoke all on routine handle_payable_debt_payment_after_insert() from public, anon, authenticated, service_role;
--@@ 89 revoke-funcao handle_payment_method_after_insert()
revoke all on routine handle_payment_method_after_insert() from public, anon, authenticated, service_role;
--@@ 89 revoke-funcao handle_sale_after_delete_cleanup()
revoke all on routine handle_sale_after_delete_cleanup() from public, anon, authenticated, service_role;
--@@ 89 revoke-funcao handle_sale_after_insert()
revoke all on routine handle_sale_after_insert() from public, anon, authenticated, service_role;
--@@ 89 revoke-funcao handle_sale_before_delete()
revoke all on routine handle_sale_before_delete() from public, anon, authenticated, service_role;
--@@ 89 revoke-funcao handle_sale_item_after_insert()
revoke all on routine handle_sale_item_after_insert() from public, anon, authenticated, service_role;
--@@ 89 revoke-funcao handle_transaction_after_delete()
revoke all on routine handle_transaction_after_delete() from public, anon, authenticated, service_role;
--@@ 89 revoke-funcao increment_unread_count(uuid,timestamp with time zone)
revoke all on routine increment_unread_count(uuid,timestamp with time zone) from public, anon, authenticated, service_role;
--@@ 89 revoke-funcao is_valid_card_fee_rates(jsonb)
revoke all on routine is_valid_card_fee_rates(jsonb) from public, anon, authenticated, service_role;
--@@ 89 revoke-funcao mark_lead_as_customer(text,text)
revoke all on routine mark_lead_as_customer(text,text) from public, anon, authenticated, service_role;
--@@ 89 revoke-funcao move_crm_lead_stage(text,text,uuid,uuid,text)
revoke all on routine move_crm_lead_stage(text,text,uuid,uuid,text) from public, anon, authenticated, service_role;
--@@ 89 revoke-funcao normalize_phone(text)
revoke all on routine normalize_phone(text) from public, anon, authenticated, service_role;
--@@ 89 revoke-funcao pdv_apply_reservation_deposit_payments(text,timestamp with time
revoke all on routine pdv_apply_reservation_deposit_payments(text,timestamp with time zone) from public, anon, authenticated, service_role;
--@@ 89 revoke-funcao pdv_assert_sale_payload(jsonb)
revoke all on routine pdv_assert_sale_payload(jsonb) from public, anon, authenticated, service_role;
--@@ 89 revoke-funcao pdv_create_sale_financial_side_effects(text)
revoke all on routine pdv_create_sale_financial_side_effects(text) from public, anon, authenticated, service_role;
--@@ 89 revoke-funcao pdv_create_sale_trade_in_rows(text,jsonb,timestamp with time zo
revoke all on routine pdv_create_sale_trade_in_rows(text,jsonb,timestamp with time zone) from public, anon, authenticated, service_role;
--@@ 89 revoke-funcao pdv_hydrate_sale_json(text)
revoke all on routine pdv_hydrate_sale_json(text) from public, anon, authenticated, service_role;
--@@ 89 revoke-funcao pdv_insert_sale_full_payload(jsonb)
revoke all on routine pdv_insert_sale_full_payload(jsonb) from public, anon, authenticated, service_role;
--@@ 89 revoke-funcao pdv_rebuild_sale_full_payload(text,jsonb)
revoke all on routine pdv_rebuild_sale_full_payload(text,jsonb) from public, anon, authenticated, service_role;
--@@ 89 revoke-funcao prepare_broadcast_recipients(uuid)
revoke all on routine prepare_broadcast_recipients(uuid) from public, anon, authenticated, service_role;
--@@ 89 revoke-funcao preview_campaign_audience(text,jsonb,integer)
revoke all on routine preview_campaign_audience(text,jsonb,integer) from public, anon, authenticated, service_role;
--@@ 89 revoke-funcao private.admin_agent_assert_admin(uuid)
revoke all on routine private.admin_agent_assert_admin(uuid) from public, anon, authenticated, service_role;
--@@ 89 revoke-funcao private.transfer_between_accounts_impl(numeric,text,text)
revoke all on routine private.transfer_between_accounts_impl(numeric,text,text) from public, anon, authenticated, service_role;
--@@ 89 revoke public.account_deletion_requests
revoke all on table public.account_deletion_requests from anon, authenticated, service_role;
--@@ 89 revoke public.admin_agent_audit_log
revoke all on table public.admin_agent_audit_log from anon, authenticated, service_role;
--@@ 89 revoke public.admin_agent_numbers
revoke all on table public.admin_agent_numbers from anon, authenticated, service_role;
--@@ 89 revoke public.admin_agent_pending_actions
revoke all on table public.admin_agent_pending_actions from anon, authenticated, service_role;
--@@ 89 revoke public.ai_turn_events
revoke all on table public.ai_turn_events from anon, authenticated, service_role;
--@@ 89 revoke public.app_role_permissions
revoke all on table public.app_role_permissions from anon, authenticated, service_role;
--@@ 89 revoke public.app_user_activity_logs
revoke all on table public.app_user_activity_logs from anon, authenticated, service_role;
--@@ 89 revoke public.app_user_activity_logs_id_seq
revoke all on sequence public.app_user_activity_logs_id_seq from anon, authenticated, service_role;
--@@ 89 revoke public.business_profile
revoke all on table public.business_profile from anon, authenticated, service_role;
--@@ 89 revoke public.card_fee_settings
revoke all on table public.card_fee_settings from anon, authenticated, service_role;
--@@ 89 revoke public.cost_history
revoke all on table public.cost_history from anon, authenticated, service_role;
--@@ 89 revoke public.costs
revoke all on table public.costs from anon, authenticated, service_role;
--@@ 89 revoke public.creditors
revoke all on table public.creditors from anon, authenticated, service_role;
--@@ 89 revoke public.crm_ai_agent_configs
revoke all on table public.crm_ai_agent_configs from anon, authenticated, service_role;
--@@ 89 revoke public.crm_ai_agent_invocations
revoke all on table public.crm_ai_agent_invocations from anon, authenticated, service_role;
--@@ 89 revoke public.crm_ai_entry_settings
revoke all on table public.crm_ai_entry_settings from anon, authenticated, service_role;
--@@ 89 revoke public.crm_attendance_scripts
revoke all on table public.crm_attendance_scripts from anon, authenticated, service_role;
--@@ 89 revoke public.crm_auth_handoffs
revoke all on table public.crm_auth_handoffs from anon, authenticated, service_role;
--@@ 89 revoke public.crm_automation_rules
revoke all on table public.crm_automation_rules from anon, authenticated, service_role;
--@@ 89 revoke public.crm_broadcast_recipients
revoke all on table public.crm_broadcast_recipients from anon, authenticated, service_role;
--@@ 89 revoke public.crm_broadcasts
revoke all on table public.crm_broadcasts from anon, authenticated, service_role;
--@@ 89 revoke public.crm_channel_store_links
revoke all on table public.crm_channel_store_links from anon, authenticated, service_role;
--@@ 89 revoke public.crm_channels
revoke all on table public.crm_channels from anon, authenticated, service_role;
--@@ 89 revoke public.crm_conversations
revoke all on table public.crm_conversations from anon, authenticated, service_role;
--@@ 89 revoke public.crm_custom_fields
revoke all on table public.crm_custom_fields from anon, authenticated, service_role;
--@@ 89 revoke public.crm_dispatch_runtime
revoke all on table public.crm_dispatch_runtime from anon, authenticated, service_role;
--@@ 89 revoke public.crm_event_log
revoke all on table public.crm_event_log from anon, authenticated, service_role;
--@@ 89 revoke public.crm_filter_views
revoke all on table public.crm_filter_views from anon, authenticated, service_role;
--@@ 89 revoke public.crm_follow_up_tracker
revoke all on table public.crm_follow_up_tracker from anon, authenticated, service_role;
--@@ 89 revoke public.crm_funnel_stages
revoke all on table public.crm_funnel_stages from anon, authenticated, service_role;
--@@ 89 revoke public.crm_funnels
revoke all on table public.crm_funnels from anon, authenticated, service_role;
--@@ 89 revoke public.crm_instagram_comment_events
revoke all on table public.crm_instagram_comment_events from anon, authenticated, service_role;
--@@ 89 revoke public.crm_instagram_media_snapshots
revoke all on table public.crm_instagram_media_snapshots from anon, authenticated, service_role;
--@@ 89 revoke public.crm_lead_custom_field_values
revoke all on table public.crm_lead_custom_field_values from anon, authenticated, service_role;
--@@ 89 revoke public.crm_lead_identities
revoke all on table public.crm_lead_identities from anon, authenticated, service_role;
--@@ 89 revoke public.crm_lead_stage_history
revoke all on table public.crm_lead_stage_history from anon, authenticated, service_role;
--@@ 89 revoke public.crm_leads
revoke all on table public.crm_leads from anon, authenticated, service_role;
--@@ 89 revoke public.crm_message_templates
revoke all on table public.crm_message_templates from anon, authenticated, service_role;
--@@ 89 revoke public.crm_messages
revoke all on table public.crm_messages from anon, authenticated, service_role;
--@@ 89 revoke public.crm_meta_ads_attributions
revoke all on table public.crm_meta_ads_attributions from anon, authenticated, service_role;
--@@ 89 revoke public.crm_meta_ads_groups
revoke all on table public.crm_meta_ads_groups from anon, authenticated, service_role;
--@@ 89 revoke public.crm_public_registration_links
revoke all on table public.crm_public_registration_links from anon, authenticated, service_role;
--@@ 89 revoke public.crm_scheduled_messages
revoke all on table public.crm_scheduled_messages from anon, authenticated, service_role;
--@@ 89 revoke public.crm_settings
revoke all on table public.crm_settings from anon, authenticated, service_role;
--@@ 89 revoke public.crm_uaz_avatar_jobs
revoke all on table public.crm_uaz_avatar_jobs from anon, authenticated, service_role;
--@@ 89 revoke public.crm_ui_preferences
revoke all on table public.crm_ui_preferences from anon, authenticated, service_role;
--@@ 89 revoke public.crm_utm_config
revoke all on table public.crm_utm_config from anon, authenticated, service_role;
--@@ 89 revoke public.crm_webhook_subscriptions
revoke all on table public.crm_webhook_subscriptions from anon, authenticated, service_role;
--@@ 89 revoke public.customers
revoke all on table public.customers from anon, authenticated, service_role;
--@@ 89 revoke public.debt_payments
revoke all on table public.debt_payments from anon, authenticated, service_role;
--@@ 89 revoke public.debts
revoke all on table public.debts from anon, authenticated, service_role;
--@@ 89 revoke public.device_catalog
revoke all on table public.device_catalog from anon, authenticated, service_role;
--@@ 89 revoke public.finance_categories
revoke all on table public.finance_categories from anon, authenticated, service_role;
--@@ 89 revoke public.lead_state
revoke all on table public.lead_state from anon, authenticated, service_role;
--@@ 89 revoke public.parts_inventory
revoke all on table public.parts_inventory from anon, authenticated, service_role;
--@@ 89 revoke public.payable_debt_payments
revoke all on table public.payable_debt_payments from anon, authenticated, service_role;
--@@ 89 revoke public.payable_debts
revoke all on table public.payable_debts from anon, authenticated, service_role;
--@@ 89 revoke public.payment_methods
revoke all on table public.payment_methods from anon, authenticated, service_role;
--@@ 89 revoke public.push_subscriptions
revoke all on table public.push_subscriptions from anon, authenticated, service_role;
--@@ 89 revoke public.reservation_message_settings
revoke all on table public.reservation_message_settings from anon, authenticated, service_role;
--@@ 89 revoke public.sale_items
revoke all on table public.sale_items from anon, authenticated, service_role;
--@@ 89 revoke public.sale_trade_in_items
revoke all on table public.sale_trade_in_items from anon, authenticated, service_role;
--@@ 89 revoke public.sales
revoke all on table public.sales from anon, authenticated, service_role;
--@@ 89 revoke public.sales_sale_number_seq
revoke all on sequence public.sales_sale_number_seq from anon, authenticated, service_role;
--@@ 89 revoke public.sellers
revoke all on table public.sellers from anon, authenticated, service_role;
--@@ 89 revoke public.simulator_trade_in_adjustments
revoke all on table public.simulator_trade_in_adjustments from anon, authenticated, service_role;
--@@ 89 revoke public.simulator_trade_in_values
revoke all on table public.simulator_trade_in_values from anon, authenticated, service_role;
--@@ 89 revoke public.stock_items
revoke all on table public.stock_items from anon, authenticated, service_role;
--@@ 89 revoke public.stock_reservations
revoke all on table public.stock_reservations from anon, authenticated, service_role;
--@@ 89 revoke public.stores
revoke all on table public.stores from anon, authenticated, service_role;
--@@ 89 revoke public.transactions
revoke all on table public.transactions from anon, authenticated, service_role;
--@@ 89 revoke public.user_access_roles
revoke all on table public.user_access_roles from anon, authenticated, service_role;
--@@ 89 revoke public.user_consents
revoke all on table public.user_consents from anon, authenticated, service_role;
--@@ 89 revoke public.user_profiles
revoke all on table public.user_profiles from anon, authenticated, service_role;
--@@ 89 revoke public.warranty_public_tokens
revoke all on table public.warranty_public_tokens from anon, authenticated, service_role;
--@@ 89 revoke-funcao record_ai_turn_event(text,text,uuid,text,text,integer,jsonb,jso
revoke all on routine record_ai_turn_event(text,text,uuid,text,text,integer,jsonb,jsonb) from public, anon, authenticated, service_role;
--@@ 89 revoke-funcao release_stock_reservation(text,boolean)
revoke all on routine release_stock_reservation(text,boolean) from public, anon, authenticated, service_role;
--@@ 89 revoke-funcao remove_stock_item_cost(text)
revoke all on routine remove_stock_item_cost(text) from public, anon, authenticated, service_role;
--@@ 89 revoke-funcao reservation_deposit_account(text)
revoke all on routine reservation_deposit_account(text) from public, anon, authenticated, service_role;
--@@ 89 revoke-funcao reserve_stock_item(text,jsonb)
revoke all on routine reserve_stock_item(text,jsonb) from public, anon, authenticated, service_role;
--@@ 89 revoke-funcao resolve_crm_default_store_id()
revoke all on routine resolve_crm_default_store_id() from public, anon, authenticated, service_role;
--@@ 89 revoke-funcao resolve_crm_lead_for_sale(text,text,text,boolean)
revoke all on routine resolve_crm_lead_for_sale(text,text,text,boolean) from public, anon, authenticated, service_role;
--@@ 89 revoke-funcao sales_backfill_ads_origin_from_phone_match()
revoke all on routine sales_backfill_ads_origin_from_phone_match() from public, anon, authenticated, service_role;
--@@ 89 revoke-funcao sales_set_crm_lead_id()
revoke all on routine sales_set_crm_lead_id() from public, anon, authenticated, service_role;
--@@ 89 revoke-funcao search_crm_messages(text,text,integer)
revoke all on routine search_crm_messages(text,text,integer) from public, anon, authenticated, service_role;
--@@ 89 revoke-funcao search_leads(text,jsonb,integer,integer)
revoke all on routine search_leads(text,jsonb,integer,integer) from public, anon, authenticated, service_role;
--@@ 89 revoke-funcao set_lead_custom_field(text,uuid,jsonb)
revoke all on routine set_lead_custom_field(text,uuid,jsonb) from public, anon, authenticated, service_role;
--@@ 89 revoke-funcao sync_crm_campaign_tag_mappings(text,jsonb)
revoke all on routine sync_crm_campaign_tag_mappings(text,jsonb) from public, anon, authenticated, service_role;
--@@ 89 revoke-funcao test_webhook_subscription(uuid)
revoke all on routine test_webhook_subscription(uuid) from public, anon, authenticated, service_role;
--@@ 89 revoke-funcao tg_set_card_fee_settings_updated_at()
revoke all on routine tg_set_card_fee_settings_updated_at() from public, anon, authenticated, service_role;
--@@ 89 revoke-funcao tg_set_creditors_updated_at()
revoke all on routine tg_set_creditors_updated_at() from public, anon, authenticated, service_role;
--@@ 89 revoke-funcao tg_set_device_catalog_updated_at()
revoke all on routine tg_set_device_catalog_updated_at() from public, anon, authenticated, service_role;
--@@ 89 revoke-funcao tg_set_finance_categories_updated_at()
revoke all on routine tg_set_finance_categories_updated_at() from public, anon, authenticated, service_role;
--@@ 89 revoke-funcao tg_set_lead_state_updated_at()
revoke all on routine tg_set_lead_state_updated_at() from public, anon, authenticated, service_role;
--@@ 89 revoke-funcao tg_set_parts_inventory_updated_at()
revoke all on routine tg_set_parts_inventory_updated_at() from public, anon, authenticated, service_role;
--@@ 89 revoke-funcao tg_set_payable_debts_updated_at()
revoke all on routine tg_set_payable_debts_updated_at() from public, anon, authenticated, service_role;
--@@ 89 revoke-funcao tg_set_simulator_trade_in_updated_at()
revoke all on routine tg_set_simulator_trade_in_updated_at() from public, anon, authenticated, service_role;
--@@ 89 revoke-funcao tg_set_stock_reservations_updated_at()
revoke all on routine tg_set_stock_reservations_updated_at() from public, anon, authenticated, service_role;
--@@ 89 revoke-funcao touch_reservation_message_settings()
revoke all on routine touch_reservation_message_settings() from public, anon, authenticated, service_role;
--@@ 89 revoke-funcao transfer_between_accounts(numeric,text,text)
revoke all on routine transfer_between_accounts(numeric,text,text) from public, anon, authenticated, service_role;
--@@ 89 revoke-funcao transfer_lead_store(text,text)
revoke all on routine transfer_lead_store(text,text) from public, anon, authenticated, service_role;
--@@ 89 revoke-funcao trigger_new_lead_avatar()
revoke all on routine trigger_new_lead_avatar() from public, anon, authenticated, service_role;
--@@ 89 revoke-funcao update_campaign_delivery_metrics(uuid,jsonb)
revoke all on routine update_campaign_delivery_metrics(uuid,jsonb) from public, anon, authenticated, service_role;
--@@ 89 revoke-funcao update_lead_basic_data(text,text,text,jsonb)
revoke all on routine update_lead_basic_data(text,text,text,jsonb) from public, anon, authenticated, service_role;
--@@ 89 revoke-funcao update_lead_funnel(text,text,text,text,uuid)
revoke all on routine update_lead_funnel(text,text,text,text,uuid) from public, anon, authenticated, service_role;
--@@ 89 revoke-funcao update_lead_memory(text,text,text)
revoke all on routine update_lead_memory(text,text,text) from public, anon, authenticated, service_role;
--@@ 89 revoke-funcao update_sale_full(text,jsonb)
revoke all on routine update_sale_full(text,jsonb) from public, anon, authenticated, service_role;
--@@ 89 revoke-funcao upsert_crm_lead(text,text,text,text,text,uuid,text,text,text,te
revoke all on routine upsert_crm_lead(text,text,text,text,text,uuid,text,text,text,text,text,text,text,text) from public, anon, authenticated, service_role;
--@@ 89 revoke-funcao upsert_lead_state(text,jsonb)
revoke all on routine upsert_lead_state(text,jsonb) from public, anon, authenticated, service_role;
--@@ 89 revoke-funcao upsert_repasse_commerce_state(text,bigint,jsonb,jsonb,jsonb)
revoke all on routine upsert_repasse_commerce_state(text,bigint,jsonb,jsonb,jsonb) from public, anon, authenticated, service_role;
--@@ 90 grant-funcao "current_role"()→anon
grant execute on routine "current_role"() to anon;
--@@ 90 grant-funcao "current_role"()→authenticated
grant execute on routine "current_role"() to authenticated;
--@@ 90 grant-funcao "current_role"()→service_role
grant execute on routine "current_role"() to service_role;
--@@ 90 grant-funcao add_lead_note(text,text,uuid)→anon
grant execute on routine add_lead_note(text,text,uuid) to anon;
--@@ 90 grant-funcao add_lead_note(text,text,uuid)→authenticated
grant execute on routine add_lead_note(text,text,uuid) to authenticated;
--@@ 90 grant-funcao add_lead_note(text,text,uuid)→public
grant execute on routine add_lead_note(text,text,uuid) to public;
--@@ 90 grant-funcao add_lead_note(text,text,uuid)→service_role
grant execute on routine add_lead_note(text,text,uuid) to service_role;
--@@ 90 grant-funcao admin_agent_account_balances()→service_role
grant execute on routine admin_agent_account_balances() to service_role;
--@@ 90 grant-funcao admin_agent_create_creditor(uuid,jsonb)→service_role
grant execute on routine admin_agent_create_creditor(uuid,jsonb) to service_role;
--@@ 90 grant-funcao admin_agent_create_customer(uuid,jsonb)→service_role
grant execute on routine admin_agent_create_customer(uuid,jsonb) to service_role;
--@@ 90 grant-funcao admin_agent_create_sale(uuid,jsonb)→service_role
grant execute on routine admin_agent_create_sale(uuid,jsonb) to service_role;
--@@ 90 grant-funcao admin_agent_create_stock_item(uuid,jsonb)→service_role
grant execute on routine admin_agent_create_stock_item(uuid,jsonb) to service_role;
--@@ 90 grant-funcao admin_agent_delete_stock_item(uuid,text)→service_role
grant execute on routine admin_agent_delete_stock_item(uuid,text) to service_role;
--@@ 90 grant-funcao admin_agent_delete_transaction(uuid,text)→service_role
grant execute on routine admin_agent_delete_transaction(uuid,text) to service_role;
--@@ 90 grant-funcao admin_agent_financial_summary(timestamp with time zone,timestam
grant execute on routine admin_agent_financial_summary(timestamp with time zone,timestamp with time zone) to service_role;
--@@ 90 grant-funcao admin_agent_inventory_summary()→service_role
grant execute on routine admin_agent_inventory_summary() to service_role;
--@@ 90 grant-funcao admin_agent_pay_payable_debt(uuid,text,numeric,text,text,text)
grant execute on routine admin_agent_pay_payable_debt(uuid,text,numeric,text,text,text) to service_role;
--@@ 90 grant-funcao admin_agent_receive_debt_payment(uuid,text,numeric,text,text,te
grant execute on routine admin_agent_receive_debt_payment(uuid,text,numeric,text,text,text) to service_role;
--@@ 90 grant-funcao admin_agent_register_transaction(uuid,text,text,numeric,text,te
grant execute on routine admin_agent_register_transaction(uuid,text,text,numeric,text,text) to service_role;
--@@ 90 grant-funcao admin_agent_release_reservation(uuid,text,boolean)→service_ro
grant execute on routine admin_agent_release_reservation(uuid,text,boolean) to service_role;
--@@ 90 grant-funcao admin_agent_reserve_stock(uuid,text,jsonb)→service_role
grant execute on routine admin_agent_reserve_stock(uuid,text,jsonb) to service_role;
--@@ 90 grant-funcao admin_agent_sales_summary(timestamp with time zone,timestamp wi
grant execute on routine admin_agent_sales_summary(timestamp with time zone,timestamp with time zone) to service_role;
--@@ 90 grant-funcao admin_agent_transfer(uuid,numeric,text,text)→service_role
grant execute on routine admin_agent_transfer(uuid,numeric,text,text) to service_role;
--@@ 90 grant-funcao admin_agent_update_customer(uuid,text,jsonb)→service_role
grant execute on routine admin_agent_update_customer(uuid,text,jsonb) to service_role;
--@@ 90 grant-funcao admin_agent_update_stock_item(uuid,text,jsonb)→service_role
grant execute on routine admin_agent_update_stock_item(uuid,text,jsonb) to service_role;
--@@ 90 grant-funcao admin_agent_update_transaction(uuid,text,jsonb)→service_role
grant execute on routine admin_agent_update_transaction(uuid,text,jsonb) to service_role;
--@@ 90 grant-funcao admin_agent_upsert_device_catalog(uuid,jsonb)→service_role
grant execute on routine admin_agent_upsert_device_catalog(uuid,jsonb) to service_role;
--@@ 90 grant-funcao admin_agent_upsert_finance_category(uuid,jsonb)→service_role
grant execute on routine admin_agent_upsert_finance_category(uuid,jsonb) to service_role;
--@@ 90 grant-funcao app_set_updated_at()→anon
grant execute on routine app_set_updated_at() to anon;
--@@ 90 grant-funcao app_set_updated_at()→authenticated
grant execute on routine app_set_updated_at() to authenticated;
--@@ 90 grant-funcao app_set_updated_at()→public
grant execute on routine app_set_updated_at() to public;
--@@ 90 grant-funcao app_set_updated_at()→service_role
grant execute on routine app_set_updated_at() to service_role;
--@@ 90 grant-funcao bulk_update_leads(text,jsonb,jsonb)→anon
grant execute on routine bulk_update_leads(text,jsonb,jsonb) to anon;
--@@ 90 grant-funcao bulk_update_leads(text,jsonb,jsonb)→authenticated
grant execute on routine bulk_update_leads(text,jsonb,jsonb) to authenticated;
--@@ 90 grant-funcao bulk_update_leads(text,jsonb,jsonb)→public
grant execute on routine bulk_update_leads(text,jsonb,jsonb) to public;
--@@ 90 grant-funcao bulk_update_leads(text,jsonb,jsonb)→service_role
grant execute on routine bulk_update_leads(text,jsonb,jsonb) to service_role;
--@@ 90 grant-funcao cancel_broadcast(uuid)→anon
grant execute on routine cancel_broadcast(uuid) to anon;
--@@ 90 grant-funcao cancel_broadcast(uuid)→authenticated
grant execute on routine cancel_broadcast(uuid) to authenticated;
--@@ 90 grant-funcao cancel_broadcast(uuid)→public
grant execute on routine cancel_broadcast(uuid) to public;
--@@ 90 grant-funcao cancel_broadcast(uuid)→service_role
grant execute on routine cancel_broadcast(uuid) to service_role;
--@@ 90 grant-funcao cancel_sale(text)→authenticated
grant execute on routine cancel_sale(text) to authenticated;
--@@ 90 grant-funcao cancel_sale(text)→service_role
grant execute on routine cancel_sale(text) to service_role;
--@@ 90 grant-funcao cancel_transaction(text)→anon
grant execute on routine cancel_transaction(text) to anon;
--@@ 90 grant-funcao cancel_transaction(text)→authenticated
grant execute on routine cancel_transaction(text) to authenticated;
--@@ 90 grant-funcao cancel_transaction(text)→public
grant execute on routine cancel_transaction(text) to public;
--@@ 90 grant-funcao cancel_transaction(text)→service_role
grant execute on routine cancel_transaction(text) to service_role;
--@@ 90 grant-funcao claim_crm_uaz_avatar_jobs(integer,integer)→service_role
grant execute on routine claim_crm_uaz_avatar_jobs(integer,integer) to service_role;
--@@ 90 grant-funcao cleanup_stale_push_subscriptions(integer,integer)→service_rol
grant execute on routine cleanup_stale_push_subscriptions(integer,integer) to service_role;
--@@ 90 grant-funcao compare_phones(text,text)→anon
grant execute on routine compare_phones(text,text) to anon;
--@@ 90 grant-funcao compare_phones(text,text)→authenticated
grant execute on routine compare_phones(text,text) to authenticated;
--@@ 90 grant-funcao compare_phones(text,text)→public
grant execute on routine compare_phones(text,text) to public;
--@@ 90 grant-funcao compare_phones(text,text)→service_role
grant execute on routine compare_phones(text,text) to service_role;
--@@ 90 grant-funcao complete_crm_uaz_avatar_job(uuid,text,integer,text,text,timesta
grant execute on routine complete_crm_uaz_avatar_job(uuid,text,integer,text,text,timestamp with time zone) to service_role;
--@@ 90 grant-funcao create_sale_full(jsonb)→authenticated
grant execute on routine create_sale_full(jsonb) to authenticated;
--@@ 90 grant-funcao create_sale_full(jsonb)→service_role
grant execute on routine create_sale_full(jsonb) to service_role;
--@@ 90 grant-funcao crm_ad_creative_signature(text,text,jsonb)→anon
grant execute on routine crm_ad_creative_signature(text,text,jsonb) to anon;
--@@ 90 grant-funcao crm_ad_creative_signature(text,text,jsonb)→authenticated
grant execute on routine crm_ad_creative_signature(text,text,jsonb) to authenticated;
--@@ 90 grant-funcao crm_ad_creative_signature(text,text,jsonb)→public
grant execute on routine crm_ad_creative_signature(text,text,jsonb) to public;
--@@ 90 grant-funcao crm_ad_creative_signature(text,text,jsonb)→service_role
grant execute on routine crm_ad_creative_signature(text,text,jsonb) to service_role;
--@@ 90 grant-funcao crm_ad_source_app(text,jsonb)→anon
grant execute on routine crm_ad_source_app(text,jsonb) to anon;
--@@ 90 grant-funcao crm_ad_source_app(text,jsonb)→authenticated
grant execute on routine crm_ad_source_app(text,jsonb) to authenticated;
--@@ 90 grant-funcao crm_ad_source_app(text,jsonb)→public
grant execute on routine crm_ad_source_app(text,jsonb) to public;
--@@ 90 grant-funcao crm_ad_source_app(text,jsonb)→service_role
grant execute on routine crm_ad_source_app(text,jsonb) to service_role;
--@@ 90 grant-funcao crm_ads_is_probable_image_url(text)→service_role
grant execute on routine crm_ads_is_probable_image_url(text) to service_role;
--@@ 90 grant-funcao crm_after_message_insert()→anon
grant execute on routine crm_after_message_insert() to anon;
--@@ 90 grant-funcao crm_after_message_insert()→authenticated
grant execute on routine crm_after_message_insert() to authenticated;
--@@ 90 grant-funcao crm_after_message_insert()→public
grant execute on routine crm_after_message_insert() to public;
--@@ 90 grant-funcao crm_after_message_insert()→service_role
grant execute on routine crm_after_message_insert() to service_role;
--@@ 90 grant-funcao crm_apply_channel_to_conversation(uuid,uuid,uuid,text)→anon
grant execute on routine crm_apply_channel_to_conversation(uuid,uuid,uuid,text) to anon;
--@@ 90 grant-funcao crm_apply_channel_to_conversation(uuid,uuid,uuid,text)→authen
grant execute on routine crm_apply_channel_to_conversation(uuid,uuid,uuid,text) to authenticated;
--@@ 90 grant-funcao crm_apply_channel_to_conversation(uuid,uuid,uuid,text)→public
grant execute on routine crm_apply_channel_to_conversation(uuid,uuid,uuid,text) to public;
--@@ 90 grant-funcao crm_apply_channel_to_conversation(uuid,uuid,uuid,text)→servic
grant execute on routine crm_apply_channel_to_conversation(uuid,uuid,uuid,text) to service_role;
--@@ 90 grant-funcao crm_backfill_sale_ads_origin_from_phone_match(text)→service_r
grant execute on routine crm_backfill_sale_ads_origin_from_phone_match(text) to service_role;
--@@ 90 grant-funcao crm_br_phone_match_key(text)→service_role
grant execute on routine crm_br_phone_match_key(text) to service_role;
--@@ 90 grant-funcao crm_build_lead_summary_operational(text,text,text,text,text,tex
grant execute on routine crm_build_lead_summary_operational(text,text,text,text,text,text,text,timestamp with time zone,text,timestamp with time zone) to service_role;
--@@ 90 grant-funcao crm_build_lead_summary_short(text,text,text,text)→service_rol
grant execute on routine crm_build_lead_summary_short(text,text,text,text) to service_role;
--@@ 90 grant-funcao crm_can_access_store(text)→anon
grant execute on routine crm_can_access_store(text) to anon;
--@@ 90 grant-funcao crm_can_access_store(text)→authenticated
grant execute on routine crm_can_access_store(text) to authenticated;
--@@ 90 grant-funcao crm_can_access_store(text)→service_role
grant execute on routine crm_can_access_store(text) to service_role;
--@@ 90 grant-funcao crm_default_sales_stage(text)→service_role
grant execute on routine crm_default_sales_stage(text) to service_role;
--@@ 90 grant-funcao crm_event_log_sync_lead_last_event()→service_role
grant execute on routine crm_event_log_sync_lead_last_event() to service_role;
--@@ 90 grant-funcao crm_fanout_event_log(integer)→anon
grant execute on routine crm_fanout_event_log(integer) to anon;
--@@ 90 grant-funcao crm_fanout_event_log(integer)→authenticated
grant execute on routine crm_fanout_event_log(integer) to authenticated;
--@@ 90 grant-funcao crm_fanout_event_log(integer)→public
grant execute on routine crm_fanout_event_log(integer) to public;
--@@ 90 grant-funcao crm_fanout_event_log(integer)→service_role
grant execute on routine crm_fanout_event_log(integer) to service_role;
--@@ 90 grant-funcao crm_identity_fallback_phone(text,text)→anon
grant execute on routine crm_identity_fallback_phone(text,text) to anon;
--@@ 90 grant-funcao crm_identity_fallback_phone(text,text)→authenticated
grant execute on routine crm_identity_fallback_phone(text,text) to authenticated;
--@@ 90 grant-funcao crm_identity_fallback_phone(text,text)→public
grant execute on routine crm_identity_fallback_phone(text,text) to public;
--@@ 90 grant-funcao crm_identity_fallback_phone(text,text)→service_role
grant execute on routine crm_identity_fallback_phone(text,text) to service_role;
--@@ 90 grant-funcao crm_jsonb_to_text_array(jsonb)→anon
grant execute on routine crm_jsonb_to_text_array(jsonb) to anon;
--@@ 90 grant-funcao crm_jsonb_to_text_array(jsonb)→authenticated
grant execute on routine crm_jsonb_to_text_array(jsonb) to authenticated;
--@@ 90 grant-funcao crm_jsonb_to_text_array(jsonb)→public
grant execute on routine crm_jsonb_to_text_array(jsonb) to public;
--@@ 90 grant-funcao crm_jsonb_to_text_array(jsonb)→service_role
grant execute on routine crm_jsonb_to_text_array(jsonb) to service_role;
--@@ 90 grant-funcao crm_lead_first_name(text)→service_role
grant execute on routine crm_lead_first_name(text) to service_role;
--@@ 90 grant-funcao crm_lead_purchase_sync_trigger()→anon
grant execute on routine crm_lead_purchase_sync_trigger() to anon;
--@@ 90 grant-funcao crm_lead_purchase_sync_trigger()→authenticated
grant execute on routine crm_lead_purchase_sync_trigger() to authenticated;
--@@ 90 grant-funcao crm_lead_purchase_sync_trigger()→public
grant execute on routine crm_lead_purchase_sync_trigger() to public;
--@@ 90 grant-funcao crm_lead_purchase_sync_trigger()→service_role
grant execute on routine crm_lead_purchase_sync_trigger() to service_role;
--@@ 90 grant-funcao crm_leads_sync_enriched_columns()→service_role
grant execute on routine crm_leads_sync_enriched_columns() to service_role;
--@@ 90 grant-funcao crm_messages_sync_lead_last_message_content()→service_role
grant execute on routine crm_messages_sync_lead_last_message_content() to service_role;
--@@ 90 grant-funcao crm_refresh_lead_purchase_metrics(text)→service_role
grant execute on routine crm_refresh_lead_purchase_metrics(text) to service_role;
--@@ 90 grant-funcao crm_refresh_purchase_metrics_for_customer(text)→service_role
grant execute on routine crm_refresh_purchase_metrics_for_customer(text) to service_role;
--@@ 90 grant-funcao crm_sales_purchase_sync_trigger()→service_role
grant execute on routine crm_sales_purchase_sync_trigger() to service_role;
--@@ 90 grant-funcao crm_set_default_funnel_fields()→anon
grant execute on routine crm_set_default_funnel_fields() to anon;
--@@ 90 grant-funcao crm_set_default_funnel_fields()→authenticated
grant execute on routine crm_set_default_funnel_fields() to authenticated;
--@@ 90 grant-funcao crm_set_default_funnel_fields()→public
grant execute on routine crm_set_default_funnel_fields() to public;
--@@ 90 grant-funcao crm_set_default_funnel_fields()→service_role
grant execute on routine crm_set_default_funnel_fields() to service_role;
--@@ 90 grant-funcao crm_set_updated_at()→anon
grant execute on routine crm_set_updated_at() to anon;
--@@ 90 grant-funcao crm_set_updated_at()→authenticated
grant execute on routine crm_set_updated_at() to authenticated;
--@@ 90 grant-funcao crm_set_updated_at()→public
grant execute on routine crm_set_updated_at() to public;
--@@ 90 grant-funcao crm_set_updated_at()→service_role
grant execute on routine crm_set_updated_at() to service_role;
--@@ 90 grant-funcao crm_sync_lead_attendance_from_conversation()→anon
grant execute on routine crm_sync_lead_attendance_from_conversation() to anon;
--@@ 90 grant-funcao crm_sync_lead_attendance_from_conversation()→authenticated
grant execute on routine crm_sync_lead_attendance_from_conversation() to authenticated;
--@@ 90 grant-funcao crm_sync_lead_attendance_from_conversation()→public
grant execute on routine crm_sync_lead_attendance_from_conversation() to public;
--@@ 90 grant-funcao crm_sync_lead_attendance_from_conversation()→service_role
grant execute on routine crm_sync_lead_attendance_from_conversation() to service_role;
--@@ 90 grant-funcao crm_sync_lead_store_to_related_tables()→anon
grant execute on routine crm_sync_lead_store_to_related_tables() to anon;
--@@ 90 grant-funcao crm_sync_lead_store_to_related_tables()→authenticated
grant execute on routine crm_sync_lead_store_to_related_tables() to authenticated;
--@@ 90 grant-funcao crm_sync_lead_store_to_related_tables()→public
grant execute on routine crm_sync_lead_store_to_related_tables() to public;
--@@ 90 grant-funcao crm_sync_lead_store_to_related_tables()→service_role
grant execute on routine crm_sync_lead_store_to_related_tables() to service_role;
--@@ 90 grant-funcao crm_trg_attribute_lead_ad()→anon
grant execute on routine crm_trg_attribute_lead_ad() to anon;
--@@ 90 grant-funcao crm_trg_attribute_lead_ad()→authenticated
grant execute on routine crm_trg_attribute_lead_ad() to authenticated;
--@@ 90 grant-funcao crm_trg_attribute_lead_ad()→public
grant execute on routine crm_trg_attribute_lead_ad() to public;
--@@ 90 grant-funcao crm_trg_attribute_lead_ad()→service_role
grant execute on routine crm_trg_attribute_lead_ad() to service_role;
--@@ 90 grant-funcao crm_ui_preferences_set_updated_at()→anon
grant execute on routine crm_ui_preferences_set_updated_at() to anon;
--@@ 90 grant-funcao crm_ui_preferences_set_updated_at()→authenticated
grant execute on routine crm_ui_preferences_set_updated_at() to authenticated;
--@@ 90 grant-funcao crm_ui_preferences_set_updated_at()→public
grant execute on routine crm_ui_preferences_set_updated_at() to public;
--@@ 90 grant-funcao crm_ui_preferences_set_updated_at()→service_role
grant execute on routine crm_ui_preferences_set_updated_at() to service_role;
--@@ 90 grant-funcao crm_upsert_ad_attribution(text)→anon
grant execute on routine crm_upsert_ad_attribution(text) to anon;
--@@ 90 grant-funcao crm_upsert_ad_attribution(text)→authenticated
grant execute on routine crm_upsert_ad_attribution(text) to authenticated;
--@@ 90 grant-funcao crm_upsert_ad_attribution(text)→public
grant execute on routine crm_upsert_ad_attribution(text) to public;
--@@ 90 grant-funcao crm_upsert_ad_attribution(text)→service_role
grant execute on routine crm_upsert_ad_attribution(text) to service_role;
--@@ 90 grant-funcao crm_upsert_lead_by_identity(text,text,text,text,uuid,text,text,
grant execute on routine crm_upsert_lead_by_identity(text,text,text,text,uuid,text,text,text,text,text,text,text,text,text,text,text) to anon;
--@@ 90 grant-funcao crm_upsert_lead_by_identity(text,text,text,text,uuid,text,text,
grant execute on routine crm_upsert_lead_by_identity(text,text,text,text,uuid,text,text,text,text,text,text,text,text,text,text,text) to authenticated;
--@@ 90 grant-funcao crm_upsert_lead_by_identity(text,text,text,text,uuid,text,text,
grant execute on routine crm_upsert_lead_by_identity(text,text,text,text,uuid,text,text,text,text,text,text,text,text,text,text,text) to public;
--@@ 90 grant-funcao crm_upsert_lead_by_identity(text,text,text,text,uuid,text,text,
grant execute on routine crm_upsert_lead_by_identity(text,text,text,text,uuid,text,text,text,text,text,text,text,text,text,text,text) to service_role;
--@@ 90 grant-funcao crm_upsert_lead_by_identity_rpc(text,text,text,text,uuid,text,t
grant execute on routine crm_upsert_lead_by_identity_rpc(text,text,text,text,uuid,text,text,text,text,text,text,text,text,text,text,text) to anon;
--@@ 90 grant-funcao crm_upsert_lead_by_identity_rpc(text,text,text,text,uuid,text,t
grant execute on routine crm_upsert_lead_by_identity_rpc(text,text,text,text,uuid,text,text,text,text,text,text,text,text,text,text,text) to authenticated;
--@@ 90 grant-funcao crm_upsert_lead_by_identity_rpc(text,text,text,text,uuid,text,t
grant execute on routine crm_upsert_lead_by_identity_rpc(text,text,text,text,uuid,text,text,text,text,text,text,text,text,text,text,text) to public;
--@@ 90 grant-funcao crm_upsert_lead_by_identity_rpc(text,text,text,text,uuid,text,t
grant execute on routine crm_upsert_lead_by_identity_rpc(text,text,text,text,uuid,text,text,text,text,text,text,text,text,text,text,text) to service_role;
--@@ 90 grant-funcao current_store_id()→anon
grant execute on routine current_store_id() to anon;
--@@ 90 grant-funcao current_store_id()→authenticated
grant execute on routine current_store_id() to authenticated;
--@@ 90 grant-funcao current_store_id()→service_role
grant execute on routine current_store_id() to service_role;
--@@ 90 grant-funcao customer_ids_by_normalized_cpf(text)→anon
grant execute on routine customer_ids_by_normalized_cpf(text) to anon;
--@@ 90 grant-funcao customer_ids_by_normalized_cpf(text)→authenticated
grant execute on routine customer_ids_by_normalized_cpf(text) to authenticated;
--@@ 90 grant-funcao customer_ids_by_normalized_cpf(text)→public
grant execute on routine customer_ids_by_normalized_cpf(text) to public;
--@@ 90 grant-funcao customer_ids_by_normalized_cpf(text)→service_role
grant execute on routine customer_ids_by_normalized_cpf(text) to service_role;
--@@ 90 grant-funcao delete_debt_cascade(text)→authenticated
grant execute on routine delete_debt_cascade(text) to authenticated;
--@@ 90 grant-funcao delete_debt_cascade(text)→service_role
grant execute on routine delete_debt_cascade(text) to service_role;
--@@ 90 grant-funcao enqueue_crm_uaz_avatar_job(text,text,uuid,uuid,text,boolean)→
grant execute on routine enqueue_crm_uaz_avatar_job(text,text,uuid,uuid,text,boolean) to service_role;
--@@ 90 grant-funcao generate_composite_lead_id()→anon
grant execute on routine generate_composite_lead_id() to anon;
--@@ 90 grant-funcao generate_composite_lead_id()→authenticated
grant execute on routine generate_composite_lead_id() to authenticated;
--@@ 90 grant-funcao generate_composite_lead_id()→public
grant execute on routine generate_composite_lead_id() to public;
--@@ 90 grant-funcao generate_composite_lead_id()→service_role
grant execute on routine generate_composite_lead_id() to service_role;
--@@ 90 grant-funcao get_broadcast_stats(uuid)→anon
grant execute on routine get_broadcast_stats(uuid) to anon;
--@@ 90 grant-funcao get_broadcast_stats(uuid)→authenticated
grant execute on routine get_broadcast_stats(uuid) to authenticated;
--@@ 90 grant-funcao get_broadcast_stats(uuid)→public
grant execute on routine get_broadcast_stats(uuid) to public;
--@@ 90 grant-funcao get_broadcast_stats(uuid)→service_role
grant execute on routine get_broadcast_stats(uuid) to service_role;
--@@ 90 grant-funcao get_cashback_summary(text)→anon
grant execute on routine get_cashback_summary(text) to anon;
--@@ 90 grant-funcao get_cashback_summary(text)→authenticated
grant execute on routine get_cashback_summary(text) to authenticated;
--@@ 90 grant-funcao get_cashback_summary(text)→public
grant execute on routine get_cashback_summary(text) to public;
--@@ 90 grant-funcao get_cashback_summary(text)→service_role
grant execute on routine get_cashback_summary(text) to service_role;
--@@ 90 grant-funcao get_crm_ads_dashboard(text)→anon
grant execute on routine get_crm_ads_dashboard(text) to anon;
--@@ 90 grant-funcao get_crm_ads_dashboard(text)→authenticated
grant execute on routine get_crm_ads_dashboard(text) to authenticated;
--@@ 90 grant-funcao get_crm_ads_dashboard(text)→service_role
grant execute on routine get_crm_ads_dashboard(text) to service_role;
--@@ 90 grant-funcao get_crm_statistics(text)→anon
grant execute on routine get_crm_statistics(text) to anon;
--@@ 90 grant-funcao get_crm_statistics(text)→authenticated
grant execute on routine get_crm_statistics(text) to authenticated;
--@@ 90 grant-funcao get_crm_statistics(text)→public
grant execute on routine get_crm_statistics(text) to public;
--@@ 90 grant-funcao get_crm_statistics(text)→service_role
grant execute on routine get_crm_statistics(text) to service_role;
--@@ 90 grant-funcao get_lead_custom_values(text)→anon
grant execute on routine get_lead_custom_values(text) to anon;
--@@ 90 grant-funcao get_lead_custom_values(text)→authenticated
grant execute on routine get_lead_custom_values(text) to authenticated;
--@@ 90 grant-funcao get_lead_custom_values(text)→public
grant execute on routine get_lead_custom_values(text) to public;
--@@ 90 grant-funcao get_lead_custom_values(text)→service_role
grant execute on routine get_lead_custom_values(text) to service_role;
--@@ 90 grant-funcao get_lead_full_data(text)→anon
grant execute on routine get_lead_full_data(text) to anon;
--@@ 90 grant-funcao get_lead_full_data(text)→authenticated
grant execute on routine get_lead_full_data(text) to authenticated;
--@@ 90 grant-funcao get_lead_full_data(text)→service_role
grant execute on routine get_lead_full_data(text) to service_role;
--@@ 90 grant-funcao get_lead_state(text)→service_role
grant execute on routine get_lead_state(text) to service_role;
--@@ 90 grant-funcao get_store_custom_fields(text)→anon
grant execute on routine get_store_custom_fields(text) to anon;
--@@ 90 grant-funcao get_store_custom_fields(text)→authenticated
grant execute on routine get_store_custom_fields(text) to authenticated;
--@@ 90 grant-funcao get_store_custom_fields(text)→public
grant execute on routine get_store_custom_fields(text) to public;
--@@ 90 grant-funcao get_store_custom_fields(text)→service_role
grant execute on routine get_store_custom_fields(text) to service_role;
--@@ 90 grant-funcao handle_debt_after_delete()→anon
grant execute on routine handle_debt_after_delete() to anon;
--@@ 90 grant-funcao handle_debt_after_delete()→authenticated
grant execute on routine handle_debt_after_delete() to authenticated;
--@@ 90 grant-funcao handle_debt_after_delete()→public
grant execute on routine handle_debt_after_delete() to public;
--@@ 90 grant-funcao handle_debt_after_delete()→service_role
grant execute on routine handle_debt_after_delete() to service_role;
--@@ 90 grant-funcao handle_debt_after_insert()→anon
grant execute on routine handle_debt_after_insert() to anon;
--@@ 90 grant-funcao handle_debt_after_insert()→authenticated
grant execute on routine handle_debt_after_insert() to authenticated;
--@@ 90 grant-funcao handle_debt_after_insert()→public
grant execute on routine handle_debt_after_insert() to public;
--@@ 90 grant-funcao handle_debt_after_insert()→service_role
grant execute on routine handle_debt_after_insert() to service_role;
--@@ 90 grant-funcao handle_debt_after_update()→anon
grant execute on routine handle_debt_after_update() to anon;
--@@ 90 grant-funcao handle_debt_after_update()→authenticated
grant execute on routine handle_debt_after_update() to authenticated;
--@@ 90 grant-funcao handle_debt_after_update()→public
grant execute on routine handle_debt_after_update() to public;
--@@ 90 grant-funcao handle_debt_after_update()→service_role
grant execute on routine handle_debt_after_update() to service_role;
--@@ 90 grant-funcao handle_debt_payment_after_delete()→anon
grant execute on routine handle_debt_payment_after_delete() to anon;
--@@ 90 grant-funcao handle_debt_payment_after_delete()→authenticated
grant execute on routine handle_debt_payment_after_delete() to authenticated;
--@@ 90 grant-funcao handle_debt_payment_after_delete()→public
grant execute on routine handle_debt_payment_after_delete() to public;
--@@ 90 grant-funcao handle_debt_payment_after_delete()→service_role
grant execute on routine handle_debt_payment_after_delete() to service_role;
--@@ 90 grant-funcao handle_debt_payment_after_insert()→anon
grant execute on routine handle_debt_payment_after_insert() to anon;
--@@ 90 grant-funcao handle_debt_payment_after_insert()→authenticated
grant execute on routine handle_debt_payment_after_insert() to authenticated;
--@@ 90 grant-funcao handle_debt_payment_after_insert()→public
grant execute on routine handle_debt_payment_after_insert() to public;
--@@ 90 grant-funcao handle_debt_payment_after_insert()→service_role
grant execute on routine handle_debt_payment_after_insert() to service_role;
--@@ 90 grant-funcao handle_payable_debt_after_delete()→anon
grant execute on routine handle_payable_debt_after_delete() to anon;
--@@ 90 grant-funcao handle_payable_debt_after_delete()→authenticated
grant execute on routine handle_payable_debt_after_delete() to authenticated;
--@@ 90 grant-funcao handle_payable_debt_after_delete()→public
grant execute on routine handle_payable_debt_after_delete() to public;
--@@ 90 grant-funcao handle_payable_debt_after_delete()→service_role
grant execute on routine handle_payable_debt_after_delete() to service_role;
--@@ 90 grant-funcao handle_payable_debt_after_insert()→anon
grant execute on routine handle_payable_debt_after_insert() to anon;
--@@ 90 grant-funcao handle_payable_debt_after_insert()→authenticated
grant execute on routine handle_payable_debt_after_insert() to authenticated;
--@@ 90 grant-funcao handle_payable_debt_after_insert()→public
grant execute on routine handle_payable_debt_after_insert() to public;
--@@ 90 grant-funcao handle_payable_debt_after_insert()→service_role
grant execute on routine handle_payable_debt_after_insert() to service_role;
--@@ 90 grant-funcao handle_payable_debt_after_update()→anon
grant execute on routine handle_payable_debt_after_update() to anon;
--@@ 90 grant-funcao handle_payable_debt_after_update()→authenticated
grant execute on routine handle_payable_debt_after_update() to authenticated;
--@@ 90 grant-funcao handle_payable_debt_after_update()→public
grant execute on routine handle_payable_debt_after_update() to public;
--@@ 90 grant-funcao handle_payable_debt_after_update()→service_role
grant execute on routine handle_payable_debt_after_update() to service_role;
--@@ 90 grant-funcao handle_payable_debt_payment_after_delete()→anon
grant execute on routine handle_payable_debt_payment_after_delete() to anon;
--@@ 90 grant-funcao handle_payable_debt_payment_after_delete()→authenticated
grant execute on routine handle_payable_debt_payment_after_delete() to authenticated;
--@@ 90 grant-funcao handle_payable_debt_payment_after_delete()→public
grant execute on routine handle_payable_debt_payment_after_delete() to public;
--@@ 90 grant-funcao handle_payable_debt_payment_after_delete()→service_role
grant execute on routine handle_payable_debt_payment_after_delete() to service_role;
--@@ 90 grant-funcao handle_payable_debt_payment_after_insert()→anon
grant execute on routine handle_payable_debt_payment_after_insert() to anon;
--@@ 90 grant-funcao handle_payable_debt_payment_after_insert()→authenticated
grant execute on routine handle_payable_debt_payment_after_insert() to authenticated;
--@@ 90 grant-funcao handle_payable_debt_payment_after_insert()→public
grant execute on routine handle_payable_debt_payment_after_insert() to public;
--@@ 90 grant-funcao handle_payable_debt_payment_after_insert()→service_role
grant execute on routine handle_payable_debt_payment_after_insert() to service_role;
--@@ 90 grant-funcao handle_payment_method_after_insert()→anon
grant execute on routine handle_payment_method_after_insert() to anon;
--@@ 90 grant-funcao handle_payment_method_after_insert()→authenticated
grant execute on routine handle_payment_method_after_insert() to authenticated;
--@@ 90 grant-funcao handle_payment_method_after_insert()→public
grant execute on routine handle_payment_method_after_insert() to public;
--@@ 90 grant-funcao handle_payment_method_after_insert()→service_role
grant execute on routine handle_payment_method_after_insert() to service_role;
--@@ 90 grant-funcao handle_sale_after_delete_cleanup()→anon
grant execute on routine handle_sale_after_delete_cleanup() to anon;
--@@ 90 grant-funcao handle_sale_after_delete_cleanup()→authenticated
grant execute on routine handle_sale_after_delete_cleanup() to authenticated;
--@@ 90 grant-funcao handle_sale_after_delete_cleanup()→public
grant execute on routine handle_sale_after_delete_cleanup() to public;
--@@ 90 grant-funcao handle_sale_after_delete_cleanup()→service_role
grant execute on routine handle_sale_after_delete_cleanup() to service_role;
--@@ 90 grant-funcao handle_sale_after_insert()→anon
grant execute on routine handle_sale_after_insert() to anon;
--@@ 90 grant-funcao handle_sale_after_insert()→authenticated
grant execute on routine handle_sale_after_insert() to authenticated;
--@@ 90 grant-funcao handle_sale_after_insert()→public
grant execute on routine handle_sale_after_insert() to public;
--@@ 90 grant-funcao handle_sale_after_insert()→service_role
grant execute on routine handle_sale_after_insert() to service_role;
--@@ 90 grant-funcao handle_sale_before_delete()→service_role
grant execute on routine handle_sale_before_delete() to service_role;
--@@ 90 grant-funcao handle_sale_item_after_insert()→anon
grant execute on routine handle_sale_item_after_insert() to anon;
--@@ 90 grant-funcao handle_sale_item_after_insert()→authenticated
grant execute on routine handle_sale_item_after_insert() to authenticated;
--@@ 90 grant-funcao handle_sale_item_after_insert()→public
grant execute on routine handle_sale_item_after_insert() to public;
--@@ 90 grant-funcao handle_sale_item_after_insert()→service_role
grant execute on routine handle_sale_item_after_insert() to service_role;
--@@ 90 grant-funcao handle_transaction_after_delete()→anon
grant execute on routine handle_transaction_after_delete() to anon;
--@@ 90 grant-funcao handle_transaction_after_delete()→authenticated
grant execute on routine handle_transaction_after_delete() to authenticated;
--@@ 90 grant-funcao handle_transaction_after_delete()→public
grant execute on routine handle_transaction_after_delete() to public;
--@@ 90 grant-funcao handle_transaction_after_delete()→service_role
grant execute on routine handle_transaction_after_delete() to service_role;
--@@ 90 grant-funcao increment_unread_count(uuid,timestamp with time zone)→anon
grant execute on routine increment_unread_count(uuid,timestamp with time zone) to anon;
--@@ 90 grant-funcao increment_unread_count(uuid,timestamp with time zone)→authent
grant execute on routine increment_unread_count(uuid,timestamp with time zone) to authenticated;
--@@ 90 grant-funcao increment_unread_count(uuid,timestamp with time zone)→public
grant execute on routine increment_unread_count(uuid,timestamp with time zone) to public;
--@@ 90 grant-funcao increment_unread_count(uuid,timestamp with time zone)→service
grant execute on routine increment_unread_count(uuid,timestamp with time zone) to service_role;
--@@ 90 grant-funcao is_valid_card_fee_rates(jsonb)→anon
grant execute on routine is_valid_card_fee_rates(jsonb) to anon;
--@@ 90 grant-funcao is_valid_card_fee_rates(jsonb)→authenticated
grant execute on routine is_valid_card_fee_rates(jsonb) to authenticated;
--@@ 90 grant-funcao is_valid_card_fee_rates(jsonb)→public
grant execute on routine is_valid_card_fee_rates(jsonb) to public;
--@@ 90 grant-funcao is_valid_card_fee_rates(jsonb)→service_role
grant execute on routine is_valid_card_fee_rates(jsonb) to service_role;
--@@ 90 grant-funcao mark_lead_as_customer(text,text)→anon
grant execute on routine mark_lead_as_customer(text,text) to anon;
--@@ 90 grant-funcao mark_lead_as_customer(text,text)→authenticated
grant execute on routine mark_lead_as_customer(text,text) to authenticated;
--@@ 90 grant-funcao mark_lead_as_customer(text,text)→public
grant execute on routine mark_lead_as_customer(text,text) to public;
--@@ 90 grant-funcao mark_lead_as_customer(text,text)→service_role
grant execute on routine mark_lead_as_customer(text,text) to service_role;
--@@ 90 grant-funcao move_crm_lead_stage(text,text,uuid,uuid,text)→anon
grant execute on routine move_crm_lead_stage(text,text,uuid,uuid,text) to anon;
--@@ 90 grant-funcao move_crm_lead_stage(text,text,uuid,uuid,text)→authenticated
grant execute on routine move_crm_lead_stage(text,text,uuid,uuid,text) to authenticated;
--@@ 90 grant-funcao move_crm_lead_stage(text,text,uuid,uuid,text)→public
grant execute on routine move_crm_lead_stage(text,text,uuid,uuid,text) to public;
--@@ 90 grant-funcao move_crm_lead_stage(text,text,uuid,uuid,text)→service_role
grant execute on routine move_crm_lead_stage(text,text,uuid,uuid,text) to service_role;
--@@ 90 grant-funcao normalize_phone(text)→anon
grant execute on routine normalize_phone(text) to anon;
--@@ 90 grant-funcao normalize_phone(text)→authenticated
grant execute on routine normalize_phone(text) to authenticated;
--@@ 90 grant-funcao normalize_phone(text)→public
grant execute on routine normalize_phone(text) to public;
--@@ 90 grant-funcao normalize_phone(text)→service_role
grant execute on routine normalize_phone(text) to service_role;
--@@ 90 grant-funcao pdv_apply_reservation_deposit_payments(text,timestamp with time
grant execute on routine pdv_apply_reservation_deposit_payments(text,timestamp with time zone) to authenticated;
--@@ 90 grant-funcao pdv_apply_reservation_deposit_payments(text,timestamp with time
grant execute on routine pdv_apply_reservation_deposit_payments(text,timestamp with time zone) to service_role;
--@@ 90 grant-funcao pdv_assert_sale_payload(jsonb)→anon
grant execute on routine pdv_assert_sale_payload(jsonb) to anon;
--@@ 90 grant-funcao pdv_assert_sale_payload(jsonb)→authenticated
grant execute on routine pdv_assert_sale_payload(jsonb) to authenticated;
--@@ 90 grant-funcao pdv_assert_sale_payload(jsonb)→public
grant execute on routine pdv_assert_sale_payload(jsonb) to public;
--@@ 90 grant-funcao pdv_assert_sale_payload(jsonb)→service_role
grant execute on routine pdv_assert_sale_payload(jsonb) to service_role;
--@@ 90 grant-funcao pdv_create_sale_financial_side_effects(text)→anon
grant execute on routine pdv_create_sale_financial_side_effects(text) to anon;
--@@ 90 grant-funcao pdv_create_sale_financial_side_effects(text)→authenticated
grant execute on routine pdv_create_sale_financial_side_effects(text) to authenticated;
--@@ 90 grant-funcao pdv_create_sale_financial_side_effects(text)→public
grant execute on routine pdv_create_sale_financial_side_effects(text) to public;
--@@ 90 grant-funcao pdv_create_sale_financial_side_effects(text)→service_role
grant execute on routine pdv_create_sale_financial_side_effects(text) to service_role;
--@@ 90 grant-funcao pdv_create_sale_trade_in_rows(text,jsonb,timestamp with time zo
grant execute on routine pdv_create_sale_trade_in_rows(text,jsonb,timestamp with time zone) to anon;
--@@ 90 grant-funcao pdv_create_sale_trade_in_rows(text,jsonb,timestamp with time zo
grant execute on routine pdv_create_sale_trade_in_rows(text,jsonb,timestamp with time zone) to authenticated;
--@@ 90 grant-funcao pdv_create_sale_trade_in_rows(text,jsonb,timestamp with time zo
grant execute on routine pdv_create_sale_trade_in_rows(text,jsonb,timestamp with time zone) to public;
--@@ 90 grant-funcao pdv_create_sale_trade_in_rows(text,jsonb,timestamp with time zo
grant execute on routine pdv_create_sale_trade_in_rows(text,jsonb,timestamp with time zone) to service_role;
--@@ 90 grant-funcao pdv_hydrate_sale_json(text)→anon
grant execute on routine pdv_hydrate_sale_json(text) to anon;
--@@ 90 grant-funcao pdv_hydrate_sale_json(text)→authenticated
grant execute on routine pdv_hydrate_sale_json(text) to authenticated;
--@@ 90 grant-funcao pdv_hydrate_sale_json(text)→public
grant execute on routine pdv_hydrate_sale_json(text) to public;
--@@ 90 grant-funcao pdv_hydrate_sale_json(text)→service_role
grant execute on routine pdv_hydrate_sale_json(text) to service_role;
--@@ 90 grant-funcao pdv_insert_sale_full_payload(jsonb)→authenticated
grant execute on routine pdv_insert_sale_full_payload(jsonb) to authenticated;
--@@ 90 grant-funcao pdv_insert_sale_full_payload(jsonb)→service_role
grant execute on routine pdv_insert_sale_full_payload(jsonb) to service_role;
--@@ 90 grant-funcao pdv_rebuild_sale_full_payload(text,jsonb)→authenticated
grant execute on routine pdv_rebuild_sale_full_payload(text,jsonb) to authenticated;
--@@ 90 grant-funcao pdv_rebuild_sale_full_payload(text,jsonb)→service_role
grant execute on routine pdv_rebuild_sale_full_payload(text,jsonb) to service_role;
--@@ 90 grant-funcao prepare_broadcast_recipients(uuid)→anon
grant execute on routine prepare_broadcast_recipients(uuid) to anon;
--@@ 90 grant-funcao prepare_broadcast_recipients(uuid)→authenticated
grant execute on routine prepare_broadcast_recipients(uuid) to authenticated;
--@@ 90 grant-funcao prepare_broadcast_recipients(uuid)→public
grant execute on routine prepare_broadcast_recipients(uuid) to public;
--@@ 90 grant-funcao prepare_broadcast_recipients(uuid)→service_role
grant execute on routine prepare_broadcast_recipients(uuid) to service_role;
--@@ 90 grant-funcao preview_campaign_audience(text,jsonb,integer)→anon
grant execute on routine preview_campaign_audience(text,jsonb,integer) to anon;
--@@ 90 grant-funcao preview_campaign_audience(text,jsonb,integer)→authenticated
grant execute on routine preview_campaign_audience(text,jsonb,integer) to authenticated;
--@@ 90 grant-funcao preview_campaign_audience(text,jsonb,integer)→public
grant execute on routine preview_campaign_audience(text,jsonb,integer) to public;
--@@ 90 grant-funcao preview_campaign_audience(text,jsonb,integer)→service_role
grant execute on routine preview_campaign_audience(text,jsonb,integer) to service_role;
--@@ 90 grant-funcao private.transfer_between_accounts_impl(numeric,text,text)→aut
grant execute on routine private.transfer_between_accounts_impl(numeric,text,text) to authenticated;
--@@ 90 grant-funcao private.transfer_between_accounts_impl(numeric,text,text)→ser
grant execute on routine private.transfer_between_accounts_impl(numeric,text,text) to service_role;
--@@ 90 grant public.account_deletion_requests→authenticated
grant delete, insert, select, update on table public.account_deletion_requests to authenticated;
--@@ 90 grant public.account_deletion_requests→service_role
grant delete, insert, maintain, references, select, trigger, truncate, update on table public.account_deletion_requests to service_role;
--@@ 90 grant public.admin_agent_audit_log→anon
grant delete, insert, maintain, references, select, trigger, truncate, update on table public.admin_agent_audit_log to anon;
--@@ 90 grant public.admin_agent_audit_log→authenticated
grant delete, insert, maintain, references, select, trigger, truncate, update on table public.admin_agent_audit_log to authenticated;
--@@ 90 grant public.admin_agent_audit_log→service_role
grant delete, insert, maintain, references, select, trigger, truncate, update on table public.admin_agent_audit_log to service_role;
--@@ 90 grant public.admin_agent_numbers→anon
grant delete, insert, maintain, references, select, trigger, truncate, update on table public.admin_agent_numbers to anon;
--@@ 90 grant public.admin_agent_numbers→authenticated
grant delete, insert, maintain, references, select, trigger, truncate, update on table public.admin_agent_numbers to authenticated;
--@@ 90 grant public.admin_agent_numbers→service_role
grant delete, insert, maintain, references, select, trigger, truncate, update on table public.admin_agent_numbers to service_role;
--@@ 90 grant public.admin_agent_pending_actions→anon
grant delete, insert, maintain, references, select, trigger, truncate, update on table public.admin_agent_pending_actions to anon;
--@@ 90 grant public.admin_agent_pending_actions→authenticated
grant delete, insert, maintain, references, select, trigger, truncate, update on table public.admin_agent_pending_actions to authenticated;
--@@ 90 grant public.admin_agent_pending_actions→service_role
grant delete, insert, maintain, references, select, trigger, truncate, update on table public.admin_agent_pending_actions to service_role;
--@@ 90 grant public.ai_turn_events→anon
grant delete, insert, maintain, references, select, trigger, truncate, update on table public.ai_turn_events to anon;
--@@ 90 grant public.ai_turn_events→authenticated
grant delete, insert, maintain, references, select, trigger, truncate, update on table public.ai_turn_events to authenticated;
--@@ 90 grant public.ai_turn_events→service_role
grant delete, insert, maintain, references, select, trigger, truncate, update on table public.ai_turn_events to service_role;
--@@ 90 grant public.app_role_permissions→anon
grant delete, insert, maintain, references, select, trigger, truncate, update on table public.app_role_permissions to anon;
--@@ 90 grant public.app_role_permissions→authenticated
grant delete, insert, maintain, references, select, trigger, truncate, update on table public.app_role_permissions to authenticated;
--@@ 90 grant public.app_role_permissions→service_role
grant delete, insert, maintain, references, select, trigger, truncate, update on table public.app_role_permissions to service_role;
--@@ 90 grant public.app_user_activity_logs_id_seq→anon
grant select, update, usage on sequence public.app_user_activity_logs_id_seq to anon;
--@@ 90 grant public.app_user_activity_logs_id_seq→authenticated
grant select, update, usage on sequence public.app_user_activity_logs_id_seq to authenticated;
--@@ 90 grant public.app_user_activity_logs_id_seq→service_role
grant select, update, usage on sequence public.app_user_activity_logs_id_seq to service_role;
--@@ 90 grant public.app_user_activity_logs→anon
grant delete, insert, maintain, references, select, trigger, truncate, update on table public.app_user_activity_logs to anon;
--@@ 90 grant public.app_user_activity_logs→authenticated
grant delete, insert, maintain, references, select, trigger, truncate, update on table public.app_user_activity_logs to authenticated;
--@@ 90 grant public.app_user_activity_logs→service_role
grant delete, insert, maintain, references, select, trigger, truncate, update on table public.app_user_activity_logs to service_role;
--@@ 90 grant public.business_profile→anon
grant delete, insert, maintain, references, select, trigger, truncate, update on table public.business_profile to anon;
--@@ 90 grant public.business_profile→authenticated
grant delete, insert, maintain, references, select, trigger, truncate, update on table public.business_profile to authenticated;
--@@ 90 grant public.business_profile→service_role
grant delete, insert, maintain, references, select, trigger, truncate, update on table public.business_profile to service_role;
--@@ 90 grant public.card_fee_settings→anon
grant delete, insert, maintain, references, select, trigger, truncate, update on table public.card_fee_settings to anon;
--@@ 90 grant public.card_fee_settings→authenticated
grant delete, insert, maintain, references, select, trigger, truncate, update on table public.card_fee_settings to authenticated;
--@@ 90 grant public.card_fee_settings→service_role
grant delete, insert, maintain, references, select, trigger, truncate, update on table public.card_fee_settings to service_role;
--@@ 90 grant public.cost_history→anon
grant delete, insert, maintain, references, select, trigger, truncate, update on table public.cost_history to anon;
--@@ 90 grant public.cost_history→authenticated
grant delete, insert, maintain, references, select, trigger, truncate, update on table public.cost_history to authenticated;
--@@ 90 grant public.cost_history→service_role
grant delete, insert, maintain, references, select, trigger, truncate, update on table public.cost_history to service_role;
--@@ 90 grant public.costs→anon
grant delete, insert, maintain, references, select, trigger, truncate, update on table public.costs to anon;
--@@ 90 grant public.costs→authenticated
grant delete, insert, maintain, references, select, trigger, truncate, update on table public.costs to authenticated;
--@@ 90 grant public.costs→service_role
grant delete, insert, maintain, references, select, trigger, truncate, update on table public.costs to service_role;
--@@ 90 grant public.creditors→anon
grant delete, insert, maintain, references, select, trigger, truncate, update on table public.creditors to anon;
--@@ 90 grant public.creditors→authenticated
grant delete, insert, maintain, references, select, trigger, truncate, update on table public.creditors to authenticated;
--@@ 90 grant public.creditors→service_role
grant delete, insert, maintain, references, select, trigger, truncate, update on table public.creditors to service_role;
--@@ 90 grant public.crm_ai_agent_configs→anon
grant delete, insert, maintain, references, select, trigger, truncate, update on table public.crm_ai_agent_configs to anon;
--@@ 90 grant public.crm_ai_agent_configs→authenticated
grant delete, insert, maintain, references, select, trigger, truncate, update on table public.crm_ai_agent_configs to authenticated;
--@@ 90 grant public.crm_ai_agent_configs→service_role
grant delete, insert, maintain, references, select, trigger, truncate, update on table public.crm_ai_agent_configs to service_role;
--@@ 90 grant public.crm_ai_agent_invocations→anon
grant delete, insert, maintain, references, select, trigger, truncate, update on table public.crm_ai_agent_invocations to anon;
--@@ 90 grant public.crm_ai_agent_invocations→authenticated
grant delete, insert, maintain, references, select, trigger, truncate, update on table public.crm_ai_agent_invocations to authenticated;
--@@ 90 grant public.crm_ai_agent_invocations→service_role
grant delete, insert, maintain, references, select, trigger, truncate, update on table public.crm_ai_agent_invocations to service_role;
--@@ 90 grant public.crm_ai_entry_settings→anon
grant delete, insert, maintain, references, select, trigger, truncate, update on table public.crm_ai_entry_settings to anon;
--@@ 90 grant public.crm_ai_entry_settings→authenticated
grant delete, insert, maintain, references, select, trigger, truncate, update on table public.crm_ai_entry_settings to authenticated;
--@@ 90 grant public.crm_ai_entry_settings→service_role
grant delete, insert, maintain, references, select, trigger, truncate, update on table public.crm_ai_entry_settings to service_role;
--@@ 90 grant public.crm_attendance_scripts→anon
grant delete, insert, maintain, references, select, trigger, truncate, update on table public.crm_attendance_scripts to anon;
--@@ 90 grant public.crm_attendance_scripts→authenticated
grant delete, insert, maintain, references, select, trigger, truncate, update on table public.crm_attendance_scripts to authenticated;
--@@ 90 grant public.crm_attendance_scripts→service_role
grant delete, insert, maintain, references, select, trigger, truncate, update on table public.crm_attendance_scripts to service_role;
--@@ 90 grant public.crm_auth_handoffs→anon
grant delete, insert, maintain, references, select, trigger, truncate, update on table public.crm_auth_handoffs to anon;
--@@ 90 grant public.crm_auth_handoffs→authenticated
grant delete, insert, maintain, references, select, trigger, truncate, update on table public.crm_auth_handoffs to authenticated;
--@@ 90 grant public.crm_auth_handoffs→service_role
grant delete, insert, maintain, references, select, trigger, truncate, update on table public.crm_auth_handoffs to service_role;
--@@ 90 grant public.crm_automation_rules→anon
grant delete, insert, maintain, references, select, trigger, truncate, update on table public.crm_automation_rules to anon;
--@@ 90 grant public.crm_automation_rules→authenticated
grant delete, insert, maintain, references, select, trigger, truncate, update on table public.crm_automation_rules to authenticated;
--@@ 90 grant public.crm_automation_rules→service_role
grant delete, insert, maintain, references, select, trigger, truncate, update on table public.crm_automation_rules to service_role;
--@@ 90 grant public.crm_broadcast_recipients→anon
grant delete, insert, maintain, references, select, trigger, truncate, update on table public.crm_broadcast_recipients to anon;
--@@ 90 grant public.crm_broadcast_recipients→authenticated
grant delete, insert, maintain, references, select, trigger, truncate, update on table public.crm_broadcast_recipients to authenticated;
--@@ 90 grant public.crm_broadcast_recipients→service_role
grant delete, insert, maintain, references, select, trigger, truncate, update on table public.crm_broadcast_recipients to service_role;
--@@ 90 grant public.crm_broadcasts→anon
grant delete, insert, maintain, references, select, trigger, truncate, update on table public.crm_broadcasts to anon;
--@@ 90 grant public.crm_broadcasts→authenticated
grant delete, insert, maintain, references, select, trigger, truncate, update on table public.crm_broadcasts to authenticated;
--@@ 90 grant public.crm_broadcasts→service_role
grant delete, insert, maintain, references, select, trigger, truncate, update on table public.crm_broadcasts to service_role;
--@@ 90 grant public.crm_channel_store_links→anon
grant delete, insert, maintain, references, select, trigger, truncate, update on table public.crm_channel_store_links to anon;
--@@ 90 grant public.crm_channel_store_links→authenticated
grant delete, insert, maintain, references, select, trigger, truncate, update on table public.crm_channel_store_links to authenticated;
--@@ 90 grant public.crm_channel_store_links→service_role
grant delete, insert, maintain, references, select, trigger, truncate, update on table public.crm_channel_store_links to service_role;
--@@ 90 grant public.crm_channels→anon
grant delete, insert, maintain, references, select, trigger, truncate, update on table public.crm_channels to anon;
--@@ 90 grant public.crm_channels→authenticated
grant delete, insert, maintain, references, select, trigger, truncate, update on table public.crm_channels to authenticated;
--@@ 90 grant public.crm_channels→service_role
grant delete, insert, maintain, references, select, trigger, truncate, update on table public.crm_channels to service_role;
--@@ 90 grant public.crm_conversations→anon
grant delete, insert, maintain, references, select, trigger, truncate, update on table public.crm_conversations to anon;
--@@ 90 grant public.crm_conversations→authenticated
grant delete, insert, maintain, references, select, trigger, truncate, update on table public.crm_conversations to authenticated;
--@@ 90 grant public.crm_conversations→service_role
grant delete, insert, maintain, references, select, trigger, truncate, update on table public.crm_conversations to service_role;
--@@ 90 grant public.crm_custom_fields→anon
grant delete, insert, maintain, references, select, trigger, truncate, update on table public.crm_custom_fields to anon;
--@@ 90 grant public.crm_custom_fields→authenticated
grant delete, insert, maintain, references, select, trigger, truncate, update on table public.crm_custom_fields to authenticated;
--@@ 90 grant public.crm_custom_fields→service_role
grant delete, insert, maintain, references, select, trigger, truncate, update on table public.crm_custom_fields to service_role;
--@@ 90 grant public.crm_dispatch_runtime→anon
grant delete, insert, maintain, references, select, trigger, truncate, update on table public.crm_dispatch_runtime to anon;
--@@ 90 grant public.crm_dispatch_runtime→authenticated
grant delete, insert, maintain, references, select, trigger, truncate, update on table public.crm_dispatch_runtime to authenticated;
--@@ 90 grant public.crm_dispatch_runtime→service_role
grant delete, insert, maintain, references, select, trigger, truncate, update on table public.crm_dispatch_runtime to service_role;
--@@ 90 grant public.crm_event_log→anon
grant delete, insert, maintain, references, select, trigger, truncate, update on table public.crm_event_log to anon;
--@@ 90 grant public.crm_event_log→authenticated
grant delete, insert, maintain, references, select, trigger, truncate, update on table public.crm_event_log to authenticated;
--@@ 90 grant public.crm_event_log→service_role
grant delete, insert, maintain, references, select, trigger, truncate, update on table public.crm_event_log to service_role;
--@@ 90 grant public.crm_filter_views→anon
grant delete, insert, maintain, references, select, trigger, truncate, update on table public.crm_filter_views to anon;
--@@ 90 grant public.crm_filter_views→authenticated
grant delete, insert, maintain, references, select, trigger, truncate, update on table public.crm_filter_views to authenticated;
--@@ 90 grant public.crm_filter_views→service_role
grant delete, insert, maintain, references, select, trigger, truncate, update on table public.crm_filter_views to service_role;
--@@ 90 grant public.crm_follow_up_tracker→anon
grant delete, insert, maintain, references, select, trigger, truncate, update on table public.crm_follow_up_tracker to anon;
--@@ 90 grant public.crm_follow_up_tracker→authenticated
grant delete, insert, maintain, references, select, trigger, truncate, update on table public.crm_follow_up_tracker to authenticated;
--@@ 90 grant public.crm_follow_up_tracker→service_role
grant delete, insert, maintain, references, select, trigger, truncate, update on table public.crm_follow_up_tracker to service_role;
--@@ 90 grant public.crm_funnel_stages→anon
grant delete, insert, maintain, references, select, trigger, truncate, update on table public.crm_funnel_stages to anon;
--@@ 90 grant public.crm_funnel_stages→authenticated
grant delete, insert, maintain, references, select, trigger, truncate, update on table public.crm_funnel_stages to authenticated;
--@@ 90 grant public.crm_funnel_stages→service_role
grant delete, insert, maintain, references, select, trigger, truncate, update on table public.crm_funnel_stages to service_role;
--@@ 90 grant public.crm_funnels→anon
grant delete, insert, maintain, references, select, trigger, truncate, update on table public.crm_funnels to anon;
--@@ 90 grant public.crm_funnels→authenticated
grant delete, insert, maintain, references, select, trigger, truncate, update on table public.crm_funnels to authenticated;
--@@ 90 grant public.crm_funnels→service_role
grant delete, insert, maintain, references, select, trigger, truncate, update on table public.crm_funnels to service_role;
--@@ 90 grant public.crm_instagram_comment_events→anon
grant delete, insert, maintain, references, select, trigger, truncate, update on table public.crm_instagram_comment_events to anon;
--@@ 90 grant public.crm_instagram_comment_events→authenticated
grant delete, insert, maintain, references, select, trigger, truncate, update on table public.crm_instagram_comment_events to authenticated;
--@@ 90 grant public.crm_instagram_comment_events→service_role
grant delete, insert, maintain, references, select, trigger, truncate, update on table public.crm_instagram_comment_events to service_role;
--@@ 90 grant public.crm_instagram_media_snapshots→anon
grant delete, insert, maintain, references, select, trigger, truncate, update on table public.crm_instagram_media_snapshots to anon;
--@@ 90 grant public.crm_instagram_media_snapshots→authenticated
grant delete, insert, maintain, references, select, trigger, truncate, update on table public.crm_instagram_media_snapshots to authenticated;
--@@ 90 grant public.crm_instagram_media_snapshots→service_role
grant delete, insert, maintain, references, select, trigger, truncate, update on table public.crm_instagram_media_snapshots to service_role;
--@@ 90 grant public.crm_lead_custom_field_values→anon
grant delete, insert, maintain, references, select, trigger, truncate, update on table public.crm_lead_custom_field_values to anon;
--@@ 90 grant public.crm_lead_custom_field_values→authenticated
grant delete, insert, maintain, references, select, trigger, truncate, update on table public.crm_lead_custom_field_values to authenticated;
--@@ 90 grant public.crm_lead_custom_field_values→service_role
grant delete, insert, maintain, references, select, trigger, truncate, update on table public.crm_lead_custom_field_values to service_role;
--@@ 90 grant public.crm_lead_identities→anon
grant delete, insert, maintain, references, select, trigger, truncate, update on table public.crm_lead_identities to anon;
--@@ 90 grant public.crm_lead_identities→authenticated
grant delete, insert, maintain, references, select, trigger, truncate, update on table public.crm_lead_identities to authenticated;
--@@ 90 grant public.crm_lead_identities→service_role
grant delete, insert, maintain, references, select, trigger, truncate, update on table public.crm_lead_identities to service_role;
--@@ 90 grant public.crm_lead_stage_history→anon
grant delete, insert, maintain, references, select, trigger, truncate, update on table public.crm_lead_stage_history to anon;
--@@ 90 grant public.crm_lead_stage_history→authenticated
grant delete, insert, maintain, references, select, trigger, truncate, update on table public.crm_lead_stage_history to authenticated;
--@@ 90 grant public.crm_lead_stage_history→service_role
grant delete, insert, maintain, references, select, trigger, truncate, update on table public.crm_lead_stage_history to service_role;
--@@ 90 grant public.crm_leads→anon
grant delete, insert, maintain, references, select, trigger, truncate, update on table public.crm_leads to anon;
--@@ 90 grant public.crm_leads→authenticated
grant delete, insert, maintain, references, select, trigger, truncate, update on table public.crm_leads to authenticated;
--@@ 90 grant public.crm_leads→service_role
grant delete, insert, maintain, references, select, trigger, truncate, update on table public.crm_leads to service_role;
--@@ 90 grant public.crm_message_templates→anon
grant delete, insert, maintain, references, select, trigger, truncate, update on table public.crm_message_templates to anon;
--@@ 90 grant public.crm_message_templates→authenticated
grant delete, insert, maintain, references, select, trigger, truncate, update on table public.crm_message_templates to authenticated;
--@@ 90 grant public.crm_message_templates→service_role
grant delete, insert, maintain, references, select, trigger, truncate, update on table public.crm_message_templates to service_role;
--@@ 90 grant public.crm_messages→anon
grant delete, insert, maintain, references, select, trigger, truncate, update on table public.crm_messages to anon;
--@@ 90 grant public.crm_messages→authenticated
grant delete, insert, maintain, references, select, trigger, truncate, update on table public.crm_messages to authenticated;
--@@ 90 grant public.crm_messages→service_role
grant delete, insert, maintain, references, select, trigger, truncate, update on table public.crm_messages to service_role;
--@@ 90 grant public.crm_meta_ads_attributions→anon
grant delete, insert, maintain, references, select, trigger, truncate, update on table public.crm_meta_ads_attributions to anon;
--@@ 90 grant public.crm_meta_ads_attributions→authenticated
grant delete, insert, maintain, references, select, trigger, truncate, update on table public.crm_meta_ads_attributions to authenticated;
--@@ 90 grant public.crm_meta_ads_attributions→service_role
grant delete, insert, maintain, references, select, trigger, truncate, update on table public.crm_meta_ads_attributions to service_role;
--@@ 90 grant public.crm_meta_ads_groups→anon
grant delete, insert, maintain, references, select, trigger, truncate, update on table public.crm_meta_ads_groups to anon;
--@@ 90 grant public.crm_meta_ads_groups→authenticated
grant delete, insert, maintain, references, select, trigger, truncate, update on table public.crm_meta_ads_groups to authenticated;
--@@ 90 grant public.crm_meta_ads_groups→service_role
grant delete, insert, maintain, references, select, trigger, truncate, update on table public.crm_meta_ads_groups to service_role;
--@@ 90 grant public.crm_public_registration_links→anon
grant delete, insert, maintain, references, select, trigger, truncate, update on table public.crm_public_registration_links to anon;
--@@ 90 grant public.crm_public_registration_links→authenticated
grant delete, insert, maintain, references, select, trigger, truncate, update on table public.crm_public_registration_links to authenticated;
--@@ 90 grant public.crm_public_registration_links→service_role
grant delete, insert, maintain, references, select, trigger, truncate, update on table public.crm_public_registration_links to service_role;
--@@ 90 grant public.crm_scheduled_messages→anon
grant delete, insert, maintain, references, select, trigger, truncate, update on table public.crm_scheduled_messages to anon;
--@@ 90 grant public.crm_scheduled_messages→authenticated
grant delete, insert, maintain, references, select, trigger, truncate, update on table public.crm_scheduled_messages to authenticated;
--@@ 90 grant public.crm_scheduled_messages→service_role
grant delete, insert, maintain, references, select, trigger, truncate, update on table public.crm_scheduled_messages to service_role;
--@@ 90 grant public.crm_settings→anon
grant delete, insert, maintain, references, select, trigger, truncate, update on table public.crm_settings to anon;
--@@ 90 grant public.crm_settings→authenticated
grant delete, insert, maintain, references, select, trigger, truncate, update on table public.crm_settings to authenticated;
--@@ 90 grant public.crm_settings→service_role
grant delete, insert, maintain, references, select, trigger, truncate, update on table public.crm_settings to service_role;
--@@ 90 grant public.crm_uaz_avatar_jobs→service_role
grant delete, insert, maintain, references, select, trigger, truncate, update on table public.crm_uaz_avatar_jobs to service_role;
--@@ 90 grant public.crm_ui_preferences→anon
grant delete, insert, maintain, references, select, trigger, truncate, update on table public.crm_ui_preferences to anon;
--@@ 90 grant public.crm_ui_preferences→authenticated
grant delete, insert, maintain, references, select, trigger, truncate, update on table public.crm_ui_preferences to authenticated;
--@@ 90 grant public.crm_ui_preferences→service_role
grant delete, insert, maintain, references, select, trigger, truncate, update on table public.crm_ui_preferences to service_role;
--@@ 90 grant public.crm_utm_config→anon
grant delete, insert, maintain, references, select, trigger, truncate, update on table public.crm_utm_config to anon;
--@@ 90 grant public.crm_utm_config→authenticated
grant delete, insert, maintain, references, select, trigger, truncate, update on table public.crm_utm_config to authenticated;
--@@ 90 grant public.crm_utm_config→service_role
grant delete, insert, maintain, references, select, trigger, truncate, update on table public.crm_utm_config to service_role;
--@@ 90 grant public.crm_webhook_subscriptions→anon
grant delete, insert, maintain, references, select, trigger, truncate, update on table public.crm_webhook_subscriptions to anon;
--@@ 90 grant public.crm_webhook_subscriptions→authenticated
grant delete, insert, maintain, references, select, trigger, truncate, update on table public.crm_webhook_subscriptions to authenticated;
--@@ 90 grant public.crm_webhook_subscriptions→service_role
grant delete, insert, maintain, references, select, trigger, truncate, update on table public.crm_webhook_subscriptions to service_role;
--@@ 90 grant public.customers→anon
grant delete, insert, maintain, references, select, trigger, truncate, update on table public.customers to anon;
--@@ 90 grant public.customers→authenticated
grant delete, insert, maintain, references, select, trigger, truncate, update on table public.customers to authenticated;
--@@ 90 grant public.customers→service_role
grant delete, insert, maintain, references, select, trigger, truncate, update on table public.customers to service_role;
--@@ 90 grant public.debt_payments→anon
grant delete, insert, maintain, references, select, trigger, truncate, update on table public.debt_payments to anon;
--@@ 90 grant public.debt_payments→authenticated
grant delete, insert, maintain, references, select, trigger, truncate, update on table public.debt_payments to authenticated;
--@@ 90 grant public.debt_payments→service_role
grant delete, insert, maintain, references, select, trigger, truncate, update on table public.debt_payments to service_role;
--@@ 90 grant public.debts→anon
grant delete, insert, maintain, references, select, trigger, truncate, update on table public.debts to anon;
--@@ 90 grant public.debts→authenticated
grant delete, insert, maintain, references, select, trigger, truncate, update on table public.debts to authenticated;
--@@ 90 grant public.debts→service_role
grant delete, insert, maintain, references, select, trigger, truncate, update on table public.debts to service_role;
--@@ 90 grant public.device_catalog→anon
grant delete, insert, maintain, references, select, trigger, truncate, update on table public.device_catalog to anon;
--@@ 90 grant public.device_catalog→authenticated
grant delete, insert, maintain, references, select, trigger, truncate, update on table public.device_catalog to authenticated;
--@@ 90 grant public.device_catalog→service_role
grant delete, insert, maintain, references, select, trigger, truncate, update on table public.device_catalog to service_role;
--@@ 90 grant public.finance_categories→anon
grant delete, insert, maintain, references, select, trigger, truncate, update on table public.finance_categories to anon;
--@@ 90 grant public.finance_categories→authenticated
grant delete, insert, maintain, references, select, trigger, truncate, update on table public.finance_categories to authenticated;
--@@ 90 grant public.finance_categories→service_role
grant delete, insert, maintain, references, select, trigger, truncate, update on table public.finance_categories to service_role;
--@@ 90 grant public.lead_state→anon
grant delete, insert, maintain, references, select, trigger, truncate, update on table public.lead_state to anon;
--@@ 90 grant public.lead_state→authenticated
grant delete, insert, maintain, references, select, trigger, truncate, update on table public.lead_state to authenticated;
--@@ 90 grant public.lead_state→service_role
grant delete, insert, maintain, references, select, trigger, truncate, update on table public.lead_state to service_role;
--@@ 90 grant public.parts_inventory→anon
grant delete, insert, maintain, references, select, trigger, truncate, update on table public.parts_inventory to anon;
--@@ 90 grant public.parts_inventory→authenticated
grant delete, insert, maintain, references, select, trigger, truncate, update on table public.parts_inventory to authenticated;
--@@ 90 grant public.parts_inventory→service_role
grant delete, insert, maintain, references, select, trigger, truncate, update on table public.parts_inventory to service_role;
--@@ 90 grant public.payable_debt_payments→anon
grant delete, insert, maintain, references, select, trigger, truncate, update on table public.payable_debt_payments to anon;
--@@ 90 grant public.payable_debt_payments→authenticated
grant delete, insert, maintain, references, select, trigger, truncate, update on table public.payable_debt_payments to authenticated;
--@@ 90 grant public.payable_debt_payments→service_role
grant delete, insert, maintain, references, select, trigger, truncate, update on table public.payable_debt_payments to service_role;
--@@ 90 grant public.payable_debts→anon
grant delete, insert, maintain, references, select, trigger, truncate, update on table public.payable_debts to anon;
--@@ 90 grant public.payable_debts→authenticated
grant delete, insert, maintain, references, select, trigger, truncate, update on table public.payable_debts to authenticated;
--@@ 90 grant public.payable_debts→service_role
grant delete, insert, maintain, references, select, trigger, truncate, update on table public.payable_debts to service_role;
--@@ 90 grant public.payment_methods→anon
grant delete, insert, maintain, references, select, trigger, truncate, update on table public.payment_methods to anon;
--@@ 90 grant public.payment_methods→authenticated
grant delete, insert, maintain, references, select, trigger, truncate, update on table public.payment_methods to authenticated;
--@@ 90 grant public.payment_methods→service_role
grant delete, insert, maintain, references, select, trigger, truncate, update on table public.payment_methods to service_role;
--@@ 90 grant public.push_subscriptions→anon
grant delete, insert, maintain, references, select, trigger, truncate, update on table public.push_subscriptions to anon;
--@@ 90 grant public.push_subscriptions→authenticated
grant delete, insert, maintain, references, select, trigger, truncate, update on table public.push_subscriptions to authenticated;
--@@ 90 grant public.push_subscriptions→service_role
grant delete, insert, maintain, references, select, trigger, truncate, update on table public.push_subscriptions to service_role;
--@@ 90 grant public.reservation_message_settings→anon
grant delete, insert, maintain, references, select, trigger, truncate, update on table public.reservation_message_settings to anon;
--@@ 90 grant public.reservation_message_settings→authenticated
grant delete, insert, maintain, references, select, trigger, truncate, update on table public.reservation_message_settings to authenticated;
--@@ 90 grant public.reservation_message_settings→service_role
grant delete, insert, maintain, references, select, trigger, truncate, update on table public.reservation_message_settings to service_role;
--@@ 90 grant public.sale_items→anon
grant delete, insert, maintain, references, select, trigger, truncate, update on table public.sale_items to anon;
--@@ 90 grant public.sale_items→authenticated
grant delete, insert, maintain, references, select, trigger, truncate, update on table public.sale_items to authenticated;
--@@ 90 grant public.sale_items→service_role
grant delete, insert, maintain, references, select, trigger, truncate, update on table public.sale_items to service_role;
--@@ 90 grant public.sale_trade_in_items→anon
grant delete, insert, maintain, references, select, trigger, truncate, update on table public.sale_trade_in_items to anon;
--@@ 90 grant public.sale_trade_in_items→authenticated
grant delete, insert, maintain, references, select, trigger, truncate, update on table public.sale_trade_in_items to authenticated;
--@@ 90 grant public.sale_trade_in_items→service_role
grant delete, insert, maintain, references, select, trigger, truncate, update on table public.sale_trade_in_items to service_role;
--@@ 90 grant public.sales_sale_number_seq→anon
grant select, update, usage on sequence public.sales_sale_number_seq to anon;
--@@ 90 grant public.sales_sale_number_seq→authenticated
grant select, update, usage on sequence public.sales_sale_number_seq to authenticated;
--@@ 90 grant public.sales_sale_number_seq→service_role
grant select, update, usage on sequence public.sales_sale_number_seq to service_role;
--@@ 90 grant public.sales→anon
grant delete, insert, maintain, references, select, trigger, truncate, update on table public.sales to anon;
--@@ 90 grant public.sales→authenticated
grant delete, insert, maintain, references, select, trigger, truncate, update on table public.sales to authenticated;
--@@ 90 grant public.sales→service_role
grant delete, insert, maintain, references, select, trigger, truncate, update on table public.sales to service_role;
--@@ 90 grant public.sellers→anon
grant delete, insert, maintain, references, select, trigger, truncate, update on table public.sellers to anon;
--@@ 90 grant public.sellers→authenticated
grant delete, insert, maintain, references, select, trigger, truncate, update on table public.sellers to authenticated;
--@@ 90 grant public.sellers→service_role
grant delete, insert, maintain, references, select, trigger, truncate, update on table public.sellers to service_role;
--@@ 90 grant public.simulator_trade_in_adjustments→anon
grant delete, insert, maintain, references, select, trigger, truncate, update on table public.simulator_trade_in_adjustments to anon;
--@@ 90 grant public.simulator_trade_in_adjustments→authenticated
grant delete, insert, maintain, references, select, trigger, truncate, update on table public.simulator_trade_in_adjustments to authenticated;
--@@ 90 grant public.simulator_trade_in_adjustments→service_role
grant delete, insert, maintain, references, select, trigger, truncate, update on table public.simulator_trade_in_adjustments to service_role;
--@@ 90 grant public.simulator_trade_in_values→anon
grant delete, insert, maintain, references, select, trigger, truncate, update on table public.simulator_trade_in_values to anon;
--@@ 90 grant public.simulator_trade_in_values→authenticated
grant delete, insert, maintain, references, select, trigger, truncate, update on table public.simulator_trade_in_values to authenticated;
--@@ 90 grant public.simulator_trade_in_values→service_role
grant delete, insert, maintain, references, select, trigger, truncate, update on table public.simulator_trade_in_values to service_role;
--@@ 90 grant public.stock_items→anon
grant delete, insert, maintain, references, select, trigger, truncate, update on table public.stock_items to anon;
--@@ 90 grant public.stock_items→authenticated
grant delete, insert, maintain, references, select, trigger, truncate, update on table public.stock_items to authenticated;
--@@ 90 grant public.stock_items→service_role
grant delete, insert, maintain, references, select, trigger, truncate, update on table public.stock_items to service_role;
--@@ 90 grant public.stock_reservations→anon
grant delete, insert, maintain, references, select, trigger, truncate, update on table public.stock_reservations to anon;
--@@ 90 grant public.stock_reservations→authenticated
grant delete, insert, maintain, references, select, trigger, truncate, update on table public.stock_reservations to authenticated;
--@@ 90 grant public.stock_reservations→service_role
grant delete, insert, maintain, references, select, trigger, truncate, update on table public.stock_reservations to service_role;
--@@ 90 grant public.stores→anon
grant delete, insert, maintain, references, select, trigger, truncate, update on table public.stores to anon;
--@@ 90 grant public.stores→authenticated
grant delete, insert, maintain, references, select, trigger, truncate, update on table public.stores to authenticated;
--@@ 90 grant public.stores→service_role
grant delete, insert, maintain, references, select, trigger, truncate, update on table public.stores to service_role;
--@@ 90 grant public.transactions→anon
grant delete, insert, maintain, references, select, trigger, truncate, update on table public.transactions to anon;
--@@ 90 grant public.transactions→authenticated
grant delete, insert, maintain, references, select, trigger, truncate, update on table public.transactions to authenticated;
--@@ 90 grant public.transactions→service_role
grant delete, insert, maintain, references, select, trigger, truncate, update on table public.transactions to service_role;
--@@ 90 grant public.user_access_roles→anon
grant delete, insert, maintain, references, select, trigger, truncate, update on table public.user_access_roles to anon;
--@@ 90 grant public.user_access_roles→authenticated
grant delete, insert, maintain, references, select, trigger, truncate, update on table public.user_access_roles to authenticated;
--@@ 90 grant public.user_access_roles→service_role
grant delete, insert, maintain, references, select, trigger, truncate, update on table public.user_access_roles to service_role;
--@@ 90 grant public.user_consents→authenticated
grant insert, select, update on table public.user_consents to authenticated;
--@@ 90 grant public.user_consents→service_role
grant delete, insert, maintain, references, select, trigger, truncate, update on table public.user_consents to service_role;
--@@ 90 grant public.user_profiles→anon
grant delete, insert, maintain, references, select, trigger, truncate, update on table public.user_profiles to anon;
--@@ 90 grant public.user_profiles→authenticated
grant delete, insert, maintain, references, select, trigger, truncate, update on table public.user_profiles to authenticated;
--@@ 90 grant public.user_profiles→service_role
grant delete, insert, maintain, references, select, trigger, truncate, update on table public.user_profiles to service_role;
--@@ 90 grant public.warranty_public_tokens→anon
grant delete, insert, maintain, references, select, trigger, truncate, update on table public.warranty_public_tokens to anon;
--@@ 90 grant public.warranty_public_tokens→authenticated
grant delete, insert, maintain, references, select, trigger, truncate, update on table public.warranty_public_tokens to authenticated;
--@@ 90 grant public.warranty_public_tokens→service_role
grant delete, insert, maintain, references, select, trigger, truncate, update on table public.warranty_public_tokens to service_role;
--@@ 90 grant-funcao record_ai_turn_event(text,text,uuid,text,text,integer,jsonb,jso
grant execute on routine record_ai_turn_event(text,text,uuid,text,text,integer,jsonb,jsonb) to anon;
--@@ 90 grant-funcao record_ai_turn_event(text,text,uuid,text,text,integer,jsonb,jso
grant execute on routine record_ai_turn_event(text,text,uuid,text,text,integer,jsonb,jsonb) to authenticated;
--@@ 90 grant-funcao record_ai_turn_event(text,text,uuid,text,text,integer,jsonb,jso
grant execute on routine record_ai_turn_event(text,text,uuid,text,text,integer,jsonb,jsonb) to service_role;
--@@ 90 grant-funcao release_stock_reservation(text,boolean)→authenticated
grant execute on routine release_stock_reservation(text,boolean) to authenticated;
--@@ 90 grant-funcao release_stock_reservation(text,boolean)→service_role
grant execute on routine release_stock_reservation(text,boolean) to service_role;
--@@ 90 grant-funcao remove_stock_item_cost(text)→authenticated
grant execute on routine remove_stock_item_cost(text) to authenticated;
--@@ 90 grant-funcao remove_stock_item_cost(text)→service_role
grant execute on routine remove_stock_item_cost(text) to service_role;
--@@ 90 grant-funcao reservation_deposit_account(text)→anon
grant execute on routine reservation_deposit_account(text) to anon;
--@@ 90 grant-funcao reservation_deposit_account(text)→authenticated
grant execute on routine reservation_deposit_account(text) to authenticated;
--@@ 90 grant-funcao reservation_deposit_account(text)→public
grant execute on routine reservation_deposit_account(text) to public;
--@@ 90 grant-funcao reservation_deposit_account(text)→service_role
grant execute on routine reservation_deposit_account(text) to service_role;
--@@ 90 grant-funcao reserve_stock_item(text,jsonb)→authenticated
grant execute on routine reserve_stock_item(text,jsonb) to authenticated;
--@@ 90 grant-funcao reserve_stock_item(text,jsonb)→service_role
grant execute on routine reserve_stock_item(text,jsonb) to service_role;
--@@ 90 grant-funcao resolve_crm_default_store_id()→anon
grant execute on routine resolve_crm_default_store_id() to anon;
--@@ 90 grant-funcao resolve_crm_default_store_id()→authenticated
grant execute on routine resolve_crm_default_store_id() to authenticated;
--@@ 90 grant-funcao resolve_crm_default_store_id()→public
grant execute on routine resolve_crm_default_store_id() to public;
--@@ 90 grant-funcao resolve_crm_default_store_id()→service_role
grant execute on routine resolve_crm_default_store_id() to service_role;
--@@ 90 grant-funcao resolve_crm_lead_for_sale(text,text,text,boolean)→service_rol
grant execute on routine resolve_crm_lead_for_sale(text,text,text,boolean) to service_role;
--@@ 90 grant-funcao sales_backfill_ads_origin_from_phone_match()→service_role
grant execute on routine sales_backfill_ads_origin_from_phone_match() to service_role;
--@@ 90 grant-funcao sales_set_crm_lead_id()→service_role
grant execute on routine sales_set_crm_lead_id() to service_role;
--@@ 90 grant-funcao search_crm_messages(text,text,integer)→anon
grant execute on routine search_crm_messages(text,text,integer) to anon;
--@@ 90 grant-funcao search_crm_messages(text,text,integer)→authenticated
grant execute on routine search_crm_messages(text,text,integer) to authenticated;
--@@ 90 grant-funcao search_crm_messages(text,text,integer)→public
grant execute on routine search_crm_messages(text,text,integer) to public;
--@@ 90 grant-funcao search_crm_messages(text,text,integer)→service_role
grant execute on routine search_crm_messages(text,text,integer) to service_role;
--@@ 90 grant-funcao search_leads(text,jsonb,integer,integer)→anon
grant execute on routine search_leads(text,jsonb,integer,integer) to anon;
--@@ 90 grant-funcao search_leads(text,jsonb,integer,integer)→authenticated
grant execute on routine search_leads(text,jsonb,integer,integer) to authenticated;
--@@ 90 grant-funcao search_leads(text,jsonb,integer,integer)→public
grant execute on routine search_leads(text,jsonb,integer,integer) to public;
--@@ 90 grant-funcao search_leads(text,jsonb,integer,integer)→service_role
grant execute on routine search_leads(text,jsonb,integer,integer) to service_role;
--@@ 90 grant-funcao set_lead_custom_field(text,uuid,jsonb)→anon
grant execute on routine set_lead_custom_field(text,uuid,jsonb) to anon;
--@@ 90 grant-funcao set_lead_custom_field(text,uuid,jsonb)→authenticated
grant execute on routine set_lead_custom_field(text,uuid,jsonb) to authenticated;
--@@ 90 grant-funcao set_lead_custom_field(text,uuid,jsonb)→public
grant execute on routine set_lead_custom_field(text,uuid,jsonb) to public;
--@@ 90 grant-funcao set_lead_custom_field(text,uuid,jsonb)→service_role
grant execute on routine set_lead_custom_field(text,uuid,jsonb) to service_role;
--@@ 90 grant-funcao sync_crm_campaign_tag_mappings(text,jsonb)→anon
grant execute on routine sync_crm_campaign_tag_mappings(text,jsonb) to anon;
--@@ 90 grant-funcao sync_crm_campaign_tag_mappings(text,jsonb)→authenticated
grant execute on routine sync_crm_campaign_tag_mappings(text,jsonb) to authenticated;
--@@ 90 grant-funcao sync_crm_campaign_tag_mappings(text,jsonb)→public
grant execute on routine sync_crm_campaign_tag_mappings(text,jsonb) to public;
--@@ 90 grant-funcao sync_crm_campaign_tag_mappings(text,jsonb)→service_role
grant execute on routine sync_crm_campaign_tag_mappings(text,jsonb) to service_role;
--@@ 90 grant-funcao test_webhook_subscription(uuid)→anon
grant execute on routine test_webhook_subscription(uuid) to anon;
--@@ 90 grant-funcao test_webhook_subscription(uuid)→authenticated
grant execute on routine test_webhook_subscription(uuid) to authenticated;
--@@ 90 grant-funcao test_webhook_subscription(uuid)→public
grant execute on routine test_webhook_subscription(uuid) to public;
--@@ 90 grant-funcao test_webhook_subscription(uuid)→service_role
grant execute on routine test_webhook_subscription(uuid) to service_role;
--@@ 90 grant-funcao tg_set_card_fee_settings_updated_at()→anon
grant execute on routine tg_set_card_fee_settings_updated_at() to anon;
--@@ 90 grant-funcao tg_set_card_fee_settings_updated_at()→authenticated
grant execute on routine tg_set_card_fee_settings_updated_at() to authenticated;
--@@ 90 grant-funcao tg_set_card_fee_settings_updated_at()→public
grant execute on routine tg_set_card_fee_settings_updated_at() to public;
--@@ 90 grant-funcao tg_set_card_fee_settings_updated_at()→service_role
grant execute on routine tg_set_card_fee_settings_updated_at() to service_role;
--@@ 90 grant-funcao tg_set_creditors_updated_at()→anon
grant execute on routine tg_set_creditors_updated_at() to anon;
--@@ 90 grant-funcao tg_set_creditors_updated_at()→authenticated
grant execute on routine tg_set_creditors_updated_at() to authenticated;
--@@ 90 grant-funcao tg_set_creditors_updated_at()→public
grant execute on routine tg_set_creditors_updated_at() to public;
--@@ 90 grant-funcao tg_set_creditors_updated_at()→service_role
grant execute on routine tg_set_creditors_updated_at() to service_role;
--@@ 90 grant-funcao tg_set_device_catalog_updated_at()→anon
grant execute on routine tg_set_device_catalog_updated_at() to anon;
--@@ 90 grant-funcao tg_set_device_catalog_updated_at()→authenticated
grant execute on routine tg_set_device_catalog_updated_at() to authenticated;
--@@ 90 grant-funcao tg_set_device_catalog_updated_at()→public
grant execute on routine tg_set_device_catalog_updated_at() to public;
--@@ 90 grant-funcao tg_set_device_catalog_updated_at()→service_role
grant execute on routine tg_set_device_catalog_updated_at() to service_role;
--@@ 90 grant-funcao tg_set_finance_categories_updated_at()→anon
grant execute on routine tg_set_finance_categories_updated_at() to anon;
--@@ 90 grant-funcao tg_set_finance_categories_updated_at()→authenticated
grant execute on routine tg_set_finance_categories_updated_at() to authenticated;
--@@ 90 grant-funcao tg_set_finance_categories_updated_at()→public
grant execute on routine tg_set_finance_categories_updated_at() to public;
--@@ 90 grant-funcao tg_set_finance_categories_updated_at()→service_role
grant execute on routine tg_set_finance_categories_updated_at() to service_role;
--@@ 90 grant-funcao tg_set_lead_state_updated_at()→anon
grant execute on routine tg_set_lead_state_updated_at() to anon;
--@@ 90 grant-funcao tg_set_lead_state_updated_at()→authenticated
grant execute on routine tg_set_lead_state_updated_at() to authenticated;
--@@ 90 grant-funcao tg_set_lead_state_updated_at()→public
grant execute on routine tg_set_lead_state_updated_at() to public;
--@@ 90 grant-funcao tg_set_lead_state_updated_at()→service_role
grant execute on routine tg_set_lead_state_updated_at() to service_role;
--@@ 90 grant-funcao tg_set_parts_inventory_updated_at()→anon
grant execute on routine tg_set_parts_inventory_updated_at() to anon;
--@@ 90 grant-funcao tg_set_parts_inventory_updated_at()→authenticated
grant execute on routine tg_set_parts_inventory_updated_at() to authenticated;
--@@ 90 grant-funcao tg_set_parts_inventory_updated_at()→public
grant execute on routine tg_set_parts_inventory_updated_at() to public;
--@@ 90 grant-funcao tg_set_parts_inventory_updated_at()→service_role
grant execute on routine tg_set_parts_inventory_updated_at() to service_role;
--@@ 90 grant-funcao tg_set_payable_debts_updated_at()→anon
grant execute on routine tg_set_payable_debts_updated_at() to anon;
--@@ 90 grant-funcao tg_set_payable_debts_updated_at()→authenticated
grant execute on routine tg_set_payable_debts_updated_at() to authenticated;
--@@ 90 grant-funcao tg_set_payable_debts_updated_at()→public
grant execute on routine tg_set_payable_debts_updated_at() to public;
--@@ 90 grant-funcao tg_set_payable_debts_updated_at()→service_role
grant execute on routine tg_set_payable_debts_updated_at() to service_role;
--@@ 90 grant-funcao tg_set_simulator_trade_in_updated_at()→anon
grant execute on routine tg_set_simulator_trade_in_updated_at() to anon;
--@@ 90 grant-funcao tg_set_simulator_trade_in_updated_at()→authenticated
grant execute on routine tg_set_simulator_trade_in_updated_at() to authenticated;
--@@ 90 grant-funcao tg_set_simulator_trade_in_updated_at()→public
grant execute on routine tg_set_simulator_trade_in_updated_at() to public;
--@@ 90 grant-funcao tg_set_simulator_trade_in_updated_at()→service_role
grant execute on routine tg_set_simulator_trade_in_updated_at() to service_role;
--@@ 90 grant-funcao tg_set_stock_reservations_updated_at()→anon
grant execute on routine tg_set_stock_reservations_updated_at() to anon;
--@@ 90 grant-funcao tg_set_stock_reservations_updated_at()→authenticated
grant execute on routine tg_set_stock_reservations_updated_at() to authenticated;
--@@ 90 grant-funcao tg_set_stock_reservations_updated_at()→public
grant execute on routine tg_set_stock_reservations_updated_at() to public;
--@@ 90 grant-funcao tg_set_stock_reservations_updated_at()→service_role
grant execute on routine tg_set_stock_reservations_updated_at() to service_role;
--@@ 90 grant-funcao touch_reservation_message_settings()→service_role
grant execute on routine touch_reservation_message_settings() to service_role;
--@@ 90 grant-funcao transfer_between_accounts(numeric,text,text)→authenticated
grant execute on routine transfer_between_accounts(numeric,text,text) to authenticated;
--@@ 90 grant-funcao transfer_between_accounts(numeric,text,text)→service_role
grant execute on routine transfer_between_accounts(numeric,text,text) to service_role;
--@@ 90 grant-funcao transfer_lead_store(text,text)→anon
grant execute on routine transfer_lead_store(text,text) to anon;
--@@ 90 grant-funcao transfer_lead_store(text,text)→authenticated
grant execute on routine transfer_lead_store(text,text) to authenticated;
--@@ 90 grant-funcao transfer_lead_store(text,text)→public
grant execute on routine transfer_lead_store(text,text) to public;
--@@ 90 grant-funcao transfer_lead_store(text,text)→service_role
grant execute on routine transfer_lead_store(text,text) to service_role;
--@@ 90 grant-funcao trigger_new_lead_avatar()→anon
grant execute on routine trigger_new_lead_avatar() to anon;
--@@ 90 grant-funcao trigger_new_lead_avatar()→authenticated
grant execute on routine trigger_new_lead_avatar() to authenticated;
--@@ 90 grant-funcao trigger_new_lead_avatar()→public
grant execute on routine trigger_new_lead_avatar() to public;
--@@ 90 grant-funcao trigger_new_lead_avatar()→service_role
grant execute on routine trigger_new_lead_avatar() to service_role;
--@@ 90 grant-funcao update_campaign_delivery_metrics(uuid,jsonb)→anon
grant execute on routine update_campaign_delivery_metrics(uuid,jsonb) to anon;
--@@ 90 grant-funcao update_campaign_delivery_metrics(uuid,jsonb)→authenticated
grant execute on routine update_campaign_delivery_metrics(uuid,jsonb) to authenticated;
--@@ 90 grant-funcao update_campaign_delivery_metrics(uuid,jsonb)→public
grant execute on routine update_campaign_delivery_metrics(uuid,jsonb) to public;
--@@ 90 grant-funcao update_campaign_delivery_metrics(uuid,jsonb)→service_role
grant execute on routine update_campaign_delivery_metrics(uuid,jsonb) to service_role;
--@@ 90 grant-funcao update_lead_basic_data(text,text,text,jsonb)→anon
grant execute on routine update_lead_basic_data(text,text,text,jsonb) to anon;
--@@ 90 grant-funcao update_lead_basic_data(text,text,text,jsonb)→authenticated
grant execute on routine update_lead_basic_data(text,text,text,jsonb) to authenticated;
--@@ 90 grant-funcao update_lead_basic_data(text,text,text,jsonb)→public
grant execute on routine update_lead_basic_data(text,text,text,jsonb) to public;
--@@ 90 grant-funcao update_lead_basic_data(text,text,text,jsonb)→service_role
grant execute on routine update_lead_basic_data(text,text,text,jsonb) to service_role;
--@@ 90 grant-funcao update_lead_funnel(text,text,text,text,uuid)→anon
grant execute on routine update_lead_funnel(text,text,text,text,uuid) to anon;
--@@ 90 grant-funcao update_lead_funnel(text,text,text,text,uuid)→authenticated
grant execute on routine update_lead_funnel(text,text,text,text,uuid) to authenticated;
--@@ 90 grant-funcao update_lead_funnel(text,text,text,text,uuid)→public
grant execute on routine update_lead_funnel(text,text,text,text,uuid) to public;
--@@ 90 grant-funcao update_lead_funnel(text,text,text,text,uuid)→service_role
grant execute on routine update_lead_funnel(text,text,text,text,uuid) to service_role;
--@@ 90 grant-funcao update_lead_memory(text,text,text)→authenticated
grant execute on routine update_lead_memory(text,text,text) to authenticated;
--@@ 90 grant-funcao update_lead_memory(text,text,text)→service_role
grant execute on routine update_lead_memory(text,text,text) to service_role;
--@@ 90 grant-funcao update_sale_full(text,jsonb)→authenticated
grant execute on routine update_sale_full(text,jsonb) to authenticated;
--@@ 90 grant-funcao update_sale_full(text,jsonb)→service_role
grant execute on routine update_sale_full(text,jsonb) to service_role;
--@@ 90 grant-funcao upsert_crm_lead(text,text,text,text,text,uuid,text,text,text,te
grant execute on routine upsert_crm_lead(text,text,text,text,text,uuid,text,text,text,text,text,text,text,text) to anon;
--@@ 90 grant-funcao upsert_crm_lead(text,text,text,text,text,uuid,text,text,text,te
grant execute on routine upsert_crm_lead(text,text,text,text,text,uuid,text,text,text,text,text,text,text,text) to authenticated;
--@@ 90 grant-funcao upsert_crm_lead(text,text,text,text,text,uuid,text,text,text,te
grant execute on routine upsert_crm_lead(text,text,text,text,text,uuid,text,text,text,text,text,text,text,text) to public;
--@@ 90 grant-funcao upsert_crm_lead(text,text,text,text,text,uuid,text,text,text,te
grant execute on routine upsert_crm_lead(text,text,text,text,text,uuid,text,text,text,text,text,text,text,text) to service_role;
--@@ 90 grant-funcao upsert_lead_state(text,jsonb)→service_role
grant execute on routine upsert_lead_state(text,jsonb) to service_role;
--@@ 90 grant-funcao upsert_repasse_commerce_state(text,bigint,jsonb,jsonb,jsonb)→
grant execute on routine upsert_repasse_commerce_state(text,bigint,jsonb,jsonb,jsonb) to anon;
--@@ 90 grant-funcao upsert_repasse_commerce_state(text,bigint,jsonb,jsonb,jsonb)→
grant execute on routine upsert_repasse_commerce_state(text,bigint,jsonb,jsonb,jsonb) to authenticated;
--@@ 90 grant-funcao upsert_repasse_commerce_state(text,bigint,jsonb,jsonb,jsonb)→
grant execute on routine upsert_repasse_commerce_state(text,bigint,jsonb,jsonb,jsonb) to service_role;
--@@ 92 realtime public.business_profile
alter publication supabase_realtime add table public.business_profile;
--@@ 92 realtime public.card_fee_settings
alter publication supabase_realtime add table public.card_fee_settings;
--@@ 92 realtime public.cost_history
alter publication supabase_realtime add table public.cost_history;
--@@ 92 realtime public.costs
alter publication supabase_realtime add table public.costs;
--@@ 92 realtime public.creditors
alter publication supabase_realtime add table public.creditors;
--@@ 92 realtime public.crm_channels
alter publication supabase_realtime add table public.crm_channels;
--@@ 92 realtime public.crm_conversations
alter publication supabase_realtime add table public.crm_conversations;
--@@ 92 realtime public.crm_leads
alter publication supabase_realtime add table public.crm_leads;
--@@ 92 realtime public.crm_messages
alter publication supabase_realtime add table public.crm_messages;
--@@ 92 realtime public.customers
alter publication supabase_realtime add table public.customers;
--@@ 92 realtime public.debt_payments
alter publication supabase_realtime add table public.debt_payments;
--@@ 92 realtime public.debts
alter publication supabase_realtime add table public.debts;
--@@ 92 realtime public.device_catalog
alter publication supabase_realtime add table public.device_catalog;
--@@ 92 realtime public.finance_categories
alter publication supabase_realtime add table public.finance_categories;
--@@ 92 realtime public.parts_inventory
alter publication supabase_realtime add table public.parts_inventory;
--@@ 92 realtime public.payable_debt_payments
alter publication supabase_realtime add table public.payable_debt_payments;
--@@ 92 realtime public.payable_debts
alter publication supabase_realtime add table public.payable_debts;
--@@ 92 realtime public.payment_methods
alter publication supabase_realtime add table public.payment_methods;
--@@ 92 realtime public.sale_items
alter publication supabase_realtime add table public.sale_items;
--@@ 92 realtime public.sale_trade_in_items
alter publication supabase_realtime add table public.sale_trade_in_items;
--@@ 92 realtime public.sales
alter publication supabase_realtime add table public.sales;
--@@ 92 realtime public.sellers
alter publication supabase_realtime add table public.sellers;
--@@ 92 realtime public.simulator_trade_in_adjustments
alter publication supabase_realtime add table public.simulator_trade_in_adjustments;
--@@ 92 realtime public.simulator_trade_in_values
alter publication supabase_realtime add table public.simulator_trade_in_values;
--@@ 92 realtime public.stock_items
alter publication supabase_realtime add table public.stock_items;
--@@ 92 realtime public.stock_reservations
alter publication supabase_realtime add table public.stock_reservations;
--@@ 92 realtime public.stores
alter publication supabase_realtime add table public.stores;
--@@ 92 realtime public.transactions
alter publication supabase_realtime add table public.transactions;
