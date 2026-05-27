import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['tests/unit/**/*.test.js', 'tests/api/**/*.test.js'],
    exclude: ['node_modules'],
    globals: false,
    environment: 'node',
  },
});
