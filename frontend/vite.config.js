import { defineConfig } from 'vite'
import { resolve } from 'path'
import { svelte } from '@sveltejs/vite-plugin-svelte'
import { visualizer } from 'rollup-plugin-visualizer'

export default defineConfig(({ mode }) => {
  const isProduction = mode === 'production'
  
  return {
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
          target: 'http://localhost:3000',
          changeOrigin: true,
          secure: false
        }
      }
    },
    
    build: {
      sourcemap: !isProduction,
      minify: isProduction ? 'terser' : false,
      cssMinify: isProduction,
      
      terserOptions: {
        compress: {
          drop_console: isProduction,
          drop_debugger: isProduction,
          pure_funcs: isProduction ? ['console.log', 'console.info', 'console.debug'] : [],
        },
        mangle: {
          safari10: true,
        },
      },
      
      rollupOptions: {
        input: {
          app: resolve(__dirname, 'index.html'),
          splashscreen: resolve(__dirname, 'splashscreen.html')
        },
        output: {
          manualChunks: {
            // Vendor chunk for third-party libraries
            'vendor': [
              'svelte',
              'mermaid',
            ],
            // Heavy dependencies in separate chunks
            'pdf': ['jspdf'],
            'syntax-highlight': ['shiki'],
            'diff': ['diff'],
          },
          // Optimize chunk file naming
          entryFileNames: 'assets/[name]-[hash].js',
          chunkFileNames: 'assets/[name]-[hash].js',
          assetFileNames: (assetInfo) => {
            const info = assetInfo.name || ''
            if (info.endsWith('.css')) {
              return 'assets/[name]-[hash][extname]'
            }
            if (info.endsWith('.woff2') || info.endsWith('.woff')) {
              return 'assets/fonts/[name][extname]'
            }
            return 'assets/[name]-[hash][extname]'
          },
        },
      },
      
      // Optimize build output
      target: 'es2022',
      cssTarget: 'es2022',
      
      // Reduce chunk size warnings
      chunkSizeWarningLimit: 500,
    },
    
    optimizeDeps: {
      // Pre-bundle these dependencies for faster dev server start
      include: [
        'svelte',
        'mermaid',
      ],
      // Exclude heavy dependencies from pre-bundling
      exclude: [
        'jspdf',
        'shiki',
      ],
    },
    
    test: {
      environment: 'jsdom',
      globals: true,
      setupFiles: ['./src/test/setup.ts']
    },
  }
})
