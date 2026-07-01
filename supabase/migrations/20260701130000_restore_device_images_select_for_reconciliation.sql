begin;

-- Restaura a policy de SELECT (autenticado) em `device-images` e `logos`.
--
-- CONTEXTO / BUG CORRIGIDO:
-- A migration 20260605120000 removeu a policy "Auth Read *" desses buckets
-- públicos para silenciar o advisor `public_bucket_allows_listing`, partindo da
-- premissa de que o app "só faz upload + getPublicUrl + fetch da URL pública".
-- Essa premissa estava ERRADA: services/storage.ts -> removeImages() chama
-- `supabase.storage.from(bucket).remove([...])`, e a Storage API precisa
-- SELECIONAR o objeto (findObject) sob o papel do usuário antes de apagá-lo.
-- Sem policy de SELECT, todo DELETE autenticado retornava 403 "Access denied",
-- então a reconciliação de storage (updateStockItem / removeStockItem /
-- descarte de fotos novas) falhava em silêncio e os órfãos SEGUIAM acumulando.
--
-- TRADE-OFF: reintroduz o aviso `public_bucket_allows_listing` para esses
-- buckets — mesmo trade-off já aceito em `crm-media` (que tem read público).
-- Aqui o SELECT é restrito a `authenticated` (equipe logada), exposição menor
-- que crm-media, e as imagens já são 100% públicas via a URL pública mesmo.
-- As policies de INSERT/UPDATE/DELETE seguem restritas a autenticados.

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

commit;
