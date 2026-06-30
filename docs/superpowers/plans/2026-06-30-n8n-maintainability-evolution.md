# Plano — Evoluir a manutenibilidade do workflow n8n vivo (sem regressão)

> Workflow vivo: `Cr4fPWe0prwS6XjI` ("ia repasse-pro v2 avancada"). Toolchain atual em
> `scripts/n8n/` + `scripts/n8n/tool/`. Este plano aplica as 4 evoluções de maior impacto
> (#1, #2, #3, #5 do diagnóstico) ao repo, de forma incremental e reversível. Cada fase é
> independente, entra verde, e não muda o comportamento do deploy existente até ser adotada.

## Princípios
- **Aditivo primeiro, migração depois.** Nada remove os 65 patches nem o guard atual antes de a
  alternativa estar provada. O sistema antigo continua funcionando durante toda a transição.
- **Rede de testes antes de tocar lógica viva.** `npm run test:n8n-tool` deve ficar verde a cada
  commit. Cada módulo novo entra com seu teste puro.
- **O vivo é canônico.** Toda fase que mexe em deploy/guard é validada com `DRY=1`/dry-run contra o
  vivo antes de qualquer PUT real.

---

## Fase 1 — `patch-kit.mjs` (evolução #2): matar a duplicação de I/O
**Problema:** 65 `patch-*.mjs` reimplementam `readEnvFile`, `n8nFetch`, `replaceOnce`, backup, PUT,
activate, verify (~120 linhas idênticas cada).

**Entrega:**
1. `scripts/n8n/tool/patch-kit.mjs` extraindo, da forma JÁ usada nos patches, as funções:
   `getLive()`, `backup(live, label)`, `replaceOnce(hay, needle, repl, label)`, `assertSyntax(code)`,
   `safePut(rebuilt, {activate=true})`, `dry(obj, file)`. Reusa `netio.mjs`/`deploy_body.mjs`
   existentes (não duplica). `backup` aplica retenção `BACKUP_KEEP` (poda `output/n8n/backups/`).
2. `scripts/n8n/tool/tests/patch-kit.test.mjs` — `replaceOnce` (0/1/2 ocorrências), `assertSyntax`
   (válido/inválido), `buildPutBody` reuso. Pura, sem rede.
3. **Migrar 2 patches piloto** (ex.: `patch-tradein-asked-detect.mjs`,
   `patch-bia2-ask-cash-entry.mjs`) para importar de `patch-kit`. Rodar ambos com `DRY=1` e
   confirmar saída idêntica à versão antiga (diff do JSON dry == vazio).

**Não-regressão:** os outros 63 patches ficam intactos. Critério: `DRY=1` dos 2 migrados produz o
mesmo workflow resultante que a versão pré-migração (comparar `/tmp/*-dry.json`).

**Reversível:** apagar `patch-kit.mjs` + reverter os 2 pilotos.

---

## Fase 2 — `node TOOL_ENTRY test` + gate no deploy (evolução #5)
**Problema:** o `deploy` valida só sintaxe (`new Function`); rodar testes é convenção do checklist,
não da ferramenta.

**Entrega:**
1. `commands.mjs`: novo `runTests()` que dispara `node --test scripts/n8n/tool/tests/*.test.mjs`
   via `child_process` e retorna `{ok, output}`.
2. `repasse-maint.mjs`: comando `test` (chama `runTests`, imprime, exit 1 se vermelho).
3. `deploy()`: **antes do PUT** (após `detectDrift`, antes de `compose`), chamar `runTests()`;
   vermelho → `{ok:false, reason:"tests"}`. Aplicar a `--confirm` E ao dry-run (dry só avisa).
4. Flag de escape `--skip-tests` (documentada, para emergência) — mas o default É rodar.

**Não-regressão:** com a suíte já verde hoje, o deploy continua passando. Critério: `n8n:deploy`
(dry) numa árvore sem edições segue dizendo "nada a enviar"; com 1 edição trivial, mostra que
rodou os testes e passou.

**Reversível:** remover a chamada `runTests()` do `deploy`.

---

## Fase 3 — diff textual no dry-run (evolução #4, complementa #5)
**Problema:** `deploy` (dry) só lista nomes de node; não dá pra revisar o que muda.

**Entrega:**
1. `scripts/n8n/tool/diff.mjs` — `textDiff(oldBody, newBody)` (LCS de linhas simples, sem dep) +
   teste puro.
2. `deploy()` dry-run: para cada node editado, comparar `base.content` (do `fresh`) com o corpo
   novo e imprimir o diff. `--confirm` não muda.

**Não-regressão:** puramente informativo no dry-run. Critério: editar 1 linha de 1 Code node e ver
o diff correto; `--confirm` inalterado.

---

## Fase 4 — `edit-prompt` (evolução #1): substituir a fábrica de patches de prompt
**Problema:** editar um prompt-expressão (`=…` em `systemMessage`) hoje exige um `patch-*.mjs`
novo — origem dos 65 scripts. A maioria deles é exatamente isso.

**Entrega:**
1. `commands.mjs`: `editPrompt({node, anchor, to, dry})` — GET fresco (via `patch-kit.getLive`),
   localizar `parameters.options.systemMessage` do node, `replaceOnce(systemMessage, anchor, to)`,
   se a string contém JSON embutido validável fazer `assertSyntax` do bloco, então `safePut`
   (ou `dry`). Reusa o guard de drift.
2. `repasse-maint.mjs`: comando `edit-prompt <node> --anchor "<txt>" --to "<txt>" [--dry]`.
3. `scripts/n8n/tool/tests/edit-prompt.test.mjs` — âncora única (ok), ausente (erro), múltipla
   (erro). Pura (mock do workflow).
4. **Validação viva:** reproduzir UMA edição de prompt que hoje seria um patch (ex.: ajustar uma
   frase da Bia 2) via `edit-prompt --dry` e confirmar o resultado == o que o patch produziria.

**Não-regressão:** os patches de prompt existentes continuam válidos; `edit-prompt` é o caminho
novo para edições FUTURAS. Não migra os 65 retroativamente (não compensa o risco).

**Reversível:** remover o comando.

---

## Fase 5 — Fonte canônica única (evolução #3) — ✅ IMPLEMENTADA (2026-06-30)
**Estado final (entregue):** um escritor ÚNICO ([tool/legacy-sync.mjs](../../../scripts/n8n/tool/legacy-sync.mjs)
`syncLegacyArtifacts` + [tool/commands.mjs](../../../scripts/n8n/tool/commands.mjs) `pullFrom`) regenera, a
partir do mesmo `live`, a árvore canônica `n8n/ia-repasse-pro-v2/` **e** os artefatos legados
(snapshot `output/n8n/ia-repasse-pro-v2-current.json` + espelhos `repasse-code-*.js`). O **guard**
([guard-live-workflow-sync.mjs](../../../scripts/n8n/guard-live-workflow-sync.mjs)) agora **delega ao
`pullFrom`** em drift (import dinâmico + fallback para o write mínimo se falhar, pois o hook nunca pode
quebrar). Resultado: guard e CLI não têm mais caminhos de refresh divergentes. **Validação:**
`pullFrom(committedSnapshot)` regenera tudo byte-idêntico (só muda `syncedAt`); drift sintético →
guard re-sincroniza do vivo (`canonicalRefreshed:true`); 178 testes verdes (+ `legacy-sync.test.mjs`).
**Mapa de consumidores corrigido:** os espelhos `repasse-code-*.js` são lidos por **patches**, NÃO pela
suíte (esta lê de `tool/parsers/blocks/`). **Pendência consciente (passo 4, NÃO feito):** deletar
fisicamente o snapshot legado exige migrar os **34 patches** que o leem em `DRY=1` para a árvore
canônica — feito incrementalmente conforme migram ao patch-kit; até lá o snapshot legado é um derivado
gerado pelo escritor único (sem divergência).

**Problema original:** havia duas árvores do vivo — o snapshot do guard
(`output/n8n/ia-repasse-pro-v2-current.json` + espelhos `repasse-code-*.js`) e a decomposição do
CLI (`n8n/ia-repasse-pro-v2/` + seu `.snapshot.json`). Podem divergir; o guard ressincroniza os
espelhos, o CLI ressincroniza a árvore — sistemas paralelos.

**Risco:** os espelhos `repasse-code-*.js` são lidos por testes (`routing-flags.test.mjs` lê
`repasse-code-routing-flags.js`) e os patches usam o snapshot em `DRY=1`. Mexer aqui pode quebrar
testes e patches. **Por isso é a última fase e a mais incremental.**

**Entrega (faseada):**
1. **Mapear consumidores** do snapshot antigo e dos espelhos: `grep -rl "ia-repasse-pro-v2-current\|repasse-code-" scripts/`.
   Documentar quem lê o quê (já há indícios em `routing-flags.test.mjs`, patches `DRY=1`).
2. **Guard passa a re-rodar `pull`** em vez de manter snapshot+espelhos próprios: `runGuard` em
   drift chama o `pull` do CLI (re-decompõe `n8n/ia-repasse-pro-v2/` + `.snapshot.json`) e **mantém
   os espelhos como derivados gerados** (um passo `syncMirrors()` que copia de `nodes/code/` para os
   `repasse-code-*.js` enquanto algum teste/patch ainda depender deles).
3. **Migrar testes/patches** que leem espelhos para lerem `n8n/ia-repasse-pro-v2/nodes/code/*.js`
   (um de cada vez, com teste verde a cada passo).
4. Quando nenhum consumidor restar, **remover** os espelhos e o snapshot duplicado; o guard usa só
   `BASE_DIR/nodes/.snapshot.json`.

**Não-regressão:** cada sub-passo mantém os espelhos como saída derivada até o último consumidor
migrar. `npm run test:n8n-tool` verde a cada passo. Nenhum PUT envolvido (só reorganização de
arquivos locais + leitura).

**Reversível:** enquanto a Fase 5 não chega no passo 4, basta parar — os espelhos continuam sendo
gerados.

---

## Fases menores (oportunistas, baixo risco)
- **Retenção** (`output/n8n/backups/` 122 arquivos, `.live-guard/` ~70): `BACKUP_KEEP` aplicado no
  `backup()` da Fase 1 + poda dos reports no guard. (Pode entrar junto da Fase 1.) — ✅ FEITO.
- **`secretScan`** em `validate.mjs` + aviso no `build`/`deploy`: barato, alto valor (evita
  commitar JWT/url de webhook em `workflow.json`). Entra como teste puro. — ✅ FEITO (2026-06-30):
  `scanSecrets()` ([tool/validate.mjs](../../../scripts/n8n/tool/validate.mjs)) detecta
  JWT/Bearer/n8n-api-key/openai/google com redação; ligado como **aviso** não-bloqueante em
  `build`/`deploy` (`commands.mjs`) + `warnSecrets()` no CLI; teste puro
  [secret-scan.test.mjs](../../../scripts/n8n/tool/tests/secret-scan.test.mjs) (zero falso-positivo no
  workflow real).
- **`remapCredentials`** em `deploy_body.mjs` + `BASE_DIR/credential-map.json`: só relevante se
  formos de fato reimportar noutra instância; deixar documentado, implementar sob demanda. — ⏳ NÃO
  FEITO (sob demanda; sem necessidade atual).

## Migração dos patches ao patch-kit (Fase 1 cont.) — ✅ FEITA (2026-06-30)
**64 de 65** `patch-*.mjs` agora usam o I/O único de `tool/patch-kit.mjs`. O único fora é
[patch-apagar-memoria-wire.mjs](../../../scripts/n8n/patch-apagar-memoria-wire.mjs), que mira um
**workflow separado** (`gt66GRAmvF4LlU8b`, "apagar memoria") — `patch-kit` é fixo no principal
`Cr4fPWe0prwS6XjI`, e esse patch nem lê o snapshot legado principal em DRY, então não é consumidor a
migrar. Verificação: 183 testes verdes + DRY de todos os 64 sem erro de encanamento.
**Consequência p/ Fase 5#4:** a leitura do snapshot legado em DRY está agora centralizada num único
ponto (`patch-kit.loadLocal` → `paths.liveSnapshot`). Para deletar fisicamente o snapshot legado
falta só: (a) repontar `loadLocal` para a árvore canônica `n8n/ia-repasse-pro-v2/workflow.json`, e
(b) mover a baseline de drift do guard para `nodes/.snapshot.json` — ambos de baixo risco, mas ainda
NÃO feitos.

## Ordem recomendada e esforço
1. Fase 1 (+ retenção) — base para tudo. **~meio dia.**
2. Fase 2 — gate de teste. **~2h.**
3. Fase 3 — diff. **~2h.**
4. Fase 4 — `edit-prompt`. **~meio dia.**
5. `secretScan` (oportunista). **~1h.**
6. Fase 5 — fonte única, por último, em sub-passos. **~1–2 dias, faseado.**

## Critério de pronto (cada fase)
- [ ] Módulo novo com teste puro em `tool/tests/`, `npm run test:n8n-tool` verde.
- [ ] Comportamento do `deploy --confirm` existente inalterado até a fase ser explicitamente adotada.
- [ ] Validação viva com `DRY=1`/dry-run (sem PUT) quando a fase toca o caminho de escrita.
- [ ] Guard roda primeiro; sem drift pendente.
- [ ] Commit em branch (não na `main`), rodapé de co-autoria.
