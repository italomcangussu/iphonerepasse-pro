# /crm/settings — pages/crm/SettingsPage.tsx
Layout/guardas: ProtectedLayout · ProtectedRoute · Rota declarada em: App.tsx

## Árvore de componentes
- SettingsPage — pages/crm/SettingsPage.tsx
  - CRMChannels — pages/CRMChannels.tsx
    - Modal (ui)
    - UazStatusBadge — pages/CRMChannels.tsx
  - CRMSimpleCrud — components/crm/CRMSimpleCrud.tsx
    - CRMPageFrame — components/crm/CRMPageFrame.tsx
    - DesktopContextMenuHost (ui)
  - Divider — pages/crm/SettingsPage.tsx
  - InfoRow — pages/crm/SettingsPage.tsx
  - LegalLink — pages/crm/SettingsPage.tsx
  - PushOptIn — components/pwa/PushOptIn.tsx
    - PermissionRequest — components/pwa/PermissionRequest.tsx
  - SectionShell — pages/crm/SettingsPage.tsx

## Hooks
- useCRMStore — components/crm/useCRMStore.ts → —
- useIsMobile — components/ui/Modal.tsx → —
- useFeedback — components/ui/ToastProvider.tsx → —
- useToast — components/ui/ToastProvider.tsx → —
- useAuth — contexts/AuthContext.tsx → —
- usePageHeader — contexts/PageHeaderContext.tsx → —
- useTheme — contexts/ThemeContext.tsx → —
- useAsyncHandler — hooks/useAsyncHandler.ts → —
- useConsents — hooks/useConsents.ts → user_consents(s,u,U)
- useDesktopContextMenu — hooks/useDesktopContextMenu.tsx → —
- useDialogA11y — hooks/useDialogA11y.ts → —
- useDisclosure — hooks/useDisclosure.ts → —
- usePushNotifications — hooks/usePushNotifications.ts → edge push-subscribe
- useData — services/dataContext.tsx → —

## Dados alcançados
| Recurso | Operações | Onde |
|---|---|---|
| edge push-subscribe | — | services/pushClient.ts:208, services/pushClient.ts:229 |
| edge user-account-delete | — | pages/crm/SettingsPage.tsx:322, pages/crm/SettingsPage.tsx:353 |
| edge user-data-export | — | pages/crm/SettingsPage.tsx:275 |
| realtime crm_channels | — | pages/CRMChannels.tsx:403 |
| tabela crm_ai_entry_settings | select, upsert | pages/CRMChannels.tsx:293, pages/CRMChannels.tsx:421 |
| tabela crm_channels | select, update, insert, delete | pages/CRMChannels.tsx:288, pages/CRMChannels.tsx:337, pages/CRMChannels.tsx:483, pages/CRMChannels.tsx:545, pages/CRMChannels.tsx:547, pages/CRMChannels.tsx:618 +1 |
| tabela crm_funnel_stages | select | pages/CRMChannels.tsx:317 |
| tabela crm_funnels | select | pages/CRMChannels.tsx:310 |
| tabela user_consents | select, upsert, update | hooks/useConsents.ts:110, hooks/useConsents.ts:30, hooks/useConsents.ts:80 |
