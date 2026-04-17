import fs from 'node:fs';
import path from 'node:path';

export type SmokeRole = 'admin' | 'seller';

export interface RoleCredentials {
  email: string;
  password: string;
}

interface SmokeEnv {
  baseUrl: string;
  admin: RoleCredentials;
  seller: RoleCredentials;
}

const parseEnvFile = (filePath: string): Record<string, string> => {
  if (!fs.existsSync(filePath)) return {};

  const parsed: Record<string, string> = {};
  const raw = fs.readFileSync(filePath, 'utf8');
  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eqIndex = trimmed.indexOf('=');
    if (eqIndex <= 0) continue;

    const key = trimmed.slice(0, eqIndex).trim();
    let value = trimmed.slice(eqIndex + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }

    if (key) parsed[key] = value;
  }

  return parsed;
};

const readLocalEnv = (): Record<string, string> => {
  const root = process.cwd();
  const local = parseEnvFile(path.resolve(root, '.env.local'));
  const fallback = parseEnvFile(path.resolve(root, '.env'));

  return {
    ...fallback,
    ...local,
    ...Object.fromEntries(Object.entries(process.env).filter((entry): entry is [string, string] => Boolean(entry[1])))
  };
};

const getRequired = (env: Record<string, string>, keys: string[]): string => {
  for (const key of keys) {
    const value = env[key];
    if (value && value.trim()) return value.trim();
  }
  return '';
};

export const loadSmokeEnv = (): SmokeEnv => {
  const env = readLocalEnv();

  return {
    baseUrl: getRequired(env, ['SMOKE_BASE_URL']) || 'http://127.0.0.1:4174',
    admin: {
      email: getRequired(env, ['SMOKE_ADMIN_EMAIL']),
      password: getRequired(env, ['SMOKE_ADMIN_PASSWORD'])
    },
    seller: {
      email: getRequired(env, ['SMOKE_SELLER_EMAIL']),
      password: getRequired(env, ['SMOKE_SELLER_PASSWORD'])
    }
  };
};

export const ensureRoleCredentials = (role: SmokeRole): RoleCredentials => {
  const smokeEnv = loadSmokeEnv();
  const credentials = smokeEnv[role];

  if (!credentials.email || !credentials.password) {
    throw new Error(
      `Missing smoke credentials for role=${role}. Set ${role === 'admin' ? 'SMOKE_ADMIN_EMAIL/SMOKE_ADMIN_PASSWORD' : 'SMOKE_SELLER_EMAIL/SMOKE_SELLER_PASSWORD'}.`
    );
  }

  return credentials;
};
