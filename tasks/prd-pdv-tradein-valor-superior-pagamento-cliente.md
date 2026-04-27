# PRD: Trade-in com valor superior — pagamento da loja para o cliente no PDV

## 1. Introduction/Overview

Hoje o PDV permite registrar trade-in de aparelhos como abatimento parcial ou total no valor de venda do iPhone. Porém, quando o aparelho recebido em trade-in tem valor **superior** ao iPhone vendido, o sistema não suporta a operação inversa: a loja pagar a diferença ao cliente.

Esta feature habilita esse fluxo no PDV: ao finalizar a venda, se o valor do(s) trade-in(s) ultrapassar o valor do(s) iPhone(s) vendido(s), o operador poderá registrar o **pagamento da diferença ao cliente**, escolhendo origem (conta bancária ou cofre) e forma de pagamento, com integração ao módulo Financeiro. A operação pode ser quitada imediatamente ou lançada como dívida ativa da loja, e ao final é gerado um comprovante completo da operação.

## 2. Goals

- Permitir finalizar uma venda no PDV com diferença negativa (loja deve ao cliente) sem bloqueios.
- Registrar o pagamento da diferença vinculado à venda, saindo do Financeiro com origem e forma de pagamento explícitas.
- Suportar dois modos de quitação: **imediato** (saída financeira na hora) ou **dívida ativa** (registro pendente para quitação futura).
- Garantir rastreabilidade entre venda, trade-in recebido, lançamento financeiro e comprovante.
- Emitir comprovante completo da operação (venda + trade-in + pagamento da diferença).

## 3. User Stories

### US-001: Detectar diferença a pagar ao cliente no fechamento da venda
**Description:** Como operador do PDV, quero que o sistema detecte automaticamente quando o valor total dos trade-ins recebidos for maior que o valor total dos iPhones vendidos, para que eu seja direcionado ao fluxo correto de pagamento ao cliente.

**Acceptance Criteria:**
- [ ] No step de pagamento, o sistema calcula `diferenca = total_tradeins - total_venda`.
- [ ] Se `diferenca > 0`, exibe banner/aviso destacado: "Loja deve R$ X,XX ao cliente" com a quebra do cálculo.
- [ ] O valor a receber do cliente é exibido como `R$ 0,00` (cliente não paga nada).
- [ ] O fluxo padrão de "formas de pagamento do cliente" é substituído pelo fluxo de "pagamento ao cliente".
- [ ] Typecheck passa.
- [ ] Verificar no navegador usando o skill dev-browser.

### US-002: Selecionar modo de quitação (imediato ou dívida ativa)
**Description:** Como operador do PDV, quero escolher se o pagamento ao cliente sai imediatamente do financeiro ou se fica registrado como dívida ativa, para que eu possa adequar à realidade operacional do momento (ex.: cliente já saiu, falta autorização do gerente, sem saldo no momento).

**Acceptance Criteria:**
- [ ] Toggle/seletor com duas opções: "Pagar agora" e "Lançar como dívida ativa".
- [ ] Default: "Pagar agora".
- [ ] Ao selecionar "Pagar agora", exibe campos de origem e forma de pagamento (US-003).
- [ ] Ao selecionar "Lançar como dívida ativa", oculta os campos de origem/forma e exibe campo opcional de "Observação" e "Prazo previsto" (data).
- [ ] Typecheck passa.
- [ ] Verificar no navegador usando o skill dev-browser.

### US-003: Selecionar origem (conta ou cofre) e forma de pagamento
**Description:** Como operador do PDV, quero selecionar de qual conta bancária ou cofre o valor sai e qual a forma de pagamento usada, para que o lançamento financeiro reflita a realidade.

**Acceptance Criteria:**
- [ ] Campo "Origem" exibe lista de contas bancárias ativas + cofres ativos cadastrados.
- [ ] Cada item mostra saldo atual ao lado do nome.
- [ ] Campo "Forma de pagamento" exibe **todas as formas de pagamento já cadastradas no sistema** (PIX, Dinheiro, Transferência TED/DOC, Cartão de débito, etc.), seguindo o mesmo conjunto disponível nos demais fluxos do Financeiro.
- [ ] Validação: bloqueia finalização se saldo da origem escolhida for insuficiente, exibindo aviso (não impede no modo dívida ativa).
- [ ] Campo opcional "Observação interna".
- [ ] Typecheck passa.
- [ ] Verificar no navegador usando o skill dev-browser.

