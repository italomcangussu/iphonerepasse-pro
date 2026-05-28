# CRM Plus Simulador Trade-in Design

## Contexto

O CRM Plus precisa de uma nova pagina "Simulador" para apoiar vendedores e admins durante atendimentos de venda com trade-in, entradas nao-cartao e parcelamento com acrescimo de taxa. A simulacao deve gerar tanto um resumo visual no frontend quanto um texto pronto para compartilhar no WhatsApp/CRM.

O sistema ja possui estoque real, configuracao de taxas de cartao em `card_fee_settings` e utilitarios de calculo em `utils/cardFees.ts`. O novo simulador deve reaproveitar essa regra de taxa e centralizar as regras de trade-in no Supabase para uso pela tela e por uma API interna.

## Objetivos

- Disponibilizar uma pagina "Simulador" no menu operacional do CRM Plus para vendedores e admins.
- Permitir escolher um aparelho do estoque real, preferencialmente com status disponivel ou reservado.
- Permitir simular tambem um aparelho manual fora do estoque.
- Sugerir valor de trade-in por modelo e armazenamento a partir de configuracoes persistidas.
- Permitir ajustes configuraveis por admins, como reduzir R$ 500 para marcas de uso na lateral em um modelo especifico.
- Permitir que o vendedor edite manualmente o valor final de recebimento do trade-in.
- Aceitar entradas nao-cartao, como Pix, dinheiro e debito, antes do saldo ser enviado para simulacao no cartao.
- Mostrar parcelamento ate 18x usando as taxas de cartao existentes.
- Gerar texto pronto para WhatsApp/CRM com o mesmo conteudo calculado na tela.
- Expor uma Edge Function autenticada por JWT Supabase para sistemas internos/agente IA obterem a mesma simulacao e mensagem.

## Fora de Escopo

- Criar venda, reserva, transacao financeira ou alteracao de estoque a partir do simulador.
- Autenticacao por API token proprio para sistemas externos.
- Precificacao automatica por bateria, estado fisico ou cor fora das regras configuradas por admins.
- Envio automatico da mensagem pelo WhatsApp; a entrega inicial e copiar/usar o texto gerado.

## Perfis e Acesso

A pagina "Simulador" deve ficar disponivel para `seller` e `admin` no CRM Plus.

Admins tambem terao acesso a configuracao do simulador: valores base e ajustes. Vendedores apenas usam as configuracoes para simular, sem permissao de alteracao.

No Supabase, as tabelas de configuracao devem ter RLS com leitura para vendedores/admins e escrita apenas para admins.

## Arquitetura

A solucao deve seguir a abordagem de motor compartilhado + Edge Function:

1. Um motor de simulacao puro calcula trade-in, ajustes, entradas, saldo liquido no cartao, parcelas e texto final.
2. A pagina React usa esse motor para resposta instantanea quando os dados necessarios ja estao carregados.
3. A Edge Function `crm-simulator-quote` usa o mesmo contrato/regra para atender chamadas internas autenticadas.
4. Supabase armazena configuracoes de trade-in e ajustes, enquanto `card_fee_settings` continua sendo a fonte das taxas de cartao.

O motor nao deve depender de componentes React. Ele deve aceitar dados normalizados e retornar um resultado estruturado, facilitando testes unitarios e o reuso pela API.

## Tela e Fluxo

O layout aprovado e a "mesa de simulacao":

- Coluna esquerda: aparelho desejado, trade-in, ajustes e entradas.
- Coluna direita: resumo, parcelamento e mensagem pronta.

### Aparelho Desejado

O fluxo principal comeca pela busca de um aparelho do estoque com status `Disponivel` ou `Reservado`. Ao escolher um item, a tela preenche modelo, capacidade, cor e preco de venda.

Tambem deve existir um modo manual para informar descricao, modelo/capacidade/cor quando aplicavel e preco de venda. Esse modo cobre vendas consultivas de aparelhos que ainda nao estao no estoque.

### Trade-in

O vendedor informa modelo, armazenamento e cor do aparelho recebido. Ao selecionar modelo e armazenamento, o sistema busca o valor base configurado.

Depois, a tela apresenta ajustes ativos compativeis:

- ajustes especificos para modelo/capacidade;
- ajustes especificos apenas para modelo;
- ajustes globais, se existirem.

A soma dos ajustes altera o valor sugerido. O campo "valor final recebido" permanece editavel, permitindo negociacao manual.

### Entradas

