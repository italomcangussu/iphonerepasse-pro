# PRD: PWA + Web Push independentes por produto (ERP iPhoneRepasse Pro e CRM Plus) no iOS

## 1. Introdução

O mesmo bundle serve **dois produtos instaláveis** como PWA standalone (ver `App.tsx`, `lib/crmRouting.ts`, `lib/runtimeBranding.ts`):

- **iPhoneRepasse Pro (ERP)** — app comercial completo (estoque, PDV, financeiro, garantias). Roteamento `HashRouter` (`/#/...`). Manifesto `/app.webmanifest` (`id`/`start_url` = `/?source=pwa`), marca escura `#0b1220`, ícones `/brand/*`.
- **CRM Plus** — central de atendimento WhatsApp/Instagram com IA. Instalável por **dois vetores**, mas é **um único produto**:
  - host próprio `crm.iphonerepasse.com.br` → `BrowserRouter` (paths limpos), manifesto `/crm.webmanifest` (`id`/`start_url` = `/`);
  - via hash no host principal `#/crmplus` → manifesto `/crmplus.webmanifest` (`id`/`start_url` = `/#/crmplus`).
  - Marca azul `#1d4ed8`, ícones `/brand/crm/*`.

Hoje a infraestrutura de Web Push existe e está parcialmente pronta (SW com handler `push`/`notificationclick`, VAPID, edge functions `push-subscribe`/`push-send`, tabela `push_subscriptions`, UI de permissão Apple HIG), mas tem **dois problemas que bloqueiam push real em iOS**:

1. 🔴 **Criptografia do payload usa o esquema legado `aesgcm` (draft-04)** em `push-send/index.ts`, e não o `aes128gcm` exigido pela RFC 8291. Isso provavelmente faz com que os pushes nunca cheguem a dispositivos iOS apesar de VAPID/assinatura corretos — é o requisito bloqueante #1 a corrigir (US-013).
2. **O pipeline é "cego" ao produto**: a subscription não registra de qual PWA veio, o envio não filtra por produto, e o deep link não respeita o roteador de cada app. Em um device com **os dois PWAs instalados**, isso causa notificação cruzada (ex.: alerta de "venda" chegando no CRM Plus, ou clique abrindo o app errado) e risco de revogação pelo iOS.

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

### 3.4 Decisão arquitetural: CRM Plus passa a ter um único vetor de instalação

O Service Worker é registrado com `scope: '/'` (`services/pwa.ts`), então **dois PWAs instalados a partir do mesmo host compartilham um único registro de SW e uma única `PushManager` subscription**. Isso significa que o ERP (host principal) e o CRM Plus instalado via `#/crmplus` (mesmo host principal) **não podem ter assinaturas de push verdadeiramente independentes** — o discriminador `product` ajudaria a rotear/filtrar no backend, mas a *subscription* em si seria compartilhada no device.

Decisão: **a independência real de push do CRM Plus só é garantida pelo host dedicado `crm.iphonerepasse.com.br`** (origem própria → SW próprio → subscription própria). Portanto:

- O vetor de instalação via `#/crmplus` no host principal é **descontinuado** como caminho de instalação/push do CRM Plus (US-002).
- `crmplus.webmanifest` e o branding `CRM_HASH_BRAND_CONFIG` deixam de ser oferecidos para instalação; usuários que acessam `#/crmplus` no host principal são direcionados a abrir/instalar via `crm.iphonerepasse.com.br`.
- Todo o restante do PRD (catálogo de tópicos, discriminador `product`, deep links, US-005 em diante) assume **CRM Plus = host dedicado** como único produto/instalação válida.

## 4. User Stories

### US-001: Instalação independente do ERP (iPhoneRepasse Pro)
**Descrição:** Como lojista, quero instalar o app comercial na Tela de Início e que ele seja reconhecido como produto `erp`.
**Critérios de Aceite:**
- [x] No host principal (não-CRM, sem hash `#/crmplus`), o manifesto ativo é `/app.webmanifest` e a marca é a escura (`runtimeBranding` DEFAULT).
- [x] Em iOS Safari **não instalado**, o ERP mostra estado `needs_install` e **não** oferece ativar push (`usePushNotifications`).
- [x] Após instalado (standalone), o contexto resolve `product = 'erp'` (`resolvePushProduct`).
- [x] Não há qualquer UI/CTA do CRM Plus visível no fluxo do ERP (`PushOptIn` usa o catálogo `erp`).
- [x] Typecheck/lint passam.

