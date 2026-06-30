# TAREFA — Manutenibilidade + deploy seguro de um workflow n8n VIVO (agente de IA) — DESIGN EVOLUÍDO

Você vai construir, NESTE repositório, um sistema de manutenção de workflow n8n. Ele é derivado
do que rodamos no iPhoneRepasse Pro, **mas já corrige as 4 dívidas estruturais que aquele sistema
acumulou** (marcadas com ✦ abaixo). Princípio inegociável: **o workflow VIVO é a fonte canônica**.
Nunca edite o JSON inteiro na mão; edite por NODE; sempre puxe (`pull`) antes e re-sincronize
depois. Toolchain em **JavaScript ESM (.mjs), Node ≥18, ZERO dependências** (só `node:` builtins +
`fetch` global).

## ✦ As 4 evoluções que distinguem este design do "ingênuo"
1. **Comando `edit-prompt` no CLI** em vez de um patch script bespoke por edição de prompt-expressão.
   (No sistema antigo isso gerou 65 scripts `patch-*.mjs` quase idênticos — não repita esse erro.)
2. **`patch-kit.mjs`**: uma lib de I/O única que QUALQUER edição estrutural rara importa — nada de
   copiar `readEnvFile`/`fetch`/backup/PUT em cada script.
3. **Fonte canônica ÚNICA**: o guard e o CLI compartilham `BASE_DIR/nodes/.snapshot.json`. Sem
   snapshot paralelo + arquivos-espelho `*.js` soltos (que no antigo divergiam do CLI).
4. **`deploy` roda os testes e mostra diff textual** antes do PUT, e ABORTA se vermelho — o gate
   de teste é da ferramenta, não da disciplina humana.

## 0) CONFIG (preencha; é a ÚNICA fonte desses valores — guard, CLI, patch-kit e hook leem daqui)
- N8N_BASE_URL  = https://SUA-INSTANCIA            # origin; a tool usa `${origin}/api/v1/...`
- WORKFLOW_ID   = <id do workflow vivo>
- API_HEADER    = X-N8N-API-KEY
- ENV_FILE      = .env.local                       # raiz do repo; NUNCA commitar/expor o valor
- ENV_KEYS      = N8N_API_KEY[,N8N_PUBLIC_API]     # nomes das vars (ordem de fallback)
- BASE_URL_KEYS = N8N_BASE_URL[,N8N_MCP_URL]
- BASE_DIR      = n8n/<slug-do-workflow>           # pasta versionada (fonte canônica única)
- TOOL_DIR      = scripts/n8n/tool                 # módulos puros + I/O
- TOOL_ENTRY    = scripts/n8n/maint.mjs            # CLI fino
- GUARD         = scripts/n8n/guard-live-workflow-sync.mjs
- HOOK          = scripts/n8n/hooks/n8n-live-guard-hook.mjs
- BACKUP_KEEP   = 20                               # ✦ retenção de backups/reports
> **Multi-workflow:** se o repo tiver mais de um workflow, transforme `CONFIG` em mapa
> `{ <slug>: {WORKFLOW_ID, BASE_DIR, …} }` e aceite `--wf <slug>` no CLI/guard. Não hardcode o id
> em lugar nenhum além do CONFIG.

## 1) Duas chaves — não confunda (causa nº1 de 401)
- A **REST API** (GET/PUT/activate) usa a chave de API **DA CONTA** — no n8n, um **JWT `eyJ…`**
  (Settings → API). É a de `ENV_KEYS`.
- **Segredo de webhook** (header ~64 hex) **NÃO** serve para a REST API → **401**. Não use no PUT.
- A tool lê a chave do `ENV_FILE` e **NUNCA** imprime/loga o valor.

## 2) Arquitetura — módulos puros + I/O (replique 1:1)

`TOOL_DIR/`, responsabilidade única, lógica pura separada de I/O (testável sem rede):

1. **`config.mjs`** — exporta `CONFIG` + `paths` (workflowJson, importJson, contextJson, manifest,
   stagesConfig, codeDir=`nodes/code`, promptsDir=`nodes/prompts`, snapshot=`nodes/.snapshot.json`,
   backupsDir). ✦ Único lugar com o id/origin.

2. **`netio.mjs`** — rede + segredo, **nunca loga a chave**: `readEnvFile`, `resolveAccess()` →
   `{apiKey, origin}`; `request(method, pathname, body?)` via `fetch` + `AbortController` + timeout,
   em erro HTTP **levanta com o corpo** (vê o 400/401 real); `getWorkflow/putWorkflow/activateWorkflow`.

