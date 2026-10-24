# /pdv/orcamentos/novo — pages/PDVQuoteNew.tsx
Layout/guardas: ProtectedLayout · ProtectedRoute · Rota declarada em: App.tsx

## Árvore de componentes
- PDVQuoteNew — pages/PDVQuoteNew.tsx
  - QuoteCustomerCard — pages/pdv/quote/QuoteCustomerCard.tsx
    - Combobox (ui)
    - MoneyInput — pages/pdv/quote/QuoteControls.tsx
  - QuoteDocumentViewer — pages/pdv/quote/QuoteDocumentViewer.tsx
    - Modal (ui)
  - QuoteItemsCard — pages/pdv/quote/QuoteItemsCard.tsx
    - Combobox (ui)
    - QuoteItemRow — pages/pdv/quote/QuoteItemsCard.tsx
      - ItemPricingRow — pages/pdv/quote/QuoteItemsCard.tsx
      - ManualItemFields — pages/pdv/quote/QuoteItemsCard.tsx
      - StockItemSummary — pages/pdv/quote/QuoteItemsCard.tsx
  - QuotePaymentCard — pages/pdv/quote/QuotePaymentCard.tsx
    - Segmented — pages/pdv/quote/QuoteControls.tsx
  - QuoteSummaryCard — pages/pdv/quote/QuoteSummaryCard.tsx
    - CompareSummary — pages/pdv/quote/QuoteSummaryCard.tsx
    - SumSummary — pages/pdv/quote/QuoteSummaryCard.tsx
      - InstallmentList — pages/pdv/quote/QuoteSummaryCard.tsx
  - QuoteValidityDialog — pages/pdv/quote/QuoteValidityDialog.tsx
    - IOSButton (ui)
    - Modal (ui)

## Hooks
- useIsMobile — components/ui/Modal.tsx → —
- useFeedback — components/ui/ToastProvider.tsx → —
- useToast — components/ui/ToastProvider.tsx → —
- useListboxPosition — components/ui/useListboxPosition.ts → —
- useAuth — contexts/AuthContext.tsx → —
- useStockOptions — pages/pdv/quote/QuoteItemsCard.tsx → —
- useQuoteDraft — pages/pdv/quote/useQuoteDraft.ts → —
- useQuoteItems — pages/pdv/quote/useQuoteDraft.ts → —
- useData — services/dataContext.tsx → —
- useReceiptLogo — utils/receiptLogo.ts → —

## Dados alcançados
| Recurso | Operações | Onde |
|---|---|---|
| tabela pdv_quotes | insert | services/quotesApi.ts:55 |
