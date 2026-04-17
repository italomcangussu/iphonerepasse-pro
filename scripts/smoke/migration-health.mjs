import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { createClient } from '@supabase/supabase-js';

const ROOT = process.cwd();
const MIGRATIONS_DIR = path.resolve(ROOT, 'supabase/migrations');
const SUPABASE_CONFIG = path.resolve(ROOT, 'supabase/config.toml');
const SUPABASE_TEMP_DIR = path.resolve(ROOT, 'supabase/.temp');
const REPORT_DIR = path.resolve(ROOT, 'reports/smoke');
const JSON_OUTPUT = path.resolve(REPORT_DIR, 'migration-health.json');
const MD_OUTPUT = path.resolve(REPORT_DIR, 'migration-health.md');

const parseEnvFile = (filePath) => {
  if (!fs.existsSync(filePath)) return {};

  const out = {};
  for (const line of fs.readFileSync(filePath, 'utf8').split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq <= 0) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    if (key) out[key] = value;
  }
  return out;
};

const env = {
  ...parseEnvFile(path.resolve(ROOT, '.env')),
  ...parseEnvFile(path.resolve(ROOT, '.env.local')),
  ...Object.fromEntries(Object.entries(process.env).filter(([, v]) => Boolean(v))),
};

const supabaseUrl = env.SUPABASE_URL || env.VITE_SUPABASE_URL || '';
const serviceRoleKey = env.SUPABASE_SERVICE_ROLE_KEY || '';

const parseMigrationFileName = (fileName) => {
  const match = fileName.match(/^(\d+)_([\w\-]+)\.sql$/);
  if (!match) return null;

  return {
    version: match[1],
    name: match[2],
    file: fileName,
  };
};

const readMigrationFiles = (directoryPath) => {
  if (!fs.existsSync(directoryPath)) return [];

  return fs
    .readdirSync(directoryPath)
    .map((file) => parseMigrationFileName(file))
    .filter(Boolean)
    .sort((a, b) => a.version.localeCompare(b.version));
};

const readLocalMigrations = () => {
  return readMigrationFiles(MIGRATIONS_DIR);
};

const parseCliMigrationRows = (rawOutput) => {
  const rows = [];
  const rowRegex = /^\s*(\d+)?\s*\|\s*(\d+)?\s*\|\s*.*$/;

  for (const line of rawOutput.split(/\r?\n/)) {
    const match = line.match(rowRegex);
    if (!match) continue;

    const localVersion = match[1] ? String(match[1]) : null;
    const remoteVersion = match[2] ? String(match[2]) : null;
    if (!localVersion && !remoteVersion) continue;

    rows.push({
      localVersion,
      remoteVersion,
    });
  }

  return rows;
};

const prepareTempSupabaseProject = () => {
  if (!fs.existsSync(SUPABASE_CONFIG)) {
    return {
      ok: false,
      reason: 'Missing supabase/config.toml',
      tempRoot: null,
    };
  }

  if (!fs.existsSync(path.resolve(SUPABASE_TEMP_DIR, 'project-ref'))) {
    return {
      ok: false,
      reason: 'Missing supabase/.temp/project-ref',
      tempRoot: null,
    };
  }

  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'smoke-supabase-fetch-'));
  const tempSupabaseDir = path.resolve(tempRoot, 'supabase');
  fs.mkdirSync(tempSupabaseDir, { recursive: true });

  fs.copyFileSync(SUPABASE_CONFIG, path.resolve(tempSupabaseDir, 'config.toml'));
  fs.cpSync(SUPABASE_TEMP_DIR, path.resolve(tempSupabaseDir, '.temp'), { recursive: true });

  return {
    ok: true,
    reason: null,
    tempRoot,
  };
};