### US-004: Finalizar venda com pagamento imediato ao cliente
**Description:** Como operador do PDV, quero finalizar a venda gerando o lançamento financeiro de saída na conta/cofre escolhido, para que a operação seja concluída atomicamente.

**Acceptance Criteria:**
- [ ] Ao confirmar, cria registro de venda com `total_a_receber = 0` e flag `tem_diferenca_a_pagar = true`.
- [ ] Cria lançamento financeiro de **saída** na origem escolhida com valor da diferença, categoria "Pagamento de trade-in ao cliente" (criar se não existir), vinculado ao ID da venda.
- [ ] Saldo da conta/cofre é decrementado.
- [ ] Trade-in recebido entra normalmente no estoque (sem alteração na lógica atual).
- [ ] Em caso de falha no lançamento financeiro, a venda também é desfeita (transação atômica).
- [ ] Toast de sucesso exibe "Venda finalizada — R$ X,XX pago ao cliente via {forma}".
- [ ] Typecheck passa.
- [ ] Verificar no navegador usando o skill dev-browser.

### US-005: Finalizar venda lançando diferença como dívida ativa
**Description:** Como operador do PDV, quero finalizar a venda gerando uma dívida ativa da loja para o cliente, para que o pagamento possa ser feito posteriormente sem travar a operação.

**Acceptance Criteria:**
- [ ] Ao confirmar, cria registro de venda com `total_a_receber = 0` e flag `tem_diferenca_a_pagar = true`.
- [ ] Cria registro de dívida ativa do tipo "Loja → Cliente" no módulo de dívidas ativas, vinculado à venda, com valor, observação e prazo previsto (se informado).
- [ ] Não cria lançamento financeiro nesse momento (será criado na quitação posterior).
- [ ] A dívida ativa aparece na listagem de dívidas com indicador visual de que é "a pagar" (loja deve), diferenciando das "a receber".
- [ ] Toast de sucesso exibe "Venda finalizada — R$ X,XX adicionado às dívidas ativas".
- [ ] Typecheck passa.
- [ ] Verificar no navegador usando o skill dev-browser.

### US-006: Gerar comprovante completo da operação
**Description:** Como operador do PDV, quero gerar e imprimir/compartilhar um comprovante único contendo a venda, o trade-in recebido e o pagamento da diferença, para que o cliente tenha registro completo da transação.

**Acceptance Criteria:**
- [ ] Comprovante exibe seção **Venda**: iPhone(s) vendido(s), valores, garantias.
- [ ] Comprovante exibe seção **Trade-in recebido**: aparelho(s), condição, valor avaliado.
- [ ] Comprovante exibe seção **Pagamento da diferença**: valor, origem (conta/cofre), forma de pagamento, status (Pago / Em dívida ativa), data.
- [ ] Comprovante exibe seção **Identificação do cliente recebedor**: nome, CPF e área de assinatura (campo de assinatura impresso no A4/80mm para coleta manual).
- [ ] Comprovante segue mesmo layout/estilo dos comprovantes existentes do PDV (A4 e 80mm).
- [ ] Botões de imprimir, compartilhar e baixar PDF disponíveis (reutilizar do fluxo atual).
- [ ] Comprovante acessível depois pelo histórico de vendas.
- [ ] Typecheck passa.
- [ ] Verificar no navegador usando o skill dev-browser.

### US-007: Estorno automático ao cancelar venda já paga
**Description:** Como gerente, quando eu cancelar uma venda que já teve o pagamento ao cliente realizado no modo imediato, quero que o sistema execute o estorno financeiro automaticamente, para que o saldo da conta/cofre seja restaurado sem intervenção manual.

**Acceptance Criteria:**
- [ ] Ao cancelar uma venda com `tem_diferenca_a_pagar = true` e pagamento já efetuado: cria automaticamente lançamento financeiro de **entrada** (estorno) na mesma origem, com mesmo valor e categoria "Estorno de pagamento de trade-in ao cliente".
- [ ] Saldo da conta/cofre é incrementado de volta.
- [ ] Lançamento de estorno é vinculado ao lançamento original e à venda cancelada.
- [ ] Se a venda estava no modo "dívida ativa", a dívida correspondente é marcada como "cancelada" (sem movimentação financeira).
- [ ] Toast confirma "Venda cancelada — R$ X,XX estornado para {origem}".
- [ ] Operação atômica: falha em qualquer passo desfaz o cancelamento.
- [ ] Typecheck passa.
- [ ] Verificar no navegador usando o skill dev-browser.

