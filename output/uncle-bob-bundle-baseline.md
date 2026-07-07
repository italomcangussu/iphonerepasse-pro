# Auditoria Uncle Bob — iphonerepasse-pro

> Gerado por `audit_codebase.py`. Limiares em `references/metrics-thresholds.md`. Interprete cada número com a razão de engenharia (heurísticas em `references/`), não como dogma.

## Saúde por eixo

| Eixo | Status | Resumo |
|------|:------:|--------|
| Cobertura de testes | 🟡 | linhas 61.28% / ramos 48.26% (coverage/coverage-summary.json) |
| Teste de mutação | · | **não medido** — configure Stryker (JS) ou mutmut (Py) |
| Estrutura de dependências | 🔴 | 1 ciclo(s) de dependência; 261 arquivos com imports internos |
| Complexidade ciclomática | 🔴 | 325/1437 funções acima de 5 |
| Tamanho de módulos/funções | 🔴 | 89 arquivos > 200 linhas; 252 funções > 20 linhas |
| Duplicação | 🔴 | ~5.7% de blocos repetidos (heurístico) |

_Escopo: 425 arquivos-fonte, 1437 funções analisadas._

## 🔴 Ciclos de dependência (viola ADP — prioridade ALTA)

Ciclos impedem evoluir/testar/deployar componentes isoladamente. Quebre invertendo uma seta via DIP (interface no lado estável) ou extraindo um módulo comum. Ver `references/clean-architecture.md`.

1. ciclo entre 2 módulos:
   - `components/crm/messageClusters.ts`
   - `components/crm/MessageBubble.tsx`

## 🔴 Matriz de risco — alta complexidade + baixa cobertura

Onde refatorar é mais perigoso E menos protegido. **Comece a rede de testes por aqui** antes de tocar no código (modo IMPROVE).

| Arquivo | Complex. máx. | Cobertura | Risco |
|---------|:--:|:--:|:--:|
| `components/crm/AudioRecorder.tsx` | 23 | 4.91% | 🔴 |
| `components/pwa/PushOptIn.tsx` | 42 | 11.42% | 🔴 |
| `hooks/useTranscriber.ts` | 15 | 23.33% | 🔴 |
| `pages/Settings.tsx` | 175 | 34.45% | 🔴 |
| `pages/Calculator.tsx` | 47 | 34.7% | 🔴 |
| `components/StockDetailsModal.tsx` | 97 | 39.26% | 🔴 |
| `pages/Warranties.tsx` | 115 | 42.17% | 🔴 |
| `pages/CRMChannels.tsx` | 102 | 44.24% | 🔴 |
| `components/crm/ConversationsListPanel.tsx` | 54 | 46.93% | 🔴 |
| `components/crm/AudioMessage.tsx` | 54 | 47.31% | 🔴 |
| `pages/Debtors.tsx` | 100 | 49.79% | 🔴 |
| `pages/PayableDebts.tsx` | 127 | 50.4% | 🔴 |
| `components/StockFormModal.tsx` | 220 | 50.63% | 🔴 |
| `pages/crm/ConversationsPage.tsx` | 467 | 51.52% | 🔴 |
| `services/dataContext.tsx` | 934 | 55.66% | 🔴 |
| `pages/PDVHistory.tsx` | 125 | 56.55% | 🔴 |
| `pages/Profile.tsx` | 10 | 57.37% | 🔴 |
| `components/pwa/CRMPwaControls.tsx` | 33 | 58.82% | 🔴 |
| `pages/Clients.tsx` | 43 | 62% | 🟡 |
| `components/SaleCompleteEditModal.tsx` | 126 | 63.98% | 🟡 |

## Arquivos com menor cobertura de linhas

| Arquivo | Cobertura | |
|---------|:--:|:--:|
| `hooks/useCRMUnreadCount.ts` | 0% | 🔴 |
| `services/crmHandoff.ts` | 0% | 🔴 |
| `components/crm/AudioRecorder.tsx` | 4.91% | 🔴 |
| `utils/thermalPrinter.ts` | 9.56% | 🔴 |
| `utils/escpos.ts` | 11.11% | 🔴 |
| `components/pwa/PushOptIn.tsx` | 11.42% | 🔴 |
| `services/pwa.ts` | 12.5% | 🔴 |
| `hooks/useTranscriber.ts` | 23.33% | 🔴 |
| `lib/crmRouting.ts` | 25% | 🔴 |
| `hooks/usePermissionState.ts` | 28.2% | 🔴 |
| `components/ui/Pagination.tsx` | 28.57% | 🔴 |
| `pages/Settings.tsx` | 34.45% | 🔴 |
| `pages/Calculator.tsx` | 34.7% | 🔴 |
| `lib/routePrefetch.ts` | 36.36% | 🔴 |
| `lib/crm/messageUtils.ts` | 39.13% | 🔴 |
| `components/StockDetailsModal.tsx` | 39.26% | 🔴 |
| `components/ui/Banner.tsx` | 40% | 🔴 |
| `pages/Warranties.tsx` | 42.17% | 🔴 |
| `public/sw.js` | 42.26% | 🔴 |
| `pages/CRMChannels.tsx` | 44.24% | 🔴 |

