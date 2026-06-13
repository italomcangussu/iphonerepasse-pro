---
name: pwa-webpush-review
description: Audita a implementação de PWA instalável + Web Push (frontend e backend Supabase/Deno) deste repo contra os requisitos da Apple/WebKit para iOS/iPadOS 16.4+ (Safari standalone). Cobre os DOIS produtos instaláveis independentes (ERP iPhoneRepasse Pro e CRM Plus): manifestos, Service Worker, fluxo de permissão, anti-revogação (push deve sempre exibir notificação), VAPID/criptografia, deep links, isolamento de tópicos/assinaturas por produto, badge, telemetria. Também varre o código em busca de eventos de negócio que deveriam disparar push e ainda não disparam, perguntando ao usuário se quer incluí-los no escopo. Use quando o pedido for revisar/auditar/validar push notifications, instalação de PWA no iOS, ou "por que a notificação não chega no iPhone".
---

# PWA + Web Push Review (iOS 16.4+ standalone) — ERP e CRM Plus

Skill de **auditoria read-only** (não edita código, não faz commit). Produz um relatório acionável e, opcionalmente, com confirmação explícita do usuário, executa uma verificação ponta-a-ponta enviando um push de teste real.

Esta skill assume o modelo de **dois produtos PWA independentes no mesmo bundle**, conforme `tasks/prd-pwa-push-independente-erp-crmplus-ios.md` (se existir — leia-o primeiro para saber se as User Stories já foram implementadas):

| Produto | Como instala | Manifesto | Roteador / deep link | Tópicos |
|---|---|---|---|---|
| `erp` (iPhoneRepasse Pro) | host principal, Tela de Início | `/app.webmanifest` | HashRouter `/#/...` | `sale`, `new_lead`, `finance_due`, `stock_alert` (ou os que existirem no código) |
| `crmplus` (CRM Plus) | `crm.iphonerepasse.com.br` **ou** `#/crmplus` no host principal | `/crm.webmanifest` / `/crmplus.webmanifest` | paths limpos ou `/#/crmplus/...` | `crm_inbox`, `new_lead`, `transfer_pending` |

Se a coluna/discriminador `product` ainda não existir no código, **não assuma que existe** — trate como gap (ver Fase 6) e relate o estado real.

---

## Fase 0 — Descoberta de escopo

Localize (Glob/Grep) e leia, sem assumir caminhos fixos — o código pode ter mudado desde esta skill ser escrita:

**Frontend**
- `services/pushClient.ts`, `hooks/usePushNotifications.ts`, `hooks/usePermissionState.ts`
- `components/pwa/PermissionRequest.tsx`, `PushOptIn.tsx`, `PushPermissionPrompt.tsx`, `CRMPwaControls.tsx`
- `public/sw.js` (handlers `push`, `notificationclick`, `pushsubscriptionchange`)
- `public/*.webmanifest` (todos)
- `lib/crmRouting.ts`, `lib/runtimeBranding.ts`
- `pages/Settings.tsx`, `pages/crm/SettingsPage.tsx`
- `App.tsx` (onde `PushPermissionPrompt`/`CRMPwaControls` são montados)

**Backend (Supabase/Deno)**
- `supabase/functions/push-subscribe/index.ts`
- `supabase/functions/push-send/index.ts` (+ `.deno.ts`)
- `supabase/migrations/*push_subscription*.sql` (todas, em ordem)
- `supabase/functions/crm-uaz-webhook-receiver/index.ts` e `crm-instagram-webhook-receiver/index.ts` (disparo de push em evento inbound)
- `supabase/functions/_shared/*` relacionados a push/notificação
- `.env.example` (variáveis `VAPID_*`, `VITE_VAPID_PUBLIC_KEY`, `PUSH_WORKER_SECRET`, `VITE_CRM_HOSTNAME`, `CRM_BASE_URL`)

