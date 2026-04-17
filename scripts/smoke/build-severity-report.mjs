import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const REPORT_DIR = path.resolve(ROOT, 'reports/smoke');
const PLAYWRIGHT_JSON = path.resolve(REPORT_DIR, 'playwright-results.json');
const MIGRATION_JSON = path.resolve(REPORT_DIR, 'migration-health.json');
const OUTPUT_JSON = path.resolve(REPORT_DIR, 'severity-report.json');
const OUTPUT_MD = path.resolve(REPORT_DIR, 'severity-report.md');

const ROUTE_MIGRATION_HINTS = {
  dashboard: ['20260211124957_auth_rbac_rls_phase1'],
  pdv_history: ['20260416230000_sale_cancellation_trigger'],
  pdv_new_sale: ['20260416231005_sale_items_stock_decrement_trigger'],
  inventory: ['20260215213000_add_stock_items_observations'],
  clients: ['20260211124957_auth_rbac_rls_phase1'],
  warranties: ['20260216123000_add_warranty_public_tokens'],
  debtors: ['20260416220000_debt_payment_reversal_flow'],
  finance: ['20260416160934_finance_accounts_debts_installments_and_storage'],
  parts_stock: ['20260216090000_add_parts_inventory_and_seed'],
  sellers: ['20260215232000_sellers_store_and_optional_auth'],
  stores: ['20260211124957_auth_rbac_rls_phase1'],
  settings: ['20260416154712_settings_permissions_and_user_activity'],
  crm_conversations: ['20260415183000_crm_plus_uazapi_instagram_only'],
  crm_comments: ['20260416141126_crm_plus_full_parity_modules_and_handoff'],
  crm_leads: ['20260415183000_crm_plus_uazapi_instagram_only'],
  crm_channels: ['20260416212431_add_crm_conversations_channel_fk'],
};

const severityRank = { P0: 0, P1: 1, P2: 2 };

const ensureDir = (dirPath) => fs.mkdirSync(dirPath, { recursive: true });

const safeReadJson = (filePath) => {
  if (!fs.existsSync(filePath)) return null;
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
};

const flattenPlaywrightTests = (playwrightReport) => {
  if (!playwrightReport || !Array.isArray(playwrightReport.suites)) return [];

  const all = [];

  const walkSuite = (suite, parents = []) => {
    const nextParents = suite?.title ? [...parents, suite.title] : parents;

    for (const spec of suite.specs || []) {
      const titlePath = [...nextParents, spec.title].filter(Boolean).join(' > ');
      for (const testEntry of spec.tests || []) {
        const results = testEntry.results || [];
        const failingResult = results.find((result) => ['failed', 'timedOut', 'interrupted'].includes(result.status));
        const status = failingResult ? failingResult.status : (results[results.length - 1]?.status || 'unknown');
        const errors = [];

        if (failingResult?.error?.message) errors.push(failingResult.error.message);
        for (const err of failingResult?.errors || []) {
          if (err?.message) errors.push(err.message);
          else if (err?.value) errors.push(String(err.value));
        }

        all.push({
          title: titlePath,
          specTitle: spec.title,
          projectName: testEntry.projectName || 'unknown',
          file: spec.file || suite.file || null,
          status,
          errors,
        });
      }
    }

    for (const child of suite.suites || []) walkSuite(child, nextParents);
  };

  for (const suite of playwrightReport.suites) walkSuite(suite, []);
  return all;
};

const inferSeverityFromFailure = (failure) => {
  const title = failure.title || '';
  const text = `${title}\n${(failure.errors || []).join('\n')}`.toLowerCase();

  if (/\[nav\]/i.test(title)) return 'P0';

  if (
    /permission denied|rls|row-level security|relation .* does not exist|column .* does not exist|function .* does not exist|trigger|schema .* does not exist|violates foreign key|invalid input syntax/i.test(
      text
    )
  ) {
    return 'P0';
  }

  if (/timeout|timed out|requestfailed|pageerror/i.test(text)) return 'P1';
  return 'P1';
};

const extractRouteId = (title) => {
  const match = title.match(/\[(?:NAV|ACTION)\]\[([^\]]+)\]/i);
  return match ? match[1] : null;
};

