begin;

insert into public.crm_ai_entry_settings (
  store_id,
  business_hours,
  special_business_hours,
  updated_at
)
select
  'st-cae5b9ed-d4e6-405f-9151-1c80542992ec',
  '{
    "mon": { "open": "09:00", "close": "22:00" },
    "tue": { "open": "09:00", "close": "22:00" },
    "wed": { "open": "09:00", "close": "22:00" },
    "thu": { "open": "09:00", "close": "22:00" },
    "fri": { "open": "09:00", "close": "22:00" },
    "sat": { "open": "09:00", "close": "22:00" },
    "sun": { "open": "14:00", "close": "20:00" }
  }'::jsonb,
  '{
    "2026-04-03": {
      "closed": true,
      "label": "Páscoa"
    }
  }'::jsonb,
  now()
where exists (
  select 1
  from public.stores
  where id = 'st-cae5b9ed-d4e6-405f-9151-1c80542992ec'
)
on conflict (store_id) do update
set
  business_hours = excluded.business_hours,
  special_business_hours = excluded.special_business_hours,
  updated_at = now();

commit;
