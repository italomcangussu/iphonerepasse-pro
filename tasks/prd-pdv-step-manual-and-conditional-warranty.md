# PRD: Correcao do Fluxo de Venda no PDV (Steps Manuais + Garantia Condicional)

## 0. Perguntas de Clarificacao (com respostas assumidas)

1. Qual deve ser a regra de garantia para aparelho `Novo`?
   A. Nao gerar garantia no app e nao emitir certificado no fluxo interno.
   B. Gerar garantia de 90 dias no app.
   C. Gerar garantia customizada por configuracao.
   D. Outro.

Resposta assumida: **A**.

2. Qual regra permanece para aparelho `Seminovo`?
   A. Manter garantia de 90 dias no app.
   B. Nao gerar garantia no app.
   C. Garantia variavel por loja.
   D. Outro.

Resposta assumida: **A**.

3. Sobre navegacao dos steps do PDV, qual comportamento esperado?
   A. Nao avancar automaticamente; avancar apenas por acao explicita do usuario.
   B. Manter autoavanco em alguns campos.
   C. Autoavanco opcional por configuracao.
   D. Outro.

Resposta assumida: **A**.

4. Ao nao haver garantia no app (aparelho novo), o que mostrar no comprovante interno?
   A. Remover bloco "Garantia de 90 dias" e vencimento.
   B. Mostrar texto "Garantia Apple".
   C. Manter bloco atual mesmo sem validade no app.
   D. Outro.

Resposta assumida: **A**.

## 1. Introducao

O fluxo atual de venda no PDV apresenta dois problemas:

- Os steps avancam automaticamente em alguns momentos (ex.: apos selecionar vendedor/cliente e apos selecionar produto), gerando comportamento inesperado para o operador.
- A garantia de 90 dias do app e gerada tambem para aparelhos `Novo`, mesmo quando a regra de negocio informa que esses aparelhos devem seguir garantia Apple e nao precisam de emissao de garantia no app.

Este PRD define ajustes para tornar a navegacao 100% manual e aplicar garantia condicional por condicao do aparelho.

## 2. Goals

- Eliminar autoavanco dos steps no PDV.
- Garantir que a navegacao avance apenas por acao explicita do usuario.
- Impedir emissao de garantia do app para aparelhos `Novo`.
- Manter garantia de 90 dias no app para aparelhos `Seminovo`.
- Evitar regressao nas telas de comprovante e listagem de garantias.

## 3. User Stories

### US-001: Navegacao manual entre steps
**Description:** Como operador de caixa, eu quero que os steps do PDV avancem somente quando eu clicar em avancar/step, para manter controle do processo.

**Acceptance Criteria:**
- [ ] Selecionar vendedor e cliente nao muda automaticamente do step 1 para o step 2.
- [ ] Selecionar produto nao muda automaticamente do step 2 para o step 3.
- [ ] O usuario so avanca ao clicar em "Proximo" ou no step superior permitido.
- [ ] Typecheck/lint passes.
- [ ] Verify in browser using dev-browser skill.

### US-002: Validacoes de navegacao preservadas com avanco manual
**Description:** Como operador de caixa, eu quero receber validacoes claras ao tentar avancar sem os dados minimos, para nao concluir venda incompleta.

**Acceptance Criteria:**
- [ ] Ao tentar ir para step de pagamento sem cliente e produto, o sistema bloqueia e mostra feedback.
- [ ] Ao tentar finalizar com pagamento pendente, o sistema bloqueia e mostra feedback.
- [ ] Nenhuma validacao funcional existente de fechamento de venda e removida.
- [ ] Typecheck/lint passes.
- [ ] Verify in browser using dev-browser skill.

### US-003: Garantia condicional por condicao do aparelho
**Description:** Como operador de caixa, eu quero que apenas aparelhos seminovos recebam garantia do app, para respeitar a regra comercial.

**Acceptance Criteria:**
- [ ] Se item vendido estiver com `condition = Seminovo`, `warrantyExpiresAt` e definido com +3 meses da data da venda.
- [ ] Se item vendido estiver com `condition = Novo`, `warrantyExpiresAt` fica `null` (ou equivalente sem garantia no app).
- [ ] Para `Novo`, o comprovante interno nao mostra bloco de "Garantia de 90 dias".
- [ ] Typecheck/lint passes.
- [ ] Verify in browser using dev-browser skill.

