# /pdv/orcamentos — pages/PDVQuotes.tsx
Layout/guardas: ProtectedLayout · ProtectedRoute · Rota declarada em: App.tsx

## Árvore de componentes
- PDVQuotes — pages/PDVQuotes.tsx
  - ConfirmDialog (ui)
  - QuoteDocumentViewer — pages/pdv/quote/QuoteDocumentViewer.tsx
    - Modal (ui)
  - QuotesListBody — pages/PDVQuotes.tsx
    - QuoteRow — pages/PDVQuotes.tsx

## Hooks
- useIsMobile — components/ui/Modal.tsx → —
- useFeedback — components/ui/ToastProvider.tsx → —
- useToast — components/ui/ToastProvider.tsx → —
- useQuotesList — pages/PDVQuotes.tsx → pdv_quotes(s)
- useData — services/dataContext.tsx → —
- useReceiptLogo — utils/receiptLogo.ts → —

## Dados alcançados
| Recurso | Operações | Onde |
|---|---|---|
| tabela pdv_quotes | select, update | services/quotesApi.ts:80, services/quotesApi.ts:86 |
