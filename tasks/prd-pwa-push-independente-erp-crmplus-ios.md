# PRD: PWA + Web Push independentes por produto (ERP iPhoneRepasse Pro e CRM Plus) no iOS

## 1. Introdução

O mesmo bundle serve **dois produtos instaláveis** como PWA standalone (ver `App.tsx`, `lib/crmRouting.ts`, `lib/runtimeBranding.ts`):

- **iPhoneRepasse Pro (ERP)** — app comercial completo (estoque, PDV, financeiro, garantias). Roteamento `HashRouter` (`/#/...`). Manifesto `/app.webmanifest` (`id`/`start_url` = `/?source=pwa`), marca escura `#0b1220`, ícones `/brand/*`.
- **CRM Plus** — central de atendimento WhatsApp/Instagram com IA. Instalável por **dois vetores**, mas é **um único produto**:
  - host próprio `crm.iphonerepasse.com.br` → `BrowserRouter` (paths limpos), manifesto `/crm.webmanifest` (`id`/`start_url` = `/`);
  - via hash no host principal `#/crmplus` → manifesto `/crmplus.webmanifest` (`id`/`start_url` = `/#/crmplus`).
  - Marca azul `#1d4ed8`, ícones `/brand/crm/*`.

Hoje a infraestrutura de Web Push existe e está ~85% pronta (SW com handler `push`/`notificationclick`, VAPID, criptografia RFC 8291, edge functions `push-subscribe`/`push-send`, tabela `push_subscriptions`, UI de permissão Apple HIG). **Porém o pipeline é "cego" ao produto**: a subscription não registra de qual PWA veio, o envio não filtra por produto, e o deep link não respeita o roteador de cada app. Em um device com **os dois PWAs instalados**, isso causa notificação cruzada (ex.: alerta de "venda" chegando no CRM Plus, ou clique abrindo o app errado) e risco de revogação pelo iOS.

Este PRD define **fluxos 100% independentes por produto** em toda a cadeia: instalação → permissão → lembrete → configurações → assinatura → backend de envio → deep link → exibição → badge → telemetria.

> Requisitos oficiais de referência (iOS/iPadOS 16.4+): Web Push só funciona em PWA **adicionado à Tela de Início** (não no Safari aba); manifesto com `display: standalone`; `Notification.requestPermission()` apenas sob **gesto do usuário**; **todo push DEVE exibir notificação visível** (push silencioso → o iOS revoga a permissão). Fontes: WebKit “Web Push for Web Apps on iOS and iPadOS”, “Badging for Home Screen Web Apps”, WWDC23 “What’s new in web apps”.

## 2. Objetivos

1. Garantir que cada PWA (ERP e CRM Plus) tenha **ciclo de push isolado**: assinatura própria, tópicos próprios, deep link próprio, branding/ícone/badge próprios, e UI de permissão própria — sem vazamento entre produtos.
2. Introduzir um **discriminador de produto** (`app`/`product`: `erp` | `crmplus`) em toda a cadeia (cliente, tabela, envio).
3. Eliminar **falsos positivos** que levam o iOS a revogar a permissão (sempre exibir notificação; payload sempre válido).
4. Padronizar o **workflow de permissão** (primeiro acesso, pré-aviso, lembrete de pendência, reativação) por produto.
5. Padronizar as **configurações manuais** (ativar/desativar/gerenciar tópicos) por produto.
6. Tornar o **backend de envio real e confiável** (filtro por produto+tópico, retry/timeout, tratamento de expiração, telemetria) sem disparos cruzados.

### Não-objetivos
- Suporte a push no Safari em aba (não existe no iOS — fora de escopo por design da Apple).
- Contornar a limitação regional EU/DMA (apenas documentar para suporte).
- Push silencioso/data-only (proibido no iOS).
- Migração para Declarative Web Push (Safari 18.4+) — pode ser avaliado em PRD futuro; aqui mantemos o caminho via Service Worker.

## 3. Conceitos e contrato de dados

### 3.1 Discriminador de produto
Toda subscription passa a carregar `product: 'erp' | 'crmplus'`, resolvido **em runtime** a partir do contexto (host/hash), reaproveitando a lógica de `lib/crmRouting.ts` + `lib/runtimeBranding.ts`:
- `isCRMStandaloneHost()` **ou** hash `#/crmplus` ⇒ `crmplus`;
- caso contrário ⇒ `erp`.

