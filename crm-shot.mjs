import { chromium, devices } from '@playwright/test';
import fs from 'node:fs';

const BASE = 'http://127.0.0.1:4174';
const OUT = '/tmp/crm-shots';
fs.mkdirSync(OUT, { recursive: true });

// creds from .env.local (LOGIN_TEST / PASSWORD_LOGIN)
const env = Object.fromEntries(
  fs.readFileSync('/Volumes/DEV/projetos/iphonerepasse-pro/.env.local', 'utf8')
    .split(/\r?\n/).filter(l => l.includes('=') && !l.trim().startsWith('#'))
    .map(l => { const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^['"]|['"]$/g, '')]; })
);
const EMAIL = env.LOGIN_TEST, PASS = env.PASSWORD_LOGIN;
console.log('login as', EMAIL);

const log = (...a) => console.log(...a);

// The PWA install prompt (bottom sheet) covers the login form on mobile.
async function dismissInstallPrompt(page) {
  for (const name of [/Mais tarde/i, /Agora não/i, /Fechar/i]) {
    const b = page.getByRole('button', { name });
    if (await b.count().catch(() => 0)) { await b.first().click().catch(() => {}); await page.waitForTimeout(300); return; }
  }
  // fallback: any visible "Mais tarde" text
  const t = page.getByText(/Mais tarde/i);
  if (await t.count().catch(() => 0)) { await t.first().click().catch(() => {}); await page.waitForTimeout(300); }
}

async function login(page) {
  await page.goto(`${BASE}/#/login`, { waitUntil: 'domcontentloaded' });
  await page.getByTestId('login-email').waitFor({ timeout: 20000 });
  await dismissInstallPrompt(page);
  await page.getByTestId('login-email').fill(EMAIL);
  await page.getByTestId('login-password').fill(PASS);
  await page.getByTestId('login-submit').click();
  await page.waitForFunction(() => !location.hash.includes('/login'), null, { timeout: 30000 })
    .catch(async () => {
      await page.screenshot({ path: `${OUT}/login-debug.png` });
      const err = await page.locator('[role="alert"], .text-error, .text-red-600').allInnerTexts().catch(() => []);
      log('  LOGIN stuck. url=', page.url(), 'errs=', JSON.stringify(err));
    });
  log('  after login ->', page.url());
}

async function gotoConversations(page) {
  await page.goto(`${BASE}/#/crmplus/conversations`, { waitUntil: 'domcontentloaded' });
  // wait for the shell or the list to appear
  await dismissInstallPrompt(page);
  await page.locator('.crm-conversation-shell').first().waitFor({ timeout: 30000 });
  await page.waitForTimeout(2500); // let conversations load
  await dismissInstallPrompt(page);
}

const browser = await chromium.launch();

// Pre-seed the "install prompt dismissed" flag so the PWA bottom sheet (which
// covers the login form / composer on mobile) never appears.
const SEED = () => { try { localStorage.setItem('pwa.install.dismissed.at', String(Date.now())); } catch (_) {} };
async function newCtx(opts) {
  const ctx = await browser.newContext(opts);
  await ctx.addInitScript(SEED);
  return ctx;
}

// ---------- iPhone ----------
{
  const iphone = devices['iPhone 13'];
  const ctx = await newCtx({ ...iphone });
  const page = await ctx.newPage();
  await login(page);
  await gotoConversations(page);

  // try to open the first conversation so the composer renders
  const firstRow = page.locator('.crm-chat-row').first();
  if (await firstRow.count()) {
    await firstRow.click().catch(() => {});
    await page.waitForTimeout(2000);
  }
  await page.screenshot({ path: `${OUT}/iphone-1-thread.png`, fullPage: false });
  log('  shot iphone-1-thread');

  const composer = page.locator('[data-testid="crm-conversation-composer"]');
  const hasComposer = await composer.count();
  log('  composer present:', hasComposer);
  if (hasComposer) {
    await composer.screenshot({ path: `${OUT}/iphone-2-composer.png` }).catch(e => log('  composer shot fail', e.message));
    // open the "+" attach sheet
    const plus = composer.getByRole('button', { name: /Anexar foto, vídeo ou arquivo/i });
    if (await plus.count()) {
      await plus.click();
      await page.waitForTimeout(600);
      await page.screenshot({ path: `${OUT}/iphone-3-attach-sheet.png`, fullPage: false });
      log('  shot iphone-3-attach-sheet');
    } else {
      log('  + attach button not found');
    }
  }
  await ctx.close();
}

// ---------- iPad portrait (split view) ----------
{
  const ipad = devices['iPad (gen 7)'];
  const ctx = await newCtx({ ...ipad, viewport: { width: 810, height: 1080 } });
  const page = await ctx.newPage();
  await login(page);
  await gotoConversations(page);
  const firstRow = page.locator('.crm-chat-row').first();
  if (await firstRow.count()) { await firstRow.click().catch(() => {}); await page.waitForTimeout(1500); }
  await page.screenshot({ path: `${OUT}/ipad-portrait-splitview.png`, fullPage: false });
  log('  shot ipad-portrait-splitview (810px)');
  await ctx.close();
}

await browser.close();
log('DONE');
