# PRD: Realtime Completo — PDV, Financeiro, Estoque e CRM Mensagens

## Introduction

O sistema atualmente tem realtime em apenas 5 tabelas (`sales`, `stock_items`, `transactions`, `debts`, `debt_payments`). Todos os outros dados — clientes, vendedores, lojas, custos, peças, dívidas a pagar, categorias financeiras — só atualizam com refresh manual, causando dados obsoletos em cenários multi-usuário. O CRM (conversas e mensagens) não tem nenhum realtime.

Este PRD cobre a implementação de realtime completo nos quatro módulos principais, com notificações visuais (toasts + badge de não-lidas no CRM).

**Nota:** As respostas 2A (CRM mensagens = alta prioridade) e 5C (ignorar outros sub-módulos do CRM) foram combinadas: conversas e mensagens do CRM recebem realtime, mas leads, funis, estatísticas, anúncios e comentários ficam fora do escopo.

---

## Goals

- Eliminar dados obsoletos em cenários multi-usuário em PDV, Financeiro e Estoque
- Fazer o módulo de conversas do CRM funcionar em tempo real (mensagem nova aparece automaticamente, como WhatsApp)
- Cobrir todos os usuários (não apenas admins) nas tabelas relevantes
- Adicionar feedback visual com toasts para eventos críticos e badge de não-lidas no menu do CRM
- Não ultrapassar os limites de canais Supabase nem gerar memory leaks

---

## User Stories

### US-001: Clientes e Vendedores sincronizados em tempo real
**Description:** As a vendedor, I want to see newly created customers and sellers immediately so that I don't need to reload the page during a sale.

**Acceptance Criteria:**
- [ ] `customers` table subscribes to INSERT/UPDATE/DELETE no canal `'data-realtime'` em `dataContext.tsx`
- [ ] `sellers` table subscribes to INSERT/UPDATE/DELETE no mesmo canal
- [ ] Em INSERT/UPDATE: buscar o registro completo e atualizar o estado (mesmo padrão de `sales` e `stock_items`)
- [ ] Em DELETE: remover o item do estado pelo `id`
- [ ] Todos os usuários autenticados recebem as atualizações (sem filtro de role)
- [ ] Typecheck passes

### US-002: Lojas sincronizadas em tempo real
**Description:** As a user, I want store changes to appear without reload so that I always see current store configurations.

**Acceptance Criteria:**
- [ ] `stores` table subscribes to INSERT/UPDATE/DELETE no canal `'data-realtime'` em `dataContext.tsx`
- [ ] Em INSERT/UPDATE: buscar o registro completo e atualizar o estado
- [ ] Em DELETE: remover do estado pelo `id`
- [ ] Todos os usuários recebem as atualizações
- [ ] Typecheck passes

### US-003: Financeiro — payable_debts e pagamentos em tempo real
**Description:** As an admin, I want payable debts and their payments to update in real time so that the financial view is always current without manual refresh.

**Acceptance Criteria:**
- [ ] `payable_debts` table subscribes to INSERT/UPDATE/DELETE no canal `'data-realtime'` (admin-only, mesmo padrão de `transactions`)
- [ ] `payable_debt_payments` table subscribes a INSERT/UPDATE/DELETE (admin-only)
- [ ] `creditors` table subscribes a INSERT/UPDATE/DELETE (admin-only)
- [ ] Em INSERT/UPDATE: buscar o registro completo e atualizar o estado
- [ ] `PayableDebts.tsx` e `Finance.tsx` refletem mudanças sem reload
- [ ] Typecheck passes

### US-004: Categorias financeiras sincronizadas
**Description:** As an admin, I want finance categories to appear across all open tabs immediately after creation.

**Acceptance Criteria:**
- [ ] `finance_categories` table subscribes a INSERT/UPDATE/DELETE no canal `'data-realtime'` (admin-only)
- [ ] Novas categorias aparecem nos dropdowns de `Finance.tsx` sem reload
- [ ] Typecheck passes

### US-005: Estoque — custos em tempo real
**Description:** As a user, I want stock item costs to sync automatically so that prices are always up to date across tabs.

**Acceptance Criteria:**
- [ ] `costs` table subscribes a INSERT/UPDATE/DELETE no canal `'data-realtime'` (todos os usuários)
- [ ] Em INSERT/UPDATE: encontrar o `stock_item` pai pelo campo `item_id` e atualizar seu array `costs` no estado
- [ ] Em DELETE: remover o custo do array `costs` do item pai
- [ ] Typecheck passes

### US-006: Estoque — peças e catálogo de dispositivos em tempo real
**Description:** As a user adding stock or a sale, I want new device models and parts to appear immediately so that dropdowns are always current.

