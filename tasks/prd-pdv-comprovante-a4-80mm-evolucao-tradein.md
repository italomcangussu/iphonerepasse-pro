# PRD: Evolucao do Comprovante PDV (A4 e 80mm) - Isolamento de Impressao e Trade-in Detalhado

## 0. Perguntas de Clarificacao (com respostas assumidas)

1. Qual e a prioridade do bug de impressao A4 onde o layout do app aparece por tras do comprovante?
   A. Corrigir imediatamente e bloquear novos ajustes visuais ate isolar 100% a area de impressao.
   B. Corrigir depois dos novos campos de dados.
   C. Manter como esta.
   D. Outro.

Resposta assumida: **A**.

2. O detalhamento de trade-in e IMEI deve aparecer em qual formato?
   A. Somente A4.
   B. Somente 80mm.
   C. A4 e 80mm (com apresentacao adaptada para cupom).
   D. Outro.

Resposta assumida: **C**.

3. Como tratar venda com mais de um aparelho recebido na troca?
   A. Suportar 1..N aparelhos de entrada por venda, com valor individual e subtotal de trade-in.
   B. Manter apenas 1 aparelho de entrada.
   C. Permitir varios aparelhos, mas sem valor individual.
   D. Outro.

Resposta assumida: **A**.

4. Qual detalhe financeiro deve aparecer no comprovante?
   A. Valores por meio de pagamento, total liquido loja, acrescimo de cartao, total pago pelo cliente e total de trade-in.
   B. Apenas total final.
   C. Apenas metodo de pagamento sem valores.
   D. Outro.

Resposta assumida: **A**.

5. Como exibir IMEI dos aparelhos de entrada no comprovante interno da loja?
   A. Exibir IMEI completo no comprovante interno (A4/80mm).
   B. Exibir IMEI mascarado.
   C. Nao exibir IMEI.
   D. Outro.

Resposta assumida: **A**.

## 1. Introducao

O comprovante pos-venda do PDV ja possui layouts A4 e 80mm, mas existem dois gaps criticos:

- No A4, o shell visual do app (header/nav/fundo) ainda aparece no preview/PDF e ocupa area da pagina.
- O bloco financeiro nao apresenta detalhamento suficiente de trade-in e pagamentos para auditoria.

Tambem ha lacuna de modelo de dados: hoje a venda suporta apenas `tradeIn` unico em memoria de tela. A evolucao desta entrega exige registrar e exibir multiplos aparelhos recebidos na troca, incluindo IMEI e valor individual.

## 2. Goals

- Eliminar vazamento do layout do app na impressao A4 e 80mm.
- Garantir que apenas o template de comprovante selecionado seja renderizado no print.
- Exibir resumo financeiro completo e auditavel em ambos os formatos.
- Exibir aparelhos de entrada (trade-in) com IMEI e valor recebido, inclusive em cenarios com mais de um aparelho.
- Manter compatibilidade com vendas antigas que so possuem `trade_in_value` agregado.

## 3. User Stories

### US-001: Isolar area de impressao do shell do app
**Description:** Como operador, eu quero que o comprovante seja impresso sem header/menu/fundo do app para gerar PDF limpo e sem cortes.

**Acceptance Criteria:**
- [ ] Ao imprimir A4, nao aparecem elementos do shell do app (sidebar, topbar, navbar mobile, overlays).
- [ ] Ao imprimir 80mm, nao aparecem elementos do shell do app.
- [ ] Apenas um layout e visivel por vez (A4 ou 80mm, conforme selecao).
- [ ] Encerrar impressao restaura o estado visual normal da pagina.
- [ ] Typecheck/lint passes.
- [ ] Verify in browser using dev-browser skill.

### US-002: Exibir resumo financeiro detalhado no A4
**Description:** Como administrativo, eu quero ver totais e composicao financeira detalhada no A4 para conferencia e arquivamento.

**Acceptance Criteria:**
- [ ] O A4 exibe: subtotal itens vendidos, subtotal trade-in, total liquido loja, acrescimo cartao e total pago pelo cliente.
- [ ] Cada meio de pagamento exibe valor base da loja (`amount`) e valor cobrado do cliente (`customerAmount`) quando houver diferenca.
- [ ] Para pagamentos em cartao, o comprovante exibe taxa/valor de acrescimo quando disponivel.
- [ ] O total pago pelo cliente corresponde a soma dos valores cobrados ao cliente.
- [ ] Typecheck/lint passes.
- [ ] Verify in browser using dev-browser skill.

