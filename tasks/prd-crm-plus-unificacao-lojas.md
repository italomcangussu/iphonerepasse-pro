# PRD: Unificação de Lojas no CRM Plus

## 1. Introdução

O CRM Plus da iPhone Repasse hoje expõe a operação dividida por loja/cidade, exigindo seleção entre lojas em pontos como o cabeçalho do CRM e a configuração de canais. Essa divisão adiciona atrito operacional e não é necessária para o fluxo atual.

Este PRD define as mudanças de frontend e backend para transformar o CRM Plus em uma experiência unificada: o usuário não escolhe cidade/loja para operar o CRM, os canais não exigem seleção de loja na interface, e o backend resolve uma loja CRM padrão de forma automática para manter compatibilidade com o schema atual.

## 2. Goals

- Remover do CRM Plus a necessidade de selecionar entre lojas/cidades.
- Remover da configuração de canais CRM a opção de escolher loja.
- Fazer listagens e dashboards do CRM exibirem dados de forma unificada.
- Manter compatibilidade com tabelas, RLS e Edge Functions que dependem de `store_id`.
- Evitar migração destrutiva de dados e preservar histórico existente.
- Reduzir pontos de erro operacional causados por canal, funil, lead ou conversa gravados na loja errada.

## 3. User Stories

### US-001: Remover seletor global de loja do CRM Plus
**Description:** Como atendente, quero acessar o CRM Plus sem escolher cidade ou loja para operar tudo em um único ambiente.

**Acceptance Criteria:**
- [ ] O cabeçalho do CRM Plus não exibe select de loja/cidade.
- [ ] `CRMStandaloneLayout` não renderiza o bloco `crm-header-store`.
- [ ] O CRM continua carregando normalmente mesmo quando existir mais de uma loja cadastrada no sistema principal.
- [ ] Nenhum texto de estado vazio menciona "loja selecionada" quando o contexto for CRM Plus.
- [ ] Typecheck/lint passes.
- [ ] Verify in browser using dev-browser skill.

### US-002: Resolver loja CRM padrão sem interação do usuário
**Description:** Como sistema, preciso definir automaticamente o `store_id` usado em escritas do CRM para preservar compatibilidade com o banco.

**Acceptance Criteria:**
- [ ] Existe uma forma única e documentada de resolver o `store_id` padrão do CRM.
- [ ] A resolução prioriza configuração persistida no backend quando existir.
- [ ] Se a configuração ainda não existir, o sistema usa fallback determinístico para uma loja existente.
- [ ] O frontend não depende de `localStorage` para escolher a loja do CRM.
- [ ] Inserções em tabelas CRM que exigem `store_id` continuam funcionando sem select de loja.
- [ ] Typecheck/lint passes.

### US-003: Unificar listagens e consultas operacionais do CRM
**Description:** Como atendente, quero ver conversas, comentários, estatísticas, ads e cashback de forma unificada, sem filtro manual por loja.

**Acceptance Criteria:**
- [ ] Conversas carregam todos os registros acessíveis ao usuário no modo unificado.
- [ ] Comentários do Instagram carregam todos os registros acessíveis ao usuário no modo unificado.
- [ ] Estatísticas, Ads e Cashback não dependem de `selectedStoreId` vindo de select visual.
- [ ] Quando uma RPC ainda exigir `p_store_id`, ela recebe o `store_id` padrão do CRM ou é evoluída para aceitar agregação global.
- [ ] Estados vazios usam textos como "Nenhum registro encontrado" em vez de "Nenhum registro para a loja selecionada".
- [ ] Typecheck/lint passes.
- [ ] Verify in browser using dev-browser skill.

### US-004: Remover seleção de loja da tela de canais
**Description:** Como administrador, quero criar e editar canais CRM sem escolher uma loja, pois os canais pertencem ao CRM unificado.

**Acceptance Criteria:**
- [ ] A tela `CRMChannels` não exibe card de filtro "Loja".
- [ ] O modal de novo/editar canal não exibe campo "Loja".
- [ ] `saveChannel` não valida `formData.storeId` como campo manual obrigatório.
- [ ] Canais novos recebem automaticamente o `store_id` padrão do CRM.
- [ ] A tabela de canais não mostra subtítulo com nome da loja.
- [ ] Funil inbound não é filtrado por loja escolhida manualmente.
- [ ] Typecheck/lint passes.
- [ ] Verify in browser using dev-browser skill.

### US-005: Remover configuração manual de centralização
**Description:** Como administrador, quero que o CRM Plus seja sempre unificado, sem toggle para ligar/desligar centralização.

**Acceptance Criteria:**
- [ ] A configuração visual "Centralizar Atendimento" é removida da tela de configurações do CRM.
- [ ] O backend passa a tratar `centralized_service` como ligado por padrão para o CRM Plus.
- [ ] O comportamento não muda por usuário ou por sessão.
- [ ] Policies e funções de acesso continuam protegendo usuários autenticados.
- [ ] Typecheck/lint passes.
- [ ] Verify in browser using dev-browser skill.

### US-006: Migração segura de dados CRM existentes
**Description:** Como administrador, quero que dados existentes de Fortaleza/Sobral continuem disponíveis no CRM unificado sem perda de histórico.

**Acceptance Criteria:**
- [ ] Existe migration para configurar a loja CRM padrão.
- [ ] A migration não apaga lojas do sistema principal.
- [ ] A migration não remove `store_id` das tabelas CRM.
- [ ] Registros CRM existentes permanecem consultáveis depois da unificação.
- [ ] Se houver consolidação de `store_id`, ela atualiza tabelas relacionadas de forma consistente ou preserva o valor original em metadados/auditoria.
- [ ] Migration health passa.

## 4. Functional Requirements

