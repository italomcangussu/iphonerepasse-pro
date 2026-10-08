# Uso do banco pelo código
> Gerado por `fabuloso.mjs react`; não edite. Front = app; edge = supabase/functions. Schema, RLS e gatilhos → `indice.md` e `tabelas/`.

## Tabelas (55)
| Tabela | Operações | Front (arquivos) | Edge (arquivos) | Telas |
|---|---|---|---|---|
| account_deletion_requests | select, insert, update | 0 | 2 | 0 |
| admin_agent_audit_log | select, insert | 1 | 1 | 2 |
| admin_agent_numbers | select, insert, update, delete | 1 | 1 | 2 |
| ai_turn_events | select | 1 | 0 | 3 |
| app_role_permissions | select, upsert | 1 | 0 | 0 |
| app_user_activity_logs | select, insert | 2 | 1 | 10 |
| business_profile | select, upsert | 2 | 1 | 0 |
| card_fee_settings | select, upsert | 2 | 1 | 0 |
| cost_history | select, insert, update | 2 | 0 | 0 |
| costs | select, insert, delete | 2 | 0 | 0 |
| creditors | select, insert, update, delete | 2 | 0 | 0 |
| crm_ai_agent_configs | select, insert, update, delete | 1 | 2 | 2 |
| crm_ai_agent_invocations | select, insert | 1 | 2 | 2 |
| crm_ai_entry_settings | select, upsert | 3 | 2 | 3 |
| crm_auth_handoffs | select, insert, update | 0 | 1 | 0 |
| crm_broadcast_recipients | select, insert, update | 1 | 1 | 1 |
| crm_broadcasts | select, insert, update | 1 | 1 | 1 |
| crm_channels | select, insert, update, delete | 3 | 15 | 8 |
| crm_conversations | select, insert, update | 2 | 15 | 3 |
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
| device_catalog | select, insert | 2 | 1 | 0 |
| finance_categories | select, insert, update, delete | 2 | 1 | 0 |
| lead_state | select, delete | 1 | 2 | 3 |
| parts_inventory | select, insert, update, delete | 2 | 0 | 0 |
| payable_debt_payments | select, insert, delete | 2 | 0 | 0 |
| payable_debts | select, insert, update, delete | 2 | 1 | 0 |
| push_subscriptions | select, update, upsert | 0 | 4 | 0 |
| reservation_message_settings | select, upsert | 2 | 0 | 0 |
| sale_items | select | 0 | 1 | 0 |
| sales | select, update | 3 | 3 | 1 |
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
- select: contexts/PermissionsContext.tsx:62
- upsert: contexts/PermissionsContext.tsx:133

### app_user_activity_logs
- select: pages/Settings.tsx:570
- select [edge]: supabase/functions/user-data-export/index.ts:57
- insert: services/telemetry.ts:72
- telas: /debtors, /in-use, /inventory, /payable-debts, /pdv, /pdv/nova-venda, /settings, /warranties, /warranties/:cpf, /warranty/:token

### business_profile
- select: services/data/dataLoaders.ts:73, services/dataContext.tsx:519
- select [edge]: supabase/functions/warranty-public/index.ts:98
- upsert: services/dataContext.tsx:1675

### card_fee_settings
- select: services/data/dataLoaders.ts:74, services/dataContext.tsx:520
- select [edge]: supabase/functions/crm-simulator-quote/index.ts:426
- upsert: services/dataContext.tsx:1714

### cost_history
- select: services/data/dataLoaders.ts:125, services/dataContext.tsx:2782, services/dataContext.tsx:542
- insert: services/dataContext.tsx:2773
- update: services/dataContext.tsx:2768

### costs
- select: services/data/dataLoaders.ts:82, services/dataContext.tsx:1882, services/dataContext.tsx:2801, services/dataContext.tsx:2956, services/dataContext.tsx:3332, services/dataContext.tsx:534
- insert: services/dataContext.tsx:1874, services/dataContext.tsx:2792, services/dataContext.tsx:2929
- delete: services/dataContext.tsx:2949

