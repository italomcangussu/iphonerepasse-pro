# PRD: Correção de Persistência de Chip e Ordenação de Aparelhos

## 1. Introduction/Overview

Corrigir dois problemas no fluxo de estoque:
1. Ao alterar o tipo de chip (físico, virtual ou ambos), o valor é atualizado apenas localmente e não persiste no backend.
2. A listagem de aparelhos no estoque deve exibir os modelos do maior para o menor.

## 2. Goals

- Persistir o tipo de chip (`simType`) de ponta a ponta (UI, camada de dados e banco).
- Garantir que o tipo de chip seja mantido após recarregar a aplicação.
- Exibir aparelhos ordenados por modelo do mais novo/maior para o mais antigo/menor.
- Cobrir a ordenação com teste automatizado.

## 3. User Stories

### US-001: Persistir tipo de chip no banco
**Description:** As a seller, I want the selected chip type to be saved in the database so that it remains correct after refresh and across devices.

**Acceptance Criteria:**
- [ ] Adicionar coluna `sim_type` em `public.stock_items` via migration.
- [ ] O insert de item de estoque envia `sim_type`.
- [ ] O update de item de estoque envia `sim_type`.
- [ ] O carregamento de itens mapeia `sim_type` para `simType`.
- [ ] Typecheck passes.

### US-002: Salvar tipo de chip no modal de estoque
**Description:** As a seller, I want the chip selector in the stock modal to be part of the save payload so that backend and UI stay in sync.

**Acceptance Criteria:**
- [ ] `StockFormModal` inclui `simType` no payload salvo.
- [ ] Novo item usa valor padrão consistente quando o usuário não altera o seletor.
- [ ] Edição de item mantém o valor selecionado.
- [ ] Typecheck passes.
- [ ] Verify in browser using dev-browser skill.

### US-003: Ordenar aparelhos por modelo (maior para menor)
**Description:** As a user, I want to see devices ordered from higher/newer model to lower/older model so that I can scan inventory faster.

**Acceptance Criteria:**
- [ ] Lista filtrada em `Inventory` aplica ordenação por modelo em ordem decrescente.
- [ ] Comparação trata números no nome do modelo de forma natural (ex.: 16 > 15 > 14).
- [ ] Empate usa critério secundário estável.
- [ ] Typecheck passes.
- [ ] Verify in browser using dev-browser skill.

### US-004: Regressão automatizada da ordenação
**Description:** As an engineer, I want automated tests for model ordering so that future changes do not break list order.

**Acceptance Criteria:**
- [ ] Adicionar teste em `pages/Inventory.test.tsx` validando ordem 16 > 15 > 14.
- [ ] Tests pass.
- [ ] Typecheck passes.

## 4. Functional Requirements

- FR-1: O sistema deve armazenar o tipo de chip em `stock_items.sim_type`.
- FR-2: O sistema deve incluir `simType` no payload de criação e edição de aparelho.
- FR-3: O sistema deve mapear `sim_type` do backend para `simType` no frontend.
- FR-4: A tela de estoque deve ordenar os aparelhos por modelo em ordem decrescente.
- FR-5: A ordenação deve considerar comparação numérica natural para nomes com dígitos.

## 5. Non-Goals (Out of Scope)

- Refatorar o layout do modal de estoque.
- Alterar regras de negócio de preços, garantias ou custos.
- Reordenar outras telas fora de Inventory.

## 6. Design Considerations

- Manter o seletor de chip atual (Physical/Virtual/Both), sem mudanças visuais extensas.

## 7. Technical Considerations

- Migration deve ser idempotente (`add column if not exists`).
- A ordenação deve ser feita após filtros para evitar inconsistências visuais.

## 8. Success Metrics

- Tipo de chip permanece correto após salvar e recarregar.
- Lista de Inventory exibe modelos em ordem decrescente de forma consistente.
- Testes automatizados da ordenação passam localmente.

## 9. Open Questions

- Nenhuma questão em aberto para este escopo.