### US-008: Acessar a venda e o lançamento no histórico
**Description:** Como gerente, quero localizar essa venda no histórico e ver claramente que houve pagamento ao cliente, para auditar a operação.

**Acceptance Criteria:**
- [ ] No histórico de vendas, vendas com diferença a pagar têm badge/indicador visual ("Pagamento ao cliente").
- [ ] Detalhes da venda mostram seção do pagamento ao cliente com origem, forma, status (pago/dívida ativa) e link para o lançamento financeiro/dívida ativa.
- [ ] No módulo Financeiro, o lançamento de saída tem link de volta para a venda originária.
- [ ] Typecheck passa.
- [ ] Verificar no navegador usando o skill dev-browser.

## 4. Functional Requirements

- **FR-1:** O sistema deve calcular automaticamente a diferença entre `total_tradeins` e `total_venda` no step final do PDV.
- **FR-2:** Quando `diferenca > 0`, o sistema deve substituir o fluxo de "pagamento do cliente" pelo fluxo de "pagamento ao cliente" sem permitir voltar ao fluxo padrão (a menos que o usuário ajuste valores nos steps anteriores).
- **FR-3:** O sistema deve permitir escolher entre dois modos: "Pagar agora" e "Lançar como dívida ativa".
- **FR-4:** No modo "Pagar agora", o operador deve obrigatoriamente selecionar uma origem (conta bancária ou cofre ativo) e uma forma de pagamento.
- **FR-5:** O sistema deve exibir o saldo atual de cada origem na lista de seleção.
- **FR-6:** O sistema deve validar e impedir a finalização imediata se o saldo da origem for insuficiente (apenas no modo "Pagar agora").
- **FR-7:** Ao finalizar no modo "Pagar agora", o sistema deve criar atomicamente: (a) registro de venda, (b) lançamento financeiro de saída na origem, (c) entrada do trade-in no estoque. Falha em qualquer etapa desfaz tudo.
- **FR-8:** Ao finalizar no modo "Dívida ativa", o sistema deve criar atomicamente: (a) registro de venda, (b) registro de dívida ativa do tipo "Loja → Cliente", (c) entrada do trade-in no estoque. Falha em qualquer etapa desfaz tudo.
- **FR-9:** O sistema deve criar/usar a categoria financeira "Pagamento de trade-in ao cliente" para o lançamento de saída.
- **FR-10:** O sistema deve gerar comprovante único contendo: dados da venda, trade-in(s) recebido(s), e pagamento da diferença (com status pago ou dívida ativa).
- **FR-11:** O comprovante deve estar disponível em formato A4 e 80mm, seguindo o layout existente do PDV.
- **FR-12:** O sistema deve manter a venda recuperável pelo histórico, com indicador visual de que houve pagamento ao cliente.
- **FR-13:** No módulo Financeiro, o lançamento de saída deve ter referência clara à venda originária.
- **FR-14:** Qualquer operador do PDV pode realizar essa operação (sem aprovação extra de gerente).
- **FR-15:** O cliente não paga nada na finalização (`total_a_receber = 0`); não é permitido combinar com formas de pagamento adicionais do cliente neste fluxo.
- **FR-16:** O sistema deve oferecer todas as formas de pagamento já cadastradas no Financeiro para o pagamento ao cliente (sem restrição a PIX/Dinheiro).
- **FR-17:** O comprovante deve incluir nome, CPF e campo de assinatura do cliente recebedor para documentação fiscal. O CPF é obrigatório no fluxo de finalização (capturado do cadastro do cliente da venda; se ausente, prompt para preenchimento).
- **FR-18:** Ao cancelar uma venda com pagamento ao cliente já efetuado (modo imediato), o sistema deve gerar automaticamente o lançamento de estorno (entrada) na mesma origem, mesma categoria de estorno, vinculado à venda cancelada.
- **FR-19:** Ao cancelar uma venda com diferença em modo "dívida ativa", o sistema deve marcar a dívida correspondente como cancelada (sem movimentação financeira).
- **FR-20:** A quitação posterior de uma dívida ativa gerada por este fluxo **não** gera comprovante adicional (o comprovante original já documenta a operação).

## 5. Non-Goals (Out of Scope)

