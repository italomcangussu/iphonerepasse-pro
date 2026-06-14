begin;

-- Endurecimento dos buckets públicos de imagem (`device-images`, `logos`).
--
-- Os buckets continuam públicos: as imagens são servidas pelo endpoint público
-- (`/storage/v1/object/public/...`), que NÃO depende de policy de SELECT em
-- `storage.objects`. A policy de leitura ampla apenas permitia LISTAR todos os
-- arquivos do bucket por clientes autenticados — exposição desnecessária
-- apontada pelo advisor `public_bucket_allows_listing`.
--
-- O app nunca lista nem usa `storage.download()` para esses buckets (apenas
-- `upload` + `getPublicUrl` e `fetch` da URL pública), então a remoção não
-- afeta o funcionamento. As policies de INSERT/UPDATE/DELETE permanecem
-- restritas a usuários autenticados.
drop policy if exists "Auth Read DevImages" on storage.objects;
drop policy if exists "Auth Read Logos" on storage.objects;

commit;

-- ----------------------------------------------------------------------------
-- Limpeza de objetos órfãos em `device-images`
-- ----------------------------------------------------------------------------
-- A remoção FÍSICA de objetos órfãos NÃO é feita aqui: o Postgres do Supabase
-- bloqueia `DELETE` direto em `storage.objects` (trigger `storage.protect_delete`)
-- justamente para evitar perda acidental. A remoção deve passar pela Storage API.
--
-- A partir desta entrega o app já reconcilia o storage automaticamente
-- (services/storage.ts -> removeImages, acionado em updateStockItem,
-- removeStockItem e ao descartar fotos novas no StockFormModal), então novos
-- órfãos deixam de se acumular.
--
-- Para limpar o backlog já existente, rode o script de manutenção (usa a
-- Storage API com a service role key):
--   SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... \
--     node scripts/cleanup-orphan-device-images.mjs
-- Use --dry-run para apenas listar os candidatos sem apagar.
