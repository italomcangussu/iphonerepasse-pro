# Repasse V2 WhatsApp Scenario Audit Design

## Contexto

O workflow novo `ia repasse-pro v2 avancada` sera validado antes de substituir o fluxo atual `ia repasse-pro`. A validacao precisa simular conversas comerciais reais no WhatsApp de teste `558899990507`, mantendo producao isolada e preservando o webhook atual.

A v2 deve ser testada com cenarios de alto potencial comercial retirados de conversas existentes do CRM. As conversas originais servem apenas como inspiracao e fonte de comportamento real; nenhum lead original deve ser alterado durante a bateria.

## Objetivos

- Rodar uma bateria de 8 a 10 cenarios reais de venda/troca no WhatsApp de teste.
- Zerar a memoria comercial do lead de teste antes de cada cenario.
- Auditar a qualidade da negociacao como se fosse um bom vendedor humano.
- Verificar se a IA entende compra, troca, comparacao entre dois iPhones, trade-in, entrada, bandeira/cartao, parcelamento e falta de estoque.
- Consolidar melhorias de prompts/fluxo somente depois da bateria, evitando ajustes por caso isolado.

## Fora de Escopo

- Alterar conversas, mensagens ou memoria dos leads originais usados como referencia.
- Trocar o webhook de producao para `repasse-next`.
- Ativar a v2 permanentemente.
- Aplicar ajustes no fluxo durante a bateria de testes.
- Apagar historico inteiro do WhatsApp de teste; a limpeza deve mirar memoria e campos de estado que contaminem a proxima simulacao.

## Selecao Dos Cenarios

A bateria deve usar 8 a 10 cenarios com maior potencial comercial, priorizando conversas que tenham:

- intencao clara de compra;
- intencao de troca com iPhone de entrada;
- comparacao entre dois modelos desejados;
- pedido de simulacao de diferenca;
- objecao de preco ou parcela;
- pergunta sobre entrada, cartao, bandeira ou parcelamento;
- falta de dados do estado do trade-in;
- falta de estoque ou necessidade de oferecer alternativa;
- cliente indeciso entre modelos;
- necessidade real de handoff humano por complexidade.

Cada cenario deve ser reescrito para o WhatsApp de teste sem expor dados pessoais desnecessarios do cliente original.

## Protocolo De Execucao

Para cada cenario:

1. Registrar o estado inicial do lead/conversa de teste.
2. Limpar a memoria comercial do lead de teste, incluindo `summary_short`, estado de atendimento da IA, campos de simulacao persistidos e qualquer resumo operacional usado pela v2.
3. Remover ou neutralizar residuos de teste que possam contaminar a proxima execucao.
4. Colocar a conversa de teste em `ai_handling` e `ai_enabled = true`.
5. Garantir que a v2 esteja disponivel no webhook `repasse-next`, ativando temporariamente se necessario.
6. Disparar a mensagem do cenario pelo webhook da v2 com payload controlado que gere resposta no WhatsApp de teste.
7. Acompanhar a execucao n8n correspondente.
8. Coletar a resposta enviada ao WhatsApp/CRM.
9. Auditar a qualidade comercial e tecnica.
10. Restaurar estado seguro ao final da bateria.

O lead de teste deve ser tratado como sandbox. A cada novo cenario, a memoria deve comecar limpa para que o comportamento avaliado seja daquele cenario, nao de residuos anteriores.

## Rubrica De Auditoria

Cada resposta deve ser avaliada com os seguintes criterios:

- `Entendimento`: captou compra, troca, comparacao ou objecao sem confundir intencao.
- `Perguntas certas`: pediu apenas o que faltava, especialmente estado do aparelho de entrada antes de simular.
- `Simulacao`: trouxe valor, diferenca, entrada/trade-in e pelo menos opcoes de parcelamento.
- `Negociacao`: conduziu como bom vendedor humano, com clareza, proximo passo e tom comercial.
- `Alternativas`: quando faltou estoque ou dado, ofereceu caminho util sem travar a venda.
- `Seguranca operacional`: nao prometeu estoque inexistente, nao somou comparacoes como pacote, nao pulou para humano cedo demais.
- `Performance`: latencia percebida, numero de execucoes e comportamento do buffer/lock.

Os achados devem ser classificados em:

- `Critico`: impede venda, simula errado, ignora trade-in obrigatorio ou gera risco operacional.
- `Alto impacto`: reduz conversao, faz pergunta ruim, perde timing comercial ou resposta fica incompleta.
- `Refino`: melhora de tom, copy, ordem das perguntas ou apresentacao dos valores.

## Criterios Comerciais Esperados

Um bom resultado deve:

- responder com naturalidade e objetividade;
- reconhecer quando dois iPhones significam comparacao, nao compra conjunta;
- usar compra conjunta apenas quando o cliente disser claramente que quer levar os dois;
- nunca somar alternativas em modo comparacao;
- pedir estado completo do trade-in antes de usar o aparelho de entrada na simulacao;
- apresentar pelo menos opcoes de parcelamento mesmo quando houver um unico aparelho;
- indicar proximo passo concreto, como confirmar cor, loja, entrada, forma de pagamento ou reserva;
- manter tom consultivo, vendedor e humano, sem parecer robotico ou burocratico.

## Saidas Esperadas

Ao fim da bateria, deve existir um relatorio com:

- lista dos cenarios testados;
- mensagem disparada;
- resumo da execucao n8n;
- resposta enviada;
- nota qualitativa por criterio;
- problemas encontrados;
- recomendacoes de ajuste por prioridade;
- decisao sobre quais ajustes aplicar em lote.

Somente depois desse relatorio os prompts/fluxo devem ser ajustados. Ajustes serao aplicados quando houver padrao recorrente ou falha critica isolada com risco alto.

## Seguranca

- Ler credenciais apenas de `.env.local` ou `.env` do repositorio atual.
- Validar a identidade do projeto Supabase antes de qualquer escrita remota.
- Nao imprimir tokens, chaves ou segredos.
- Nao alterar leads originais usados como referencia.
- Manter a v2 isolada no webhook `repasse-next` durante a bateria.
- Restaurar o lead/conversa de teste para estado seguro ao final.

## Verificacao

A bateria sera considerada valida quando:

- 8 a 10 cenarios forem executados ou houver interrupcao justificada por falha critica;
- cada cenario tiver memoria zerada antes do disparo;
- cada resposta tiver evidencia de CRM/WhatsApp ou execucao n8n;
- o relatorio separar falhas criticas, alto impacto e refinos;
- a producao permanecer sem troca de webhook.
