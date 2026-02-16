begin;

create temporary table if not exists tmp_import_feb_2026_sales (
  line_no integer primary key,
  day integer not null,
  cost_total numeric not null,
  sale_total numeric not null,
  model text not null,
  ls_flag text not null,
  imei text,
  payment_raw text,
  customer_name text not null,
  cpf_raw text,
  phone_raw text,
  seller_name text not null,
  city text not null
);

truncate table tmp_import_feb_2026_sales;

insert into tmp_import_feb_2026_sales (
  line_no, day, cost_total, sale_total, model, ls_flag, imei, payment_raw,
  customer_name, cpf_raw, phone_raw, seller_name, city
) values
  (1, 1, 4650.00, 5850.00, '16G 256GB PRETO ANATEL', 'L', '351267385156559', 'CELULAR+CARTAO', 'IDERLAN RODRIGUES BARROS', '034464063-95', '(86)981117033', 'RAILY', 'Fortaleza'),
  (2, 1, 3800.00, 3990.00, '14 PRO 256GB PRETO 100%', 'S', '358849702479062', 'CARTAO+PIX', 'LUAN LUCAS SILVA SENA', '064244443-94', '(85)982070438', 'VICTOR', 'Fortaleza'),
  (3, 1, 4300.00, 5500.00, '15PM 256GB AZUL 91%', 'S', '354773167923337', 'CELULAR+CARTAO', 'LEANDRO DE HOLANDA DA ROCHA', '055716983-65', '(85)998504450', 'RAILY', 'Fortaleza'),
  (4, 1, 4750.00, 5600.00, '15PM 256GB NATURAL 88%', 'S', '351071526314469', 'CARTAO', 'FRANCISCO RONY DO NASCIMENTO FONTINELE', '035279423-27', '(85)987818378', 'RAILY', 'Fortaleza'),
  (5, 2, 8400.00, 9000.00, '17PM 256GB AZUL', 'L', '358051321075054', 'CARTAO+PIX', 'FRANCISCO JOSE ARAUJO MELO', '040658693-40', '(88)988819693', 'JULIO', 'Sobral'),
  (6, 2, 4700.00, 5000.00, '15PM 256GB AZUL 100%', 'S', '351016867979867', 'CELULAR+CARTAO', 'NATERCIA TOMAZ', '026242953-56', '(88)997293061', 'VICTOR', 'Sobral'),
  (7, 2, 4600.00, 5750.00, '16G 256GB PRETO ANATEL', 'L', '351267381130756', 'CELULAR+PIX', 'BIANCA CAROLINE SOUSA PONTES', '607835943-64', '(88)996903376', 'VICTOR', 'Sobral'),
  (8, 3, 9000.00, 9600.00, '17PM 256GB BRANCO', 'L', '359614547623194', 'CELULAR+CARTAO', 'RANDY MARTINEZ', '08469065-14', '(88)997395589', 'VICTOR', 'Sobral'),
  (9, 3, 8500.00, 9100.00, '17PM 256GB LARANJA', 'L', '356764175309880', 'CELULAR+CARTAO', 'RANDY MARTINEZ', '08469065-14', '(88)997395589', 'VICTOR', 'Sobral'),
  (10, 3, 3000.00, 3600.00, '13G 256GB BRANCO ANATEL', 'L', '355602549045031', 'PIX', 'AMIGO IGOR', '', '', 'IGOR', 'Fortaleza'),
  (11, 3, 1000.00, 1450.00, '11G 64GB BRANCO 100%', 'S', '355091841251762', 'CARTAO+PIX', 'FRANCISCO ANDRE SOARES MENDES', '55400173-07', '(88)981460904', 'EDSON', 'Sobral'),
  (12, 3, 1475.00, 1950.00, '12G 128GB AZUL 100%', 'S', '350197044972388', 'CARTAO+PIX', 'MATHEUS BARROS MOREIRA', '623513483-54', '(88)993071963', 'KAUAN', 'Sobral'),
  (13, 3, 8500.00, 8900.00, '17PM 256GB AZUL', 'L', '355478875876160', 'CELULAR+CARTAO', 'DRA IANA CARNEIRO', '', '(88)981178181', 'VICTOR', 'Sobral'),
  (14, 3, 9900.00, 10400.00, '17PM 512GB LARANJA', 'L', '355988210975840', 'CELULAR+PIX', 'KETLEN SOUTO', '004697229-32', '(84)988968456', 'VICTOR', 'Fortaleza'),
  (15, 3, 1140.00, 1860.00, '11PM 64GB 100%', 'S', '353887108900510', 'CARTAO', 'KARINA BARBOSA DE SOUSA', '044417873-24', '(88)994631544', 'THALLES', 'Sobral'),
  (16, 3, 8400.00, 8900.00, '17PM 256GB LARANJA', 'L', '359912581805986', 'PIX', 'FRANCISCO ANTONIO BARROS', '726172503-00', '(88)999971000', 'VICTOR', 'Sobral'),
  (17, 4, 900.00, 1250.00, '11G 64GB BRANCO 100%', 'S', '352924112597633', 'PIX', 'MARIANA SOUSA ALBUQUERQUE', '028744113-02', '(85)984721927', 'VICTOR', 'Fortaleza'),
  (18, 4, 2850.00, 3400.00, '16E 128GB PRETO 92%', 'S', '355441318326490', 'CELULAR+PIX+CARTAO', 'JOCIELE VASCONCELOS MOURA', '051252563-31', '(88)998565043', 'VINICIUS', 'Sobral'),
  (19, 5, 1950.00, 2500.00, '13G 128GB PRETO 100%', 'S', '357474409626518', 'CELULAR+CARTAO', 'MARIA CLARA DO NASCIMENTO AZEVEDO', '606221323-26', '(88)988572389', 'VICTOR', 'Sobral'),
  (20, 5, 7500.00, 8200.00, '17PM 256GB LARANJA 100%', 'S', '359802891700367', 'CELULAR+CARTAO', 'ERMESSON TORRES FARIAS', '991903203-44', '(88)997145672', 'VICTOR', 'Sobral'),
  (21, 6, 3830.00, 4500.00, '14PM 128GB GOLD 100%', 'S', '353791986882576', 'CELULAR+PIX', 'GABRIEL CAZELY ALVES BEZERRA', '573287868-84', '(11)989866020', 'RAILY', 'Fortaleza'),
  (22, 6, 5750.00, 6500.00, '16PM 256GB DESERT 100%', 'S', '358536506866582', 'CELULAR+PIX+DINHEIRO', 'PAULO ROBERTO', '041649963-58', '(85)992016119', 'VICTOR', 'Sobral'),
  (23, 6, 1780.00, 3000.00, '13 PRO 256GB BRANCO 100%', 'S', '356133310487193', 'PIX', 'JOAO VICTOR DE SOUSA MELO', '627548693-79', '(88)994921854', 'LEAD', 'Sobral'),
  (24, 6, 8900.00, 9300.00, '17PM 256GB BRANCO', 'L', '355988213037374', 'CELULAR+PIX+DINHEIRO', 'JOSE HERALDO FREITAS DE SOUSA', '634397193-91', '(88)999426959', 'VICTOR', 'Sobral'),
  (25, 6, 8500.00, 8900.00, '17PM 256GB AZUL', 'L', '356605225840160', 'CELULAR+PIX', 'CAMILA HOLANDA CAMELO', '041152463-16', '(11)995435056', 'VICTOR', 'Sobral'),
  (26, 7, 3100.00, 4200.00, '16 PLUS 256GB ROSE 92%', 'S', '358922374371105', 'CELULAR+PIX', 'JOSE HERALDO FREITAS DE SOUSA', '634397193-91', '(88)999426959', 'VICTOR', 'Sobral'),
  (27, 7, 8500.00, 9300.00, '17PM 256GB LARANJA', 'L', '352116262262346', 'CELULAR+PIX', 'JOSE HERALDO FREITAS DE SOUSA', '634397193-91', '(88)999426959', 'VICTOR', 'Sobral'),
  (28, 7, 8400.00, 8800.00, '17PM 256GB LARANJA', 'L', '353263421883262', 'CELULAR+PIX', 'LINO CIDRAO DE LAVOR JUNIOR', '019689493-05', '(85)998581012', 'VICTOR', 'Fortaleza'),
  (29, 8, 2630.00, 3411.00, '13PM 128GB BRANCO 100%', 'S', '351243326146918', 'CARTAO', 'MONICA ISABEL MESQUITA PEREIRA', '002031743-30', '(88)998169857', 'VICTOR', 'Sobral'),
  (30, 10, 4800.00, 5490.00, '15PM 256GB NATURAL 86%', 'S', '356964990316900', 'CARTAO+PIX', 'FELIPE DA SILVA COELHO', '959004893-53', '(85)988956840', 'VICTOR', 'Sobral'),
  (31, 10, 9800.00, 10500.00, '17PM 512GB AZUL', 'L', '359802899567602', 'PIX+DINHEIRO', 'JOSE WALTER DO NASCIMENTO', '267631683-49', '(85)991119060', 'VICTOR', 'Fortaleza'),
  (32, 10, 3400.00, 4790.00, '14PM 256GB PRETO 100%', 'S', '350387758357286', 'CELULAR+PIX', 'MANUEL PEREIRA AGUIAR NETO', '603674483-86', '(88)993175489', 'KAUAN', 'Sobral'),
  (33, 10, 4400.00, 5400.00, '16 PRO 128GB PRETO 100%', 'S', '356043384572616', 'CELULAR+PIX+DINHEIRO', 'TCHENZO', '', '', 'VICTOR', 'Sobral'),
  (34, 10, 1200.00, 1750.00, 'MACBOOK AIR 2017 I5 8GB RAM 256GB SSD', 'S', '', '-', 'GABRIEL UNINTA', '', '', 'VICTOR', 'Sobral'),
  (35, 11, 2300.00, 3500.00, '14PM 128GB PRETO 87%', 'S', '358795289866058', 'PIX', 'MATHEUS SOUSA', '', '', 'VICTOR', 'Sobral'),
  (36, 11, 2500.00, 2850.00, '14G 128GB AZUL 100%', 'S', '358832595252887', 'CARTAO', 'ANTONIO DE SABOIA ROBERTO', '317760943-87', '(88)994023522', 'KAUAN', 'Sobral'),
  (37, 11, 5700.00, 6390.00, '16PM 256GB NATURAL 92%', 'S', '355706421215560', 'CELULAR+PIX+CARTAO', 'JOCELIA NASCIMENTO DE SALES', '078520903-36', '(88)981471330', 'LEAD', 'Sobral'),
  (38, 11, 5500.00, 6300.00, '17G 256GB BRANCO', 'L', '358334289098148', 'CELULAR+PIX+CARTAO', 'IZABEL EDUVIRGENS MAGALHAES E SILVA', '013693193-63', '(85)992982908', 'LEAD', 'Fortaleza'),
  (39, 12, 2935.00, 3790.00, '13PM 256GB GOLD 100%', 'S', '359456491312113', 'PIX', 'ZILNAR PEREIRA DIAS', '211265773-91', '(85)984142947', 'LEAD', 'Fortaleza');

