# Evolução Comercial dos Agentes (Bia 1 / Bia 2) — Design

**Data:** 2026-06-18
**Workflow vivo:** `ia repasse-pro v2 avancada` (`Cr4fPWe0prwS6XjI`), versão de referência `2d26d6dd-f4b8-4f2c-97d1-d2cd9a18a342`, 128 nós, ativo.
**Origem:** diagnóstico `diagnostico-prompts-agentes-venda-ia-repasse-contexto-unificado.md` (anexo do usuário).
**Relacionado:** [2026-06-18-bia2-unificada-design.md](2026-06-18-bia2-unificada-design.md) (a Bia 2 já é um único nó; nome interno `Bia 2 ESTOQUE` preservado — **nunca renomear**).

---

## 1. Objetivo e escopo

Evoluir o comportamento comercial dos agentes **sem regressão**, em duas frentes coesas:

- **(A) Remover a pergunta de bandeira de cartão.** A IA nunca pergunta bandeira; a simulação avança por padrão em `visa_master`, sem reabrir perguntas antigas (cidade/cor) e **sem** regredir a entrada-antes-de-simular (feature de 2026-06-15).
- **(B) Tornar a Bia 2 ESTOQUE mais vendedora**, em 5 fases aditivas e independentes: CTA pós-simulação forte, régua de objeção de preço, recuperação de indeciso, recomendação ativa, e microconversões na Bia 1.

**Princípio dos dois-chapéus (uncle-bob):** cada item é uma mudança de **comportamento** (não de estrutura). (A) é uma mudança coesa em 2 camadas (gate + voz) que andam juntas. Cada fase de (B) é aditiva (enxerta um bloco rotulado novo; **não** reescreve o texto que funciona), reversível e travada por teste antes da próxima.

### 1.1 Métricas / contexto

| | Antes |
|---|---|
| Pergunta de bandeira no fluxo | sim (Bia 2 ESTOQUE tem `ESTÁGIO 2 — BANDEIRA DO CARTÃO` dedicado) |
| `card_brand` como gate de simulação | 4 cláusulas (3 em `50_01`, 1 em `50_04`) |
| Ocorrências de "bandeira" nos prompts | Bia 2 ESTOQUE: 16 linhas; Bia 1: 2; Router: 0 |
| CTA pós-sim | fraco (`"O que achou da proposta?"`, Bia 2 linha 239) |

---

## 2. Verificação técnica de (A)

A tese do diagnóstico (tirar a pergunta só no prompt trava a simulação) **se confirma**. `card_brand` é gate de simulação:

| Local | Linha | Cláusula | Papel |
|---|---|---|---|
| `repasseV2CanRequestSimulation` | [50_01:189](../../../n8n/ia-repasse-pro-v2/nodes/code/50_01_code-routing-flags.js) | `!!state.card_brand &&` | gate multi-cotação |
| `shouldSimulateNow` | [50_01:342](../../../n8n/ia-repasse-pro-v2/nodes/code/50_01_code-routing-flags.js) | `!!state.card_brand &&` | gate cotação única |
| `needsCashEntryQuestion` | [50_01:274](../../../n8n/ia-repasse-pro-v2/nodes/code/50_01_code-routing-flags.js) | `!state.card_brand &&` | dispara pergunta de entrada |
| `shouldSimulateNow` (refresh pré-Switch2) | [50_04:104](../../../n8n/ia-repasse-pro-v2/nodes/code/50_04_code-refresh-lead-state-before-switch2.js) | `!!inputData.card_brand &&` | gate re-simulação |

O Montar Body **já** resolve o default `visa_master` ([60_01:171](../../../n8n/ia-repasse-pro-v2/nodes/code/60_01_montar-body-do-simulador.js)).

### 2.1 Correção crítica vs. o diagnóstico

A sugestão §4.1 do diagnóstico (`state.card_brand = "visa_master"` global) **causaria regressão**: como `needsCashEntryQuestion` exige `!state.card_brand`, setar a bandeira faz a pergunta obrigatória de entrada **nunca disparar**. Por isso o fix **não** seta `state.card_brand`. Em vez disso, **remove `card_brand` como pré-requisito de simulação** (as 4 cláusulas acima). `card_brand` permanece `null` no `lead_state` salvo se o cliente citar uma bandeira espontaneamente; Memory 2 já o preserva e já separa entrada de bandeira ([40_04:58/61](../../../n8n/ia-repasse-pro-v2/nodes/prompts/40_04_memory-2-reconciler.md)).

