# Máscaras de campos

Leia antes de criar ou mexer em campo de dinheiro, telefone ou documento digitado (helpers em `utils/inputMasks.ts`).

- Campo de dinheiro digitado: `onChange` com `maskDecimalInput`, prefill de edição com `formatDecimalBRL(valor)`, parse com `parseDecimalBRL` (no simulador, `parseSimulatorAmount`), placeholder "0,00".
- Ajuste com sinal (+/-): `maskSignedDecimalInput`, igual a `maskDecimalInput` mas preserva o "+"/"-" inicial.
- Armadilha: `maskCurrencyInput` aceita só inteiro e ainda é usado por `components/companies/useStockSale.ts`; não usar em campo que precisa de centavos. Misturar máscara de inteiro com prefill `toFixed` inflava o valor ×100 ao editar (bug corrigido em `pages/PayableDebts.tsx`).
- Documento de credor/cliente: `formatCpfOrCnpj`. Telefone: `formatPhone`, ou `maskPhoneInput` em campo digitado (até 11 dígitos formata; número com DDI/"+" ou mais de 11 dígitos fica como digitado, porque `formatPhone` trunca em 11). Usar `type="tel"`.
- Telefone sem máscara de propósito: `ConversationsPage`, `AdminAgentPage` e `CRMChannels`, que aceitam DDI internacional via `normalizePhone`.
- Já no padrão: `pages/crm/SimulatorPage.tsx` (todos os valores; ajuste com sinal), `pages/PayableDebts.tsx`, `StockReservationModal` e `components/marketing/ScriptsTab`.
