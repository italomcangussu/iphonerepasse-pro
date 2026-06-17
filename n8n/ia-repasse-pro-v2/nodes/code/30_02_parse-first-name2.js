// AUTO-HEADER (gerado por scripts/n8n/repasse-maint.mjs — re-gerado a cada pull)
// node:     PARSE FIRST NAME2
// type:     n8n-nodes-base.code
// field:    jsCode
// stage:    30 contexto-lead
// Edite SÓ o corpo abaixo da sentinela. 'build'/'deploy' remontam o workflow.json.
// ===== n8n-tool: NÃO EDITE ACIMA DESTA LINHA =====
// PARSE FIRST NAME
//
// Recebe name (nome completo) e devolve firstName.
// Trata nomes compostos, espacos extras e valores ausentes.

var senderName = $('Edit Fields4').last().json.data.lead.name;

if (senderName === null || senderName === undefined) {
  return [{ json: { firstName: null } }];
}

var trimmed = String(senderName).replace(/\s+/g, " ").trim();

if (trimmed.length === 0) {
  return [{ json: { firstName: null } }];
}

var firstName = trimmed.split(" ")[0];

return [{ json: { firstName: firstName } }];
