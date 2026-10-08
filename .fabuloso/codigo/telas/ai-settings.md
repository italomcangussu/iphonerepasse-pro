# /ai-settings — pages/crm/AISettingsPage.tsx
Layout/guardas: ProtectedRoute · CRMStandaloneLayout · CRMRoleGate · Rota declarada em: components/crm/CRMStandaloneApp.tsx

## Árvore de componentes
- AISettingsPage — pages/crm/AISettingsPage.tsx
  - CRMPageFrame — components/crm/CRMPageFrame.tsx
  - IOSSwitch — pages/crm/AISettingsPage.tsx

## Hooks
- useCRMStore — components/crm/useCRMStore.ts → —
- useFeedback — components/ui/ToastProvider.tsx → —
- useToast — components/ui/ToastProvider.tsx → —
- usePageHeader — contexts/PageHeaderContext.tsx → —

## Dados alcançados
| Recurso | Operações | Onde |
|---|---|---|
| tabela crm_ai_agent_configs | select, update, insert, delete | pages/crm/AISettingsPage.tsx:129, pages/crm/AISettingsPage.tsx:200, pages/crm/AISettingsPage.tsx:202, pages/crm/AISettingsPage.tsx:223 |
| tabela crm_ai_agent_invocations | select | pages/crm/AISettingsPage.tsx:140 |
| tabela crm_channels | select | pages/crm/AISettingsPage.tsx:134 |
