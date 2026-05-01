# PRD: Evolução do Frontend do CRMPlus para Experiência Tipo Mensageiro

## 1. Introdução / Visão Geral

O CRMPlus do `iphonerepasse-pro` hoje concentra toda a UI de conversas em um único arquivo monolítico: [pages/crm/ConversationsPage.tsx](pages/crm/ConversationsPage.tsx) (1.643 linhas). A experiência atual já cobre o básico (lista, bolhas, reply e reaction como linhas separadas, mídia, polling), mas está distante da fluidez de um app mensageiro moderno (WhatsApp/Telegram/Instagram Direct):

- Reactions são renderizadas como **mensagens separadas** ("Reação: 👍") ao invés de afetarem visualmente a bolha original.
- Não há detecção estruturada do payload UAZAPI `contextInfo.externalAdReply` para reconhecer leads vindos de **tráfego pago** — a tag "Campanha Meta" do print só aparece porque foi atribuída manualmente.
- Os filtros do lado esquerdo ocupam grande parte da tela (vide print) e não são ocultáveis com persistência.
- Scroll do histórico, paginação para cima e preservação de posição ao receber nova mensagem são frágeis.
- Não há busca server-side em mensagens; busca atual é client-side por nome/telefone.
- Performance degrada em conversas longas (sem virtualização, mas optamos por infinite scroll simples — vide decisão na seção 7).
- Não existe sistema de "views" salvas (ex: "Aguardando atendimento", "Campanhas Meta de hoje").

O projeto-irmão `warrantyguard-hdi` já tem uma arquitetura modular madura para o mesmo CRM:
- [src/components/crm/MessageBubble.tsx](../../warrantyguard-hdi/src/components/crm/MessageBubble.tsx) — 868 linhas, bolha completa com reply inline, reaction inline, swipe-to-reply, menu de ações.
- [src/components/crm/messageUtils.ts](../../warrantyguard-hdi/src/components/crm/messageUtils.ts) — 897 linhas, inclui `resolveMetaCampaignPreviewData()` que destrincha `contextInfo.externalAdReply` e reconhece campanhas Meta/Instagram Ads.
- [src/components/crm/messageTimeline.ts](../../warrantyguard-hdi/src/components/crm/messageTimeline.ts), `MediaBadge`, `MediaViewerModal`, `LeadDetailsDrawer`, `LeadFilters`, `CRMAudioPlayer/Recorder`, `ui/` (CrmButton, CrmCard, CrmEmptyState, CrmTabs, etc.).

**Esta evolução vai trazer paridade visual e funcional com `warrantyguard-hdi`, mais quatro novas capacidades** (detecção de tráfego pago persistida, reactions agrupadas no estilo WhatsApp moderno opcional, filtros como "views" salvas, busca server-side full-text), reaproveitando o máximo possível dos componentes do projeto de referência.

## 2. Goals

- **G1**: Reduzir [ConversationsPage.tsx](pages/crm/ConversationsPage.tsx) de ~1.643 linhas para < 400 linhas, extraindo componentes para `components/crm/` espelhando a arquitetura de `warrantyguard-hdi`.
- **G2**: Reactions deixam de ocupar uma linha própria — afetam visualmente a bolha-alvo (badge flutuante no canto inferior, estilo WhatsApp).
- **G3**: Detecção automática do payload UAZAPI: quando `contextInfo.externalAdReply` indicar tráfego pago, persistir `lead.source` (ex: `meta_ads`, `instagram_ads`, `click_to_whatsapp`) e auto-aplicar tag de campanha — expor filtro **por campanha específica**, não só "Campanhas Meta" genérico.
- **G4**: Filtros laterais ocultáveis via toggle "Ocultar filtros" com estado persistido em `localStorage` e suporte a **views salvas** (ex: usuário cria "Meta hoje não respondidas" e reusa).
- **G5**: Scroll do histórico tipo WhatsApp: chegou ao topo → carrega 50 mensagens antigas; chegou nova mensagem → mantém posição se usuário rolou para cima, gruda no fim se já estava no fim.
- **G6**: Busca server-side full-text em conteúdo de mensagens (não só nome/telefone) com debounce 300ms.
- **G7**: Reply inline na bolha (preview clicável que rola até a mensagem original) e composer com pré-visualização da mensagem sendo respondida (X para cancelar).
- **G8**: Sem regressões funcionais — toda funcionalidade atual (envio de mídia, áudio, status de entrega ✓✓, polling 15s, novo lead, transferir IA) continua funcionando.

