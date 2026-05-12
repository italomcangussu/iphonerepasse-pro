#!/usr/bin/env node
/**
 * Generate Apple Splash Screens (apple-touch-startup-image) for iOS 26 / iPadOS 26.
 *
 * Inputs:
 *   public/brand/logo-mark-light.png   (centered logo on light background)
 *   public/brand/logo-mark-dark.png    (optional — used in dark mode if present)
 *
 * Output:
 *   public/brand/splash/<device>_portrait.png
 *
 * Requires `sharp`. Install on demand:
 *   npm i -D sharp
 *
 * Run:
 *   node scripts/generate-ios-splash.mjs
 *
 * The sizes below cover every iPhone/iPad that runs iOS 26 / iPadOS 26 at
 * the time of writing. They match the media queries declared in index.html.
 */

import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const inputLight = path.join(root, 'public/brand/logo-mark-light.png');
const outDir = path.join(root, 'public/brand/splash');

// width × height in CSS pixels (we multiply by the device DPR when rendering).
const DEVICES = [
  // iPhones (iOS 26) — portrait light
  { name: 'iphone-16-pro-max',       w: 440,  h: 956,  dpr: 3, bg: '#f5f7fb' },
  { name: 'iphone-16-pro-max_dark',  w: 440,  h: 956,  dpr: 3, bg: '#0b1220' },
  { name: 'iphone-16-pro',           w: 402,  h: 874,  dpr: 3, bg: '#f5f7fb' },
  { name: 'iphone-16-pro_dark',      w: 402,  h: 874,  dpr: 3, bg: '#0b1220' },
  { name: 'iphone-16-plus',          w: 430,  h: 932,  dpr: 3, bg: '#f5f7fb' },
  { name: 'iphone-16-plus_dark',     w: 430,  h: 932,  dpr: 3, bg: '#0b1220' },
  { name: 'iphone-16',               w: 393,  h: 852,  dpr: 3, bg: '#f5f7fb' },
  { name: 'iphone-16_dark',          w: 393,  h: 852,  dpr: 3, bg: '#0b1220' },
  { name: 'iphone-se',               w: 375,  h: 667,  dpr: 2, bg: '#f5f7fb' },
  { name: 'iphone-se_dark',          w: 375,  h: 667,  dpr: 2, bg: '#0b1220' },
  // iPads (iPadOS 26) — portrait light + dark
  { name: 'ipad-pro-13',             w: 1032, h: 1376, dpr: 2, bg: '#f5f7fb' },
  { name: 'ipad-pro-13_dark',        w: 1032, h: 1376, dpr: 2, bg: '#0b1220' },
  { name: 'ipad-pro-11',             w: 834,  h: 1210, dpr: 2, bg: '#f5f7fb' },
  { name: 'ipad-pro-11_dark',        w: 834,  h: 1210, dpr: 2, bg: '#0b1220' },
  { name: 'ipad-air',                w: 820,  h: 1180, dpr: 2, bg: '#f5f7fb' },
  { name: 'ipad-air_dark',           w: 820,  h: 1180, dpr: 2, bg: '#0b1220' },
  // iPad landscape light + dark
  { name: 'ipad-pro-13_landscape',       w: 1376, h: 1032, dpr: 2, bg: '#f5f7fb' },
  { name: 'ipad-pro-13_landscape_dark',  w: 1376, h: 1032, dpr: 2, bg: '#0b1220' },
  { name: 'ipad-pro-11_landscape',       w: 1210, h: 834,  dpr: 2, bg: '#f5f7fb' },
  { name: 'ipad-pro-11_landscape_dark',  w: 1210, h: 834,  dpr: 2, bg: '#0b1220' },
  { name: 'ipad-air_landscape',          w: 1180, h: 820,  dpr: 2, bg: '#f5f7fb' },
  { name: 'ipad-air_landscape_dark',     w: 1180, h: 820,  dpr: 2, bg: '#0b1220' },
];

const LOGO_SIZE_RATIO = 0.28; // logo fills 28% of the shorter side

async function ensureSharp() {
  try {
    const m = await import('sharp');
    return m.default;
  } catch (_) {
    console.error('\n  ✖ sharp is required.');
    console.error('  Install with: npm i -D sharp\n');
    process.exit(1);
  }
}

async function main() {
  const sharp = await ensureSharp();
  await fs.access(inputLight).catch(() => {
    console.error('\n  ✖ Missing input:', inputLight);
    console.error('  Provide a centered logo PNG at that path and re-run.\n');
    process.exit(1);
  });
  await fs.mkdir(outDir, { recursive: true });

  const inputDark = path.join(root, 'public/brand/logo-mark-dark.png');
  const logoBufLight = await fs.readFile(inputLight);
  const logoBufDark = await fs.readFile(inputDark).catch(() => logoBufLight);

  for (const d of DEVICES) {
    const isDark = d.name.includes('_dark');
    const logoBuf = isDark ? logoBufDark : logoBufLight;
    const pxW = d.w * d.dpr;
    const pxH = d.h * d.dpr;
    const shortest = Math.min(pxW, pxH);
    const logoSize = Math.round(shortest * LOGO_SIZE_RATIO);

    const resizedLogo = await sharp(logoBuf)
      .resize(logoSize, logoSize, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
      .png()
      .toBuffer();

    const suffix = d.name.includes('landscape') ? '' : '_portrait';
    const outFile = path.join(outDir, `${d.name}${suffix}.png`);
    await sharp({
      create: { width: pxW, height: pxH, channels: 4, background: d.bg },
    })
      .composite([{ input: resizedLogo, gravity: 'center' }])
      .png({ compressionLevel: 9 })
      .toFile(outFile);

    console.log(`  ✓ ${path.relative(root, outFile)}  (${pxW}×${pxH})`);
  }

  console.log('\n  Done. Splash links are already wired in index.html.\n');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
