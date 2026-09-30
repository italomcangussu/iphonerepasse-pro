# Mapa do banco — postgres
> Gerado por `fabuloso.mjs db` em 2026-09-30 18:05 UTC · fonte: api supabase (ubuusaiezpyayqgfujbe) · Postgres 17.6 · hash 240f9de6e7b0
> Última migração aplicada no remoto: 20260929131000 · última local no mapa: 20260929131000
> Detalhe: `tabelas/<schema>.<tabela>.md` (colunas, FKs, índices, políticas, gatilhos) · `funcoes.md` · `relacoes.mmd`. Não introspecte o banco para o que está aqui.

## Alertas (40)
- [info] 60 funções — SECURITY DEFINER executáveis por anon (coluna anon em funcoes.md) — confirme quais RPCs devem ser públicas
- [info] public.admin_agent_audit_log — FK (user_id) → auth.users sem índice
- [info] public.admin_agent_numbers — FK (user_id) → auth.users sem índice
- [info] public.admin_agent_pending_actions — RLS ligado sem políticas — ninguém acessa pela API (ok se for só service_role)
- [info] public.admin_agent_pending_actions — FK (user_id) → auth.users sem índice
- [info] public.ai_turn_events — FK (store_id) → public.stores sem índice
- [info] public.crm_automation_rules — FK (channel_id) → public.crm_channels sem índice
- [info] public.crm_broadcast_recipients — FK (channel_id) → public.crm_channels sem índice
- [info] public.crm_broadcast_recipients — FK (conversation_id) → public.crm_conversations sem índice
- [info] public.crm_broadcast_recipients — FK (lead_id) → public.crm_leads sem índice
- [info] public.crm_broadcasts — FK (channel_id) → public.crm_channels sem índice
- [info] public.crm_broadcasts — FK (store_id) → public.stores sem índice
- … +28 infos em `alertas.md`

