# Design: Ações com botão direito no desktop

**Data:** 2026-06-23  
**Produtos:** iPhoneRepasse Pro ERP e CRM Plus  
**Status:** aprovado para planejamento  
**Abordagem escolhida:** camada discreta de produtividade, sem remover botões atuais

## 1. Objetivo

Adicionar menus de contexto por clique direito no modo desktop para acelerar
ações repetidas em listas, tabelas, cards e mensagens, preservando a interface
atual para quem usa toque, teclado ou botões visíveis.

O trabalho deve:

- funcionar apenas em contexto desktop, com ponteiro fino e hover;
- não esconder ações principais já visíveis;
- reutilizar as mesmas funções, permissões, confirmações e toasts atuais;
- não interceptar clique direito em campos de texto, inputs, textareas,
  selects, links, mídias abertas ou conteúdo selecionável;
- manter acessibilidade por teclado usando o botão de ações já visível quando
  houver, e um gatilho equivalente quando a superfície não tiver menu;
- seguir o vocabulário visual existente: `ios-card`, `liquid-glass`,
  `crm-card`, `crm-icon-btn`, `surface-dark-*`, `hit-target-44` e ícones
  `lucide-react`.

## 2. Abordagens consideradas

### 2.1 Camada discreta por item

Cada linha/card/mensagem acionável passa a aceitar `onContextMenu` no desktop e
abre um menu no ponto do cursor. Os botões atuais continuam visíveis.

Vantagens:

- menor risco de regressão;
- descoberta gradual para usuários avançados;
- respeita mobile e toque;
- permite rollout por superfície.

Desvantagens:

- a tela continua com algumas colunas de ação repetidas;
- exige disciplina para não duplicar menus de forma inconsistente.

### 2.2 Substituir colunas de ação por menus

As colunas "Ação/Ações" seriam reduzidas para um botão de reticências, com
clique direito como atalho.

Vantagens:

- interface mais limpa;
- reduz largura de tabelas densas.

Desvantagens:

- pior descoberta para usuários atuais;
- risco maior em fluxos operacionais de venda, estoque e financeiro;
- mais regressões em testes e permissões.

### 2.3 Command palette contextual

Um atalho global abriria ações para o item selecionado ou página atual.

Vantagens:

- poderoso para usuários intensivos;
- escala para ações globais.

Desvantagens:

- depende de estado de seleção consistente que o app ainda não tem;
- não substitui a expectativa natural do clique direito;
- escopo maior do que a necessidade atual.

### Decisão

Implementar a abordagem 2.1. As opções 2.2 e 2.3 ficam fora do escopo inicial.

## 3. Regras de interação

### 3.1 Onde o menu aparece

O menu aparece ao clicar com o botão direito em:

- cards de listagem;
- linhas de tabela;
- bolhas de mensagem no CRM;
- itens de conversa/leads;
- registros de CRUD simples;
- cards de resultado ou simulação que já possuem ações de copiar/editar.

O menu não aparece em:

- inputs, textareas, selects e comboboxes;
- conteúdo editável;
- links externos;
- botões já clicáveis;
- imagens, vídeos, áudios e visualizadores de mídia;
- texto selecionado;
- mobile/tablet touch-first.

### 3.2 Desktop

O app deve considerar clique direito customizado somente quando:

- `window.matchMedia('(hover: hover) and (pointer: fine)').matches` for
  verdadeiro;
- o viewport estiver em layout desktop da superfície, normalmente `lg` ou
  equivalente;
- o evento vier de mouse/trackpad, não de long press touch.

Em ambientes híbridos, o menu pode ficar disponível se o ponteiro fino estiver
ativo, mas não deve substituir a experiência de toque.

### 3.3 Posicionamento

O menu abre no ponto do cursor, com correção para não sair da viewport:

- margem mínima de `8px` das bordas;
- largura padrão entre `220px` e `280px`;
- altura máxima com scroll próprio quando necessário;
- `z-index` acima de tabelas/cards e abaixo de modais ativos;
- fechamento por `Escape`, clique fora, scroll relevante, mudança de rota ou
  execução de ação.

### 3.4 Feedback

Toda ação deve manter o feedback já existente:

- ações destrutivas continuam usando `ConfirmDialog` ou confirmação atual;
- sucesso usa toast existente quando a ação já usa;
- erro preserva causa e correção quando disponível;
- ações assíncronas podem mostrar estado desabilitado ou label progressivo no
  item de menu, sem duplicar requests.

### 3.5 Permissões

O menu não pode revelar ações que o usuário não teria pelos botões atuais.

Regras:

