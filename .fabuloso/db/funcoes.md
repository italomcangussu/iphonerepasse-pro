# Funções
> 146 funções nos schemas private, public. Corpo completo sob demanda: `select pg_get_functiondef('<schema.nome>(<args>)'::regprocedure)`.

| Função | Argumentos | Retorno | Ling. | Segurança | anon | Nota |
|---|---|---|---|---|---|---|
| private.admin_agent_assert_admin | `p_actor uuid` | `void` | plpgsql | DEFINER | não |  |
| private.customers_normalize_birth_date | — | `trigger` | plpgsql | invoker | sim |  |
| private.normalize_birth_day_month | `p_value text` | `text` | plpgsql | invoker | sim |  |
| private.transfer_between_accounts_impl | `p_amount numeric, p_from text, p_to text` | `SETOF transactions` | plpgsql | DEFINER | não |  |
| public.add_lead_note | `p_lead_id text, p_note text, p_created_by uuid` | `uuid` | plpgsql | DEFINER | sim |  |
| public.admin_agent_account_balances | — | `jsonb` | sql | DEFINER | não |  |
| public.admin_agent_create_creditor | `p_actor uuid, p_payload jsonb` | `jsonb` | plpgsql | DEFINER | não |  |
| public.admin_agent_create_customer | `p_actor uuid, p_payload jsonb` | `jsonb` | plpgsql | DEFINER | não |  |
| public.admin_agent_create_sale | `p_actor uuid, p_payload jsonb` | `jsonb` | plpgsql | DEFINER | não |  |
| public.admin_agent_create_stock_item | `p_actor uuid, p_payload jsonb` | `jsonb` | plpgsql | DEFINER | não |  |
| public.admin_agent_delete_stock_item | `p_actor uuid, p_id text` | `jsonb` | plpgsql | DEFINER | não |  |
| public.admin_agent_delete_transaction | `p_actor uuid, p_id text` | `jsonb` | plpgsql | DEFINER | não |  |
| public.admin_agent_financial_summary | `p_from timestamp with time zone, p_to timestamp with time zone` | `jsonb` | sql | DEFINER | não |  |
| public.admin_agent_inventory_summary | — | `jsonb` | sql | DEFINER | não |  |
| public.admin_agent_pay_payable_debt | `p_actor uuid, p_payable_debt_id text, p_amount numeric, p_method text, p_account text, p_…` | `jsonb` | plpgsql | DEFINER | não |  |
| public.admin_agent_receive_debt_payment | `p_actor uuid, p_debt_id text, p_amount numeric, p_method text, p_account text, p_notes te…` | `jsonb` | plpgsql | DEFINER | não |  |
| public.admin_agent_register_transaction | `p_actor uuid, p_type text, p_category text, p_amount numeric, p_account text, p_descripti…` | `jsonb` | plpgsql | DEFINER | não |  |
| public.admin_agent_release_reservation | `p_actor uuid, p_stock_item_id text, p_refund_deposit boolean` | `jsonb` | plpgsql | DEFINER | não |  |
| public.admin_agent_reserve_stock | `p_actor uuid, p_stock_item_id text, p_payload jsonb` | `jsonb` | plpgsql | DEFINER | não |  |
| public.admin_agent_sales_summary | `p_from timestamp with time zone, p_to timestamp with time zone` | `jsonb` | sql | DEFINER | não |  |
| public.admin_agent_transfer | `p_actor uuid, p_amount numeric, p_from text, p_to text` | `jsonb` | plpgsql | DEFINER | não |  |
| public.admin_agent_update_customer | `p_actor uuid, p_id text, p_patch jsonb` | `jsonb` | plpgsql | DEFINER | não |  |
| public.admin_agent_update_stock_item | `p_actor uuid, p_id text, p_patch jsonb` | `jsonb` | plpgsql | DEFINER | não |  |
| public.admin_agent_update_transaction | `p_actor uuid, p_id text, p_patch jsonb` | `jsonb` | plpgsql | DEFINER | não |  |
| public.admin_agent_upsert_device_catalog | `p_actor uuid, p_payload jsonb` | `jsonb` | plpgsql | DEFINER | não |  |
| public.admin_agent_upsert_finance_category | `p_actor uuid, p_payload jsonb` | `jsonb` | plpgsql | DEFINER | não |  |
| public.app_set_updated_at | — | `trigger` | plpgsql | invoker | sim |  |
| public.bulk_update_leads | `p_store_id text, p_filters jsonb, p_patch jsonb` | `integer` | plpgsql | DEFINER | sim |  |
| public.cancel_broadcast | `p_broadcast_id uuid` | `jsonb` | plpgsql | DEFINER | sim |  |
| public.cancel_sale | `p_sale_id text` | `void` | plpgsql | DEFINER | não |  |
| public.cancel_transaction | `p_transaction_id text` | `void` | plpgsql | DEFINER | sim |  |
| public.claim_crm_uaz_avatar_jobs | `p_limit integer, p_lease_seconds integer` | `SETOF crm_uaz_avatar_jobs` | plpgsql | invoker | não |  |
| public.cleanup_stale_push_subscriptions | `p_inactive_retention_days integer, p_active_stale_days integer` | `integer` | plpgsql | DEFINER | não | Deactivates stale push devices and deletes long-inactive subscriptions. Returns rows deleted. See PRD US-012. |
| public.compare_phones | `phone1 text, phone2 text` | `boolean` | plpgsql | invoker | sim |  |
| public.complete_crm_uaz_avatar_job | `p_job_id uuid, p_store_id text, p_attempt integer, p_status text, p_error_code text, p_av…` | `boolean` | plpgsql | invoker | não |  |
| public.create_sale_full | `p_payload jsonb` | `jsonb` | plpgsql | DEFINER | não |  |
| public.crm_ad_creative_signature | `p_source_campaign_id text, p_source_campaign_title text, p_source_ad_context jsonb` | `text` | sql | invoker | sim |  |
| public.crm_ad_source_app | `p_source text, p_ctx jsonb` | `text` | sql | invoker | sim |  |
| public.crm_ads_is_probable_image_url | `p_url text` | `boolean` | sql | invoker | não |  |
| public.crm_after_message_insert | — | `trigger` | plpgsql | invoker | sim |  |
| public.crm_apply_channel_to_conversation | `p_conversation_id uuid, p_channel_id uuid, p_changed_by uuid, p_reason text` | `TABLE(conversation_id uuid, lead_id text, from_channel_id u…` | plpgsql | DEFINER | sim |  |
| public.crm_backfill_sale_ads_origin_from_phone_match | `p_sale_id text` | `void` | plpgsql | DEFINER | não |  |
| public.crm_br_phone_match_key | `p_phone text` | `text` | sql | invoker | não |  |
| public.crm_build_lead_summary_operational | `p_name text, p_phone text, p_sales_stage text, p_intent text, p_conversation_status text,…` | `text` | sql | invoker | não |  |
| public.crm_build_lead_summary_short | `p_name text, p_phone text, p_sales_stage text, p_intent text` | `text` | sql | invoker | não |  |
| public.crm_can_access_store | `p_store_id text` | `boolean` | plpgsql | DEFINER | sim |  |
| public.crm_default_sales_stage | `p_funnel_stage text` | `text` | sql | invoker | não |  |
| public.crm_event_log_sync_lead_last_event | — | `trigger` | plpgsql | DEFINER | não |  |
| public.crm_fanout_event_log | `p_limit integer` | `integer` | plpgsql | DEFINER | sim |  |
| public.crm_identity_fallback_phone | `p_identity_type text, p_identity_value text` | `text` | sql | invoker | sim |  |
| public.crm_jsonb_to_text_array | `p_value jsonb` | `text[]` | sql | invoker | sim |  |
| public.crm_lead_first_name | `p_name text` | `text` | sql | invoker | não |  |
| public.crm_lead_purchase_sync_trigger | — | `trigger` | plpgsql | DEFINER | sim |  |
| public.crm_leads_sync_enriched_columns | — | `trigger` | plpgsql | DEFINER | não |  |
| public.crm_messages_sync_lead_last_message_content | — | `trigger` | plpgsql | DEFINER | não |  |
| public.crm_refresh_lead_purchase_metrics | `p_lead_id text` | `void` | plpgsql | DEFINER | não |  |
| public.crm_refresh_purchase_metrics_for_customer | `p_customer_id text` | `void` | plpgsql | DEFINER | não |  |
| public.crm_sales_purchase_sync_trigger | — | `trigger` | plpgsql | DEFINER | não |  |
| public.crm_set_default_funnel_fields | — | `trigger` | plpgsql | DEFINER | sim |  |
| public.crm_set_updated_at | — | `trigger` | plpgsql | invoker | sim |  |
| public.crm_sync_lead_attendance_from_conversation | — | `trigger` | plpgsql | DEFINER | sim |  |
| public.crm_sync_lead_store_to_related_tables | — | `trigger` | plpgsql | invoker | sim |  |
| public.crm_trg_attribute_lead_ad | — | `trigger` | plpgsql | DEFINER | sim |  |
| public.crm_ui_preferences_set_updated_at | — | `trigger` | plpgsql | invoker | sim |  |
| public.crm_upsert_ad_attribution | `p_lead_id text` | `void` | plpgsql | DEFINER | sim |  |
| public.crm_upsert_lead_by_identity | `p_store_id text, p_identity_type text, p_identity_value text, p_name text, p_channel_id u…` | `text` | plpgsql | DEFINER | sim |  |
| public.crm_upsert_lead_by_identity_rpc | `p_store_id text, p_identity_type text, p_identity_value text, p_name text, p_channel_id u…` | `text` | plpgsql | DEFINER | sim |  |
| public.current_role | — | `text` | sql | DEFINER | sim |  |
| public.current_store_id | — | `text` | sql | DEFINER | sim |  |
| public.customer_ids_by_normalized_cpf | `input_cpf text` | `TABLE(id text, name text, cpf text)` | sql | invoker | sim |  |
| public.delete_debt_cascade | `p_debt_id text` | `void` | plpgsql | DEFINER | não |  |
| public.enqueue_crm_uaz_avatar_job | `p_store_id text, p_lead_id text, p_channel_id uuid, p_conversation_id uuid, p_talk_id tex…` | `uuid` | plpgsql | invoker | não |  |
| public.generate_composite_lead_id | — | `trigger` | plpgsql | invoker | sim |  |
| public.get_broadcast_stats | `p_broadcast_id uuid` | `jsonb` | plpgsql | DEFINER | sim |  |
| public.get_cashback_summary | `p_store_id text` | `TABLE(lead_id text, lead_name text, lifetime_value numeric,…` | sql | DEFINER | sim |  |
| public.get_crm_ads_dashboard | `p_store_id text` | `jsonb` | plpgsql | DEFINER | sim |  |
| public.get_crm_statistics | `p_store_id text` | `jsonb` | plpgsql | DEFINER | sim |  |
| public.get_lead_custom_values | `p_lead_id text` | `jsonb` | sql | DEFINER | sim |  |
| public.get_lead_full_data | `p_lead_id text` | `jsonb` | plpgsql | DEFINER | sim |  |
| public.get_lead_state | `p_lead_id text` | `jsonb` | sql | DEFINER | não |  |
| public.get_store_custom_fields | `p_store_id text` | `SETOF crm_custom_fields` | sql | DEFINER | sim |  |
| public.handle_debt_after_delete | — | `trigger` | plpgsql | DEFINER | sim |  |
| public.handle_debt_after_insert | — | `trigger` | plpgsql | DEFINER | sim |  |
| public.handle_debt_after_update | — | `trigger` | plpgsql | DEFINER | sim |  |
| public.handle_debt_payment_after_delete | — | `trigger` | plpgsql | DEFINER | sim |  |
| public.handle_debt_payment_after_insert | — | `trigger` | plpgsql | DEFINER | sim |  |
| public.handle_payable_debt_after_delete | — | `trigger` | plpgsql | DEFINER | sim |  |
| public.handle_payable_debt_after_insert | — | `trigger` | plpgsql | DEFINER | sim |  |
| public.handle_payable_debt_after_update | — | `trigger` | plpgsql | DEFINER | sim |  |
| public.handle_payable_debt_payment_after_delete | — | `trigger` | plpgsql | DEFINER | sim |  |
| public.handle_payable_debt_payment_after_insert | — | `trigger` | plpgsql | DEFINER | sim |  |
| public.handle_payment_method_after_insert | — | `trigger` | plpgsql | DEFINER | sim |  |
| public.handle_sale_after_delete_cleanup | — | `trigger` | plpgsql | DEFINER | sim |  |
| public.handle_sale_after_insert | — | `trigger` | plpgsql | DEFINER | sim |  |
| public.handle_sale_before_delete | — | `trigger` | plpgsql | DEFINER | não |  |
| public.handle_sale_item_after_insert | — | `trigger` | plpgsql | DEFINER | sim |  |
| public.handle_transaction_after_delete | — | `trigger` | plpgsql | DEFINER | sim |  |
| public.increment_unread_count | `p_conversation_id uuid, p_last_customer_message_at timestamp with time zone` | `void` | plpgsql | invoker | sim |  |
| public.is_valid_card_fee_rates | `input jsonb` | `boolean` | sql | invoker | sim |  |
| public.mark_lead_as_customer | `p_lead_id text, p_customer_id text` | `jsonb` | plpgsql | DEFINER | sim |  |
| public.move_crm_lead_stage | `p_lead_id text, p_to_stage text, p_to_funnel_id uuid, p_changed_by uuid, p_notes text` | `TABLE(lead_id text, from_stage text, to_stage text, from_fu…` | plpgsql | DEFINER | sim |  |
| public.normalize_phone | `phone text` | `text` | plpgsql | invoker | sim |  |
| public.pdv_apply_reservation_deposit_payments | `p_sale_id text, p_sale_date timestamp with time zone` | `void` | plpgsql | DEFINER | não |  |
| public.pdv_assert_sale_payload | `p_payload jsonb` | `void` | plpgsql | DEFINER | sim |  |
| public.pdv_create_sale_financial_side_effects | `p_sale_id text` | `void` | plpgsql | DEFINER | sim |  |
| public.pdv_create_sale_trade_in_rows | `p_sale_id text, p_payload jsonb, p_sale_date timestamp with time zone` | `void` | plpgsql | DEFINER | sim |  |
| public.pdv_hydrate_sale_json | `p_sale_id text` | `jsonb` | sql | DEFINER | sim |  |
| public.pdv_insert_sale_full_payload | `p_payload jsonb` | `void` | plpgsql | DEFINER | não |  |
| public.pdv_rebuild_sale_full_payload | `p_sale_id text, p_payload jsonb` | `void` | plpgsql | DEFINER | não |  |
| public.prepare_broadcast_recipients | `p_broadcast_id uuid` | `integer` | plpgsql | DEFINER | sim |  |
| public.preview_campaign_audience | `p_store_id text, p_filters jsonb, p_limit integer` | `TABLE(lead_id text, name text, phone text, funnel_stage tex…` | sql | DEFINER | sim |  |
| public.record_ai_turn_event | `p_turn_id text, p_lead_id text, p_conversation_id uuid, p_action text, p_outcome text, p_…` | `jsonb` | plpgsql | DEFINER | sim |  |
| public.release_stock_reservation | `p_stock_item_id text, p_refund_deposit boolean` | `stock_reservations` | plpgsql | DEFINER | não |  |
| public.remove_stock_item_cost | `p_cost_id text` | `void` | plpgsql | DEFINER | não |  |
| public.reservation_deposit_account | `p_method text` | `text` | sql | invoker | sim |  |
| public.reserve_stock_item | `p_stock_item_id text, p_payload jsonb` | `stock_reservations` | plpgsql | DEFINER | não |  |
| public.resolve_crm_default_store_id | — | `text` | sql | DEFINER | sim |  |
| public.resolve_crm_lead_for_sale | `p_customer_id text, p_store_id text, p_explicit_lead_id text, p_conservative boolean` | `text` | plpgsql | DEFINER | não |  |
| public.sales_backfill_ads_origin_from_phone_match | — | `trigger` | plpgsql | DEFINER | não |  |
| public.sales_set_crm_lead_id | — | `trigger` | plpgsql | DEFINER | não |  |
| public.search_crm_messages | `p_store_id text, p_query text, p_limit integer` | `TABLE(conversation_id uuid, message_id uuid, snippet text, …` | sql | DEFINER | sim |  |
| public.search_leads | `p_store_id text, p_filters jsonb, p_limit integer, p_offset integer` | `jsonb` | plpgsql | DEFINER | sim |  |
| public.set_lead_custom_field | `p_lead_id text, p_field_id uuid, p_value jsonb` | `jsonb` | plpgsql | DEFINER | sim |  |
| public.sync_crm_campaign_tag_mappings | `p_store_id text, p_mappings jsonb` | `jsonb` | plpgsql | DEFINER | sim |  |
| public.test_webhook_subscription | `p_subscription_id uuid` | `jsonb` | plpgsql | DEFINER | sim |  |
| public.tg_set_card_fee_settings_updated_at | — | `trigger` | plpgsql | invoker | sim |  |
| public.tg_set_creditors_updated_at | — | `trigger` | plpgsql | invoker | sim |  |
| public.tg_set_device_catalog_updated_at | — | `trigger` | plpgsql | invoker | sim |  |
| public.tg_set_finance_categories_updated_at | — | `trigger` | plpgsql | invoker | sim |  |
| public.tg_set_lead_state_updated_at | — | `trigger` | plpgsql | invoker | sim |  |
| public.tg_set_parts_inventory_updated_at | — | `trigger` | plpgsql | invoker | sim |  |
| public.tg_set_payable_debts_updated_at | — | `trigger` | plpgsql | invoker | sim |  |
| public.tg_set_simulator_trade_in_updated_at | — | `trigger` | plpgsql | invoker | sim |  |
| public.tg_set_stock_reservations_updated_at | — | `trigger` | plpgsql | invoker | sim |  |
| public.touch_reservation_message_settings | — | `trigger` | plpgsql | invoker | não |  |
| public.transfer_between_accounts | `p_amount numeric, p_from text, p_to text` | `SETOF transactions` | sql | invoker | não |  |
| public.transfer_lead_store | `p_lead_id text, p_to_store_id text` | `jsonb` | plpgsql | DEFINER | sim |  |
| public.trigger_new_lead_avatar | — | `trigger` | plpgsql | DEFINER | sim |  |
| public.update_campaign_delivery_metrics | `p_group_key uuid, p_payload jsonb` | `jsonb` | plpgsql | DEFINER | sim |  |
| public.update_lead_basic_data | `p_lead_id text, p_name text, p_email text, p_tags jsonb` | `jsonb` | plpgsql | DEFINER | sim |  |
| public.update_lead_funnel | `p_lead_id text, p_funnel_stage text, p_intent text, p_reason text, p_funnel_id uuid` | `jsonb` | plpgsql | DEFINER | sim |  |
| public.update_lead_memory | `p_lead_id text, p_summary_short text, p_summary_operational text` | `jsonb` | plpgsql | DEFINER | não |  |
| public.update_sale_full | `p_sale_id text, p_payload jsonb` | `jsonb` | plpgsql | DEFINER | não |  |
| public.upsert_crm_lead | `p_store_id text, p_phone text, p_name text, p_contact_id text, p_entity_id text, p_channe…` | `text` | plpgsql | DEFINER | sim |  |
| public.upsert_lead_state | `p_lead_id text, p_state jsonb` | `jsonb` | plpgsql | DEFINER | não |  |
| public.upsert_repasse_commerce_state | `p_lead_id text, p_expected_version bigint, p_state jsonb, p_tradein jsonb, p_quotes jsonb` | `jsonb` | plpgsql | DEFINER | sim |  |
