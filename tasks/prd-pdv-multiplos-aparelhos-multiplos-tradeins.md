# PRD: PDV com Venda de Múltiplos Aparelhos e Múltiplos Trade-ins

## 1. Introdução / Visão Geral

Hoje o PDV (`pages/PDV.tsx`) só permite selecionar **um** aparelho por venda (estado `selectedProduct` singular), embora o modelo `Sale.items` já seja um array (`StockItem[]`) e `tradeIns` já aceite 1..N (`SaleTradeInItem[]`).

Esta feature evolui o PDV para que o vendedor consiga, em **uma única venda**:

1. Montar um **carrinho livre** com N aparelhos do estoque (cada um com IMEI, cor e preço próprios).
2. Receber **N aparelhos como trade-in** numa lista clara, com adicionar/remover individuais.
3. Aplicar **desconto único** sobre o subtotal consolidado.
4. Emitir **comprovante consolidado** (A4 e 80mm) listando todos os aparelhos e todos os trade-ins.
5. Atribuir **garantia individual por aparelho** vendido (cada item com sua própria data de expiração).

A meta é cobrir cenários reais (ex.: cliente compra 2 iPhones e entrega 2 usados como parte do pagamento) sem precisar quebrar em múltiplas vendas, evitando inconsistência de caixa, comissão e estoque.

## 2. Objetivos

- Permitir adicionar de 1 até N aparelhos do estoque em uma única venda.
- Permitir adicionar de 0 até N trade-ins em uma única venda, com UI dedicada (lista + "+ Adicionar trade-in" + remover por item).
- Aplicar **um único desconto** (valor ou %) sobre o subtotal consolidado.
- Calcular **garantia por aparelho**, persistindo a data de expiração individualmente em cada `StockItem` snapshot dentro de `Sale.items`.
- Atualizar **comprovante A4 e 80mm** e a tela de **histórico** (`PDVHistory.tsx`) para refletir o consolidado.
- Manter o esquema de banco atual (sem migrações novas) — usar campos já existentes em `Sale`, `StockItem` e `SaleTradeInItem`.
- Não quebrar vendas legadas com 1 item (compatibilidade total na leitura).

## 3. User Stories

### US-001: Carrinho de múltiplos aparelhos no Step 2
**Description:** Como vendedor, quero adicionar vários aparelhos do estoque ao carrinho da venda, para fechar uma única venda quando o cliente leva mais de um aparelho.

**Acceptance Criteria:**
- [ ] No Step 2, o seletor de produto muda para um padrão "carrinho": busca/seleciona aparelho disponível e clica em "Adicionar ao carrinho".
- [ ] Lista do carrinho exibe cada item com: modelo, capacidade, cor, IMEI, condição, preço de venda, e botão "Remover".
- [ ] Botão "Avançar para pagamento" só habilita quando o carrinho tem ≥ 1 item.
- [ ] Não permite adicionar o mesmo `StockItem.id` duas vezes (estoque por unidade com IMEI único).
- [ ] Carrinho persiste no draft local (mesma chave usada hoje em `useEffect` do draft) ao recarregar a página.
- [ ] Filtro de condição (NEW/SEMINOVO/USADO) e filtro por loja continuam funcionando ao buscar produtos para adicionar.
- [ ] Typecheck e lint passam.
- [ ] Verificar no browser usando dev-browser skill.

### US-002: Lista de múltiplos trade-ins com adicionar/remover (sem persistência prematura)
**Description:** Como vendedor, quero gerenciar uma lista de trade-ins recebidos com botões claros para adicionar e remover individualmente, sabendo que esses aparelhos só entrarão no estoque quando a venda for **finalizada com sucesso**.

**Acceptance Criteria:**
- [ ] Substituir UI atual por lista mostrando cada trade-in com: modelo, capacidade, cor, IMEI, condição, valor recebido, botão "Remover".
- [ ] Botão "+ Adicionar trade-in" abre o `StockFormModal` em modo "rascunho" (não persiste em DB) — apenas devolve o objeto preenchido para a lista local `tradeInItems`.
- [ ] **Trade-ins NÃO são inseridos no estoque enquanto a venda não for concluída no Step 3.** A inserção dos trade-ins no estoque ocorre na mesma transação atômica de `addSale` (FR-14).
- [ ] "Remover" da lista é instantâneo (apenas remove do array local), pois nada foi persistido.
- [ ] Se o usuário cancelar/sair da venda antes do Step 3, **nenhum trade-in é gravado no estoque**.
- [ ] Subtotal de trade-ins exibido: "Total trade-in: R$ X (N aparelhos)".
- [ ] Typecheck e lint passam.
- [ ] Verificar no browser usando dev-browser skill.

