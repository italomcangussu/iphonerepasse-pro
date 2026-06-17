// AUTO-HEADER (gerado por scripts/n8n/repasse-maint.mjs — re-gerado a cada pull)
// node:     Code in JavaScript1
// type:     n8n-nodes-base.code
// field:    jsCode
// stage:    50 leadstate-flags
// Edite SÓ o corpo abaixo da sentinela. 'build'/'deploy' remontam o workflow.json.
// ===== n8n-tool: NÃO EDITE ACIMA DESTA LINHA =====
const input = $('Edit Fields5').first().json;
const leadId = $('Edit Fields').first().json.lead.id;

return [
  {
    json: {
      action: 'upsert_lead_state',
      payload: {
        lead_id: leadId,
        state: {
          summary_short: input.summary_short,
          summary_operational: input.summary_operational
        },
      },
    },
  },
];
