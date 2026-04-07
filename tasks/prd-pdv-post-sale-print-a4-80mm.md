# PRD: Impressao Pos-Venda no PDV com Seletor de Layout (80mm e A4)

## 0. Perguntas de Clarificacao (com respostas assumidas)

1. Qual deve ser o comportamento ao clicar em "Imprimir Comprovante" apos finalizar a venda?
   A. Abrir modal para escolher formato (80mm ou A4) antes de imprimir.
   B. Imprimir direto em 80mm sem perguntar.
   C. Imprimir direto em A4 sem perguntar.
   D. Outro.

Resposta assumida: **A**.

2. Qual formato deve ser priorizado por padrao na escolha?
   A. 80mm (cupom termico).
   B. A4.
   C. Lembrar ultimo formato usado por navegador.
   D. Outro.

Resposta assumida: **A**.

3. O que deve conter no layout A4 alem do conteudo basico do cupom?
   A. Identificacao completa da venda, secoes estruturadas, cliente/vendedor e resumo financeiro detalhado.
   B. Mesmo conteudo do cupom sem reorganizacao.
   C. Apenas cabecalho e total.
   D. Outro.

Resposta assumida: **A**.

4. Como tratar venda sem garantia do app no comprovante?
   A. Nao exibir bloco de garantia de 90 dias e mostrar mensagem neutra de ausencia de garantia do app no layout formal.
   B. Exibir garantia de 90 dias mesmo sem vigencia.
   C. Exibir sempre texto fixo de garantia Apple.
   D. Outro.

Resposta assumida: **A**.

## 1. Introducao

O fluxo de impressao pos-venda no PDV possui um unico template e nao diferencia contexto de impressora termica (80mm) versus impressao formal em A4/PDF. Alem disso, o fluxo nao oferece decisao explicita de formato no momento da acao.

Esta entrega adiciona um modal de escolha de layout e dois templates dedicados para melhorar legibilidade, reduzir erros operacionais e padronizar emissao de comprovantes.

## 2. Goals

- Permitir que o operador escolha o formato de impressao apos a venda concluida.
- Entregar layout otimizado para impressora termica 80mm.
- Entregar layout otimizado para A4/PDF com informacoes estruturadas.
- Evitar regressao no fluxo atual de finalizar venda e iniciar nova venda.
- Garantir conteudo correto de garantia conforme regra existente da venda.

## 3. User Stories

### US-001: Escolha de formato antes da impressao
**Description:** Como operador de caixa, eu quero escolher entre 80mm e A4 antes de imprimir para usar o comprovante adequado ao equipamento e contexto.

**Acceptance Criteria:**
- [ ] Ao clicar em "Imprimir Comprovante", o sistema abre modal de escolha de formato.
- [ ] O modal exibe opcoes 80mm e A4 com descricao de uso.
- [ ] O usuario pode cancelar sem imprimir.
- [ ] O usuario confirma e a impressao e disparada com o formato selecionado.
- [ ] Typecheck/lint passes.
- [ ] Verify in browser using dev-browser skill.

### US-002: Layout 80mm para impressora termica
**Description:** Como operador de loja, eu quero um layout compacto de cupom em 80mm para leitura rapida e impressao termica sem truncamentos.

**Acceptance Criteria:**
- [ ] Layout 80mm exibe cabecalho da loja, identificacao da venda e data/hora.
- [ ] Lista de itens, trade-in (quando houver), total liquido e formas de pagamento sao exibidos de forma compacta.
- [ ] Bloco de garantia so aparece quando `warrantyExpiresAt` existir.
- [ ] O layout mantem largura de cupom e nao tenta renderizacao em estrutura A4.
- [ ] Typecheck/lint passes.
- [ ] Verify in browser using dev-browser skill.

### US-003: Layout A4 para PDF e comprovante formal
**Description:** Como administrativo, eu quero um layout A4 estruturado para arquivamento e compartilhamento em PDF.

**Acceptance Criteria:**
- [ ] Layout A4 possui cabecalho com dados da loja, numero da venda e data/hora.
- [ ] Exibe secoes de cliente, vendedor, itens e resumo financeiro.
- [ ] Exibe breakdown de pagamentos e total pago pelo cliente.
- [ ] Trata venda sem garantia com texto apropriado, sem falso positivo de 90 dias.
- [ ] Typecheck/lint passes.
- [ ] Verify in browser using dev-browser skill.

### US-004: Robustez de impressao no app
**Description:** Como time de produto, queremos garantir que o fluxo de impressao nao dependa de hacks que escondam toda a aplicacao e inviabilizem templates de impressao.

**Acceptance Criteria:**
- [ ] CSS de impressao permite renderizar os templates de comprovante corretamente.
- [ ] O sistema exibe apenas o layout selecionado durante a impressao.
- [ ] Componentes de tela (acoes/animacoes) nao aparecem no PDF.
- [ ] Typecheck/lint passes.
- [ ] Verify in browser using dev-browser skill.

### US-005: Cobertura minima automatizada
**Description:** Como engenharia, eu quero teste automatizado do modal de formato para reduzir regressao no fluxo pos-venda.

**Acceptance Criteria:**
- [ ] Teste valida abertura do modal de formato apos venda concluida.
- [ ] Teste valida selecao de A4 e disparo da impressao.
- [ ] Testes existentes do PDV continuam verdes.
- [ ] Typecheck/lint passes.

## 4. Functional Requirements

- FR-1: O botao "Imprimir Comprovante" deve abrir um modal de escolha de formato.
- FR-2: O modal deve oferecer opcoes `80mm` e `A4` com descricao de contexto de uso.
- FR-3: O sistema deve imprimir apenas o template correspondente ao formato escolhido.
- FR-4: O template 80mm deve ser compacto e otimizado para cupom termico.
- FR-5: O template A4 deve apresentar estrutura detalhada para uso administrativo/PDF.
- FR-6: O conteudo de garantia deve respeitar `warrantyExpiresAt` da venda.
- FR-7: Elementos de interface de tela (botoes, celebracao, navegacao) nao devem aparecer no resultado impresso.

## 5. Non-Goals

- Nao implementar editor visual de templates.
- Nao adicionar novos formatos alem de 80mm e A4 nesta iteracao.
- Nao alterar regras de negocio financeiras da venda.
- Nao alterar o fluxo de garantia alem da exibicao no comprovante.

## 6. Design Considerations

- Priorizar decisao explicita de formato antes da impressao.
- Usar microcopy clara para reduzir erro de escolha no caixa.
- Em 80mm, priorizar legibilidade com hierarquia curta e objetiva.
- Em A4, priorizar escaneabilidade por secoes (cabecalho, itens, pagamentos, totais).

## 7. Technical Considerations

- Implementacao principal em `pages/PDV.tsx`.
- Ajustes de print CSS globais em `index.css`.
- Testes em `pages/PDV.test.tsx`.
- Uso de `window.print()` com controle de layout via atributo no `body` durante o evento de impressao.

## 8. Success Metrics

- 100% dos operadores conseguem escolher formato antes da impressao no fluxo pos-venda.
- Reducao de reimpressao por formato incorreto (indicador qualitativo em operacao).
- Zero regressao no fluxo de finalizacao de venda e inicio de nova venda.
- Testes do PDV cobrindo o modal de formato e passando localmente.

## 9. Open Questions

- Vale persistir o ultimo formato escolhido por usuario/dispositivo em iteracao futura?
- Precisamos incluir assinatura fisica no layout A4 para cenarios juridicos?
- Deve haver configuracao por loja para habilitar/desabilitar um dos formatos?
