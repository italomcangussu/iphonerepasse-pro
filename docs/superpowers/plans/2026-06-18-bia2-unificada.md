# Fusão Bia 2 unificada — Plano de Implementação

> **Para workers agênticos:** SUB-SKILL OBRIGATÓRIA: usar superpowers:executing-plans (execução inline). Passos usam checkbox (`- [ ]`).

**Goal:** Fundir `Bia 2 ESTOQUE` + `Bia 2 SEM ESTOQUE ` num único agente Bia 2 no workflow vivo `Cr4fPWe0prwS6XjI`, sem regressão de comportamento.

**Architecture:** Refactor estrutural ("dois chapéus" do uncle-bob — só estrutura, comportamento idêntico). Sobrevivente = `Bia 2 ESTOQUE` (identificador interno preservado → não quebra ~450 refs `$('Nome')` + 25 patches). Transforma-se o `workflow.json` LOCAL (união de prompt + repointe de 3 conexões + remoção de 13 nós), valida-se LOCALMENTE (validar cedo/sempre — n8n-validation-expert), e só então PUT único para o vivo (padrão de patch cirúrgico, pois `repasse-maint deploy` NÃO carrega mudança de topologia/prompt-expressão — `compose()` só faz splice de código/prompt-estático sobre o vivo fresco).

**Tech Stack:** n8n REST (`X-N8N-API-KEY`), Node ESM, helpers puros de `scripts/n8n/tool/` (`deploy_body.mjs` → `buildPutBody`/`buildSettings`; `extract.mjs` → `structuralErrors`; `netio.mjs`), `node --test`, `smoke-step.mjs`.

## Global Constraints
- **NUNCA renomear nós** — manter o identificador `Bia 2 ESTOQUE` no nó sobrevivente.
- **node via nvm:** `export NVM_DIR="$HOME/.nvm"; . "$NVM_DIR/nvm.sh"` antes de qualquer node/npm.
- **Guard primeiro:** rodar `guard-live-workflow-sync.mjs` antes de tocar no vivo; o hook PreToolUse pode disparar sozinho.
- **PUT só com allowlist de settings** + `timeSavedMode` removido (via `buildPutBody`). Credenciais por referência de ID, nunca valor cru.
- **Comportamento idêntico:** nenhuma mudança de voz/regra; só estrutura. Saída por cenário equivalente ao baseline.
- **Branch:** trabalho na `main` (consentido pelo usuário); commits com rodapé de co-autoria.
- **n8n-workflow-patterns:** padrão AI Agent (Model + Memory + Agent → parser); iterar, não fazer one-shot; validar antes de ativar; nomes descritivos; tratar caso de dados vazios.
- **n8n-validation-expert:** validar cedo/sempre; corrigir erros antes de warnings; nunca ativar/deployar com erro; checar integridade de conexões (sem "node inexistente"); loop validar→corrigir→validar.

---

## File Structure
- `scripts/n8n/transform-bia2-merge.mjs` (CRIAR) — transforma o `workflow.json` LOCAL: união de prompt no nó sobrevivente + repointe de 3 conexões + remoção de 13 nós. Idempotente. `--in/--out` para arquivos; sem I/O de rede.
- `scripts/n8n/deploy-bia2-merge.mjs` (CRIAR) — GET fresco do vivo, checa drift vs `n8n/ia-repasse-pro-v2/nodes/.snapshot.json`, PUT do workflow transformado via `buildPutBody`, `/activate`, re-pull. `DRY=1` previa.
- `scripts/n8n/tool/tests/bia2-merge.test.mjs` (CRIAR) — caracterização: roda `transform` sobre o `workflow.json` atual e trava a topologia/contrato resultante (nós removidos ausentes, 3 conexões repontadas, `structuralErrors`=[], invariantes de prompt do nó unificado por cenário).
- `n8n/ia-repasse-pro-v2/workflow.json` (MODIFICAR via transform + re-pull).
- `n8n/ia-repasse-pro-v2/README.md` (MODIFICAR) — changelog da fusão + mapa de duplicação atualizado.
- `output/n8n/baselines/2026-06-18-bia2/*` (CRIAR) — snapshots de baseline dos 4 cenários ao vivo.
- `memory/n8n-bia2-unificada.md` + `MEMORY.md` (CRIAR/ATUALIZAR).

