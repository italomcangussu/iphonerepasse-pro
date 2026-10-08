# Mapa React — iphonerepasse-pro
> Gerado por `fabuloso.mjs react`; não edite. Detalhe por tela em `telas/`. Cardápio visual em `design.md`. Imports e símbolos exatos → agentmap.

Stack: React 19 · Vite · react-router 7 · supabase-js · tailwindcss 4 · ícones: lucide-react · movimento: framer-motion
Entrada: — · Rotas declaradas em: App.tsx, components/crm/CRMStandaloneApp.tsx

## Rotas (63)
Dados: s=select i=insert u=update U=upsert d=delete.
| Rota | Tela | Layout/guardas | Dados | Detalhe |
|---|---|---|---|---|
| / | App.tsx | ProtectedLayout · ProtectedRoute | — | telas/inicio.md |
| / | pages/crm/ConversationsPage.tsx | ProtectedRoute · CRMStandaloneLayout · CRMRoleGate | ai_turn_events(s) crm_channels(s) crm_conversations(s,i,u) crm_filter_views(s,i,d) crm_leads(s,u) crm_messages(s,u) +2 · rpc crm_apply_channel_to_conversation, search_crm_messages, upsert_crm_lead · edge crm-audio-transcribe, crm-conversation-handoff, crm-delete-conversation, crm-send-message, crm-uaz-media-download, crm-uaz-message-action · bucket crm-media · realtime crm_conversations, crm_leads, crm_messages | telas/inicio-2.md |
| /admin-agent | pages/crm/AdminAgentPage.tsx | ProtectedRoute · CRMStandaloneLayout · CRMRoleGate | admin_agent_audit_log(s) admin_agent_numbers(s,i,u,d) sellers(s) user_profiles(s) | telas/admin-agent.md |
| /ads | pages/crm/AdsPage.tsx | ProtectedRoute · CRMStandaloneLayout · CRMRoleGate | rpc get_crm_ads_dashboard | telas/ads.md |
| /ai-settings | pages/crm/AISettingsPage.tsx | ProtectedRoute · CRMStandaloneLayout · CRMRoleGate | crm_ai_agent_configs(s,i,u,d) crm_ai_agent_invocations(s) crm_channels(s) | telas/ai-settings.md |
| /attendance-scripts | pages/crm/AttendanceScriptsPage.tsx | ProtectedRoute · CRMStandaloneLayout · CRMRoleGate | — | telas/attendance-scripts.md |
| /automations | pages/crm/AutomationsPage.tsx | ProtectedRoute · CRMStandaloneLayout · CRMRoleGate | — | telas/automations.md |
| /broadcasts | pages/crm/BroadcastsPage.tsx | ProtectedRoute · CRMStandaloneLayout · CRMRoleGate | — | telas/broadcasts.md |
| /calculator | pages/Calculator.tsx | ProtectedLayout · ProtectedRoute | — | telas/calculator.md |
| /cashback | pages/crm/CashbackPage.tsx | ProtectedRoute · CRMStandaloneLayout · CRMRoleGate | rpc get_cashback_summary | telas/cashback.md |
| /clients | pages/Clients.tsx | ProtectedLayout · ProtectedRoute | — | telas/clients.md |
| /comments | pages/crm/CommentsPage.tsx | ProtectedRoute · CRMStandaloneLayout · CRMRoleGate | crm_instagram_comment_events(s) | telas/comments.md |
| /conversations/:conversationId | pages/crm/ConversationsPage.tsx | ProtectedRoute · CRMStandaloneLayout · CRMRoleGate | ai_turn_events(s) crm_channels(s) crm_conversations(s,i,u) crm_filter_views(s,i,d) crm_leads(s,u) crm_messages(s,u) +2 · rpc crm_apply_channel_to_conversation, search_crm_messages, upsert_crm_lead · edge crm-audio-transcribe, crm-conversation-handoff, crm-delete-conversation, crm-send-message, crm-uaz-media-download, crm-uaz-message-action · bucket crm-media · realtime crm_conversations, crm_leads, crm_messages | telas/conversations-conversationid.md |
| /crm/admin-agent | pages/crm/AdminAgentPage.tsx | ProtectedLayout · ProtectedRoute | admin_agent_audit_log(s) admin_agent_numbers(s,i,u,d) sellers(s) user_profiles(s) | telas/crm-admin-agent.md |
| /crm/ads | pages/crm/AdsPage.tsx | ProtectedLayout | rpc get_crm_ads_dashboard | telas/crm-ads.md |
| /crm/ai-settings | pages/crm/AISettingsPage.tsx | ProtectedLayout · ProtectedRoute | crm_ai_agent_configs(s,i,u,d) crm_ai_agent_invocations(s) crm_channels(s) | telas/crm-ai-settings.md |
| /crm/attendance-scripts | pages/crm/AttendanceScriptsPage.tsx | ProtectedLayout · ProtectedRoute | — | telas/crm-attendance-scripts.md |
| /crm/automations | pages/crm/AutomationsPage.tsx | ProtectedLayout · ProtectedRoute | — | telas/crm-automations.md |
| /crm/broadcasts | pages/crm/BroadcastsPage.tsx | ProtectedLayout · ProtectedRoute | — | telas/crm-broadcasts.md |
| /crm/cashback | pages/crm/CashbackPage.tsx | ProtectedLayout · ProtectedRoute | rpc get_cashback_summary | telas/crm-cashback.md |
| /crm/channels | pages/CRMChannels.tsx | ProtectedLayout · ProtectedRoute | crm_ai_entry_settings(s,U) crm_channels(s,i,u,d) crm_funnel_stages(s) crm_funnels(s) · realtime crm_channels | telas/crm-channels.md |
| /crm/comments | pages/crm/CommentsPage.tsx | ProtectedLayout | crm_instagram_comment_events(s) | telas/crm-comments.md |
| /crm/conversations | pages/crm/ConversationsPage.tsx | ProtectedLayout | ai_turn_events(s) crm_channels(s) crm_conversations(s,i,u) crm_filter_views(s,i,d) crm_leads(s,u) crm_messages(s,u) +2 · rpc crm_apply_channel_to_conversation, search_crm_messages, upsert_crm_lead · edge crm-audio-transcribe, crm-conversation-handoff, crm-delete-conversation, crm-send-message, crm-uaz-media-download, crm-uaz-message-action · bucket crm-media · realtime crm_conversations, crm_leads, crm_messages | telas/crm-conversations.md |
| /crm/custom-fields | pages/crm/CustomFieldsPage.tsx | ProtectedLayout · ProtectedRoute | — | telas/crm-custom-fields.md |
| /crm/forms | pages/crm/FormsPage.tsx | ProtectedLayout | — | telas/crm-forms.md |
| /crm/funnels | pages/crm/FunnelsPage.tsx | ProtectedLayout | — | telas/crm-funnels.md |
| /crm/integrations | pages/crm/IntegrationsPage.tsx | ProtectedLayout · ProtectedRoute | — | telas/crm-integrations.md |
| /crm/leads | pages/crm/LeadsPage.tsx | ProtectedLayout | crm_funnel_stages(s) · rpc get_lead_full_data, mark_lead_as_customer, move_crm_lead_stage, search_leads | telas/crm-leads.md |
| /crm/settings | pages/crm/SettingsPage.tsx | ProtectedLayout · ProtectedRoute | crm_ai_entry_settings(s,U) crm_channels(s,i,u,d) crm_funnel_stages(s) crm_funnels(s) user_consents(s,u,U) · edge push-subscribe, user-account-delete, user-data-export · realtime crm_channels | telas/crm-settings.md |
| /crm/statistics | pages/crm/StatisticsPage.tsx | ProtectedLayout | rpc get_crm_statistics | telas/crm-statistics.md |
| /crm/templates | pages/crm/TemplatesPage.tsx | ProtectedLayout · ProtectedRoute | — | telas/crm-templates.md |
| /custom-fields | pages/crm/CustomFieldsPage.tsx | ProtectedRoute · CRMStandaloneLayout · CRMRoleGate | — | telas/custom-fields.md |
| /debtors | pages/Debtors.tsx | ProtectedLayout · ProtectedRoute | app_user_activity_logs(i) | telas/debtors.md |
| /finance | App.tsx | ProtectedLayout · ProtectedRoute | — | telas/finance.md |
| /forms | pages/crm/FormsPage.tsx | ProtectedRoute · CRMStandaloneLayout · CRMRoleGate | — | telas/forms.md |
| /funnels | pages/crm/FunnelsPage.tsx | ProtectedRoute · CRMStandaloneLayout · CRMRoleGate | — | telas/funnels.md |
| /in-use | pages/InUse.tsx | ProtectedLayout · ProtectedRoute | app_user_activity_logs(i) | telas/in-use.md |
| /integrations | pages/crm/IntegrationsPage.tsx | ProtectedRoute · CRMStandaloneLayout · CRMRoleGate | — | telas/integrations.md |
| /inventory | App.tsx | ProtectedLayout · ProtectedRoute | app_user_activity_logs(i) · edge send-reservation-whatsapp | telas/inventory.md |
| /leads | pages/crm/LeadsPage.tsx | ProtectedRoute · CRMStandaloneLayout · CRMRoleGate | crm_funnel_stages(s) · rpc get_lead_full_data, mark_lead_as_customer, move_crm_lead_stage, search_leads | telas/leads.md |
| /leads/:leadId | pages/crm/LeadsPage.tsx | ProtectedRoute · CRMStandaloneLayout · CRMRoleGate | crm_funnel_stages(s) · rpc get_lead_full_data, mark_lead_as_customer, move_crm_lead_stage, search_leads | telas/leads-leadid.md |
| /legacy | pages/crm/LegacyRedirectPage.tsx | — | — | telas/legacy.md |
| /legal/dados | pages/legal/DataUsage.tsx | — | — | telas/legal-dados.md |
| /legal/privacidade | pages/legal/PrivacyPolicy.tsx | — | — | telas/legal-privacidade.md |
| /legal/termos | pages/legal/TermsOfService.tsx | — | — | telas/legal-termos.md |
| /login | pages/Login.tsx | PublicOnlyRoute | — | telas/login.md |
| /marketing | pages/Marketing.tsx | ProtectedLayout · ProtectedRoute | crm_broadcast_recipients(s) crm_broadcasts(s,i) crm_leads(s) | telas/marketing.md |
| /parts-stock | pages/PartsStock.tsx | ProtectedLayout · ProtectedRoute | — | telas/parts-stock.md |
| /payable-debts | pages/PayableDebts.tsx | ProtectedLayout · ProtectedRoute | app_user_activity_logs(i) · bucket payable-debt-receipts | telas/payable-debts.md |
| /pdv | App.tsx | ProtectedLayout · ProtectedRoute | app_user_activity_logs(i) · edge send-receipt-whatsapp | telas/pdv.md |
| /pdv/nova-venda | pages/PDV.tsx | ProtectedLayout · ProtectedRoute | app_user_activity_logs(i) · edge admin-provision-user, send-receipt-whatsapp | telas/pdv-nova-venda.md |
| /profile | pages/Profile.tsx | ProtectedLayout · ProtectedRoute | — | telas/profile.md |
| /sellers | pages/Sellers.tsx | ProtectedLayout · ProtectedRoute | edge admin-provision-user | telas/sellers.md |
| /settings | pages/crm/SettingsPage.tsx | ProtectedRoute · CRMStandaloneLayout · CRMRoleGate | crm_ai_entry_settings(s,U) crm_channels(s,i,u,d) crm_funnel_stages(s) crm_funnels(s) user_consents(s,u,U) · edge push-subscribe, user-account-delete, user-data-export · realtime crm_channels | telas/settings.md |
| /settings | pages/Settings.tsx | ProtectedLayout · ProtectedRoute | app_user_activity_logs(s) user_access_roles(s) user_consents(s,u,U) · edge admin-manage-user, admin-provision-user, push-subscribe, user-account-delete, user-data-export | telas/settings-2.md |
| /settings/card-fees | pages/CardFeesSettings.tsx | ProtectedLayout · ProtectedRoute | — | telas/settings-card-fees.md |
| /simulator | pages/crm/SimulatorPage.tsx | ProtectedRoute · CRMStandaloneLayout · CRMRoleGate | — | telas/simulator.md |
| /statistics | pages/crm/StatisticsPage.tsx | ProtectedRoute · CRMStandaloneLayout · CRMRoleGate | rpc get_crm_statistics | telas/statistics.md |
| /stores | pages/Stores.tsx | ProtectedLayout · ProtectedRoute | — | telas/stores.md |
| /templates | pages/crm/TemplatesPage.tsx | ProtectedRoute · CRMStandaloneLayout · CRMRoleGate | — | telas/templates.md |
| /warranties | pages/Warranties.tsx | ProtectedLayout · ProtectedRoute | app_user_activity_logs(i) sales(u) · edge warranty-link-create | telas/warranties.md |
| /warranties/:cpf | pages/PublicWarranty.tsx | — | app_user_activity_logs(i) · edge warranty-public | telas/warranties-cpf.md |
| /warranty/:token | pages/PublicWarranty.tsx | — | app_user_activity_logs(i) · edge warranty-public | telas/warranty-token.md |