O vendedor pode adicionar entradas nao-cartao com forma de pagamento e valor. Exemplos: Pix, dinheiro, cartao debito ou outro abatimento operacional aceito pelo negocio.

O saldo para cartao e:

`preco do aparelho - valor final do trade-in - soma das entradas`

Se as entradas excederem o saldo, a tela deve bloquear a simulacao e explicar o problema.

### Reserva/Sinal

O valor fixo de R$ 250,00 deve aparecer como informacao de reserva/sinal no texto gerado. Ele nao entra automaticamente no calculo. Se o cliente efetivamente pagar esse sinal, o vendedor deve adiciona-lo como entrada, por exemplo Pix de R$ 250,00.

### Cartao

O vendedor escolhe bandeira `visa_master` ou `outras`. O simulador usa `getCardRate` e `calculateCardCharge` para gerar a lista de 1x a 18x, mostrando parcela e total para preservar o valor liquido desejado.

## Modelo de Dados

### `simulator_trade_in_values`

Armazena valores base por modelo e armazenamento.

Campos:

- `id uuid primary key`
- `model text not null`
- `capacity text not null`
- `base_value numeric(12,2) not null`
- `is_active boolean not null default true`
- `created_at timestamptz not null default now()`
- `updated_at timestamptz not null default now()`

Deve haver uma restricao unica para evitar duplicidade ativa por `model` e `capacity`, considerando normalizacao simples de espacos/caixa no nivel da aplicacao ou do banco.

Seed inicial:

| Modelo | Armazenamento | Valor |
| --- | --- | ---: |
| iPhone 11 | 64GB | 800 |
| iPhone 11 | 128GB | 1100 |
| iPhone 12 | 64GB | 1000 |
| iPhone 12 | 128GB | 1250 |
| iPhone 13 | 128GB | 1700 |
| iPhone 13 | 256GB | 1900 |
| iPhone 14 | 128GB | 1900 |
| iPhone 14 | 256GB | 2100 |
| iPhone 15 | 128GB | 2600 |
| iPhone 15 | 256GB | 2900 |
| iPhone 15 Pro | 128GB | 3100 |
| iPhone 15 Pro | 256GB | 3350 |
| iPhone 15 Pro Max | 256GB | 4100 |
| iPhone 15 Pro Max | 512GB | 4500 |
| iPhone 16 | 128GB | 3000 |
| iPhone 16 | 256GB | 3300 |
| iPhone 16 Pro Max | 256GB | 5000 |

### `simulator_trade_in_adjustments`

Armazena variaveis de ajuste aplicaveis ao trade-in.

Campos:

- `id uuid primary key`
- `label text not null`
- `model text null`
- `capacity text null`
- `amount_delta numeric(12,2) not null`
- `is_active boolean not null default true`
- `created_at timestamptz not null default now()`
- `updated_at timestamptz not null default now()`

`amount_delta` deve aceitar valores negativos e positivos. Exemplo: `-500.00` para marcas de uso na lateral.

## API Interna

A Edge Function `crm-simulator-quote` deve exigir JWT Supabase valido. Ela nao precisa de API token proprio.

### Entrada

Payload conceitual:

```json
{
  "desiredDevice": {
    "stockItemId": "uuid-opcional",
    "manual": {
      "description": "iPhone 17 Pro Max 512GB Azul",
      "price": 9950
    }
  },
  "tradeIn": {
    "model": "iPhone 15 Pro Max",
    "capacity": "256GB",
    "color": "Branco",
    "selectedAdjustmentIds": ["uuid-ajuste"],
    "manualReceivedValue": 4100
  },
  "entries": [
    { "type": "Pix", "amount": 1000 }
  ],
  "cardBrand": "visa_master"
}
```

Regras:

- `desiredDevice.stockItemId` tem prioridade sobre `desiredDevice.manual`.
- Se `stockItemId` for informado, a funcao deve validar que o item existe e esta disponivel/reservado.
- `manualReceivedValue` substitui o valor calculado por tabela/ajustes quando informado.
- `entries` nao deve aceitar valores negativos.

### Saida

Payload conceitual:

```json
{
  "summary": {
    "desiredDeviceLabel": "iPhone 17 Pro Max 512GB Azul",
    "desiredDevicePrice": 9950,
    "tradeInLabel": "iPhone 15 Pro Max 256GB Branco",
    "tradeInBaseValue": 4100,
    "tradeInAdjustmentsTotal": 0,
    "tradeInReceivedValue": 4100,
    "entriesTotal": 1000,
    "cardNetAmount": 4850,
    "reservationHintAmount": 250
  },
  "installments": [
    {
      "installments": 1,
      "feeRate": 2.99,
      "installmentAmount": 4999.48,
      "customerAmount": 4999.48,
      "feeAmount": 149.48
    }
  ],
  "messageText": "..."
}
```

