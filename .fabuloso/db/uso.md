# Uso do banco pelo código
> Gerado por `fabuloso.mjs react`; não edite. Front = app; edge = supabase/functions. Schema, RLS e gatilhos → `indice.md` e `tabelas/`.

## Tabelas (66)
| Tabela | Operações | Front (arquivos) | Edge (arquivos) | Telas |
|---|---|---|---|---|
| account_deletion_requests | select, insert, update | 0 | 2 | 0 |
| admin_agent_audit_log | select, insert | 1 | 1 | 2 |
| admin_agent_numbers | select, insert, update, delete | 1 | 1 | 2 |
| ai_turn_events | select | 1 | 0 | 3 |
| app_role_permissions | select, upsert | 1 | 0 | 0 |
| app_user_activity_logs | select, insert | 2 | 1 | 10 |
| business_profile | select, upsert | 2 | 2 | 0 |
| card_fee_settings | select, upsert | 2 | 1 | 0 |
| care_benefits | select, insert, update | 1 | 0 | 1 |
| care_condition_rules | select, update | 1 | 0 | 1 |
| care_contract_documents | select, update | 0 | 3 | 0 |
| care_contracts | select | 1 | 1 | 3 |
| care_model_rule_bonuses | select, insert, delete | 1 | 0 | 1 |
| care_model_rules | select, insert, update | 1 | 0 | 1 |
| care_service_requests | select | 1 | 0 | 1 |
| care_settings | select, update | 1 | 1 | 1 |
| care_signature_events | select, insert | 0 | 2 | 0 |
| care_signature_sessions | select, update | 0 | 1 | 0 |
| cost_history | select, insert, update | 2 | 0 | 0 |
| costs | select, insert, delete | 2 | 0 | 0 |
| creditors | select, insert, update, delete | 2 | 0 | 0 |
| crm_ai_agent_configs | select, insert, update, delete | 1 | 2 | 2 |
| crm_ai_agent_invocations | select, insert | 1 | 2 | 2 |
| crm_ai_entry_settings | select, upsert | 3 | 2 | 3 |
| crm_auth_handoffs | select, insert, update | 0 | 1 | 0 |
| crm_broadcast_recipients | select, insert, update | 1 | 1 | 1 |
| crm_broadcasts | select, insert, update | 1 | 1 | 1 |
| crm_channels | select, insert, update, delete | 3 | 17 | 8 |
| crm_conversations | select, insert, update | 2 | 16 | 3 |
| crm_custom_fields | select | 0 | 1 | 0 |
| crm_event_log | select, insert, update | 0 | 6 | 0 |
| crm_filter_views | select, insert, delete | 1 | 0 | 3 |
| crm_funnel_stages | select | 2 | 0 | 6 |
| crm_funnels | select | 1 | 0 | 3 |
| crm_instagram_comment_events | select | 1 | 0 | 2 |
| crm_lead_identities | upsert | 0 | 1 | 0 |
| crm_leads | select, update, delete | 2 | 16 | 4 |
| crm_messages | select, insert, update, delete | 2 | 10 | 3 |
| crm_public_registration_links | select, update | 0 | 1 | 0 |
| crm_scheduled_messages | select, insert, update | 0 | 2 | 0 |
| crm_webhook_subscriptions | select, update | 0 | 1 | 0 |
| customers | select, insert, update, delete | 2 | 3 | 0 |
| debt_payments | select, insert, delete | 2 | 0 | 0 |
| debts | select, insert, update | 2 | 1 | 0 |
| device_catalog | select, insert | 3 | 1 | 1 |
| finance_categories | select, insert, update, delete | 2 | 1 | 0 |
| lead_state | select, delete | 1 | 2 | 3 |
| parts_inventory | select, insert, update, delete | 2 | 0 | 0 |
| payable_debt_payments | select, insert, delete | 2 | 0 | 0 |
| payable_debts | select, insert, update, delete | 2 | 1 | 0 |
| pdv_quotes | select, insert, update | 1 | 0 | 2 |
| push_subscriptions | select, update, upsert | 0 | 4 | 0 |
| reservation_message_settings | select, upsert | 2 | 0 | 0 |
| sale_items | select | 0 | 1 | 0 |
| sales | select, update | 3 | 4 | 1 |
| sellers | select, insert, update, delete | 3 | 6 | 2 |
| simulator_trade_in_adjustments | select, update, upsert, delete | 2 | 1 | 0 |
| simulator_trade_in_values | select, update, upsert, delete | 2 | 1 | 0 |
| stock_items | select, insert, update, delete | 2 | 3 | 0 |
| stock_reservations | select, update | 2 | 1 | 0 |
| stores | select, insert, update, delete | 2 | 0 | 0 |
| transactions | select, insert, update | 2 | 1 | 0 |
| user_access_roles | select, update, upsert | 3 | 4 | 4 |
| user_consents | select, update, upsert | 1 | 1 | 2 |
| user_profiles | select, insert, update | 2 | 7 | 2 |
| warranty_public_tokens | select, update | 0 | 1 | 0 |

### account_deletion_requests
- select [edge]: supabase/functions/user-account-delete/index.ts:33, supabase/functions/user-account-delete/index.ts:59, supabase/functions/user-data-export/index.ts:77
- insert [edge]: supabase/functions/user-account-delete/index.ts:78
- update [edge]: supabase/functions/user-account-delete/index.ts:43

### admin_agent_audit_log
- select: pages/crm/AdminAgentPage.tsx:75
- insert [edge]: supabase/functions/_shared/admin_agent/runner.ts:93
- telas: /admin-agent, /crm/admin-agent

### admin_agent_numbers
- select: pages/crm/AdminAgentPage.tsx:72
- select [edge]: supabase/functions/_shared/admin_agent/identity.ts:24
- insert: pages/crm/AdminAgentPage.tsx:110
- update: pages/crm/AdminAgentPage.tsx:135
- delete: pages/crm/AdminAgentPage.tsx:146
- telas: /admin-agent, /crm/admin-agent

### ai_turn_events
- select: pages/crm/ConversationsPage.tsx:649
- telas: /, /conversations/:conversationId, /crm/conversations

### app_role_permissions
- select: contexts/PermissionsContext.tsx:80
- upsert: contexts/PermissionsContext.tsx:133