- `visible`, `editable` e `deletable` continuam vindo da matriz atual;
- ações administrativas aparecem apenas para roles atuais;
- itens desabilitados só aparecem quando ajudam a explicar estado operacional
  temporário, como "Assumindo..." ou "Atualizando...";
- ações proibidas por permissão devem ser omitidas, não desabilitadas.

## 4. Arquitetura proposta

### 4.1 Primitivo compartilhado

Criar um primitivo compartilhado para menus de contexto de desktop:

```ts
type ContextMenuAction = {
  id: string;
  label: string;
  icon?: React.ReactNode;
  hint?: string;
  disabled?: boolean;
  loading?: boolean;
  destructive?: boolean;
  separatorBefore?: boolean;
  onSelect: () => void | Promise<void>;
};
```

Responsabilidades do primitivo:

- detectar se o menu customizado pode abrir no ambiente atual;
- ignorar targets nativos onde o menu do browser deve continuar;
- receber lista de ações já filtradas pela tela;
- renderizar via portal no `document.body`;
- gerenciar foco, `Escape`, clique fora e fechamento;
- aplicar tokens visuais existentes;
- aceitar `aria-label` descritivo da entidade.

O primitivo não conhece estoque, CRM, financeiro ou permissões. Cada página
monta suas ações a partir de callbacks que já existem.

### 4.2 API de uso esperada

O padrão de uso deve ser pequeno o suficiente para ser adotado em várias telas:

```tsx
const contextMenu = useDesktopContextMenu();

<tr
  onContextMenu={contextMenu.bind(eventActions, {
    label: `Ações de ${item.model}`,
  })}
>
  ...
</tr>

<DesktopContextMenuHost controller={contextMenu} />
```

Uma alternativa aceitável é um componente wrapper, desde que não crie markup
inválido dentro de `table`, `tbody`, `tr` ou `td`.

## 5. Superfícies e ações

### 5.1 Estoque

Alvos:

- cards mobile/tablet quando estiverem em viewport com ponteiro fino;
- linhas da tabela desktop;
- cards/detalhes de aparelho quando aplicável.

Ações:

- "Ver detalhes";
- "Editar", se `canEditInventory`;
- "Reservar", se disponível e editável;
- "Liberar reserva", se reservado e editável;
- "Copiar IMEI/Serial", quando existir;
- "Copiar resumo" com modelo, capacidade, cor, estado e preço;
- "Selecionar para lista especial", somente quando o modo de lista especial
  estiver ativo.

### 5.2 PDV e histórico de vendas

Alvos:

- linhas e cards do histórico;
- registros duplicados quando a tela já oferece ação de remoção;
- itens vendidos nos detalhes, quando já houver ação visível.

Ações:

- "Ver detalhes";
- "Editar", para administrador;
- "Edição completa", para administrador quando existente;
- "Cancelar venda", para administrador e seguindo confirmação atual;
- "Copiar número da venda";
- "Copiar resumo da venda".

### 5.3 Financeiro, devedores e contas a pagar

Alvos:

- lançamentos financeiros;
- dívidas de clientes;
- dívidas ativas/credores;
- cards equivalentes em layouts menores.

Ações:

- "Ver detalhes";
- "Editar";
- "Registrar pagamento", quando a tela já oferece fluxo;
- "Exportar lançamentos da conta", somente em áreas onde a ação já existe;
- "Cancelar lançamento" ou "Excluir dívida", mantendo confirmação atual;
- "Copiar descrição/identificador".

### 5.4 Clientes, vendedores, lojas e peças

Alvos:

- linhas/cards de cadastros simples.

Ações:

- "Editar";
- "Excluir" ou "Remover", somente onde a tela já oferece essa ação;
- "Copiar nome";
- "Copiar telefone/documento", quando existir.

### 5.5 Garantias

Alvos:

- cards/linhas de garantia;
- área de link público.

Ações:

- "Editar garantia";
- "Copiar link";
- "Copiar código/identificador";
- "Ver detalhes", quando houver fluxo correspondente.

### 5.6 Calculadora e simuladores

Alvos:

- blocos de resultado;
- simulações do CRM;
- valores base do simulador onde a tela já permite editar/excluir.

Ações:

- "Copiar texto";
- "Copiar mensagem";
- "Copiar para CRM", quando já existir;
- "Editar valor";
- "Excluir valor", mantendo confirmação atual.

### 5.7 CRM Plus: conversas

Alvos:

- itens da lista de conversas;
- header da conversa selecionada;
- bolhas de mensagem;
- cards de mídia dentro da mensagem, sem bloquear o menu nativo de mídia aberta.

