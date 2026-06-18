# Bia 2 unificada — Design / Spec

**Data:** 2026-06-18
**Workflow vivo:** `Cr4fPWe0prwS6XjI` ("ia repasse-pro v2 avancada")
**Tipo:** refactor estrutural **sem mudança de comportamento** (uncle-bob "dois chapéus": muda só a estrutura; a saída de cada cenário fica equivalente à de hoje).

---

## 1. Objetivo

Fundir os dois nós de agente `Bia 2 ESTOQUE` e `Bia 2 SEM ESTOQUE ` em **um único agente Bia 2**, eliminando a duplicação (prompt, parser, link-builder, memória, modelo, pipeline de envio) sem regressão de comportamento, reduzindo complexidade e custo de manutenção.

Restrição-mãe do projeto (CLAUDE.md): **nós não são renomeados** — ~450 referências `$('Nome')` + 25 patch scripts dependem dos nomes atuais. Portanto a fusão **reaproveita o identificador interno de um nó existente** em vez de criar um nó novo.

Decisões já aprovadas pelo usuário:
- **Escopo:** nó único, preservando 1 nome.
- **Sobrevivente:** `Bia 2 ESTOQUE` (tem o funil completo + o ramo de re-simulação).
- **Paridade:** comportamento idêntico (melhorias de voz/regra ficam para um passo separado e futuro).
- **Consolidação de envio:** no pipeline **POST2**, com checagem obrigatória de paridade POST2 ≡ POST4.

### 1.1 Métricas alvo (uncle-bob: antes → depois)
| Métrica | Antes | Depois |
|---|---|---|
| Nós de agente Bia 2 | 2 (ESTOQUE ~31KB + CONTINUIDADE ~9.8KB) | **1** |
| Memórias / Modelos do agente | 2 + 2 | **1 + 1** |
| Parsers de saída | 2 (214 linhas, duplicados) | **1** |
| Construtores de link | 2 (idênticos) | **1** |
| Pipelines de envio | 2 (POST2 / POST4) | **1 (POST2)** |
| Duplicação de prompt | ~80% copiada entre 2 nós | fonte única |
| Nós totais removidos | — | 17 (ver §3.2 — corrigido na execução) |

---

## 2. Estado atual (apurado no workflow vivo)

### 2.1 Os nomes mentem
`Bia 2 SEM ESTOQUE ` (com espaço no fim) **não** é o agente de "sem estoque". O cabeçalho do próprio prompt é `BIA 2 CONTINUIDADE v1.0`: trata FAQ, pergunta de cidade, **apresentação do resultado de simulação**, fora-de-escopo leve e retomadas **sem nova consulta de estoque**. É por isso que "a simulação sai pela SEM ESTOQUE" (`Parse Simulator → Bia 2 SEM ESTOQUE`) — é o desenho atual, não um bug.

### 2.2 Entradas de cada agente
- **`Bia 2 ESTOQUE`** (funil completo, systemMessage ~31KB):
  - 1 entrada: `Code Commerce Context → Bia 2 ESTOQUE` (após busca de estoque).
- **`Bia 2 SEM ESTOQUE `** (continuidade, systemMessage ~9.8KB):
  - 3 entradas: `Switch1[out0 fora_escopo]`, `Switch3[out2 bia2_continuation]`, `Parse Simulator` (pós-sim).

### 2.3 Saídas / downstream
- `Bia 2 ESTOQUE`:
  - `out0 → Edit Fields3 → Code Parse Bia 2 SEM ESTOQUE → CODE MONTAR LINK REPASSE 2 → Split Out1 → Edit Fields6 → Edit Fields7 → Split Out → Loop Over Items → If2 → CRM Leads POST2`
  - `out1 → Code Parse Re-simulacao Bia 2 ESTOQUE → Montar Body do Simulador` (loop de re-sim)
- `Bia 2 SEM ESTOQUE `:
  - `out0 → Edit Fields13 → Code Parse Bia 2 SEM ESTOQUE1 → CODE MONTAR LINK REPASSE → Split Out5 → Edit Fields11 → Edit Fields12 → Split Out4 → Loop Over Items2 → If4 → CRM Leads POST4`

