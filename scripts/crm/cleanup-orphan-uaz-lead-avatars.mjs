#!/usr/bin/env node

import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const BUCKET = 'crm-media';
const AVATAR_PREFIX = 'avatars/';
const PAGE_SIZE = 1000;
const REMOVE_BATCH_SIZE = 100;

const clean = (value) => String(value ?? '').trim();

const decodeOnce = (value) => {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
};

const validateAvatarPath = (value) => {
  const normalized = clean(value).replace(/^\/+/, '');
  if (!normalized.startsWith(AVATAR_PREFIX)) return null;
  if (normalized.includes('\\') || normalized.split('/').includes('..')) return null;
  return normalized;
};

export const normalizeStoredAvatarPath = (value) => {
  const raw = clean(value);
  if (!raw) return null;

  if (!/^https?:\/\//i.test(raw)) {
    // Storage list() already returns the literal object name. Decoding here
    // would turn a legacy filename containing "%2B" into a different "+" key.
    return validateAvatarPath(raw.split(/[?#]/, 1)[0]);
  }

  try {
    const url = new URL(raw);
    const markers = [
      `/storage/v1/object/public/${BUCKET}/`,
      `/storage/v1/render/image/public/${BUCKET}/`,
    ];
    const marker = markers.find((candidate) => url.pathname.includes(candidate));
    if (!marker) return null;
    const objectPath = url.pathname.slice(url.pathname.indexOf(marker) + marker.length);
    return validateAvatarPath(decodeOnce(objectPath));
  } catch {
    return null;
  }
};

const referencedAvatarPaths = (leads) => {
  const referenced = new Set();
  for (const lead of leads || []) {
    for (const value of [lead?.avatar_storage_path, lead?.avatar_url]) {
      const normalized = normalizeStoredAvatarPath(value);
      if (normalized) referenced.add(normalized);
    }
  }
  return referenced;
};

export const discoverOrphanLeadAvatars = ({ objects, leads }) => {
  const referenced = referencedAvatarPaths(leads);
  const candidates = new Set();
  for (const object of objects || []) {
    const normalized = normalizeStoredAvatarPath(object?.name);
    if (normalized && !referenced.has(normalized)) candidates.add(normalized);
  }
  return [...candidates].sort();
};

export const runOrphanLeadAvatarCleanup = async (options, deps) => {
  const [objects, leads] = await Promise.all([
    deps.fetchAvatarObjects(),
    deps.fetchLeadAvatarReferences(),
  ]);
  const paths = discoverOrphanLeadAvatars({ objects, leads });
  const referenced = referencedAvatarPaths(leads).size;
  let deleted = 0;

  if (options.apply) {
    for (let index = 0; index < paths.length; index += REMOVE_BATCH_SIZE) {
      const batch = paths.slice(index, index + REMOVE_BATCH_SIZE);
      await deps.removeObjects(batch);
      deleted += batch.length;
    }
  }

  return {
    mode: options.apply ? 'apply' : 'dry-run',
    scanned: objects.length,
    referenced,
    orphaned: paths.length,
    deleted,
    paths,
  };
};

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
  const localEnv = await readFile(path.join(ROOT, '.env.local'), 'utf8').catch(() => '');
  const env = { ...parseEnv(localEnv), ...process.env };
  const supabaseUrl = clean(env.VITE_SUPABASE_URL || env.SUPABASE_URL).replace(/\/$/, '');
  const serviceRole = clean(env.SUPABASE_SERVICE_ROLE_KEY);
  if (!supabaseUrl || !serviceRole) {
    throw new Error('VITE_SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY são obrigatórios.');
  }

  const { createClient } = await import('@supabase/supabase-js');
  const supabase = createClient(supabaseUrl, serviceRole, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const storage = supabase.storage.from(BUCKET);

  const listDirectory = async (prefix) => {
    const entries = [];
    for (let offset = 0; ; offset += PAGE_SIZE) {
      const { data, error } = await storage.list(prefix, {
        limit: PAGE_SIZE,
        offset,
        sortBy: { column: 'name', order: 'asc' },
      });
      if (error) throw new Error(`Falha ao listar ${prefix || BUCKET}: ${error.message}`);
      entries.push(...(data || []));
      if (!data || data.length < PAGE_SIZE) break;
    }
    return entries;
  };

  return {
    async fetchAvatarObjects() {
      const objects = [];
      const directories = ['avatars'];
      while (directories.length > 0) {
        const prefix = directories.shift();
        for (const entry of await listDirectory(prefix)) {
          const objectPath = `${prefix}/${entry.name}`;
          if (entry.id) objects.push({ name: objectPath });
          else directories.push(objectPath);
        }
      }
      return objects;
    },
    async fetchLeadAvatarReferences() {
      const rows = [];
      for (let from = 0; ; from += PAGE_SIZE) {
        const { data, error } = await supabase
          .from('crm_leads')
          .select('avatar_storage_path,avatar_url')
          .range(from, from + PAGE_SIZE - 1);
        if (error) throw new Error(`Falha ao ler crm_leads: ${error.message}`);
        rows.push(...(data || []));
        if (!data || data.length < PAGE_SIZE) break;
      }
      return rows;
    },
    async removeObjects(paths) {
      const { error } = await storage.remove(paths);
      if (error) throw new Error(`Falha ao remover objetos: ${error.message}`);
    },
  };
};

const runCli = async () => {
  const apply = process.argv.includes('--apply') && process.env.DRY !== '1';
  const report = await runOrphanLeadAvatarCleanup({ apply }, await createProductionDeps());
  const outputDirectory = path.join(ROOT, 'output/crm/avatar-cleanup');
  await mkdir(outputDirectory, { recursive: true });
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const reportPath = path.join(outputDirectory, `${timestamp}-${report.mode}.json`);
  await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  console.log(JSON.stringify({ ...report, reportPath }, null, 2));
};

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  runCli().catch((error) => {
    console.error(error?.message || error);
    process.exitCode = 1;
  });
}
