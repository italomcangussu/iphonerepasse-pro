# Repasse AI Deterministic Core Design

## Contexto

A auditoria consolidada do workflow `ia repasse-pro v2 avancada` mostrou quatro problemas principais:

1. O harness reutiliza a mesma conversa do CRM, permitindo que o histórico retornado por `get_lead_full_data` contamine cenários mesmo após limpar memória e `lead_state`.
2. O fluxo de troca reconhece o trade-in, mas pode priorizar perguntas sobre o aparelho desejado e não concluir a avaliação essencial antes da simulação.
3. A comparação entre dois aparelhos ainda depende de agentes e memória narrativa, embora o endpoint `crm-simulator-quote` já aceite até duas cotações nos modos `comparison` e `bundle`.
4. O caminho crítico possui Router, dois agentes de memória e agentes de resposta em cascata, elevando latência e permitindo decisões conflitantes.

O workflow atual possui 135 nós. Seu buffer, deduplicação e lock Redis são úteis e devem ser preservados. A mudança deve concentrar-se no núcleo comercial entre o carregamento do contexto e o envio da resposta.

## Prioridades E Metas

A ordem de prioridade é:

1. Confiabilidade.
2. Conversão comercial.
3. Performance.

A fase 1 deve:

- manter a IA conduzindo o atendimento até a simulação;
- transferir fechamento, reserva e exceções definidas para humano;
- atingir P95 de até 45 segundos por turno;
- impedir contexto cruzado entre leads, conversas e cenários;
- entrar em produção por shadow e canário;
- preservar o webhook de produção até a promoção controlada.

## Estratégia Escolhida

Será adotado um núcleo determinístico híbrido.

O n8n permanece como orquestrador de:

- webhook, mídia, deduplicação, buffer e lock;
- carregamento de contexto;
- chamadas ao extractor, estoque e simulador;
- execução da ação decidida;
- retries, tratamento de erro, persistência e envio.

O Supabase permanece como fonte de:

- estado comercial persistente;
- estoque e configurações comerciais;
- cálculos de simulação;
- histórico de propostas e re-simulações;
- telemetria por turno.

O app CRM oferece:

- visibilidade do estado e da ação pendente;
- supervisão e correção humana;
- histórico de propostas;
- métricas de qualidade e performance.

Router Agent, Memory 1 e Memory 2 deixam de ser autoridades concorrentes. Durante a migração, podem executar em shadow para comparação, sem controlar a resposta.

## Arquitetura Por Turno

Cada turno segue esta sequência:

1. Receber e normalizar o evento.
2. Aplicar deduplicação, buffer e lock por conversa.
3. Carregar lead, conversa, estado comercial e última interação relevante.
4. Extrair fatos da mensagem atual.
5. Reconciliar fatos com o estado canônico usando regras de autoridade.
6. Executar o Decision Engine para produzir uma única ação.
7. Chamar estoque, simulador ou handoff somente quando exigido pela ação.
8. Compor a resposta dentro do contrato da ação.
9. Persistir estado e eventos com controle de versão.
10. Enviar uma ou mais mensagens conforme o modo de entrega.

O texto narrativo do histórico pode ajudar a interpretar a mensagem, mas não pode sobrescrever fatos atuais ou estado estruturado validado.

## Commerce State

O estado canônico será versionado e deverá representar:

- `schema_version`;
- `state_version`;
- `turn_id`;
- `conversation_id`;
- `intent`;
- `interest_type`;
- `simulation_mode`: `single`, `comparison` ou `bundle`;
- até dois `desired_devices`;
- até dois slots de cotação;
- dados de trade-in;
- entrada em Pix ou dinheiro;
- cartões e grupos de taxa;
- cidade e contexto de estoque;
- `pending_question`;
- `active_quote_slot`;
- `missing_fields`;
- `next_action`;
- proposta e versão de pagamento ativas;
- motivo de handoff, quando houver.

O Decision Engine deve produzir exatamente uma ação por turno. Exemplos:

- `ask_target_identity`;
- `ask_tradein_consent`;
- `send_tradein_questionnaire`;
- `ask_remaining_tradein_fields`;
- `compare_inventory`;
- `search_inventory`;
- `simulate_quote`;
- `revise_payment`;
- `answer_commercial_faq`;
- `handoff`.

## Extração E Reconciliação

Regras e parsers determinísticos devem tratar primeiro:

- modelos e variantes;
- capacidades;
- cores;
- cidades;
- valores monetários;
- bandeiras;
- quantidade de parcelas;
- sinais explícitos de comparação ou compra conjunta;
- respostas estruturadas do questionário de trade-in.

Uma chamada curta de IA pode resolver ambiguidades remanescentes. A saída deve ser estruturada, validada e limitada aos campos permitidos.

Mensagens como `dele`, `esse`, `o Pro` ou respostas curtas só podem ser resolvidas quando houver `pending_question` ou `active_quote_slot` válido. Sem âncora confiável, o fluxo pede confirmação curta.

## Fluxo De Trade-In

### Lista Essencial

Quando houver sinal de troca e o modelo do aparelho de entrada estiver identificado, o fluxo verifica tudo que o cliente já informou e calcula as pendências desta lista:

- armazenamento;
- cor;
- arranhões;
- contato com líquido;
- marcas de uso nas laterais;
- troca de peças;
- caixa e cabo originais;
- percentual de bateria;
- garantia Apple;
- validade da garantia, somente quando houver garantia ativa.

O modelo não é perguntado novamente quando já estiver identificado.

### Gate De Consentimento

O pedido prévio de autorização permanece obrigatório.

Estados recomendados:

- `not_started`;
- `awaiting_consent`;
- `collecting`;
- `complete`;
- `declined`;
- `disqualified`.

Ao receber consentimento claro, o sistema gera deterministicamente um questionário contendo somente as perguntas ainda pendentes. Cada pergunta deve ser seguida por `R:`, indicando o local que o cliente preencherá ao copiar e editar a mensagem no WhatsApp.

Respostas parciais atualizam apenas os campos reconhecidos. O bloco seguinte repete somente as perguntas ainda pendentes.

### Mensagem Atômica

O questionário deve carregar `delivery_mode = "atomic"`.

Mensagens atômicas:

- são enviadas em uma única mensagem;
- não passam por splitter;
- não dependem de heurística textual para evitar divisão;
- preservam quebras de linha e todas as ocorrências de `R:`.

A detecção atual por quantidade de linhas `R:` pode permanecer apenas como fallback temporário durante a migração.

### Trava De Simulação

Uma simulação com trade-in só pode ocorrer quando:

```text
consent_granted
AND missing_tradein_fields.length = 0
AND tradein_disqualified = false
AND tradein_model_accepted != false
```

Essa condição é determinística. Prompt, resumo narrativo ou memória de agente não podem ultrapassá-la.

## Comparação E Duas Simulações

Quando o cliente estiver em dúvida entre dois aparelhos:

- usar `simulation_mode = "comparison"`;
- manter dois slots independentes;
- aplicar o mesmo trade-in e as mesmas entradas a cada alternativa para comparar diferenças;
- nunca somar os aparelhos;
- consultar e responder disponibilidade por slot;
- permitir resultado parcial quando apenas uma opção puder ser simulada.

`bundle` só é usado quando o cliente disser explicitamente que pretende comprar os dois aparelhos. Em caso de dúvida, o padrão é `comparison`.

O endpoint `crm-simulator-quote` já suporta até duas cotações e deve ser aproveitado, com evolução retrocompatível.

## Simulação Inicial

Toda apresentação de simulação deve mostrar:

- aparelho e preço;
- trade-in e valor recebido;
- entradas em dinheiro ou Pix;
- valor líquido que será financiado;
- grupo de taxa ou bandeira;
- quantidade de parcelas;
- taxa aplicada;
- total cobrado com taxa;
- valor de cada parcela;
- próximo passo comercial.

