# PRD: PDV Historico - Detalhes com Comprovantes e Edicao Completa de Venda Concluida

## 0. Perguntas de Clarificacao (com respostas assumidas)

1. Onde deve ficar o acesso a comprovantes de uma venda ja registrada?
   A. Dentro do modal/tela de detalhes da venda.
   B. Apenas na listagem principal.
   C. Apenas em pagina separada.
   D. Outro.

Resposta assumida: **A**.

2. Quais layouts de comprovante devem estar disponiveis no historico?
   A. 80mm e A4, com seletor antes de imprimir.
   B. Somente 80mm.
   C. Somente A4.
   D. Outro.

Resposta assumida: **A**.

3. Ao editar venda concluida, qual o nivel de permissao esperado?
   A. Edicao parcial (cliente/vendedor/obs).
   B. Edicao completa de todos os componentes de venda.
   C. Somente financeiro.
   D. Outro.

Resposta assumida: **B**.

4. O que deve ser considerado "componentes da venda" para checklist de revisao?
   A. Metadados + itens vendidos + trade-in + pagamentos + totais.
   B. Apenas itens vendidos e total.
   C. Apenas pagamentos.
   D. Outro.

Resposta assumida: **A**.

5. Ao alterar venda concluida, o sistema deve recompor efeitos financeiros/estoque associados?
   A. Sim, manter consistencia de estoque, transacoes, dividas e contadores.
   B. Nao, apenas salvar snapshot visual.
   C. Recalcular apenas total da venda.
   D. Outro.

Resposta assumida: **A**.

## 1. Introducao

O historico do PDV atualmente permite apenas edicao basica (cliente, vendedor, observacao) e nao oferece acao clara de detalhes com acesso direto aos comprovantes imprimiveis da venda. Esse limite cria retrabalho operacional quando e necessario revisar a venda completa, ajustar composicao financeira ou reemitir comprovante.

Esta entrega evolui o historico para:

- abrir detalhes completos da venda;
- permitir impressao de comprovante (80mm/A4) a partir dos detalhes;
- habilitar edicao completa de venda concluida, incluindo itens vendidos, trade-in, valores e formas de pagamento;
- manter consistencia de dados de estoque e financeiro no backend apos a edicao.

## 2. Goals

- Adicionar acao de **Detalhes** para cada venda no historico.
- Disponibilizar **Comprovantes imprimiveis** dentro de detalhes da venda.
- Permitir **edicao completa** de venda concluida (itens, trade-in, pagamentos e totais).
- Garantir que a atualizacao da venda mantenha consistencia de estoque e financeiro.
- Evitar regressoes no fluxo atual de filtro/cancelamento/historico.

## 3. User Stories

### US-001: Abrir detalhes completos da venda no historico
**Description:** Como operador, quero abrir os detalhes de uma venda para verificar toda a composicao antes de tomar acoes.

**Acceptance Criteria:**
- [ ] Cada venda possui acao "Detalhes" (desktop e mobile).
- [ ] O modal de detalhes exibe cliente, vendedor, data, itens vendidos, trade-in, pagamentos e totais.
- [ ] O modal mostra identificador da venda de forma clara.
- [ ] Typecheck/lint passes.
- [ ] Verify in browser using dev-browser skill.

### US-002: Acessar comprovantes imprimiveis pelos detalhes
**Description:** Como operador, quero acessar comprovantes imprimiveis direto dos detalhes para reimprimir em 80mm ou A4 sem abrir nova venda.

**Acceptance Criteria:**
- [ ] Modal de detalhes inclui botao "Comprovantes imprimiveis".
- [ ] Ao clicar, abre seletor de formato (80mm/A4).
- [ ] O sistema imprime apenas o layout selecionado.
- [ ] O conteudo impresso corresponde aos dados da venda escolhida.
- [ ] Typecheck/lint passes.
- [ ] Verify in browser using dev-browser skill.

### US-003: Editar componentes gerais da venda concluida
**Description:** Como admin, quero editar metadados da venda concluida para corrigir cadastro sem cancelar e refazer a venda.

**Acceptance Criteria:**
- [ ] Edicao permite alterar cliente, vendedor, data e observacoes.
- [ ] Salvar atualiza o registro da venda no banco.
- [ ] Alteracoes aparecem imediatamente no historico.
- [ ] Typecheck/lint passes.
- [ ] Verify in browser using dev-browser skill.

### US-004: Editar aparelho vendido e valores por item
**Description:** Como admin, quero trocar o aparelho vendido e ajustar valores por item para refletir a negociacao real.

**Acceptance Criteria:**
- [ ] Edicao permite remover/adicionar item vendido da venda.
- [ ] Permite editar valor original e valor negociado por item.
- [ ] Total da venda recalcula com base na composicao editada.
- [ ] Alterar item vendido atualiza status de estoque (sai/entra) corretamente.
- [ ] Typecheck/lint passes.

### US-005: Editar trade-in (aparelho(s) de entrada)
**Description:** Como admin, quero alterar aparelho trade-in e valor recebido para corrigir divergencias de entrada.

**Acceptance Criteria:**
- [ ] Edicao permite adicionar/remover trade-ins.
- [ ] Permite editar dados principais (modelo/capacidade/cor/imei/valor recebido).
- [ ] Subtotal de trade-in recalcula com base na lista editada.
- [ ] Persistencia salva em `sale_trade_in_items` e campo agregado em `sales.trade_in_value`.
- [ ] Typecheck/lint passes.