### creditors
- select: services/data/dataLoaders.ts:128, services/dataContext.tsx:545
- insert: services/dataContext.tsx:3369
- update: services/dataContext.tsx:3396
- delete: services/dataContext.tsx:3404

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
- select: pages/CRMChannels.tsx:293, services/data/dataLoaders.ts:76, services/dataContext.tsx:522
- select [edge]: supabase/functions/_shared/crm_ai_entry_engine.ts:58, supabase/functions/_shared/crm_ai_routing.ts:74
- upsert: pages/CRMChannels.tsx:421, services/dataContext.tsx:1689
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
- select [edge]: supabase/functions/_shared/crm_ai_inbound_dispatch.ts:231, supabase/functions/_shared/crm_ai_routing.ts:69, supabase/functions/_shared/uazAvatarJobs.ts:88, supabase/functions/crm-broadcast-worker/index.ts:211, supabase/functions/crm-conversation-handoff/index.ts:120, supabase/functions/crm-instagram-webhook-receiver/index.ts:125, supabase/functions/crm-instagram-webhook-receiver/index.ts:139, supabase/functions/crm-scheduled-messages-worker/index.ts:118, supabase/functions/crm-send-message/index.ts:364, supabase/functions/crm-uaz-avatar-refresh/index.ts:81, supabase/functions/crm-uaz-instance-admin/index.ts:99, supabase/functions/crm-uaz-media-download/index.ts:81 +10
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
- update [edge]: supabase/functions/_shared/crm_ai_entry_engine.ts:97, supabase/functions/_shared/crm_ai_routing.ts:147, supabase/functions/crm-ai-inbound/index.ts:357, supabase/functions/crm-ai-inbound/index.ts:55, supabase/functions/crm-conversation-handoff/index.ts:202, supabase/functions/crm-conversation-handoff/index.ts:341, supabase/functions/crm-uaz-webhook-receiver/index.ts:1034, supabase/functions/crm-uaz-webhook-receiver/index.ts:1094, supabase/functions/crm-uaz-webhook-receiver/index.ts:896, supabase/functions/crm-uaz-webhook-receiver/index.ts:903, supabase/functions/send-receipt-whatsapp/index.ts:211, supabase/functions/send-reservation-whatsapp/index.ts:149
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
- select: services/data/dataLoaders.ts:80, services/dataContext.tsx:2125, services/dataContext.tsx:526
- select [edge]: supabase/functions/_shared/admin_agent/operations.ts:220, supabase/functions/_shared/admin_agent/operations.ts:429, supabase/functions/_shared/admin_agent/operations.ts:516, supabase/functions/_shared/admin_agent/operations.ts:625, supabase/functions/_shared/admin_agent/operations.ts:634, supabase/functions/_shared/admin_agent/operations.ts:933, supabase/functions/warranty-link-create/index.ts:98, supabase/functions/warranty-public/index.ts:155, supabase/functions/warranty-public/index.ts:222
- insert: services/dataContext.tsx:2088, services/dataContext.tsx:2148
- update: services/dataContext.tsx:2106
- delete: services/dataContext.tsx:2117

### debt_payments
- select: services/data/dataLoaders.ts:121, services/dataContext.tsx:1584, services/dataContext.tsx:532
- insert: services/dataContext.tsx:2303
- delete: services/dataContext.tsx:2350

### debts
- select: services/data/dataLoaders.ts:118, services/dataContext.tsx:1550, services/dataContext.tsx:1651, services/dataContext.tsx:2322, services/dataContext.tsx:2360, services/dataContext.tsx:2721, services/dataContext.tsx:529
- select [edge]: supabase/functions/_shared/admin_agent/operations.ts:233, supabase/functions/_shared/admin_agent/operations.ts:416, supabase/functions/_shared/admin_agent/operations.ts:526, supabase/functions/_shared/admin_agent/operations.ts:922
- insert: services/dataContext.tsx:2178
- update: services/dataContext.tsx:2267

### device_catalog
- select: services/data/dataLoaders.ts:84, services/dataContext.tsx:536
- select [edge]: supabase/functions/_shared/admin_agent/operations.ts:598
- insert: services/dataContext.tsx:2482

### finance_categories
- select: services/data/dataLoaders.ts:126, services/dataContext.tsx:543
- select [edge]: supabase/functions/_shared/admin_agent/operations.ts:575
- insert: services/dataContext.tsx:3562
- update: services/dataContext.tsx:3577
- delete: services/dataContext.tsx:3583

