import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { createClient } from '@supabase/supabase-js';
import {
  buildCriticalScenarios,
  createSandboxIdentity,
  normalizeScenarioTurns,
  validateScenario,
} from './repasse-scenario-harness.mjs';

const ROOT = process.cwd();
const ENV_PATH = path.join(ROOT, '.env.local');
const WORKFLOW_ID = 'Cr4fPWe0prwS6XjI';
const WORKFLOW_NAME = 'ia repasse-pro v2 avancada';
// Must match the live webhook node path on workflow Cr4fPWe0prwS6XjI.
// Was 'repasse-next' during staging; production cut over to 'repasse'.
const WEBHOOK_PATH = 'repasse';
const EXPECTED_PROJECT_REF = 'ubuusaiezpyayqgfujbe';
const SANDBOX_PHONE = '558899990507';
const DEFAULT_LIMIT = 10;
const RESPONSE_TIMEOUT_MS = 240_000;
const RESPONSE_POLL_MS = 5_000;
const RESPONSE_QUIET_MS = 12_000;

const REQUIRED_CATEGORIES = [
  'compra_modelo_definido',
  'troca_com_iphone_entrada',
  'comparacao_dois_iphones',
  'faltam_dados_tradein',
  'parcelamento_bandeira',
  'objecao_preco',
  'sem_estoque_alternativa',
  'cliente_indeciso',
];

function parseArgs(argv) {
  const args = {
    listScenarios: false,
    runLive: false,
    limit: DEFAULT_LIMIT,
    start: 1,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--list-scenarios') args.listScenarios = true;
    if (arg === '--run-live') args.runLive = true;
    if (arg === '--limit') {
      args.limit = Number(argv[index + 1] || DEFAULT_LIMIT);
      index += 1;
    }
    if (arg === '--start') {
      args.start = Number(argv[index + 1] || 1);
      index += 1;
    }
  }

  if (args.listScenarios === args.runLive) {
    throw new Error('Use exactly one mode: --list-scenarios or --run-live');
  }

  args.limit = Math.max(1, Math.min(10, Number.isFinite(args.limit) ? args.limit : DEFAULT_LIMIT));
  args.start = Math.max(1, Math.min(10, Number.isFinite(args.start) ? args.start : 1));
  return args;
}

function parseEnv(text) {
  const env = {};
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#') || !line.includes('=')) continue;
    const index = line.indexOf('=');
    const key = line.slice(0, index).trim();
    let value = line.slice(index + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    env[key] = value;
  }
  return env;
}

async function loadEnv() {
  const env = parseEnv(await readFile(ENV_PATH, 'utf8'));
  for (const key of ['VITE_SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY', 'N8N_PUBLIC_API', 'N8N_MCP_URL']) {
    if (!env[key]) throw new Error(`Missing ${key} in .env.local`);
  }

  const projectRef = new URL(env.VITE_SUPABASE_URL).hostname.split('.')[0];
  if (projectRef !== EXPECTED_PROJECT_REF) {
    throw new Error(`Unexpected Supabase project ref ${projectRef}; expected ${EXPECTED_PROJECT_REF}`);
  }

  return env;
}

function digits(value) {
  return String(value ?? '').replace(/\D/g, '');
}

function cleanText(value, max = 800) {
  return String(value ?? '')
    .replace(/\s+/g, ' ')
    .replace(/\+?\d[\d\s().-]{7,}\d/g, '[telefone]')
    .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, '[email]')
    .trim()
    .slice(0, max)
    .trim();
}

function normalize(value) {
  return String(value ?? '')
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase();
}

function has(pattern, text) {
  return pattern.test(normalize(text));
}

function classifyScenario(text) {
  const normalized = normalize(text);
  const mentionsIphone = /\biphone\b/.test(normalized);
  const mentionsModel = /\biphone\s?(1[1-7]|x|xr|xs|se)\b/.test(normalized);
  const trade = /(troca|trocar|entrada|meu iphone|pega meu|avaliar|avaliacao|quanto volta|volta no meu)/.test(normalized);
  const condition = /(bateria|arranha|arranho|trinc|quebr|tela|face|original|peca|caixa|cabo|garantia|estado|lateral|molhou|agua)/.test(normalized);

  if (mentionsIphone && /(compar|versus|\bvs\b|qual compensa|qual melhor|entre .* ou | ou .*iphone|quanto fica nos dois|diferenca para)/.test(normalized)) {
    return 'comparacao_dois_iphones';
  }
  if (trade && !condition) return 'faltam_dados_tradein';
  if (trade) return 'troca_com_iphone_entrada';
  if (/(parcela|parcelamento|cartao|bandeira|\bvisa\b|\bmaster\b|\bmastercard\b|\belo\b|\bnubank\b|dividir|\d+x)/.test(normalized)) {
    return 'parcelamento_bandeira';
  }
  if (/(caro|desconto|melhor preco|menor valor|negocia|abaixa|baixar|a vista|avista)/.test(normalized)) {
    return 'objecao_preco';
  }
  if (/(tem|disponivel|estoque|pronta entrega|cor|preto|branco|azul|natural|titani)/.test(normalized) && mentionsIphone) {
    return 'sem_estoque_alternativa';
  }
  if (/(duvida|indica|recomenda|compensa|qual melhor|melhor pra|melhor para)/.test(normalized) && mentionsIphone) {
    return 'cliente_indeciso';
  }
  if (mentionsModel || mentionsIphone) return 'compra_modelo_definido';
  return null;
}

