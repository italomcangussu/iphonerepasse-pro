begin;

drop policy if exists "Public Access DevImages" on storage.objects;
drop policy if exists "Public Access Logos" on storage.objects;
drop policy if exists "Public Upload Logos" on storage.objects;
drop policy if exists "Public Update Logos" on storage.objects;

drop policy if exists "Auth Read DevImages" on storage.objects;
create policy "Auth Read DevImages"
on storage.objects
for select
to authenticated
using (bucket_id = 'device-images');

drop policy if exists "Auth Read Logos" on storage.objects;
create policy "Auth Read Logos"
on storage.objects
for select
to authenticated
using (bucket_id = 'logos');

create index if not exists idx_debts_sale_id on public.debts (sale_id);

drop index if exists public.idx_warranty_public_tokens_token_hash;

commit;
