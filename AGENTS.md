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
> (`.claude/settings.json` → `scripts/n8n/hooks/n8n-live-guard-hook.mjs`). Codex
> and other agents have no such hook, so **you must run it manually** as the first
> step of any n8n task.

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
