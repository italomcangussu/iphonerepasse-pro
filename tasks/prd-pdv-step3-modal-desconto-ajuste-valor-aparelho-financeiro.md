# PRD: PDV Step 3 - Modal de Desconto (R$ / %) + Ajuste de Valor do Aparelho com Repercussao Financeira

## 0. Contexto e Premissas desta Iteracao

Este PRD foi gerado a partir do briefing atual, sem rodada adicional de perguntas.
Premissas adotadas para esta entrega:

1. O desconto sera aplicado no Step 3 do PDV via modal dedicado.
2. O operador podera escolher desconto em valor fixo (R$) ou percentual (%).
3. O operador podera ajustar o valor de venda do aparelho no Step 3, inclusive para cima do valor cadastrado no estoque.
4. O valor final negociado deve repercutir corretamente no fluxo financeiro (sales, payment_methods, transactions, dashboards e historico).
5. A experiencia deve ficar legivel e sem truncamento em mobile e desktop.

## 1. Introduction/Overview

Hoje o Step 3 do PDV calcula o total com base no `sellPrice` cadastrado no estoque e no valor de trade-in, sem um fluxo explicito para negociacao de desconto e sem ajuste manual do preco final do aparelho nessa etapa.

Isso limita operacoes comuns de loja (desconto de fechamento, venda acima do preco de tabela por condicao de mercado, bundle, urgencia) e pode gerar divergencia operacional entre o que foi negociado no caixa e o que fica registrado no financeiro.

A proposta e incluir no Step 3:
- modal de desconto com selecao entre R$ e %,
- ajuste de valor do aparelho (inclusive acima do cadastro),
- persistencia auditavel do preco original x preco negociado,
- reflexo consistente no calculo do total, validacoes de pagamento e registros financeiros.

## 2. Goals

- Permitir aplicar desconto em R$ ou % no Step 3 com feedback imediato de calculo.
- Permitir alterar o valor do aparelho no Step 3 para mais ou para menos do valor cadastrado.
- Garantir que `sale.total` e os lancamentos financeiros reflitam exatamente o valor final negociado.
- Preservar rastreabilidade do preco original cadastrado e do preco efetivamente vendido.
- Entregar UX sem truncamento e sem quebra visual em mobile e desktop.

## 3. User Stories

### US-001: Abrir modal de desconto no Step 3
**Description:** Como operador de caixa, eu quero abrir um modal de desconto no Step 3 para ajustar rapidamente a negociacao sem sair do fluxo de fechamento.

**Acceptance Criteria:**
- [ ] Existe CTA explicito no Step 3 para abrir o modal de desconto.
- [ ] O modal abre com foco inicial no seletor de tipo de desconto.
- [ ] O modal mostra valor base atual antes do desconto.
- [ ] O modal pode ser fechado por `Cancelar`, `ESC` e clique no backdrop (quando permitido pelo padrao atual de Modal).
- [ ] Typecheck/lint passes.
- [ ] Verify in browser using dev-browser skill.

### US-002: Escolher desconto por R$ ou %
**Description:** Como operador de caixa, eu quero escolher desconto por valor fixo ou percentual para seguir a regra comercial acordada com o cliente.

**Acceptance Criteria:**
- [ ] O modal possui alternancia clara entre `R$` e `%`.
- [ ] Ao trocar o tipo, o input e a mascara/validacao se adaptam automaticamente.
- [ ] O sistema exibe o desconto convertido em R$ em tempo real, independente do tipo escolhido.
- [ ] O sistema impede desconto que gere total negativo.
- [ ] Typecheck/lint passes.
- [ ] Verify in browser using dev-browser skill.

### US-003: Ajustar valor do aparelho no Step 3 (inclusive acima do cadastrado)
**Description:** Como operador de caixa, eu quero editar o valor do aparelho no fechamento para registrar a negociacao real, inclusive quando vender acima do valor de tabela.

**Acceptance Criteria:**
- [ ] Existe campo/acao de `Valor negociado do aparelho` no Step 3.
- [ ] O valor inicial e preenchido com `selectedProduct.sellPrice`.
- [ ] E permitido informar valor maior que `sellPrice` sem bloqueio.
- [ ] O sistema sinaliza visualmente quando houve aumento ou reducao em relacao ao valor cadastrado.
- [ ] O valor final e refletido imediatamente no resumo e no restante.
- [ ] Typecheck/lint passes.
- [ ] Verify in browser using dev-browser skill.

### US-004: Recalculo consistente do resumo e dos pagamentos
**Description:** Como operador de caixa, eu quero que total, restante e validacoes de pagamento sejam recalculados apos desconto/ajuste para evitar fechamento inconsistente.