### 3.2 Catálogo de tópicos por produto
| Produto | Tópicos válidos | Deep link base |
|---|---|---|
| `erp` | `sale`, `new_lead`, `finance_due`, `stock_alert` | `HashRouter` → `/#/...` |
| `crmplus` | `crm_inbox`, `new_lead`, `transfer_pending` | host CRM: paths limpos `/conversations/:id`; via hash: `/#/crmplus/conversations/:id` |

> `new_lead` existe nos dois, mas o **deep link e o destino diferem por produto** — por isso o discriminador é obrigatório.

### 3.3 Isolamento de armazenamento local
No iOS cada PWA da Tela de Início tem storage isolado, mas para correção em desktop/host compartilhado as chaves de `localStorage` passam a ser **namespaced por produto**: `push.sub.endpoint:<product>`, `push.sub.topics:<product>`, `push.permission.prompt.dismissed.at:<product>`, etc.

## 4. User Stories

### US-001: Instalação independente do ERP (iPhoneRepasse Pro)
**Descrição:** Como lojista, quero instalar o app comercial na Tela de Início e que ele seja reconhecido como produto `erp`.
**Critérios de Aceite:**
- [ ] No host principal (não-CRM, sem hash `#/crmplus`), o manifesto ativo é `/app.webmanifest` e a marca é a escura (`#0b1220`).
- [ ] Em iOS Safari **não instalado**, o ERP mostra guia "Adicionar à Tela de Início" e **não** oferece ativar push.
- [ ] Após instalado (standalone), o contexto resolve `product = 'erp'`.
- [ ] Não há qualquer UI/CTA do CRM Plus visível no fluxo do ERP.
- [ ] Typecheck/lint passam.

### US-002: Instalação independente do CRM Plus (dois vetores, um produto)
**Descrição:** Como atendente, quero instalar o CRM Plus (pelo host `crm.` ou pelo hash `#/crmplus`) e que ambos resolvam para o produto `crmplus`.
**Critérios de Aceite:**
- [ ] No host `crm.iphonerepasse.com.br`, manifesto `/crm.webmanifest`, marca azul `#1d4ed8`, ícones `/brand/crm/*`.
- [ ] No host principal com hash `#/crmplus`, manifesto `/crmplus.webmanifest`, mesma marca CRM.
- [ ] Em iOS Safari não instalado, o CRM mostra guia de instalação e **não** oferece ativar push.
- [ ] Ambos os vetores resolvem `product = 'crmplus'`.
- [ ] Nenhuma UI/CTA do ERP aparece no fluxo do CRM Plus.
- [ ] Typecheck/lint passam.

### US-003: Workflow de permissão por produto (primeiro acesso + gesto)
**Descrição:** Como usuário, ao usar pela primeira vez um PWA instalado, quero um pré-aviso explicativo antes do alerta nativo, sem queimar a permissão.
**Critérios de Aceite:**
- [ ] O prompt nativo **nunca** é disparado no carregamento — sempre sob gesto (CTA `Continuar`/`Ativar notificações`).
- [ ] O pré-aviso (sheet HIG, `PermissionRequest.tsx`) tem texto/ícone/cor do **produto corrente**.
- [ ] Em iOS não-standalone, o fluxo bloqueia o pedido de push e exibe o guia de instalação (estado `needs_install`), em vez de cair em `unsupported` genérico.
- [ ] A assinatura criada é gravada com o `product` correto.
- [ ] Typecheck/lint passam.

### US-004: Lembrete de permissão pendente por produto
**Descrição:** Como usuário que ainda não ativou notificações, quero ser lembrado de forma não intrusiva, sem banners duplicados.
**Critérios de Aceite:**
- [ ] Existe **um único dono de banner por contexto**: ERP usa `PushPermissionPrompt`; CRM Plus usa `CRMPwaControls`. Eles não renderizam simultaneamente no mesmo produto (deduplicação garantida).
- [ ] O banner aparece quando: standalone + permissão `default`/`error` + ainda não assinado + não dispensado nos últimos 14 dias.
- [ ] "Agora não" silencia por 14 dias usando chave **namespaced por produto**.
- [ ] Após instalar (`appinstalled`), o pré-aviso do produto correspondente é oferecido.
- [ ] Quando `denied`, o banner não reaparece; em vez disso há card "Como reativar em Ajustes".
- [ ] Typecheck/lint passam.

