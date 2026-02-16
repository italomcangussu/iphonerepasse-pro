begin;

alter table public.sellers
  add column if not exists store_id text;

alter table public.sellers
  alter column email drop not null,
  alter column auth_user_id drop not null;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'sellers_store_id_fkey'
      and conrelid = 'public.sellers'::regclass
  ) then
    alter table public.sellers
      add constraint sellers_store_id_fkey
      foreign key (store_id) references public.stores(id) on delete set null;
  end if;
end $$;

create index if not exists idx_sellers_store_id on public.sellers (store_id);

commit;