**Acceptance Criteria:**
- [ ] `Subtotal` passa a considerar o valor negociado do aparelho (nao apenas o valor original de estoque).
- [ ] `Total` considera: valor negociado - desconto negociado - trade-in.
- [ ] `Restante` e recalculado imediatamente apos qualquer alteracao de preco/desconto.
- [ ] Se pagamentos ja adicionados excederem o novo total, o sistema bloqueia finalizacao e orienta remocao/ajuste de pagamento.
- [ ] Typecheck/lint passes.
- [ ] Verify in browser using dev-browser skill.

### US-005: Persistir dados de negociacao para auditoria
**Description:** Como gestor, eu quero enxergar preco original, preco negociado e desconto aplicado para auditar margem e comportamento de venda.

**Acceptance Criteria:**
- [ ] A venda salva `preco_original`, `preco_negociado`, `tipo_desconto`, `valor_desconto` e `valor_desconto_percentual` (quando aplicavel).
- [ ] O item da venda (`sale_items`) registra o preco final efetivo vendido.
- [ ] O historico de vendas exibe os dados de negociacao de forma clara.
- [ ] Typecheck/lint passes.

### US-006: Repercussao correta no fluxo financeiro
**Description:** Como admin financeiro, eu quero que o valor final negociado afete corretamente os lancamentos para evitar divergencia de caixa e relatrios.

**Acceptance Criteria:**
- [ ] `sales.total` usa o valor final negociado da venda.
- [ ] Lancamentos `transactions` de entrada por `payment_methods` continuam somando o valor liquido recebido e batendo com os pagamentos informados.
- [ ] Trade-in continua gerando saida (`OUT/Compra`) sem regressao.
- [ ] Contadores de `customers.total_spent` e `sellers.total_sales` refletem o novo total da venda.
- [ ] Typecheck/lint passes.

### US-007: UX responsiva sem truncamento (mobile e desktop)
**Description:** Como operador, eu quero concluir o fluxo sem textos cortados, controles espremidos ou overflow horizontal em nenhum dispositivo.

**Acceptance Criteria:**
- [ ] Mobile alvo (390x844): modal e resumo sem truncamento critico de labels/valores.
- [ ] Desktop alvo (1440x900): campos, totais e CTA permanecem legiveis sem sobreposicao.
- [ ] Conteudos numericos longos usam tratamento visual consistente (tabular nums, quebra/ellipsis controlada apenas onde aceitavel).
- [ ] Footer do modal com acoes principais permanece acessivel.
- [ ] Typecheck/lint passes.
- [ ] Verify in browser using dev-browser skill.

## 4. Functional Requirements

- FR-1: O sistema deve adicionar no Step 3 um CTA para abrir `Modal de Desconto`.
- FR-2: O modal deve suportar dois modos de desconto: `amount` (R$) e `percent` (%).
- FR-3: O sistema deve converter desconto percentual para valor monetario em tempo real para exibicao e persistencia.
- FR-4: O Step 3 deve expor campo de `valor negociado` iniciando com `selectedProduct.sellPrice`.
- FR-5: O sistema deve permitir `valor negociado > valor cadastrado` sem bloqueio.
- FR-6: O sistema deve manter validacao minima: valor negociado > 0 e total final >= 0.
- FR-7: Formula base do total deve ser: `total = max(0, valor_negociado - desconto_monetario - trade_in_value)`.
- FR-8: O bloco de resumo (`Subtotal`, `Total`, `Restante`) deve atualizar imediatamente apos qualquer alteracao de preco/desconto.
- FR-9: O fluxo de pagamento deve revalidar automaticamente pagamentos existentes quando total mudar.
- FR-10: A venda deve persistir snapshot de negociacao com, no minimo:
  - `original_unit_price`
  - `negotiated_unit_price`
  - `discount_type` (`amount` | `percent`)
  - `discount_value` (R$)
  - `discount_percent` (nullable)
- FR-11: `sale_items.price` deve refletir o preco final efetivo vendido do item (negotiated/final), sem depender do `stock_items.sell_price` original.
- FR-12: `sales.total` deve refletir o valor final negociado apos descontos e trade-in.
- FR-13: Os triggers/funcoes financeiras atuais devem continuar contabilizando entrada/saida com base nos dados finais da venda sem regressao.
- FR-14: O historico de vendas deve apresentar os campos de negociacao de forma auditavel para admin/manager.
- FR-15: O modal e o Step 3 devem ser responsivos sem overflow horizontal em breakpoints mobile e desktop.
- FR-16: O fluxo deve manter consistencia com acessibilidade minima: foco visivel, labels claros, mensagem de erro acionavel.