---

## Task 1: Baseline verde + captura de comportamento

**Files:** nenhum (leitura/execução).

- [ ] **Step 1: Guard + pull (sem drift)**
```bash
export NVM_DIR="$HOME/.nvm"; . "$NVM_DIR/nvm.sh"
node scripts/n8n/guard-live-workflow-sync.mjs
node scripts/n8n/repasse-maint.mjs pull
node scripts/n8n/repasse-maint.mjs status
```
Esperado: guard sincronizado; `status` sem edição local pendente.

- [ ] **Step 2: Suíte verde (linha de base de testes)**
```bash
node --test scripts/n8n/tool/tests/
```
Esperado: todos verdes. Se vermelho, PARAR e reportar (n8n-validation-expert: nunca prosseguir com erro).

- [ ] **Step 3: Capturar baseline ao vivo dos 4 cenários** (antes de qualquer mudança)
Rodar `smoke-step.mjs` para cada roteiro e salvar a reply + diagnostics (rota, Bia que rodou, Simulador) em `output/n8n/baselines/2026-06-18-bia2/`:
  1. `compra+troca+entrada` (VD) → chega ao Simulador.
  2. `faq-pos-venda` (garantia) → sem transferência indevida.
  3. `cidade-pos-sim` (`ask_pickup_city_after_sim`).
  4. `fora-escopo/HDI` ou `tradein_condition_human_eval`.
```bash
mkdir -p output/n8n/baselines/2026-06-18-bia2
WIPE_MSGS=1 node scripts/n8n/smoke-step.mjs reset
# ... sequência de `say` por cenário; redirecionar saída para os arquivos de baseline
```
Esperado: 4 baselines salvos (referência de "antes" para comparar no Task 7).

---

## Task 2: Verificar paridade POST2 ≡ POST4 (risco crítico §2.5 do spec)

**Files:** leitura de `n8n/ia-repasse-pro-v2/workflow.json`.

- [ ] **Step 1: Extrair config de envio dos dois nós**
```bash
export NVM_DIR="$HOME/.nvm"; . "$NVM_DIR/nvm.sh"
node -e '
const fs=require("fs");const wf=JSON.parse(fs.readFileSync("n8n/ia-repasse-pro-v2/workflow.json","utf8"));
const f=n=>wf.nodes.find(x=>x.name===n);
for(const nm of ["CRM Leads POST2","CRM Leads POST4"]){
  const nd=f(nm);
  console.log("====",nm,"====");
  console.log(JSON.stringify({type:nd.type,method:nd.parameters?.method,url:nd.parameters?.url,
    auth:nd.parameters?.authentication,headerAuth:nd.parameters?.nodeCredentialType,
    credentials:nd.credentials,sendHeaders:nd.parameters?.sendHeaders,
    headerParams:nd.parameters?.headerParameters,bodyParams:nd.parameters?.jsonBody??nd.parameters?.bodyParameters},null,1));
}'
```
- [ ] **Step 2: Decidir**
  - Se **credencial/método/URL/headers/body equivalentes** → consolidar em POST2 é seguro; seguir.
  - Se **POST2 divergir** (ex.: sem a credencial httpHeaderAuth que o POST4 ganhou) → ANTES de remover o POST4, alinhar o POST2 (incluir no transform) ou rever qual pipeline sobrevive. Documentar a decisão no commit.
Esperado: decisão registrada; nenhum risco de auth carregado adiante.

---

## Task 3: Varredura de referências órfãs aos 13 nós a remover

**Files:** leitura de `workflow.json` + `scripts/n8n/*.mjs`.

Nós-alvo de remoção: `Bia 2 SEM ESTOQUE `, `Postgres Chat Memory2`, `OpenRouter Chat Model4`, `Edit Fields13`, `Code Parse Bia 2 SEM ESTOQUE1`, `CODE MONTAR LINK REPASSE `, `Split Out5`, `Edit Fields11`, `Edit Fields12`, `Split Out4`, `Loop Over Items2`, `If4`, `CRM Leads POST4`.

