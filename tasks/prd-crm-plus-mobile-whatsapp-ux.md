# PRD: Refactor Mobile do CRM Plus com UX tipo WhatsApp

## 1. Introduction / Overview

O CRM Plus já possui uma tela de conversas funcional em `pages/crm/ConversationsPage.tsx`, com lista de conversas, thread, header, mensagens, anexos, áudio, replies, reactions agrupadas, busca e filtros. No mobile, porém, a experiência ainda precisa se comportar como um mensageiro nativo, especialmente WhatsApp: navegação em tela cheia entre lista e conversa, header compacto, área de mensagens com scroll previsível, composer sempre acessível, anexos em fluxo natural e ações por toque com mínimo atrito.

Este PRD define o refactor de UI/UX mobile do CRM Plus para que a operação no celular siga a lógica mental do WhatsApp, preservando a arquitetura e integrações atuais do CRM. O foco é comportamento, ergonomia e consistência visual mobile; não é uma mudança de backend nem uma reescrita completa do módulo.

## 2. Goals

- Tornar a experiência mobile de conversas equivalente à lógica de uso do WhatsApp: lista primeiro, conversa em tela cheia, voltar explícito, composer fixo e mensagens no centro.
- Reduzir atrito para abrir conversa, responder, enviar mídia/áudio e voltar para a lista.
- Garantir que header, timeline e composer respeitem safe areas, teclado virtual e viewports pequenos.
- Manter desktop sem regressões visuais ou funcionais.
- Criar uma base de componentes mobile reutilizáveis para futuras melhorias do CRM Plus.
- Verificar o resultado em browser com viewports mobile reais antes de considerar pronto.

## 3. User Stories

### US-001: Navegação mobile lista -> conversa em tela cheia

**Description:** Como atendente no celular, quero ver primeiro a lista de conversas e, ao tocar em uma conversa, entrar em uma tela de chat em tela cheia para responder sem distrações.

**Acceptance Criteria:**
- [ ] Em viewports mobile, quando `selectedConversationId` for `null`, somente a lista de conversas aparece.
- [ ] Em viewports mobile, quando uma conversa estiver selecionada, somente a thread aparece.
- [ ] O botão de voltar no header limpa `selectedConversationId` e retorna para a lista sem recarregar a página.
- [ ] A conversa selecionada mantém seu estado ao alternar entre mobile e desktop quando possível.
- [ ] Não há coluna lateral vazia, overflow horizontal ou área branca residual em mobile.
- [ ] Typecheck/lint passes.
- [ ] Verify in browser using dev-browser skill.

### US-002: Header mobile compacto no padrão WhatsApp

**Description:** Como atendente, quero um header compacto com botão de voltar, avatar, nome, canal/status e ações essenciais, para reconhecer rapidamente a conversa ativa.

**Acceptance Criteria:**
- [ ] Header mobile é sticky no topo e ocupa altura compacta, sem roubar espaço da timeline.
- [ ] Header mostra botão voltar, avatar, nome truncado em uma linha e subtítulo com telefone/grupo/canal.
- [ ] Status/provedor aparece como badge visual pequeno, sem quebrar linha em telas estreitas.
- [ ] Ações secundárias ficam em menu ou ícones compactos; não comprimem nome e subtítulo.
- [ ] Header respeita `env(safe-area-inset-top)` quando aplicável.
- [ ] Typecheck/lint passes.
- [ ] Verify in browser using dev-browser skill.

### US-003: Timeline mobile com scroll tipo WhatsApp

**Description:** Como atendente, quero que a área de mensagens preserve minha posição quando estou lendo histórico e grude no fim quando estou acompanhando a conversa atual.

**Acceptance Criteria:**
- [ ] Ao abrir uma conversa no mobile, a timeline rola para a última mensagem após o carregamento inicial.
- [ ] Ao receber/enviar mensagem, o scroll vai para o fim somente se o usuário já estiver próximo do fim.
- [ ] Se o usuário estiver lendo mensagens antigas, novas mensagens exibem uma pílula flutuante "Novas mensagens" ou equivalente.
- [ ] Ao tocar na pílula, a timeline rola para o fim e zera o contador.
- [ ] Paginação para mensagens antigas preserva posição visual após prepend.
- [ ] Separadores de data permanecem legíveis e não competem com as bolhas.
- [ ] Typecheck/lint passes.
- [ ] Verify in browser using dev-browser skill.

### US-004: Composer fixo, seguro para teclado virtual

**Description:** Como atendente, quero que o campo de resposta fique sempre acessível no rodapé da conversa, sem ser coberto pelo teclado ou por barras do navegador mobile.

