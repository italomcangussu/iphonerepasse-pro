# Design — Evolução do fluxo de atendimento da IA (CRM Plus / n8n v2)

**Data:** 2026-06-17
**Workflow alvo:** `Cr4fPWe0prwS6XjI` ("ia repasse-pro v2 avancada")
**Abordagem aprovada:** C — Híbrida (determinismo para estado/ordem, prompt para linguagem/venda)

## Contexto e motivação

Caso real que disparou o trabalho: lead **VD (+558897107383)**, conversa
`26c2b4be-1309-4fea-9e71-e653693af001` (48 mensagens, 1h32min, **zero
simulações produzidas**, despejada no humano com status
`transferencia_pendente`). A conversa viola quase todas as regras de FAQ/FLUXO
desejadas pelo negócio:

| # | O que aconteceu | Regra violada |
|---|---|---|
| 1 | "Qual tem disponível?" / "Quais você tem?" (3×) → IA sempre deflectiu ("preciso verificar"), nunca mostrou lista | Disponibilidade: buscar, não negar / lista curta sem valores |
| 2 | Perguntou cidade de retirada às 20:07, antes de qualquer simulação | Local de retirada só após simulação + intenção clara |
| 3 | Perguntou cor às 20:11, antes da simulação | Cor não importa p/ simulação; vem depois |
| 4 | "...ou é **compra direta**?" | Termo desumanizador |
| 5 | "Quero dar um **13**" → nunca confirmou 13 / Pro / Pro Max | Confirmar variante do modelo |
| 6 | "Existe diferença de valores?" (2×) → recusou | Deve informar diferença de preço |
| 7 | **"Ótimo, Dourado então!"** — cliente nunca disse Dourado (alucinação); depois confirmou/negou cor inexistente | Não confirmar/inventar cor que não tem |
| 8 | Ofereceu Titânio Azul **e** Natural (20:36), mas só Natural existia (21:04) | Não oferecer cor fora de estoque |
| 9 | Re-perguntou entrada **4×** depois de "Quero dar 500" | Não reperguntar entrada/parcelamento já informado |
| 10 | 1h32min, zero simulações, despejado no humano | (resultado de tudo acima) |

## Regras de negócio (fonte: FAQ/FLUXO do usuário)

**FAQ**
- Se cliente pedir tabela: **não negar**; investigar o aparelho que busca.
- "perguntar se tem aparelho de entrada" ou "compra direta" são **termos
  desumanizadores** — evitar.
- Ser **direto** ao pedir autorização das perguntas do seminovo: "posso te
  fazer algumas perguntas sobre o seu iPhone?"

**FLUXO**
- Pergunta genérica/inespecífica → trazer **lista curta sem valores**.
- Pergunta por disponibilidade → **buscar**, não negar.
- Local de retirada → **após** simulação + intenção clara de compra.
- Cor do aparelho desejado → **não** é necessária para simular; vem como
  sugestão **após** as simulações ou sob demanda.
- Cliente informa modelo base (13, 14, 15) → **confirmar** se é normal, Pro ou
  Pro Max.
- Entender correção por **asterisco** (`*`).
- Diferença de preço entre aparelhos → a IA **deve poder informar**.
- **Não confirmar cor que não tem**; se a cor pedida não existe, informar e
  convencer a escolher uma disponível.
- Oferecer especialista por falta de modelo/cor **só** para iPhones **novos**;
  para **seminovos**, convencer mostrando simulação.
- **Não reperguntar** forma de entrada/parcelamento já informada.

## Decisões de produto (confirmadas no brainstorming)

1. **Cidade × Estoque:** o estoque é por cidade (Fortaleza ≠ Sobral). A IA passa
   a buscar/simular sobre o **estoque consolidado das duas lojas** e só pergunta
   onde retirar **depois** que o cliente aceita a simulação. Se o item escolhido
   só existir em uma cidade, isso é informado junto com a proposta.
2. **Política de preço:** a IA **não oferece** preço na navegação, mas
   **responde quando perguntam** — preço à vista de um modelo e diferença entre
   dois. Parcelamento/entrada/troca continuam só dentro da simulação.
