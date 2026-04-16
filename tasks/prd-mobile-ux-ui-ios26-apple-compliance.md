# PRD: Auditoria Completa UX/UI Mobile para Conformidade Apple iOS 26

## 0. Perguntas de Clarificacao (com respostas assumidas)

1. Qual e o escopo desta auditoria?
   A. Apenas telas operacionais principais (PDV e Estoque).
   B. Todo o app mobile autenticado + telas publicas + CRM standalone.
   C. Apenas componentes base (buttons, modal, nav).
   D. Outro.

Resposta assumida: **B**.

2. Qual o nivel de aderencia esperado as diretrizes Apple?
   A. Ajustes cosmeticos.
   B. Conformidade funcional para uso interno.
   C. Conformidade forte para UX mobile, acessibilidade e readiness iOS 26.
   D. Outro.

Resposta assumida: **C**.

3. O que fazer com tabelas que dependem de scroll horizontal no mobile?
   A. Manter como esta.
   B. Criar modo card/lista para tarefas comuns e manter tabela para desktop.
   C. Remover tabelas completamente.
   D. Outro.

Resposta assumida: **B**.

4. Este PRD deve incluir criterios de acessibilidade App Store iOS 26?
   A. Nao.
   B. Sim, incluindo matriz de tarefas comuns (login, compra, settings, etc).
   C. Apenas contraste.
   D. Outro.

Resposta assumida: **B**.

5. O rollout deve ser em fases para reduzir risco de regressao?
   A. Nao, big-bang.
   B. Sim, faseado por fundacao, telas criticas e modulos administrativos.
   C. Apenas piloto em uma tela.
   D. Outro.

Resposta assumida: **B**.

## 1. Introducao / Overview

Este PRD define um plano de adequacao UX/UI mobile para o iPhoneRepasse Pro, com foco em conformidade com as diretrizes Apple para iOS 26 e criterios de acessibilidade associados ao App Store.

A base atual esta madura (safe area parcial, motion com reduced motion, linguagem visual consistente), mas a auditoria identificou lacunas que afetam conformidade e usabilidade mobile em telas de alta frequencia.

### 1.1 Fontes oficiais Apple usadas como baseline

- UI Design Dos and Don'ts (hit targets 44x44 e texto minimo 11pt): https://developer.apple.com/design/tips/
- Meet Liquid Glass (WWDC25): https://developer.apple.com/videos/play/wwdc2025/219/
- Get to know the new design system (WWDC25): https://developer.apple.com/videos/play/wwdc2025/356/
- Sufficient Contrast evaluation criteria: https://developer.apple.com/help/app-store-connect/manage-app-accessibility/sufficient-contrast-evaluation-criteria/
- Overview of Accessibility Nutrition Labels (iOS 26+): https://developer.apple.com/help/app-store-connect/manage-app-accessibility/overview-of-accessibility-nutrition-labels/

### 1.2 Snapshot da auditoria atual (2026-04-16)

1. Alvos de toque abaixo de 44pt em controles criticos:
- `components/ui/Modal.tsx:260` (`w-8 h-8`)
- `pages/PDV.tsx:996` e `pages/PDV.tsx:1162` (`w-8 h-8`)
- `index.css:513` (`app-search-clear` com `1.5rem`)
- `index.css:1172` (`crm-icon-btn` com `min-height: 1.9rem`)

2. Dependencia de tabela com scroll horizontal em fluxos mobile:
- `pages/Inventory.tsx:374`
- `pages/PDVHistory.tsx:306`
- `pages/Debtors.tsx:396`
- `pages/Finance.tsx:426`
- `pages/Settings.tsx:634`

3. Safe area nao padronizada fora do shell principal:
- `pages/Login.tsx:38`
- `pages/PublicWarranty.tsx:108`
- Toast sem offset por `env(safe-area-inset-bottom)`: `components/ui/ToastViewport.tsx:49`

4. Tipografia fixa e labels pequenas em navegacao:
- `components/Layout.tsx:433` e `components/Layout.tsx:456` (`text-[10px]`)

