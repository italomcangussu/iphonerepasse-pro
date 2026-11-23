# Auditoria de abuso — 2026-11-23

Alvo: diff desde 0c49bad (5 arquivo(s)). Achado por regra é pista: confirme lendo o trecho antes de blindar.

Placar: 0 crítica(s), 0 alta(s), 36 média(s), 0 baixa(s).

```
components/marketing/ScriptsTab.tsx:69 — campo de texto sem limite de tamanho (input) — média — maxLength no campo e o mesmo limite no servidor (schema e CHECK no banco)
components/marketing/ScriptsTab.tsx:81 — campo de texto sem limite de tamanho (input) — média — maxLength no campo e o mesmo limite no servidor (schema e CHECK no banco)
components/marketing/ScriptsTab.tsx:93 — campo de texto sem limite de tamanho (input) — média — maxLength no campo e o mesmo limite no servidor (schema e CHECK no banco)
components/marketing/ScriptsTab.tsx:133 — campo de texto sem limite de tamanho (input) — média — maxLength no campo e o mesmo limite no servidor (schema e CHECK no banco)
components/StockReservationModal.tsx:350 — campo de texto sem limite de tamanho (input) — média — maxLength no campo e o mesmo limite no servidor (schema e CHECK no banco)
components/StockReservationModal.tsx:399 — campo de texto sem limite de tamanho (textarea) — média — maxLength no campo e o mesmo limite no servidor (schema e CHECK no banco)
components/StockReservationModal.tsx:436 — campo de texto sem limite de tamanho (textarea) — média — maxLength no campo e o mesmo limite no servidor (schema e CHECK no banco)
pages/crm/SimulatorPage.tsx:405 — campo de texto sem limite de tamanho (input) — média — maxLength no campo e o mesmo limite no servidor (schema e CHECK no banco)
pages/crm/SimulatorPage.tsx:429 — campo de texto sem limite de tamanho (input) — média — maxLength no campo e o mesmo limite no servidor (schema e CHECK no banco)
pages/crm/SimulatorPage.tsx:455 — campo de texto sem limite de tamanho (input) — média — maxLength no campo e o mesmo limite no servidor (schema e CHECK no banco)
pages/crm/SimulatorPage.tsx:521 — campo de texto sem limite de tamanho (input) — média — maxLength no campo e o mesmo limite no servidor (schema e CHECK no banco)
pages/crm/SimulatorPage.tsx:615 — campo de texto sem limite de tamanho (input) — média — maxLength no campo e o mesmo limite no servidor (schema e CHECK no banco)
pages/crm/SimulatorPage.tsx:626 — campo de texto sem limite de tamanho (input) — média — maxLength no campo e o mesmo limite no servidor (schema e CHECK no banco)
pages/crm/SimulatorPage.tsx:637 — campo de texto sem limite de tamanho (input) — média — maxLength no campo e o mesmo limite no servidor (schema e CHECK no banco)
pages/crm/SimulatorPage.tsx:668 — campo de texto sem limite de tamanho (input) — média — maxLength no campo e o mesmo limite no servidor (schema e CHECK no banco)
pages/crm/SimulatorPage.tsx:679 — campo de texto sem limite de tamanho (input) — média — maxLength no campo e o mesmo limite no servidor (schema e CHECK no banco)
pages/crm/SimulatorPage.tsx:693 — campo de texto sem limite de tamanho (input) — média — maxLength no campo e o mesmo limite no servidor (schema e CHECK no banco)
pages/crm/SimulatorPage.tsx:776 — campo de texto sem limite de tamanho (input) — média — maxLength no campo e o mesmo limite no servidor (schema e CHECK no banco)
pages/crm/SimulatorPage.tsx:787 — campo de texto sem limite de tamanho (input) — média — maxLength no campo e o mesmo limite no servidor (schema e CHECK no banco)
pages/crm/SimulatorPage.tsx:799 — campo de texto sem limite de tamanho (input) — média — maxLength no campo e o mesmo limite no servidor (schema e CHECK no banco)
pages/crm/SimulatorPage.tsx:810 — campo de texto sem limite de tamanho (input) — média — maxLength no campo e o mesmo limite no servidor (schema e CHECK no banco)
pages/crm/SimulatorPage.tsx:956 — campo de texto sem limite de tamanho (input) — média — maxLength no campo e o mesmo limite no servidor (schema e CHECK no banco)
pages/crm/SimulatorPage.tsx:965 — campo de texto sem limite de tamanho (input) — média — maxLength no campo e o mesmo limite no servidor (schema e CHECK no banco)
pages/crm/SimulatorPage.tsx:1063 — campo de texto sem limite de tamanho (input) — média — maxLength no campo e o mesmo limite no servidor (schema e CHECK no banco)
pages/crm/SimulatorPage.tsx:1197 — campo de texto sem limite de tamanho (input) — média — maxLength no campo e o mesmo limite no servidor (schema e CHECK no banco)
pages/crm/SimulatorPage.tsx:1229 — campo de texto sem limite de tamanho (input) — média — maxLength no campo e o mesmo limite no servidor (schema e CHECK no banco)
pages/PayableDebts.tsx:375 — exportação CSV sem escapar fórmula (=, +, -, @) — média — prefixar com apóstrofo a célula que começa com =, +, - ou @
pages/PayableDebts.tsx:424 — campo de texto sem limite de tamanho (input) — média — maxLength no campo e o mesmo limite no servidor (schema e CHECK no banco)
pages/PayableDebts.tsx:622 — campo de texto sem limite de tamanho (input) — média — maxLength no campo e o mesmo limite no servidor (schema e CHECK no banco)
pages/PayableDebts.tsx:639 — campo de texto sem limite de tamanho (input) — média — maxLength no campo e o mesmo limite no servidor (schema e CHECK no banco)
pages/PayableDebts.tsx:643 — campo de texto sem limite de tamanho (input) — média — maxLength no campo e o mesmo limite no servidor (schema e CHECK no banco)
pages/PayableDebts.tsx:648 — campo de texto sem limite de tamanho (textarea) — média — maxLength no campo e o mesmo limite no servidor (schema e CHECK no banco)
pages/PayableDebts.tsx:708 — campo de texto sem limite de tamanho (input) — média — maxLength no campo e o mesmo limite no servidor (schema e CHECK no banco)
pages/PayableDebts.tsx:755 — campo de texto sem limite de tamanho (textarea) — média — maxLength no campo e o mesmo limite no servidor (schema e CHECK no banco)
pages/PayableDebts.tsx:803 — campo de texto sem limite de tamanho (input) — média — maxLength no campo e o mesmo limite no servidor (schema e CHECK no banco)
pages/PayableDebts.tsx:840 — campo de texto sem limite de tamanho (textarea) — média — maxLength no campo e o mesmo limite no servidor (schema e CHECK no banco)
```
