import { defineConfig } from 'vitest/config';
import { compile, compileModule, preprocess } from 'svelte/compiler';
import { svelteTesting } from '@testing-library/svelte/vite';
import { resolve } from 'path';
import { transform } from 'esbuild';

// Minimal Svelte compiler plugin for vitest — avoids @sveltejs/vite-plugin-svelte 6.x
// which requires Vite 7 APIs (server.environments) that vitest 1.x (Vite 5) lacks.
// Handles both .svelte files AND .svelte.js/.svelte.ts files (Svelte 5 runes modules).
function svelteTestPlugin() {
  return {
    name: 'svelte-test-compiler',
    async transform(code: string, id: string) {
      // Handle .svelte.js and .svelte.ts files (runes modules like $state, $derived)
      if (/\.svelte\.[jt]s$/.test(id)) {
        // Strip TS if needed
        let processedCode = code;
        if (id.endsWith('.svelte.ts')) {
          const tsResult = await transform(code, {
            loader: 'ts',
            tsconfigRaw: { compilerOptions: { verbatimModuleSyntax: true } },
          });
          processedCode = tsResult.code;
        }
        const result = compileModule(processedCode, {
          filename: id,
          dev: true,
          generate: 'client',
        });
        return { code: result.js.code, map: result.js.map };
      }

      // Handle .svelte component files
      if (!id.endsWith('.svelte')) return null;

      // Preprocess: strip TypeScript using esbuild
      const preprocessed = await preprocess(code, {
        script: async ({ content, attributes }) => {
          if (attributes.lang !== 'ts') return;
          const result = await transform(content, {
            loader: 'ts',
            tsconfigRaw: { compilerOptions: { verbatimModuleSyntax: true } },
          });
          return { code: result.code };
        },
      }, { filename: id });

      const result = compile(preprocessed.code, {
        filename: id,
        css: 'injected',
        dev: true,
        generate: 'client',
      });
      return { code: result.js.code, map: result.js.map };
    },
  };
}

export default defineConfig({
  plugins: [
    svelteTestPlugin(),
    svelteTesting(),
  ],
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    exclude: ['**/node_modules/**', '**/dist/**', '**/e2e/**'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html', 'lcov'],
      reportsDirectory: './coverage',
      exclude: [
        'node_modules/**',
        'dist/**',
        '**/*.config.{js,ts}',
        '**/*.d.ts',
        '**/tests/**',
        '**/test/**',
        '**/__tests__/**',
        '**/__mocks__/**',
        '**/coverage/**',
        '**/e2e/**',
        'src/main.ts',
        'src/vite-env.d.ts',
        // UI-only and static assets (goal: 80% on logic/stores/utils/lib)
        'src/components/**',
        'src/lib/design-system/**',
        'src/lib/icons/**',
        'src/data/**',
        'src/types/ship.ts',
        'electron/**',
        'src/App.svelte',
        'src/TestApp.svelte',
        'src/lib/analytics.ts',
        // Docker/setup UI and optional integrations
        'src/lib/dockerSetup.ts',
        'src/lib/gpuDetection.ts',
        'src/lib/hardwarePresets.ts',
        'src/lib/offlineManager.ts',
        'src/lib/ollamaDetection.ts',
        'src/stores/authGateStore.ts',
        'src/stores/runModeStore.ts',
        // IndexedDB-based cache requires fake-indexeddb package for proper testing
        'src/services/predictiveClientCache.ts',
      ],
      // 100% coverage requirement - ZERO GAPS ALLOWED
      thresholds: {
        statements: 100,
        branches: 100,
        functions: 100,
        lines: 100,
      },
    },
  },
  resolve: {
    // Critical for Svelte 5: ensure browser exports are used instead of server exports
    conditions: ['browser', 'development'],
    alias: {
      '@': resolve(__dirname, './src'),
      '$lib': resolve(__dirname, './src/lib'),
    },
  },
});
