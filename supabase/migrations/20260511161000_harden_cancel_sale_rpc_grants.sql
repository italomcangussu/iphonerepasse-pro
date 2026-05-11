begin;

revoke all on function public.handle_sale_before_delete() from public;
revoke all on function public.handle_sale_before_delete() from anon;
revoke all on function public.handle_sale_before_delete() from authenticated;

revoke all on function public.cancel_sale(text) from public;
revoke all on function public.cancel_sale(text) from anon;
grant execute on function public.cancel_sale(text) to authenticated;

commit;