### US-002: CRM Plus com vetor único de instalação (host dedicado)
**Descrição:** Como atendente, quero instalar o CRM Plus **apenas pelo host dedicado** `crm.iphonerepasse.com.br`, garantindo que ele tenha Service Worker e subscription de push próprios (ver decisão em 3.4).
**Critérios de Aceite:**
- [x] No host `crm.iphonerepasse.com.br`, manifesto `/crm.webmanifest`, marca azul `#1d4ed8`, ícones `/brand/crm/*`, resolve `product = 'crmplus'`.
- [x] Em iOS Safari não instalado (host CRM), o app mostra guia "Adicionar à Tela de Início" e **não** oferece ativar push.
- [x] No host principal com hash `#/crmplus`, a UI **não oferece mais instalação/push como PWA do CRM Plus**: exibe CTA "Abrir no app CRM Plus" apontando para `crm.iphonerepasse.com.br` (`CRMPwaControls` detecta o vetor legado de hash e troca os controles pelo CTA).
- [ ] `crmplus.webmanifest` e o branding `CRM_HASH_BRAND_CONFIG` (`lib/runtimeBranding.ts`) deixam de ser vinculados como manifesto instalável (mantidos por ora para compatibilidade de usuários já instalados via hash — UI de instalação já não é oferecida).
- [x] Nenhuma UI/CTA do ERP aparece no fluxo do CRM Plus.
- [x] Typecheck/lint passam.

### US-003: Workflow de permissão por produto (primeiro acesso + gesto)
**Descrição:** Como usuário, ao usar pela primeira vez um PWA instalado, quero um pré-aviso explicativo antes do alerta nativo, sem queimar a permissão.
**Critérios de Aceite:**
- [x] O prompt nativo **nunca** é disparado no carregamento — sempre sob gesto (`PermissionRequest` `onAllow`).
- [x] Em iOS não-standalone, o fluxo bloqueia o pedido de push e exibe o guia de instalação (estado `needs_install`), em vez de cair em `unsupported` genérico.
- [x] A assinatura criada é gravada com o `product` correto (`resolvePushProduct` no `pushClient`).
- [x] O pré-aviso (sheet HIG, `PermissionRequest.tsx`) tem texto/ícone/cor do **produto corrente** em todos os pontos de entrada. Copy centralizada em `getPushPermissionCopy(product)` (`lib/pushProduct.ts`) e consumida por `PushPermissionPrompt`, `CRMPwaControls` e `PushOptIn`; ícone (`Bell`) e cores (`brand-*`) já são temados por produto via `runtimeBranding`.
- [x] Typecheck/lint passam.

### US-004: Lembrete de permissão pendente por produto
**Descrição:** Como usuário que ainda não ativou notificações, quero ser lembrado de forma não intrusiva, sem banners duplicados.
**Critérios de Aceite:**
- [x] Existe **um único dono de banner por contexto**: ERP usa `PushPermissionPrompt` (montado só no app principal); CRM Plus usa `CRMPwaControls` (montado só no standalone). Nunca renderizam juntos.
- [x] O banner aparece quando: standalone + permissão `default`/`error` + ainda não assinado + não dispensado nos últimos 14 dias.
- [x] "Agora não" silencia por 14 dias usando chave namespaced por contexto.
- [x] Após instalar (`appinstalled`/standalone), o pré-aviso correspondente é oferecido.
- [x] Quando `denied`, o banner não reaparece; em vez disso há card "Como reativar".
- [x] Typecheck/lint passam.

