# Sistema Visual — Lente 3 (Execução / Refactoring UI) + Tokens do repo

Depois que Cognição (lente 1) e Clareza (lente 2) estão ✅, faça a UI **parecer
projetada**. Princípio mestre de Wathan/Schoger: **design é sistema, não talento**
— você **escolhe de um cardápio fixo**, nunca inventa "14px ou 15px".

> **Comece em escala de cinza.** Resolva hierarquia só com tamanho, peso e
> espaço. Só depois adicione cor — como **reforço**, nunca como muleta.

---

## Os 6 movimentos (nesta ordem)

### 1. Hierarquia — 3 eixos, não só tamanho
| Eixo | Como | Tokens deste repo |
|------|------|-------------------|
| **Peso** | bold enfatiza, normal é corpo; **nunca** < 400 | `font-medium/semibold/bold` (500/600/700) |
| **Cor** | escuro=primário, cinza médio=secundário, claro=terciário | `text-gray-900` → `text-gray-600/text-text-secondary` → `text-text-muted`/`text-gray-400` |
| **Tamanho** | só para as maiores distinções | escala `ios-*` (abaixo) |
- **HIG manda:** crie hierarquia com **peso + tamanho** primeiro; **cor reforça**. Cor **nunca** é o único sinal (acessibilidade).
- **Não suba a fonte** para indicar importância — ajuste **peso/cor** (fica mais uniforme, menos "claustrofóbico").
- **Des-enfatize o secundário** tanto quanto enfatiza o primário. Padrão rótulo/valor: rótulo pequeno/maiúsculo/claro, valor grande/bold/escuro.
- **Uma única ação primária** por contexto. Secundária = outline/baixo contraste. Terciária = estilo de link.

### 2. Espaçamento — escala fixa, respiro generoso
Escala do repo (`spacing.scale`, = Tailwind `p-/m-/gap-`):
`1=4 · 2=8 · 3=12 · 4=16 · 5=20 · 6=24 · 8=32 · 10=40 · 12=48 · 16=64 · 20=80 · 24=96`
- Comece com **mais** espaço do que parece preciso e reduza.
- **Proximidade = relação**: aproxime o que pertence junto, afaste o que é distinto. Resolve 80% de "tela poluída".
- No **pequeno** (ícone, padding de botão) poucos px mudam tudo; no **grande** (largura de card) não. Por isso a escala é não-linear.
- **Nem tudo largura total.** Texto corrido confortável: ~45–75 caracteres/linha (`max-w-prose`/`max-w-[65ch]`).

### 3. Tipografia
Escala `ios-*` (Tailwind `text-ios-*`, já com leading + tracking corretos):
`ios-large 34 · ios-title-1 28 · ios-title-2 22 · ios-title-3 20 · ios-headline 17(semibold) · ios-body 17 · ios-callout 16 · ios-subhead 15 · ios-footnote 13 · ios-caption 12`
- **Line-height inverso ao tamanho**: corpo `leading-normal/relaxed` (1.5–1.7); títulos `leading-tight/snug` (1.1–1.3). A escala `ios-*` já embute isso.
- **Tracking**: negativo leve em títulos grandes (já nos tokens `ios-*`); em MAIÚSCULAS, **aumente** (`tracking-wide`).
- **Mínimo 12px** (`ios-caption`) — nunca menor (HIG).
- Tabular/números alinhados: fonte mono `Space Mono`/`font-mono`.
- Não justifique na web; alinhe à **esquerda**.

### 4. Cor — semântica, em HSL, com contraste
Pense em **HSL** (matiz/saturação/luz são manipuláveis). Use os tokens:
- **Marca**: `brand-{50..900}` (500 = `#2563eb`), `accent-{50..900}` (500 = `#f97316`).
- **Semânticas**: `success #16a34a · warning #d97706 · error #dc2626 · info #0ea5e9` (+ variantes dark `#4ade80/#f59e0b/#f87171/#38bdf8`).
- **Cinzas/texto**: `text #0f172a · text-secondary #334155 · text-muted #64748b`; superfícies `surface/bg/bg-2`. Dark: `surface-dark-*`, `dark-text*`.
- **Você precisa de mais tons do que imagina.** Tom médio = botão/link; claro (50/100) = fundo suave; escuro (600/700) = hover/borda.
- **Nunca texto cinza sobre fundo colorido** (fica "lavado"). Para des-enfatizar sobre cor: use tom **mais claro da própria cor** (mesmo matiz) ou branco com opacidade (`text-white/70`).
- **Clarear sem desbotar**: gire o **matiz** ~20–30° rumo ao matiz claro vizinho; escurecer, rumo ao escuro.
- **Contraste**: mire WCAG AA (4.5:1 texto normal, 3:1 grande). Os tokens já anotam AA/AAA em `contrast_notes`. **Cor nunca sozinha** → reforce com ícone/rótulo.

