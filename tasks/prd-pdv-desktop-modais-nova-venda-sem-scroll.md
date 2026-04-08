# PRD: Otimizacao dos Modais de Nova Venda no PDV Desktop (Sem Scroll por Step)

## 0. Perguntas de Clarificacao (com respostas do usuario)

1. Qual e o objetivo principal da melhoria?
   A. Reduzir tempo de preenchimento por venda
   B. Eliminar scroll e aumentar legibilidade por step
   C. Reduzir erros de preenchimento/validacao
   D. Outro

Resposta: **B**.

2. Qual deve ser a estrategia quando um step tem muitos campos?
   A. Reorganizar em layout mais denso (sem remover campos)
   B. Quebrar em mais steps menores
   C. Manter steps atuais e usar areas colapsaveis
   D. Outro

Resposta: **A + C**.

3. Qual e a resolucao minima obrigatoria sem scroll?
   A. 1366x768
   B. 1440x900
   C. 1920x1080
   D. Outra

Resposta: **B (1440x900)**.

4. Escopo desta iteracao:
   A. So layout/hierarquia visual (sem mudar regra de negocio)
   B. Layout + microcopy + validacao inline
   C. Layout + reordenacao de campos + revisao dos steps
   D. Inclui novos campos/regras

Resposta: **A**.

5. Como sera medido o sucesso?
   A. 100% dos campos visiveis por step sem scroll na resolucao alvo
   B. Reducao do tempo medio de conclusao da venda
   C. Reducao da taxa de abandono
   D. Combinacao de metricas

Resposta: **A**.

## 1. Introduction/Overview

O fluxo de nova venda no PDV desktop possui steps e modais com densidade irregular de conteudo, o que causa necessidade de scroll para visualizar campos e informacoes importantes.
Isso aumenta carga cognitiva do operador no caixa e dificulta validacao visual rapida antes de concluir a venda.

Esta entrega define uma reorganizacao de layout e hierarquia visual para que, na resolucao minima de 1440x900, cada step de nova venda tenha suas informacoes essenciais completamente visiveis sem scroll.

## 2. Goals

- Eliminar scroll vertical nos steps da nova venda em desktop na resolucao 1440x900.
- Garantir visibilidade completa das informacoes e campos obrigatorios de cada step sem rolagem.
- Reorganizar o layout com maior densidade e uso de secoes colapsaveis apenas para conteudo secundario.
- Preservar 100% das regras de negocio, validacoes e campos existentes.
- Melhorar escaneabilidade visual para decisao rapida do operador.

## 3. User Stories

### US-001: Step 1 sem scroll no desktop
**Description:** Como operador de caixa, eu quero ver vendedor, cliente e comissao no mesmo viewport para preencher o inicio da venda sem rolagem.

**Acceptance Criteria:**
- [ ] Em viewport 1440x900, o step `Cliente/Vendedor` exibe todos os campos obrigatorios sem scroll.
- [ ] O bloco de comissao (quando vendedor selecionado) permanece visivel sem empurrar a tela para rolagem.
- [ ] Hierarquia visual deixa claro o fluxo: vendedor -> cliente -> comissao.
- [ ] Typecheck/lint passes.
- [ ] Verify in browser using dev-browser skill.

### US-002: Step 2 reorganizado com densidade + colapsavel
**Description:** Como operador de caixa, eu quero ver produto, troca e informacoes de apoio do step 2 sem scroll para validar a composicao da venda rapidamente.

**Acceptance Criteria:**
- [ ] Em viewport 1440x900, o step `Produto/Troca` nao requer scroll para campos e informacoes obrigatorias.
- [ ] Blocos secundarios podem ficar em secoes colapsaveis sem esconder campos obrigatorios.
- [ ] Nenhum campo existente e removido.
- [ ] Typecheck/lint passes.
- [ ] Verify in browser using dev-browser skill.

### US-003: Step 3 com conclusao visivel sem rolagem
**Description:** Como operador de caixa, eu quero visualizar checklist, pagamentos, restante e CTA final no mesmo contexto para fechar a venda com seguranca.

**Acceptance Criteria:**
- [ ] Em viewport 1440x900, o step `Pagamento` apresenta checklist, lista de pagamentos e bloco de conclusao sem scroll da area principal.
- [ ] O botao `Finalizar Venda` fica visivel sem necessidade de rolar.
- [ ] Mensagens de bloqueio de conclusao continuam visiveis e inalteradas em regra.
- [ ] Typecheck/lint passes.
- [ ] Verify in browser using dev-browser skill.

### US-004: Modal de cartao sem scroll interno no desktop alvo
**Description:** Como operador de caixa, eu quero visualizar os controles do modal de cartao e a tabela de parcelas sem rolagem para comparar opcoes com rapidez.

**Acceptance Criteria:**
- [ ] Em viewport 1440x900, o modal `Adicionar Cartao` nao usa scroll vertical interno para os elementos principais.
- [ ] A tabela de parcelas permanece legivel com hierarquia clara de colunas.
- [ ] Se houver secao colapsavel, ela e usada para conteudo secundario e nao para campos obrigatorios.
- [ ] Typecheck/lint passes.
- [ ] Verify in browser using dev-browser skill.