### 2.4 Equivalências comprovadas (o que torna a fusão segura)
- **Parsers idênticos:** `Code Parse Bia 2 SEM ESTOQUE` (80_02) e `Code Parse Bia 2 SEM ESTOQUE1` (80_03) têm corpos **byte-idênticos** (214 linhas cada).
- **Link-builders idênticos:** `CODE MONTAR LINK REPASSE 2` (80_04) e `CODE MONTAR LINK REPASSE ` (80_05) **byte-idênticos**.
- **Edit Fields3 ⊇ Edit Fields13:** Edit Fields3 tem `output` + passthrough de `faq_*`; Edit Fields13 só `output`. O parser lê `faq_* ?? memory.faq_*`, então rotear itens de continuidade pela cadeia da estoque é inofensivo (no pior caso, passa faq_* que o parser já buscaria na memória).
- **Re-sim já é guardada:** `Code Parse Re-simulacao Bia 2 ESTOQUE` faz `return []` quando `decision?.rerun_simulation !== true` (linha 60-62). Itens de continuidade/pós-sim que saiam pela `out1` do sobrevivente são descartados com segurança — não disparam re-simulação indevida.
- **Memória converge:** `Postgres Chat Memory` (ESTOQUE, base `$json.lead_id`) e `Postgres Chat Memory2` (CONTINUIDADE, base `$('Edit Fields').last().json.lead?.id`) têm derivações diferentes mas **resolvem para o mesmo valor de sessão por lead** (mesmo fallback para `webhook.body.lead_id`, mesmo sufixo de `scenario_id` em auditoria). Unificar para uma memória só é seguro.
- **Interpolação no systemMessage:** ESTOQUE tem só `{{ after_hours_message }}`; CONTINUIDADE não tem nenhuma. O contexto dinâmico por turno vive no campo `text` (user message) do agente, não no systemMessage.

### 2.5 Risco crítico a validar (não suposição)
O pipeline de envio que **sobrevive** é o **POST2**. O `POST4` (consertado na sessão anterior para usar a credencial httpHeaderAuth via referência do n8n, não Authorization manual) pertence ao ramo de continuidade que será aposentado. CLAUDE.md indica que `POST2` sempre foi a referência correta e o `POST4` foi alinhado a ela. **A paridade POST2 ≡ POST4 (mesma credencial, mesmo método/URL/headers/body de envio) precisa ser confirmada por leitura antes do deploy.** Se POST2 divergir, a consolidação reintroduz o bug de auth.

---

## 3. Arquitetura alvo

### 3.1 Topologia final
`Bia 2 ESTOQUE` permanece como o **único agente Bia 2** (identificador interno intacto).

Entradas repontadas para `Bia 2 ESTOQUE`:
- `Code Commerce Context → Bia 2 ESTOQUE` (já existe; inalterado)
- `Switch1[out0 fora_escopo] → Bia 2 ESTOQUE` (era → Bia 2 SEM ESTOQUE)
- `Switch3[out2 bia2_continuation] → Bia 2 ESTOQUE` (era → Bia 2 SEM ESTOQUE)
- `Parse Simulator → Bia 2 ESTOQUE` (era → Bia 2 SEM ESTOQUE)

Saídas inalteradas:
- `out0 → Edit Fields3 → … → CRM Leads POST2`
- `out1 → Code Parse Re-simulacao Bia 2 ESTOQUE → Montar Body do Simulador`

### 3.2 Nós aposentados (deletados) — 17 nós (CORRIGIDO na execução)

> **Correção vs. rascunho:** o rascunho deste spec listava `If4`/`CRM Leads POST4` por engano — esses pertencem ao pipeline de envio da **Bia 1** (`Loop Over Items1 → If4 → POST4`) e foram **preservados**. A continuidade na verdade termina em `Loop Over Items2 → If → CRM Leads POST` (nós próprios). O conjunto morto correto foi derivado por **delta de alcançabilidade** (`alcançável-antes \ alcançável-depois` do repointe), o que também exclui sticky notes ("Módulo XX") e o nó de teste "Delete table or rows" (já desconectados antes).