function isNoisySourcePrompt(prompt) {
  const text = normalize(prompt);
  if (prompt.length > 650) return true;
  if (/(revendas|oportunidades pra faturar|atualizado \d{2}\/\d{2}|linha iphone|homologados anatel)/.test(text)) return true;
  if (/(conserto|assistencia tecnica|bateria inchou|troca de tela|reparo)/.test(text)) return true;
  if (/(apenas iphone|outro dispositivo)/.test(text)) return true;
  return false;
}

function scoreMessage(message) {
  const text = normalize(message.content);
  let score = 0;
  if (/\biphone\b/.test(text)) score += 25;
  if (/\biphone\s?(1[1-7]|x|xr|xs|se)\b/.test(text)) score += 15;
  if (/(troca|trocar|entrada|meu iphone|pega meu|avaliar)/.test(text)) score += 25;
  if (/(simula|simulacao|quanto fica|valor|preco|diferenca|volta)/.test(text)) score += 20;
  if (/(parcela|parcelamento|cartao|bandeira|\bvisa\b|\bmaster\b|\bmastercard\b|\belo\b|\bnubank\b|\d+x)/.test(text)) score += 15;
  if (/(compar| ou |versus|\bvs\b|qual compensa)/.test(text)) score += 20;
  if (/(caro|desconto|negocia|melhor preco|menor valor)/.test(text)) score += 15;
  if (/(tem|estoque|disponivel|cor)/.test(text)) score += 8;
  if (text.length > 20) score += 5;
  if (text.length > 160) score -= 5;
  return score;
}

function buildFallbackScenarios() {
  return [
    {
      category: 'comparacao_dois_iphones',
      prompt: 'Quero iPhone 15 Pro Max ou 16 Pro Max. Quanto fica a diferenca para o meu iPhone 13 128GB nos dois?',
    },
    {
      category: 'faltam_dados_tradein',
      prompt: 'Tenho um iPhone 13 128GB para dar de entrada e quero pegar um iPhone 15 Pro Max. Quanto fica?',
    },
    {
      category: 'troca_com_iphone_entrada',
      prompt: 'Quero trocar meu iPhone 13 128GB preto, bateria 86%, sem arranho, nunca molhou, tudo original e com caixa/cabo por um iPhone 15 Pro Max 256GB. Meu cartao e Visa.',
    },
    {
      category: 'parcelamento_bandeira',
      prompt: 'Qual fica a parcela do iPhone 15 Pro Max 256GB no Mastercard com 1000 de entrada?',
    },
    {
      category: 'objecao_preco',
      prompt: 'Achei caro esse iPhone 15 Pro Max. Consegue melhorar o valor ou fazer uma condicao melhor?',
    },
    {
      category: 'sem_estoque_alternativa',
      prompt: 'Tem iPhone 16 Pro Max 256GB preto disponivel? Se nao tiver, qual opcao parecida voce recomenda?',
    },
    {
      category: 'cliente_indeciso',
      prompt: 'Estou em duvida entre iPhone 15 Pro e 15 Pro Max. Qual compensa mais para foto e bateria?',
    },
    {
      category: 'compra_modelo_definido',
      prompt: 'Boa tarde, quero comprar um iPhone 15 128GB. Quanto fica no cartao Visa?',
    },
  ].map((scenario, index) => ({
    ...scenario,
    id: `fallback-${index + 1}`,
    source: 'fallback_generated',
    source_conversation_id: null,
    source_message_id: null,
    source_created_at: null,
    score: 0,
  }));
}

