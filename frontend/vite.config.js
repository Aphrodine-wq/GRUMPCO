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
      
      rollupOptions: {
        input: {
          app: resolve(__dirname, 'index.html'),
          splashscreen: resolve(__dirname, 'splashscreen.html')
        },
        output: {
          manualChunks(id) {
            // Dynamic chunking based on module type
            if (id.includes('node_modules')) {
              // Vendor libraries
              if (id.includes('svelte') && !id.includes('svelte-spa-router')) {
                return 'vendor-svelte'
              }
              if (id.includes('@supabase')) {
                return 'vendor-supabase'
              }
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
              return 'vendor'
            }
            // Route-based chunking for large components
            if (id.includes('/components/')) {
              if (id.includes('AgentSwarmVisualizer') || 
                  id.includes('DesignToCodeScreen') ||
                  id.includes('VoiceCodeScreen')) {
                return 'feature-heavy'
              }
            }
          },
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
        },
      },
      
      // Optimize build output for modern browsers
      target: 'esnext',
      cssTarget: 'esnext',
      
      // Reduce chunk size warnings (500KB threshold)
      chunkSizeWarningLimit: 500,
      
      // Report compressed sizes for accurate metrics
      reportCompressedSize: true,
    },
    
    optimizeDeps: {
      // Pre-bundle these dependencies for faster dev server start
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
        'mermaid',
        'diff',
      ],
      // Force optimize on cold start
      force: true,
    },
    
    test: {
      environment: 'jsdom',
      globals: true,
      setupFiles: ['./src/test/setup.ts']
    },
  }
})
