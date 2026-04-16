# PRD: Evolucao de UX dos Selects no App

## 1. Objetivo de UX

Padronizar a experiencia de uso de `select` em todo o app para reduzir ambiguidade de interacao, melhorar leitura de estado e manter consistencia visual entre modulos operacionais e CRM.

Hipotese principal:
`Se` os selects tiverem affordance visual explicita de dropdown e estados consistentes de foco/hover/disabled, `entao` a selecao de filtros e campos obrigatorios sera concluida com menos erro e menos hesitacao, `medido por` menor taxa de abandono em formularios e menor tempo medio para aplicar filtros.

## 2. Usuarios e Contexto

- Operador de loja: usa filtros de estoque, financeiro, devedores e historico de vendas varias vezes ao dia.
- Admin/gestor: configura usuarios, canais CRM e parametros operacionais com campos de selecao sensiveis.
- Contexto de uso: desktop e mobile, fluxo rapido, alta frequencia, necessidade de leitura imediata do controle.

## 3. Escopo de UX desta iteracao

Foco: `interface + otimizacao`.

Entregavel minimo:
- Mapear todos os `select` atuais.
- Evoluir design em camada global para cobrir `select.ios-input` e `select.crm-input`.
- Preservar regras de negocio existentes (sem alteracao de dados/fluxos).

## 4. Mapeamento Completo dos Selects

Baseline em 2026-04-16: `38 selects` em `14 arquivos`.

| Arquivo | Quantidade |
|---|---:|
| `pages/CRMChannels.tsx` | 6 |
| `pages/Finance.tsx` | 5 |
| `pages/PDVHistory.tsx` | 4 |
| `components/StockFormModal.tsx` | 3 |
| `pages/CRMLeads.tsx` | 3 |
| `pages/Debtors.tsx` | 3 |
| `pages/Settings.tsx` | 3 |
| `pages/Warranties.tsx` | 3 |
| `pages/Inventory.tsx` | 2 |
| `pages/PDV.tsx` | 2 |
| `components/crm/CRMSimpleCrud.tsx` | 1 |
| `components/crm/CRMStandaloneLayout.tsx` | 1 |
| `components/crm/CRMStoreFilter.tsx` | 1 |
| `pages/Sellers.tsx` | 1 |

## 5. Jornada Resumida (UX)

| Etapa | Objetivo do usuario | Acao | Friccao atual | Oportunidade |
|---|---|---|---|---|
| Entrada | Entender que campo e selecionavel | Bater o olho no formulario/filtro | Alguns selects parecem input comum | Reforcar seta de dropdown e cursor de acao |
| Exploracao | Abrir e navegar opcoes | Tocar/clicar no controle | Estado hover/foco pouco distinto | Aumentar contraste e feedback visual |
| Decisao | Escolher opcao correta | Selecionar item da lista | Hesitacao quando placeholder e opcao real se parecem | Melhorar hierarquia visual de texto e controle |
| Conclusao | Confirmar que escolha foi aplicada | Ver filtro ativo / salvar formulario | Falta padrao unico entre modulos | Uniformizar comportamento iOS e CRM |

## 6. Wireframe Textual (Padrao de Interacao)

- Tela: Qualquer tela com `select.ios-input` ou `select.crm-input`.
- Objetivo da tela: Permitir selecao rapida sem ambiguidade.
- Elementos principais (ordem de cima para baixo): label -> select com seta visivel -> mensagem de erro (quando houver) -> CTA.
- CTA primario: varia por contexto (filtrar, salvar, confirmar).
- CTA secundario: cancelar/limpar quando aplicavel.
- Feedback esperado apos acao: valor selecionado permanece visivel no campo e impacta lista/formulario.
- Estado vazio: opcao inicial clara (`Todos`, `Selecione`, etc.) sem parecer valor definitivo.
- Estado de erro: borda/realce de erro mantidos por classe existente.
- Estado de carregamento: manter select desabilitado quando dados de opcoes ainda nao carregaram.
- Evento de telemetria: alteracao de filtro e alteracao de campo critico em formularios administrativos.

## 7. User Stories

### US-001: Padrao visual unico de dropdown no sistema iOS
**Description:** Como operador, quero identificar imediatamente que um campo e um dropdown para decidir mais rapido.

**Acceptance Criteria:**
- [ ] Todo `select` com classe `ios-input` exibe seta de dropdown consistente.
- [ ] `hover`, `focus` e `disabled` possuem feedback visual claro.
- [ ] Nao ha regressao visual em inputs que nao sao `select`.
- [ ] Typecheck/lint passes.
- [ ] Verify in browser using dev-browser skill.

### US-002: Padrao visual unico de dropdown no sistema CRM
**Description:** Como gestor, quero o mesmo comportamento de dropdown no CRM para reduzir mudanca de contexto visual.

**Acceptance Criteria:**
- [ ] Todo `select` com classe `crm-input` exibe seta de dropdown consistente.
- [ ] Estado de foco permanece alinhado ao tema CRM.
- [ ] Nao ha regressao nos demais campos `crm-input`.
- [ ] Typecheck/lint passes.
- [ ] Verify in browser using dev-browser skill.

## 8. Functional Requirements

- FR-1: `select.ios-input` deve usar `appearance: none` e indicador visual de dropdown.
- FR-2: `select.ios-input` deve manter contraste legivel em light/dark mode.
- FR-3: `select.ios-input` deve ter estado `hover` e `disabled` coerentes.
- FR-4: `select.crm-input` deve ter o mesmo principio de affordance visual.
- FR-5: Estados de foco existentes (`ios-input` e `crm-input`) nao devem perder destaque de acessibilidade.
- FR-6: Mudanca deve ocorrer sem alterar regras de negocio dos formularios/filtros.

## 9. Non-Goals

- Nao substituir `select` por componente custom com busca nesta iteracao.
- Nao reescrever microcopy de todas as opcoes agora.
- Nao alterar fluxo de dados, validacoes de backend ou regras de permissao.

## 10. Checklist Heuristico e A11y (Aplicado)

- Visibilidade de status: foco/hover/disabled mais claros.
- Consistencia: mesmo comportamento de dropdown em iOS e CRM.
- Prevencao de erro: maior clareza de que o controle e selecionavel.
- WCAG pragmatico: foco visivel preservado e alvo de toque >= 44px.

## 11. Plano Rapido de Validacao

- Objetivo: confirmar se usuarios reconhecem dropdown mais rapido e cometem menos erro de selecao.
- Perfil: 3 operadores + 2 admins.
- Tarefas:
  - Aplicar filtro de loja no estoque.
  - Selecionar conta de entrada no Financeiro/PDV.
  - Configurar provider e funil no CRM Channels.
- Criterio de sucesso: concluir cada tarefa sem tentativa errada de digitacao no campo.
- Sinais de friccao: hesitacao > 2s, clique repetido sem feedback, troca de contexto entre modulos.
- Decisao final: manter estilo global ou ajustar contraste/espacamento apos rodada.

## 12. Metricas de Sucesso

- Reduzir em pelo menos 20% o tempo medio para aplicar filtros principais.
- Reduzir em pelo menos 15% erros de preenchimento em campos de selecao obrigatoria.
- Diminuir relatos qualitativos de "campo parece input" em testes internos.