### US-004: Compatibilidade das telas de garantia com venda sem garantia do app
**Description:** Como usuario administrativo, eu quero que as telas de garantia tratem vendas sem garantia do app sem erro, para manter confiabilidade operacional.

**Acceptance Criteria:**
- [ ] A tela de garantias nao quebra ao encontrar venda com `warrantyExpiresAt` vazio/nulo.
- [ ] Vendas sem garantia do app podem ser ocultadas da listagem principal de garantias.
- [ ] Fluxos de link/QR de garantia nao devem ser ofertados para vendas sem garantia do app.
- [ ] Typecheck/lint passes.
- [ ] Verify in browser using dev-browser skill.

### US-005: Cobertura de testes para os dois bugs
**Description:** Como time de produto, eu quero testes automatizados cobrindo navegacao manual e garantia condicional, para evitar regressao.

**Acceptance Criteria:**
- [ ] Teste valida que selecionar vendedor/cliente/produto nao autoavanca step.
- [ ] Teste valida garantia `null` para `Novo` e +3 meses para `Seminovo`.
- [ ] Testes existentes do PDV e garantias continuam passando apos os ajustes.
- [ ] Typecheck/lint passes.

## 4. Functional Requirements

- FR-1: O sistema nao deve avancar automaticamente de step em nenhuma selecao de campo do PDV.
- FR-2: O avanco de step deve ocorrer somente por acao explicita do usuario (botao ou click em step permitido).
- FR-3: O sistema deve manter bloqueios de navegacao quando dados obrigatorios nao estiverem preenchidos.
- FR-4: Ao finalizar venda com item `Seminovo`, o sistema deve persistir `warrantyExpiresAt = data_venda + 3 meses`.
- FR-5: Ao finalizar venda com item `Novo`, o sistema deve persistir `warrantyExpiresAt = null` (sem garantia do app).
- FR-6: O comprovante/tela de sucesso nao deve exibir bloco de garantia de 90 dias para vendas sem garantia do app.
- FR-7: A tela de garantias deve tratar `warrantyExpiresAt` nulo sem quebrar renderizacao.
- FR-8: O fluxo de gerar link/QR/certificado deve ser desabilitado ou nao exibido para vendas sem garantia do app.

## 5. Non-Goals

- Nao alterar a politica de garantia Apple fora do app.
- Nao criar configurador avancado de prazo de garantia por loja nesta entrega.
- Nao alterar regras financeiras de pagamentos/comissao.
- Nao reprocessar historico antigo de vendas automaticamente.

## 6. Design Considerations

- Manter UX atual do PDV, apenas removendo transicoes automaticas inesperadas.
- Para aparelho novo, remover elementos visuais de garantia do app no sucesso/comprovante.
- Manter mensagens de erro objetivas em portugues para bloqueios de validacao.

## 7. Technical Considerations

- Pontos de impacto principais esperados:
  - `pages/PDV.tsx` (controle de step e calculo de garantia)
  - `types.ts` (possivel ajuste de `Sale.warrantyExpiresAt` para aceitar nulo)
  - `services/dataContext.tsx` (map/persistencia de `warranty_expires_at`)
  - `pages/Warranties.tsx` e fluxos de link publico (tratamento de venda sem garantia do app)
  - testes em `pages/PDV.test.tsx` e `pages/Warranties.test.tsx`
- Garantir backward compatibility para vendas antigas com garantia preenchida.
- Evitar fallback silencioso para data vazia que possa gerar datas invalidas em UI.

## 8. Success Metrics

- 0 ocorrencias de autoavanco de step em validacao manual de QA no PDV.
- 100% das vendas com item `Novo` registradas sem garantia do app.
- 0 erros de renderizacao nas telas de garantias apos introduzir `warrantyExpiresAt` nulo.
- Testes automatizados cobrindo os dois cenarios novos e passando no CI local.

## 9. Open Questions

- Deve exibir explicitamente "Garantia Apple" para aparelho novo no comprovante, ou apenas remover bloco de garantia do app?
- Para listagem de garantias, vendas sem garantia do app devem ser ocultadas por padrao ou aparecer com status "Sem garantia"?
- No futuro, o prazo de garantia para seminovo deve ser configuravel por loja?
