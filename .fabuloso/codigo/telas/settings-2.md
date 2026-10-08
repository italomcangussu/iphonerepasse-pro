# /settings — pages/Settings.tsx
Layout/guardas: ProtectedLayout · ProtectedRoute · Rota declarada em: App.tsx

## Árvore de componentes
- Settings — pages/Settings.tsx
  - Modal (ui)
  - PushOptIn — components/pwa/PushOptIn.tsx
    - PermissionRequest — components/pwa/PermissionRequest.tsx

## Hooks
- useIsMobile — components/ui/Modal.tsx → —
- useFeedback — components/ui/ToastProvider.tsx → —
- useToast — components/ui/ToastProvider.tsx → —
- useAuth — contexts/AuthContext.tsx → —
- usePermissions — contexts/PermissionsContext.tsx → —
- useTheme — contexts/ThemeContext.tsx → —
- useAsyncHandler — hooks/useAsyncHandler.ts → —
- useConsents — hooks/useConsents.ts → user_consents(s,u,U)
- useFinanceDemand — hooks/useDataGroupDemand.ts → —
- useDialogA11y — hooks/useDialogA11y.ts → —
- useDisclosure — hooks/useDisclosure.ts → —
- usePushNotifications — hooks/usePushNotifications.ts → edge push-subscribe
- useData — services/dataContext.tsx → —

## Dados alcançados
| Recurso | Operações | Onde |
|---|---|---|
| edge admin-manage-user | — | services/adminManageUser.ts:82 |
| edge admin-provision-user | — | services/adminProvision.ts:72 |
| edge push-subscribe | — | services/pushClient.ts:208, services/pushClient.ts:229 |
| edge user-account-delete | — | pages/Settings.tsx:715, pages/Settings.tsx:744 |
| edge user-data-export | — | pages/Settings.tsx:678 |
| tabela app_user_activity_logs | select | pages/Settings.tsx:570 |
| tabela user_access_roles | select | pages/Settings.tsx:365 |
| tabela user_consents | select, upsert, update | hooks/useConsents.ts:110, hooks/useConsents.ts:30, hooks/useConsents.ts:80 |