## Providers e contexts (7)
| Context | Arquivo | Provider | Montado em | Hook de acesso | Consumidores |
|---|---|---|---|---|---|
| AuthContext | contexts/AuthContext.tsx | AuthProvider | App.tsx | useAuth | 19 |
| CRMStoreContext | components/crm/useCRMStore.ts | — | — | useCRMStore | 7 |
| DataContext | services/dataContext.tsx | DataProvider | App.tsx, components/crm/CRMStandaloneApp.tsx | useData | 31 |
| FeedbackContext | components/ui/ToastProvider.tsx | FeedbackProvider | — | useFeedback | 1 |
| PageHeaderContext | contexts/PageHeaderContext.tsx | PageHeaderProvider | components/Layout.tsx | usePageHeader | 3 |
| PermissionsContext | contexts/PermissionsContext.tsx | PermissionsProvider | App.tsx | usePermissions | 5 |
| ThemeContext | contexts/ThemeContext.tsx | ThemeProvider | index.tsx | useTheme | 6 |

## Stores (0)
_nenhum_

## Hooks próprios (37)
| Hook | Arquivo | Dados | Usado por |
|---|---|---|---|
| useToast | components/ui/ToastProvider.tsx | — | 33 |
| useData | services/dataContext.tsx | — | 30 |
| useAsyncHandler | hooks/useAsyncHandler.ts | — | 20 |
| useAuth | contexts/AuthContext.tsx | — | 18 |
| useDisclosure | hooks/useDisclosure.ts | — | 17 |
| useCRMStore | components/crm/useCRMStore.ts | — | 6 |
| useSalesHistoryDemand | hooks/useDataGroupDemand.ts | — | 6 |
| useChartTheme | hooks/useChartTheme.ts | — | 5 |
| useDesktopContextMenu | hooks/useDesktopContextMenu.tsx | — | 5 |
| useFinanceDemand | hooks/useDataGroupDemand.ts | — | 5 |
| useIsMobileViewport | hooks/useIsMobileViewport.ts | — | 5 |
| useTheme | contexts/ThemeContext.tsx | — | 5 |
| usePermissions | contexts/PermissionsContext.tsx | — | 4 |
| useConsents | hooks/useConsents.ts | user_consents(s,u,U) | 3 |
| useDialogA11y | hooks/useDialogA11y.ts | — | 3 |
| usePushNotifications | hooks/usePushNotifications.ts | edge push-subscribe | 3 |
| useOnlineStatus | hooks/useOnlineStatus.ts | — | 2 |
| usePageHeader | contexts/PageHeaderContext.tsx | — | 2 |
| usePaginatedRows | hooks/usePaginatedRows.ts | — | 2 |
| useReceiptPrint | hooks/useReceiptPrint.ts | — | 2 |
| useTradeInDrafts | hooks/useTradeInDrafts.ts | — | 2 |
| useConversationDrafts | components/crm/useConversationDrafts.ts | — | 1 |
| useCRMUnreadCount | hooks/useCRMUnreadCount.ts | crm_conversations(s) · realtime crm_conversations | 1 |
| useDataRealtime | services/data/useDataRealtime.ts | — | 1 |
| useListboxPosition | components/ui/useListboxPosition.ts | — | 1 |
| useMessagesPagination | hooks/useMessagesPagination.ts | crm_messages(s) · realtime crm_messages | 1 |
| usePermissionState | hooks/usePermissionState.ts | — | 1 |
| useReceiptLogo | utils/receiptLogo.ts | — | 1 |
| useStockPhotoQueue | components/stock-form/useStockPhotoQueue.ts | — | 1 |
| useThermalPrinter | utils/thermalPrinter.ts | — | 1 |
| useTranscriber | hooks/useTranscriber.ts | edge crm-audio-transcribe | 1 |
| useAuth | screenshots/mocks/AuthContext.tsx | — | 0 |
| useData | screenshots/mocks/dataContext.tsx | — | 0 |
| useFeedback | components/ui/ToastProvider.tsx | — | 0 |
| useFeedback | screenshots/mocks/ToastProvider.tsx | — | 0 |
| useIsMobile | components/ui/Modal.tsx | — | 0 |
| useToast | screenshots/mocks/ToastProvider.tsx | — | 0 |