async function selectSandbox(supabase) {
  const exactPhone = `+${SANDBOX_PHONE}`;
  let { data: leads, error } = await supabase
    .from('crm_leads')
    .select('*')
    .eq('phone', exactPhone)
    .limit(5);
  if (error) throw new Error(`Sandbox lead lookup failed: ${error.message}`);

  if (!leads?.length) {
    const result = await supabase
      .from('crm_leads')
      .select('*')
      .ilike('phone', `%${SANDBOX_PHONE}%`)
      .limit(10);
    if (result.error) throw new Error(`Sandbox fallback lookup failed: ${result.error.message}`);
    leads = result.data ?? [];
  }

  const lead = leads.find((item) => digits(item.phone) === SANDBOX_PHONE) ?? leads[0];
  if (!lead) throw new Error(`No sandbox lead found for ${SANDBOX_PHONE}`);

  const { data: conversations, error: conversationError } = await supabase
    .from('crm_conversations')
    .select('*')
    .eq('lead_id', lead.id)
    .order('updated_at', { ascending: false })
    .limit(5);
  if (conversationError) throw new Error(`Sandbox conversation lookup failed: ${conversationError.message}`);

  const conversation = (conversations ?? []).find((item) => digits(item.talk_id) === SANDBOX_PHONE) ?? conversations?.[0];
  if (!conversation) throw new Error(`No sandbox conversation found for lead ${lead.id}`);

  const { data: leadState, error: leadStateError } = await supabase
    .from('lead_state')
    .select('*')
    .eq('lead_id', lead.id)
    .maybeSingle();
  if (leadStateError) throw new Error(`Sandbox lead_state lookup failed: ${leadStateError.message}`);

  return { lead, conversation, leadState: leadState ?? null };
}

async function selectScenarios(supabase, sandboxLead, limit) {
  const { data: rows, error } = await supabase
    .from('crm_messages')
    .select('id,conversation_id,lead_id,channel_id,store_id,content,created_at,direction,sender_type')
    .eq('direction', 'inbound')
    .eq('sender_type', 'customer')
    .not('content', 'is', null)
    .order('created_at', { ascending: false })
    .limit(1200);
  if (error) throw new Error(`CRM message query failed: ${error.message}`);

  const byConversation = new Map();
  for (const row of rows ?? []) {
    if (!row.content || row.lead_id === sandboxLead.id) continue;
    const prompt = cleanText(row.content);
    if (!prompt) continue;
    if (isNoisySourcePrompt(prompt)) continue;
    const category = classifyScenario(prompt);
    if (!category) continue;
    const score = scoreMessage(row);
    const current = byConversation.get(row.conversation_id);
    if (!current || score > current.score) {
      byConversation.set(row.conversation_id, {
        id: `crm-${row.id}`,
        source: 'crm_conversation',
        source_conversation_id: row.conversation_id,
        source_message_id: row.id,
        source_created_at: row.created_at,
        category,
        prompt,
        score,
      });
    }
  }

  const candidates = [...byConversation.values()].sort((a, b) => b.score - a.score);
  const fallbacks = buildFallbackScenarios();
  const selected = [];
  const usedCategories = new Set();
  for (const category of REQUIRED_CATEGORIES) {
    const match = candidates.find((item) => item.category === category && !selected.includes(item));
    if (match) {
      selected.push(match);
      usedCategories.add(category);
    }
  }
  for (const category of REQUIRED_CATEGORIES) {
    if (selected.length >= limit) break;
    if (usedCategories.has(category)) continue;
    const fallback = fallbacks.find((item) => item.category === category);
    if (fallback) {
      selected.push(fallback);
      usedCategories.add(category);
    }
  }
  for (const candidate of candidates) {
    if (selected.length >= limit) break;
    if (selected.some((item) => item.source_conversation_id === candidate.source_conversation_id)) continue;
    selected.push(candidate);
    usedCategories.add(candidate.category);
  }
  for (const fallback of fallbacks) {
    if (selected.length >= Math.max(8, limit)) break;
    if (!usedCategories.has(fallback.category)) {
      selected.push(fallback);
      usedCategories.add(fallback.category);
    }
  }
  for (const fallback of fallbacks) {
    if (selected.length >= limit) break;
    if (!selected.some((item) => item.id === fallback.id)) selected.push(fallback);
  }

  return selected.slice(0, limit).map((scenario, index) => ({
    ...scenario,
    ordinal: index + 1,
  }));
}

async function n8nFetch(env, route, options = {}) {
  const origin = new URL(env.N8N_MCP_URL).origin;
  const response = await fetch(new URL(route, origin), {
    ...options,
    headers: {
      'X-N8N-API-KEY': env.N8N_PUBLIC_API,
      ...(options.headers ?? {}),
    },
  });
  const text = await response.text();
  let data = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = text;
  }
  if (!response.ok) {
    throw new Error(`n8n ${route} failed: HTTP ${response.status} ${typeof data === 'string' ? data.slice(0, 300) : JSON.stringify(data).slice(0, 300)}`);
  }
  return data;
}

async function getWorkflow(env) {
  return await n8nFetch(env, `/api/v1/workflows/${WORKFLOW_ID}`);
}

async function activateWorkflow(env) {
  return await n8nFetch(env, `/api/v1/workflows/${WORKFLOW_ID}/activate`, { method: 'POST' });
}

