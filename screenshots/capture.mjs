import { chromium } from '@playwright/test';
import fs from 'node:fs';

const BASE = 'http://127.0.0.1:4399/screenshots/index.html';
const OUT = 'screenshots/out';
fs.mkdirSync(OUT, { recursive: true });

const widths = [
  { w: 375, h: 812, name: '375' },   // phone
  { w: 768, h: 1024, name: '768' },  // tablet portrait
  { w: 1024, h: 800, name: '1024' }, // lg
  { w: 1440, h: 900, name: '1440' }, // desktop
];

const pick = async (page, label, query, optionRe) => {
  // open combobox by its accessible name (label), type, choose option
  await page.getByRole('combobox', { name: label }).first().click();
  const input = page.getByRole('combobox', { name: label }).first();
  await input.fill(query);
  await page.getByRole('option', { name: optionRe }).first().click();
};

const run = async () => {
  const browser = await chromium.launch({
    executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
  });
  for (const vp of widths) {
    const ctx = await browser.newContext({ viewport: { width: vp.w, height: vp.h }, deviceScaleFactor: 2 });
    const page = await ctx.newPage();
    await page.goto(BASE, { waitUntil: 'networkidle' });
    await page.waitForTimeout(400);

    // --- STEP 1 (shows stepper labels / #5) ---
    await page.screenshot({ path: `${OUT}/01-step1-${vp.name}.png` });

    // fill step 1
    await pick(page, 'Loja', 'Sobral', /Sobral/);
    await pick(page, 'Vendedor', 'Maria', /Maria/);
    await pick(page, 'Cliente', 'CARLOS', /CARLOS/);
    await page.getByRole('button', { name: 'Continuar' }).click();
    await page.waitForTimeout(300);

    // --- STEP 2 (product + trade-in columns / #6) ---
    await pick(page, 'Produto', '13 Pro', /13 Pro/);
    await page.getByRole('button', { name: /Adicionar ao carrinho/ }).click();
    await page.waitForTimeout(300);
    await page.screenshot({ path: `${OUT}/02-step2-${vp.name}.png`, fullPage: true });

    await page.getByRole('button', { name: /Avançar para pagamento/ }).click();
    await page.waitForTimeout(300);

    // --- STEP 3 (full page — CTA at bottom / #7) ---
    await page.screenshot({ path: `${OUT}/03-step3-full-${vp.name}.png`, fullPage: true });

    // --- #1 sticky stepper vs header: scroll down, capture viewport ---
    await page.evaluate(() => window.scrollTo(0, 220));
    await page.waitForTimeout(250);
    await page.screenshot({ path: `${OUT}/04-sticky-scrolled-${vp.name}.png` });

    // --- #8 payment modal renders + Enter-to-confirm ---
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await page.getByRole('button', { name: /^Pix$/ }).first().click();
    await page.waitForTimeout(300);
    await page.screenshot({ path: `${OUT}/05-pix-modal-${vp.name}.png` });
    // Press Enter inside the amount field -> should submit and add the payment
    await page.getByRole('dialog').getByRole('spinbutton').first().focus();
    await page.keyboard.press('Enter');
    await page.waitForTimeout(300);
    const dialogGone = await page.getByRole('dialog').count();
    console.log(`${vp.name}: dialog after Enter = ${dialogGone}`);
    await page.screenshot({ path: `${OUT}/06-after-enter-${vp.name}.png` });

    await ctx.close();
  }
  await browser.close();
  console.log('done');
};

run().catch((e) => { console.error(e); process.exit(1); });
