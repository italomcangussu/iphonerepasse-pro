begin;

drop policy if exists "Auth Upload DevImages" on storage.objects;
create policy "Auth Upload DevImages"
on storage.objects
for insert
to authenticated
with check (bucket_id = 'device-images');

drop policy if exists "Auth Upload Logos" on storage.objects;
create policy "Auth Upload Logos"
on storage.objects
for insert
to authenticated
with check (bucket_id = 'logos');

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

drop policy if exists "Auth Update DevImages" on storage.objects;
create policy "Auth Update DevImages"
on storage.objects
for update
to authenticated
using (bucket_id = 'device-images')
with check (bucket_id = 'device-images');

drop policy if exists "Auth Update Logos" on storage.objects;
create policy "Auth Update Logos"
on storage.objects
for update
to authenticated
using (bucket_id = 'logos')
with check (bucket_id = 'logos');

drop policy if exists "Auth Delete DevImages" on storage.objects;
create policy "Auth Delete DevImages"
on storage.objects
for delete
to authenticated
using (bucket_id = 'device-images');

drop policy if exists "Auth Delete Logos" on storage.objects;
create policy "Auth Delete Logos"
on storage.objects
for delete
to authenticated
using (bucket_id = 'logos');

commit;
