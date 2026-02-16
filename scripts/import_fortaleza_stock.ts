import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { createClient } from '@supabase/supabase-js';

type Section = 'SEMINOVOS';
type DeviceType = 'iPhone' | 'iPad' | 'Macbook' | 'Apple Watch' | 'Acessório';
type Condition = 'Novo' | 'Seminovo';
type Status = 'Disponível' | 'Em Preparação';

interface RawRow {
  section: Section;
  raw_description: string;
  raw_has_box: string;
  raw_imei: string;
  raw_cost_brl: string;
  raw_sale_brl: string;
}

interface NormalizedRow {
  id: string;
  key: string;
  section: Section;
  type: DeviceType;
  model: string;
  color: string;
  hasBox: boolean;
  capacity: string;
  imei: string;
  condition: Condition;
  status: Status;
  batteryHealth: number | null;
  storeId: string;
  purchasePrice: number;
  sellPrice: number;
  maxDiscount: number;
  warrantyType: 'Loja';
  warrantyEnd: string | null;
  origin: string;
  notes: string;
  observations: string;
  photos: string[];
  entryDate: string;
}

interface Report {
  runAt: string;
  mode: 'dry-run' | 'apply';
  sourcePath: string;
  storeId: string;
  inputCount: number;
  sectionCounts: Record<string, number>;
  summary: {
    processed: number;
    inserted: number;
    updated: number;
    skipped: number;
    errors: number;
    warnings: number;
  };
  warnings: string[];
  errors: string[];
  metrics: {
    purchaseTotal: number;
    saleTotal: number;
  };
}

const STORE_ID = 'st-cae5b9ed-d4e6-405f-9151-1c80542992ec';
const IMPORT_TAG = 'IMPORT_FORTALEZA_LOTE_001';
const SOURCE_DEFAULT = 'Estoque Fortaleza Print';

const SECTION_MAPPING: Record<Section, { condition: Condition; status: Status }> = {
  SEMINOVOS: { condition: 'Seminovo', status: 'Disponível' }
};

const MODEL_ALIAS: Array<{ pattern: RegExp; model: string }> = [
  { pattern: /\b14PM\b/, model: 'iPhone 14 Pro Max' },
  { pattern: /\b14\s*PRO\b/, model: 'iPhone 14 Pro' },
  { pattern: /\b14G\b/, model: 'iPhone 14' },
  { pattern: /\b13PM\b/, model: 'iPhone 13 Pro Max' },
  { pattern: /\b13\s*PRO\b/, model: 'iPhone 13 Pro' },
  { pattern: /\b13G\b/, model: 'iPhone 13' },
  { pattern: /\b12PM\b/, model: 'iPhone 12 Pro Max' },
  { pattern: /\b11\s*PRO\s*MAX\b/, model: 'iPhone 11 Pro Max' },
  { pattern: /\b11PM\b/, model: 'iPhone 11 Pro Max' },
  { pattern: /\b11G\b/, model: 'iPhone 11' }
];

const COLOR_ALIAS: Array<{ token: string; value: string }> = [
  { token: 'GRAFITE', value: 'Grafite' },
  { token: 'BRANCO', value: 'Branco' },
  { token: 'PRETO', value: 'Preto' },
  { token: 'ROXO', value: 'Roxo' },
  { token: 'AZUL', value: 'Azul' },
  { token: 'GOLD', value: 'Gold' },
  { token: 'RED', value: 'Red' }
];

const stableHash = (value: string): string => createHash('sha1').update(value).digest('hex').slice(0, 20);

const parseBrl = (input: string): number => {
  const normalized = input.replace(/[^\d,.-]/g, '').replace(/\./g, '').replace(',', '.');
  const parsed = Number(normalized);
  if (Number.isNaN(parsed)) {
    throw new Error(`Valor monetário inválido: ${input}`);
  }
  return parsed;
};

const normalizeImei = (input: string): string => {
  const digits = input.replace(/\D/g, '');
  return digits.length === 15 ? digits : '';
};

const detectColor = (descriptionUpper: string): string => {
  for (const color of COLOR_ALIAS) {
    if (descriptionUpper.includes(color.token)) return color.value;
  }
  return '';
};

const extractBattery = (descriptionUpper: string): number | null => {
  const match = descriptionUpper.match(/(\d{2,3})\s*%/);
  if (!match) return null;
  const value = Number(match[1]);
  if (Number.isNaN(value)) return null;
  return value;
};