`cashEntryResolved` ([50_01:127](../../../n8n/ia-repasse-pro-v2/nodes/code/50_01_code-routing-flags.js)) = `cash_entry_asked || cash_entry_intent != null || cash_entry_amount != null`. Junto com `postSimulationFlow !== true`, é suficiente para gatear a pergunta de entrada — a cláusula `!state.card_brand` é redundante e sai sem efeito colateral.

---

## 3. Design — (A) remover bandeira

### 3.1 Camada gate (código)

Remover **somente** estas 4 cláusulas (sem mexer no resto da expressão booleana):

1. `50_01` `repasseV2CanRequestSimulation`: apagar a linha `  !!state.card_brand &&`.
2. `50_01` `shouldSimulateNow`: apagar a linha `  !!state.card_brand &&`.
3. `50_01` `needsCashEntryQuestion`: apagar a linha `  !state.card_brand &&`.
4. `50_04` `shouldSimulateNow`: apagar `  !!inputData.card_brand &&`.

Nada é atribuído a `state.card_brand`. O `Montar Body` permanece intocado.

### 3.2 Camada voz (prompts-expressão em `workflow.json`)

`Router Agent` não menciona bandeira → sem mudança.

**Bia 2 ESTOQUE** — substituir o estágio dedicado e neutralizar as frases que pedem bandeira:

- `# ESTÁGIO 2 — BANDEIRA DO CARTÃO` (bloco linhas 221–227) → reescrito como:

```
# ESTÁGIO 2 — AVANÇO PARA SIMULAÇÃO (NUNCA PERGUNTE BANDEIRA)

Nunca pergunte a bandeira do cartão. A simulação usa a condição padrão do cartão automaticamente. Quando o cliente confirmar que a opção apresentada serve, avance direto para a simulação:

"Fechou. Vou simular na condição padrão do cartão pra você já ver como fica. 😊"

Se você ainda não perguntou sobre entrada, faça a pergunta de entrada (Pix/dinheiro) ANTES de simular — nunca pergunte bandeira no lugar dela.
Se o cliente informar uma bandeira espontaneamente, use-a; mas nunca bloqueie ou atrase a simulação por falta desse dado. Para o cliente, chame sempre de "condição padrão do cartão", nunca diga "visa_master".
```

- Frases de disponibilidade que terminam pedindo bandeira (linhas 169, 170, 176, 177, 181, 193, 195, 200, 202, 392, 395) → trocar o pedido de bandeira pelo avanço direto. Padrão de substituição:
  - `Qual a bandeira do seu cartão pra eu simular?` → `Vou simular na condição padrão do cartão pra você.`
  - `Qual a bandeira do seu cartão pra eu já simular o valor pra você?` → `Vou já simular o valor pra você na condição padrão do cartão.`
  - `… e peça a bandeira do cartão.` / `peca a bandeira do cartao.` → `… e conduza direto para a simulação na condição padrão do cartão.`
  - linha 181 (preço cru): remover `Qual a bandeira do seu cartao?` da mensagem, mantendo a apresentação do `sell_price` + "a condicao final no cartao eu consigo te passar certinha na simulacao."
- Menções de "bandeira" em listas de etapa (linha 80, 184) → remover o item "bandeira" da enumeração (mantém "cidade, capacidade, simulação ou fechamento").

**Bia 1** — remover "bandeira" das 2 menções:
- Linha 72 (lista "próxima etapa") → tirar "bandeira" da enumeração.
- Linha 219 (coleta de não-iPhone) → remover "e bandeira do cartão" da frase de coleta.

**Invariante:** o contrato de saída JSON e os marcadores de estágio/roteamento permanecem. `ESTÁGIO 3+` **não** são renumerados (texto os referencia por número — renumerar geraria churn e risco). O cabeçalho do `ESTÁGIO 2` muda de nome mas mantém a posição.

---

## 4. Design — (B) evolução comercial (5 fases aditivas)

Cada fase enxerta **um bloco rotulado novo** no `systemMessage`, sem reescrever os blocos existentes (mesmo método da fusão Bia 2). Texto exato de cada bloco abaixo.

### B1 — CTA pós-simulação forte (Bia 2 ESTOQUE, §7 do diagnóstico)

Substituir a linha fraca 239 (`Após a simulação: "O que achou da proposta? Quer que eu já encaminhe o fechamento? 😃"`) por:

```
Após a simulação, NUNCA feche com pergunta fraca ("o que achou?", "quer seguir?"). Conduza com proposta de valor + próximo passo concreto. Varie entre:
{"message": "Essa proposta ficou boa porque já considera seu aparelho de entrada e deixa o restante parcelado. Quer que eu já deixe o aparelho separado pra você?", "transfer": false}
{"message": "Se quiser deixar a parcela mais leve, dá pra simular com uma entrada maior. Prefere seguir com essa condição ou ajustar a entrada?", "transfer": false}
```

### B2 — Régua de objeção de preço (Bia 2 ESTOQUE, §8)

Inserir um bloco novo após `# REGRAS TRANSVERSAIS`:

```
# RÉGUA DE OBJEÇÃO DE PREÇO (TRATE ANTES DE TRANSFERIR)

Quando o cliente achar caro ou pedir desconto, NÃO transfira na primeira objeção. Suba a régua:
1ª objeção — reforce valor + ofereça caminho:
{"message": "Entendo. A proposta já considera a máxima avaliação do seu aparelho de entrada, garantia e a confiança da nossa loja. Quer que eu deixe a parcela mais leve com uma entrada, ou posso simular em mais vezes no cartão (vai até 18x)?", "transfer": false}
2ª objeção — ofereça alternativa concreta:
{"message": "Dá pra seguir por dois caminhos: reduzir a parcela com uma entrada maior, ou eu te mostro uma opção mais em conta no mesmo padrão. Quer que eu mande outras opções?", "transfer": false}
3ª objeção ou pedido explícito de negociação humana — aí sim transfira:
{"message": "Pra tentar uma condição fora da simulação padrão, vou chamar nosso especialista da iPhone Repasse pra ver o melhor cenário com você.", "transfer": true}
```

### B3 — Recuperação de cliente indeciso (Bia 2 ESTOQUE, §9)

Inserir bloco novo logo após `CONTINUIDADE SEM CONSULTA DE ESTOQUE`:

```
# RECUPERAÇÃO DE CLIENTE INDECISO (CONTINUIDADE — NÃO RECOMECE O ATENDIMENTO)

Quando o cliente some e volta, ou está em cima do muro, NÃO refaça perguntas já respondidas. Reengaje a partir do que já existe:
{"message": "A opção que simulamos ainda é uma boa referência. Quer seguir nela ou prefere que eu veja uma alternativa mais em conta?", "transfer": false}
{"message": "Pra eu te ajudar sem mandar um monte de opção solta, você prefere priorizar menor parcela ou melhor custo-benefício?", "transfer": false}
```

### B4 — Recomendação ativa + novo×seminovo (Bia 2 ESTOQUE, §10)

Inserir bloco novo dentro de `# CENÁRIOS DE ESTOQUE — LEIA PRIMEIRO` (após a apresentação de múltiplas opções):

```
# RECOMENDAÇÃO ATIVA (RECOMENDE, NÃO SÓ LISTE)

Com mais de uma opção disponível, recomende uma com justificativa curta em vez de listar tudo:
{"message": "Das opções disponíveis, eu iria no 256GB porque costuma ser o melhor equilíbrio entre espaço e valor. Quer que eu simule nele?", "transfer": false}
Novo vs seminovo, deixe o cliente escolher com critério:
{"message": "Se a ideia é economizar, o seminovo faz mais sentido. Se quer garantia Apple cheia, o novo é melhor. Qual caminho você prefere?", "transfer": false}
```

### B5 — Microconversões antes de perguntas (Bia 1, §5.3/§14.2)

Inserir bloco novo após `# COMO DECIDIR O QUE PERGUNTAR — LEIA PRIMEIRO`:

```
# MICROCONVERSÃO ANTES DE PERGUNTAR

Antes de uma pergunta importante (capacidade, autorização de avaliação do trade-in, entrada), dê um motivo curto que mostre benefício pro cliente:
{"message": "Pra eu buscar a opção certa pra sua necessidade, você procura iPhone com qual armazenamento?", "transfer": false}
{"message": "Pra tentar puxar o melhor valor possível no seu iPhone de entrada, posso te fazer umas perguntas rápidas sobre ele?", "transfer": false}
{"message": "Pra deixar a simulação mais próxima da realidade, você quer colocar algum valor de entrada no Pix ou prefere ver sem entrada?", "transfer": false}
```

---

## 5. Estratégia de não-regressão

**Sequência:** (A) deploy + smoke → B1 deploy + smoke → B2 … → B5. Cada fase parte do **vivo fresco** (guard `guard-live-workflow-sync.mjs` primeiro), faz backup em `output/n8n/backups/`, e tem `--rollback` disponível. Se um cenário regredir, reverte só a fase.

