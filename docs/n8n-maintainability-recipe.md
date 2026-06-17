# Receita portável — manutenibilidade de workflow n8n com agente de IA

> Cole o bloco abaixo na sessão de um agente (Claude ou outro) no **outro app** que também
> tem agente de IA com fluxo em n8n. Ele reconstrói, do zero, o mesmo nível de manutenibilidade
> que aplicamos no "Ibiapaba IA v1": workflow versionado, decomposto por node, com guarda de
> drift no deploy, PUT à prova de sobrescrita, e rede de testes travando as funções.
>
> Antes de colar, preencha o bloco `CONFIG` com os dados da instância-alvo.

---

````markdown
# TAREFA — Dar manutenibilidade ao nosso workflow n8n (agente de IA)

Você vai montar, neste repo, um sistema de manutenção para um workflow n8n VIVO de
atendimento por IA. Princípio inegociável: **o workflow vivo é a fonte canônica**. Nunca
edite o JSON inteiro na mão; edite por NODE; sempre puxe antes e re-sincronize depois.

## CONFIG (preencha com a instância-alvo)
- N8N_BASE_URL  = https://SUA-INSTANCIA/api/v1/workflows
- WORKFLOW_ID   = <id do workflow vivo>
- API_HEADER    = X-N8N-API-KEY
- ENV_FILE      = env.local            # na raiz do repo; NUNCA commitar/expor o valor
- ENV_KEY       = <nome da var com o JWT da REST API>   # ver "Duas chaves" abaixo
- BASE_DIR      = n8n/<slug-do-workflow>                # pasta versionada deste workflow
- TOOL_ENTRY    = scripts/n8n_<slug>.py                 # CLI de entrada

## Duas chaves — não confunda (causa nº1 de 401)
- A **REST API** (GET/PUT do workflow) autentica com a chave de API **da conta** (no n8n
  costuma ser um **JWT `eyJ…`** gerado em Settings → API). É essa que vai em `ENV_KEY`.
- Qualquer **segredo de webhook** (header compartilhado tipo `x-n8n-api-key` de 64 chars hex)
  **NÃO** serve para a REST API — dá **401**. Não use essa no PUT.
- A ferramenta lê a chave do `ENV_FILE` e **nunca** imprime/loga o valor.

## Arquitetura da ferramenta (Python stdlib, ZERO dependências)

Crie `scripts/n8n_tool/` (pacote) + `TOOL_ENTRY` (CLI fino). Módulos com responsabilidade
única (lógica pura separada de I/O, para dar para testar sem subir rede):

1. **`netio.py`** — I/O de rede + segredo.
   - `read_env_value(env_path, key)` — parser simples de `chave=valor` (ignora `#`/vazias, tira aspas).
   - `get_workflow(key)` / `put_workflow(key, body)` — `urllib` puro; header `API_HEADER`;
     em erro HTTP, levanta com o corpo da resposta (para ver o 400/401 real).
2. **`extract.py`** — decompõe/recompõe SÓ os campos de risco (lógica pura, sem I/O):
   - Alvos extraídos: **Code nodes** (`n8n-nodes-base.code`, campo `jsCode`) e **prompts
     estáticos de Agente** (`@n8n/n8n-nodes-langchain.agent`).
   - **REGRA CRÍTICA `is_static_prompt`:** só extrai string que **NÃO começa com `=`**.
     Prompt montado por expressão (`=…`) **fica no `workflow.json`** e NÃO é extraído para
     `nodes/prompts/`. (Ver "Pegadinha do prompt-expressão" abaixo — é o que mais confunde.)
   - Campos de prompt candidatos, em ordem: `options.systemMessage`, `text`, `system`.
   - `compose(base, targets)` — **deep-copy** da base e dá splice só nos campos extraídos;
     **mais nada é tocado**. Isso garante que conexões, posições, credenciais e nodes não
     extraídos (Set/IF/Switch/HTTP/Redis) passem intactos.
   - `structural_errors(workflow)` — valida que toda conexão aponta para node existente.
3. **`naming.py`** — nomes determinísticos por **stage**:
   - `assign_stages` — node cujo nome começa com número (`00`, `30`, `50`…) define o stage;
     nodes sem número herdam o stage do vizinho à esquerda (ordena por posição x,y).
   - `filename(prefix, name, ext, used)` → `NN_slug.ext`, de-duplicado.
