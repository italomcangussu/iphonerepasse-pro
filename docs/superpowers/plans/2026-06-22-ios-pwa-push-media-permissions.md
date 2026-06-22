# iOS PWA Push and Media Permissions Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Modernizar o push dos PWAs para o envelope Declarative Web Push e corrigir os fluxos contextuais de notificações, câmera, microfone e seleção de fotos no ERP e CRM Plus.

**Architecture:** `push-send` continuará recebendo o payload interno atual, transformará a notificação em um envelope declarativo antes da criptografia RFC 8291 e deixará o Service Worker interpretar tanto o formato novo quanto o legado. O frontend preservará o componente visual compartilhado de pré-explicação, mas usará ações e textos específicos para permissões persistentes (`notifications`, `microphone`) e seletores pontuais (`camera-capture`, `photo-picker`). O stream adquirido pelo gesto de ativação do microfone será entregue ao gravador, evitando a segunda chamada atual.

**Tech Stack:** React 19, TypeScript, Vite PWA/Service Worker, Vitest + Testing Library, Supabase Cloud Edge Functions em Deno, Web Push/VAPID RFC 8291.

## Global Constraints

- Executar diretamente na branch `main`, conforme autorização explícita do usuário.
- Não criar worktree.
- Não alterar nem incluir em commits o diretório não relacionado `.claude/skills/refatorar-ui/`.
- Manter apenas `sale` no ERP e `crm_inbox`, `new_lead`, `transfer_pending` no CRM Plus como eventos apresentados e produzidos.
- Não criar migration nem alterar RLS/schema de `push_subscriptions`.
- Manter compatibilidade com Web Push tradicional no iOS/iPadOS 16.4+.
- Adicionar Declarative Web Push para Safari/iOS/iPadOS 18.4+.
- Toda solicitação nativa deve decorrer de gesto explícito da pessoa.
- Nunca expor `VAPID_PRIVATE_KEY`, `PUSH_WORKER_SECRET` ou service role no bundle/VPS.
- Aplicar TDD: escrever e executar teste falhando antes de cada alteração de comportamento.

---

## File Map

- `supabase/functions/push-send/index.ts`: normalização, URL absoluta e envelope Declarative Web Push.
- `supabase/functions/push-send/push-send.deno.ts`: contrato do envelope e regressões do envio.
- `public/sw.js`: leitura retrocompatível do envelope declarativo e do payload legado.
- `tests/service-worker/push-sw.test.ts`: exibição, navegação e badge nos dois formatos.
- `lib/pushProduct.ts`: separar catálogo aceito dos tópicos efetivamente oferecidos por padrão.
- `supabase/functions/_shared/push_topics.ts`: espelho server-side dos defaults por produto.
- `services/pushClient.test.ts`, `components/pwa/PushOptIn.test.tsx`: subscriptions e UI por produto.
- `components/pwa/PermissionRequest.tsx`: textos e CTA específicos à capacidade.
- `components/pwa/PermissionRequest.test.tsx`: gesto explícito e copy sem permissão fictícia.
- `components/StockFormModal.tsx` e teste: câmera/fototeca como seletores pontuais.
- `components/crm/AudioRecorder.tsx` e novo teste: receber e encerrar stream pré-adquirido.
- `pages/crm/ConversationsPage.tsx`: adquirir uma vez e entregar o stream ao gravador.
- `pages/crm/SettingsPage.tsx`, `pages/Settings.tsx`: estados honestos e tópicos reais.
- `.env.example`: matriz VPS versus Supabase Cloud.
- `tasks/prd-pwa-push-independente-erp-crmplus-ios.md`: registrar a evolução declarativa.

---

### Task 1: Envelope Declarative Web Push no backend

**Files:**
- Modify: `supabase/functions/push-send/push-send.deno.ts`
- Modify: `supabase/functions/push-send/index.ts`

