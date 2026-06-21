# Buffer ciente de contexto: extensão da janela quando há detalhe pendente

**Data:** 2026-06-21
**Workflow:** `Cr4fPWe0prwS6XjI` ("ia repasse-pro v2 avancada") — `n8n/ia-repasse-pro-v2/`
**Status:** design aprovado, pronto para plano de implementação

## Problema

A IA fez uma pergunta composta de entrada/troca:

> "Você tem algum iPhone pra dar como parte do pagamento? Se tiver, me conta qual modelo que eu já vou verificando."

O lead VD respondeu em **duas mensagens separadas**:
- `11:25:43` → "Sim"
- `11:26:09` → "14pm"

O debounce do buffer (Redis + winner por `event_id`) processou a primeira mensagem isolada:

1. "Sim" casa com `isSafeShortReply` (o regex inclui `sim`) → janela **encurtada para 15s** → fecha ~`11:25:58`.
2. No winner-check às `11:25:58`, "14pm" ainda não chegou (vem `11:26:09`, ~26s depois do "Sim"). A execução de "Sim" vence **sozinha** e a IA gera *"Qual modelo é o iPhone que você vai dar como entrada?"*.
3. "14pm" chega `11:26:09`, tarde demais, em execução separada → **eco**: o bot pergunta o modelo logo depois que o usuário já começou a respondê-lo, parecendo repetitivo/quebrado. O usuário reenvia "14pm" achando que não foi recebido.

### Causa-raiz

Duas causas que se somam:

- **Timing do buffer:** um afirmativo nu (`sim` / `tenho` / `quero`) é tratado como resposta *completa* e **encurta** a janela para 15s — mas um afirmativo a uma pergunta quase sempre **precede** um detalhe. É exatamente o caso errado para encurtar. (E este lead foi lento: gap de 26s — até o fallback de 25s teria perdido por 1s.)
- **Pergunta composta:** a pergunta do bot pedia duas coisas (*"tem?"* + *"qual modelo?"*), o que ativamente convida a resposta em duas mensagens.

O nó `Calcular Wait Buffer` enxerga **apenas as mensagens do usuário** — não sabe que o bot acabou de fazer uma pergunta que espera continuação, então não tem como "esperar mais porque a resposta está a caminho".

## Decisão

Tornar o buffer **ciente de contexto** via um flag curto no Redis escrito no **envio** da resposta do bot, e lido no **próximo inbound** para estender a janela quando há um detalhe pendente e a resposta parece parcial.

Decisões tomadas no brainstorm:
- **Alavanca:** buffer ciente de contexto (não só timing; não mexer no design da pergunta nem em supressão pós-hoc).
- **Fonte do sinal:** flag no Redis no envio, com TTL (sem leitura de DB no hot path).
- **Escopo:** todas as 5 classes de pergunta do classificador (`tradein_model`, `cash_entry`, `desired_model`, `desired_capacity`, `desired_color`).
- **Extensão da janela:** 40s.

## Solução

### A. No envio do bot (escrever o sinal)