### US-002b: Estorno de venda exclui todos os trade-ins do estoque
**Description:** Como gestor, quero que ao estornar uma venda todos os trade-ins recebidos sejam removidos do estoque, para que o caixa e o inventário voltem ao estado anterior à venda.

**Acceptance Criteria:**
- [ ] Ao executar estorno (fluxo existente em `PDVHistory`), além das ações atuais, excluir do estoque **todos os `StockItem`** que foram criados como trade-ins desta venda (identificados via `SaleTradeInItem.stockItemId`).
- [ ] Operação atômica: ou todas as exclusões + estorno passam, ou nenhuma é aplicada (rollback).
- [ ] Se algum trade-in já tiver sido **vendido posteriormente** (status `SOLD`), abortar o estorno e exibir mensagem clara ao usuário com a lista de IMEIs bloqueantes.
- [ ] Test em `PDVHistory.test.tsx` cobre: estorno feliz (remove 2 trade-ins) e estorno bloqueado (1 trade-in já vendido).
- [ ] Typecheck e lint passam.

### US-003: Cálculo de subtotal, desconto único e total
**Description:** Como vendedor, quero ver o subtotal somado dos aparelhos, aplicar um desconto único (valor ou %), e ver o total a pagar já com trade-ins abatidos.

**Acceptance Criteria:**
- [ ] `originalSubtotal` = soma de `originalSellPrice ?? sellPrice` de todos os itens do carrinho.
- [ ] `negotiatedSubtotal` = soma de `sellPrice` (após eventuais ajustes individuais futuros — fora deste escopo).
- [ ] Desconto único aplicado sobre `negotiatedSubtotal` (mesma regra do PDV atual: tipo `amount` ou `percent`).
- [ ] `tradeInValue` = soma de `receivedValue` de todos os trade-ins.
- [ ] `total` = max(0, `negotiatedSubtotal` - `discountAmount` - `tradeInValue` + acréscimos de cartão).
- [ ] Resumo no Step 3 mostra: linha por aparelho, linha por trade-in, desconto, total.
- [ ] Testes em `PDV.test.tsx` cobrem: 2 aparelhos + 0 trade-in; 2 aparelhos + 2 trade-ins; 3 aparelhos + 1 trade-in com desconto %.
- [ ] Typecheck e lint passam.

### US-004: Garantia individual por aparelho
**Description:** Como cliente, quero que cada aparelho da venda tenha sua própria data de garantia, para que cada item seja consultável independentemente.

**Acceptance Criteria:**
- [ ] Ao concluir a venda, calcular `warrantyExpiresAt` para cada item conforme regras já existentes (NEW vs SEMINOVO/USADO, regra manual/condicional do `prd-pdv-step-manual-and-conditional-warranty.md`).
- [ ] Persistir a data calculada em cada `StockItem` snapshot dentro de `Sale.items[i].warrantyExpiresAt` (campo já existente no `StockItem`).
- [ ] Manter `Sale.warrantyExpiresAt` no nível da venda como **a maior** entre as datas dos itens (compat com leitura legada).
- [ ] Tela pública de garantia (`PublicWarrantyView`) lista os itens com `warrantyExpiresAt` individual quando disponível, fallback para o nível da venda.
- [ ] Vendas legadas (1 item) continuam exibindo a mesma data sem mudança visual.
- [ ] Typecheck e lint passam.

### US-005: Comprovante A4 consolidado
**Description:** Como vendedor, quero imprimir um comprovante A4 consolidado mostrando todos os aparelhos e todos os trade-ins da venda, para entregar um único documento ao cliente.

**Acceptance Criteria:**
- [ ] Template A4 lista cada aparelho vendido com modelo, capacidade, cor, IMEI, condição, preço unitário, e **garantia até DD/MM/AAAA por item**.
- [ ] Lista cada trade-in com modelo, capacidade, cor, IMEI, condição, valor recebido.
- [ ] Mostra subtotal, desconto, total trade-in (com contagem "N aparelhos"), acréscimo cartão (se houver) e total final.
- [ ] Quantidade exibida sempre `1 x` por linha (cada IMEI é uma linha distinta).
- [ ] Layout A4 cabe em 1 página para até 5 aparelhos + 5 trade-ins (ajustar fontes/espaçamentos se necessário).
- [ ] Verificar no browser usando dev-browser skill.