3. **`extract.mjs`** — decompõe/recompõe SÓ os campos de risco:
   - Alvos: **Code** (`n8n-nodes-base.code`/`jsCode`) e **prompts de Agente**
     (`@n8n/n8n-nodes-langchain.agent`; campos em ordem `options.systemMessage`, `text`, `system`).
   - **`isStaticPrompt`:** extrai pra arquivo só string que **NÃO começa com `=`**. Prompt-expressão
     (`=…`) fica no `workflow.json` com `expression:true` (ver §6 + comando `edit-prompt`).
   - `extractTargets`, `compose(base, edits)` via **`structuredClone`** + splice só nos campos
     editados (conexões/posições/credenciais/nodes não-extraídos passam intactos), `structuralErrors`.

4. **`stages.mjs`** — stage por **posição x** do node contra faixas de `stages.json`
   (`{id,label,xMin,xMax}`), **sem renomear nodes no canvas** (preserva refs `$('Nome')`).
   `planFiles` ordena por (x,y) e gera `NN_seq_slug.<js|md>` de-duplicado.

5. **`fsio.mjs`** — disco + **header com sentinela** por arquivo (node/type/field/stage + linha
   `// ===== ... NÃO EDITE ACIMA ... =====`). `stripHeader` remove só até a sentinela (corpo
   byte-fiel). `writeJson` (`indent 2` + `\n`). `rmDirContents` preserva `.snapshot.json`.

6. **`snapshot.mjs`** — `sha256(trimEnd(s))`, `buildSnapshot(targets)→{node→sha}`,
   `detectDrift(old, fresh, edited)` → nodes que VOCÊ editou E que mudaram no vivo → `deploy` RECUSA.

7. **`validate.mjs`** — `checkJsSource` = `new Function(src)` (syntax-assert, não executa);
   `checkAllCode`; re-exporta `structuralErrors`.
   - ✦ **`secretScan(workflow)`** — varre `parameters` por padrões de segredo (JWT `eyJ…`, urls de
     webhook com token, `apikey`/`secret` inline). Retorna achados; `build`/`deploy` avisam e, em
     `--strict`, abortam (evita commitar segredo no `workflow.json`).

8. **`deploy_body.mjs`** — corpo do PUT à prova do schema (ver §5):
   - `SETTINGS_ALLOWLIST` (saveExecutionProgress, saveManualExecutions, saveDataErrorExecution,
     saveDataSuccessExecution, executionTimeout, errorWorkflow, timezone, executionOrder,
     callerPolicy, callerIds, timeSavedPerExecution, availableInMCP); `SETTINGS_REJECTED`
     ([timeSavedMode] → causa 400); `buildSettings` default `executionOrder:"v1"`; `buildPutBody`,
     `buildImportBody` (+`active:false`).
   - ✦ **`remapCredentials(workflow, map)`** — ao IMPORTAR noutra instância, troca os
     `credentials.{id}` pelos ids de lá (map em `BASE_DIR/credential-map.json`). Sem isso o import
     "funciona" mas executa quebrado.

9. **`diff.mjs`** ✦ — `textDiff(oldBody, newBody)` (diff de linhas simples, sem dep) p/ o dry-run
   mostrar o que muda em cada node, não só o nome.

10. **`harness.mjs`** ✦ — `runCodeNode(filePath, {$input, $, extras})`, `makeInput(json)`,
    `makeRefs(map)` (lança "unexecuted" p/ node fora do map, igual ao n8n). Roda o JS isolado com
    globals n8n mockados → pega `ReferenceError`/contrato, não só sintaxe. Payloads vêm de execução
    real (`GET /executions/{id}?includeData=true`).

11. **`manifest.mjs`** — `renderManifest(...)` → `BASE_DIR/manifest.md`: receita + tabela
    node→arquivo por stage + prompts-expressão + conexões. Não hardcode nome/id do workflow (leia
    do CONFIG/workflow).

12. **`commands.mjs`** — orquestra (ver §3).

13. **`patch-kit.mjs`** ✦ — lib única para edições estruturais raras (que NÃO são Code/prompt
    geridos por arquivo): `getLive()`, `backup(live)`, `replaceOnce(hay, needle, repl, label)`
    (guard de exatamente 1 ocorrência), `assertSyntax(code)`, `safePut(rebuilt)` (= buildPutBody +
    PUT + activate + re-pull), `dry(obj)`. Todo script de edição pontual importa daqui — nunca
    recopia I/O.

