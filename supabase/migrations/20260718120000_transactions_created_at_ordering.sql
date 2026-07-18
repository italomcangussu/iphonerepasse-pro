-- Extrato de Movimentações fora de ordem cronológica.
--
-- O extrato era ordenado apenas pela coluna `transactions.date`, que guarda uma
-- "data de negócio" e NÃO o horário real em que o lançamento foi criado:
--   * vendas (pdv_*)            -> date = coalesce(sale.date, now())  (todos os
--                                 lançamentos da mesma venda com timestamp igual)
--   * quitação de dívida        -> date = coalesce(paid_at, now())
--   * pagamento de dívida       -> date = data escolhida às 12:00 (meio-dia)
--   * aporte/pagamento manual   -> date = now() (horário real aproximado)
-- Com valores heterogêneos (uns à meia-noite/meio-dia, outros com hora real) e
-- desempate por `id` (UUID aleatório), lançamentos do mesmo dia apareciam fora
-- da ordem em que foram realizados.
--
-- Correção: registrar o horário real de inserção (created_at) e passar a
-- desempatar por ele dentro de cada dia.

do $$
begin
  if not exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'transactions'
      and column_name = 'created_at'
  ) then
    alter table public.transactions
      add column created_at timestamptz not null default now();

    -- Backfill do histórico: aproxima created_at pela data de negócio para
    -- preservar a ordenação cronológica por dia já existente. Lançamentos novos
    -- passam a receber o now() real da inserção via default.
    update public.transactions set created_at = coalesce(date, now());
  end if;
end $$;

-- Suporte à ordenação (dia desc, horário real desc).
create index if not exists idx_transactions_date_created_at
  on public.transactions (date desc, created_at desc);
