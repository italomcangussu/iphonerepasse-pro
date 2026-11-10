# public.crm_funnels
> tabela · RLS on · ~<100 linhas

## Colunas
| Coluna | Tipo | Nulo | Padrão | Nota |
|---|---|---|---|---|
| id | uuid | não | `gen_random_uuid()` |  |
| store_id | text | não |  |  |
| channel_id | uuid | sim |  |  |
| name | text | não |  |  |
| description | text | sim |  |  |
| stages | jsonb | não | `'[]'::jsonb` |  |
| funnel_type | text | não | `'sales'::text` |  |
| is_default | boolean | sim | `false` |  |
| is_active | boolean | sim | `true` |  |
| created_at | timestamp with time zone | sim | `now()` |  |
| updated_at | timestamp with time zone | sim | `now()` |  |
| tenant_id | uuid | não |  |  |

## Chaves e restrições
- PK (id)
- FK (tenant_id) → public.tenants(id)
- CHECK valid_crm_funnel_type: `CHECK ((funnel_type = ANY (ARRAY['sales'::text, 'post_sale'::text])))`

## Referenciada por (1)
public.crm_channels.inbound_funnel_id

## Índices
- crm_funnels_tenant_idx: `btree (tenant_id)`
- idx_crm_funnels_store: `btree (store_id)`
- idx_crm_funnels_type: `btree (funnel_type)`
- unique_crm_funnel_default_per_type: `btree (store_id, funnel_type) WHERE (is_default = true)` único

## Políticas RLS
- "crm_funnels_store_scope" — ALL para authenticated · using `crm_can_access_store(store_id)` · check `crm_can_access_store(store_id)`
- "tenant_isolation" — ALL para authenticated (restritiva) · using `(tenant_id = ( SELECT current_tenant_id() AS current_tenant_id))` · check `(tenant_id = ( SELECT current_tenant_id() AS current_tenant_id))`

## Gatilhos
- trg_crm_funnels_set_updated_at — BEFORE UPDATE → public.crm_set_updated_at()
- zz_tenant_fill — BEFORE INSERT → private.tenant_fill()
- zz_tenant_guard — BEFORE UPDATE OF tenant_id → private.tenant_guard()

## Grants
- anon: siud · authenticated: siud (s=select i=insert u=update d=delete)