**Interfaces:**
- Consumes: `SendBody.product` e `SendBody.notification`.
- Produces: `buildDeclarativePushEnvelope(product, notification)` com `web_push: 8030`, `notification.title`, `notification.navigate`, `silent: false`, `lang: "pt-BR"` e `dir: "ltr"`.
- Environment: `APP_BASE_URL` para ERP e `CRM_BASE_URL` para CRM Plus.

- [ ] **Step 1: Escrever testes falhando para URL absoluta e envelope**

Adicionar testes que importam `buildDeclarativePushEnvelope`:

```ts
Deno.test("builds a declarative ERP push envelope with an absolute navigate URL", () => {
  Deno.env.set("APP_BASE_URL", "https://app.iphonerepasse.com.br");
  const envelope = buildDeclarativePushEnvelope("erp", {
    title: "Nova venda",
    body: "Venda concluída",
    url: "/#/finance",
  });

  assertEquals(envelope.web_push, 8030);
  assertEquals(envelope.notification.navigate, "https://app.iphonerepasse.com.br/#/finance");
  assertEquals(envelope.notification.silent, false);
});

Deno.test("preserves an absolute CRM Plus navigate URL", () => {
  const envelope = buildDeclarativePushEnvelope("crmplus", {
    title: "Nova mensagem",
    url: "https://crm.iphonerepasse.com.br/conversations/abc",
  });

  assertEquals(envelope.notification.navigate, "https://crm.iphonerepasse.com.br/conversations/abc");
});
```

- [ ] **Step 2: Executar o teste e confirmar RED**

Run:

```bash
deno test --sloppy-imports --node-modules-dir=auto --allow-read --allow-env --allow-net supabase/functions/push-send/push-send.deno.ts
```

Expected: FAIL porque `buildDeclarativePushEnvelope` ainda não existe.

- [ ] **Step 3: Implementar normalização e envelope mínimo**

Adicionar:

```ts
type DeclarativePushEnvelope = {
  web_push: 8030;
  notification: {
    title: string;
    navigate: string;
    lang: "pt-BR";
    dir: "ltr";
    silent: false;
    body?: string;
    icon?: string;
    badge?: string;
    tag?: string;
    requireInteraction?: boolean;
    app_badge?: string;
  };
};
```

Resolver URLs relativas contra:

```ts
const baseUrl = product === "crmplus"
  ? Deno.env.get("CRM_BASE_URL") || "https://crm.iphonerepasse.com.br"
  : Deno.env.get("APP_BASE_URL") || "https://app.iphonerepasse.com.br";
```

Rejeitar protocolos diferentes de HTTPS em produção e usar `/` como fallback.
Transformar `badgeCount` real em `app_badge: String(count)`; não criar contador.
Serializar o envelope, não o payload plano, em `handlePushSend`.

- [ ] **Step 4: Executar testes Deno e confirmar GREEN**

Run:

```bash
deno test --sloppy-imports --node-modules-dir=auto --allow-read --allow-env --allow-net supabase/functions/push-send/push-send.deno.ts
```

Expected: todos os testes de `push-send` passam.

- [ ] **Step 5: Commit**

```bash
git add supabase/functions/push-send/index.ts supabase/functions/push-send/push-send.deno.ts
git commit -m "feat(push): enviar envelope declarativo"
```

### Task 2: Service Worker retrocompatível

**Files:**
- Modify: `tests/service-worker/push-sw.test.ts`
- Modify: `public/sw.js`

**Interfaces:**
- Consumes: envelope declarativo ou payload plano legado.
- Produces: exatamente uma chamada explícita de substituição a `showNotification` no handler legado, com navegação e badge corretos.

- [ ] **Step 1: Escrever testes falhando para payload declarativo**

Adicionar casos:

```ts
it("renders a declarative push envelope in legacy browsers", async () => {
  // payload.web_push = 8030
  // payload.notification.navigate = absolute CRM URL
  // expects showNotification with data.url and silent:false
});

it("maps declarative app_badge to the Badging API", async () => {
  // app_badge: "4" -> setAppBadge(4)
});
```

