import { spawnSync } from 'node:child_process';

const run = (command, args) => {
  const result = spawnSync(command, args, { stdio: 'inherit', shell: false });
  return result.status ?? 1;
};

// Portão de sintaxe das edge functions: roda primeiro porque é o mais barato
// (~1s) e cobre a área que tsconfig/ESLint/Vitest excluem. Ver o cabeçalho de
// scripts/smoke/check-edge-functions-parse.mjs.
const edgeParseStatus = run(process.execPath, ['scripts/smoke/check-edge-functions-parse.mjs']);
if (edgeParseStatus !== 0) {
  console.error(`check-edge-functions-parse exited with ${edgeParseStatus}`);
}

const playwrightStatus = run('npx', ['playwright', 'test', '-c', 'playwright.smoke.config.ts']);
console.log(`Playwright exit status: ${playwrightStatus}`);

const migrationStatus = run(process.execPath, ['scripts/smoke/migration-health.mjs']);
if (migrationStatus !== 0) {
  console.error(`migration-health exited with ${migrationStatus}`);
}

const severityStatus = run(process.execPath, ['scripts/smoke/build-severity-report.mjs']);
if (severityStatus !== 0) {
  console.error(`build-severity-report exited with ${severityStatus}`);
}

process.exit(edgeParseStatus !== 0 ? edgeParseStatus : severityStatus);
