# PRD: Configuracoes em Abas com Gestao de Usuarios, Log de Atividades e Permissoes

## 0. Perguntas de Clarificacao (com respostas assumidas)

1. Como deve ficar a divisao da tela de Configuracoes?
   A. Separar em abas: Menu, Senhas e Contas, Log de Usuarios e Permissoes e Privacidade.
   B. Manter uma unica tela longa.
   C. Criar telas separadas por rota.
   D. Outro.

Resposta assumida: **A**.

2. Qual perfil pode acessar "Senhas e Contas", "Log de Usuarios" e "Permissoes e Privacidade"?
   A. Apenas admin.
   B. Admin e gerente.
   C. Todos os usuarios autenticados.
   D. Outro.

Resposta assumida: **A**.

3. Como deve funcionar o cadastro de novo usuario na aba "Senhas e Contas"?
   A. Modal com nome, email, senha e funcao (admin/gerente/vendedor), criando usuario Auth com email ja confirmado.
   B. Cadastro sem senha e com convite por email.
   C. Reaproveitar tela de vendedores para tudo.
   D. Outro.

Resposta assumida: **A**.

4. O que o admin precisa ver no log de usuarios?
   A. Lista por usuario com historico cronologico em modal com motion, cobrindo vendas, financeiro, cancelamentos, estoque e navegacao.
   B. Apenas ultimo login.
   C. Apenas eventos de erro.
   D. Outro.

Resposta assumida: **A**.

5. Qual a expectativa da aba "Permissoes e Privacidade"?
   A. Matriz por funcao (admin/gerente/vendedor) com switches de visivel/editavel/excluivel por modulo.
   B. Apenas leitura sem edicao.
   C. Apenas permissao de visualizacao.
   D. Outro.

Resposta assumida: **A**.

## 1. Introducao

A tela atual de Configuracoes concentra diferentes responsabilidades em uma unica pagina e nao possui gestao consolidada de usuarios, trilha de auditoria por usuario nem controle granular de permissao por funcao.

Esta entrega organiza Configuracoes em abas e adiciona dois pilares administrativos: auditoria de movimentos e matriz de permissoes por funcao.

## 2. Goals

- Estruturar Configuracoes em abas com foco de uso e clareza.
- Restringir areas sensiveis para acesso exclusivo de admin.
- Permitir criar usuarios Auth com funcao operacional (admin, gerente, vendedor) sem confirmacao por email.
- Oferecer visao cronologica de atividades por usuario com destaque para vendas, financeiro, cancelamentos e estoque.
- Permitir configuracao de visibilidade/edicao/exclusao por funcao, com persistencia.

## 3. User Stories

### US-001: Navegacao por abas em Configuracoes
**Description:** Como usuario, eu quero ver Configuracoes separada por abas para encontrar opcoes com mais rapidez.

**Acceptance Criteria:**
- [ ] A tela `/settings` exibe abas claramente identificadas.
- [ ] A aba `Menu` permanece acessivel para perfis nao-admin.
- [ ] Abas administrativas aparecem somente para admin.
- [ ] Typecheck/build passam.
- [ ] Verify in browser using dev-browser skill.

### US-002: Restricao da aba Senhas e Contas
**Description:** Como admin, eu quero que a aba `Senhas e Contas` seja exclusiva para administradores para evitar alteracoes sensiveis por perfis comuns.

**Acceptance Criteria:**
- [ ] Usuario nao-admin nao visualiza nem acessa `Senhas e Contas`.
- [ ] Admin consegue alterar dados da propria conta e senha na mesma aba.
- [ ] Typecheck/build passam.
- [ ] Verify in browser using dev-browser skill.

### US-003: Criacao de usuario com funcao operacional
**Description:** Como admin, eu quero criar usuario por modal e escolher funcao (admin/gerente/vendedor) para ativar acesso sem dependencia de confirmacao por email.

**Acceptance Criteria:**
- [ ] Existe botao `Criar usuario` na aba `Senhas e Contas`.
- [ ] Modal exige nome, email, senha e funcao.
- [ ] Provisionamento usa Auth admin API com `email_confirm: true`.
- [ ] Fluxo suporta funcoes `admin`, `gerente`, `vendedor`.
- [ ] Typecheck/build passam.
- [ ] Verify in browser using dev-browser skill.

### US-004: Log de usuarios por trilha cronologica
**Description:** Como admin, eu quero abrir um modal cronologico por usuario para auditar movimentos do app.

**Acceptance Criteria:**
- [ ] Nova aba `Log de usuarios` visivel apenas para admin.
- [ ] Lista de usuarios permite abrir modal de historico.
- [ ] Modal mostra eventos ordenados por data/hora com motion.
- [ ] Eventos exibem categoria (vendas, financeiro, cancelamentos, estoque, navegacao), descricao e metadados relevantes.
- [ ] Typecheck/build passam.
- [ ] Verify in browser using dev-browser skill.

