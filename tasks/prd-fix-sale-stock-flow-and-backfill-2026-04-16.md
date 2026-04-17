# PRD: Correcao do Fluxo de Venda para Baixa de Estoque + Backfill de Hoje

## 1. Introducao

Corrigir o fluxo de venda para garantir que todo aparelho vendido seja removido do estoque disponivel no momento do registro da venda. Tambem executar backfill das vendas do dia **16/04/2026** (timezone `America/Fortaleza`) para marcar os aparelhos vendidos como `Vendido`.

## 2. Goals

- Garantir baixa de estoque no backend para toda insercao em `sale_items`.
- Eliminar sucesso silencioso em `addSale` quando algum `insert` falha.
- Executar backfill das vendas de hoje para corrigir inconsistencias de status.
- Validar com query de conferencia sem itens vendidos pendentes.

## 3. User Stories

### US-001: Baixa de estoque garantida no banco
**Description:** Como operador, quero que o sistema baixe o estoque automaticamente ao registrar item da venda, para que o estoque nao dependa de atualizacao do front.

**Acceptance Criteria:**
- [ ] Existe trigger `AFTER INSERT` em `public.sale_items`.
- [ ] Trigger atualiza `public.stock_items.status` para `Vendido`.
- [ ] Backfill idempotente existente em migration.

### US-002: Fluxo de venda sem falha silenciosa
**Description:** Como operador, quero receber erro real quando alguma etapa de persistencia falhar para nao ter venda inconsistente sem aviso.

**Acceptance Criteria:**
- [ ] `addSale` lanca erro quando falha em `sales`.
- [ ] `addSale` lanca erro quando falha em `sale_items`, `payment_methods` e `sale_trade_in_items`.
- [ ] Fluxo nao retorna sucesso silencioso.

### US-003: Backfill de vendas de hoje
**Description:** Como gestor, quero aplicar backfill das vendas do dia para garantir que os aparelhos vendidos nao aparecam como disponiveis.

**Acceptance Criteria:**
- [ ] SQL de backfill executado para vendas de 16/04/2026 (`America/Fortaleza`).
- [ ] Query final de conferencia retorna zero itens vendidos com status diferente de `Vendido`.

## 4. Functional Requirements

- FR-1: Criar/atualizar funcao `public.handle_sale_item_after_insert`.
- FR-2: Criar trigger `trg_sale_items_after_insert` em `public.sale_items`.
- FR-3: `services/dataContext.tsx` deve validar `error` em todos os `insert` da venda.
- FR-4: Estado local de estoque deve refletir `Vendido` apos venda registrada.
- FR-5: Executar backfill para o dia corrente com filtro de timezone.

## 5. Non-Goals

- Nao refatorar todo o PDV para RPC transacional unico.
- Nao alterar regras financeiras de `transactions`, `debts` e `payment_methods`.
- Nao alterar fluxo de cancelamento de venda existente.

## 6. Technical Considerations

- Trigger no banco reduz dependencia de permissoes e estado do cliente.
- Backfill deve ser idempotente para permitir reexecucao segura.
- Filtro de data para backfill deve usar `America/Fortaleza`.

## 7. Success Metrics

- 0 itens de vendas de hoje com status diferente de `Vendido`.
- 0 casos de sucesso silencioso no fluxo `addSale`.
- Novas vendas passam a baixar estoque sem acao manual.

## 8. Open Questions

- Se houver erro apos criar `sales` e antes de finalizar os inserts relacionados, devemos migrar para RPC transacional em etapa futura?
