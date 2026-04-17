# PRD: Correcao do Modal de Categorias Financeiras no Settings

## Perguntas de Clarificacao

1. Qual e o objetivo principal desta correcao?
   A. Fazer o modal de categoria abrir/fechar corretamente para criar/editar categoria.
   B. Redesenhar toda a secao financeira do Settings.
   C. Alterar regras contabeis de categorias.
   D. Outro.
   Resposta adotada: A

2. Qual e o escopo desta entrega?
   A. Corrigir apenas o comportamento de abertura/fechamento do modal.
   B. Corrigir modal e adicionar cobertura minima de validacao tecnica.
   C. Reescrever toda a pagina de Settings.
   D. Apenas documentacao.
   Resposta adotada: B

3. O que fica fora de escopo nesta iteracao?
   A. Mudar schema do banco.
   B. Mudar fluxo de cadastro/edicao/remocao de categorias alem do bug do modal.
   C. Mudar design visual completo.
   D. Todas as anteriores.
   Resposta adotada: D

4. Como validar sucesso?
   A. Clique em Nova Categoria abre modal.
   B. Clique em editar categoria abre modal com dados da categoria.
   C. Fechar/cancelar limpa estado sem travar tela.
   D. Typecheck e testes passam.
   Resposta adotada: A, B, C e D

## 1. Introduction/Overview

A tela de Settings > Financeiro possui um modal para criar/editar categorias financeiras. O modal estava com contrato de props incorreto, impedindo o comportamento esperado de abertura/fechamento no fluxo de alteracao de categorias. Esta entrega corrige a integracao com o componente de modal padrao e valida regressao tecnica.

## 2. Goals

- Garantir que o modal de categoria financeira abra ao clicar em "Nova Categoria".
- Garantir que o modal abra em modo de edicao ao clicar no icone de editar.
- Garantir fechamento consistente com limpeza de estado local.
- Manter build/typecheck sem regressao.

## 3. User Stories

### US-001: Corrigir contrato de abertura do modal de categorias
**Description:** Como operador admin, quero abrir o modal de categoria financeira ao clicar em criar ou editar para concluir a alteracao sem bloqueio de interface.

**Acceptance Criteria:**
- [ ] O componente `Modal` em `Settings.tsx` recebe a prop `open` (nao `isOpen`).
- [ ] Clicar em `Nova Categoria` abre o modal `Nova Categoria Financeira`.
- [ ] Clicar no icone de editar em uma categoria abre o modal `Editar Categoria Financeira`.
- [ ] Clicar em cancelar ou fechar encerra o modal e reseta `isAddingCategory`, `editingCategory` e `newCategory`.
- [ ] Typecheck passes
- [ ] Verify in browser using dev-browser skill

### US-002: Validar regressao tecnica do fluxo
**Description:** Como time de engenharia, quero validacao tecnica da correcao para evitar reintroducao do bug de abertura do modal.

**Acceptance Criteria:**
- [ ] `npm run typecheck` executa sem erros.
- [ ] Teste unitario do componente base de modal passa (`components/ui/Modal.test.tsx`).
- [ ] Tests pass
- [ ] Typecheck passes

## 4. Functional Requirements

- FR-1: O modal de categorias financeiras deve usar a API publica do componente base `Modal` com prop `open`.
- FR-2: O estado de abertura deve ser verdadeiro quando `isAddingCategory` for true ou `editingCategory` tiver valor.
- FR-3: O estado de fechamento deve limpar todos os estados temporarios do fluxo de categoria.
- FR-4: O comportamento de criar e editar categoria deve permanecer inalterado fora da correcao de abertura/fechamento.
- FR-5: A entrega deve manter validacao tecnica via typecheck e teste relacionado ao modal base.

## 5. Non-Goals (Out of Scope)

- Nao alterar tabela `finance_categories` no banco.
- Nao alterar regras de permissao/admin da aba Financeiro.
- Nao alterar layout global da pagina de Settings.
- Nao alterar fluxo de remocao de categorias.

## 6. Design Considerations

- Reusar o mesmo componente `Modal` ja adotado no app.
- Manter linguagem visual e estrutura atual da aba Financeiro.

## 7. Technical Considerations

- Arquivo principal: `pages/Settings.tsx`.
- Componente base envolvido: `components/ui/Modal.tsx`.
- A API do `Modal` e tipada em TypeScript e espera `open: boolean`.

## 8. Success Metrics

- 100% dos cliques em `Nova Categoria` abrem o modal em ambiente local.
- 100% dos cliques em editar categoria abrem o modal em ambiente local.
- Zero erros de compilacao TypeScript apos a correcao.

## 9. Open Questions

- Devemos adicionar teste dedicado de `Settings` cobrindo esse fluxo, alem do typecheck?
- Deseja incluir teste E2E de regressao para a aba Financeiro no pipeline smoke?
