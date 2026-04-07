# PRD: PDV com Tela Inicial de Historico de Vendas e CTA Nova Venda

## 0. Perguntas de Clarificacao (respondidas)

1. Qual e o objetivo principal dessa mudanca no menu PDV?
   A. Facilitar acompanhamento e auditoria.
   B. Reduzir erros operacionais.
   C. Melhorar velocidade de operacao.
   D. Outro.

Resposta do usuario: **1ABC**.
Consolidacao: o escopo deve equilibrar controle operacional (A/B) e velocidade de caixa (C), sem adicionar friccao desnecessaria para abrir uma nova venda.

2. Quem pode acessar a nova tela inicial de historico no PDV?
   A. Todos os usuarios do PDV.
   B. Apenas gerente/admin.
   C. Operador ve so propria loja; gerente ve todas.
   D. Outro.

Resposta do usuario: **2A**.
Consolidacao: historico deve ficar disponivel para todos os perfis com acesso ao PDV.

3. O que deve existir no historico alem da listagem e filtros?
   A. Apenas lista.
   B. Lista + detalhe.
   C. Lista + detalhe + acoes.
   D. Outro.

Resposta do usuario: **3C**.
Consolidacao: incluir detalhe e acoes por venda (ex.: imprimir comprovante e cancelar venda, com regra de permissao).

4. Como os filtros devem funcionar por padrao ao entrar no menu?
   A. Loja do usuario + periodo hoje.
   B. Loja do usuario + ultimos 7 dias.
   C. Sem filtros.
   D. Outro.

Resposta do usuario: **4AB**.
Consolidacao: manter loja do usuario como padrao e oferecer preset de periodo com alternancia rapida entre **Hoje** e **Ultimos 7 dias**; inicializar em **Hoje**.

5. Sobre navegacao "Nova venda", qual comportamento esperado?
   A. Abrir fluxo atual de steps do zero.
   B. Abrir fluxo e retomar rascunho.
   C. Abrir modal de tipo de venda.
   D. Outro.

Resposta do usuario: **5A**.
Consolidacao: botao "Nova venda" deve abrir fluxo de steps atual do zero.

## 1. Introducao/Overview

Hoje, ao entrar em `PDV`, o usuario cai diretamente nos steps de venda. A mudanca proposta transforma o ponto de entrada em uma tela de **Historico de Vendas** com filtros operacionais (loja, estado, metodo de pagamento e periodo), mantendo no topo um CTA claro de **Nova venda** para abrir a pagina de steps.

Problema principal:
- Falta de visibilidade operacional imediata ao entrar no PDV.
- Dificuldade para revisar vendas recentes antes de iniciar um novo atendimento.
- Necessidade de preservar velocidade para iniciar venda nova sem comprometer auditoria.

## 2. Goals

- Tornar o historico de vendas a tela padrao do menu PDV.
- Permitir filtragem rapida por loja, estado, metodo de pagamento e periodo.
- Garantir acesso em 1 clique para iniciar nova venda (steps atuais).
- Disponibilizar detalhes e acoes por venda sem sair do contexto operacional.
- Reduzir retrabalho de consulta em outras telas para confirmar dados de venda.

## 3. User Stories

### US-001: Entrada do PDV passa a ser historico de vendas
**Description:** Como usuario do PDV, eu quero entrar no menu e ver o historico de vendas para consultar rapidamente o que acabou de ser vendido antes de iniciar novo atendimento.

**Acceptance Criteria:**
- [ ] A rota de entrada `"/pdv"` exibe a tela "Historico de Vendas" em vez do stepper.
- [ ] O cabecalho da tela exibe titulo, resumo (quantidade/total filtrado) e CTA "Nova venda".
- [ ] Nao existe redirecionamento automatico para os steps ao abrir `"/pdv"`.
- [ ] Typecheck/lint passes.
- [ ] Verify in browser using dev-browser skill.

### US-002: Filtros operacionais obrigatorios
**Description:** Como operador, eu quero filtrar o historico para localizar vendas por loja, estado, metodo de pagamento e periodo.

**Acceptance Criteria:**
- [ ] A tela possui filtros visiveis para Loja, Estado, Metodo de Pagamento e Periodo.
- [ ] Filtros podem ser combinados (AND logico) sem perder selecoes anteriores.
- [ ] Loja inicia com loja do usuario selecionada.
- [ ] Periodo inicia em "Hoje" e oferece alternancia rapida para "Ultimos 7 dias".
- [ ] Existe opcao de intervalo customizado de datas no filtro de periodo.
- [ ] Typecheck/lint passes.
- [ ] Verify in browser using dev-browser skill.

### US-003: Listagem de historico com detalhe
**Description:** Como operador, eu quero visualizar uma lista clara das vendas e abrir detalhes de uma venda para confirmar informacoes sem iniciar novo fluxo.

