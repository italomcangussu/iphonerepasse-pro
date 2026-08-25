# Auditoria Uncle Bob — iphonerepasse-pro

> Gerado por `audit_codebase.py`. Limiares em `references/metrics-thresholds.md`. Interprete cada número com a razão de engenharia (heurísticas em `references/`), não como dogma.

## Saúde por eixo

| Eixo | Status | Resumo |
|------|:------:|--------|
| Cobertura de testes | 🟡 | linhas 61.28% / ramos 48.26% (coverage/coverage-summary.json) |
| Teste de mutação | · | **não medido** — configure Stryker (JS) ou mutmut (Py) |
| Estrutura de dependências | 🔴 | 1 ciclo(s) de dependência; 294 arquivos com imports internos |
| Complexidade ciclomática | 🔴 | 362/1628 funções acima de 5 |
| Tamanho de módulos/funções | 🔴 | 99 arquivos > 200 linhas; 287 funções > 20 linhas |
| Duplicação | 🔴 | ~5.2% de blocos repetidos (heurístico) |

_Escopo: 455 arquivos-fonte, 1628 funções analisadas._

## 🔴 Ciclos de dependência (viola ADP — prioridade ALTA)

Ciclos impedem evoluir/testar/deployar componentes isoladamente. Quebre invertendo uma seta via DIP (interface no lado estável) ou extraindo um módulo comum. Ver `references/clean-architecture.md`.

1. ciclo entre 2 módulos:
   - `components/crm/messageClusters.ts`
   - `components/crm/MessageBubble.tsx`

## 🔴 Matriz de risco — alta complexidade + baixa cobertura

Onde refatorar é mais perigoso E menos protegido. **Comece a rede de testes por aqui** antes de tocar no código (modo IMPROVE).

| Arquivo | Complex. máx. | Cobertura | Risco |
|---------|:--:|:--:|:--:|
| `components/crm/AudioRecorder.tsx` | 24 | 4.91% | 🔴 |
| `components/pwa/PushOptIn.tsx` | 42 | 11.42% | 🔴 |
| `hooks/useTranscriber.ts` | 15 | 23.33% | 🔴 |
| `pages/Settings.tsx` | 175 | 34.45% | 🔴 |
| `pages/Calculator.tsx` | 47 | 34.7% | 🔴 |
| `components/StockDetailsModal.tsx` | 102 | 39.26% | 🔴 |
| `pages/Warranties.tsx` | 116 | 42.17% | 🔴 |
| `pages/CRMChannels.tsx` | 148 | 44.24% | 🔴 |
| `components/crm/ConversationsListPanel.tsx` | 54 | 46.93% | 🔴 |
| `components/crm/AudioMessage.tsx` | 56 | 47.31% | 🔴 |
| `pages/Debtors.tsx` | 100 | 49.79% | 🔴 |
| `pages/PayableDebts.tsx` | 127 | 50.4% | 🔴 |
| `components/StockFormModal.tsx` | 241 | 50.63% | 🔴 |
| `pages/crm/ConversationsPage.tsx` | 472 | 51.52% | 🔴 |
| `services/dataContext.tsx` | 964 | 55.66% | 🔴 |

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

> O *que* não é coberto frequentemente revela *por que* o código falha (Código Limpo T8). Cubra primeiro o que tem mais ramos/risco.

## Funções mais complexas (complexidade > 5)

