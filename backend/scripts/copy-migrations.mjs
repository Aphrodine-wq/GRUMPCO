#!/usr/bin/env node
// Copy non-TypeScript assets to dist after tsc build.
// - src/db/migrations to dist/db/migrations
// - src/skills/{skill}/manifest.json to dist/skills/{skill}/manifest.json
// Ensures these files are present in dist for Docker and production runs.
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');

// Copy migrations
const migrationsSrc = path.join(root, 'src', 'db', 'migrations');
const migrationsDestDir = path.join(root, 'dist', 'db');
const migrationsDest = path.join(migrationsDestDir, 'migrations');

if (fs.existsSync(migrationsSrc)) {
  fs.mkdirSync(migrationsDestDir, { recursive: true });
  fs.cpSync(migrationsSrc, migrationsDest, { recursive: true });
  console.log('[copy-assets] copied src/db/migrations -> dist/db/migrations');
} else {
  console.warn('[copy-assets] src/db/migrations not found, skipping');
}

// Copy skill manifest.json files
const skillsSrc = path.join(root, 'src', 'skills');
const skillsDest = path.join(root, 'dist', 'skills');

if (fs.existsSync(skillsSrc)) {
  const skillDirs = fs.readdirSync(skillsSrc, { withFileTypes: true })
    .filter(d => d.isDirectory() && !['base', 'node_modules', '__tests__'].includes(d.name));
  
  let copied = 0;
  for (const dir of skillDirs) {
    const manifestSrc = path.join(skillsSrc, dir.name, 'manifest.json');
    const manifestDest = path.join(skillsDest, dir.name, 'manifest.json');
    
    if (fs.existsSync(manifestSrc)) {
      fs.mkdirSync(path.dirname(manifestDest), { recursive: true });
      fs.copyFileSync(manifestSrc, manifestDest);
      copied++;
    }
  }
  console.log(`[copy-assets] copied ${copied} skill manifest.json files to dist/skills/`);
} else {
  console.warn('[copy-assets] src/skills not found, skipping');
}
