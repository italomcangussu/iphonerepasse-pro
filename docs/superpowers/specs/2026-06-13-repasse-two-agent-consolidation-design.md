# Consolidação para 2 agentes conversacionais — Bia 1 (Coleta) + Bia 2 (Comercial)

- **Data:** 2026-06-13
- **Workflow alvo:** `Cr4fPWe0prwS6XjI` ("ia repasse-pro v2 avancada")
- **Status:** Proposto (aguardando execução faseada)
- **Origem:** investigação da execução #405587 (Bia 2 sem estoque alucinando cores de iPhone 15 e nó HTTP `CRM Leads POST Update Memory` quebrando com JSON inválido)
- **Decisões aprovadas:** (1) divisão Bia 1 Coleta + Bia 2 Comercial; (2) trava de cor **determinística + prompt**; (3) escrever este spec antes de mexer no workflow.

---

## 1. Objetivo

Eliminar a necessidade do agente **Bia 2 SEM ESTOQUE (continuidade)**, mantendo **exatamente 2 agentes conversacionais** com responsabilidade única e maior controle/qualidade:

- **Bia 1 — Atendimento & Coleta**: tudo *antes* de existir uma oferta precificada.
- **Bia 2 — Comercial & Fechamento**: tudo *depois* de existir contexto de estoque/simulação, sempre alimentado por um snapshot comercial determinístico.

A "continuação" deixa de ser um agente e passa a ser uma **decisão determinística** (existe contexto comercial? → Bia 2; senão → Bia 1) + **injeção de FAQ** no agente do estágio atual.

## 2. Estado atual (baseline)

Dispatcher = **Switch3**, alimentado por flags que o **Parse Memory** calcula em `setMainRoute()`:

| `routing_decision` | Flag | Destino atual |
|---|---|---|
| `inventory_or_simulator` / `v2_multi_quote_inventory_or_simulator` | `shouldSearchInventory` | busca estoque → **Bia 2 ESTOQUE** |
| `bia1_pre_inventory` | `shouldUseBia1` | **Bia 1** |
| `bia2_continuation` / `ask_client_city_before_stock` | `shouldUseBia2Continuation` (liga `shouldUseBia2NoStock`) | **Bia 2 SEM ESTOQUE** |
| `spam_stop` | `shouldStopAsSpam` | — |

`setMainRoute(flag, decision)` zera todas as flags e liga uma; para `shouldUseBia2Continuation` também liga `shouldUseBia2NoStock`. Switch3:
- `out[0]` `inventory_or_simulator` (`shouldSearchInventory`) → `CRM Leads GET Before Switch2` → busca/filtra estoque → Bia 2 ESTOQUE
- `out[1]` `bia1_pre_inventory` (`shouldUseBia1`) → `Should Precheck Inventory` → Bia 1
- `out[2]` `bia2_continuation` (`shouldUseBia2Continuation || shouldUseBia2NoStock`) → **Bia 2 SEM ESTOQUE**
- `out[3]` `spam_stop`

### Infra que já existe e será reaproveitada
- Filtro de estoque `Node13-Code Filtrar Resultados Estoque` produz: `inventory_found`, `best_item`, `color_status`, `available_colors`, `available_colors_same_capacity`, `available_options`, `stock_item_id`, `last_inventory_context`.
- `last_inventory_context` é persistido via `CRM Leads POST Inventory Context` (`upsert_lead_state`) e recarregado em `Code Refresh Lead State Before Switch2`.
- Core determinístico (`scripts/n8n/repasse-deterministic-core.mjs`): `deriveTradeInDecision`, `buildAtomicTradeInResponse`, `resolveSimulationMode` — já tratam a coleta atômica do trade-in e roteiam para Bia 1.

## 3. Causa-raiz (por que a Bia 2 SEM ESTOQUE é estruturalmente ruim)

1. **Grab-bag semântico** — abrange coleta-ish, FAQ, continuação pós-venda, erro/handoff; sem responsabilidade única.
2. **Roda sem contexto comercial** — sem `inventory`/`best_item`/`available_colors` → improvisa (alucinação de cores, inclusive cores inexistentes para o modelo).
3. **Atingida prematuramente** — ex.: logo após o questionário de trade-in, antes de qualquer consulta de estoque, cai no `else`/continuation.
4. **Regras triplicadas** entre 3 prompts → drift (a regra de cor existia na ESTOQUE, não na SEM ESTOQUE).

