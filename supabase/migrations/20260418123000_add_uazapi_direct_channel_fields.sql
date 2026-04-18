-- Add direct UAZAPI channel fields (instance/admin tokens, status and webhook metadata).

alter table public.crm_channels
  add column if not exists uaz_instance_token text,
  add column if not exists uaz_admin_token text,
  add column if not exists uaz_instance_name text,
  add column if not exists uaz_webhook_id text,
  add column if not exists uaz_connection_status text,
  add column if not exists uaz_last_status jsonb,
  add column if not exists uaz_last_status_at timestamptz;

-- Backfill for legacy channels using api_key as instance token fallback.
update public.crm_channels
set uaz_instance_token = coalesce(
  nullif(btrim(uaz_instance_token), ''),
  nullif(btrim(api_key), '')
)
where provider = 'uazapi';

update public.crm_channels
set uaz_connection_status = 'unknown'
where uaz_connection_status is null
   or btrim(uaz_connection_status) = '';

update public.crm_channels
set uaz_last_status = '{}'::jsonb
where uaz_last_status is null;

alter table public.crm_channels
  alter column uaz_connection_status set default 'unknown',
  alter column uaz_connection_status set not null,
  alter column uaz_last_status set default '{}'::jsonb,
  alter column uaz_last_status set not null;

alter table public.crm_channels
  drop constraint if exists crm_channels_uaz_connection_status_check;

alter table public.crm_channels
  add constraint crm_channels_uaz_connection_status_check
  check (uaz_connection_status in ('unknown', 'connecting', 'connected', 'disconnected', 'error'));