5. Segmented control com area visual menor que alvo recomendado sem hit-slope adicional:
- `index.css:412` (`.ios-segment`, `min-height: 2rem`)

## 2. Goals

- Garantir alvos de toque efetivos de no minimo `44x44pt` em todos os controles interativos mobile.
- Eliminar dependencias de scroll horizontal para tarefas comuns em iPhone nas telas core.
- Padronizar safe area top/bottom em todas as rotas full-screen e superficies flutuantes.
- Normalizar tipografia mobile para legibilidade (`>= 11pt`) e consistencia por token.
- Aplicar Liquid Glass somente na camada funcional de navegacao/controle, com contraste validado.
- Garantir cobertura de acessibilidade para tarefas comuns conforme matriz iOS 26.
- Preservar performance e reduzir regressao com rollout faseado e testes de viewport.

## 3. User Stories

### US-001: Matriz de acessibilidade por tarefas comuns e dispositivo
**Description:** Como time de produto, queremos uma matriz de validacao de tarefas comuns para declarar conformidade de acessibilidade com criterio objetivo.

**Acceptance Criteria:**
- [ ] Criar matriz com tarefas: first launch, login, venda, filtros/listas, configuracoes e logout.
- [ ] Cobrir viewports iPhone SE (375), iPhone 15/16 (393-402), iPhone Pro Max (430+).
- [ ] Incluir colunas para: VoiceOver, Larger Text, Dark Interface, Sufficient Contrast, Reduced Motion.
- [ ] Definir evidencias por tarefa (video curto, screenshot e checklist).
- [ ] Typecheck/lint passes.

### US-002: Sistema global de hit targets 44x44
**Description:** Como usuario mobile, quero que todos os controles sejam faceis de tocar sem erro de toque.

**Acceptance Criteria:**
- [ ] Introduzir utilitario CSS para alvo minimo (`min-w` e `min-h` equivalentes a 44px) com opcao de hit-slope.
- [ ] Mapear e migrar controles menores em `Modal`, `Toast`, `PDV`, `Inventory`, `CRM`.
- [ ] Garantir espacamento minimo entre alvos adjacentes em acoes destrutivas.
- [ ] Nenhum botao interativo com caixa final menor que `44x44` nos fluxos auditados.
- [ ] Typecheck/lint passes.
- [ ] Verify in browser using dev-browser skill.

### US-003: Normalizacao de controles de dismiss e icon buttons
**Description:** Como usuario, quero fechar modais/toasts e remover itens com toque preciso e feedback claro.

**Acceptance Criteria:**
- [ ] `Modal` close button passa para alvo efetivo >= 44x44 mantendo hierarquia visual.
- [ ] `Toast` close action e action button passam para alvo efetivo >= 44x44.
- [ ] Controles de remocao no `PDV` passam para alvo efetivo >= 44x44.
- [ ] `app-search-clear` e `crm-icon-btn` passam para alvo efetivo >= 44x44.
- [ ] Typecheck/lint passes.
- [ ] Verify in browser using dev-browser skill.

### US-004: Contrato de safe area em todas as rotas full-screen
**Description:** Como usuario de iPhone com notch/home indicator, quero que nenhum conteudo ou CTA fique colado em areas inseguras.

**Acceptance Criteria:**
- [ ] Criar wrapper reutilizavel para aplicar safe area top/bottom por rota.
- [ ] Aplicar em `Login`, `PublicWarranty` e outras rotas fora do `Layout` principal.
- [ ] Ajustar `ToastViewport` para respeitar `safe-area-inset-bottom` no mobile.
- [ ] Validar com teclado aberto em formularios criticos.
- [ ] Typecheck/lint passes.
- [ ] Verify in browser using dev-browser skill.

### US-005: Modo mobile sem scroll horizontal para Inventory e PDVHistory
**Description:** Como usuario operacional, quero consumir listas de estoque e historico de vendas sem arrastar tabela lateralmente.