- **Não** será implementada aprovação/senha de gerente para essa operação (qualquer operador finaliza).
- **Não** será permitido o cliente pagar parte da diferença em outro produto/serviço dentro do mesmo PDV (combinação fica fora do escopo).
- **Não** haverá notificações automáticas (push/email/WhatsApp) ao cliente ao gerar a dívida ativa neste PRD.
- **Não** haverá relatório dedicado de "trade-ins com pagamento ao cliente" — usaremos os filtros existentes do histórico/financeiro.
- **Não** serão criados limites de valor máximo ou alertas de risco de fraude nesta versão.
- **Não** haverá integração bancária automática para executar o pagamento (PIX/transferência são apenas registros, não transações reais executadas pelo sistema).
- **Não** será gerado comprovante adicional na quitação posterior de dívida ativa originada por este fluxo.
- **Não** haverá captura digital de assinatura — o comprovante imprime área para assinatura física (manual).

## 6. Design Considerations

- Reutilizar componentes existentes:
  - Seleção de origem: mesmo padrão usado em "aporte" e "pagar conta" do Financeiro.
  - Seleção de forma de pagamento: mesmo padrão dos demais fluxos do PDV.
  - Layout de comprovante: estender o comprovante atual do PDV (A4 + 80mm), adicionando seção "Pagamento ao cliente".
  - Banner de diferença: usar o mesmo estilo dos avisos atuais do step de pagamento.
- O step de pagamento do PDV deve renderizar condicionalmente o "modo cliente recebe" quando `diferenca > 0`, sem criar uma nova rota/página.
- Indicadores visuais devem diferenciar claramente "a pagar" (loja deve) de "a receber" (cliente deve) na listagem de dívidas ativas.

## 7. Technical Considerations

- **Transações atômicas:** o fluxo precisa garantir consistência entre venda, lançamento/dívida e estoque. Avaliar uso da camada de serviço/contexto existente (`dataContext`) para encapsular a operação.
- **Modelo de dados:**
  - Adicionar campo `tem_diferenca_a_pagar` (bool) e `valor_diferenca` (number) no registro de venda.
  - Reusar tabela de lançamentos financeiros (saída) com `categoria = "Pagamento de trade-in ao cliente"` e `referencia_venda_id`.
  - Reusar tabela de dívidas ativas com `tipo = "loja_para_cliente"` (criar enum/flag se não existir).
- **Categorias financeiras:** garantir que a categoria "Pagamento de trade-in ao cliente" exista (seed/migration).
- **Saldos:** decremento do saldo da conta/cofre deve ser feito na mesma transação do lançamento.
- **Reversão:** cancelamento da venda (se já existir esse fluxo) precisa também reverter o lançamento financeiro ou marcar a dívida como cancelada.
- **Testes:** cobrir casos de borda — diferença exatamente zero (sem fluxo novo), trade-in múltiplo, cancelamento, falha no lançamento financeiro.
- **Compatibilidade:** não pode regredir o fluxo atual de trade-in com valor inferior (mais comum).

## 8. Success Metrics

- 100% das vendas no PDV com `total_tradein > total_venda` finalizam sem erro/bloqueio (medida: zero ocorrências de "Workaround manual" reportadas após release).
- Lançamento financeiro de saída é gerado em 100% das operações no modo "Pagar agora".
- Comprovante gerado em 100% das operações concluídas, com as três seções (venda, trade-in, pagamento) preenchidas.
- Tempo total para concluir a operação ≤ 2× o tempo de uma venda comum com trade-in (sem regressão grave de UX).
- Zero divergência entre saldo de conta/cofre exibido e saldo real após a operação (auditoria de batimento).

## 9. Decisões consolidadas

Pontos previamente em aberto, agora decididos:

- **Formas de pagamento:** todas as formas já cadastradas no Financeiro são aceitas (sem restrição). Ver FR-16.
- **Quitação posterior de dívida ativa:** não gera comprovante adicional. Ver FR-20.
- **Limite máximo / aprovação por valor:** não haverá limite ou trigger de aprovação por valor nesta versão.
- **Cancelamento de venda já paga:** estorno financeiro automático (entrada na mesma origem). Ver US-007 e FR-18/FR-19.
- **Assinatura/CPF no comprovante:** incluir nome, CPF e área de assinatura física no comprovante. Ver FR-17.

## 10. Open Questions

- Nenhuma pendência aberta no momento — todos os pontos foram decididos.
