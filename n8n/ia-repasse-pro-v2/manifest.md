# Manifesto — ia repasse-pro v2 avancada (workflow vivo `Cr4fPWe0prwS6XjI`)

> Gerado por `scripts/n8n/repasse-maint.mjs pull`. NÃO edite à mão — re-gerado a cada pull.
> **Fonte canônica é o workflow VIVO.** Sempre `pull` antes de editar; `deploy` compõe sobre o vivo fresco.

## Como editar

1. `node scripts/n8n/repasse-maint.mjs pull` — sincroniza e decompõe.
2. Edite **um** arquivo em `nodes/code/` (JS) ou `nodes/prompts/` (prompt estático). Edite só o corpo abaixo da sentinela.
3. Prompt montado por **expressão** (`=…`) NÃO vira arquivo — edite `parameters.options.systemMessage` no `workflow.json` por âncora. Ver lista abaixo.
4. `node scripts/n8n/repasse-maint.mjs status` — confira o que mudou.
5. `node --test scripts/n8n/tool/tests/` — invariantes + nodes verdes.
6. `node scripts/n8n/repasse-maint.mjs deploy` (dry-run) → revise o diff.
7. `node scripts/n8n/repasse-maint.mjs deploy --confirm` → PUT + reativa + re-sync.

## Checklist por alteração

- [ ] `pull` antes de editar (sem drift).
- [ ] Editei por NODE (`nodes/code/*.js` ou `nodes/prompts/*.md`); prompt-expressão via `systemMessage` no `workflow.json`.
- [ ] Testes de invariantes verdes + teste do node editado verde (`node --test scripts/n8n/tool/tests/`).
- [ ] `deploy` (dry-run) revisado no diff.
- [ ] PUT: settings só com allowlist, `timeSavedMode` removido, credential refs intactas.
- [ ] `deploy --confirm` + reativação + re-sync (versionId novo).
- [ ] Commit com rodapé de co-autoria.

## Prompts montados por expressão (editar no `workflow.json`, NÃO viram arquivo)

| node | campo |
| --- | --- |
| Router Agent | options.systemMessage |
| Bia 2 SEM ESTOQUE  | options.systemMessage |
| Bia 1 | options.systemMessage |
| Bia 2 ESTOQUE | options.systemMessage |

## Nodes extraídos por stage

### 00 entrada-normalizacao

| arquivo | node | tipo |
| --- | --- | --- |
| `nodes/code/00_01_code-parse-pre-imagem.js` | Code Parse pre-imagem | code |
| `nodes/code/00_02_code-parse-imagem.js` | Code Parse Imagem | code |

### 10 buffer-lock

| arquivo | node | tipo |
| --- | --- | --- |
| `nodes/code/10_01_atualizar-estado-buffer.js` | Atualizar Estado Buffer | code |
| `nodes/code/10_02_calcular-wait-buffer.js` | Calcular Wait Buffer | code |
| `nodes/code/10_03_verificar-vencedor.js` | Verificar vencedor | code |
| `nodes/code/10_04_tentar-lock.js` | Tentar Lock | code |
| `nodes/code/10_05_code-consolidador-payload-final.js` | Code Consolidador Payload Final | code |

### 30 contexto-lead

| arquivo | node | tipo |
| --- | --- | --- |
| `nodes/code/30_01_data-hora.js` | data_hora | code |
| `nodes/code/30_02_parse-first-name2.js` | PARSE FIRST NAME2 | code |

### 40 router-memoria

| arquivo | node | tipo |
| --- | --- | --- |
| `nodes/code/40_01_code-parse-router.js` | Code Parse Router | code |
| `nodes/prompts/40_02_memory-1-extractor.md` | Memory 1 - Extractor | prompt |
| `nodes/code/40_03_code-parse-memory-1.js` | Code Parse Memory 1 | code |
| `nodes/prompts/40_04_memory-2-reconciler.md` | Memory 2 - Reconciler | prompt |
| `nodes/code/40_05_code-parse-memory-2.js` | Code Parse Memory 2 | code |
| `nodes/code/40_06_code-in-javascript2.js` | Code in JavaScript2 | code |

### 50 leadstate-flags

| arquivo | node | tipo |
| --- | --- | --- |
| `nodes/code/50_01_code-routing-flags.js` | Code Routing Flags | code |
| `nodes/code/50_02_code-in-javascript1.js` | Code in JavaScript1 | code |
| `nodes/code/50_03_code-in-javascript.js` | Code in JavaScript | code |
| `nodes/code/50_04_code-refresh-lead-state-before-switch2.js` | Code Refresh Lead State Before Switch2 | code |

### 60 simulacao-estoque