### US-005: Configurações independentes (ativar/desativar/tópicos) por produto
**Descrição:** Como usuário, quero gerenciar minhas notificações de cada produto separadamente.
**Critérios de Aceite:**
- [x] `pages/Settings.tsx` (ERP) exibe `PushOptIn` com os tópicos do ERP (`sale`, `new_lead`, `finance_due`, `stock_alert`) — derivados do catálogo do produto em `PushOptIn.tsx`.
- [x] `pages/crm/SettingsPage.tsx` (CRM Plus) exibe `PushOptIn` com os tópicos do CRM (`crm_inbox`, `new_lead`, `transfer_pending`).
- [x] Ações: **Ativar** (subscribe), **Desativar** (unsubscribe → `is_active=false`), **Trocar tópicos** (sem re-subscrever) — todas marcando/lendo o `product` corrente.
- [x] Estado visual: `Ativado` / `Bloqueado` / `Precisa instalar` / `Não suportado`.
- [x] Em `denied` no iOS, instrução "Ajustes › Notificações › <nome do app>".
- [x] Desativar/alterar tópicos de um produto **não** afeta a assinatura do outro (cache namespaced + `product` no envio).
- [x] Typecheck/lint passam.

### US-006: Cliente tagueia a assinatura com o produto
**Descrição:** Como sistema, preciso registrar de qual PWA veio cada subscription.
**Critérios de Aceite:**
- [x] `services/pushClient.ts` resolve `product` em runtime e o envia no corpo de `push-subscribe` (POST).
- [x] Tópicos default passam a ser **derivados do produto** (não a lista global atual `['crm_inbox','new_lead','sale']`).
- [x] Chaves de cache de `localStorage` são namespaced por produto.
- [x] Em re-sync (pageshow/focus), se `getSubscription()` for `null` (revogado pelo iOS), o cliente re-subscreve preservando `product`+tópicos.
- [x] Testes unitários de `pushClient` cobrem resolução de produto e namespacing.
- [x] Typecheck/lint passam.

### US-007: Persistência da assinatura com coluna de produto
**Descrição:** Como sistema, preciso armazenar e indexar a assinatura por produto.
**Critérios de Aceite:**
- [x] Nova migration adiciona coluna `product text not null default 'erp'` (check em `('erp','crmplus')`) a `push_subscriptions`.
- [x] Índice `(store_id, product, is_active)` e `(product, topics, is_active)` para targeting eficiente.
- [x] Backfill: linhas existentes recebem `product` inferido por `platform`/`topics` quando possível; default `erp`.
- [x] `push-subscribe` valida `product` e valida `topics` contra o catálogo **do produto** (rejeita tópico desconhecido).
- [x] RLS mantida (usuário gerencia apenas as próprias). 
- [x] Teste Deno de `push-subscribe` cobre validação de produto/tópicos.

### US-008: Envio backend filtrado por produto (sem disparo cruzado)
**Descrição:** Como sistema, ao enviar um evento, devo atingir **apenas** as assinaturas do produto correto.
**Critérios de Aceite:**
- [x] `push-send` aceita e **exige** `product` no targeting; só seleciona subscriptions daquele produto.
- [x] O filtro por `topic` é **efetivamente aplicado** (hoje todos da loja recebem tudo) — só recebe quem tem o tópico no array **e** o produto correto.
- [x] Evento de ERP (`sale`/`finance_due`/`stock_alert`) nunca atinge `crmplus`; evento de CRM (`crm_inbox`/`transfer_pending`) nunca atinge `erp`.
- [x] Mantém tratamento de `404`/`410` (desativa subscription) e atualiza `last_error_*`.
- [x] Adiciona **timeout** no `fetch` e **retry com backoff** para `5xx`.
- [x] Teste Deno cobre seleção por produto+tópico.

### US-009: Deep link correto por produto/roteador
**Descrição:** Como usuário, ao tocar a notificação, quero abrir exatamente a tela certa do PWA certo.
**Critérios de Aceite:**
- [x] O `url` do payload é construído conforme o **produto e roteador da assinatura alvo**:
  - `erp` → `https://<host principal>/#/<rota>` (HashRouter);
  - `crmplus` (host CRM) → `https://crm.iphonerepasse.com.br/<rota-limpa>` (`buildCrmNotificationUrl` em `_shared/crm_push.ts`).