### lead_state
- select: pages/crm/ConversationsPage.tsx:644
- select [edge]: supabase/functions/crm-leads-api/index.ts:187
- delete [edge]: supabase/functions/crm-delete-conversation/index.ts:85
- telas: /, /conversations/:conversationId, /crm/conversations

### parts_inventory
- select: services/data/dataLoaders.ts:123, services/dataContext.tsx:2832, services/dataContext.tsx:537
- insert: services/dataContext.tsx:2852
- update: services/dataContext.tsx:2887, services/dataContext.tsx:2941
- delete: services/dataContext.tsx:2902

### payable_debt_payments
- select: services/data/dataLoaders.ts:134, services/dataContext.tsx:1602, services/dataContext.tsx:551
- insert: services/dataContext.tsx:3496
- delete: services/dataContext.tsx:3539

### payable_debts
- select: services/data/dataLoaders.ts:131, services/dataContext.tsx:1567, services/dataContext.tsx:1652, services/dataContext.tsx:2741, services/dataContext.tsx:3518, services/dataContext.tsx:3544, services/dataContext.tsx:548
- select [edge]: supabase/functions/_shared/admin_agent/operations.ts:1014, supabase/functions/_shared/admin_agent/operations.ts:457, supabase/functions/_shared/admin_agent/operations.ts:992
- insert: services/dataContext.tsx:3416
- update: services/dataContext.tsx:3471
- delete: services/dataContext.tsx:3486

### push_subscriptions
- select [edge]: supabase/functions/push-send/index.ts:723, supabase/functions/user-data-export/index.ts:65
- update [edge]: supabase/functions/push-send/index.ts:770, supabase/functions/push-send/index.ts:778, supabase/functions/push-send/index.ts:789, supabase/functions/push-subscribe/index.ts:82, supabase/functions/user-account-delete/index.ts:89
- upsert [edge]: supabase/functions/push-subscribe/index.ts:126

### reservation_message_settings
- select: services/data/dataLoaders.ts:75, services/dataContext.tsx:521
- upsert: services/dataContext.tsx:1733

### sale_items
- select [edge]: supabase/functions/warranty-public/index.ts:155, supabase/functions/warranty-public/index.ts:222

### sales
- select: services/data/dataLoaders.ts:44, services/dataContext.tsx:717
- select [edge]: supabase/functions/send-receipt-whatsapp/index.ts:168, supabase/functions/warranty-link-create/index.ts:98, supabase/functions/warranty-public/index.ts:155, supabase/functions/warranty-public/index.ts:222
- update: pages/Warranties.tsx:529, pages/Warranties.tsx:559
- telas: /warranties

### sellers
- select: pages/crm/AdminAgentPage.tsx:74, services/data/dataLoaders.ts:81, services/dataContext.tsx:527
- select [edge]: supabase/functions/_shared/admin_agent/operations.ts:556, supabase/functions/admin-manage-user/index.ts:146, supabase/functions/admin-manage-user/index.ts:157, supabase/functions/admin-manage-user/index.ts:418, supabase/functions/admin-provision-user/index.ts:276, supabase/functions/crm-auth-handoff/index.ts:76, supabase/functions/crm-send-message/index.ts:85, supabase/functions/send-receipt-whatsapp/index.ts:177
- insert: services/dataContext.tsx:2401
- insert [edge]: supabase/functions/admin-manage-user/index.ts:192, supabase/functions/admin-provision-user/index.ts:253, supabase/functions/admin-provision-user/index.ts:352
- update: services/dataContext.tsx:2419
- update [edge]: supabase/functions/admin-manage-user/index.ts:180, supabase/functions/admin-manage-user/index.ts:309, supabase/functions/admin-provision-user/index.ts:298
- delete: services/dataContext.tsx:2424
- delete [edge]: supabase/functions/admin-manage-user/index.ts:432
- telas: /admin-agent, /crm/admin-agent

### simulator_trade_in_adjustments
- select: services/data/dataLoaders.ts:78, services/dataContext.tsx:524
- select [edge]: supabase/functions/crm-simulator-quote/index.ts:425
- update: services/dataContext.tsx:1826
- upsert: services/dataContext.tsx:1802
- delete: services/dataContext.tsx:1832

### simulator_trade_in_values
- select: services/data/dataLoaders.ts:77, services/dataContext.tsx:523
- select [edge]: supabase/functions/crm-simulator-quote/index.ts:424
- update: services/dataContext.tsx:1780
- upsert: services/dataContext.tsx:1757
- delete: services/dataContext.tsx:1786

