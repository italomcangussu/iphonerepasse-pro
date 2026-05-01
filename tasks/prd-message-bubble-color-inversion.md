# PRD: Inversão de Cores das Bolhas de Mensagem (CRMPlus)

## 1. Introduction/Overview

Hoje as bolhas de mensagens do CRMPlus seguem um padrão "atendente colorido / cliente branco":
mensagens **outbound** (enviadas pelo atendimento ou IA) usam gradiente azul (brand) e mensagens
**inbound** (recebidas do cliente) usam fundo branco.

A solicitação é inverter essa lógica visual para se aproximar do mockup fornecido — onde as
mensagens do cliente aparecem em **azul (cor brand do tema)** e as mensagens enviadas pelo
atendimento aparecem em **branco** (com fallback dark mode em slate-800). A mesma lógica de cor
deve refletir na lista de conversas, através de uma **bolinha indicadora (dot)** ao lado do preview
da última mensagem, sinalizando se a última troca foi inbound (azul) ou outbound (cinza).

A IA mantém sua identidade visual atual (gradiente indigo→brand) para se diferenciar das outras duas categorias.

## 2. Goals

- Inbound (cliente) passa a usar a cor **brand-600** sólida com texto branco
- Outbound humano passa a usar fundo **branco no light** / **slate-800 no dark** com texto escuro/claro
- Outbound IA mantém o gradiente **indigo→brand** atual (distinção visual preservada)
- Lista de conversas ganha um **dot colorido** (azul/cinza) sinalizando a última direção
- Posição das bolhas permanece como hoje (inbound à esquerda, outbound à direita)
- Nenhuma regressão em: ícones de status, campanha Meta, reply preview, badge de reação

## 3. User Stories

### US-001: Inverter paleta das bolhas de mensagem

**Description:** Como atendente, quero ver as mensagens do cliente em azul e as minhas em branco, para diferenciá-las rapidamente seguindo o padrão visual do mockup.

**Acceptance Criteria:**
- [ ] Inbound: fundo `bg-brand-600` (light) e `bg-brand-500` (dark), texto `text-white`
- [ ] Outbound humano: fundo `bg-white` (light) e `bg-slate-800` (dark), texto `text-slate-800` / `text-slate-100`
- [ ] Outbound humano em light mode tem `border border-slate-200` para destacar do fundo claro
- [ ] Outbound IA mantém gradiente atual `from-indigo-600 to-brand-700` com texto branco
- [ ] `rounded-bl-md` permanece em inbound, `rounded-br-md` em outbound (cantos diferenciados)
- [ ] Sombra `shadow-ios26-md` aplicada em inbound; `shadow-sm` em outbound humano; gradient mantém atual em IA
- [ ] Typecheck passa
- [ ] Verificar no browser usando dev-browser skill

### US-002: Ajustar cores secundárias (meta, status, reply preview, reação)

**Description:** Como atendente, quero que ícones de status, reply quote e badges continuem legíveis após a inversão de cores, sem perda de contraste.

**Acceptance Criteria:**
- [ ] `metaTextClass`:
  - inbound passa a usar `text-brand-100` (texto secundário sobre fundo brand)
  - outbound humano passa a usar `text-slate-500` / `dark:text-slate-400`
  - outbound IA mantém `text-white/70` atual
- [ ] `StatusIcon` usa as cores corretas de acordo com o novo background:
  - inbound: clock/check em `text-white/75`, read em `text-sky-100`, failed em `text-amber-100`
  - outbound humano: clock/check em `text-slate-400`/`text-slate-500`, read em `text-brand-500`, failed em `text-red-500`
  - outbound IA: mantém comportamento atual
- [ ] Reply preview strip:
  - inbound: borda esquerda `border-white/60`, fundo `bg-white/10`, texto `text-brand-50`
  - outbound humano: borda `border-brand-400`, fundo `bg-brand-50`, texto `text-slate-600`
  - outbound IA: mantém comportamento atual
- [ ] Badge de reação posicionado e legível em todos os 3 estilos
- [ ] Texto sem `media_url` ("[mensagem sem conteúdo]") permanece visível com `opacity-50`
- [ ] Typecheck passa
- [ ] Verificar no browser usando dev-browser skill

### US-003: Indicador de direção (dot) na lista de conversas

**Description:** Como atendente, quero ver na lista de conversas um indicador colorido sinalizando se a última mensagem foi recebida (cliente) ou enviada (atendimento), facilitando triagem rápida.

**Acceptance Criteria:**
- [ ] Cada item da lista renderiza um `<span>` redondo (`h-2 w-2 rounded-full`) ao lado do preview da última mensagem
- [ ] Cor do dot: `bg-brand-600` quando `lastMessage.direction === 'inbound'`; `bg-slate-300` (light) / `bg-slate-600` (dark) quando `outbound`; oculto quando não há `lastMessage`
- [ ] Dot é posicionado antes do ícone de mídia (`previewKind`) e antes do texto preview
- [ ] Acessibilidade: `aria-label="Última mensagem recebida"` ou `"Última mensagem enviada"`
- [ ] Conversas com `unread_count > 0` continuam exibindo o badge de count separadamente (não substituído pelo dot)
- [ ] Typecheck passa
- [ ] Verificar no browser usando dev-browser skill

### US-004: Validação de regressão visual em mídia, campanha Meta e legacy reactions