## 5. Non-Goals (Out of Scope)

- Nao incluir motor de precificacao automatica por margem/custo.
- Nao incluir aprovacao hierarquica de desconto nesta iteracao.
- Nao alterar regras de taxa de cartao ou formulas existentes de acrescimo.
- Nao implementar campanha/cupom promocional multi-item.
- Nao alterar fluxo de impressao alem do necessario para exibir valor final correto no comprovante.

## 6. Design Considerations (UX)

### 6.1 Objetivo de UX e hipotese

- Objetivo de UX: permitir ajuste comercial no fechamento sem aumentar friccao cognitiva nem gerar ambiguidade nos totais.
- Hipotese principal: **Se** o desconto (R$ / %) e o ajuste de valor forem centralizados em interacoes curtas e explicitas no Step 3, **entao** o operador concluira a venda com menos retrabalho e sem erros de total, **medido por** reducao de correcoes manuais e taxa de finalizacao sem bloqueio.

### 6.2 Usuarios e contexto

- Usuario principal: operador de caixa (seller/manager) em atendimento presencial.
- Usuario secundario: admin/financeiro que audita resultado da venda.
- Contexto: alta frequencia, baixa tolerancia a campos confusos, necessidade de clareza numerica.

### 6.3 Jornada resumida

| Etapa | Objetivo do usuario | Acao | Friccao atual | Oportunidade |
|---|---|---|---|---|
| Entrada | Fechar venda no Step 3 | Revisar resumo e pagamentos | Sem fluxo claro de desconto negociado | Introduzir CTA de desconto dedicado |
| Exploracao | Ajustar condicao comercial | Abrir modal e escolher R$/% | Conversao mental de percentual para valor | Mostrar conversao instantanea |
| Decisao | Confirmar valor final | Ajustar preco negociado e validar restante | Divergencia entre preco de tabela e venda real | Snapshot claro de original x negociado |
| Conclusao | Finalizar sem erro financeiro | Revisar total/restante e concluir | Risco de valor pago nao bater apos ajuste | Revalidacao automatica + mensagens acionaveis |

### 6.4 Wireframe textual por tela

- Tela: PDV Step 3 (Resumo + Pagamentos)
- Objetivo da tela: consolidar fechamento com clareza de valor original, valor negociado, desconto e total.
- Elementos principais (ordem de cima para baixo): resumo financeiro -> CTA `Aplicar desconto` -> campo `Valor negociado` -> formas de pagamento -> restante -> CTA `Finalizar Venda`.
- CTA primario: `Finalizar Venda`.
- CTA secundario: `Salvar rascunho`, `Voltar etapa`, `Aplicar desconto`.
- Feedback esperado apos acao: recalc de total e restante em tempo real.
- Estado vazio: sem pagamento adicionado.
- Estado de erro: pagamento excedente ou total invalido apos ajuste.
- Estado de carregamento: nao aplicavel (calculo local); manter feedback visual instantaneo.
- Evento de telemetria: `pdv_discount_applied`, `pdv_price_overridden`, `pdv_sale_finished`.

- Tela: Modal de Desconto
- Objetivo da tela: configurar desconto sem ambiguidade entre valor fixo e percentual.
- Elementos principais (ordem de cima para baixo): seletor de tipo (R$ / %) -> campo de entrada -> resumo de conversao -> preview do total final.
- CTA primario: `Aplicar desconto`.
- CTA secundario: `Cancelar`.
- Feedback esperado apos acao: total atualizado no Step 3 sem fechar contexto do usuario.
- Estado vazio: desconto 0 (sem impacto).
- Estado de erro: valor invalido, percentual fora de faixa, total negativo.
- Estado de carregamento: nao aplicavel.
- Evento de telemetria: `pdv_discount_modal_opened`, `pdv_discount_applied`.

### 6.5 Especificacao de interacao

- Gatilho do usuario: clicar em `Aplicar desconto` no Step 3.
- Regra de negocio: modal abre com base no valor negociado atual.
- Resposta da interface: foco no seletor de tipo; preview dinamico ativo.
- Mensagem de feedback: exibir desconto calculado e novo total.
- Condicao de bloqueio: valor invalido.
- Alternativa de recuperacao: corrigir campo e aplicar novamente.