### app_user_activity_logs
- select: pages/Settings.tsx:575
- select [edge]: supabase/functions/user-data-export/index.ts:57
- insert: services/telemetry.ts:72
- telas: /debtors, /in-use, /inventory, /payable-debts, /pdv, /pdv/nova-venda, /settings, /warranties, /warranties/:cpf, /warranty/:token

### business_profile
- select: services/data/dataLoaders.ts:73, services/dataContext.tsx:524
- select [edge]: supabase/functions/_shared/care/repository.ts:109, supabase/functions/warranty-public/index.ts:98
- upsert: services/dataContext.tsx:1680

### card_fee_settings
- select: services/data/dataLoaders.ts:74, services/dataContext.tsx:525
- select [edge]: supabase/functions/crm-simulator-quote/index.ts:426
- upsert: services/dataContext.tsx:1719

### care_benefits
- select: services/careApi.ts:222
- insert: services/careApi.ts:228
- update: services/careApi.ts:227
- telas: /care

### care_condition_rules
- select: services/careApi.ts:189
- update: services/careApi.ts:194
- telas: /care

### care_contract_documents
- select [edge]: supabase/functions/_shared/care/repository.ts:40, supabase/functions/care-contract/index.ts:55, supabase/functions/care-sign-public/index.ts:355
- update [edge]: supabase/functions/_shared/care/repository.ts:258

### care_contracts
- select: services/careApi.ts:148, services/careApi.ts:79, services/careApi.ts:83
- select [edge]: supabase/functions/_shared/care/repository.ts:30
- telas: /care, /pdv, /pdv/nova-venda

### care_model_rule_bonuses
- select: services/careApi.ts:198
- insert: services/careApi.ts:216
- delete: services/careApi.ts:214
- telas: /care

### care_model_rules
- select: services/careApi.ts:198
- insert: services/careApi.ts:212
- update: services/careApi.ts:211
- telas: /care

### care_service_requests
- select: services/careApi.ts:148
- telas: /care

### care_settings
- select: services/careApi.ts:232
- select [edge]: supabase/functions/_shared/care/repository.ts:53
- update: services/careApi.ts:235
- telas: /care

### care_signature_events
- select [edge]: supabase/functions/_shared/care/repository.ts:172, supabase/functions/care-sign-public/index.ts:107
- insert [edge]: supabase/functions/_shared/care/repository.ts:58

### care_signature_sessions
- select [edge]: supabase/functions/care-sign-public/index.ts:59
- update [edge]: supabase/functions/care-sign-public/index.ts:176, supabase/functions/care-sign-public/index.ts:224, supabase/functions/care-sign-public/index.ts:271, supabase/functions/care-sign-public/index.ts:80

### cost_history
- select: services/data/dataLoaders.ts:125, services/dataContext.tsx:2787, services/dataContext.tsx:547
- insert: services/dataContext.tsx:2778
- update: services/dataContext.tsx:2773

### costs
- select: services/data/dataLoaders.ts:82, services/dataContext.tsx:1887, services/dataContext.tsx:2806, services/dataContext.tsx:2961, services/dataContext.tsx:3337, services/dataContext.tsx:539
- insert: services/dataContext.tsx:1879, services/dataContext.tsx:2797, services/dataContext.tsx:2934
- delete: services/dataContext.tsx:2954

### creditors
- select: services/data/dataLoaders.ts:128, services/dataContext.tsx:550
- insert: services/dataContext.tsx:3374
- update: services/dataContext.tsx:3401
- delete: services/dataContext.tsx:3409

### crm_ai_agent_configs
- select: pages/crm/AISettingsPage.tsx:129
- select [edge]: supabase/functions/crm-ai-agent-test-endpoint/index.ts:40, supabase/functions/crm-ai-inbound/index.ts:238
- insert: pages/crm/AISettingsPage.tsx:202
- update: pages/crm/AISettingsPage.tsx:200
- update [edge]: supabase/functions/crm-ai-agent-test-endpoint/index.ts:93, supabase/functions/crm-ai-inbound/index.ts:369
- delete: pages/crm/AISettingsPage.tsx:223
- telas: /ai-settings, /crm/ai-settings

### crm_ai_agent_invocations
- select: pages/crm/AISettingsPage.tsx:140
- insert [edge]: supabase/functions/crm-ai-agent-test-endpoint/index.ts:79, supabase/functions/crm-ai-inbound/index.ts:377
- telas: /ai-settings, /crm/ai-settings

### crm_ai_entry_settings
- select: pages/CRMChannels.tsx:293, services/data/dataLoaders.ts:76, services/dataContext.tsx:527
- select [edge]: supabase/functions/_shared/crm_ai_entry_engine.ts:58, supabase/functions/_shared/crm_ai_routing.ts:74
- upsert: pages/CRMChannels.tsx:421, services/dataContext.tsx:1694
- telas: /crm/channels, /crm/settings, /settings

### crm_auth_handoffs
- select [edge]: supabase/functions/crm-auth-handoff/index.ts:124
- insert [edge]: supabase/functions/crm-auth-handoff/index.ts:85
- update [edge]: supabase/functions/crm-auth-handoff/index.ts:135

### crm_broadcast_recipients
- select: components/marketing/CampaignsTab.tsx:377
- select [edge]: supabase/functions/crm-broadcast-worker/index.ts:155, supabase/functions/crm-broadcast-worker/index.ts:290, supabase/functions/crm-broadcast-worker/index.ts:72
- insert [edge]: supabase/functions/crm-broadcast-worker/index.ts:141
- update [edge]: supabase/functions/crm-broadcast-worker/index.ts:250, supabase/functions/crm-broadcast-worker/index.ts:280
- telas: /marketing

### crm_broadcasts
- select: components/marketing/CampaignsTab.tsx:369
- select [edge]: supabase/functions/crm-broadcast-worker/index.ts:38
- insert: components/marketing/CampaignsTab.tsx:151
- update [edge]: supabase/functions/crm-broadcast-worker/index.ts:111, supabase/functions/crm-broadcast-worker/index.ts:118, supabase/functions/crm-broadcast-worker/index.ts:146, supabase/functions/crm-broadcast-worker/index.ts:163, supabase/functions/crm-broadcast-worker/index.ts:297, supabase/functions/crm-broadcast-worker/index.ts:60, supabase/functions/crm-broadcast-worker/index.ts:67, supabase/functions/crm-broadcast-worker/index.ts:82
- telas: /marketing

