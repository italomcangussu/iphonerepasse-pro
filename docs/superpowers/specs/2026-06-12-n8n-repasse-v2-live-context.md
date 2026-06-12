# N8N Repasse Pro v2 Live Context

Atualizado em 2026-06-12 a partir da API publica do n8n.

## Workflow operacional atual

- Nome: `ia repasse-pro v2 avancada`
- ID: `Cr4fPWe0prwS6XjI`
- Status: ativo
- Ultima atualizacao n8n: `2026-06-12T17:06:57.162Z`
- Total de nodes exportados: 138
- Webhook de producao: `POST /webhook/repasse`
- Snapshot local: `output/n8n/ia-repasse-pro-v2-current.json`

O workflow antigo `ia repasse-pro` (`oWNdWPUq6kEFitsnl8OpH`) nao deve ser usado como referencia operacional.

## Contratos de API usados pelo workflow

- `crm-leads-api` GET/POST usa header `x-api-key` com `CRM_N8N_API_KEY`.
- `crm-leads-api` POST atualiza memoria, `lead_state` e funil por actions separadas:
  - `update_memory`
  - `upsert_lead_state`
  - `update_funnel`
- `stock_items` e `crm_ai_entry_settings` via `/rest/v1` usam HTTP Custom Auth com headers:
  - `apikey`
  - `Authorization`
- `crm-send-message` usa `Authorization: Bearer ...`.
- `crm-simulator-quote` usa `x-api-key` com `CRM_N8N_API_KEY`.

## Evolucoes manuais observadas no snapshot vivo

- Nodes de persistencia de contexto de lead:
  - `CRM Leads POST Lead_State`
  - `CRM Leads POST Update Memory`
  - `CRM Leads POST update_funnel`
- Nodes de refresh/consulta de lead antes de roteamento:
  - `CRM Leads GET Webhook`
  - `CRM Leads GET Before Switch2`
  - `Code Refresh Lead State Before Switch2`
- Nodes de inventario com Supabase REST e Custom Auth:
  - `CRM Inventory Search`
  - `CRM Inventory Precheck`
  - `Code Build Inventory Lite`
- Consulta de horario comercial:
  - `Business hours`
- Envio de mensagem por Edge Function:
  - `HTTP Request`
  - `HTTP Request1`
  - `HTTP Request21`

## Manutencao

Use `node scripts/n8n/export-repasse-workflow.mjs` para atualizar o snapshot local do workflow vivo.
Esse script exporta o ID `Cr4fPWe0prwS6XjI` para `output/n8n/ia-repasse-pro-v2-current.json`.
