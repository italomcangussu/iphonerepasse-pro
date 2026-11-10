# /settings/companies — pages/Companies.tsx
Layout/guardas: ProtectedLayout · ProtectedRoute · Rota declarada em: App.tsx

## Árvore de componentes
- Companies — pages/Companies.tsx
  - Banner (ui)
  - CompanyMembersModal — components/companies/CompanyMembersModal.tsx
    - AddMemberForm — components/companies/AddMemberForm.tsx
      - IOSButton (ui)
    - ConfirmDialog (ui)
    - MembersList — components/companies/CompanyMembersModal.tsx
      - MemberRow — components/companies/MemberRow.tsx
    - Modal (ui)
  - CompanyNameModal — components/companies/CompanyNameModal.tsx
    - IOSButton (ui)
    - Modal (ui)
  - CompanyRow — components/companies/CompanyRow.tsx
  - IOSButton (ui)
  - TransferSection — components/companies/TransferSection.tsx
    - Banner (ui)
    - TransferBody — components/companies/TransferSection.tsx
      - StockTransferPanel — components/companies/StockTransferPanel.tsx
      - StoreTransferPanel — components/companies/StoreTransferPanel.tsx

## Hooks
- useMembers — components/companies/CompanyMembersModal.tsx → —
- useTransferableStock — components/companies/useTransferableStock.ts → —
- useIsMobile — components/ui/Modal.tsx → —
- useFeedback — components/ui/ToastProvider.tsx → —
- useToast — components/ui/ToastProvider.tsx → —
- useAuth — contexts/AuthContext.tsx → —
- useAsyncHandler — hooks/useAsyncHandler.ts → —
- useTransferCatalog — pages/Companies.tsx → —

## Dados alcançados
_nenhum_
