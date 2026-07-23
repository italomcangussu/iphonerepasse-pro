# Sinal de reserva na tabela de estoque

## Objetivo

Permitir que quem consulta a aba **Reservados** identifique, sem abrir o
detalhe do aparelho, se a reserva recebeu sinal e qual foi o valor pago.

## Decisão de interface

O indicador ficará no bloco de informações da reserva, na coluna
**Dispositivo**, imediatamente após cliente e validade. A tabela já possui
informações operacionais suficientes nas demais colunas; criar uma coluna de
sinal reduziria o espaço disponível e degradaria a visualização compacta.

- Reserva com `depositAmount > 0`: exibir `Sinal pago · R$ 0,00` usando a
  formatação monetária brasileira já adotada pelo aplicativo.
- Reserva sem valor, com valor nulo ou igual a zero: exibir `Sem sinal pago`.
- O status será compreensível por texto, além da cor de apoio, e continuará
  legível no desktop e no celular.

## Dados e limites

Nenhum schema, consulta ou mutação será alterado. O `StockItem` já carrega a
reserva ativa e seu campo opcional `reservation.depositAmount`; a mudança é
somente de apresentação para itens reservados.

## Verificação

Os testes da tela de estoque devem cobrir os dois estados: sinal positivo com
valor formatado e ausência de sinal para reserva sem valor. Os testes e a
checagem de tipos existentes precisam continuar passando.
