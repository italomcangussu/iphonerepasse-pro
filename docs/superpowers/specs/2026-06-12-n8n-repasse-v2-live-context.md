# N8N Repasse Pro v2 Live Context

Atualizado em 2026-06-14 a partir da API publica do n8n.

## Workflow operacional atual

- Nome: `ia repasse-pro v2 avancada`
- ID: `Cr4fPWe0prwS6XjI`
- Status: ativo
- Ultima atualizacao n8n: `2026-06-14T12:43:55.169Z`
- Total de nodes exportados: 142
- Webhook de producao: `POST /webhook/repasse`
- Snapshot local: `output/n8n/ia-repasse-pro-v2-current.json`

O workflow antigo `ia repasse-pro` (`oWNdWPUq6kEFitsnl8OpH`) nao deve ser usado como referencia operacional.

## Pipeline de memoria e ownership do lead_state (2026-06-14)

Maquina de estado por rodada: `Memory 1 - Extractor → Code Parse Memory 1 → Memory 2 - Reconciler → Code Parse Memory 2 → Code in JavaScript2`. A saida do `Code in JavaScript2` e persistida como `lead_state` (`Edit Fields5 → Code in JavaScript → CRM Leads POST Lead_State`), entao corrupcao gruda entre rodadas.

- **Memory 1 - Extractor** (LLM): extrai apenas fatos da mensagem atual (`memory_extraction`).
- **Code Parse Memory 1** (code): parse robusto de `memory_extraction` com fallback gracioso.
- **Memory 2 - Reconciler** (LLM, + Postgres Chat Memory): **dono unico do `lead_state`** — sua saida JSON E o `lead_state` completo reconciliado (copia o `LEAD_STATE ATUAL`, sobrepoe so o que mudou, nunca omite campo). Inclui os campos de roteamento (`intent`, `context_ready`, `missing_fields`, `next_best_action`, `summary_short`, `summary_operational`) + todos os campos de estado (`desired_*`, `tradein_*`, `has_tradein`, `interest_type`, `card_brand`, `cash_entry_*`, `proposal_accepted`, etc.). A desambiguacao trade-in vs desejado agora vive inteiramente no prompt deste node.
- **Code Parse Memory 2** (code, extraction-only — fonte em `scripts/n8n/repasse-code-parse-memory-2.js`): so extrai o JSON entregue (strip de markdown + reparo de aspas), sem reconciliar; degrada com `memory.parse_error` em vez de lancar erro; repassa `lead_state` anterior (como `prev`) e `last_message_content`.
- **Code in JavaScript2** (code, trivial): `item.json = $input.first().json.memory` — apenas achata o objeto `memory` reconciliado para a raiz antes do `Edit Fields5`.

> **Mudanca manual 2026-06-14 (`updatedAt` 12:43:55Z):** o node `Parse Memory` (rede de seguranca deterministica) foi **removido**. Antes ele rodava `preserve(memory.X, prev.X)` + guardrails (`REPASSE V2 MULTI QUOTE READINESS`, `REPASSE DETERMINISTIC CORE`, `can_simulate_tradein`, `tradeinOk`, questionario de trade-in, flags de rota). Agora o LLM `Memory 2 - Reconciler` e a unica autoridade sobre o `lead_state` — campo que o LLM deixar cair **nao** e mais reposto a partir de `prev`. O `Edit Fields5` reconstroi o contexto restante via `$('Edit Fields')` / `$('Edit Fields4')` / `$('Code Parse Memory 1')` (ex.: `intent_confidence` agora le `$('Code Parse Memory 1').item.json.memory_extraction.confidence`).

Historico de correcoes (a maioria mirava o agora-removido `Parse Memory`, mantidas so como referencia): `patch-parse-memory-output-shape.mjs` (saida canonica), `patch-parse-memory-tradein-state.mjs` (wiring de `last_message_content` + desambiguacao trade-in), `patch-memory2-owns-leadstate.mjs` (ownership do `lead_state` no Memory 2), `patch-tradein-current-model-only.mjs` (tradein_model so do modelo da mensagem atual).

## Deploy de qualidade dos agentes 2026-06-14

Investigacao revelou que TODO o conjunto de patches de qualidade de 2026-06-12 (humanizer + anti-tell + pre-consulta) **nunca tinha sido deployado** no workflow vivo — os apply scripts liam `N8N_PUBLIC_API` (ausente do `.env.local`, que so tem `N8N_API_KEY`), entao sempre lancavam erro. Nenhum backup desde 2026-06-13 carregava esses marcadores.

