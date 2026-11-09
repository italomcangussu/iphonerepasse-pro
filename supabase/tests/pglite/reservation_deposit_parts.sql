-- Reserva com vários sinais: um lançamento por sinal, na conta da forma de cada um.
insert into public.stock_items (id, type, model, condition, status)
values ('stk_parts', 'iPhone', 'iPhone 15', 'Seminovo', 'Disponível'),
       ('stk_legacy', 'iPhone', 'iPhone 14', 'Seminovo', 'Disponível');

select public.reserve_stock_item('stk_parts', jsonb_build_object(
  'customerName', 'Ana', 'customerPhone', '88999990000',
  'depositParts', jsonb_build_array(
    jsonb_build_object('amount', 500, 'method', 'Pix'),
    jsonb_build_object('amount', 300, 'method', 'Dinheiro')
  ),
  'tradeIn', jsonb_build_object('description', 'iPhone 11 64GB', 'value', 1200)
));

do $$
declare r public.stock_reservations%rowtype;
begin
  select * into r from public.stock_reservations where stock_item_id = 'stk_parts' and status = 'active';
  assert r.deposit_amount = 800, 'total dos sinais';
  assert r.deposit_payment_method = 'Pix', 'forma principal é a do 1º sinal';
  assert jsonb_array_length(r.deposit_parts) = 2, 'dois sinais gravados';
  assert r.deposit_transaction_id = r.deposit_parts -> 0 ->> 'transactionId', '1º sinal é o lançamento principal';
  assert r.trade_in ->> 'description' = 'iPhone 11 64GB' and (r.trade_in ->> 'value')::numeric = 1200, 'troca gravada';
  assert (select account from public.transactions where id = r.deposit_parts -> 0 ->> 'transactionId') = 'Conta Bancária', 'Pix na conta';
  assert (select account from public.transactions where id = r.deposit_parts -> 1 ->> 'transactionId') = 'Cofre', 'dinheiro no cofre';
  assert (select count(*) from public.transactions where category = 'Adiantamento de reserva' and description = 'Adiantamento de reserva - Ana') = 2, 'dois lançamentos';
  assert (select status from public.stock_items where id = 'stk_parts') = 'Reservado', 'aparelho reservado';
end $$;

-- Editar mantendo os sinais reaproveita os lançamentos; tirar um sinal apaga o lançamento dele.
create temp table ids as
  select deposit_parts -> 0 ->> 'transactionId' as first_id, deposit_parts -> 1 ->> 'transactionId' as second_id
    from public.stock_reservations where stock_item_id = 'stk_parts' and status = 'active';

select public.reserve_stock_item('stk_parts', jsonb_build_object(
  'customerName', 'Ana', 'customerPhone', '88999990000',
  'depositParts', jsonb_build_array(
    jsonb_build_object('amount', 500, 'method', 'Pix'),
    jsonb_build_object('amount', 300, 'method', 'Dinheiro')
  )
));

do $$
declare r public.stock_reservations%rowtype;
begin
  select * into r from public.stock_reservations where stock_item_id = 'stk_parts' and status = 'active';
  assert r.deposit_parts -> 0 ->> 'transactionId' = (select first_id from ids), 're-salvar mantém o 1º lançamento';
  assert r.deposit_parts -> 1 ->> 'transactionId' = (select second_id from ids), 're-salvar mantém o 2º lançamento';
  assert r.trade_in is null, 'troca removida';
end $$;

select public.reserve_stock_item('stk_parts', jsonb_build_object(
  'customerName', 'Ana', 'customerPhone', '88999990000',
  'depositParts', jsonb_build_array(jsonb_build_object('amount', 500, 'method', 'Pix'))
));

do $$ begin
  assert not exists (select 1 from public.transactions where id = (select second_id from ids)), 'sinal removido apaga o lançamento';
  assert exists (select 1 from public.transactions where id = (select first_id from ids)), '1º sinal continua';
  assert (select deposit_amount from public.stock_reservations where stock_item_id = 'stk_parts' and status = 'active') = 500, 'total atualizado';
end $$;

-- Devolver os sinais estorna cada um pela conta em que entrou.
select public.reserve_stock_item('stk_parts', jsonb_build_object(
  'customerName', 'Ana', 'customerPhone', '88999990000',
  'depositParts', jsonb_build_array(
    jsonb_build_object('amount', 500, 'method', 'Pix'),
    jsonb_build_object('amount', 300, 'method', 'Dinheiro')
  )
));
select public.release_stock_reservation('stk_parts', true);

do $$
declare r public.stock_reservations%rowtype;
begin
  select * into r from public.stock_reservations where stock_item_id = 'stk_parts' order by created_at desc limit 1;
  assert r.status = 'released', 'reserva liberada';
  assert (select count(*) from public.transactions where category = 'Estorno de reserva' and description = 'Estorno de reserva - Ana') = 2, 'dois estornos';
  assert (select account from public.transactions where id = r.deposit_parts -> 0 ->> 'refundTransactionId') = 'Conta Bancária', 'Pix estornado da conta';
  assert (select amount from public.transactions where id = r.deposit_parts -> 1 ->> 'refundTransactionId') = 300, 'valor do 2º estorno';
  assert (select account from public.transactions where id = r.deposit_parts -> 1 ->> 'refundTransactionId') = 'Cofre', 'dinheiro estornado do cofre';
  assert r.deposit_refund_transaction_id = r.deposit_parts -> 0 ->> 'refundTransactionId', 'estorno principal registrado';
end $$;

-- Payload antigo (um sinal só) continua funcionando.
select public.reserve_stock_item('stk_legacy', jsonb_build_object(
  'customerName', 'Bruno', 'customerPhone', '88999991111',
  'depositAmount', 200, 'depositPaymentMethod', 'Dinheiro'
));

do $$
declare r public.stock_reservations%rowtype;
begin
  select * into r from public.stock_reservations where stock_item_id = 'stk_legacy' and status = 'active';
  assert r.deposit_amount = 200 and r.deposit_payment_method = 'Dinheiro', 'sinal legado';
  assert jsonb_array_length(r.deposit_parts) = 1, 'sinal legado vira uma parte';
  assert (select account from public.transactions where id = r.deposit_transaction_id) = 'Cofre', 'legado no cofre';
end $$;

-- Sinal sem forma é recusado.
do $$ begin
  begin
    perform public.reserve_stock_item('stk_legacy', jsonb_build_object(
      'customerName', 'Bruno', 'customerPhone', '88999991111',
      'depositParts', jsonb_build_array(jsonb_build_object('amount', 100))
    ));
    assert false, 'deveria recusar sinal sem forma';
  exception when others then
    assert sqlerrm = 'Informe a forma do sinal.', 'mensagem do sinal sem forma: ' || sqlerrm;
  end;
end $$;