Preservar os testes do payload legado e fallback inválido.

- [ ] **Step 2: Executar e confirmar RED**

Run:

```bash
npx vitest run tests/service-worker/push-sw.test.ts
```

Expected: FAIL porque o SW procura `payload.title` e `payload.url` no topo.

- [ ] **Step 3: Implementar adaptador declarativo no SW**

Criar helper puro no arquivo do SW:

```js
function normalizePushPayload(payload) {
  const proposed = payload && payload.web_push === 8030 && payload.notification
    ? payload.notification
    : payload || {};
  return {
    title: proposed.title,
    body: proposed.body,
    url: proposed.navigate || proposed.url,
    badgeCount: proposed.app_badge ?? proposed.badgeCount,
    // demais campos
  };
}
```

Converter `app_badge` para número positivo antes de `setAppBadge`.
Manter `silent: false` e o fallback visível.

- [ ] **Step 4: Executar testes e confirmar GREEN**

Run:

```bash
npx vitest run tests/service-worker/push-sw.test.ts
```

Expected: todos os testes passam.

- [ ] **Step 5: Commit**

```bash
git add public/sw.js tests/service-worker/push-sw.test.ts
git commit -m "feat(pwa): suportar push declarativo no service worker"
```

### Task 3: Tópicos apresentados conforme produtores reais

**Files:**
- Modify: `lib/pushProduct.ts`
- Modify: `supabase/functions/_shared/push_topics.ts`
- Modify: `services/pushClient.test.ts`
- Modify: `components/pwa/PushOptIn.test.tsx`
- Modify: `components/pwa/PushOptIn.tsx`
- Modify: `pages/Settings.tsx`

**Interfaces:**
- Produces: defaults ERP `["sale"]`; defaults CRM Plus `["crm_inbox", "new_lead", "transfer_pending"]`.
- Preserva: catálogo aceito pelo backend para compatibilidade com subscriptions antigas.

- [ ] **Step 1: Escrever testes falhando dos defaults e da UI ERP**

Testar:

```ts
expect(getDefaultPushTopics("erp")).toEqual(["sale"]);
expect(getDefaultPushTopics("crmplus")).toEqual([
  "crm_inbox",
  "new_lead",
  "transfer_pending",
]);
```

No `PushOptIn.test.tsx`, renderizar contexto ERP e confirmar:

```ts
expect(screen.getByText("Vendas")).toBeInTheDocument();
expect(screen.queryByText("Contas a vencer")).not.toBeInTheDocument();
expect(screen.queryByText("Alertas de estoque")).not.toBeInTheDocument();
```

- [ ] **Step 2: Executar e confirmar RED**

Run:

```bash
npx vitest run services/pushClient.test.ts components/pwa/PushOptIn.test.tsx
```

Expected: FAIL porque o ERP usa todo o catálogo como default/opções.

- [ ] **Step 3: Separar catálogo aceito de defaults**

Adicionar em cliente e servidor:

```ts
export const PUSH_DEFAULT_TOPICS = {
  erp: ["sale"],
  crmplus: ["crm_inbox", "new_lead", "transfer_pending"],
} satisfies Record<PushProduct, string[]>;
```

`getDefaultPushTopics`/`getDefaultTopics` usam `PUSH_DEFAULT_TOPICS`.
`findInvalidTopics` continua validando contra `PUSH_TOPIC_CATALOG`.
`PushOptIn` renderiza os defaults do produto atual.
Remover das cópias de Configurações do ERP qualquer promessa de financeiro ou
estoque.

- [ ] **Step 4: Executar e confirmar GREEN**

Run:

```bash
npx vitest run services/pushClient.test.ts components/pwa/PushOptIn.test.tsx hooks/usePushNotifications.test.tsx
```