- [ ] **Step 1: Procurar `$('Nome')` em expressões do workflow e nos patch scripts**
```bash
export NVM_DIR="$HOME/.nvm"; . "$NVM_DIR/nvm.sh"
node -e '
const fs=require("fs");const wf=JSON.parse(fs.readFileSync("n8n/ia-repasse-pro-v2/workflow.json","utf8"));
const dead=["Bia 2 SEM ESTOQUE ","Postgres Chat Memory2","OpenRouter Chat Model4","Edit Fields13","Code Parse Bia 2 SEM ESTOQUE1","CODE MONTAR LINK REPASSE ","Split Out5","Edit Fields11","Edit Fields12","Split Out4","Loop Over Items2","If4","CRM Leads POST4"];
const blob=JSON.stringify(wf);
for(const d of dead){
  const re=new RegExp("\\\$\\(\\s*[\x27\x22]"+d.replace(/[.*+?^${}()|[\]\\]/g,"\\\$&")+"[\x27\x22]","g");
  const n=(blob.match(re)||[]).length;
  console.log((n?"REF":"ok "),n,JSON.stringify(d));
}'
grep -rn "Bia 2 SEM ESTOQUE\|Edit Fields13\|Code Parse Bia 2 SEM ESTOQUE1\|CODE MONTAR LINK REPASSE \|Split Out5\|Edit Fields11\|Edit Fields12\|Split Out4\|Loop Over Items2\|CRM Leads POST4\|Postgres Chat Memory2\|OpenRouter Chat Model4\|If4\b" scripts/n8n/*.mjs || echo "no patch-script refs"
```
- [ ] **Step 2:** Para cada nó com `REF` remanescente (fora as próprias conexões), decidir repointe ou retirar da lista de remoção. Os `$('Edit Fields')`/`$('Webhook')`/`$('Code Refresh Lead State Before Switch2')` lidos pelos parsers/memória do sobrevivente **permanecem** (não são removidos).
Esperado: lista de remoção confirmada sem órfãos.

---

## Task 4: `transform-bia2-merge.mjs` — prompt unificado (TDD: teste primeiro)

**Files:** Create `scripts/n8n/transform-bia2-merge.mjs`; Create `scripts/n8n/tool/tests/bia2-merge.test.mjs`.

**Interfaces:**
- Produz: `transformWorkflow(wf) -> wf'` (função pura exportada) que aplica união de prompt + topologia; idempotente.

- [ ] **Step 1: Teste falho — invariantes do prompt unificado**
Em `bia2-merge.test.mjs`, carregar `workflow.json`, aplicar `transformWorkflow`, e assertar que o `systemMessage` do nó `Bia 2 ESTOQUE`:
  - mantém os blocos da ESTOQUE (âncora: `CENÁRIOS DE ESTOQUE — LEIA PRIMEIRO`, `ESTÁGIO 4 — RESERVA E DADOS PIX`),
  - passa a conter os blocos exclusivos da CONTINUIDADE: `REGRA DE ENTRADA ANTES DE SIMULAR`, `CONTINUIDADE SEM CONSULTA DE ESTOQUE`, `CONVENCER SEMINOVO`, e o tratamento `tradein_condition_human_eval`,
  - contém o preâmbulo de detecção de contexto (âncora marcadora: `MODO DE OPERAÇÃO POR CONTEXTO`),
  - cada bloco compartilhado aparece **uma vez** (sem duplicar `NATURALIDADE — SEM CARA DE IA`).
```bash
node --test scripts/n8n/tool/tests/bia2-merge.test.mjs
```
Esperado: FALHA (transform ainda não implementado).

- [ ] **Step 2: Implementar a união de prompt no transform**
`transformWorkflow` edita `nodes[Bia 2 ESTOQUE].parameters.options.systemMessage`:
  - acrescenta, após o cabeçalho, um bloco `# MODO DE OPERAÇÃO POR CONTEXTO`: "Se `inventory` ausente neste turno, opere em modo continuidade (FAQ/cidade/pós-sim/entrada) e NÃO afirme indisponibilidade sem `inventory_checked`/`inventory_found=false` reais."
  - acrescenta, antes do `FORMATO DE SAÍDA OBRIGATÓRIO` final, os 4 blocos exclusivos copiados **verbatim** da CONTINUIDADE (texto já lido do nó `Bia 2 SEM ESTOQUE `): `REGRA DE ENTRADA ANTES DE SIMULAR`, `CONTINUIDADE SEM CONSULTA DE ESTOQUE`, `CONVENCER SEMINOVO / CIDADE POS-SIM`, e o item `CONDIÇÃO DO APARELHO DE ENTRADA` (`tradein_condition_human_eval`).
  - marcador de idempotência: `# MODO DE OPERAÇÃO POR CONTEXTO` (não reaplica se já presente).
  - também unifica o `text` do agente para ler defensivamente `commerce_context ?? (contexto persistido) ?? simulation_result ?? routing_decision/next_best_action` (preservando o `text` atual da ESTOQUE como base e adicionando os `??`).
