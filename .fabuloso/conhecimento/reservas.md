# Reservas de estoque

Leia antes de mexer em `components/StockReservationModal.tsx`, `components/reservation/ReservationPaymentFields.tsx`, `lib/reservationDeposits.ts`, `lib/reservationMessage.ts`, nas RPCs `reserve_stock_item`/`release_stock_reservation` ou em `stock_reservations`.

- Reserva com vários sinais: cada sinal vira um lançamento IN 'Adiantamento de reserva' na conta de `reservation_deposit_account(forma)` (Dinheiro vai para o Cofre, o resto para a Conta Bancária).
- `stock_reservations.deposit_amount` continua sendo o TOTAL e `deposit_transaction_id` o lançamento do 1º sinal, para o PDV e `pdv_apply_reservation_deposit_payments` não mudarem (o PDV pula pagamentos `source='reservation_deposit'`, então não duplica).
- Os lançamentos dos demais sinais ficam em `deposit_parts[i].transactionId`. Estorno é por sinal, na conta do lançamento de cada um (`refundTransactionId` por parte; o 1º também em `deposit_refund_transaction_id`). Liberar com devolução gera um OUT 'Estorno de reserva' por sinal.
- `reserve_stock_item` aceita `depositParts` (novo) ou `depositAmount`/`depositPaymentMethod` (legado), reaproveita ids de lançamento por posição e apaga o lançamento de sinal removido.
- Troca (`trade_in` jsonb `{description,value}`) é só informativa: entra na mensagem (`{{troca}}`, `{{valor_troca}}`, `{{sinais}}`) e no "Falta pagar", não gera lançamento; o aparelho entra no estoque na venda pelo PDV. Modelo de mensagem salvo por loja não ganha a linha da troca sozinho.
- Helpers em `lib/reservationDeposits.ts`; UI em `components/reservation/ReservationPaymentFields.tsx`.
- Para achar sinal extra no front use `.contains('deposit_parts', [{transactionId}])`, nunca JSON dentro de `.or()` (PostgREST trata aspas como delimitador).
- `updateStockReservation` (update direto, não usado pela UI) não trata partes.
- Teste PGlite: `supabase/tests/pglite/reservation_deposit_parts.sql`.
- Pendência conhecida: o `cancel_transaction` mais recente (`20260911113452`) perdeu os bloqueios para lançamentos de venda e de sinal de reserva.
- Botão Simulador em `pages/Inventory.tsx` abre `StockSimulatorModal` (escolha do aparelho).