| arquivo | node | tipo |
| --- | --- | --- |
| `nodes/code/60_01_montar-body-do-simulador.js` | Montar Body do Simulador | code |
| `nodes/code/60_02_node13-code-filtrar-resultados-estoque.js` | Node13-Code Filtrar Resultados Estoque | code |
| `nodes/code/60_03_code-build-inventory-lite.js` | Code Build Inventory Lite | code |
| `nodes/code/60_04_parse-simulator.js` | Parse Simulator | code |
| `nodes/code/60_05_code-consciliador.js` | Code Consciliador | code |

### 70 agentes-bia

| arquivo | node | tipo |
| --- | --- | --- |
| `nodes/code/70_01_code-commerce-context.js` | Code Commerce Context | code |
| `nodes/code/70_02_code-parse-bia-1.js` | Code Parse Bia 1 | code |
| `nodes/code/70_03_code-parse-re-simulacao-bia-2-estoque.js` | Code Parse Re-simulacao Bia 2 ESTOQUE | code |
| `nodes/code/70_04_code-montar-link-repasse-1.js` | Code Montar Link Repasse 1 | code |

### 80 links-envio

| arquivo | node | tipo |
| --- | --- | --- |
| `nodes/code/80_01_split-out3.js` | Split Out3 | code |
| `nodes/code/80_02_code-parse-bia-2-sem-estoque.js` | Code Parse Bia 2 SEM ESTOQUE | code |
| `nodes/code/80_03_code-parse-bia-2-sem-estoque1.js` | Code Parse Bia 2 SEM ESTOQUE1 | code |
| `nodes/code/80_04_code-montar-link-repasse-2.js` | CODE MONTAR LINK REPASSE 2 | code |
| `nodes/code/80_05_code-montar-link-repasse.js` | CODE MONTAR LINK REPASSE  | code |
| `nodes/code/80_06_split-out1.js` | Split Out1 | code |
| `nodes/code/80_07_split-out5.js` | Split Out5 | code |

## Faixas de stage (de `stages.json`, por posição x do canvas)

| stage | faixa x | rótulo |
| --- | --- | --- |
| 00 | 0–12350 | entrada-normalizacao |
| 10 | 12350–16300 | buffer-lock |
| 30 | 16300–17700 | contexto-lead |
| 40 | 17700–19330 | router-memoria |
| 50 | 19330–20100 | leadstate-flags |
| 60 | 20100–21000 | simulacao-estoque |
| 70 | 21000–21750 | agentes-bia |
| 80 | 21750–∞ | links-envio |

## Conexões (origem → destinos)