create or replace function pg_temp.fold_text(v text)
returns text
language sql
immutable
as $$
  select regexp_replace(
    translate(
      upper(coalesce(v, '')),
      'ÁÀÂÃÄÉÈÊËÍÌÎÏÓÒÔÕÖÚÙÛÜÇÑ',
      'AAAAAEEEEIIIIOOOOOUUUUCN'
    ),
    '\s+',
    ' ',
    'g'
  );
$$;

create or replace function pg_temp.only_digits(v text)
returns text
language sql
immutable
as $$
  select regexp_replace(coalesce(v, ''), '\D', '', 'g');
$$;

do $$
declare
  r record;
  v_debts_before bigint;
  v_debt_payments_before bigint;
  v_debts_after bigint;
  v_debt_payments_after bigint;

  v_sale_date timestamptz;
  v_store_id text;
  v_seller_id text;
  v_customer_id text;
  v_existing_stock_id text;
  v_stock_id text;
  v_sale_id text;
  v_sale_item_id text;

  v_norm_city text;
  v_norm_seller text;
  v_norm_customer text;
  v_norm_model text;

  v_cpf text;
  v_phone text;
  v_imei text;
  v_capacity text;
  v_condition text;
  v_device_type text;
  v_stock_key text;
  v_sale_key text;

  v_payment_norm text;
  v_token text;
  v_mapped_method text;
  v_methods text[];
  v_method_count integer;
  v_base_amount numeric;
  v_amount numeric;
  v_payment_id text;
  v_idx integer;