## 3. User Stories

### US-001: Extrair `MessageBubble` para componente dedicado
**Description:** Como desenvolvedor, quero `MessageBubble.tsx` em `components/crm/` para que a renderização de mensagens seja testável e reutilizável, espelhando `warrantyguard-hdi`.

**Acceptance Criteria:**
- [ ] Novo arquivo `components/crm/MessageBubble.tsx` exporta um componente que recebe `message`, `replyReference`, `reactionSummary`, `onReply`, `onReact`, `onOpenMedia`, `onEdit`, `onDelete`.
- [ ] [pages/crm/ConversationsPage.tsx](pages/crm/ConversationsPage.tsx) usa `<MessageBubble />` no lugar do JSX inline atual.
- [ ] Status icons (pending/sent/delivered/read/failed) movidos para sub-componente interno `<StatusIcon />`.
- [ ] Visual idêntico ao atual (sem regressão de pixel — comparar lado a lado em conversa real).
- [ ] Typecheck e lint passam.
- [ ] Verificar no browser usando dev-browser skill.

### US-002: Extrair `messageUtils.ts` e `MediaViewerModal`
**Description:** Como desenvolvedor, quero utilitários de mensagem (resolução de mídia, nomes de remetente, preview de mídia) extraídos para `components/crm/messageUtils.ts` e `MediaViewerModal.tsx`.

**Acceptance Criteria:**
- [ ] Funções `getFixedMediaUrl`, `getMediaFileName`, `getParticipantName`, `resolveMessageDataKind` portadas (ou re-implementadas) a partir do `warrantyguard-hdi/src/components/crm/messageUtils.ts`.
- [ ] `MediaViewerModal.tsx` extraído de [ConversationsPage.tsx](pages/crm/ConversationsPage.tsx) (estado `mediaViewer` e JSX correspondentes).
- [ ] Nenhuma regressão na visualização de imagens/vídeos/áudio/documentos.
- [ ] Typecheck e lint passam.

### US-003: Extrair `ConversationsList` (sidebar de conversas) e `LeadFilters`
**Description:** Como desenvolvedor, quero a sidebar de conversas e os chips de filtros em componentes separados.

**Acceptance Criteria:**
- [ ] Novo `components/crm/ConversationsListPanel.tsx` recebe `conversations`, `selectedId`, `onSelect`, `searchTerm`, `filters`.
- [ ] Novo `components/crm/LeadFilters.tsx` (espelha `warrantyguard-hdi`) com chips: Não lidas / IA ativa / Humano / Campanhas Meta / Todos os canais / Sobral 1 / Sobral 2 / Instagram HDI / etc., dinâmicos por canais ativos.
- [ ] Visual idêntico ao print do usuário.
- [ ] Typecheck e lint passam.
- [ ] Verificar no browser usando dev-browser skill.

### US-004: Reactions afetando visualmente a bolha (read-only do recebido)
**Description:** Como atendente, quando o cliente reage a uma mensagem minha pelo WhatsApp, quero ver o emoji + contador no canto inferior direito da bolha original em vez de uma mensagem separada "Reação: 👍".