**Acceptance Criteria:**
- [ ] Composer mobile é sticky/fixed no rodapé da thread, dentro da área de chat.
- [ ] Composer respeita `env(safe-area-inset-bottom)`.
- [ ] Ao focar o input/textarea, o teclado virtual não cobre o campo nem o botão enviar.
- [ ] O campo cresce de forma limitada para mensagens longas e depois usa scroll interno.
- [ ] Enter envia apenas quando o comportamento existente permitir; Shift+Enter ou quebra de linha segue o padrão definido no app.
- [ ] Botões de anexo, áudio e envio têm alvo mínimo de toque de 44px.
- [ ] Typecheck/lint passes.
- [ ] Verify in browser using dev-browser skill.

### US-005: Fluxo de anexos e áudio semelhante ao WhatsApp

**Description:** Como atendente, quero anexar imagens, vídeos, documentos e áudios em um fluxo mobile claro, com prévia antes do envio.

**Acceptance Criteria:**
- [ ] Botão de anexo abre opções compatíveis com o fluxo atual de mídia.
- [ ] Prévia de anexos aparece acima do composer e não empurra a timeline de forma imprevisível.
- [ ] O usuário consegue remover cada anexo antes de enviar.
- [ ] Limite de lote respeita `MAX_MEDIA_BATCH_ITEMS` e mensagens de erro continuam usando toast.
- [ ] Gravação de áudio funciona em mobile com estados claros de gravando, cancelar e enviar.
- [ ] Botões de mídia ficam acessíveis por toque e não dependem de hover.
- [ ] Typecheck/lint passes.
- [ ] Verify in browser using dev-browser skill.

### US-006: Ações de mensagem otimizadas para toque

**Description:** Como atendente no celular, quero responder, encaminhar, editar ou excluir mensagens sem depender de hover ou menus difíceis de tocar.

**Acceptance Criteria:**
- [ ] Cada bolha oferece ações por toque em ícone/menu acessível.
- [ ] Não há controles que aparecem apenas em `hover` no mobile.
- [ ] Reply mostra preview acima do composer com nome/remetente, trecho da mensagem e botão X.
- [ ] Tocar em reply dentro da bolha tenta rolar até a mensagem original quando ela estiver carregada.
- [ ] Menus/overlays fecham ao tocar fora ou selecionar uma ação.
- [ ] Typecheck/lint passes.
- [ ] Verify in browser using dev-browser skill.

### US-007: Lista de conversas mobile com triagem rápida

**Description:** Como atendente, quero uma lista de conversas parecida com WhatsApp, com busca, avatar, nome, último texto, horário, unread count e filtros sem ocupar espaço excessivo.

**Acceptance Criteria:**
- [ ] Lista mobile mostra header de inbox, busca e lista em uma única coluna.
- [ ] Cada item mostra avatar, nome, preview da última mensagem, horário e contador de não lidas.
- [ ] Filtros/status ficam em chips horizontais ou drawer compacto, não como bloco vertical longo.
- [ ] Tocar em item abre a conversa imediatamente em tela cheia.
- [ ] Pull-to-refresh pode ser simulado por botão/ícone existente; não é obrigatório implementar gesto nativo.
- [ ] Typecheck/lint passes.
- [ ] Verify in browser using dev-browser skill.

### US-008: Estados vazios, loading e erro coerentes no mobile

**Description:** Como atendente, quero entender rapidamente se não há conversa, se a conversa está carregando ou se ocorreu erro, sem telas quebradas.

**Acceptance Criteria:**
- [ ] Estado sem conversas aparece na lista mobile com mensagem curta e ação relevante quando existir.
- [ ] Estado sem conversa selecionada não aparece no mobile após entrar na thread; mobile sempre mostra lista ou thread.
- [ ] Loading de mensagens não desloca composer/header de forma brusca.
- [ ] Falhas de envio continuam visíveis na bolha ou via toast, com opção de tentativa quando já existir.
- [ ] Typecheck/lint passes.
- [ ] Verify in browser using dev-browser skill.

### US-009: Refactor técnico dos blocos mobile

**Description:** Como desenvolvedor, quero separar blocos mobile em componentes menores para reduzir complexidade de `ConversationsPage.tsx` e facilitar manutenção.

**Acceptance Criteria:**
- [ ] Extrair componentes onde fizer sentido, por exemplo `ConversationMobileHeader`, `ConversationListPanel`, `ConversationThread`, `ConversationComposer` ou nomes equivalentes alinhados ao padrão local.
- [ ] `ConversationsPage.tsx` fica responsável principalmente por estado, queries e composição de alto nível.
- [ ] Não duplicar lógica desktop/mobile quando props e composição resolverem.
- [ ] Componentes recebem callbacks explícitos para seleção, envio, anexos, reply e abertura de mídia.
- [ ] Testes existentes de CRM continuam passando.
- [ ] Typecheck/lint passes.

## 4. Functional Requirements