async function deactivateWorkflow(env) {
  return await n8nFetch(env, `/api/v1/workflows/${WORKFLOW_ID}/deactivate`, { method: 'POST' });
}

async function listRecentExecutions(env, startedAtIso) {
  try {
    const payload = await n8nFetch(env, `/api/v1/executions?workflowId=${WORKFLOW_ID}&limit=10`);
    const rows = Array.isArray(payload?.data) ? payload.data : Array.isArray(payload) ? payload : [];
    const start = Date.parse(startedAtIso);
    return rows
      .filter((row) => Date.parse(row.startedAt ?? row.createdAt ?? 0) >= start - 2000)
      .map((row) => ({
        id: row.id,
        status: row.status ?? (row.finished ? 'finished' : 'unknown'),
        mode: row.mode ?? null,
        startedAt: row.startedAt ?? row.createdAt ?? null,
        stoppedAt: row.stoppedAt ?? null,
      }));
  } catch (error) {
    return [{ error: error instanceof Error ? error.message : String(error) }];
  }
}

function buildPayload({ scenario, lead, conversation, runId, turnPrompt, turnIndex = 0 }) {
  const now = Date.now();
  const chatid = conversation.talk_id || `${SANDBOX_PHONE}@s.whatsapp.net`;
  const messageId = `audit-${scenario.ordinal}-${turnIndex + 1}-${now}`;
  const scenarioInstanceId = `${scenario.id}-${runId}`;
  const prompt = turnPrompt || scenario.prompt;
  return {
    event: 'inbound_message',
    instanceName: String(lead.entity_id || 'crm'),
    type: 'text',
    lead_id: lead.id,
    store_id: conversation.store_id || lead.store_id,
    body: {
      sender: chatid,
      message: {
        messageTimestamp: now,
        text: prompt,
        senderName: lead.name || 'Cliente Teste',
        messageid: messageId,
        fromMe: false,
        edited: '',
        owner: '',
        chatid,
        content: prompt,
      },
      BaseUrl: 'https://crm.internal/scenario-audit',
      EventType: 'messages',
      chatid,
      mediaType: '',
    },
    lead: {
      summary_short: '',
      instagram_user_id: null,
      instagram_username: null,
    },
    lead_detail: {
      ...lead,
      summary_short: '',
      summary_operational: '',
      first_message: '',
      last_message_content: '',
      last_event_name: '',
      last_event_at: null,
      last_message_at: null,
      last_interaction_at: null,
    },
    media: { URL: null, mimetype: null, mediaKey: null },
    meta: {
      source: 'repasse_v2_scenario_audit',
      conversation_id: conversation.id,
      channel_id: conversation.channel_id,
      message_id: messageId,
      scenario_id: scenarioInstanceId,
      source_scenario_id: scenario.id,
      scenario_category: scenario.category,
      scenario_turn: turnIndex + 1,
      source_conversation_id: scenario.source_conversation_id,
    },
    raw_inbound: {
      source: 'repasse_v2_scenario_audit',
      message: {
        type: 'text',
        messageType: 'conversation',
        id: messageId,
      },
    },
  };
}

async function resetSandbox(supabase, lead, conversation) {
  const now = new Date().toISOString();
  const leadPatch = {
    summary_short: null,
    summary_operational: null,
    first_message: null,
    last_message_content: null,
    last_event_name: null,
    last_event_at: null,
    last_message_at: null,
    last_interaction_at: null,
    attendance_owner: 'ia',
    conversation_status: 'em_atendimento_ia',
    last_agent_type: 'alana',
    updated_at: now,
  };

  let { error: leadError } = await supabase.from('crm_leads').update(leadPatch).eq('id', lead.id);
  let usedFallback = false;
  if (leadError && /summary_operational|last_message_content|last_agent_type/i.test(leadError.message)) {
    usedFallback = true;
    const fallbackPatch = {
      summary_short: null,
      attendance_owner: 'ia',
      conversation_status: 'em_atendimento_ia',
      updated_at: now,
    };
    const fallback = await supabase.from('crm_leads').update(fallbackPatch).eq('id', lead.id);
    leadError = fallback.error;
  }
  if (leadError) throw new Error(`Sandbox lead reset failed: ${leadError.message}`);

  const { error: leadStateError } = await supabase
    .from('lead_state')
    .delete()
    .eq('lead_id', lead.id);
  if (leadStateError) throw new Error(`Sandbox lead_state reset failed: ${leadStateError.message}`);

  const { error: conversationError } = await supabase
    .from('crm_conversations')
    .update({ status: 'ai_handling', ai_enabled: true, updated_at: now })
    .eq('id', conversation.id);
  if (conversationError) throw new Error(`Sandbox conversation reset failed: ${conversationError.message}`);

  return { usedFallback };
}

