begin;

create or replace function public.delete_debt_cascade(p_debt_id text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if public.current_role() <> 'admin' then
    raise exception 'Only admins can delete debts.' using errcode = '42501';
  end if;

  perform 1
  from public.debts
  where id = p_debt_id
  for update;

  if not found then
    raise exception 'Dívida não encontrada.';
  end if;

  delete from public.debt_payments
  where debt_id = p_debt_id;

  delete from public.debts
  where id = p_debt_id;
end;
$$;

grant execute on function public.delete_debt_cascade(text) to authenticated;

commit;
