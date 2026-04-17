# PRD: Smoke Test Automatizado de Todos os Botoes dos Menus + Diagnostico de Migrations

## 1. Introduction/Overview

Este PRD define uma suite de smoke test automatizada (Playwright) para clicar e validar os botoes de cada menu/pagina do app, cobrindo os perfis `admin` e `seller`. O objetivo e detectar rapidamente regressao funcional e correlacionar falhas com migrations pendentes ou migrations aplicadas com comportamento incorreto.

As decisoes de escopo para este PRD sao:
- Objetivo principal: navegacao + efeitos no banco (1B)
- Escopo: todas as paginas do app para admin e seller (2A)
- Execucao: automatizada E2E com Playwright (3B)
- Diagnostico de migrations: comparacao tecnica + impacto funcional (4C)
- Saida: lista priorizada por severidade P0/P1/P2 (5B)

## 2. Goals

- Garantir smoke coverage de navegacao e botoes de acao por menu para `admin` e `seller`.
- Detectar migrations pendentes comparando `supabase/migrations` local com `supabase_migrations.schema_migrations` remoto.
- Detectar sintomas de migration em mal funcionamento durante fluxo funcional (erro SQL, RPC, coluna/constraint ausente, trigger ausente).
- Produzir relatorio unico priorizado por severidade para decisao rapida de correcao.

## 3. User Stories

### US-001: Inventario de telas e botoes por role
**Description:** Como QA/engenharia, quero um inventario versionado de telas e botoes por role para garantir cobertura de smoke clara e rastreavel.

**Acceptance Criteria:**
- [ ] Existe arquivo de inventario com rotas do `admin` e `seller` (incluindo menus principais e CRM).
- [ ] Cada rota lista botoes/acoes candidatas ao smoke com seletor estavel.
- [ ] Cada item do inventario esta marcado com tipo de acao: `navigation`, `create`, `update`, `delete`, `modal`, `external`.

### US-002: Contrato de seletores para automacao estavel
**Description:** Como engenheiro de testes, quero seletores estaveis para reduzir flakiness e manter os testes resilientes a mudancas visuais.

**Acceptance Criteria:**
- [ ] Botoes criticos possuem `data-testid` ou seletor semanticamente estavel.
- [ ] Nenhum passo critico depende apenas de seletor fragil por texto ambiguo.
- [ ] Guia de convencao de seletores documentado no repositorio.

### US-003: Suite Playwright com sessao por role
**Description:** Como QA, quero executar smoke em paralelo para `admin` e `seller` para validar permissoes e fluxos basicos de ponta a ponta.

**Acceptance Criteria:**
- [ ] Suite Playwright configurada com projeto `admin` e projeto `seller`.
- [ ] Login automatizado para ambos os perfis sem etapa manual.
- [ ] Cada projeto registra artifacts minimos (trace em falha + screenshot em falha).

### US-004: Smoke de navegacao de todos os menus
**Description:** Como usuario, quero que cada item de menu carregue sem erro para garantir operacao basica do app.

**Acceptance Criteria:**
- [ ] Todos os menus permitidos por role sao clicados ao menos uma vez no fluxo.
- [ ] Cada rota valida carregamento de elemento ancora da pagina (header, titulo ou container principal).
- [ ] Falhas de carregamento sao registradas com URL, role e stack/console associado.

### US-005: Smoke de botoes de cada menu/pagina
**Description:** Como operador, quero validar que botoes principais de cada tela executam acao minima esperada sem quebra de banco.

**Acceptance Criteria:**
- [ ] Cada pagina possui lista de botoes principais cobertos (acao primaria + secundarias relevantes).
- [ ] Para cada botao coberto, o teste valida resultado minimo observavel (ex.: modal abriu, registro criou, filtro aplicou, navegou).
- [ ] Acoes destrutivas rodam em modo seguro (massa isolada ou dry-run quando aplicavel).

### US-006: Verificacao tecnica de migrations pendentes
**Description:** Como dev, quero saber se existem migrations locais nao aplicadas no ambiente alvo para eliminar drift de schema.

**Acceptance Criteria:**
- [ ] Job coleta migrations locais por versao (prefixo timestamp dos arquivos SQL).
- [ ] Job consulta `supabase_migrations.schema_migrations` no banco alvo.
- [ ] Relatorio lista migrations pendentes com versao, nome e ordem de aplicacao.

