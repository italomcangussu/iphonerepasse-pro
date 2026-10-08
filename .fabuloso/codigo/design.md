# Cardápio visual — iphonerepasse-pro
> Gerado por `fabuloso.mjs react`; não edite. Toda decisão de interface escolhe daqui: se o valor não está no cardápio, reúse o mais próximo antes de criar um novo.

Bibliotecas: tailwindcss 4 · ícones: lucide-react · movimento: framer-motion
Estilos: index.css · tailwind.config.cjs

## Tokens (variáveis CSS / @theme)
**outros** (55): crm-accent=var(--ds-color-accent) · crm-accent-soft · crm-bg · crm-brand=var(--ds-color-primary) · crm-brand-strong · crm-card-bg · crm-card-border=var(--ds-color-border) · crm-card-shadow=var(--ds-shadow-md) · crm-composer-bottom-padding · crm-input-bg · crm-ios-hit-target=44px · crm-keyboard-inset=0px · crm-mobile-composer-gap=10px · crm-mobile-composer-height=6.25rem · crm-mobile-composer-obstruction-height · crm-muted=var(--ds-color-text-muted) · crm-nav-muted=rgba(226, 232, 240, 0.62) · crm-nav-text=rgba(226, 232, 240, 0.9) · crm-sidebar-bg · crm-text=var(--ds-color-text) · crm-visual-viewport-height=100dvh · ds-color-accent=#f97316 · ds-color-accent-strong=#c2410c · ds-color-badge-blue-text · ds-color-badge-green-text=#166534 · ds-color-badge-orange-text=#9a3412 · ds-color-badge-red-text=#991b1b · ds-color-bg=#f8fafc · ds-color-bg-soft=#f1f5f9 · ds-color-border=rgba(15, 23, 42, 0.12) · ds-color-border-strong=rgba(15, 23, 42, 0.24) · ds-color-error=#dc2626 · ds-color-primary=#2563eb · ds-color-primary-soft=#60a5fa · ds-color-primary-strong=#1d4ed8 · ds-color-success=#16a34a · ds-color-surface=#ffffff · ds-color-surface-soft=#e2e8f0 · ds-color-text=#0f172a · ds-color-text-inverse=#ffffff · ds-color-text-muted=#64748b · ds-color-text-secondary=#334155 · ds-color-warning=#b45309 · ds-elevation-{0…4} · ds-gradient-hero · ds-shadow-glow · ds-shadow-lg · ds-shadow-md · ds-shadow-sm · pl-accent-emerald=#00FF94 · +5

## Tema do Tailwind (theme.extend)
**animation** (5): ios-fade · ios-scale · ios-sheet · ios-slide-up · shimmer
**borderRadius** (4): ios · ios-2xl · ios-lg · ios-xl
**boxShadow** (8): ios · ios-lg · ios-md · ios-xl · ios26-glow · ios26-lg · ios26-md · ios26-sm
**colors** (15): accent-{50…900} · brand-{50…950} · elevation-{0…4} · ios-blue · ios-gray · ios-green · ios-indigo · ios-orange · ios-pink · ios-purple · ios-red · ios-teal · ios-yellow · surface-dark · surface-light
**fontFamily** (1): sans
**fontSize** (8): ios-body · ios-callout · ios-caption · ios-footnote · ios-headline · ios-large · ios-subhead · ios-title-{1…3}
**keyframes** (10): iosFade-0% · iosFade-100% · iosScale-0% · iosScale-100% · iosSheet-0% · iosSheet-100% · iosSlideUp-0% · iosSlideUp-100% · shimmer-0% · shimmer-100%
**spacing** (6): ios · ios-2xl · ios-lg · ios-md · ios-sm · ios-xl
**transitionTimingFunction** (4): ios · ios-emphasized · ios-out · ios-spring
**zIndex** (2): 70 · 71