4. **`fsio.py`** — disco + **cabeçalhos com sentinela**:
   - Cada arquivo extraído leva um header com node/id/contrato e uma linha-sentinela
     ("não edite acima desta linha"). `strip_header` remove o header ao ler de volta, então
     o diff compara só o conteúdo real. JS e MD têm sentinelas distintas.
   - `write_json` com `ensure_ascii=False, indent=2` (mantém acento e diff limpo).
5. **`snapshot.py`** — hash + **detecção de drift**:
   - Ao puxar, grava `nodes/.snapshot.json` com `sha256` do conteúdo de cada alvo.
   - `detect_drift(old, fresh, edited)` → nomes que **você editou local E que mudaram no vivo**
     desde o último pull. Se houver, o deploy **recusa** (não sobrescreve mudança feita na UI).
6. **`validate.py`** — `check_js_source` roda **`node --check`** em cada JS (degradação
   graciosa se `node` faltar); `structural_errors` (reexporta de extract).
7. **`deploy_body.py`** — corpo do PUT **à prova do schema de escrita** (ver "Regras do PUT").
8. **`manifest.py`** — renderiza `BASE_DIR/manifest.md`: receita de edição + tabela
   node→arquivo por stage + lista de conexões. É o mapa que um agente novo lê primeiro.
9. **`commands.py`** — orquestra pull/status/build/deploy juntando lógica pura + I/O.

## CLI (TOOL_ENTRY) — 4 comandos

```
python3 TOOL_ENTRY pull             # GET vivo → grava workflow.json + decompõe em nodes/ + manifest + snapshot
python3 TOOL_ENTRY status           # lista nodes com edição local pendente
python3 TOOL_ENTRY build            # remonta workflow.json a partir das partes (valida estrutura + JS)
python3 TOOL_ENTRY deploy           # DRY-RUN: re-puxa, checa drift, valida, mostra o diff, NÃO envia
python3 TOOL_ENTRY deploy --confirm # PUT + GET de novo + re-sync de todos os arquivos
```

Fluxo do `deploy --confirm` (replique exatamente — é onde mora a segurança):
1. Lê o `workflow.json` local e quais nodes têm edição pendente (`status`).
2. **GET fresco do vivo** e compara o snapshot → se algum node editado mudou no vivo, **aborta**
   pedindo `pull` + reaplicar (anti-sobrescrita).
3. `compose(fresh, edits)` — aplica suas edições **sobre o vivo fresco** (não sobre uma base velha).
4. `structural_errors` + `node --check` em cada JS editado. Erro → aborta.
5. `put_workflow(deploy_body.build_put_body(rebuilt))`.
6. GET de novo e re-grava os 4 arquivos com o novo `versionId`.

## Como quebrar o workflow em nodes enumerados (o coração da manutenibilidade)

A decomposição tem **duas metades**: uma automática (a ferramenta) e uma manual única (a
convenção de nomes no canvas). A primeira só rende se você fizer a segunda.

**1. Decomposição automática (a ferramenta faz):** no `pull`, cada Code node e cada prompt
estático de Agente vira **um arquivo isolado** em `nodes/code/` ou `nodes/prompts/`. Assim
você conserta UM node sem abrir o JSON gigante, o diff do git fica por node, e o `node --check`
+ testes rodam por unidade. Set/IF/Switch/HTTP/Redis não viram arquivo (são declarativos) —
edita-se direto no `workflow.json`.

**2. Enumeração por stage (você faz uma vez, no canvas do n8n):** renomeie os nodes dando um
**prefixo numérico de 2 dígitos** que reflete a FASE do pipeline. Ex. de fases típicas de um
agente: `00` entrada/normalização → `03` buffer/lock → `30` contexto do lead → `40` router/memória
→ `50` contexto/RAG + dados → `60` agentes IA → `70` envio/pós-processamento. Então um node se
chama `30 Code Parse Router`, `50 Formatar Agenda`, etc.

Por que importa:
- `naming.assign_stages` lê esse prefixo e nomeia os arquivos `NN_slug.js` — então
  `nodes/code/` já sai **ordenado pela ordem de execução**, navegável de cima a baixo.
- Nodes **sem** prefixo **herdam o stage do vizinho à esquerda** (ordenação por posição x,y no
  canvas) — então você não precisa numerar todos; numere os "marcos" de cada fase e posicione
  os demais logo à direita do seu marco.
- O `manifest.md` agrupa a tabela node→arquivo por stage, virando o índice que um agente novo
  (sem contexto) lê primeiro para saber **onde mexer**.

Regras práticas da convenção:
- Prefixo = `^\d{1,3}` no **início do nome** do node (normalizado para 2 dígitos). Reservar
  faixas (00,10,20…) deixa espaço para inserir fases no meio depois.
