# public.care_settings
> tabela · RLS on · ~0 linhas

## Colunas
| Coluna | Tipo | Nulo | Padrão | Nota |
|---|---|---|---|---|
| id | boolean | não | `true` |  |
| otp_ttl_minutes | integer | não | `5` |  |
| otp_max_attempts | integer | não | `5` |  |
| otp_resend_cooldown_seconds | integer | não | `60` |  |
| otp_max_sends | integer | não | `5` |  |
| signature_link_ttl_hours | integer | não | `72` |  |
| clauses_version | text | não | `'RC-2026.11-v1'::text` |  |
| contractor_legal_name | text | sim |  |  |
| contractor_cnpj | text | sim |  |  |
| contractor_address | text | sim |  |  |
| default_services_description | text | sim |  |  |
| updated_at | timestamp with time zone | não | `now()` |  |
| updated_by | uuid | sim | `auth.uid()` |  |
| default_usage_limits | text | sim |  |  |
| preventive_checkup_months | integer | sim |  |  |
| privacy_contact | text | sim |  |  |
| suspension_grace_days | integer | não | `5` |  |

## Chaves e restrições
- PK (id)
- CHECK care_settings_id_check: `CHECK (id)`
- CHECK care_settings_otp_max_attempts_check: `CHECK (((otp_max_attempts >= 1) AND (otp_max_attempts <= 10)))`
- CHECK care_settings_otp_max_sends_check: `CHECK (((otp_max_sends >= 1) AND (otp_max_sends <= 20)))`
- CHECK care_settings_otp_resend_cooldown_seconds_check: `CHECK (((otp_resend_cooldown_seconds >= 0) AND (otp_resend_cooldown_seconds <= 900)))`
- CHECK care_settings_otp_ttl_minutes_check: `CHECK (((otp_ttl_minutes >= 1) AND (otp_ttl_minutes <= 30)))`
- CHECK care_settings_preventive_checkup_months_check: `CHECK (((preventive_checkup_months IS NULL) OR ((preventive_checkup_months >= 1) AND (preventive_checkup_months <= 12))))`
- CHECK care_settings_signature_link_ttl_hours_check: `CHECK (((signature_link_ttl_hours >= 1) AND (signature_link_ttl_hours <= 720)))`
- CHECK care_settings_suspension_grace_days_check: `CHECK (((suspension_grace_days >= 1) AND (suspension_grace_days <= 60)))`

## Políticas RLS
- "care_settings_admin_update" — UPDATE para authenticated · using `(( SELECT "current_role"() AS "current_role") = 'admin'::text)` · check `(( SELECT "current_role"() AS "current_role") = 'admin'::text)`
- "care_settings_select" — SELECT para authenticated · using `(( SELECT "current_role"() AS "current_role") = ANY (ARRAY['admin'::text, 'seller'::text]))`

## Gatilhos
- care_settings_audit — AFTER INSERT OR DELETE OR UPDATE → private.care_audit()
- care_settings_touch — BEFORE UPDATE → private.care_touch_updated_at()

## Grants
- anon: — · authenticated: siud (s=select i=insert u=update d=delete)
