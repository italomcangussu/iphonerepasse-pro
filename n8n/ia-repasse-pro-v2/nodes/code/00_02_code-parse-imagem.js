// AUTO-HEADER (gerado por scripts/n8n/repasse-maint.mjs — re-gerado a cada pull)
// node:     Code Parse Imagem
// type:     n8n-nodes-base.code
// field:    jsCode
// stage:    00 entrada-normalizacao
// Edite SÓ o corpo abaixo da sentinela. 'build'/'deploy' remontam o workflow.json.
// ===== n8n-tool: NÃO EDITE ACIMA DESTA LINHA =====
// Media context parser for Gemini audio, image and video outputs.
// Keeps legacy has_image/image_context while exposing the new media_context contract.

function isEmpty(value) {
  if (value === null) { return true; }
  if (value === undefined) { return true; }
  if (String(value).trim().length === 0) { return true; }
  return false;
}

function trimText(value, maxLength) {
  if (isEmpty(value)) { return ""; }
  var text = String(value).replace(/\s+/g, " ").trim();
  if (maxLength && text.length > maxLength) {
    return text.substring(0, maxLength - 3).trim() + "...";
  }
  return text;
}

function clampConfidence(value) {
  var number = Number(value);
  if (isNaN(number)) { return 0.5; }
  if (number < 0) { return 0; }
  if (number > 1) { return 1; }
  return number;
}

function oneOf(value, allowed, fallback) {
  if (isEmpty(value)) { return fallback; }
  var normalized = String(value).toLowerCase().trim();
  for (var i = 0; i < allowed.length; i++) {
    if (allowed[i] === normalized) { return normalized; }
  }
  return fallback;
}

function extractJSON(raw) {
  if (isEmpty(raw)) { return null; }
  var text = String(raw).trim();
  var fenceMatch = text.match(/```json\s*([\s\S]*?)```/i);
  if (fenceMatch && fenceMatch[1]) {
    try { return JSON.parse(fenceMatch[1].trim()); } catch (e) {}
  }
  var genericFence = text.match(/```\s*([\s\S]*?)```/);
  if (genericFence && genericFence[1]) {
    try { return JSON.parse(genericFence[1].trim()); } catch (e) {}
  }
  try { return JSON.parse(text); } catch (e) {}
  var objectMatch = text.match(/\{[\s\S]*\}/);
  if (objectMatch) {
    try { return JSON.parse(objectMatch[0]); } catch (e) {}
  }
  return null;
}

function detectMediaType(inputItem, parsed) {
  if (parsed && parsed.media_context && parsed.media_context.media_type) {
    return parsed.media_context.media_type;
  }
  if (inputItem && inputItem.media_context && inputItem.media_context.media_type) {
    return inputItem.media_context.media_type;
  }
  if (inputItem && inputItem.body && inputItem.body.mediaType) {
    return inputItem.body.mediaType;
  }
  if (inputItem && inputItem.mediaType) { return inputItem.mediaType; }
  return "image";
}

function inferDeviceFamily(text) {
  var value = String(text || "").toLowerCase();
  if (/mac|macbook/.test(value)) { return "mac"; }
  if (/ipad/.test(value)) { return "ipad"; }
  if (/watch|apple watch/.test(value)) { return "watch"; }
  if (/airpods|air pods/.test(value)) { return "airpods"; }
  if (/capa|pelicula|película|cabo|carregador|fone|acessorio|acessório/.test(value)) { return "accessory"; }
  if (/pix|comprovante|pagamento|recibo/.test(value)) { return "payment"; }
  if (/iphone|i phone/.test(value)) { return "iphone"; }
  return "unknown";
}