### stock_items
- select: services/data/dataLoaders.ts:82, services/dataContext.tsx:1882, services/dataContext.tsx:2801, services/dataContext.tsx:2956, services/dataContext.tsx:3332, services/dataContext.tsx:534
- select [edge]: supabase/functions/_shared/admin_agent/operations.ts:1125, supabase/functions/_shared/admin_agent/operations.ts:1573, supabase/functions/_shared/admin_agent/operations.ts:1584, supabase/functions/_shared/admin_agent/operations.ts:278, supabase/functions/_shared/admin_agent/operations.ts:746, supabase/functions/crm-simulator-quote/index.ts:212, supabase/functions/warranty-public/index.ts:155, supabase/functions/warranty-public/index.ts:222
- insert: services/dataContext.tsx:1840
- update: services/dataContext.tsx:1924
- delete: services/dataContext.tsx:2056

### stock_reservations
- select: services/data/dataLoaders.ts:83, services/dataContext.tsx:2569, services/dataContext.tsx:3333, services/dataContext.tsx:535
- select [edge]: supabase/functions/_shared/admin_agent/operations.ts:1078, supabase/functions/_shared/admin_agent/operations.ts:316
- update: services/dataContext.tsx:2004

### stores
- select: services/data/dataLoaders.ts:79, services/dataContext.tsx:525
- insert: services/dataContext.tsx:2433
- update: services/dataContext.tsx:2447
- delete: services/dataContext.tsx:2456

### transactions
- select: services/data/dataLoaders.ts:24, services/dataContext.tsx:1630, services/dataContext.tsx:1650, services/dataContext.tsx:1959, services/dataContext.tsx:2209, services/dataContext.tsx:2282
- select [edge]: supabase/functions/_shared/admin_agent/operations.ts:1390, supabase/functions/_shared/admin_agent/operations.ts:483
- insert: services/dataContext.tsx:2504
- update: services/dataContext.tsx:2615, services/dataContext.tsx:2643

### user_access_roles
- select: contexts/AuthContext.tsx:67, pages/Settings.tsx:365, pages/crm/ConversationsPage.tsx:478
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

## RPC (65)
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
- `cancel_sale`: services/dataContext.tsx:3312
- `cancel_transaction`: services/dataContext.tsx:2710
- `claim_crm_uaz_avatar_jobs`: — · [edge] supabase/functions/_shared/uazAvatarJobs.ts:116
- `complete_crm_uaz_avatar_job`: — · [edge] supabase/functions/_shared/uazAvatarJobs.ts:75
- `create_sale_full`: services/dataContext.tsx:3094
- `crm_apply_channel_to_conversation`: pages/crm/ConversationsPage.tsx:1296 · [edge] supabase/functions/crm-conversation-handoff/index.ts:331, supabase/functions/crm-instagram-webhook-receiver/index.ts:312, supabase/functions/crm-leads-api/index.ts:365, supabase/functions/crm-send-message/index.ts:477, supabase/functions/crm-uaz-webhook-receiver/index.ts:913 · telas: /, /conversations/:conversationId, /crm/conversations
- `crm_fanout_event_log`: — · [edge] supabase/functions/crm-event-publisher/index.ts:43
- `crm_refresh_lead_purchase_metrics`: — · [edge] supabase/functions/crm-leads-api/index.ts:380
- `crm_upsert_lead_by_identity_rpc`: — · [edge] supabase/functions/crm-instagram-webhook-receiver/index.ts:239, supabase/functions/crm-n8n-api/index.ts:129
- `customer_ids_by_normalized_cpf`: — · [edge] supabase/functions/warranty-public/index.ts:133
- `delete_debt_cascade`: services/dataContext.tsx:2381
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
- `release_stock_reservation`: services/dataContext.tsx:2030
- `remove_stock_item_cost`: services/dataContext.tsx:2820
- `reserve_stock_item`: services/dataContext.tsx:1981
- `resolve_crm_default_store_id`: services/dataContext.tsx:1686 · [edge] supabase/functions/send-receipt-whatsapp/index.ts:87, supabase/functions/send-reservation-whatsapp/index.ts:85
- `search_crm_messages`: pages/crm/ConversationsPage.tsx:1432 · telas: /, /conversations/:conversationId, /crm/conversations
- `search_leads`: pages/CRMLeads.tsx:184 · [edge] supabase/functions/crm-leads-api/index.ts:175 · telas: /crm/leads, /leads, /leads/:leadId
- `set_lead_custom_field`: — · [edge] supabase/functions/crm-leads-api/index.ts:443, supabase/functions/lead-form-public/index.ts:134
- `sync_crm_campaign_tag_mappings`: — · [edge] supabase/functions/crm-n8n-api/index.ts:260
- `test_webhook_subscription`: — · [edge] supabase/functions/crm-n8n-api/index.ts:271
- `transfer_between_accounts`: services/dataContext.tsx:2534
- `transfer_lead_store`: — · [edge] supabase/functions/crm-conversation-handoff/index.ts:321, supabase/functions/crm-leads-api/index.ts:429
- `update_lead_basic_data`: — · [edge] supabase/functions/crm-leads-api/index.ts:218
- `update_lead_funnel`: — · [edge] supabase/functions/crm-leads-api/index.ts:316
- `update_lead_memory`: — · [edge] supabase/functions/crm-leads-api/index.ts:302
- `update_sale_full`: services/dataContext.tsx:3244
- `upsert_crm_lead`: pages/crm/ConversationsPage.tsx:1279 · [edge] supabase/functions/crm-n8n-api/index.ts:159, supabase/functions/crm-uaz-webhook-receiver/index.ts:813, supabase/functions/send-receipt-whatsapp/index.ts:150, supabase/functions/send-reservation-whatsapp/index.ts:120 · telas: /, /conversations/:conversationId, /crm/conversations
- `upsert_lead_state`: — · [edge] supabase/functions/crm-leads-api/index.ts:235
- `upsert_repasse_commerce_state`: — · [edge] supabase/functions/crm-leads-api/index.ts:255