**Acceptance Criteria:**
- [ ] A listagem mostra no minimo: data/hora, identificador da venda, loja, vendedor, cliente, total, metodo(s) e estado.
- [ ] Clicar em uma venda abre painel/modal de detalhe com itens, pagamentos e dados de garantia.
- [ ] O detalhe e fechado sem perder filtros aplicados na listagem.
- [ ] Typecheck/lint passes.
- [ ] Verify in browser using dev-browser skill.

### US-004: Acoes por venda no historico
**Description:** Como usuario operacional, eu quero executar acoes por venda para resolver tarefas de pos-venda sem navegar para outras telas.

**Acceptance Criteria:**
- [ ] Cada item da lista possui menu de acoes com pelo menos: "Ver detalhe", "Imprimir comprovante" e "Cancelar venda".
- [ ] "Imprimir comprovante" reutiliza o fluxo de layout (80mm/A4) ja existente no PDV.
- [ ] "Cancelar venda" exige confirmacao explicita e motivo.
- [ ] "Cancelar venda" respeita permissao por perfil (admin permitido; demais perfis conforme regra definida).
- [ ] Apos cancelamento bem-sucedido, a linha da venda exibe estado atualizado.
- [ ] Typecheck/lint passes.
- [ ] Verify in browser using dev-browser skill.

### US-005: CTA Nova venda abre pagina de steps
**Description:** Como operador de caixa, eu quero clicar em "Nova venda" no topo para abrir imediatamente o fluxo de venda com steps.

**Acceptance Criteria:**
- [ ] Botao "Nova venda" fica no topo da tela de historico, com destaque visual.
- [ ] Clique em "Nova venda" abre a pagina de steps do PDV do zero.
- [ ] A pagina de steps preserva o comportamento atual de validacao por etapa.
- [ ] Typecheck/lint passes.
- [ ] Verify in browser using dev-browser skill.

### US-006: Estados criticos da experiencia
**Description:** Como usuario, eu quero feedback claro quando a lista esta carregando, vazia ou com erro para confiar na consulta.

**Acceptance Criteria:**
- [ ] Estado de carregamento exibe skeleton/loading apropriado.
- [ ] Estado vazio exibe mensagem contextual e CTA "Nova venda".
- [ ] Estado de erro exibe mensagem com opcao de tentar novamente.
- [ ] Typecheck/lint passes.
- [ ] Verify in browser using dev-browser skill.

### US-007: Cobertura de testes para regressao
**Description:** Como engenharia, eu quero testes automatizados dessa mudanca para reduzir regressao no PDV.

**Acceptance Criteria:**
- [ ] Teste valida que `"/pdv"` abre historico e nao o stepper.
- [ ] Teste valida filtros (loja, estado, metodo, periodo) com combinacao.
- [ ] Teste valida que "Nova venda" abre fluxo de steps.
- [ ] Teste valida acao de impressao a partir do historico.
- [ ] Teste valida fluxo de cancelamento com confirmacao.
- [ ] Typecheck/lint passes.

## 4. Functional Requirements

- FR-1: O sistema deve exibir Historico de Vendas como tela inicial da rota `"/pdv"`.
- FR-2: A tela inicial deve ter CTA principal "Nova venda" no topo.
- FR-3: Ao clicar em "Nova venda", o sistema deve abrir a pagina de steps do PDV em estado inicial.
- FR-4: O historico deve suportar filtro por Loja.
- FR-5: O historico deve suportar filtro por Estado da venda.
- FR-6: O historico deve suportar filtro por Metodo de pagamento.
- FR-7: O historico deve suportar filtro por Periodo com presets "Hoje" e "Ultimos 7 dias", alem de intervalo customizado.
- FR-8: Filtros devem ser aplicados em combinacao e refletidos imediatamente na listagem.
- FR-9: O sistema deve exibir detalhe completo de venda sem perder o contexto dos filtros.
- FR-10: A listagem deve suportar acao de impressao de comprovante reutilizando o fluxo atual.
- FR-11: A listagem deve suportar acao de cancelamento com confirmacao e motivo.
- FR-12: O cancelamento deve respeitar regra de permissao por perfil.
- FR-13: O sistema deve tratar estados de carregamento, vazio e erro como parte da experiencia principal.
- FR-14: Historico deve apresentar informacoes minimas de rastreabilidade (data/hora, id, loja, vendedor, cliente, total, metodo, estado).
- FR-15: A experiencia deve estar disponivel para todos os usuarios com acesso ao PDV.

## 5. Non-Goals (Out of Scope)

- Nao redesenhar o fluxo interno dos steps de venda (campos/regra de negocio atual).
- Nao alterar calculo financeiro de venda, cartao ou comissao nesta iteracao.
- Nao incluir exportacao CSV/PDF do historico completo nesta iteracao.
- Nao implementar relatorio gerencial avancado (BI, dashboards novos) nesta entrega.

## 6. Design Considerations (UX)

