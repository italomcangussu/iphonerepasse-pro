# Design — Correção da falha de contexto da IA do CRM (buffer/event_id no n8n)

- **Data:** 2026-06-11
- **Workflow alvo:** `Cr4fPWe0prwS6XjI` ("ia repasse-pro v2 avancada") no n8n (`iatende-n8n.ylgf5w.easypanel.host`)
- **Status:** aprovado para planejamento

## 1. Problema observado

No CRM Plus, a IA não mantém o contexto: o cliente informa o modelo ("Tô em dúvida do 17 pro Max ou pro", depois "17 pro de 256gb vcs tem?") e a IA continua perguntando "qual modelo você quer?", chega a sugerir modelos desatualizados ("iPhone 15, 16, 16 Pro") e **envia respostas duplicadas** (2–4 balões quase idênticos por turno).

## 2. Diagnóstico (com evidência de execução real)

Investigação feita ao vivo via API pública do n8n (`N8N_PUBLIC_API` em `.env.local`; a key antiga `CRM_N8N_API_KEY`/MCP retornava 401). Execuções `403645/46/47/49` (11/06 18:22–18:25 UTC = 15:22–15:25 BRT) batem exatamente com o screenshot.

**Causa-raiz única — `event_id` mal-semeado.** O nó **Buffer + Data Lead** define tanto `last_event_id` quanto cada `messages[].event_id` a partir de:

```
$("Load dados + texto Lead").item.json.cliente.talk_id
```

`cliente.talk_id` é o **`conversation_id` (constante por contato)** — confirmado: valor `ae1dd5ed-…-b3c481568b3a`, cujo final `81568b3a` apareceu idêntico como `current_event_id` nas 4 execuções. Não é um id por mensagem.

Esse único bug produz os três sintomas:

1. **Perda de contexto (mensagens reais descartadas).** O nó **Atualizar Estado Buffer**, PASSO 4, deduplica as mensagens do buffer por `event_id` (`if (existingIds.has(msg.event_id)) continue`). Como toda mensagem do contato compartilha o mesmo `event_id`, **só a primeira mensagem entra no buffer**; as seguintes (ex. "17 pro de 256gb") são puladas como duplicadas. Resultado verificado: as 4 execuções processaram o mesmo `message_buffered` estagnado ("Não não, quero começar uma nova compra"); o extractor (Memory 1) retornou `facts: {}` e o guardrail não tinha texto novo → `desired_model: null`, `missing_fields: ["interest_type"]` na entrada do Bia 1 → Bia 1 corretamente pergunta o modelo.
2. **Respostas duplicadas.** O nó **Verificar vencedor** (debounce) decide o vencedor por `current_event_id === buffer.last_event_id`. Como ambos são o `talk_id` constante, **toda execução vence** (`reason: event_id_confere`) e dispara resposta → 2–4 balões repetidos.
3. **"iPhone 15, 16, 16 Pro" é alucinação do LLM.** O system message do Bia 1 manda só "Qual iPhone você quer comprar?" (e ainda "nunca questione modelo"); os exemplos velhos foram inventados pelo modelo — o prompt não proíbe listar modelos-exemplo nem os ancora no catálogo real.

**O que NÃO é o problema:** o prompt do Bia 1 está correto (lê `desired_model`, "só pergunte o que falta"); o guardrail determinístico (`detectIphoneModel`, trata o 17) **está** deployado no nó "Parse Memory" e roda upstream do Bia 1; a persistência **funciona** — `CRM Leads POST Inventory Context` faz `upsert_lead_state` com o snapshot completo (`state: JSON.stringify($json)`). A causa é exclusivamente o `event_id`.

## 3. Mudanças propostas

### 3.1 `event_id` único por mensagem (causa-raiz)

Nó **Buffer + Data Lead** — trocar as duas referências de `cliente.talk_id` por um id único e estável por mensagem:

- Fonte preferida: `$('Webhook').last().json.body.meta.messageid` (id do WhatsApp, ex. `3A0A3E027025C712908D` — **estável entre re-entregas do provedor**, servindo como chave natural de idempotência).
- Fallback: `meta.message_id` (UUID do CRM) caso `messageid` venha vazio.
- Aplicar a `last_event_id` **e** a `messages[].event_id`.

Efeito: o PASSO 4 deixa de descartar mensagens reais (contexto preservado, `desired_model` extraído) e o "Verificar vencedor" volta a deixar só a última mensagem da rajada vencer (sem duplicação).

### 3.2 Guard de idempotência no Redis (reforço)

Logo após o Webhook, antes de montar o buffer: `SET NX repasse-next:seen:{messageid}` com TTL ~300s. Se a chave já existe, dropar a execução (re-entrega do provedor que chegou depois do buffer já ter sido limpo). Cinto + suspensório sobre a 3.1.

### 3.3 Persistência por turno

Garantir que `upsert_lead_state` rode em **todo turno** que altere slots (modelo/capacidade/cor), não só no ramo de estoque. Hoje `CRM Leads POST Inventory Context` só dispara no caminho de inventário; um turno que extrai `desired_model` sem tocar estoque pode não persistir. Adicionar/rotear a persistência do snapshot para cobrir esses caminhos.

### 3.4 Anti-alucinação de catálogo (prompt do Bia 1)

Adicionar ao system message do agente **Bia 1** uma regra explícita: nunca inventar nomes de modelos como exemplo; ao perguntar o modelo, perguntar de forma aberta ("Qual iPhone você quer?") sem listar exemplos; só citar modelos específicos quando vierem de `pre_inventory`/`last_inventory_context`. Edição apenas de prompt.

## 4. Abordagem de deploy

Patch **cirúrgico** via API do n8n (`n8n_update_partial_workflow` / `patchNodeField` ou PATCH direto), nó a nó, **sem** o build script (que clobra e deixa o workflow OFF — ver `n8n-repasse-deploy-footguns`). **Sempre reativar** o workflow após o patch e confirmar `active: true`.

Ordem: 3.1 → validar → 3.2 → 3.3 → 3.4, cada uma seguida de validação. 3.1 sozinha já resolve os sintomas visíveis; as demais são robustez.

## 5. Validação

- **Harness de cenários:** `scripts/n8n/run-repasse-scenario-audit.mjs` (e `test-repasse-quality-gate.mjs`), usando **JIDs únicos por cenário** (`repasse-test-harness-buffer-key`).
- **Cenário-alvo:** cliente envia "17 pro Max ou pro" e, em mensagem separada, "256gb" → a IA **não** re-pergunta o modelo e **não** duplica resposta; `desired_model` chega preenchido ao Bia 1.
- **Regressão:** rajada de 2 mensagens distintas dispara **uma** resposta (só a vencedora); re-entrega do mesmo `messageid` não gera resposta extra.
- **Pós-deploy:** inspecionar 1–2 execuções reais via API e confirmar `current_event_id` distinto por mensagem e `is_winner` verdadeiro só na última.

## 6. Riscos e mitigação

- **`meta.messageid` ausente em algum canal (ex. Instagram):** fallback para `meta.message_id` (UUID), garantindo unicidade mesmo sem o id do WhatsApp.
- **Workflow ficar OFF após patch:** checagem obrigatória de `active: true` ao final; reativar se necessário.
- **Escopo do harness:** colisão de buffer por JID repetido mascara resultados; usar JIDs únicos.

## 7. Fora de escopo

Reescrita do pipeline de buffer/lock, mudança do provedor, refatoração dos agentes Memory/Router. Apenas as 4 mudanças acima.