### US-007: Correlacao de falhas funcionais com suspeita de migration
**Description:** Como dev, quero correlacionar falha de botao/fluxo com possivel origem de migration para acelerar triagem.

**Acceptance Criteria:**
- [ ] Falhas de smoke sao classificadas por tipo (schema missing, RPC missing, policy/RLS, constraint, trigger, timeout).
- [ ] Cada falha recebe hipoteses de migration suspeita com evidencias objetivas (erro SQL/log/objeto ausente).
- [ ] Cada falha recebe severidade P0/P1/P2 e acao recomendada.

### US-008: Relatorio final priorizado para execucao
**Description:** Como gestor tecnico, quero um output unico priorizado por severidade para decidir correcoes imediatas.

**Acceptance Criteria:**
- [ ] Saida final e uma lista ordenada por `P0 -> P1 -> P2`.
- [ ] Cada item inclui: rota, botao, role, erro, impacto, migration pendente/suspeita, recomendacao.
- [ ] O pipeline retorna status falho quando existir item P0.

## 4. Functional Requirements

- FR-1: O sistema deve executar smoke E2E para dois perfis (`admin`, `seller`) com suites separadas.
- FR-2: O sistema deve percorrer todas as rotas de menu permitidas por perfil no app principal.
- FR-3: O sistema deve percorrer rotas CRM disponiveis para cada perfil conforme regras de acesso.
- FR-4: O sistema deve clicar botoes principais por pagina e validar efeito minimo esperado.
- FR-5: O sistema deve registrar console errors e network failures durante cada passo.
- FR-6: O sistema deve extrair versoes de migrations locais de `supabase/migrations/*.sql`.
- FR-7: O sistema deve consultar versoes aplicadas no banco em `supabase_migrations.schema_migrations`.
- FR-8: O sistema deve calcular `pending = local - remote` e incluir no relatorio.
- FR-9: O sistema deve classificar falhas funcionais com heuristica de causa provavel ligada a migration.
- FR-10: O sistema deve gerar relatorio final somente em formato priorizado por severidade (P0/P1/P2).

## 5. Non-Goals (Out of Scope)

- Nao cobrir validacao exaustiva de regra de negocio de cada formulario.
- Nao executar testes de performance/carga.
- Nao substituir suite de testes unitarios/integracao existente.
- Nao corrigir automaticamente migrations durante o smoke (apenas diagnosticar e priorizar).
- Nao cobrir navegadores alem do baseline definido para a primeira versao (ex.: Chromium apenas).

## 6. Design Considerations

- Preferir visibilidade de diagnostico: falha deve ser autoexplicativa em uma leitura.
- Padronizar nome de passos com `role + rota + botao` para busca rapida nos logs.
- Exibir timeline curta por falha: `acao -> erro -> objeto ausente -> migration suspeita`.

## 7. Technical Considerations

- Framework: Playwright com projetos por role (`admin`, `seller`).
- Massa de teste: usuarios dedicados e dados de smoke isolados para evitar dano operacional.
- Diagnostico de migration pendente: diff entre arquivos locais e `schema_migrations` remoto.
- Diagnostico de migration mal funcionamento: correlacao entre erro de runtime e objetos esperados (tabela, coluna, RPC, trigger, policy).
- Recomendado expor script utilitario de auditoria de migrations para uso local e CI.

## 8. Success Metrics

- 100% das rotas de menu acessiveis por role cobertas por smoke.
- >= 90% dos botoes principais por pagina cobertos na primeira iteracao.
- Tempo total da suite <= 15 minutos em CI.
- 100% das falhas de smoke com classificacao de severidade e suspeita de migration.
- Zero falhas P0 sem abertura de item de acao no relatorio final.

## 9. Open Questions

- O ambiente alvo do smoke sera producao, staging ou branch DB dedicada?
- Qual politica para acoes destrutivas em telas administrativas (delete/cancel): executar com dados fake ou apenas dry-run?
- O baseline inicial inclui CRM standalone host alem das rotas `/crm/*` no app principal?
- Qual sera a fonte de credenciais em CI para consultar `schema_migrations` com seguranca?