Expected: todos passam.

- [ ] **Step 5: Commit**

```bash
git add lib/pushProduct.ts supabase/functions/_shared/push_topics.ts services/pushClient.test.ts components/pwa/PushOptIn.test.tsx components/pwa/PushOptIn.tsx pages/Settings.tsx
git commit -m "fix(push): exibir apenas topicos operacionais"
```

### Task 4: Linguagem e ações honestas para câmera e seletor de fotos

**Files:**
- Create: `components/pwa/PermissionRequest.test.tsx`
- Modify: `components/pwa/PermissionRequest.tsx`
- Modify: `components/StockFormModal.test.tsx`
- Modify: `components/StockFormModal.tsx`
- Modify: `pages/crm/ConversationsPage.tsx`
- Modify: `pages/crm/SettingsPage.tsx`
- Modify: `pages/Settings.tsx`

**Interfaces:**
- Produces: `allowLabel` configurável e copy específica para captura/seletor.
- Preserva: `Notification.requestPermission()` somente no clique do CTA.

- [ ] **Step 1: Escrever testes falhando do CTA e da copy**

Testar no `PermissionRequest`:

```tsx
render(
  <PermissionRequest
    permission="photos"
    open
    allowLabel="Escolher fotos e vídeos"
    onAllow={onAllow}
    onDeny={onDeny}
  />,
);
expect(screen.getByText(/somente.*escolher/i)).toBeInTheDocument();
await user.click(screen.getByRole("button", { name: "Escolher fotos e vídeos" }));
expect(onAllow).toHaveBeenCalledOnce();
```

No `StockFormModal.test.tsx`, confirmar que “Abrir câmera” e “Escolher fotos”
só acionam os respectivos inputs depois do CTA explicativo.

- [ ] **Step 2: Executar e confirmar RED**

Run:

```bash
npx vitest run components/pwa/PermissionRequest.test.tsx components/StockFormModal.test.tsx
```

Expected: FAIL porque `allowLabel` não é uma prop e a copy usa “acesso à biblioteca”.

- [ ] **Step 3: Implementar copy e CTA por capacidade**

Alterar `PermissionRequest`:

```ts
interface Props {
  // ...
  allowLabel?: string;
}
```

Usar rótulos:

- notificações: `Continuar`;
- câmera: `Abrir câmera`;
- fotos ERP: `Escolher fotos`;
- mídia CRM: `Escolher fotos e vídeos`;
- microfone: `Ativar microfone`.

Trocar “Acesso à Biblioteca de Fotos” por “Escolher fotos e vídeos” e explicar
que somente itens escolhidos serão compartilhados.
Não apresentar estado persistente de fototeca em Configurações.
Para captura por `<input capture>`, mostrar “Aberta somente quando você escolhe
fotografar”.

- [ ] **Step 4: Executar e confirmar GREEN**

Run:

```bash
npx vitest run components/pwa/PermissionRequest.test.tsx components/StockFormModal.test.tsx
```

Expected: todos passam.

- [ ] **Step 5: Commit**

```bash
git add components/pwa/PermissionRequest.tsx components/pwa/PermissionRequest.test.tsx components/StockFormModal.tsx components/StockFormModal.test.tsx pages/crm/ConversationsPage.tsx pages/crm/SettingsPage.tsx pages/Settings.tsx
git commit -m "fix(ios): alinhar camera e fotos aos seletores nativos"
```

### Task 5: Uma única aquisição de microfone no CRM

**Files:**
- Create: `components/crm/AudioRecorder.test.tsx`
- Modify: `components/crm/AudioRecorder.tsx`
- Modify: `pages/crm/ConversationsPage.tsx`

**Interfaces:**
- `AudioRecorder` recebe `initialStream?: MediaStream`.
- Quando `initialStream` existe, não chama `getUserMedia`.
- O componente sempre encerra tracks no cancelamento, envio, erro e unmount.