O cliente deve conseguir distinguir claramente o valor sem taxa do custo final parcelado.

## Re-Simulações

Uma re-simulação altera a proposta ativa sem reiniciar a negociação. Deve permitir:

- adicionar, alterar ou retirar entrada em Pix ou dinheiro;
- alterar bandeira ou grupo de taxa;
- pedir uma quantidade específica de parcelas;
- alterar um dos aparelhos comparados;
- remover ou adicionar trade-in, respeitando a avaliação obrigatória;
- dividir o pagamento em até dois cartões;
- retornar a uma versão anterior.

O sistema mantém uma proposta-base e versões numeradas da forma de pagamento. Apenas uma versão fica ativa.

## Dois Cartões

Serão aceitos no máximo dois cartões.

### Mesmo Grupo De Taxas

Visa e Master pertencem ao mesmo grupo.

Quando os cartões pertencem ao mesmo grupo e usam a mesma quantidade de parcelas:

- a taxa é calculada uma vez;
- o total com taxa é preservado;
- o total é dividido entre os cartões conforme os valores informados;
- não é necessária nova cotação do aparelho.

Exemplo:

- valor líquido financiado exibido na proposta;
- total em 10x com taxa: `R$ 5.850,00`;
- cartão Visa: `R$ 3.000,00`, exibido como `10x de R$ 300,00`;
- cartão Master: `R$ 2.850,00`, exibido como `10x de R$ 285,00`.

### Grupos De Taxa Diferentes

Quando um cartão pertence a `Visa/Master` e outro a `Outras`:

- o cliente distribui o valor líquido financiado entre os cartões;
- cada parte recebe sua taxa correspondente;
- cada cartão produz total com taxa e parcela próprios;
- a resposta mostra o valor líquido total, cada cálculo individual e a soma final cobrada.

O contrato deve ser retrocompatível com o campo atual `cardBrand`.

## Handoff

A IA continua até a simulação. O handoff ocorre quando:

- o cliente pede atendimento humano;
- o trade-in é desqualificado ou permanece ambíguo;
- há recusa reiterada em concluir a avaliação;
- três tentativas não produzem progresso;
- há inconsistência de preço, estoque ou estado;
- o caso envolve mais de dois aparelhos;
- há pós-venda, garantia operacional ou outro risco;
- o fechamento ou a reserva exige confirmação humana.

O handoff deve persistir motivo estruturado.

## Supabase

A fase 1 deve introduzir objetos versionados, inicialmente em `jsonb` quando isso reduzir risco de migração:

- `commerce_state`;
- `tradein_assessment`;
- `quote_versions`;
- `payment_revision`;
- `ai_turn_events`.

Os campos legados de `lead_state` continuam disponíveis durante o canário. Leitura e escrita devem manter compatibilidade enquanto o novo núcleo é promovido.

Cada persistência usa:

- `turn_id`;
- chave de idempotência;
- `state_version`;
- comparação de versão;
- timestamps por etapa.

Uma execução atrasada não pode sobrescrever estado mais novo.

## App CRM

### Conversa

O atendimento deve mostrar, de forma operacional:

- status atual da IA;
- ação pendente;
- perguntas de trade-in restantes;
- modo de simulação;
- proposta e versão ativas;
- motivo de bloqueio ou handoff;
- ações para assumir atendimento e corrigir estado.

O app não deve duplicar regras comerciais. Correções humanas escrevem no mesmo contrato canônico e geram evento auditável.

### Qualidade

O painel deve acompanhar:

- P50, P95 e P99 por turno;
- latência por etapa;
- contexto cruzado detectado;
- taxa de simulação correta;
- handoff antes da simulação;
- questionários atômicos divididos indevidamente;
- correções humanas;
- falhas de estoque e simulador;
- conversão por modo de atendimento.

## Tratamento De Falhas

