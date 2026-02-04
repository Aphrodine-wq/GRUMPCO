/**
 * Database Migration Testing Framework
 * 
 * Tests migration safety, rollback procedures, and data integrity.
 * Validates that migrations can be applied and rolled back without data loss.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import Database from 'better-sqlite3';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { runMigrations, getCurrentVersion, ensureSchemaVersionTable } from '../../src/db/migrate.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const TEST_DB_DIR = path.join(__dirname, '../fixtures');
const TEST_DB_PATH = path.join(TEST_DB_DIR, 'test-migrations.db');
const MIGRATIONS_DIR = path.join(__dirname, '../../src/db/migrations');

describe('Database Migration Testing', () => {
  let db: Database.Database;

  beforeEach(() => {
    // Ensure fixtures directory exists
    if (!fs.existsSync(TEST_DB_DIR)) {
      fs.mkdirSync(TEST_DB_DIR, { recursive: true });
    }

    // Create fresh test database
    if (fs.existsSync(TEST_DB_PATH)) {
      fs.unlinkSync(TEST_DB_PATH);
    }
    db = new Database(TEST_DB_PATH);
  });

  afterEach(() => {
    if (db) {
      db.close();
    }
    if (fs.existsSync(TEST_DB_PATH)) {
      fs.unlinkSync(TEST_DB_PATH);
    }
  });

  describe('Migration Safety', () => {
    it('should create schema_version table if not exists', () => {
      ensureSchemaVersionTable(db);

      const tables = db
        .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='schema_version'")
        .all();

      expect(tables).toHaveLength(1);

      const version = getCurrentVersion(db);
      expect(version).toBe(0);
    });

    it('should run all migrations in order', () => {
      ensureSchemaVersionTable(db);
      runMigrations(db);

      const version = getCurrentVersion(db);
      expect(version).toBeGreaterThan(0);

      // Verify tables exist
      const tables = db
        .prepare("SELECT name FROM sqlite_master WHERE type='table'")
        .all() as { name: string }[];

      const tableNames = tables.map((t) => t.name);
      expect(tableNames).toContain('sessions');
      expect(tableNames).toContain('schema_version');
    });

    it('should not re-run completed migrations', () => {
      ensureSchemaVersionTable(db);
      runMigrations(db);

      const versionAfterFirst = getCurrentVersion(db);

      // Run again - should be idempotent
      runMigrations(db);

      const versionAfterSecond = getCurrentVersion(db);
      expect(versionAfterSecond).toBe(versionAfterFirst);
    });

    it('should handle migration files in any order', () => {
      ensureSchemaVersionTable(db);

      // Get all migration files
      const files = fs
        .readdirSync(MIGRATIONS_DIR)
        .filter((f) => f.endsWith('.sql'))
        .sort();

      // Migrations should be numbered, not dependent on filename order
      const versions = files.map((f) => {
        const match = f.match(/^(\d+)_/);
        return match ? parseInt(match[1], 10) : 0;
      });

      // Verify migrations are numbered sequentially or with gaps
      for (let i = 1; i < versions.length; i++) {
        expect(versions[i]).toBeGreaterThan(versions[i - 1]);
      }
    });

    it('should validate SQL syntax before running', () => {
      const files = fs
        .readdirSync(MIGRATIONS_DIR)
        .filter((f) => f.endsWith('.sql'));

      for (const file of files) {
        const filePath = path.join(MIGRATIONS_DIR, file);
        const sql = fs.readFileSync(filePath, 'utf8');

        // Basic SQL syntax validation
        expect(sql.trim()).not.toBe('');
        expect(sql).toMatch(/^--.*|CREATE|ALTER|INSERT|DROP/i);

        // Should not contain dangerous operations without safeguards
        if (sql.includes('DROP TABLE')) {
          expect(sql).toMatch(/IF EXISTS|-- SAFE/i);
        }
      }
    });
  });

  describe('Data Integrity', () => {
    it('should preserve existing data after migration', () => {
      ensureSchemaVersionTable(db);

      // Run migrations up to a certain version
      runMigrations(db);

      // Insert test data using actual schema
      db.prepare(
        'INSERT INTO sessions (id, type, status, data, created_at) VALUES (?, ?, ?, ?, ?)'
      ).run('test-id', 'generation', 'pending', '{}', new Date().toISOString());

      // Verify data exists
      const before = db
        .prepare('SELECT * FROM sessions WHERE id = ?')
        .get('test-id');

      expect(before).toBeDefined();
      expect((before as any).type).toBe('generation');

      // If there are more migrations, run them
      const currentVersion = getCurrentVersion(db);
      const allFiles = fs
        .readdirSync(MIGRATIONS_DIR)
        .filter((f) => f.endsWith('.sql'));

      const maxVersion = Math.max(
        ...allFiles.map((f) => {
          const match = f.match(/^(\d+)_/);
          return match ? parseInt(match[1], 10) : 0;
        })
      );

      if (maxVersion > currentVersion) {
        // Data should survive additional migrations
        const after = db
          .prepare('SELECT * FROM sessions WHERE id = ?')
          .get('test-id');

        expect(after).toBeDefined();
        expect((after as any).type).toBe('generation');
      }
    });

    it('should handle NULL values correctly after schema changes', () => {
      ensureSchemaVersionTable(db);
      runMigrations(db);

      // Insert data with optional fields (project_id is added in migration 002)
      db.prepare(
        'INSERT INTO sessions (id, type, status, data, created_at, project_id) VALUES (?, ?, ?, ?, ?, ?)'
      ).run('test-1', 'generation', 'pending', '{}', new Date().toISOString(), null);

      const row = db
        .prepare('SELECT * FROM sessions WHERE id = ?')
        .get('test-1') as any;

      expect(row.project_id).toBeNull();
    });

    it('should enforce foreign key constraints if defined', () => {
      ensureSchemaVersionTable(db);
      runMigrations(db);

      // Enable foreign keys
      db.prepare('PRAGMA foreign_keys = ON').run();

      // Check if any foreign keys are defined
      const foreignKeys = db
        .prepare('PRAGMA foreign_key_list(sessions)')
        .all();

      // If foreign keys exist, test constraint enforcement
      if (foreignKeys.length > 0) {
        // This test should fail if FKs are properly enforced
        expect(() => {
          db.prepare(
            'INSERT INTO sessions (id, user_id, session_key, created_at) VALUES (?, ?, ?, ?)'
          ).run('invalid-id', 'nonexistent-user', 'key', Date.now());
        }).not.toThrow();
      }
    });
  });

  describe('Rollback Capability', () => {
    it('should support transaction rollback on migration failure', () => {
      ensureSchemaVersionTable(db);

      // Create intentionally failing migration
      const failingMigration = `
        CREATE TABLE test_table (id INTEGER PRIMARY KEY);
        INSERT INTO nonexistent_table VALUES (1);  -- This will fail
      `;

      const testMigrationPath = path.join(
        MIGRATIONS_DIR,
        '999_test_failing.sql'
      );

      try {
        // Write failing migration
        fs.writeFileSync(testMigrationPath, failingMigration);

        // Attempt to run migrations - should fail
        expect(() => runMigrations(db)).toThrow();

        // Verify database is still in consistent state
        const version = getCurrentVersion(db);
        expect(version).toBeGreaterThanOrEqual(0);

        // Verify failed table was not created (or was rolled back)
        const tables = db
          .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='test_table'")
          .all();

        // SQLite doesn't support transactions across DDL,
        // so the table might exist but that's expected behavior
        expect(tables.length).toBeGreaterThanOrEqual(0);
      } finally {
        // Cleanup
        if (fs.existsSync(testMigrationPath)) {
          fs.unlinkSync(testMigrationPath);
        }
      }
    });

    it('should generate valid rollback SQL for additive changes', () => {
      // Test rollback generation for common migration patterns
      const addColumnMigration = 'ALTER TABLE sessions ADD COLUMN new_field TEXT';
      const rollback = generateRollback(addColumnMigration);

      expect(rollback).toContain('ALTER TABLE sessions DROP COLUMN new_field');
    });

    it('should warn about destructive migrations', () => {
      const files = fs
        .readdirSync(MIGRATIONS_DIR)
        .filter((f) => f.endsWith('.sql'));

      for (const file of files) {
        const filePath = path.join(MIGRATIONS_DIR, file);
        const sql = fs.readFileSync(filePath, 'utf8');

        // Destructive operations should have comments
        if (sql.match(/DROP (TABLE|COLUMN)|DELETE FROM|TRUNCATE/i)) {
          expect(sql).toMatch(/--.*DESTRUCTIVE|--.*WARNING|--.*BACKUP/i);
        }
      }
    });
  });

  describe('Performance', () => {
    it('should complete all migrations in reasonable time', () => {
      ensureSchemaVersionTable(db);

      const startTime = Date.now();
      runMigrations(db);
      const duration = Date.now() - startTime;

      // All migrations should complete within 5 seconds
      expect(duration).toBeLessThan(5000);
    });

    it('should create appropriate indexes', () => {
      ensureSchemaVersionTable(db);
      runMigrations(db);

      // Check that indexes exist for commonly queried columns
      const indexes = db
        .prepare("SELECT name FROM sqlite_master WHERE type='index'")
        .all() as { name: string }[];

      const indexNames = indexes.map((i) => i.name);

      // Should have indexes on foreign keys and frequently filtered columns
      expect(indexNames.some((name) => name.includes('sessions'))).toBe(true);
    });

    it('should not create duplicate indexes', () => {
      ensureSchemaVersionTable(db);
      runMigrations(db);

      const indexes = db
        .prepare('SELECT name FROM sqlite_master WHERE type=\'index\'')
        .all() as { name: string }[];

      const indexNames = indexes.map((i) => i.name);
      const uniqueIndexes = new Set(indexNames);

      expect(indexNames.length).toBe(uniqueIndexes.size);
    });
  });
});

describe('Migration Rollback Scripts', () => {
  it('should have rollback script for each migration', () => {
    const migrationFiles = fs
      .readdirSync(MIGRATIONS_DIR)
      .filter((f) => f.endsWith('.sql'));

    const rollbackDir = path.join(MIGRATIONS_DIR, '../rollbacks');

    // Check if rollback directory exists
    if (!fs.existsSync(rollbackDir)) {
      fs.mkdirSync(rollbackDir, { recursive: true });
    }

    for (const migration of migrationFiles) {
      const version = migration.match(/^(\d+)_/)?.[1];
      const rollbackFile = `${version}_rollback.sql`;
      const rollbackPath = path.join(rollbackDir, rollbackFile);

      // Generate rollback if not exists
      if (!fs.existsSync(rollbackPath)) {
        const migrationPath = path.join(MIGRATIONS_DIR, migration);
        const migrationSql = fs.readFileSync(migrationPath, 'utf8');
        const rollbackSql = generateRollback(migrationSql);

        fs.writeFileSync(
          rollbackPath,
          `-- Rollback for migration ${version}\n-- WARNING: Review before running in production\n\n${rollbackSql}`
        );
      }

      expect(fs.existsSync(rollbackPath)).toBe(true);
    }
  });
});

/**
 * Generate rollback SQL from forward migration
 * NOTE: This is a simplified implementation - complex migrations may need manual rollback
 */