**Specs/planos existentes** (para não duplicar trabalho já mapeado):
- `tasks/prd-pwa-push-independente-erp-crmplus-ios.md`
- `tasks/prd-apple-permissoes-toast-push-camera-album-estoque.md`
- `docs/superpowers/plans/2026-05-15-pwa-completo-ios-push-crmplus.md`
- `docs/superpowers/specs/2026-05-15-pwa-completo-ios-push-crmplus-design.md`

Se o repo for grande, delegue esta fase a um agente `Explore` para não estourar contexto — peça que retorne apenas caminhos + trechos relevantes (push handler, manifestos, edge functions).

---

## Fase 1 — Requisitos bloqueantes (gate Apple/WebKit)

Verifique cada item; se algum falhar, **marque o produto inteiro como "push impossível no iOS"** até corrigir:

- [ ] iOS/iPadOS alvo ≥ 16.4 (documentar como requisito de suporte, não testável em código).
- [ ] Cada manifesto relevante tem `"display": "standalone"` ou `"fullscreen"` (sem isso o `PushManager` não é exposto no SW).
- [ ] `Notification.requestPermission()` só é chamado dentro de handler de gesto do usuário (`onClick`/`onTap`), nunca em `useEffect`/mount/loader.
- [ ] Existe Service Worker registrado com `addEventListener('push', ...)` e `addEventListener('notificationclick', ...)`.
- [ ] `PushManager.subscribe()` usa `userVisibleOnly: true`.
- [ ] `VAPID_PUBLIC_KEY`/`VAPID_PRIVATE_KEY`/`VAPID_SUBJECT` configurados e consistentes entre cliente e backend (mesma chave pública usada em `applicationServerKey` e na assinatura JWT do `push-send`).
- [ ] HTTPS em produção (não testável localmente — confirmar via config/deploy).
- [ ] Documentar a limitação regional EU/DMA (PWA pode abrir só em aba do Safari na UE → push indisponível) — não é bug do código, é aviso de produto/suporte.

---

## Fase 2 — Frontend: fluxo de permissão e configurações (por produto)

Para **cada produto** (`erp` e `crmplus`), verifique:

### Primeiro acesso / pré-aviso
- [ ] Existe sheet/pré-aviso (Apple HIG) antes do prompt nativo, com CTA único (ex.: "Continuar").
- [ ] Em iOS Safari **não instalado** (não-standalone), o app **bloqueia** a oferta de push e mostra instrução "Adicionar à Tela de Início" — não deve cair num estado genérico "unsupported".
- [ ] Após `appinstalled`/entrada em modo standalone, o pré-aviso correspondente é oferecido.

### Lembrete de permissão pendente
- [ ] Existe banner/lembrete quando: standalone + `Notification.permission === 'default'` (ou `'error'`) + sem subscription ativa.
- [ ] **Apenas um componente** é "dono" do banner por contexto/produto (cheque se `PushPermissionPrompt` e `CRMPwaControls`, ou equivalentes, não renderizam simultaneamente para o mesmo produto — procure por condições de exibição sobrepostas).
- [ ] Dismissal ("Agora não") tem cooldown (ex.: 14 dias) persistido em `localStorage`, com chave que **não colida entre produtos** (verifique se a chave é namespaced, ex. `:erp`/`:crmplus`, ou se é genérica — se genérica, é gap).
- [ ] Estado `denied`: não tenta reabrir prompt nativo (impossível no iOS); mostra instrução "Ajustes › Notificações › <nome do app>" com o **nome correto do app** por produto.

### Configurações manuais (Settings)
- [ ] Toggle Ativar/Desativar presente em `pages/Settings.tsx` (ERP) e `pages/crm/SettingsPage.tsx` (CRM).
- [ ] Lista de tópicos exibida corresponde ao catálogo do **produto correspondente** (não a lista genérica global).
- [ ] Desativar/alterar tópicos de um produto não deve gravar/alterar a subscription do outro produto (se houver discriminador `product`, confirme que o filtro é usado nas chamadas; se não houver, é gap crítico — ver Fase 6).
- [ ] Estados visuais cobrem: `Ativado` / `Bloqueado` / `Precisa instalar` / `Não suportado` / erro.