const parseDevice = (rawDescription: string): { type: DeviceType; model: string; capacity: string; color: string } => {
  const descriptionUpper = rawDescription.toUpperCase();
  let model = '';
  for (const alias of MODEL_ALIAS) {
    if (alias.pattern.test(descriptionUpper)) {
      model = alias.model;
      break;
    }
  }
  if (!model) {
    throw new Error(`Não foi possível mapear modelo: ${rawDescription}`);
  }

  const capacityMatch = descriptionUpper.match(/(\d+)\s*(GB|TB)/);
  return {
    type: 'iPhone',
    model,
    capacity: capacityMatch ? `${capacityMatch[1]} ${capacityMatch[2].toUpperCase()}` : '',
    color: detectColor(descriptionUpper)
  };
};

const toNormalized = (row: RawRow, index: number): { row?: NormalizedRow; warnings: string[]; error?: string } => {
  const warnings: string[] = [];
  try {
    const sectionConfig = SECTION_MAPPING[row.section];
    if (!sectionConfig) {
      return { warnings, error: `Seção inválida na linha ${index + 1}: ${row.section}` };
    }

    const descriptionUpper = row.raw_description.toUpperCase();
    const device = parseDevice(row.raw_description);
    const purchasePrice = parseBrl(row.raw_cost_brl);
    const sellPrice = parseBrl(row.raw_sale_brl);
    const imei = normalizeImei(row.raw_imei || '');
    const hasBox = row.raw_has_box.trim().toUpperCase() === 'S';
    const batteryHealth = extractBattery(descriptionUpper);

    const notes: string[] = [];
    const observations: string[] = [];
    const parenthesisMatches = [...row.raw_description.matchAll(/\(([^)]+)\)/g)];
    for (const match of parenthesisMatches) {
      const note = match[1].trim();
      if (note) {
        notes.push(note);
        observations.push(note.toLowerCase());
      }
    }
    notes.push(IMPORT_TAG);

    if (!imei) warnings.push(`Linha ${index + 1}: IMEI ausente/invalidado.`);
    if (!device.capacity) warnings.push(`Linha ${index + 1}: capacidade ausente.`);
    if (!device.color) warnings.push(`Linha ${index + 1}: cor ausente.`);
    if (batteryHealth === null) warnings.push(`Linha ${index + 1}: battery_health ausente.`);

    const key = imei
      ? `${STORE_ID}|${imei}`
      : `${STORE_ID}|${row.section}|${device.model}|${device.capacity}|${device.color}|${purchasePrice}|${sellPrice}`;
    const id = `stk_fortaleza_${stableHash(key)}`;

    return {
      warnings,
      row: {
        id,
        key,
        section: row.section,
        type: device.type,
        model: device.model,
        color: device.color,
        hasBox,
        capacity: device.capacity,
        imei,
        condition: sectionConfig.condition,
        status: sectionConfig.status,
        batteryHealth,
        storeId: STORE_ID,
        purchasePrice,
        sellPrice,
        maxDiscount: 0,
        warrantyType: 'Loja',
        warrantyEnd: null,
        origin: SOURCE_DEFAULT,
        notes: notes.join(' | '),
        observations: observations.join(' | '),
        photos: [],
        entryDate: new Date().toISOString()
      }
    };
  } catch (error) {
    return { warnings, error: `Linha ${index + 1}: ${(error as Error).message}` };
  }
};

const toDbPayload = (row: NormalizedRow) => ({
  id: row.id,
  type: row.type,
  model: row.model,
  color: row.color || null,
  has_box: row.hasBox,
  capacity: row.capacity || null,
  imei: row.imei,
  condition: row.condition,
  status: row.status,
  battery_health: row.batteryHealth,
  store_id: row.storeId,
  purchase_price: row.purchasePrice,
  sell_price: row.sellPrice,
  max_discount: row.maxDiscount,
  warranty_type: row.warrantyType,
  warranty_end: row.warrantyEnd,
  origin: row.origin,
  notes: row.notes,
  observations: row.observations || null,
  entry_date: row.entryDate,
  photos: row.photos
});

const rowsAreEquivalent = (db: any, normalized: NormalizedRow): boolean => {
  const p = toDbPayload(normalized);
  return (
    db.type === p.type &&
    db.model === p.model &&
    (db.color || null) === p.color &&
    db.has_box === p.has_box &&
    (db.capacity || null) === p.capacity &&
    (db.imei || '') === p.imei &&
    db.condition === p.condition &&
    db.status === p.status &&
    (db.battery_health ?? null) === p.battery_health &&
    db.store_id === p.store_id &&
    Number(db.purchase_price) === Number(p.purchase_price) &&
    Number(db.sell_price) === Number(p.sell_price) &&
    Number(db.max_discount ?? 0) === Number(p.max_discount) &&
    (db.warranty_type || 'Loja') === p.warranty_type &&
    (db.warranty_end || null) === p.warranty_end &&
    (db.origin || null) === p.origin &&
    (db.notes || null) === p.notes &&
    (db.observations || null) === p.observations
  );
};

