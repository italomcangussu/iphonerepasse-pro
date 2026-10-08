# /in-use — pages/InUse.tsx
Layout/guardas: ProtectedLayout · ProtectedRoute · Rota declarada em: App.tsx

## Árvore de componentes
- InUse — pages/InUse.tsx
  - IOSButton (ui)
  - Modal (ui)
  - StockDetailsModal — components/StockDetailsModal.tsx
    - IOSButton (ui)
    - Modal (ui)
    - Stagger — components/motion/Stagger.tsx
    - StockSimulatorModal — components/StockSimulatorModal.tsx
      - CurrencyField — components/StockSimulatorModal.tsx
      - IOSButton (ui)
      - Modal (ui)
      - SegmentedControl — components/StockSimulatorModal.tsx

## Hooks
- useIsMobile — components/ui/Modal.tsx → —
- useFeedback — components/ui/ToastProvider.tsx → —
- useToast — components/ui/ToastProvider.tsx → —
- useAsyncHandler — hooks/useAsyncHandler.ts → —
- useDisclosure — hooks/useDisclosure.ts → —
- useTradeInDrafts — hooks/useTradeInDrafts.ts → —
- useData — services/dataContext.tsx → —

## Dados alcançados
| Recurso | Operações | Onde |
|---|---|---|
| tabela app_user_activity_logs | insert | services/telemetry.ts:72 |