Ações para conversa/lead:

- "Abrir conversa";
- "Informações do lead";
- "Atualizar conversa";
- "Marcar como lida", quando houver não lidas;
- "Assumir atendimento da IA" ou "Transferir para IA", conforme estado atual;
- "Excluir lead", mantendo confirmação atual.

Ações para mensagem:

- "Responder";
- reações rápidas, quando provider permitir;
- "Editar mensagem", somente mensagem enviada com provider id;
- "Encaminhar";
- "Apagar para todos", somente quando permitido.

O menu existente de três pontos em `MessageBubble` deve ser reaproveitado ou
extraído para o mesmo modelo de ações, evitando duas listas divergentes.

### 5.8 CRM Plus: cadastros e páginas administrativas

Alvos:

- `CRMSimpleCrud`;
- canais, templates, automações, scripts, campos personalizados e páginas com
  tabelas administrativas.

Ações:

- "Editar";
- "Duplicar", somente se a tela já tiver lógica ou se for implementada
  explicitamente em uma fase futura;
- "Excluir/Remover", quando já existir;
- "Copiar identificador";
- ações específicas de canal já existentes, como "Copiar webhook",
  "Atualizar status" ou "Configurar webhook".

## 6. Visual e conteúdo

O menu deve parecer parte do app, não do navegador:

- raio: `rounded-xl` no CRM e `rounded-ios`/`rounded-ios-lg` no ERP, conforme
  superfície;
- sombra: `shadow-xl`/`shadow-ios26` existente;
- fundo: `bg-white dark:bg-surface-dark-100` no ERP e
  `bg-white dark:bg-slate-900` no CRM;
- borda: `border-gray-200 dark:border-surface-dark-200` ou equivalente CRM;
- item: altura mínima `40px`, ideal `44px` quando houver espaço;
- ícones `lucide-react` com `16px` ou `17px`;
- destrutivas em vermelho com ícone, nunca apenas por cor;
- separadores apenas entre grupos de intenção: primárias, copiar/compartilhar,
  destrutivas.

Labels em PT-BR devem usar verbos diretos e iguais aos botões existentes:

- "Editar", não "Modificar";
- "Excluir", "Remover" ou "Cancelar" conforme a tela já usa;
- "Copiar resumo", quando a ação gera texto composto;
- "Copiar IMEI/Serial", quando copia campo específico.

## 7. Não objetivos

Esta fase não deve:

- remover botões atuais;
- criar seleção global de linhas;
- criar command palette;
- adicionar atalhos de teclado globais;
- inventar ações novas sem fluxo existente;
- alterar regras de negócio, permissões ou confirmações;
- interceptar o menu nativo do browser fora de superfícies acionáveis.

## 8. Rollout

Implementar em fases pequenas:

1. Primitivo compartilhado e testes de comportamento desktop/nativo.
2. Estoque e histórico de vendas, por serem listas operacionais de alta
   frequência.
3. CRM conversas: bolhas de mensagem e opções do lead.
4. Financeiro, devedores e contas a pagar.
5. Cadastros simples, garantias, calculadora e simuladores.
6. Auditoria visual e smoke tests nas rotas principais.

Cada fase deve preservar a tela funcional mesmo que o menu de contexto não
esteja disponível.

## 9. Testes

Adicionar cobertura em camadas:

- teste unitário do detector de target nativo, garantindo que input, textarea,
  select, links, botões e texto selecionado não são interceptados;
- teste do posicionamento para bordas direita/inferior da viewport;
- teste do hook/componente compartilhado: abre com `contextMenu`, fecha com
  `Escape`, clique fora e seleção de item;
- testes focados em Estoque e CRM MessageBubble para garantir que ações
  existentes continuam sendo chamadas;
- testes de permissão para confirmar que ações proibidas não aparecem;
- smoke Playwright em desktop para pelo menos Estoque, Histórico de vendas,
  Financeiro e Conversas CRM.

## 10. Critérios de aceite

- Clique direito em uma linha/card acionável no desktop abre menu com ações
  relevantes daquela entidade.
- Clique direito em campo de texto, botão, link ou mídia mantém o comportamento
  esperado do browser/app.
- Nenhuma ação aparece para usuário sem permissão.
- Ações destrutivas continuam exigindo confirmação.
- Botões e fluxos atuais permanecem visíveis e funcionais.
- O menu não sai da viewport.
- O menu respeita dark mode.
- O menu fecha por `Escape`, clique fora, scroll/mudança de rota e após ação.
- Mobile não recebe menu customizado por long press.
- `npm run typecheck` e testes focados passam antes de concluir a implementação.
