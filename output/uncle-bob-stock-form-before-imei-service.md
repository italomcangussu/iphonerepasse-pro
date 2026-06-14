# Auditoria Uncle Bob — components

> Gerado por `audit_codebase.py`. Limiares em `references/metrics-thresholds.md`. Interprete cada número com a razão de engenharia (heurísticas em `references/`), não como dogma.

## Saúde por eixo

| Eixo | Status | Resumo |
|------|:------:|--------|
| Cobertura de testes | · | **não medido** — rode com `--run` ou gere coverage |
| Teste de mutação | · | **não medido** — configure Stryker (JS) ou mutmut (Py) |
| Estrutura de dependências | 🟢 | 0 ciclo(s) de dependência; 53 arquivos com imports internos |
| Complexidade ciclomática | 🔴 | 28/164 funções acima de 5 |
| Tamanho de módulos/funções | 🔴 | 14 arquivos > 200 linhas; 39 funções > 20 linhas |
| Duplicação | 🟢 | ~0.6% de blocos repetidos (heurístico) |

_Escopo: 55 arquivos-fonte, 164 funções analisadas._

## Funções mais complexas (complexidade > 5)

| Severidade | Função | Local | Complex. | Linhas | Args | Aninh. |
|:--:|--------|-------|:--:|:--:|:--:|:--:|
| 🔴 | `StockFormModal` | `StockFormModal.tsx:111` | **230** | 1639 | 1 | 5 |
| 🔴 | `SaleCompleteEditModal` | `SaleCompleteEditModal.tsx:110` | **125** | 930 | 1 | 4 |
| 🔴 | `LayoutInner` | `Layout.tsx:103` | **95** | 550 | 1 | 5 |
| 🔴 | `StockDetailsModal` | `StockDetailsModal.tsx:70` | **95** | 622 | 1 | 6 |
| 🔴 | `MessageBubbleInner` | `crm/MessageBubble.tsx:487` | **89** | 286 | 1 | 4 |
| 🔴 | `CRMSimpleCrud` | `crm/CRMSimpleCrud.tsx:45` | **67** | 321 | 1 | 5 |
| 🔴 | `Combobox` | `ui/Combobox.tsx:32` | **67** | 362 | 1 | 0 |
| 🔴 | `CRMStandaloneLayout` | `crm/CRMStandaloneLayout.tsx:24` | **62** | 300 | 0 | 1 |
| 🔴 | `AudioMessage` | `crm/AudioMessage.tsx:25` | **53** | 222 | 1 | 4 |
| 🔴 | `StockSimulatorModal` | `StockSimulatorModal.tsx:40` | **49** | 416 | 1 | 4 |

> Complexidade > 10 ⇒ nº de caminhos a testar explode. Extraia funções, use guard clauses (G18/G28) ou polimorfismo (G23/OCP).

## Funções mais longas (> 20 linhas)

| Severidade | Função | Local | Linhas | Complex. | Args |
|:--:|--------|-------|:--:|:--:|:--:|
| 🔴 | `StockFormModal` | `StockFormModal.tsx:111` | **1639** | 230 | 1 |
| 🔴 | `SaleCompleteEditModal` | `SaleCompleteEditModal.tsx:110` | **930** | 125 | 1 |
| 🔴 | `StockDetailsModal` | `StockDetailsModal.tsx:70` | **622** | 95 | 1 |
| 🔴 | `LayoutInner` | `Layout.tsx:103` | **550** | 95 | 1 |
| 🔴 | `StockSimulatorModal` | `StockSimulatorModal.tsx:40` | **416** | 49 | 1 |
| 🔴 | `Combobox` | `ui/Combobox.tsx:32` | **362** | 67 | 1 |
| 🔴 | `CRMSimpleCrud` | `crm/CRMSimpleCrud.tsx:45` | **321** | 67 | 1 |
| 🔴 | `CRMStandaloneLayout` | `crm/CRMStandaloneLayout.tsx:24` | **300** | 62 | 0 |
| 🔴 | `MessageBubbleInner` | `crm/MessageBubble.tsx:487` | **286** | 89 | 1 |
| 🔴 | `Modal` | `ui/Modal.tsx:78` | **254** | 41 | 1 |

> Função faz UMA coisa, em UM nível de abstração (Código Limpo cap. 3).

## Arquivos mais longos (> 200 linhas)

| Severidade | Arquivo | Linhas de código | I (instab.) |
|:--:|---------|:--:|:--:|
| 🔴 | `StockFormModal.tsx` | **1593** | 0.88 |
| 🔴 | `SaleCompleteEditModal.tsx` | **951** | 0.67 |
| 🔴 | `crm/MessageBubble.tsx` | **721** | 0.33 |
| 🔴 | `StockDetailsModal.tsx` | **641** | 0.83 |
| 🔴 | `Layout.tsx` | **602** | 0.83 |
| 🔴 | `crm/CRMStandaloneLayout.tsx` | **489** | 0.67 |
| 🔴 | `crm/ConversationsListPanel.tsx` | **450** | 0.50 |
| 🔴 | `StockSimulatorModal.tsx` | **428** | 0.60 |
| 🟡 | `ui/Combobox.tsx` | **355** | 0.33 |
| 🟡 | `crm/CRMSimpleCrud.tsx` | **339** | 1.00 |

## Módulos muito dependidos (cuidado ao mudar)

| Arquivo | Ca (fan-in) | Ce (fan-out) | I |
|---------|:--:|:--:|:--:|
| `ui/Modal.tsx` | **10** | 1 | 0.09 |
| `motion/transitions.ts` | **9** | 0 | 0.00 |
| `ui/ToastProvider.tsx` | **8** | 3 | 0.27 |

> Ca alto + I baixo = muitos dependem dele e ele é concreto. Mudanças se propagam; proteja com testes fortes e considere extrair uma abstração estável (DIP). Ver Zona da Dor em `clean-architecture.md`.

---
_Próximo passo sugerido: começar pelos 🔴 (ciclos e lacunas de teste), criar rede de caracterização onde falta cobertura e refatorar em passos pequenos mantendo a suíte verde. Ver modo IMPROVE no SKILL.md._