### crm_channels
- select: pages/CRMChannels.tsx:288, pages/CRMChannels.tsx:337, pages/CRMChannels.tsx:483, pages/crm/AISettingsPage.tsx:134, pages/crm/ConversationsPage.tsx:459, pages/crm/ConversationsPage.tsx:514
- select [edge]: supabase/functions/_shared/care/whatsapp.ts:20, supabase/functions/_shared/care/whatsapp.ts:32, supabase/functions/_shared/crm_ai_inbound_dispatch.ts:231, supabase/functions/_shared/crm_ai_routing.ts:69, supabase/functions/_shared/uazAvatarJobs.ts:88, supabase/functions/care-contract/index.ts:97, supabase/functions/crm-broadcast-worker/index.ts:211, supabase/functions/crm-conversation-handoff/index.ts:120, supabase/functions/crm-instagram-webhook-receiver/index.ts:125, supabase/functions/crm-instagram-webhook-receiver/index.ts:139, supabase/functions/crm-scheduled-messages-worker/index.ts:118, supabase/functions/crm-send-message/index.ts:364 +13
- insert: pages/CRMChannels.tsx:547
- update: pages/CRMChannels.tsx:545, pages/CRMChannels.tsx:618
- update [edge]: supabase/functions/crm-uaz-instance-admin/index.ts:143, supabase/functions/crm-uaz-webhook-receiver/index.ts:608
- delete: pages/CRMChannels.tsx:636
- telas: /, /ai-settings, /conversations/:conversationId, /crm/ai-settings, /crm/channels, /crm/conversations, /crm/settings, /settings

### crm_conversations
- select: hooks/useCRMUnreadCount.ts:5, pages/crm/ConversationsPage.tsx:1287, pages/crm/ConversationsPage.tsx:514
- select [edge]: supabase/functions/_shared/crm_ai_entry_engine.ts:67, supabase/functions/_shared/crm_ai_inbound_dispatch.ts:226, supabase/functions/_shared/crm_ai_routing.ts:88, supabase/functions/crm-ai-inbound/index.ts:153, supabase/functions/crm-broadcast-worker/index.ts:179, supabase/functions/crm-conversation-handoff/index.ts:100, supabase/functions/crm-delete-conversation/index.ts:41, supabase/functions/crm-delete-conversation/index.ts:52, supabase/functions/crm-instagram-webhook-receiver/index.ts:283, supabase/functions/crm-scheduled-messages-worker/index.ts:76, supabase/functions/crm-send-message/index.ts:321, supabase/functions/crm-send-message/index.ts:398 +5
- insert: pages/crm/ConversationsPage.tsx:1291
- insert [edge]: supabase/functions/crm-broadcast-worker/index.ts:191, supabase/functions/crm-instagram-webhook-receiver/index.ts:295, supabase/functions/crm-scheduled-messages-worker/index.ts:88, supabase/functions/crm-send-message/index.ts:413, supabase/functions/crm-uaz-webhook-receiver/index.ts:877
- update: pages/crm/ConversationsPage.tsx:1607, pages/crm/ConversationsPage.tsx:583
- update [edge]: supabase/functions/_shared/crm_ai_entry_engine.ts:97, supabase/functions/_shared/crm_ai_routing.ts:147, supabase/functions/care-contract/index.ts:140, supabase/functions/crm-ai-inbound/index.ts:357, supabase/functions/crm-ai-inbound/index.ts:55, supabase/functions/crm-conversation-handoff/index.ts:202, supabase/functions/crm-conversation-handoff/index.ts:341, supabase/functions/crm-uaz-webhook-receiver/index.ts:1034, supabase/functions/crm-uaz-webhook-receiver/index.ts:1094, supabase/functions/crm-uaz-webhook-receiver/index.ts:896, supabase/functions/crm-uaz-webhook-receiver/index.ts:903, supabase/functions/send-receipt-whatsapp/index.ts:211 +1
- telas: /, /conversations/:conversationId, /crm/conversations

### crm_custom_fields
- select [edge]: supabase/functions/lead-form-public/index.ts:117, supabase/functions/lead-form-public/index.ts:56

### crm_event_log
- select [edge]: supabase/functions/_shared/crm_ai_inbound_dispatch.ts:267, supabase/functions/crm-event-publisher/index.ts:45
- insert [edge]: supabase/functions/_shared/crm.ts:145, supabase/functions/_shared/crm_ai_inbound_dispatch.ts:53, supabase/functions/_shared/crm_ai_routing.ts:47, supabase/functions/crm-n8n-api/index.ts:96, supabase/functions/push-send/index.ts:633
- update [edge]: supabase/functions/crm-event-publisher/index.ts:118, supabase/functions/crm-event-publisher/index.ts:147

### crm_filter_views
- select: pages/crm/ConversationsPage.tsx:738
- insert: pages/crm/ConversationsPage.tsx:758
- delete: pages/crm/ConversationsPage.tsx:773
- telas: /, /conversations/:conversationId, /crm/conversations

### crm_funnel_stages
- select: pages/CRMChannels.tsx:317, pages/CRMLeads.tsx:160
- telas: /crm/channels, /crm/leads, /crm/settings, /leads, /leads/:leadId, /settings

### crm_funnels
- select: pages/CRMChannels.tsx:310
- telas: /crm/channels, /crm/settings, /settings

### crm_instagram_comment_events
- select: pages/crm/CommentsPage.tsx:127
- telas: /comments, /crm/comments

### crm_lead_identities
- upsert [edge]: supabase/functions/crm-instagram-webhook-receiver/index.ts:268

