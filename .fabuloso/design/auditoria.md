# Auditoria de design — iphonerepasse-pro

> 2026-11-23 15:14 · 4 arquivos · tipo pwa-standalone (web). Heurístico: confira cada item antes de corrigir. P1–P3 é a sugestão do script; P0 (tarefa bloqueada) é julgamento seu. Exceção: `design-ok <id>: motivo`.

| P | Lei / lente | Onde | Problema | Correção | Regra |
|---|---|---|---|---|---|
| P2 | Tesler | components/marketing/ScriptsTab.tsx:81 | campo numérico sem teclado numérico | `inputMode="numeric"` (ou `tel`) e máscara que aceita qualquer formato (Postel) | `teclado-numerico` |
| P2 | Tesler | pages/PayableDebts.tsx:882 | campo numérico sem teclado numérico | `inputMode="numeric"` (ou `tel`) e máscara que aceita qualquer formato (Postel) | `teclado-numerico` |
| P2 | escala | pages/crm/SimulatorPage.tsx:45 | valor fora da escala (min-h-[44px]) | troque pelo degrau mais próximo da escala de espaço (4 8 12 16 24 32 48 64…): `p-4`, `gap-6` | `espaco-fora-escala` |
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
| P2 | escala | pages/crm/SimulatorPage.tsx:572 | valor fora da escala (rounded-[11px]) | troque pelo degrau mais próximo da escala de espaço (4 8 12 16 24 32 48 64…): `p-4`, `gap-6` | `espaco-fora-escala` |
| P2 | Tesler | pages/crm/SimulatorPage.tsx:616 | campo numérico sem teclado numérico | `inputMode="numeric"` (ou `tel`) e máscara que aceita qualquer formato (Postel) | `teclado-numerico` |
| P2 | Tesler | pages/crm/SimulatorPage.tsx:669 | campo numérico sem teclado numérico | `inputMode="numeric"` (ou `tel`) e máscara que aceita qualquer formato (Postel) | `teclado-numerico` |
| P2 | Tesler | pages/crm/SimulatorPage.tsx:680 | campo numérico sem teclado numérico | `inputMode="numeric"` (ou `tel`) e máscara que aceita qualquer formato (Postel) | `teclado-numerico` |
| P2 | escala | pages/crm/SimulatorPage.tsx:727 | valor fora da escala (min-h-[72px]) | troque pelo degrau mais próximo da escala de espaço (4 8 12 16 24 32 48 64…): `p-4`, `gap-6` | `espaco-fora-escala` |
| P2 | Tesler | pages/crm/SimulatorPage.tsx:800 | campo numérico sem teclado numérico | `inputMode="numeric"` (ou `tel`) e máscara que aceita qualquer formato (Postel) | `teclado-numerico` |
| P2 | escala | pages/crm/SimulatorPage.tsx:835 | valor fora da escala (min-h-[56px]) | troque pelo degrau mais próximo da escala de espaço (4 8 12 16 24 32 48 64…): `p-4`, `gap-6` | `espaco-fora-escala` |
| P2 | escala | pages/crm/SimulatorPage.tsx:912 | valor fora da escala (rounded-[9px]) | troque pelo degrau mais próximo da escala de espaço (4 8 12 16 24 32 48 64…): `p-4`, `gap-6` | `espaco-fora-escala` |
| P2 | Tesler | pages/crm/SimulatorPage.tsx:957 | campo numérico sem teclado numérico | `inputMode="numeric"` (ou `tel`) e máscara que aceita qualquer formato (Postel) | `teclado-numerico` |
| P2 | escala | pages/crm/SimulatorPage.tsx:988 | valor fora da escala (min-h-[52px]) | troque pelo degrau mais próximo da escala de espaço (4 8 12 16 24 32 48 64…): `p-4`, `gap-6` | `espaco-fora-escala` |
| P2 | escala | pages/crm/SimulatorPage.tsx:1137 | valor fora da escala (min-h-[44px]) | troque pelo degrau mais próximo da escala de espaço (4 8 12 16 24 32 48 64…): `p-4`, `gap-6` | `espaco-fora-escala` |
| P3 | escala | pages/PayableDebts.tsx:391 | tamanho de texto fora da escala (text-[28px]) | use um degrau da escala de texto do projeto | `texto-fora-escala` |
| P3 | Doherty | pages/PayableDebts.tsx:938 | <img> sem width/height nem aspect | dê `width`/`height` (ou `aspect-[4/3]`): sem eles a página pula quando a imagem chega (CLS) | `img-sem-dimensao` |