**Rede de teste por mudança (antes de cada deploy):**
- **Gates (A):** teste de caracterização/novo-comportamento sobre o routing flags puro: lead pronto **sem** `card_brand` → `shouldSimulateNow === true`; entrada não resolvida → `needsCashEntryQuestion === true` (a pergunta de entrada ainda dispara); entrada resolvida + `stock_item_id` → simula. Roda via `npm run test:n8n-tool`.
- **Integridade estrutural:** `structuralErrors(wf) === []`.
- **Sintaxe:** `new Function()` syntax-assert em todo código/expressão editada.
- **Contrato de prompt (toda alteração de prompt):** `prompt-invariants.test.mjs` verde — contrato de saída `{message, transfer}`, marcadores de roteamento/estágio, `NATURALIDADE` 1×, regra de cidade pós-sim, regra de cor por estoque, transferência humana em trade-in de risco.

**Deploy cirúrgico (padrão da casa):** GET vivo → backup → `replace()` exato com guards (cada `replace` assertado: a string-alvo existe 1× antes; a substituição muda o conteúdo) → syntax-assert → PUT com allowlist de `settings` (strip `timeSavedMode`) → `/activate` → re-export → re-sync do guard. `DRY=1` previa contra o vivo sem escrever.

**Cuidado buffer-race:** o smoke vivo dispara execuções paralelas inconsistentes por turno; verificar comportamento pelo runData da execução que rodou `Simulador`/`Montar Body`, não pela resposta postada.

---

## 6. Cenários de teste ao vivo (`smoke-step.mjs`)

Mapa dos 20 cenários do §18 do diagnóstico às fases:

| # | Cenário | Fase | Resultado esperado |
|---|---|---|---|
| 1–5 | pede iPhone / modelo+cap / nunca perguntado bandeira / simula em `visa_master` | A | simulação sem citar bandeira |
| 6 | cliente pergunta "qual cartão?" | A | não vira etapa; responde "condição padrão" e segue |
| 7 | informa bandeira espontânea | A | usa, mas não bloqueia |
| 8–10 | tudo no cartão / entrada Pix / sem entrada | A | entrada-antes-de-simular ainda dispara |
| 11–12 | trade-in completo / com dano | A | trade-in OK simula; dano → avaliação humana (inalterado) |
| 13 | acha caro | B2 | régua de objeção antes de transferir |
| 14 | pede desconto | B2 | régua de objeção |
| 15 | pede outra cor | A/B4 | cor por estoque (inalterado) + recomendação |
| 16 | aceita proposta | B1 | CTA forte → reserva |
| 17 | informa cidade pós-aceite | A | regra de cidade pós-sim (inalterado) |
| 18 | manda comprovante Pix | — | inalterado |
| 19 | volta depois de sumir | B3 | recuperação sem recomeçar |
| 20 | pede especialista | B2 | transfere |

**Controle:** caminho Bia 1 de qualificação inalterado; fusão Bia 2 (`2d26d6dd`) preservada.

---

## 7. Fora de escopo

- Renomear o nó `Bia 2 ESTOQUE` (≥450 refs `$('Nome')` + patch scripts dependem do nome).
- Mudanças no Router Agent (não roteia por bandeira), no Simulador, no HTTP de estoque, na regra de cidade pós-sim, na regra de cor por estoque, na transferência humana de trade-in de risco.
- Memory 1/2: nenhuma mudança (já tratam `card_brand` como opcional). Não adicionar extração obrigatória.
- Persistir `visa_master` no `lead_state`.

## 8. Riscos

| Risco | Mitigação |
|---|---|
| Remover gate de `card_brand` quebra a pergunta de entrada | A cláusula `!state.card_brand` de `needsCashEntryQuestion` também sai; `cashEntryResolved`+`postSimulationFlow` cobrem; teste de caracterização trava |
| Mudança de voz quebra contrato de saída/roteamento | Blocos aditivos rotulados (não reescrita) + `prompt-invariants` + smoke por fase |
| Edição na UI do n8n durante o ciclo reverte mudanças | Guard primeiro sempre; patch cirúrgico; verificar pelo runData |
| Buffer-race confunde verificação | Validar pela execução que rodou `Simulador` |
| Patch de prompt encontra string ambígua/ausente | Cada `replace` assertado (existe 1×, muda conteúdo) antes do PUT |
