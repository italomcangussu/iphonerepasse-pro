DO $$
DECLARE
  t text;
  tables text[] := ARRAY[
    'business_profile',
    'card_fee_settings',
    'sale_items',
    'payment_methods',
    'sale_trade_in_items',
    'sales',
    'transactions',
    'debts',
    'debt_payments',
    'stock_items',
    'customers',
    'sellers',
    'stores',
    'costs',
    'parts_inventory',
    'device_catalog',
    'cost_history',
    'finance_categories',
    'creditors',
    'payable_debts',
    'payable_debt_payments'
  ];
BEGIN
  -- Create the publication if it does not exist (it is created by default by Supabase)
  IF NOT EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    CREATE PUBLICATION supabase_realtime;
  END IF;

  FOR t IN SELECT unnest(tables) LOOP
    IF NOT EXISTS (
      SELECT 1 
      FROM pg_publication_tables 
      WHERE pubname = 'supabase_realtime' 
        AND schemaname = 'public' 
        AND tablename = t
    ) THEN
      EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE public.%I', t);
    END IF;
  END LOOP;
END
$$;
