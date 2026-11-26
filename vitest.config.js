import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['tests/unit/**/*.test.js', 'tests/api/**/*.test.js'],
    exclude: ['node_modules'],
    globals: false,
    environment: 'node',
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'json-summary', 'html'],
      // Ops-critical surfaces only: release status ingestion, the QA scan gate,
      // DB health, and the revenue config checker. Other modules are tracked
      // by their own suites but are not release-blocking thresholds yet.
      include: [
        'functions/api/admin/ci/status.js',
        'functions/admin/api/qa/scan.js',
        'functions/api/db/ping.js',
        'scripts/check-revenue-config.mjs'
      ],
      thresholds: {
        lines: 80,
        branches: 65
      }
    }
  },
});