- **FR-1:** O sistema deve alternar entre `list view` e `thread view` em mobile com base em `selectedConversationId`.
- **FR-2:** O sistema deve manter split view em desktop sem regressão visual.
- **FR-3:** O header mobile da conversa deve ser sticky, compacto e conter voltar, avatar, nome, subtítulo e ações essenciais.
- **FR-4:** O composer mobile deve permanecer acessível no rodapé e respeitar safe area inferior.
- **FR-5:** A timeline deve controlar scroll de forma condicional: auto-scroll apenas quando o usuário estiver próximo do fim.
- **FR-6:** O sistema deve exibir indicador de novas mensagens quando o usuário estiver fora do fim da thread.
- **FR-7:** A lista mobile deve priorizar preview de conversa, horário e unread count.
- **FR-8:** Ações de mensagem no mobile devem funcionar por toque, sem depender de hover.
- **FR-9:** Reply, anexos, áudio, mídia e status de envio devem preservar a lógica atual.
- **FR-10:** A UI deve evitar overflow horizontal em larguras de 320px a 430px.
- **FR-11:** O refactor deve manter compatibilidade com `useMessagesPagination`, `MessageBubble`, `AudioRecorder`, `conversationMediaBatch` e helpers atuais de conversa/grupo.
- **FR-12:** A verificação visual deve cobrir pelo menos iPhone SE/compacto, iPhone padrão e desktop.

## 5. Non-Goals (Out of Scope)

- Não substituir polling por realtime/websocket.
- Não alterar schema do banco de dados.
- Não recriar regras de envio de mensagem, mídia, áudio ou handoff.
- Não implementar criptografia, status online real ou "digitando..." se isso ainda não existir.
- Não criar app nativo; o escopo é frontend web responsivo.
- Não redesenhar todas as páginas do CRM Plus.
- Não copiar pixel a pixel o WhatsApp; a referência é lógica de uso e ergonomia, mantendo identidade visual do iPhone Repasse.

## 6. Design Considerations

- Mobile deve ser tratado como experiência principal para esta tela: lista e conversa são duas telas, não duas colunas comprimidas.
- O visual deve continuar usando tokens/classes existentes do projeto (`crm-*`, Tailwind e Liquid Glass quando já usado), mas com densidade parecida com app mensageiro.
- Header e composer devem ser visualmente leves; a timeline precisa ocupar a maior parte do viewport.
- Bolhas devem preservar diferenciação inbound/outbound e status atual, mas com espaçamento confortável para toque.
- Ícones devem usar `lucide-react`, mantendo consistência com o restante da tela.
- Evitar textos longos dentro de botões no mobile; usar ícones com `aria-label` quando a ação for familiar.
- Filtros mobile devem virar chips horizontais ou painel/drawer compacto, para não empurrar a lista para baixo.

## 7. Technical Considerations

- Arquivo principal alvo: `pages/crm/ConversationsPage.tsx`.
- Componentes diretamente relacionados: `components/crm/MessageBubble.tsx`, `components/crm/AudioRecorder.tsx`, `components/crm/AudioMessage.tsx`.
- Hook relevante: `hooks/useMessagesPagination.ts`.
- Helpers relevantes: `lib/crm/groupReactions.ts`, `lib/crm/conversationGroup.ts`, `pages/crm/conversationMediaBatch.ts`.
- Usar `MOBILE_MEDIA_QUERY = "(max-width: 1023px)"` como base, salvo se houver padrão de breakpoint mais apropriado no projeto.
- Preferir CSS responsivo e composição de componentes a forks extensos de lógica.
- Considerar `visualViewport` apenas se necessário para corrigir teclado virtual em iOS/Android; manter fallback simples.
- Testes recomendados:
  - Unit/component para callbacks críticos quando possível.
  - Browser visual em mobile para navegação, composer, teclado, anexos e scroll.
  - Regressão desktop para garantir split view preservada.

## 8. Success Metrics

- Atendente consegue abrir uma conversa e enviar uma resposta no mobile em até 2 toques após localizar o lead.
- Zero overflow horizontal em viewports entre 320px e 430px.
- Header + composer deixam pelo menos 60% da altura útil para mensagens em iPhone SE ou viewport equivalente.
- Ao receber nova mensagem enquanto lendo histórico, a posição visual não é perdida.
- Testes existentes de CRM continuam passando.
- Validação manual confirma paridade de fluxo com WhatsApp para: abrir conversa, voltar, responder, anexar, gravar áudio e ler novas mensagens.

## 9. Open Questions

- O composer deve enviar com Enter no mobile ou sempre exigir toque no botão enviar?
- Filtros mobile devem ser chips horizontais sempre visíveis ou abrir em bottom sheet?
- Devemos adicionar gesto de swipe para voltar da conversa para a lista, ou manter apenas botão explícito?
- O botão de anexos deve abrir um menu com categorias ou manter o seletor atual direto?
- Existe prioridade para WhatsApp/UAZAPI sobre Instagram no comportamento visual, ou ambos devem compartilhar exatamente a mesma UI?