## Edge functions invocadas (17)
- `admin-manage-user`: services/adminManageUser.ts:82 · telas: /settings
- `admin-provision-user`: services/adminProvision.ts:72 · telas: /pdv/nova-venda, /sellers, /settings
- `crm-audio-transcribe`: hooks/useTranscriber.ts:41 · telas: /, /conversations/:conversationId, /crm/conversations
- `crm-auth-handoff`: components/crm/CRMStandaloneApp.tsx:75, services/crmHandoff.ts:19
- `crm-conversation-handoff`: pages/crm/ConversationsPage.tsx:1638 · telas: /, /conversations/:conversationId, /crm/conversations
- `crm-delete-conversation`: pages/crm/ConversationsPage.tsx:711 · telas: /, /conversations/:conversationId, /crm/conversations
- `crm-send-message`: pages/crm/ConversationsPage.tsx:1017, pages/crm/ConversationsPage.tsx:1095, pages/crm/ConversationsPage.tsx:1241, pages/crm/ConversationsPage.tsx:962, pages/crm/ConversationsPage.tsx:973, supabase/functions/send-receipt-whatsapp/index.ts:45, supabase/functions/send-reservation-whatsapp/index.ts:37 · telas: /, /conversations/:conversationId, /crm/conversations
- `crm-uaz-media-download`: components/crm/AudioMessage.tsx:78, components/crm/MessageBubble.tsx:410, components/crm/MessageBubble.tsx:646 · telas: /, /conversations/:conversationId, /crm/conversations
- `crm-uaz-message-action`: pages/crm/ConversationsPage.tsx:1141, pages/crm/ConversationsPage.tsx:593, pages/crm/ConversationsPage.tsx:628 · telas: /, /conversations/:conversationId, /crm/conversations
- `push-subscribe`: services/pushClient.ts:208, services/pushClient.ts:229 · telas: /crm/settings, /settings
- `sales-notify`: services/dataContext.tsx:3175
- `send-receipt-whatsapp`: utils/sendReceiptWhatsApp.ts:30, utils/sendReceiptWhatsApp.ts:37 · telas: /pdv, /pdv/nova-venda
- `send-reservation-whatsapp`: utils/sendReservationWhatsApp.ts:41 · telas: /inventory
- `user-account-delete`: pages/Settings.tsx:715, pages/Settings.tsx:744, pages/crm/SettingsPage.tsx:322, pages/crm/SettingsPage.tsx:353 · telas: /crm/settings, /settings
- `user-data-export`: pages/Settings.tsx:678, pages/crm/SettingsPage.tsx:275 · telas: /crm/settings, /settings
- `warranty-link-create`: pages/Warranties.tsx:219 · telas: /warranties
- `warranty-public`: pages/PublicWarranty.tsx:58 · telas: /warranties/:cpf, /warranty/:token

