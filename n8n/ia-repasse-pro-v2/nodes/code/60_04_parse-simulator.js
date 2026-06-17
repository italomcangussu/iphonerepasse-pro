// AUTO-HEADER (gerado por scripts/n8n/repasse-maint.mjs — re-gerado a cada pull)
// node:     Parse Simulator
// type:     n8n-nodes-base.code
// field:    jsCode
// stage:    60 simulacao-estoque
// Edite SÓ o corpo abaixo da sentinela. 'build'/'deploy' remontam o workflow.json.
// ===== n8n-tool: NÃO EDITE ACIMA DESTA LINHA =====
const ctx = $('Montar Body do Simulador').first().json;
const resp = $input.first().json;
const memory = ctx.memory ?? ctx;

if (resp.error || resp.statusCode >= 400 || resp.success === false) {
  return [{
    json: {
      ...ctx,
      simulation_result: null,
      simulation_error: true,
      memory: {
        ...memory,
        next_best_action: "transferir para especialista repasse"
      }
    }
  }];
}

const simulation_text = resp.messageText ?? resp.message ?? resp.text ?? JSON.stringify(resp);
const new_count = Number(memory.simulation_count ?? 0) + 1;
const total = resp.simulationMode === "comparison"
  ? null
  : resp.combinedSummary?.totalCardNetAmount ?? resp.total ?? resp.summary?.cardNetAmount ?? null;

return [{
  json: {
    ...ctx,
    simulation_result: {
      text:          simulation_text,
      count:         new_count,
      body_used:     ctx.simulator_body,
      quotes:        resp.quotes ?? null,
      combined:      resp.combinedSummary ?? null,
      simulation_mode: resp.simulationMode ?? ctx.simulation_mode ?? null,
      partial:       resp.partial ?? false
    },
    memory: {
      ...memory,
      simulation_done:        true,
      simulation_count:       new_count,
      last_simulation_total:  total,
      last_simulation_quotes: resp.quotes ?? null,
      simulation_mode: resp.simulationMode ?? ctx.simulation_mode ?? memory.simulation_mode ?? null
    }
  }
}];