const loadRemoteMigrationsFromCliFetch = () => {
  const prepared = prepareTempSupabaseProject();
  if (!prepared.ok) {
    return {
      status: 'error',
      reason: `CLI fetch fallback preflight failed: ${prepared.reason}`,
      rows: [],
      source: 'supabase_cli_fetch',
    };
  }

  const { tempRoot } = prepared;

  try {
    const cli = spawnSync('supabase', ['migration', 'fetch', '--linked'], {
      cwd: tempRoot,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    const combinedOutput = `${cli.stdout || ''}\n${cli.stderr || ''}`.trim();
    if (cli.error) {
      return {
        status: 'error',
        reason: `CLI fetch fallback failed: ${cli.error.message}`,
        rows: [],
        source: 'supabase_cli_fetch',
        diagnostics: combinedOutput || null,
      };
    }

    if ((cli.status ?? 1) !== 0) {
      return {
        status: 'error',
        reason: `CLI fetch fallback failed with exit code ${cli.status ?? 1}`,
        rows: [],
        source: 'supabase_cli_fetch',
        diagnostics: combinedOutput || null,
      };
    }

    const remoteMigrations = readMigrationFiles(path.resolve(tempRoot, 'supabase/migrations')).map((row) => ({
      version: row.version,
      name: row.name,
    }));

    if (remoteMigrations.length === 0) {
      return {
        status: 'error',
        reason: 'CLI fetch fallback returned no remote migration files',
        rows: [],
        source: 'supabase_cli_fetch',
        diagnostics: combinedOutput || null,
      };
    }

    return {
      status: 'ok',
      reason: null,
      rows: remoteMigrations,
      source: 'supabase_cli_fetch',
    };
  } finally {
    fs.rmSync(tempRoot, { recursive: true, force: true });
  }
};

const loadRemoteMigrationsFromCli = (localMigrations) => {
  const localByVersion = new Map(localMigrations.map((row) => [row.version, row]));
  const cli = spawnSync('supabase', ['migration', 'list', '--linked'], {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  if (cli.error) {
    return {
      status: 'error',
      reason: `CLI fallback failed: ${cli.error.message}`,
      rows: [],
      source: 'supabase_cli',
    };
  }

  const combinedOutput = `${cli.stdout || ''}\n${cli.stderr || ''}`.trim();
  if ((cli.status ?? 1) !== 0) {
    return {
      status: 'error',
      reason: `CLI fallback failed with exit code ${cli.status ?? 1}`,
      rows: [],
      source: 'supabase_cli',
      diagnostics: combinedOutput || null,
    };
  }

  const parsedRows = parseCliMigrationRows(combinedOutput);
  const remoteVersions = [...new Set(parsedRows.map((row) => row.remoteVersion).filter(Boolean))]
    .map((value) => String(value))
    .sort((a, b) => a.localeCompare(b));

  if (remoteVersions.length === 0) {
    return {
      status: 'error',
      reason: 'CLI fallback returned no remote migration rows',
      rows: [],
      source: 'supabase_cli',
      diagnostics: combinedOutput || null,
    };
  }

  return {
    status: 'ok',
    reason: null,
    rows: remoteVersions.map((version) => ({
      version,
      name: localByVersion.get(version)?.name ?? null,
    })),
    source: 'supabase_cli',
  };
};

const loadRemoteMigrations = async (localMigrations) => {
  if (!supabaseUrl || !serviceRoleKey) {
    return {
      status: 'unavailable',
      reason: 'Missing SUPABASE_SERVICE_ROLE_KEY or SUPABASE_URL/VITE_SUPABASE_URL',
      rows: [],
      source: 'none',
    };
  }

  const client = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  let data = null;
  let error = null;

  ({ data, error } = await client
    .schema('supabase_migrations')
    .from('schema_migrations')
    .select('version,name')
    .order('version', { ascending: true }));

  if (error && /column .*name.* does not exist/i.test(error.message || '')) {
    ({ data, error } = await client
      .schema('supabase_migrations')
      .from('schema_migrations')
      .select('version')
      .order('version', { ascending: true }));
  }

  if (error) {
    const cliFetchFallback = loadRemoteMigrationsFromCliFetch();
    if (cliFetchFallback.status === 'ok') {
      return cliFetchFallback;
    }

    const cliListFallback = loadRemoteMigrationsFromCli(localMigrations);
    if (cliListFallback.status === 'ok') {
      return cliListFallback;
    }

    return {
      status: 'error',
      reason: error.message || 'Failed to read remote migrations',
      rows: [],
      source: 'rest',
      fallback: [
        {
          source: cliFetchFallback.source,
          status: cliFetchFallback.status,
          reason: cliFetchFallback.reason,
          diagnostics: cliFetchFallback.diagnostics || null,
        },
        {
          source: cliListFallback.source,
          status: cliListFallback.status,
          reason: cliListFallback.reason,
          diagnostics: cliListFallback.diagnostics || null,
        },
      ],
    };
  }

  const rows = (data || []).map((row) => ({
    version: String(row.version),
    name: row.name ? String(row.name) : null,
  }));

  return {
    status: 'ok',
    reason: null,
    rows,
    source: 'rest',
  };
};

const ensureDir = (dirPath) => {
  fs.mkdirSync(dirPath, { recursive: true });
};

const toMarkdown = (report) => {
  const lines = [];
  lines.push('# Migration Health Report');
  lines.push('');
  lines.push(`- Generated at: ${report.generatedAt}`);
  lines.push(`- Local migrations: ${report.local.count}`);
  lines.push(`- Remote status: ${report.remote.status}`);
  lines.push(`- Remote source: ${report.remote.source}`);
  if (report.remote.reason) lines.push(`- Remote reason: ${report.remote.reason}`);
  lines.push(`- Pending migrations (real): ${report.pendingMigrations.length}`);
  lines.push(`- Version drift migrations: ${report.versionDriftMigrations.length}`);
  lines.push(`- Remote-only migrations: ${report.remoteOnlyMigrations.length}`);
  lines.push('');

  if (report.pendingMigrations.length === 0) {
    lines.push('No real pending migrations detected.');
  } else {
    lines.push('## Pending migrations');
    lines.push('');
    for (const migration of report.pendingMigrations) {
      lines.push(`- ${migration.version}_${migration.name}`);
    }
    lines.push('');
  }

  if (report.versionDriftMigrations.length > 0) {
    lines.push('## Version drift migrations');
    lines.push('');
    for (const drift of report.versionDriftMigrations) {
      lines.push(`- local ${drift.localVersion}_${drift.name} -> remote ${drift.remoteVersions.join(', ')}`);
    }
    lines.push('');
  }

  if (report.remoteOnlyMigrations.length > 0) {
    lines.push('## Remote-only migrations');
    lines.push('');
    for (const migration of report.remoteOnlyMigrations) {
      lines.push(`- ${migration.version}_${migration.name || 'unknown_name'}`);
    }
    lines.push('');
  }

  return `${lines.join('\n')}\n`;
};

const main = async () => {
  const localMigrations = readLocalMigrations();
  const remote = await loadRemoteMigrations(localMigrations);

  const remoteVersions = new Set(remote.rows.map((row) => row.version));
  const localVersions = new Set(localMigrations.map((row) => row.version));
  const remoteByName = new Map();
  const localByName = new Map();

  for (const row of remote.rows) {
    if (!row.name) continue;
    const existing = remoteByName.get(row.name) || [];
    existing.push(row);
    remoteByName.set(row.name, existing);
  }

  for (const row of localMigrations) {
    const existing = localByName.get(row.name) || [];
    existing.push(row);
    localByName.set(row.name, existing);
  }

  const pendingMigrations =
    remote.status === 'ok'
      ? localMigrations.filter((row) => !remoteVersions.has(row.version) && !remoteByName.has(row.name))
      : [];

  const versionDriftMigrations =
    remote.status === 'ok'
      ? localMigrations
          .filter((row) => !remoteVersions.has(row.version) && remoteByName.has(row.name))
          .map((row) => ({
            name: row.name,
            localVersion: row.version,
            localFile: row.file,
            remoteVersions: remoteByName
              .get(row.name)
              .map((remoteRow) => remoteRow.version)
              .sort((a, b) => a.localeCompare(b)),
          }))
      : [];

  const remoteOnlyMigrations =
    remote.status === 'ok'
      ? remote.rows.filter((row) => !localVersions.has(row.version) && !(row.name && localByName.has(row.name)))
      : [];

  const report = {
    generatedAt: new Date().toISOString(),
    local: {
      count: localMigrations.length,
      migrations: localMigrations,
    },
    remote: {
      status: remote.status,
      reason: remote.reason,
      source: remote.source || 'unknown',
      count: remote.rows.length,
      migrations: remote.rows,
      fallback: remote.fallback || null,
    },
    pendingMigrations,
    versionDriftMigrations,
    remoteOnlyMigrations,
  };

  ensureDir(REPORT_DIR);
  fs.writeFileSync(JSON_OUTPUT, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  fs.writeFileSync(MD_OUTPUT, toMarkdown(report), 'utf8');

  console.log(`Migration health JSON: ${JSON_OUTPUT}`);
  console.log(`Migration health MD: ${MD_OUTPUT}`);
};

await main();
