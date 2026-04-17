import { expect, test } from '@playwright/test';
import { menuPathByKey, roleMenuKeys } from './smokeInventory';
import { attachRuntimeErrorListeners } from './utils/smokeAssertions';

const currentRole = (projectName: string): 'admin' | 'seller' => (projectName.includes('admin') ? 'admin' : 'seller');

test('[NAV][menu] should navigate through all visible sidebar items', async ({ page }, testInfo) => {
  const role = currentRole(testInfo.project.name);
  const runtimeErrors = attachRuntimeErrorListeners(page);

  await page.goto('/#/');
  await expect(page.getByTestId('nav-link-dashboard')).toBeVisible();

  for (const menuKey of roleMenuKeys[role]) {
    const navLink = page.getByTestId(`nav-link-${menuKey}`);
    await expect(navLink).toBeVisible();
    await navLink.click();

    const targetPath = menuPathByKey[menuKey];
    const escapedTarget = targetPath.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    await expect(page).toHaveURL(new RegExp(`${escapedTarget}(?:$|\\?)`));
  }

  const errors = runtimeErrors.getErrors();
  expect(errors, `Runtime errors while navigating menus as role=${role}:\n${errors.join('\n')}`).toEqual([]);
});