## 4. Arquitetura alvo

### Pilar A — Snapshot Comercial determinístico (sempre presente)
Construído **sempre** (no Parse Memory ou Code node dedicado logo após), com schema estável e persistido no `lead_state`:

```jsonc
commerce_context = {
  inventory_checked_this_turn: boolean,   // estoque consultado NESTE turno
  inventory_found: boolean | null,
  best_item: object | null,
  available_colors: string[],             // SÓ cores vindas de estoque real
  available_colors_same_capacity: string[],
  available_options: object[],
  last_inventory_context: object | null,  // opções já apresentadas (persistido)
  simulation: { done: boolean, count: number, last_total: number|null, error: boolean } | null,
  allowed_colors: string[],               // união de cores permitidas (estoque + last_inventory_context)
  stage: "collection" | "presentation" | "simulation" | "closing" | "post_sale"
}
```

Regra de derivação de `stage` e `allowed_colors`:
- `allowed_colors` = união de `available_colors` ∪ `available_colors_same_capacity` ∪ cores em `last_inventory_context`. Se vazio → o agente **não pode** enumerar cor nenhuma.
- `stage` derivado das flags já existentes (`context_ready`, `shouldSearchInventory`, `simulation_done`, `proposal_accepted`, `pix_paid`).

### Pilar B — Trava determinística de cor/opção (aprovada)
Um **Code node pós-agente** (entre a saída do agente e o envio) que:
1. Faz parse da `message`.
2. Detecta nomes de cor de catálogo Apple na mensagem.
3. **Remove/bloqueia** qualquer cor mencionada que **não** esteja em `allowed_colors`. Se a remoção tornar a frase inválida (ex.: "temos em X e Y" onde ambas eram inválidas), substitui por fallback seguro ("me diz se tem alguma cor de preferência que eu confiro no estoque") e marca telemetria `color_guard_triggered=true`.
4. Nunca *adiciona* cor — só restringe.

Isso garante robustez independentemente do LLM (o prompt sozinho não é garantia).

### Os 2 agentes

**Bia 1 — Atendimento & Coleta** (evolução do Bia 1 atual)
- Escopo: triagem, FAQ pré-venda, desambiguação desejado×entrada, questionário de trade-in (atômico/determinístico já existente), cidade-antes-do-estoque, bandeira do cartão, fora de escopo/HDI.
- Nunca cita preço/cor de si mesma. Quando precisa de estoque, sinaliza a camada determinística (`shouldSearchInventory`).

**Bia 2 — Comercial & Fechamento** (promoção da Bia 2 ESTOQUE atual)
- Escopo: apresentação de estoque, simulação, objeção, fechamento, reserva, continuação pós-venda, FAQ pós-venda/garantia, handoff com mensagem.
- **Sempre** recebe `commerce_context`. Mantém as regras de cor por cenário (A/B1–B4) que já tem; reforçadas pela trava determinística.

### Roteamento simplificado (4 → 3 rotas)
`setMainRoute` passa a expor conceptualmente: `spam_stop` · `bia1_atendimento` · `bia2_comercial`. "Buscar estoque" vira **ação determinística** antes da Bia 2 (quem fala é sempre Bia 2), não uma rota de agente.

Mapeamento das decisões atuais:
| Decisão atual | Nova rota | Observação |
|---|---|---|
| `spam_stop` | `spam_stop` | inalterado |
| `inventory_or_simulator` / `v2_multi_quote` | `bia2_comercial` | precedido de busca de estoque (ação) |
| `bia1_pre_inventory` | `bia1_atendimento` | inalterado |
| `ask_client_city_before_stock` | `bia1_atendimento` | é coleta pré-estoque |
| `bia2_continuation` (garantia/disqualified/sim≥3/else) | `bia2_comercial` **se** há `commerce_context`; senão `bia1_atendimento` | FAQ injetado no estágio atual |

FAQ comercial controlado (`matchCommercialFaq`) continua determinístico; a resposta aprovada é **injetada** no prompt do agente do estágio — não há mais agente de FAQ dedicado.

## 5. Plano faseado (cirúrgico — workflow frágil)

