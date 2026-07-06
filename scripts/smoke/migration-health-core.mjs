export const hasMigrationHealthFailures = (report) =>
  report.remote.status !== 'ok' ||
  report.pendingMigrations.length > 0 ||
  report.versionDriftMigrations.length > 0 ||
  report.remoteOnlyMigrations.length > 0;
