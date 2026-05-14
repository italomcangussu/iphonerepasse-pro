# PDV: Edicao Completa em Modal Overflow

## Contexto

O historico do PDV ja possui dois caminhos de edicao:

- `Editar`, para ajustes simples de venda concluida.
- `Edicao Completa`, que hoje confirma a acao, cancela/remove a venda, grava um draft no `localStorage` e redireciona o usuario para o fluxo de nova venda no PDV.

Esse segundo caminho obriga o usuario a passar novamente por um fluxo guiado e mistura correcao de venda existente com criacao de nova venda. A nova experiencia deve manter a venda no historico e editar tudo em um modal com overflow, sem wizard e sem fallback para o PDV.

## Objetivo

Trocar somente a acao `Edicao Completa` por um modal dedicado de edicao completa. O botao `Editar` simples continua separado e com seu comportamento atual.

O novo modal deve permitir revisar e alterar todos os componentes principais da venda em uma unica tela com scroll e navegacao por abas internas:

- resumo da venda;
- itens vendidos;
- trade-ins;
- pagamentos;
- totais e validacoes.

## Fora de Escopo

- Remover ou substituir o fluxo `Editar` simples.
- Criar um novo wizard ou reutilizar o wizard de nova venda.
- Manter fallback baseado em `removeSale`, `localStorage` e navegacao para `/pdv`.
- Criar historico/auditoria de alteracoes.
- Alterar regras de permissao fora do que ja controla as acoes de admin no historico.

## Arquitetura

Criar um componente dedicado para edicao completa em `components/SaleCompleteEditModal.tsx`. Ele deve ficar fora do corpo principal de `PDVHistory.tsx` para reduzir a responsabilidade da pagina.

`PDVHistory` continua responsavel por:

- listar e filtrar vendas;
- abrir detalhes;
- abrir edicao simples;
- abrir impressao;
- cancelar vendas;
- abrir o novo modal de edicao completa.

O novo modal recebe:

- `open`;
- `sale`;
- `onClose`;
- dados de apoio: clientes, vendedores, estoque;
- `onSave`, que chama `updateSale(sale.id, payload)`.

`updateSale` permanece a fonte de verdade para persistencia e recomposicao de efeitos derivados da venda. O modal nao deve chamar `removeSale`, nao deve gravar draft no `localStorage` e nao deve navegar para o PDV.

## UX do Modal

O modal deve ser grande (`xl`) e usar overflow interno. Ele deve ter abas horizontais fixas no topo do conteudo:

- `Resumo`;
- `Itens vendidos`;
- `Trade-in`;
- `Pagamentos`;
- `Totais`.

As abas nao representam passos obrigatorios. O usuario pode navegar livremente entre secoes. Clicar em uma aba rola o conteudo ate a secao correspondente. Em telas mobile, a barra de abas deve ser horizontal e rolavel.

O rodape do modal deve manter as acoes principais:

- `Cancelar`;
- `Salvar Alteracoes`.

O salvamento deve ser unico e atomico do ponto de vista da UI: se qualquer secao estiver inconsistente, nada e salvo e o usuario recebe erro claro.

## Campos e Comportamento

O modal deve reaproveitar a logica funcional ja existente no `SaleEditModal` atual:

- hidratar estado inicial a partir da venda;
- editar cliente, vendedor, data e observacoes;
- editar desconto por valor ou percentual;
- adicionar, remover e alterar itens vendidos;
- editar valor original e valor negociado de cada item vendido;
- adicionar, remover e alterar trade-ins;
- selecionar trade-in do estoque quando aplicavel ou editar dados manualmente;
- adicionar, remover e alterar formas de pagamento;
- preservar campos especificos de cartao, cartao debito e devedor;
- recalcular totais derivados durante a edicao.

Totais derivados esperados:

- `originalSubtotal`;
- `negotiatedSubtotal`;
- `discount`;
- `discountType`;
- `discountPercent`;
- `tradeInValue`;
- `total`;
- `paymentMethods`;
- `items`;
- `tradeIns`.

## Validacoes

O modal deve bloquear o salvamento quando:

- cliente ou vendedor estiverem vazios;
- nao houver item vendido;
- algum item vendido selecionado nao existir no estoque nem no snapshot da venda;
- o total liquido em contas for maior que zero e nao houver forma de pagamento financeiro com valor maior que zero;
- a soma de pagamentos financeiros mais trade-in nao igualar o total bruto da venda;
- algum valor numerico obrigatorio estiver invalido ou negativo.

Mensagens de erro podem aparecer em banner geral e, quando simples, perto da secao afetada. O requisito principal e impedir salvamento parcial ou inconsistente.

## Persistencia

Ao salvar, o modal monta um `Partial<Sale>` completo e chama:

```ts
await updateSale(sale.id, payload);
```

O fluxo antigo de edicao completa deve ser removido da acao:

- nao abrir `ConfirmDialog` de edicao completa;
- nao chamar `handleEditCompleteConfirmed`;
- nao chamar `removeSale`;
- nao gravar `pdv:draft:v1`;
- nao chamar `navigate('/pdv')`.

Depois de salvar com sucesso:

- exibir toast de sucesso;
- fechar o modal;
- manter o usuario no historico;
- se a venda estiver aberta em detalhes, fechar ou atualizar o detalhe conforme o padrao atual mais simples.

## Testes

Atualizar ou adicionar cobertura em `pages/PDVHistory.test.tsx`:

- clicar em `Edicao Completa` abre o novo modal;
- a abertura do modal nao chama `removeSale`;
- o modal exibe abas/secoes esperadas;
- salvar uma alteracao completa chama `updateSale` com payload contendo itens, pagamentos, trade-ins e totais;
- validacao bloqueia salvamento quando pagamentos financeiros + trade-in nao fecham com o total bruto.

Verificacao esperada:

- teste focado de `PDVHistory`;
- `npm run typecheck`.

## Criterios de Aceite

- `Editar` simples continua funcionando como antes.
- `Edicao Completa` abre modal overflow com abas horizontais fixas.
- O usuario consegue alterar componentes completos da venda sem passar pelo wizard.
- O fluxo nao remove/cancela a venda antes de salvar.
- O fluxo nao cria draft no `localStorage`.
- O fluxo nao navega para `/pdv`.
- Salvamento usa `updateSale`.
- Validacoes impedem estado financeiro inconsistente.
- Testes focados e typecheck passam.

## Riscos e Mitigacoes

Risco: duplicar muita logica entre `SaleEditModal` e o novo modal.
Mitigacao: extrair o componente completo a partir da logica ja existente, mantendo o escopo limitado e evitando novas abstracoes prematuras.

Risco: o modal ficar longo demais em telas pequenas.
Mitigacao: usar overflow interno, abas horizontais rolaveis e secoes com titulos claros.

Risco: divergencia entre totais exibidos e payload salvo.
Mitigacao: centralizar os calculos derivados dentro do modal e cobrir salvamento com teste focado.