- Mantenha o nome do node **estável**: o arquivo é derivado do nome; renomear o node renomeia o
  arquivo no próximo `pull` (o git vê como rename). Renomeie de propósito, não por acidente.
- Posicione o node logo à direita/abaixo do marco do seu stage para a herança cair certo.
- Layout do canvas é só visual para o n8n, mas para esta ferramenta a **posição é semântica**
  (define herança de stage e ordem). Trate o arranjo do canvas como parte da manutenibilidade.

Passo a passo para enumerar um workflow que ainda não é enumerado:
1. `GET` do vivo e liste os nodes por fase lógica (entrada → … → envio).
2. No canvas, **renomeie os marcos** de cada fase com o prefixo (`00 …`, `30 …`, `70 …`) e
   alinhe os nodes-satélite à direita do marco.
3. Salve no n8n, rode `pull`, confira `manifest.md` e a árvore `nodes/` — deve sair agrupada
   e ordenada. Ajuste prefixos/posições e re-`pull` até o mapa ficar legível.
4. Só então comece a editar lógica por arquivo.

## Regras do PUT (para nada ser ignorado/sobrescrito) — NÃO PULE

- O PUT **substitui** o workflow. Por isso o corpo é montado a partir do **vivo fresco** com
  suas edições aplicadas — nunca de uma cópia local possivelmente defasada.
- **`settings` é `additionalProperties:false`.** Envie só chaves do allowlist do schema:
  `saveExecutionProgress, saveManualExecutions, saveDataErrorExecution, saveDataSuccessExecution,
  executionTimeout, errorWorkflow, timezone, executionOrder, callerPolicy, callerIds,
  timeSavedPerExecution, availableInMCP`.
- **Confira o spec da SUA instância:** `GET N8N_BASE_URL/../openapi.yml`, schema `workflowSettings`.
  Campos que o GET devolve mas o schema de escrita **não** aceita causam **HTTP 400** — tire-os
  do corpo antes do PUT. (No nosso caso era `timeSavedMode`: o GET devolve, o PUT recusa; o
  certo é `timeSavedPerExecution`.) Se o PUT der 400, leia o corpo do erro e remova o campo citado.
- **`availableInMCP` é permitido — mantenha `true`** se o workflow é exposto via MCP (sem passo de UI).
- **Default `executionOrder: "v1"`** se ausente.
- **NÃO** envie `id`, `versionId`, `active`, `createdAt`, `updatedAt`, `tags`, `pinData` no corpo;
  envie só `name`, `nodes`, `connections`, `settings`.
- **Credential refs (`{id, name}`) nos nodes são mantidas** — não são segredo, são ponteiros;
  apagá-las quebra a execução. (Ao importar noutra instância, **remapeie** esses ids.)

## Pegadinha do prompt-expressão (a que mais quebra)

Se o prompt do agente for montado por **expressão** (a string começa com `=`, ex.
`=Você é... {{ $json.x }}`), `is_static_prompt` retorna `false` e o campo **NÃO é extraído**
para `nodes/prompts/`. Esse prompt vive em `workflow.json` no node, em
`parameters.options.systemMessage`. Para editá-lo:
1. `pull` (sincronize).
2. Edite **só** essa string no `workflow.json` com um script (preservando escape `\n`/aspas;
   ancore por trechos únicos). Não edite "no olho".
3. `build` (se também mexeu em algum `.md`) e rode os testes.
4. `deploy --confirm` envia o `workflow.json` inteiro, então a mudança vai junto — mas **não
   espere** vê-la em `nodes/prompts/`; ela não é gerenciada lá.

## Rede de testes (funções que não podem regredir)

Trave o contrato ANTES de mexer em prosa/voz. Dois tipos:

1. **Invariantes de prompt** (`tests/prompt-invariants.test.mjs`, Node puro, `node:assert`):
   - Lê o prompt estático do `.md` e o prompt-expressão do `workflow.json` (`systemMessage`).
   - Asserta as **cláusulas funcionais** que não podem sumir numa reescrita de voz: o **formato
     de saída** que os nodes downstream parseiam (ex. o JSON exato `{"messages":[...],
     "transfer":...,"handoff_note":...,"reason":...}`), gatilhos de transferência/handoff,
     regras anti-alucinação, dados fixos corretos, e a persona-alvo.
   - Edite a VOZ à vontade; se uma regra de negócio cair junto, o teste pega.
