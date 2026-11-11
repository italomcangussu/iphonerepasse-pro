begin;

-- Vídeos do aparelho: URLs públicas do bucket `device-videos`, na ordem em que
-- foram adicionados. Coluna separada de `photos` para não misturar com a capa
-- e com a reconciliação de `device-images`.
alter table public.stock_items
  add column if not exists videos text[] not null default '{}'::text[];

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'device-videos',
  'device-videos',
  true,
  52428800,
  array['video/mp4', 'video/quicktime', 'video/webm']::text[]
)
on conflict (id) do update
set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- Mesmo desenho de `device-images`: equipe logada envia, lê (a Storage API
-- precisa do SELECT para apagar) e remove; a leitura pública é pela URL pública.
drop policy if exists "Auth Upload DevVideos" on storage.objects;
create policy "Auth Upload DevVideos"
on storage.objects for insert to authenticated
with check (bucket_id = 'device-videos');

drop policy if exists "Auth Read DevVideos" on storage.objects;
create policy "Auth Read DevVideos"
on storage.objects for select to authenticated
using (bucket_id = 'device-videos');

drop policy if exists "Auth Delete DevVideos" on storage.objects;
create policy "Auth Delete DevVideos"
on storage.objects for delete to authenticated
using (bucket_id = 'device-videos');

commit;
