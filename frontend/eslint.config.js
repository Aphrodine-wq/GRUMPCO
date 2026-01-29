import js from '@eslint/js';
import tseslint from '@typescript-eslint/eslint-plugin';
import tsparser from '@typescript-eslint/parser';

// Browser globals
const browserGlobals = {
  console: 'readonly',
  window: 'readonly',
  document: 'readonly',
  localStorage: 'readonly',
  fetch: 'readonly',
  AbortController: 'readonly',
  setTimeout: 'readonly',
  clearTimeout: 'readonly',
  setInterval: 'readonly',
  clearInterval: 'readonly',
  navigator: 'readonly',
  URL: 'readonly',
  Blob: 'readonly',
  FileReader: 'readonly',
  HTMLElement: 'readonly',
  HTMLInputElement: 'readonly',
  HTMLTextAreaElement: 'readonly',
  HTMLAnchorElement: 'readonly',
  SVGElement: 'readonly',
  Node: 'readonly',
  Element: 'readonly',
  Image: 'readonly',
  NodeJS: 'readonly',
  EventSource: 'readonly',
  MessageEvent: 'readonly',
  Event: 'readonly',
  MouseEvent: 'readonly',
  KeyboardEvent: 'readonly',
  CustomEvent: 'readonly',
  MutationObserver: 'readonly',
  IntersectionObserver: 'readonly',
  ResizeObserver: 'readonly',
  requestAnimationFrame: 'readonly',
  cancelAnimationFrame: 'readonly',
  crypto: 'readonly',
  TextDecoder: 'readonly',
  TextEncoder: 'readonly',
  Response: 'readonly',
  Request: 'readonly',
  Headers: 'readonly',
  RequestInit: 'readonly',
  HeadersInit: 'readonly',
  confirm: 'readonly',
  alert: 'readonly',
  prompt: 'readonly',
};


export default [
  js.configs.recommended,
  {
    ignores: ['dist/**', 'node_modules/**', '*.config.js', '*.config.ts', 'src/**/__tests__/**'],
  },
  // TypeScript files
  {
    files: ['src/**/*.ts', 'src/**/*.tsx'],
    ignores: ['src/**/__tests__/**'],
    languageOptions: {
      parser: tsparser,
      parserOptions: {
        ecmaVersion: 'latest',
        sourceType: 'module',
      },
      globals: browserGlobals,
    },
    plugins: {
      '@typescript-eslint': tseslint,
    },
    rules: {
      ...tseslint.configs.recommended.rules,
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_', caughtErrorsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
      '@typescript-eslint/explicit-function-return-type': 'off',
      '@typescript-eslint/no-non-null-assertion': 'warn',
      '@typescript-eslint/no-empty-object-type': 'off',
      'no-console': ['warn', { allow: ['warn', 'error'] }],
    },
  },
  // Svelte files
  {
    files: ['src/**/*.svelte'],
    languageOptions: {
      parser: tsparser,
      parserOptions: {
        ecmaVersion: 'latest',
        sourceType: 'module',
      },
      globals: browserGlobals,
    },
    plugins: {
      '@typescript-eslint': tseslint,
    },
    rules: {
      ...tseslint.configs.recommended.rules,
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_', caughtErrorsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
      '@typescript-eslint/no-empty-object-type': 'off',
      'no-console': ['warn', { allow: ['warn', 'error'] }],
    },
  },
  // JavaScript files
  {
    files: ['src/**/*.js'],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      globals: browserGlobals,
    },
    rules: {
      'no-console': ['warn', { allow: ['warn', 'error'] }],
      'no-unused-vars': ['error', { argsIgnorePattern: '^_', caughtErrorsIgnorePattern: '^_' }],
    },
  },
  // .d.ts files - relaxed rules
  {
    files: ['src/**/*.d.ts'],
    languageOptions: {
      parser: tsparser,
    },
    plugins: {
      '@typescript-eslint': tseslint,
    },
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-empty-object-type': 'off',
    },
  },
];
