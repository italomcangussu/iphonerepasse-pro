---
name: refatorar-ui
description: Use ao criar, melhorar, refatorar ou auditar qualquer interface ou componente de UI — toast, banner, modal/dialog, card, campo/input, formulário, toggle/switch, máscara, mensagem ou estado de erro, estado vazio/carregando — ou ao tratar hierarquia visual, espaçamento, tipografia, cor, contraste, profundidade/sombra, feedback, affordance, acessibilidade, e ao tornar a interface auto-explicativa e intuitiva ("não me faça pensar"). Síntese de Refactoring UI, Norman (O Design do Dia a Dia) e Krug (Não Me Faça Pensar) aplicada aos tokens e primitivos deste projeto (Tailwind v4, HIG/iOS-26, framer-motion).
---

# Refatorar UI

Melhorar uma interface **sem inventar do zero**: toda decisão passa por três
lentes, **nesta ordem**, e cada recomendação vira um valor **mensurável** no
vocabulário deste repo (não "dê mais espaço", e sim "`p-2` → `p-6`").

> **Regra de ouro:** se a recomendação não é mensurável e repetível, não está
> pronta. Aponte token, classe Tailwind, primitivo (`Banner`, `Modal`,
> `formatCpf`…) ou número.

## As 3 lentes (sempre nesta sequência)

| # | Lente | Pergunta | Fonte |
|---|-------|----------|-------|
| 1 | **Cognição** | O usuário consegue **agir** e **entender o resultado**? (fecha os golfos de execução + avaliação) | Norman |
| 2 | **Clareza** | É **óbvio**, sem pensar? Escaneável, convencional, sem ponto de interrogação? | Krug |
| 3 | **Execução** | **Parece projetado**? Hierarquia, espaço, tipo, cor, profundidade, polimento. | Refactoring UI |

Resolva **1 → 2 → 3**. Card lindo (lente 3) que não dá feedback (lente 1) está
quebrado. Detalhe visual é o **último** passo, nunca o primeiro.

## Quando usar
- "melhora/arruma/deixa profissional esse [toast|modal|card|formulário]"
- "essa tela tá poluída/confusa/não é intuitiva"; "avisos de erro", "máscara", "toggle", "estado vazio/carregando"
- auditar uma UI e dar nota + correções; escolher entre toast × banner × modal × erro inline

**Não use para:** backend, dados/queries, ou pedidos sem superfície visível.

## Fluxo
1. **Classifique** o alvo: componente? tela? fluxo? Qual a severidade/persistência da mensagem? → matriz de feedback em componentes.md.
2. **Rode as 3 lentes** em ordem; marque cada check ✅/❌ com o motivo. Checks em [references/fundamentos.md](references/fundamentos.md) (L1+L2) e [references/sistema-visual.md](references/sistema-visual.md) (L3).
3. **Receite** cada ❌ com token/classe/primitivo. Use o **cardápio de tokens** e as classes do repo (`liquid-glass`, `ios-card`, `hit-target-44`) — nunca invente valores fora deles → sistema-visual.md.
4. **Dê nota 0–10** + lista priorizada → [references/auditoria.md](references/auditoria.md).
5. **Reúse antes de criar:** `components/ui/{Banner,Modal,ConfirmDialog,ToastProvider}`, `components/motion/transitions`, `utils/{inputMasks,authErrors}`.

**Receitas** (anatomia, 3 lentes, estados, specs, anti-padrões) para toast,
banner, modal, card, erro, máscara, campo, toggle + a matriz
toast×banner×modal×inline → [references/componentes.md](references/componentes.md).

## Princípios inegociáveis (todo componente)
- **Feedback sempre** — nenhuma ação sem resposta visível imediata; sucesso silencioso é proibido.
- **Reversível > confirmação** — prefira *undo* (toast c/ ação); `ConfirmDialog` só p/ irreversível/caro.
- **Erro = causa + correção, nunca culpa** — modelo: `utils/authErrors.ts`. Validação é **inline**, não toast.
- **Convenção > invenção** — X fecha, ✓ confirma, vermelho **+ ícone** = erro. Só inove se for claramente melhor.
- **Cor reforça, não carrega** — hierarquia por **peso + tamanho**; cor é o 3º eixo e **nunca** o único sinal.
- **44px de toque** (`hit-target-44`/`min-h-[44px]`), **`useReducedMotion`** e **dark mode** (`surface-dark-*`) em todo estado.

## Fontes
Síntese autoral de **Refactoring UI** (Wathan & Schoger), **O Design do Dia a Dia**
(Norman) e **Não Me Faça Pensar** (Krug), adaptada à stack/tokens deste repo. Não
reproduz o texto original.