| Severidade | Função | Local | Complex. | Linhas | Args | Aninh. |
|:--:|--------|-------|:--:|:--:|:--:|:--:|
| 🔴 | `DataProvider` | `services/dataContext.tsx:124` | **964** | 3327 | 1 | 5 |
| 🔴 | `PDV` | `pages/PDV.tsx:74` | **483** | 3001 | 0 | 7 |
| 🔴 | `ConversationsPage` | `pages/crm/ConversationsPage.tsx:257` | **472** | 2158 | 0 | 6 |
| 🔴 | `Inventory` | `pages/Inventory.tsx:52` | **253** | 1558 | 0 | 7 |
| 🔴 | `StockFormModal` | `components/StockFormModal.tsx:110` | **241** | 1699 | 1 | 5 |
| 🔴 | `Finance` | `pages/Finance.tsx:172` | **202** | 1744 | 0 | 6 |
| 🔴 | `loadEnv` | `scripts/n8n/run-repasse-scenario-audit.mjs:83` | **198** | 881 | 0 | 0 |
| 🔴 | `Settings` | `pages/Settings.tsx:236` | **175** | 1767 | 0 | 9 |
| 🔴 | `CRMChannels` | `pages/CRMChannels.tsx:247` | **148** | 988 | 0 | 4 |
| 🔴 | `handler` | `supabase/functions/crm-uaz-webhook-receiver/index.ts:458` | **146** | 780 | 1 | 4 |
| 🔴 | `SaleCompleteEditModal` | `components/SaleCompleteEditModal.tsx:115` | **127** | 990 | 1 | 5 |
| 🔴 | `CRMLeads` | `pages/CRMLeads.tsx:126` | **127** | 606 | 1 | 6 |
| 🔴 | `PayableDebts` | `pages/PayableDebts.tsx:31` | **127** | 924 | 0 | 5 |
| 🔴 | `SaleEditModal` | `pages/PDVHistory.tsx:1388` | **126** | 937 | 1 | 4 |
| 🔴 | `MessageBubbleInner` | `components/crm/MessageBubble.tsx:530` | **119** | 370 | 1 | 4 |

> Complexidade > 10 ⇒ nº de caminhos a testar explode. Extraia funções, use guard clauses (G18/G28) ou polimorfismo (G23/OCP).

## Funções mais longas (> 20 linhas)

| Severidade | Função | Local | Linhas | Complex. | Args |
|:--:|--------|-------|:--:|:--:|:--:|
| 🔴 | `DataProvider` | `services/dataContext.tsx:124` | **3327** | 964 | 1 |
| 🔴 | `PDV` | `pages/PDV.tsx:74` | **3001** | 483 | 0 |
| 🔴 | `ConversationsPage` | `pages/crm/ConversationsPage.tsx:257` | **2158** | 472 | 0 |
| 🔴 | `Settings` | `pages/Settings.tsx:236` | **1767** | 175 | 0 |
| 🔴 | `Finance` | `pages/Finance.tsx:172` | **1744** | 202 | 0 |
| 🔴 | `StockFormModal` | `components/StockFormModal.tsx:110` | **1699** | 241 | 1 |
| 🔴 | `Inventory` | `pages/Inventory.tsx:52` | **1558** | 253 | 0 |
| 🔴 | `SimulatorPage` | `pages/crm/SimulatorPage.tsx:121` | **1302** | 81 | 0 |
| 🔴 | `Warranties` | `pages/Warranties.tsx:109` | **1188** | 116 | 0 |
| 🔴 | `Debtors` | `pages/Debtors.tsx:23` | **1082** | 100 | 0 |
| 🔴 | `SaleCompleteEditModal` | `components/SaleCompleteEditModal.tsx:115` | **990** | 127 | 1 |
| 🔴 | `CRMChannels` | `pages/CRMChannels.tsx:247` | **988** | 148 | 0 |
| 🔴 | `PDVHistory` | `pages/PDVHistory.tsx:168` | **983** | 112 | 0 |
| 🔴 | `SaleEditModal` | `pages/PDVHistory.tsx:1388` | **937** | 126 | 1 |
| 🔴 | `PayableDebts` | `pages/PayableDebts.tsx:31` | **924** | 127 | 0 |

> Função faz UMA coisa, em UM nível de abstração (Código Limpo cap. 3).

## Funções com excesso de argumentos (> 3)