## 3) CLI (`TOOL_ENTRY`)
```
node TOOL_ENTRY pull                 # GET vivo → 4 arquivos + decompõe + manifest + snapshot
node TOOL_ENTRY status               # nodes com edição local pendente
node TOOL_ENTRY build                # remonta workflow.json (estrutura + JS + secretScan)
node TOOL_ENTRY test                 # ✦ node --test (invariantes + nodes + tool pura)
node TOOL_ENTRY edit-prompt <node> --anchor "<txt>" --to "<txt>"   # ✦ edita prompt-expressão por âncora
node TOOL_ENTRY deploy               # DRY-RUN: re-pull, drift, valida, RODA TESTES, mostra DIFF textual
node TOOL_ENTRY deploy --confirm     # PUT + activate + re-sync (só passa se testes verdes)
node TOOL_ENTRY rollback [<backup>]  # ✦ restaura último backup (ou o indicado) via safePut
```
Fluxo do `deploy --confirm` (replique EXATAMENTE — é a segurança):
1. `computeEdits()` — arquivos ≠ `workflow.json`. Vazio → "nada a enviar".
2. **GET fresco do vivo**; `detectDrift` → conflito **ABORTA** (pull + reaplicar).
3. ✦ **`node --test`** → vermelho **ABORTA**.
4. `compose(fresh, edits)`; `structuralErrors` + `checkAllCode` + `secretScan(--strict)`. Erro → ABORTA.
5. ✦ dry-run mostra `textDiff` por node editado.
6. `backup` (com retenção `BACKUP_KEEP`), `putWorkflow(buildPutBody(rebuilt))`, `activateWorkflow`.
7. GET de novo, re-grava 4 arquivos + decompõe (novo `versionId`).

## 4) Guard anti-regressão + hook (fonte canônica ÚNICA — ✦)
**`GUARD`** roda ANTES de qualquer análise/alteração do vivo: `getWorkflow`; `meaningfulSignature`
= sha de `{nodes(name,type,typeVersion,parameters,credentials) ordenados, connections,
executionOrder}` (ignora posição/ids/metadados). Compara vs **`BASE_DIR/nodes/.snapshot.json`**
(drift) e `versionId/updatedAt` vs último estado (edição manual na UI). Em drift: **re-roda o
`pull`** (re-decompõe + re-snapshot — ✦ NÃO mantém snapshot/espelhos paralelos), grava relatório
em `output/n8n/.live-guard/` (com retenção) e `version-history.jsonl`. Modos: `sync` (default),
`--check` (exit 3 em drift), `--json`, `--quiet`. Exporta `runGuard()`.

**`HOOK`** (PreToolUse, matcher Bash, **NÃO-BLOQUEANTE**): lê `tool_input.command`; se toca o vivo
(WORKFLOW_ID, `/api/v1/workflows`, ou `scripts/n8n/(patch-|edit-|export-|build-|validate-|smoke-)`,
evitando recursão do guard), roda `runGuard({mode:"sync",quiet:true})` e injeta `additionalContext`
mandando re-ler arquivos quando a base mudou. Erro vira aviso, nunca aborta. Registre em
`.claude/settings.json`:
```json
{ "hooks": { "PreToolUse": [ { "matcher": "Bash", "hooks": [
  { "type": "command", "command": "node \"$CLAUDE_PROJECT_DIR/scripts/n8n/hooks/n8n-live-guard-hook.mjs\"" }
] } ] } }
```

## 5) Regras do PUT — NÃO PULE
- PUT **substitui** o workflow → corpo a partir do **vivo fresco** + edições, nunca de cópia velha.
- `settings` é `additionalProperties:false` → só allowlist. Campo que o GET devolve e o PUT recusa
  = **400** → remova (ex.: `timeSavedMode`). Confirme na sua instância: `GET .../openapi.yml`,
  schema `workflowSettings`. PUT 400 → leia o corpo do erro, tire o campo citado.
- Default `executionOrder:"v1"`; mantenha `availableInMCP:true` se exposto via MCP.
- **NÃO** envie `id, versionId, active, createdAt, updatedAt, tags, pinData` — só
  `name, nodes, connections, settings`.