**Fase 1 (deployada 2026-06-14, `updatedAt` 13:1x):**
- `apply-repasse-humanizer.mjs` — sanitizador deterministico (`repasseHumanizeMessage`) injetado nos 4 nodes `Code Parse Bia *` (pos-LLM, pre-envio): mesmo que o LLM gere travessao/`;`/`apareceu`, a mensagem REAL sai limpa. (Env-var corrigida para cair em `N8N_API_KEY`.)
- `patch-bia1-confident-stock.mjs` — Bia 1: remove a diretiva positiva de hedge (`Use linguagem de pre-consulta ("apareceu por aqui"...)`), passa a afirmar estoque com confianca, e estende a REGRA DE OURO para nao re-perguntar o modelo ja informado (usa historico). O substring `apareceu por aqui` ainda aparece, mas agora dentro de `NUNCA use hedge como "apareceu por aqui"` (negativo) — o guard negativo do validador foi refinado para mirar so a diretiva positiva.

**Fase 2 (deployada 2026-06-14, `updatedAt` 13:22, via `scripts/n8n/patch-repasse-quality-phase2.mjs`):** patch cirurgico unico reconciliado, porque os scripts legados NAO sao componiveis (`apply-bias-humanization` depende do bloco `MODELO EXATO` que o `apply-bia1-stock-presence` insere, e os edits E1/E3a deste ultimo conflitam com o confident-stock ja deployado). O patch novo aplica, sobre a Fase 1:
- `Code Build Inventory Lite`: flags `desired_exact_available` + `only_nearby_alternatives`.
- `Bia 1`: bullet de sem-estoque apontando pro bloco, bloco `MODELO EXATO INDISPONÍVEL` **ja pre-limpo** (sem travessao/`;`/carimbo/`apareceu` nos exemplos), limpezas de humanizacao dos exemplos e bloco `NATURALIDADE — SEM CARA DE IA`. (Os edits E1/E3a + nearby-* dos scripts legados sao PULADOS: a Fase 1 ja corrigiu a linha do apareceu e o exemplo, e o bloco foi escrito limpo.)
- `Bia 2 ESTOQUE` / `Bia 2 SEM ESTOQUE `: limpezas de humanizacao completas + bloco `NATURALIDADE`.
Guards: unicidade de needle, `scanMessageTells` zerado antes do PUT, `new Function()` no Code node, backup, activate, verify. `DRY=1` roda contra o export local sem PUT. O `validate-repasse-next-workflow.mjs` agora exige todos esses marcadores como asserts duros (39 no total) e passa verde no workflow vivo.

> Os scripts legados `apply-bia1-stock-presence.mjs` e `apply-bias-humanization.mjs` foram **removidos** (2026-06-14) por terem sido substituidos pelo `patch-repasse-quality-phase2.mjs`. `apply-repasse-humanizer.mjs` e `patch-bia1-confident-stock.mjs` (Fase 1) seguem validos e idempotentes.

**Fase 3 (deployada 2026-06-14, mesmo dia, ultimos 2 lotes de 2026-06-12 que tambem nunca tinham subido):**
- `apply-stock-nodes-fixes.mjs` — `battery_health` no select dos 2 nos HTTP de estoque (`CRM Inventory Search`/`Precheck`), filtro `type=eq.iPhone` (evita iPad/Watch contaminarem o match de modelo), ambiguidade no `Code Build Inventory Lite` por MODELOS DISTINTOS (`familyModelKeys`, nao unidades — complementa as flags de pre-consulta), e `normalizeCapacity` no `Node13` tolerando `gb`/`tera`. (Env-var corrigida pra cair em `N8N_API_KEY`.)
- `apply-simulator-error-handling.mjs` — `Montar Body do Simulador`: throw por falta de `stock_item_id` vira degradacao graciosa (`simulation_skipped_reason`); `Simulador`: `neverError` + `onError=continueRegularOutput` para o branch de erro (4xx/5xx) deixar de ser codigo morto e o cliente nunca ficar sem resposta. (Env-var corrigida.)

O `validate-repasse-next-workflow.mjs` agora cobre os 3 deploys e passa verde no vivo. Esses dois scripts seguem idempotentes e validos.

## Cobertura de campos do lead_state — Bucket 1+2 (2026-06-14)

