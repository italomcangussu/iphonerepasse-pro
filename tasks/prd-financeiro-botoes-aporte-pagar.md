# PRD: Claridade de Fluxo nos Botoes Aporte e Pagar do Financeiro

## 1. Introducao

Este PRD define o comportamento esperado dos botoes de acao rapida na tela `Financeiro` para eliminar duplicidade de decisao no modal de movimentacao.

Problema atual: ao clicar em `Aporte` ou `Pagar`, o modal volta a exibir escolha de tipo (`Entrada` e `Saida`), criando ambiguidade de fluxo.

## 2. Goals

- Tornar o fluxo de movimentacao financeira direto e sem decisao repetida.
- Garantir consistencia entre CTA clicado e conteudo do modal aberto.
- Reduzir erro operacional causado por troca acidental de tipo dentro do modal.

## 3. User Stories

### US-001: Aporte abre modal de aporte sem seletor duplicado
**Description:** Como operador, quero clicar em `Aporte` e abrir um modal ja configurado como entrada para registrar rapidamente um aporte.

**Acceptance Criteria:**
- [ ] Ao clicar `Aporte`, o modal abre com titulo `Novo Aporte`.
- [ ] O botao primario do modal exibe `Confirmar Aporte`.
- [ ] O modal nao exibe abas de troca de tipo (`Entrada` e `Saida`).
- [ ] Typecheck/lint passes.
- [ ] Verify in browser using dev-browser skill.

### US-002: Pagar abre modal de pagamento sem seletor duplicado
**Description:** Como operador, quero clicar em `Pagar` e abrir um modal ja configurado como saida para registrar pagamento sem ambiguidades.

**Acceptance Criteria:**
- [ ] Ao clicar `Pagar`, o modal abre com titulo `Novo Pagamento`.
- [ ] O botao primario do modal exibe `Confirmar Pagamento`.
- [ ] O modal nao exibe abas de troca de tipo (`Entrada` e `Saida`).
- [ ] Typecheck/lint passes.
- [ ] Verify in browser using dev-browser skill.

## 4. Functional Requirements

- FR-1: O botao verde deve permanecer como `Aporte`.
- FR-2: O botao vermelho deve exibir `Pagar`.
- FR-3: O clique no CTA deve definir o tipo da transacao antes de abrir o modal.
- FR-4: O modal nao deve reexibir controle de escolha de tipo.
- FR-5: O titulo e CTA do modal devem refletir o tipo selecionado no clique.

## 5. Non-Goals (Out of Scope)

- Nao alterar o modelo de dados de `Transaction`.
- Nao alterar categorias financeiras existentes no backend.
- Nao alterar layout geral das abas de `Financeiro`.

## 6. Technical Considerations

- Arquivo principal: `pages/Finance.tsx`.
- Cobertura de regressao: `pages/Finance.test.tsx`.

## 7. Success Metrics

- 0 ocorrencias de exibicao simultanea de fluxo rapido e seletor de tipo no modal.
- Reducao de duvidas operacionais reportadas no fluxo de movimentacao.

## 8. Open Questions

- O label interno de categoria para saida deve permanecer `Retirada` ou migrar para um termo alinhado ao CTA `Pagar`?

