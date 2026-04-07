# PRD: Garantias Avulsas + Edicao e Remocao na Tela de Garantias

## 0. Perguntas de Clarificacao (com respostas assumidas)

1. Como deve funcionar a criacao de garantia avulsa?
   A. Permitir cadastrar garantia sem passar pelo PDV, gerando registro completo na base.
   B. Apenas criar anotacao visual sem persistencia.
   C. Redirecionar obrigatoriamente para PDV.
   D. Outro.

Resposta assumida: **A**.

2. O que significa "apagar garantia"?
   A. Remover apenas a garantia do app (warranty_expires_at = null), sem apagar a venda.
   B. Excluir venda inteira e todos os registros vinculados.
   C. Apenas ocultar no frontend.
   D. Outro.

Resposta assumida: **A**.

3. Ao clicar no card de garantia, qual acao principal?
   A. Abrir menu/modal de gerenciamento com: ver certificado, editar, apagar.
   B. Abrir certificado direto.
   C. Abrir edicao direto.
   D. Outro.

Resposta assumida: **A**.

4. Quais campos devem ser editaveis?
   A. Dados do cliente, dados do aparelho principal da garantia e tempo de garantia.
   B. Apenas cliente.
   C. Apenas aparelho.
   D. Outro.

Resposta assumida: **A**.

## 1. Introducao

A pagina de Garantias atualmente permite consulta e emissao de certificado/QR, mas nao permite criar garantias avulsas fora do PDV nem gerenciar garantias existentes com edicao/remocao.

Esta entrega adiciona fluxo de criacao manual e gerenciamento por card para aumentar flexibilidade operacional no pos-venda.

## 2. Goals

- Adicionar botao para criar garantia avulsa sem fluxo PDV.
- Permitir acionar gerenciamento ao clicar no card de garantia.
- Permitir edicao de cliente, aparelho e tempo de garantia.
- Permitir apagar garantia sem comprometer historico de venda.

## 3. User Stories

### US-001: Cadastrar garantia avulsa
**Description:** Como operador, quero adicionar uma garantia manualmente para registrar atendimentos pos-venda que nao passaram no PDV.

**Acceptance Criteria:**
- [ ] Existe botao "Adicionar garantia" na tela.
- [ ] Modal de cadastro coleta dados minimos de cliente, aparelho e tempo de garantia.
- [ ] Persistencia cria registro valido exibido na listagem.
- [ ] Typecheck/lint passes.
- [ ] Verify in browser using dev-browser skill.

### US-002: Gerenciar garantia ao clicar no card
**Description:** Como operador, quero clicar no card da garantia para abrir opcoes de gestao sem procurar botoes dispersos.

**Acceptance Criteria:**
- [ ] Clique no card abre modal de gerenciamento.
- [ ] Modal oferece no minimo: Ver certificado, Editar garantia, Apagar garantia.
- [ ] Typecheck/lint passes.
- [ ] Verify in browser using dev-browser skill.

### US-003: Editar garantia
**Description:** Como operador, quero editar dados do cliente, aparelho e tempo de garantia para corrigir cadastro.

**Acceptance Criteria:**
- [ ] Edicao atualiza cliente vinculado.
- [ ] Edicao atualiza aparelho principal vinculado na garantia.
- [ ] Edicao atualiza tempo/prazo de garantia no registro da venda.
- [ ] Typecheck/lint passes.
- [ ] Verify in browser using dev-browser skill.

### US-004: Apagar garantia
**Description:** Como operador, quero apagar garantia indevida sem perder historico financeiro da venda.

**Acceptance Criteria:**
- [ ] Acao de apagar exige confirmacao.
- [ ] Ao confirmar, o prazo de garantia do app e removido do registro.
- [ ] Garantia deixa de aparecer na listagem de garantias ativas/expiradas.
- [ ] Typecheck/lint passes.
- [ ] Verify in browser using dev-browser skill.

## 4. Functional Requirements

- FR-1: Exibir CTA "Adicionar garantia" no cabecalho da pagina.
- FR-2: Permitir cadastro de garantia avulsa com persistencia no backend.
- FR-3: Clique no card deve abrir modal de gerenciamento.
- FR-4: Fluxo de edicao deve atualizar cliente + aparelho + tempo de garantia.
- FR-5: Fluxo de apagar deve remover garantia do app sem excluir venda.
- FR-6: Fluxos devem atualizar listagem sem necessidade de recarregar a pagina.

## 5. Non-Goals

- Nao alterar logica de QR/link publico alem do necessario para compatibilidade.
- Nao refatorar arquitetura completa do modulo de vendas.
- Nao alterar regras financeiras de PDV nesta iteracao.

## 6. Design Considerations

- Reduzir friccao operacional: acao por card com opcoes claras.
- Priorizar seguranca operacional na remocao (confirmacao explicita).
- Manter consistencia com componentes de modal existentes.

## 7. Technical Considerations

- Implementacao principal em `pages/Warranties.tsx`.
- Reuso de `dataContext` para update de cliente/aparelho e refresh global.
- Atualizacao de garantia (warranty_expires_at) via `supabase` na tabela `sales`.

## 8. Success Metrics

- Tempo para cadastrar garantia manual reduzido para fluxo unico de modal.
- Erros de cadastro corrigiveis sem sair da tela de garantias.
- Remocao de garantias indevidas sem impacto em vendas historicas.

## 9. Open Questions

- Deve existir permissao de papel (admin/seller) para apagar garantia?
- Em iteracao futura, vale historico/auditoria de alteracoes de garantia?
