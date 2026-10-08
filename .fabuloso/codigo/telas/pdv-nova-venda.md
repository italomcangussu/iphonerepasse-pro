# /pdv/nova-venda — pages/PDV.tsx
Layout/guardas: ProtectedLayout · ProtectedRoute · Rota declarada em: App.tsx

## Árvore de componentes
- PDV — pages/PDV.tsx
  - AddCustomerModal — components/AddCustomerModal.tsx
    - IOSButton (ui)
    - Modal (ui)
  - AddSellerModal — components/AddSellerModal.tsx
    - IOSButton (ui)
    - Modal (ui)
  - Combobox (ui)
  - Modal (ui)
  - ObservationsList — components/ObservationsList.tsx
  - SaleCelebration — components/motion/SaleCelebration.tsx
  - StockFormModal — components/StockFormModal.tsx
    - Combobox (ui)
    - Modal (ui)
    - PermissionRequest — components/pwa/PermissionRequest.tsx
  - WhatsAppSendFailure — components/WhatsAppSendFailure.tsx
    - Banner (ui)

## Hooks
- useStockPhotoQueue — components/stock-form/useStockPhotoQueue.ts → —
- useIsMobile — components/ui/Modal.tsx → —
- useFeedback — components/ui/ToastProvider.tsx → —
- useToast — components/ui/ToastProvider.tsx → —
- useListboxPosition — components/ui/useListboxPosition.ts → —
- useAuth — contexts/AuthContext.tsx → —
- useAsyncHandler — hooks/useAsyncHandler.ts → —
- useDialogA11y — hooks/useDialogA11y.ts → —
- useDisclosure — hooks/useDisclosure.ts → —
- useReceiptPrint — hooks/useReceiptPrint.ts → —
- useData — services/dataContext.tsx → —
- useReceiptLogo — utils/receiptLogo.ts → —

## Dados alcançados
| Recurso | Operações | Onde |
|---|---|---|
| edge admin-provision-user | — | services/adminProvision.ts:72 |
| edge send-receipt-whatsapp | — | utils/sendReceiptWhatsApp.ts:30, utils/sendReceiptWhatsApp.ts:37 |
| tabela app_user_activity_logs | insert | services/telemetry.ts:72 |