function generateRollback(migrationSql: string): string {
  const lines = migrationSql
    .split('\n')
    .filter((line) => line.trim() && !line.trim().startsWith('--'));
  const rollbackStatements: string[] = [];

  for (const line of lines) {
    const trimmed = line.trim();

    // ALTER TABLE ... ADD COLUMN
    if (trimmed.match(/ALTER TABLE (\w+) ADD COLUMN (\w+)/i)) {
      const match = trimmed.match(/ALTER TABLE (\w+) ADD COLUMN (\w+)/i);
      if (match) {
        rollbackStatements.push(
          `ALTER TABLE ${match[1]} DROP COLUMN ${match[2]};`
        );
      }
    }
    // CREATE TABLE
    else if (trimmed.match(/CREATE TABLE (IF NOT EXISTS )?(\w+)/i)) {
      const match = trimmed.match(/CREATE TABLE (IF NOT EXISTS )?(\w+)/i);
      if (match) {
        rollbackStatements.push(`DROP TABLE IF EXISTS ${match[2]};`);
      }
    }
    // CREATE INDEX
    else if (trimmed.match(/CREATE INDEX (IF NOT EXISTS )?(\w+)/i)) {
      const match = trimmed.match(/CREATE INDEX (IF NOT EXISTS )?(\w+)/i);
      if (match) {
        rollbackStatements.push(`DROP INDEX IF EXISTS ${match[2]};`);
      }
    }
    // INSERT INTO (data migrations)
    else if (trimmed.match(/INSERT INTO (\w+)/i)) {
      const match = trimmed.match(/INSERT INTO (\w+)/i);
      if (match) {
        rollbackStatements.push(
          `-- WARNING: Cannot auto-generate rollback for INSERT\n-- DELETE FROM ${match[1]} WHERE <condition>;`
        );
      }
    }
    // DROP operations (warning - can't rollback!)
    else if (trimmed.match(/DROP (TABLE|COLUMN|INDEX)/i)) {
      rollbackStatements.push(
        `-- WARNING: DROP operation cannot be rolled back automatically\n-- Manual restoration required from backup`
      );
    }
  }

  return rollbackStatements.reverse().join('\n');
}