---

## Fase 3 — Anti-revogação (o item mais crítico)

O iOS revoga a permissão de um site se o Service Worker receber um `push` e **não exibir** uma notificação visível. Audite `public/sw.js`:

- [ ] O handler `push` chama `showNotification()` em **todo** caminho, incluindo:
  - payload ausente/vazio (`event.data` null);
  - `event.data.json()` lançando exceção (payload malformado);
  - `title` vazio/undefined no payload (deve ter fallback de string não-vazia).
- [ ] Toda a lógica do handler está dentro de `event.waitUntil(...)`, incluindo o caminho de fallback/erro (não só o caminho feliz).
- [ ] `silent: true` no payload é **ignorado** (sempre mostra notificação) — confirme que não existe `if (payload.silent) return;` sem `showNotification`.
- [ ] `tag`/`renotify` configurados de forma sensata (evita acúmulo, mas não esconde notificações novas).
- [ ] Limites de conteúdo: `title` curto (~≤ 240 chars), `body` curto o suficiente para lock screen — checar se o backend (`push-send` / quem monta o payload) valida/trunca.

Se algum desses falhar, classifique como **🔴 risco de revogação silenciosa** — após poucos envios, o usuário para de receber push e a permissão volta para `default`/`denied` sem aviso.

---

## Fase 4 — Backend: assinatura, envio, criptografia

### `push-subscribe`
- [ ] Exige auth (JWT do usuário), valida `endpoint`, `p256dh`, `auth` presentes.
- [ ] Upsert por `endpoint` (não duplica subscriptions do mesmo device).
- [ ] Se existir discriminador `product`/`app`: valida contra `('erp','crmplus')` e valida `topics` contra o catálogo **daquele produto** (rejeita tópico desconhecido/cruzado).
- [ ] DELETE/unsubscribe marca `is_active=false` (não deleta a linha — preserva histórico para diagnóstico).

### Tabela `push_subscriptions`
- [ ] RLS: usuário só gerencia as próprias subscriptions.
- [ ] Índices úteis para o targeting usado por `push-send` (`store_id`, `topics`, `is_active`, e `product` se existir).
- [ ] Colunas de diagnóstico: `last_seen_at`, `last_error_at`, `last_error_message`.

### `push-send`
- [ ] Autenticação por service-role ou secret de worker (`x-worker-secret`/`PUSH_WORKER_SECRET`) — não exposto publicamente.
- [ ] Assinatura VAPID JWT (`ES256`), `aud` = origem do push service do endpoint (ex. `https://web.push.apple.com` para Safari/iOS), `exp` ≤ 24h.
- [ ] Criptografia RFC 8291 (`aes128gcm`): ECDH P-256 + HKDF + AES-GCM, headers corretos (`Authorization: vapid t=...,k=...`, `Content-Encoding: aes128gcm`, `TTL`).
- [ ] **Filtro de targeting realmente aplicado**: se o request pede `topic`/`product`, confirme no código que a query SQL filtra por isso (não apenas por `store_id`) — esse é o ponto onde "manda tudo pra todo mundo" costuma se esconder.
- [ ] Tratamento de resposta do push service:
  - `200/201/202` → sucesso;
  - `404/410` → marca `is_active=false`;
  - `429`/`5xx` → não desativa; idealmente retry com backoff.
- [ ] `fetch` ao push service tem **timeout** (evita function travada).
- [ ] Telemetria: log de envio/falha/desativação (tabela de eventos, ex. `crm_event_log`), com `product`/`topic`/host do endpoint.