2. **Code nodes** (`tests/<node>.test.mjs` + `tests/harness.mjs`):
   - `node --check` só pega **sintaxe**, não `ReferenceError` de runtime. Rode o JS isolado
     com globals n8n mockados (`$input`, `$('Node')`).
   - `harness.mjs`: `runCodeNode(path, {$input, $, extras})`, `makeInput(json)`,
     `makeRefs(map)` (lança "unexecuted" para node fora do map, igual ao n8n).
   - Baseie payloads em execução real (`GET /executions/{id}?includeData=true`). Cubra os
     caminhos perigosos: HTTP devolvendo `{error}`, node não executado, catálogo vazio, e o
     caminho com **dados de verdade no loop**.

Rode os testes **antes** de `deploy --confirm`. Inclua um teste da própria ferramenta
(`python3 -m unittest`) para extract/compose/snapshot/deploy_body (lógica pura).

## Os 4 arquivos versionados (o `deploy --confirm` re-sincroniza)

- `workflow.json` — espelho canônico do vivo (credential refs mantidas).
- `workflow.import.json` — cópia portável (`active:false`) para reimportar noutra instância.
- `workflow-context.json` — inventário: `versionId`, `updatedAt`, contagens de node/conexão/tipo.
- `README.md` / `contracts.md` (+ `manifest.md`) — docs humanas + contratos app↔n8n.

## Cuidados específicos de n8n (ao editar Code nodes)

- Webhook entrega dados em **`$json.body`** (não `$json`). Webhooks devem ser **idempotentes**.
- Code node: modo "Run Once for All Items"; retorno **`[{json:{...}}]`**; **sem** sintaxe `{{ }}`
  (use template literals); optional chaining; **soft-fail no lugar de `throw`** em nodes de parse
  (uma exceção mata a execução inteira).
- `SplitInBatches`: saída `main[0]` = done (1x no fim), `main[1]` = cada lote. Após o loop,
  `$('Node').all()` só traz o último lote — use `$getWorkflowStaticData('global')` para acumular;
  inclua `pairedItem` em itens novos.
- Nodes normalizadores defensivos costumam ter **redundância intencional** (vários fallbacks) —
  não deduplique sem entender.
- Multi-tenant: todo payload/HTTP escopado pela chave de tenant; nunca cruze tenant.

## Skills a usar (quando/onde/por quê)

- **uncle-bob** (dois chapéus, zero regressão): prosa não dá para testar por unidade → trave os
  **invariantes funcionais** num teste ANTES de mexer na voz. Estrutura (função) fica verde o
  tempo todo; comportamento (persona) muda RED→GREEN. Use também para refatorar Code nodes com
  rede de testes; mantenha módulos pequenos e lógica pura separada de I/O.
- **n8n-code-javascript**: sempre que escrever/editar Code node (retorno, `$json.body`, soft-fail,
  SplitInBatches/cross-iteration, pairedItem).
- **n8n-expression-syntax / n8n-workflow-patterns**: ao mexer em expressões `=…` e wiring/stages.
- **writing-plans / brainstorming**: desenhe antes de codar mudanças não-triviais.

## Ordem de execução para implantar do zero

1. Faça um `GET` manual do workflow vivo e inspecione: tipos de node, onde estão os prompts
   (estático vs `=expressão`), quais Code nodes existem, qual o **contrato de saída** dos agentes.
2. Construa os 9 módulos + CLI acima, adaptando CONFIG.
3. `pull` → confira `manifest.md` e a árvore `nodes/`.
4. Escreva os testes de invariantes (trave o contrato de saída atual) + harness dos Code nodes
   mais críticos. Deixe tudo verde.
5. `deploy` (dry-run) sem alteração → deve dizer "nada a enviar".
6. Faça uma edição mínima de teste num node, `deploy` (revise o diff), `deploy --confirm`,
   confirme o novo `versionId` no vivo, reverta.
7. Commit (branch antes se estiver na default). Documente CONFIG no `README.md` do `BASE_DIR`.

## Checklist por alteração (cole no manifest.md do novo repo)

- [ ] `pull` antes de editar (sem drift).
- [ ] Editei por NODE; prompt-expressão via `systemMessage` no `workflow.json`.
- [ ] Testes de invariantes verdes + teste do node editado verde.
- [ ] `deploy` (dry-run) revisado no diff.
- [ ] PUT: settings só com allowlist, campo problemático removido (se 400), credential refs intactas.
- [ ] `deploy --confirm` + 4 arquivos re-sincronizados (versionId novo).
- [ ] Commit com rodapé de co-autoria.
````