**Description:** Como atendente, quero garantir que mensagens com mídia, campanhas Meta e reações órfãs continuem renderizando corretamente após a mudança de cores.

**Acceptance Criteria:**
- [ ] Imagem inbound: borda da preview adapta para `border-white/30` para destacar sobre fundo brand
- [ ] Vídeo inbound: mesma adaptação acima
- [ ] Documento inbound: card interno mantém `bg-white/85` mas com texto `text-slate-700` (mantém legibilidade)
- [ ] Áudio inbound: card mantém `bg-white/80` (light) / `bg-slate-900/70` (dark) para contraste com bolha azul
- [ ] `MetaCampaignCard` permanece visualmente independente (gradient indigo→purple próprio)
- [ ] Linha legacy de reação ("Reação: 👍"):
  - inbound: `bg-white/15 text-white`
  - outbound humano: `bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300`
  - outbound IA: mantém `bg-white/15 text-white`
- [ ] Botão "Baixar" em outbound documento muda de `text-white/80` para `text-slate-600` no humano (mantém branco no IA)
- [ ] Typecheck passa
- [ ] Verificar no browser usando dev-browser skill

## 4. Functional Requirements

- **FR-1:** Em [components/crm/MessageBubble.tsx](components/crm/MessageBubble.tsx), `bubbleClass` deve resolver para 3 estilos distintos: outbound IA (gradient indigo→brand), outbound humano (branco/slate-800 com borda), inbound (brand-600 sólido).
- **FR-2:** `metaTextClass` deve ter 3 ramos correspondentes aos 3 estilos.
- **FR-3:** `StatusIcon` deve aceitar não só `isOutbound` mas também o "tom" do background (ou receber as classes diretamente), retornando ícones com contraste adequado em cada um dos 3 estilos.
- **FR-4:** Reply preview strip deve aplicar 3 esquemas de cor coerentes com os 3 estilos.
- **FR-5:** Em [pages/crm/ConversationsPage.tsx](pages/crm/ConversationsPage.tsx), cada `<button>` da lista de conversas deve renderizar um dot colorido ao lado do preview baseado em `conv.lastMessage?.direction`.
- **FR-6:** Helper `getDirectionDotClass(direction: string | undefined): string` deve ser criado (inline no arquivo ou em `lib/crm/messageUtils.ts`) retornando classes Tailwind apropriadas.
- **FR-7:** Mídia (imagem/vídeo/documento/áudio) embutida em bolha inbound deve ajustar bordas/contrastes para legibilidade sobre fundo brand.

## 5. Non-Goals (Out of Scope)

- Não há mudança de **posição** das bolhas (inbound continua à esquerda, outbound à direita)
- Não criar novo componente — apenas ajustar [components/crm/MessageBubble.tsx](components/crm/MessageBubble.tsx) e [pages/crm/ConversationsPage.tsx](pages/crm/ConversationsPage.tsx)
- Não alterar schema de banco de dados nem comportamento de webhooks
- Não criar novas variantes além das 3 já listadas (inbound, outbound humano, outbound IA)
- Não alterar padding, raio (`rounded-2xl`), ou tipografia das bolhas
- Não tocar em `MetaCampaignCard` (mantém identidade própria independente da bolha)
- Não introduzir tema customizável pelo usuário (cores fixas)

## 6. Design Considerations

- **Paleta brand do projeto** já definida em `tailwind.config` — usar tokens existentes (`bg-brand-600`, `bg-brand-500`, `text-brand-100`, `text-brand-50`, `border-brand-200`, etc.).
- **Dark mode**: outbound humano em dark mode usa `bg-slate-800` com texto `text-slate-100`; inbound mantém `bg-brand-500` para suavizar contraste.
- **Acessibilidade**: contraste mínimo AA — texto branco sobre brand-600 (~5.4:1 OK); texto slate-800 sobre branco (>10:1 OK).
- **Fronteira sutil em outbound branco**: `border border-slate-200` (light) / `border-slate-700` (dark) evita "flutuação" sobre fundos claros.

## 7. Technical Considerations

- O comparador `React.memo` em [components/crm/MessageBubble.tsx:286-295](components/crm/MessageBubble.tsx#L286-L295) **não precisa** de mudança — as cores são derivadas de `direction` e `sender_type`, que já estão estáveis na chave `id`.
- Não há necessidade de migrar dados; trata-se apenas de mudança de classes Tailwind.
- A ausência de dot quando `conv.lastMessage` for null já é tratada pelo render condicional.
- Verificar que `getMessageStatusLabel` continua exibindo cor correta — só muda o ícone, não o texto.

## 8. Success Metrics

- Em revisão visual no navegador, mensagens inbound aparecem em azul brand sólido e outbound humano em branco/slate-800.
- Lista de conversas exibe dot colorido coerente com a direção da última mensagem.
- Nenhum bug visual reportado em mídia, reply preview, status icon ou reaction badge após o deploy.
- `tsc --noEmit` permanece limpo.

## 9. Open Questions

- A escolha de cor para outbound de IA — manter gradient atual ou alinhar com inbound azul (criando 2 estilos em vez de 3)? **Decisão atual:** manter gradient para distinção visual.
- Deve haver indicador visual também para mensagens **outbound de IA** na lista de conversas (ex: ícone Bot pequeno)? **Decisão atual:** fora de escopo, ficaria para PRD futuro.
