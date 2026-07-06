# Seguranca de Transferencias Financeiras

## Contexto

A transferencia entre `Conta Bancaria` e `Cofre` usa a RPC
`public.transfer_between_accounts`. O contrato tabular da RPC foi restaurado, mas a
revisao encontrou tres riscos ainda abertos:

1. duas transferencias simultaneas podem validar o mesmo saldo antes dos inserts;
2. Realtime e a resposta da RPC podem adicionar as mesmas transacoes ao estado local;
3. o historico remoto registra quatro migrations locais como pendentes, embora parte
   do SQL ja tenha sido aplicada diretamente.

O objetivo e eliminar esses riscos sem indisponibilidade e sem marcar migrations como
aplicadas antes de comprovar equivalencia entre o schema remoto e o estado local.

## Escopo

### Incluido

- Serializar transferencias concorrentes pela conta de origem.
- Tornar a incorporacao das transacoes idempotente no estado React.
- Cobrir o contrato da migration e a ordem RPC/Realtime com testes automatizados.
- Auditar e reconciliar individualmente as quatro migrations pendentes.
- Fazer o smoke de migrations falhar quando detectar pendencia ou drift real.
- Validar RPC, autorizacao, atomicidade e ausencia de dados de teste no Supabase remoto.

### Excluido

- Refatoracao ampla do `DataProvider`.
- Correcao do teste independente `crm-ios-layout-contract.test.ts`.
- Alteracoes no workflow n8n.

## Desenho

### 1. Serializacao no banco

A implementacao privada da RPC adquire um advisory lock transacional antes de calcular
o saldo. A chave deriva de um namespace fixo e da conta de origem. O PostgreSQL libera
o lock automaticamente no commit ou rollback.

Isso serializa chamadas que disputam o mesmo saldo sem bloquear transferencias que
partem de contas diferentes. A validacao de saldo permanece no banco, imediatamente
antes do insert atomico das duas pernas.

### 2. Estado idempotente no cliente

O modulo puro `services/data/realtime/realtimeState.ts` passa a expor uma operacao para
incorporar varias linhas por `id`, reutilizando `upsertById`. Tanto o callback Realtime
quanto `transferBetweenAccounts` usam a mesma operacao.

Assim, a ordem dos eventos deixa de importar:

- RPC primeiro, Realtime depois: o evento atualiza a linha existente;
- Realtime primeiro, RPC depois: a resposta da RPC atualiza a linha existente;
- repeticao do mesmo evento: a quantidade de transacoes nao aumenta.

### 3. Rede de testes

O ciclo sera RED, GREEN, REFACTOR:

- teste puro para merge de multiplas transacoes, incluindo IDs repetidos;
- teste do `DataProvider` para resposta tabular da RPC;
- teste do contrato SQL exigindo lock antes da consulta de saldo;
- verificacao funcional remota dentro de transacao com rollback;
- verificacao do PostgREST para confirmar descoberta da RPC e bloqueio de nao-admin.

O teste textual de migration continua como guarda rapida, mas nao sera tratado como
prova unica de SQL executavel.

### 4. Reconciliacao das migrations

As pendencias serao tratadas uma a uma:

1. consultar o catalogo remoto e as policies afetadas;
2. comparar o efeito esperado de cada migration com o estado atual;
3. aplicar somente o SQL ausente, usando a migration final como fonte versionada;
4. usar `supabase migration repair --status applied` apenas para uma versao cuja
   equivalencia tenha sido demonstrada;
5. repetir `supabase migration list --linked` e o smoke ate nao haver pendencias.

A migration ampla `20260705120000_finance_integrity_guards` nao sera executada
cegamente. Seus guardas nao relacionados a transferencia serao verificados antes de
qualquer reparo do historico.

### 5. Migration health como gate

O script `scripts/smoke/migration-health.mjs` continua gerando JSON e Markdown, mas
encerra com status diferente de zero quando ocorrer qualquer uma destas condicoes:

- leitura remota indisponivel ou com erro;
- migration local pendente;
- drift de versao;
- migration existente apenas no remoto.

Isso transforma o relatorio em gate verificavel para CI e operacao manual.

## Seguranca e rollback

- A escrita privilegiada permanece em schema privado com `security definer` e
  `search_path` fixo.
- A funcao publica permanece `security invoker` e executavel apenas por
  `authenticated`.
- A verificacao de administrador continua consultando `public.current_role()` com
  comparacao segura para `NULL`.
- Testes remotos usam transacao e rollback; nenhum lancamento de teste permanece.
- Antes de reconciliar o ledger, o estado atual das funcoes e policies e registrado
  por consultas de catalogo para permitir diagnostico e recuperacao.

## Criterios de aceite

1. Duas transferencias da mesma origem nao conseguem consumir o mesmo saldo.
2. Cada perna aparece uma unica vez no estado local, independentemente da ordem dos
   eventos RPC e Realtime.
3. A RPC retorna duas linhas com um unico `transfer_group_id`.
4. Chamadas sem perfil administrador continuam bloqueadas.
5. O relatorio de migrations termina sem pendencias, drift ou itens apenas remotos.
6. `smoke:migrations` retorna erro quando uma pendencia controlada e introduzida.
7. Testes financeiros, typecheck, lint e build passam; avisos preexistentes sao
   relatados separadamente.