Depois que o texto da resposta é composto, nos módulos de envio (**"Módulo 09 - Envio WhatsApp e handoff Bia 2"** e o caminho de envio da Bia 1), classificar o texto outbound com o classificador **já existente** `__classifyBiaQuestion()` (de [40_05_code-parse-memory-2.js:205-214](../../../n8n/ia-repasse-pro-v2/nodes/code/40_05_code-parse-memory-2.js#L205-L214), o mesmo que alimenta o gate `tradein_asked`):

- Se retornar um tipo não-nulo (`tradein_model` | `cash_entry` | `desired_model` | `desired_capacity` | `desired_color`):
  `SET pending_detail:{contact_id} = {expects:<tipo>, asked_at:<iso>}` com **TTL ~90s**.
- Se retornar `null` (afirmação/sem detalhe esperado):
  `DEL pending_detail:{contact_id}` — para um flag anterior não ficar pendurado.

O classificador é reutilizado **as-is** (mesma fonte de verdade dos padrões já confiados pelo `tradein_asked`); não se inventa nova detecção de pergunta. Se necessário, extrair o `__classifyBiaQuestion` + helpers de normalização para um bloco compartilhado para que envio e Memory 2 não dupliquem (ver "Duplicação" abaixo).

### B. No próximo inbound (ler o sinal, decidir a janela)

1. Adicionar um nó `Redis GET pending_detail:{contact_id}` ao lado do `Redis Get Buffer` existente, e propagar seu valor até `Calcular Wait Buffer` (via o mesmo caminho que já leva `buffer_obj` ao nó — `Atualizar Estado Buffer` passa o campo adiante, ou um merge dedicado).
2. Em [10_02_calcular-wait-buffer.js](../../../n8n/ia-repasse-pro-v2/nodes/code/10_02_calcular-wait-buffer.js), **antes** da lógica de short-reply atual, novo ramo:
   - Se o flag existe **E** `messages.length === 1` **E** a resposta é afirmativo/parcial que **não** contém ainda o detalhe esperado →
     `buffer_wait_seconds = 40`, `buffer_wait_reason = 'pending_detail_extend'`.
   - Senão → **lógica atual 100% intacta** (15/20/25s).

Resultado no caso do print: "Sim" às `11:25:43` → janela fecha `11:26:23` → "14pm" às `11:26:09` é mesclada → winner processa `"Sim\n14pm"` junto → IA responde com o modelo, **sem eco**.

### Guard de completude

Se a única mensagem já contém o detalhe esperado (ex.: o usuário digitou "14pm" de uma vez, ou um GB quando `expects:desired_capacity`), **não** estender — disparar normalmente. Heurística simples por `expects`:
- `*_model` / `tradein_model`: presença de token de modelo de iPhone (número de geração / apelido).
- `desired_capacity`: presença de `\d+\s?(gb|tb)`.
- `desired_color`: presença de cor conhecida (mesma lista do `isSafeShortReply`).
- `cash_entry`: presença de valor numérico / "não" explícito.

Quando em dúvida (afirmativo puro sem detalhe), estender.

## Por que é de baixo risco de regressão

- **Mecânica de winner/lock inalterada** — só muda *quanto tempo* a janela dura; o debounce por `event_id` + o lock são idênticos → nenhuma race nova.
- **Limitado e auto-curável:** teto rígido de 40s + TTL de 90s no flag → um flag preso nunca pendura respostas; pior caso é um turno levemente atrasado.
- **Reusa o classificador existente** — sem lógica nova não-testada; mesmos padrões já confiados pelo `tradein_asked`.
- **Gatilho estreito:** só dispara em resposta *única e curta* *enquanto* há detalhe pendente. Mídia, rajadas multi-mensagem e respostas normais mantêm o comportamento atual (15/20/25s).
- **Guard de completude:** resposta única que já traz o detalhe dispara normal — não atrasa quem responde completo de uma vez.

## Custo conhecido (tradeoff aceito)

Se o usuário responder só "Sim" e **não disser mais nada**, agora esperamos ~40s em vez de 15s antes de o bot perguntar "qual modelo?". Esse ~25s extra numa confirmação seca é o preço de eliminar o eco. Valor tunável.

## Plumbing / nós tocados

- **Novo:** `Redis GET pending_detail` (lado a lado com `Redis Get Buffer`).
- **Novo:** `Redis SET/DEL pending_detail` no(s) caminho(s) de envio (Módulo 09 Bia 2 + envio Bia 1) + um Code curto que roda `__classifyBiaQuestion(outbound_text)` para decidir SET vs DEL.
- **Editado:** [10_02_calcular-wait-buffer.js](../../../n8n/ia-repasse-pro-v2/nodes/code/10_02_calcular-wait-buffer.js) — novo ramo `pending_detail_extend` + guard de completude.
- **Possivelmente editado:** `Atualizar Estado Buffer` ou um merge para propagar o valor do flag até `Calcular Wait Buffer` (passagem de campo, sem mexer na lógica de merge de mensagens).
- **Possível refactor:** extrair `__classifyBiaQuestion` para bloco compartilhado (`scripts/n8n/tool/parsers/blocks/`) consumido por envio + Memory 2.

### Duplicação

`__classifyBiaQuestion` passaria a ter dois call-sites (Memory 2 + envio). Preferir extrair para um bloco canônico re-anexável (padrão dos parsers em [scripts/n8n/tool/parsers/blocks/](../../../scripts/n8n/tool/parsers/blocks/)) em vez de copiar, para os padrões não divergirem. Se o custo de plumbing for alto, copiar **com** um teste de consistência de duplicação (como `parsers.test.mjs` já faz).

## Processo obrigatório de deploy (live workflow)

Esta mudança toca o workflow LIVE. Seguir o protocolo do CLAUDE.md:

1. **Guard primeiro:** `node scripts/n8n/guard-live-workflow-sync.mjs` (ou confiar no PreToolUse hook) — detecta edição manual e re-sincroniza o snapshot/.js mirrors antes de qualquer patch.
2. Patch cirúrgico (GET → backup em `output/n8n/backups/` → `.replace()` exato com guards → `new Function()` syntax-assert → PUT → `/activate` → re-export) **ou** via `repasse-maint.mjs build/deploy --confirm`.
3. **Validar:** [validate-repasse-next-workflow.mjs](../../../scripts/n8n/validate-repasse-next-workflow.mjs) + `npm run test:n8n-tool`.
4. **Reativar** o workflow após o deploy (ele fica OFF se clobberado).
5. Nunca editar na UI do n8n enquanto deploya via API (reverte silenciosamente).

## Testes

- **Unidade (puro):** lógica de extensão em `Calcular Wait Buffer` — afirmativo+flag → 40s; afirmativo sem flag → 15s; reply com detalhe completo+flag → não estende; multi-mensagem → 25s; flag expirado/ausente → atual.
- **Unidade:** `__classifyBiaQuestion(outbound)` → SET vs DEL para cada uma das 5 classes + caso null.
- **Smoke live (JID único):** reproduzir o cenário "Sim" + "14pm" com gap >20s e <40s; confirmar que o winner processa as duas juntas e a IA não pergunta o modelo de novo. Usar a fixture de sandbox ([smoke-seed-sandbox.mjs](../../../scripts/n8n/smoke-seed-sandbox.mjs)); validar pelo runData do `Simulador`/`Montar Body` da execução correta, não só pela reply postada (cuidado com a buffer-race de execuções paralelas).

## Fora de escopo (YAGNI)

- Redesenhar a pergunta composta para uma-de-cada-vez (alavanca descartada).
- Supressão pós-hoc de eco (alavanca descartada).
- Leitura de DB/lead_state no hot path do buffer (descartada por latência).
- Extensão adaptativa por histórico de velocidade de digitação do lead.