- **Analyze an image** → Code Parse pre-imagem
- **Analyze audio** → Edit Fields1
- **Analyze video** → Code Parse pre-imagem
- **Atualizar Estado Buffer** → Redis Set Buffer
- **Bia 1** → Code Parse Bia 1
- **Bia 2 ESTOQUE** → Edit Fields3, Code Parse Re-simulacao Bia 2 ESTOQUE
- **Bia 2 SEM ESTOQUE ** → Edit Fields13
- **Buffer + Data Lead** → Merge Get Buffer + Status Loja
- **Business hours** → Edit Fields4
- **CODE MONTAR LINK REPASSE ** → Split Out5
- **CODE MONTAR LINK REPASSE 2** → Split Out1
- **CRM Inventory Precheck** → Code Build Inventory Lite
- **CRM Inventory Search** → Node13-Code Filtrar Resultados Estoque
- **CRM Leads GET** → Business hours
- **CRM Leads GET Before Switch2** → Code Refresh Lead State Before Switch2
- **CRM Leads GET Webhook** → Formatar Payload CRM2
- **Calcular Wait Buffer** → Wait1
- **Code Build Inventory Lite** → CRM Leads POST Pre Inventory Context, Code Consciliador
- **Code Commerce Context** → Bia 2 ESTOQUE
- **Code Consciliador** → Bia 1
- **Code Consolidador Payload Final** → Redis Delete Buffer
- **Code Montar Link Repasse 1** → Split Out3
- **Code Parse Bia 1** → Code Montar Link Repasse 1
- **Code Parse Bia 2 SEM ESTOQUE** → CODE MONTAR LINK REPASSE 2
- **Code Parse Bia 2 SEM ESTOQUE1** → CODE MONTAR LINK REPASSE 
- **Code Parse Imagem** → Edit Fields2
- **Code Parse Memory 1** → Memory 2 - Reconciler
- **Code Parse Memory 2** → Code in JavaScript2
- **Code Parse Re-simulacao Bia 2 ESTOQUE** → Montar Body do Simulador
- **Code Parse Router** → Switch1
- **Code Parse pre-imagem** → Code Parse Imagem
- **Code Refresh Lead State Before Switch2** → Switch2
- **Code Routing Flags** → Switch3
- **Code in JavaScript** → CRM Leads POST Lead_State
- **Code in JavaScript1** → CRM Leads POST Update Memory
- **Code in JavaScript2** → Edit Fields5
- **Edit Fields** → Router Agent
- **Edit Fields1** → Merge
- **Edit Fields10** → Code Commerce Context
- **Edit Fields11** → Edit Fields12
- **Edit Fields12** → Split Out4
- **Edit Fields13** → Code Parse Bia 2 SEM ESTOQUE1
- **Edit Fields2** → Merge
- **Edit Fields3** → Code Parse Bia 2 SEM ESTOQUE
- **Edit Fields4** → data_hora
- **Edit Fields5** → Code Routing Flags, CRM Leads POST update_funnel, Code in JavaScript, Code in JavaScript1
- **Edit Fields6** → Edit Fields7
- **Edit Fields7** → Split Out
- **Edit Fields8** → Edit Fields9
- **Edit Fields9** → Split Out2
- **Formatar Payload CRM2** → If3
- **HTTP Request** → Wait2, No Operation, do nothing4
- **HTTP Request1** → Wait3, No Operation, do nothing5
- **HTTP Request21** → Wait, No Operation, do nothing7
- **If** → CRM Leads POST, No Operation, do nothing1
- **If Lock** → Load buffer_obj, Redis Set Lock, Load if Lock, No Operation, do nothing2
- **If Winner** → Merge3, Redis Get Lock
- **If2** → CRM Leads POST2, No Operation, do nothing
- **If3** → Switch, Merge
- **If4** → CRM Leads POST4, No Operation, do nothing6
- **Load Buffer Final** → CRM Leads GET
- **Load buffer_obj** → Merge: Set Lock + Loads
- **Load dados + texto Lead** → Redis Get Buffer, Buffer + Data Lead
- **Load if Lock** → Merge: Set Lock + Loads
- **Loop Over Items** → If2, HTTP Request
- **Loop Over Items1** → If4, HTTP Request21
- **Loop Over Items2** → If, HTTP Request1
- **Memory 1 - Extractor** → Code Parse Memory 1
- **Memory 2 - Reconciler** → Code Parse Memory 2
- **Merge** → Load dados + texto Lead
- **Merge Get Buffer + Status Loja** → Atualizar Estado Buffer
- **Merge3** → Tentar Lock
- **Merge: Get Pós-Wait + Set + buffer_obj** → Verificar vencedor
- **Merge: Set Lock + Loads** → Code Consolidador Payload Final
- **Montar Body do Simulador** → Simulador
- **Node13-Code Filtrar Resultados Estoque** → Edit Fields10, CRM Leads POST Inventory Context
- **OpenRouter Chat Model** → Router Agent
- **OpenRouter Chat Model1** → Memory 2 - Reconciler
- **OpenRouter Chat Model2** → Bia 1
- **OpenRouter Chat Model3** → Bia 2 ESTOQUE
- **OpenRouter Chat Model4** → Bia 2 SEM ESTOQUE 
- **OpenRouter Chat Model5** → Memory 1 - Extractor
- **PARSE FIRST NAME2** → Edit Fields
- **Parse Simulator** → Bia 2 SEM ESTOQUE 
- **Postgres Chat Memory** → Bia 2 ESTOQUE
- **Postgres Chat Memory1** → Bia 1
- **Postgres Chat Memory2** → Bia 2 SEM ESTOQUE 
- **Postgres Chat Memory3** → Memory 2 - Reconciler
- **Postgres Chat Memory4** → Memory 1 - Extractor
- **Redis Delete Buffer** → Redis Delete Lock
- **Redis Delete Lock** → Load Buffer Final
- **Redis Get Buffer** → Merge Get Buffer + Status Loja
- **Redis Get Lock** → Merge3
- **Redis Get Pós-Wait** → Merge: Get Pós-Wait + Set + buffer_obj
- **Redis Set Buffer** → Calcular Wait Buffer, Values Set + buffer_obj
- **Redis Set Lock** → Merge: Set Lock + Loads
- **Router Agent** → Code Parse Router
- **Should Precheck Inventory** → CRM Inventory Precheck, Code Consciliador
- **Simulador** → Parse Simulator
- **Split Out** → Loop Over Items
- **Split Out1** → Edit Fields6
- **Split Out2** → Loop Over Items1
- **Split Out3** → Edit Fields8
- **Split Out4** → Loop Over Items2
- **Split Out5** → Edit Fields11
- **Switch** → Analyze audio, Analyze an image, Analyze video
- **Switch1** → Bia 2 SEM ESTOQUE , Memory 1 - Extractor
- **Switch2** → Montar Body do Simulador, CRM Inventory Search
- **Switch3** → CRM Leads GET Before Switch2, Should Precheck Inventory, Bia 2 SEM ESTOQUE , No Operation, do nothing8
- **Tentar Lock** → If Lock
- **Values Set + buffer_obj** → Merge: Get Pós-Wait + Set + buffer_obj
- **Verificar vencedor** → If Winner
- **Wait** → Loop Over Items1
- **Wait1** → Redis Get Pós-Wait
- **Wait2** → Loop Over Items
- **Wait3** → Loop Over Items2
- **Webhook** → CRM Leads GET Webhook
- **data_hora** → PARSE FIRST NAME2

