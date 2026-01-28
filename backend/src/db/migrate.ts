/**
 * Schema migration runner.
 * Ensures schema_version table exists, then runs pending migrations from
 * backend/src/db/migrations/*.sql in order.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import type Database from 'better-sqlite3';
import logger from '../middleware/logger.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const MIGRATIONS_DIR = path.join(__dirname, 'migrations');

export function getCurrentVersion(db: Database.Database): number {
  try {
    const row = db.prepare('SELECT version FROM schema_version LIMIT 1').get() as { version: number } | undefined;
    return row?.version ?? 0;
  } catch {
    return 0;
  }
}

export function ensureSchemaVersionTable(db: Database.Database): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS schema_version (
      version INTEGER NOT NULL DEFAULT 0
    );
    INSERT INTO schema_version (version) SELECT 0 WHERE (SELECT COUNT(*) FROM schema_version) = 0;
  `);
}

function getMigrationFiles(): { version: number; file: string }[] {
  if (!fs.existsSync(MIGRATIONS_DIR)) {
    return [];
  }
  const files = fs.readdirSync(MIGRATIONS_DIR).filter((f) => f.endsWith('.sql'));
  const parsed = files.map((f) => {
    const m = f.match(/^(\d+)_/);
    return { version: m ? parseInt(m[1], 10) : 0, file: f };
  });
  return parsed.filter((p) => p.version > 0).sort((a, b) => a.version - b.version);
}

export function runMigrations(db: Database.Database): void {
  ensureSchemaVersionTable(db);
  const current = getCurrentVersion(db);
  const files = getMigrationFiles();

  for (const { version, file } of files) {
    if (version <= current) continue;

    const filePath = path.join(MIGRATIONS_DIR, file);
    const sql = fs.readFileSync(filePath, 'utf8');
    logger.info({ migration: file, version }, 'Running migration');

    try {
      db.exec(sql);
      db.prepare('UPDATE schema_version SET version = ?').run(version);
    } catch (err) {
      logger.error({ migration: file, error: (err as Error).message }, 'Migration failed');
      throw err;
    }
  }
}
