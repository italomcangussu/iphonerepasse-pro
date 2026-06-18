# n8n — ia repasse-pro v2 avancada (manutenibilidade)

Sistema de manutenção do workflow n8n **VIVO** `Cr4fPWe0prwS6XjI` ("ia repasse-pro
v2 avancada"). Princípio inegociável: **o workflow vivo é a fonte canônica**.
Nunca edite o JSON inteiro na mão; edite por NODE; sempre `pull` antes e
re-sincronize depois. Receita de origem: [docs/n8n-maintainability-recipe.md](../../docs/n8n-maintainability-recipe.md).

## ⚠️ Conflito UI × API — causa nº1 de "o PUT não colocou minhas mudanças"

O **"Salvar" do editor do n8n faz um PUT do workflow INTEIRO** com a cópia que
está aberta no navegador. Se alguém estiver editando na UI enquanto você
deploya via API (`repasse-maint` ou `patch-*.mjs`), **o último a salvar vence** e
**reverte silenciosamente** as mudanças do outro lado — sem erro, sem aviso. Foi
exatamente isso que derrubou 4 mudanças já aplicadas (2026-06-18, versão
`ec930e16` reverteu Bia 1 / Bia 2 ESTOQUE / Memory 1 / Memory 2).

**Regra: um canal por vez.**
- Vai aplicar via API/scripts? **Feche o editor do n8n** (não deixe aba aberta com
  o workflow para evitar autosave/save manual).
- Vai editar na UI? Avise quem mexe via API; faça `pull` antes e depois.
- **Reabriu o editor depois de um deploy por API?** Dê **reload na página** antes de
  qualquer edição — a aba antiga tem a cópia velha e salvar reverteria tudo.
- O **guard** (`PreToolUse` / `guard-live-workflow-sync.mjs`) detecta esse drift
  ("EDIÇÃO MANUAL detectada na versão ao vivo") e re-sincroniza o snapshot, mas
  **não desfaz a reversão** — ele só te avisa que a base mudou por fora.

## Como ter CERTEZA que o deploy entrou (verificação)

Não confie no "deploy OK" isolado (pode ter sido revertido segundos depois por um
save na UI). Confirme contra o **GET fresco do vivo**:

```bash
# 1) arquivos locais == vivo? (decompostos: code + prompts .md)
node scripts/n8n/repasse-maint.mjs pull && node scripts/n8n/repasse-maint.mjs status   # -> "nada pendente"
# 2) guard sem drift
node scripts/n8n/guard-live-workflow-sync.mjs --check                                  # exit 0
# 3) marcadores no GET fresco (prompts-expressão NÃO viram arquivo; cheque o systemMessage)
#    GET /api/v1/workflows/<ID> e procure as âncoras esperadas em parameters.jsCode /
#    parameters.options.systemMessage de cada node (ex.: "REGRA DE CIDADE (SO APOS A
#    SIMULACAO)", "coerceLeadStateBooleans", "PRESERVE O TIER", etc.).
```

Pegadinha do diff: `repasse-maint deploy` compara os arquivos de node com o
`workflow.json` LOCAL. Se um `pull` recente já trouxe seu conteúdo para o
`workflow.json` (mas o vivo foi revertido por fora), o `status` dirá "nada
pendente" e o `deploy` **não reenvia**. Nesse caso use um **patch cirúrgico**
(`patch-*.mjs`: GET-fresco → `.replace` → PUT), que ignora o diff de arquivos e
sempre age sobre o vivo atual.

## CONFIG (esta instância)

| chave | valor |
| --- | --- |
| WORKFLOW_ID | `Cr4fPWe0prwS6XjI` |
| API_HEADER | `X-N8N-API-KEY` |
| ENV_FILE | `.env.local` (raiz) — **nunca** commitado |
| ENV_KEY | `N8N_API_KEY` (fallback `N8N_PUBLIC_API`) |
| BASE_URL | `N8N_BASE_URL` (fallback `N8N_MCP_URL`) — usa-se só o `origin` |
| BASE_DIR | `n8n/ia-repasse-pro-v2` |
| TOOL_ENTRY | `scripts/n8n/repasse-maint.mjs` |

### Duas chaves — não confunda (causa nº1 de 401)

A REST API (GET/PUT) autentica com a **chave de API da conta** (JWT `eyJ…` de
Settings → API), que vive em `N8N_API_KEY`. O segredo de webhook
(`CRM_N8N_API_KEY`, header `x-api-key` de 64 hex) **não** serve para a REST API.

## CLI

```bash
node scripts/n8n/repasse-maint.mjs pull             # GET vivo → workflow.json + nodes/ + manifest + snapshot
node scripts/n8n/repasse-maint.mjs status           # nodes com edição local pendente
node scripts/n8n/repasse-maint.mjs build            # remonta workflow.json (valida estrutura + JS)
node scripts/n8n/repasse-maint.mjs deploy           # DRY-RUN: re-puxa, checa drift, valida, mostra o diff
node scripts/n8n/repasse-maint.mjs deploy --confirm # PUT + reativa + re-sync dos arquivos
```

Atalhos: `npm run n8n:pull` / `n8n:status` / `n8n:deploy`. Testes:
`npm run test:n8n-tool`.

## Decomposição (este repo)

- **Code nodes** → `nodes/code/NN_seq_slug.js` (33 arquivos).
- **Prompts ESTÁTICOS de Agente** → `nodes/prompts/NN_seq_slug.md` (2: Memory 1 / Memory 2).
- **Prompts montados por expressão** (`=…`: Router Agent, Bia 1, Bia 2 ESTOQUE, Bia 2
  SEM ESTOQUE) **NÃO viram arquivo** — vivem em `parameters.options.systemMessage`
  no `workflow.json`. Edite-os lá por âncora; `deploy --confirm` envia o JSON inteiro.
- `NN` (stage) é inferido pela **posição x** do node (ver [stages.json](stages.json)),
  porque o canvas **não é renomeado** — 450 refs `$('Nome')` + 25 patch scripts
  dependem dos nomes atuais. Edite as faixas em `stages.json` e re-`pull`.

Cada arquivo extraído tem um **header com sentinela**; edite só o corpo abaixo
dela. `status`/`build`/`deploy` comparam apenas o corpo (o header é ignorado).

## Arquivos versionados

- `workflow.json` — espelho canônico do vivo (credential refs mantidas).
- `workflow.import.json` — cópia portável (`active:false`) p/ reimportar noutra instância.
- `workflow-context.json` — inventário: versionId, updatedAt, contagens.
- `manifest.md` — mapa node→arquivo por stage + conexões + checklist (gerado).
- `nodes/.snapshot.json` — sha256 por node (base da detecção de drift).

## Relação com o toolchain existente

Este tool **convive** com os scripts de patch cirúrgico (`scripts/n8n/patch-*.mjs`)
e o **guard anti-regressão** ([scripts/n8n/guard-live-workflow-sync.mjs](../../scripts/n8n/guard-live-workflow-sync.mjs),
hook `PreToolUse`). Rode o guard **primeiro** em qualquer tarefa no workflow vivo;
o `deploy --confirm` deste tool já faz GET fresco + checagem de drift + backup +
reativação, no mesmo espírito dos patches.

## Settings no PUT (pegadinha 400)

`settings` é `additionalProperties:false`. O GET desta instância devolve
`timeSavedMode: "fixed"`, que o **PUT recusa (HTTP 400)** — o tool remove esse
campo e envia só o allowlist (ver [deploy_body.mjs](../../scripts/n8n/tool/deploy_body.mjs)).

## Lógica pura dos parsers — fonte canônica + rede de testes

Os `Code Parse *` (que parseiam a saída dos agentes) carregam lógica pura
**inline e duplicada** porque Code nodes do n8n **não importam módulos locais**.
A fonte canônica byte-extraída vive em
[scripts/n8n/tool/parsers/blocks/](../../scripts/n8n/tool/parsers/blocks/):

| bloco canônico | nós que carregam | o que faz |
| --- | --- | --- |
| `commerce_context.block.js` | Code Commerce Context + Code Parse Bia 2 SEM ESTOQUE (×1 após a fusão) | color-guard (anti-alucinação de cor), `deriveStage` |
| `json_repair.block.js` | Code Parse Memory 1 e 2 | strip de cerca markdown + reparo de aspas não-escapadas |
| `bia1_tradein.block.js` | Code Parse Bia 1 | decisão de trade-in (consentimento/questionário/`canSimulate`) |
| `repasse-humanizer.mjs` (`N8N_HUMANIZER_BLOCK`) | Bia 1, Re-sim, Bia 2 SEM ESTOQUE (×1 após a fusão) | sanitiza travessão/`;`/`!` na mensagem final |

> **Fusão Bia 2 (2026-06-18):** os gêmeos de continuidade (`Code Parse Bia 2 SEM ESTOQUE1`, `CODE MONTAR LINK REPASSE `, `Split Out5`) foram **removidos** — sobrou uma cópia de cada. Os testes de "gêmeos" desses nós saíram do `parsers.test.mjs`; Split Out caiu de ×3 para ×2.

A rede [parsers.test.mjs](../../scripts/n8n/tool/tests/parsers.test.mjs) (`npm run
test:n8n-tool`) trava três coisas: **(1)** caracterização (saídas conhecidas das
funções), **(2)** fidelidade (bloco canônico == nó vivo) e **(3)**
consistência-de-duplicação (todas as cópias byte-idênticas). Edite a lógica no
bloco canônico, reaplique nos nós e rode a rede — qualquer drift entre cópias falha.

### Contrato de re-anexação (por que cada parser lê nós irmãos)

Os `@n8n/n8n-nodes-langchain.agent` emitem só `{ output }` e **dropam o contexto
upstream**; por isso cada parser reconstrói o que os nós a jusante leem, via
`$('Nome irmão').last()`. Acoplamento temporal — **não realoque/renomeie** esses
nós sem atualizar o parser correspondente:

| parser | re-anexa de | campos |
| --- | --- | --- |
| Code Parse Router | — (só `$json`) | passa `ctx` + `router` |
| Code Parse Memory 1 | — (só `$json`) | + `memory_extraction` |
| Code Parse Memory 2 | `$('CRM Leads GET')`, `$('Edit Fields')` | `lead_state` (prev), `last_message_content` |
| Code Parse Bia 1 | `$('Edit Fields5')` | estado de trade-in / `message_buffered` |
| Code Parse Re-simulação Bia 2 ESTOQUE | `$('Edit Fields10')`, `$('Code Refresh Lead State Before Switch2')` | trade-in/entrada/cartão/desejo |
| Parse Simulator | `$('Montar Body do Simulador')` | `ctx`/`memory` + `simulation_result` |
| Code Parse Bia 2 SEM ESTOQUE (×1) | `Edit Fields3/4/5/10`, `Node13-…` | cores permitidas/mencionadas (color-guard) |

> `Code Parse Re-simulação` retorna `[]` quando não há re-simulação — isso é
> **intencional**: a resposta normal já saiu pela outra saída da `Bia 2 ESTOQUE`
> (→ `Edit Fields3`); emitir um objeto aqui empurraria item espúrio p/ `Montar Body`.

### Fusão Bia 2 unificada (2026-06-18, versão `2d26d6dd`)

Os dois agentes Bia 2 viraram **um só nó**. O nome `Bia 2 SEM ESTOQUE ` mentia — o prompt dela era `BIA 2 CONTINUIDADE` (FAQ, cidade, apresentação de simulação, entrada-antes-de-simular, retomadas). **Sobrevivente = `Bia 2 ESTOQUE`** (identificador preservado → não quebra refs/patches).

- **Repontadas** para o sobrevivente: `Switch1[main0 fora_escopo]`, `Switch3[main2 bia2_continuation]`, `Parse Simulator[main0]`.
- **Removidos (17 nós continuidade-exclusivos):** `Bia 2 SEM ESTOQUE `, `OpenRouter Chat Model4`, `Postgres Chat Memory2`, `Edit Fields13`, `Code Parse Bia 2 SEM ESTOQUE1`, `CODE MONTAR LINK REPASSE `, `Split Out5`, `Edit Fields11/12`, `Split Out4`, `Loop Over Items2`, `HTTP Request1`, `Wait3`, `If`, `CRM Leads POST`, `No Operation do nothing1/5`. **Bia 1 (`If4`/`CRM Leads POST4`) preservada** — pipeline próprio; sobrevivente envia por `CRM Leads POST2`. Conjunto derivado por delta de alcançabilidade.
- **Prompt unificado:** base ESTOQUE + 4 blocos exclusivos da continuidade (entrada-antes-de-simular, continuidade-sem-consulta, convencer-seminovo, `tradein_condition_human_eval`) + preâmbulo `MODO DE OPERAÇÃO POR CONTEXTO`. Campo `text` defensivo + expõe `routing_decision`/`last_inventory_context`.
- **Ferramentas:** [transform-bia2-merge.mjs](../../scripts/n8n/transform-bia2-merge.mjs) (puro/idempotente) + [deploy-bia2-merge.mjs](../../scripts/n8n/deploy-bia2-merge.mjs) (`DRY=1`, `--rollback <backup>`). **Topologia/prompt-expressão NÃO vão por `repasse-maint deploy`** (o `compose()` só faz splice de código/prompt-estático).
- **Verificado ao vivo:** controle Bia 1 inalterado; pergunta de entrada dispara do nó unificado (Switch3); `Parse Simulator → Bia 2 ESTOQUE` apresenta a simulação completa (1x–18x); `errors:[]`. Spec/plano: [spec](../../docs/superpowers/specs/2026-06-18-bia2-unificada-design.md) · [plano](../../docs/superpowers/plans/2026-06-18-bia2-unificada.md).

## Evolução do fluxo FAQ/FLUXO (2026-06-18) — o que está no vivo

Spec: [docs/superpowers/specs/2026-06-17-ia-fluxo-atendimento-evolucao-design.md](../../docs/superpowers/specs/2026-06-17-ia-fluxo-atendimento-evolucao-design.md).
Plano: [docs/superpowers/plans/2026-06-17-ia-fluxo-atendimento-evolucao.md](../../docs/superpowers/plans/2026-06-17-ia-fluxo-atendimento-evolucao.md).
Abordagem **híbrida**: determinismo (estado/ordem) no `Code Routing Flags`; voz/venda nos prompts. Para re-aplicar (ex.: após reversão por save na UI), rode o script indicado com `DRY=1` antes.

| Mudança | Onde | Marcador / re-aplicar |
| --- | --- | --- |
| D1 — cidade de retirada **só após simulação** | `Code Routing Flags` (`needsPickupCity`/`ask_pickup_city_after_sim`) + prompts Bia | routing via `repasse-maint deploy`; prompts via [patch-bia1-remove-city-before-stock.mjs](../../scripts/n8n/patch-bia1-remove-city-before-stock.mjs) (`REGRA DE CIDADE (SO APOS A SIMULACAO)`) |
| D2 — cor **não exigida** p/ simular | `Code Routing Flags` (`shouldRequireDesiredColor` → false) | `repasse-maint deploy` |
| D3 — **não reperguntar entrada** | `Code Routing Flags` (`cashEntryResolved` inclui `cash_entry_amount`; `!card_brand`) | `repasse-maint deploy` |
| D5 — confirmar variante (13→Pro/Pro Max) | `Code Routing Flags` (`needs_model_tier_confirmation`/`ask_model_tier`) | `repasse-maint deploy` |
| Condições do trade-in (líquido/arranhões/peça) → **avaliação humana** | `Code Routing Flags` (`tradeinConditionBlocks`/`tradein_condition_human_eval`) + Bia 2 SEM ESTOQUE | `repasse-maint deploy` + [patch-bia2-semestoque-convince-city.mjs](../../scripts/n8n/patch-bia2-semestoque-convince-city.mjs) |
| Coerção de booleanos do lead_state (`boolean\|null`) — anti bot-mudo | `Code in JavaScript2` (`coerceLeadStateBooleans`) | `repasse-maint deploy` |
| Set tolerante (defesa em profundidade) | `Edit Fields5` (`options.ignoreConversionErrors`) | [patch-editfields5-ignore-conversion.mjs](../../scripts/n8n/patch-editfields5-ignore-conversion.mjs) |
| `stripBrowsingPrices` (preço só sob demanda) | bloco `commerce_context.block.js` + 3 cópias | `repasse-maint deploy` (testes `parsers.test.mjs`) |
| Memory 2 carry-forward + correção asterisco | `Memory 2 - Reconciler` (.md) | `repasse-maint deploy` |
| Bia 1 — lista curta / preço sob demanda / sem "compra direta" | `Bia 1` (expressão) | [patch-bia1-price-city-list.mjs](../../scripts/n8n/patch-bia1-price-city-list.mjs) (`ATUALIZACAO DE FLUXO (FAQ/FLUXO) v1`) |
| Bia 2 ESTOQUE — cor pós-sim | `Bia 2 ESTOQUE` (expressão) | [patch-bia2-estoque-color.mjs](../../scripts/n8n/patch-bia2-estoque-color.mjs) (`COR POS-SIMULACAO (FAQ/FLUXO) v1`) |
| Memory 1/2 — **preservar tier** por device | `Memory 1`/`Memory 2` (.md) | [patch-memory-preserve-tier.mjs](../../scripts/n8n/patch-memory-preserve-tier.mjs) (`PRESERVE O TIER`) |
| `sessionKey` do Memory4 (sintaxe `=2{{` → `={{ '2m'`) | `Postgres Chat Memory4` | [patch-memory4-sessionkey-syntax.mjs](../../scripts/n8n/patch-memory4-sessionkey-syntax.mjs) |

### Refino de voz pós-replay VD (2026-06-18, versão `7ee63726`)

Quatro defeitos conversacionais observados ao reproduzir o transcript do lead VD contra o sandbox `558899990507` — todos nos `systemMessage` das Bias, aplicados por [patch-bia-faq-flow-v2.mjs](../../scripts/n8n/patch-bia-faq-flow-v2.mjs) (idempotente, `DRY=1` para preview):

| Defeito observado | Onde | Marcador / re-aplicar |
| --- | --- | --- |
| Negava "tabela fixa" em vez de reposicionar | `Bia 1` (expressão) | marcador `algo melhor que uma tabela` — não nega; enquadra com valor (atendimento personalizado → simulação completa > tabela) |
| Repetia info não solicitada (horário/abertura da loja) 3× | `Bia 1` / `Bia 2 ESTOQUE` / `Bia 2 SEM ESTOQUE ` (expressão) | marcador `NAO REPETIR INFORMACAO NAO SOLICITADA` (bloco compartilhado após a âncora "Reafirmar a escolha…") |
| Perguntava cor do **desejado** (depende do estoque → perda de venda) | `Bia 1` (expressão) | marcador `NÃO peça nem ofereça a cor do iPhone DESEJADO` + remoção da pergunta `desired_color` do catálogo e do exemplo "Falta cor do desejado" |
| Cauda redundante "ou vai direto?"/"ou prefere tudo no cartão?" | `Bia 1` / `Bia 2 ESTOQUE` / `Bia 2 SEM ESTOQUE ` (expressão) | bloco `SEM CAUDA REDUNDANTE` (compartilhado) + correção do exemplo de entrada no `Bia 2 SEM ESTOQUE ` (`NUNCA acrescente "ou prefere tudo no cartao?"`) |

> Observação: a cor do **trade-in** (aparelho de entrada) continua sendo perguntada — faz parte da avaliação. A regra só remove a pergunta de cor do aparelho **desejado**.

### Correção: "simulação caiu na Bia 1 que não simula" (2026-06-18, versão `f4fb20dc`)

**Sintoma:** com tudo coletado (modelo + capacidade confirmados, trade-in avaliado e limpo, cliente pedindo simulação), o roteamento ficava preso em `bia1_pre_inventory` — a Bia 1 prometia "vou preparar a simulação… já te passo com um especialista" e transferia para humano, **sem nunca rodar o Simulador**.

**Causa raiz** (em [50_01_code-routing-flags.js](nodes/code/50_01_code-routing-flags.js)): os gates `eligibleForInventory` e o `desiredOk` de `context_ready` exigiam `!!(desired_color || desired_condition)`. Como a regra acima **removeu a pergunta de cor do desejado** (e `desired_condition` nunca é coletado), esses campos ficam `null` para sempre → `eligibleForInventory=false` e `context_ready=false` → nunca busca estoque, nunca pergunta entrada, sempre cai em `bia1_pre_inventory`. Remover a pergunta de cor **matou de fome** o gate que avança para a simulação.

**Fix:** ambos os gates passam a exigir só `desired_model && desired_capacity` (cor/condição são resolvidas pelo estoque). Isso **também restaura** a pergunta obrigatória de entrada antes de simular (`ask_cash_entry_before_sim`), que dependia de `eligibleForInventory`.

**Regressão travada** (`routing-flags.test.mjs`, testes `D6`): compra com trade-in limpo e `desired_color=null`/`desired_condition=null` **não** pode dar `bia1_pre_inventory` — deve pedir entrada (`ask_cash_entry_before_sim`) e, com entrada+bandeira resolvidas, avançar para `inventory_or_simulator`.

**Verificação ao vivo** (driver turn-by-turn [scripts/n8n/smoke-step.mjs](../../scripts/n8n/smoke-step.mjs)): fluxo completo VD-adaptado chega ao `Simulador` e produz cotação correta — iPhone 15 Pro Max 256GB Titânio Azul R$ 5.390, trade-in iPhone 13 R$ 1.700, entrada Pix R$ 500, líquido R$ 3.190, parcelas 1–18×. **Cuidado buffer-race:** o smoke ao vivo dispara execuções paralelas inconsistentes por turn; valide pelo `runData` do `Simulador`/`Montar Body` da execução correta, não pela reply postada (um gêmeo pode postar "tem cor de preferência?").

**Memória de chat (sessionKey por agente):** Bia 1/2 ESTOQUE/2 SEM ESTOQUE
compartilham `<lead_id>` (mesma voz com o cliente); `Memory 2 - Reconciler` usa
`m<lead_id>` e `Memory 1 - Extractor` usa `2m<lead_id>` — **distintos de propósito**
para a memória dos agentes de análise não se misturar. O nó Postgres
**"Delete table or rows"** é um utilitário de debug **desconectado** (não roda no
fluxo); apaga `n8n_chat_histories` por `session_id`.

Rede de testes determinística (`npm run test:n8n-tool`): `routing-flags.test.mjs`
(D1–D6 + condições de trade-in) e `code-in-javascript2.test.mjs` (coerção de
booleanos, incl. regressão `cash_entry_intent="negociacao"`).
