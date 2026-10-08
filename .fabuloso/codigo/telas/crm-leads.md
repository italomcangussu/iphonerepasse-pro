# /crm/leads — pages/crm/LeadsPage.tsx
Layout/guardas: ProtectedLayout · Rota declarada em: App.tsx

## Árvore de componentes
- LeadsPage — pages/crm/LeadsPage.tsx
  - CRMLeads — pages/CRMLeads.tsx
    - CRMPageFrame — components/crm/CRMPageFrame.tsx

## Hooks
- useFeedback — components/ui/ToastProvider.tsx → —
- useToast — components/ui/ToastProvider.tsx → —
- usePageHeader — contexts/PageHeaderContext.tsx → —
- useAsyncHandler — hooks/useAsyncHandler.ts → —
- useData — services/dataContext.tsx → —

## Dados alcançados
| Recurso | Operações | Onde |
|---|---|---|
| rpc get_lead_full_data | — | pages/CRMLeads.tsx:225 |
| rpc mark_lead_as_customer | — | pages/CRMLeads.tsx:311 |
| rpc move_crm_lead_stage | — | pages/CRMLeads.tsx:331 |
| rpc search_leads | — | pages/CRMLeads.tsx:184 |
| tabela crm_funnel_stages | select | pages/CRMLeads.tsx:160 |
