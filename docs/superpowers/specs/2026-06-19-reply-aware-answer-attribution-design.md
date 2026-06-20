# Reply-Aware Answer Attribution — Design

**Data:** 2026-06-19
**Workflow n8n:** `Cr4fPWe0prwS6XjI` ("ia repasse-pro v2 avancada")
**Status:** aprovado (brainstorming) → pronto para writing-plans

## Problema

Quando o cliente responde uma pergunta da Bia usando o **reply (mensagem citada)** do
WhatsApp, esse reply é o sinal definitivo de **qual pergunta** ele está respondendo.
Caso real (lead VD, 2026-06-19):

- Bia perguntou, em mensagens separadas: "Qual modelo de iPhone você deseja comprar?" e
  "E qual é o aparelho que você tem agora?".
- VD respondeu **com reply** em cada uma: reply na 1ª → "Tô procurando 17pm"; reply na
  2ª → "14pm".
- O agente perdeu a atribuição: o reconciliador (flash-lite) gravou
  `desired_model = iPhone 14 Pro Max` (sobrescreveu o 17 Pro Max) e `has_tradein=false`,
  então o fluxo nunca entrou na qualificação de troca.

Tentativas via prompt (reconciliador + Bia) **não** seguraram o modelo fraco; um guard
determinístico por heurística ("2º modelo durante a coleta = entrada") foi deployado como
rede, mas o sinal correto e robusto é o próprio reply.

## Causa-raiz (confirmada por execução real)

O encanamento de `reply_context` **já existe ponta a ponta** — tipo `CrmAiReplyContext`,
builder, db-lookup e wiring no dispatch. Há **um elo quebrado** e **um consumidor faltando**:

1. **Extração não casa com a forma real (edge).** O uazapi entrega o quote em
   `raw_inbound.message.content.contextInfo`:
   ```json
   { "stanzaID": "3EB0...A0", "quotedMessage": { "conversation": "E qual é o aparelho que você tem agora?" } }
   ```
   Mas [extractUazReply()](../../../supabase/functions/_shared/uazapi.ts) (uazapi.ts:1054)
   procura `contextInfo` em `data.contextInfo` / `extendedTextMessage.contextInfo` (ignora
   o nível **`content`**) e procura `stanzaId` (minúsculo) — o real é **`stanzaID`**.
   Resultado: `targetMessageId=null` → `reply_to_provider_message_id=null` →
   [resolveReplyContextForAi()](../../../supabase/functions/_shared/crm_ai_inbound_dispatch.ts)
   (linha 153) retorna `null` logo no início → `buildCompactAiInboundPayload` **omite**
   `reply_context` (crm_ai_payload.ts:260). Verificado: nas execuções reais do VD
   (419159/419160) o payload n8n chega **sem** `reply_context`, embora o raw contenha
   `contextInfo`/`quotedMessage`.

2. **n8n não consome `reply_context`.** Mesmo que chegasse, nenhum nó (Memory 1/2, Bia,
   routing) lê `reply_context` para ancorar a resposta à pergunta certa.

## Objetivo

Quando o cliente responder com reply, atribuir a resposta **deterministicamente** ao campo
correspondente à pergunta citada (desejado, aparelho atual/entrada, capacidade, cor, entrada
em dinheiro, etc.), de forma **autoritativa** (sobrepondo a extração do LLM). Escopo
**geral** (qualquer pergunta da Bia), não só desejado×atual.

## Decisões (travadas no brainstorming)

- **Escopo:** geral — classifica o texto da pergunta citada e ancora ao campo.
- **Força:** autoritativo/determinístico — código sobrepõe o LLM quando há reply.
- **Fallback:** sem reply, mantém o heurístico já deployado
  (`patch-parse-memory2-tradein-reclass`) e as regras de prompt adicionadas hoje.

## Arquitetura / fluxo-alvo

```
WhatsApp (reply numa pergunta da Bia)
  └─ uazapi webhook: message.content.contextInfo { stanzaID, quotedMessage.conversation }
       └─ crm-uaz-webhook-receiver → extractUazReply()                 [FIX A]
            → persiste reply_to_provider_message_id + reply_preview_text (crm_messages)
       └─ crm-ai-inbound → resolveReplyContextForAi() (db-lookup da msg da Bia + preview fallback)
            → buildCompactAiInboundPayload({ replyContext }) → POST n8n (inclui reply_context)
  └─ n8n: Code Parse Memory 2 lê reply_context e ANCORA a resposta ao campo   [FIX B]
```

## Fix A — Edge: extração do reply

**Arquivo:** [supabase/functions/_shared/uazapi.ts](../../../supabase/functions/_shared/uazapi.ts), função `extractUazReply` (1054).

Mudanças:
- Adicionar o nível `content`: `const content = asRecord(nestedMessage.content)` e incluir
  `content.contextInfo` entre as fontes de `quotedMessage` e de stanza.