> Regra geral (CLAUDE.md): exportar → patch → validar (`validate-repasse-next-workflow.mjs`) → reativar. Patches cirúrgicos via REST API (ver memória `n8n-export-env-var-mismatch`), nunca o build script que zera o workflow.

- **Fase 0 — Rede de segurança**
  - Snapshot do workflow atual (`output/n8n/ia-repasse-pro-v2-current.json` já atualizado).
  - Baseline do `scripts/n8n/run-repasse-scenario-audit.mjs` com **JIDs únicos** (o harness faz debounce por JID).

- **Fase 1 — Snapshot Comercial + trava de cor** (sem mudar roteamento)
  - Construir/persistir `commerce_context` + `allowed_colors` (estender Parse Memory ou novo Code node).
  - Adicionar o Code node guard pós-agente em **ambas** as saídas Bia 2 (ESTOQUE e, temporariamente, SEM ESTOQUE).
  - Reforçar Bia 1 com a regra "só cite cor de `allowed_colors`".

- **Fase 2 — Consolidar Bia 2**
  - Injetar `commerce_context` na Bia 2 ESTOQUE em **todas** as entradas, incluindo os casos hoje da continuação.
  - Re-apontar `Switch3 out[2]` (bia2_continuation com commerce_context) para a **Bia 2 (ESTOQUE)**.
  - Validar paridade pelo harness (sem regressões nos cenários de continuação/FAQ/pós-simulação).

- **Fase 3 — Absorver resíduos da SEM ESTOQUE**
  - Mover para **Bia 1**: cidade-antes-do-estoque, links HDI, FAQ pré-venda + retomada.
  - Mover para **Bia 2**: FAQ pós-venda/garantia, limite de simulações, handoff com mensagem.

- **Fase 4 — Remover Bia 2 SEM ESTOQUE**
  - Deletar o nó `Bia 2 SEM ESTOQUE ` + Code Parse/Split dependentes (`Code Parse Bia 2 SEM ESTOQUE`, `Code Parse Bia 2 SEM ESTOQUE1`, `OpenRouter Chat Model4`, `Postgres Chat Memory2`, etc. — auditar antes).
  - Simplificar Switch3 para 3 saídas.
  - Rodar quality-gate completo (`test-repasse-quality-gate.mjs`).

- **Fase 5 — Docs & tooling**
  - Atualizar seção "AI pipeline" do `CLAUDE.md` (não há mais dois estados de Bia 2; descrever Bia 1/Bia 2 + snapshot).
  - Atualizar `docs/superpowers/specs/2026-06-12-n8n-repasse-v2-live-context.md`.
  - Ajustar `build-repasse-next-workflow.mjs` / `validate-repasse-next-workflow.mjs` para a topologia de 2 agentes.

## 6. Controles de qualidade

- **Bloco de política compartilhado** (desambiguação desejado×entrada, cidade, handoff, cor) definido **uma vez** e injetado nos 2 system messages via script de patch — fim do drift entre prompts.
- **Validação de schema + trava de cor** na saída de cada agente (estende os Code Parse atuais): `{message, transfer}` válido e sem cores fora de `allowed_colors`.
- **Quality-gate** com casos obrigatórios:
  - pós-trade-in → apresentar cores **reais** do estoque;
  - **teste negativo de alucinação de cor** (estoque vazio → nenhuma cor enumerada);
  - cidade-antes-do-estoque;
  - FAQ pré-venda e pós-venda;
  - re-simulação (cor alternativa / PIX como entrada).
- **Telemetria** em `crm_event_log`: `routing_decision`, agente escolhido, `color_guard_triggered`, `allowed_colors_empty_when_color_mentioned`.

## 7. Riscos & mitigação
- **Workflow frágil / desativa no deploy** → patches cirúrgicos via REST + reativar + verificar `active:true` após cada PUT.
- **Regressão de continuação** ao consolidar na Bia 2 → Fase 2 só avança com paridade no harness.
- **Prompt da Bia 2 fica grande** ao absorver continuação → mitigado pelo `commerce_context` determinístico (menos lógica no prompt) e pelo bloco de política compartilhado.
- **Debounce do harness por JID** → sempre usar JIDs únicos por cenário.

