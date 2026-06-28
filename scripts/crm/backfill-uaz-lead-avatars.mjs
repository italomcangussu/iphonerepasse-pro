import { readFile, mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

const clean = (value) => String(value ?? '').trim();
const relation = (value) => Array.isArray(value) ? value[0] ?? null : value ?? null;
const hasRemoteImage = (chat) => Boolean(clean(chat?.imagePreview || chat?.image));

export async function discoverAvatarBackfillCandidates(deps) {
  const conversations = await deps.fetchLocalConversations();
  const channelIds = [...new Set(conversations.map((row) => clean(row.channel_id)).filter(Boolean))];
  const remoteByChannel = new Map();
  await Promise.all(channelIds.map(async (channelId) => {
    const chats = await deps.fetchRemoteChats(channelId);
    remoteByChannel.set(
      channelId,
      new Map(chats.map((chat) => [clean(chat.wa_chatid).toLowerCase(), chat])),
    );
  }));

  const seenLeads = new Set();
  const candidates = [];
  for (const conversation of conversations) {
    const lead = relation(conversation.crm_leads);
    const leadId = clean(lead?.id);
    const channelId = clean(conversation.channel_id);
    if (!leadId || !channelId || clean(lead?.avatar_url) || seenLeads.has(leadId)) continue;
    const remote = remoteByChannel.get(channelId)?.get(clean(conversation.talk_id).toLowerCase());
    if (!hasRemoteImage(remote)) continue;
    seenLeads.add(leadId);
    candidates.push({ leadId, channelId });
  }
  return candidates;
}

const runBounded = async (items, concurrency, worker) => {
  const results = new Array(items.length);
  let next = 0;
  const runners = Array.from({ length: Math.min(Math.max(1, concurrency), items.length) }, async () => {
    while (next < items.length) {
      const index = next;
      next += 1;
      results[index] = await worker(items[index]);
    }
  });
  await Promise.all(runners);
  return results;
};

export async function runAvatarBackfill(options, deps) {
  const candidates = await discoverAvatarBackfillCandidates(deps);
  if (!options.apply) {
    return { mode: 'dry-run', candidates: candidates.length, attempted: 0, statuses: {} };
  }

  const results = await runBounded(
    candidates,
    options.concurrency ?? 3,
    async (candidate) => {
      try {
        return await deps.refreshLead(candidate);
      } catch {
        return { status: 'request_failed' };
      }
    },
  );
  const statuses = {};
  for (const result of results) {
    const status = clean(result?.status) || 'unknown';
    statuses[status] = (statuses[status] || 0) + 1;
  }
  return {
    mode: 'apply',
    candidates: candidates.length,
    attempted: results.length,
    statuses,
  };
}

const parseEnv = (text) => {
  const values = {};
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;
    const match = line.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);
    if (!match) continue;
    let value = match[2].trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    values[match[1]] = value;
  }
  return values;
};

const createProductionDeps = async () => {
  const fileEnv = parseEnv(await readFile(path.join(ROOT, '.env.local'), 'utf8'));
  const env = { ...fileEnv, ...process.env };
  const supabaseUrl = clean(env.VITE_SUPABASE_URL || env.SUPABASE_URL).replace(/\/$/, '');
  const serviceRole = clean(env.SUPABASE_SERVICE_ROLE_KEY);
  if (!supabaseUrl || !serviceRole) {
    throw new Error('VITE_SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY são obrigatórios.');
  }
  const headers = { apikey: serviceRole, Authorization: `Bearer ${serviceRole}` };
  const rest = `${supabaseUrl}/rest/v1`;
  const getRows = async (resource) => {
    const response = await fetch(`${rest}/${resource}`, { headers });
    if (!response.ok) throw new Error(`supabase_http_${response.status}`);
    return response.json();
  };
  const channelCache = new Map();

  return {
    async fetchLocalConversations() {
      const rows = [];
      for (let offset = 0; ; offset += 1000) {
        const page = await getRows(
          `crm_conversations?select=talk_id,channel_id,crm_leads!inner(id,avatar_url)&is_group=eq.false&talk_id=not.is.null&crm_leads.avatar_url=is.null&order=last_message_at.desc&limit=1000&offset=${offset}`,
        );
        rows.push(...page);
        if (page.length < 1000) break;
      }
      return rows;
    },
    async fetchRemoteChats(channelId) {
      let channel = channelCache.get(channelId);
      if (!channel) {
        const rows = await getRows(
          `crm_channels?select=api_endpoint,uaz_subdomain,uaz_instance_token,api_key&id=eq.${encodeURIComponent(channelId)}&limit=1`,
        );
        channel = rows[0];
        if (!channel) throw new Error('channel_not_found');
        channelCache.set(channelId, channel);
      }
      const token = clean(channel.uaz_instance_token || channel.api_key);
      const origin = clean(channel.api_endpoint) || `https://${clean(channel.uaz_subdomain || 'api')}.uazapi.com`;
      if (!token) throw new Error('uaz_instance_token_missing');
      const chats = [];
      for (let offset = 0; offset < 10000; offset += 500) {
        const response = await fetch(`${origin.replace(/\/$/, '')}/chat/find`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', token },
          body: JSON.stringify({ limit: 500, offset, sort: '-wa_lastMsgTimestamp' }),
        });
        if (!response.ok) throw new Error(`uaz_chat_find_http_${response.status}`);
        const body = await response.json();
        const page = Array.isArray(body.chats) ? body.chats : [];
        chats.push(...page);
        if (page.length < 500 || chats.length >= Number(body.pagination?.totalRecords || Infinity)) break;
      }
      return chats;
    },
    async refreshLead(candidate) {
      const response = await fetch(`${supabaseUrl}/functions/v1/crm-uaz-avatar-refresh`, {
        method: 'POST',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({ leadId: candidate.leadId, force: true }),
      });
      const body = await response.json().catch(() => ({}));
      return { status: clean(body.status) || `http_${response.status}` };
    },
  };
};

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  const apply = process.argv.includes('--apply') && process.env.DRY !== '1';
  const report = await runAvatarBackfill(
    { apply, concurrency: 3 },
    await createProductionDeps(),
  );
  const reportDir = path.join(ROOT, 'output/crm/avatar-backfill');
  await mkdir(reportDir, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const reportPath = path.join(reportDir, `${stamp}-${report.mode}.json`);
  await writeFile(reportPath, `${JSON.stringify({ ...report, created_at: new Date().toISOString() }, null, 2)}\n`);
  console.log(JSON.stringify({ ...report, report: path.relative(ROOT, reportPath) }, null, 2));
}