### 5. Profundidade — luz de cima, elevação = proximidade
- A luz vem **de cima**: topo mais claro, sombra **abaixo**. Sombra = **preto transparente**, nunca cinza opaco.
- Sombras **compostas** (curta+nítida e longa+suave) parecem reais. Use a escala `ios26-*`:
  `shadow-ios26-sm` (linhas/rows) · `shadow-ios26-md` (cards) · `shadow-ios26-lg` (toast/popover) · `shadow-ios26-glow` (foco).
- **Elevação = distância do usuário**: quanto maior a sombra, mais "próximo/interativo". Modal/toast > card > row. Modal pede sombra grande + backdrop.
- Sem sombra também separa: **dois tons de fundo** (`surface` vs `bg-2`) ou `liquid-glass` (vibrancy/blur — HIG Deference).
- Feedback por profundidade: pego para arrastar **sobe** (sombra maior); pressionado **afunda** (sombra menor) — ver toast.

### 6. Polimento (por último)
- **Eleve os defaults**: troque bullets por ícones lucide; estilize checkbox/radio/toggle; dê personalidade a citações/empty states.
- **Troque bordas** por espaço, sombra suave, ou dois tons de fundo. Borda em excesso = ruído. (Repo usa `border-…/70` sutis — ok.)
- **Estados vazio/carregando/erro são design**, não tela branca: ilustração/ícone + texto + CTA; skeleton com `animate-shimmer`.
- **Accent border**: faixa colorida no topo de card/alerta para quebrar monotonia.
- **Ícones**: um só conjunto (**lucide-react**), tamanho consistente (`w-4 h-4`/`w-5 h-5`/`size={16/20}`). Não estique ícone pequeno; encapsule em círculo de fundo se precisar ocupar espaço.
- **Movimento** com `framer-motion` (`m` + `AnimatePresence`) e **sempre** `useReducedMotion`. Use as springs/eases nomeadas de `components/motion/transitions`:
  `iosSpring · iosSheetSpring (bottom-sheet) · iosSnappySpring (toast) · iosEase · iosFastEase (banner) · iosSlowEase · iosStagger (listas)`.

---

## Cardápio de tokens (escolha sempre daqui)

```
RAIO     rounded-ios(10) · ios-lg(14) · ios-xl(20) · ios-2xl(24) · rounded-full
SOMBRA   shadow-ios26-sm | -md | -lg | -glow   (cards→lg p/ flutuantes)
COR      brand-* accent-* | success/warning/error/info (+dark-*) | text/-secondary/-muted | surface/bg/bg-2 | surface-dark-*
TIPO     text-ios-{large,title-1..3,headline,body,callout,subhead,footnote,caption}
PESO     font-{medium,semibold,bold}  (nunca abaixo de normal/400)
ESPAÇO   p-/m-/gap- {1,2,3,4,5,6,8,10,12,16,20,24}
TOQUE    hit-target-44 / min-h-[44px] / w-11 h-11   (HIG: 44px mínimo)
MOTION   m + AnimatePresence + useReducedMotion + spring/ease nomeada
SUPERFÍCIE  liquid-glass (flutuante/vibrancy) · ios-card (card padrão)
```

## Classes utilitárias do repo (reúse, não recrie)
- `liquid-glass` — superfície translúcida com blur (toasts, sheets, popovers).
- `ios-card` — card padrão (raio + sombra + padding base).
- `hit-target-44` — garante área de toque 44×44 (HIG).
- `animate-shimmer` — skeleton/loading.
> Antes de escrever CSS novo, procure em `index.css` e `tailwind.config.cjs`.

## Anti-padrões visuais (UI smells) → correção
| Smell | Correção mensurável |
|-------|---------------------|
| Tudo no mesmo peso/cor → sem hierarquia | aplique 3 eixos: `text-gray-900 font-semibold` (primário) vs `text-text-muted text-ios-footnote` (secundário) |
| Só tamanho p/ hierarquia (título gigante, corpo minúsculo) | troque por peso+cor; títulos no máx `ios-title-1`, corpo `ios-body` |
| Espaçamentos arbitrários (13px, 7px) | snap para a escala (`p-3`=12, `p-4`=16) |
| Tela apertada / poluída | aumente respiro (`gap-2`→`gap-4`/`gap-6`) e agrupe por proximidade |
| Bordas em tudo | troque por sombra `ios26-sm` ou 2 tons de fundo |
| Texto cinza sobre cor | tom claro da própria cor (`text-brand-50` em `bg-brand-600`) ou `text-white/70` |
| Sombra cinza/spread gigante | use escala `ios26-*` (preto transparente, offset vertical) |
| Cor como único sinal de erro/sucesso | adicione ícone lucide + rótulo |
| Tudo centralizado | alinhe à esquerda; defina foco visual; varie ênfase |
| Animação sem `useReducedMotion` | envolva e respeite a preferência |
