# Capacidades — iphonerepasse-pro
> Gerado pela skill fabuloso (perfil local). Atualizado só quando skills são instaladas/removidas.

## Gatilhos obrigatórios
- UI/layout/erros/toasts/forms → `fabuloso-design` (tela nova, redesign, auditoria) + `refatorar-ui` (projeto) + `frontend-design` (+ `impeccable` para polish)
- Banco/Supabase (schema, RLS, edge function, dados) → `supabase` + `supabase-postgres-best-practices`
- iPhone/PWA standalone/Safari → `hig` (carregar ANTES de decidir interface) + `pwa-design-debug`
- Qualidade/refatoração/testes → `fabuloso-uncle-bob` (preferida; `uncle-bob` também instalada)
- Lentidão/bundle → `performance-profiler`
- Bug/teste falhando → `systematic-debugging` (ou `debug`); antes de declarar pronto → `verification-before-completion`
- agentmap (CLI, não é skill) → "onde fica X / quem usa Y / quais testes rodar"
- Segurança (auth, RLS, segredos, superfície pública) → `fabuloso-security`
- Nenhuma skill obrigatória ausente.

## Por área
### Front-end/design
- `fabuloso-design` — criar/auditar telas e fluxos, medir em tamanhos de iPhone/Android.
- `refatorar-ui` — 3 lentes (cognição, clareza, execução); tokens/primitivos do repo (Banner, Toast, ios-*).
- `frontend-design`, `impeccable`, `design-critique`, `accessibility-review`, `ux-copy`, `design-system`, `redesign-existing-projects` — direção visual e auditoria.
- `dark-mode-design-expert` — tema escuro (`surface-dark-*`).
- `design-taste-frontend`, `high-end-visual-design`, `minimalist-ui`, `industrial-brutalist-ui`, `stitch-design-taste`, `gpt-taste` — estilos alternativos; raramente.
### Back-end
- `supabase` — edge functions Deno, Auth, RLS, CLI.
- `fabuloso-crm` — chat de CRM/WhatsApp (UAZAPI), inbox, follow-up, automações.
- `fabuloso-agente` — agentes de IA (Bia, memória, prompts, custo, evals).
- `uazapi` — API UazAPI do WhatsApp.
- `fabuloso-security` — segredos, auth, RLS, edge functions expostas.
- `chat-best-practices` — CRM WhatsApp/Instagram (uazapi), realtime, mídia, atribuição de anúncios.
- `n8n-code-javascript`, `n8n-expression-syntax`, `n8n-mcp-tools-expert`, `n8n-workflow-patterns`, `n8n-node-configuration`, `n8n-validation-expert`, `n8n-code-tool` — workflow do agente (Bia); ver CLAUDE.md antes de tocar o live.
### Banco de dados
- `supabase-postgres-best-practices` — queries, índices, RLS.
### Mobile iOS
- `hig` — Apple HIG para PWA/WKWebView.
- `pwa-design-debug` — faixa cinza/safe-area/teclado em PWA standalone.
- `pwa-webpush-review`, `push-validator` — push/PWA.
- `simulador-ios` — verificar no simulador.
### Qualidade de código
- `fabuloso-uncle-bob` / `uncle-bob` — auditoria e refatoração sem regressão.
- `code-review`, `testing-strategy`, `tech-debt`, `karpathy-guidelines`, `debug`.
- `test-driven-development`, `receiving-code-review`, `requesting-code-review`, `verification-before-completion`.
### Performance
- `performance-profiler`, `vercel-react-best-practices`.
### Estrutural/arquitetura
- `architecture`, `system-design`, `deploy-checklist`, `brainstorming`, `writing-plans`, `executing-plans`, `subagent-driven-development`, `dispatching-parallel-agents`, `using-git-worktrees`, `finishing-a-development-branch`.
### Outras (raramente relevantes)
- `playwright`, `built-in-browser`, `chrome-browser`, `computer-use` (navegador/tela), `imagegen*`, `image-to-code`, `brandkit`, `humanizer`, `full-output-enforcement`, `openai-docs`, `skill-*`/`plugin-*`/`plugin-creator`/`Hook Development`… (criação de skills/plugins).
