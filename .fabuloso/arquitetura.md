# Arquitetura — iphonerepasse-pro
> Camada semântica. Fatos estruturais exatos (arquivos, símbolos, dependentes, testes) → agentmap.
> Regras de negócio, n8n, CRM Plus e agente financeiro estão detalhados no `CLAUDE.md` (também no bloco estável): aqui só o mapa de navegação.

## Visão geral
ERP de revenda de iPhones usados (estoque, PDV, financeiro, garantias) + CRM Plus (WhatsApp/Instagram com agente de IA), em português do Brasil. SPA React 19 + Vite + Tailwind, PWA instalável (`vite-plugin-pwa` injectManifest → `public/sw.js`). Backend 100% Supabase: Postgres + Auth + Storage + Edge Functions Deno. Um bundle serve dois produtos (ERP em `HashRouter`; CRM standalone em `BrowserRouter`, escolhido por host/hash em `App.tsx`). Deploy: Nixpacks (`npm run build` → `serve dist`). Testes: Vitest (jsdom) colocados ao lado do código; Deno para edge functions; Playwright em `scripts/smoke`.

## Módulos
| Módulo | Faz | Entrada/hub | Consulta útil |
|---|---|---|---|
| `App.tsx`, `index.tsx` | bootstrap, rotas lazy, decide ERP × CRM | `App.tsx` | `--relates App.tsx` |
| `pages/` | uma tela por rota do ERP (PDV, Inventory, Finance, Clients, Warranties…) | `pages/PDV.tsx`, `pages/Inventory.tsx` | `--feature pdv` |
| `pages/pdv`, `pages/inventory` | lógica pura extraída das telas (cálculo, payload de venda, view-model) | `buildSalePayload.ts`, `pdvCalculations.ts` | `--relates pages/pdv/pdvCalculations.ts` |
| `pages/crm/` | uma página por feature do CRM Plus (conversas, leads, IA, automações…) | `ConversationsPage.tsx` | `--find ConversationsPage` |
| `components/` | modais e blocos de domínio do ERP (`StockFormModal`, `SaleCompleteEditModal`, `WhatsAppSendFailure`…) | — | `--any <nome>` |
| `components/ui` | primitivos: `Banner`, `Modal`, `ConfirmDialog`, `ToastProvider`, `IOSButton`, `Combobox` | `ToastProvider.tsx` (35 dependentes) | `--relates components/ui/ToastProvider.tsx` |
| `components/crm` | painéis de conversa, bolhas, áudio, roteamento de páginas CRM, `pageAccess.ts` | `CRMStandaloneApp.tsx` | `--relates components/crm/pageAccess.ts` |
| `components/motion` | springs/easings iOS compartilhados | `transitions.ts` | — |
| `services/` | `supabase.ts` (client), `dataContext.tsx` (estado do ERP + todas as mutações), `data/` (loaders, realtime), push/PWA/telemetria | `services/dataContext.tsx` | `--relates services/dataContext.tsx` |
| `contexts/` | Auth (sessão + role), Permissions (matriz), Theme, PageHeader | `AuthContext.tsx` | — |
| `lib/` | regras de domínio sem UI: `permissions.ts`, `crmRouting.ts`, `runtimeBranding.ts`, `phone.ts`, `crm/`, `finance/`, `marketing/` | `lib/permissions.ts` | `--relates lib/permissions.ts` |
| `utils/` | funções puras e side-effects de apoio: máscaras, comprovante (PDF/ESC-POS), envio por WhatsApp, dívidas, cartões | `inputMasks.ts` (29 dependentes) | `--relates utils/inputMasks.ts` |
| `hooks/` | hooks reutilizáveis (`useAsyncHandler`, `useReceiptPrint`, push, paginação) | — | — |
| `types.ts` | tipos de domínio do ERP (63 dependentes) | `types.ts` | `--relates types.ts` |
| `design-system/seroclub-iphonerepasse` | tokens, motion e tema; CSS global em `index.css` | `index.css` | — |
| `supabase/functions` | uma edge function por pasta (`index.ts`); código comum em `_shared/` | `_shared/crm.ts` (32 dependentes) | `ls supabase/functions` |
| `supabase/migrations` | 145 migrations ordenadas = fonte da verdade do schema | — | `.fabuloso/db/indice.md` |
| `scripts/n8n`, `n8n/ia-repasse-pro-v2` | patches cirúrgicos, guard, ferramenta de decomposição do workflow Bia | `scripts/n8n/tool/patch-kit.mjs` | ver CLAUDE.md |
| `tests/` | contratos transversais (migrations, PWA, layout iOS, realtime) | — | `--affected <arquivo>` |
| `docs/`, `tasks/`, `ralph/` | planos/specs, PRDs em PT-BR, listas do loop Ralph | — | — |

