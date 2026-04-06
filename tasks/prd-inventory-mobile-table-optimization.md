# PRD: Otimizacao da Tabela de Estoque para Mobile

## Introducao / Overview

A tabela de estoque atual exige scroll lateral no celular para visualizar colunas criticas. Esta melhoria reduz a largura necessaria da tabela mobile, concentra as informacoes mais importantes em `Dispositivo` e remove redundancias de acao.

Hipotese principal de UX:
- Se consolidarmos `estado` e `bateria` dentro da coluna `Dispositivo` e reduzirmos colunas secundarias no mobile, entao a leitura e operacao do estoque em telas pequenas sera mais rapida, medida por menor necessidade de scroll lateral e menor tempo para localizar um item.

## Goals

- Reduzir ao maximo o scroll lateral na tabela de estoque mobile.
- Manter as informacoes essenciais visiveis sem abrir detalhes.
- Remover redundancia da acao `Detalhes` quando ja existe acesso por clique no item.
- Preservar clareza e eficiencia na versao desktop.

## User Stories

### US-001: Remover coluna Status da tabela
**Description:** Como usuario da tela de estoque, quero uma tabela com menos colunas para enxergar melhor os dados no celular.

**Acceptance Criteria:**
- [ ] A coluna `Status` nao aparece na tabela desktop.
- [ ] A coluna `Status` nao aparece na tabela mobile.
- [ ] Nao ha regressao de filtros por status.
- [ ] Typecheck/lint passes.
- [ ] Verify in browser using dev-browser skill.

### US-002: Consolidar estado e bateria em Dispositivo
**Description:** Como usuario de estoque, quero ver estado do aparelho e saude da bateria junto do nome/modelo para decidir rapidamente sem varrer varias colunas.

**Acceptance Criteria:**
- [ ] `Estado` e `Bateria` deixam de existir como colunas separadas.
- [ ] `Dispositivo` exibe modelo, caracteristicas basicas, estado e bateria no mesmo bloco.
- [ ] Para aparelho novo, bateria aparece como 100%.
- [ ] Para seminovo, bateria exibida com sinal visual de saude (boa/atencao/critica).
- [ ] Typecheck/lint passes.
- [ ] Verify in browser using dev-browser skill.

### US-003: Simplificar acao da linha removendo Detalhes
**Description:** Como usuario, quero menos botoes por linha para reduzir ruido visual, mantendo o fluxo de abrir detalhes ao clicar no item.

**Acceptance Criteria:**
- [ ] Botao `Detalhes` removido da coluna de acao.
- [ ] Clique no item continua abrindo o modal de detalhes.
- [ ] Botao `Editar` permanece funcional.
- [ ] Typecheck/lint passes.
- [ ] Verify in browser using dev-browser skill.

### US-004: Melhorar responsividade da tabela mobile
**Description:** Como usuario mobile, quero abrir a tabela e ler os principais dados sem precisar arrastar horizontalmente na maioria dos casos.

**Acceptance Criteria:**
- [ ] Colunas secundarias (ex.: loja, IMEI, caixa) ficam ocultas no mobile.
- [ ] Largura minima fixa da tabela nao bloqueia a visualizacao mobile.
- [ ] Texto e badges no bloco `Dispositivo` quebram/encaixam sem overflow visual.
- [ ] Typecheck/lint passes.
- [ ] Verify in browser using dev-browser skill.

## Functional Requirements

- FR-1: O sistema deve remover a coluna `Status` do cabecalho e do corpo da tabela de estoque.
- FR-2: O sistema deve remover as colunas `Estado` e `Bateria` e exibir ambos dentro da celula `Dispositivo`.
- FR-3: A celula `Dispositivo` deve incluir, no minimo, modelo, caracteristicas (capacidade/cor), estado e informacao de bateria.
- FR-4: O sistema deve remover o botao `Detalhes` da coluna de acao.
- FR-5: O clique no item da coluna `Dispositivo` deve continuar abrindo o modal de detalhes.
- FR-6: No mobile, o sistema deve ocultar colunas de menor prioridade (`Loja`, `IMEI`, `Caixa`).
- FR-7: O sistema deve manter `Editar` disponivel por linha.

## Non-Goals (Out of Scope)

- Redesenho completo da pagina de estoque.
- Alteracao de regras de negocio de status/filtros.
- Alteracao de backend, banco de dados ou contratos de API.
- Mudancas no modal de detalhes fora do necessario para manter compatibilidade.

## Design Considerations

- Hierarquia de leitura no mobile: `modelo` > `caracteristicas` > `estado/bateria` > `observacoes`.
- Uso de badges e contraste para leitura rapida em contexto de loja.
- Reducao de carga cognitiva removendo acao redundante (`Detalhes`).

## Technical Considerations

- Implementacao centrada em `pages/Inventory.tsx`.
- Responsividade via utilitarios CSS existentes (`hidden md:table-cell`).
- Nenhuma migracao de dados necessaria.

## Success Metrics

- Em viewport mobile, a tabela fica operacional sem exigir scroll lateral na maior parte dos cenarios.
- Menor numero de toques para chegar em detalhes do aparelho (sem botao intermediario).
- Ausencia de regressao funcional em abrir detalhes, editar item e aplicar filtros.

## Open Questions

- Em uma iteracao futura, vale avaliar troca da tabela mobile por cards para zero scroll lateral em 100% dos casos.
