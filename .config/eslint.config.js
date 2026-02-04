import js from '@eslint/js';
import globals from 'globals';
import tseslint from '@typescript-eslint/eslint-plugin';
import tsparser from '@typescript-eslint/parser';
import prettier from 'eslint-config-prettier';

/**
 * Root ESLint configuration for the G-Rump monorepo.
 * This provides shared rules across all workspaces while allowing
 * workspace-specific overrides in their own eslint.config.js files.
 */
export default [
  // Global ignores
  {
    ignores: [
      '**/node_modules/**',
      '**/dist/**',
      '**/build/**',
      '**/coverage/**',
      '**/.svelte-kit/**',
      '**/.vite/**',
      '**/electron-dist/**',
      '**/target/**',
      '**/*.min.js',
      '**/*.bundle.js',
      '**/docs-site/.vitepress/cache/**',
      '**/docs-site/.vitepress/dist/**',
    ],
  },

  // Base JavaScript configuration
  js.configs.recommended,

  // TypeScript files configuration
  {
    files: ['**/*.ts', '**/*.tsx', '**/*.mts', '**/*.cts'],
    languageOptions: {
      parser: tsparser,
      parserOptions: {
        ecmaVersion: 'latest',
        sourceType: 'module',
      },
      globals: {
        ...globals.node,
        ...globals.es2022,
      },
    },
    plugins: {
      '@typescript-eslint': tseslint,
    },
    rules: {
      // TypeScript-specific rules
      ...tseslint.configs.recommended.rules,
      
      // Disable rules that conflict with TypeScript
      'no-unused-vars': 'off',
      '@typescript-eslint/no-unused-vars': ['warn', { 
        argsIgnorePattern: '^_',
        varsIgnorePattern: '^_',
        caughtErrorsIgnorePattern: '^_',
      }],
      
      // Allow explicit any for flexibility (warn instead of error)
      '@typescript-eslint/no-explicit-any': 'warn',
      
      // Allow empty functions (useful for default handlers)
      '@typescript-eslint/no-empty-function': 'off',
      
      // Enforce consistent type imports
      '@typescript-eslint/consistent-type-imports': ['warn', {
        prefer: 'type-imports',
        fixStyle: 'inline-type-imports',
      }],
      
      // Naming conventions
      '@typescript-eslint/naming-convention': [
        'warn',
        {
          selector: 'interface',
          format: ['PascalCase'],
        },
        {
          selector: 'typeAlias',
          format: ['PascalCase'],
        },
        {
          selector: 'enum',
          format: ['PascalCase'],
        },
      ],
    },
  },

  // JavaScript files configuration
  {
    files: ['**/*.js', '**/*.mjs', '**/*.cjs'],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      globals: {
        ...globals.node,
        ...globals.es2022,
      },
    },
    rules: {
      'no-unused-vars': ['warn', { 
        argsIgnorePattern: '^_',
        varsIgnorePattern: '^_',
      }],
    },
  },

  // Test files - more relaxed rules
  {
    files: ['**/*.test.ts', '**/*.test.js', '**/*.spec.ts', '**/*.spec.js', '**/tests/**/*'],
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-non-null-assertion': 'off',
      'no-console': 'off',
    },
  },

  // Scripts - allow console
  {
    files: ['**/scripts/**/*', '**/cli/**/*'],
    rules: {
      'no-console': 'off',
    },
  },

  // Shared rules for code quality
  {
    files: ['**/*.ts', '**/*.tsx', '**/*.js', '**/*.mjs'],
    rules: {
      // Best practices
      'eqeqeq': ['error', 'always', { null: 'ignore' }],
      'no-var': 'error',
      'prefer-const': 'warn',
      'prefer-arrow-callback': 'warn',
      'no-duplicate-imports': 'error',
      
      // Code style (most handled by Prettier)
      'no-multiple-empty-lines': ['warn', { max: 2, maxEOF: 1 }],
      'no-trailing-spaces': 'warn',
      
      // Security
      'no-eval': 'error',
      'no-implied-eval': 'error',
      'no-new-func': 'error',
      
      // Error prevention
      'no-return-await': 'warn',
      'require-await': 'warn',
      'no-promise-executor-return': 'error',
      'no-unmodified-loop-condition': 'error',
    },
  },

  // Prettier compatibility (must be last)
  prettier,
];
