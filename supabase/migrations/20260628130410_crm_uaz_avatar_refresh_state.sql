begin;

alter table public.crm_leads
  add column if not exists avatar_last_checked_at timestamptz,
  add column if not exists avatar_refreshed_at timestamptz;

update public.crm_leads
set
  avatar_last_checked_at = coalesce(
    avatar_last_checked_at,
    updated_at,
    created_at,
    now()
  ),
  avatar_refreshed_at = coalesce(
    avatar_refreshed_at,
    updated_at,
    created_at,
    now()
  )
where avatar_lead_updated is true
  and nullif(btrim(avatar_url), '') is not null;

comment on column public.crm_leads.avatar_last_checked_at is
  'Última consulta de avatar concluída no provedor, inclusive quando não havia foto visível.';

comment on column public.crm_leads.avatar_refreshed_at is
  'Último upload bem-sucedido do avatar do lead no Storage do CRM.';

commit;