## Fronteiras
- **Autenticação/papéis:** Supabase Auth em `contexts/AuthContext.tsx` (role de banco `admin|seller` + `AppRole` operacional nos metadados). Guardas por rota em `ProtectedRoute`; matriz de permissões em `lib/permissions.ts` + `PermissionsContext`.
- **Dados (Supabase):** client único `services/supabase.ts`. ERP lê/escreve tudo via `useData()` (`dataContext.tsx`); CRM usa o mesmo provider + chamadas diretas a `crm_*` e edge functions. Tabelas, FKs, RLS e funções: `.fabuloso/db/indice.md` (não listar aqui). Schema muda só por migration nova.
- **Realtime:** `services/data/useDataRealtime.ts` (ERP) e `postgres_changes` em `ConversationsPage`. Toda tabela assinada precisa estar na publicação `supabase_realtime` (contrato em `tests/realtime-publication-contract.test.ts`).
- **Rotas:** ERP = `HashRouter` (rotas em `App.tsx`, prefetch em `lib/routePrefetch.ts`); CRM standalone = `BrowserRouter` (`components/crm/CRMStandaloneApp.tsx`, paths em `lib/crmRouting.ts`); CRM também montado em `/crm/*` no ERP.
- **UI/design system:** Tailwind + classes `ios-*` (`index.css`) + tokens `--ds-*`; primitivos em `components/ui`; HIG em `AgenteHIG.md`. Feedback de erro: toast para efêmero, `Banner` para persistente, inline para campo (skill `refatorar-ui`).
- **Integrações:** WhatsApp via uazapi (`_shared/uazapi.ts`, canal por `crm_channels`); Instagram oficial; n8n (app→n8n por webhook do canal, n8n→app por `crm-n8n-api`); IA de admin no WhatsApp (`crm-admin-agent`, OpenRouter); Gemini via `gemini-proxy`; Web Push (`push-*`).
- **Comprovantes:** PDF vetorial/ESC-POS em `utils/` (`receiptPdf`, `escpos`, `deliverReceiptPdf`); envio pelo CRM: `utils/sendReceiptWhatsApp.ts` → edge `send-receipt-whatsapp` → `crm-send-message` → uazapi. Falhas viram `WhatsAppSendError` (`utils/whatsappSendError.ts`) e são exibidas por `WhatsAppSendFailure`/toast.

## Fora do alcance do agentmap
- `supabase/migrations` — SQL; ler o mapa `.fabuloso/db/` antes.
- `supabase/functions` — Deno, imports por URL/jsr; excluído de tsconfig/ESLint/Vitest; testar com `npm run test:deno`.
- `n8n/ia-repasse-pro-v2` e `output/n8n` — JSON do workflow (live = `Cr4fPWe0prwS6XjI`); nunca editar o live às cegas (guard + patch cirúrgico).
- `public/sw.js`, `public/*.webmanifest`, `index.html`, `index.css`, `tailwind.config.cjs`, `vite.config.ts` — PWA/tema/build.
- `scripts/*.mjs` — ferramentas Node avulsas (import de estoque, PWA assets, smoke).

## Convenções que o código não mostra
- Alias `@/` = raiz do repo. `noUnusedLocals/Parameters` ligados; ESLint barra código morto/inalcançável.
- Domínio e UI em pt-BR; erros para o usuário dizem causa + próximo passo, sem código HTTP cru.
- Testes colocados ao lado do arquivo; `.red.test.*` = especificação TDD de comportamento desejado (não "teste quebrado").
- Edge functions: `verify_jwt` varia por função (conferir em `config.toml`/deploy); segredos só por variável de ambiente, nunca no código.
- Node não está no PATH da shell do agente: `source ~/.nvm/nvm.sh` antes de `node/npm/npx`.
- Backend real = projeto Supabase `ubuusaiezpyayqgfujbe` ("Sistema Repasse"); o MCP do Supabase enxerga esse projeto. Logs de edge: `function_edge_logs`; motivo real de falha de envio: `crm_messages.error_message` / `crm_event_log`.
- Migrations aplicadas por psql manual exigem `supabase migration repair` (ledger mentiroso já causou migration dormente em prod).