- [ ] **Step 1: Escrever testes falhando do stream pré-adquirido**

Criar mock mínimo de `MediaRecorder` e testar:

```tsx
it("uses the provided stream without requesting the microphone again", async () => {
  render(<AudioRecorder initialStream={stream} ... />);
  expect(navigator.mediaDevices.getUserMedia).not.toHaveBeenCalled();
});

it("stops every provided track when cancelled or unmounted", () => {
  const { unmount } = render(<AudioRecorder initialStream={stream} ... />);
  unmount();
  expect(track.stop).toHaveBeenCalled();
});
```

- [ ] **Step 2: Executar e confirmar RED**

Run:

```bash
npx vitest run components/crm/AudioRecorder.test.tsx
```

Expected: FAIL porque a prop não existe e o componente sempre chama
`getUserMedia`.

- [ ] **Step 3: Implementar handoff do stream**

No `ConversationsPage`:

- adicionar `microphoneStream` ao estado;
- `handleMicAllow` chama `getUserMedia` uma vez e armazena o stream;
- se a permissão já estiver concedida, o toque no microfone também adquire o
  stream antes de montar o gravador;
- passar `initialStream={microphoneStream}` ao `AudioRecorder`;
- limpar a referência quando gravação termina/cancela.

No `AudioRecorder`, usar `initialStream ?? await getUserMedia(...)`.
Centralizar encerramento idempotente das tracks.

- [ ] **Step 4: Executar e confirmar GREEN**

Run:

```bash
npx vitest run components/crm/AudioRecorder.test.tsx pages/crm/ConversationsPage.newConversation.test.tsx
```

Expected: todos passam.

- [ ] **Step 5: Commit**

```bash
git add components/crm/AudioRecorder.tsx components/crm/AudioRecorder.test.tsx pages/crm/ConversationsPage.tsx
git commit -m "fix(crm): reutilizar stream do microfone"
```

### Task 6: Lembrete CRM e documentação de ambiente

**Files:**
- Modify: `components/pwa/CRMPwaControls.tsx`
- Modify: `components/pwa/PushPermissionPrompt.tsx`
- Modify: `.env.example`
- Modify: `tasks/prd-pwa-push-independente-erp-crmplus-ios.md`
- Modify: `docs/superpowers/specs/2026-06-22-ios-pwa-push-media-permissions-design.md`

**Interfaces:**
- Produces: dismissal de 14 dias com chave namespaced por produto nos dois PWAs.
- Documents: VPS pública e Supabase Cloud secrets, incluindo `APP_BASE_URL`.

- [ ] **Step 1: Escrever/ajustar teste falhando do dismissal CRM**

Adicionar teste de componente ou contrato que confirme:

```ts
localStorage.setItem("push.permission.prompt.dismissed.at:crmplus", String(Date.now()));
// banner CRM não aparece
```

E que o banner volta para timestamp superior a 14 dias.

- [ ] **Step 2: Executar e confirmar RED**

Run:

```bash
npx vitest run components/pwa
```

Expected: FAIL porque `CRMPwaControls` usa `crm_pwa_banner_dismissed` permanente.

- [ ] **Step 3: Unificar janela e documentar ambiente**

Usar:

```ts
namespacedPushKey("push.permission.prompt.dismissed.at", "crmplus")
```

com `14 * 24 * 60 * 60 * 1000`.

Reorganizar `.env.example` em:

- VPS/frontend público:
  `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`,
  `VITE_VAPID_PUBLIC_KEY`, `VITE_CRM_HOSTNAME`, `VITE_CRM_BASE_URL`;
- Supabase Cloud:
  `VAPID_PRIVATE_KEY`, `VAPID_PUBLIC_KEY`, `VAPID_SUBJECT`,
  `APP_BASE_URL`, `CRM_BASE_URL`, `CRM_HOSTNAME`, `PUSH_WORKER_SECRET`;
