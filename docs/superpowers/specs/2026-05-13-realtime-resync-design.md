# Realtime Resync Design

**Contexto**

O app principal depende de `DataProvider` em `services/dataContext.tsx` para hidratar e distribuir estado de estoque, vendas, clientes, financeiro e entidades correlatas. Hoje o provider abre um canal Supabase Realtime e aplica atualizações incrementais em memória, mas não faz reconciliação quando a conexão degrada, a aba volta do background, a janela volta ao foco ou o dispositivo retorna ao estado online.

O sintoma observado é consistente com perda silenciosa de sincronia: mudanças só aparecem ao reabrir o app ou atualizar a página, tanto no mesmo navegador quanto entre dispositivos.

**Objetivo**

Garantir que o app principal volte a refletir alterações sem necessidade de reload manual, combinando:

- atualização incremental por eventos Realtime quando a conexão está saudável
- ressincronização completa e controlada quando houver sinais de conexão degradada ou retorno da aba
- proteção contra concorrência e rajadas de `fetchData()`

**Escopo**

- Modificar `services/dataContext.tsx`
- Ampliar `services/dataContext.test.tsx`
- Validar com `vitest` e `tsc --noEmit`

**Fora de escopo**

- Refatorar o CRM para centralizar todas as mutações no `DataContext`
- Mudar schema, migrations ou configuração do Supabase
- Reestruturar telas consumidoras do contexto sem necessidade direta para a correção

## Problema Atual

1. O canal Realtime é assinado via `.subscribe()` sem tratamento explícito dos estados de assinatura.
2. Não existe estratégia global de ressincronização ao voltar foco, voltar visibilidade ou recuperar conectividade.
3. `fetchData()` pode ser acionado por mais de uma origem e não possui proteção explícita contra respostas antigas sobrescrevendo estado mais novo.
4. Há fluxos que escrevem direto no Supabase fora do `DataContext`, então a interface depende ainda mais do canal global permanecer coerente.

## Abordagem Recomendada

Manter o Realtime incremental atual, mas tratar o provider como a camada autoritativa de reconciliação:

1. Encapsular `fetchData()` atrás de um executor estável com:
   - serialização básica
   - supressão de rajadas em intervalo curto
   - proteção contra aplicar resultados obsoletos
2. Observar o status do canal Supabase Realtime.
3. Disparar ressync completo quando:
   - o canal sinalizar erro ou timeout
   - a aba voltar ao foco
   - `document.visibilityState` voltar para `visible`
   - o browser emitir `online`
   - houver re-subscribe após estado degradado
4. Preservar atualizações incrementais existentes para os casos saudáveis.

## Design Técnico

### 1. Executor de sincronização protegido

`fetchData()` continuará sendo a rotina que lê todas as tabelas necessárias, mas será envolvida por um mecanismo com `useRef` para:

- contar versões de sincronização
- registrar se há sincronização em andamento
- registrar timestamp da última sincronização disparada
- evitar chamadas redundantes em sequência curta

Fluxo:

1. um gatilho chama `scheduleRefresh(reason)`
2. `scheduleRefresh` decide se deve ignorar por debounce curto
3. se deve rodar, inicia nova versão de sincronização
4. quando a resposta terminar, só aplica se a versão ainda for a mais recente

Isso evita duas falhas comuns:

- duas sincronizações consecutivas sobrescrevendo estado fora de ordem
- múltiplos eventos de reconnect/focus causando tempestade de requests

### 2. Observabilidade do canal Realtime

O subscribe do canal em `services/dataContext.tsx` passará a usar callback de status para:

- registrar quando o canal entra em `SUBSCRIBED`
- marcar que a conexão ficou degradada ao receber `CHANNEL_ERROR` ou `TIMED_OUT`
- disparar ressync quando o canal voltar a `SUBSCRIBED` depois de estado degradado

Esse comportamento não substitui os listeners do browser; ele os complementa.

### 3. Ressync por ciclo de vida da aba

O provider adicionará listeners globais enquanto o usuário estiver autenticado:

- `window.focus`
- `window.online`
- `document.visibilitychange`

Regras:

- `focus` sempre agenda ressync
- `visibilitychange` só agenda quando o estado for `visible`
- `online` agenda ressync porque o websocket pode não ter recuperado tudo sozinho

Todos os listeners serão removidos no cleanup do efeito.

### 4. Manutenção do comportamento incremental

Os handlers existentes de `postgres_changes` permanecem como primeira linha de atualização. A correção não remove a aplicação incremental de `sales`, `stock_items`, `customers`, `transactions` e demais tabelas já tratadas.

O ressync total entra apenas como mecanismo de cura para:

- reconexão
- perda silenciosa de eventos
- mudança feita por fluxos externos ao contexto

## Tratamento de Erros

- Erros de subscribe e timeout serão logados com contexto suficiente para diagnóstico.
- Falhas de `fetchData()` continuam sem quebrar o app, mas não devem limpar estado autenticado como efeito colateral de uma tentativa de ressync.
- O estado de loading inicial deve continuar correto; ressyncs posteriores não devem rebaixar a UX para um “carregando” global desnecessário.

## Testes

Adicionar cobertura em `services/dataContext.test.tsx` para:

1. disparar `refreshData` ao receber `focus`
2. disparar `refreshData` ao voltar `online`
3. disparar `refreshData` ao receber `visibilitychange` com `visible`
4. não disparar múltiplas sincronizações equivalentes em sequência curta
5. disparar ressync ao re-subscrever depois de status degradado do canal

## Riscos e Mitigações

- **Risco:** aumentar quantidade de fetches totais.
  **Mitigação:** debounce curto e reaproveitamento do fluxo incremental.

- **Risco:** testes ficarem frágeis por mocking incompleto do canal.
  **Mitigação:** controlar o mock do subscribe/status explicitamente no teste.

- **Risco:** ainda restar problema no CRM standalone.
  **Mitigação:** tratar esta entrega como estabilização do app principal; CRM fica como etapa posterior se necessário.

## Critério de Sucesso

- Alterações feitas no próprio app aparecem sem reload manual.
- Alterações feitas em outro dispositivo aparecem sem precisar fechar e abrir a aba.
- Voltar para a aba após período em background reidrata os dados relevantes automaticamente.
- Os testes do provider cobrem reconexão e ressync por ciclo de vida.