### crm_leads
- select: components/marketing/CampaignsTab.tsx:384, pages/crm/ConversationsPage.tsx:514
- select [edge]: supabase/functions/_shared/crm_ai_entry_engine.ts:78, supabase/functions/_shared/crm_ai_inbound_dispatch.ts:299, supabase/functions/_shared/uazLeadAvatar.ts:329, supabase/functions/crm-ai-inbound/index.ts:153, supabase/functions/crm-broadcast-worker/index.ts:96, supabase/functions/crm-conversation-handoff/index.ts:137, supabase/functions/crm-delete-conversation/index.ts:94, supabase/functions/crm-n8n-api/index.ts:194, supabase/functions/crm-n8n-api/index.ts:28, supabase/functions/crm-scheduled-messages-worker/index.ts:106, supabase/functions/crm-send-message/index.ts:342, supabase/functions/crm-uaz-message-action/index.ts:89 +1
- update: pages/crm/ConversationsPage.tsx:1611
- update [edge]: supabase/functions/_shared/crm_ai_routing.ts:156, supabase/functions/_shared/uazLeadAvatar.ts:361, supabase/functions/_shared/uazLeadAvatar.ts:387, supabase/functions/_shared/uazLeadAvatar.ts:432, supabase/functions/_shared/uazLeadAvatar.ts:471, supabase/functions/crm-ai-inbound/index.ts:276, supabase/functions/crm-ai-inbound/index.ts:59, supabase/functions/crm-conversation-handoff/index.ts:213, supabase/functions/crm-uaz-webhook-receiver/index.ts:1053, supabase/functions/lead-form-public/index.ts:105, supabase/functions/send-receipt-whatsapp/index.ts:216, supabase/functions/send-reservation-whatsapp/index.ts:154
- delete [edge]: supabase/functions/crm-delete-conversation/index.ts:105
- telas: /, /conversations/:conversationId, /crm/conversations, /marketing

### crm_messages
- select: hooks/useMessagesPagination.ts:111, hooks/useMessagesPagination.ts:146, hooks/useMessagesPagination.ts:77, pages/crm/ConversationsPage.tsx:530, pages/crm/ConversationsPage.tsx:566
- select [edge]: supabase/functions/_shared/crm_ai_inbound_dispatch.ts:146, supabase/functions/_shared/crm_ai_inbound_dispatch.ts:79, supabase/functions/crm-admin-agent/index.ts:74, supabase/functions/crm-conversation-handoff/index.ts:143, supabase/functions/crm-uaz-media-download/index.ts:63, supabase/functions/crm-uaz-webhook-receiver/index.ts:647, supabase/functions/crm-uaz-webhook-receiver/index.ts:978
- insert [edge]: supabase/functions/crm-broadcast-worker/index.ts:226, supabase/functions/crm-instagram-webhook-receiver/index.ts:362, supabase/functions/crm-scheduled-messages-worker/index.ts:138, supabase/functions/crm-send-message/index.ts:491, supabase/functions/crm-uaz-webhook-receiver/index.ts:970
- update: pages/crm/ConversationsPage.tsx:1181, pages/crm/ConversationsPage.tsx:1206, pages/crm/ConversationsPage.tsx:584
- update [edge]: supabase/functions/crm-send-message/index.ts:542, supabase/functions/crm-send-message/index.ts:575, supabase/functions/crm-uaz-media-download/index.ts:192, supabase/functions/crm-uaz-webhook-receiver/index.ts:1116, supabase/functions/crm-uaz-webhook-receiver/index.ts:368, supabase/functions/crm-uaz-webhook-receiver/index.ts:694
- delete [edge]: supabase/functions/crm-delete-conversation/index.ts:66, supabase/functions/crm-delete-conversation/index.ts:76
- telas: /, /conversations/:conversationId, /crm/conversations

### crm_public_registration_links
- select [edge]: supabase/functions/lead-form-public/index.ts:38, supabase/functions/lead-form-public/index.ts:80
- update [edge]: supabase/functions/lead-form-public/index.ts:144

### crm_scheduled_messages
- select [edge]: supabase/functions/crm-scheduled-messages-worker/index.ts:50
- insert [edge]: supabase/functions/crm-n8n-api/index.ts:203
- update [edge]: supabase/functions/crm-scheduled-messages-worker/index.ts:160, supabase/functions/crm-scheduled-messages-worker/index.ts:23

### crm_webhook_subscriptions
- select [edge]: supabase/functions/crm-event-publisher/index.ts:65
- update [edge]: supabase/functions/crm-event-publisher/index.ts:130, supabase/functions/crm-event-publisher/index.ts:157, supabase/functions/crm-event-publisher/index.ts:170

### customers
- select: services/data/dataLoaders.ts:80, services/dataContext.tsx:2130, services/dataContext.tsx:531
- select [edge]: supabase/functions/_shared/admin_agent/operations.ts:220, supabase/functions/_shared/admin_agent/operations.ts:429, supabase/functions/_shared/admin_agent/operations.ts:516, supabase/functions/_shared/admin_agent/operations.ts:625, supabase/functions/_shared/admin_agent/operations.ts:634, supabase/functions/_shared/admin_agent/operations.ts:933, supabase/functions/warranty-link-create/index.ts:98, supabase/functions/warranty-public/index.ts:155, supabase/functions/warranty-public/index.ts:222
- insert: services/dataContext.tsx:2093, services/dataContext.tsx:2153
- update: services/dataContext.tsx:2111
- delete: services/dataContext.tsx:2122

### debt_payments
- select: services/data/dataLoaders.ts:121, services/dataContext.tsx:1589, services/dataContext.tsx:537
- insert: services/dataContext.tsx:2308
- delete: services/dataContext.tsx:2355

### debts
- select: services/data/dataLoaders.ts:118, services/dataContext.tsx:1555, services/dataContext.tsx:1656, services/dataContext.tsx:2327, services/dataContext.tsx:2365, services/dataContext.tsx:2726, services/dataContext.tsx:534
- select [edge]: supabase/functions/_shared/admin_agent/operations.ts:233, supabase/functions/_shared/admin_agent/operations.ts:416, supabase/functions/_shared/admin_agent/operations.ts:526, supabase/functions/_shared/admin_agent/operations.ts:922
- insert: services/dataContext.tsx:2183
- update: services/dataContext.tsx:2272

### device_catalog
- select: services/careApi.ts:239, services/data/dataLoaders.ts:84, services/dataContext.tsx:541
- select [edge]: supabase/functions/_shared/admin_agent/operations.ts:598
- insert: services/dataContext.tsx:2487
- telas: /care

### finance_categories
- select: services/data/dataLoaders.ts:126, services/dataContext.tsx:548
- select [edge]: supabase/functions/_shared/admin_agent/operations.ts:575
- insert: services/dataContext.tsx:3567
- update: services/dataContext.tsx:3582
- delete: services/dataContext.tsx:3588

### lead_state
- select: pages/crm/ConversationsPage.tsx:644
- select [edge]: supabase/functions/crm-leads-api/index.ts:187
- delete [edge]: supabase/functions/crm-delete-conversation/index.ts:85
- telas: /, /conversations/:conversationId, /crm/conversations

