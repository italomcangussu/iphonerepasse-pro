# /pdv — App.tsx
Layout/guardas: ProtectedLayout · ProtectedRoute · Rota declarada em: App.tsx

## Árvore de componentes
- PDVHistory — App.tsx

## Hooks
- useCareContractFlow — components/care/useCareContractFlow.ts → care_contracts(s) · rpc care_create_contract, care_quote_for_sale_item
- useSaleItemCareState — components/care/useCareContractFlow.ts → care_contracts(s) · rpc care_quote_for_sale_item
- useIsMobile — components/ui/Modal.tsx → —
- useFeedback — components/ui/ToastProvider.tsx → —
- useToast — components/ui/ToastProvider.tsx → —
- useAuth — contexts/AuthContext.tsx → —
- usePermissions — contexts/PermissionsContext.tsx → —
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
| rpc care_create_contract | — | services/careApi.ts:62 |
| rpc care_quote_for_sale_item | — | services/careApi.ts:56 |
| tabela app_user_activity_logs | insert | services/telemetry.ts:72 |
| tabela care_contracts | select | services/careApi.ts:83 |