**Acceptance Criteria:**
- [ ] Implementar modo card/lista mobile para `Inventory` mantendo tabela no desktop.
- [ ] Implementar modo card/lista mobile para `PDVHistory` mantendo tabela no desktop.
- [ ] Exibir no card apenas campos criticos + acao primaria visivel.
- [ ] Tarefas comuns (buscar, filtrar, abrir detalhe, editar) executaveis sem scroll horizontal.
- [ ] Typecheck/lint passes.
- [ ] Verify in browser using dev-browser skill.

### US-006: Modo mobile sem scroll horizontal para Finance, Debtors e Settings
**Description:** Como admin/gerente em mobile, quero consultar recebiveis e permissoes com leitura vertical clara.

**Acceptance Criteria:**
- [ ] Criar visao mobile para tabela de devedores do `Finance`.
- [ ] Criar visao mobile para `Debtors` (lista de dividas e acoes).
- [ ] Criar visao mobile para matriz de permissoes em `Settings` (por modulo em cards/accordion).
- [ ] Manter versao tabela para desktop sem regressao.
- [ ] Typecheck/lint passes.
- [ ] Verify in browser using dev-browser skill.

### US-007: Tipografia mobile legivel e tokenizada
**Description:** Como usuario, quero ler informacao critica sem esforco em tela pequena.

**Acceptance Criteria:**
- [ ] Substituir tamanhos fixos menores que 11px em elementos de leitura funcional por tokens equivalentes >= 11px.
- [ ] Revisar labels de navegacao e status para legibilidade em 100% zoom e com Larger Text.
- [ ] Padronizar estilos tipograficos por funcao (titulo, subtitulo, metadata, badge, helper).
- [ ] Typecheck/lint passes.
- [ ] Verify in browser using dev-browser skill.

### US-008: Governanca de Liquid Glass + contraste
**Description:** Como usuario, quero interfaces com glass legiveis e sem poluicao visual.

**Acceptance Criteria:**
- [ ] Documentar regra: Liquid Glass somente em camada funcional (nav, barras, sheets, toasts, overlays).
- [ ] Remover usos indevidos de glass na camada de conteudo, se existirem.
- [ ] Validar contraste em light/dark com texto e controles sobre superficies translucidas.
- [ ] Garantir criterio minimo de contraste para texto e componentes de estado.
- [ ] Typecheck/lint passes.
- [ ] Verify in browser using dev-browser skill.

### US-009: Reduced Motion e feedback alternativo
**Description:** Como usuario sensivel a movimento, quero completar fluxos sem animacoes desconfortaveis.

**Acceptance Criteria:**
- [ ] Garantir fallback sem transformacoes bruscas para transicoes e microinteracoes.
- [ ] Confirmar feedback alternativo (opacidade, cor, estado) quando motion for reduzido.
- [ ] Validar toasts, modais, page transitions e celebracoes no modo reduced motion.
- [ ] Typecheck/lint passes.
- [ ] Verify in browser using dev-browser skill.

### US-010: CRM standalone mobile hardening
**Description:** Como usuario CRM em mobile, quero controles confortaveis e layout sem quebra.

**Acceptance Criteria:**
- [ ] Ajustar `crm-btn`, `crm-input`, `crm-sidebar-toggle`, `crm-icon-btn` para ergonomia mobile (alvo efetivo >= 44x44).
- [ ] Validar fluxo de navegacao principal e filtros em viewport <= 430px.
- [ ] Remover truncamentos criticos em cabecalho e acoes principais.
- [ ] Typecheck/lint passes.
- [ ] Verify in browser using dev-browser skill.

### US-011: Regressao visual automatizada por viewport
**Description:** Como time de engenharia, queremos detectar regressao UX mobile antes de release.

**Acceptance Criteria:**
- [ ] Criar suite de screenshots para telas core em 3 breakpoints iPhone.
- [ ] Validar ausencia de overflow horizontal nos fluxos principais.
- [ ] Validar safe area e sobreposicao de bottom navigation/toast/modal.
- [ ] Build, typecheck e testes automatizados passam no CI.

## 4. Functional Requirements