- [x] O webhook `crm-uaz-webhook-receiver` usa o builder compartilhado por produto (deep link de host dedicado, não mais `/conversations/:id` "cru").
- [x] `notificationclick` no `sw.js` foca a janela existente do produto certo ou abre nova com a URL correta.
- [x] Typecheck/lint passam (cliente). Teste Deno do builder em `_shared/crm_push.deno.ts` (execução do `test:deno` bloqueada neste ambiente — deno.land/jsr/esm.sh retornam 403).

### US-010: Service Worker compartilhado, exibição sempre visível (anti-revogação)
**Descrição:** Como sistema, com **um SW para os dois PWAs**, preciso exibir notificação visível em todo push, com branding do payload.
**Critérios de Aceite:**
- [x] O handler `push` **sempre** chama `showNotification` dentro de `event.waitUntil`, inclusive em caminho de erro/payload vazio (fallback genérico com título não-vazio).
- [x] `icon`/`badge`/`tag`/`title` vêm do payload e refletem o produto (ícone `/brand/*` para ERP, `/brand/crm/*` para CRM).
- [x] `silent:true` continua ignorado (sempre visível).
- [x] Teste em `tests/service-worker/push-sw.test.ts` cobre: payload válido (ERP e CRM) e payload inválido (fallback exibido).

### US-011: Badge de ícone por produto (iOS 16.4+)
**Descrição:** Como usuário, quero ver o contador no ícone do PWA correspondente.
**Critérios de Aceite:**
- [x] Em push recebido, o SW atualiza o badge via `navigator.setAppBadge()` quando o payload traz `badgeCount` (sem quebrar onde não há suporte).
- [x] O badge do ERP e do CRM Plus são independentes (cada PWA tem seu próprio contexto/contador no iOS).
- [x] Ao tocar a notificação (`notificationclick`), o badge é zerado via `clearAppBadge()`.
- [x] Degradação graciosa onde a API não existe (guards + try/catch; coberto em `push-sw.test.ts`).

### US-012: Telemetria e robustez (sem falso positivo)
**Descrição:** Como operação, quero observar envio/entrega/erros para detectar revogação e medir entrega.
**Critérios de Aceite:**
- [x] `push-send` registra em `crm_event_log` eventos `push_sent`/`push_failed`/`push_deactivated` com `product`, `topic`, `count` (best-effort). Como `crm_event_log.store_id` é `NOT NULL`, a telemetria só é gravada quando um envio é explicitamente escopado por loja; os disparos atuais (CRM e venda) são intencionalmente **não** escopados por loja (ver §5/US-014), então a capacidade fica disponível para envios futuros store-scoped.
- [x] `.env.example` passa a documentar `PUSH_WORKER_SECRET` e `VITE_CRM_HOSTNAME`.
- [x] Validação de `title` não-vazio e limites (≈240 chars título; body ≤480) no envio (`normalizeNotification`).
- [x] Rotina de limpeza de subscriptions `is_active=false` antigas e cascade ao deletar usuário. Cascade já vem do FK `user_id ... on delete cascade`; a migration `20260613150000_push_subscriptions_housekeeping.sql` adiciona `cleanup_stale_push_subscriptions()` (desativa devices silenciosos e remove inativos antigos) e a agenda via `pg_cron` quando a extensão está disponível (guard idempotente).
- [x] Testes Deno cobrem desativação por `410` (logging coberto por revisão manual; `test:deno` bloqueado no ambiente).

