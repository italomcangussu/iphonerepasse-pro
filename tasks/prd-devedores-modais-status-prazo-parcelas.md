# PRD: UX de Modais e Status de Prazo em Devedores

## 1. Objetivo de UX

Melhorar a clareza operacional da tela `Devedores`, removendo truncamentos visuais em modais e exibindo status de prazo compreensivel para cobranca.

Hipotese principal:
`Se` o modal de pagamento e a tabela de devedores apresentarem informacoes sem truncamento, com status de prazo explicito e valor de parcela visivel, `entao` operadores registram cobrancas com menos erro e maior velocidade, `medido por` menor retrabalho em pagamentos e menor tempo para identificar prioridade de cobranca.

## 2. Usuarios e Contexto

- Operador financeiro: registra recebimentos, identifica devedores criticos e acompanha parcelamentos.
- Gestor: monitora carteira em aberto e atrasos.
- Contexto: uso diario em desktop e mobile, com necessidade de leitura rapida de saldo, vencimento e condicao de prazo.

## 3. Fluxo Recomendado

| Etapa | Objetivo do usuario | Acao | Friccao atual | Oportunidade |
|---|---|---|---|---|
| Entrada | Ver rapidamente quem priorizar | Abrir tabela de devedores | Status atual nao explicita prazo | Exibir badge de prazo (`Em aberto`, `Atrasado`, `Em dias`) |
| Analise | Entender parcelamento pendente | Ler colunas financeiras | Valor por parcela nao aparece | Mostrar `Valor Parcela` para saldo parcelado |
| Execucao | Registrar pagamento sem erro | Abrir modal e preencher | Cards truncados no modal `md` | Expandir modal e reorganizar grid responsivo |
| Conclusao | Confirmar registro e historico | Revisar historico no modal | Layout e feedback variam por viewport | Padronizar footer e blocos para mobile/desktop |

## 4. Wireframe Textual

- Tela: `Devedores` (lista + modal de pagamento).
- Objetivo da tela: priorizar cobranca e registrar pagamento com contexto completo.
- Elementos principais:
  - Tabela: cliente -> badge de prazo -> situacao operacional -> saldo -> parcelas -> valor parcela -> vencimento -> observacao -> acoes.
  - Modal pagamento: resumo em cards responsivos -> formulario de pagamento -> historico.
- CTA primario: `Confirmar Pagamento`.
- CTA secundario: `Cancelar`.
- Feedback apos acao: toast de sucesso e atualizacao da linha na tabela.
- Estado vazio: mensagem clara sem truncamento.
- Estado de erro: validacao de valor e mensagens acionaveis.
- Estado de carregamento: botao com texto de progresso (`Confirmando...`, `Salvando...`).

## 5. User Stories

### US-001: Badge de prazo para priorizacao de cobranca
**Description:** Como operador, quero ver o prazo da divida em linguagem direta para saber quem cobrar primeiro.

**Acceptance Criteria:**
- [ ] Mostrar badge `Em aberto` quando a divida nao venceu e ainda nao foi quitada.
- [ ] Mostrar badge `Atrasado` quando nao foi quitada ate a data de vencimento.
- [ ] Mostrar badge `Em dias` quando foi quitada antes ou no dia do vencimento.
- [ ] Typecheck/lint passes.
- [ ] Verify in browser using dev-browser skill.

### US-002: Valor da parcela para saldo parcelado
**Description:** Como operador, quero visualizar o valor por parcela no saldo em aberto para orientar negociacao e cobranca.

**Acceptance Criteria:**
- [ ] Para dividas com `saldo > 0` e `parcelas > 1`, exibir coluna/valor de parcela na tabela desktop.
- [ ] Exibir valor da parcela tambem no card mobile.
- [ ] Quando nao houver parcelamento em aberto, exibir `-`.
- [ ] Typecheck/lint passes.
- [ ] Verify in browser using dev-browser skill.

### US-003: Modal de pagamento sem truncamento em mobile e desktop
**Description:** Como operador, quero que os dados no modal fiquem legiveis em qualquer viewport para evitar erro no registro.

**Acceptance Criteria:**
- [ ] Modal de pagamento usa largura e grid responsivos para evitar truncamento de cliente/saldo/vencimento.
- [ ] Footer de modais de devedores segue padrao responsivo (stack no mobile, inline no desktop).
- [ ] Historico de pagamentos quebra linha em textos longos sem cortar informacao.
- [ ] Typecheck/lint passes.
- [ ] Verify in browser using dev-browser skill.

## 6. Functional Requirements

- FR-1: Implementar calculo de badge de prazo com base em vencimento, saldo e data de quitacao.
- FR-2: Preservar `status` operacional (`Aberta`, `Parcial`, `Quitada`) como informacao separada.
- FR-3: Exibir `Valor Parcela` na tabela desktop e no card mobile para saldo parcelado.
- FR-4: Ajustar modal de pagamento para layout responsivo sem truncamento.
- FR-5: Padronizar rodape dos modais de devedores para mobile/desktop.

## 7. Non-Goals

- Nao alterar regras de negocio de calculo financeiro no backend.
- Nao alterar modelo de dados de `debts` e `debt_payments`.
- Nao substituir tabela por outro componente de listagem nesta iteracao.

## 8. Riscos e Trade-offs

- Sem campo explicito de data de quitacao no modelo, usa-se a ultima data de pagamento (ou `updatedAt`) como referencia de pontualidade.
- Aumento de colunas na tabela desktop exige `overflow-x` para manter legibilidade em telas menores.

## 9. Plano de Validacao

- Teste rapido com operadores:
  - identificar 1 devedor atrasado,
  - identificar 1 devedor em dia,
  - informar valor de parcela de um saldo parcelado,
  - registrar pagamento no modal sem perda de informacao.
- Criterio de sucesso: tarefas concluidas sem duvida sobre prazo e sem necessidade de ampliar zoom/rolagem horizontal no modal.

## 10. Metricas

- Reduzir erros de pagamento por valor/conta em registro manual.
- Reduzir tempo medio para classificar prioridade de cobranca.
- Aumentar assertividade na leitura de parcelamento em aberto.

