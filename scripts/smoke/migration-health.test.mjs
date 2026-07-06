import test from 'node:test';
import assert from 'node:assert/strict';
import { hasMigrationHealthFailures } from './migration-health-core.mjs';

const healthy = {
  remote: { status: 'ok' },
  pendingMigrations: [],
  versionDriftMigrations: [],
  remoteOnlyMigrations: [],
};

test('migration health is clean only when remote and ledgers agree', () => {
  assert.equal(hasMigrationHealthFailures(healthy), false);
  assert.equal(hasMigrationHealthFailures({ ...healthy, remote: { status: 'error' } }), true);
  assert.equal(hasMigrationHealthFailures({ ...healthy, pendingMigrations: [{}] }), true);
  assert.equal(hasMigrationHealthFailures({ ...healthy, versionDriftMigrations: [{}] }), true);
  assert.equal(hasMigrationHealthFailures({ ...healthy, remoteOnlyMigrations: [{}] }), true);
});
