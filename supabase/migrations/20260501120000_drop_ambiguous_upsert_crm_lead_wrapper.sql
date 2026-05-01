-- PostgREST cannot reliably choose between the 6-argument wrapper and the
-- full upsert_crm_lead signature because the full function also has defaults.
-- Keep only the full signature so Edge Functions and frontend RPC calls are
-- unambiguous.
drop function if exists public.upsert_crm_lead(text, text, text, text, text, uuid);

grant execute on function public.upsert_crm_lead(
  text,
  text,
  text,
  text,
  text,
  uuid,
  text,
  text,
  text,
  text,
  text,
  text,
  text,
  text
) to anon, authenticated;

notify pgrst, 'reload schema';
