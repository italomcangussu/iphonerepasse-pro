---
name: CRM Plus iPhoneRepasse
description: Uma mesa de atendimento confiável e humana para conversas comerciais.
colors:
  primary: "#2563eb"
  primary-strong: "#1d4ed8"
  accent: "#f97316"
  accent-strong: "#c2410c"
  canvas: "#f8fafc"
  surface: "#ffffff"
  surface-soft: "#f1f5f9"
  ink: "#0f172a"
  ink-secondary: "#334155"
  ink-muted: "#64748b"
  dark-canvas: "#0b1220"
  dark-surface: "#20293a"
  dark-ink: "#e8edf4"
  success: "#16a34a"
  warning: "#b45309"
  error: "#dc2626"
typography:
  headline:
    fontFamily: "-apple-system, BlinkMacSystemFont, SF Pro Display, SF Pro Text, Manrope, system-ui, sans-serif"
    fontSize: "1.375rem"
    fontWeight: 700
    lineHeight: 1.2
    letterSpacing: "-0.02em"
  title:
    fontFamily: "-apple-system, BlinkMacSystemFont, SF Pro Text, Manrope, system-ui, sans-serif"
    fontSize: "1.0625rem"
    fontWeight: 600
    lineHeight: 1.3
    letterSpacing: "-0.01em"
  body:
    fontFamily: "-apple-system, BlinkMacSystemFont, SF Pro Text, Manrope, system-ui, sans-serif"
    fontSize: "0.9375rem"
    fontWeight: 400
    lineHeight: 1.4
    letterSpacing: "-0.01em"
  label:
    fontFamily: "-apple-system, BlinkMacSystemFont, SF Pro Text, Manrope, system-ui, sans-serif"
    fontSize: "0.8125rem"
    fontWeight: 600
    lineHeight: 1.4
    letterSpacing: "-0.01em"
rounded:
  control: "10px"
  container: "14px"
  panel: "20px"
  pill: "9999px"
spacing:
  xs: "4px"
  sm: "8px"
  md: "12px"
  base: "16px"
  lg: "20px"
  xl: "24px"
  2xl: "32px"
components:
  button-primary:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.surface}"
    typography: "{typography.body}"
    rounded: "{rounded.control}"
    padding: "10px 20px"
    height: "44px"
  button-ghost:
    backgroundColor: "{colors.surface-soft}"
    textColor: "{colors.ink-secondary}"
    typography: "{typography.body}"
    rounded: "{rounded.control}"
    padding: "10px 16px"
    height: "44px"
  input:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    typography: "{typography.body}"
    rounded: "{rounded.control}"
    padding: "10px 12px"
    height: "44px"
  chip:
    backgroundColor: "{colors.surface-soft}"
    textColor: "{colors.ink-secondary}"
    typography: "{typography.label}"
    rounded: "{rounded.pill}"
    padding: "6px 10px"
  conversation-row:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    typography: "{typography.body}"
    rounded: "{rounded.container}"
    padding: "12px"
---

# Design System: CRM Plus iPhoneRepasse

## 1. Overview

**Creative North Star: "Mesa de Atendimento"**

O CRM Plus deve parecer o espaço de trabalho de uma equipe atenta: organizado o bastante para inspirar confiança e humano o bastante para manter cada cliente visível como pessoa. A conversa ocupa o centro; navegação, filtros, contexto comercial e automação formam uma estrutura discreta ao redor dela.

A densidade é operacional, nunca decorativa. Azul indica direção, seleção e ação; laranja chama atenção com parcimônia. Superfícies se separam por tom, ritmo e bordas antes de recorrer a sombras. O sistema rejeita explicitamente a aparência de SaaS genérico, glassmorphism decorativo, gradientes sem função, excesso de cards, hierarquia baseada apenas em sombras e animações chamativas.

**Key Characteristics:**

- Conversas e próximas ações dominam a hierarquia.
- Controles familiares, táteis e consistentes reduzem hesitação.
- Estados são claros em texto, forma e cor.
- Tema claro e escuro preservam a mesma hierarquia semântica.
- Movimento é curto, responsivo e ligado a mudança de estado.

## 2. Colors

A paleta une um azul direto e confiável a neutros slate; o laranja da marca é um sinal de atenção, não decoração.

### Primary

- **Azul de Confiança**: ação principal, foco, seleção atual, links e indicadores de navegação.
- **Azul de Decisão**: hover, estados pressionados e contraste de texto quando o azul principal não atingir AA.

### Secondary

- **Laranja de Atenção**: exceções comerciais e pontos que realmente pedem atenção; nunca compete com a ação principal.
- **Laranja Resoluto**: versão de maior contraste para texto pequeno ou ícones sobre superfícies claras.

### Tertiary

- **Verde de Continuidade**: sucesso, disponibilidade e estados concluídos.
- **Âmbar de Cautela**: avisos que ainda permitem continuidade.
- **Vermelho de Interrupção**: falhas e ações destrutivas.

### Neutral

- **Névoa Operacional**: canvas claro de baixo ruído.
- **Mesa Clara**: superfície principal para mensagens, painéis e controles.
- **Tinta Slate**: texto primário e dados essenciais.
- **Slate de Apoio**: metadados, descrições e texto secundário que ainda precisa atingir AA.
- **Noite Navy**: canvas escuro, elevado o bastante para evitar preto absoluto e smearing em OLED.
- **Mesa Noturna**: camada elevada no tema escuro.
- **Tinta Noturna**: texto principal off-white, evitando brilho excessivo.

**The One Blue Rule.** Azul é reservado para ação, foco e seleção. Se tudo estiver azul, nada estará priorizado.

**The Orange Signal Rule.** Laranja só aparece quando a informação pede atenção real; nunca como preenchimento decorativo.