### US-005: Permissoes e Privacidade por funcao
**Description:** Como admin, eu quero editar o que cada funcao pode visualizar, editar e excluir para reduzir risco operacional.

**Acceptance Criteria:**
- [ ] Nova aba `Permissoes e Privacidade` visivel apenas para admin.
- [ ] Matriz separada por funcao (`admin`, `gerente`, `vendedor`) e por modulo.
- [ ] Cada item possui switches de `visivel`, `editavel`, `excluivel`.
- [ ] Persistencia em banco e recarregamento das permissoes no app.
- [ ] Modulos ocultos deixam de aparecer na navegacao e bloqueiam acesso por rota.
- [ ] Typecheck/build passam.
- [ ] Verify in browser using dev-browser skill.

### US-006: Persistencia de papeis operacionais
**Description:** Como sistema, eu quero persistir o papel operacional (admin/gerente/vendedor) para identificar corretamente o perfil de cada usuario.

**Acceptance Criteria:**
- [ ] Existe estrutura de dados para armazenar papel operacional por usuario.
- [ ] Login resolve corretamente o papel operacional da sessao.
- [ ] Perfis existentes continuam funcionando com fallback seguro.
- [ ] Typecheck/build passam.

### US-007: Log tecnico de eventos do app
**Description:** Como sistema, eu quero registrar eventos de uso para alimentar auditoria por usuario.

**Acceptance Criteria:**
- [ ] Existe tabela para armazenar eventos de atividade com usuario, categoria, acao e timestamp.
- [ ] Eventos rastreados sao persistidos de forma nao bloqueante.
- [ ] Admin consulta eventos por usuario e periodo recente.
- [ ] Typecheck/build passam.

## 4. Functional Requirements

- FR-1: `/settings` deve usar abas internas com pelo menos `Menu` e `Senhas e Contas`.
- FR-2: `Senhas e Contas` deve ser acessivel apenas por `admin`.
- FR-3: A aba `Senhas e Contas` deve conter alteracao de senha.
- FR-4: A aba `Senhas e Contas` deve conter CTA `Criar usuario` e modal de provisionamento Auth.
- FR-5: O provisionamento deve aceitar `admin`, `gerente`, `vendedor` e confirmar email automaticamente.
- FR-6: Deve existir aba `Log de usuarios` somente para admin.
- FR-7: O modal de historico deve listar eventos em ordem cronologica com motion.
- FR-8: Deve existir aba `Permissoes e Privacidade` somente para admin.
- FR-9: A matriz deve conter controles de `visivel`, `editavel`, `excluivel` por funcao e modulo.
- FR-10: Permissao `visivel` deve refletir na navegacao e em bloqueio de rota.
- FR-11: O sistema deve persistir papel operacional de usuario de forma consultavel no frontend.
- FR-12: O sistema deve persistir logs de atividades com contexto minimo (usuario, categoria, acao, tela, metadata, data).

## 5. Non-Goals

- Nao implementar aprovacao em duas etapas para alteracao de permissao.
- Nao criar motor completo de autorizacao backend por acao de negocio nesta iteracao.
- Nao substituir os modulos atuais de vendedores/lojas.
- Nao implementar exportacao CSV/PDF do log nesta fase.

## 6. Design Considerations

- Aba ativa com destaque claro e navegacao sem scroll excessivo.
- Modal de historico com leitura rapida (timeline, badges de categoria e timestamps).
- Estados vazios explicitos para ausencia de usuarios e logs.
- Em `Permissoes e Privacidade`, usar linguagem objetiva por modulo para reduzir erro de configuracao.

## 7. Technical Considerations

- Frontend:
  - Refatorar `pages/Settings.tsx` para layout em abas.
  - Introduzir contexto/hook de permissoes para uso em menu e rotas.
  - Atualizar `AuthContext` para resolver papel operacional.
- Backend/Supabase:
  - Nova migration para tabelas de papel operacional, permissoes e log de atividade.
  - Ajustar Edge Function `admin-provision-user` para aceitar funcao `gerente`.
- Compatibilidade:
  - Garantir fallback para usuarios antigos sem registro de papel operacional.
  - Manter `admin` como unica funcao capaz de alterar permissoes.

## 8. Success Metrics

- 100% dos admins conseguem acessar as quatro abas esperadas em Configuracoes.
- 100% dos usuarios nao-admin nao conseguem abrir abas administrativas.
- Cadastro de novo usuario com funcao operacional concluido sem confirmacao de email.
- Logs de atividade exibindo eventos reais para pelo menos vendas, financeiro, cancelamentos e estoque.
- Permissoes de visibilidade refletidas no menu e no acesso por rota.

## 9. Open Questions

- Gerente deve ter escopo de dados igual a vendedor ou intermediario entre vendedor e admin?
- Precisamos permitir desativacao/bloqueio de usuarios existentes nesta tela?
- Em proxima iteracao, o controle `editavel/excluivel` deve ser aplicado em backend (RLS/funcoes) alem de UI?