## Mensagem Gerada

A mensagem deve ser gerada por uma funcao unica de formatacao para evitar diferencas entre tela e API.

Formato base:

```text
📱 iPhone 17 Pro Max 512GB R$ 9.950,00 Azul

📲 iPhone 15 Pro Max 256GB Branco R$ 4.100,00
Reserva/sinal opcional: R$ 250,00 via Pix

Entradas:
Pix: R$ 1.000,00

Resta a pagar R$ 4.850,00

💳 *Simulação de Parcelamento*

🏷️ Bandeira: *Visa / Master*
🎯 Valor líquido desejado: *R$ 4.850,00*

📋 *Parcelas disponíveis*
...

🗓️ Gerado em: 28/05/2026, 11:33:33
```

O texto pode manter emojis e separadores do exemplo original. Os valores devem ser formatados em `pt-BR`. A data/hora deve usar o horario local do usuario no frontend e um timezone definido no backend, preferencialmente `America/Fortaleza`, quando gerada pela Edge Function.

## Estados de Erro

A tela e a API devem tratar:

- aparelho de estoque inexistente;
- aparelho de estoque fora de `Disponivel` ou `Reservado`;
- preco manual invalido;
- trade-in sem valor padrao ativo;
- ajuste selecionado inexistente, inativo ou incompativel;
- entrada negativa;
- soma de entradas maior que o saldo;
- bandeira de cartao ausente ou invalida;
- falha ao carregar configuracoes;
- ausencia de permissao para editar configuracoes.

Na tela, os erros devem aparecer perto do campo correspondente sempre que possivel. Na API, a resposta deve retornar erro estruturado com codigo estavel e mensagem humana curta.

## Configuracao Admin

A configuracao do simulador deve ficar em uma aba admin dentro da propria pagina `Simulador`, visivel apenas para admins. Vendedores devem ver apenas a mesa de simulacao.

Funcionalidades:

- listar valores base por modelo/capacidade;
- criar, editar, ativar/desativar valores base;
- listar ajustes;
- criar, editar, ativar/desativar ajustes;
- permitir ajustes globais, por modelo ou por modelo/capacidade;
- validar que valores base nao sejam negativos;
- validar que labels de ajustes sejam claros e nao vazios.

## Testes

Testes unitarios:

- motor calcula saldo com trade-in, ajustes e entradas;
- `manualReceivedValue` substitui o valor sugerido;
- entradas maiores que saldo geram erro;
- parcelamento usa `calculateCardCharge` e taxas existentes;
- mensagem final inclui dados, reserva opcional, entradas, saldo, parcelas e data.

Testes de pagina:

- vendedor acessa `Simulador`;
- admin acessa `Simulador` e configuracoes;
- selecao de estoque preenche dados e preco;
- modo manual permite preco fora do estoque;
- trade-in puxa valor padrao e aplica ajuste;
- campo valor final e editavel;
- copiar mensagem usa o texto gerado.

Testes de API:

- Edge Function exige JWT;
- stockItemId disponivel retorna simulacao;
- aparelho manual retorna simulacao;
- payload invalido retorna erro estruturado;
- resposta da API bate com o motor usado no frontend para um caso base.

Testes de banco:

- migrations criam tabelas, seeds e politicas;
- vendedores leem configuracoes;
- vendedores nao escrevem configuracoes;
- admins escrevem configuracoes.

## Criterios de Aceite

- A pagina "Simulador" aparece no CRM Plus para vendedores e admins.
- O simulador funciona com aparelho do estoque disponivel/reservado e com aparelho manual.
- Admin consegue manter valores base e ajustes no Supabase.
- Vendedor consegue aplicar ajustes e ainda editar o valor final do trade-in.
- Entradas nao-cartao reduzem o saldo antes do parcelamento.
- Reserva/sinal de R$ 250,00 aparece como informacao, sem alterar calculo automaticamente.
- Parcelas de 1x a 18x usam as taxas atuais de cartao.
- Texto copiado corresponde ao resumo exibido.
- Edge Function autenticada retorna a mesma simulacao e mensagem para sistemas internos.