**Acceptance Criteria:**
- [ ] Novo helper `lib/crm/groupReactions.ts` recebe `messages: MessageRow[]` e retorna `Map<provider_message_id, ReactionSummary>` onde `ReactionSummary = { emoji: string, count: number, fromCustomer: boolean }`.
- [ ] Mensagens cuja `reaction_target_provider_message_id` resolve para uma mensagem visível são **omitidas da timeline** (não viram bolha).
- [ ] `MessageBubble` recebe `reactionSummary` e renderiza badge flutuante `absolute -bottom-2 right-2` com fundo branco/dark, borda fina, e emoji.
- [ ] Reactions órfãs (target não está na conversa carregada) caem para o comportamento legado: bolha "Reação: 👍" (não quebram).
- [ ] Reaction com `reaction_emoji = ''` (remoção de reaction no WhatsApp) → remove o badge da bolha.
- [ ] Verificar no browser usando dev-browser skill.

### US-005: Reply inline na bolha + composer com preview de reply
**Description:** Como atendente, quero que ao clicar em "Responder" numa mensagem, o composer mostre uma faixa com a mensagem citada (X para cancelar), e que a bolha enviada mostre a citação clicável que rola até a original.

**Acceptance Criteria:**
- [ ] Estado `replyingTo: MessageRow | null` controla preview no composer.
- [ ] Botão "Responder" no menu de ações da bolha (3 pontinhos) define `replyingTo`.
- [ ] Preview no composer mostra senderLabel + primeiros 60 chars do conteúdo + ícone X que limpa `replyingTo`.
- [ ] Ao enviar, payload inclui `reply_to_provider_message_id` e `reply_preview_text`.
- [ ] Bolhas com `reply_preview_text` renderizam faixa interna no topo (borda esquerda colorida, texto cinza).
- [ ] Clicar na faixa rola a timeline até a mensagem original (se carregada) e a destaca por 1.5s com `bg-yellow-100/30`.
- [ ] Se a mensagem original não está carregada, scroll-to permanece no-op (sem erro).
- [ ] Verificar no browser usando dev-browser skill.

### US-006: Detecção de tráfego pago + persistência de origem
**Description:** Como gestor, quero que conversas iniciadas por anúncios Meta/Instagram sejam automaticamente identificadas, com a origem persistida e disponível para filtragem por campanha específica.

**Acceptance Criteria:**
- [ ] Helper `lib/crm/detectAdSource.ts` extrai de `provider_payload.contextInfo.externalAdReply`:
  - `source_type` (ex: `ad`)
  - `source_id` (ID da campanha)
  - `source_url`
  - `source_app` (`facebook` / `instagram`)
  - `title`, `body` (headline e descrição do anúncio)
  - `media_url`, `thumbnail`
- [ ] Edge function `crm-uaz-webhook-receiver` (ou novo handler) atualiza, na primeira mensagem inbound de um lead com `externalAdReply`:
  - `crm_leads.source = 'meta_ads' | 'instagram_ads' | 'click_to_whatsapp'`
  - `crm_leads.source_campaign_id = source_id`
  - `crm_leads.source_campaign_title = title`
  - tag automática `Campanha: <title>` aplicada via tabela existente de tags.
- [ ] Migração SQL adiciona colunas `source`, `source_campaign_id`, `source_campaign_title` a `crm_leads` se não existirem (idempotente).
- [ ] Frontend: chip "Campanha: <título>" aparece no header da conversa quando lead.source_campaign_id está presente.
- [ ] Frontend: filtro lateral "Por campanha" lista campanhas distintas dos últimos 30 dias (`SELECT DISTINCT source_campaign_id, source_campaign_title FROM crm_leads WHERE source_campaign_id IS NOT NULL`).
- [ ] Card roxo de pré-visualização do anúncio (já existe no print) continua sendo renderizado a partir do mesmo helper.
- [ ] Backfill SQL (script separado) preenche `source/source_campaign_*` para leads existentes parseando `crm_messages.provider_payload`.
- [ ] Typecheck e lint passam.
- [ ] Verificar no browser usando dev-browser skill.

### US-007: Filtros ocultáveis com persistência
**Description:** Como atendente, quero ocultar a coluna de filtros para ter mais espaço visual e que o estado persista entre sessões.