## Componentes compartilhados (25 mais usados)
| Componente | Arquivo | Usado por |
|---|---|---|
| Modal (ui) | components/ui/Modal.tsx | 24 |
| CRMPageFrame | components/crm/CRMPageFrame.tsx | 10 |
| CRMSimpleCrud | components/crm/CRMSimpleCrud.tsx | 9 |
| IOSButton (ui) | components/ui/IOSButton.tsx | 8 |
| ConfirmDialog (ui) | components/ui/ConfirmDialog.tsx | 7 |
| Combobox (ui) | components/ui/Combobox.tsx | 5 |
| DesktopContextMenuHost (ui) | components/ui/DesktopContextMenu.tsx | 5 |
| PermissionRequest | components/pwa/PermissionRequest.tsx | 5 |
| StableResponsiveContainer | components/charts/StableResponsiveContainer.tsx | 5 |
| BrandLogo | components/BrandLogo.tsx | 4 |
| Banner (ui) | components/ui/Banner.tsx | 3 |
| CRMAvatarContent | components/crm/CRMAvatarContent.tsx | 3 |
| ObservationsList | components/ObservationsList.tsx | 3 |
| Pagination (ui) | components/ui/Pagination.tsx | 3 |
| AddCustomerModal | components/AddCustomerModal.tsx | 2 |
| AdminAgentPage | pages/crm/AdminAgentPage.tsx | 2 |
| AdsPage | pages/crm/AdsPage.tsx | 2 |
| AISettingsPage | pages/crm/AISettingsPage.tsx | 2 |
| AttendanceScriptsPage | pages/crm/AttendanceScriptsPage.tsx | 2 |
| AutomationsPage | pages/crm/AutomationsPage.tsx | 2 |
| BroadcastsPage | pages/crm/BroadcastsPage.tsx | 2 |
| CashbackPage | pages/crm/CashbackPage.tsx | 2 |
| CommentsPage | pages/crm/CommentsPage.tsx | 2 |
| ConversationsPage | pages/crm/ConversationsPage.tsx | 2 |
| ConversationWorkspaceState | components/crm/ConversationWorkspaceState.tsx | 2 |