## 8. Critérios de aceite
- Apenas 2 agentes conversacionais ativos (Bia 1, Bia 2); nó SEM ESTOQUE removido.
- Nenhuma cor mencionada por qualquer agente fora de `allowed_colors` (verificado por teste negativo).
- `CRM Leads POST Update Memory` e `update_funnel` gravando memória sem erro de JSON (já corrigido nesta investigação).
- Quality-gate verde, incluindo os casos novos.
- Docs e scripts atualizados para a topologia de 2 agentes.

## 9. Já feito nesta investigação (pré-requisitos / paliativos)
- Corrigido `CRM Leads POST Update Memory` e `CRM Leads POST update_funnel` para montar o body via `JSON.stringify` (escapa aspas) — `scripts/n8n/patch-update-memory-jsonbody.mjs`.
- Reforço de prompt: regra de cor na Bia 2 SEM ESTOQUE e Bia 2 ESTOQUE; desambiguação trade-in×desejado no Memory 1/Memory 2; passthrough de `memory` no Edit Fields5 — `scripts/n8n/patch-bia2-colors-and-tradein.mjs`.
- Esses paliativos serão **superados** pelas Fases 1–4 (trava determinística + snapshot + consolidação).

### Progresso (2026-06-13)
- **Fase 0 (baseline):** `test-repasse-deterministic-core` e `test-repasse-humanizer` verdes. `test-bia1-stock-presence` tem **4 falhas pré-existentes** (não relacionadas a este trabalho). `validate-repasse-next-workflow.mjs` tem **drift pré-existente** (espera marker `desired_exact_available` em `Code Build Inventory Lite`, ausente no workflow ao vivo e no export commitado) — checar/atualizar o validador em momento oportuno.
- **Fase 1 (núcleo determinístico — FEITO):**
  - `scripts/n8n/repasse-commerce-context.mjs` — `buildAllowedColors`, `buildCommerceContext`, `enforceAllowedColors` + runtime embutível (`buildCommerceContextRuntime`). **22 asserções verdes** em `scripts/n8n/test-repasse-commerce-context.mjs`, incluindo o caso exato do #405587.
  - **Trava de cor determinística LIVE** via `scripts/n8n/patch-color-guard.mjs` nos dois Code Parse que extraem a `message` dos agentes Bia 2 (`Code Parse Bia 2 SEM ESTOQUE` = saída da Bia 2 ESTOQUE; `Code Parse Bia 2 SEM ESTOQUE1` = saída da Bia 2 SEM ESTOQUE). Roda após o parse, sobre `router.message`, item 1:1 sem rewiring; `allowed_colors` derivado só de fontes do turno atual (try/catch ignora nós não executados). Telemetria em `color_guard` (triggered/violations/mentioned). Workflow segue `active:true`, 139 nós.
  - **Refinamento anti-falso-positivo:** a trava agora também permite cores que o **cliente mencionou no turno** (`message_buffered` + `desired_color`/`tradein_color`/`secondary_color_simulation`) via `extraAllowed` — eco da escolha do cliente não dispara. Replay sobre 40 execuções reais: **1 catch verdadeiro (#405587), 0 falsos-positivos**, eco (#405566) suprimido. Harness de replay: `scripts/n8n/replay-color-guard.mjs`.
  - **Fluidez (qualidade de conversa):** regra "NÃO REAFIRME A ESCOLHA DO CLIENTE" adicionada a Bia 1, Bia 2 ESTOQUE e Bia 2 SEM ESTOQUE (`scripts/n8n/patch-fluidez-no-restatement.mjs`) — quando `desired_model`/`desired_color` já estão no estado, o agente avança em vez de repetir a escolha ("vi que você quer X rosa!").
- **Fase 1 (restante):** persistência do `commerce_context` no lead_state (hoje é computado em memória por turno).
- **Fase 2 — backbone (FEITO, 2026-06-13):**
  - Code node **`Code Commerce Context`** inserido entre `Edit Fields10` → `Bia 2 ESTOQUE` (`scripts/n8n/patch-commerce-context-node.mjs`). Aditivo + passthrough + try/catch (pior caso re-emite o item inalterado). `type=code v2`, `id` UUID, `mode=runOnceForAllItems`, `pairedItem` preservado. Computa `commerce_context` (com `allowed_colors`/`stage`) a partir de `inventory` (caminho ESTOQUE) ou `last_inventory_context` (continuação). Validado: sintaxe + funcional (ambos caminhos) + estrutural (140 nós, sem conexões pendentes, não-órfão).
  - Prompt da Bia 2 ESTOQUE ganhou bloco **"SNAPSHOT COMERCIAL (FONTE ÚNICA)"** com `allowed_colors` (ofereça só estas). Aditivo, com fallbacks — Bia 2 fica pronta para absorver tráfego de continuação.
  - **Nota n8n-code-tool:** o workflow **não tem** nenhum `@n8n/n8n-nodes-langchain.toolCode` (os agentes são `agent` com model+memory) → consolidação é via Code node + Switch + prompt, nunca via toolCode.
- **Validação ao vivo (2026-06-13):**
  - `run-repasse-scenario-audit --run-live` (10 cenários) **bloqueado** por incompatibilidade pré-existente com o schema de prod (`unique_lead_per_store`); falhou no 1º insert, **zero efeito colateral**. Ver [[repasse-live-validation-tooling]].
  - **Smoke ao vivo (`scripts/n8n/smoke-live-bia2.mjs`)** no lead sandbox `558899990507`: 2 turnos, execuções 405643/405644 **success**. "Quero iPhone 15 + tenho iPhone 12 de entrada" → pede cidade; "quais as cores do iPhone 15?" (sem estoque) → **pivota para avaliação de trade-in, NÃO inventa cores** (bug do #405587 não reproduz). `update_funnel` confirmado gravando live sem erro de JSON.
- **Fase 2 — superset + flip (EM PROGRESSO):**
  - Seção aditiva **"MODO CONTINUIDADE"** (gated em `commerce_context.inventory_checked_this_turn`) construída e validada como artefato em `scripts/n8n/patch-bia2-continuity-mode.mjs` (com `REVERT=1`). Foi aplicada e **revertida** do ESTOQUE ao vivo: como o flip ainda não ocorreu, ela não traria benefício e eu não consegui confirmar empiricamente ausência de regressão no tráfego real de estoque (o caminho ESTOQUE exige buildup multi-turno + extração + estado limpo, que o sandbox não entrega de forma limpa num smoke). **Deve entrar junto com o flip, como um passo validado único.**
  - **Smokes dirigidos** revelaram (e resolvi) 4 problemas de infra de teste pré-existentes: env mismatch, `unique_lead_per_store` no harness, `body.lead_id` precisa ser telefone numérico, isolamento de memória via `meta.scenario_id`, e reset de estado na tabela correta `lead_state` (não `crm_lead_state`). Ver [[repasse-live-validation-tooling]].
  - **Flip (`Switch3 out[2]` → pipeline Bia 2) NÃO aplicado:** alto risco em tráfego real + shape de item da continuação (Edit Fields5: `first_name`/`message_buffered`) difere do esperado pelo ESTOQUE (`firstName`/`buffer.message_buffered`) → exige normalização de shape antes do flip. Pré-validação synthetica limpa está bloqueada; recomendação: canary com monitoramento de execuções reais, OU normalizar shape + concluir o fix do harness.
- **Validações ao vivo confirmadas (lado positivo):** pipeline saudável (execuções success), `color_guard` ativo sem falso-positivo (allowed_colors=[] → nenhuma cor inventada), `update_funnel`/`update_memory` gravando sem erro de JSON.

### Fase 2 — FLIP da rota de continuação APLICADO (2026-06-13, canary)
Rota 1 de 3 da continuação migrada para a Bia 2 unificada:
- **Topologia:** `Switch3 out[2] → Code Normalize Continuation → Code Commerce Context → Bia 2 ESTOQUE`. Normalizador (`scripts/n8n/patch-fase2-flip.mjs`) mapeia o shape da continuação (Edit Fields5) para o que a ESTOQUE lê — crítico `buffer.message_buffered` ← `message_buffered`, `inventory=null` (→ `inventory_checked_this_turn=false` → ramo MODO CONTINUIDADE), `name`. Resto passa direto (first_name, memory, faq_*, media_context, last_inventory_context, store_open, local_time, after_hours).
- **MODO CONTINUIDADE** re-aplicado ao prompt da Bia 2 ESTOQUE (agora ativo e útil: trata estoque-não-consultado sem cair em CENÁRIO C "indisponível").
- **Validação:** execução 405652 = success; rodou `Code Normalize Continuation → Code Commerce Context → Bia 2 ESTOQUE`; sem erro, sem cor inventada (`allowed_colors=[]`, guard não disparou), sem falso "indisponível". 141 nós, 0 conexões pendentes, `active:true`. Export atualizado.
- **Canary:** `scripts/n8n/canary-fase2-flip.mjs [limit] [sinceISO]` monitora a saúde do novo caminho (status, resposta, guard). Baseline pós-flip: 1/1 success.
- **Revert instantâneo:** `REVERT=1 node scripts/n8n/patch-fase2-flip.mjs` (volta `Switch3 out[2] → Bia 2 SEM ESTOQUE` e remove o normalizador) + `REVERT=1 node scripts/n8n/patch-bia2-continuity-mode.mjs`.
- **Restam 2 rotas** para a Bia 2 SEM ESTOQUE ser totalmente removível: `Switch1` (fora-de-escopo) e `Parse Simulator` (entrega de simulação). Migrar de forma análoga (com normalizador) após o canary da rota 1 estabilizar.
- **Fases 3–4:** absorver resíduos + remover a Bia 2 SEM ESTOQUE + Switch3 4→3 saídas.

### Validação (/n8n-validation-expert) — 2026-06-13
Sem `validate_node`/`validate_workflow` no MCP local; usados surrogates: `node --check` do `jsCode` (✓), invariância estrutural (139 nós, 113 conexões, in/out dos alvos intactos — só `jsCode`/`systemMessage` mudaram), validador do projeto parando no **mesmo ponto pré-existente** (drift do marker `desired_exact_available`, nó não tocado), suite unitária (26+core+humanizer verdes) e replay de produção (0 falsos-positivos). Nenhuma regressão nova introduzida.

---

## 10. Compatibilidade com n8n (revisado pelas skills)

Análise cruzada com as skills `n8n-workflow-patterns`, `n8n-code-javascript`, `n8n-node-configuration`, `n8n-expression-syntax`, `n8n-validation-expert`. Cada item lista o achado e a correção que passa a fazer parte do spec.

### 10.0 ⚠️ Restrição de tooling (a mais importante)
O MCP n8n disponível aqui expõe **apenas** `search_workflows`, `get_workflow_details`, `execute_workflow`. **Não** há `validate_node`, `validate_workflow`, `n8n_update_partial_workflow`, `patchNodeField`, `n8n_autofix_workflow` nem `cleanStaleConnections`. Consequências que o spec adota:
- **Patching via REST API PUT** do workflow inteiro (já validado nesta investigação), não via `patchNodeField`.
- **Auto-sanitização NÃO roda** em PUT cru (ela só roda nos updates via MCP). Portanto **toda condição de Switch/IF precisa ser entregue já válida** (metadata `conditions.options` completa), e **conexões precisam ser mantidas manualmente consistentes** (não há `cleanStaleConnections`).
- **Validação** = `scripts/n8n/validate-repasse-next-workflow.mjs` + harness de cenários, não as ferramentas MCP de validação.

### 10.1 Code nodes (`commerce_context` builder + trava de cor) — typeVersion 2
- **Formato de retorno** `[{json:{...}}]`: ok (os Code nodes atuais já seguem).
- **`pairedItem` obrigatório**: a trava de cor fica no caminho de envio (Set/`Loop Over Items`/HTTP). Se ela **criar item novo**, os Set/HTTP a jusante quebram com `paired_item_no_info`. → **Correção:** a trava deve **mutar a `message` do item existente e retorná-lo com o `pairedItem` preservado**, nunca emitir item novo.
- **Sem `{{ }}` dentro de Code node**: usar JS direto; referência a outros nós sempre `$('Node').first()/.last().json` (nunca `$('Node').json`). Os nós atuais já fazem isso.
- **Catálogo de cores estático em código** (léxico Apple) para *detectar* tokens de cor; comparar contra `allowed_colors`. Nada de HTTP no guard.
- **Cross-iteration / SplitInBatches**: `commerce_context` deve ser montado **uma vez, ANTES** dos loops (`Loop Over Items*`). Dentro de loop, `$('Node').all()` retorna só a última batch — não montar contexto lá.
- **typeVersion**: novos Code nodes em **v2** (igual aos existentes); novos Set em **v3.4**. Node `id` deve ser **UUID v4**.

### 10.2 Ponto de inserção da trava de cor (output do agente)
- O AI Agent entrega texto em **`$json.output`** (string, normalmente cercada por ```json). → **Correção:** a trava roda **depois** do parse que já existe (`Code Parse Bia 2 SEM ESTOQUE` → hoje vai para `CODE MONTAR LINK REPASSE 2`; e `Code Parse Re-simulacao Bia 2 ESTOQUE` no lado ESTOQUE), operando sobre o `message` **já parseado**, não sobre o `$json.output` cru.

### 10.3 Switch 4→3 rotas (Switch3 é v3.4, `typeValidation: strict`)
- **Branch count mismatch não é auto-corrigível**: ao remover a saída `bia2_continuation`, é obrigatório **remover/religar também a conexão de saída correspondente** no objeto `connections`, senão `validate_workflow` acusa incompatibilidade (e, sem `cleanStaleConnections`, a limpeza é manual no PUT).
- **Condições já válidas**: manter o padrão atual (expressão booleana `={{ ... }}` com `operator` boolean/true + metadata `{caseSensitive, typeValidation:"strict", version:3}`). Não confiar em sanitização pós-save.
- Referência da Switch a flags: hoje usa `$json.shouldUseBia2Continuation === true || $json.shouldUseBia2NoStock === true`; ao consolidar, a nova rota `bia2_comercial` deve cobrir esses casos **com `commerce_context` presente**.

### 10.4 Expressões de injeção do `commerce_context`
- Em `text`/`systemMessage` de agente, usar **`={{ ... }}`** (prefixo `=`); os prompts atuais já fazem. `$json.commerce_context?.allowed_colors` com optional chaining é válido.
- **Nome de nó com espaço final** `"Bia 2 SEM ESTOQUE "`: qualquer `$('Bia 2 SEM ESTOQUE ')` exige o espaço exato. Na Fase 4, ao remover o nó, **eliminar todas as referências** a ele (senão vira `invalid_reference`).
- Dados de webhook ficam sob `.body` — manter `$('Webhook').last().json.body...` onde já se usa.

### 10.5 Persistência HTTP do `commerce_context`
- Reusar o padrão seguro **`state: {{ JSON.stringify($json) }}`** já presente em `CRM Leads POST Inventory Context` (escapa aspas — mesma classe do bug do #405587).
- Nós de escrita (`upsert_lead_state`, `update_memory`) podem retornar **0 itens**; se algo depender da saída deles, setar **`alwaysOutputData: true`** e a jusante usar `$('NóUpstream').all()`.

### 10.6 Agente com múltiplas entradas (consolidação na Bia 2)
- A Bia 2 (ESTOQUE) passará a receber também os casos de continuação. O nó agente roda por item de entrada; garantir que **todos os caminhos entreguem o mesmo shape** com `commerce_context` populado (mesmo que "vazio"/`inventory_checked_this_turn:false`), para o prompt nunca ler `undefined`.
- **Não funilar agentes paralelos em Merge `combineAll`** (cross-product/0 itens). A topologia atual entrega cada saída direto ou via parse próprio — manter assim.

### 10.7 Ordem de execução
- Workflow já em **`executionOrder: v1`** (connection-based) — requisito para o roteamento determinístico funcionar previsivelmente. Manter.

### 10.8 Ajuste no plano faseado decorrente da análise
- **Fase 1** passa a incluir explicitamente: (a) `pairedItem` preservado na trava; (b) trava posicionada após os Code Parse; (c) catálogo de cor estático.
- **Fase 4** passa a incluir explicitamente: (a) remoção da conexão `Switch3 out[2]` junto com o nó; (b) varredura de referências `$('Bia 2 SEM ESTOQUE ')`; (c) revalidação de branch-count no PUT.
- **Validação** em todas as fases via `validate-repasse-next-workflow.mjs` + harness (não há MCP validate aqui).

### 10.9 Veredito de compatibilidade
O desenho é **compatível** com n8n. Não há nenhum padrão usado que o n8n não suporte. Os riscos são **operacionais** (PUT cru sem auto-sanitização/validação MCP) e se resolvem com: condições/conexões hand-authored válidas, `pairedItem` preservado, `JSON.stringify` nos bodies, `alwaysOutputData` nos writes, e validação pelo script/harness do projeto antes de reativar.