**Acceptance Criteria:**
- [ ] `parts_inventory` table subscribes a INSERT/UPDATE/DELETE no canal `'data-realtime'` (todos os usuários)
- [ ] `device_catalog` table subscribes a INSERT/UPDATE/DELETE no canal `'data-realtime'` (todos os usuários)
- [ ] Novos dispositivos aparecem nos selects de `PDV.tsx` e `StockFormModal.tsx` sem reload
- [ ] Typecheck passes

### US-007: CRM — novas mensagens aparecem em tempo real na conversa aberta
**Description:** As a CRM user, I want new incoming messages to appear automatically in the open conversation so that I don't miss messages or need to reload.

**Acceptance Criteria:**
- [ ] `ConversationsPage.tsx` (ou hook `useCRMRealtime`) cria um canal Supabase `'crm-realtime'`
- [ ] O canal subscribes a `crm_messages` INSERT filtrado pelo `conversation_id` da conversa ativa
- [ ] Em INSERT: a mensagem nova é adicionada ao final da lista de mensagens sem reload
- [ ] Quando o usuário troca de conversa, a subscription é atualizada para o novo `conversation_id`
- [ ] A subscription é destruída (`unsubscribe()`) quando o componente desmonta
- [ ] Typecheck passes
- [ ] Verify in browser using dev-browser skill

### US-008: CRM — lista de conversas atualiza em tempo real
**Description:** As a CRM user, I want the conversation list to refresh when new messages arrive so that I always see the latest activity without manual reload.

**Acceptance Criteria:**
- [ ] O canal `'crm-realtime'` também subscribes a `crm_conversations` INSERT/UPDATE
- [ ] Em INSERT: nova conversa aparece no topo da lista
- [ ] Em UPDATE (ex.: `last_message_at` muda): a conversa sobe para o topo e o preview atualiza
- [ ] Indicador de não-lida atualiza automaticamente
- [ ] Typecheck passes
- [ ] Verify in browser using dev-browser skill

### US-009: Badge de não-lidas no menu do CRM
**Description:** As a user anywhere in the app, I want to see an unread message count badge on the CRM menu item so that I know when there are pending conversations.

**Acceptance Criteria:**
- [ ] O item do menu do CRM no sidebar exibe um badge vermelho com o total de conversas não-lidas
- [ ] A contagem é derivada de `crm_conversations` onde existe mensagem não-lida (campo `unread_count > 0` ou equivalente — verificar schema antes de implementar)
- [ ] O badge atualiza em tempo real quando chegam novas mensagens
- [ ] Badge desaparece quando a contagem é 0
- [ ] Badge mostra `99+` quando a contagem ultrapassa 99
- [ ] Typecheck passes
- [ ] Verify in browser using dev-browser skill

### US-010: Toast para nova mensagem CRM (usuário fora da página de conversas)
**Description:** As a user navigating other parts of the app, I want a toast notification when a new CRM message arrives so that I can respond promptly.

**Acceptance Criteria:**
- [ ] Quando um evento INSERT em `crm_messages` dispara e o usuário NÃO está na rota do CRM, exibir um toast
- [ ] Toast exibe: nome/número do remetente + preview da mensagem (truncado em 60 chars)
- [ ] Clicar no toast navega para a conversa correspondente
- [ ] Toast se auto-fecha após 5 segundos
- [ ] NÃO exibir toast quando o usuário já está na página de conversas
- [ ] Typecheck passes
- [ ] Verify in browser using dev-browser skill

### US-011: Toast para nova venda por outro usuário
**Description:** As a manager, I want a subtle toast when a sale is recorded by another user so that I'm aware of team activity in real time.

**Acceptance Criteria:**
- [ ] Quando o evento INSERT em `sales` dispara e o usuário que criou a venda NÃO é o usuário atual, exibir um toast
- [ ] Toast exibe: `"Nova venda: [modelo do aparelho] — R$ [valor total]"`
- [ ] Toast se auto-fecha após 4 segundos
- [ ] NÃO disparar toast para o próprio usuário que criou a venda
- [ ] Typecheck passes
- [ ] Verify in browser using dev-browser skill

### US-012: Canal realtime único sem memory leak
**Description:** As a developer, I want all DataContext subscriptions in a single Supabase channel and CRM in its own isolated channel so that we don't leak connections or hit channel limits.

**Acceptance Criteria:**
- [ ] Todas as novas subscriptions de tabela (US-001 a US-006) são adicionadas ao canal existente `'data-realtime'` em `dataContext.tsx`
- [ ] CRM realtime usa canal separado `'crm-realtime'` isolado em `ConversationsPage.tsx` (ou hook dedicado)
- [ ] Nenhum canal duplicado é criado em re-renders (cleanup em `useEffect` retorna `channel.unsubscribe()`)
- [ ] Console não exibe warnings de "channel already exists"
- [ ] Typecheck passes

---

