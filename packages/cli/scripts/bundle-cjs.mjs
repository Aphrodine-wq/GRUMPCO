/**
 * Bundle CLI to single CommonJS file for pkg (native EXE).
 * pkg requires CJS - ESM fails at runtime.
 */
import * as esbuild from 'esbuild';
import { mkdirSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const cliRoot = join(__dirname, '..');
const outDir = join(cliRoot, 'dist-native');
const outFile = join(outDir, 'grump.js');

if (!existsSync(outDir)) mkdirSync(outDir, { recursive: true });

// Plugin: replace import.meta.url with CJS-compatible (process.argv[1] = script path)
const importMetaPlugin = {
  name: 'import-meta-cjs',
  setup(build) {
    build.onLoad({ filter: /\.ts$/ }, async (args) => {
      const { readFileSync } = await import('fs');
      let src = readFileSync(args.path, 'utf8');
      src = src.replace(
        /const __filename = fileURLToPath\(import\.meta\.url\);/g,
        'const __filename = require("path").resolve(process.argv[1] || process.cwd());'
      );
      return { contents: src, loader: 'ts' };
    });
  },
};

await esbuild.build({
  entryPoints: [join(cliRoot, 'src', 'index.ts')],
  bundle: true,
  format: 'cjs',
  platform: 'node',
  target: 'node18',
  outfile: outFile,
  plugins: [importMetaPlugin],
  external: ['fs', 'path', 'os', 'child_process', 'url', 'stream', 'crypto', 'events', 'util', 'buffer', 'process', 'module', 'assert', 'tty', 'readline', 'net', 'http', 'https'],
  banner: { js: '/* G-Rump CLI */\n' },
  sourcemap: false,
  minify: false,
  keepNames: true,
});
console.log('Bundled to', outFile);