### US-003: Exibir trade-in detalhado no A4
**Description:** Como operador, eu quero listar todos os aparelhos recebidos na troca no A4 para formalizar a negociacao com rastreabilidade.

**Acceptance Criteria:**
- [ ] O A4 exibe tabela/seção de aparelhos de entrada com: modelo, capacidade, cor, IMEI e valor recebido por aparelho.
- [ ] Suporta 1..N aparelhos de entrada.
- [ ] Exibe subtotal de trade-in (soma dos valores recebidos).
- [ ] Em ausencia de IMEI, exibe marcador explicito (ex.: "-").
- [ ] Typecheck/lint passes.
- [ ] Verify in browser using dev-browser skill.

### US-004: Exibir trade-in e financeiro no 80mm sem perder legibilidade
**Description:** Como operador de caixa, eu quero um cupom 80mm compacto, mas com os dados essenciais de trade-in e pagamentos.

**Acceptance Criteria:**
- [ ] O 80mm lista aparelhos de entrada (1..N) em formato compacto com modelo + IMEI + valor recebido.
- [ ] O 80mm exibe subtotal de trade-in e total pago pelo cliente.
- [ ] O 80mm mantem largura fisica de cupom (sem overflow horizontal).
- [ ] O 80mm quebra linhas longas de IMEI/modelo sem truncar informacao critica.
- [ ] Typecheck/lint passes.
- [ ] Verify in browser using dev-browser skill.

### US-005: Persistir multiplos aparelhos de entrada por venda
**Description:** Como sistema, eu quero persistir os aparelhos de entrada da venda para que comprovantes e historicos possam ser reconstruidos corretamente.

**Acceptance Criteria:**
- [ ] Existe estrutura persistente para itens de trade-in por venda (1..N), com valor por aparelho.
- [ ] Cada item de trade-in salva snapshot minimo: modelo, capacidade, cor, IMEI e valor recebido.
- [ ] Leitura de vendas antigas sem itens de trade-in detalhados continua funcionando.
- [ ] O subtotal de trade-in e derivado da soma dos itens quando disponivel; fallback para `trade_in_value` legado.
- [ ] Typecheck/lint passes.

### US-006: Ajustar fluxo PDV para multiplos trade-ins
**Description:** Como operador, eu quero adicionar mais de um aparelho de entrada no fluxo de venda para refletir negociacoes reais.

**Acceptance Criteria:**
- [ ] O passo de produto/troca permite adicionar e remover mais de um aparelho de entrada.
- [ ] O total da venda considera a soma dos valores recebidos em todos os trade-ins.
- [ ] O resumo final antes de concluir venda mostra todos os aparelhos de entrada.
- [ ] Sem regressao no fluxo atual quando houver apenas um aparelho de entrada.
- [ ] Typecheck/lint passes.
- [ ] Verify in browser using dev-browser skill.

### US-007: Cobertura de testes para regressao
**Description:** Como engenharia, eu quero cobertura automatizada dos cenarios criticos de impressao e trade-in para reduzir regressao.

**Acceptance Criteria:**
- [ ] Teste valida que o layout A4 impresso nao inclui shell do app.
- [ ] Teste valida impressao com multiplos trade-ins no A4.
- [ ] Teste valida impressao com multiplos trade-ins no 80mm.
- [ ] Teste valida composicao financeira (amount vs customerAmount vs feeAmount).
- [ ] Suite existente do PDV continua verde.
- [ ] Typecheck/lint passes.

## 4. Functional Requirements

