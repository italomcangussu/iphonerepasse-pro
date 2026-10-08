# /payable-debts — pages/PayableDebts.tsx
Layout/guardas: ProtectedLayout · ProtectedRoute · Rota declarada em: App.tsx

## Árvore de componentes
- PayableDebts — pages/PayableDebts.tsx
  - ConfirmDialog (ui)
  - Modal (ui)

## Hooks
- useIsMobile — components/ui/Modal.tsx → —
- useFeedback — components/ui/ToastProvider.tsx → —
- useToast — components/ui/ToastProvider.tsx → —
- useAsyncHandler — hooks/useAsyncHandler.ts → —
- useFinanceDemand — hooks/useDataGroupDemand.ts → —
- useDisclosure — hooks/useDisclosure.ts → —
- useIsMobileViewport — hooks/useIsMobileViewport.ts → —
- useData — services/dataContext.tsx → —

## Dados alcançados
| Recurso | Operações | Onde |
|---|---|---|
| bucket payable-debt-receipts | upload, remove, createSignedUrl | pages/PayableDebts.tsx:273, pages/PayableDebts.tsx:300, pages/PayableDebts.tsx:312, pages/PayableDebts.tsx:322 |
| tabela app_user_activity_logs | insert | services/telemetry.ts:72 |
