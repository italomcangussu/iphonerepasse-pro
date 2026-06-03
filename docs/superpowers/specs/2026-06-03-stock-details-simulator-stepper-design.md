# Stock Details Simulator Stepper Design

## Context

O modal `Detalhes do Aparelho` recebeu um botão `Simulador` que reaproveita o motor de cálculo do CRM (`calculateSimulatorQuote`) com o aparelho do estoque já escolhido. A primeira versão mostra dados de trade-in, entrada, bandeira, saída e um resumo lateral, mas ainda expõe apenas as 6 primeiras parcelas mesmo que o motor calcule até 18x.

O objetivo desta evolução é melhorar a UI/UX do simulador dentro do modal, reduzir densidade visual e permitir que o vendedor escolha mais opções de parcelamento, com abertura padrão em 18x.

## Approved Direction

Usar um fluxo em 3 passos dentro do modal:

1. `Dados`
2. `Parcelas`
3. `Enviar`

O passo `Parcelas` usa o comportamento `alcance máximo`: o vendedor escolhe até quantas parcelas enviar, de 1x até N. O valor padrão ao abrir o simulador é 18x.

## Goals

- Tornar o simulador mais claro durante atendimento comercial.
- Evitar que todos os campos, parcelas e ações disputem atenção ao mesmo tempo.
- Permitir mensagem com parcelas de 1x até 18x.
- Manter o aparelho desejado travado no item do modal de detalhes.
- Manter a saída escolhível entre copiar para CRM e abrir WhatsApp.
- Reaproveitar o motor existente de cálculo, taxas e texto sempre que possível.

## Non-Goals

- Criar envio automático via provedor do CRM.
- Permitir seleção avulsa de parcelas não-contíguas.
- Criar reserva, venda, transação financeira ou alteração de estoque.
- Alterar a página principal do CRM Simulador neste ciclo, exceto se uma extração compartilhada for necessária para evitar duplicação relevante.

## User Flow

### Open

O vendedor abre `Detalhes do Aparelho` e clica em `Simulador`.

O modal do simulador inicia no passo `Dados`, com:

- aparelho escolhido exibido como contexto fixo;
- preço do aparelho;
- campos de trade-in;
- campo de entrada;
- bandeira do cartão;
- saída desejada (`Copiar para CRM` ou `Abrir WhatsApp`).

### Step 1: Dados

O vendedor informa dados opcionais:

- trade-in: modelo, armazenamento, cor, ajustes e valor final recebido;
- entrada: valor recebido fora do cartão;
- bandeira: `Visa / Master` ou `Outras`;
- saída: `CRM` ou `WhatsApp`.

O resumo do saldo no cartão deve atualizar em tempo real.

O botão principal avança para `Parcelas`. Se houver erro de simulação, exibir feedback claro e manter o vendedor neste passo.

### Step 2: Parcelas

O passo mostra:

- saldo no cartão;
- controle `Enviar até`;
- teto padrão `18x`;
- indicação de quantas parcelas entrarão na mensagem;
- prévia da primeira e da última parcela do alcance;
- opção de voltar para dados.

O controle aceita valores de 1 a 18. A mensagem gerada usa somente as parcelas de 1x até o teto escolhido.

Exemplo: se o teto for `12x`, a mensagem inclui 1x a 12x. Se for `18x`, inclui 1x a 18x.

### Step 3: Enviar

O passo final mostra:

- resumo do aparelho;
- saldo a pagar;
- trade-in e entrada aplicados;
- bandeira;
- alcance de parcelas escolhido;
- prévia do texto que será enviado/copiado.

A ação primária depende da saída escolhida:

- `Copiar para CRM`: copia o texto final para a área de transferência.
- `Abrir WhatsApp`: abre `https://wa.me/?text=...` com o texto final.

Após a ação, exibir toast de sucesso. Não fechar automaticamente o modal.

## Layout

### Desktop

O modal deve usar uma composição de stepper:

- lateral ou cabeçalho compacto com os 3 passos;
- área central para o passo atual;
- resumo persistente do saldo e da prévia à direita quando houver espaço.

O conteúdo deve caber melhor que a versão atual, evitando que o vendedor precise rolar para encontrar as ações principais.

### Mobile

Em telas menores:

- os passos aparecem como tabs/chips horizontais no topo;
- o resumo fica abaixo do conteúdo do passo;
- o footer mantém as ações principais visíveis;
- campos e controles têm altura confortável para toque.

## Data And State

Estado novo necessário:

- `activeSimulatorStep`: `dados | parcelas | enviar`;
- `maxInstallmentsToShare`: número entre 1 e 18, padrão 18.

Estado existente preservado:

- trade-in selecionado;
- ajustes selecionados;
- valor final recebido;
- entradas;
- bandeira;
- saída CRM/WhatsApp.

O cálculo continua usando `calculateSimulatorQuote`. A lista completa de `quote.installments` continua sendo calculada até `CARD_INSTALLMENTS_MAX`.

A mensagem final deve usar uma versão filtrada das parcelas:

```ts
quote.installments.slice(0, maxInstallmentsToShare)
```

Essa filtragem deve ser aplicada somente ao texto e à prévia de envio. O resumo financeiro principal continua baseado no saldo calculado.

## Message Behavior

A mensagem enviada ou copiada mantém o formato atual do simulador, com alteração no bloco de parcelas:

- se `maxInstallmentsToShare` for 18, pode manter `Parcelas disponíveis`;
- se for menor que 18, indicar que são parcelas de `1x até Nx`.

O texto deve evitar ambiguidade: cliente e vendedor precisam entender que as opções exibidas são as opções enviadas naquela simulação, não o limite técnico do sistema.

## Validation And Errors

- Se o aparelho escolhido não tiver preço válido, bloquear avanço e mostrar erro.
- Se trade-in parcial for informado sem modelo/armazenamento, bloquear avanço.
- Se entrada e trade-in excederem o valor do aparelho, bloquear avanço.
- Se `maxInstallmentsToShare` sair do intervalo 1-18, normalizar para o limite válido.
- Se clipboard falhar, mostrar erro.
- Se WhatsApp abrir, mostrar toast confirmando abertura.

## Accessibility

- Os passos devem ser botões com estado atual perceptível.
- O controle de teto de parcelas deve ter label acessível.
- A prévia das parcelas deve ser textual, não apenas visual.
- Botões principais devem manter nomes claros: `Continuar`, `Voltar`, `Copiar para CRM`, `Abrir WhatsApp`.

## Testing

Adicionar ou atualizar testes cobrindo:

- abrir simulador no passo `Dados` com aparelho travado;
- avançar para `Parcelas` com teto padrão 18x;
- reduzir teto para 12x e verificar que a mensagem copiada contém 12x e não contém 13x;
- manter erro no passo atual quando a simulação é inválida;
- alternar saída para WhatsApp e abrir `wa.me` com o texto filtrado;
- garantir que o fluxo anterior de detalhes, baixar fotos e compartilhar WhatsApp do aparelho não regride.

## Implementation Notes

O arquivo `StockDetailsModal.tsx` está crescendo e já concentra galeria, detalhes, compartilhamento e simulador. Para implementar esta evolução com menor risco, considerar extrair um componente local ou arquivo dedicado, por exemplo:

- `components/StockSimulatorModal.tsx`
- ou `components/stock/StockSimulatorModal.tsx`

Esse componente receberia:

- `item`;
- `simulatorTradeInValues`;
- `simulatorTradeInAdjustments`;
- `cardFeeSettings`;
- `open`;
- `onClose`.

Essa extração deixa o modal de detalhes responsável apenas por abrir o simulador.

## Approved Decisions

- Design visual escolhido: fluxo em passos.
- Comportamento de parcelas escolhido: alcance máximo, de 1x até N.
- Teto padrão de parcelas ao abrir: 18x.
- Seleção livre de parcelas avulsas fica fora deste ciclo.