## Schema public
| Tabela | Linhas | PK | FK → | RLS | Políticas | Gatilhos | anon/auth |
|---|---|---|---|---|---|---|---|
| account_deletion_requests | 0 | id | auth.users | on | A1 | — | ·/siud |
| admin_agent_audit_log | <10k | id | auth.users | on | S1 | — | siud/siud |
| admin_agent_numbers | 0 | id | auth.users | on | A1 | — | siud/siud |
| admin_agent_pending_actions | 0 | id | auth.users | on | — | — | siud/siud |
| ai_turn_events | 0 | id | crm_conversations, crm_leads, stores | on | S1 | — | siud/siud |
| app_role_permissions | <100 | role, permission_key | — | on | S1 I1 U1 D1 | 1 | siud/siud |
| app_user_activity_logs | <100k | id | auth.users | on | S1 I1 | — | siud/siud |
| business_profile | 0 | id | — | on | S1 I1 U1 D1 | — | siud/siud |
| card_fee_settings | 0 | id | — | on | S1 I1 U1 D1 | 1 | siud/siud |
| cost_history | <1k | id | — | on | S1 I1 U1 D1 | — | siud/siud |
| costs | <1k | id | parts_inventory, stock_items | on | S1 I1 U1 D1 | — | siud/siud |
| creditors | 0 | id | — | on | A1 | 1 | siud/siud |
| crm_ai_agent_configs | 0 | id | stores | on | A1 | 1 | siud/siud |
| crm_ai_agent_invocations | 0 | id | crm_ai_agent_configs, stores | on | S1 I1 | — | siud/siud |
| crm_ai_entry_settings | 0 | id | stores | on | A1 | — | siud/siud |
| crm_attendance_scripts | 0 | id | stores | on | A1 | 1 | siud/siud |
| crm_auth_handoffs | 0 | id | — | on | A1 | — | siud/siud |
| crm_automation_rules | 0 | id | crm_channels, stores | on | A1 | 1 | siud/siud |
| crm_broadcast_recipients | 0 | id | crm_broadcasts, crm_channels, crm_conversations, crm_leads | on | A1 | — | siud/siud |
| crm_broadcasts | 0 | id | crm_channels, stores | on | A1 | 1 | siud/siud |
| crm_channel_store_links | 0 | id | crm_channels, stores | on | A1 | 1 | siud/siud |
| crm_channels | <100 | id | crm_funnels | on | A1 | 1 | siud/siud |
| crm_conversations | <10k | id | crm_channels, crm_leads | on | A1 | 3 | siud/siud |
| crm_custom_fields | 0 | id | stores | on | A1 | 1 | siud/siud |
| crm_dispatch_runtime | 0 | id | — | on | A1 | 1 | siud/siud |
| crm_event_log | <1M | id | crm_channels, crm_conversations, crm_leads, crm_webhook_subscriptions | on | A1 | 1 | siud/siud |
| crm_filter_views | 0 | id | auth.users | on | S1 I1 U1 D1 | — | siud/siud |
| crm_follow_up_tracker | 0 | id | crm_leads | on | A1 | — | siud/siud |
| crm_funnel_stages | 0 | id | — | on | S1 I1 U1 D1 | 1 | siud/siud |
| crm_funnels | 0 | id | — | on | A1 | 1 | siud/siud |
| crm_instagram_comment_events | 0 | id | crm_channels, crm_conversations, crm_leads, crm_messages, stores | on | A1 | 1 | siud/siud |
| crm_instagram_media_snapshots | 0 | id | crm_channels, stores | on | A1 | 1 | siud/siud |
| crm_lead_custom_field_values | 0 | id | crm_custom_fields, crm_leads, stores | on | A1 | 1 | siud/siud |
| crm_lead_identities | 0 | id | crm_leads | on | A1 | 1 | siud/siud |
| crm_lead_stage_history | 0 | id | crm_leads | on | A1 | 1 | siud/siud |
| crm_leads | <10k | id | crm_channels | on | A1 | 7 ⚡ | siud/siud |
| crm_message_templates | 0 | id | crm_channels, stores | on | A1 | 1 | siud/siud |
| crm_messages | <100k | id | crm_conversations, crm_leads, auth.users | on | A1 | 3 | siud/siud |
| crm_meta_ads_attributions | <1k | id | crm_meta_ads_groups, crm_leads, crm_messages, stores | on | A1 | — | siud/siud |
| crm_meta_ads_groups | <100 | id | stores | on | A1 | 1 | siud/siud |
| crm_public_registration_links | 0 | id | crm_leads, stores | on | A1 | 1 | siud/siud |
| crm_scheduled_messages | 0 | id | crm_conversations, crm_leads | on | A1 | 2 | siud/siud |
| crm_settings | 0 | id | — | on | S1 I1 U1 D1 | — | siud/siud |
| crm_uaz_avatar_jobs | <10k | id | crm_channels, crm_conversations, crm_leads, stores | on | — | — | ·/· |
| crm_ui_preferences | 0 | id | — | on | A2 | 2 | siud/siud |
| crm_utm_config | 0 | id | crm_channels, stores | on | A1 | 1 | siud/siud |
| crm_webhook_subscriptions | 0 | id | — | on | A1 | 1 | siud/siud |
| customers | <1k | id | — | on | S1 I1 U1 D1 | 1 | siud/siud |
| debt_payments | <1k | id | debts | on | A1 | 2 | siud/siud |
| debts | <100 | id | customers, sales | on | A1 | 3 | siud/siud |
| device_catalog | 0 | id | auth.users | on | S1 I1 U1 D1 | 1 | siud/siud |
| finance_categories | <100 | id | — | on | S1 I1 U1 D1 | 1 | siud/siud |
| lead_state | <100 | lead_id | crm_leads | on | S1 I1 U1 | 1 | siud/siud |
| parts_inventory | 0 | id | — | on | S1 I1 U1 D1 | 1 | siud/siud |
| payable_debt_payments | <100 | id | payable_debts | on | A1 | 2 | siud/siud |
| payable_debts | <100 | id | creditors, sales | on | A1 | 4 | siud/siud |
| payment_methods | <1k | id | transactions, stock_reservations, sales | on | S1 I1 U1 D1 | — | siud/siud |
| push_subscriptions | <100 | id | stores, auth.users | on | A1 | — | siud/siud |
| reservation_message_settings | 0 | id | — | on | S1 A1 | 1 | siud/siud |
| sale_items | <1k | id | sales, stock_items | on | S1 I1 U1 D1 | 1 | siud/siud |
| sale_trade_in_items | <1k | id | sales, stock_items | on | S1 I1 U1 D1 | — | siud/siud |
| sales | <1k | id | crm_leads, customers, sellers, stores, stock_items | on | S1 I1 U1 D1 | 5 | siud/siud |
| sellers | <100 | id | auth.users, stores | on | S1 I1 U1 D1 | — | siud/siud |
| simulator_trade_in_adjustments | 0 | id | — | on | S1 I1 U1 D1 | 1 | siud/siud |
| simulator_trade_in_values | 0 | id | — | on | S1 I1 U1 D1 | 1 | siud/siud |
| stock_items | <1k | id | stores | on | S1 I1 U1 D1 | — | siud/siud |
| stock_reservations | <100 | id | auth.users, transactions, sellers, sales, stock_items | on | S1 I1 U1 | 1 | siud/siud |
| stores | 0 | id | — | on | S1 I1 U1 D1 | — | siud/siud |
| transactions | <10k | id | debt_payments, payable_debt_payments, sales | on | A1 | 1 | siud/siud |
| user_access_roles | 0 | user_id | auth.users | on | S1 I1 U1 D1 | 1 | siud/siud |
| user_consents | <100 | id | auth.users | on | S1 I1 U1 | — | ·/siu |
| user_profiles | 0 | id | auth.users, sellers | on | S1 I1 U1 D1 | — | siud/siud |
| warranty_public_tokens | 0 | id | auth.users, sales | on | S1 I1 U1 D1 | — | siud/siud |

