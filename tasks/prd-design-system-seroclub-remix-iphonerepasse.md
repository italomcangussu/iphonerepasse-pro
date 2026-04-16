# PRD — Evolução Visual Global com Design System (SeroClub Remix + Marca iPhoneRepasse)

## 1. Contexto
Evoluir a interface inteira do `iphonerepasse-pro` usando a linguagem visual do `seroclub` (motion, tipografia e atmosfera), preservando a identidade da marca iPhoneRepasse (azul + laranja), com modos Light e Dark e contraste AA.

Fonte de referência do design system:
- https://github.com/italomcangussu/seroclub

## 2. Objetivo do Produto
Padronizar o visual do shell, componentes base e CRM numa única camada de tokens, reduzindo inconsistência visual e melhorando legibilidade em ambos os temas.

## 3. Escopo
### Incluído
- Criação de tokens globais de design (`--ds-*`) para cor, superfície, borda, sombra e feedback.
- Adaptação do shell principal para novo fundo atmosférico orientado à marca.
- Refatoração dos componentes iOS utilitários (`ios-card`, `ios-button`, `ios-input`, badges, segmented, glass) para consumir tokens.
- Atualização da camada visual do CRM standalone para consumir tokens e responder corretamente ao modo dark.
- Entrega dos artefatos de design system (`combined-tokens.json`, `design_system.html`, `prompt.md`).

### Não incluído nesta fase
- Refatoração pixel-perfect de todas as páginas de negócio individualmente.
- Revisão de copy/layout de cada tela de formulário (fase 2/3).

## 4. Requisitos Funcionais
1. O toggle de tema existente deve continuar funcional.
2. Light/Dark devem alterar superfícies, texto e bordas sem perda de contraste.
3. Botões, inputs e cards base devem respeitar tokens sem hardcode crítico de cor.
4. CRM standalone deve compartilhar a mesma lógica cromática do app principal.

## 5. Requisitos Não Funcionais
1. Contraste mínimo AA para texto normal nas combinações principais.
2. Compatibilidade com `prefers-reduced-motion` já existente.
3. Nenhuma quebra de build.

## 6. Métricas de Sucesso
- 100% dos componentes base (`ios-*` + `crm-*`) usando tokens para cores principais.
- Zero regressão de build (`npm run build`).
- Dark mode visualmente consistente no shell e no CRM.

## 7. Plano de Execução
### Fase 1 — Fundação (executada neste ciclo)
- [x] Extrair DNA visual do SeroClub e consolidar tokens.
- [x] Definir paleta iPhoneRepasse com variantes light/dark.
- [x] Introduzir tokens globais `--ds-*` no `index.css`.
- [x] Migrar componentes base iOS para tokens.
- [x] Ajustar tema CRM para herdar tokens e suportar dark.
- [x] Aplicar fundo base no shell principal (`app-shell-bg`).

### Fase 2 — Páginas de domínio (próxima)
- [ ] Revisar páginas de operação (Dashboard, PDV, Estoque, Clientes) removendo hardcodes residuais.
- [ ] Unificar estilos de tabelas, filtros e cabeçalhos.

### Fase 3 — QA visual
- [ ] Checklist de contraste por tela crítica (light e dark).
- [ ] Ajustes finos de estados hover/focus/disabled por componente.

## 8. Artefatos
- `design-system/seroclub-iphonerepasse/seroclub-tokens.json`
- `design-system/seroclub-iphonerepasse/combined-tokens.json`
- `design-system/seroclub-iphonerepasse/design_system.html`
- `design-system/seroclub-iphonerepasse/prompt.md`

## 9. Riscos
1. Uso de `color-mix()` em navegadores antigos (fallback visual parcial).
2. Algumas telas de negócio ainda podem conter hardcodes locais fora da camada base.

## 10. Decisão de Arquitetura Visual
- **SeroClub** contribui com: escala tipográfica, motion orgânico e atmosfera (gradientes/orbs).
- **iPhoneRepasse** mantém: hierarquia cromática principal (azul) + destaque comercial (laranja).
- **Dark/Light** tratados por variáveis raiz para troca sem duplicação de componente.