**Acceptance Criteria:**
- [ ] Botão "Ocultar filtros" / "Exibir filtros" alterna a visibilidade do bloco de chips e do campo "Filtrar por tag".
- [ ] Estado salvo em `localStorage` com key `crmplus.filters.collapsed`.
- [ ] Layout reflui (sidebar de conversas ocupa o espaço liberado).
- [ ] Funciona em mobile (hide/show drawer) e desktop.
- [ ] Verificar no browser usando dev-browser skill.

### US-008: Views salvas (filtros reutilizáveis)
**Description:** Como atendente, quero salvar combinações de filtros como "views" reutilizáveis (ex: "Meta hoje não respondidas") para acessar com 1 clique.

**Acceptance Criteria:**
- [ ] Nova tabela `crm_filter_views` (`id, store_id, user_id, name, filters_json, is_shared, created_at`) — migração SQL idempotente.
- [ ] Botão "Salvar view" abre modal pedindo nome + checkbox "Compartilhar com equipe".
- [ ] Dropdown "Minhas views" lista views do usuário + views compartilhadas, separadas.
- [ ] Selecionar uma view aplica `filters_json` ao estado de filtros atual.
- [ ] Botão "Excluir view" com confirmação (apenas dono da view, ou admin para shared).
- [ ] Typecheck e lint passam.
- [ ] Verificar no browser usando dev-browser skill.

### US-009: Scroll inteligente + paginação infinita para cima
**Description:** Como atendente, quero que o histórico se comporte como WhatsApp — chega no topo carrega mais 50 mensagens, recebo nova mensagem mantém posição se eu rolei para ler histórico.

**Acceptance Criteria:**
- [ ] Hook `useMessagesPagination(conversationId)` retorna `messages, loadingOlder, hasMore, loadMore()`.
- [ ] Carga inicial: últimas 50 mensagens (ordem ascendente após reverse).
- [ ] `IntersectionObserver` em sentinel no topo dispara `loadMore()` que faz `SELECT ... created_at < oldest_loaded.created_at LIMIT 50`.
- [ ] Após loadMore, `scrollTop` é ajustado para preservar a posição visual (medir altura antes/depois e somar diff).
- [ ] Hook `useStickyScrollBottom`: se usuário está nos últimos 80px ao receber nova msg, gruda no fim; senão, mostra pílula "↓ N novas mensagens".
- [ ] Pílula clicável rola para o fim e zera o contador.
- [ ] Trocar de conversa reseta scroll para o fim e cancela observers.
- [ ] Verificar no browser usando dev-browser skill (testar com conversa de >100 msgs).

### US-010: Busca server-side full-text em mensagens
**Description:** Como atendente, quero buscar por trechos de mensagens (não só nome/telefone) com resultados rápidos.

**Acceptance Criteria:**
- [ ] Migração SQL: índice `tsvector` em `crm_messages.content` (português) + função RPC `search_crm_messages(p_store_id, p_query, p_limit)` que retorna `conversation_id, message_id, snippet, rank`.
- [ ] Campo de busca atual aceita 2 modos: "Leads" (default, atual) e "Mensagens" (tab/toggle).
- [ ] No modo "Mensagens", debounce 300ms, query mínima de 3 caracteres, lista resultados com snippet + nome do lead + data.
- [ ] Clicar no resultado abre a conversa e rola até a mensagem (carregando histórico se necessário).
- [ ] Estados: digitando / sem resultados / N resultados / erro.
- [ ] Typecheck e lint passam.
- [ ] Verificar no browser usando dev-browser skill.

### US-011: Performance — memoização e evitar re-render de toda a timeline
**Description:** Como atendente, quero que a UI continue fluida mesmo com 500+ mensagens carregadas.

