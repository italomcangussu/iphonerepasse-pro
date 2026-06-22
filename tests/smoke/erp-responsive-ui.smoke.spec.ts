import { expect, test } from '@playwright/test';
import { ADMIN_STORAGE_STATE } from './utils/constants';

const routes = [
  { path: '/#/inventory', title: 'Estoque' },
  { path: '/#/finance', title: 'Financeiro' },
  { path: '/#/pdv/nova-venda', title: 'Resumo' },
] as const;

const viewports = [
  { name: 'iphone', width: 393, height: 852, expectsSidebar: false, expectsBottomNav: true },
  { name: 'ipad-portrait', width: 834, height: 1194, expectsSidebar: true, expectsBottomNav: false },
  { name: 'ipad-landscape', width: 1194, height: 834, expectsSidebar: true, expectsBottomNav: false },
  { name: 'desktop', width: 1440, height: 1000, expectsSidebar: true, expectsBottomNav: false },
] as const;

test.use({ storageState: ADMIN_STORAGE_STATE });

for (const viewport of viewports) {
  for (const route of routes) {
    test(`[ERP responsive] ${viewport.name} ${route.path}`, async ({ page }) => {
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      await page.goto(route.path);

      await expect(page.getByText(route.title).first()).toBeVisible();

      const sidebar = page.getByTestId('erp-sidebar');
      const bottomNav = page.getByTestId('erp-bottom-nav');

      if (viewport.expectsSidebar) {
        await expect(sidebar).toBeVisible();
      } else {
        await expect(sidebar).toBeHidden();
      }

      if (viewport.expectsBottomNav) {
        await expect(bottomNav).toBeVisible();
      } else {
        await expect(bottomNav).toBeHidden();
      }

      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      expect(overflow).toBeLessThanOrEqual(1);
    });
  }
}
