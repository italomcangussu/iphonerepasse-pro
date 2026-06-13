/** @type {import('@stryker-mutator/api/core').PartialStrykerOptions} */
export default {
  testRunner: 'vitest',
  mutate: [
    'utils/**/*.ts',
    'pages/pdv/**/*.ts',
    'pages/inventory/**/*.ts',
    'components/stock-form/**/*.ts',
    '!**/*.test.ts'
  ],
  reporters: ['clear-text', 'progress', 'html', 'json'],
  jsonReporter: { fileName: 'reports/mutation/mutation.json' },
  coverageAnalysis: 'perTest',
  thresholds: { high: 70, low: 50, break: 50 }
};