### parts_inventory
- select: services/data/dataLoaders.ts:123, services/dataContext.tsx:2837, services/dataContext.tsx:542
- insert: services/dataContext.tsx:2857
- update: services/dataContext.tsx:2892, services/dataContext.tsx:2946
- delete: services/dataContext.tsx:2907

### payable_debt_payments
- select: services/data/dataLoaders.ts:134, services/dataContext.tsx:1607, services/dataContext.tsx:556
- insert: services/dataContext.tsx:3501
- delete: services/dataContext.tsx:3544

### payable_debts
- select: services/data/dataLoaders.ts:131, services/dataContext.tsx:1572, services/dataContext.tsx:1657, services/dataContext.tsx:2746, services/dataContext.tsx:3523, services/dataContext.tsx:3549, services/dataContext.tsx:553
- select [edge]: supabase/functions/_shared/admin_agent/operations.ts:1014, supabase/functions/_shared/admin_agent/operations.ts:457, supabase/functions/_shared/admin_agent/operations.ts:992
- insert: services/dataContext.tsx:3421
- update: services/dataContext.tsx:3476
- delete: services/dataContext.tsx:3491

### pdv_quotes
- select: services/quotesApi.ts:80
- insert: services/quotesApi.ts:55
- update: services/quotesApi.ts:86
- telas: /pdv/orcamentos, /pdv/orcamentos/novo

### push_subscriptions
- select [edge]: supabase/functions/push-send/index.ts:723, supabase/functions/user-data-export/index.ts:65
- update [edge]: supabase/functions/push-send/index.ts:770, supabase/functions/push-send/index.ts:778, supabase/functions/push-send/index.ts:789, supabase/functions/push-subscribe/index.ts:82, supabase/functions/user-account-delete/index.ts:89
- upsert [edge]: supabase/functions/push-subscribe/index.ts:126

### reservation_message_settings
- select: services/data/dataLoaders.ts:75, services/dataContext.tsx:526
- upsert: services/dataContext.tsx:1738

### sale_items
- select [edge]: supabase/functions/warranty-public/index.ts:155, supabase/functions/warranty-public/index.ts:222

### sales
- select: services/data/dataLoaders.ts:44, services/dataContext.tsx:722
- select [edge]: supabase/functions/_shared/care/repository.ts:110, supabase/functions/send-receipt-whatsapp/index.ts:168, supabase/functions/warranty-link-create/index.ts:98, supabase/functions/warranty-public/index.ts:155, supabase/functions/warranty-public/index.ts:222
- update: pages/Warranties.tsx:533, pages/Warranties.tsx:563
- telas: /warranties

### sellers
- select: pages/crm/AdminAgentPage.tsx:74, services/data/dataLoaders.ts:81, services/dataContext.tsx:532
- select [edge]: supabase/functions/_shared/admin_agent/operations.ts:556, supabase/functions/admin-manage-user/index.ts:146, supabase/functions/admin-manage-user/index.ts:157, supabase/functions/admin-manage-user/index.ts:418, supabase/functions/admin-provision-user/index.ts:276, supabase/functions/crm-auth-handoff/index.ts:76, supabase/functions/crm-send-message/index.ts:85, supabase/functions/send-receipt-whatsapp/index.ts:177
- insert: services/dataContext.tsx:2406
- insert [edge]: supabase/functions/admin-manage-user/index.ts:192, supabase/functions/admin-provision-user/index.ts:253, supabase/functions/admin-provision-user/index.ts:352
- update: services/dataContext.tsx:2424
- update [edge]: supabase/functions/admin-manage-user/index.ts:180, supabase/functions/admin-manage-user/index.ts:309, supabase/functions/admin-provision-user/index.ts:298
- delete: services/dataContext.tsx:2429
- delete [edge]: supabase/functions/admin-manage-user/index.ts:432
- telas: /admin-agent, /crm/admin-agent

### simulator_trade_in_adjustments
- select: services/data/dataLoaders.ts:78, services/dataContext.tsx:529
- select [edge]: supabase/functions/crm-simulator-quote/index.ts:425
- update: services/dataContext.tsx:1831
- upsert: services/dataContext.tsx:1807
- delete: services/dataContext.tsx:1837

### simulator_trade_in_values
- select: services/data/dataLoaders.ts:77, services/dataContext.tsx:528
- select [edge]: supabase/functions/crm-simulator-quote/index.ts:424
- update: services/dataContext.tsx:1785
- upsert: services/dataContext.tsx:1762
- delete: services/dataContext.tsx:1791

### stock_items
- select: services/data/dataLoaders.ts:82, services/dataContext.tsx:1887, services/dataContext.tsx:2806, services/dataContext.tsx:2961, services/dataContext.tsx:3337, services/dataContext.tsx:539
- select [edge]: supabase/functions/_shared/admin_agent/operations.ts:1125, supabase/functions/_shared/admin_agent/operations.ts:1573, supabase/functions/_shared/admin_agent/operations.ts:1584, supabase/functions/_shared/admin_agent/operations.ts:278, supabase/functions/_shared/admin_agent/operations.ts:746, supabase/functions/crm-simulator-quote/index.ts:212, supabase/functions/warranty-public/index.ts:155, supabase/functions/warranty-public/index.ts:222
- insert: services/dataContext.tsx:1845
- update: services/dataContext.tsx:1929
- delete: services/dataContext.tsx:2061

### stock_reservations
- select: services/data/dataLoaders.ts:83, services/dataContext.tsx:2574, services/dataContext.tsx:3338, services/dataContext.tsx:540
- select [edge]: supabase/functions/_shared/admin_agent/operations.ts:1078, supabase/functions/_shared/admin_agent/operations.ts:316
- update: services/dataContext.tsx:2009

### stores
- select: services/data/dataLoaders.ts:79, services/dataContext.tsx:530
- insert: services/dataContext.tsx:2438
- update: services/dataContext.tsx:2452
- delete: services/dataContext.tsx:2461

### transactions
- select: services/data/dataLoaders.ts:24, services/dataContext.tsx:1635, services/dataContext.tsx:1655, services/dataContext.tsx:1964, services/dataContext.tsx:2214, services/dataContext.tsx:2287
- select [edge]: supabase/functions/_shared/admin_agent/operations.ts:1390, supabase/functions/_shared/admin_agent/operations.ts:483
- insert: services/dataContext.tsx:2509
- update: services/dataContext.tsx:2620, services/dataContext.tsx:2648

