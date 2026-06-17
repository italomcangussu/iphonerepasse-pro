# AGENTS.md

Guidance for AI coding agents (Codex, etc.) working in this repo. Claude Code
reads [CLAUDE.md](CLAUDE.md) — read it too; it is the canonical project guide.
This file calls out the few things that need agent-specific handling.

## ⚠️ Live n8n workflow — anti-regression guard (MANDATORY, run FIRST)

The AI agent's conversational logic runs in an **external, live, fragile** n8n
workflow: `Cr4fPWe0prwS6XjI` ("ia repasse-pro v2 avancada"). It is sometimes
edited **manually** in the n8n UI. When that happens, two project artifacts go
stale and become a regression trap:

1. the snapshot `output/n8n/ia-repasse-pro-v2-current.json`
2. the byte-exact `.js` mirrors of some Code nodes (`scripts/n8n/repasse-code-*.js`)

The surgical patch scripts do `GET → exact-string .replace() → PUT` (and read the
snapshot under `DRY=1`). If the live version moved by hand, you'd be reasoning
about — and patching against — old code.

**Before you analyze or change the live workflow in ANY way, run:**

```bash
node scripts/n8n/guard-live-workflow-sync.mjs
```

It GETs the live workflow, recognizes whether it was manually edited since the
last sync, and on drift **re-exports the snapshot and re-syncs the `.js` mirrors
from the live code**, writing a report to `output/n8n/.live-guard/`. If it reports
drift, **re-read the affected files before applying any patch.**

- `node scripts/n8n/guard-live-workflow-sync.mjs --check` → detect only; exit 3 on drift (no writes). Good for a pre-flight gate.
- `... --json` → machine-readable result.

> Claude Code runs this guard **automatically** via a `PreToolUse` Bash hook
> (`.claude/settings.json` → `scripts/n8n/hooks/n8n-live-guard-hook.mjs`).
> Codex also has a project-local `PreToolUse` Bash hook registered in
> `.codex/hooks.json` pointing to the same script. On first use, review/trust it
> with `/hooks` in Codex so it can run automatically. Other agents without hook
> support must run it manually as the first step of any n8n task.

### n8n env / API access

n8n REST API: origin is the host from `N8N_BASE_URL` (`.env.local`), auth header
`X-N8N-API-KEY: $N8N_API_KEY`. The older `export-repasse-workflow.mjs` expects
`N8N_PUBLIC_API`/`N8N_MCP_URL`, which don't exist here — the guard and patch
scripts already use the correct keys (with fallbacks).

### Patch workflow shape

GET → backup under `output/n8n/backups/` → exact-string `.replace()` with guards
→ `new Function()` syntax-assert → PUT → `POST /activate` → re-export. `DRY=1`
previews without writing. **Always reactivate after a deploy** — the build script
leaves the workflow OFF.

### Maintainability tool (decomposed, node-by-node editing)

For structured edits there is a node-decomposition tool:
`scripts/n8n/repasse-maint.mjs` (`pull` / `status` / `build` / `deploy [--confirm]`),
with the versioned mirror under `n8n/ia-repasse-pro-v2/` (`workflow.json`, decomposed
`nodes/code/*.js` + `nodes/prompts/*.md`, `manifest.md`, `stages.json`). It still
treats the live workflow as canonical: `pull` re-syncs; `deploy` GETs fresh,
refuses on drift, composes your edits onto the fresh live, validates JS +
structure, backs up, PUTs (settings allowlist strips `timeSavedMode` → avoids 400),
reactivates, re-syncs. **Run the guard first** (same as patches). Stages are
inferred by canvas x-position (`stages.json`) — nodes are **not** renamed (450
`$('Name')` refs + 25 patch scripts depend on current names). Prompts built by
expression (`=…`: Router Agent, Bia 1/2) stay in `workflow.json`, not as files.
Read `n8n/ia-repasse-pro-v2/README.md` + `manifest.md` first. Tests:
`npm run test:n8n-tool`.

### Parsers de agente — lógica pura, blocos canônicos e rede de testes

Os `Code Parse *` (que parseiam a saída dos `@n8n/...langchain.agent`) carregam
lógica pura **inline e duplicada** porque Code nodes do n8n **não importam
módulos locais**. Antes de mexer nessa lógica:

- **Edite no bloco canônico**, não numa cópia solta. Fonte byte-extraída em
  `scripts/n8n/tool/parsers/blocks/` (`commerce_context` = color-guard;
  `json_repair` = strip de cerca markdown + reparo de aspas; `bia1_tradein` =
  decisão de trade-in) + `scripts/n8n/repasse-humanizer.mjs` (`N8N_HUMANIZER_BLOCK`).
  Reaplique em **todas** as cópias (mesmo texto byte-a-byte).
- **Rode a rede** `npm run test:n8n-tool` (inclui `parsers.test.mjs`): trava
  caracterização (saídas conhecidas), fidelidade (bloco canônico == nó vivo) e
  **consistência-de-duplicação** (todas as cópias idênticas: commerce ×3,
  humanizer ×4, gêmeos SEM ESTOQUE/MONTAR LINK/Split Out). Corrigir uma cópia e
  esquecer a gêmea **falha o teste** — é proposital.
- **Contrato de re-anexação:** os agentes emitem só `{ output }` e dropam o
  contexto; cada parser reconstrói o que os nós a jusante leem via
  `$('Nome irmão').last()`. A tabela (qual parser lê qual nó) está no
  `n8n/ia-repasse-pro-v2/README.md` — **não realoque/renomeie** esses nós sem
  atualizar o parser. O `return []` de `Code Parse Re-simulação` é intencional
  (dupla saída da `Bia 2 ESTOQUE`), não um bug.
