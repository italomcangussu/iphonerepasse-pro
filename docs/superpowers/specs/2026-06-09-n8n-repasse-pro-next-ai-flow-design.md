# N8N Repasse Pro Next AI Flow Design

## Contexto

O workflow n8n ativo `ia repasse-pro` atende a IA comercial da iPhone Repasse. Ele esta ativo em producao e usa o webhook `/webhook/repasse`.

A leitura do workflow atual mostrou 135 nos, organizados em 10 modulos:

1. Entrada e payload inicial.
2. Normalizacao de mensagem e midia.
3. Buffer de mensagem e lock Redis.
4. CRM e horario de loja.
5. Router, memory e FAQ comercial.
6. Bia 1 coleta e pre-consulta.
7. Estoque e simulacao.
8. Bia 2 sem estoque e montagem.
9. Envio WhatsApp e handoff Bia 2.
10. Handoff final e pos-reserva.

O bloco inicial de buffer ja funciona bem e deve ser preservado. Ele faz dedupe por `event_id`, consolida mensagens em rajadas, calcula espera dinamica, faz uma leitura pos-wait no Redis, escolhe a execucao vencedora e usa lock por conversa para evitar concorrencia.

O gargalo atual e que a inteligencia comercial esta espalhada entre muitos agentes e Code nodes: Router Agent, Memory 1, Memory 2, Parse Memory, Bia 1, Bia 2 com estoque, Bia 2 sem estoque e re-simulacao. Isso aumenta latencia, custo e risco de campos estruturados divergirem do resumo narrativo.

O endpoint local `crm-simulator-quote` aceita hoje um unico `desiredDevice` por chamada. Para simular ate dois aparelhos com boa performance e contrato limpo, o novo fluxo deve usar um contrato multi-aparelho compativel, em vez de depender de duas ramificacoes manuais e prompts longos no n8n.

## Objetivos

- Criar um workflow n8n totalmente novo, inicialmente inativo, para substituir o `ia repasse-pro` somente depois de validado.
- Preservar o mesmo contexto operacional e as mesmas funcoes externas do fluxo atual.
- Replicar a logica inicial de buffer e lock Redis do workflow atual.
- Melhorar inteligencia e performance reduzindo chamadas de IA quando a decisao pode ser deterministica.
- Simular compra e troca de iPhones com mais confiabilidade.
- Permitir simulacao de ate dois aparelhos de uma vez.
- Manter o contrato compacto de IA ja usado no repo, com `summary_short` e payload leve.
- Evitar segredos hardcoded no novo workflow; usar credenciais n8n, env ou headers recebidos do CRM.
- Manter o workflow atual ativo ate o novo fluxo passar em testes reais.

## Fora de Escopo

- Substituir imediatamente o webhook de producao `/webhook/repasse`.
- Alterar regras comerciais de preco, taxa de cartao, reserva ou aceite de trade-in sem necessidade tecnica.
- Criar reserva, venda ou baixa de estoque automaticamente a partir da simulacao.
- Reescrever todo o CRM.
- Criar uma nova UI para o simulador.

## Arquitetura Recomendada

Usar a opcao B: novo workflow n8n + extensao compativel do simulador para ate dois aparelhos.

O workflow novo deve nascer com nome claro, por exemplo `ia repasse-pro next`, com webhook de teste proprio e `active = false`. A troca de producao so acontece depois dos testes de contrato, simulacao e atendimento.

O desenho macro:

1. `Webhook Next`
2. `Normalize Payload`
3. bloco replicado de `Buffer + Redis Lock`
4. `Load CRM Context`
5. `Commerce State Extractor`
6. `Decision Engine`
7. `Inventory Search`
8. `Build Multi Quote Request`
9. `CRM Simulator Quote`
10. `Response Composer`
11. `Persist Lead State`
12. `Send WhatsApp`
13. `Human Handoff`, quando necessario

## Bloco Preservado: Buffer e Lock

O novo workflow deve reaproveitar a logica dos nos atuais:

- `Atualizar Estado Buffer`
- `Calcular Wait Buffer`
- `Redis Set Buffer`
- `Redis Get Pos-Wait`
- `Verificar vencedor`
- `Redis Get Lock`
- `Tentar Lock`
- `Redis Set Lock`
- `Redis Delete Buffer`
- `Redis Delete Lock`
- `Code Consolidador Payload Final`

Mudancas permitidas nesse bloco:

- Renomear nos para padrao mais claro.
- Remover referencias acidentais a nomes antigos se forem substituidas por campos estaveis.
- Manter dedupe, reply context, janela dinamica, vencedor e lock com a mesma semantica.

Mudancas nao permitidas:

- Diminuir protecao contra mensagens duplicadas.
- Remover lock por conversa.
- Trocar a chave Redis sem estrategia de compatibilidade para testes.

## Novo Nucleo de Inteligencia

O novo fluxo deve reduzir a quantidade de agentes.

### Commerce State Extractor

Responsavel por transformar mensagem atual, midia, `summary_short`, ultima resposta da IA e lead state em campos estruturados.

Pode usar um Code node deterministico primeiro e uma chamada de IA curta apenas quando houver ambiguidade.

Campos principais:

- `intent`
- `interest_type`
- `desired_devices`
- `trade_ins`
- `entries`
- `card_brand`
- `preferred_city`
- `missing_fields`
- `summary_short_next`
- `handoff_reason`

`desired_devices` deve aceitar ate dois itens:

```json
[
  {
    "slot": 1,
    "model": "iPhone 17 Pro",
    "capacity": "256GB",
    "color": "preto",
    "condition": "seminovo"
  },
  {
    "slot": 2,
    "model": "iPhone 17",
    "capacity": "128GB",
    "color": null,
    "condition": "novo"
  }
]
```

`trade_ins` deve aceitar ate dois itens, mas a primeira versao deve vincular no maximo um trade-in por aparelho desejado. Se o cliente mandar um cenario mais complexo, o fluxo transfere para humano.

### Decision Engine

Responsavel por decidir a proxima acao sem prompt longo:

- perguntar campo faltante;
- consultar estoque;
- simular;
- responder FAQ comercial;
- transferir para humano;
- encerrar spam/fora de escopo;
- continuar pos-simulacao.

Regras deterministicas devem prevalecer sobre texto narrativo de IA.

Exemplos:

- Se ha modelo desejado reconhecido e nao ha capacidade, perguntar capacidade.
- Se ha ate dois aparelhos com modelo/capacidade suficientes, consultar estoque.
- Se ha estoque e `card_brand`, simular.
- Se falta `card_brand`, perguntar bandeira antes de simular.
- Se o cliente pede dois aparelhos mas um deles nao tem estoque, compor resposta com o item encontrado e a indisponibilidade do outro.
- Se o cliente pede tres ou mais aparelhos, transferir para humano por complexidade.

## Estoque

O novo workflow deve consultar `stock_items` uma vez por turno quando a decisao for estoque/simulacao.

O filtro deve buscar candidatos para todos os `desired_devices` do turno, limitado a dois aparelhos. O Code node de selecao deve produzir:

```json
{
  "inventory": {
    "items": [
      {
        "slot": 1,
        "inventory_found": true,
        "stock_item_id": "uuid",
        "match_status": "exact",
        "best_item": {}
      },
      {
        "slot": 2,
        "inventory_found": false,
        "match_status": "not_found",
        "available_options": []
      }
    ]
  }
}
```

O match estrutural deve evitar confundir `iPhone 16` com `iPhone 16 Pro` ou `iPhone 16 Pro Max`.

## Simulador Multi-Aparelho

O endpoint `crm-simulator-quote` deve ser estendido de forma retrocompativel.

Contrato atual continua aceito:

```json
{
  "desiredDevice": {
    "stockItemId": "uuid"
  },
  "tradeIn": {
    "model": "iPhone 14",
    "capacity": "128GB",
    "color": "preto"
  },
  "entries": [
    { "type": "Pix", "amount": 500 }
  ],
  "cardBrand": "visa_master"
}
```

Novo contrato aceito:

```json
{
  "quotes": [
    {
      "slot": 1,
      "desiredDevice": {
        "stockItemId": "uuid"
      },
      "tradeIn": {
        "model": "iPhone 14",
        "capacity": "128GB",
        "color": "preto"
      },
      "entries": [
        { "type": "Pix", "amount": 500 }
      ]
    },
    {
      "slot": 2,
      "desiredDevice": {
        "stockItemId": "uuid"
      },
      "entries": []
    }
  ],
  "cardBrand": "visa_master"
}
```

Regras do endpoint:

