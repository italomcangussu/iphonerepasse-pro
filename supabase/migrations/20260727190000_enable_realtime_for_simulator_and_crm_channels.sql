-- Um único binding `postgres_changes` apontando para uma tabela FORA da
-- publicação `supabase_realtime` faz o Realtime descartar TODAS as subscriptions
-- daquele canal — e ainda assim responder `SUBSCRIBED` ao cliente. Nenhum erro,
-- nenhum log: o canal fica vivo e permanentemente mudo.
--
-- Comprovado em produção (2026-07-27): o canal `data-realtime` do ERP registra
-- 24 bindings; dois deles (`simulator_trade_in_values` e
-- `simulator_trade_in_adjustments`, criados em 2026-05-28) nunca entraram na
-- publicação. Resultado: zero linhas em `realtime.subscription` para o canal
-- inteiro — vendas, transações, dívidas e estoque paravam de atualizar ao vivo
-- entre usuários. Com os mesmos 22 bindings publicados, as 22 linhas aparecem e
-- os eventos fluem normalmente.
--
-- `crm_channels` (canal `crm-channels-live-status`, status de conexão UAZAPI)
-- estava no mesmo estado, mascarado pelo polling da tela de conexão.
--
-- `crm_conversations` e `crm_messages` já estão na publicação em produção, mas
-- foram adicionadas pelo dashboard e nunca por migration — um rebuild a partir
-- das migrations recriaria o bug no CRM. Entram aqui (idempotente) para que a
-- publicação passe a ser reproduzível pelo repositório.
do $$
declare
  t text;
  tables text[] := array[
    'simulator_trade_in_values',
    'simulator_trade_in_adjustments',
    'crm_channels',
    'crm_conversations',
    'crm_messages'
  ];
begin
  if not exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    create publication supabase_realtime;
  end if;

  foreach t in array tables loop
    if not exists (
      select 1
      from pg_publication_tables
      where pubname = 'supabase_realtime'
        and schemaname = 'public'
        and tablename = t
    ) then
      execute format('alter publication supabase_realtime add table public.%I', t);
    end if;
  end loop;
end
$$;
