# Orçamentos do PDV

Leia antes de mexer em `pages/pdv/quote/`, `pages/PDVQuotes`, `pages/PDVQuoteNew`, `services/quotesApi.ts` ou na tabela `pdv_quotes`.

- Orçamento é snapshot imutável em `pdv_quotes`: itens em jsonb e `payment` jsonb = {plan, presentation, totals}, calculados na hora. Reabrir não recalcula com taxas novas; "Renovar/Duplicar" cria outro orçamento recalculando.
- RLS pela matriz de permissões: ler, criar e atualizar = `has_app_permission('pdv','visible')`; excluir = `'deletable'`. Cancelar = status `cancelado` (a UI não exclui).
- `quote_number` é identity, exibido como "ORC-0001" (`formatQuoteNumber`).
- Validade: diálogo obrigatório ao salvar (`QuoteValidityDialog`), sempre abre em 1 dia, de 1 a 30 (check no banco); `expires_at` = criação + N×24h.
- Dois modos: "Compra conjunta" (total + desconto opcional) e "Opções para comparar" (cada item com preço/parcelas próprios, sem desconto; só com 2+ itens).
- Item manual pode ser "Sob encomenda": marca interna, NÃO aparece no documento; só o "prazo de entrega" opcional aparece.
- Parcelas usam `cardFeeSettings` (`utils/cardFees`, mesma fórmula do PDV: valor/(1-taxa)).
- Documento: HTML autocontido gerado pela função pura `buildQuoteDocumentHtml` (CSS embutido com valores dos tokens `--ds-*`, sempre claro, `@page` A4). Saídas em `quoteDelivery.ts`: baixar .html, `navigator.share` com arquivo (fallback download), imprimir o iframe = "Salvar como PDF". Logo via `useReceiptLogo` (data URL); sem logo usa monograma.
- Dados só por `services/quotesApi.ts`.
- Testes: `supabase/tests/pglite/pdv_quotes.sql`, `pages/pdv/quote/quoteModel.test.ts`, `quoteDocument.test.ts`.
- Rotas: `/pdv/orcamentos` (lista) e `/pdv/orcamentos/novo` (aceita `location.state.baseQuote` para duplicar), ambas `requiredPermission="pdv"`.
- Evolução possível: converter orçamento em venda no PDV; enviar direto pelo CRM.