### US-006: Comprovante 80mm (térmica) consolidado
**Description:** Como vendedor, quero imprimir o comprovante 80mm consolidado na impressora térmica, com todos os aparelhos e trade-ins.

**Acceptance Criteria:**
- [ ] Template 80mm itera os arrays `items` e `tradeIns` na mesma ordem do A4.
- [ ] Cada aparelho mostra modelo, IMEI, cor, preço, e linha "Garantia: DD/MM/AAAA".
- [ ] Cada trade-in mostra modelo, IMEI, valor recebido com sinal negativo.
- [ ] Totais (subtotal, desconto, trade-ins, acréscimo, total) seguem layout 80mm atual.
- [ ] Impressão direta via Web Serial (caminho ESC/POS atual em `services/`) processa o template novo sem regressão.
- [ ] Verificar no browser usando dev-browser skill.

### US-007: Histórico (PDVHistory) reflete múltiplos aparelhos e trade-ins
**Description:** Como gestor, quero ver no histórico de vendas a lista completa de aparelhos vendidos e trade-ins recebidos em cada venda.

**Acceptance Criteria:**
- [ ] Card/linha de venda no histórico mostra contadores: "N aparelhos · M trade-ins".
- [ ] Modal de detalhes da venda lista todos os `items` (aparelhos vendidos) e todos os `tradeIns`, com mesma estrutura do comprovante A4.
- [ ] Filtros e busca existentes continuam funcionando (busca por IMEI deve achar a venda se qualquer item ou trade-in casar).
- [ ] Total exibido na lista é `Sale.total` (já consolidado).
- [ ] Typecheck e lint passam.
- [ ] Verificar no browser usando dev-browser skill.

### US-008: Compatibilidade com vendas legadas (1 item)
**Description:** Como sistema, preciso ler vendas antigas que tinham só 1 item sem quebrar a UI nem perder dados.

**Acceptance Criteria:**
- [ ] PDV, histórico e comprovantes leem `Sale.items` sempre como array (já é o caso no schema).
- [ ] Quando `Sale.tradeIns` está vazio mas `Sale.tradeIn` existe (legado), normalizar para um array de 1 elemento na renderização (já tem precedente em `PDV.tsx:770-783`).
- [ ] Smoke test (`tests/smoke/`) cobre abrir uma venda antiga e verificar que renderiza sem erro.
- [ ] Typecheck e lint passam.

### US-010: Bloqueio + modal de resolução para IMEI duplicado no estoque
**Description:** Como vendedor, ao tentar adicionar um aparelho ao carrinho cujo IMEI bate com outro registro de estoque, quero ser avisado e ter a chance de identificar/excluir o item duplicado incorreto, para não vender uma unidade fantasma.

**Acceptance Criteria:**
- [ ] Antes de adicionar ao carrinho, validar se há outro `StockItem` ativo com o mesmo IMEI.
- [ ] Se houver, **bloquear** a adição e abrir um modal "IMEI duplicado detectado" listando os 2+ registros lado a lado com todos os campos relevantes (modelo, capacidade, cor, IMEI, condição, status, loja, preços, datas de criação).
- [ ] Cada registro no modal tem botão "Excluir este" (com confirmação) e botão "Manter".
- [ ] Após resolver o duplicado, o usuário pode tentar adicionar ao carrinho novamente.
- [ ] IMEIs vazios/nulos não disparam validação (não é duplicidade).
- [ ] Typecheck e lint passam.
- [ ] Verificar no browser usando dev-browser skill.

### US-009: Métodos de pagamento aplicados ao total consolidado
**Description:** Como vendedor, quero dividir o pagamento (Pix/Dinheiro/Cartão/Devedor) sobre o total final da venda consolidada, sem amarrar pagamento a item específico.

**Acceptance Criteria:**
- [ ] Step 3 calcula "Restante a pagar" = `total` - soma de `paymentMethods[i].amount`.
- [ ] Travas existentes (cartão não pode passar do restante; débito vs líquido) seguem funcionando sobre o total consolidado.
- [ ] Acréscimo de cartão aplicado uma única vez sobre o total, não por item.
- [ ] Typecheck e lint passam.
- [ ] Verificar no browser usando dev-browser skill.

