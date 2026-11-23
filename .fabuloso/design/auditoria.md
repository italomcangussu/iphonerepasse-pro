# Auditoria de design — iphonerepasse-pro

> 2026-11-23 14:57 · 4 arquivos · tipo pwa-standalone (web). Heurístico: confira cada item antes de corrigir. P1–P3 é a sugestão do script; P0 (tarefa bloqueada) é julgamento seu. Exceção: `design-ok <id>: motivo`.

| P | Lei / lente | Onde | Problema | Correção | Regra |
|---|---|---|---|---|---|
| P1 | Jakob | pages/PayableDebts.tsx:845 | <div> clicável | use <button> (ou <a> para navegação): ganha foco, teclado, leitor de tela e o estado pressionado | `clicavel-sem-botao` |
| P2 | Fitts | components/StockReservationModal.tsx:487 | alvo de toque de 36 px em <button> | mínimo 44×44 (iOS e web) / 48×48 dp (Android): `min-h-11 min-w-11`, ou área de toque maior que o desenho (`p-2.5` ou pseudo-elemento) | `alvo-pequeno` |
| P2 | Tesler | components/marketing/ScriptsTab.tsx:81 | campo numérico sem teclado numérico | `inputMode="numeric"` (ou `tel`) e máscara que aceita qualquer formato (Postel) | `teclado-numerico` |
| P2 | clareza | components/marketing/ScriptsTab.tsx:133 | campo só com placeholder | rótulo persistente (`<label htmlFor>`): o placeholder some ao digitar e a pessoa esquece o que era (Miller) | `so-placeholder` |
| P2 | Norman (recuperação) | pages/PayableDebts.tsx:302 | mensagem técnica crua na tela (error.message) | traduza por tipo de falha (rede, permissão, validação, servidor) para língua de gente; o detalhe técnico vai para o log | `erro-cru` |
| P2 | clareza | pages/PayableDebts.tsx:424 | campo só com placeholder | rótulo persistente (`<label htmlFor>`): o placeholder some ao digitar e a pessoa esquece o que era (Miller) | `so-placeholder` |
| P2 | Tesler | pages/PayableDebts.tsx:868 | campo numérico sem teclado numérico | `inputMode="numeric"` (ou `tel`) e máscara que aceita qualquer formato (Postel) | `teclado-numerico` |
| P2 | escala | pages/crm/SimulatorPage.tsx:45 | valor fora da escala (min-h-[44px]) | troque pelo degrau mais próximo da escala de espaço (4 8 12 16 24 32 48 64…): `p-4`, `gap-6` | `espaco-fora-escala` |
| P2 | Fitts | pages/crm/SimulatorPage.tsx:49 | alvo de toque de 31 px em <button> | mínimo 44×44 (iOS e web) / 48×48 dp (Android): `min-h-11 min-w-11`, ou área de toque maior que o desenho (`p-2.5` ou pseudo-elemento) | `alvo-pequeno` |
| P2 | escala | pages/crm/SimulatorPage.tsx:56 | valor fora da escala (h-[31px]) | troque pelo degrau mais próximo da escala de espaço (4 8 12 16 24 32 48 64…): `p-4`, `gap-6` | `espaco-fora-escala` |
| P2 | escala | pages/crm/SimulatorPage.tsx:56 | valor fora da escala (w-[51px]) | troque pelo degrau mais próximo da escala de espaço (4 8 12 16 24 32 48 64…): `p-4`, `gap-6` | `espaco-fora-escala` |
| P2 | escala | pages/crm/SimulatorPage.tsx:62 | valor fora da escala (top-[2px]) | troque pelo degrau mais próximo da escala de espaço (4 8 12 16 24 32 48 64…): `p-4`, `gap-6` | `espaco-fora-escala` |
| P2 | escala | pages/crm/SimulatorPage.tsx:62 | valor fora da escala (h-[27px]) | troque pelo degrau mais próximo da escala de espaço (4 8 12 16 24 32 48 64…): `p-4`, `gap-6` | `espaco-fora-escala` |
| P2 | escala | pages/crm/SimulatorPage.tsx:62 | valor fora da escala (w-[27px]) | troque pelo degrau mais próximo da escala de espaço (4 8 12 16 24 32 48 64…): `p-4`, `gap-6` | `espaco-fora-escala` |
| P2 | escala | pages/crm/SimulatorPage.tsx:74 | valor fora da escala (rounded-[8px]) | troque pelo degrau mais próximo da escala de espaço (4 8 12 16 24 32 48 64…): `p-4`, `gap-6` | `espaco-fora-escala` |
| P2 | escala | pages/crm/SimulatorPage.tsx:74 | valor fora da escala (min-h-[36px]) | troque pelo degrau mais próximo da escala de espaço (4 8 12 16 24 32 48 64…): `p-4`, `gap-6` | `espaco-fora-escala` |
| P2 | escala | pages/crm/SimulatorPage.tsx:78 | valor fora da escala (rounded-[7px]) | troque pelo degrau mais próximo da escala de espaço (4 8 12 16 24 32 48 64…): `p-4`, `gap-6` | `espaco-fora-escala` |
| P2 | escala | pages/crm/SimulatorPage.tsx:78 | valor fora da escala (min-h-[44px]) | troque pelo degrau mais próximo da escala de espaço (4 8 12 16 24 32 48 64…): `p-4`, `gap-6` | `espaco-fora-escala` |
| P2 | escala | pages/crm/SimulatorPage.tsx:379 | valor fora da escala (rounded-[9px]) | troque pelo degrau mais próximo da escala de espaço (4 8 12 16 24 32 48 64…): `p-4`, `gap-6` | `espaco-fora-escala` |
| P2 | escala | pages/crm/SimulatorPage.tsx:478 | valor fora da escala (min-h-[44px]) | troque pelo degrau mais próximo da escala de espaço (4 8 12 16 24 32 48 64…): `p-4`, `gap-6` | `espaco-fora-escala` |
| P2 | clareza | pages/crm/SimulatorPage.tsx:521 | campo só com placeholder | rótulo persistente (`<label htmlFor>`): o placeholder some ao digitar e a pessoa esquece o que era (Miller) | `so-placeholder` |
| P2 | escala | pages/crm/SimulatorPage.tsx:571 | valor fora da escala (rounded-[11px]) | troque pelo degrau mais próximo da escala de espaço (4 8 12 16 24 32 48 64…): `p-4`, `gap-6` | `espaco-fora-escala` |
| P2 | Tesler | pages/crm/SimulatorPage.tsx:615 | campo numérico sem teclado numérico | `inputMode="numeric"` (ou `tel`) e máscara que aceita qualquer formato (Postel) | `teclado-numerico` |
| P2 | Tesler | pages/crm/SimulatorPage.tsx:668 | campo numérico sem teclado numérico | `inputMode="numeric"` (ou `tel`) e máscara que aceita qualquer formato (Postel) | `teclado-numerico` |
| P2 | Tesler | pages/crm/SimulatorPage.tsx:679 | campo numérico sem teclado numérico | `inputMode="numeric"` (ou `tel`) e máscara que aceita qualquer formato (Postel) | `teclado-numerico` |
| P2 | escala | pages/crm/SimulatorPage.tsx:726 | valor fora da escala (min-h-[72px]) | troque pelo degrau mais próximo da escala de espaço (4 8 12 16 24 32 48 64…): `p-4`, `gap-6` | `espaco-fora-escala` |
| P2 | Tesler | pages/crm/SimulatorPage.tsx:799 | campo numérico sem teclado numérico | `inputMode="numeric"` (ou `tel`) e máscara que aceita qualquer formato (Postel) | `teclado-numerico` |
| P2 | escala | pages/crm/SimulatorPage.tsx:834 | valor fora da escala (min-h-[56px]) | troque pelo degrau mais próximo da escala de espaço (4 8 12 16 24 32 48 64…): `p-4`, `gap-6` | `espaco-fora-escala` |
| P2 | escala | pages/crm/SimulatorPage.tsx:911 | valor fora da escala (rounded-[9px]) | troque pelo degrau mais próximo da escala de espaço (4 8 12 16 24 32 48 64…): `p-4`, `gap-6` | `espaco-fora-escala` |
| P2 | Tesler | pages/crm/SimulatorPage.tsx:956 | campo numérico sem teclado numérico | `inputMode="numeric"` (ou `tel`) e máscara que aceita qualquer formato (Postel) | `teclado-numerico` |
| P2 | escala | pages/crm/SimulatorPage.tsx:987 | valor fora da escala (min-h-[52px]) | troque pelo degrau mais próximo da escala de espaço (4 8 12 16 24 32 48 64…): `p-4`, `gap-6` | `espaco-fora-escala` |
| P2 | clareza | pages/crm/SimulatorPage.tsx:1063 | campo só com placeholder | rótulo persistente (`<label htmlFor>`): o placeholder some ao digitar e a pessoa esquece o que era (Miller) | `so-placeholder` |
| P2 | Fitts | pages/crm/SimulatorPage.tsx:1096 | alvo de toque de 20 px em <button> | mínimo 44×44 (iOS e web) / 48×48 dp (Android): `min-h-11 min-w-11`, ou área de toque maior que o desenho (`p-2.5` ou pseudo-elemento) | `alvo-pequeno` |
| P2 | escala | pages/crm/SimulatorPage.tsx:1135 | valor fora da escala (min-h-[44px]) | troque pelo degrau mais próximo da escala de espaço (4 8 12 16 24 32 48 64…): `p-4`, `gap-6` | `espaco-fora-escala` |
| P3 | escala | pages/PayableDebts.tsx:387 | tamanho de texto fora da escala (text-[28px]) | use um degrau da escala de texto do projeto | `texto-fora-escala` |
| P3 | Doherty | pages/PayableDebts.tsx:924 | <img> sem width/height nem aspect | dê `width`/`height` (ou `aspect-[4/3]`): sem eles a página pula quando a imagem chega (CLS) | `img-sem-dimensao` |