**Acceptance Criteria:**
- [ ] `MessageBubble` envolto em `React.memo` com comparador customizado (compara `message.id`, `status`, `reactionSummary`, `replyReference`).
- [ ] `useMemo` para `groupedMessages` (timeline com separadores de data).
- [ ] Polling 15s não causa re-render da bolha se nada mudou (verificável no React DevTools Profiler).
- [ ] Render de timeline com 500 mensagens < 16ms (medido em Profiler em conversa real).
- [ ] Sem regressões: status icons, reactions e replies continuam atualizando em tempo real.

### US-012: Limpeza final — remover dead code e simplificar `ConversationsPage.tsx`
**Description:** Como desenvolvedor, quero o `ConversationsPage.tsx` enxuto após as extrações.

**Acceptance Criteria:**
- [ ] [pages/crm/ConversationsPage.tsx](pages/crm/ConversationsPage.tsx) tem < 400 linhas.
- [ ] Imports não usados removidos.
- [ ] Estados locais que viraram props/contextos removidos.
- [ ] Testes existentes ([ConversationsPage.newConversation.test.tsx](pages/crm/ConversationsPage.newConversation.test.tsx)) continuam passando.
- [ ] Adicionar `MessageBubble.test.tsx` com snapshots dos 4 estados (texto, com reply, com reaction, com mídia).

## 4. Functional Requirements

- **FR-1**: O sistema deve omitir da timeline mensagens cuja `reaction_target_provider_message_id` aponta para uma mensagem visível, e renderizar o emoji como badge sobre a bolha-alvo.
- **FR-2**: O sistema deve detectar `contextInfo.externalAdReply` no payload UAZAPI e persistir `crm_leads.source`, `source_campaign_id`, `source_campaign_title` automaticamente na primeira mensagem inbound.
- **FR-3**: O sistema deve aplicar tag automática `Campanha: <title>` ao lead quando `source_campaign_title` for definido.
- **FR-4**: O sistema deve renderizar card roxo do anúncio (já existente) usando os mesmos campos persistidos.
- **FR-5**: O sistema deve permitir filtrar conversas por campanha específica (`source_campaign_id`).
- **FR-6**: O sistema deve persistir o estado collapsed/expanded da coluna de filtros em `localStorage`.
- **FR-7**: O sistema deve permitir salvar/listar/aplicar/excluir "views" via tabela `crm_filter_views`.
- **FR-8**: O sistema deve carregar 50 mensagens por página, paginando para cima ao chegar no topo, preservando posição visual de scroll.
- **FR-9**: O sistema deve grudar o scroll no fim ao receber nova mensagem **somente** se o usuário já estava nos últimos 80px; caso contrário, exibir pílula "↓ N novas mensagens".
- **FR-10**: O sistema deve oferecer busca server-side full-text em `crm_messages.content` via RPC com tsvector PT-BR.
- **FR-11**: O sistema deve permitir reply inline: composer mostra preview da mensagem citada com X para cancelar; bolha enviada mostra faixa clicável que rola até a original.
- **FR-12**: O sistema deve memoizar `MessageBubble` (React.memo) para que polling não cause re-render quando nada mudou.
- **FR-13**: O sistema deve manter retrocompatibilidade visual com bolhas órfãs de reaction (target não carregado) renderizando a linha "Reação: 👍" como hoje.
- **FR-14**: O sistema deve usar como referência arquitetural os componentes de [warrantyguard-hdi/src/components/crm/](../../warrantyguard-hdi/src/components/crm/) (`MessageBubble`, `messageUtils`, `MediaViewerModal`, `LeadFilters`, `MediaBadge`, `CRMAudioPlayer`), portando ou re-implementando, **não** copiando-os via dependência.

## 5. Non-Goals (Out of Scope)

