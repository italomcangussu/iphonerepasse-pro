# PRD: Correção do Botão de Excluir Categoria Financeira

## 1. Introduction/Overview

Corrigir o problema na tela de Configurações Financeiras em que o botão de excluir categoria não gera ação perceptível para o usuário.

## 2. Goals

- Garantir que o clique na lixeira execute um fluxo completo de remoção.
- Exibir feedback claro de sucesso e falha no processo de exclusão.
- Cobrir o comportamento com testes automatizados.

## 3. User Stories

### US-001: Fluxo de exclusão com confirmação
**Description:** As an admin, I want a reliable delete action for financial categories so that I can remove unnecessary categories safely.

**Acceptance Criteria:**
- [ ] Clicar na lixeira abre confirmação de remoção (fluxo síncrono com `window.confirm`).
- [ ] Confirmar remoção chama `removeFinancialCategory` com o ID correto.
- [ ] Categorias padrão não podem ser removidas.
- [ ] Typecheck passes.
- [ ] Verify in browser using dev-browser skill.

### US-002: Feedback explícito de sucesso e erro
**Description:** As an admin, I want immediate feedback after attempting deletion so I understand the operation result.

**Acceptance Criteria:**
- [ ] Em sucesso, mostrar toast de categoria removida.
- [ ] Em falha, mostrar toast de erro com mensagem adequada.
- [ ] Fluxo não falha silenciosamente.
- [ ] Typecheck passes.

### US-003: Regressão automatizada
**Description:** As an engineer, I want tests for delete interactions so regressions are detected before release.

**Acceptance Criteria:**
- [ ] Teste cobre confirmação e chamada de remoção.
- [ ] Teste cobre cenário de erro de remoção.
- [ ] Tests pass.
- [ ] Typecheck passes.

## 4. Functional Requirements

- FR-1: O botão de remover deve disparar handler dedicado com confirmação.
- FR-2: O handler deve aguardar `removeFinancialCategory` e tratar exceções.
- FR-3: O sistema deve mostrar toast de sucesso ao concluir exclusão.
- FR-4: O sistema deve mostrar toast de erro quando a exclusão falhar.

## 5. Non-Goals (Out of Scope)

- Alterar o layout visual do card de categorias.
- Refatorar todo o módulo financeiro.
- Criar endpoint novo para exclusão.

## 6. Technical Considerations

- Evitar chamada “fire-and-forget” para delete.
- Usar `type="button"` e labels nos ícones para previsibilidade e acessibilidade.
- Preferir confirmação nativa do navegador neste ponto para evitar travamento de promise de confirmação.

## 7. Success Metrics

- Admin consegue excluir categoria não padrão com retorno visual.
- Falhas de delete deixam de ser silenciosas.
- Testes de Settings cobrem fluxo de exclusão.

## 8. Open Questions

- Nenhuma questão pendente para esse escopo.
