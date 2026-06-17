// AUTO-HEADER (gerado por scripts/n8n/repasse-maint.mjs — re-gerado a cada pull)
// node:     Verificar vencedor
// type:     n8n-nodes-base.code
// field:    jsCode
// stage:    10 buffer-lock
// Edite SÓ o corpo abaixo da sentinela. 'build'/'deploy' remontam o workflow.json.
// ===== n8n-tool: NÃO EDITE ACIMA DESTA LINHA =====
function safeParse(value, fallback = null) {
  if (value === null || value === undefined || value === '') return fallback;
  if (typeof value === 'object') return value;
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}

const items = $input.all();

// item da execução atual
const currentItem = items.find(item =>
  item.json.current_event_id || item.json.contact_id
);

// item vindo do Redis pós-Wait
const redisItem = items.find(item =>
  Object.prototype.hasOwnProperty.call(item.json, 'Redis Get pos-Wait') ||
  Object.prototype.hasOwnProperty.call(item.json, 'value') ||
  Object.prototype.hasOwnProperty.call(item.json, 'data') ||
  Object.prototype.hasOwnProperty.call(item.json, '')
);

const currentEventId = String(currentItem?.json?.current_event_id ?? '');
const contactId = String(currentItem?.json?.contact_id ?? '');

const bufferRaw =
  redisItem?.json?.['Redis Get pos-Wait'] ??
  redisItem?.json?.value ??
  redisItem?.json?.data ??
  redisItem?.json?.[''] ??
  null;

const buffer = safeParse(bufferRaw, null);

if (!currentEventId) {
  throw new Error('current_event_id não encontrado na entrada.');
}

if (!buffer || !buffer.last_event_id) {
  return [
    {
      json: {
        is_winner: false,
        reason: 'buffer_inexistente_ou_sem_last_event_id',
        current_event_id: currentEventId,
        buffer_last_event_id: null,
        contact_id: contactId,
        buffer_obj: buffer
      }
    }
  ];
}

const isWinner = currentEventId === String(buffer.last_event_id);

return [
  {
    json: {
      is_winner: isWinner,
      reason: isWinner ? 'event_id_confere' : 'event_id_nao_confere',
      current_event_id: currentEventId,
      buffer_last_event_id: String(buffer.last_event_id),
      contact_id: contactId,
      buffer_obj: buffer
    }
  }
];