const main = async () => {
  const cwd = process.cwd();
  const sourcePath = path.resolve(cwd, 'data/import/fortaleza_lote_001.json');
  const reportPath = path.resolve(cwd, 'reports/import_fortaleza_lote_001.json');
  const rowsPath = path.resolve(cwd, 'reports/import_fortaleza_lote_001_rows.json');
  const isApply = process.argv.includes('--apply');
  const mode: 'dry-run' | 'apply' = isApply ? 'apply' : 'dry-run';

  const raw = await readFile(sourcePath, 'utf8');
  const inputRows = JSON.parse(raw) as RawRow[];

  const sectionCounts = inputRows.reduce<Record<string, number>>((acc, row) => {
    acc[row.section] = (acc[row.section] || 0) + 1;
    return acc;
  }, {});

  const errors: string[] = [];
  const warnings: string[] = [];
  const normalizedRows: NormalizedRow[] = [];

  inputRows.forEach((row, index) => {
    const result = toNormalized(row, index);
    warnings.push(...result.warnings);
    if (result.error) {
      errors.push(result.error);
      return;
    }
    normalizedRows.push(result.row as NormalizedRow);
  });

  const dedupe = new Map<string, NormalizedRow>();
  for (const row of normalizedRows) {
    dedupe.set(row.key, row);
  }
  const dedupedRows = [...dedupe.values()];

  let inserted = 0;
  let updated = 0;
  let skipped = 0;

  if (isApply) {
    const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!supabaseUrl || !serviceKey) {
      throw new Error('Modo --apply exige SUPABASE_URL (ou VITE_SUPABASE_URL) e SUPABASE_SERVICE_ROLE_KEY no ambiente.');
    }

    const supabase = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });
    const { data: existingRows, error: selectError } = await supabase
      .from('stock_items')
      .select('*')
      .eq('store_id', STORE_ID);
    if (selectError) {
      throw new Error(`Falha ao consultar estoque existente: ${selectError.message}`);
    }

    const byKey = new Map<string, any>();
    for (const row of existingRows || []) {
      const existingImei = String(row.imei || '').replace(/\D/g, '');
      const key = existingImei.length === 15
        ? `${STORE_ID}|${existingImei}`
        : `${STORE_ID}|SEMINOVOS|${row.model || ''}|${row.capacity || ''}|${row.color || ''}|${Number(row.purchase_price)}|${Number(row.sell_price)}`;
      byKey.set(key, row);
    }

    for (const row of dedupedRows) {
      const existing = byKey.get(row.key);
      const payload = toDbPayload(row);
      if (!existing) {
        const { error } = await supabase.from('stock_items').insert(payload);
        if (error) {
          errors.push(`Insert falhou para ${row.id}: ${error.message}`);
          continue;
        }
        inserted += 1;
        continue;
      }

      if (rowsAreEquivalent(existing, row)) {
        skipped += 1;
        continue;
      }

      const { error } = await supabase.from('stock_items').update(payload).eq('id', existing.id);
      if (error) {
        errors.push(`Update falhou para ${existing.id}: ${error.message}`);
        continue;
      }
      updated += 1;
    }
  } else {
    inserted = dedupedRows.length;
  }

  const purchaseTotal = dedupedRows.reduce((acc, row) => acc + row.purchasePrice, 0);
  const saleTotal = dedupedRows.reduce((acc, row) => acc + row.sellPrice, 0);

  const report: Report = {
    runAt: new Date().toISOString(),
    mode,
    sourcePath,
    storeId: STORE_ID,
    inputCount: inputRows.length,
    sectionCounts,
    summary: {
      processed: dedupedRows.length,
      inserted,
      updated,
      skipped,
      errors: errors.length,
      warnings: warnings.length
    },
    warnings,
    errors,
    metrics: {
      purchaseTotal,
      saleTotal
    }
  };

  await mkdir(path.dirname(reportPath), { recursive: true });
  await writeFile(reportPath, JSON.stringify(report, null, 2), 'utf8');
  await writeFile(rowsPath, JSON.stringify(dedupedRows.map(toDbPayload), null, 2), 'utf8');

  console.log(JSON.stringify(report, null, 2));
  if (errors.length > 0) process.exitCode = 1;
};

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