### US-005: Configurações independentes (ativar/desativar/tópicos) por produto
**Descrição:** Como usuário, quero gerenciar minhas notificações de cada produto separadamente.
**Critérios de Aceite:**
- [ ] `pages/Settings.tsx` (ERP) exibe `PushOptIn` com os tópicos do ERP (`sale`, `new_lead`, `finance_due`, `stock_alert`).
- [ ] `pages/crm/SettingsPage.tsx` (CRM Plus) exibe `PushOptIn` com os tópicos do CRM (`crm_inbox`, `new_lead`, `transfer_pending`).
- [ ] Ações: **Ativar** (subscribe), **Desativar** (unsubscribe → `is_active=false`), **Trocar tópicos** (sem re-subscrever) — todas marcando/lendo o `product` corrente.
- [ ] Estado visual: `Ativado` / `Bloqueado` / `Precisa instalar` / `Não suportado`.
- [ ] Em `denied` no iOS, instrução "Ajustes › Notificações › <nome do app>".
- [ ] Desativar/alterar tópicos de um produto **não** afeta a assinatura do outro.
- [ ] Typecheck/lint passam.

### US-006: Cliente tagueia a assinatura com o produto
**Descrição:** Como sistema, preciso registrar de qual PWA veio cada subscription.
**Critérios de Aceite:**
- [ ] `services/pushClient.ts` resolve `product` em runtime e o envia no corpo de `push-subscribe` (POST).
- [ ] Tópicos default passam a ser **derivados do produto** (não a lista global atual `['crm_inbox','new_lead','sale']`).
- [ ] Chaves de cache de `localStorage` são namespaced por produto.
- [ ] Em re-sync (pageshow/focus), se `getSubscription()` for `null` (revogado pelo iOS), o cliente re-subscreve preservando `product`+tópicos.
- [ ] Testes unitários de `pushClient` cobrem resolução de produto e namespacing.
- [ ] Typecheck/lint passam.

### US-007: Persistência da assinatura com coluna de produto
**Descrição:** Como sistema, preciso armazenar e indexar a assinatura por produto.
**Critérios de Aceite:**
- [ ] Nova migration adiciona coluna `product text not null default 'erp'` (check em `('erp','crmplus')`) a `push_subscriptions`.
- [ ] Índice `(store_id, product, is_active)` e `(product, topics, is_active)` para targeting eficiente.
- [ ] Backfill: linhas existentes recebem `product` inferido por `platform`/`topics` quando possível; default `erp`.
- [ ] `push-subscribe` valida `product` e valida `topics` contra o catálogo **do produto** (rejeita tópico desconhecido).
- [ ] RLS mantida (usuário gerencia apenas as próprias). 
- [ ] Teste Deno de `push-subscribe` cobre validação de produto/tópicos.

### US-008: Envio backend filtrado por produto (sem disparo cruzado)
**Descrição:** Como sistema, ao enviar um evento, devo atingir **apenas** as assinaturas do produto correto.
**Critérios de Aceite:**
- [ ] `push-send` aceita e **exige** `product` no targeting; só seleciona subscriptions daquele produto.
- [ ] O filtro por `topic` é **efetivamente aplicado** (hoje todos da loja recebem tudo) — só recebe quem tem o tópico no array **e** o produto correto.
- [ ] Evento de ERP (`sale`/`finance_due`/`stock_alert`) nunca atinge `crmplus`; evento de CRM (`crm_inbox`/`transfer_pending`) nunca atinge `erp`.
- [ ] Mantém tratamento de `404`/`410` (desativa subscription) e atualiza `last_error_*`.
- [ ] Adiciona **timeout** no `fetch` e **retry com backoff** para `5xx`.
- [ ] Teste Deno cobre seleção por produto+tópico.

### US-009: Deep link correto por produto/roteador
**Descrição:** Como usuário, ao tocar a notificação, quero abrir exatamente a tela certa do PWA certo.
**Critérios de Aceite:**
- [ ] O `url` do payload é construído conforme o **produto e roteador da assinatura alvo**:
  - `erp` → `https://<host principal>/#/<rota>` (HashRouter);
  - `crmplus` (host CRM) → `https://crm.iphonerepasse.com.br/<rota-limpa>`;
  - `crmplus` (hash) → `https://<host>/#/crmplus/<rota>`.