Os 17 nós continuidade-exclusivos removidos:
`Bia 2 SEM ESTOQUE `, `OpenRouter Chat Model4`, `Postgres Chat Memory2`, `Edit Fields13`, `Code Parse Bia 2 SEM ESTOQUE1`, `CODE MONTAR LINK REPASSE `, `Split Out5`, `Edit Fields11`, `Edit Fields12`, `Split Out4`, `Loop Over Items2`, `HTTP Request1`, `Wait3`, `If`, `CRM Leads POST`, `No Operation, do nothing1`, `No Operation, do nothing5`.

Pipeline de envio do sobrevivente = **`CRM Leads POST2`** (credencial httpHeaderAuth `Authorization repasse`, id `ukDcBjUSJ75DVnR8` — confirmada idêntica à do POST4).

> A varredura `$('Nome')` confirmou que nenhum nó VIVO referencia um nó morto (as 2 refs a `Code Parse Bia 2 SEM ESTOQUE1` estavam dentro do próprio nó `If`, também morto).

### 3.3 Prompt unificado (systemMessage) — comportamento idêntico
Base = systemMessage da `Bia 2 ESTOQUE` (funil completo). Enxertar os blocos **exclusivos** da CONTINUIDADE que a ESTOQUE não tem:
- `REGRA DE ENTRADA ANTES DE SIMULAR` (gatilho `routing_decision = "ask_cash_entry_before_sim"`).
- `CONTINUIDADE SEM CONSULTA DE ESTOQUE` (nunca afirmar indisponibilidade sem `inventory_checked`/`inventory_found=false` de consulta real).
- `CONVENCER SEMINOVO / CIDADE POS-SIM` (não oferecer especialista por falta de cor/modelo em seminovo; convencer com alternativa + simular).
- Tratamento explícito de `routing_decision = "tradein_condition_human_eval"` (não simular/prometer valor; transferir com mensagem simpática).

Preâmbulo curto de **detecção de contexto**: "se o estoque não foi consultado neste turno (`inventory` ausente), opere em modo continuidade — não apresente/ negue estoque; responda FAQ/cidade/pós-sim/entrada conforme o contexto presente". Isso garante que as regras de apresentação de estoque (Cenários A/B/C) só disparem quando há `inventory` no turno — replicando o que hoje é separado por roteamento.

Blocos compartilhados (`NATURALIDADE — SEM CARA DE IA`, `FLUIDEZ`, `DESAMBIGUACAO`, `REGRA DE CORES`, `FAQ COMERCIAL CONTROLADO`, `TOM`) aparecem **uma única vez**.

### 3.4 Contexto por turno (`text` do agente) — unificado e defensivo
Hoje: ESTOQUE usa `==== SNAPSHOT COMERCIAL …`; CONTINUIDADE usa `=== CONTEXTO DE ESTOQUE PERSISTIDO …`. O `text` unificado lê com `??` em cascata, cobrindo as 4 origens:
- `commerce_context` (entrada via Code Commerce Context / busca de estoque)
- contexto de estoque persistido / `last_inventory_context` (entrada de continuidade)
- `simulation_result` (entrada pós-sim via Parse Simulator)
- `routing_decision` / `next_best_action` (sempre)

Cada campo ausente resolve para `n/a`/vazio sem quebrar a expressão (mesma estratégia já usada no `text` atual da ESTOQUE).

### 3.5 Memória e modelo
- Manter `Postgres Chat Memory` (sessionKey base `$json.lead_id`, com fallback para `webhook.body.lead_id`) ligada ao agente único.
- Manter `OpenRouter Chat Model3` ligado ao agente único.
- Confirmar que `$json.lead_id` (ou o fallback) está presente em **todas** as 4 entradas; se alguma entrada não o tiver no root, o fallback para `webhook.body.lead_id` cobre — validar no smoke ao vivo.

---

## 4. Estratégia de "sem regressão" (uncle-bob: rede primeiro)

### 4.1 Baseline (antes de tocar em nada)
1. `node scripts/n8n/guard-live-workflow-sync.mjs` (sincronizado, sem drift) e `repasse-maint.mjs pull`.
2. `node --test scripts/n8n/tool/tests/` → **verde**. Se vermelho, parar e reportar.
3. Capturar o comportamento atual dos 4 cenários de smoke ao vivo (snapshot das respostas/roteamento), para comparar depois.