- Timeout de IA: usar fallback determinístico ou pergunta curta.
- Parse incompleto: salvar somente fatos confiáveis e perguntar o trecho ambíguo.
- Falha de estoque ou simulador: não inventar disponibilidade ou valores; preservar estado e encaminhar com motivo.
- Conflito de versão: recarregar o estado e reavaliar o turno uma vez.
- Falha de envio: retry idempotente sem duplicar mensagem.
- Resultado parcial de comparação: responder o slot válido e explicar o slot indisponível.

## Harness De Auditoria

Cada cenário deve criar lead e conversa sandbox próprios, associados ao canal ou número de teste necessário. Ao fim, essas entidades são marcadas para limpeza.

O harness deve:

- evitar reutilizar histórico de uma conversa;
- usar `scenario_id` também em chaves de memória;
- suportar cenários multi-turno;
- reproduzir contexto anterior quando houver pronomes ou re-simulação;
- capturar todas as mensagens de IA do turno;
- medir latência por etapa;
- registrar avaliação automática e manual;
- restaurar workflow e ambiente ao estado seguro.

Prompts como `Quanto fica a parcela dele?` não são cenários de primeiro turno. Devem incluir a mensagem e resposta anteriores na mesma conversa sandbox.

## Estratégia De Testes

### Unidade

- extração de fatos;
- cálculo de campos pendentes;
- gate de consentimento;
- geração do questionário;
- decisão por estado;
- comparação versus bundle;
- simulação e divisão entre cartões;
- versionamento e resolução de referências.

### Contrato

- n8n e Supabase;
- estado canônico e campos legados;
- simulador single/comparison/bundle;
- re-simulações;
- `delivery_mode = atomic`;
- idempotência e controle de versão.

### Cenários

- compra simples;
- trade-in com nenhum dado adicional;
- trade-in com dados parciais;
- consentimento, questionário e resposta parcial;
- tentativa de simular antes da avaliação completa;
- comparação com e sem trade-in;
- comparação com um slot indisponível;
- re-simulação sem entrada;
- alteração de parcelas;
- dois cartões do mesmo grupo;
- dois cartões de grupos diferentes;
- referência pronominal multi-turno;
- recusa reiterada e handoff.

## Rollout

1. Shadow: o novo núcleo registra estado e decisão; o fluxo legado responde.
2. Canário de 5%: casos simples e monitorados.
3. Promoção para 25% e 50%: incluir troca, comparação e re-simulação.
4. Promoção para 100% após janela estável e aprovação operacional.

Rollback deve ser possível por configuração, sem trocar contratos ou apagar estado.

## Critérios De Promoção

- P95 de até 45 segundos.
- Zero contexto cruzado.
- 100% das simulações com trade-in bloqueadas até avaliação completa.
- 100% dos questionários atômicos enviados sem split.
- Comparação nunca tratada como bundle sem sinal explícito.
- Re-simulações corretas para entrada, parcelas e até dois cartões.
- Nenhuma resposta com preço, estoque ou taxa inventados.
- Nenhuma regressão crítica de handoff ou envio.

## Fases

### Fase 1: Núcleo E Contratos

- commerce state;
- extractor;
- Decision Engine;
- gate de trade-in;
- comparação;
- re-simulação;
- simulador com até dois cartões;
- mensagens atômicas;
- harness isolado;
- shadow e canário inicial.

### Fase 2: App E Operação

- estado e propostas na conversa;
- correção humana;
- métricas e painel de qualidade;
- controles de canário e rollback.

### Fase 3: Otimização

- redução adicional de latência e custo;
- remoção dos agentes legados após evidência;
- ajustes de conversão baseados em métricas;
- expansão gradual de autonomia, se aprovada.

## Fora De Escopo

- trocar imediatamente o webhook de produção;
- automatizar baixa de estoque ou venda;
- permitir mais de dois aparelhos ou cartões;
- remover campos legados antes do fim do canário;
- alterar preços, taxas ou regras comerciais sem fonte configurada;
- dar autonomia de fechamento final à IA nesta fase.
