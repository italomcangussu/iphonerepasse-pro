begin;

revoke all on function public.resolve_crm_lead_for_sale(text, text, text, boolean) from public, anon, authenticated;
revoke all on function public.sales_set_crm_lead_id() from public, anon, authenticated;
revoke all on function public.crm_sales_purchase_sync_trigger() from public, anon, authenticated;
revoke all on function public.crm_refresh_purchase_metrics_for_customer(text) from public, anon, authenticated;

revoke all on function public.crm_refresh_lead_purchase_metrics(text) from public, anon, authenticated;
grant execute on function public.crm_refresh_lead_purchase_metrics(text) to service_role;

notify pgrst, 'reload schema';

commit;
