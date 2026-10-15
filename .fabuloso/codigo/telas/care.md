# /care — pages/care/RepasseCare.tsx
Layout/guardas: ProtectedLayout · ProtectedRoute · Rota declarada em: App.tsx

## Árvore de componentes
- RepasseCare — pages/care/RepasseCare.tsx
  - CareContractsTab — pages/care/tabs/CareContractsTab.tsx
    - CareEmpty — pages/care/CareStates.tsx
    - CareLoadError — pages/care/CareStates.tsx
      - Banner (ui)
    - CareLoading — pages/care/CareStates.tsx
    - ContractRow — pages/care/tabs/CareContractsTab.tsx
      - CareStatusBadge — components/care/CareStatusBadge.tsx
  - CareDashboardTab — pages/care/tabs/CareDashboardTab.tsx
    - ByModel — pages/care/tabs/CareDashboardTab.tsx
    - CareLoadError — pages/care/CareStates.tsx
      - Banner (ui)
    - CareLoading — pages/care/CareStates.tsx
    - KpiGrid — pages/care/tabs/CareDashboardTab.tsx
      - Kpi — pages/care/tabs/CareDashboardTab.tsx
    - Portfolio — pages/care/tabs/CareDashboardTab.tsx
  - CareLoading — pages/care/CareStates.tsx
  - CareLogo — components/care/CareLogo.tsx
  - CareRulesTab — pages/care/tabs/CareRulesTab.tsx
    - BenefitCatalogSection — pages/care/rules/BenefitCatalogSection.tsx
      - BenefitEditor — pages/care/rules/BenefitCatalogSection.tsx
      - IOSButton (ui)
    - CareLoadError — pages/care/CareStates.tsx
      - Banner (ui)
    - CareLoading — pages/care/CareStates.tsx
    - CareSettingsSection — pages/care/rules/CareSettingsSection.tsx
      - DecimalField — pages/care/CareFields.tsx
      - IOSButton (ui)
      - TextField — pages/care/CareFields.tsx
    - ConditionRulesSection — pages/care/rules/ConditionRulesSection.tsx
      - ConditionCard — pages/care/rules/ConditionRulesSection.tsx
    - ModelRuleModal — pages/care/rules/ModelRuleModal.tsx
      - BillingPart — pages/care/rules/ModelRuleModal.tsx
      - BonusPart — pages/care/rules/ModelRuleModal.tsx
      - ContractTextPart — pages/care/rules/ModelRuleModal.tsx
      - DevicePart — pages/care/rules/ModelRuleModal.tsx
      - IOSButton (ui)
      - Modal (ui)
      - RatesPart — pages/care/rules/ModelRuleModal.tsx
    - ModelRulesSection — pages/care/rules/ModelRulesSection.tsx
      - CareEmpty — pages/care/CareStates.tsx
      - IOSButton (ui)
      - RuleRow — pages/care/rules/ModelRulesSection.tsx
  - CareServiceRequestsTab — pages/care/tabs/CareServiceRequestsTab.tsx
    - CareEmpty — pages/care/CareStates.tsx
    - CareLoadError — pages/care/CareStates.tsx
      - Banner (ui)
    - CareLoading — pages/care/CareStates.tsx
    - CareStatusBadge — components/care/CareStatusBadge.tsx
    - RequestActions — pages/care/tabs/CareServiceRequestsTab.tsx
      - IOSButton (ui)
  - CareSimulatorTab — pages/care/tabs/CareSimulatorTab.tsx
    - Banner (ui)
    - CarePendencies — components/care/CareQuoteSummary.tsx
    - CareQuoteSummary — components/care/CareQuoteSummary.tsx
      - Row — components/care/CareQuoteSummary.tsx
    - DecimalField — pages/care/CareFields.tsx
      - Affix — pages/care/CareFields.tsx
      - HelpText — pages/care/CareFields.tsx
    - IOSButton (ui)
  - ContractDetailModal — pages/care/contract/ContractDetailModal.tsx
    - CareLoadError — pages/care/CareStates.tsx
      - Banner (ui)
    - CareLoading — pages/care/CareStates.tsx
    - DossierBody — pages/care/contract/ContractDetailModal.tsx
      - AuditTrailSection — pages/care/contract/AuditTrailSection.tsx
      - BenefitsSection — pages/care/contract/BenefitsSection.tsx
      - CancelContract — pages/care/contract/ContractDetailModal.tsx
      - CareStatusBadge — components/care/CareStatusBadge.tsx
      - ContractServiceSection — pages/care/contract/ContractServiceSection.tsx
      - InstallmentsSection — pages/care/contract/InstallmentsSection.tsx
      - SignatureSection — pages/care/contract/SignatureSection.tsx
      - SummarySection — pages/care/contract/SummarySection.tsx
    - Modal (ui)

## Hooks
- useIsMobile — components/ui/Modal.tsx → —
- useFeedback — components/ui/ToastProvider.tsx → —
- useToast — components/ui/ToastProvider.tsx → —
- useAuth — contexts/AuthContext.tsx → —
- useSignatureActions — pages/care/contract/SignatureSection.tsx → rpc care_verify_event_chain
- useCareQuery — pages/care/useCareQuery.ts → —

## Dados alcançados
| Recurso | Operações | Onde |
|---|---|---|
| rpc care_cancel_contract | — | services/careApi.ts:102 |
| rpc care_confirm_installment_payment | — | services/careApi.ts:90 |
| rpc care_contract_dossier | — | services/careApi.ts:80 |
| rpc care_dashboard | — | services/careApi.ts:168 |
| rpc care_deliver_benefit | — | services/careApi.ts:98 |
| rpc care_open_service_request | — | services/careApi.ts:139 |
| rpc care_simulate | — | services/careApi.ts:59 |
| rpc care_update_service_request | — | services/careApi.ts:155 |
| rpc care_verify_event_chain | — | services/careApi.ts:118 |
| tabela care_benefits | select, update, insert | services/careApi.ts:206, services/careApi.ts:211, services/careApi.ts:212 |
| tabela care_condition_rules | select, update | services/careApi.ts:173, services/careApi.ts:178 |
| tabela care_contracts | select | services/careApi.ts:132, services/careApi.ts:74 |
| tabela care_model_rule_bonuses | select, delete, insert | services/careApi.ts:182, services/careApi.ts:198, services/careApi.ts:200 |
| tabela care_model_rules | select, update, insert | services/careApi.ts:182, services/careApi.ts:195, services/careApi.ts:196 |
| tabela care_service_requests | select | services/careApi.ts:132 |
| tabela care_settings | select, update | services/careApi.ts:216, services/careApi.ts:219 |
| tabela device_catalog | select | services/careApi.ts:223 |