const buildIssues = (playwrightTests, migrationHealth) => {
  const issues = [];

  if (!migrationHealth) {
    issues.push({
      severity: 'P1',
      source: 'migrations',
      title: 'Migration health report missing',
      details: 'File reports/smoke/migration-health.json not found.',
      routeId: null,
      role: null,
      migrationHints: [],
    });
  } else {
    if (migrationHealth.remote?.status !== 'ok') {
      issues.push({
        severity: 'P1',
        source: 'migrations',
        title: 'Remote migration status unavailable',
        details: migrationHealth.remote?.reason || 'Unknown remote migration error.',
        routeId: null,
        role: null,
        migrationHints: [],
      });
    }

    for (const migration of migrationHealth.pendingMigrations || []) {
      issues.push({
        severity: 'P0',
        source: 'migrations',
        title: `Pending migration ${migration.version}_${migration.name}`,
        details: `Migration exists locally but is not applied remotely: ${migration.file}`,
        routeId: null,
        role: null,
        migrationHints: [`${migration.version}_${migration.name}`],
      });
    }
  }

  const failedTests = playwrightTests.filter((entry) => ['failed', 'timedOut', 'interrupted'].includes(entry.status));
  for (const failure of failedTests) {
    const routeId = extractRouteId(failure.title);
    const hints = routeId ? ROUTE_MIGRATION_HINTS[routeId] || [] : [];

    issues.push({
      severity: inferSeverityFromFailure(failure),
      source: 'smoke',
      title: failure.title,
      details: failure.errors.length > 0 ? failure.errors.join(' | ') : `status=${failure.status}`,
      routeId,
      role: failure.projectName,
      migrationHints: hints,
      file: failure.file,
    });
  }

  return issues.sort((a, b) => severityRank[a.severity] - severityRank[b.severity]);
};

const toMarkdown = (report) => {
  const lines = [];
  lines.push('# Smoke Severity Report');
  lines.push('');
  lines.push(`- Generated at: ${report.generatedAt}`);
  lines.push(`- Total issues: ${report.summary.total}`);
  lines.push(`- P0: ${report.summary.p0}`);
  lines.push(`- P1: ${report.summary.p1}`);
  lines.push(`- P2: ${report.summary.p2}`);
  lines.push('');

  if (report.issues.length === 0) {
    lines.push('No issues detected.');
    lines.push('');
    return `${lines.join('\n')}\n`;
  }

  lines.push('## Prioritized issues');
  lines.push('');

  report.issues.forEach((issue, index) => {
    lines.push(`${index + 1}. [${issue.severity}] ${issue.title}`);
    lines.push(`   source: ${issue.source}`);
    if (issue.role) lines.push(`   role: ${issue.role}`);
    if (issue.routeId) lines.push(`   route: ${issue.routeId}`);
    if (issue.file) lines.push(`   file: ${issue.file}`);
    lines.push(`   details: ${issue.details}`);
    lines.push(`   migration_hints: ${(issue.migrationHints || []).join(', ') || 'none'}`);
    lines.push('');
  });

  return `${lines.join('\n')}\n`;
};

const main = () => {
  ensureDir(REPORT_DIR);

  const playwrightReport = safeReadJson(PLAYWRIGHT_JSON);
  const migrationHealth = safeReadJson(MIGRATION_JSON);

  const playwrightTests = flattenPlaywrightTests(playwrightReport);
  const issues = buildIssues(playwrightTests, migrationHealth);

  const summary = {
    total: issues.length,
    p0: issues.filter((issue) => issue.severity === 'P0').length,
    p1: issues.filter((issue) => issue.severity === 'P1').length,
    p2: issues.filter((issue) => issue.severity === 'P2').length,
  };

  const report = {
    generatedAt: new Date().toISOString(),
    summary,
    issues,
  };

  fs.writeFileSync(OUTPUT_JSON, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  fs.writeFileSync(OUTPUT_MD, toMarkdown(report), 'utf8');

  console.log(`Severity report JSON: ${OUTPUT_JSON}`);
  console.log(`Severity report MD: ${OUTPUT_MD}`);

  if (summary.p0 > 0) {
    process.exitCode = 1;
  }
};

main();
