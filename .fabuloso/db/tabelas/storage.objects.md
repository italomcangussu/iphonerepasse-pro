# storage.objects
> tabela · RLS on — tabela do Supabase Storage; só as políticas são mapeadas

## Políticas RLS
- "Auth Delete CRM Media" — DELETE para authenticated · using `(bucket_id = 'crm-media'::text)`
- "Auth Delete DevImages" — DELETE para authenticated · using `(bucket_id = 'device-images'::text)`
- "Auth Delete Logos" — DELETE para authenticated · using `(bucket_id = 'logos'::text)`
- "Auth Delete PayableDebtReceipts" — DELETE para authenticated · using `((bucket_id = 'payable-debt-receipts'::text) AND ("current_role"() = 'admin'::text))`
- "Auth Read DevImages" — SELECT para authenticated · using `(bucket_id = 'device-images'::text)`
- "Auth Read Logos" — SELECT para authenticated · using `(bucket_id = 'logos'::text)`
- "Auth Read PayableDebtReceipts" — SELECT para authenticated · using `((bucket_id = 'payable-debt-receipts'::text) AND ("current_role"() = 'admin'::text))`
- "Auth Update CRM Media" — UPDATE para authenticated · using `(bucket_id = 'crm-media'::text)` · check `(bucket_id = 'crm-media'::text)`
- "Auth Update DevImages" — UPDATE para authenticated · using `(bucket_id = 'device-images'::text)` · check `(bucket_id = 'device-images'::text)`
- "Auth Update Logos" — UPDATE para authenticated · using `(bucket_id = 'logos'::text)` · check `(bucket_id = 'logos'::text)`
- "Auth Upload CRM Media" — INSERT para authenticated · check `(bucket_id = 'crm-media'::text)`
- "Auth Upload DevImages" — INSERT para authenticated · check `(bucket_id = 'device-images'::text)`
- "Auth Upload Logos" — INSERT para authenticated · check `(bucket_id = 'logos'::text)`
- "Auth Upload PayableDebtReceipts" — INSERT para authenticated · check `((bucket_id = 'payable-debt-receipts'::text) AND ("current_role"() = 'admin'::text))`
- "Service role full access on receipts" — ALL para service_role · using `(bucket_id = 'receipts'::text)` · check `(bucket_id = 'receipts'::text)`