## Storage (4)
- bucket `admin-agent-reports` (uso): supabase/functions/_shared/admin_agent/reports.ts:209
- bucket `crm-media` (upload, getPublicUrl): pages/crm/ConversationsPage.tsx:1087, pages/crm/ConversationsPage.tsx:1091, pages/crm/ConversationsPage.tsx:845, pages/crm/ConversationsPage.tsx:847
- bucket `payable-debt-receipts` (upload, remove, createSignedUrl): pages/PayableDebts.tsx:273, pages/PayableDebts.tsx:300, pages/PayableDebts.tsx:312, pages/PayableDebts.tsx:322
- bucket `receipts` (upload, createSignedUrl): supabase/functions/send-receipt-whatsapp/index.ts:133, supabase/functions/send-receipt-whatsapp/index.ts:142

## Realtime (28)
- tabela `business_profile`: services/dataContext.tsx:726
- tabela `card_fee_settings`: services/dataContext.tsx:726
- tabela `cost_history`: services/dataContext.tsx:726
- tabela `costs`: services/dataContext.tsx:726
- tabela `creditors`: services/dataContext.tsx:726
- tabela `crm_channels`: pages/CRMChannels.tsx:403
- tabela `crm_conversations`: hooks/useCRMUnreadCount.ts:21, pages/crm/ConversationsPage.tsx:1397
- tabela `crm_leads`: pages/crm/ConversationsPage.tsx:1397
- tabela `crm_messages`: hooks/useMessagesPagination.ts:204, pages/crm/ConversationsPage.tsx:1397
- tabela `customers`: services/dataContext.tsx:726
- tabela `debt_payments`: services/dataContext.tsx:726
- tabela `debts`: services/dataContext.tsx:726
- tabela `device_catalog`: services/dataContext.tsx:726
- tabela `finance_categories`: services/dataContext.tsx:726
- tabela `parts_inventory`: services/dataContext.tsx:726
- tabela `payable_debt_payments`: services/dataContext.tsx:726
- tabela `payable_debts`: services/dataContext.tsx:726
- tabela `payment_methods`: services/dataContext.tsx:726
- tabela `sale_items`: services/dataContext.tsx:726
- tabela `sale_trade_in_items`: services/dataContext.tsx:726
- tabela `sales`: components/Layout.tsx:122, services/dataContext.tsx:726
- tabela `sellers`: services/dataContext.tsx:726
- tabela `simulator_trade_in_adjustments`: services/dataContext.tsx:726
- tabela `simulator_trade_in_values`: services/dataContext.tsx:726
- tabela `stock_items`: services/dataContext.tsx:726
- tabela `stock_reservations`: services/dataContext.tsx:726
- tabela `stores`: services/dataContext.tsx:726
- tabela `transactions`: services/dataContext.tsx:726

## Alertas (2)
- Tabelas do mapa sem uso no código (front + edge): `admin_agent_pending_actions`, `crm_attendance_scripts`, `crm_automation_rules`, `crm_channel_store_links`, `crm_dispatch_runtime`, `crm_follow_up_tracker`, `crm_instagram_media_snapshots`, `crm_lead_custom_field_values`, `crm_lead_stage_history`, `crm_message_templates`, `crm_meta_ads_attributions`, `crm_meta_ads_groups`, `crm_settings`, `crm_uaz_avatar_jobs`, `crm_ui_preferences`, `crm_utm_config`
- Edge functions sem chamada no front (webhook, cron ou outra função?): `crm-admin-agent`, `crm-ai-agent-test-endpoint`, `crm-ai-inbound`, `crm-broadcast-worker`, `crm-event-publisher`, `crm-instagram-webhook-receiver`, `crm-lead-profile`, `crm-leads-api`, `crm-n8n-api`, `crm-scheduled-messages-worker`, `crm-simulator-quote`, `crm-uaz-avatar-refresh`, `crm-uaz-instance-admin`, `crm-uaz-webhook-receiver`, `lead-form-public`, `push-send`