### Disparo em eventos de negócio
- [ ] `crm-uaz-webhook-receiver`/`crm-instagram-webhook-receiver`: mensagem inbound → push `crm_inbox`; novo lead → `new_lead`. Confirme que o `url` do payload de notificação é uma rota válida **no roteador do produto de destino** (ex.: se o destinatário é assinante `crmplus` via hash, a URL deve ser `/#/crmplus/conversations/:id`; se via host dedicado, path limpo `/conversations/:id`). Procure por URLs hardcoded que ignoram o roteador.
- [ ] Outros eventos de negócio do ERP que já existam disparando push (ex. venda concluída, conta a pagar vencendo, estoque baixo) — confirme `product`/`topic` corretos.

---

## Fase 5 — Manifestos, ícones, badge

Para cada `.webmanifest` envolvido:
- [ ] `display: standalone`/`fullscreen`, `start_url` e `scope` coerentes com o roteador do produto.
- [ ] Ícones 192/512 (+ maskable) e `apple-touch-icon` 180×180 existem nos paths referenciados (verifique se os arquivos existem em `public/brand/...`, não só a entrada no manifest).
- [ ] `theme_color`/`background_color` e nome (`name`/`short_name`) corretos por produto (não devem aparecer textos/cores do outro produto).
- [ ] `lib/runtimeBranding.ts` troca `<link rel="manifest">`, favicons e `theme-color` corretamente conforme host/hash — teste mentalmente os 3 casos: host principal, host `crm.*`, hash `#/crmplus`.
- [ ] Badge API (`navigator.setAppBadge`/`clearAppBadge`, iOS 16.4+): se implementada, confirme que roda dentro do SW (push) e/ou do app em foreground, com try/catch (API pode não existir em todos os browsers) e que é zerada ao visualizar a fila.

---

## Fase 6 — Independência por produto (auditoria cruzada)

Esta é a checagem que evita "notificação do app errado":

1. Existe algum campo/coluna que discrimine o produto da subscription (`product`, `app`, ou inferível de forma confiável por `topics`/`platform`)? Se **não existir**, registre como gap crítico — sem isso, qualquer envio por `topic` pode atingir os dois produtos se o nome do tópico colidir (ex. `new_lead` existe nos dois catálogos).
2. Para cada tópico que existe nos dois catálogos (ex. `new_lead`), confirme que o `push-send` consegue diferenciar o destino — senão um evento de CRM pode notificar o PWA do ERP e vice-versa.
3. Cache local (`localStorage`) de endpoint/tópicos/dismissal: as chaves são namespaced por produto? Em um navegador onde o usuário tem os dois PWAs instalados (mesmo `localStorage` de origem, se mesmo host), uma chave genérica faz o estado de um produto vazar para o outro.
4. Deep link: para um payload de teste de cada tópico de cada produto, escreva manualmente a URL resultante (usando a lógica do `notificationclick` + `crmRouting`) e confirme que abre a tela certa no app certo.

---

## Fase 7 — Descoberta de novos fluxos que deveriam ter push (expansão de escopo)

Esta skill **amplia o escopo ativamente**: depois da auditoria do que já existe, procure no código por eventos de negócio assíncronos/relevantes que ainda não disparam push, para sugerir como candidatos.

1. Rode uma busca ampla (Grep/Explore) por padrões de eventos de negócio relevantes que já existem no app mas **não** aparecem perto de `push-send`/`sendCrmPushNotification`/`upsertSubscription`, por exemplo:
   - Vencimento de dívida/conta a pagar (`finance`, `debts`, `dueDate`, `vencimento`).
   - Estoque baixo / produto reservado expirando (`stock`, `reserva`, `estoque baixo`).
   - Garantia próxima do vencimento (`warranties`, `garantia`).
   - Handoff de IA→humano no CRM (`transferencia_pendente`, `em_atendimento_humano`) — já é mencionado no CLAUDE.md como estado crítico.
   - Broadcast/agendamento de mensagens (`crm-broadcast-worker`, `crm-scheduled-messages-worker`).
   - Pagamento recebido / venda concluída no PDV.
   - Qualquer `crm_event_log` / evento publicado via `crm-event-publisher` que não tenha um consumidor de push.

