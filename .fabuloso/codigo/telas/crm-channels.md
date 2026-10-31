# /crm/channels — pages/CRMChannels.tsx
Layout/guardas: ProtectedLayout · ProtectedRoute · Rota declarada em: App.tsx

## Árvore de componentes
- CRMChannels — pages/CRMChannels.tsx
  - Modal (ui)
  - UazStatusBadge — pages/CRMChannels.tsx

## Hooks
- useCRMStore — components/crm/useCRMStore.ts → —
- useIsMobile — components/ui/Modal.tsx → —
- useFeedback — components/ui/ToastProvider.tsx → —
- useToast — components/ui/ToastProvider.tsx → —
- useAsyncHandler — hooks/useAsyncHandler.ts → —
- useDisclosure — hooks/useDisclosure.ts → —

## Dados alcançados
| Recurso | Operações | Onde |
|---|---|---|
| realtime crm_channels | — | pages/CRMChannels.tsx:404 |
| tabela crm_ai_entry_settings | select, upsert | pages/CRMChannels.tsx:294, pages/CRMChannels.tsx:422 |
| tabela crm_channels | select, update, insert, delete | pages/CRMChannels.tsx:289, pages/CRMChannels.tsx:338, pages/CRMChannels.tsx:484, pages/CRMChannels.tsx:546, pages/CRMChannels.tsx:548, pages/CRMChannels.tsx:619 +1 |
| tabela crm_funnel_stages | select | pages/CRMChannels.tsx:318 |
| tabela crm_funnels | select | pages/CRMChannels.tsx:311 |