- Aceitar **`stanzaID`** (capital) além de `stanzaId` em todas as fontes de `contextInfo`.
- `previewText` continua saindo de `extractInboundText(quotedMessage)` (lê
  `quotedMessage.conversation`).

Sem mudança em `resolveReplyContextForAi`, `buildCompactAiInboundPayload`, nem no receiver:
basta `extractUazReply` voltar a `targetMessageId` não-nulo para o resto fluir (db-lookup da
mensagem outbound da Bia + fallback de preview text).

**Teste:** `extractUazReply` com fixture do payload real do VD (estrutura
`message.content.contextInfo.stanzaID` + `quotedMessage.conversation`) deve retornar
`targetMessageId="3EB0...A0"` e `previewText="E qual é o aparelho que você tem agora?"`.
Manter casos existentes (shapes antigos) verdes. `npm run test:deno`.

## Fix B — n8n: consumo determinístico (autoritativo, geral)

**Nó:** `Code Parse Memory 2` (jsCode), no workflow `Cr4fPWe0prwS6XjI` — mesmo nó dos guards
de hoje (interest_type / cash-latch / tradein-reclass).

Lógica nova (após o parse do reconciliador, antes do `return`):
1. Ler `reply_context` do payload (passa a estar disponível em `$json` /
   `$('Edit Fields')...` — pinar a origem exata no plano) e o texto da mensagem atual
   (`message_buffered`).
2. Se `reply_context.target_text` existir e `reply_context.target_direction` for outbound
   (pergunta da Bia), **classificar** o texto citado por padrões e ancorar a resposta atual:

   | Pergunta citada (classificador) | Campo ancorado |
   |---|---|
   | aparelho atual / "tem agora" / "tem hoje" / "dar de entrada" | `tradein_model` + `has_tradein=true`, `interest_type="trocar"` |
   | "modelo... deseja comprar" / "procurando" | `desired_model` |
   | "armazenamento" / "capacidade" | `desired_capacity` (ou `tradein_capacity` se a citada for de avaliação de troca) |
   | "cor" | `desired_color` (ou `tradein_color` no contexto de troca) |
   | "valor de entrada" / "Pix/dinheiro" antes de simular | `cash_entry_intent` / `cash_entry_amount` |

3. **Autoritativo:** o valor ancorado sobrepõe o que o LLM extraiu para aquele campo, e —
   no caso do aparelho atual — restaura/preserva `desired_model` se o LLM o tiver
   sobrescrito.
4. Se a pergunta citada não casar com nenhum padrão conhecido, **não força nada** (mantém o
   comportamento atual).

**Isolamento:** o classificador "texto da pergunta da Bia → categoria de campo" é função pura,
extraída para [scripts/n8n/tool/](../../../scripts/n8n/tool/) com teste
(`npm run test:n8n-tool`), e referenciada/duplicada no jsCode do nó conforme o contrato de
re-attach do projeto.

## Coexistência / fallback

- `reply_context` é o sinal **primário**. Ausente → heurístico
  `patch-parse-memory2-tradein-reclass` (já vivo) + regras de prompt de hoje.
- Ordem no `Code Parse Memory 2`: aplicar a ancoragem por reply **antes** do heurístico de
  2º-modelo, e o heurístico só age quando não houve ancoragem por reply.

## Testes & rollout

- **Edge:** Deno test do `extractUazReply` (fixture real) + suíte existente verde
  (`crm_ai_inbound_dispatch.test.ts`, `crm_ai_payload.test.ts`). Deploy:
  `supabase functions deploy crm-uaz-webhook-receiver` (e demais que importam o shared).
- **n8n:** guard-first → patch cirúrgico em `Code Parse Memory 2` (backup, `new Function()`
  assert, PUT+activate, re-sync) + teste pure-logic do classificador.
- **Validação ao vivo:** o smoke sintético **não** carrega quote real → validar relendo uma
  execução real do VD após o fix, ou um teste manual com reply no WhatsApp do sandbox.

## Riscos

- **Casing/shape do uazapi** pode variar por tipo de mídia; a fixture cobre texto, e o teste
  deve incluir ao menos um reply em mídia se houver amostra.
- **Classificador por padrões** depende do texto das perguntas da Bia; manter os padrões
  alinhados com os prompts (desejado/atual/capacidade/cor/entrada).
- **db-lookup** pode falhar para mensagens muito antigas (preview text cobre o fallback).
- Edge é Deno deploy (fora dos patches n8n) — exige `supabase functions deploy`, não só PUT.

## Fora de escopo

- Reescrita do buffer/debounce do n8n.
- Mudar a abertura (continua perguntando as duas coisas; o reply resolve a atribuição).
- Reações (emoji) — já tratadas separadamente.