- [ ] O webhook `crm-uaz-webhook-receiver` deixa de gerar `/conversations/:id` "cru" e passa a usar o builder por produto (corrige o bug atual de cair na home).
- [ ] `notificationclick` no `sw.js` foca a janela existente do produto certo ou abre nova com a URL correta.
- [ ] Typecheck/lint passam (cliente) e teste Deno do webhook cobre o builder.

### US-010: Service Worker compartilhado, exibição sempre visível (anti-revogação)
**Descrição:** Como sistema, com **um SW para os dois PWAs**, preciso exibir notificação visível em todo push, com branding do payload.
**Critérios de Aceite:**
- [ ] O handler `push` **sempre** chama `showNotification` dentro de `event.waitUntil`, inclusive em caminho de erro/payload vazio (fallback genérico com título não-vazio).
- [ ] `icon`/`badge`/`tag`/`title` vêm do payload e refletem o produto (ícone `/brand/*` para ERP, `/brand/crm/*` para CRM).
- [ ] `silent:true` continua ignorado (sempre visível).
- [ ] Teste em `tests/service-worker/push-sw.test.ts` cobre: payload válido (ERP e CRM) e payload inválido (fallback exibido).

### US-011: Badge de ícone por produto (iOS 16.4+)
**Descrição:** Como usuário, quero ver o contador no ícone do PWA correspondente.
**Critérios de Aceite:**
- [ ] Em push recebido, o SW atualiza o badge via `navigator.setAppBadge()`/`clearAppBadge()` (quando disponível) sem quebrar onde não há suporte.
- [ ] O badge do ERP e do CRM Plus são independentes (cada PWA tem seu próprio contexto/contador no iOS).
- [ ] Ao abrir/limpar a fila no app, o badge é zerado.
- [ ] Degradação graciosa onde a API não existe.

### US-012: Telemetria e robustez (sem falso positivo)
**Descrição:** Como operação, quero observar envio/entrega/erros para detectar revogação e medir entrega.
**Critérios de Aceite:**
- [ ] `push-send` registra em `crm_event_log` (ou tabela equivalente) eventos `push_sent`/`push_failed`/`push_deactivated` com `product`, `topic`, `endpoint_host`, status.
- [ ] `.env.example` passa a documentar `PUSH_WORKER_SECRET` e `VITE_CRM_HOSTNAME` (hoje ausentes).
- [ ] Validação de `title` não-vazio e limites (≈240 chars título; body curto para lock screen) no envio.
- [ ] Rotina de limpeza de subscriptions `is_active=false` antigas e cascade ao deletar usuário.
- [ ] Testes Deno cobrem logging e desativação por `410`.

## 5. Matriz de independência por produto (resumo)

| Dimensão | ERP (`erp`) | CRM Plus (`crmplus`) | Compartilhado |
|---|---|---|---|
| Manifesto | `/app.webmanifest` | `/crm.webmanifest` ou `/crmplus.webmanifest` | — |
| Marca/ícone/badge | escura, `/brand/*` | azul, `/brand/crm/*` | — |
| Roteador / deep link | `/#/...` | paths limpos ou `/#/crmplus/...` | — |
| Tópicos | `sale`,`new_lead`,`finance_due`,`stock_alert` | `crm_inbox`,`new_lead`,`transfer_pending` | catálogo central |
| Assinatura | `product='erp'` | `product='crmplus'` | tabela `push_subscriptions` |
| UI permissão/banner | `PushPermissionPrompt` + `PushOptIn` (Settings) | `CRMPwaControls` + `PushOptIn` (SettingsPage CRM) | `PermissionRequest` (sheet) |
| Cache local | chaves `:erp` | chaves `:crmplus` | — |
| VAPID | mesma chave (mesma origem) | mesma chave | `VITE_VAPID_PUBLIC_KEY` / `VAPID_PRIVATE_KEY` |
| Service Worker | mesmo `/sw.js` (scope `/`), branding por payload | idem | `public/sw.js` |
| Envio | filtro `product=erp`+tópico | filtro `product=crmplus`+tópico | `push-send` |

## 6. Requisitos bloqueantes (gate — valem para os dois PWAs)

