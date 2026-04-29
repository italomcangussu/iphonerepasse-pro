-- Create private storage bucket for PDF receipts sent via WhatsApp
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'receipts',
  'receipts',
  false,
  10485760,
  array['application/pdf']
)
on conflict (id) do nothing;

-- Allow service role (used by Edge Functions) full access
do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'storage' and tablename = 'objects'
      and policyname = 'Service role full access on receipts'
  ) then
    execute $policy$
      create policy "Service role full access on receipts"
      on storage.objects
      for all
      to service_role
      using (bucket_id = 'receipts')
      with check (bucket_id = 'receipts')
    $policy$;
  end if;
end;
$$;
