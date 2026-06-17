// AUTO-HEADER (gerado por scripts/n8n/repasse-maint.mjs — re-gerado a cada pull)
// node:     Code Parse Router
// type:     n8n-nodes-base.code
// field:    jsCode
// stage:    40 router-memoria
// Edite SÓ o corpo abaixo da sentinela. 'build'/'deploy' remontam o workflow.json.
// ===== n8n-tool: NÃO EDITE ACIMA DESTA LINHA =====
let raw = $json.output;

raw = String(raw || '').trim();
raw = raw.replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/```$/i, '').trim();

const { output: _routerOutput, ...ctx } = $json;

try {
  const router = JSON.parse(raw);

  return [
    {
      json: {
        ...ctx,
        router,
        router_parse_ok: true,
        router_raw: raw
      }
    }
  ];
} catch (error) {
  return [
    {
      json: {
        ...ctx,
        router_parse_ok: false,
        router_parse_error: String(error.message || error),
        router_raw: raw
      }
    }
  ];
}