- [ ] iOS/iPadOS **16.4+**.
- [ ] App **adicionado à Tela de Início** (standalone); push não existe no Safari aba.
- [ ] Manifesto `display: standalone` (✅ já atendido nos 3 manifestos).
- [ ] `Notification.requestPermission()` **somente sob gesto** (✅ já atendido).
- [ ] SW com handler `push` que **sempre** exibe notificação (US-010).
- [ ] VAPID configurado (✅) e HTTPS em produção.
- [ ] (Documentar) limitação EU/DMA.

## 7. Arquivos impactados (referência)

**Frontend/cliente**
- `services/pushClient.ts` — resolver `product`, tópicos default por produto, namespacing de cache, re-sync pós-revogação.
- `hooks/usePushNotifications.ts` — propagar `product`; estado `needs_install` bloqueante no iOS.
- `components/pwa/PermissionRequest.tsx` — copy/branding por produto.
- `components/pwa/PushOptIn.tsx` — catálogo de tópicos por produto.
- `components/pwa/PushPermissionPrompt.tsx` / `components/pwa/CRMPwaControls.tsx` — deduplicação (um dono por contexto).
- `lib/crmRouting.ts` / `lib/runtimeBranding.ts` — fonte da verdade do produto e do deep link.
- `pages/Settings.tsx` / `pages/crm/SettingsPage.tsx` — toggles por produto.

**Service Worker**
- `public/sw.js` — `push` com fallback sempre-visível + branding por payload; `notificationclick` por produto; badge.

**Backend / Supabase**
- `supabase/migrations/<novo>_push_subscriptions_product.sql` — coluna `product`, índices, backfill, check.
- `supabase/functions/push-subscribe/index.ts` — validar `product`+tópicos do produto.
- `supabase/functions/push-send/index.ts` — filtro por produto+tópico, timeout/retry, telemetria.
- `supabase/functions/crm-uaz-webhook-receiver/index.ts` — deep link por produto (`crmplus`).
- (novo disparo) eventos do ERP (`sale`/`finance_due`/`stock_alert`) chamando `push-send` com `product='erp'`.

**Config/Docs**
- `.env.example` — `PUSH_WORKER_SECRET`, `VITE_CRM_HOSTNAME`.

**Testes**
- `services/pushClient.test.ts`, `hooks/usePushNotifications.test.tsx` (resolução de produto/namespacing).
- `tests/service-worker/push-sw.test.ts` (ERP/CRM + fallback).
- `supabase/functions/push-subscribe/*.deno.ts`, `supabase/functions/push-send/*.deno.ts` (validação/targeting/410).
- `crm-uaz-webhook-receiver/*.deno.ts` (deep link por produto).

## 8. Riscos e mitigações

- **Revogação silenciosa pelo iOS** (push sem notificação) → US-010 (fallback sempre-visível) + US-012 (telemetria para detectar).
- **Notificação cruzada entre produtos** → discriminador `product` em toda a cadeia (US-006/007/008).
- **Deep link abrindo app errado/home** → builder por produto (US-009).
- **Banners duplicados no CRM** → um dono por contexto (US-004).
- **Colisão de cache em host compartilhado/desktop** → namespacing por produto (US-006).
- **Limitação EU/DMA** → fora do controle; documentar para suporte.

## 9. Critérios de pronto (Definition of Done)

- [ ] Todos os critérios de aceite das US-001…US-012 atendidos.
- [ ] `npm run typecheck`, `npm run lint`, `npm run test:run` e `npm run test:deno` verdes.
- [ ] Validação manual em **device iOS real** (16.4+) com **os dois PWAs instalados no mesmo aparelho**, confirmando: assinaturas separadas, notificações sem cruzamento, deep link correto por produto, badge independente, e ausência de revogação após múltiplos envios.

## 10. Fontes (requisitos Apple/WebKit)

- WebKit — Web Push for Web Apps on iOS and iPadOS: https://webkit.org/blog/13878/web-push-for-web-apps-on-ios-and-ipados/
- WebKit — Badging for Home Screen Web Apps: https://webkit.org/blog/14112/badging-for-home-screen-web-apps/
- Apple WWDC23 — What's new in web apps: https://developer.apple.com/videos/play/wwdc2023/10120/
- Pitfall de revogação após poucos pushes (sempre exibir notificação): https://dev.to/progressier/how-to-fix-ios-push-subscriptions-being-terminated-after-3-notifications-39a7
