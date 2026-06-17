// AUTO-HEADER (gerado por scripts/n8n/repasse-maint.mjs — re-gerado a cada pull)
// node:     Tentar Lock
// type:     n8n-nodes-base.code
// field:    jsCode
// stage:    10 buffer-lock
// Edite SÓ o corpo abaixo da sentinela. 'build'/'deploy' remontam o workflow.json.
// ===== n8n-tool: NÃO EDITE ACIMA DESTA LINHA =====
const items = $input.all();

// Item vindo do Verificar Vencedor / If Vencedor?
const winnerItem = items.find(item =>
  item.json.contact_id || item.json.is_winner || item.json.buffer_obj
);

// Item vindo do Redis Get Lock
const redisItem = items.find(item =>
  Object.prototype.hasOwnProperty.call(item.json, 'Redis Get Lock') ||
  Object.prototype.hasOwnProperty.call(item.json, 'value') ||
  Object.prototype.hasOwnProperty.call(item.json, 'data') ||
  Object.prototype.hasOwnProperty.call(item.json, '')
);

const contactId = String(winnerItem?.json?.contact_id ?? '');

// Lê possível lock existente
const existingLock =
  redisItem?.json?.['Redis Get Lock'] ??
  redisItem?.json?.value ??
  redisItem?.json?.data ??
  redisItem?.json?.[''] ??
  null;

if (!contactId) {
  throw new Error('contact_id não encontrado na entrada do Tentar Lock.');
}

const canLock = !existingLock;

return [
  {
    json: {
      can_lock: canLock,
      contact_id: contactId,
      lock_key: `lock:${contactId}`,
      lock_value: `exec_${$execution.id}`,
      existing_lock: existingLock || null
    }
  }
];
