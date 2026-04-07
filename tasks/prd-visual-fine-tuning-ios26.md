# PRD: Ajuste Fino Visual iOS 26 — PDV, Inventory & Dashboard

## 1. Introdução / Visão Geral

O iPhoneRepasse Pro tem hoje uma base sólida de design Apple HIG (estilo iOS 18): tokens próprios em [index.css](index.css), 4 keyframes CSS (`iosFade`, `iosSlideUp`, `iosScale`, `iosSheet`) configurados em [tailwind.config.cjs:128-150](tailwind.config.cjs#L128-L150), modais como bottom sheet no mobile, dark mode classe-based e `prefers-reduced-motion` respeitado.

Este PRD eleva o app para o padrão **iOS 26 Liquid Glass** (anunciado no WWDC25, lançado set/2025) e refina visual + motion das três páginas operacionais críticas — **PDV** ([pages/PDV.tsx](pages/PDV.tsx), 1057 linhas), **Inventory** ([pages/Inventory.tsx](pages/Inventory.tsx), 564 linhas) e **Dashboard** ([pages/Dashboard.tsx](pages/Dashboard.tsx), 250 linhas) — junto com a biblioteca de componentes compartilhada.

A direção visual combina três referências:
- **Apple HIG iOS 26** (chassi) — Liquid Glass material em navegação, modais e CTAs flutuantes
- **Linear / Notion / Vercel** (densidade de dados) — tipografia precisa, micro-interações sutis, cards densos
- **Square / Shopify POS** (tátil) — botões grandes, feedback de toque forte, totais ganham vida, celebração de venda fechada

Motion será adicionado via **framer-motion** (~30kb gzip), com durações alinhadas ao iOS 26 (100–500ms) e spring physics para sensação de inércia real.

### Referências iOS 26 pesquisadas

- **Liquid Glass**: material translúcido com refração simulada, especulares dinâmicos, três camadas (highlight, shadow, illumination). APIs nativas em SwiftUI/UIKit para nav bars, sheets, modais. Para web: `backdrop-filter: blur()` + camadas `::before`/`::after` + opcionalmente SVG `<feDisplacementMap>` para refração avançada (Chromium-only — Safari ainda não suporta).
- **Motion HIG iOS 26**: 100–500ms é a faixa ideal; <200ms para toggles e micro-feedback; 300–500ms para transições entre páginas/modais. Stagger: elemento primário primeiro, secundários atrasados (~50ms). Scale entry: 95% ou 90%. Inércia natural via spring.
- **Limitação a respeitar**: Liquid Glass tem custo de GPU. Restringir o efeito a poucos elementos flutuantes (top bar, bottom tab, modais, FABs, toasts). Cards de lista NÃO devem usar glass — usar shadow tokens refinados.

---

## 2. Goals (Objetivos)

- **G1**: Adotar Liquid Glass nas superfícies de chrome (top bar, bottom tab, modais, toasts, FABs, command palette) sem prejudicar contraste nem performance.
- **G2**: Estabelecer um sistema de motion coerente baseado em framer-motion com 6–8 primitivas reutilizáveis (Fade, SlideUp, Scale, Stagger, Spring, AnimatedNumber, Skeleton, PageTransition).
- **G3**: Refinar densidade visual e hierarquia tipográfica do Dashboard e Inventory ao nível de Linear/Notion (tabular-nums, tracking apertado, espaçamento 4pt grid).
- **G4**: Tornar o checkout do PDV tátil e recompensador no estilo Square — totais animados, feedback de tap, celebração de venda fechada.
- **G5**: Manter `prefers-reduced-motion` 100% funcional e acessibilidade WCAG AA (contraste sobre glass adaptativo).
- **G6**: Bundle gzip não pode crescer mais que **+35kb** total após framer-motion.
- **G7**: 60fps em scroll e transições no iPhone 12 / Macbook Air M1 (target devices).

---

## 3. User Stories

> Cada story é dimensionada para uma sessão focada de implementação. Stories de UI exigem verificação no browser via dev-browser skill.

### Fundação — Motion infra & Design Tokens

#### US-001: Instalar framer-motion e criar motion primitives
**Description:** Como desenvolvedor, preciso de uma camada de primitivas de motion reutilizáveis para que todas as animações do app sigam o mesmo sistema.

**Acceptance Criteria:**
- [ ] `npm install motion` (pacote sucessor de framer-motion, mesmo time, API idêntica) — verificar bundle delta ≤ 35kb gzip
- [ ] Criar `components/motion/index.ts` exportando: `Fade`, `SlideUp`, `Scale`, `Stagger`, `Spring`, `MotionDiv` (wrapper com defaults iOS 26)
- [ ] Criar `components/motion/transitions.ts` com presets nomeados: `iosSpring` (`{ type: 'spring', stiffness: 380, damping: 30 }`), `iosEase` (`[0.25, 0.1, 0.25, 1]`, 250ms), `iosSheetSpring` (`{ stiffness: 320, damping: 32 }`), `iosFastEase` (180ms), `iosSlowEase` (450ms)
- [ ] Todas as primitivas respeitam `prefers-reduced-motion` (motion lib faz isso nativo via `MotionConfig` — configurar global no [App.tsx](App.tsx))
- [ ] Typecheck e build passam
- [ ] Documentar uso no header do `index.ts` com 3 exemplos curtos

#### US-002: Expandir tokens visuais iOS 26 (Liquid Glass utilities + shadows refinados)
**Description:** Como desenvolvedor, preciso de utilities CSS Liquid Glass e shadow tokens refinados para aplicar consistentemente em chrome flutuante.

**Acceptance Criteria:**
- [ ] Adicionar em [index.css](index.css) novas classes em `@layer components`:
  - `.liquid-glass` — `backdrop-filter: blur(24px) saturate(180%)`, fundo `rgba(255,255,255,0.72)` (light) / `rgba(28,28,30,0.72)` (dark), border `1px solid rgba(255,255,255,0.18)` (light) / `rgba(255,255,255,0.08)` (dark), shadow multi-camada (ver abaixo)
  - `.liquid-glass-strong` — variante com blur 32px e opacidade maior para top bars
  - `.liquid-glass-thin` — variante leve (blur 12px) para chips/botões flutuantes
- [ ] Adicionar shadow tokens iOS 26 em [tailwind.config.cjs](tailwind.config.cjs):
  - `shadow-ios26-sm`: `0 1px 2px rgba(0,0,0,0.04), 0 1px 3px rgba(0,0,0,0.06)`
  - `shadow-ios26-md`: `0 4px 8px rgba(0,0,0,0.04), 0 2px 4px rgba(0,0,0,0.06), 0 0 0 1px rgba(0,0,0,0.04)`
  - `shadow-ios26-lg`: `0 12px 24px rgba(0,0,0,0.08), 0 4px 8px rgba(0,0,0,0.06), 0 0 0 1px rgba(0,0,0,0.04)`
  - `shadow-ios26-glow`: shadow azul sutil para focus rings (`0 0 0 4px rgba(59,130,246,0.15)`)
- [ ] Adicionar easings nomeados em tailwind config: `ease-ios-spring`, `ease-ios-out` (`cubic-bezier(0.32, 0.72, 0, 1)`), `ease-ios-emphasized` (`cubic-bezier(0.2, 0, 0, 1)`)
- [ ] Garantir fallback: se browser não suporta `backdrop-filter`, usa background opaco
- [ ] Build passa, classes funcionam em light e dark
- [ ] Verificar visualmente em browser (light e dark)

#### US-003: Criar componente AnimatedNumber (count-up)
**Description:** Como usuário, quando vejo um valor numérico mudar (total da venda, métricas do dashboard), quero ver ele transitar suavemente para o novo valor — não "pular" instantaneamente.

**Acceptance Criteria:**
- [ ] Criar `components/motion/AnimatedNumber.tsx` que recebe `value: number`, `format?: (n) => string`, `duration?: number` (default 600ms), `decimals?: number`
- [ ] Usa `motion`'s `useSpring` + `useTransform` (não setInterval) — tem que ser smooth a 60fps
- [ ] Respeita `prefers-reduced-motion` — pula animação e renderiza valor final
- [ ] Suporta formatação BRL (`R$ 1.234,56`) via prop `format`
- [ ] Quando `value` muda enquanto animação está em curso, transiciona do valor atual para o novo (não reseta)
- [ ] Adicionar 2 testes Vitest: valor inicial, valor após mudança
- [ ] Typecheck e testes passam

#### US-004: Criar Skeleton primitives (loading shimmer)
**Description:** Como usuário, enquanto dados estão carregando, quero ver placeholders animados em vez de tela em branco ou spinner genérico.

**Acceptance Criteria:**
- [ ] Criar `components/ui/Skeleton.tsx` com 3 variantes: `<Skeleton.Text lines={n} />`, `<Skeleton.Card />`, `<Skeleton.Row />`
- [ ] Animação shimmer via CSS (gradient sweep, 1.4s linear infinite) — não usa motion lib
- [ ] Respeita dark mode (cores `gray-200` / `surface-dark-100`)
- [ ] Respeita `prefers-reduced-motion` — esconde shimmer, mostra cor sólida
- [ ] Usar no Dashboard (StatCard skeleton) e Inventory (rows skeleton) como prova
- [ ] Build passa
- [ ] Verificar em browser

#### US-005: Page transition wrapper para route changes
**Description:** Como usuário, ao navegar entre páginas (Dashboard → PDV → Inventory), quero uma transição suave que dê sensação de continuidade espacial.

**Acceptance Criteria:**
- [ ] Criar `components/motion/PageTransition.tsx` que envolve `<Outlet />` no [Layout.tsx](components/Layout.tsx)
- [ ] Usar `AnimatePresence` com `mode="wait"` para crossfade entre rotas
- [ ] Animação: fade (200ms) + slide vertical sutil (8px → 0)
- [ ] `key` da animação derivado de `useLocation().pathname`
- [ ] No mobile: aceitar config para usar slide horizontal (left/right) baseado em direção da nav (futura)
- [ ] Reduced motion: apenas fade sem slide
- [ ] Verificar em browser navegando entre páginas

---

### Component Library — polish

#### US-006: Modal — Liquid Glass + spring entry + drag-to-dismiss mobile
**Description:** Como usuário, quero que modais entrem com física natural, tenham fundo de vidro líquido e que no mobile eu possa arrastar pra baixo pra fechar (gesto iOS nativo).

**Acceptance Criteria:**
- [ ] Refatorar [components/ui/Modal.tsx](components/ui/Modal.tsx) para usar `motion.div` em vez de classes `animate-ios-sheet`
- [ ] Backdrop: usa `liquid-glass-strong`, entra com fade (180ms), sai com fade (150ms)
- [ ] Desktop modal: scale 0.95 → 1 + opacity 0 → 1, transition `iosSpring`
- [ ] Mobile sheet: slideY 100% → 0 com `iosSheetSpring`
- [ ] Mobile: drag-to-dismiss usando `drag="y"` + `dragConstraints={{top: 0}}` + `onDragEnd` que fecha se velocity > 500 ou offset > 100px
- [ ] Drag handle visual no topo do sheet (barra cinza 36×4px, rounded-full)
- [ ] Manter focus trap, ESC, ARIA atuais — não quebrar testes existentes
- [ ] Reduced motion: sem drag, sem spring, fade simples
- [ ] [Modal.test.tsx](components/ui/Modal.test.tsx) continua passando + adicionar 1 teste para drag-to-dismiss
- [ ] Verificar em browser (desktop + viewport mobile)

#### US-007: ToastViewport — spring slide-in + stack + swipe dismiss
**Description:** Como usuário, quero que toasts deslizem de baixo (mobile) ou de cima (desktop) com mola, empilhem corretamente quando há vários e eu possa arrastar pra dispensar.

**Acceptance Criteria:**
- [ ] Refatorar [components/ui/ToastViewport.tsx](components/ui/ToastViewport.tsx) usando `AnimatePresence` + `motion.div`
- [ ] Spring entry com `iosSpring`, exit com fade + slide
- [ ] Stack: até 3 toasts visíveis, antigos comprimem em scale 0.95 + opacity 0.7 (estilo iOS Notification)
- [ ] Swipe horizontal (mobile) ou vertical (desktop) pra dismiss — usar `drag` com threshold
- [ ] Toast usa `liquid-glass-thin`
- [ ] Reduced motion: fade simples, sem swipe
- [ ] Verificar em browser

#### US-008: Buttons iOS 26 — refinar estados e adicionar loading/success
**Description:** Como usuário, quero feedback visual claro quando interajo com um botão (hover, press, loading, success) — estilo Square POS.

**Acceptance Criteria:**
- [ ] Em [index.css](index.css), refinar `.ios-button-primary`: adicionar leve gradient (top → bottom), shadow `shadow-ios26-sm`, hover lift (`translateY(-1px)` + `shadow-ios26-md`), active scale 0.97 (já existe)
- [ ] Criar componente `components/ui/Button.tsx` opcional que envolve as classes existentes e adiciona props `loading` (mostra spinner inline) e `success` (mostra checkmark draw + cor verde por 1.5s)
- [ ] Spinner inline = motion `rotate` infinito (1s linear)
- [ ] Success state = SVG checkmark com `pathLength` animation (300ms)
- [ ] Botões mantêm min-h 44px (HIG)
- [ ] Reduced motion: sem lift no hover, sem rotate (spinner usa CSS opacity pulse), success aparece sem draw
- [ ] Aplicar no botão "Finalizar Venda" do PDV como prova (US-021 reusa)
- [ ] Verificar em browser

#### US-009: ConfirmDialog — scale entry com glass
**Description:** Como usuário, quando confirmo uma ação destrutiva, quero que o diálogo apareça com presença mas sem ser violento.

**Acceptance Criteria:**
- [ ] Refatorar [components/ui/ConfirmDialog.tsx](components/ui/ConfirmDialog.tsx) com `motion.div`
- [ ] Entry: scale 0.92 → 1 + opacity 0 → 1, `iosSpring` com `stiffness: 400, damping: 28`
- [ ] Backdrop: `liquid-glass` blur, fade 180ms
- [ ] Botão de confirmação destrutivo (red): adicionar leve brilho pulsante (1.5s, 2 pulses, depois para)
- [ ] Reduced motion: fade simples
- [ ] Verificar em browser

#### US-010: Combobox — dropdown smooth + keyboard nav highlight
**Description:** Como usuário do Combobox (busca de cliente, produto, etc), quero que o dropdown abra suavemente e que o item destacado pelo teclado tenha animação fluida.

**Acceptance Criteria:**
- [ ] Refatorar [components/ui/Combobox.tsx](components/ui/Combobox.tsx)
- [ ] Dropdown entry: `motion.div` com slideY -8px → 0 + fade, 180ms ease-out
- [ ] Item highlight (keyboard): background animado com `layoutId="combobox-highlight"` (motion's layout animation) — desliza entre items em vez de pular
- [ ] Items list: stagger entry (50ms entre cada, max 8 items animados)
- [ ] Reduced motion: dropdown fade simples, highlight sem layout animation
- [ ] [Combobox.test.tsx](components/ui/Combobox.test.tsx) continua passando
- [ ] Verificar em browser

#### US-011: Layout chrome — Liquid Glass top bar + bottom tab com pill indicator animado
**Description:** Como usuário, quero que a barra de navegação superior e a tab bar inferior usem o material Liquid Glass do iOS 26, e que o indicador de tab ativa deslize com mola entre os ícones.

**Acceptance Criteria:**
- [ ] Em [components/Layout.tsx](components/Layout.tsx), aplicar `liquid-glass-strong` na top bar (substituir glass utility atual)
- [ ] Top bar fica `sticky top-0`, com border bottom sutil que aparece só após scroll > 8px (usar `useScroll` do motion)
- [ ] Bottom tab bar mobile: aplicar `liquid-glass-strong` + adicionar **pill indicator** (background colorido por trás do ícone ativo) que desliza entre tabs com `layoutId="tab-pill"` + `iosSpring`
- [ ] Ícone ativo: scale 1.1, cor primary; ícones inativos: scale 1, cor cinza
- [ ] Sidebar desktop: item ativo ganha pill background animado mesmo padrão (`layoutId` separado)
- [ ] Tab/sidebar item tap: ripple sutil (scale 0.95 active state)
- [ ] Reduced motion: pill aparece/desaparece sem deslizar, ícone só muda de cor
- [ ] Verificar em browser (desktop + mobile viewport)

---

### Dashboard — refinamento

#### US-012: StatCard — counting numbers, stagger entry, hover lift refinado
**Description:** Como usuário do Dashboard, quero que os cards de estatísticas entrem em sequência (stagger), os números contem do zero ao valor final, e tenham um lift refinado no hover.

**Acceptance Criteria:**
- [ ] Em [pages/Dashboard.tsx](pages/Dashboard.tsx), envolver grid de StatCards com `<Stagger>` (50ms delay between children)
- [ ] StatCard usa `<AnimatedNumber>` (US-003) para o valor principal
- [ ] Hover: transform `translateY(-2px)` + `shadow-ios26-lg`, transition spring 200ms
- [ ] Refinar tipografia: valor em `tabular-nums font-bold tracking-tight`, label em `text-[11px] uppercase font-semibold tracking-wide` (mais Linear-style)
- [ ] Ícone do card: container com `liquid-glass-thin` em vez de cor sólida, ícone ganha leve `motion` `whileHover` rotate 4 graus
- [ ] Reduced motion: cards aparecem juntos, números pulam pro valor final, sem hover lift animado
- [ ] Verificar em browser

#### US-013: Recharts polish — animated bars, refined tooltip, gradient fills, custom legend
**Description:** Como usuário, quero que os gráficos do Dashboard sejam visualmente polidos no nível do Stripe Dashboard.

**Acceptance Criteria:**
- [ ] No [Dashboard.tsx](pages/Dashboard.tsx), refinar `<BarChart>`:
  - Substituir cor sólida por `<LinearGradient id="bar-gradient">` do brand-500 → brand-300
  - `<Bar>` com `radius={[8, 8, 0, 0]}` (top arredondado)
  - Habilitar `animationDuration={800}` e `animationEasing="ease-out"` no Bar
  - `<CartesianGrid>` `strokeDasharray="3 3"` `stroke` cinza-200/dark-200, vertical={false}
- [ ] Custom `<Tooltip content={...}>` com `liquid-glass` style + tipografia refinada (label menor, valor grande tabular-nums)
- [ ] `<PieChart>`: similar — gradient fills, animação de entrada (spring de 0% até full)
- [ ] Cores do chart: usar paleta consistente (brand-500, green-500, orange-500, purple-500, cinza-400) com 80% opacity
- [ ] Verificar em browser

#### US-014: Empty / loading states do Dashboard
**Description:** Como usuário, quando o Dashboard está carregando ou não tem dados, quero ver skeletons elegantes em vez de "loading..." ou tela em branco.

**Acceptance Criteria:**
- [ ] Enquanto `useData()` carrega: renderizar `<Skeleton.Card />` para cada StatCard e `<Skeleton.Card />` grande para os charts
- [ ] Quando não há dados (ex: zero vendas no período): mostrar empty state com ícone Lucide (`LineChart` ou `Inbox`), título, descrição e CTA opcional ("Registrar primeira venda")
- [ ] Empty state ilustração entra com fade + slideY (300ms)
- [ ] Verificar em browser (forçar estados via mock se necessário)

---

### Inventory — refinamento

#### US-015: Lista de estoque — stagger entry, row hover refinado, badges polidos
**Description:** Como usuário do Inventory, quero que a lista entre suavemente, cada linha tenha hover state refinado, e os status badges sejam visualmente polidos.

**Acceptance Criteria:**
- [ ] Em [pages/Inventory.tsx](pages/Inventory.tsx), envolver lista (mobile cards e desktop table rows) com `<Stagger delay={30}>`
- [ ] Cada row/card: `motion.div` com `whileHover={{ scale: 1.005, y: -1 }}` + `transition: iosSpring`
- [ ] Refinar `.ios-badge-*`: adicionar sutil border interno (`inset 0 0 0 1px rgba(255,255,255,0.1)`) e tipografia tracking-tight
- [ ] Status badge "Disponível" (verde): adicionar pequeno dot animado (pulse, 2s loop, paused on reduced-motion)
- [ ] Click no row: scale 0.98 active feedback
- [ ] Reduced motion: sem stagger (renderiza tudo junto), sem hover scale
- [ ] [Inventory.test.tsx](pages/Inventory.test.tsx) continua passando
- [ ] Verificar em browser

#### US-016: Filtros e search — chips animados + focus ring spring
**Description:** Como usuário, quero que os chips de filtro tenham feedback claro quando ativados/desativados e que o input de busca tenha focus ring com vida.

**Acceptance Criteria:**
- [ ] Filtros (chips de status, condition, store): clicar transiciona com `iosSpring` entre estados (background, color, border)
- [ ] Chip ativo: ganha pill solid color + scale 1.02
- [ ] Search input: focus ring expande com spring (de 0 → 4px), border vira brand-500
- [ ] Adicionar X button para limpar busca quando há texto (entra com fade + scale spring)
- [ ] Verificar em browser

#### US-017: StockDetailsModal + StockFormModal — motion polish
**Description:** Como usuário, quero que os modais de detalhe e edição de estoque tenham as mesmas animações refinadas do US-006 e que o conteúdo interno também tenha micro-animações.

**Acceptance Criteria:**
- [ ] Refatorar [components/StockDetailsModal.tsx](components/StockDetailsModal.tsx) e [components/StockFormModal.tsx](components/StockFormModal.tsx) para herdar o novo Modal (US-006) automaticamente
- [ ] StockDetailsModal: campos de informação entram com stagger (40ms)
- [ ] StockFormModal: validação de erro usa shake animation (translateX -8 → 8 → 0, 350ms) no input + label vermelho
- [ ] Botão "Salvar" usa Button (US-008) com loading state durante save e success state após
- [ ] Verificar em browser

---

### PDV — Square POS-style tactile

#### US-018: Step navigator com indicator slide
**Description:** Como usuário do PDV, quero que o indicador de step atual deslize suavemente entre os passos do checkout (não pule).

**Acceptance Criteria:**
- [ ] No step navigator do [pages/PDV.tsx](pages/PDV.tsx), usar `layoutId="pdv-step-indicator"` no background do step ativo
- [ ] Transition: `iosSpring` (`stiffness: 380, damping: 30`)
- [ ] Steps completos: ícone de checkmark com pathLength draw (300ms)
- [ ] Step ativo: scale 1.05, cor brand
- [ ] Steps futuros: cor cinza, scale 1
- [ ] Reduced motion: sem layout animation, troca instantânea de cor
- [ ] [PDV.test.tsx](pages/PDV.test.tsx) continua passando
- [ ] Verificar em browser

#### US-019: Carrinho — spring add/remove + total animado
**Description:** Como usuário, quando adiciono ou removo um item do carrinho, quero ver o item entrar/sair com mola, e quero ver o total animar para o novo valor — estilo Square checkout.

**Acceptance Criteria:**
- [ ] Cart line items envolvidos em `<AnimatePresence>` com:
  - Enter: opacity 0 + slideX -16 → 0 + height 0 → auto, `iosSpring`
  - Exit: opacity 1 → 0 + slideX 0 → 16 + height auto → 0, 200ms
- [ ] Total da venda usa `<AnimatedNumber>` (US-003) com formato BRL e duration 500ms
- [ ] Subtotal, descontos e impostos também usam AnimatedNumber
- [ ] Quando total muda: leve flash de cor brand (background flash 300ms) no container do total — "respira"
- [ ] Reduced motion: itens aparecem/somem sem slide, número pula direto
- [ ] Verificar em browser

#### US-020: Botões de ação tátil — payment methods, numeric input, qty controls
**Description:** Como usuário operando um PDV em touch, quero que cada botão tenha feedback tátil forte estilo Square (scale + ripple sutil + haptic visual).

**Acceptance Criteria:**
- [ ] Botões de método de pagamento (PIX, Cartão, Dinheiro): `whileTap={{ scale: 0.94 }}` + ripple via `motion.span` que expande do ponto de toque
- [ ] Quando selecionado: ganha ring brand-500 + checkmark no canto + leve scale 1.02 sustained
- [ ] Botões de quantidade (+/-) no carrinho: `whileTap={{ scale: 0.85 }}` + spring back
- [ ] Tap em produto/item para adicionar ao carrinho: o item "voa" pro carrinho (motion's animate from layout) — efeito sutil
- [ ] Reduced motion: sem ripple, sem voo, apenas mudança de cor + checkmark estático
- [ ] Verificar em browser

#### US-021: Sale-completed celebration
**Description:** Como vendedor, quando finalizo uma venda com sucesso, quero ver uma celebração visual rápida que confirme o sucesso — estilo Square ou Stripe Checkout.

**Acceptance Criteria:**
- [ ] Após sucesso da finalização, mostrar overlay full-screen com:
  - Background: `liquid-glass-strong` fade in (200ms)
  - Centro: SVG checkmark grande (96px) com `pathLength` draw (500ms ease-out)
  - Círculo ao redor do checkmark: scale 0 → 1 spring + green-500 background
  - Texto "Venda concluída!" + valor total (AnimatedNumber, count from 0)
  - Mini partículas (12-16 dots) que explodem do centro com `motion` (3D-ish, fade out em 800ms) — opcional, sutil
- [ ] Auto-dismiss após 2.5s ou ao tap
- [ ] Botão "Nova venda" entra com slideUp delay 600ms
- [ ] Reduced motion: checkmark aparece estático, sem partículas, fade simples
- [ ] Verificar em browser (criar mock de finalização)

#### US-022: PDV form inputs — focus spring, error shake, success check
**Description:** Como usuário, quando preencho campos do PDV (cliente, valor, observação), quero feedback animado de focus, erro e sucesso.

**Acceptance Criteria:**
- [ ] Refinar `.ios-input` em [index.css](index.css): focus ring usa `box-shadow` animável (CSS transition já existe, ajustar para spring-like via cubic-bezier `(0.32, 0.72, 0, 1)`)
- [ ] Em [PDV.tsx](pages/PDV.tsx), inputs com erro: aplicar shake (US-017 mesmo padrão)
- [ ] Inputs validados com sucesso (após blur): mostrar checkmark verde inline (16px) à direita, fade in 200ms
- [ ] Verificar em browser

---

### Polish final

#### US-023: Reduced motion audit + acessibilidade
**Description:** Como usuário com `prefers-reduced-motion`, quero que TODAS as animações sejam reduzidas ou removidas — sem regressões introduzidas pelo PRD.

**Acceptance Criteria:**
- [ ] Configurar `<MotionConfig reducedMotion="user">` no [App.tsx](App.tsx) ou [index.tsx](index.tsx) — global
- [ ] QA manual com `prefers-reduced-motion: reduce` (devtools) em: Dashboard, Inventory, PDV, todos os modais polidos, layout chrome
- [ ] Verificar contraste sobre `liquid-glass`: usar Chrome Lighthouse / contrast checker em pelo menos 4 surfaces (top bar light, top bar dark, modal light, modal dark) — ratio ≥ 4.5:1 para texto, ≥ 3:1 para UI
- [ ] Documentar resultados em comentário ou log
- [ ] Fix qualquer regressão encontrada

#### US-024: Performance pass + bundle audit
**Description:** Como usuário, quero que o app continue rápido após todas as animações adicionadas — 60fps em devices target.

**Acceptance Criteria:**
- [ ] Rodar `npx vite build` e comparar tamanho do bundle gzip antes/depois — delta deve ser ≤ 35kb
- [ ] Garantir `motion` é tree-shaken: importar de `motion/react` (mini bundle) em vez de `framer-motion`
- [ ] Adicionar `will-change: transform, opacity` apenas em elementos animados ativamente (não permanente)
- [ ] Garantir que todos os elementos com `liquid-glass` estão em containers fixos/sticky/portal — não dentro de listas longas
- [ ] Profiling rápido no Chrome DevTools Performance tab: scroll do Inventory, abertura de modal, finalização de venda — identificar long tasks > 50ms
- [ ] Documentar findings; corrigir qualquer regressão crítica
- [ ] Build final passa, app roda sem warnings novos

---

## 4. Functional Requirements (numerados para referência)

### Motion System
- **FR-1**: O app deve usar a biblioteca `motion` (ex-framer-motion) para todas as animações novas via primitivas em `components/motion/`.
- **FR-2**: Todas as animações devem ter duração entre 100ms e 500ms, com exceção de loops infinitos (shimmer, pulse) e loading states.
- **FR-3**: O app deve respeitar `prefers-reduced-motion: reduce` globalmente via `<MotionConfig reducedMotion="user">`.
- **FR-4**: Todas as animações de entrada de modais e overlays devem usar spring physics (`stiffness: 320-400`, `damping: 28-32`).
- **FR-5**: Stagger entre elementos sequenciais deve ser entre 30ms e 50ms, com no máximo 8 elementos animados em sequência.

### Liquid Glass
- **FR-6**: Apenas chrome flutuante (top bar, bottom tab, modais, toasts, FABs, command palette) deve usar utility `.liquid-glass*`.
- **FR-7**: Cards de lista, rows de tabela e StatCards NÃO devem usar liquid glass — usam `shadow-ios26-*` tokens.
- **FR-8**: Quando `backdrop-filter` não é suportado pelo browser, fallback para background opaco (sem blur).
- **FR-9**: Contraste de texto sobre liquid glass deve ser ≥ 4.5:1 em ambos os modos (light/dark).

### Componentes
- **FR-10**: Modal deve suportar drag-to-dismiss em mobile (gesture vertical, threshold velocity 500 ou offset 100px).
- **FR-11**: Toast viewport deve exibir até 3 toasts visíveis, com os antigos comprimidos em scale 0.95 e opacity 0.7.
- **FR-12**: Botão deve suportar estados `loading` (spinner inline) e `success` (checkmark draw + cor verde 1.5s).
- **FR-13**: Combobox dropdown highlight deve usar `layoutId` para deslizar entre items na navegação por teclado.
- **FR-14**: Tab bar / sidebar item ativo deve usar `layoutId` pill indicator para deslizar entre tabs.

### Dashboard
- **FR-15**: StatCards do Dashboard devem usar `<AnimatedNumber>` para o valor principal, com count-up de 600ms.
- **FR-16**: Charts (Recharts) devem usar gradient fills e tooltips com `liquid-glass`.
- **FR-17**: Estado de loading do Dashboard deve mostrar `<Skeleton.Card />` para cada widget.

### Inventory
- **FR-18**: Lista de estoque deve usar stagger de 30ms entre rows/cards na entrada inicial.
- **FR-19**: Filter chips devem ter spring transition entre estados ativo/inativo.
- **FR-20**: Validação de erro em forms deve usar shake animation (translateX -8 → 8 → 0, 350ms).

### PDV
- **FR-21**: Carrinho (line items) deve usar `AnimatePresence` para enter/exit animado.
- **FR-22**: Total da venda deve usar `<AnimatedNumber>` com flash de background brand quando muda.
- **FR-23**: Botões de pagamento e qty controls devem ter `whileTap={{ scale: 0.85-0.94 }}` + spring back.
- **FR-24**: Após sale completion, exibir overlay de celebração com checkmark animado, AnimatedNumber e auto-dismiss em 2.5s.
- **FR-25**: Step navigator do PDV deve usar `layoutId` para indicator slide entre steps.

### Performance
- **FR-26**: Bundle gzip total não deve aumentar mais de 35kb após implementação completa.
- **FR-27**: App deve manter 60fps em scroll de listas longas e durante transições de modal/route no iPhone 12 / Macbook Air M1.
- **FR-28**: Importar `motion` de `motion/react` (não `framer-motion` legacy) para tree-shaking ótimo.

---

## 5. Non-Goals (Out of Scope)

- ❌ NÃO refatorar páginas fora do trio prioritário (Finance, Clients, Sellers, Stores, Warranties, Profile, Debtors, Settings, PartsStock, Login). Stories de **componentes compartilhados** (Modal, Toast, Button, Combobox, Layout) afetam essas páginas indiretamente, mas nenhum trabalho específico nelas.
- ❌ NÃO migrar Recharts para outra lib (D3, Visx, Tremor). Apenas refinar dentro do que Recharts oferece.
- ❌ NÃO adicionar SVG `<feDisplacementMap>` nem WebGL para refração avançada. Liquid Glass usa apenas `backdrop-filter` + multi-layer CSS — refração realista fica fora do escopo (trade-off: Safari não suporta SVG displacement, custo de GPU alto).
- ❌ NÃO implementar haptic feedback real (Vibration API) — apenas feedback visual ("haptic visual").
- ❌ NÃO redesenhar fluxo de informação ou IA do PDV — apenas polish visual e motion. Steps, campos, validações permanecem.
- ❌ NÃO criar storybook ou documentação visual além de comentários inline.
- ❌ NÃO mudar paleta de cores brand (azul `#3b82f6`).
- ❌ NÃO suportar IE11 / browsers sem `backdrop-filter` além do fallback opaco mencionado.
- ❌ NÃO adicionar animações 3D / parallax em scroll geral — só onde explicitamente listado.

---

## 6. Design Considerations

### Referências visuais (concretas)
- **Apple HIG iOS 26 / Liquid Glass**: nav bars do iOS 26, Control Center, Notification Center, Dock no macOS Tahoe — material translúcido com especulares
- **Linear**: lista de issues (densidade), command palette, sidebar nav, hover states
- **Notion**: settings page (forms refinados), database views (rows hover)
- **Vercel Dashboard**: gráficos refinados, tooltips, empty states
- **Square POS**: checkout flow, numeric keypad, grandes botões de payment, celebração de venda
- **Stripe Dashboard**: tooltips, gradients em charts, AnimatedNumber em métricas
- **Mercury Bank**: transição entre rotas, motion sutil em listas

### Componentes existentes a reusar
- `Modal`, `ConfirmDialog`, `Combobox`, `Toast` em `components/ui/` — refatorar, não recriar
- Tokens `.ios-card`, `.ios-button-*`, `.ios-input`, `.ios-badge-*` em [index.css](index.css) — refinar, manter API
- Keyframes existentes em [tailwind.config.cjs](tailwind.config.cjs) — manter para fallback CSS-only

### Estrutura de arquivos a criar
```
components/
  motion/
    index.ts                # exports
    transitions.ts          # presets nomeados
    Fade.tsx
    SlideUp.tsx
    Scale.tsx
    Stagger.tsx
    AnimatedNumber.tsx
    PageTransition.tsx
  ui/
    Skeleton.tsx            # novo
    Button.tsx              # opcional, se US-008 escolher criar wrapper
```

### Tokens iOS 26 (para US-002)
```css
/* Liquid Glass — material */
.liquid-glass {
  background-color: rgba(255, 255, 255, 0.72);
  backdrop-filter: blur(24px) saturate(180%);
  -webkit-backdrop-filter: blur(24px) saturate(180%);
  border: 1px solid rgba(255, 255, 255, 0.18);
  box-shadow:
    0 1px 0 0 rgba(255, 255, 255, 0.5) inset,    /* highlight top */
    0 -1px 0 0 rgba(0, 0, 0, 0.04) inset,         /* shadow bottom */
    0 8px 24px rgba(0, 0, 0, 0.08),               /* drop */
    0 2px 4px rgba(0, 0, 0, 0.04);
}
.dark .liquid-glass {
  background-color: rgba(28, 28, 30, 0.72);
  border-color: rgba(255, 255, 255, 0.08);
  box-shadow:
    0 1px 0 0 rgba(255, 255, 255, 0.06) inset,
    0 -1px 0 0 rgba(0, 0, 0, 0.4) inset,
    0 8px 24px rgba(0, 0, 0, 0.4),
    0 2px 4px rgba(0, 0, 0, 0.2);
}
@supports not (backdrop-filter: blur(24px)) {
  .liquid-glass { background-color: rgba(255, 255, 255, 0.92); }
  .dark .liquid-glass { background-color: rgba(28, 28, 30, 0.94); }
}
```

---

## 7. Technical Considerations

- **Lib de motion**: usar `motion` (npm: `motion`), import path `motion/react`. É a continuação oficial de `framer-motion` mantida pelo mesmo time, com bundle menor (~18-30kb gzip dependendo de tree-shaking) e API idêntica.
- **React 19**: motion suporta. Verificar peer deps no install.
- **`prefers-reduced-motion`**: motion lib trata via `<MotionConfig reducedMotion="user">` — uma única configuração global. Componentes com animação CSS pura também precisam respeitar (já tem em [index.css:493](index.css#L493)).
- **Recharts 3.8.1**: gradientes via `<defs><linearGradient id=""/></defs>` — já compatível, sem upgrade.
- **Tailwind 4**: tokens em [tailwind.config.cjs](tailwind.config.cjs) — extender `boxShadow`, `transitionTimingFunction`, `animation`. Liquid glass utilities entram em `@layer components` em [index.css](index.css).
- **Bundle budget**: monitorar com `vite build` antes/depois. Usar chunk `vendor-motion` separado se necessário.
- **Safari `backdrop-filter`**: precisa do prefixo `-webkit-backdrop-filter` (incluir sempre).
- **Testes existentes**: Modal.test, Combobox.test, Inventory.test, PDV.test, Finance.test, Warranties.test, PublicWarranty.test, Debtors.test — manter passando. Stories críticas devem rodar `npm run test:run` antes de marcar como complete.
- **Drag gestures (US-006)**: pode conflitar com scroll vertical do conteúdo do modal. Usar `dragListener={false}` no `motion.div` raiz e `dragControls` ativados apenas no drag handle (barra cinza no topo).
- **`layoutId` collisions**: cuidar de IDs únicos por contexto. Usar `pdv-step-indicator`, `tab-pill-mobile`, `tab-pill-desktop`, `combobox-highlight`, etc.
- **AnimatedNumber em listas**: se houver vários `<AnimatedNumber>` simultâneos (StatCards), garantir que cada um tem seu próprio `useSpring` (component instance scoping é automático, só anotar).

---

## 8. Success Metrics

- **M1**: Bundle gzip total ≤ baseline + 35kb
- **M2**: Build vite verde sem warnings novos
- **M3**: Todos os testes vitest existentes continuam passando + 3 novos testes adicionados (AnimatedNumber, Modal drag, Skeleton)
- **M4**: 60fps mantido durante: scroll Inventory (200+ items), abertura/fechamento de modal, transição entre rotas (Chrome Performance tab)
- **M5**: Lighthouse Accessibility score ≥ 95 nas 3 páginas alvo (Dashboard, Inventory, PDV)
- **M6**: Contraste WCAG AA em todas as superfícies com `liquid-glass` (ratio ≥ 4.5:1 texto, ≥ 3:1 UI)
- **M7**: Reduced motion desativa 100% das transformações (verificação manual via `prefers-reduced-motion: reduce`)
- **M8**: Zero regressões funcionais nas 3 páginas alvo + componentes compartilhados (Modal, Toast, Combobox, ConfirmDialog)

---

## 9. Open Questions

- **Q1**: A celebração de venda (US-021) com partículas é desejada ou exagerada para o tom do produto? Default: incluir mas sutil (12 partículas, 800ms).
- **Q2**: O motion lib `motion` é preferível ao `framer-motion`? Decisão tomada: sim (mesmo time, bundle menor, API idêntica). Se houver problema de peer dep com React 19, fallback para `framer-motion@latest`.
- **Q3**: Haptic feedback real (Vibration API no mobile) é desejado? Marcado como out-of-scope, mas é fácil de adicionar depois (1 linha em US-020). Confirmar?
- **Q4**: Page transitions (US-005) podem causar latência percebida em conexões lentas. Vale a pena ou preferir crossfade mais rápido (120ms)? Default: 200ms fade.
- **Q5**: O drag-to-dismiss do modal (US-006) deve estar disponível também no desktop com mouse? Default: NÃO — apenas mobile (gesto iOS nativo).
- **Q6**: Charts no Dashboard ganham animação de entrada apenas no primeiro render ou também em re-renders (mudança de filtro/período)? Default: apenas primeiro render — Recharts re-renders custosos.
- **Q7**: Existem outras páginas (fora do trio) onde o esforço de fundação (motion primitives, liquid glass tokens, Modal/Toast polidos) deveria propagar imediatamente? Default: deixar essas páginas herdarem automaticamente via componentes compartilhados, sem sweep manual.

---

## Apêndice — Ordem sugerida de implementação

Stories podem rodar em paralelo dentro de cada bloco. Cada bloco depende do anterior.

**Bloco 1 — Fundação** (sequencial): US-001 → US-002 → US-003, US-004, US-005 (paralelo)

**Bloco 2 — Component library** (paralelo após bloco 1): US-006, US-007, US-008, US-009, US-010, US-011

**Bloco 3 — Páginas** (paralelo após bloco 2):
- Dashboard: US-012 → US-013 → US-014
- Inventory: US-015 → US-016 → US-017
- PDV: US-018 → US-019 → US-020 → US-021 → US-022

**Bloco 4 — Polish final** (sequencial após bloco 3): US-023 → US-024
