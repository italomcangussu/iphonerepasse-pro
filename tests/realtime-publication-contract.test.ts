import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';

/**
 * Guarda de regressão para a falha silenciosa mais cara do realtime:
 *
 * Um único binding `postgres_changes` em tabela FORA da publicação
 * `supabase_realtime` faz o servidor descartar TODAS as subscriptions do canal
 * e mesmo assim responder `SUBSCRIBED`. O canal fica vivo e mudo, sem erro e
 * sem log — foi assim que o ERP passou semanas sem atualizar vendas/finanças ao
 * vivo por causa de duas tabelas do simulador.
 *
 * Portanto: toda tabela assinada no código precisa estar numa migration que a
 * adiciona à publicação.
 */

const repoRoot = process.cwd();

const SOURCE_DIRS = ['components', 'contexts', 'hooks', 'lib', 'pages', 'services'];
const SOURCE_EXTENSIONS = ['.ts', '.tsx'];

const collectSourceFiles = (dir: string): string[] => {
  const absolute = path.join(repoRoot, dir);
  let entries: string[];
  try {
    entries = readdirSync(absolute);
  } catch {
    return [];
  }
  return entries.flatMap((entry) => {
    const relative = path.join(dir, entry);
    if (statSync(path.join(repoRoot, relative)).isDirectory()) return collectSourceFiles(relative);
    if (!SOURCE_EXTENSIONS.includes(path.extname(entry))) return [];
    if (/\.(test|spec)\.tsx?$/.test(entry)) return [];
    return [relative];
  });
};

/** Tabelas assinadas via `.on('postgres_changes', { ..., table: 'x' })` no app. */
const collectSubscribedTables = (): Map<string, string[]> => {
  const found = new Map<string, string[]>();
  for (const file of SOURCE_DIRS.flatMap(collectSourceFiles)) {
    const source = readFileSync(path.join(repoRoot, file), 'utf8');
    for (const match of source.matchAll(/postgres_changes[\s\S]{0,200}?table:\s*'([a-z0-9_]+)'/g)) {
      const table = match[1];
      found.set(table, [...(found.get(table) ?? []), file]);
    }
  }
  return found;
};

/** Tabelas adicionadas à publicação por alguma migration (statement direto ou array em DO block). */
const collectPublishedTables = (): Set<string> => {
  const migrationsDir = path.join(repoRoot, 'supabase/migrations');
  const sql = readdirSync(migrationsDir)
    .filter((file) => file.endsWith('.sql'))
    .sort()
    .map((file) => readFileSync(path.join(migrationsDir, file), 'utf8'))
    .join('\n');

  const published = new Set<string>();

  // alter publication supabase_realtime add table public.foo
  for (const match of sql.matchAll(
    /alter\s+publication\s+supabase_realtime\s+add\s+table\s+(?:public\.)?"?([a-z0-9_]+)"?/gi
  )) {
    published.add(match[1]);
  }

  // DO blocks que iteram um array de nomes e fazem o ADD TABLE via format()
  for (const block of sql.matchAll(/tables\s+text\[\]\s*:=\s*array\s*\[([\s\S]*?)\]/gi)) {
    if (!/alter publication supabase_realtime add table/i.test(sql)) continue;
    for (const name of block[1].matchAll(/'([a-z0-9_]+)'/g)) {
      published.add(name[1]);
    }
  }

  return published;
};

describe('contrato realtime: publicação supabase_realtime', () => {
  const subscribed = collectSubscribedTables();
  const published = collectPublishedTables();

  it('encontra os bindings do canal principal do ERP', () => {
    // sanity check do parser — se isto quebrar, o teste virou inócuo
    expect(subscribed.has('transactions')).toBe(true);
    expect(subscribed.has('sales')).toBe(true);
    expect(subscribed.size).toBeGreaterThan(20);
  });

  it('toda tabela assinada está na publicação (um binding órfão silencia o canal inteiro)', () => {
    const missing = [...subscribed.entries()]
      .filter(([table]) => !published.has(table))
      .map(([table, files]) => `${table} (usada em ${files.join(', ')})`);

    expect(missing).toEqual([]);
  });

  it('as tabelas do simulador e crm_channels seguem publicadas', () => {
    // regressão direta do bug de 2026-07-27
    expect(published.has('simulator_trade_in_values')).toBe(true);
    expect(published.has('simulator_trade_in_adjustments')).toBe(true);
    expect(published.has('crm_channels')).toBe(true);
  });
});
