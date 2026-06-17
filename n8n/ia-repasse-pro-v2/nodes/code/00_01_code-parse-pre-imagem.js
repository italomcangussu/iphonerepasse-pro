// AUTO-HEADER (gerado por scripts/n8n/repasse-maint.mjs — re-gerado a cada pull)
// node:     Code Parse pre-imagem
// type:     n8n-nodes-base.code
// field:    jsCode
// stage:    00 entrada-normalizacao
// Edite SÓ o corpo abaixo da sentinela. 'build'/'deploy' remontam o workflow.json.
// ===== n8n-tool: NÃO EDITE ACIMA DESTA LINHA =====
let raw = $input.first().json.content.parts[0].text;

raw = String(raw || '').trim();
raw = raw.replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/```$/i, '').trim();

try {
  const router = JSON.parse(raw);

  return [
    {
      json: {
        ...$json,
        router,
        router_parse_ok: true
      }
    }
  ];
} catch (error) {
  return [
    {
      json: {
        ...$json,
        router_parse_ok: false,
        router_parse_error: String(error.message || error),
        router_raw: raw
      }
    }
  ];
}
