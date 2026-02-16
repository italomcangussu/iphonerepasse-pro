alter table public.stock_items
  add column if not exists observations text;

update public.stock_items
set observations = lower(trim(split_part(notes, ' | ', 1)))
where status = 'Em Preparação'
  and coalesce(observations, '') = ''
  and coalesce(notes, '') ilike 'TROCAR%';