## Classes e utilitárias próprias
**classes** (163): animate-ios-shake · app-border · app-border-strong · app-icon-button-muted · app-page-subtitle · app-page-title · app-search-clear · app-search-icon · app-search-wrap · app-shell-bg · app-surface-soft · app-surface-soft-hover · app-table-divider · app-table-head · app-table-header · app-table-row-hover · app-text-muted · app-text-primary · app-text-secondary · crm-brand · crm-brand-lockup · crm-brand-subtitle · crm-brand-title · crm-btn · crm-btn-primary · crm-btn-secondary · crm-card · crm-chat-list-panel · crm-chat-row · crm-conversation-compact-header · crm-conversation-composer · crm-conversation-context · crm-conversation-header-avatar · crm-conversation-list · crm-conversation-list-summary · crm-conversation-messages · crm-conversation-panel · crm-conversation-shell · crm-conversation-thread · crm-desktop-data-table · crm-field-label · crm-ghost-link · crm-header-store · crm-icon-btn · crm-input · crm-input-compact · crm-layout-header · crm-layout-header-left · crm-layout-page-kicker · crm-layout-page-name · crm-layout-page-title · crm-logout-btn · crm-main · crm-main-content · crm-message-bubble · crm-message-bubble--inbound · crm-message-bubble--outbound-ai · crm-message-bubble--outbound-human · crm-message-bubble--sticker · crm-mobile-close-action · crm-mobile-composer-hint · crm-mobile-data-cell · crm-mobile-data-list · crm-mobile-data-meta · crm-mobile-data-title · crm-mobile-filter-chip · crm-mobile-more-backdrop · crm-mobile-more-grid · crm-mobile-more-handle · crm-mobile-more-header · crm-mobile-more-link · crm-mobile-more-sheet · crm-mobile-sheet-action · crm-mobile-tabbar · crm-mobile-tabbar-item · crm-nav · crm-nav-item · crm-nav-section · crm-page-header · crm-page-subtitle · +83
**keyframes** (3): detailSlideIn · ios-shake · listSlideIn

## Primitivos de UI (12)
- components/ui/AppErrorBoundary.tsx: AppErrorBoundary
- components/ui/Banner.tsx: Banner
- components/ui/Combobox.tsx: Combobox
- components/ui/ConfirmDialog.tsx: ConfirmDialog
- components/ui/DesktopContextMenu.tsx: DesktopContextMenuHost
- components/ui/IOSButton.tsx: IOSButton
- components/ui/InfoTooltip.tsx: InfoTooltip
- components/ui/Modal.tsx: Modal
- components/ui/Pagination.tsx: Pagination
- components/ui/ToastProvider.tsx: FeedbackProvider
- components/ui/ToastViewport.tsx: ToastViewport

## Movimento e helpers
**presets de movimento** (8): Stagger (components/motion/Stagger.tsx) · iosEase (components/motion/transitions.ts) · iosFastEase (components/motion/transitions.ts) · iosSheetSpring (components/motion/transitions.ts) · iosSlowEase (components/motion/transitions.ts) · iosSnappySpring (components/motion/transitions.ts) · iosSpring (components/motion/transitions.ts) · iosStagger (components/motion/transitions.ts)
**formatadores/máscaras/validadores** (49): formatBRL (lib/marketing/campaignInsights.ts) · formatBRL (lib/marketing/opportunityInsights.ts) · formatBirthdayLabel (utils/birthday.ts) · formatCnpj (utils/inputMasks.ts) · formatCpf (utils/inputMasks.ts) · formatCpfOrCnpj (utils/inputMasks.ts) · formatCurrencyBRL (utils/inputMasks.ts) · formatDateBRL (utils/inputMasks.ts) · formatDateTimeBRL (utils/inputMasks.ts) · formatDayMonth (utils/birthday.ts) · formatDays (lib/marketing/campaignInsights.ts) · formatDays (lib/marketing/opportunityInsights.ts) · formatDecimalBRL (utils/inputMasks.ts) · formatPct (lib/marketing/campaignInsights.ts) · formatPct (lib/marketing/opportunityInsights.ts) · formatPercentBRL (utils/inputMasks.ts) · formatPhone (utils/inputMasks.ts) · formatReceiptCurrency (utils/receiptPdf.ts) · formatReservationDayBR (utils/reservations.ts) · formatSaleNumber (utils/saleCode.ts) · formatSaleNumberFrom (utils/saleCode.ts) · formatScriptTemplate (lib/marketing/scriptLibrary.ts) · formatSimulatorCurrency (utils/simulator.ts) · formatSimulatorMessage (utils/simulator.ts) · formatWarrantyDevice (utils/warrantyDevice.ts) · maskCurrencyInput (utils/inputMasks.ts) · maskDecimalInput (utils/inputMasks.ts) · normalizeAICommerceSnapshot (lib/crm/aiCommerceSnapshot.ts) · normalizeAuthError (utils/authErrors.ts) · normalizeBusinessHours (utils/businessHours.ts) · normalizeCardFeeSettings (utils/cardFees.ts) · normalizeCardGroup (lib/crm/paymentRevision.ts) · normalizeDigits (utils/debts.ts) · normalizeFinancialAccount (utils/financialAccounts.ts) · normalizeName (utils/debts.ts) · normalizePhone (lib/phone.ts) · normalizeProductSearchText (utils/productSearch.ts) · normalizeSearchText (utils/saleSearch.ts) · normalizeSpecialBusinessHours (utils/businessHours.ts) · normalizeWhatsAppPhone (utils/sendReceiptWhatsApp.ts) · +9
