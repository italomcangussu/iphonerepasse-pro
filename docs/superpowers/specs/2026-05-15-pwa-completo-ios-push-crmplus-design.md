# PWA Completo iOS/iPadOS e Push CRM Plus Design

## Contexto

O app ja possui uma base PWA relevante: `vite-plugin-pwa` esta instalado e configurado no build, `public/sw.js` e gerado no `dist`, existem manifests para app principal e CRM, e o fluxo de Web Push ja tem cliente, hook, tabela `push_subscriptions` e Edge Functions `push-subscribe` e `push-send`.

O trabalho deve endurecer essa base para que, quando instalado em iPhone ou iPad pela Tela de Inicio, o app se comporte como uma experiencia nativa dentro dos limites reais de PWA no iOS/iPadOS: icone proprio, tela standalone, cache/offline controlado, permissao de notificacao por gesto do usuario, push visivel, clique abrindo o destino correto e controles de configuracao claros.

As verificacoes iniciais em 2026-05-15 mostraram:

- `npm run typecheck`: passou.
- `npm run build`: passou e confirmou `PWA v1.3.0`, com `dist/sw.js`.
- `npm run test:run`: falhou antes de qualquer alteracao com `84 failed | 181 passed | 265 total`.

Essas falhas sao linha de base pre-existente e nao devem ser misturadas com regressao PWA.

## Fontes e Regras Externas

- Apple Developer: Web Push para web apps e browsers.
- WebKit: Web Push para web apps no iOS/iPadOS 16.4+.
- WebKit: Badging API para Home Screen web apps.
- Apple Human Interface Guidelines: padroes de permissao, feedback, navegacao, areas seguras e controles.
- MDN: Push API, Notifications API, Service Workers e `showNotification`.
- Vite PWA: configuracao `injectManifest`.

As regras praticas derivadas dessas fontes sao:

- iOS/iPadOS Web Push exige iOS/iPadOS 16.4 ou superior.
- No iPhone/iPad, push so funciona para web app adicionado a Tela de Inicio e aberto pelo icone instalado.
- A permissao de notificacao deve ser pedida por acao explicita do usuario.
- O service worker deve mostrar notificacao visivel no evento `push`; nao ha push silencioso confiavel no Safari iOS.
- Uma notificacao recebida deve abrir ou focar uma janela e rotear o usuario para um destino util.
- Badging deve usar feature detection e ser tratado como enriquecimento, nao requisito para entrega.

## Objetivos

- Transformar a base atual em um PWA completo e verificavel para iPhone e iPad.
- Manter o plugin PWA instalado e garantido no build.
- Garantir que o app instalado use manifests, icones, splash screens, safe areas, status bar e standalone mode corretamente.
- Fazer Web Push funcionar para o app principal e para o CRM Plus, incluindo notificacoes vindas do CRM Plus/UAZAPI.
- Adicionar configuracoes de notificacao por usuario, topico e contexto, sem prompts invasivos.
- Preservar comportamento existente de PDV, estoque, financeiro, CRM, configuracoes, autenticacao e realtime.
- Rodar TDD para separar erros pre-existentes de regressao gerada pelo trabalho.
- Executar a implementacao com multiplos agentes em tarefas independentes, com integracao e verificacao centralizadas.

## Nao Objetivos

- Criar app nativo iOS ou wrapper hibrido.
- Substituir Supabase, UAZAPI ou o sistema de rotas atual.
- Reescrever o service worker do zero se os ajustes pontuais forem suficientes.
- Redesenhar todas as telas do sistema.
- Prometer recursos que PWAs iOS nao oferecem de forma nativa, como push silencioso ou permissao de notificacao fora do app instalado.

## Arquitetura Proposta

### Build e Instalabilidade

Manter `vite-plugin-pwa` com `injectManifest` e `public/sw.js` como fonte do service worker. O build deve continuar gerando `dist/sw.js`, e a validacao deve verificar explicitamente esse artefato.

Os manifests devem continuar separados por contexto:

- `app.webmanifest`: experiencia principal do iPhoneRepasse Pro.
- `crm.webmanifest`: host dedicado do CRM.
- `crmplus.webmanifest`: rota CRM Plus dentro do app principal.

O runtime branding deve garantir que icones, titulo, `theme-color`, `apple-touch-icon` e manifest reflitam o contexto correto antes da instalacao quando o usuario estiver no CRM Plus.

### Service Worker

O service worker deve manter o modelo atual de cache, mas com testes cobrindo:

- navegacao com fallback offline;
- cache de assets versionados;
- assets de marca;
- fetch GET de Supabase sem cachear mutacoes;
- recebimento de push com `showNotification`;
- clique de notificacao focando janela existente ou abrindo nova URL.

O handler de push deve normalizar payloads vindos de `push-send`, ignorar `silent`, definir `icon` e `badge` seguros e sempre chamar `registration.showNotification()` dentro de `event.waitUntil()`.

### Cliente Push

`services/pushClient.ts` deve continuar sendo a camada unica para:

- detectar suporte com feature detection;
- solicitar permissao;
- criar subscription com `userVisibleOnly: true`;
- converter VAPID public key;
- persistir subscription completa via `push-subscribe`;
- remover subscription no unsubscribe;
- classificar plataforma como `ios`, `android` ou `desktop`.

O hook `usePushNotifications` deve distinguir estados:

- `unsupported`;
- `needs_install`;
- `default`;
- `requesting`;
- `subscribing`;
- `subscribed`;
- `denied`;
- `error`.

### CRM Plus e Origem das Notificacoes

O webhook `crm-uaz-webhook-receiver` ja chama `push-send` para mensagens inbound e novos leads. Esse fluxo deve ser validado e endurecido para:

- enviar `topic: "crm_inbox"` em nova mensagem;
- enviar `topic: "new_lead"` quando uma conversa/lead for criado;
- usar URL canonica do CRM Plus;
- incluir, quando viavel, rota profunda para conversa ou lead;
- manter payload compacto e nao sensivel, pois o texto aparece na tela bloqueada;
- registrar falhas de envio sem bloquear o processamento do webhook.

O clique na notificacao deve abrir o CRM Plus e, quando houver rota profunda estavel, direcionar para a conversa ou lead.

### Configuracoes e UX Apple

A UI deve seguir estes principios:

- Nao pedir permissao automaticamente no primeiro acesso.
- Mostrar valor claro antes do prompt: mensagens CRM, novos leads, vendas ou alertas relevantes.
- No iOS, orientar instalacao pela Tela de Inicio antes de pedir push.
- Mostrar estado atual e acao possivel: instalar, ativar, ativo, desativar, negado, erro.
- Em permissao negada, explicar recuperacao via Ajustes/Safari/Home Screen, sem repetir prompt.
- Usar controles compactos, labels claros, safe-area bottom/top e feedback visual consistente.
- Respeitar dark mode, `prefers-reduced-motion`, areas seguras e alvos de toque confortaveis.

As configuracoes devem permitir escolher topicos por usuario/dispositivo:

- CRM inbox;
- novo lead;
- vendas;
- financeiro;
- garantia ou outros eventos futuros.

### Banco e Edge Functions

A tabela `push_subscriptions` deve continuar representando um dispositivo/browser por endpoint. O trabalho deve revisar:

- RLS e acesso service role;
- unicidade por endpoint;
- armazenamento de `topics`;
- `store_id`;
- limpeza de subscriptions expiradas;
- logs de erro por subscription.

`push-send` deve ser testado contra os principais codigos de resposta:

- sucesso `200`, `201` ou `202`;
- expirado `404` ou `410`, desativando subscription;
- erro `401` ou `403`, apontando problema VAPID/autenticacao;
- erro transiente, registrando falha sem desativar indevidamente.

## Estrategia TDD

Antes de qualquer alteracao de produto, criar uma linha de base:

- Registrar que `typecheck` e `build` estao verdes.
- Registrar a falha atual da suite completa.
- Agrupar falhas pre-existentes por dominio.

Para cada mudanca PWA/push:

1. Escrever teste falhando.
2. Rodar o teste alvo e confirmar falha correta.
3. Implementar o minimo necessario.
4. Rodar o teste alvo e confirmar verde.
5. Rodar verificacoes relacionadas.
6. Fazer commit pequeno.

Testes planejados:

- `services/pwa` registra SW apenas em producao, captura install prompt e aplica update.
- `services/pushClient` converte VAPID, recusa ambiente sem suporte, cria subscription e envia payload correto.
- `hooks/usePushNotifications` retorna `needs_install` no iOS nao standalone e `subscribed` quando ha permissao e subscription.
- `public/sw.js` sempre chama `showNotification` no push e roteia clique.
- `supabase/functions/push-subscribe` valida JWT, upsert e delete.
- `supabase/functions/push-send` filtra por topico/store/user e desativa `404/410`.
- `crm-uaz-webhook-receiver` dispara `crm_inbox` e `new_lead` sem bloquear webhook.
- Componentes de PWA exibem estados Apple-friendly e nao chamam `Notification.requestPermission` fora de gesto do usuario.