async function restoreSandbox(supabase, initialLead, initialConversation, initialLeadState) {
  const leadPatch = {};
  for (const key of [
    'summary_short',
    'summary_operational',
    'first_message',
    'last_message_content',
    'last_event_name',
    'last_event_at',
    'last_message_at',
    'last_interaction_at',
    'attendance_owner',
    'conversation_status',
    'last_agent_type',
  ]) {
    if (Object.prototype.hasOwnProperty.call(initialLead, key)) leadPatch[key] = initialLead[key];
  }
  leadPatch.updated_at = new Date().toISOString();

  const { error: leadError } = await supabase.from('crm_leads').update(leadPatch).eq('id', initialLead.id);
  if (leadError) throw new Error(`Sandbox lead restore failed: ${leadError.message}`);

  const conversationPatch = {
    status: initialConversation.status,
    ai_enabled: initialConversation.ai_enabled,
    updated_at: new Date().toISOString(),
  };
  const { error: conversationError } = await supabase
    .from('crm_conversations')
    .update(conversationPatch)
    .eq('id', initialConversation.id);
  if (conversationError) throw new Error(`Sandbox conversation restore failed: ${conversationError.message}`);

  if (initialLeadState) {
    const { error: stateRestoreError } = await supabase
      .from('lead_state')
      .upsert({ ...initialLeadState, updated_at: new Date().toISOString() }, { onConflict: 'lead_id' });
    if (stateRestoreError) throw new Error(`Sandbox lead_state restore failed: ${stateRestoreError.message}`);
  } else {
    const { error: stateDeleteError } = await supabase
      .from('lead_state')
      .delete()
      .eq('lead_id', initialLead.id);
    if (stateDeleteError) throw new Error(`Sandbox lead_state cleanup failed: ${stateDeleteError.message}`);
  }
}

async function createScenarioSandbox(supabase, template, scenario, runId) {
  const identity = createSandboxIdentity(runId, scenario.ordinal);
  const leadRow = {
    id: identity.leadId,
    store_id: template.lead.store_id,
    phone: template.lead.phone,
    name: `${template.lead.name || 'Cliente Teste'} [AUDIT ${scenario.ordinal}]`,
    contact_id: template.lead.contact_id,
    entity_id: template.lead.entity_id,
    source_channel_id: template.lead.source_channel_id || template.conversation.channel_id,
    tags: [...new Set([...(template.lead.tags || []), identity.cleanupTag])],
    first_message: null,
  };
  const { data: lead, error: leadError } = await supabase
    .from('crm_leads')
    .insert(leadRow)
    .select('*')
    .single();
  if (leadError) throw new Error(`Scenario sandbox lead create failed: ${leadError.message}`);

  const conversationRow = {
    id: identity.conversationId,
    store_id: template.conversation.store_id || template.lead.store_id,
    lead_id: identity.leadId,
    channel_id: template.conversation.channel_id,
    talk_id: template.conversation.talk_id,
    status: 'ai_handling',
    ai_enabled: true,
  };
  const { data: conversation, error: conversationError } = await supabase
    .from('crm_conversations')
    .insert(conversationRow)
    .select('*')
    .single();
  if (conversationError) {
    await supabase.from('crm_leads').delete().eq('id', identity.leadId);
    throw new Error(`Scenario sandbox conversation create failed: ${conversationError.message}`);
  }
  return { lead, conversation, identity };
}

async function cleanupScenarioSandbox(supabase, sandbox) {
  if (!sandbox?.lead?.id) return;
  const { error } = await supabase.from('crm_leads').delete().eq('id', sandbox.lead.id);
  if (error) throw new Error(`Scenario sandbox cleanup failed: ${error.message}`);
}