> O *que* não é coberto frequentemente revela *por que* o código falha (Código Limpo T8). Cubra primeiro o que tem mais ramos/risco.

## Funções mais complexas (complexidade > 5)

| Severidade | Função | Local | Complex. | Linhas | Args | Aninh. |
|:--:|--------|-------|:--:|:--:|:--:|:--:|
| 🔴 | `DataProvider` | `services/dataContext.tsx:114` | **934** | 3240 | 1 | 5 |
| 🔴 | `ConversationsPage` | `pages/crm/ConversationsPage.tsx:247` | **467** | 2143 | 0 | 6 |
| 🔴 | `PDV` | `pages/PDV.tsx:65` | **461** | 2880 | 0 | 7 |
| 🔴 | `Inventory` | `pages/Inventory.tsx:55` | **227** | 1495 | 0 | 7 |
| 🔴 | `StockFormModal` | `components/StockFormModal.tsx:106` | **220** | 1615 | 1 | 5 |
| 🔴 | `loadEnv` | `scripts/n8n/run-repasse-scenario-audit.mjs:83` | **198** | 881 | 0 | 0 |
| 🔴 | `Finance` | `pages/Finance.tsx:164` | **185** | 1605 | 0 | 6 |
| 🔴 | `Settings` | `pages/Settings.tsx:236` | **175** | 1758 | 0 | 9 |
| 🔴 | `handler` | `supabase/functions/crm-uaz-webhook-receiver/index.ts:318` | **145** | 705 | 1 | 4 |
| 🔴 | `PayableDebts` | `pages/PayableDebts.tsx:31` | **127** | 924 | 0 | 5 |
| 🔴 | `SaleCompleteEditModal` | `components/SaleCompleteEditModal.tsx:115` | **126** | 966 | 1 | 5 |
| 🔴 | `SaleEditModal` | `pages/PDVHistory.tsx:1443` | **125** | 913 | 1 | 4 |
| 🔴 | `PDVHistory` | `pages/PDVHistory.tsx:212` | **115** | 992 | 0 | 5 |
| 🔴 | `Warranties` | `pages/Warranties.tsx:107` | **115** | 1150 | 0 | 5 |
| 🔴 | `MessageBubbleInner` | `components/crm/MessageBubble.tsx:507` | **113** | 364 | 1 | 4 |
| 🔴 | `readEnvFile` | `scripts/n8n/guard-live-workflow-sync.mjs:52` | **113** | 391 | 1 | 1 |
| 🔴 | `CRMLeads` | `pages/CRMLeads.tsx:77` | **104** | 515 | 1 | 5 |
| 🔴 | `CRMChannels` | `pages/CRMChannels.tsx:211` | **102** | 757 | 0 | 4 |
| 🔴 | `Debtors` | `pages/Debtors.tsx:23` | **100** | 1059 | 0 | 7 |
| 🔴 | `StockDetailsModal` | `components/StockDetailsModal.tsx:70` | **97** | 628 | 1 | 6 |

> Complexidade > 10 ⇒ nº de caminhos a testar explode. Extraia funções, use guard clauses (G18/G28) ou polimorfismo (G23/OCP).

## Funções mais longas (> 20 linhas)