### user_access_roles
- select: contexts/AuthContext.tsx:67, pages/Settings.tsx:370, pages/crm/ConversationsPage.tsx:478
- select [edge]: supabase/functions/admin-manage-user/index.ts:230, supabase/functions/crm-send-message/index.ts:71, supabase/functions/user-data-export/index.ts:84
- update [edge]: supabase/functions/admin-manage-user/index.ts:362
- upsert [edge]: supabase/functions/admin-provision-user/index.ts:99
- telas: /, /conversations/:conversationId, /crm/conversations, /settings

### user_consents
- select: hooks/useConsents.ts:30
- select [edge]: supabase/functions/user-data-export/index.ts:71
- update: hooks/useConsents.ts:110
- upsert: hooks/useConsents.ts:80
- telas: /crm/settings, /settings

### user_profiles
- select: contexts/AuthContext.tsx:42, pages/crm/AdminAgentPage.tsx:73
- select [edge]: supabase/functions/_shared/admin_agent/identity.ts:38, supabase/functions/_shared/crm.ts:94, supabase/functions/admin-manage-user/index.ts:102, supabase/functions/admin-manage-user/index.ts:118, supabase/functions/admin-manage-user/index.ts:216, supabase/functions/admin-manage-user/index.ts:401, supabase/functions/admin-manage-user/index.ts:75, supabase/functions/admin-provision-user/index.ts:180, supabase/functions/admin-provision-user/index.ts:193, supabase/functions/crm-auth-handoff/index.ts:66, supabase/functions/user-data-export/index.ts:54, supabase/functions/warranty-link-create/index.ts:77
- insert [edge]: supabase/functions/admin-provision-user/index.ts:219, supabase/functions/admin-provision-user/index.ts:314, supabase/functions/admin-provision-user/index.ts:369
- update [edge]: supabase/functions/admin-manage-user/index.ts:319, supabase/functions/admin-manage-user/index.ts:340
- telas: /admin-agent, /crm/admin-agent

### warranty_public_tokens
- select [edge]: supabase/functions/warranty-public/index.ts:205
- update [edge]: supabase/functions/warranty-public/index.ts:239