3. **Formato da lista curta:** modelo + capacidade, agrupado, marcando
   novo/seminovo quando relevante, **sem cor e sem preço**, terminando com uma
   pergunta que afunila ("qual desses te interessa?").

## Arquitetura

O fluxo permanece estruturalmente igual (nenhum node é renomeado — 450
referências `$('Name')` + 25 scripts de patch dependem dos nomes atuais):

```
Router Agent → Switch1 → Memory 1/2 → Code in JavaScript2 →
Edit Fields5 → Code Routing Flags → Switch3 →
(inventory-lite / simulator | Bia 1 | Bia 2 ESTOQUE | Bia 2 SEM ESTOQUE)
```

O comportamento muda em duas camadas:

### Camada 1 — Determinística (estado e ordem)

Arquivo principal: [scripts/n8n/repasse-code-routing-flags.js](../../../scripts/n8n/repasse-code-routing-flags.js)
(espelhado em `n8n/ia-repasse-pro-v2/nodes/code/50_01_code-routing-flags.js`),
mais persistência no Memory 2 e o color-guard nos parsers.

| Rule | Superfície | Mudança |
|---|---|---|
| Retirada só após simulação | `needsClientCityBeforeStock` (linhas 209-213, 250-253) | Remover a cidade como gate **pré-estoque**; buscar estoque consolidado sem cidade; novo passo pós-sim `needsPickupCity` |
| Cor não exigida p/ simular | `shouldRequireDesiredColor` (58-60), `missing_fields` (186) | Cor nunca entra em `missing_fields`/`context_ready`; `desired_condition` sozinho satisfaz |
| Não reperguntar entrada/parcela | `needsCashEntryQuestion` (223-228) + persistência Memory 2 | Guard: uma vez setados `cash_entry_intent`/`amount`/`card_brand`, não re-disparam pergunta (confia no estado persistido) |
| Não inventar/confirmar cor ou preço fora do estoque | **color-guard** dos parsers + guard de preço | Remove/sinaliza qualquer cor/preço que o bot cite e que não esteja em `available_colors`/inventário |

### Camada 2 — Prompt (linguagem e comportamento de venda)

Prompts **expression-built** (`=…`) ficam em `workflow.json`: Router Agent,
Bia 1, Bia 2 ESTOQUE, Bia 2 SEM ESTOQUE. O prompt **estático** Memory 2 -
Reconciler é o espelho `.md`
([n8n/ia-repasse-pro-v2/nodes/prompts/40_04_memory-2-reconciler.md](../../../n8n/ia-repasse-pro-v2/nodes/prompts/40_04_memory-2-reconciler.md)).

| Rule | Prompt |
|---|---|
| Não negar tabela → investigar; lista curta sem preço | Bia 1 (pré-estoque) |
| Buscar disponibilidade, não deflectir | Bia 1 (consome `available_*` do estado) |
| Diferença de preço sob demanda; preço à vista sob demanda | Bia 1 / Bia 2 |
| Sem "compra direta"; autorização seminovo direta | Bia 1 / Memory 2 |
| Confirmar 13 → 13/Pro/Pro Max | Router / Memory 2 (disambiguação de variante) |
| Cor como sugestão pós-sim; só ofertar cores em estoque | Bia 2 ESTOQUE |
| Convencer no seminovo / handoff só p/ novo | Bia 2 SEM ESTOQUE |
| Correção com asterisco (`*`) | Memory 2 reconciler |

## Detalhamento — Camada determinística

### D1. Cidade pós-simulação (consolidado das 2 lojas)
- Remover o gate `needsClientCityBeforeStock` (209-213) e o branch
  `ask_client_city_before_stock` (250-253).
- `eligibleForInventory` (214-219) deixa de exigir `!!state.preferred_city` →
  a busca de estoque roda **sem** cidade.
- A consulta de inventário que alimenta
  [60_03_code-build-inventory-lite.js](../../../n8n/ia-repasse-pro-v2/nodes/code/60_03_code-build-inventory-lite.js)
  passa a retornar itens das **duas** lojas (já carrega `item.stores.city` +
  `sell_price` por item — basta parar de filtrar por cidade upstream e manter
  `city` em cada `formatOption`).
