import js from '@eslint/js';
import globals from 'globals';

export default [
  js.configs.recommended,
  {
    ignores: [
      'node_modules/**',
      'books/**',
      '.wrangler/**',
      'coverage/**',
      'test-results/**',
      '**/*.html',
    ],
  },
  // Frontend JS (browser context)
  {
    files: ['assets/js/**/*.js'],
    languageOptions: {
      ecmaVersion: 2020,
      sourceType: 'script',
      globals: {
        ...globals.browser,
      },
    },
    rules: {
      'no-unused-vars': ['warn', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
      'no-empty': 'warn',
    },
  },
  // Admin JS (browser globals)
  {
    files: ['admin/**/*.js'],
    languageOptions: {
      ecmaVersion: 2020,
      sourceType: 'script',
      globals: {
        ...globals.browser,
        AppState: 'readonly',
        AdminState: 'readonly',
      },
    },
    rules: {
      'no-unused-vars': ['warn', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
      'no-empty': 'warn',
      'no-redeclare': 'off',
    },
  },
  // Cloudflare Functions (workers env)
  {
    files: ['functions/**/*.js'],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      globals: {
        ...globals.node,
        Response: 'readonly',
        Request: 'readonly',
        URL: 'readonly',
        Headers: 'readonly',
        fetch: 'readonly',
        FormData: 'readonly',
        atob: 'readonly',
        btoa: 'readonly',
      },
    },
    rules: {
      'no-unused-vars': ['warn', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
      'no-empty': 'warn',
    },
  },
  // Workers (cron)
  {
    files: ['workers/**/*.js'],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      globals: {
        ...globals.node,
        fetch: 'readonly',
        Response: 'readonly',
        Request: 'readonly',
        console: 'readonly',
      },
    },
    rules: {
      'no-unused-vars': ['warn', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
    },
  },
  // Config + script files (node)
  {
    files: ['vitest.config.js', 'playwright.config.js', 'eslint.config.js', 'scripts/**/*.js', 'scripts/**/*.cjs'],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      globals: {
        ...globals.node,
        process: 'readonly',
      },
    },
  },
  // Tests
  {
    files: ['tests/**/*.js'],
    languageOptions: {
      globals: {
        ...globals.node,
      },
    },
    rules: {
      'no-unused-vars': 'off',
      'no-undef': 'off',
    },
  },
];