## RPC (83)
- `add_lead_note`: — · [edge] supabase/functions/crm-leads-api/index.ts:393
- `admin_agent_account_balances`: — · [edge] supabase/functions/_shared/admin_agent/operations.ts:195
- `admin_agent_create_creditor`: — · [edge] supabase/functions/_shared/admin_agent/operations.ts:1858
- `admin_agent_create_customer`: — · [edge] supabase/functions/_shared/admin_agent/operations.ts:1837
- `admin_agent_create_sale`: — · [edge] supabase/functions/_shared/admin_agent/operations.ts:1887
- `admin_agent_create_stock_item`: — · [edge] supabase/functions/_shared/admin_agent/operations.ts:1811
- `admin_agent_delete_stock_item`: — · [edge] supabase/functions/_shared/admin_agent/operations.ts:1829
- `admin_agent_delete_transaction`: — · [edge] supabase/functions/_shared/admin_agent/operations.ts:1879
- `admin_agent_financial_summary`: — · [edge] supabase/functions/_shared/admin_agent/operations.ts:350
- `admin_agent_inventory_summary`: — · [edge] supabase/functions/_shared/admin_agent/operations.ts:394
- `admin_agent_pay_payable_debt`: — · [edge] supabase/functions/_shared/admin_agent/operations.ts:1768
- `admin_agent_receive_debt_payment`: — · [edge] supabase/functions/_shared/admin_agent/operations.ts:1743
- `admin_agent_register_transaction`: — · [edge] supabase/functions/_shared/admin_agent/operations.ts:1721
- `admin_agent_release_reservation`: — · [edge] supabase/functions/_shared/admin_agent/operations.ts:1793
- `admin_agent_reserve_stock`: — · [edge] supabase/functions/_shared/admin_agent/operations.ts:1705
- `admin_agent_sales_summary`: — · [edge] supabase/functions/_shared/admin_agent/operations.ts:378
- `admin_agent_transfer`: — · [edge] supabase/functions/_shared/admin_agent/operations.ts:1679
- `admin_agent_update_customer`: — · [edge] supabase/functions/_shared/admin_agent/operations.ts:1849
- `admin_agent_update_stock_item`: — · [edge] supabase/functions/_shared/admin_agent/operations.ts:1820
- `admin_agent_update_transaction`: — · [edge] supabase/functions/_shared/admin_agent/operations.ts:1870
- `admin_agent_upsert_device_catalog`: — · [edge] supabase/functions/_shared/admin_agent/operations.ts:1905
- `admin_agent_upsert_finance_category`: — · [edge] supabase/functions/_shared/admin_agent/operations.ts:1897
- `bulk_update_leads`: — · [edge] supabase/functions/crm-leads-api/index.ts:414
- `cancel_broadcast`: — · [edge] supabase/functions/crm-n8n-api/index.ts:250
- `cancel_sale`: services/dataContext.tsx:3317
- `cancel_transaction`: services/dataContext.tsx:2715
- `care_cancel_contract`: services/careApi.ts:118 · telas: /care
- `care_confirm_installment_payment`: services/careApi.ts:106 · telas: /care
- `care_consume_otp_attempt`: — · [edge] supabase/functions/care-sign-public/index.ts:324
- `care_contract_dossier`: services/careApi.ts:87 · telas: /care
- `care_contract_inspections_json`: services/careApi.ts:88 · telas: /care
- `care_create_contract`: services/careApi.ts:62 · telas: /pdv, /pdv/nova-venda
- `care_dashboard`: services/careApi.ts:184 · telas: /care
- `care_deliver_benefit`: services/careApi.ts:114 · telas: /care
- `care_open_service_request`: services/careApi.ts:155 · telas: /care
- `care_open_signature_session`: — · [edge] supabase/functions/care-contract/index.ts:162
- `care_quote_for_sale_item`: services/careApi.ts:56 · telas: /pdv, /pdv/nova-venda
- `care_reactivate_after_inspection`: services/careApi.ts:95 · telas: /care
- `care_refresh_suspensions`: services/careApi.ts:75 · telas: /care
- `care_register_document`: — · [edge] supabase/functions/care-contract/index.ts:69
- `care_sign_session`: — · [edge] supabase/functions/care-sign-public/index.ts:332
- `care_simulate`: services/careApi.ts:59 · telas: /care
- `care_update_service_request`: services/careApi.ts:171 · telas: /care
- `care_verify_event_chain`: services/careApi.ts:134 · telas: /care
- `claim_crm_uaz_avatar_jobs`: — · [edge] supabase/functions/_shared/uazAvatarJobs.ts:116
- `complete_crm_uaz_avatar_job`: — · [edge] supabase/functions/_shared/uazAvatarJobs.ts:75
- `create_sale_full`: services/dataContext.tsx:3099
- `crm_apply_channel_to_conversation`: pages/crm/ConversationsPage.tsx:1296 · [edge] supabase/functions/crm-conversation-handoff/index.ts:331, supabase/functions/crm-instagram-webhook-receiver/index.ts:312, supabase/functions/crm-leads-api/index.ts:365, supabase/functions/crm-send-message/index.ts:477, supabase/functions/crm-uaz-webhook-receiver/index.ts:913 · telas: /, /conversations/:conversationId, /crm/conversations
- `crm_fanout_event_log`: — · [edge] supabase/functions/crm-event-publisher/index.ts:43
- `crm_refresh_lead_purchase_metrics`: — · [edge] supabase/functions/crm-leads-api/index.ts:380
- `crm_upsert_lead_by_identity_rpc`: — · [edge] supabase/functions/crm-instagram-webhook-receiver/index.ts:239, supabase/functions/crm-n8n-api/index.ts:129
- `customer_ids_by_normalized_cpf`: — · [edge] supabase/functions/warranty-public/index.ts:133
- `delete_debt_cascade`: services/dataContext.tsx:2386
- `enqueue_crm_uaz_avatar_job`: — · [edge] supabase/functions/_shared/uazAvatarJobs.ts:56
- `get_broadcast_stats`: — · [edge] supabase/functions/crm-n8n-api/index.ts:242
- `get_cashback_summary`: pages/crm/CashbackPage.tsx:26 · telas: /cashback, /crm/cashback
- `get_crm_ads_dashboard`: pages/crm/AdsPage.tsx:245 · telas: /ads, /crm/ads
- `get_crm_statistics`: pages/crm/StatisticsPage.tsx:72 · [edge] supabase/functions/crm-n8n-api/index.ts:226 · telas: /crm/statistics, /statistics
- `get_lead_custom_values`: — · [edge] supabase/functions/crm-lead-profile/index.ts:49, supabase/functions/crm-leads-api/index.ts:141
- `get_lead_full_data`: pages/CRMLeads.tsx:225 · [edge] supabase/functions/crm-lead-profile/index.ts:48, supabase/functions/crm-leads-api/index.ts:139 · telas: /crm/leads, /leads, /leads/:leadId
- `get_lead_state`: — · [edge] supabase/functions/crm-leads-api/index.ts:144
- `mark_lead_as_customer`: pages/CRMLeads.tsx:311 · [edge] supabase/functions/crm-leads-api/index.ts:332 · telas: /crm/leads, /leads, /leads/:leadId
- `move_crm_lead_stage`: pages/CRMLeads.tsx:331 · [edge] supabase/functions/crm-leads-api/index.ts:346 · telas: /crm/leads, /leads, /leads/:leadId
- `prepare_broadcast_recipients`: — · [edge] supabase/functions/crm-n8n-api/index.ts:234
- `record_ai_turn_event`: — · [edge] supabase/functions/crm-leads-api/index.ts:283
- `release_stock_reservation`: services/dataContext.tsx:2035
- `remove_stock_item_cost`: services/dataContext.tsx:2825
- `reserve_stock_item`: services/dataContext.tsx:1986
- `resolve_crm_default_store_id`: services/dataContext.tsx:1691 · [edge] supabase/functions/_shared/care/whatsapp.ts:16, supabase/functions/send-receipt-whatsapp/index.ts:87, supabase/functions/send-reservation-whatsapp/index.ts:85
- `search_crm_messages`: pages/crm/ConversationsPage.tsx:1432 · telas: /, /conversations/:conversationId, /crm/conversations
- `search_leads`: pages/CRMLeads.tsx:184 · [edge] supabase/functions/crm-leads-api/index.ts:175 · telas: /crm/leads, /leads, /leads/:leadId
- `set_lead_custom_field`: — · [edge] supabase/functions/crm-leads-api/index.ts:443, supabase/functions/lead-form-public/index.ts:134
- `sync_crm_campaign_tag_mappings`: — · [edge] supabase/functions/crm-n8n-api/index.ts:260
- `test_webhook_subscription`: — · [edge] supabase/functions/crm-n8n-api/index.ts:271
- `transfer_between_accounts`: services/dataContext.tsx:2539
- `transfer_lead_store`: — · [edge] supabase/functions/crm-conversation-handoff/index.ts:321, supabase/functions/crm-leads-api/index.ts:429
- `update_lead_basic_data`: — · [edge] supabase/functions/crm-leads-api/index.ts:218
- `update_lead_funnel`: — · [edge] supabase/functions/crm-leads-api/index.ts:316
- `update_lead_memory`: — · [edge] supabase/functions/crm-leads-api/index.ts:302
- `update_sale_full`: services/dataContext.tsx:3249
- `upsert_crm_lead`: pages/crm/ConversationsPage.tsx:1279 · [edge] supabase/functions/care-contract/index.ts:127, supabase/functions/crm-n8n-api/index.ts:159, supabase/functions/crm-uaz-webhook-receiver/index.ts:813, supabase/functions/send-receipt-whatsapp/index.ts:150, supabase/functions/send-reservation-whatsapp/index.ts:120 · telas: /, /conversations/:conversationId, /crm/conversations
- `upsert_lead_state`: — · [edge] supabase/functions/crm-leads-api/index.ts:235
- `upsert_repasse_commerce_state`: — · [edge] supabase/functions/crm-leads-api/index.ts:255

