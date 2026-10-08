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
| realtime crm_channels | — | pages/CRMChannels.tsx:403 |
| tabela crm_ai_entry_settings | select, upsert | pages/CRMChannels.tsx:293, pages/CRMChannels.tsx:421 |
| tabela crm_channels | select, update, insert, delete | pages/CRMChannels.tsx:288, pages/CRMChannels.tsx:337, pages/CRMChannels.tsx:483, pages/CRMChannels.tsx:545, pages/CRMChannels.tsx:547, pages/CRMChannels.tsx:618 +1 |
| tabela crm_funnel_stages | select | pages/CRMChannels.tsx:317 |
| tabela crm_funnels | select | pages/CRMChannels.tsx:310 |
