-- Vídeos do aparelho: coluna com padrão vazio e bucket próprio com limites e políticas.
do $$ begin
  assert (select column_default from information_schema.columns
          where table_schema = 'public' and table_name = 'stock_items' and column_name = 'videos') like '%{}%',
    'stock_items.videos nasce vazio';
  assert (select is_nullable from information_schema.columns
          where table_schema = 'public' and table_name = 'stock_items' and column_name = 'videos') = 'NO',
    'stock_items.videos não aceita nulo';

  assert (select public and file_size_limit = 52428800
            and allowed_mime_types @> array['video/mp4', 'video/quicktime', 'video/webm']
          from storage.buckets where id = 'device-videos'),
    'bucket device-videos público, 50 MB, só vídeo';

  assert (select count(*) from pg_policies
          where schemaname = 'storage' and tablename = 'objects'
            and policyname in ('Auth Upload DevVideos', 'Auth Read DevVideos', 'Auth Delete DevVideos')
            and roles = '{authenticated}') = 3,
    'envio, leitura e remoção só para a equipe logada';
end $$;
