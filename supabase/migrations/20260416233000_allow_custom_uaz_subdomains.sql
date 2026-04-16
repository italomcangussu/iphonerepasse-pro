-- Allow dedicated UAZAPI subdomains while keeping DNS-safe validation.

update public.crm_channels
set uaz_subdomain = lower(coalesce(nullif(btrim(uaz_subdomain), ''), 'api'))
where uaz_subdomain is null
   or uaz_subdomain <> lower(coalesce(nullif(btrim(uaz_subdomain), ''), 'api'));

alter table public.crm_channels
  drop constraint if exists crm_channels_uaz_subdomain_check;

alter table public.crm_channels
  add constraint crm_channels_uaz_subdomain_check
  check (
    uaz_subdomain ~ '^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$'
  );
