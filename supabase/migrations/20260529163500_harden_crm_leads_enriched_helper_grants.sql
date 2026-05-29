begin;

revoke all on function public.crm_default_sales_stage(text) from public, anon, authenticated;
revoke all on function public.crm_lead_first_name(text) from public, anon, authenticated;
revoke all on function public.crm_build_lead_summary_short(text, text, text, text) from public, anon, authenticated;
revoke all on function public.crm_build_lead_summary_operational(text, text, text, text, text, text, text, timestamptz, text, timestamptz) from public, anon, authenticated;
revoke all on function public.crm_leads_sync_enriched_columns() from public, anon, authenticated;
revoke all on function public.crm_messages_sync_lead_last_message_content() from public, anon, authenticated;
revoke all on function public.crm_event_log_sync_lead_last_event() from public, anon, authenticated;

commit;
