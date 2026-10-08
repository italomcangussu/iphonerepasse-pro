# /admin-agent — pages/crm/AdminAgentPage.tsx
Layout/guardas: ProtectedRoute · CRMStandaloneLayout · CRMRoleGate · Rota declarada em: components/crm/CRMStandaloneApp.tsx

## Árvore de componentes
- AdminAgentPage — pages/crm/AdminAgentPage.tsx
  - CRMPageFrame — components/crm/CRMPageFrame.tsx

## Hooks
- useFeedback — components/ui/ToastProvider.tsx → —
- useToast — components/ui/ToastProvider.tsx → —
- usePageHeader — contexts/PageHeaderContext.tsx → —
- useAsyncHandler — hooks/useAsyncHandler.ts → —

## Dados alcançados
| Recurso | Operações | Onde |
|---|---|---|
| tabela admin_agent_audit_log | select | pages/crm/AdminAgentPage.tsx:75 |
| tabela admin_agent_numbers | select, insert, update, delete | pages/crm/AdminAgentPage.tsx:110, pages/crm/AdminAgentPage.tsx:135, pages/crm/AdminAgentPage.tsx:146, pages/crm/AdminAgentPage.tsx:72 |
| tabela sellers | select | pages/crm/AdminAgentPage.tsx:74 |
| tabela user_profiles | select | pages/crm/AdminAgentPage.tsx:73 |
