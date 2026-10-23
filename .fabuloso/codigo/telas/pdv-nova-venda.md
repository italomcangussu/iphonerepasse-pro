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
  - CareContractModal — components/care/CareContractModal.tsx
    - CareLogo — components/care/CareLogo.tsx
    - DevicePicker — components/care/CareContractModal.tsx
    - FlowBody — components/care/CareContractModal.tsx
      - Banner (ui)
      - IssuedPanel — components/care/CareContractModal.tsx
      - ReadyBody — components/care/CareContractModal.tsx
    - FlowFooter — components/care/CareContractModal.tsx
      - CopyLinkButton — components/care/CareContractModal.tsx
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
    - PhotoTileControls — components/StockFormModal.tsx
  - WhatsAppSendFailure — components/WhatsAppSendFailure.tsx
    - Banner (ui)

## Hooks
- useCareContractFlow — components/care/useCareContractFlow.ts → care_contracts(s) · rpc care_create_contract, care_quote_for_sale_item
- useSaleItemCareState — components/care/useCareContractFlow.ts → care_contracts(s) · rpc care_quote_for_sale_item
- useStockPhotoQueue — components/stock-form/useStockPhotoQueue.ts → —
- useIsMobile — components/ui/Modal.tsx → —
- useFeedback — components/ui/ToastProvider.tsx → —
- useToast — components/ui/ToastProvider.tsx → —
- useListboxPosition — components/ui/useListboxPosition.ts → —
- useAuth — contexts/AuthContext.tsx → —
- usePermissions — contexts/PermissionsContext.tsx → —
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
| rpc care_create_contract | — | services/careApi.ts:62 |
| rpc care_quote_for_sale_item | — | services/careApi.ts:56 |
| tabela app_user_activity_logs | insert | services/telemetry.ts:72 |
| tabela care_contracts | select | services/careApi.ts:83 |
