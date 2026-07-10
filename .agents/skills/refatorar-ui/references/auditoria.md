# Auditoria — Nota 0–10 + formato de saída

Use ao auditar uma UI/componente existente. Sempre informe **nota atual + o que
falta para 10**. Cada recomendação é **mensurável** (token/classe/primitivo).

## Testes rápidos (faça primeiro, em segundos)
- **Squint test** (desfoque mental): o que salta é o que importa? A ação primária domina?
- **Trunk test** (Krug): jogado aqui sem contexto — *que tela é esta? onde estou? quais as opções? como volto?*
- **Teste do dedo** (HIG): todo alvo tocável tem ≥ 44px?
- **Teste do feedback** (Norman): clique em cada ação — algo visível responde **na hora**?
- **Teste do cinza** (Refactoring UI): tirando a cor, a hierarquia ainda se sustenta?

## Rubrica (1 ponto cada — ajuste ao contexto)
- [ ] **Feedback** — toda ação tem resposta visível imediata; nada de sucesso silencioso. *(L1.4)*
- [ ] **Recuperação de erro** — reversível/undo onde dá; `ConfirmDialog` só p/ irreversível; mensagens causa+correção sem culpa. *(L1.6)*
- [ ] **Affordance & modelo** — clicável parece clicável; toggle≠checkbox; mapeamento natural controle↔efeito. *(L1.1–1.3)*
- [ ] **Auto-evidência** — entende-se sem instrução; sem pontos de interrogação. *(L2)*
- [ ] **Escaneabilidade & convenção** — varre e acha; usa padrões conhecidos; microcopy enxuto. *(L2)*
- [ ] **Hierarquia** — peso+tamanho primeiro, cor reforça (nunca só cor); uma ação primária; secundário des-enfatizado. *(L3.1)*
- [ ] **Espaçamento** — escala fixa; respiro; proximidade=relação; largura de leitura. *(L3.2)*
- [ ] **Cor & contraste** — tokens semânticos; AA/AAA; sem texto cinza sobre cor; cor + ícone. *(L3.4)*
- [ ] **Profundidade** — luz de cima; `ios26-*`; elevação coerente (toast/modal>card>row). *(L3.5)*
- [ ] **Polimento & a11y** — estados vazio/loading/erro desenhados; `useReducedMotion`; dark mode; 44px; `role`/`aria`/foco visível; reúso de primitivos. *(L3.6 + a11y)*

**Faixas:** 0–3 quebrado · 4–6 funciona mas faz pensar · 7–8 bom · 9–10 invisível (o usuário só faz a tarefa).

## Formato de saída da auditoria
```
ALVO: <arquivo/componente/tela>     NOTA: X/10

LENTE 1 (Cognição):  ✅ … / ❌ …
LENTE 2 (Clareza):   ✅ … / ❌ …
LENTE 3 (Execução):  ✅ … / ❌ …

CORREÇÕES (priorizadas, mensuráveis):
1. [Lente.N] <problema> → <correção: token/classe/primitivo>
2. …

REÚSO: <primitivos do repo a usar em vez de criar>
PARA 10/10: <lista curta priorizada>
```

## Limites éticos (Norman/Krug — inegociáveis)
- **Hierarquia esclarece, não esconde.** Nunca use peso/cor/posição p/ ocultar preço, prazo, termos ou opção de cancelar.
- **Sem dark patterns.** Não use ênfase/sombra p/ induzir clique enganoso; não pré-marque o que beneficia só o negócio.
- **Acessibilidade não é opcional:** contraste, tamanho legível (≥12px), 44px e reforço além da cor são requisitos.
- **Não culpe o usuário** na cópia de erro. A falha quase sempre é de design.

## Catálogo de smells → correção
Consolidado nas tabelas de [sistema-visual.md](sistema-visual.md) (visuais) e nas seções
"Anti-padrões" de [componentes.md](componentes.md) (por componente). Ao auditar,
cite o smell pelo nome e dê a correção com valor do repo.