- Gatilho do usuario: editar `Valor negociado`.
- Regra de negocio: aceita valor maior ou menor que preco cadastrado, desde que > 0.
- Resposta da interface: atualizar subtotal/total/restante instantaneamente.
- Mensagem de feedback: badge `Acima do preco cadastrado` ou `Abaixo do preco cadastrado`.
- Condicao de bloqueio: valor <= 0.
- Alternativa de recuperacao: restaurar valor original via atalho `Usar preco cadastrado`.

- Gatilho do usuario: finalizar venda apos ajuste.
- Regra de negocio: restante deve ser <= 0 e campos obrigatorios preenchidos.
- Resposta da interface: manter bloqueio com motivo explicito quando invalido.
- Mensagem de feedback: `Pagamento excede o total. Ajuste ou remova pagamentos.` quando aplicavel.
- Condicao de bloqueio: divergencia entre pagamentos e total final.
- Alternativa de recuperacao: editar/remover pagamentos e concluir.

### 6.6 Checklist de usabilidade e acessibilidade aplicado

- Labels curtos e objetivos (`Valor negociado`, `Tipo de desconto`, `Desconto aplicado`).
- Alvos de toque adequados para mobile (>= 44px).
- Contraste e foco visivel em inputs e botoes.
- Mensagens de erro vinculadas ao campo causador.
- Sem dependencia exclusiva de cor para indicar aumento/reducao de preco.

## 7. Technical Considerations

- Frontend principal:
  - `pages/PDV.tsx` (estado de preco negociado, estado de desconto, novos calculos, modal e validacoes)
  - `types.ts` (novos campos opcionais de negociacao em `Sale` / `sale item snapshot`)
  - `pages/PDVHistory.tsx` (exibicao de dados de negociacao, se aplicavel no escopo)
- Data layer:
  - `services/dataContext.tsx` (`addSale` deve persistir novos campos e preco final em `sale_items.price`)
- Banco (migracao nova):
  - adicionar colunas em `public.sales` para snapshot de negociacao (tipo e valores de desconto, preco original/negociado quando no nivel da venda)
  - opcional/recomendado: adicionar em `public.sale_items` campo de `original_price` para auditoria de diferenca por item
- Financeiro:
  - revisar compatibilidade com `handle_sale_after_insert` e `handle_payment_method_after_insert` para garantir consistencia com `sales.total` final
  - manter regras atuais de trade-in e pagamento devedor sem regressao
- Testes:
  - atualizar `pages/PDV.test.tsx` com cenarios de desconto em R$ e %, preco acima do cadastrado e validacao de restante
  - adicionar testes de regressao de persistencia em `dataContext` (quando coberto)

## 8. Success Metrics

- >= 95% das vendas com ajuste comercial concluidas sem retrabalho manual de pagamento no mesmo atendimento.
- 0 divergencia entre `sales.total` e regra de fechamento exibida no Step 3 (amostra QA + homologacao).
- 0 truncamentos bloqueantes em mobile (390x844) e desktop (1440x900) no fluxo principal do Step 3.
- 100% das vendas com ajuste exibindo campos auditaveis de negociacao no historico/consulta.

## 9. Open Questions

- O ajuste para cima do valor cadastrado sera permitido para todos os perfis (`seller`, `manager`, `admin`) ou com regra de permissao?
- Deve existir limite maximo de aumento percentual para evitar erro operacional?
- O desconto percentual deve aceitar casas decimais (ex.: 2.5%) ou apenas inteiros?
- No comprovante, devemos exibir separadamente `Preco original`, `Preco negociado` e `Desconto`?
- Em caso de venda com multiplos itens no futuro, o desconto sera por item ou por venda?

## 10. Plano Rapido de Validacao (UX)

- Objetivo: validar clareza de negociacao e ausencia de truncamento no Step 3.
- Perfil de participantes: 3-5 operadores (mix seller e manager).
- Tarefas:
  - T1: aplicar desconto de R$ 300 e finalizar venda.
  - T2: aplicar desconto de 5% e conferir valor convertido.
  - T3: aumentar valor do aparelho acima do cadastrado e concluir venda.
  - T4: gerar cenario de pagamento excedente e corrigir para finalizar.
- Criterio de sucesso por tarefa:
  - Operador conclui sem duvida sobre total final.
  - Nao ha texto truncado que impeça entendimento.
  - Nao ha overflow horizontal em mobile/desktop alvo.
- Sinais de friccao observaveis:
  - Duvida recorrente entre desconto em % e R$.
  - Erro frequente ao interpretar restante apos ajuste de preco.
  - Busca longa pelo CTA de aplicar desconto.
- Decisao esperada ao final:
  - Aprovar rollout quando tarefas forem concluidas com baixa friccao e sem erro de total.