- **Virtualização de lista** (react-window, virtua, etc.) — usuário escolheu infinite scroll simples (opção 2A). Pode entrar em iteração futura se conversas com >2k mensagens forem comuns.
- **Atendente reagir/enviar reaction ao cliente** — usuário escolheu read-only (opção 3A). Reactions outbound continuam apenas exibindo a linha legada.
- **Reactions múltiplas agrupadas por emoji** (estilo WhatsApp moderno com vários reactors) — fora de escopo. Apenas 1 reaction do cliente + 1 do agente conforme schema atual.
- **Notificações push** ou som de nova mensagem — não solicitado.
- **WebSocket / Realtime Supabase** para substituir polling 15s — fora de escopo. Polling permanece.
- **Edição/exclusão de mensagens** — apenas portar comportamento existente (`onEditMessage`, `onDeleteMessage` do `MessageBubble` de referência), não criar novo fluxo.
- **Refatorar páginas vizinhas** ([CRMLeads.tsx](pages/CRMLeads.tsx), [CRMChannels.tsx](pages/CRMChannels.tsx)) — fora de escopo.
- **Migrar para servidor de busca dedicado** (Meilisearch, Typesense) — usar `tsvector` Postgres é suficiente.
- **Mudanças no schema de `crm_message_reactions`** se já existir tabela dedicada — verificar e usar o que existe.
- **Mobile-first redesign** — manter responsividade atual (drawer em mobile, 2 colunas em desktop).

## 6. Design Considerations

- **Visual**: manter design system atual ([components/ui/](components/ui/)). Para badges de reaction usar mesmas cores do print (verde primário do projeto).
- **Bolha de reaction**: `absolute bottom-[-8px] right-3 bg-white dark:bg-slate-800 rounded-full px-1.5 py-0.5 text-xs shadow-sm border border-slate-200 dark:border-slate-700`.
- **Faixa de reply**: borda esquerda 3px na cor do remetente, fundo `bg-slate-100/60 dark:bg-slate-700/40`, padding 8px.
- **Card de campanha (roxo)**: já existe no design — apenas reutilizar; passar a popular a partir de `lead.source_campaign_*` quando disponível em vez de fazer parsing toda vez.
- **Pílula "↓ N novas mensagens"**: posicionar `absolute bottom-20 left-1/2 -translate-x-1/2`, `bg-emerald-600 text-white rounded-full px-4 py-1.5 shadow-lg`.
- **Componentes a reaproveitar do warrantyguard-hdi** (portar):
  - [MessageBubble.tsx](../../warrantyguard-hdi/src/components/crm/MessageBubble.tsx)
  - [messageUtils.ts](../../warrantyguard-hdi/src/components/crm/messageUtils.ts) (funções de parsing de payload — incluindo `resolveMetaCampaignPreviewData`)
  - [MediaBadge.tsx](../../warrantyguard-hdi/src/components/crm/MediaBadge.tsx)
  - [MediaViewerModal.tsx](../../warrantyguard-hdi/src/components/crm/MediaViewerModal.tsx)
  - [LeadFilters.tsx](../../warrantyguard-hdi/src/components/crm/LeadFilters.tsx)
  - [CRMAudioPlayer.tsx](../../warrantyguard-hdi/src/components/crm/CRMAudioPlayer.tsx) e `CRMAudioRecorder.tsx`
  - `ui/` primitives (`CrmButton`, `CrmCard`, `CrmEmptyState`, `CrmTabs`)
- **Não importar diretamente** do outro projeto — copiar/adaptar para `iphonerepasse-pro/components/crm/` mantendo independência.

## 7. Technical Considerations

- **Stack**: React + TypeScript + Tailwind + Supabase (já em uso). Sem novas dependências exceto se virtualização entrar (não entra agora).
- **Edge functions**: alterações no handler de webhook UAZAPI ([supabase/functions/crm-uaz-webhook-receiver/](supabase/functions/) ou equivalente) para popular `source/source_campaign_*` na primeira mensagem inbound.
- **Migrações SQL**:
  - `ALTER TABLE crm_leads ADD COLUMN IF NOT EXISTS source TEXT, source_campaign_id TEXT, source_campaign_title TEXT;`
  - `CREATE TABLE IF NOT EXISTS crm_filter_views (...)` com RLS por `store_id` e `user_id`.
  - `CREATE INDEX IF NOT EXISTS crm_messages_content_tsvector_idx ON crm_messages USING gin(to_tsvector('portuguese', content));`
  - Função RPC `search_crm_messages(p_store_id uuid, p_query text, p_limit int)` retorna `(conversation_id, message_id, snippet, rank)`.
