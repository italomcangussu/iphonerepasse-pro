begin;

revoke all on function public.delete_debt_cascade(text) from public;
revoke all on function public.delete_debt_cascade(text) from anon;
grant execute on function public.delete_debt_cascade(text) to authenticated;

commit;
