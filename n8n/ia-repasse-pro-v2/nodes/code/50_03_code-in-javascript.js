// AUTO-HEADER (gerado por scripts/n8n/repasse-maint.mjs — re-gerado a cada pull)
// node:     Code in JavaScript
// type:     n8n-nodes-base.code
// field:    jsCode
// stage:    50 leadstate-flags
// Edite SÓ o corpo abaixo da sentinela. 'build'/'deploy' remontam o workflow.json.
// ===== n8n-tool: NÃO EDITE ACIMA DESTA LINHA =====
const input = $('Edit Fields5').first().json;
const leadId = $('Edit Fields').first().json.lead.id;

// Bucket 3 carry-forward (2026-06-14): campos determinísticos (estoque/simulador/PIX)
// só são computados nos turnos em que os nodes de inventário/simulador/PIX rodam.
// Nos demais turnos chegam null no Edit Fields5 e, sem isto, este POST zerava o
// valor persistido. Aqui fazemos fallback para o estado anterior (prev) só quando
// o valor fresco vier ausente. NÃO são donos de agente (alucinariam) — Memory 2
// continua dono dos demais campos.
function readPrevLeadState() {
  try {
    const ls = $('Code Parse Memory 2').last().json?.lead_state;
    if (ls && typeof ls === 'object' && !Array.isArray(ls)) return ls;
  } catch (e) {}
  try {
    const crm = $('CRM Leads GET').last().json;
    return crm?.lead_state ?? crm?.data?.lead_state ?? crm?.data?.items?.[0]?.lead_state ?? {};
  } catch (e) {}
  return {};
}
const prev = readPrevLeadState();
const isPresent = (v) => v !== null && v !== undefined && v !== '';
const cf = (cur, key) => (isPresent(cur) ? cur : (prev?.[key] ?? null));
const latch = (cur, key) => (cur === true || prev?.[key] === true);
const maxNum = (cur, key) => Math.max(Number(cur ?? 0) || 0, Number(prev?.[key] ?? 0) || 0);

return [
  {
    json: {
      action: 'upsert_lead_state',
      payload: {
        lead_id: leadId,
        state: {
          interest_type: input.interest_type,
          desired_model: input.desired_model,
          desired_capacity: input.desired_capacity,
          desired_color: input.desired_color,
          desired_condition: input.desired_condition,

          has_tradein: input.has_tradein,
          tradein_model: input.tradein_model,
          tradein_model_accepted: input.tradein_model_accepted,
          tradein_rejected_reason: input.tradein_rejected_reason,
          tradein_capacity: input.tradein_capacity,
          tradein_color: input.tradein_color,
          tradein_scratches: input.tradein_scratches,
          tradein_liquid_contact: input.tradein_liquid_contact,
          tradein_side_marks: input.tradein_side_marks,
          tradein_parts_swapped: input.tradein_parts_swapped,
          tradein_has_box_cable: input.tradein_has_box_cable,
          tradein_battery_pct: input.tradein_battery_pct,
          tradein_battery_suspect: input.tradein_battery_suspect,
          tradein_apple_warranty: input.tradein_apple_warranty,
          tradein_warranty_until: input.tradein_warranty_until,
          tradein_disqualified: input.tradein_disqualified,

          preferred_city: input.preferred_city,
          stock_city: cf(input.stock_city, 'stock_city'),
          cross_city_situation: input.cross_city_situation,
          stock_item_id: cf(input.stock_item_id, 'stock_item_id'),
          hdi_city_needed: input.hdi_city_needed,
          client_outside_ce: input.client_outside_ce,
          card_brand: input.card_brand,
          cash_entry_asked: latch(input.cash_entry_asked, 'cash_entry_asked'),
          cash_entry_intent: cf(input.cash_entry_intent, 'cash_entry_intent'),
          cash_entry_amount: cf(input.cash_entry_amount, 'cash_entry_amount'),

          simulation_done: latch(input.simulation_done, 'simulation_done'),
          simulation_count: maxNum(input.simulation_count, 'simulation_count'),
          last_simulation_total: cf(input.last_simulation_total, 'last_simulation_total'),
          secondary_color_simulation: cf(input.secondary_color_simulation, 'secondary_color_simulation'),

          proposal_accepted: input.proposal_accepted,
          reservation_intent: input.reservation_intent,
          pix_data_sent: latch(input.pix_data_sent, 'pix_data_sent'),
          pix_paid: input.pix_paid,
          pix_amount: input.pix_amount,
          pickup_datetime: input.pickup_datetime,

          cadastro_solicitado: input.cadastro_solicitado,
          cadastro_nome_completo: input.cadastro_nome_completo,
          cadastro_data_nascimento: input.cadastro_data_nascimento,
          cadastro_cpf: input.cadastro_cpf,
          cadastro_contato: input.cadastro_contato,
          cadastro_completo: input.cadastro_completo,
        },
      },
    },
  },
];