### US-013: 🔴 Corrigir criptografia do payload para `aes128gcm` (RFC 8291)
**Descrição:** Como sistema, preciso cifrar o payload de push no formato exigido pelos navegadores atuais (incluindo Safari/iOS), pois o esquema legado `aesgcm` (draft-04) hoje usado provavelmente impede qualquer entrega real no iOS. Este item é **pré-requisito de todos os demais** — sem ele, nenhuma validação ponta-a-ponta no iOS é possível.
**Critérios de Aceite:**
- [x] `encryptPayload`/`buildWebPushInfo` em `supabase/functions/push-send/index.ts` implementam o formato `aes128gcm` (RFC 8291): header binário único (salt 16 bytes + record size + `keyid` com a chave pública efêmera) seguido do corpo cifrado, em vez dos headers separados `Encryption`/`Crypto-Key`.
- [x] `info` strings usam os labels da RFC 8291 (`"WebPush: info\x00"` para derivar a IKM combinada com a chave pública do servidor/cliente) em vez de `"Content-Encoding: aesgcm\x00"` / `"Content-Encoding: nonce\x00"`.
- [x] Request HTTP ao push service usa `Content-Encoding: aes128gcm` e remove os headers `Encryption`/`Crypto-Key` do formato legado.
- [x] Cabeçalho `Authorization: vapid t=<jwt>, k=<chave VAPID pública>` (ES256) mantido.
- [x] Teste Deno (`push-send.deno.ts`) cobre o round-trip de criptografia (cifra com a função do código, decifra com implementação de referência da RFC 8291) e os testes existentes de `push-send.deno.ts` continuam verdes.
- [ ] Validação manual com um endpoint real `https://web.push.apple.com/...` (subscription real de um iPhone 16.4+) confirma que a notificação chega — **pendente, requer device iOS + deploy**.

### US-014: Alerta de venda concluída para administrador (ERP)
**Descrição:** Como administrador da loja, quero receber um push no app ERP quando uma venda for concluída no PDV.

> **Arquitetura escolhida: edge function `sales-notify`.** A venda é criada via RPC `create_sale_full` (DB) e o cliente (`addSale`) usa apenas JWT de usuário — que o `push-send` rejeita (403). Optou-se pela edge function `sales-notify` (segue o padrão de edge functions do CRM, é testável, e dispara **após** o RPC ter sucesso, sem tocar na transação da venda) em vez de um trigger `pg_net`+Vault (sem precedente algum no repo — não há `pg_net`/`net.http_post` em nenhuma migration — e com risco de afetar a transação). `sales-notify` autentica o chamador (`requireAuthenticatedRole`) e relaia ao `push-send` com o bearer service-role.

**Critérios de Aceite:**
- [x] Ao concluir uma venda, `addSale` (`services/dataContext.tsx`) chama a edge function `sales-notify` (fire-and-forget, defensivo: erro nunca quebra a venda) que dispara `push-send` com `product='erp'`, `topic='sale'`.
- [x] Apenas assinaturas com `topic='sale'` e `product='erp'` recebem (nunca alcança `crmplus`, pois `product` é sempre filtrado no `push-send`). **Sem escopo por loja** — o app opera ambas as lojas com acesso compartilhado (ver §5), espelhando o comportamento do CRM.
- [x] Título/corpo trazem um resumo da venda (vendedor • valor total • cliente, via `buildSaleNotificationBody`), respeitando os limites de tamanho do US-012.
- [x] `url` do payload aponta para `/#/finance` no ERP (`HashRouter`), onde a venda impacta o financeiro (não há rota de detalhe de venda dedicada).
- [x] Testes Deno (`sales-notify/sales-notify.deno.ts`) cobrem o builder e o relay ao push-send (sucesso e falha sem quebrar a venda); testes Vitest cobrem o disparo a partir de `addSale` e a resiliência a erro de dispatch.

### US-015: Push de handoff IA→humano pendente (CRM Plus)
**Descrição:** Como atendente/admin do CRM Plus, quero ser notificado quando uma conversa entra em `transferencia_pendente` (a IA parou e está aguardando um humano assumir), para reduzir o tempo de resposta.
**Critérios de Aceite:**
- [x] Quando a conversa transita para `transferencia_pendente` (`crm-ai-inbound/index.ts`, nos dois caminhos: transfer pedido pelo agente e escalonamento por sentimento/urgência), dispara `push-send` com `product='crmplus'`, `topic='transfer_pending'` via `notifyHandoffPending`.
- [x] Payload usa `requireInteraction: true`.
- [x] Alcança todos os assinantes `crmplus` com `topic='transfer_pending'` (sem escopo por loja — o app opera ambas as lojas com acesso compartilhado, ver §5; mesma lógica de `crm_inbox`/`new_lead`).
- [x] `url` do payload aponta para `/conversations/:id` no host dedicado `crm.iphonerepasse.com.br` (builder compartilhado).
- [x] A transição para `em_atendimento_humano` acontece na UI (`ConversationsPage`) e **não** passa por este fluxo — só o `transfer_pending` inicial notifica.
- [x] Teste Deno do builder `transfer_pending` em `_shared/crm_push.deno.ts` (`test:deno` bloqueado no ambiente).

