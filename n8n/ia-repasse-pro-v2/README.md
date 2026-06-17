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