## Storage
storage.objects: 15 políticas (S3 I4 U3 D4 A1) → `tabelas/storage.objects.md`

## Funções (146) → `funcoes.md`
private.admin_agent_assert_admin*, private.customers_normalize_birth_date, private.normalize_birth_day_month, private.transfer_between_accounts_impl*, add_lead_note*, admin_agent_account_balances*, admin_agent_create_creditor*, admin_agent_create_customer*, admin_agent_create_sale*, admin_agent_create_stock_item*, admin_agent_delete_stock_item*, admin_agent_delete_transaction*, admin_agent_financial_summary*, admin_agent_inventory_summary*, admin_agent_pay_payable_debt*, admin_agent_receive_debt_payment*, admin_agent_register_transaction*, admin_agent_release_reservation*, admin_agent_reserve_stock*, admin_agent_sales_summary*, admin_agent_transfer*, admin_agent_update_customer*, admin_agent_update_stock_item*, admin_agent_update_transaction*, admin_agent_upsert_device_catalog*, admin_agent_upsert_finance_category*, app_set_updated_at, bulk_update_leads*, cancel_broadcast*, cancel_sale*, cancel_transaction*, claim_crm_uaz_avatar_jobs, cleanup_stale_push_subscriptions*, compare_phones, complete_crm_uaz_avatar_job, create_sale_full*, crm_ad_creative_signature, crm_ad_source_app, crm_ads_is_probable_image_url, crm_after_message_insert, crm_apply_channel_to_conversation*, crm_backfill_sale_ads_origin_from_phone_match*, crm_br_phone_match_key, crm_build_lead_summary_operational, crm_build_lead_summary_short, crm_can_access_store*, crm_default_sales_stage, crm_event_log_sync_lead_last_event*, crm_fanout_event_log*, crm_identity_fallback_phone, crm_jsonb_to_text_array, crm_lead_first_name, crm_lead_purchase_sync_trigger*, crm_leads_sync_enriched_columns*, crm_messages_sync_lead_last_message_content*, crm_refresh_lead_purchase_metrics*, crm_refresh_purchase_metrics_for_customer*, crm_sales_purchase_sync_trigger*, crm_set_default_funnel_fields*, crm_set_updated_at, crm_sync_lead_attendance_from_conversation*, crm_sync_lead_store_to_related_tables, crm_trg_attribute_lead_ad*, crm_ui_preferences_set_updated_at, crm_upsert_ad_attribution*, crm_upsert_lead_by_identity*, crm_upsert_lead_by_identity_rpc*, current_role*, current_store_id*, customer_ids_by_normalized_cpf, delete_debt_cascade*, enqueue_crm_uaz_avatar_job, generate_composite_lead_id, get_broadcast_stats*, get_cashback_summary*, get_crm_ads_dashboard*, get_crm_statistics*, get_lead_custom_values*, get_lead_full_data*, get_lead_state*, get_store_custom_fields*, handle_debt_after_delete*, handle_debt_after_insert*, handle_debt_after_update*, handle_debt_payment_after_delete*, handle_debt_payment_after_insert*, handle_payable_debt_after_delete*, handle_payable_debt_after_insert*, handle_payable_debt_after_update*, handle_payable_debt_payment_after_delete*, handle_payable_debt_payment_after_insert*, handle_payment_method_after_insert*, handle_sale_after_delete_cleanup*, handle_sale_after_insert*, handle_sale_before_delete*, handle_sale_item_after_insert*, handle_transaction_after_delete*, increment_unread_count, is_valid_card_fee_rates, mark_lead_as_customer*, move_crm_lead_stage*, normalize_phone, pdv_apply_reservation_deposit_payments*, pdv_assert_sale_payload*, pdv_create_sale_financial_side_effects*, pdv_create_sale_trade_in_rows*, pdv_hydrate_sale_json*, pdv_insert_sale_full_payload*, pdv_rebuild_sale_full_payload*, prepare_broadcast_recipients*, preview_campaign_audience*, record_ai_turn_event*, release_stock_reservation*, remove_stock_item_cost*, reservation_deposit_account, reserve_stock_item*, resolve_crm_default_store_id*, resolve_crm_lead_for_sale*, sales_backfill_ads_origin_from_phone_match*, sales_set_crm_lead_id*, search_crm_messages*, search_leads*, set_lead_custom_field*, sync_crm_campaign_tag_mappings*, test_webhook_subscription*, tg_set_card_fee_settings_updated_at, tg_set_creditors_updated_at, tg_set_device_catalog_updated_at, tg_set_finance_categories_updated_at, tg_set_lead_state_updated_at, tg_set_parts_inventory_updated_at, tg_set_payable_debts_updated_at, tg_set_simulator_trade_in_updated_at, tg_set_stock_reservations_updated_at, touch_reservation_message_settings, transfer_between_accounts, transfer_lead_store*, trigger_new_lead_avatar*, update_campaign_delivery_metrics*, update_lead_basic_data*, update_lead_funnel*, update_lead_memory*, update_sale_full*, upsert_crm_lead*, upsert_lead_state*, upsert_repasse_commerce_state*
(* = SECURITY DEFINER)

Extensões: pg_cron 1.6.4, pg_stat_statements 1.11, pgcrypto 1.3, supabase_vault 0.3.1, uuid-ossp 1.1

> Legenda: Políticas S/I/U/D/A = SELECT/INSERT/UPDATE/DELETE/ALL · anon/auth = grants s/i/u/d · ⚡ = gatilho com efeito externo (http, fila, notify).