- FR-1: O CRM Plus não deve renderizar select de loja/cidade no layout principal.
- FR-2: O contexto `useCRMStore` deve deixar de representar uma escolha do usuário e passar a representar a loja CRM resolvida automaticamente, ou ser substituído por um contexto de configuração CRM.
- FR-3: O sistema deve remover o uso de `crm_plus_selected_store_id` como fonte de verdade para operação do CRM.
- FR-4: O backend deve expor ou persistir um `default_crm_store_id` para operações que ainda exigem `store_id`.
- FR-5: O valor de `default_crm_store_id` deve referenciar uma loja existente em `public.stores`.
- FR-6: A tela `CRMChannels` deve carregar todos os canais acessíveis sem filtro por loja.
- FR-7: A criação e edição de canais deve preencher `crm_channels.store_id` automaticamente.
- FR-8: Funis usados por canais devem carregar em modo unificado, sem depender de loja selecionada no formulário.
- FR-9: Páginas CRM que hoje dependem de `selectedStoreId` devem ser revisadas: `ConversationsPage`, `CommentsPage`, `StatisticsPage`, `AdsPage`, `CashbackPage`, `CRMSimpleCrud` e páginas que o reutilizam.
- FR-10: RPCs que recebem `p_store_id` devem ser mantidas com fallback para loja padrão ou evoluídas para modo agregado, conforme a natureza dos dados.
- FR-11: Edge Functions que recebem `storeId` externo devem continuar aceitando `storeId` quando necessário para integrações, mas fluxos internos do CRM Plus devem usar a loja padrão automaticamente.
- FR-12: Textos de UI devem evitar "loja selecionada", "padrão da loja" e equivalentes quando o usuário não tem mais controle de loja.

## 5. Non-Goals

- Não remover o módulo de lojas do sistema principal.
- Não apagar lojas Fortaleza/Sobral da tabela `stores`.
- Não remover `store_id` de todas as tabelas CRM nesta entrega.
- Não alterar regras de estoque, vendas, vendedores, garantias ou financeiro fora do CRM Plus.
- Não recriar integrações UAZAPI/Instagram do zero.
- Não fazer deduplicação automática de leads entre lojas sem regra explícita de merge.
- Não mudar permissões gerais do app fora do escopo CRM Plus.

## 6. Design Considerations

- A experiência deve comunicar "CRM Plus" como ambiente único, não como uma operação por cidade.
- Onde antes aparecia loja como subtítulo de registro, remover ou substituir por informação mais útil: provider, status, telefone, funil ou última atividade.
- Em páginas administrativas, manter formulários densos e diretos, sem cards explicativos adicionais.
- Não introduzir novos seletores para substituir o seletor de loja. A unificação deve ser invisível para o operador.

## 7. Technical Considerations

- Arquivos frontend diretamente envolvidos:
  - `components/crm/CRMStandaloneLayout.tsx`
  - `components/crm/useCRMStore.ts`
  - `components/crm/CRMStoreFilter.tsx`
  - `components/crm/CRMSimpleCrud.tsx`
  - `pages/CRMChannels.tsx`
  - `pages/crm/SettingsPage.tsx`
  - `pages/crm/ConversationsPage.tsx`
  - `pages/crm/CommentsPage.tsx`
  - `pages/crm/StatisticsPage.tsx`
  - `pages/crm/AdsPage.tsx`
  - `pages/crm/CashbackPage.tsx`
- Backend atual depende fortemente de `store_id`; a implementação deve preferir camada de compatibilidade em vez de remoção estrutural ampla.
- A migration `20260417125800_add_crm_centralized_setting.sql` já introduziu `crm_settings.centralized_service`; esta entrega deve consolidar essa decisão como padrão permanente ou substituir por configuração mais explícita, como `default_crm_store_id`.
- Policies usam `public.crm_can_access_store(p_store_id)`. A mudança deve manter isolamento por usuário autenticado e evitar abrir acesso público.
- Funções/RPCs relevantes incluem `get_crm_statistics`, `get_crm_ads_dashboard`, `get_cashback_summary` e funções de leads/campanhas que recebem `p_store_id`.
- Edge Functions relevantes incluem `crm-uaz-webhook-receiver`, `crm-instagram-webhook-receiver`, `crm-send-message`, `crm-leads-api`, `crm-n8n-api` e `crm-conversation-handoff`.
- Recomenda-se criar helper único no frontend para obter o `crmDefaultStoreId`, em vez de espalhar fallback `stores[0]?.id`.
- Recomenda-se criar helper/RPC no backend para resolver a loja padrão e evitar divergência entre frontend, SQL e Edge Functions.

## 8. Success Metrics

- Zero selects de loja/cidade visíveis dentro do CRM Plus.
- Criação de canal CRM em até um fluxo direto, sem campo de loja.
- Redução de erros de configuração de canal por loja incorreta.
- Conversas e canais existentes continuam visíveis após a mudança.
- Testes automatizados e verificação visual confirmam que o CRM abre sem depender de `localStorage` de loja.

## 9. Open Questions

- Qual loja existente deve ser usada como `default_crm_store_id` inicial: Fortaleza, Sobral ou uma nova loja técnica "CRM Plus"?
- Devemos consolidar fisicamente `store_id` dos registros CRM antigos para uma loja padrão, ou apenas consultar tudo de forma agregada e usar a loja padrão somente para novos registros?
- O toggle `centralized_service` deve ser removido do banco ou mantido como compatibilidade interna sempre `true`?
- Funis e configurações já duplicados por loja devem ser mesclados agora ou apenas carregados em visão unificada?
- Integrações externas que enviam `storeId` devem continuar aceitando loja específica por compatibilidade, mesmo que a UI não exponha essa escolha?
