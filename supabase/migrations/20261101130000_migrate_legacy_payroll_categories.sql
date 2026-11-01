-- Histórico: categorias por pessoa ("PAGAMENTO FOLHA SEMANAL IGOR", "PAGAMENTO SERVIÇO EDSON")
-- viram "Salário semanal" / "Serviço semanal" com o funcionário em payee_seller_id.
-- Descrição padrão ("Pagamento em <conta>") ganha o formato novo; texto digitado fica como está.
-- A categoria antiga só é apagada quando nenhum lançamento a usa mais.
create temp table legacy_payroll_map (legacy text primary key, new_category text not null, seller_id text not null) on commit drop;

insert into legacy_payroll_map (legacy, new_category, seller_id) values
  ('PAGAMENTO FOLHA SEMANAL IGOR',     'Salário semanal', 'sel_b232333c64d0'),
  ('PAGAMENTO FOLHA SEMANAL MATHEUS',  'Salário semanal', 'sel_4b586fb3348f'),
  ('PAGAMENTO FOLHA SEMANAL RAILY',    'Salário semanal', 'sel_7665cafb8bd1'),
  ('PAGAMENTO FOLHA SEMANAL VINICIUS', 'Salário semanal', 'sel_d0338ee00c51'),
  ('PAGAMENTO SERVIÇO CÉSAR',          'Serviço semanal', 'sel_e2715344366c'),
  ('PAGAMENTO SERVIÇO EDSON',          'Serviço semanal', 'sel_8a6abd2565a0'),
  ('PAGAMENTO SERVIÇO HENRIQUE',       'Serviço semanal', 'sel_3bbf0a1c1f6c'),
  ('PAGAMENTO SERVIÇO IGOR',           'Serviço semanal', 'sel_b232333c64d0'),
  ('PAGAMENTO SERVIÇO MATHEUS',        'Serviço semanal', 'sel_4b586fb3348f'),
  ('PAGAMENTO SERVIÇO VINÍCIUS',       'Serviço semanal', 'sel_d0338ee00c51');

-- Segunda-feira da semana do pagamento, no fuso da loja.
create function public.tmp_payroll_week_monday(moment timestamptz) returns date
language sql immutable as $$
  select (moment at time zone 'America/Fortaleza')::date
         - (extract(isodow from (moment at time zone 'America/Fortaleza'))::int - 1)
$$;

update public.transactions t
set category = m.new_category,
    payee_seller_id = s.id,
    description = case
      when t.description is null or t.description = '' or t.description = 'Pagamento em ' || t.account then
        m.new_category || ' · ' || s.name || ' · semana '
        || to_char(public.tmp_payroll_week_monday(coalesce(t.date, t.created_at)), 'DD/MM') || ' a '
        || to_char(public.tmp_payroll_week_monday(coalesce(t.date, t.created_at)) + 6, 'DD/MM')
      else t.description
    end,
    updated_at = now()
from legacy_payroll_map m
join public.sellers s on s.id = m.seller_id
where t.category = m.legacy;

delete from public.finance_categories c
using legacy_payroll_map m
where c.name = m.legacy
  and c.type = 'OUT'
  and not exists (select 1 from public.transactions t where t.category = c.name);

drop function public.tmp_payroll_week_monday(timestamptz);
