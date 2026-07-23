-- Realtime: com REPLICA IDENTITY DEFAULT o payload de DELETE só carrega a PK,
-- mas o handler do cliente precisa de stock_item_id para desanexar a reserva do
-- item de estoque (services/dataContext.tsx, tabela stock_reservations). As
-- tabelas de finanças já rodam FULL desde 20260514155038; alinha a de reservas
-- para que deletes (cascade ou manuais) hidratem a UI corretamente.
alter table public.stock_reservations replica identity full;