### US-006: Editar formas de pagamento e valores
**Description:** Como admin, quero editar formas de pagamento e seus valores para manter financeiro coerente com a venda real.

**Acceptance Criteria:**
- [ ] Edicao permite adicionar/remover formas de pagamento.
- [ ] Para cada forma, permite ajustar valor e campos especificos (conta, parcelas, vencimento de devedor, etc.).
- [ ] Validacao impede total de pagamentos incoerente com total liquido da venda.
- [ ] Atualizacao recompõe registros financeiros associados (`transactions` e `debts`) da venda editada.
- [ ] Typecheck/lint passes.

### US-007: Checklist de componentes da venda via PRD
**Description:** Como time de produto/engenharia, quero uma checklist explicita dos componentes da venda para revisar cobertura funcional da edicao.

**Acceptance Criteria:**
- [ ] PRD desta entrega documenta checklist completo dos componentes.
- [ ] Checklist cobre: metadados, itens vendidos, trade-in, pagamentos, totais e consistencia derivada.
- [ ] Checklist orienta validacao QA e homologacao.

## 4. Functional Requirements

- FR-1: O historico deve oferecer acao `Detalhes` para cada venda.
- FR-2: O detalhe da venda deve exibir resumo completo dos componentes persistidos.
- FR-3: O detalhe deve expor acao `Comprovantes imprimiveis`.
- FR-4: A impressao deve suportar layouts `80mm` e `A4` com seletor de formato.
- FR-5: O modal de edicao deve permitir alterar cliente, vendedor, data e observacoes.
- FR-6: O modal de edicao deve permitir substituir/editar itens vendidos.
- FR-7: O modal de edicao deve permitir editar preco original e negociado por item.
- FR-8: O modal de edicao deve permitir editar lista de trade-ins e valor recebido por trade-in.
- FR-9: O modal de edicao deve permitir editar/remover/adicionar formas de pagamento.
- FR-10: O sistema deve recalcular `original_subtotal`, `negotiated_subtotal`, `discount`, `trade_in_value` e `total` apos edicao.
- FR-11: O sistema deve atualizar `sales`, `sale_items`, `payment_methods` e `sale_trade_in_items` de forma sincronizada.
- FR-12: O sistema deve recompor efeitos financeiros da venda editada (`transactions` e `debts`) para evitar registros obsoletos.
- FR-13: O sistema deve manter consistencia de estoque ao trocar item vendido (`Disponível`/`Vendido`).
- FR-14: O sistema deve ajustar contadores de cliente e vendedor quando houver mudanca de cliente, vendedor ou total.

## 5. Non-Goals (Out of Scope)

- Nao criar novo fluxo fiscal/NF-e.
- Nao criar novo template de comprovante alem de 80mm/A4.
- Nao permitir edicao em massa de multiplas vendas.
- Nao alterar regras de permissao fora do modulo PDV/historico.

## 6. Design Considerations

- Acao de detalhes deve ficar proxima de editar/cancelar para previsibilidade.
- No detalhe, priorizar hierarquia por secoes: identificacao, itens, trade-in, pagamentos e totais.
- No modal de edicao, usar agrupamento por blocos para reduzir erro operacional.
- Campos monetarios devem exibir formato e validacao clara.

## 7. Technical Considerations

- Frontend principal em `pages/PDVHistory.tsx`.
- Persistencia principal em `services/dataContext.tsx` via `updateSale` ampliado.
- Impressao reutilizando padrao de `data-print-layout` ja usado no PDV.
- Necessario evitar manter templates de impressao dentro de modal para nao serem ocultados pelo `@media print`.

## 8. Success Metrics

- 100% das vendas do historico com acesso a detalhes e comprovante imprimivel.
- Reducao de cancelamentos/refazer venda por erro de cadastro simples (indicador qualitativo operacional).
- Zero divergencia conhecida entre venda editada e registros financeiros/estoque vinculados.
- Testes do historico cobrindo detalhes e edicao ampliada passando localmente.

## 9. Open Questions

- Edicao de venda com devedor parcialmente pago deve ser bloqueada ou permitir ajuste com reconciliacao guiada?
- A mudanca de item vendido deve restringir selecao apenas a estoque `Disponível` + item atual da venda?
- Precisamos historico/auditoria de alteracoes de venda em tabela dedicada em iteracao futura?

## 10. Checklist de Componentes da Venda

- [ ] Identificacao da venda (`id`, `date`, cliente, vendedor)
- [ ] Itens vendidos (`sale_items`): aparelho(s), valor original, valor negociado
- [ ] Trade-in (`sale_trade_in_items` + agregado): aparelho(s) de entrada e valor recebido
- [ ] Pagamentos (`payment_methods`): tipo, valor, conta e metadados por tipo
- [ ] Totais derivados: subtotal original, subtotal negociado, desconto, subtotal trade-in, total liquido
- [ ] Efeitos financeiros: `transactions` e `debts` coerentes com os pagamentos apos edicao
- [ ] Estoque: aparelho vendido marcado como `Vendido`; aparelho removido da venda retornado para `Disponível`
- [ ] Contadores: `customers.total_spent/purchases` e `sellers.total_sales` ajustados quando necessario
