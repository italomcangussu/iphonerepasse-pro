# PRD: Correcao de Filtro de Estoque, Step 3 de Cadastro e Exclusao de Vendedores

## 1. Introducao

Este PRD define tres correcoes pontuais de UX e operacao no app:

1. Renomear o filtro "Loja" para "Geral" na tela de Estoque.
2. Remover os botoes de status inicial no step 3 de "Adicionar Aparelho", mantendo apenas o banner de confirmacao apos salvar.
3. Permitir exclusao de vendedor na tela de Vendedores, alem da edicao ja existente.

O objetivo e reduzir duplicidade de escolhas, melhorar clareza de navegacao e ampliar controle administrativo sobre cadastro de vendedores.

## 2. Goals

- Tornar o filtro principal do Estoque mais claro para o contexto de visao agregada.
- Eliminar duplicidade de decisao sobre status inicial no fluxo de cadastro de aparelho.
- Habilitar ciclo completo de manutencao de vendedores (editar e excluir) na mesma area administrativa.
- Garantir que as mudancas sejam verificaveis por testes e validacao visual.

## 3. User Stories

### US-001: Renomear filtro principal de estoque
**Description:** Como operador, eu quero ver o filtro principal como "Geral" para entender que ele representa visao ampla e nao uma loja especifica.

**Acceptance Criteria:**
- [ ] Na tela de Estoque, a opcao de filtro com id `all` exibe o rotulo `Geral` em vez de `Loja`.
- [ ] A mudanca de texto nao altera a logica de filtragem existente.
- [ ] Labels derivados de chips/filtros continuam coerentes com o estado aplicado.
- [ ] Typecheck/lint passes.
- [ ] Verify in browser using dev-browser skill.

### US-002: Remover escolha de status inicial no step 3 de adicionar aparelho
**Description:** Como operador, eu quero concluir o cadastro sem escolher status duas vezes para evitar redundancia e conflito de decisao.

**Acceptance Criteria:**
- [ ] No step 3 de "Adicionar Aparelho", a secao com botoes de status inicial (`Disponivel para Venda` e `Em Preparacao`) nao e mais exibida.
- [ ] O banner de confirmacao apos salvar continua sendo o unico ponto para decidir o destino/status final.
- [ ] O salvamento do aparelho permanece funcional e sem regressao de validacao obrigatoria.
- [ ] Typecheck/lint passes.
- [ ] Verify in browser using dev-browser skill.

### US-003: Excluir vendedor na tela de vendedores
**Description:** Como admin/gerente, eu quero excluir vendedor diretamente da listagem para remover cadastros inativos ou criados por engano.

**Acceptance Criteria:**
- [ ] Cada vendedor na tela de Vendedores possui acao de excluir, alem da acao de editar.
- [ ] A exclusao exige confirmacao explicita antes de executar.
- [ ] Ao excluir com sucesso, o vendedor some da listagem sem necessidade de recarregar manualmente.
- [ ] Em caso de erro na exclusao, exibir mensagem de erro consistente com o padrao de toasts existente.
- [ ] Typecheck/lint passes.
- [ ] Verify in browser using dev-browser skill.

## 4. Functional Requirements

- FR-1: O sistema deve trocar o label do filtro global da tela de Estoque de `Loja` para `Geral`.
- FR-2: A mudanca de label do filtro nao deve alterar ids, estados internos ou regras de consulta de dados.
- FR-3: O step 3 do modal/formulario de cadastro de aparelho nao deve renderizar controles de `Status Inicial`.
- FR-4: O fluxo de definicao de status apos salvar deve permanecer ativo e funcional via banner ja existente.
- FR-5: A tela de Vendedores deve expor acao de exclusao por item/lista.
- FR-6: A exclusao de vendedor deve ter etapa de confirmacao antes da remocao definitiva.
- FR-7: A exclusao deve atualizar estado local/listagem com feedback de sucesso ou erro ao usuario.

## 5. Non-Goals (Out of Scope)

- Nao alterar regras de permissao/RBAC alem do necessario para a acao de exclusao de vendedor.
- Nao redesenhar layout completo da tela de Estoque ou Vendedores.
- Nao alterar semantica de status de estoque no backend.
- Nao incluir exclusao em massa de vendedores nesta entrega.

## 6. Design Considerations

- Reutilizar padrao visual de acoes existente na listagem de vendedores para manter consistencia.
- A acao de excluir deve ter destaque de risco (ex.: estilo destrutivo) sem competir com CTA principal de editar.
- Remocao dos botoes de status no step 3 deve preservar espacos/fluxo sem gerar area vazia estranha.

## 7. Technical Considerations

- Arquivos com alta probabilidade de alteracao:
  - `pages/Inventory.tsx`
  - `components/StockFormModal.tsx`
  - `pages/Sellers.tsx`
- Avaliar impacto em testes existentes de inventario e adicionar/ajustar testes da tela de vendedores, se necessario.
- Garantir compatibilidade com toasts e handlers assinc nos fluxos de exclusao.

## 8. Success Metrics

- 100% dos ambientes internos exibem `Geral` no filtro global de Estoque.
- 0 ocorrencias de escolha duplicada de status no step 3 apos deploy.
- Operadores conseguem excluir vendedor em ate 2 interacoes apos clicar na acao (abrir confirmacao + confirmar).
- Nenhuma regressao funcional nos fluxos de cadastro de aparelho e edicao de vendedores.

## 9. Open Questions

- A exclusao de vendedor deve ser hard delete ou soft delete (inativo), considerando historico de vendas vinculado?
- Em caso de vendedor com usuario de acesso vinculado, a exclusao deve bloquear, desativar acesso ou remover ambos?
- A acao de excluir deve ser permitida para todos os perfis que hoje conseguem editar vendedor ou apenas admin?