### 6.1 Objetivo de UX
Se a entrada do PDV mostrar historico filtravel com CTA "Nova venda" bem destacado, entao o operador ganha contexto operacional sem perder velocidade para abrir novo atendimento, medido por tempo de inicio de venda e taxa de consultas bem-sucedidas no proprio PDV.

### 6.2 Usuarios e contexto
- Operador de caixa: precisa consultar venda recente e iniciar nova venda rapidamente.
- Gerente/admin: precisa auditar e atuar em pos-venda (impressao/cancelamento).
- Contexto: operacao diaria, alto volume, uso em desktop e tablet.

### 6.3 Fluxo recomendado
1. Entrada: usuario acessa `"/pdv"` e ve Historico de Vendas.
2. Acao: aplica filtros (loja, estado, metodo, periodo).
3. Decisao: abre detalhe ou executa acao na venda (imprimir/cancelar).
4. Saida A: resolve tarefa de consulta/pos-venda.
5. Saida B: clica em "Nova venda" e segue para steps de venda.

### 6.4 Wireframe textual
Tela A - PDV Historico (`/pdv`)
- Topo:
  - Titulo: "Historico de Vendas"
  - Subtitulo: "Consulte, filtre e acione pos-venda"
  - CTA primario: `Nova venda`
- Barra de filtros:
  - Select Loja
  - Select Estado
  - Select Metodo de pagamento
  - Presets Periodo: `Hoje` | `Ultimos 7 dias`
  - Controle de intervalo customizado (data inicial/final)
  - Botao limpar filtros
- Lista/Tabela:
  - Colunas: Data/Hora | Venda | Loja | Vendedor | Cliente | Total | Metodo | Estado | Acoes
  - Acoes por linha: Ver detalhe | Imprimir comprovante | Cancelar venda
- Estados:
  - Loading: skeleton de linhas
  - Vazio: mensagem + CTA `Nova venda`
  - Erro: mensagem + botao `Tentar novamente`

Tela B - Nova venda (`/pdv/nova-venda` ou equivalente)
- Topo com titulo "Nova venda"
- Link secundario "Voltar ao historico"
- Stepper atual (Cliente/Vendedor, Produto/Troca, Pagamento) sem alteracao de regra

### 6.5 Microcopy principal
- Titulo: "Historico de Vendas"
- CTA: "Nova venda"
- Vazio: "Nenhuma venda encontrada com os filtros atuais."
- Erro: "Nao foi possivel carregar o historico. Tente novamente."
- Confirmacao cancelamento: "Deseja cancelar esta venda? Esta acao pode impactar estoque e financeiro."

## 7. Technical Considerations

- Pagina principal impactada: `pages/PDV.tsx` (introduzir modo historico + modo steps) ou separar em `PDVHistory` e `PDVSaleFlow`.
- Possivel ajuste de rotas em `App.tsx` para suportar `"/pdv"` (historico) e `"/pdv/nova-venda"` (steps).
- Navegacao e atalhos podem requerer ajuste em `components/Layout.tsx` (quick action "Nova venda").
- Fonte de dados: `sales`, `stores`, `sellers`, `customers` em `services/dataContext.tsx`.
- Definicao tecnica de "Estado da venda" deve mapear dados atuais (ex.: concluida, com devedor, garantia ativa/expirada ou cancelada).
- Cancelamento requer validacao de impacto em estoque, contas e rastreabilidade de auditoria.

## 8. Success Metrics

- Reduzir em 30% o tempo medio para localizar uma venda recente no fluxo operacional.
- Manter inicio de nova venda em no maximo 1 clique a partir de `"/pdv"`.
- Pelo menos 80% das consultas de vendas recentes resolvidas sem sair do modulo PDV.
- Zero regressao funcional nos steps existentes de venda.
- Taxa de erro de operacao (venda errada/duplicada por falta de consulta) em queda apos lancamento.

## 9. Plano de Validacao (UX + Produto)

- Teste rapido moderado com 5 usuarios (3 operadores, 2 gestores).
- Tarefas de validacao:
  - Encontrar uma venda de hoje por metodo de pagamento.
  - Encontrar uma venda dos ultimos 7 dias e abrir detalhe.
  - Reimprimir comprovante de uma venda.
  - Iniciar nova venda em ate 1 clique.
- Criterios de sucesso:
  - >= 90% concluem tarefas sem ajuda.
  - Tempo medio para achar uma venda <= 20s.
  - Zero confusao recorrente entre "Historico" e "Nova venda".

## 10. Open Questions

- O filtro "Estado" deve usar quais valores finais no dominio de negocio (incluindo cancelada)?
- Qual regra definitiva de permissao para cancelar venda por perfil alem de admin?
- Cancelamento deve reverter estoque e financeiro automaticamente nesta mesma entrega?
- A rota tecnica para steps sera `"/pdv/nova-venda"` ou controle interno de modo na mesma rota?

