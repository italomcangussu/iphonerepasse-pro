# /pdv — App.tsx
Layout/guardas: ProtectedLayout · ProtectedRoute · Rota declarada em: App.tsx

## Árvore de componentes
- PDVHistory — App.tsx

## Hooks
- useIsMobile — components/ui/Modal.tsx → —
- useFeedback — components/ui/ToastProvider.tsx → —
- useToast — components/ui/ToastProvider.tsx → —
- useAuth — contexts/AuthContext.tsx → —
- useAsyncHandler — hooks/useAsyncHandler.ts → —
- useSalesHistoryDemand — hooks/useDataGroupDemand.ts → —
- useDesktopContextMenu — hooks/useDesktopContextMenu.tsx → —
- useDisclosure — hooks/useDisclosure.ts → —
- useIsMobileViewport — hooks/useIsMobileViewport.ts → —
- usePaginatedRows — hooks/usePaginatedRows.ts → —
- useReceiptPrint — hooks/useReceiptPrint.ts → —
- useData — services/dataContext.tsx → —
- useReceiptLogo — utils/receiptLogo.ts → —
- useThermalPrinter — utils/thermalPrinter.ts → —

## Dados alcançados
| Recurso | Operações | Onde |
|---|---|---|
| edge send-receipt-whatsapp | — | utils/sendReceiptWhatsApp.ts:30, utils/sendReceiptWhatsApp.ts:37 |
| tabela app_user_activity_logs | insert | services/telemetry.ts:72 |