- **Credential refs `{id,name}` mantidas** (ponteiros, não segredo). Ao reimportar → `remapCredentials`.

## 6) Prompt-expressão (a que mais quebra) — agora com comando dedicado ✦
Prompt montado por expressão (`=…`) NÃO vira arquivo; vive em `workflow.json`
(`parameters.options.systemMessage`). **Edite via `edit-prompt`** (âncora única + `new Function`
de validação implícita do JSON embutido, se houver, + reuso do deploy seguro) — não escreva um
patch script novo, não edite "no olho". `pull` antes, `deploy --confirm` depois.

## 7) Edições estruturais raras (não Code/prompt) → `patch-kit.mjs` ✦
GET (ou `dry`) → `backup` → `replaceOnce` (guard de 1 ocorrência) → `assertSyntax` → `safePut`.
Idempotente (no-op se já aplicado). **Guard primeiro, sempre.** Nada de recopiar I/O.

## 8) Rede de testes (trave o contrato ANTES da voz)
- **Tool pura** (`node --test`): extract/compose/snapshot/deploy_body/secretScan/diff — round-trip
  byte-fiel, drift, allowlist do PUT, remap, scan.
- **Invariantes de prompt**: leia prompt (`.md` estático + expressão do `workflow.json`) e asserte
  **cláusulas funcionais** (formato de saída JSON que o downstream parseia, gatilhos de
  transfer/handoff, anti-alucinação, dados fixos, persona). Voz livre; regra que cai, teste pega.
- **Code nodes**: `harness.runCodeNode` com globals mockados de execução real. Cubra HTTP `{error}`,
  node não executado, catálogo vazio, dados reais no loop.
- ✦ `deploy` já roda tudo isso (passo 3). Rode também isolado durante o desenvolvimento.

## 9) Cuidados de n8n ao editar Code nodes
- Webhook entrega em **`$json.body`**; webhooks **idempotentes**.
- "Run Once for All Items"; retorno **`[{json:{...}}]`**; **sem `{{ }}`** (template literals);
  optional chaining; **soft-fail em vez de `throw`** em parse (exceção mata a execução).
- `@n8n/n8n-nodes-langchain.agent` emite só `{output}` e **dropa contexto upstream** → o
  `Code Parse *` seguinte re-anexa o que o downstream lê.
- `SplitInBatches`: pós-loop `$('Node').all()` só traz o último lote → use
  `$getWorkflowStaticData('global')`; inclua `pairedItem`.
- Multi-tenant: tudo escopado pela chave de tenant; nunca cruze tenant.

## 10) Ordem de implantação do zero
1. `GET` manual do vivo; mapeie tipos de node, prompts (estático vs `=`), Code nodes, **contrato de
   saída** dos agentes.
2. `stages.json` com faixas de x (entrada→…→envio).
3. Módulos + CLI + GUARD + HOOK + `patch-kit` + `harness` (CONFIG preenchido).
4. `pull` → confira `manifest.md` e `nodes/`.
5. Testes de invariantes + harness dos Code nodes críticos. Verde.
6. `deploy` (dry-run) sem alteração → "nada a enviar".
7. Edição mínima (via `edit-prompt` ou arquivo) → `deploy` (revise diff+testes) → `deploy --confirm`
   → confirme `versionId` → reverta (`rollback`).
8. Commit (branch antes se na default). Documente CONFIG no `README.md` do `BASE_DIR`.

## 11) Checklist por alteração (cole no manifest.md)
- [ ] GUARD/`pull` antes (sem drift).
- [ ] Editei por NODE; prompt-expressão via `edit-prompt`.
- [ ] `node TOOL_ENTRY test` verde (o `deploy` reforça).
- [ ] `deploy` (dry-run): diff textual + secretScan revisados.
- [ ] PUT: settings allowlist, campo problemático removido (se 400), credential refs intactas.
- [ ] `deploy --confirm` + re-sync (versionId novo) + reativado.
- [ ] Commit com rodapé de co-autoria.

## Skills (se disponíveis)
- **n8n-code-javascript** (retorno `[{json}]`, `$json.body`, soft-fail, SplitInBatches/pairedItem).
- **n8n-expression-syntax / n8n-workflow-patterns** (expressões `=…`, wiring/stages).
- **uncle-bob** (trave invariantes ANTES da voz; módulos pequenos; lógica pura ≠ I/O).
- **writing-plans / brainstorming** (desenhe antes de codar).