### 4.2 Caracterização (travar comportamento atual)
- `parsers.test.mjs` já cobre byte-fidelidade dos parsers — após consolidar para 1 parser, o teste deve continuar verde (o sobrevivente é o canônico).
- `prompt-invariants.test.mjs`: **estender** para travar que o prompt unificado produz a mesma **forma de saída** por cenário, antes de qualquer mudança de voz:
  - inventory fresco (Cenário A/B/C)
  - pós-simulação (apresentar `simulation_result` + pergunta de fechamento)
  - continuidade (FAQ pós-venda, retomada sem consulta)
  - `ask_cash_entry_before_sim` (pergunta de entrada antes de simular)
  - `tradein_condition_human_eval` (bloqueio + transfer)
  - `ask_pickup_city_after_sim` (cidade só após sim aceita)

### 4.3 Verificação ao vivo (`smoke-step.mjs`)
4 roteiros, comparando contra o baseline (4.1.3):
1. VD compra + troca + entrada (chega ao Simulador, cotação correta).
2. FAQ pós-venda (garantia/nota) sem transferência indevida.
3. Pergunta de cidade pós-simulação (`ask_pickup_city_after_sim`).
4. Fora-de-escopo / HDI (reparo) e/ou `tradein_condition_human_eval`.

Cuidado documentado: **buffer-race** — verificar pelo runData da execução que rodou `Simulador`/`Montar Body`, não pela reply postada por um gêmeo.

### 4.4 Deploy e rollback
- Deploy só via `repasse-maint.mjs deploy` (dry-run → revisar diff → `--confirm`); **nunca patch cego**. Reativar + re-sync + novo versionId.
- Backup automático em `output/n8n/backups/` antes do PUT.
- **Rollback:** restaurar o backup pré-deploy (PUT do JSON salvo) + reativar, caso qualquer cenário de 4.3 regrida.
- Branch dedicada (não `main`); commit com rodapé de co-autoria. **Não** commitar/mergear sem consentimento explícito.

### 4.5 Critério de sucesso (Definition of Done)
- 1 agente Bia 2; nós duplicados removidos; pipeline único (POST2) com paridade confirmada.
- `node --test scripts/n8n/tool/tests/` verde (incluindo invariantes estendidos).
- 4 cenários de smoke equivalentes ao baseline (mesma forma de saída/roteamento).
- Guard sincronizado; workflow reativado; métricas da §1.1 reduzidas conforme alvo.

---

## 5. Fora de escopo (YAGNI)
- Qualquer mudança de **voz/tom/regra** de atendimento (passo futuro separado, com a rede de testes já pronta).
- Renomear o nó sobrevivente para literalmente "Bia 2" (violaria a restrição anti-rename; o identificador interno permanece `Bia 2 ESTOQUE`, conceitualmente tratado como "Bia 2").
- Mexer na Bia 1 ou no sub-pipeline de memória (`lead_state`).
- Tocar nos Switches além de repontar as 3 conexões de saída listadas em 3.1.

---

## 6. Riscos e mitigação
| Risco | Mitigação |
|---|---|
| POST2 ≠ POST4 (auth) | Tarefa obrigatória: confirmar credencial/método/headers/body antes do deploy; se divergir, alinhar POST2 ou manter o pipeline correto. |
| Prompt unificado muda comportamento sutilmente | `prompt-invariants` estendidos travam a forma de saída por cenário antes do deploy; smoke ao vivo compara com baseline. |
| Referência órfã a nó deletado | Varredura `$('Nome')` no workflow.json + 25 patch scripts antes de cada remoção. |
| `lead_id` ausente em alguma entrada → sessão de memória errada | Fallback `webhook.body.lead_id` já cobre; validar no smoke. |
| Edição manual concorrente na UI do n8n durante o deploy | Guard roda primeiro; deploy GET-fresco recusa em drift; verificar versionId pós-deploy. |
| Buffer-race confunde a verificação | Verificar pelo runData da execução correta, não pela reply postada. |