function normalizeMediaContext(value, fallbackMediaType) {
  var allowedMedia = ["audio", "image", "video"];
  var allowedIntent = ["iphone_purchase", "iphone_tradein", "iphone_sale", "repair_or_accessory_hdi", "non_iphone_device", "payment_proof", "support", "unknown"];
  var allowedFamily = ["iphone", "mac", "ipad", "watch", "airpods", "accessory", "payment", "unknown"];
  var media = value || {};
  var mediaType = oneOf(media.media_type || fallbackMediaType, allowedMedia, fallbackMediaType || "image");
  var customerText = trimText(media.customer_text, 220);
  var summary = trimText(media.summary, 220);
  var detectedSubject = trimText(media.detected_subject, 80) || "nao identificado";
  var condition = trimText(media.condition_or_signal, 120) || "nao identificado";
  var deviceFamily = oneOf(media.device_family, allowedFamily, inferDeviceFamily([customerText, summary, detectedSubject, condition].join(" ")));
  var intent = oneOf(media.commercial_intent_hint, allowedIntent, "unknown");
  var confidence = clampConfidence(media.confidence);

  if (isEmpty(customerText)) { customerText = summary; }
  if (isEmpty(summary)) { summary = customerText || "Midia recebida para triagem comercial."; }

  return {
    media_type: mediaType,
    customer_text: customerText,
    summary: summary,
    commercial_intent_hint: intent,
    detected_subject: detectedSubject,
    condition_or_signal: condition,
    device_family: deviceFamily,
    confidence: confidence
  };
}

function legacyImageToMediaContext(imageData, mediaType) {
  var descricao = trimText(imageData.descricao, 220);
  var item = trimText(imageData.item_principal, 80);
  var estado = trimText(imageData.problema_ou_estado, 120);
  var mensagem = trimText(imageData.mensagem_cliente, 220);
  var intencao = String(imageData.intencao_inferida || "outro").toLowerCase().trim();
  var joined = [descricao, item, estado, mensagem].join(" ");
  var family = inferDeviceFamily(joined);
  var intent = "unknown";

  if (intencao === "reparo" || intencao === "duvida_compatibilidade") {
    intent = "repair_or_accessory_hdi";
  } else if (intencao === "compra_produto") {
    if (family === "accessory") { intent = "repair_or_accessory_hdi"; }
    else if (family === "iphone") { intent = "iphone_purchase"; }
    else if (family !== "unknown" && family !== "payment") { intent = "non_iphone_device"; }
  } else if (intencao === "avaliacao_aparelho") {
    if (family === "iphone") { intent = "iphone_tradein"; }
    else if (family !== "unknown") { intent = "non_iphone_device"; }
  }

  return normalizeMediaContext({
    media_type: mediaType || "image",
    customer_text: mensagem,
    summary: descricao,
    commercial_intent_hint: intent,
    detected_subject: item,
    condition_or_signal: estado,
    device_family: family,
    confidence: 0.75
  }, mediaType || "image");
}

function audioTextToMediaContext(text) {
  var transcription = trimText(text, 500);
  return normalizeMediaContext({
    media_type: "audio",
    customer_text: transcription,
    summary: trimText(transcription, 220),
    commercial_intent_hint: "unknown",
    detected_subject: null,
    condition_or_signal: null,
    device_family: "unknown",
    confidence: transcription.length > 0 ? 1 : 0.2
  }, "audio");
}

function mediaContextToLegacyImage(mediaContext) {
  var intent = "outro";
  if (mediaContext.commercial_intent_hint === "repair_or_accessory_hdi") { intent = "reparo"; }
  if (mediaContext.commercial_intent_hint === "iphone_purchase") { intent = "compra_produto"; }
  if (mediaContext.commercial_intent_hint === "iphone_tradein" || mediaContext.commercial_intent_hint === "iphone_sale") { intent = "avaliacao_aparelho"; }

  return {
    descricao: mediaContext.summary,
    item_principal: mediaContext.detected_subject,
    problema_ou_estado: mediaContext.condition_or_signal,
    intencao_inferida: intent,
    mensagem_cliente: mediaContext.customer_text
  };
}