**The Color Is Not a Label Rule.** Estado, prioridade e responsabilidade nunca dependem apenas de cor.

## 3. Typography

**Display Font:** SF Pro Display, com Manrope e system-ui como fallback

**Body Font:** SF Pro Text, com Manrope e system-ui como fallback

**Character:** uma única família de interface mantém o produto familiar e rápido. Peso, tamanho e espaço criam a hierarquia; caixa alta e tracking amplo não substituem estrutura.

### Hierarchy

- **Headline** (700, 1.375rem, 1.2): título da tela e contexto principal da conversa.
- **Title** (600, 1.0625rem, 1.3): nomes de contatos, seções e ações importantes.
- **Body** (400, 0.9375rem, 1.4): mensagens, instruções e conteúdo operacional; prose longa fica limitada a 65–75ch.
- **Label** (600, 0.8125rem, 1.4): metadados e rótulos de controle. Texto abaixo de 12px não carrega informação essencial.

**The Sentence Case Rule.** Use frase normal em títulos, botões e rótulos. Caixa alta fica restrita a siglas e dados tabulares que realmente precisem dela.

**The Read Once Rule.** Texto operacional deve ser entendido na primeira leitura: verbo direto, objeto claro e orientação de recuperação quando houver erro.

## 4. Elevation

O sistema é plano por padrão. No tema claro, uma sombra curta pode distinguir controles flutuantes e overlays; no escuro, profundidade vem principalmente de camadas navy progressivamente mais claras. Bordas finas separam regiões adjacentes. Nunca use simultaneamente borda decorativa e sombra larga para fabricar um card.

### Shadow Vocabulary

- **Contato** (`0 1px 3px rgba(15, 23, 42, 0.08)`): feedback sutil em superfícies interativas.
- **Flutuação** (`0 4px 8px rgba(0,0,0,0.04), 0 2px 4px rgba(0,0,0,0.06)`): menus e elementos que precisam sair do fluxo.
- **Overlay** (`0 8px 32px rgba(0, 0, 0, 0.16)`): dialogs e sheets; proibida em cards comuns.

**The Structural Depth Rule.** Use tom e divisores para estrutura; sombra comunica sobreposição temporária.

## 5. Components

### Buttons

- **Shape:** cantos táteis e contidos (10px), com altura mínima de 44px.
- **Primary:** Azul de Confiança, texto branco e padding horizontal de 20px.
- **Hover / Focus:** mudança para Azul de Decisão em 150–200ms; foco de 2px com offset visível; active usa escala mínima somente quando movimento reduzido não estiver ativo.
- **Secondary / Ghost:** superfície neutra, texto Slate de Apoio e estado hover por mudança tonal, sem gradiente.

### Chips

- **Style:** formato pill apenas para filtros, estados ou categorias curtas; fundo neutro e texto com contraste AA.
- **State:** seleção combina fundo azul suave, texto Azul de Decisão e marca adicional além da cor.

### Cards / Containers

- **Corner Style:** curvatura contida (14px); painéis estruturais podem chegar a 20px, nunca mais.
- **Background:** Mesa Clara ou a camada navy correspondente.
- **Shadow Strategy:** sem sombra em repouso; overlays seguem o vocabulário de Elevação.
- **Border:** divisor fino quando duas superfícies do mesmo tom se encontram.
- **Internal Padding:** 12–20px conforme densidade e viewport.

### Inputs / Fields

- **Style:** altura mínima de 44px, fundo sólido, borda discreta e cantos de 10px.
- **Focus:** borda Azul de Confiança e anel perceptível sem deslocar layout.
- **Error / Disabled:** erro traz mensagem de recuperação associada ao campo; disabled mantém legibilidade e explica indisponibilidade quando necessário.

### Navigation

A navegação usa ícone e rótulo, com seleção atual inequívoca e foco visível. No desktop, a barra lateral preserva densidade; no mobile, ações primárias permanecem alcançáveis e respeitam safe areas. Tooltips complementam estados recolhidos, nunca substituem rótulos essenciais.

### Conversation Row

Cada linha responde rapidamente: quem, última mensagem, tempo, canal, prioridade e responsabilidade. Não transforme cada metadado em badge. Não lidos e transferências pendentes usam peso, forma e texto além de cor.

### Message Composer

O compositor é uma única zona de ação. Anexo, texto, áudio e envio compartilham alvos de 44px, estados disabled claros e feedback imediato. Atalhos de teclado aparecem como ajuda contextual, não como texto decorativo persistente.

## 6. Do's and Don'ts

### Do:

- **Do** manter mensagens, contexto e próxima ação no topo da hierarquia.
- **Do** usar Azul de Confiança apenas para ação, foco e seleção.
- **Do** garantir WCAG 2.2 AA, foco visível, teclado completo e alvos de 44 × 44px.
- **Do** combinar cor com texto, ícone ou forma para comunicar estado.
- **Do** usar transições de 150–250ms e respeitar `prefers-reduced-motion`.
- **Do** escrever erros com causa compreensível e próximo passo possível.

### Don't:

- **Don't** reproduzir a aparência de SaaS genérico.
- **Don't** usar glassmorphism decorativo, gradientes sem função ou animações chamativas.
- **Don't** criar excesso de cards ou hierarquia baseada apenas em sombras.
- **Don't** combinar borda decorativa com sombra larga no mesmo componente.
- **Don't** usar gradiente em texto, faixas laterais coloridas ou cantos acima de 20px em painéis.
- **Don't** repetir minúsculos rótulos em caixa alta com tracking amplo como estrutura padrão.
- **Don't** reinventar controles, esconder ações essenciais em tooltips ou depender apenas de cor.