## Functional Requirements

- **FR-1:** `customers`, `sellers`, `stores` devem subscribes a INSERT/UPDATE/DELETE no canal `'data-realtime'` para todos os usuários autenticados
- **FR-2:** `payable_debts`, `payable_debt_payments`, `creditors`, `finance_categories` devem subscribes a INSERT/UPDATE/DELETE no canal `'data-realtime'` com filtro de role admin (mesmo padrão de `transactions` existente)
- **FR-3:** `costs` deve subscribes a INSERT/UPDATE/DELETE para todos os usuários; em mudança, atualizar o array `costs` do `stock_item` correspondente no estado do DataContext
- **FR-4:** `parts_inventory` e `device_catalog` devem subscribes a INSERT/UPDATE/DELETE para todos os usuários
- **FR-5:** `ConversationsPage.tsx` deve manter um canal `'crm-realtime'` subscrito a `crm_messages` (filtrado por `conversation_id` ativo) e a `crm_conversations` (sem filtro)
- **FR-6:** A subscription de `crm_messages` deve ser reestabelecida sempre que o `conversation_id` ativo mudar
- **FR-7:** Verificar se o projeto já usa `sonner` ou `react-hot-toast`; se sim, reusar; se não, adicionar `sonner` (compatível com Vite, bundle mínimo)
- **FR-8:** Toast de nova mensagem CRM dispara apenas quando `window.location.pathname` NÃO contém a rota de conversas do CRM
- **FR-9:** Toast de nova venda dispara apenas quando o `user_id` do evento difere do usuário autenticado atual
- **FR-10:** O badge de não-lidas do CRM no sidebar deve ser alimentado por um contador derivado do estado de `crm_conversations` — verificar schema antes de implementar (campo `unread_count`, `last_read_at`, ou similar)
- **FR-11:** Todas as subscriptions devem retornar `channel.unsubscribe()` no cleanup do `useEffect`

---

## Non-Goals

- CRM Leads, Funis, Estatísticas, Anúncios, Comentários — sem realtime nesta fase
- `business_profile`, `card_fee_settings`, `payment_methods` — sem realtime (mudam raramente, não são críticos)
- Push notifications (browser/PWA) — fora de escopo
- Indicadores de presença ("usuário X está digitando") — fora de escopo
- Optimistic UI — eventos realtime trigam re-fetch ou patch de estado, não mutação otimista

---

## Technical Considerations

- **Padrão existente:** `dataContext.tsx` linha ~420 define o canal `'data-realtime'`. Seguir o mesmo padrão de `supabase.channel('data-realtime').on('postgres_changes', { event: '*', schema: 'public', table: 'X' }, handler)` para todas as novas tabelas
- **Supabase channel limits:** Um único canal pode ter múltiplos listeners de tabela — não criar canais separados por tabela no DataContext
- **costs aninhados:** O estado atual armazena `costs` dentro de cada `stock_item`. Ao receber um evento de `costs`, fazer lookup por `item_id` no array `stockItems` do contexto e fazer patch local sem refetch completo
- **CRM channel:** Deve viver fora do DataContext (escopo de ConversationsPage) para não assinar `crm_messages` quando o usuário não está no CRM
- **Toast:** Verificar primeiro se `sonner` já está em `package.json`; se não, `npm install sonner`
- **Badge unread:** Inspecionar schema de `crm_conversations` para o campo correto antes de implementar — pode ser `unread_count`, `unread_messages_count`, ou derivado de join com `crm_messages`
- **Role check:** Usar o `role` já disponível no DataContext (`useData().role`) para os filtros admin

---

## Design Considerations

- Toasts posicionados no canto inferior-direito, não intrusivos, máximo 3 visíveis simultaneamente
- Badge do CRM: bolinha vermelha com número sobre o ícone no sidebar, seguindo o estilo visual existente do app
- Atualizações de dados chegam silenciosamente (sem loading states ou skeleton), patchando o estado existente

---

## Success Metrics

- Zero necessidade de refresh manual em sessões multi-usuário após a implementação
- Mensagens CRM aparecem em menos de 1 segundo após chegada (latência Supabase Realtime)
- Sem memory leaks — contagem de canais estável ao navegar pelo app (verificável no Supabase Dashboard > Realtime)
- TypeScript sem novos erros após a implementação

---

## Open Questions

1. `crm_conversations` tem campo `unread_count` ou similar? Inspecionar schema antes de US-009
2. O projeto já usa `sonner` ou `react-hot-toast`? Verificar `package.json` antes de US-010/US-011
3. O toast de nova venda (US-011) deve ser mostrado a todos os usuários ou apenas admin/gerente?
4. Para `costs` realtime (US-005): re-fetch do item pai via Supabase ou patch do array local? Patch local é mais eficiente mas exige cuidado com consistência