- Aceitar no maximo dois itens em `quotes`.
- Reusar a mesma logica de calculo do contrato atual por item.
- Buscar regras de trade-in, ajustes, taxas de cartao e estoque uma unica vez por request quando possivel.
- Retornar `success: true`, `quotes`, `combinedSummary` e `messageText`.
- Se um item falhar e outro for valido, retornar resultado parcial com `success: true`, `partial: true` e erro por slot.
- Se todos falharem, retornar erro geral.
- Preservar o retorno atual para chamadas antigas.

Formato de retorno recomendado:

```json
{
  "success": true,
  "partial": false,
  "quotes": [
    {
      "slot": 1,
      "success": true,
      "summary": {},
      "installments": [],
      "messageText": "..."
    }
  ],
  "combinedSummary": {
    "quoteCount": 1,
    "cardBrand": "visa_master"
  },
  "messageText": "..."
}
```

## Resposta ao Cliente

O novo `Response Composer` deve ser uma chamada de IA curta ou um template deterministico, dependendo da acao.

O Composer recebe apenas:

- nome do cliente;
- mensagem atual consolidada;
- `summary_short`;
- estado comercial estruturado;
- resultado de estoque;
- resultado de simulacao;
- status da loja;
- acao decidida.

Ele deve retornar JSON:

```json
{
  "messages": ["texto 1", "texto 2"],
  "transfer": false,
  "handoff_reason": null,
  "summary_short_next": "..."
}
```

O texto final deve evitar inventar estoque, preco ou simulacao. Valores comerciais so podem vir de estoque/simulador.

## Persistencia

Reutilizar o estado existente do CRM sempre que possivel.

Persistir:

- `summary_short`
- campos estruturados ja aceitos por `crm-leads-api`
- `simulation_done`
- `simulation_count`
- `last_simulation_total`
- `stock_item_id`, quando houver um item principal

Para dois aparelhos, a primeira versao pode persistir detalhes completos em `summary_operational` ou no payload de estado se o endpoint ja aceitar um campo apropriado. Se nao houver campo persistente adequado, a memoria compacta deve registrar os dois cenarios de forma legivel e o workflow deve manter o payload do turno ate a resposta.

Nao adicionar coluna nova antes de confirmar que o estado atual nao e suficiente.

## Seguranca e Credenciais

O novo workflow nao deve copiar o Set node `credenciais` com segredos literais.

Preferencias:

1. Usar credenciais n8n para Supabase, Redis, OpenRouter/Gemini e HTTP.
2. Quando o CRM enviar headers validos, propagar os headers recebidos.
3. Para chamadas internas n8n -> Edge Function, usar `x-api-key` vindo de credencial/env, nunca literal no Code node.

## Plano de Testes

### Backend

- Teste de contrato antigo de `crm-simulator-quote` continua passando.
- Novo teste para `quotes` com um aparelho sem trade-in.
- Novo teste para `quotes` com dois aparelhos.
- Novo teste para resultado parcial.
- Novo teste para limite de mais de dois aparelhos.
- `deno check` na Edge Function alterada.

### Workflow

Validar fluxo novo com dados representativos:

1. Texto simples: "quero um 17 pro 256".
2. Compra com entrada: "17 pro 256, dou 1000 de pix".
3. Troca: cliente quer comprar um iPhone e dar outro iPhone como entrada.
4. Dois aparelhos: "simula um 17 pro 256 e um 17 128".
5. Dois aparelhos com um indisponivel.
6. Audio/imagem quando o payload trouxer midia.
7. Mensagens em rajada para confirmar buffer.
8. Reply context para resposta curta como "256".
9. Cliente pede tres aparelhos, deve transferir.
10. Falha no simulador, deve transferir ou pedir humano sem enviar valor inventado.

### Substituicao

O workflow atual so deve ser substituido depois de:

- workflow novo criado como inativo;
- testes com webhook de teste aprovados;
- simulador multi-aparelho deployado e validado;
- logs sem erros em casos representativos;
- plano de rollback documentado;
- alteracao de webhook feita em uma janela controlada.

## Criterios de Aceite

- O novo workflow existe separado do atual.
- O workflow atual continua ativo ate aprovacao final.
- Buffer e lock se comportam como no fluxo atual.
- Simulacao de um aparelho continua compativel com o contrato antigo.
- Simulacao de dois aparelhos funciona em um unico request ao simulador.
- O fluxo nao envia resposta comercial com estoque/preco inventado.
- O numero de chamadas de IA por atendimento normal e menor que o fluxo atual.
- Segredos nao ficam hardcoded em nos Set ou Code.
- O usuario consegue revisar e aprovar antes da troca de producao.
