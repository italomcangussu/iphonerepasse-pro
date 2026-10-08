# /marketing — pages/Marketing.tsx
Layout/guardas: ProtectedLayout · ProtectedRoute · Rota declarada em: App.tsx

## Árvore de componentes
- Marketing — pages/Marketing.tsx
  - AudienceTab — components/marketing/AudienceTab.tsx
  - CampaignsTab — components/marketing/CampaignsTab.tsx
    - BroadcastModal — components/marketing/CampaignsTab.tsx
      - Modal (ui)
    - KpiCard — components/marketing/CampaignsTab.tsx
    - StableResponsiveContainer — components/charts/StableResponsiveContainer.tsx
    - TargetTable — components/marketing/CampaignsTab.tsx
  - OpportunitiesTab — components/marketing/OpportunitiesTab.tsx
    - AbcBadge — components/marketing/OpportunitiesTab.tsx
    - ClassBadge — components/marketing/OpportunitiesTab.tsx
    - GlossaryBody — components/marketing/OpportunitiesTab.tsx
    - InfoTooltip (ui)
    - KpiCard — components/marketing/OpportunitiesTab.tsx
      - DeltaBadge — components/marketing/OpportunitiesTab.tsx
      - MetricLabel — components/marketing/OpportunitiesTab.tsx
    - ModelInsightCard — components/marketing/OpportunitiesTab.tsx
      - ClassBadge — components/marketing/OpportunitiesTab.tsx
    - StableResponsiveContainer — components/charts/StableResponsiveContainer.tsx
  - ScriptsTab — components/marketing/ScriptsTab.tsx

## Hooks
- useIsMobile — components/ui/Modal.tsx → —
- useTheme — contexts/ThemeContext.tsx → —
- useChartTheme — hooks/useChartTheme.ts → —
- useSalesHistoryDemand — hooks/useDataGroupDemand.ts → —
- useData — services/dataContext.tsx → —

## Dados alcançados
| Recurso | Operações | Onde |
|---|---|---|
| tabela crm_broadcast_recipients | select | components/marketing/CampaignsTab.tsx:377 |
| tabela crm_broadcasts | select, insert | components/marketing/CampaignsTab.tsx:151, components/marketing/CampaignsTab.tsx:369 |
| tabela crm_leads | select | components/marketing/CampaignsTab.tsx:384 |
