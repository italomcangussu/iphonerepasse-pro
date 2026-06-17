# n8n — ia repasse-pro v2 avancada (manutenibilidade)

Sistema de manutenção do workflow n8n **VIVO** `Cr4fPWe0prwS6XjI` ("ia repasse-pro
v2 avancada"). Princípio inegociável: **o workflow vivo é a fonte canônica**.
Nunca edite o JSON inteiro na mão; edite por NODE; sempre `pull` antes e
re-sincronize depois. Receita de origem: [docs/n8n-maintainability-recipe.md](../../docs/n8n-maintainability-recipe.md).

## CONFIG (esta instância)

| chave | valor |
| --- | --- |
| WORKFLOW_ID | `Cr4fPWe0prwS6XjI` |
| API_HEADER | `X-N8N-API-KEY` |
| ENV_FILE | `.env.local` (raiz) — **nunca** commitado |
| ENV_KEY | `N8N_API_KEY` (fallback `N8N_PUBLIC_API`) |
| BASE_URL | `N8N_BASE_URL` (fallback `N8N_MCP_URL`) — usa-se só o `origin` |
| BASE_DIR | `n8n/ia-repasse-pro-v2` |
| TOOL_ENTRY | `scripts/n8n/repasse-maint.mjs` |

### Duas chaves — não confunda (causa nº1 de 401)

A REST API (GET/PUT) autentica com a **chave de API da conta** (JWT `eyJ…` de
Settings → API), que vive em `N8N_API_KEY`. O segredo de webhook
(`CRM_N8N_API_KEY`, header `x-api-key` de 64 hex) **não** serve para a REST API.

## CLI

```bash
node scripts/n8n/repasse-maint.mjs pull             # GET vivo → workflow.json + nodes/ + manifest + snapshot
node scripts/n8n/repasse-maint.mjs status           # nodes com edição local pendente
node scripts/n8n/repasse-maint.mjs build            # remonta workflow.json (valida estrutura + JS)
node scripts/n8n/repasse-maint.mjs deploy           # DRY-RUN: re-puxa, checa drift, valida, mostra o diff
node scripts/n8n/repasse-maint.mjs deploy --confirm # PUT + reativa + re-sync dos arquivos
```

Atalhos: `npm run n8n:pull` / `n8n:status` / `n8n:deploy`. Testes:
`npm run test:n8n-tool`.

## Decomposição (este repo)

- **Code nodes** → `nodes/code/NN_seq_slug.js` (33 arquivos).
- **Prompts ESTÁTICOS de Agente** → `nodes/prompts/NN_seq_slug.md` (2: Memory 1 / Memory 2).
- **Prompts montados por expressão** (`=…`: Router Agent, Bia 1, Bia 2 ESTOQUE, Bia 2
  SEM ESTOQUE) **NÃO viram arquivo** — vivem em `parameters.options.systemMessage`
  no `workflow.json`. Edite-os lá por âncora; `deploy --confirm` envia o JSON inteiro.
- `NN` (stage) é inferido pela **posição x** do node (ver [stages.json](stages.json)),
  porque o canvas **não é renomeado** — 450 refs `$('Nome')` + 25 patch scripts
  dependem dos nomes atuais. Edite as faixas em `stages.json` e re-`pull`.

Cada arquivo extraído tem um **header com sentinela**; edite só o corpo abaixo
dela. `status`/`build`/`deploy` comparam apenas o corpo (o header é ignorado).

## Arquivos versionados

- `workflow.json` — espelho canônico do vivo (credential refs mantidas).
- `workflow.import.json` — cópia portável (`active:false`) p/ reimportar noutra instância.
- `workflow-context.json` — inventário: versionId, updatedAt, contagens.
- `manifest.md` — mapa node→arquivo por stage + conexões + checklist (gerado).
- `nodes/.snapshot.json` — sha256 por node (base da detecção de drift).

## Relação com o toolchain existente

Este tool **convive** com os scripts de patch cirúrgico (`scripts/n8n/patch-*.mjs`)
e o **guard anti-regressão** ([scripts/n8n/guard-live-workflow-sync.mjs](../../scripts/n8n/guard-live-workflow-sync.mjs),
hook `PreToolUse`). Rode o guard **primeiro** em qualquer tarefa no workflow vivo;
o `deploy --confirm` deste tool já faz GET fresco + checagem de drift + backup +
reativação, no mesmo espírito dos patches.

## Settings no PUT (pegadinha 400)

`settings` é `additionalProperties:false`. O GET desta instância devolve
`timeSavedMode: "fixed"`, que o **PUT recusa (HTTP 400)** — o tool remove esse
campo e envia só o allowlist (ver [deploy_body.mjs](../../scripts/n8n/tool/deploy_body.mjs)).

## Lógica pura dos parsers — fonte canônica + rede de testes

Os `Code Parse *` (que parseiam a saída dos agentes) carregam lógica pura
**inline e duplicada** porque Code nodes do n8n **não importam módulos locais**.
A fonte canônica byte-extraída vive em
[scripts/n8n/tool/parsers/blocks/](../../scripts/n8n/tool/parsers/blocks/):

| bloco canônico | nós que carregam | o que faz |
| --- | --- | --- |
| `commerce_context.block.js` | Code Commerce Context + Code Parse Bia 2 SEM ESTOQUE (×2) | color-guard (anti-alucinação de cor), `deriveStage` |
| `json_repair.block.js` | Code Parse Memory 1 e 2 | strip de cerca markdown + reparo de aspas não-escapadas |
| `bia1_tradein.block.js` | Code Parse Bia 1 | decisão de trade-in (consentimento/questionário/`canSimulate`) |
| `repasse-humanizer.mjs` (`N8N_HUMANIZER_BLOCK`) | Bia 1, Re-sim, SEM ESTOQUE (×2) | sanitiza travessão/`;`/`!` na mensagem final |

A rede [parsers.test.mjs](../../scripts/n8n/tool/tests/parsers.test.mjs) (`npm run
test:n8n-tool`) trava três coisas: **(1)** caracterização (saídas conhecidas das
funções), **(2)** fidelidade (bloco canônico == nó vivo) e **(3)**
consistência-de-duplicação (todas as cópias byte-idênticas). Edite a lógica no
bloco canônico, reaplique nos nós e rode a rede — qualquer drift entre cópias falha.

### Contrato de re-anexação (por que cada parser lê nós irmãos)

Os `@n8n/n8n-nodes-langchain.agent` emitem só `{ output }` e **dropam o contexto
upstream**; por isso cada parser reconstrói o que os nós a jusante leem, via
`$('Nome irmão').last()`. Acoplamento temporal — **não realoque/renomeie** esses
nós sem atualizar o parser correspondente:

| parser | re-anexa de | campos |
| --- | --- | --- |
| Code Parse Router | — (só `$json`) | passa `ctx` + `router` |
| Code Parse Memory 1 | — (só `$json`) | + `memory_extraction` |
| Code Parse Memory 2 | `$('CRM Leads GET')`, `$('Edit Fields')` | `lead_state` (prev), `last_message_content` |
| Code Parse Bia 1 | `$('Edit Fields5')` | estado de trade-in / `message_buffered` |
| Code Parse Re-simulação Bia 2 ESTOQUE | `$('Edit Fields10')`, `$('Code Refresh Lead State Before Switch2')` | trade-in/entrada/cartão/desejo |
| Parse Simulator | `$('Montar Body do Simulador')` | `ctx`/`memory` + `simulation_result` |
| Code Parse Bia 2 SEM ESTOQUE (×2) | `Edit Fields3/4/5/10/13`, `Node13-…` | cores permitidas/mencionadas (color-guard) |

> `Code Parse Re-simulação` retorna `[]` quando não há re-simulação — isso é
> **intencional**: a resposta normal já saiu pela outra saída da `Bia 2 ESTOQUE`
> (→ `Edit Fields3`); emitir um objeto aqui empurraria item espúrio p/ `Montar Body`.