- 🔴 `createUserOrError` (`supabase/functions/admin-provision-user/index.ts:56`) — **7 args**. Considere objeto-parâmetro ou quebrar a função (F1).
- 🔴 `drawMark` (`utils/receiptPdf.ts:464`) — **6 args**. Considere objeto-parâmetro ou quebrar a função (F1).
- 🔴 `applyReplacement` (`scripts/n8n/patch-parse-memory-tradein-state.mjs:94`) — **5 args**. Considere objeto-parâmetro ou quebrar a função (F1).
- 🔴 `replaceOnce` (`scripts/n8n/tool/patch-kit.mjs:51`) — **5 args**. Considere objeto-parâmetro ou quebrar a função (F1).
- 🔴 `upload` (`supabase/functions/_shared/admin_agent/operations.ts:12`) — **5 args**. Considere objeto-parâmetro ou quebrar a função (F1).
- 🔴 `runTool` (`supabase/functions/_shared/admin_agent/tools.ts:682`) — **5 args**. Considere objeto-parâmetro ou quebrar a função (F1).
- 🔴 `buildVapidHeaders` (`supabase/functions/push-send/index.ts:220`) — **5 args**. Considere objeto-parâmetro ou quebrar a função (F1).
- 🔴 `deliverWithRetry` (`supabase/functions/push-send/index.ts:652`) — **5 args**. Considere objeto-parâmetro ou quebrar a função (F1).
- 🔴 `request` (`supabase/functions/push-send/push-send.deno.ts:27`) — **5 args**. Considere objeto-parâmetro ou quebrar a função (F1).
- 🔴 `renderReceipt` (`utils/receiptPdf.ts:658`) — **5 args**. Considere objeto-parâmetro ou quebrar a função (F1).
- 🔴 `computeBroadcastStats` (`lib/marketing/broadcastStats.ts:96`) — **4 args**. Considere objeto-parâmetro ou quebrar a função (F1).
- 🔴 `computeCampaignPlan` (`lib/marketing/campaigns.ts:156`) — **4 args**. Considere objeto-parâmetro ou quebrar a função (F1).
- 🔴 `pick` (`screenshots/capture.mjs:15`) — **4 args**. Considere objeto-parâmetro ou quebrar a função (F1).
- 🔴 `replaceStrict` (`scripts/n8n/build-repasse-next-workflow.mjs:42`) — **4 args**. Considere objeto-parâmetro ou quebrar a função (F1).
- 🔴 `n8nFetch` (`scripts/n8n/build-repasse-next-workflow.mjs:643`) — **4 args**. Considere objeto-parâmetro ou quebrar a função (F1).

## Arquivos mais longos (> 200 linhas)

| Severidade | Arquivo | Linhas de código | I (instab.) |
|:--:|---------|:--:|:--:|
| 🔴 | `services/dataContext.tsx` | **3056** | 0.30 |
| 🔴 | `pages/PDV.tsx` | **2903** | 0.86 |
| 🔴 | `pages/PDVHistory.tsx` | **2531** | 0.94 |
| 🔴 | `pages/crm/ConversationsPage.tsx` | **2137** | 0.88 |
| 🔴 | `pages/Settings.tsx` | **1856** | 0.91 |
| 🔴 | `supabase/functions/_shared/admin_agent/operations.ts` | **1783** | · |
| 🔴 | `pages/Finance.tsx` | **1770** | 0.88 |
| 🔴 | `components/StockFormModal.tsx` | **1629** | 0.86 |
| 🔴 | `supabase/functions/_shared/uazapi.ts` | **1568** | 0.00 |
| 🔴 | `pages/Inventory.tsx` | **1511** | 0.93 |
| 🔴 | `pages/crm/SimulatorPage.tsx` | **1339** | 0.80 |
| 🔴 | `pages/Warranties.tsx` | **1195** | 0.89 |
| 🔴 | `pages/CRMChannels.tsx` | **1133** | 0.73 |
| 🔴 | `supabase/functions/crm-uaz-webhook-receiver/index.ts` | **1115** | · |
| 🔴 | `pages/Debtors.tsx` | **1058** | 0.88 |

## Módulos muito dependidos (cuidado ao mudar)

| Arquivo | Ca (fan-in) | Ce (fan-out) | I |
|---------|:--:|:--:|:--:|
| `types.ts` | **103** | 0 | 0.00 |
| `services/supabase.ts` | **38** | 0 | 0.00 |
| `components/ui/ToastProvider.tsx` | **35** | 4 | 0.10 |
| `services/dataContext.tsx` | **33** | 14 | 0.30 |
| `components/ui/Modal.tsx` | **26** | 1 | 0.04 |
| `utils/inputMasks.ts` | **24** | 0 | 0.00 |
| `hooks/useAsyncHandler.ts` | **20** | 1 | 0.05 |
| `hooks/useDisclosure.ts` | **17** | 0 | 0.00 |
| `contexts/AuthContext.tsx` | **17** | 3 | 0.15 |
| `components/motion/transitions.ts` | **16** | 0 | 0.00 |

> Ca alto + I baixo = muitos dependem dele e ele é concreto. Mudanças se propagam; proteja com testes fortes e considere extrair uma abstração estável (DIP). Ver Zona da Dor em `clean-architecture.md`.

---
_Próximo passo sugerido: começar pelos 🔴 (ciclos e lacunas de teste), criar rede de caracterização onde falta cobertura e refatorar em passos pequenos mantendo a suíte verde. Ver modo IMPROVE no SKILL.md._