- FR-1: O sistema deve renderizar somente o template de comprovante selecionado durante `window.print()`.
- FR-2: O sistema nao deve renderizar shell/layout do app no contexto de impressao quando `data-print-layout` estiver ativo.
- FR-3: O layout A4 deve ocupar area imprimivel sem empurrar o comprovante por elementos externos.
- FR-4: O layout 80mm deve manter largura de cupom termico e legibilidade de dados detalhados.
- FR-5: O comprovante A4 deve exibir bloco de itens vendidos com modelo, capacidade, cor e IMEI.
- FR-6: O comprovante A4 deve exibir bloco de aparelhos de entrada (trade-in) com 1..N linhas.
- FR-7: Cada linha de trade-in deve conter modelo, capacidade, cor, IMEI e valor recebido.
- FR-8: O comprovante 80mm deve exibir os mesmos dados de trade-in em formato compacto.
- FR-9: O comprovante deve exibir subtotal de trade-in.
- FR-10: O comprovante deve exibir subtotal de itens vendidos (antes da troca).
- FR-11: O comprovante deve exibir total liquido loja (apos trade-in).
- FR-12: O comprovante deve exibir acrescimo total de cartao.
- FR-13: O comprovante deve exibir total pago pelo cliente (soma de `customerAmount` quando houver, senao `amount`).
- FR-14: Para cada pagamento, o comprovante deve exibir metodo e valor correspondente.
- FR-15: Para pagamentos com diferenca entre `amount` e `customerAmount`, o comprovante deve explicitar ambos os valores.
- FR-16: O dominio de venda deve suportar lista de itens de trade-in por venda (1..N) para novos registros.
- FR-17: O sistema deve manter compatibilidade de leitura com vendas legadas sem lista detalhada de trade-in.
- FR-18: O fluxo PDV deve permitir cadastrar/remover multiplos aparelhos de entrada antes de concluir venda.
- FR-19: O total de desconto por troca deve ser calculado pela soma dos valores recebidos dos itens de trade-in.
- FR-20: O comprovante deve continuar respeitando regra existente de garantia (com e sem garantia de app).

## 5. Non-Goals (Out of Scope)

- Nao incluir assinatura digital, QR fiscal ou NF-e nesta iteracao.
- Nao alterar regras contabeis alem da exibicao e persistencia de dados de trade-in/pagamento.
- Nao implementar editor visual de comprovantes.
- Nao criar novos formatos de impressao alem de A4 e 80mm.

## 6. Design Considerations

- A4 deve priorizar leitura formal por secoes: cabecalho, cliente/vendedor, itens vendidos, aparelhos de entrada, pagamentos, totais.
- 80mm deve priorizar escaneabilidade de caixa, com textos curtos e quebra controlada para IMEI/modelo.
- Valores negativos (trade-in) devem manter padrao visual consistente e sem ambiguidade.
- Rotulos financeiros devem refletir o significado de negocio (loja x cliente) para evitar erro de interpretacao.

## 7. Technical Considerations

- Frontend principal:
  - `pages/PDV.tsx` (templates A4/80mm, fluxo de impressao, fluxo de trade-in no PDV)
  - `index.css` (isolamento de print, ocultacao do shell e overlays)
  - `types.ts` (extensao do tipo `Sale` para lista de trade-ins)
- Data layer:
  - `services/dataContext.tsx` (mapeamento de venda, insert e leitura de trade-ins detalhados)
- Banco:
  - Nova migration para persistir itens de trade-in por venda (tabela relacional de 1..N com snapshot + valor).
  - Ajuste no select de vendas para incluir os itens de trade-in detalhados.
- Compatibilidade:
  - Leitura de vendas antigas sem lista de trade-in deve continuar sem erro (fallback para `trade_in_value`).

## 8. Success Metrics

- 0 ocorrencias de elementos do shell do app no PDF/comprovante A4 em testes manuais.
- 100% dos comprovantes novos com trade-in exibem IMEI e valor por aparelho (quando informado).
- Reducao de retrabalho operacional por divergencia de comprovante (indicador qualitativo no PDV).
- Testes automatizados cobrindo cenarios de impressao e trade-in multi-itens passando localmente.

## 9. Open Questions

- IMEI deve ser obrigatorio para salvar item de trade-in no PDV ou pode ser opcional com justificativa?
- No 80mm, quando houver muitos aparelhos de entrada (ex.: 4+), devemos imprimir lista completa ou resumo + anexo A4?
- Historico de vendas (`PDVHistory`) deve exibir os trade-ins detalhados na mesma entrega ou em iteracao seguinte?
- Precisamos exibir o valor de avaliacao original vs valor final aceito por aparelho de entrada?