```bash
node --test scripts/n8n/tool/tests/bia2-merge.test.mjs
```
Esperado: invariantes de prompt PASSAM.

---

## Task 5: `transform-bia2-merge.mjs` — topologia (repointe + remoção)

**Files:** Modify `scripts/n8n/transform-bia2-merge.mjs`; Modify `scripts/n8n/tool/tests/bia2-merge.test.mjs`.

- [ ] **Step 1: Teste falho — topologia resultante**
Adicionar asserts: após `transformWorkflow`,
  - `connections["Switch1"]`, `connections["Switch3"]`, `connections["Parse Simulator"]` apontam para `Bia 2 ESTOQUE` (no índice de saída correto: Switch1 out0, Switch3 out2, Parse Simulator out0),
  - os 13 nós-alvo NÃO existem em `nodes[]`,
  - nenhuma entrada em `connections{}` referencia nó removido,
  - `structuralErrors(wf') === []` (import de `../extract.mjs`).
```bash
node --test scripts/n8n/tool/tests/bia2-merge.test.mjs
```
Esperado: FALHA nos novos asserts.

- [ ] **Step 2: Implementar repointe + remoção**
No `transformWorkflow`:
  - **Repontar:** em `connections`, trocar o destino `Bia 2 SEM ESTOQUE ` por `Bia 2 ESTOQUE` nas saídas de `Switch1` (grupo out0), `Switch3` (grupo out2) e `Parse Simulator` (out0). Preservar `type:"main"` e índices.
  - **Remover nós:** `nodes = nodes.filter(n => !DEAD.has(n.name))`.
  - **Limpar conexões:** deletar `connections[deadNode]` (origens removidas) e, em todo grupo de toda origem, filtrar links cujo `.node` esteja em `DEAD`.
  - idempotente (se já removido/repontado, no-op).
```bash
node --test scripts/n8n/tool/tests/bia2-merge.test.mjs
```
Esperado: topologia PASSA + `structuralErrors=[]`.

- [ ] **Step 3: Rodar a suíte inteira (não regredir os outros testes)**
```bash
node --test scripts/n8n/tool/tests/
```
Esperado: tudo verde (parsers, invariantes existentes, routing-flags, bia2-merge).

