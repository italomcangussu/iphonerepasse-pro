#!/usr/bin/env node
/**
 * Remove objetos órfãos do bucket `device-images`.
 *
 * "Órfão" = objeto gerado pelo app (prefixo `img-`, no nível raiz do bucket)
 * que NÃO é referenciado por nenhum `stock_items.photos`. Conteúdo sob prefixos
 * (ex.: `store-photos/`) é preservado.
 *
 * Por que um script e não uma migration: o Postgres do Supabase bloqueia
 * `DELETE` direto em `storage.objects` (trigger `storage.protect_delete`). A
 * remoção precisa passar pela Storage API, que exige a service role key.
 *
 * Uso:
 *   SUPABASE_URL=https://<ref>.supabase.co \
 *   SUPABASE_SERVICE_ROLE_KEY=<service_role_key> \
 *     node scripts/cleanup-orphan-device-images.mjs [--dry-run]
 *
 * --dry-run: apenas lista os candidatos, sem apagar.
 *
 * Requer `@supabase/supabase-js` (já é dependência do projeto).
 */

import { createClient } from '@supabase/supabase-js';

const BUCKET = 'device-images';
const APP_PREFIX = 'img-';
const PAGE_SIZE = 1000;

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const DRY_RUN = process.argv.includes('--dry-run');

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error(
    'Defina SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY no ambiente.\n' +
      'A service role key é necessária para remover objetos via Storage API.'
  );
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

/** Extrai o nome do objeto (caminho dentro do bucket) a partir de uma URL pública. */
const objectNameFromUrl = (url) => {
  const marker = `/storage/v1/object/public/${BUCKET}/`;
  const idx = String(url || '').indexOf(marker);
  if (idx === -1) return null;
  const raw = String(url).slice(idx + marker.length).split('?')[0];
  if (!raw) return null;
  try {
    return decodeURIComponent(raw);
  } catch {
    return raw;
  }
};

async function loadReferencedNames() {
  const referenced = new Set();
  const pageSize = 1000;
  let from = 0;
  for (;;) {
    const { data, error } = await supabase
      .from('stock_items')
      .select('photos')
      .range(from, from + pageSize - 1);
    if (error) throw new Error(`Falha ao ler stock_items: ${error.message}`);
    if (!data || data.length === 0) break;
    for (const row of data) {
      for (const url of row.photos || []) {
        const name = objectNameFromUrl(url);
        if (name) referenced.add(name);
      }
    }
    if (data.length < pageSize) break;
    from += pageSize;
  }
  return referenced;
}

async function loadRootObjects() {
  const objects = [];
  let offset = 0;
  for (;;) {
    const { data, error } = await supabase.storage.from(BUCKET).list('', {
      limit: PAGE_SIZE,
      offset,
      sortBy: { column: 'name', order: 'asc' },
    });
    if (error) throw new Error(`Falha ao listar o bucket: ${error.message}`);
    if (!data || data.length === 0) break;
    // Entradas de "pasta" (ex.: store-photos/) vêm sem `id` — descartamos.
    for (const entry of data) {
      if (entry.id && entry.name) objects.push(entry.name);
    }
    if (data.length < PAGE_SIZE) break;
    offset += PAGE_SIZE;
  }
  return objects;
}

async function main() {
  console.log(`Bucket: ${BUCKET} | modo: ${DRY_RUN ? 'dry-run' : 'remoção'}`);

  const [referenced, rootObjects] = await Promise.all([
    loadReferencedNames(),
    loadRootObjects(),
  ]);

  const orphans = rootObjects.filter(
    (name) => name.startsWith(APP_PREFIX) && !referenced.has(name)
  );

  console.log(
    `Objetos no nível raiz: ${rootObjects.length} | referenciados: ${referenced.size} | órfãos (img-*): ${orphans.length}`
  );

  if (orphans.length === 0) {
    console.log('Nada a remover. ✅');
    return;
  }

  orphans.forEach((name) => console.log(`  - ${name}`));

  if (DRY_RUN) {
    console.log('\n--dry-run: nenhum objeto foi removido.');
    return;
  }

  // Remove em lotes para evitar payloads grandes.
  const BATCH = 100;
  let removed = 0;
  for (let i = 0; i < orphans.length; i += BATCH) {
    const batch = orphans.slice(i, i + BATCH);
    const { error } = await supabase.storage.from(BUCKET).remove(batch);
    if (error) throw new Error(`Falha ao remover lote: ${error.message}`);
    removed += batch.length;
  }
  console.log(`\nRemovidos ${removed} objeto(s) órfão(s). ✅`);
}

main().catch((err) => {
  console.error(err.message || err);
  process.exit(1);
});
