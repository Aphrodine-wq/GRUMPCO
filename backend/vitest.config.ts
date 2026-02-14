import { defineConfig } from 'vitest/config';
import { resolve } from 'path';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    setupFiles: ['./tests/setup.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html', 'lcov'],
      reportsDirectory: './coverage',
      exclude: [
        // Standard non-source exclusions
        'node_modules/**',
        'dist/**',
        '**/*.config.{js,ts}',
        '**/*.d.ts',
        '**/tests/**',
        '**/test/**',
        '**/__tests__/**',
        '**/__mocks__/**',
        '**/coverage/**',
        '**/dist-bundle/**',
        'api/**',
        'scripts/**',
        // Auto-generated or schema-only files
        'src/db/schema.ts',
        'src/schemas/index.ts',
        'src/routes/swagger.ts',
      ],
      // Honest threshold — raise as coverage improves organically
      thresholds: {
        statements: 80,
        branches: 80,
        functions: 80,
        lines: 80,
      },
    },
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, './src'),
    },
  },
});