- listar as variáveis Supabase automáticas sem pedir configuração manual.

Atualizar o PRD com o estado Declarative Web Push e remover a afirmação antiga
de que a migração ficou para futuro.

- [ ] **Step 4: Executar testes e checagem documental**

Run:

```bash
npx vitest run components/pwa services/pushClient.test.ts hooks/usePushNotifications.test.tsx
git diff --check
```

Expected: testes passam e não há whitespace errors.

- [ ] **Step 5: Commit**

```bash
git add components/pwa/CRMPwaControls.tsx components/pwa/PushPermissionPrompt.tsx .env.example tasks/prd-pwa-push-independente-erp-crmplus-ios.md docs/superpowers/specs/2026-06-22-ios-pwa-push-media-permissions-design.md
git commit -m "docs(pwa): separar ambiente vps e supabase"
```

### Task 7: Verificação integral

**Files:**
- Verify only; corrigir somente regressões causadas por este plano.

**Interfaces:**
- Produces: evidência de testes, lint, typecheck e build.

- [ ] **Step 1: Executar testes focados**

```bash
npx vitest run services/pushClient.test.ts hooks/usePushNotifications.test.tsx components/pwa/PushOptIn.test.tsx components/pwa/PermissionRequest.test.tsx components/StockFormModal.test.tsx components/crm/AudioRecorder.test.tsx tests/service-worker/push-sw.test.ts tests/crm-pwa-production-contract.test.ts
```

Expected: zero falhas.

- [ ] **Step 2: Executar testes Deno de push**

```bash
deno test --sloppy-imports --node-modules-dir=auto --allow-read --allow-env --allow-net supabase/functions/push-send/push-send.deno.ts supabase/functions/push-subscribe/push-subscribe.deno.ts supabase/functions/sales-notify/sales-notify.deno.ts supabase/functions/_shared/crm_push.deno.ts
```

Expected: zero falhas.

- [ ] **Step 3: Executar gates completos**

```bash
npm run typecheck
npm run lint
npm run test:run
npm run test:deno
npm run build
```

Expected: todos retornam exit code 0.

- [ ] **Step 4: Revisar escopo e segurança**

Confirmar:

```bash
git status --short
git diff HEAD~6 -- . ':!.claude/skills/refatorar-ui/'
rg -n "VAPID_PRIVATE_KEY|PUSH_WORKER_SECRET|SUPABASE_SERVICE_ROLE_KEY" --glob '!supabase/functions/**' --glob '!*lock*'
```

Expected:

- nenhuma secret privada no código do frontend;
- nenhum arquivo não relacionado incluído;
- nenhuma migration;
- nenhum produtor de `finance_due` ou `stock_alert`.

- [ ] **Step 5: Commit corretivo final, somente se necessário**

```bash
git add public/sw.js tests/service-worker/push-sw.test.ts \
  supabase/functions/push-send/index.ts supabase/functions/push-send/push-send.deno.ts \
  lib/pushProduct.ts supabase/functions/_shared/push_topics.ts \
  services/pushClient.test.ts components/pwa/PushOptIn.tsx components/pwa/PushOptIn.test.tsx \
  components/pwa/PermissionRequest.tsx components/pwa/PermissionRequest.test.tsx \
  components/StockFormModal.tsx components/StockFormModal.test.tsx \
  components/crm/AudioRecorder.tsx components/crm/AudioRecorder.test.tsx \
  pages/crm/ConversationsPage.tsx pages/crm/SettingsPage.tsx pages/Settings.tsx \
  components/pwa/CRMPwaControls.tsx components/pwa/PushPermissionPrompt.tsx \
  .env.example tasks/prd-pwa-push-independente-erp-crmplus-ios.md \
  docs/superpowers/specs/2026-06-22-ios-pwa-push-media-permissions-design.md
git commit -m "test(pwa): fechar verificacoes de permissoes ios"
```