- FR-1: O sistema deve garantir alvo efetivo minimo de `44x44` para controles interativos mobile.
- FR-2: O sistema deve aplicar safe area top/bottom de forma consistente em todas as rotas full-screen.
- FR-3: O sistema deve eliminar scroll horizontal nas tarefas comuns mobile dos modulos Inventory, PDVHistory, Finance, Debtors e Settings.
- FR-4: O sistema deve manter tabela desktop para analise densa onde aplicavel.
- FR-5: O sistema deve fornecer representacao mobile em card/lista para cada tabela prioritaria.
- FR-6: O sistema deve manter acoes primarias e destrutivas visiveis e tocaveis sem ambiguidade.
- FR-7: O sistema deve usar tipografia funcional com tamanho minimo legivel >= 11px para conteudo e labels criticos.
- FR-8: O sistema deve restringir Liquid Glass a camada funcional de navegacao/controle.
- FR-9: O sistema deve validar contraste de texto/icone/estado em light e dark mode, incluindo superficies translucidas.
- FR-10: O sistema deve respeitar `prefers-reduced-motion` em animacoes e interacoes chave.
- FR-11: O sistema deve manter comportamento funcional atual sem regressao de regras de negocio.
- FR-12: O sistema deve disponibilizar matriz de auditoria de acessibilidade por tarefa comum e por dispositivo.
- FR-13: O sistema deve registrar evidencias de conformidade para release (screenshots + checklist).
- FR-14: O sistema deve incluir checks de regressao visual mobile no pipeline de entrega.

## 5. Non-Goals (Out of Scope)

- Reescrever o produto como app nativo SwiftUI/UIKit nesta iteracao.
- Alterar regras de negocio de vendas, financeiro, CRM ou permissoes.
- Redesenhar identidade visual da marca.
- Cobrir iPad/macOS com o mesmo nivel de detalhe desta fase (foco e iPhone).

## 6. Design Considerations

- Priorizar clareza da tarefa sobre densidade de informacao no mobile.
- Em listas mobile, mostrar somente campos de decisao e mover detalhes longos para detalhe/modal.
- Preservar consistencia de componentes (`IOSButton`, `Modal`, `Toast`, `Combobox`) para reduzir variancia.
- Evitar stacking excessivo de superficies em glass.
- Manter CTA principal sempre no alcance visual e de toque.

## 7. Technical Considerations

- Arquivos centrais de base:
  - `index.css`
  - `components/Layout.tsx`
  - `components/ui/Modal.tsx`
  - `components/ui/ToastViewport.tsx`
- Telas core para fase 1 e 2:
  - `pages/Inventory.tsx`
  - `pages/PDVHistory.tsx`
  - `pages/Finance.tsx`
  - `pages/Debtors.tsx`
  - `pages/Settings.tsx`
- Rotas fora do shell principal:
  - `pages/Login.tsx`
  - `pages/PublicWarranty.tsx`
- Superficie CRM standalone:
  - `components/crm/CRMStandaloneLayout.tsx`
  - estilos `crm-*` em `index.css`

## 8. Success Metrics

- 100% dos controles auditados com alvo efetivo >= `44x44` em mobile.
- 0 ocorrencias de scroll horizontal nas tarefas comuns mobile dos modulos priorizados.
- 100% das rotas full-screen com safe area validada em devices com notch/home indicator.
- 100% das tarefas comuns da matriz com status validado para: Dark Interface, Sufficient Contrast e Reduced Motion.
- Queda de incidentes de usabilidade mobile reportados no periodo pos-release (meta: -50% em 30 dias).

## 9. Plano de Rollout

1. Fase 1 - Fundacao (tokens, hit targets, safe area, controles base)
2. Fase 2 - Telas operacionais core (Inventory, PDVHistory, Finance, Debtors)
3. Fase 3 - Administrativo e CRM (Settings permissions + CRM standalone)
4. Fase 4 - Hardening (auditoria final, regressao visual, evidencias de conformidade)

## 10. Open Questions

- O modulo CRM standalone deve manter paridade total mobile agora ou entrar em fase separada apos core?
- Em `Settings` (permissoes), preferimos `accordion` por modulo ou cards com toggles agrupados por acao?
- O time quer um budget formal de performance para blur/glass em aparelhos de entrada (ex.: iPhone SE) antes do release final?
