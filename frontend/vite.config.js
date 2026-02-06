import { defineConfig } from 'vite'
import { resolve } from 'path'
import { svelte } from '@sveltejs/vite-plugin-svelte'
import { visualizer } from 'rollup-plugin-visualizer'

export default defineConfig(({ mode }) => {
  const isProduction = mode === 'production'

  return {
    base: isProduction ? './' : '/',
    plugins: [
      svelte(),
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
      proxy: {
        '/api': {
          target: (process.env.VITE_PROXY_TARGET || process.env.VITE_API_URL || 'http://localhost:3000').replace(/\/api\/?$/, ''),
          changeOrigin: true,
          secure: false
        }
      }
    },

    build: {
      sourcemap: !isProduction,
      minify: isProduction ? 'terser' : false,
      cssMinify: isProduction,

      // Optimize chunk size and count
      chunkSizeWarningLimit: 500,

      // Report compressed sizes for accurate metrics
      reportCompressedSize: true,

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
            // Framework core - loaded on every page
            if (id.includes('node_modules')) {
              // Svelte runtime - core framework
              if (id.includes('svelte') && !id.includes('svelte-spa-router')) {
                return 'vendor-svelte'
              }

              // Database/auth - critical but can be cached separately
              if (id.includes('@supabase')) {
                return 'vendor-supabase'
              }

              // Large feature libraries - loaded on demand
              if (id.includes('mermaid')) {
                return 'vendor-mermaid'
              }
              if (id.includes('jspdf')) {
                return 'vendor-pdf'
              }
              if (id.includes('shiki')) {
                return 'vendor-shiki'
              }
              if (id.includes('diff')) {
                return 'vendor-diff'
              }

              // Other third-party libraries
              return 'vendor'
            }

            // Route-based chunking for heavy components
            if (id.includes('/components/')) {
              if (id.includes('AgentSwarmVisualizer') ||
                id.includes('DesignToCodeScreen') ||
                id.includes('VoiceCodeScreen') ||
                id.includes('CodeDiffViewer')) {
                return 'feature-heavy'
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
      // Pre-bundle critical dependencies for faster dev server start
      include: [
        'svelte',
        'svelte/animate',
        'svelte/easing',
        'svelte/internal',
        'svelte/motion',
        'svelte/store',
        'svelte/transition',
        '@supabase/supabase-js',
      ],
      // Exclude heavy dependencies from pre-bundling (loaded on demand)
      exclude: [
        'jspdf',
        'shiki',
        'diff',
        'mermaid',
      ],
      // Force optimize on certain packages
      force: true,
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