### US-005: Preservacao funcional com mudancas apenas de layout
**Description:** Como time de produto, eu quero garantir que esta entrega altere apenas layout/hierarquia para nao gerar regressao de negocio.

**Acceptance Criteria:**
- [ ] Regras de validacao de steps, pagamentos e conclusao permanecem iguais.
- [ ] Nenhum campo novo de negocio e introduzido.
- [ ] Nenhuma regra de calculo financeiro e alterada.
- [ ] Typecheck/lint passes.

## 4. Functional Requirements

- FR-1: O sistema deve aplicar layout desktop otimizado para nova venda com baseline minimo de viewport `1440x900`.
- FR-2: O sistema deve manter os 3 steps atuais (`Cliente/Vendedor`, `Produto/Troca`, `Pagamento`) sem criar novos steps nesta iteracao.
- FR-3: Em cada step, todos os campos obrigatorios e informacoes essenciais devem ficar visiveis sem scroll vertical.
- FR-4: O sistema deve permitir uso de secoes colapsaveis apenas para conteudo secundario/informativo.
- FR-5: O modal `Adicionar Cartao` deve ser reorganizado para visualizacao completa sem scroll vertical interno na resolucao alvo.
- FR-6: O sistema nao deve alterar validacoes de navegacao entre steps nem regras de conclusao da venda.
- FR-7: O sistema nao deve alterar calculos de pagamento, comissao, acrescimo de cartao ou persistencia de dados.
- FR-8: O comportamento responsivo fora de desktop alvo deve permanecer funcional, sem quebra de layout.

## 5. Non-Goals (Out of Scope)

- Nao incluir novos campos no fluxo de venda.
- Nao alterar regras de negocio de pagamento, garantia ou comissao.
- Nao criar novos steps no wizard de nova venda.
- Nao refatorar servicos de dados, persistencia ou telemetria.
- Nao redesenhar o fluxo pos-venda (impressao/comprovante) nesta entrega.

## 6. Design Considerations (UX)

### 6.1 Objetivo de UX e hipotese

- Objetivo de UX: maximizar legibilidade e controle do operador no desktop, eliminando scroll por step.
- Hipotese principal: **Se** reorganizarmos os steps com layout mais denso e blocos secundarios colapsaveis, **entao** o operador conseguira revisar todo o step sem rolagem, **medido por** 100% de campos visiveis em 1440x900.

### 6.2 Usuarios e contexto

- Usuario principal: operador de caixa em jornada transacional rapida.
- Contexto: atendimento presencial, alta repeticao de tarefas, necessidade de baixa latencia cognitiva.
- Restricao: resolucao minima obrigatoria de desktop 1440x900.

### 6.3 Jornada resumida

| Etapa | Objetivo do usuario | Acao | Friccao atual | Oportunidade |
|---|---|---|---|---|
| Entrada | Iniciar venda sem perder contexto | Selecionar vendedor e cliente | Blocos variam de altura e podem empurrar conteudo | Densificar topo e reduzir espacos verticais |
| Exploracao | Compor venda com item e troca | Selecionar produto e trade-in | Conteudo do step 2 tende a crescer | Ordenar por prioridade visual e colapsar detalhes secundarios |
| Decisao | Definir pagamentos | Abrir modais e escolher condicoes | Modal de cartao com rolagem interna | Rebalancear grid e altura util da tabela |
| Conclusao | Finalizar sem duvida | Revisar checklist e clicar CTA | Informacoes competem por espaco | Fixar hierarquia de fechamento e manter CTA sempre visivel |

### 6.4 Wireframe textual por tela

- Tela: Step 1 - Cliente/Vendedor
- Objetivo da tela: capturar contexto comercial inicial sem rolagem.
- Elementos principais (ordem de cima para baixo): titulo do step -> combobox vendedor/cliente em 2 colunas -> comissao compacta em linha unica.
- CTA primario: `Continuar`.
- CTA secundario: `Voltar etapa` (desabilitado no step 1).
- Feedback esperado apos acao: mensagens de erro inline e toast de bloqueio quando faltar vendedor.
- Estado vazio: sem vendedor/cliente selecionado.
- Estado de erro: highlight de campo + mensagem curta.
- Estado de carregamento: opcoes de combobox carregando.
- Evento de telemetria: `pdv_step_completed`.

- Tela: Step 2 - Produto/Troca
- Objetivo da tela: permitir selecao e validacao de produto/troca no mesmo viewport.
- Elementos principais (ordem de cima para baixo): bloco produto -> bloco troca -> observacao de cartao (secundaria, pode colapsar).
- CTA primario: `Continuar`.
- CTA secundario: `Voltar etapa`.
- Feedback esperado apos acao: confirmacao visual de item escolhido e bloqueio quando faltar produto.
- Estado vazio: sem estoque disponivel com CTA para estoque.
- Estado de erro: mensagem `Selecione um produto para continuar`.
- Estado de carregamento: busca de produto no combobox.
- Evento de telemetria: `pdv_step_completed`.