## Alertas (16)
- Acesso a dados direto no componente: `BroadcastModal` (components/marketing/CampaignsTab.tsx:151) chama crm_broadcasts; o padrão do projeto é passar por hook/serviço
- Acesso a dados direto no componente: `CampaignsTab` (components/marketing/CampaignsTab.tsx:369) chama crm_broadcasts, crm_broadcast_recipients, crm_leads; o padrão do projeto é passar por hook/serviço
- Acesso a dados direto no componente: `AuthProvider` (contexts/AuthContext.tsx:42) chama user_profiles, user_access_roles; o padrão do projeto é passar por hook/serviço
- Acesso a dados direto no componente: `PermissionsProvider` (contexts/PermissionsContext.tsx:62) chama app_role_permissions; o padrão do projeto é passar por hook/serviço
- Acesso a dados direto no componente: `CRMChannels` (pages/CRMChannels.tsx:288) chama crm_channels, crm_ai_entry_settings, crm_funnels, crm_funnel_stages; o padrão do projeto é passar por hook/serviço
- Acesso a dados direto no componente: `CRMLeads` (pages/CRMLeads.tsx:160) chama crm_funnel_stages, search_leads, get_lead_full_data, mark_lead_as_customer, move_crm_lead_stage; o padrão do projeto é passar por hook/serviço
- Acesso a dados direto no componente: `Settings` (pages/Settings.tsx:365) chama user_access_roles, app_user_activity_logs; o padrão do projeto é passar por hook/serviço
- Acesso a dados direto no componente: `Warranties` (pages/Warranties.tsx:529) chama sales; o padrão do projeto é passar por hook/serviço
- Acesso a dados direto no componente: `AISettingsPage` (pages/crm/AISettingsPage.tsx:129) chama crm_ai_agent_configs, crm_channels, crm_ai_agent_invocations; o padrão do projeto é passar por hook/serviço
- Acesso a dados direto no componente: `AdminAgentPage` (pages/crm/AdminAgentPage.tsx:72) chama admin_agent_numbers, user_profiles, sellers, admin_agent_audit_log; o padrão do projeto é passar por hook/serviço
- Acesso a dados direto no componente: `AdsPage` (pages/crm/AdsPage.tsx:245) chama get_crm_ads_dashboard; o padrão do projeto é passar por hook/serviço
- Acesso a dados direto no componente: `CashbackPage` (pages/crm/CashbackPage.tsx:26) chama get_cashback_summary; o padrão do projeto é passar por hook/serviço
- Acesso a dados direto no componente: `CommentsPage` (pages/crm/CommentsPage.tsx:127) chama crm_instagram_comment_events; o padrão do projeto é passar por hook/serviço
- Acesso a dados direto no componente: `ConversationsPage` (pages/crm/ConversationsPage.tsx:459) chama crm_channels, user_access_roles, crm_conversations, crm_leads, crm_messages, lead_state, ai_turn_events, crm_filter_views, upsert_crm_lead, crm_apply_channel_to_conversation, search_crm_messages; o padrão do projeto é passar por hook/serviço
- Acesso a dados direto no componente: `StatisticsPage` (pages/crm/StatisticsPage.tsx:72) chama get_crm_statistics; o padrão do projeto é passar por hook/serviço
- Acesso a dados direto no componente: `DataProvider` (services/dataContext.tsx:519) chama business_profile, card_fee_settings, reservation_message_settings, crm_ai_entry_settings, simulator_trade_in_values, simulator_trade_in_adjustments, stores, customers, sellers, debts, debt_payments, stock_items, costs, stock_reservations, device_catalog, parts_inventory, cost_history, finance_categories, creditors, payable_debts, payable_debt_payments, sales, transactions, resolve_crm_default_store_id, reserve_stock_item, release_stock_reservation, delete_debt_cascade, transfer_between_accounts, cancel_transaction, remove_stock_item_cost, create_sale_full, update_sale_full, cancel_sale; o padrão do projeto é passar por hook/serviço