## Execucao Multiagente

A implementacao deve usar multiplos agentes quando as tarefas forem independentes. A coordenacao principal fica responsavel por revisar diffs, resolver conflitos, rodar verificacoes finais e preservar a linha de base.

Divisao recomendada:

- Agente 1, linha de base e testes: diagnosticar falhas pre-existentes da suite, separar falhas de infraestrutura de testes das falhas reais e propor correcoes minimas.
- Agente 2, build e instalabilidade PWA: validar `vite-plugin-pwa`, manifests, icones, runtime branding, splash screens e artefatos `dist`.
- Agente 3, cliente PWA/push: cobrir `services/pwa.ts`, `services/pushClient.ts`, `hooks/usePushNotifications.ts` e componentes de permissao.
- Agente 4, service worker: cobrir cache, offline, push visivel, click routing e compatibilidade iOS.
- Agente 5, Supabase/Edge Functions: cobrir `push-subscribe`, `push-send`, migration e tratamento de subscriptions expiradas.
- Agente 6, CRM Plus: cobrir webhook UAZAPI, topicos `crm_inbox` e `new_lead`, URL de destino e payload compacto.
- Agente 7, UI/UX Apple e QA visual: revisar instalacao, permissao, configuracoes, safe areas, estados de erro e textos de ajuda.

Cada agente deve ter escopo de escrita separado. Se duas tarefas precisarem tocar o mesmo arquivo, uma delas deve virar tarefa sequencial, nao paralela.

## Plano de Verificacao

Verificacoes automatizadas:

- `npm run typecheck`
- `npm run build`
- testes unitarios PWA/push/CRM novos;
- testes existentes afetados;
- suite completa quando a linha de base estiver saneada;
- smoke de rotas principais quando credenciais estiverem disponiveis.

Verificacoes de build:

- `dist/sw.js` existe;
- manifests existem em `dist`;
- `app.webmanifest`, `crm.webmanifest` e `crmplus.webmanifest` sao servidos com conteudo valido;
- service worker de producao e registrado em preview/build.

Verificacoes manuais obrigatorias:

- iPhone real ou iPad real com iOS/iPadOS 16.4+;
- instalar pela Tela de Inicio;
- abrir pelo icone instalado;
- ativar push por botao;
- receber push com app aberto, em background e fechado;
- clicar na notificacao e cair no destino esperado;
- negar permissao e ver estado de recuperacao;
- desativar push e confirmar unsubscribe;
- disparar notificacao CRM Plus via webhook/test payload.

## Criterios de Aceite

- Build continua passando e gerando service worker via `vite-plugin-pwa`.
- Typecheck passa.
- Falhas pre-existentes estao documentadas ou corrigidas antes de validar ausencia de regressao.
- App principal e CRM Plus sao instalaveis no iPhone/iPad com manifest correto.
- Em iOS/iPadOS 16.4+, push funciona no PWA instalado e aberto pela Tela de Inicio.
- Service worker sempre exibe notificacao visivel no evento push.
- CRM Plus envia notificacoes para mensagens inbound e novos leads.
- Clique em notificacao abre/foca o app e direciona para o CRM Plus ou destino profundo quando disponivel.
- Usuario consegue ativar, ver estado, desativar e entender permissao negada.
- Android/Chrome e desktop nao sofrem regressao no fluxo de push.

## Riscos e Mitigacoes

- **Falhas pre-existentes na suite mascaram regressao:** criar linha de base, corrigir infraestrutura de testes primeiro e rodar testes alvo a cada tarefa.
- **iOS nao permite push fora do app instalado:** UI deve mostrar `needs_install` antes de pedir permissao.
- **Payload sensivel na tela bloqueada:** manter mensagem compacta, sem dados financeiros ou dados pessoais excessivos.
- **Conflitos entre agentes:** separar arquivos por dominio e revisar diffs antes de integrar.
- **Service worker stale:** manter fluxo de update, `skipWaiting` controlado e banner de atualizacao.
- **Subscriptions expiradas:** desativar `404/410` e permitir resubscribe.

## Proxima Etapa

O plano de implementacao deve comecar pela linha de base TDD e depois dividir tarefas multiagente. A execucao so deve iniciar depois da revisao deste documento e da geracao do plano detalhado em `docs/superpowers/plans`.
