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
      - SuspensionSection — pages/care/contract/SuspensionSection.tsx
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
| rpc care_cancel_contract | — | services/careApi.ts:118 |
| rpc care_confirm_installment_payment | — | services/careApi.ts:106 |
| rpc care_contract_dossier | — | services/careApi.ts:87 |
| rpc care_contract_inspections_json | — | services/careApi.ts:88 |
| rpc care_dashboard | — | services/careApi.ts:184 |
| rpc care_deliver_benefit | — | services/careApi.ts:114 |
| rpc care_open_service_request | — | services/careApi.ts:155 |
| rpc care_reactivate_after_inspection | — | services/careApi.ts:95 |
| rpc care_refresh_suspensions | — | services/careApi.ts:75 |
| rpc care_simulate | — | services/careApi.ts:59 |
| rpc care_update_service_request | — | services/careApi.ts:171 |
| rpc care_verify_event_chain | — | services/careApi.ts:134 |
| tabela care_benefits | select, update, insert | services/careApi.ts:222, services/careApi.ts:227, services/careApi.ts:228 |
| tabela care_condition_rules | select, update | services/careApi.ts:189, services/careApi.ts:194 |
| tabela care_contracts | select | services/careApi.ts:148, services/careApi.ts:79 |
| tabela care_model_rule_bonuses | select, delete, insert | services/careApi.ts:198, services/careApi.ts:214, services/careApi.ts:216 |
| tabela care_model_rules | select, update, insert | services/careApi.ts:198, services/careApi.ts:211, services/careApi.ts:212 |
| tabela care_service_requests | select | services/careApi.ts:148 |
| tabela care_settings | select, update | services/careApi.ts:232, services/careApi.ts:235 |
| tabela device_catalog | select | services/careApi.ts:239 |