| Severidade | Função | Local | Linhas | Complex. | Args |
|:--:|--------|-------|:--:|:--:|:--:|
| 🔴 | `DataProvider` | `services/dataContext.tsx:114` | **3240** | 934 | 1 |
| 🔴 | `PDV` | `pages/PDV.tsx:65` | **2880** | 461 | 0 |
| 🔴 | `ConversationsPage` | `pages/crm/ConversationsPage.tsx:247` | **2143** | 467 | 0 |
| 🔴 | `Settings` | `pages/Settings.tsx:236` | **1758** | 175 | 0 |
| 🔴 | `StockFormModal` | `components/StockFormModal.tsx:106` | **1615** | 220 | 1 |
| 🔴 | `Finance` | `pages/Finance.tsx:164` | **1605** | 185 | 0 |
| 🔴 | `Inventory` | `pages/Inventory.tsx:55` | **1495** | 227 | 0 |
| 🔴 | `SimulatorPage` | `pages/crm/SimulatorPage.tsx:121` | **1302** | 81 | 0 |
| 🔴 | `Warranties` | `pages/Warranties.tsx:107` | **1150** | 115 | 0 |
| 🔴 | `Debtors` | `pages/Debtors.tsx:23` | **1059** | 100 | 0 |
| 🔴 | `PDVHistory` | `pages/PDVHistory.tsx:212` | **992** | 115 | 0 |
| 🔴 | `SaleCompleteEditModal` | `components/SaleCompleteEditModal.tsx:115` | **966** | 126 | 1 |
| 🔴 | `PayableDebts` | `pages/PayableDebts.tsx:31` | **924** | 127 | 0 |
| 🔴 | `SaleEditModal` | `pages/PDVHistory.tsx:1443` | **913** | 125 | 1 |
| 🔴 | `loadEnv` | `scripts/n8n/run-repasse-scenario-audit.mjs:83` | **881** | 198 | 0 |
| 🔴 | `CRMChannels` | `pages/CRMChannels.tsx:211` | **757** | 102 | 0 |
| 🔴 | `handler` | `supabase/functions/crm-uaz-webhook-receiver/index.ts:318` | **705** | 145 | 1 |
| 🔴 | `StockDetailsModal` | `components/StockDetailsModal.tsx:70` | **628** | 97 | 1 |
| 🔴 | `SettingsPage` | `pages/crm/SettingsPage.tsx:212` | **584** | 61 | 0 |
| 🔴 | `Calculator` | `pages/Calculator.tsx:56` | **539** | 47 | 0 |

> Função faz UMA coisa, em UM nível de abstração (Código Limpo cap. 3).

## Funções com excesso de argumentos (> 3)

- 🔴 `createUserOrError` (`supabase/functions/admin-provision-user/index.ts:56`) — **7 args**. Considere objeto-parâmetro ou quebrar a função (F1).
- 🔴 `applyReplacement` (`scripts/n8n/patch-parse-memory-tradein-state.mjs:94`) — **5 args**. Considere objeto-parâmetro ou quebrar a função (F1).
- 🔴 `replaceOnce` (`scripts/n8n/tool/patch-kit.mjs:51`) — **5 args**. Considere objeto-parâmetro ou quebrar a função (F1).
- 🔴 `buildVapidHeaders` (`supabase/functions/push-send/index.ts:220`) — **5 args**. Considere objeto-parâmetro ou quebrar a função (F1).
- 🔴 `deliverWithRetry` (`supabase/functions/push-send/index.ts:652`) — **5 args**. Considere objeto-parâmetro ou quebrar a função (F1).
- 🔴 `request` (`supabase/functions/push-send/push-send.deno.ts:27`) — **5 args**. Considere objeto-parâmetro ou quebrar a função (F1).
- 🔴 `computeBroadcastStats` (`lib/marketing/broadcastStats.ts:96`) — **4 args**. Considere objeto-parâmetro ou quebrar a função (F1).
- 🔴 `computeCampaignPlan` (`lib/marketing/campaigns.ts:154`) — **4 args**. Considere objeto-parâmetro ou quebrar a função (F1).
- 🔴 `pick` (`screenshots/capture.mjs:15`) — **4 args**. Considere objeto-parâmetro ou quebrar a função (F1).
- 🔴 `replaceStrict` (`scripts/n8n/build-repasse-next-workflow.mjs:42`) — **4 args**. Considere objeto-parâmetro ou quebrar a função (F1).
- 🔴 `n8nFetch` (`scripts/n8n/build-repasse-next-workflow.mjs:643`) — **4 args**. Considere objeto-parâmetro ou quebrar a função (F1).
- 🔴 `api` (`scripts/n8n/patch-apagar-memoria-wire.mjs:59`) — **4 args**. Considere objeto-parâmetro ou quebrar a função (F1).
- 🔴 `appendAfterAnchor` (`scripts/n8n/patch-memory-model-normalization.mjs:52`) — **4 args**. Considere objeto-parâmetro ou quebrar a função (F1).
- 🔴 `sub` (`scripts/n8n/patch-repasse-quality-phase2.mjs:24`) — **4 args**. Considere objeto-parâmetro ou quebrar a função (F1).
- 🔴 `replaceOnce` (`scripts/n8n/patch-repasse-quality-phase2.mjs:29`) — **4 args**. Considere objeto-parâmetro ou quebrar a função (F1).
- 🔴 `replaceOnce` (`scripts/n8n/patch-tradein-asked-gate.mjs:31`) — **4 args**. Considere objeto-parâmetro ou quebrar a função (F1).
- 🔴 `patchCodeNode` (`scripts/n8n/patch-tradein-asked-gate.mjs:42`) — **4 args**. Considere objeto-parâmetro ou quebrar a função (F1).
- 🔴 `createSandbox` (`scripts/n8n/test-repasse-quality-gate.mjs:289`) — **4 args**. Considere objeto-parâmetro ou quebrar a função (F1).
- 🔴 `collectNested` (`supabase/functions/_shared/crm_ad_context.ts:75`) — **4 args**. Considere objeto-parâmetro ou quebrar a função (F1).
- 🔴 `logAvatarEvent` (`supabase/functions/_shared/uazLeadAvatar.ts:238`) — **4 args**. Considere objeto-parâmetro ou quebrar a função (F1).