- [ ] **Step 4: Commit (estrutura + testes, ainda sem deploy)**
```bash
git add scripts/n8n/transform-bia2-merge.mjs scripts/n8n/tool/tests/bia2-merge.test.mjs
git commit -m "feat(n8n): transform+testes da fusão Bia 2 (prompt unificado + topologia)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 6: `deploy-bia2-merge.mjs` — aplicar no vivo (validar antes de ativar)

**Files:** Create `scripts/n8n/deploy-bia2-merge.mjs`.

- [ ] **Step 1: Implementar o deploy cirúrgico**
Script: 
  1. `export NVM`; ler env (`N8N_API_KEY`/`N8N_BASE_URL`, fallbacks).
  2. **GET** workflow vivo.
  3. **Drift check:** comparar nós/versionId do vivo com `n8n/ia-repasse-pro-v2/nodes/.snapshot.json`; se o vivo divergir do snapshot local → ABORTAR (peça `guard`/`pull`). (n8n-validation-expert: não deployar sobre base inesperada.)
  4. `const out = transformWorkflow(structuredClone(live))` (importa do transform).
  5. **Validar:** `structuralErrors(out)` deve ser `[]`; para cada Code node tocado, `new Function(jsCode)` não lança (aqui não tocamos código, mas manter o assert genérico). Se erro → ABORTAR e imprimir (loop validar→corrigir).
  6. **Backup:** salvar `live` em `output/n8n/backups/bia2-merge-<ts>.json`.
  7. `DRY=1` → imprimir diff resumido (nós removidos, conexões repontadas, tamanho do systemMessage) e SAIR sem PUT.
  8. **PUT** `buildPutBody(out)`; depois `POST /activate`.
  9. Imprimir novo `versionId`.
- [ ] **Step 2: DRY-run e revisar**
```bash
export NVM_DIR="$HOME/.nvm"; . "$NVM_DIR/nvm.sh"
DRY=1 node scripts/n8n/deploy-bia2-merge.mjs
```
Esperado: diff bate com o desenho (13 nós removidos, 3 conexões repontadas, `structuralErrors=[]`). Se algo destoar, corrigir o transform e revalidar (Task 5 Step 3).
- [ ] **Step 3: Deploy ao vivo + reativar**
```bash
node scripts/n8n/deploy-bia2-merge.mjs
node scripts/n8n/repasse-maint.mjs pull   # re-sincroniza local + snapshot a partir do vivo novo
node scripts/n8n/repasse-maint.mjs status # sem pendências
```
Esperado: PUT 200, workflow ativo, novo versionId; guard reconhece como meu deploy.

---

## Task 7: Verificação ao vivo (4 cenários) vs baseline

**Files:** leitura dos baselines do Task 1.

- [ ] **Step 1: IA habilitada + reset limpo**
```bash
export NVM_DIR="$HOME/.nvm"; . "$NVM_DIR/nvm.sh"
WIPE_MSGS=1 node scripts/n8n/smoke-step.mjs reset
```
- [ ] **Step 2: Replay dos 4 cenários** (mesmos `say` do Task 1)
Para cada cenário, comparar reply + diagnostics com o baseline correspondente. Verificar pelo runData da execução que rodou `Simulador`/`Montar Body` (cuidado buffer-race).
Esperado, por cenário:
  1. compra+troca+entrada → roteia `ask_cash_entry_before_sim → inventory_or_simulator → Simulador`; cotação equivalente ao baseline.
  2. FAQ pós-venda → resposta de FAQ, `transfer:false`.
  3. cidade pós-sim → "Você prefere retirar em Fortaleza ou Sobral?".
  4. fora-escopo/tradein bloqueado → HDI/handoff equivalente.
- [ ] **Step 3: Se qualquer cenário regredir → ROLLBACK**
```bash
# PUT do backup salvo no Task 6 Step 1.6 + activate
node scripts/n8n/deploy-bia2-merge.mjs --rollback output/n8n/backups/bia2-merge-<ts>.json
```
Depois reabrir o transform para corrigir e repetir Task 5→7.

---

## Task 8: Docs, memória e fechamento

**Files:** Modify `n8n/ia-repasse-pro-v2/README.md`; Create `memory/n8n-bia2-unificada.md`; Modify `memory/MEMORY.md`.

- [ ] **Step 1: README** — seção "Fusão Bia 2 (2026-06-18, versão `<novo>`)": o que mudou (1 agente, nós removidos, pipeline POST2), mapa de duplicação atualizado, e que os blocos da continuidade agora vivem no prompt único da `Bia 2 ESTOQUE`.
- [ ] **Step 2: Memória** — `n8n-bia2-unificada.md` (type: project): por que "SEM ESTOQUE" era na verdade "continuidade", as 5 equivalências que tornaram a fusão segura, e que topologia/prompt-expressão exigem patch cirúrgico (não `repasse-maint deploy`). Linkar `[[n8n-routing-color-gate-starved-bia1]]`, `[[n8n-ui-api-concurrent-edit-hazard]]`. Adicionar linha no `MEMORY.md`.
- [ ] **Step 3: Suíte final verde + guard sincronizado**
```bash
node --test scripts/n8n/tool/tests/
node scripts/n8n/guard-live-workflow-sync.mjs --check
```
- [ ] **Step 4: Commit final**
```bash
git add -A
git commit -m "feat(n8n): fusão Bia 2 aplicada no vivo + docs/memória

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Review final
Após Task 8, rodar a auditoria uncle-bob (modo REVIEW) sobre o resultado: comparar métricas §1.1 do spec (antes→depois), confirmar zero regressão (suíte + 4 smokes equivalentes ao baseline), e que a duplicação (prompt/parser/link/pipeline) foi de fato eliminada.