- Tela: Step 3 - Pagamento
- Objetivo da tela: concluir venda com checklist e resumo financeiro sem rolagem.
- Elementos principais (ordem de cima para baixo): checklist de conclusao -> grade de formas de pagamento -> lista de pagamentos -> restante + CTA finalizar.
- CTA primario: `Finalizar Venda`.
- CTA secundario: `Salvar rascunho` e `Voltar etapa`.
- Feedback esperado apos acao: estado claro de pendencia/pagamento completo.
- Estado vazio: nenhuma forma adicionada.
- Estado de erro: `Existe pagamento pendente`.
- Estado de carregamento: abertura de modal de pagamento.
- Evento de telemetria: `pdv_payment_added`.

- Tela: Modal `Adicionar Cartao`
- Objetivo da tela: escolher condicao de cartao com comparacao de parcelas sem scroll.
- Elementos principais (ordem de cima para baixo): valor/conta/bandeira em grid compacto -> tabela de parcelas otimizada -> footer com `Cancelar` e `Adicionar Cartao`.
- CTA primario: `Adicionar Cartao`.
- CTA secundario: `Cancelar`.
- Feedback esperado apos acao: parcela selecionada destacada.
- Estado vazio: valor liquido nao informado (mostrar tabela com zeros).
- Estado de erro: bloqueio de confirmacao com valor invalido.
- Estado de carregamento: recalculo de tabela ao trocar valor/bandeira.
- Evento de telemetria: `pdv_payment_added`.

### 6.5 Especificacao de interacao (acoes criticas)

- Gatilho do usuario: clicar em `Continuar` para mudar de step.
- Regra de negocio: validar obrigatorios ja existentes antes de avancar.
- Resposta da interface: manter no step atual quando houver erro.
- Mensagem de feedback: toast + erro inline no campo faltante.
- Condicao de bloqueio: vendedor ausente (step 1) ou cliente/produto ausentes (step 2).
- Alternativa de recuperacao: preencher campo indicado e tentar novamente.

- Gatilho do usuario: abrir modal `Adicionar Cartao`.
- Regra de negocio: valor liquido > 0 para confirmar.
- Resposta da interface: exibir configuracao compacta e tabela legivel sem rolagem.
- Mensagem de feedback: destacar opcao de parcela ativa.
- Condicao de bloqueio: valor invalido.
- Alternativa de recuperacao: corrigir valor e selecionar parcela.

## 7. Technical Considerations

- Pontos principais de implementacao:
  - `pages/PDV.tsx` (reorganizacao de grids, espacos, ordem e comportamento visual por step/modal).
  - `components/ui/Modal.tsx` (apenas se necessario para ajuste de altura/largura no desktop).
  - `index.css` (tokens utilitarios de altura/espacamento para viewport desktop).
- Manter o escopo visual:
  - Nao alterar assinaturas de funcoes de negocio.
  - Nao alterar payloads persistidos em vendas/pagamentos.
- Considerar restricoes de viewport:
  - Validar sem scroll em `1440x900` com zoom do navegador em 100%.
  - Preservar comportamento funcional em resolucoes maiores e menores.

## 8. Success Metrics

- 100% dos campos obrigatorios de cada step visiveis sem scroll em viewport 1440x900.
- 100% dos modais de pagamento da nova venda com informacoes principais visiveis sem scroll em 1440x900.
- 0 regressao de regra de negocio no fluxo de nova venda (validada por testes existentes).
- 0 regressao visual bloqueante no fluxo principal de venda em desktop.

## 9. Open Questions

- O criterio de "sem scroll" deve considerar apenas area do app (viewport interno) ou janela completa com barras do navegador/SO?
- Em telas com escala de sistema acima de 100%, o criterio de aceite continua obrigatorio sem scroll?
- Para a tabela de parcelas do cartao, devemos mostrar todas as 18 opcoes simultaneamente ou priorizar um recorte com expansao explicita sem scroll?

## 10. Plano Rapido de Validacao (UX)

- Objetivo: confirmar que operadores conseguem completar venda sem rolagem por step em desktop.
- Perfil de participantes: 3 a 5 operadores com uso frequente de PDV.
- Tarefas:
  - T1: preencher step 1 (vendedor, cliente, comissao) e avancar.
  - T2: selecionar produto e opcionalmente troca no step 2.
  - T3: adicionar pagamento em cartao e concluir venda no step 3.
- Criterio de sucesso por tarefa:
  - Nenhuma rolagem vertical durante execucao de cada step.
  - Operador identifica CTA de continuidade/conclusao sem hesitacao relevante.
- Sinais de friccao observaveis:
  - Procura visual longa por campo/CTA.
  - Dificuldade para comparar parcelas no modal de cartao.
- Decisao esperada ao final:
  - Aprovar release se 100% dos campos obrigatorios ficarem visiveis sem scroll em 1440x900.
