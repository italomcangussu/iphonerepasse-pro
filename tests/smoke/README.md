# Smoke Test Suite

This directory contains the Playwright smoke suite for menu navigation, route loading, and key button actions.

## Selector contract

- Prefer `data-testid` for critical auth and navigation controls.
- For page-level actions, use semantic selectors (`getByRole('button'|'link')`) with stable labels.
- Avoid brittle selectors based on CSS classes.

## Required environment variables

- `SMOKE_ADMIN_EMAIL`
- `SMOKE_ADMIN_PASSWORD`
- `SMOKE_SELLER_EMAIL`
- `SMOKE_SELLER_PASSWORD`
- `SMOKE_BASE_URL` (optional, default: `http://127.0.0.1:4174`)

## Run

```bash
npm run smoke:run
```

Outputs:

- `reports/smoke/playwright-results.json`
- `reports/smoke/migration-health.json`
- `reports/smoke/severity-report.md`