async function dispatchScenario(env, scenario, lead, conversation, runId, turnPrompt, turnIndex) {
  const origin = new URL(env.N8N_MCP_URL).origin;
  const payload = buildPayload({ scenario, lead, conversation, runId, turnPrompt, turnIndex });
  const response = await fetch(new URL(`/webhook/${WEBHOOK_PATH}`, origin), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const body = await response.text();
  return {
    ok: response.ok,
    status: response.status,
    body: body.slice(0, 1000),
    messageId: payload.meta.message_id,
  };
}

async function waitForAiResponse(supabase, conversationId, sinceIso) {
  const deadline = Date.now() + RESPONSE_TIMEOUT_MS;
  let lastRows = [];
  let lastAiCount = 0;
  let lastChangeAt = Date.now();
  while (Date.now() < deadline) {
    const { data, error } = await supabase
      .from('crm_messages')
      .select('id,content,direction,sender_type,status,created_at,provider_message_id,error_message')
      .eq('conversation_id', conversationId)
      .gte('created_at', sinceIso)
      .order('created_at', { ascending: true })
      .limit(20);
    if (error) throw new Error(`CRM response polling failed: ${error.message}`);
    lastRows = data ?? [];
    const aiMessages = lastRows.filter((row) => row.direction === 'outbound' && row.sender_type === 'ai_inbound');
    if (aiMessages.length !== lastAiCount) {
      lastAiCount = aiMessages.length;
      lastChangeAt = Date.now();
    }
    if (aiMessages.length > 0 && Date.now() - lastChangeAt >= RESPONSE_QUIET_MS) {
      return {
        timedOut: false,
        rows: lastRows,
        aiMessage: aiMessages[0],
        aiMessages,
        combinedContent: aiMessages.map((row) => row.content).filter(Boolean).join('\n\n'),
      };
    }
    await new Promise((resolve) => setTimeout(resolve, RESPONSE_POLL_MS));
  }
  const aiMessages = lastRows.filter((row) => row.direction === 'outbound' && row.sender_type === 'ai_inbound');
  return {
    timedOut: aiMessages.length === 0,
    rows: lastRows,
    aiMessage: aiMessages[0] ?? null,
    aiMessages,
    combinedContent: aiMessages.map((row) => row.content).filter(Boolean).join('\n\n'),
  };
}

function evaluateResponse(scenario, responseText, timedOut) {
  const text = normalize(responseText);
  const hasInstallments = /(\b1x\b|\b6x\b|\b12x\b|\b18x\b|parcela|parcelamento)/.test(text);
  const hasQuestion = /\?/.test(responseText) || /(me confirma|qual|pode me informar|me diz|me manda|preciso saber)/.test(text);
  const hasTradeinQuestion = /(bateria|arranho|arranha|molhou|agua|peca|original|caixa|cabo|garantia|estado)/.test(text);
  const hasValue = /(r\$|\d+[,.]\d{2}|\d+\s?reais|entrada|diferenca)/.test(text);
  const comparisonOk = scenario.category !== 'comparacao_dois_iphones' || /(compar|opcao|15|16|cada|alternativa|nos dois)/.test(text);
  const negotiationOk = /(posso|vamos|consigo|melhor|reserva|fechar|confirmar|te passo|opcao|alternativa)/.test(text);
  const issues = [];

  if (timedOut) issues.push({ level: 'Critico', issue: 'A IA nao respondeu dentro do tempo limite.' });
  if (scenario.category.includes('tradein') || scenario.category === 'faltam_dados_tradein') {
    if (scenario.category === 'faltam_dados_tradein' && !hasTradeinQuestion) {
      issues.push({ level: 'Critico', issue: 'Nao pediu estado completo do trade-in antes de seguir.' });
    }
  }
  if ((hasValue || scenario.category === 'parcelamento_bandeira') && !hasInstallments) {
    issues.push({ level: 'Alto impacto', issue: 'Resposta nao trouxe opcoes de parcelamento.' });
  }
  if (!comparisonOk) {
    issues.push({ level: 'Critico', issue: 'Cenario de comparacao nao foi tratado como alternativas separadas.' });
  }
  if (!timedOut && !hasQuestion && !hasValue) {
    issues.push({ level: 'Alto impacto', issue: 'Resposta nao avancou com pergunta objetiva nem simulacao.' });
  }
  if (!timedOut && !negotiationOk) {
    issues.push({ level: 'Refino', issue: 'Tom comercial pode ter proximo passo mais forte.' });
  }

  return {
    entendimento: timedOut ? 'critico' : 'ok',
    perguntas_certas: hasQuestion || hasValue ? 'ok' : 'fraco',
    simulacao: hasValue ? (hasInstallments ? 'ok' : 'incompleta') : 'nao_aplicada',
    negociacao: negotiationOk ? 'ok' : 'refino',
    alternativas: comparisonOk ? 'ok' : 'critico',
    seguranca_operacional: issues.some((item) => item.level === 'Critico') ? 'risco' : 'ok',
    performance: timedOut ? 'timeout' : 'ok',
    issues,
  };
}

function markdownEscape(value) {
  return String(value ?? '').replace(/\|/g, '\\|');
}

async function writeReport({ scenarios, results, sandbox, workflowInitial, workflowFinal, reportPath, notes }) {
  const lines = [];
  lines.push('# Repasse V2 WhatsApp Scenario Audit');
  lines.push('');
  lines.push(`Generated at: ${new Date().toISOString()}`);
  lines.push(`Workflow: ${WORKFLOW_NAME} (${WORKFLOW_ID})`);
  lines.push(`Sandbox phone: ${SANDBOX_PHONE}`);
  lines.push(`Sandbox lead: ${sandbox.lead.id}`);
  lines.push(`Sandbox conversation: ${sandbox.conversation.id}`);
  lines.push(`Workflow initial active: ${workflowInitial?.active}`);
  lines.push(`Workflow final active: ${workflowFinal?.active}`);
  if (notes.length) {
    lines.push('');
    lines.push('## Notes');
    for (const note of notes) lines.push(`- ${note}`);
  }
  lines.push('');
  lines.push('## Scenario List');
  lines.push('');
  lines.push('| # | Category | Source | Source Conversation | Turns |');
  lines.push('| - | - | - | - | - |');
  for (const scenario of scenarios) {
    const turnSummary = normalizeScenarioTurns(scenario)
      .map((turn, index) => `${index + 1}. ${turn}`)
      .join('<br>');
    lines.push(`| ${scenario.ordinal} | ${scenario.category} | ${scenario.source} | ${scenario.source_conversation_id ?? ''} | ${markdownEscape(turnSummary)} |`);
  }

  lines.push('');
  lines.push('## Results');
  for (const result of results) {
    lines.push('');
    lines.push(`### Scenario ${result.scenario.ordinal}: ${result.scenario.category}`);
    lines.push('');
    lines.push(`Source: ${result.scenario.source} ${result.scenario.source_conversation_id ?? ''}`);
    lines.push('');
    lines.push(`Turns: ${result.turns.length}`);
    lines.push(`Elapsed: ${result.elapsedMs}ms`);
    lines.push(`Timed out: ${result.response.timedOut}`);
    lines.push(`AI message ids: ${(result.response.aiMessages ?? []).map((row) => row.id).join(', ')}`);
    for (const turn of result.turns) {
      lines.push('');
      lines.push(`#### Turn ${turn.turn}`);
      lines.push('');
      lines.push('Customer:');
      lines.push('');
      lines.push('```text');
      lines.push(turn.prompt);
      lines.push('```');
      lines.push('');
      lines.push(`Dispatch: HTTP ${turn.dispatch.status}, ok=${turn.dispatch.ok}`);
      lines.push(`Elapsed: ${turn.elapsedMs}ms`);
      lines.push(`Timed out: ${turn.response.timedOut}`);
      lines.push('');
      lines.push('AI response:');
      lines.push('');
      lines.push('```text');
      lines.push(turn.response.combinedContent || turn.response.aiMessage?.content || '[sem resposta capturada]');
      lines.push('```');
      lines.push('');
      lines.push('Recent n8n executions:');
      lines.push('');
      lines.push('```json');
      lines.push(JSON.stringify(turn.executions, null, 2));
      lines.push('```');
    }
    lines.push('');
    lines.push('Rubric:');
    lines.push('');
    lines.push('```json');
    lines.push(JSON.stringify(result.evaluation, null, 2));
    lines.push('```');
  }

  const allIssues = results.flatMap((result) => result.evaluation.issues.map((issue) => ({
    ...issue,
    scenario: result.scenario.ordinal,
    category: result.scenario.category,
  })));
  lines.push('');
  lines.push('## Findings');
  if (!allIssues.length) {
    lines.push('');
    lines.push('- Nenhum problema automatico detectado. Revisao humana ainda recomendada.');
  } else {
    lines.push('');
    lines.push('| Level | Scenario | Category | Issue |');
    lines.push('| - | - | - | - |');
    for (const issue of allIssues) {
      lines.push(`| ${issue.level} | ${issue.scenario} | ${issue.category} | ${markdownEscape(issue.issue)} |`);
    }
  }

  lines.push('');
  lines.push('## Recommended Improvement Targets');
  lines.push('');
  lines.push('- `Memory 1 - Extractor`: revisar extracao quando a resposta do cliente mistura dois modelos, entrada e aparelho de troca.');
  lines.push('- `Memory 2 - Reconciler`: preservar `comparison` por padrao em dois aparelhos e impedir pacote sem sinal explicito.');
  lines.push('- `Parse Memory`: manter trava de trade-in completo antes de simular.');
  lines.push('- `Bia 1`: melhorar ordem das perguntas de estado do aparelho de entrada se os cenarios mostrarem friccao.');
  lines.push('- `Bia 2 ESTOQUE`: reforcar parcelamento minimo e proximo passo comercial.');
  lines.push('- `Montar Body do Simulador`: auditar se trade-in/entrada sao aplicados corretamente por modo.');
  lines.push('- `crm-simulator-quote`: auditar formato de retorno quando comparacao multi-aparelho for executada.');

  await mkdir(path.dirname(reportPath), { recursive: true });
  await writeFile(reportPath, `${lines.join('\n')}\n`, 'utf8');
}

function printScenarioList(scenarios) {
  console.log(JSON.stringify({
    count: scenarios.length,
    categories: scenarios.map((scenario) => scenario.category),
    scenarios: scenarios.map((scenario) => ({
      ordinal: scenario.ordinal,
      category: scenario.category,
      source: scenario.source,
      source_conversation_id: scenario.source_conversation_id,
      source_created_at: scenario.source_created_at,
      turns: normalizeScenarioTurns(scenario),
    })),
  }, null, 2));
}

async function run() {
  const args = parseArgs(process.argv.slice(2));
  const env = await loadEnv();
  const supabase = createClient(env.VITE_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
  });
  const sandbox = await selectSandbox(supabase);
  const selectedScenarios = await selectScenarios(supabase, sandbox.lead, 10);
  const combinedScenarios = [...buildCriticalScenarios(), ...selectedScenarios]
    .filter((scenario, index, rows) => rows.findIndex((item) => item.id === scenario.id) === index)
    .map((scenario, index) => ({ ...scenario, ordinal: index + 1 }))
    .filter((scenario) => validateScenario(scenario).valid);
  const scenarios = combinedScenarios
    .filter((scenario) => scenario.ordinal >= args.start)
    .slice(0, args.limit);

  if (args.listScenarios) {
    printScenarioList(scenarios);
    return;
  }

  const dateStamp = new Date().toISOString().slice(0, 10);
  const reportSuffix = args.start === 1 && args.limit === 10 ? '' : `-s${String(args.start).padStart(2, '0')}-n${String(args.limit).padStart(2, '0')}`;
  const reportPath = path.join(ROOT, 'output', 'n8n', `repasse-v2-scenario-audit-${dateStamp}${reportSuffix}.md`);
  const runId = new Date().toISOString().replace(/[^0-9]/g, '').slice(0, 14);
  const workflowInitial = await getWorkflow(env);
  const notes = [];
  const results = [];
  let activatedByScript = false;

  try {
    if (!workflowInitial.active) {
      await activateWorkflow(env);
      activatedByScript = true;
      await new Promise((resolve) => setTimeout(resolve, 1500));
    }

    for (const scenario of scenarios) {
      let scenarioSandbox = null;
      try {
        scenarioSandbox = await createScenarioSandbox(supabase, sandbox, scenario, runId);
        const turnResults = [];
        for (const [turnIndex, turnPrompt] of normalizeScenarioTurns(scenario).entries()) {
          const startedAt = new Date();
          const dispatch = await dispatchScenario(
            env,
            scenario,
            scenarioSandbox.lead,
            scenarioSandbox.conversation,
            runId,
            turnPrompt,
            turnIndex,
          );
          const response = await waitForAiResponse(supabase, scenarioSandbox.conversation.id, startedAt.toISOString());
          const executions = await listRecentExecutions(env, startedAt.toISOString());
          turnResults.push({
            turn: turnIndex + 1,
            prompt: turnPrompt,
            dispatch,
            response,
            executions,
            elapsedMs: Date.now() - startedAt.getTime(),
          });
          if (response.timedOut) break;
          await new Promise((resolve) => setTimeout(resolve, 1500));
        }
        const lastTurn = turnResults.at(-1);
        const combinedContent = turnResults
          .map((turn) => turn.response.combinedContent || turn.response.aiMessage?.content || '')
          .filter(Boolean)
          .join('\n\n');
        const evaluation = evaluateResponse(
          scenario,
          combinedContent,
          turnResults.some((turn) => turn.response.timedOut),
        );
        results.push({
          scenario,
          turns: turnResults,
          dispatch: lastTurn.dispatch,
          response: {
            ...lastTurn.response,
            combinedContent,
            timedOut: turnResults.some((turn) => turn.response.timedOut),
          },
          executions: turnResults.flatMap((turn) => turn.executions),
          elapsedMs: turnResults.reduce((sum, turn) => sum + turn.elapsedMs, 0),
          evaluation,
        });
        console.log(JSON.stringify({
          scenario: scenario.ordinal,
          category: scenario.category,
          turns: turnResults.length,
          timedOut: turnResults.some((turn) => turn.response.timedOut),
          issues: evaluation.issues,
        }));
      } finally {
        try {
          await cleanupScenarioSandbox(supabase, scenarioSandbox);
        } catch (error) {
          notes.push(`Scenario ${scenario.ordinal} cleanup failed: ${error instanceof Error ? error.message : String(error)}`);
        }
      }
    }
  } finally {
    if (activatedByScript) {
      try {
        await deactivateWorkflow(env);
      } catch (error) {
        notes.push(`Failed to deactivate v2 workflow: ${error instanceof Error ? error.message : String(error)}`);
      }
    }
  }

  const workflowFinal = await getWorkflow(env);
  await writeReport({ scenarios, results, sandbox, workflowInitial, workflowFinal, reportPath, notes });
  console.log(JSON.stringify({
    reportPath,
    scenarios: scenarios.length,
    results: results.length,
    workflowInitialActive: workflowInitial.active,
    workflowFinalActive: workflowFinal.active,
  }, null, 2));
}

run().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