### US-016: Paridade de push para mensagens inbound do Instagram
**Descrição:** Como atendente do CRM Plus, quero receber push de novas mensagens/leads do Instagram da mesma forma que já recebo do WhatsApp.
**Critérios de Aceite:**
- [x] A lógica de notificação foi extraída para `supabase/functions/_shared/crm_push.ts` (`buildCrmNotificationUrl`, `buildCrmPushNotificationRequest`, `sendCrmPushNotification`, `compactNotificationText`); `crm-uaz-webhook-receiver` agora a importa (e re-exporta para os testes existentes).
- [x] `crm-instagram-webhook-receiver` chama o helper em mensagem inbound (`topic='crm_inbox'`) e novo lead (`topic='new_lead'`), com `product='crmplus'` (sem escopo por loja — ver §5, paridade com o WhatsApp).
- [x] Usa o mesmo builder de deep link por produto (US-009) e `compactNotificationText` do WhatsApp.
- [x] Teste Deno do builder compartilhado em `_shared/crm_push.deno.ts` (`test:deno` bloqueado no ambiente).

## 5. Matriz de independência por produto (resumo)

| Dimensão | ERP (`erp`) | CRM Plus (`crmplus`) | Compartilhado |
|---|---|---|---|
| Manifesto | `/app.webmanifest` | `/crm.webmanifest` (host dedicado, único vetor — ver 3.4) | — |
| Marca/ícone/badge | escura, `/brand/*` | azul, `/brand/crm/*` | — |
| Roteador / deep link | `/#/...` | paths limpos em `crm.iphonerepasse.com.br` | — |
| Tópicos | `sale`,`new_lead`,`finance_due`,`stock_alert` | `crm_inbox`,`new_lead`,`transfer_pending` | catálogo central |
| Assinatura | `product='erp'` | `product='crmplus'` | tabela `push_subscriptions` |
| UI permissão/banner | `PushPermissionPrompt` + `PushOptIn` (Settings) | `CRMPwaControls` + `PushOptIn` (SettingsPage CRM) | `PermissionRequest` (sheet) |
| Cache local | chaves `:erp` | chaves `:crmplus` | — |
| VAPID | mesma chave (mesma origem) | mesma chave | `VITE_VAPID_PUBLIC_KEY` / `VAPID_PRIVATE_KEY` |
| Service Worker | mesmo `/sw.js` (scope `/`), branding por payload | idem | `public/sw.js` |
| Envio | filtro `product=erp`+tópico | filtro `product=crmplus`+tópico | `push-send` |

> **Sem escopo por loja (decisão de produto).** O app opera **ambas as lojas** com acesso compartilhado aos mesmos canais. Portanto os disparos (WhatsApp, Instagram, handoff IA, venda) **não** filtram por `store_id` — alcançam todos os assinantes do produto+tópico. O `push-send` ainda suporta `store_id` para um eventual envio store-scoped futuro, mas nenhum disparo atual o usa.

## 6. Requisitos bloqueantes (gate — valem para os dois PWAs)