## 4. Functional Requirements

- **FR-1:** Estado `selectedProduct: StockItem | null` é substituído por `cartItems: StockItem[]` no PDV.
- **FR-2:** Não permitir o mesmo `StockItem.id` repetido em `cartItems`.
- **FR-3:** Botão "Adicionar ao carrinho" no Step 2 só habilita quando há aparelho selecionado e a busca/filtros encontraram o item.
- **FR-4:** Botão "Remover" em cada linha do carrinho recalcula subtotais imediatamente.
- **FR-5:** Trade-ins NÃO são persistidos no estoque pelo `StockFormModal` enquanto estiverem em rascunho; persistência ocorre **somente** na transação `addSale` ao concluir a venda no Step 3.
- **FR-5b:** Cancelar/sair do PDV antes da conclusão descarta todos os trade-ins em rascunho — nada é gravado.
- **FR-5c:** Estorno de venda (em `PDVHistory`) exclui do estoque todos os `StockItem` criados como trade-ins daquela venda; aborta se algum já foi revendido.
- **FR-6:** `Sale.tradeIn` (singular legado) é populado com `tradeInItems[0]` apenas para compat de leitura; novas vendas usam exclusivamente `Sale.tradeIns`.
- **FR-7:** Cálculo de garantia por item segue regras de `prd-pdv-step-manual-and-conditional-warranty.md` aplicadas individualmente a cada `StockItem`.
- **FR-8:** `Sale.warrantyExpiresAt` (nível venda) = `MAX(items[i].warrantyExpiresAt)` para compat com a tela pública atual.
- **FR-9:** Comprovante A4 e 80mm renderizam todos os `items` e todos os `tradeIns`.
- **FR-10:** Histórico (`PDVHistory.tsx`) renderiza contagem `N aparelhos · M trade-ins` e modal de detalhes lista todos.
- **FR-11:** Busca por IMEI no histórico encontra a venda se qualquer `items[i].imei` OU `tradeIns[j].imei` casar.
- **FR-12:** Telemetria `pdv_step_completed` continua disparada; adicionar `metadata.itemsCount` e `metadata.tradeInsCount` no evento de venda concluída.
- **FR-13:** Cálculo do total consolidado: `total = max(0, sum(items.sellPrice) - discountAmount - sum(tradeIns.receivedValue) + cardSurcharge)`.
- **FR-14:** Ao concluir a venda, todos os `items` têm seu `StockStatus` mudado para `SOLD` em uma única operação atômica (transação única no `dataContext.addSale`).
- **FR-15:** Comissão do vendedor é calculada sobre `Sale.total` (regra mantida — venda, não por item).
- **FR-16:** Validação de IMEI duplicado: ao tentar adicionar um `StockItem` ao carrinho, se houver outro `StockItem` ativo com mesmo IMEI não-vazio, bloquear e abrir modal de resolução de duplicidade (US-010).
- **FR-17:** Comprovante térmico 80mm não impõe limite de aparelhos por ticket (sem paginação artificial).

## 5. Non-Goals (Fora de Escopo)

- **Sem migração de banco**: usar exclusivamente colunas e arrays JSON existentes em `sales`, `stock_items`, `sale_trade_ins`.
- **Sem desconto por item**: desconto é único e aplicado sobre o subtotal (regra já existente).
- **Sem ajuste de preço individual** dentro do carrinho neste PRD (já existe modal de ajuste no Step 3 — não é alterado aqui).
- **Sem vincular trade-in específico a aparelho específico** da venda (trade-ins entram no pool geral que abate o total).
- **Sem comprovante por aparelho (split)**: apenas consolidado.
- **Sem alterar regra de cálculo de garantia** (manual/condicional já está definida em PRD anterior, só passamos a aplicá-la por item).
- **Sem mudar fluxo de pagamento parcelado/devedor** (continuam sobre o total consolidado).
- **Sem reabrir/editar venda concluída** (PRD existente cobre isso separadamente).

## 6. Design Considerations

