import js from '@eslint/js';
import globals from 'globals';

const unusedVarsWarn = {
  'no-unused-vars': ['warn', {
    argsIgnorePattern: '^_',
    varsIgnorePattern: '^_',
    caughtErrorsIgnorePattern: '^_',
  }],
};

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
    files: ['assets/js/**/*.js', 'courses/*.js'],
    languageOptions: {
      ecmaVersion: 2020,
      sourceType: 'script',
      globals: {
        ...globals.browser,
      },
    },
    rules: {
      ...unusedVarsWarn,
      'no-empty': ['warn', { allowEmptyCatch: true }],
    },
  },
  // Root-level browser files (nav, service-inquiry widgets)
  {
    files: ['nav.js', 'services/**/*.js'],
    languageOptions: {
      ecmaVersion: 2020,
      sourceType: 'script',
      globals: {
        ...globals.browser,
      },
    },
    rules: {
      ...unusedVarsWarn,
      'no-empty': ['warn', { allowEmptyCatch: true }],
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
        Modal: 'readonly',
        Toast: 'readonly',
        adminFetch: 'readonly',
        escapeHtml: 'readonly',
        adminLogout: 'readonly',
        getAdminKey: 'readonly',
        ensureAdminKey: 'readonly',
      },
    },
    rules: {
      ...unusedVarsWarn,
      'no-empty': ['warn', { allowEmptyCatch: true }],
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
      ...unusedVarsWarn,
      'no-empty': ['warn', { allowEmptyCatch: true }],
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
      ...unusedVarsWarn,
      'no-empty': ['warn', { allowEmptyCatch: true }],
    },
  },
  // Config + script files (node; browser globals allowed inside page.evaluate callbacks)
  {
    files: ['vitest.config.js', 'playwright.config.js', 'eslint.config.js', 'scripts/**/*.js', 'scripts/**/*.cjs'],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      globals: {
        ...globals.node,
        ...globals.browser,
        process: 'readonly',
      },
    },
    rules: {
      ...unusedVarsWarn,
      'no-empty': ['warn', { allowEmptyCatch: true }],
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