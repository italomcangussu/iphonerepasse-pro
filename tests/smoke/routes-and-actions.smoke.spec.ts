import { expect, test } from '@playwright/test';
import { smokeRoutes, type SmokeRole } from './smokeInventory';
import { assertRouteAnchor, attachRuntimeErrorListeners, executeAction } from './utils/smokeAssertions';

const resolveRoleFromProject = (projectName: string): SmokeRole => (projectName.includes('admin') ? 'admin' : 'seller');

const escapeForRegex = (value: string): RegExp => new RegExp(value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');

test.describe('Smoke routes and actions', () => {
  for (const route of smokeRoutes) {
    test(`[NAV][${route.id}] route loads ${route.path}`, async ({ page }, testInfo) => {
      const role = resolveRoleFromProject(testInfo.project.name);
      test.skip(!route.roles.includes(role), `Route ${route.id} not available for role=${role}`);

      const runtimeErrors = attachRuntimeErrorListeners(page);

      await page.goto(route.path);
      await expect(page).toHaveURL(escapeForRegex(route.path));
      await assertRouteAnchor(page, route);

      const errors = runtimeErrors.getErrors();
      expect(errors, `Runtime errors on route=${route.id} role=${role}:\n${errors.join('\n')}`).toEqual([]);
    });

    for (const action of route.actions) {
      test(`[ACTION][${route.id}] ${action.id}`, async ({ page }, testInfo) => {
        const role = resolveRoleFromProject(testInfo.project.name);
        test.skip(!route.roles.includes(role), `Route ${route.id} not available for role=${role}`);

        const runtimeErrors = attachRuntimeErrorListeners(page);

        await page.goto(route.path);
        await assertRouteAnchor(page, route);

        await executeAction(page, action);

        const errors = runtimeErrors.getErrors();
        expect(
          errors,
          `Runtime errors on action=${action.id} route=${route.id} role=${role}:\n${errors.join('\n')}`
        ).toEqual([]);
      });
    }
  }
});
