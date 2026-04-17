import fs from 'node:fs';
import { expect, test } from '@playwright/test';
import { ADMIN_STORAGE_STATE, SMOKE_AUTH_DIR } from './utils/constants';
import { ensureRoleCredentials } from './utils/smokeEnv';

test('[AUTH][admin] create storage state', async ({ page, context }) => {
  const credentials = ensureRoleCredentials('admin');

  fs.mkdirSync(SMOKE_AUTH_DIR, { recursive: true });

  await page.goto('/#/login');
  await expect(page.getByTestId('login-email')).toBeVisible();

  await page.getByTestId('login-email').fill(credentials.email);
  await page.getByTestId('login-password').fill(credentials.password);
  await page.getByTestId('login-submit').click();

  await expect(page).toHaveURL(/#\/$/);
  await expect(page.getByTestId('nav-link-dashboard')).toBeVisible();

  await context.storageState({ path: ADMIN_STORAGE_STATE });
});
