/**
 * Example G-Rump Compiler Configuration
 * 
 * Save this file as grump.compiler.config.js in your project root
 */

/** @type {import('@grump/compiler-enhanced').CompilerConfig} */
module.exports = {
  /**
   * Core Compilation Features
   */
  
  // Enable incremental compilation (only recompile changed files)
  incremental: true,
  
  // Enable watch mode (auto-recompile on file changes)
  watch: false,
  
  // Enable parallel compilation (use multiple CPU cores)
  parallel: true,
  
  // Number of worker threads (defaults to CPU count - 1)
  workers: 4,
  
  /**
   * Optimization Features
   */
  
  // Enable dead code elimination
  dce: true,
  
  // Enable minification
  minify: true,
  
  // Enable tree shaking
  treeShake: true,
  
  /**
   * Output Features
   */
  
  // Generate source maps (true | 'inline' | 'hidden')
  sourceMaps: true,
  
  // Enable hot reload server
  hotReload: true,
  
  // Hot reload server port
  hotReloadPort: 3456,
  
  /**
   * Paths
   */
  
  // Output directory for compiled files
  outDir: './dist',
  
  // Cache directory for incremental compilation
  cacheDir: './.grump/cache',
  
  /**
   * Target Environment
   */
  
  // Target JavaScript version
  // Options: 'es2020' | 'es2022' | 'node20'
  target: 'es2022',
  
  /**
   * Entry Points
   */
  
  // Entry points to compile
  // Can be single string or array of strings
  entry: ['./intents'],
  
  /**
   * Transform Plugins
   */
  
  // Custom transform plugins
  plugins: [
    // Example: Built-in minification plugin
    // require('@grump/compiler-enhanced').builtinPlugins.minify(),
    
    // Example: Custom plugin
    {
      name: 'myCustomTransform',
      preCompile: async (context) => {
        // Transform content before compilation
        const transformed = context.content.replace(/OLD_API/g, 'NEW_API');
        return {
          content: transformed,
          changed: transformed !== context.content
        };
      },
      postCompile: async (context) => {
        // Transform output after compilation
        return {
          content: context.output,
          changed: false
        };
      }
    }
  ],
  
  /**
   * External Dependencies
   */
  
  // Dependencies to treat as external (not bundled)
  external: [
    'react',
    'react-dom',
    'vue',
    '@angular/core'
  ]
};