Como o `Edit Fields5` le **75 dos 87 campos** persistidos via `={{ $json.X }}` — e nesse ponto `$json` E o `memory` do `Memory 2 - Reconciler` (achatado pelo `Code in JavaScript2`) — o Memory 2 e o **dono de fato** desses 75. Sem o `Parse Memory`/`preserve()` (removido manualmente), qualquer campo que o Memory 2 nao emitir cai para `null` toda rodada. Auditoria encontrou **38 campos nessa situacao**, agrupados por dono recomendado:

- **Bucket 1 (fatos do cliente → Memory 1 extrai + Memory 2 preserva):** `intent_secondary`, `sentiment_current`, `objection_current`, `desired_device_type`, `secondary_color_simulation`, `pickup_datetime`, `cadastro_solicitado`, `cadastro_nome_completo`, `cadastro_data_nascimento`, `cadastro_cpf`, `cadastro_contato`, `cadastro_completo`.
- **Bucket 2 (derivados de regra → Memory 2 deriva dos insumos do estado):** `tradein_battery_suspect`, `tradein_disqualified`, `tradein_evaluation_pending`, `tradein_model_accepted`, `tradein_rejected_reason`, `cross_city_situation`, `hdi_city_needed`, `client_outside_ce`.

**Deployado via `scripts/n8n/patch-memory-cover-fields-bucket12.mjs`** (DRY=1 suportado): estende o `facts{}` + adiciona o bloco `REPASSE V2 SINAIS E CADASTRO` no Memory 1, e estende a lista de preservacao + adiciona o bloco `REPASSE V2 CAMPOS DERIVADOS E CADASTRO` no Memory 2. Regras conservadoras anti-alucinacao (null/preserve quando faltar evidencia; nunca inventar CPF/nome/cidade-de-estoque/elegibilidade). Validador estendido (53 asserts duros, verde no vivo).

> **Regressao detectada 2026-06-14:** o GET ao vivo desta sessao ja vinha **sem a Fase 3** (stock-node fixes + simulator error handling) — uma edicao/restauracao manual entre sessoes reverteu para uma versao pre-Fase 3 (Fases 1 e 2 sobreviveram). Re-aplicada com os dois scripts idempotentes da Fase 3. **Licao: sempre rodar o validador no inicio da sessao** antes de patchar — o vivo pode ter sido revertido manualmente.

## Bucket 4 — node deterministico de roteamento (2026-06-14, RESOLVE INTERRUPCAO)

**Interrupcao detectada:** apos a delecao do `Parse Memory`, ninguem computava as flags de roteamento. O `Switch3` (que decide Bia1 / estoque / Bia2 / spam) le essas flags de `$json` e **NAO tem `fallbackOutput`** → com tudo `null` o item era descartado → **bot mudo**. Confirmado na exec real `405819`: `lastNodeExecuted: Edit Fields5`, nenhuma `Bia`/envio rodou, nem o `POST Lead_State`.

**Correcao deployada (`scripts/n8n/patch-add-routing-flags-node.mjs`):** novo node de codigo **`Code Routing Flags`** (fonte em `scripts/n8n/repasse-code-routing-flags.js`) inserido `Edit Fields5 → Code Routing Flags → Switch3`. Ele restaura a arvore de decisao deterministica do antigo `Parse Memory` (`setMainRoute`, `shouldPrecheckInventory`, `shouldSimulateNow`, gates de inventario, `context_ready`/`missing_fields` deterministicos, defaults de funil) **SEM reconciliar lead_state** (o `Memory 2 - Reconciler` continua dono do estado semantico — o node so LE o estado ja reconciliado). As flags sao transitorias (nao persistem; o `POST Lead_State` le de `$('Edit Fields5')`). FAQ comercial (`matchCommercialFaq`) ficou de fora por ora (respeita `faq_found` se ja vier no estado). Validador estendido (56 asserts + guarda de wiring: `Edit Fields5` nao pode ligar direto no `Switch3`). **Verificado ao vivo (smoke + exec `405839`):** `Code Routing Flags` → `Switch3` → resposta enviada; bot voltou a responder.

## Bucket 3 — carry-forward deterministico (DEPLOYADO 2026-06-14)

Os campos abaixo **nao devem** ir para prompt de LLM (causaria alucinacao). Ate 2026-06-14 o `POST Lead_State` (`Code in JavaScript`, que grava a linha inteira lendo do `Edit Fields5`) os **zerava** toda rodada porque vinham `null` de `$json` (Memory 2 nao os produz), sobrescrevendo o que os branches de inventario/simulador persistiram no turno anterior.