- **Backfill**: script SQL idempotente que parseia `crm_messages.provider_payload->'contextInfo'->'externalAdReply'` para popular `source/source_campaign_*` em leads existentes.
- **Polling vs Realtime**: manter polling 15s. A pílula "↓ N novas" só aparece quando o polling traz mensagens novas após a última posição vista pelo usuário.
- **Estado de scroll**: usar `useRef<HTMLDivElement>` no container, medir `scrollHeight` antes/depois de prepend para preservar offset visual.
- **Detecção robusta de `externalAdReply`**: parsing deve aceitar tanto camelCase (`externalAdReply.sourceID`) quanto snake_case (`external_ad_reply.source_id`) — o helper `readAliasValue` de `warrantyguard-hdi` resolve isso.
- **Testes**:
  - Manter [ConversationsPage.newConversation.test.tsx](pages/crm/ConversationsPage.newConversation.test.tsx).
  - Adicionar `MessageBubble.test.tsx` (snapshots: texto, reply, reaction, mídia).
  - Adicionar `groupReactions.test.ts` (unit).
  - Adicionar `detectAdSource.test.ts` (unit, com fixtures de payloads UAZAPI reais).

## 8. Success Metrics

- **M1**: [ConversationsPage.tsx](pages/crm/ConversationsPage.tsx) reduzido de 1.643 → ≤ 400 linhas.
- **M2**: 100% das reactions vindas com `reaction_target_provider_message_id` resolvível são renderizadas como badge na bolha original (zero linhas "Reação: 👍" para reactions com target carregado).
- **M3**: 100% das conversas iniciadas via Meta/Instagram Ads (com `externalAdReply` no payload) têm `lead.source` populado automaticamente nas primeiras 24h após deploy.
- **M4**: Tempo médio de render da timeline com 500 mensagens < 16ms (medido com React Profiler).
- **M5**: Busca server-side em mensagens retorna < 300ms p95 em store com 100k mensagens.
- **M6**: Após 30 dias, ≥ 50% dos atendentes ativos criaram pelo menos 1 view salva (indicador de adoção).
- **M7**: Zero regressões reportadas nas funcionalidades existentes (mídia, áudio, status, polling, novo lead, transferir IA).

## 9. Open Questions

- **Q1**: Existe tabela dedicada `crm_message_reactions` ou as reactions estão sendo armazenadas como linhas em `crm_messages` com `reaction_target_provider_message_id`? **Verificar antes de US-004** — se houver tabela dedicada, `groupReactions` consulta essa fonte, não filtra `messages`.
- **Q2**: O webhook UAZAPI atual já guarda `provider_payload` completo em `crm_messages` (necessário para parsing de `externalAdReply`)? Se não, é pré-requisito para US-006.
- **Q3**: Tags automáticas no formato `Campanha: <title>` podem colidir com tag manual existente "Campanha Meta"? Decisão: prefixar com "auto:" ou usar campo separado `lead.source_campaign_title` apenas, sem virar tag? **Sugestão padrão**: persistir em `source_campaign_*` e exibir como chip no header **sem** virar tag manual, evitando poluir a tabela de tags.
- **Q4**: Views salvas devem suportar compartilhamento por equipe inteira ou apenas por loja (`store_id`)? Default proposto: por `store_id` (todos da loja podem usar se `is_shared=true`).
- **Q5**: O backfill de `source/source_campaign_*` deve ser executado uma vez via script manual ou agendado em job recorrente? Default proposto: script único + edge function passa a popular dali em diante.
- **Q6**: Mobile (drawer): "Ocultar filtros" ainda faz sentido ou é redundante com o próprio fechamento do drawer? Default proposto: em mobile, o toggle vira "Aplicar" + auto-fechar drawer.