- [ ] iOS/iPadOS **16.4+**.
- [ ] App **adicionado à Tela de Início** (standalone); push não existe no Safari aba.
- [ ] Manifesto `display: standalone` (✅ já atendido em `app.webmanifest`/`crm.webmanifest`).
- [ ] `Notification.requestPermission()` **somente sob gesto** (✅ já atendido).
- [ ] SW com handler `push` que **sempre** exibe notificação (✅ já atendido, ver US-010 para branding por produto).
- [ ] 🔴 Criptografia do payload em `aes128gcm` (RFC 8291) — **hoje em `aesgcm` legado, bloqueia entrega real no iOS** (US-013, pré-requisito de todo o restante).
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
- `supabase/functions/push-send/index.ts` — **reescrever `encryptPayload`/`buildInfo` para `aes128gcm`/RFC 8291** (US-013); filtro por produto+tópico, timeout/retry, telemetria.
- `supabase/functions/_shared/crm_push.ts` (novo) — extrai `buildCrmNotificationUrl`/`buildCrmPushNotificationRequest`/`sendCrmPushNotification` de `crm-uaz-webhook-receiver` para reuso (US-016).
- `supabase/functions/crm-uaz-webhook-receiver/index.ts` — deep link por produto (`crmplus`); passa a usar o helper compartilhado.
- `supabase/functions/crm-instagram-webhook-receiver/index.ts` — paridade de push com WhatsApp (US-016).
- `supabase/functions/crm-ai-inbound/index.ts` — disparo de push `transfer_pending` na transição para `transferencia_pendente` (US-015).
- `supabase/functions/sales-notify/index.ts` (novo) — edge function de venda concluída; `addSale` (`services/dataContext.tsx`) a chama fire-and-forget e ela relaia ao `push-send` com `product='erp'`, `topic='sale'` (US-014).
- `supabase/migrations/20260613150000_push_subscriptions_housekeeping.sql` (novo) — `cleanup_stale_push_subscriptions()` + agenda `pg_cron` (US-012).
- (novo disparo) `finance_due`/`stock_alert` do ERP chamando `push-send` com `product='erp'` (mantido como candidato futuro, fora do escopo imediato de US-014/015/016).

**Config/Docs**
- `.env.example` — `PUSH_WORKER_SECRET`, `VITE_CRM_HOSTNAME`.

**Testes**
- `services/pushClient.test.ts`, `hooks/usePushNotifications.test.tsx` (resolução de produto/namespacing).
- `tests/service-worker/push-sw.test.ts` (ERP/CRM + fallback).
- `supabase/functions/push-subscribe/*.deno.ts`, `supabase/functions/push-send/*.deno.ts` (validação/targeting/410/`aes128gcm`).
- `crm-uaz-webhook-receiver/*.deno.ts`, `crm-instagram-webhook-receiver/*.deno.ts` (deep link por produto, paridade de push).
- `crm-ai-inbound/*.deno.ts` (push em `transferencia_pendente`).

## 8. Riscos e mitigações

- **🔴 Criptografia legada (`aesgcm`) impede entrega no iOS** → corrigir para `aes128gcm`/RFC 8291 antes de qualquer outro trabalho de validação (US-013).
- **Revogação silenciosa pelo iOS** (push sem notificação) → US-010 (fallback sempre-visível) + US-012 (telemetria para detectar).
- **Notificação cruzada entre produtos** → discriminador `product` em toda a cadeia (US-006/007/008).
- **Deep link abrindo app errado/home** → builder por produto (US-009).
- **Banners duplicados no CRM** → um dono por contexto (US-004).
- **Colisão de cache em host compartilhado/desktop** → namespacing por produto (US-006).
- **Subscription compartilhada entre ERP e CRM via `#/crmplus`** (mesmo SW scope `/`) → vetor de instalação descontinuado, CRM Plus passa a depender apenas do host dedicado (US-002, 3.4).
- **Limitação EU/DMA** → fora do controle; documentar para suporte.

## 9. Critérios de pronto (Definition of Done)

- [ ] Todos os critérios de aceite das US-001…US-016 atendidos.
- [ ] `npm run typecheck`, `npm run lint`, `npm run test:run` e `npm run test:deno` verdes.
- [ ] Validação manual em **device iOS real** (16.4+) com **os dois PWAs instalados no mesmo aparelho**, confirmando: assinaturas separadas, notificações sem cruzamento, deep link correto por produto, badge independente, e ausência de revogação após múltiplos envios.

## 10. Fontes (requisitos Apple/WebKit)

- WebKit — Web Push for Web Apps on iOS and iPadOS: https://webkit.org/blog/13878/web-push-for-web-apps-on-ios-and-ipados/
- WebKit — Badging for Home Screen Web Apps: https://webkit.org/blog/14112/badging-for-home-screen-web-apps/
- Apple WWDC23 — What's new in web apps: https://developer.apple.com/videos/play/wwdc2023/10120/
- Pitfall de revogação após poucos pushes (sempre exibir notificação): https://dev.to/progressier/how-to-fix-ios-push-subscriptions-being-terminated-after-3-notifications-39a7
