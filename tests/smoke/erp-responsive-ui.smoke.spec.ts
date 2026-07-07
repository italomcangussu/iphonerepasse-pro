import { expect, test } from '@playwright/test';
import { ADMIN_STORAGE_STATE } from './utils/constants';

const routes = [
  { path: '/#/', title: 'Dashboard' },
  { path: '/#/inventory', title: 'Estoque' },
  { path: '/#/finance', title: 'Financeiro' },
  { path: '/#/pdv/nova-venda', title: 'Resumo' },
] as const;

const viewports = [
  { name: 'iphone', width: 393, height: 852, expectsSidebar: false, expectsBottomNav: true },
  { name: 'ipad-mini-portrait', width: 768, height: 1024, expectsSidebar: true, expectsBottomNav: false },
  { name: 'ipad-air-portrait', width: 820, height: 1180, expectsSidebar: true, expectsBottomNav: false },
  { name: 'ipad-portrait', width: 834, height: 1194, expectsSidebar: true, expectsBottomNav: false },
  { name: 'ipad-pro-portrait', width: 1024, height: 1366, expectsSidebar: true, expectsBottomNav: false },
  { name: 'ipad-landscape', width: 1194, height: 834, expectsSidebar: true, expectsBottomNav: false },
  { name: 'desktop', width: 1440, height: 1000, expectsSidebar: true, expectsBottomNav: false },
] as const;

test.use({ storageState: ADMIN_STORAGE_STATE });

for (const viewport of viewports) {
  for (const route of routes) {
    test(`[ERP responsive] ${viewport.name} ${route.path}`, async ({ page }) => {
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      await page.goto(route.path);

      const routeAnchor = route.path === '/#/'
        ? page.getByRole('heading', { name: route.title }).first()
        : page.getByText(route.title).first();
      await expect(routeAnchor).toBeVisible();

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

      const temporalInputs = page.locator(
        'input[type="date"], input[type="datetime-local"], input[type="time"], input[type="month"], input[type="week"]'
      );
      for (let index = 0; index < await temporalInputs.count(); index += 1) {
        const input = temporalInputs.nth(index);
        if (!(await input.isVisible())) continue;

        const geometry = await input.evaluate((element) => {
          const inputRect = element.getBoundingClientRect();
          const parentRect = element.parentElement?.getBoundingClientRect();
          return {
            inputLeft: inputRect.left,
            inputRight: inputRect.right,
            parentLeft: parentRect?.left ?? inputRect.left,
            parentRight: parentRect?.right ?? inputRect.right,
            scrollWidth: element.scrollWidth,
            clientWidth: element.clientWidth,
          };
        });

        expect(geometry.inputLeft).toBeGreaterThanOrEqual(geometry.parentLeft - 1);
        expect(geometry.inputRight).toBeLessThanOrEqual(geometry.parentRight + 1);
        expect(geometry.scrollWidth).toBeLessThanOrEqual(geometry.clientWidth + 1);
      }
    });
  }
}