## Arquivos mais longos (> 200 linhas)

| Severidade | Arquivo | Linhas de código | I (instab.) |
|:--:|---------|:--:|:--:|
| 🔴 | `services/dataContext.tsx` | **3002** | 0.30 |
| 🔴 | `pages/PDV.tsx` | **2790** | 0.83 |
| 🔴 | `pages/PDVHistory.tsx` | **2557** | 0.92 |
| 🔴 | `pages/crm/ConversationsPage.tsx` | **2113** | 0.88 |
| 🔴 | `pages/Settings.tsx` | **1848** | 0.91 |
| 🔴 | `pages/Finance.tsx` | **1650** | 0.88 |
| 🔴 | `components/StockFormModal.tsx` | **1547** | 0.84 |
| 🔴 | `pages/Inventory.tsx` | **1459** | 0.93 |
| 🔴 | `supabase/functions/_shared/uazapi.ts` | **1415** | 0.00 |
| 🔴 | `pages/crm/SimulatorPage.tsx` | **1339** | 0.80 |
| 🔴 | `pages/Warranties.tsx` | **1155** | 0.89 |
| 🔴 | `pages/Debtors.tsx` | **1035** | 0.88 |
| 🔴 | `components/SaleCompleteEditModal.tsx` | **986** | 0.80 |
| 🔴 | `supabase/functions/crm-uaz-webhook-receiver/index.ts` | **937** | · |
| 🔴 | `pages/PayableDebts.tsx` | **904** | 0.88 |
| 🔴 | `pages/CRMChannels.tsx` | **899** | 0.73 |
| 🔴 | `scripts/n8n/run-repasse-scenario-audit.mjs` | **892** | · |
| 🔴 | `components/crm/MessageBubble.tsx` | **820** | 0.62 |
| 🔴 | `pages/crm/SettingsPage.tsx` | **729** | 0.83 |
| 🔴 | `supabase/functions/_shared/crm_ai_payload.ts` | **691** | · |

## Módulos muito dependidos (cuidado ao mudar)

| Arquivo | Ca (fan-in) | Ce (fan-out) | I |
|---------|:--:|:--:|:--:|
| `types.ts` | **92** | 0 | 0.00 |
| `services/supabase.ts` | **37** | 0 | 0.00 |
| `components/ui/ToastProvider.tsx` | **34** | 4 | 0.11 |
| `services/dataContext.tsx` | **33** | 14 | 0.30 |
| `components/ui/Modal.tsx` | **25** | 1 | 0.04 |
| `hooks/useAsyncHandler.ts` | **19** | 1 | 0.05 |
| `utils/inputMasks.ts` | **19** | 0 | 0.00 |
| `contexts/AuthContext.tsx` | **17** | 3 | 0.15 |
| `hooks/useDisclosure.ts` | **17** | 0 | 0.00 |
| `components/motion/transitions.ts` | **15** | 0 | 0.00 |

> Ca alto + I baixo = muitos dependem dele e ele é concreto. Mudanças se propagam; proteja com testes fortes e considere extrair uma abstração estável (DIP). Ver Zona da Dor em `clean-architecture.md`.

---
_Próximo passo sugerido: começar pelos 🔴 (ciclos e lacunas de teste), criar rede de caracterização onde falta cobertura e refatorar em passos pequenos mantendo a suíte verde. Ver modo IMPROVE no SKILL.md._