2. Para cada candidato encontrado, monte uma lista curta: **evento → produto (`erp`/`crmplus`) → tópico sugerido → por que importa** (ex.: "conta a pagar vence em 1 dia → erp → `finance_due` → evita atraso/multa").

3. **Pergunte ao usuário via `AskUserQuestion`** (não decida por conta própria) quais desses candidatos devem entrar no escopo de implementação/PRD — apresente como lista de opções (multiSelect) com descrição de 1 linha cada. Não implemente nada nesta fase; apenas registre a decisão no relatório final.

---

## Fase 8 — Verificação de entrega real (opcional, requer confirmação)

A skill não controla um iPhone físico, mas pode **fechar o ciclo** com a infraestrutura existente:

1. **Auditoria de estado real via Supabase MCP** (somente leitura):
   - `list_tables` para confirmar schema de `push_subscriptions` e tabelas de log relacionadas.
   - `execute_sql` (SELECT) para contar subscriptions ativas por `platform='ios'`, por produto/tópico, e verificar `last_error_*` recentes (sinal de revogação em massa).
   - `get_logs`/`get_advisors` nas edge functions `push-subscribe`/`push-send` para erros recorrentes.
   - `list_edge_functions` para confirmar que `push-subscribe` e `push-send` estão deployadas e ativas.

2. **Envio de push de teste real** (ação com efeito visível para um usuário/dispositivo real — **trate como ação que requer confirmação explícita**, igual a uma ação irreversível/visível):
   - Antes de chamar `push-send` com dados reais, use `AskUserQuestion` para confirmar: para qual `user_id`/`store_id`/produto enviar, e que o usuário está com o PWA correspondente instalado e em primeiro plano/background para observar o resultado.
   - Envie um payload mínimo válido (`title`, `body` curto, `tag` de teste, `url` para a tela inicial do produto).
   - Peça ao usuário para relatar: notificação apareceu no banner/lock screen? Toque abriu o app certo na tela certa? Badge do ícone atualizou?
   - Registre o resultado (sucesso/falha + observações) no relatório.

3. Se não houver subscription `ios` ativa disponível para teste, **não invente dados** — relate isso como bloqueio ("nenhum device iOS assinado para testar entrega real") e oriente o passo manual: instalar o PWA correspondente na Tela de Início em um iPhone 16.4+, ativar notificações em Configurações do app, e repetir o passo 2.

---

## Relatório final (formato)

Produza um relatório markdown (não precisa salvar em arquivo, a menos que o usuário peça) com:

1. **Resumo executivo** — 3-5 linhas, situação geral por produto (`erp` / `crmplus`), e se há risco ativo de revogação pelo iOS.
2. **Tabela de achados** por fase (0–6), cada linha: item do checklist, status (`✅ ok` / `⚠️ parcial` / `❌ gap` / `🔴 crítico`), produto(s) afetado(s), arquivo:linha de evidência.
3. **Top riscos priorizados** (3–7 itens), com o porquê e impacto (ex.: "revogação silenciosa", "notificação cruzada entre apps", "deep link abre app errado").
4. **Candidatos de novos fluxos de push** (Fase 7) com a decisão do usuário via `AskUserQuestion` já registrada (incluído/adiado/rejeitado).
5. **Resultado da verificação ponta-a-ponta** (Fase 8), se executada, ou motivo do bloqueio.
6. **Próximos passos sugeridos** — curto, em forma de checklist, sem implementar nada ainda (a menos que o usuário peça explicitamente para já corrigir).

Mantenha o relatório em português (domínio do produto é PT-BR). Não modifique arquivos do app durante esta skill — é uma auditoria. Se o usuário pedir para corrigir os achados, trate como uma tarefa separada (ex.: retomar o PRD `tasks/prd-pwa-push-independente-erp-crmplus-ios.md`).