function readRawCandidate(inputItem) {
  if (!inputItem) { return null; }
  if (inputItem.media_context && typeof inputItem.media_context === "object") {
    return { objectValue: { media_context: inputItem.media_context }, rawValue: JSON.stringify({ media_context: inputItem.media_context }) };
  }
  if (inputItem.router && typeof inputItem.router === "object") {
    if (inputItem.router.media_context && typeof inputItem.router.media_context === "object") {
      return { objectValue: { media_context: inputItem.router.media_context }, rawValue: JSON.stringify({ media_context: inputItem.router.media_context }) };
    }
    if (inputItem.router.image && typeof inputItem.router.image === "object") {
      return { objectValue: { image: inputItem.router.image }, rawValue: JSON.stringify({ image: inputItem.router.image }) };
    }
    if (!isEmpty(inputItem.router.image)) {
      return { objectValue: null, rawValue: inputItem.router.image };
    }
    if (inputItem.router.descricao || inputItem.router.item_principal || inputItem.router.mensagem_cliente) {
      return { objectValue: { image: inputItem.router }, rawValue: JSON.stringify({ image: inputItem.router }) };
    }
  }
  if (inputItem.content && inputItem.content.parts && inputItem.content.parts[0] && !isEmpty(inputItem.content.parts[0].text)) {
    return { objectValue: null, rawValue: inputItem.content.parts[0].text };
  }
  if (!isEmpty(inputItem.output)) { return { objectValue: null, rawValue: inputItem.output }; }
  if (!isEmpty(inputItem.text)) { return { objectValue: null, rawValue: inputItem.text }; }
  if (!isEmpty(inputItem.message)) { return { objectValue: null, rawValue: inputItem.message }; }
  if (typeof inputItem.content === "string" && !isEmpty(inputItem.content)) {
    return { objectValue: null, rawValue: inputItem.content };
  }
  return null;
}

var inputItem = $input.first().json || {};
var warnings = [];
var candidate = readRawCandidate(inputItem);
var parsed = candidate && candidate.objectValue ? candidate.objectValue : null;
var raw = candidate ? candidate.rawValue : null;
var detectedMediaType = detectMediaType(inputItem, parsed);

if (!parsed && !isEmpty(raw)) { parsed = extractJSON(raw); }

var mediaContext = null;
var parseOk = true;

if (parsed && parsed.media_context && typeof parsed.media_context === "object") {
  mediaContext = normalizeMediaContext(parsed.media_context, detectedMediaType);
} else if (parsed && parsed.image && typeof parsed.image === "object") {
  mediaContext = legacyImageToMediaContext(parsed.image, detectedMediaType);
  warnings.push("Payload legado image convertido para media_context");
} else if (parsed && (parsed.descricao || parsed.item_principal || parsed.mensagem_cliente)) {
  mediaContext = legacyImageToMediaContext(parsed, detectedMediaType);
  warnings.push("Payload legado sem wrapper convertido para media_context");
} else if (detectedMediaType === "audio" && !isEmpty(raw)) {
  mediaContext = audioTextToMediaContext(raw);
} else if (!isEmpty(raw)) {
  parseOk = false;
  mediaContext = normalizeMediaContext({
    media_type: detectedMediaType,
    customer_text: "",
    summary: trimText(raw, 220),
    commercial_intent_hint: "unknown",
    detected_subject: "nao identificado",
    condition_or_signal: "nao identificado",
    device_family: "unknown",
    confidence: 0.2
  }, detectedMediaType);
  warnings.push("Nao foi possivel extrair JSON de media_context; usando resumo bruto truncado");
} else {
  mediaContext = normalizeMediaContext({
    media_type: detectedMediaType,
    customer_text: "",
    summary: "",
    commercial_intent_hint: "unknown",
    detected_subject: "nao identificado",
    condition_or_signal: "nao identificado",
    device_family: "unknown",
    confidence: 0.2
  }, detectedMediaType);
  warnings.push("Nenhum output de midia recebido");
}

var hasMedia = !isEmpty(mediaContext.customer_text) || !isEmpty(mediaContext.summary);
var isVisualMedia = mediaContext.media_type === "image" || mediaContext.media_type === "video";
var imageContext = isVisualMedia && hasMedia ? mediaContextToLegacyImage(mediaContext) : null;

return [
  {
    json: {
      has_media: hasMedia,
      media_context: mediaContext,
      has_image: isVisualMedia && hasMedia,
      image_context: imageContext,
      parse_ok: parseOk,
      parse_warnings: warnings,
      raw_preview: isEmpty(raw) ? "" : String(raw).substring(0, 300)
    }
  }
];
