begin;

-- ============================================================
-- transfer_reversal_flow: estorno automático de transferências
-- Problema: ao transferir entre Conta Bancária e Cofre são criados
-- dois lançamentos independentes (um OUT na origem, um IN no destino)
-- sem nenhum vínculo entre eles. Cancelar um lado não tinha efeito
-- sobre o outro, deixando o saldo inconsistente.
-- Solução: vincular o par com transfer_group_id e fazer o
-- cancel_transaction estornar todos os lançamentos do mesmo grupo.
-- ============================================================

alter table public.transactions
  add column if not exists transfer_group_id text null;

create index if not exists idx_transactions_transfer_group_id
  on public.transactions (transfer_group_id);

-- Backfill best-effort: vincula pares de transferências já existentes.
-- Para cada OUT "Transferência para X" sem grupo, procura o IN
-- "Transferência de {conta-origem}" na conta X, mesmo valor e mesmo dia,
-- mais próximo no tempo. Pareamento 1:1 determinístico.
do $$
declare
  v_out record;
  v_in_id text;
  v_to_account text;
  v_group text;
begin
  for v_out in
    select id, account, amount, date, description
    from public.transactions
    where type = 'OUT'
      and transfer_group_id is null
      and description like 'Transferência para %'
    order by date, id
  loop
    v_to_account := replace(v_out.description, 'Transferência para ', '');

    select id into v_in_id
    from public.transactions
    where type = 'IN'
      and transfer_group_id is null
      and description = 'Transferência de ' || v_out.account
      and account = v_to_account
      and amount = v_out.amount
      and date::date = v_out.date::date
    order by abs(extract(epoch from (date - v_out.date))), date, id
    limit 1;

    if v_in_id is not null then
      v_group := 'trf_' || replace(gen_random_uuid()::text, '-', '');
      update public.transactions
        set transfer_group_id = v_group
      where id in (v_out.id, v_in_id);
    end if;
  end loop;
end $$;

-- Atualiza o RPC de cancelamento para estornar o lançamento pareado
-- da transferência. Os dois lançamentos compartilham transfer_group_id;
-- ao cancelar um, removemos os demais do mesmo grupo para que o dinheiro
-- volte/saia de ambas as contas automaticamente.
create or replace function public.cancel_transaction(p_transaction_id text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_trx public.transactions%rowtype;
begin
  -- 1. Verificar permissão
  if public.current_role() <> 'admin' then
    raise exception 'Apenas administradores podem cancelar lançamentos.'
      using errcode = '42501';
  end if;

  -- 2. Buscar e travar o lançamento
  select * into v_trx
  from public.transactions
  where id = p_transaction_id
  for update;

  if not found then
    raise exception 'Lançamento não encontrado: %', p_transaction_id
      using errcode = 'P0002';
  end if;

  -- 3. Se vinculado a um debt_payment, deletar o payment primeiro para que o
  --    trigger handle_debt_payment_after_delete restaure o saldo da dívida.
  if v_trx.debt_payment_id is not null then
    delete from public.debt_payments where id = v_trx.debt_payment_id;
  end if;

  -- 4. Se vinculado a um payable_debt_payment, deletar o payment primeiro para
  --    que o trigger handle_payable_debt_payment_after_delete restaure o saldo.
  if v_trx.payable_debt_payment_id is not null then
    update public.transactions
      set payable_debt_payment_id = null
    where id = p_transaction_id;

    delete from public.payable_debt_payments where id = v_trx.payable_debt_payment_id;
  end if;

  -- 5. Se for parte de uma transferência, estornar o(s) lançamento(s) pareado(s).
  --    Ambos os lados compartilham transfer_group_id; ao remover o par o saldo
  --    é devolvido à conta de origem e retirado do destino automaticamente.
  if v_trx.transfer_group_id is not null then
    delete from public.transactions
    where transfer_group_id = v_trx.transfer_group_id
      and id <> p_transaction_id;
  end if;

  -- 6. Deletar o lançamento principal.
  delete from public.transactions where id = p_transaction_id;
end;
$$;

grant execute on function public.cancel_transaction(text) to authenticated;

commit;
