// AUTO-HEADER (gerado por scripts/n8n/repasse-maint.mjs — re-gerado a cada pull)
// node:     data_hora
// type:     n8n-nodes-base.code
// field:    jsCode
// stage:    30 contexto-lead
// Edite SÓ o corpo abaixo da sentinela. 'build'/'deploy' remontam o workflow.json.
// ===== n8n-tool: NÃO EDITE ACIMA DESTA LINHA =====
const resp = $input.first().json;

const business_hours         = resp.business_hours ?? {};
const special_business_hours = resp.special_business_hours ?? {};

// ── HORA LOCAL DE FORTALEZA (UTC-3, sem horário de verão) ──────────────────
const now       = new Date();
const local     = new Date(now.getTime() + (-3 * 60 * 60 * 1000));

const pad       = n => String(n).padStart(2, "0");
const local_date = `${local.getUTCFullYear()}-${pad(local.getUTCMonth()+1)}-${pad(local.getUTCDate())}`;
const local_time = `${pad(local.getUTCHours())}:${pad(local.getUTCMinutes())}`;
const _greetHour = local.getUTCHours();
const saudacao = (_greetHour >= 5 && _greetHour < 12) ? "Bom dia" : (_greetHour >= 12 && _greetHour < 18) ? "Boa tarde" : "Boa noite";

const DAY_KEYS  = ["sun","mon","tue","wed","thu","fri","sat"];
const DAY_NAMES = {
  sun: "domingo",
  mon: "segunda-feira",
  tue: "terça-feira",
  wed: "quarta-feira",
  thu: "quinta-feira",
  fri: "sexta-feira",
  sat: "sábado"
};

const day_key       = DAY_KEYS[local.getUTCDay()];
const time_in_min   = local.getUTCHours() * 60 + local.getUTCMinutes();

// ── VERIFICA FERIADO / DIA ESPECIAL ───────────────────────────────────────
const special       = special_business_hours[local_date] ?? null;
const is_holiday    = special?.closed === true;
const holiday_label = special?.label ?? null;

// ── DETERMINA HORÁRIO DE HOJE ──────────────────────────────────────────────
let open_today  = null;
let close_today = null;
let is_open     = false;

if (!is_holiday) {
  const today_hours = business_hours[day_key] ?? null;
  if (today_hours?.open && today_hours?.close) {
    open_today  = today_hours.open;
    close_today = today_hours.close;

    const [oh, om] = open_today.split(":").map(Number);
    const [ch, cm] = close_today.split(":").map(Number);
    const open_min  = oh * 60 + om;
    const close_min = ch * 60 + cm;

    is_open = time_in_min >= open_min && time_in_min < close_min;
  }
}

// ── PRÓXIMA ABERTURA (quando fechado) ─────────────────────────────────────
let next_open_day   = null;
let next_open_time  = null;
let next_open_date  = null;

if (!is_open) {
  const currentDayIndex = DAY_KEYS.indexOf(day_key);

  for (let i = 1; i <= 7; i++) {
    const nextIndex    = (currentDayIndex + i) % 7;
    const nextDayKey   = DAY_KEYS[nextIndex];

    // Calcula a data do próximo dia candidato
    const nextDate     = new Date(local.getTime() + i * 24 * 60 * 60 * 1000);
    const nextDateStr  = `${nextDate.getUTCFullYear()}-${pad(nextDate.getUTCMonth()+1)}-${pad(nextDate.getUTCDate())}`;

    // Verifica se é feriado
    const nextSpecial  = special_business_hours[nextDateStr];
    if (nextSpecial?.closed) continue;

    const nextHours    = business_hours[nextDayKey];
    if (nextHours?.open) {
      next_open_day   = DAY_NAMES[nextDayKey];
      next_open_time  = nextHours.open;
      next_open_date  = nextDateStr;
      break;
    }
  }
}

// ── FRASE PRONTA PARA A IA ─────────────────────────────────────────────────
let after_hours_message = null;

if (!is_open) {
  if (is_holiday && holiday_label) {
    after_hours_message = next_open_day
      ? `Nossa loja está fechada hoje (${holiday_label}). Voltamos ${next_open_day} às ${next_open_time}.`
      : `Nossa loja está fechada hoje (${holiday_label}).`;
  } else if (!open_today) {
    after_hours_message = next_open_day
      ? `Nossa loja não abre hoje. Voltamos ${next_open_day} às ${next_open_time}.`
      : `Nossa loja está fechada no momento.`;
  } else {
    // Fora do horário (antes de abrir ou depois de fechar)
    const before_open = time_in_min < (parseInt(open_today) * 60 + parseInt(open_today.split(":")[1]));
    after_hours_message = before_open
      ? `Nossa loja ainda não abriu. Hoje abrimos às ${open_today}.`
      : next_open_day
        ? `Nossa loja já fechou por hoje. Voltamos ${next_open_day} às ${next_open_time}.`
        : `Nossa loja está fechada no momento.`;
  }
}

// ── RETORNO ────────────────────────────────────────────────────────────────
return [{
  json: {
    store_open:          is_open,
    after_hours:         !is_open,
    local_date,
    local_time,
    saudacao,
    day_key,
    open:                open_today,
    close:               close_today,
    is_holiday,
    holiday_label,
    business_hours,
    next_open_day,
    next_open_time,
    next_open_date,
    after_hours_message,
    store_status_source: is_holiday ? "special_business_hours" : "business_hours"
  }
}];