- Novo passo `needsPickupCity`: dispara apenas quando
  `postSimulationFlow === true && proposal_accepted === true && !preferred_city`.
  Nova rota `ask_pickup_city_after_sim` → Bia 2 continuation. **Único** lugar
  onde a cidade é perguntada.
- A cidade do item escolhido viaja com a proposta (Bia pode dizer "esse está
  em Sobral").

### D2. Cor não exigida para simular
- `shouldRequireDesiredColor` (58-60) → sempre `false` (ou remover).
- `missing_fields` nunca empurra `desired_color` (186).
- `context_ready`/`eligibleForInventory` já usam
  `(desired_color || desired_condition)` → `desired_condition` sozinho basta e
  a cor deixa de bloquear.

### D3. Não reperguntar entrada/parcelamento (anti-loop)
- Causa raiz do loop 4× no VD: `cash_entry_*` / `card_brand` não eram tratados
  como resolvidos.
- Endurecer `cashEntryResolved` (106): qualquer um de
  `cash_entry_asked | cash_entry_intent != null | cash_entry_amount != null`
  resolve.
- `needsCashEntryQuestion` (223-228) passa a exigir também `card_brand == null`
  — uma vez dada a bandeira, nunca mais se pergunta entrada.
- Memory 2 reconciler faz **carry-forward** de `cash_entry_intent`,
  `cash_entry_amount`, `card_brand`, `preferred_city` em todo turno
  (overlay-only, nunca dropar). A coalesce-preserve do `upsert_lead_state`
  protege contra a buffer-race.

### D4. Guard anti-alucinação de cor/preço
- Estender o **color-guard** existente (em
  [scripts/n8n/tool/parsers/](../../../scripts/n8n/tool/parsers/)): qualquer cor
  citada na resposta do bot que **não** esteja em `available_colors` é
  removida/sinalizada (mata o "Ótimo, Dourado então!").
- Mesma ideia para qualquer **preço concreto** que não derive de
  inventário/simulador.

### D5. Confirmar variante do modelo (13 → 13/Pro/Pro Max)
- Gate determinístico: quando `desired_model` casa com geração nua
  (`/^iphone 1[0-9]$/` sem tier) **e** a família tem variantes Pro/Pro Max em
  estoque, setar `needs_model_tier_confirmation = true` para o prompt confirmar
  antes de tratar como modelo base. Reusar `parseIphoneModel` (já existe no
  inventory-lite).

## Detalhamento — Camada de prompt

### P1. Bia 1 (pré-estoque)
- **Nunca negar tabela.** Em pedido de tabela/genérico → montar a **lista
  curta** (modelo + capacidade, agrupado, novo/seminovo, **sem cor, sem
  preço**), terminando em pergunta que afunila. Fonte:
  `available_models`/`available_capacities`/`available_conditions`.
- **Disponibilidade = buscar, não deflectir.** Banir "preciso verificar / ainda
  vou conferir"; se `available_*` está populado, responder a partir dele.
- **Autorização do seminovo, direta:** "posso te fazer algumas perguntas sobre o
  seu iPhone?" (remover "perguntas rápidas de avaliação").
- **Sem "compra direta":** substituir por frase humanizada (ex.: "você pretende
  dar um iPhone usado como parte do pagamento?").

### P2. Bia 1 / Bia 2 — preço sob demanda
- Default: não oferecer preço. Se o cliente pergunta preço de um modelo → dar o
  **à vista** (`sell_price`); diferença entre dois → calcular e informar a
  diferença; parcelas/entrada/troca → "te mostro certinho na simulação".

### P3. Bia 2 ESTOQUE — cor e simulação
- Cor é **sugestão pós-simulação** ou sob demanda — não perguntar antes de
  simular.
- **Só ofertar cores presentes em `available_colors`.** Se o cliente pede cor
  fora de estoque → informar a indisponibilidade e direcionar para as cores
  disponíveis (nunca confirmar/inventar). Respaldado pelo color-guard (D4).

### P4. Bia 2 SEM ESTOQUE — convencer vs. transferir
- Falta de modelo/cor: **seminovo → convencer** (mostrar alternativa próxima +
  simulação), **não** oferecer especialista. Oferecer especialista **só** para
  iPhone **novo** indisponível.

### P5. Router / Memory 2 — variante e correção com asterisco
- Quando o cliente diz só "13/14/15" e há variantes Pro/Pro Max em estoque
  (`needs_model_tier_confirmation` da D5) → confirmar "normal, Pro ou Pro Max?"
  antes de fixar `desired_model`.
- **Correção com `*`:** Memory 2 reconciler interpreta `* texto` como correção
  da última mensagem do cliente (sobrescreve o campo correspondente), não como
  nova entrada.
- Memory 2 reforça o **carry-forward** de `cash_entry_*` / `card_brand` /
  `preferred_city` (overlay-only).

**Restrição:** os prompts Bia/Router são expression-built (`=…`) e ficam em
`workflow.json`; só o Memory 2 estático é o `.md`. O `prompt-invariants.test.mjs`
trava o **contrato de saída** (shape do JSON) — a reescrita de texto não pode
quebrá-lo.

## Fluxo de dados

- **Consulta de inventário** (node HTTP que alimenta o inventory-lite): hoje
  escopada por `preferred_city`. Passa a consultar **todas as lojas**; mantém
  `item.stores.city` + `sell_price` em cada `formatOption`. `available_*`
  refletem o pool consolidado. O caminho do simulador (`Montar Body` →
  `crm-simulator-quote`) já resolve `stock_item_id` contra
  `inventory.available_items`; a `city` do item escolhido acompanha a proposta.
- **Lista vs. simular:** `shouldPrecheckInventory` (Bia 1) já retorna o pool
  lite → fonte da lista curta. Simulação completa permanece gated por
  `shouldSimulateNow` / `repasseV2CanRequestSimulation`. Nenhum fetch novo para
  preço/diferença — ambos vêm do `sell_price` do pool lite.
- **Pickup city** passa a ser uma **escrita no fim**: quando
  `proposal_accepted` e sem cidade → rota `needsPickupCity` → após a resposta,
  `preferred_city` persiste pelo caminho normal `Edit Fields5 → POST Lead_State`.

## Tratamento de erros e guardrails

- **Anti-alucinação:** o color-guard (D4) é a rede de segurança mesmo se um
  prompt escorregar — o bot não consegue exibir cor/preço ausente de
  `available_*`. Memory 2 continua **graceful** em falha de parse
  (`memory.parse_error`, sem throw), preservando `prev`.
- **Segurança de persistência:** confiar na coalesce-preserve do
  `upsert_lead_state` para que o twin da buffer-race não apague
  `cash_entry_*`/`card_brand`/`preferred_city`.

## Testes e validação (TDD-first)

- `npm run test:n8n-tool`:
  - estender `parsers.test.mjs` (color/price guard);
  - `prompt-invariants.test.mjs` (nova redação deve manter o contrato de saída).
- Novos casos unitários de routing-flags: cidade-não-exigida-pré-estoque,
  cor-fora-de-missing, entrada-não-reperguntada-após-resolvida,
  confirmação-de-variante.
- **Cenário VD como regressão** no smoke harness (JID único — ver memória
  "repasse live-validation tooling"): reproduz a thread de 48 mensagens e
  afirma: aparece uma lista-curta, nenhuma pergunta de cidade/cor pré-sim, sem
  "compra direta", entrada perguntada ≤1×, uma simulação é de fato produzida.

## Disciplina de deploy (workflow vivo frágil)

- Rodar o **guard primeiro** (`guard-live-workflow-sync.mjs` / hook PreToolUse).
- Patches cirúrgicos para edições de prompt/consulta de inventário
  (GET → backup → `.replace()` exato → assert `new Function()` → PUT →
  `/activate` → re-export), ou `repasse-maint deploy --confirm` para os code
  nodes decompostos. `DRY=1` para preview. Reativar + re-sync ao final.
- **Nunca** usar o build script (clobbera e deixa o workflow OFF).

## Fora de escopo (YAGNI)

- Nenhum node novo de UI no CRM frontend.
- Sem mudança no esquema de `lead_state` além de garantir carry-forward dos
  campos já existentes.
- Sem renomear nodes.
- Matcher de FAQ comercial determinístico (`faq_found`) permanece como hook
  futuro já presente no routing-flags; não é reintroduzido aqui.
```