**Correcao deployada (`scripts/n8n/patch-leadstate-carry-forward-bucket3.mjs`):** o `Code in JavaScript` agora resolve o estado anterior em `prev` (de `$('Code Parse Memory 2').last().json.lead_state`, fallback `$('CRM Leads GET')`) e aplica fallback por campo **so quando o valor fresco vier ausente**:
- `cf(cur, key)` — usa o fresco se presente, senao `prev[key]`: `stock_item_id`, `stock_city`, `last_simulation_total`, `secondary_color_simulation`.
- `latch(cur, key)` — monotonico booleano (`cur === true || prev === true`): `simulation_done`, `pix_data_sent`.
- `maxNum(cur, key)` — monotonico numerico (`Math.max`): `simulation_count` (nunca regride).

Quando os nodes de inventario/simulador/PIX **rodam** no turno, o comportamento e identico ao anterior (valor fresco vence); so o null-overwrite e evitado. Memory 2 **nao** vira dono desses campos. `cross_city_situation`/`hdi_city_needed`/`client_outside_ce` ficaram com o `Memory 2 - Reconciler` (Bucket 2, derivados) — nao entram neste carry-forward para nao criar dupla-fonte. Campos de funil (`conversation_status_next`, `attendance_owner_next`, `sales_stage_next`) sao gravados por outro node (`CRM Leads POST update_funnel`), fora do escopo deste POST.

Validador estendido (61 asserts: `Bucket 3 carry-forward`, `readPrevLeadState`, `cf(input.stock_item_id…)`, `latch(input.pix_data_sent…)`, `maxNum(input.simulation_count…)`). **Verificado ao vivo (smoke + exec `405841`):** bot continua respondendo nos 2 turnos, sem regressao. O node `Code Refresh Lead State Before Switch2` (carry-forward parcial, mas so no branch de estoque, depois do Switch3) continua existindo e e complementar.

## Contratos de API usados pelo workflow

- `crm-leads-api` GET/POST usa header `x-api-key` com `CRM_N8N_API_KEY`.
- `crm-leads-api` POST atualiza memoria, `lead_state` e funil por actions separadas:
  - `update_memory`
  - `upsert_lead_state`
  - `update_funnel`
- `stock_items` e `crm_ai_entry_settings` via `/rest/v1` usam HTTP Custom Auth com headers:
  - `apikey`
  - `Authorization`
- `crm-send-message` usa `Authorization: Bearer ...`.
- `crm-simulator-quote` usa `x-api-key` com `CRM_N8N_API_KEY`.

## Evolucoes manuais observadas no snapshot vivo

- Nodes de persistencia de contexto de lead:
  - `CRM Leads POST Lead_State`
  - `CRM Leads POST Update Memory`
  - `CRM Leads POST update_funnel`
- Nodes de refresh/consulta de lead antes de roteamento:
  - `CRM Leads GET Webhook`
  - `CRM Leads GET Before Switch2`
  - `Code Refresh Lead State Before Switch2`
- Nodes de inventario com Supabase REST e Custom Auth:
  - `CRM Inventory Search`
  - `CRM Inventory Precheck`
  - `Code Build Inventory Lite`
- Consulta de horario comercial:
  - `Business hours`
- Envio de mensagem por Edge Function:
  - `HTTP Request`
  - `HTTP Request1`
  - `HTTP Request21`

## Manutencao

Env real lido pelos scripts: `N8N_API_KEY` + `N8N_BASE_URL` (origin = host do n8n). O `scripts/n8n/export-repasse-workflow.mjs` ja tem fallback (`N8N_PUBLIC_API || N8N_API_KEY`, `N8N_MCP_URL || N8N_BASE_URL`), entao `node scripts/n8n/export-repasse-workflow.mjs` exporta direto para `output/n8n/ia-repasse-pro-v2-current.json`. Alternativa: bata na REST API direto (`GET /api/v1/workflows/Cr4fPWe0prwS6XjI`, header `X-N8N-API-KEY`).

Os patch scripts cirurgicos (`patch-*.mjs`) seguem o mesmo formato: `GET → backup em output/n8n/backups/ → .replace()/set com guards → new Function() syntax-assert → PUT → /activate → re-export para output/n8n/ia-repasse-pro-v2-current.json`. `DRY=1` previsualiza sem gravar. Sempre validar depois com `node scripts/n8n/validate-repasse-next-workflow.mjs` e confirmar `active: true` (o agente fica mudo se o workflow ficar OFF).
