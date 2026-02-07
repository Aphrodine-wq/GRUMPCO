import { defineConfig } from 'vite'
import { resolve } from 'path'
import { svelte } from '@sveltejs/vite-plugin-svelte'
import { visualizer } from 'rollup-plugin-visualizer'

export default defineConfig(({ mode }) => {
  const isProduction = mode === 'production'

  return {
    base: isProduction ? './' : '/',
    plugins: [
      svelte({
        // Enable hot module replacement for faster dev iterations
        hot: !isProduction,
        // Compile with fewer checks in dev for speed
        compilerOptions: {
          dev: !isProduction,
        },
      }),
      // Bundle visualizer for production builds
      isProduction && visualizer({
        filename: 'dist/stats.html',
        open: false,
        gzipSize: true,
        brotliSize: true,
      }),
    ].filter(Boolean),

    resolve: {
      alias: {
        $lib: resolve(__dirname, 'src/lib'),
        '@': resolve(__dirname, 'src'),
      },
    },

    server: {
      port: 5173,
      // Faster dev server startup
      warmup: {
        clientFiles: [
          './src/main.ts',
          './src/App.svelte',
          './src/style.css',
          './src/styles/themes.css',
          './src/styles/animations.css',
          './src/lib/api.ts',
          './src/stores/uiStore.ts',
          './src/components/RefactoredChatInterface.svelte',
        ],
      },
      // Faster HMR
      hmr: {
        overlay: false, // Don't block UI with error overlay
      },
      // Allow CORS for dev
      cors: true,
      proxy: {
        '/api': {
          target: (process.env.VITE_PROXY_TARGET || process.env.VITE_API_URL || 'http://localhost:3000').replace(/\/api\/?$/, ''),
          changeOrigin: true,
          secure: false
        }
      }
    },

    // Faster CSS processing in dev
    css: {
      devSourcemap: false, // Skip sourcemaps for faster rebuild
    },

    build: {
      sourcemap: !isProduction,
      minify: isProduction ? 'terser' : false,
      cssMinify: isProduction,

      // Optimize chunk size and count
      chunkSizeWarningLimit: 500,

      // Report compressed sizes for accurate metrics
      reportCompressedSize: isProduction, // Skip in dev for faster build

      rollupOptions: {
        input: {
          index: resolve(__dirname, 'index.html'),
          splashscreen: resolve(__dirname, 'splashscreen.html')
        },
        output: {
          // Optimize chunk file naming with content hash
          entryFileNames: 'assets/[name]-[hash].js',
          chunkFileNames: 'assets/[name]-[hash].js',
          assetFileNames: (assetInfo) => {
            const info = assetInfo.name || ''
            if (info.endsWith('.css')) {
              return 'assets/css/[name]-[hash][extname]'
            }
            if (info.endsWith('.woff2') || info.endsWith('.woff') || info.endsWith('.ttf')) {
              return 'assets/fonts/[name][extname]'
            }
            if (/\.(png|jpe?g|gif|svg|webp|ico)$/i.test(info)) {
              return 'assets/images/[name]-[hash][extname]'
            }
            return 'assets/[name]-[hash][extname]'
          },
          // Advanced chunking strategy for optimal caching
          manualChunks(id) {
            // Framework core - loaded on every page (must be small)
            if (id.includes('node_modules')) {
              // Svelte runtime - framework (tiny, essential)
              if (id.includes('/svelte/') || id.includes('/svelte$')) {
                return 'vendor-svelte'
              }

              // Auth/DB - critical for app
              if (id.includes('@supabase')) {
                return 'vendor-supabase'
              }

              // UI icons - needed on most pages
              if (id.includes('lucide-svelte')) {
                return 'vendor-icons'
              }

              // Heavy feature libraries - lazy loaded on demand
              // These should NOT be in the main bundle
              if (id.includes('mermaid')) {
                return 'vendor-mermaid' // Lazy loaded in BuilderScreen
              }
              if (id.includes('shiki')) {
                return 'vendor-shiki' // Lazy loaded in CodeDiffViewer
              }
              if (id.includes('jspdf')) {
                return 'vendor-pdf' // Lazy loaded for exports
              }

              // Markdown - used in multiple places, but can be lazy
              if (id.includes('marked') || id.includes('markdown')) {
                return 'vendor-markdown'
              }

              // Diff utility - used in CodeDiffViewer, lazy loaded
              if (id.includes('diff')) {
                return 'vendor-diff'
              }

              // Catch-all for other third-party libs
              // This should be much smaller now
              return 'vendor'
            }

            // Route-based chunking for heavy components
            // Only the feature components that have significant code
            if (id.includes('/components/')) {
              // These components are used on specific routes
              if (id.includes('AgentSwarmVisualizer')) {
                return 'component-agent-swarm'
              }
              if (id.includes('DesignToCodeScreen')) {
                return 'component-design-to-code'
              }
              if (id.includes('VoiceCodeScreen')) {
                return 'component-voice'
              }
            }
          },
        },
      },

      // Optimize build output for modern browsers
      target: 'esnext',
      cssTarget: 'esnext',

      // Terser options for better minification
      ...(isProduction && {
        terserOptions: {
          compress: {
            drop_console: true,
            drop_debugger: true,
            pure_funcs: ['console.log', 'console.info', 'console.debug'],
            passes: 2,
          },
          mangle: {
            safari10: true,
          },
          format: {
            comments: false,
          },
        },
      }),
    },

    optimizeDeps: {
      // Pre-bundle only truly critical dependencies
      include: [
        'svelte',
        'svelte/animate',
        'svelte/easing',
        'svelte/internal',
        'svelte/motion',
        'svelte/store',
        'svelte/transition',
        '@supabase/supabase-js',
        'lucide-svelte',
        'svelte-spa-router',
      ],
      // Exclude heavy libraries - they'll be loaded on demand
      exclude: [
        'jspdf',
        'shiki',
        'diff',
        'mermaid',
        'marked',
      ],
      // Use cache to avoid re-optimizing every dev startup
      force: false,
    },

    // Preload configuration for production
    ...(isProduction && {
      experimental: {
        renderBuiltUrl(filename, { hostType }) {
          if (hostType === 'js') {
            return { relative: true }
          }
          return { relative: true }
        },
      },
    }),

    test: {
      environment: 'jsdom',
      globals: true,
      setupFiles: ['./src/test/setup.ts']
    },
  }
})