## Edge functions invocadas (17)
- `admin-manage-user`: services/adminManageUser.ts:82 · telas: /settings
- `admin-provision-user`: services/adminProvision.ts:72 · telas: /pdv/nova-venda, /sellers, /settings
- `crm-audio-transcribe`: hooks/useTranscriber.ts:41 · telas: /, /conversations/:conversationId, /crm/conversations
- `crm-auth-handoff`: components/crm/CRMStandaloneApp.tsx:75, services/crmHandoff.ts:19
- `crm-conversation-handoff`: pages/crm/ConversationsPage.tsx:1638 · telas: /, /conversations/:conversationId, /crm/conversations
- `crm-delete-conversation`: pages/crm/ConversationsPage.tsx:711 · telas: /, /conversations/:conversationId, /crm/conversations
- `crm-send-message`: pages/crm/ConversationsPage.tsx:1017, pages/crm/ConversationsPage.tsx:1095, pages/crm/ConversationsPage.tsx:1241, pages/crm/ConversationsPage.tsx:962, pages/crm/ConversationsPage.tsx:973, supabase/functions/care-contract/index.ts:82, supabase/functions/send-receipt-whatsapp/index.ts:45, supabase/functions/send-reservation-whatsapp/index.ts:37 · telas: /, /conversations/:conversationId, /crm/conversations
- `crm-uaz-media-download`: components/crm/AudioMessage.tsx:78, components/crm/MessageBubble.tsx:410, components/crm/MessageBubble.tsx:646 · telas: /, /conversations/:conversationId, /crm/conversations
- `crm-uaz-message-action`: pages/crm/ConversationsPage.tsx:1141, pages/crm/ConversationsPage.tsx:593, pages/crm/ConversationsPage.tsx:628 · telas: /, /conversations/:conversationId, /crm/conversations
- `push-subscribe`: services/pushClient.ts:208, services/pushClient.ts:229 · telas: /crm/settings, /settings
- `sales-notify`: services/dataContext.tsx:3180
- `send-receipt-whatsapp`: utils/sendReceiptWhatsApp.ts:30, utils/sendReceiptWhatsApp.ts:37 · telas: /pdv, /pdv/nova-venda
- `send-reservation-whatsapp`: utils/sendReservationWhatsApp.ts:41 · telas: /inventory
- `user-account-delete`: pages/Settings.tsx:720, pages/Settings.tsx:749, pages/crm/SettingsPage.tsx:322, pages/crm/SettingsPage.tsx:353 · telas: /crm/settings, /settings
- `user-data-export`: pages/Settings.tsx:683, pages/crm/SettingsPage.tsx:275 · telas: /crm/settings, /settings
- `warranty-link-create`: pages/Warranties.tsx:223 · telas: /warranties
- `warranty-public`: pages/PublicWarranty.tsx:58 · telas: /warranties/:cpf, /warranty/:token

## Storage (4)
- bucket `admin-agent-reports` (uso): supabase/functions/_shared/admin_agent/reports.ts:209
- bucket `crm-media` (upload, getPublicUrl): pages/crm/ConversationsPage.tsx:1087, pages/crm/ConversationsPage.tsx:1091, pages/crm/ConversationsPage.tsx:845, pages/crm/ConversationsPage.tsx:847
- bucket `payable-debt-receipts` (upload, remove, createSignedUrl): pages/PayableDebts.tsx:277, pages/PayableDebts.tsx:304, pages/PayableDebts.tsx:316, pages/PayableDebts.tsx:326
- bucket `receipts` (upload, createSignedUrl): supabase/functions/send-receipt-whatsapp/index.ts:133, supabase/functions/send-receipt-whatsapp/index.ts:142

## Realtime (28)
- tabela `business_profile`: services/dataContext.tsx:731
- tabela `card_fee_settings`: services/dataContext.tsx:731
- tabela `cost_history`: services/dataContext.tsx:731
- tabela `costs`: services/dataContext.tsx:731
- tabela `creditors`: services/dataContext.tsx:731
- tabela `crm_channels`: pages/CRMChannels.tsx:403
- tabela `crm_conversations`: hooks/useCRMUnreadCount.ts:21, pages/crm/ConversationsPage.tsx:1397
- tabela `crm_leads`: pages/crm/ConversationsPage.tsx:1397
- tabela `crm_messages`: hooks/useMessagesPagination.ts:204, pages/crm/ConversationsPage.tsx:1397
- tabela `customers`: services/dataContext.tsx:731
- tabela `debt_payments`: services/dataContext.tsx:731
- tabela `debts`: services/dataContext.tsx:731
- tabela `device_catalog`: services/dataContext.tsx:731
- tabela `finance_categories`: services/dataContext.tsx:731
- tabela `parts_inventory`: services/dataContext.tsx:731
- tabela `payable_debt_payments`: services/dataContext.tsx:731
- tabela `payable_debts`: services/dataContext.tsx:731
- tabela `payment_methods`: services/dataContext.tsx:731
- tabela `sale_items`: services/dataContext.tsx:731
- tabela `sale_trade_in_items`: services/dataContext.tsx:731
- tabela `sales`: components/Layout.tsx:125, services/dataContext.tsx:731
- tabela `sellers`: services/dataContext.tsx:731
- tabela `simulator_trade_in_adjustments`: services/dataContext.tsx:731
- tabela `simulator_trade_in_values`: services/dataContext.tsx:731
- tabela `stock_items`: services/dataContext.tsx:731
- tabela `stock_reservations`: services/dataContext.tsx:731
- tabela `stores`: services/dataContext.tsx:731
- tabela `transactions`: services/dataContext.tsx:731

## Alertas (2)
- Tabelas do mapa sem uso no código (front + edge): `admin_agent_pending_actions`, `care_audit_log`, `care_contract_benefits`, `care_contract_inspections`, `care_contract_installments`, `crm_attendance_scripts`, `crm_automation_rules`, `crm_channel_store_links`, `crm_dispatch_runtime`, `crm_follow_up_tracker`, `crm_instagram_media_snapshots`, `crm_lead_custom_field_values`, `crm_lead_stage_history`, `crm_message_templates`, `crm_meta_ads_attributions`, `crm_meta_ads_groups`, `crm_settings`, `crm_uaz_avatar_jobs`, `crm_ui_preferences`, `crm_utm_config`
- Edge functions sem chamada no front (webhook, cron ou outra função?): `care-contract`, `care-sign-public`, `crm-admin-agent`, `crm-ai-agent-test-endpoint`, `crm-ai-inbound`, `crm-broadcast-worker`, `crm-event-publisher`, `crm-instagram-webhook-receiver`, `crm-lead-profile`, `crm-leads-api`, `crm-n8n-api`, `crm-scheduled-messages-worker`, `crm-simulator-quote`, `crm-uaz-avatar-refresh`, `crm-uaz-instance-admin`, `crm-uaz-webhook-receiver`, `lead-form-public`, `push-send`