begin
  select count(*) into v_debts_before from public.debts;
  select count(*) into v_debt_payments_before from public.debt_payments;

  for r in
    select *
    from tmp_import_feb_2026_sales
    order by line_no
  loop
    if r.day < 1 or r.day > 29 then
      raise exception 'Linha % com dia invalido: %', r.line_no, r.day;
    end if;

    if coalesce(r.sale_total, 0) <= 0 then
      raise exception 'Linha % com valor de venda invalido: %', r.line_no, r.sale_total;
    end if;

    v_sale_date := make_timestamptz(2026, 2, r.day, 12, 0, 0, 'UTC');
    v_norm_city := pg_temp.fold_text(r.city);
    v_norm_seller := pg_temp.fold_text(r.seller_name);
    v_norm_customer := pg_temp.fold_text(r.customer_name);
    v_norm_model := pg_temp.fold_text(r.model);

    select st.id
      into v_store_id
    from public.stores st
    where pg_temp.fold_text(st.name) = v_norm_city
       or pg_temp.fold_text(st.city) = v_norm_city
       or pg_temp.fold_text(st.city) like v_norm_city || '%'
       or pg_temp.fold_text(st.city) like '%' || v_norm_city || '%'
    order by case
      when pg_temp.fold_text(st.name) = v_norm_city then 0
      when pg_temp.fold_text(st.city) = v_norm_city then 1
      else 2
    end,
    st.id
    limit 1;

    if v_store_id is null then
      raise exception 'Linha % sem loja valida para cidade: %', r.line_no, r.city;
    end if;

    select s.id
      into v_seller_id
    from public.sellers s
    where pg_temp.fold_text(s.name) = v_norm_seller
      and s.store_id = v_store_id
    order by s.id
    limit 1;

    if v_seller_id is null then
      raise exception 'Linha % sem vendedor valido para loja/cidade: % (%).', r.line_no, r.seller_name, r.city;
    end if;

    v_cpf := pg_temp.only_digits(r.cpf_raw);
    v_phone := pg_temp.only_digits(r.phone_raw);

    v_customer_id := null;

    if v_cpf <> '' then
      select c.id
        into v_customer_id
      from public.customers c
      where pg_temp.only_digits(c.cpf) = v_cpf
      order by c.id
      limit 1;
    end if;

    if v_customer_id is null and v_phone <> '' then
      select c.id
        into v_customer_id
      from public.customers c
      where pg_temp.only_digits(c.phone) = v_phone
      order by c.id
      limit 1;
    end if;

    if v_customer_id is null then
      select c.id
        into v_customer_id
      from public.customers c
      where pg_temp.fold_text(c.name) = v_norm_customer
      order by c.id
      limit 1;
    end if;

    if v_customer_id is null then
      v_customer_id := 'cust_imp_fev_' || substr(md5(
        case
          when v_cpf <> '' then 'CPF|' || v_cpf
          when v_phone <> '' then 'PHONE|' || v_phone
          else 'NAME|' || v_norm_customer
        end
      ), 1, 20);

      insert into public.customers (
        id,
        name,
        cpf,
        phone,
        email,
        birth_date,
        purchases,
        total_spent
      )
      values (
        v_customer_id,
        trim(regexp_replace(r.customer_name, '\s+', ' ', 'g')),
        nullif(v_cpf, ''),
        nullif(v_phone, ''),
        '',
        null,
        0,
        0
      )
      on conflict (id) do nothing;
    end if;

    v_imei := pg_temp.only_digits(r.imei);
    if length(v_imei) <> 15 then
      v_imei := '';
    end if;

    v_condition := case when pg_temp.fold_text(r.ls_flag) = 'S' then 'Seminovo' else 'Novo' end;

    if v_norm_model like '%MACBOOK%' then
      v_device_type := 'Macbook';
    elsif v_norm_model like '%IPAD%' then
      v_device_type := 'iPad';
    elsif v_norm_model like '%WATCH%' then
      v_device_type := 'Apple Watch';
    else
      v_device_type := 'iPhone';
    end if;

    v_capacity := regexp_replace(upper(coalesce(substring(v_norm_model from '([0-9]+\s*(GB|TB))'), '')), '\s+', ' ', 'g');

    v_existing_stock_id := null;
    if v_imei <> '' then
      select si.id
        into v_existing_stock_id
      from public.stock_items si
      where pg_temp.only_digits(si.imei) = v_imei
      order by si.created_at nulls first, si.id
      limit 1;
    end if;

    if v_existing_stock_id is not null then
      v_stock_id := v_existing_stock_id;
      update public.stock_items
      set status = 'Vendido',
          updated_at = now()
      where id = v_stock_id;
    else
      v_stock_key := case
        when v_imei <> '' then 'IMEI|' || v_imei
        else 'FALLBACK|' || v_norm_model || '|' || v_norm_customer || '|' || v_norm_seller || '|' || r.sale_total::text || '|' || v_sale_date::date::text
      end;

      v_stock_id := 'stk_imp_fev_' || substr(md5(v_stock_key), 1, 20);

      insert into public.stock_items (
        id,
        type,
        model,
        color,
        has_box,
        capacity,
        imei,
        condition,
        status,
        battery_health,
        store_id,
        purchase_price,
        sell_price,
        max_discount,
        warranty_type,
        warranty_end,
        origin,
        notes,
        observations,
        entry_date,
        photos
      )
      values (
        v_stock_id,
        v_device_type,
        trim(regexp_replace(r.model, '\s+', ' ', 'g')),
        null,
        false,
        nullif(v_capacity, ''),
        nullif(v_imei, ''),
        v_condition,
        'Vendido',
        null,
        v_store_id,
        r.cost_total,
        r.sale_total,
        0,
        'Loja',
        null,
        'import_fev_2026_historico',
        'Importacao historica fev/2026 linha ' || r.line_no,
        'Pagamento original: ' || coalesce(r.payment_raw, ''),
        v_sale_date,
        array[]::text[]
      )
      on conflict (id) do update
      set status = 'Vendido',
          updated_at = now();
    end if;

    v_sale_key := case
      when v_imei <> '' then v_sale_date::date::text || '|IMEI|' || v_imei
      else v_sale_date::date::text || '|FALLBACK|' || v_norm_seller || '|' || v_norm_customer || '|' || v_norm_model || '|' || r.sale_total::text
    end;

    v_sale_id := 'sale_imp_fev_' || substr(md5(v_sale_key), 1, 20);

    insert into public.sales (
      id,
      customer_id,
      seller_id,
      total,
      discount,
      date,
      warranty_expires_at,
      trade_in_id,
      trade_in_value
    )
    values (
      v_sale_id,
      v_customer_id,
      v_seller_id,
      r.sale_total,
      0,
      v_sale_date,
      v_sale_date + interval '3 months',
      null,
      0
    )
    on conflict (id) do nothing;

    v_sale_item_id := 'si_imp_fev_' || substr(md5(v_sale_id || '|' || v_stock_id), 1, 20);

    insert into public.sale_items (
      id,
      sale_id,
      stock_item_id,
      price
    )
    values (
      v_sale_item_id,
      v_sale_id,
      v_stock_id,
      r.sale_total
    )
    on conflict (id) do nothing;

    v_payment_norm := replace(pg_temp.fold_text(coalesce(r.payment_raw, '')), ' ', '');

    if v_payment_norm = '' or v_payment_norm = '-' then
      continue;
    end if;

    v_methods := array[]::text[];

    for v_token in
      select regexp_split_to_table(replace(v_payment_norm, '/', '+'), '\+')
    loop
      v_mapped_method := null;

      if v_token like '%PIX%' then
        v_mapped_method := 'Pix';
      elsif v_token like '%CARTAO%' then
        v_mapped_method := 'Cartao';
      elsif v_token like '%DINHEIRO%' then
        v_mapped_method := 'Dinheiro';
      else
        v_mapped_method := null;
      end if;

      if v_mapped_method is not null and not (v_mapped_method = any(v_methods)) then
        v_methods := array_append(v_methods, v_mapped_method);
      end if;
    end loop;

    v_method_count := coalesce(array_length(v_methods, 1), 0);

    if v_method_count = 0 then
      continue;
    end if;

    v_base_amount := round(r.sale_total / v_method_count, 2);

    for v_idx in 1..v_method_count loop
      if v_idx = v_method_count then
        v_amount := r.sale_total - (v_base_amount * (v_method_count - 1));
      else
        v_amount := v_base_amount;
      end if;

      v_payment_id := 'pm_imp_fev_' || substr(md5(v_sale_id || '|' || v_methods[v_idx] || '|' || v_idx::text), 1, 20);

      insert into public.payment_methods (
        id,
        sale_id,
        type,
        amount,
        installments,
        debt_due_date,
        debt_notes
      )
      values (
        v_payment_id,
        v_sale_id,
        case when v_methods[v_idx] = 'Cartao' then 'Cartão' else v_methods[v_idx] end,
        v_amount,
        null,
        null,
        null
      )
      on conflict (id) do nothing;
    end loop;
  end loop;

  select count(*) into v_debts_after from public.debts;
  select count(*) into v_debt_payments_after from public.debt_payments;

  if v_debts_after <> v_debts_before then
    raise exception 'Importacao alterou debts indevidamente (% -> %).', v_debts_before, v_debts_after;
  end if;

  if v_debt_payments_after <> v_debt_payments_before then
    raise exception 'Importacao alterou debt_payments indevidamente (% -> %).', v_debt_payments_before, v_debt_payments_after;
  end if;
end;
$$;

drop table if exists tmp_import_feb_2026_sales;

commit;
