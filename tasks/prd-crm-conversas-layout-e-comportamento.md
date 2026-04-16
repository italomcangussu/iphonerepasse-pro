# PRD: Redesign de Conversas CRM (iPhone Repasse) inspirado no Clinicacrm

## 1. Introdução

O módulo de Conversas do CRM no iPhone Repasse está funcional, porém com layout simples e com pouca otimização para operação contínua. A lista de conversas e o chat precisam de uma organização mais eficiente, inspirada no padrão do app `clinicacrm`, priorizando velocidade de triagem, leitura e resposta, com comportamento robusto em desktop e mobile.

Este PRD define as mudanças de design, posição dos elementos e melhorias de comportamento para tornar o inbox mais previsível e produtivo.

## 2. Goals

- Redesenhar o layout do inbox para padrão split-view (lista + thread) com foco operacional.
- Melhorar navegação mobile entre lista e conversa ativa.
- Adicionar busca local de conversas por nome/telefone/lead.
- Garantir atualização periódica da lista e da thread ativa sem exigir refresh manual constante.
- Tornar estados de carregamento, vazio e erro mais claros para operação diária.

## 3. User Stories

### US-001: Layout split-view para inbox
**Description:** Como atendente, quero ver lista de conversas e thread em painéis bem definidos para navegar e responder mais rápido.

**Acceptance Criteria:**
- [ ] Em desktop, a UI exibe painel de lista à esquerda e painel de chat à direita.
- [ ] Em mobile, a lista ocupa a tela quando nenhuma conversa está selecionada.
- [ ] Em mobile, ao abrir conversa, a thread ocupa a tela e existe botão de voltar para a lista.
- [ ] Typecheck/lint passes.
- [ ] Verify in browser using dev-browser skill.

### US-002: Busca e triagem de conversas
**Description:** Como atendente, quero buscar conversas por dados do lead para encontrar rapidamente o atendimento certo.

**Acceptance Criteria:**
- [ ] Campo de busca filtra conversas por `nome`, `telefone` e `lead_id` localmente.
- [ ] O contador de conversas filtradas aparece no cabeçalho da lista.
- [ ] Estado vazio informa claramente quando não há conversas para o filtro aplicado.
- [ ] Typecheck/lint passes.
- [ ] Verify in browser using dev-browser skill.

### US-003: Comportamento de atualização contínua
**Description:** Como atendente, quero que a lista e a thread ativa atualizem automaticamente para reduzir risco de operar dados defasados.

**Acceptance Criteria:**
- [ ] A lista de conversas atualiza periodicamente (polling) sem perder seleção atual.
- [ ] A thread da conversa selecionada atualiza periodicamente.
- [ ] Ao focar novamente a aba/janela, a tela força recarga de dados.
- [ ] Typecheck/lint passes.

### US-004: Composer e histórico com usabilidade superior
**Description:** Como atendente, quero enviar mensagens com menos atrito e ler histórico com melhor legibilidade.

**Acceptance Criteria:**
- [ ] Mensagens exibem direção visual clara (inbound/outbound).
- [ ] O composer permite envio por botão e por Enter (sem Shift).
- [ ] A timeline rola para o final após carregar mensagens/enviar.
- [ ] Estados de envio e bloqueio do botão são coerentes.
- [ ] Typecheck/lint passes.
- [ ] Verify in browser using dev-browser skill.

### US-005: Header operacional da conversa
**Description:** Como atendente, quero ver dados essenciais da conversa no topo para contexto rápido.

**Acceptance Criteria:**
- [ ] Header mostra nome/identificador do lead.
- [ ] Header mostra canal/provedor e status da conversa.
- [ ] Header mostra ação de refresh manual.
- [ ] Em mobile, header inclui ação de voltar para lista.
- [ ] Typecheck/lint passes.
- [ ] Verify in browser using dev-browser skill.

## 4. Functional Requirements

- FR-1: O sistema deve renderizar o módulo de conversas em duas áreas principais: `lista de conversas` e `thread da conversa`.
- FR-2: O sistema deve suportar alternância de visualização no mobile (`lista` e `thread`) com controle explícito de navegação.
- FR-3: O sistema deve aplicar filtro local por texto sobre os campos do lead e identificadores da conversa.
- FR-4: O sistema deve manter a conversa selecionada após recargas periódicas, sempre que ela ainda existir no resultado.
- FR-5: O sistema deve atualizar lista e mensagens por polling em intervalo definido.
- FR-6: O sistema deve permitir envio de mensagem por clique e tecla Enter.
- FR-7: O sistema deve exibir estados de `loading`, `empty` e `error` com feedback textual útil.
- FR-8: O layout deve seguir direção visual inspirada no `clinicacrm` (pane list + thread, badges de status, header operacional), sem copiar dependências específicas daquele projeto.

## 5. Non-Goals (Out of Scope)

- Não inclui refatoração de regras de negócio do backend CRM.
- Não inclui implementação de funcionalidades avançadas do `clinicacrm` (transferência de ownership, mídia, agendamento, etc.).
- Não inclui alteração estrutural de schema de banco para este redesign.
- Não inclui redesign global de todas as páginas do CRM além da tela de conversas.

## 6. Design Considerations

- Inspirar estrutura em inbox operacional: painel esquerdo com triagem e painel direito com contexto + mensagens.
- Priorizar legibilidade de status (chips/badges), sem excesso de ruído visual.
- Manter consistência com classes e tokens visuais existentes do CRM (`crm-card`, `crm-input`, `crm-btn`).
- Melhorar hierarquia visual no primeiro viewport da tela de conversas.

## 7. Technical Considerations

- Arquivo principal alvo: `pages/crm/ConversationsPage.tsx`.
- Não introduzir dependências novas para este escopo.
- Preservar integração atual com:
  - `supabase.from("crm_conversations")`
  - `supabase.from("crm_messages")`
  - `supabase.functions.invoke("crm-send-message")`
- Implementar polling com cleanup adequado para evitar vazamento de intervalos.

## 8. Success Metrics

- Redução do número de cliques para navegar entre conversas no mobile.
- Menor necessidade de refresh manual para acompanhar novas mensagens.
- Tempo médio de localizar uma conversa (via busca) reduzido.
- Menos erros operacionais por falta de contexto de canal/status no header.

## 9. Open Questions

- Devemos marcar automaticamente conversa como lida ao abrir a thread?
- O polling deve ser pausado quando a aba estiver oculta para reduzir custo?
- Qual intervalo ideal de polling para equilibrar frescor de dados e custo de API?
- No futuro, devemos trazer preview da última mensagem diretamente na listagem via query otimizada?