- **Step 2 (Aparelhos)**: reaproveitar o seletor atual + adicionar lista do carrinho abaixo. Mostrar contador "(N) no carrinho" no botão de avançar.
- **Step 2 (Trade-in)**: lista vertical, com `StockFormModal` reutilizado para adicionar. Cada linha com ícone de remover (lixeira iOS).
- **Step 3 (Resumo)**: tabela com 1 linha por aparelho + 1 linha por trade-in (sinal negativo), seguido de bloco de descontos/acréscimos/total.
- **Histórico**: badge com `N · M` no card; modal de detalhes adapta o template de A4 para visualização em tela.
- Reutilizar componentes do design system (`design-system/`) — botões iOS-secondary, cards, badges existentes.
- Não introduzir novos componentes "carrinho global" — manter escopo local ao PDV.

## 7. Technical Considerations

- **Arquivo principal**: `pages/PDV.tsx` (2153 linhas) — refatoração focada nos estados `selectedProduct` → `cartItems` e nos cálculos de subtotal.
- **Tipos**: `Sale.items` já é `StockItem[]` e `Sale.tradeIns` já é `SaleTradeInItem[]` ([types.ts:108-110](types.ts:108)). Sem mudanças.
- **Persistência**: `services/dataContext.tsx#addSale` já recebe `Sale` com arrays — validar que insere todos os `items` e atualiza estoque para todos.
- **Garantia por item**: `StockItem.warrantyExpiresAt` já existe; popular no snapshot ao concluir venda.
- **Trade-in (rascunho até concluir)**: `StockFormModal.tsx` ganha um modo "draft" que retorna o objeto preenchido sem chamar `addStockItem`. A inserção real acontece dentro de `dataContext.addSale` em transação única junto com a venda. Isso elimina a necessidade de `removeStockItem` ao remover da lista local.
- **Estorno**: o fluxo de estorno em `PDVHistory` precisa receber a lista de `stockItemId` de trade-ins a excluir e operar atomicamente; se algum trade-in tiver `status = SOLD`, abortar com mensagem.
- **Comprovantes**: templates já estão fora do container principal (commit `b31c2a0`); iterar sobre arrays nos templates existentes.
- **Testes**:
  - `pages/PDV.test.tsx`: novos casos de carrinho com 2-3 itens + 1-2 trade-ins; cancelar venda não persiste trade-ins; IMEI duplicado abre modal.
  - `pages/PDVHistory.test.tsx`: render de venda com múltiplos itens; busca por IMEI de trade-in; estorno feliz remove trade-ins; estorno bloqueado quando trade-in já vendido.
  - `tests/smoke/smokeInventory.ts`: **estender** com um cenário multi-item (2 aparelhos + 2 trade-ins) ao invés de criar arquivo novo, mantendo o smoke single-item para garantir compat. Justificativa: smoke é um fluxo end-to-end curto; um arquivo único cobre os dois caminhos sem duplicar boilerplate.
- **Performance**: carrinho local em memória — sem impacto. Persistência é uma única transação.
- **Telemetria**: estender evento existente em `services/telemetry.ts`.

## 8. Success Metrics

- Vendedor fecha uma venda com 2 aparelhos + 2 trade-ins em ≤ 90 segundos (mesma ordem de grandeza de uma venda single-item hoje).
- 0 regressões em vendas single-item (smoke + testes existentes verdes).
- Comprovante A4 multi-item cabe em 1 página para até 5 aparelhos + 5 trade-ins.
- Histórico carrega vendas multi-item sem aumento perceptível de latência (< 200ms a mais que single-item).
- 100% das vendas legadas continuam abrindo no histórico sem erro.

## 9. Decisões Tomadas

- **Trade-in só vai para o estoque ao concluir a venda.** Cancelamento descarta sem gravar. Estorno exclui todos os trade-ins gravados (abortando se algum já foi revendido). → US-002, US-002b, FR-5/5b/5c.
- **Comissão do vendedor é calculada sobre `Sale.total` (venda)**, não por item. → FR-15.
- **IMEI duplicado bloqueia a adição ao carrinho** e abre modal de resolução com os campos lado a lado para o vendedor escolher qual excluir. → US-010, FR-16.
- **Sem limite de linhas no comprovante térmico 80mm.** → FR-17.
- **Smoke test estendido**, não novo: adicionar cenário multi-item ao `tests/smoke/smokeInventory.ts` existente, mantendo o caminho single-item. → seção 7 (Testes).

## 10. Open Questions

- Nenhuma pendente.
