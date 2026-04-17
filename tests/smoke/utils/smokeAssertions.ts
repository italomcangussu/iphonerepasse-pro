import { expect, Page } from '@playwright/test';
import type { SmokeAction, SmokeRoute } from '../smokeInventory';

const toCaseInsensitiveRegex = (value: string): RegExp => new RegExp(value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
const clickSelector = async (
  page: Page,
  selectorKind: SmokeAction['selectorKind'],
  selectorValue: string
): Promise<void> => {
  const selectorRegex = toCaseInsensitiveRegex(selectorValue);

  if (selectorKind === 'button') {
    await expect(page.getByRole('button', { name: selectorRegex }).first()).toBeVisible();
    await page.getByRole('button', { name: selectorRegex }).first().click();
    return;
  }

  if (selectorKind === 'link') {
    await expect(page.getByRole('link', { name: selectorRegex }).first()).toBeVisible();
    await page.getByRole('link', { name: selectorRegex }).first().click();
    return;
  }

  await expect(page.getByTestId(selectorValue).first()).toBeVisible();
  await page.getByTestId(selectorValue).first().click();
};

export const assertRouteAnchor = async (page: Page, route: SmokeRoute): Promise<void> => {
  if (route.anchorKind === 'heading') {
    await expect(page.getByRole('heading', { name: toCaseInsensitiveRegex(route.anchorValue) }).first()).toBeVisible();
    return;
  }

  if (route.anchorKind === 'testid') {
    await expect(page.getByTestId(route.anchorValue)).toBeVisible();
    return;
  }

  await expect(page.getByText(toCaseInsensitiveRegex(route.anchorValue)).first()).toBeVisible();
};

export const executeAction = async (page: Page, action: SmokeAction): Promise<void> => {
  if (Array.isArray(action.before) && action.before.length > 0) {
    for (const step of action.before) {
      await clickSelector(page, step.selectorKind, step.selectorValue);
    }
  }

  await clickSelector(page, action.selectorKind, action.selectorValue);

  if (!action.expect) return;

  if (action.expect.kind === 'urlContains') {
    await expect(page).toHaveURL(new RegExp(action.expect.value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i'));
    return;
  }

  if (action.expect.kind === 'heading') {
    await expect(page.getByRole('heading', { name: toCaseInsensitiveRegex(action.expect.value) }).first()).toBeVisible();
    return;
  }

  await expect(page.getByText(toCaseInsensitiveRegex(action.expect.value)).first()).toBeVisible();
};

export const attachRuntimeErrorListeners = (page: Page): {
  getErrors: () => string[];
} => {
  const errors: string[] = [];

  page.on('pageerror', (error) => {
    errors.push(`[pageerror] ${error.message}`);
  });

  page.on('requestfailed', (request) => {
    const url = request.url();
    const failureText = request.failure()?.errorText || 'unknown_error';
    if (/ERR_ABORTED|NS_BINDING_ABORTED/i.test(failureText)) return;

    if (url.includes('/rest/v1/') || url.includes('/functions/v1/') || url.includes('/auth/v1/')) {
      errors.push(`[requestfailed] ${request.method()} ${url} :: ${failureText}`);
    }
  });

  return {
    getErrors: () => [...errors]
  };
};
