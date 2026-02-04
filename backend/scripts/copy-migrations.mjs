#!/usr/bin/env node
/**
 * Copy src/db/migrations to dist/db/migrations after tsc build.
 * Ensures migrations are present in dist for Docker and production runs.
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');
const src = path.join(root, 'src', 'db', 'migrations');
const destDir = path.join(root, 'dist', 'db');
const dest = path.join(destDir, 'migrations');

if (!fs.existsSync(src)) {
  console.warn('[copy-migrations] src/db/migrations not found, skipping');
  process.exit(0);
}
fs.mkdirSync(destDir, { recursive: true });
fs.cpSync(src, dest, { recursive: true });
console.log('[copy-migrations] copied src/db/migrations -> dist/db/migrations');
