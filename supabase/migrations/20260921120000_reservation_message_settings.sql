-- Mensagem automática enviada ao cliente quando uma reserva é concluída.
--
-- Guarda apenas o TEMPLATE padrão da loja (com os marcadores `{{cliente}}`,
-- `{{sinal}}`, …). O texto final de cada reserva é resolvido no app e enviado
-- pela função `send-reservation-whatsapp`; o envio em si é decidido reserva a
-- reserva pelo checkbox do modal.
begin;

create table if not exists public.reservation_message_settings (
  id text primary key default 'default' check (id = 'default'),
  template text not null default '',
  send_by_default boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

insert into public.reservation_message_settings (id, template, send_by_default)
values (
  'default',
  concat_ws(
    chr(10),
    'Olá {{cliente}}! Sua reserva do {{aparelho}} foi concluída. ✅',
    'Entrada recebida: {{sinal}} ({{forma_sinal}})',
    'Valor restante: {{restante}}',
    'Separamos o aparelho para você até {{validade}}.',
    'Qualquer dúvida, é só chamar por aqui. 😉'
  ),
  true
)
on conflict (id) do nothing;

create or replace function public.touch_reservation_message_settings()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists reservation_message_settings_touch on public.reservation_message_settings;
create trigger reservation_message_settings_touch
  before update on public.reservation_message_settings
  for each row execute function public.touch_reservation_message_settings();

alter table public.reservation_message_settings enable row level security;

-- Todo mundo que pode reservar precisa LER o template para montar a mensagem;
-- só admin altera o padrão da loja.
drop policy if exists reservation_message_settings_read on public.reservation_message_settings;
create policy reservation_message_settings_read on public.reservation_message_settings
  for select to authenticated
  using (true);

drop policy if exists reservation_message_settings_admin_all on public.reservation_message_settings;
create policy reservation_message_settings_admin_all on public.reservation_message_settings
  for all to authenticated
  using (public.current_role() = 'admin')
  with check (public.current_role() = 'admin');

grant select on public.reservation_message_settings to authenticated;
grant insert, update on public.reservation_message_settings to authenticated;

commit;
