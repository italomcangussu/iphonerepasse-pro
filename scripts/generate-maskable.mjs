#!/usr/bin/env node
/**
 * Generates maskable PWA icons with safe-zone padding.
 * Run: node scripts/generate-maskable.mjs
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');

async function ensureSharp() {
  try {
    const m = await import('sharp');
    return m.default;
  } catch {
    console.error('sharp not found. Run: npm install --save-dev sharp');
    process.exit(1);
  }
}

async function main() {
  const sharp = await ensureSharp();
  const inputPath = path.join(root, 'public/brand/icon-512.png');

  const configs = [
    { size: 192, safeZone: 0.70, output: 'icon-192-maskable.png', bg: '#0b1220' },
    { size: 512, safeZone: 0.70, output: 'icon-512-maskable.png', bg: '#0b1220' },
    { size: 1024, safeZone: 0.80, output: 'icon-1024.png', bg: '#f5f7fb' },
  ];

  for (const { size, safeZone, output, bg } of configs) {
    const logoSize = Math.round(size * safeZone);
    const inputBuf = await fs.readFile(inputPath);
    const logo = await sharp(inputBuf)
      .resize(logoSize, logoSize, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
      .png()
      .toBuffer();

    const outPath = path.join(root, 'public/brand', output);
    await sharp({
      create: { width: size, height: size, channels: 4, background: bg },
    })
      .composite([{ input: logo, gravity: 'center' }])
      .png({ compressionLevel: 9 })
      .toFile(outPath);

    console.log(`  ✓ public/brand/${output}  (${size}×${size})`);
  }
  console.log('\n  Done.\n');
}

main().catch(e => { console.error(e); process.exit(1); });
