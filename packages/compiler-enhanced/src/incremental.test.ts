/**
 * Tests for Incremental Compilation
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { IncrementalCompiler, calculateHash } from './incremental.js';
import type { CompilerConfig } from './types.js';
import { writeFileSync, mkdirSync, rmSync, existsSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';

describe('IncrementalCompiler', () => {
  let tempDir: string;
  let config: CompilerConfig;
  let compiler: IncrementalCompiler;

  beforeEach(() => {
    tempDir = join(tmpdir(), `grump-test-${Date.now()}`);
    mkdirSync(tempDir, { recursive: true });
    
    config = {
      cacheDir: join(tempDir, 'cache'),
      outDir: join(tempDir, 'dist')
    };
    
    compiler = new IncrementalCompiler(config);
  });

  afterEach(() => {
    if (existsSync(tempDir)) {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });

  describe('calculateHash', () => {
    it('should calculate consistent hashes for same content', () => {
      const content = 'test content';
      const hash1 = calculateHash(content);
      const hash2 = calculateHash(content);
      expect(hash1).toBe(hash2);
    });

    it('should calculate different hashes for different content', () => {
      const hash1 = calculateHash('content1');
      const hash2 = calculateHash('content2');
      expect(hash1).not.toBe(hash2);
    });
  });

  describe('needsRecompilation', () => {
    it('should return true for new files', () => {
      const filePath = join(tempDir, 'test.intent');
      writeFileSync(filePath, 'test content');
      
      expect(compiler.needsRecompilation(filePath)).toBe(true);
    });

    it('should return false for unchanged files after caching', () => {
      const filePath = join(tempDir, 'test.intent');
      writeFileSync(filePath, 'test content');
      
      // First compilation
      compiler.storeCache(filePath, 'output', []);
      
      // Should not need recompilation
      expect(compiler.needsRecompilation(filePath)).toBe(false);
    });

    it('should return true for changed files', () => {
      const filePath = join(tempDir, 'test.intent');
      writeFileSync(filePath, 'original content');
      
      // First compilation
      compiler.storeCache(filePath, 'output', []);
      
      // Change file
      writeFileSync(filePath, 'modified content');
      
      // Should need recompilation
      expect(compiler.needsRecompilation(filePath)).toBe(true);
    });
  });

  describe('getCachedOutput', () => {
    it('should return null for uncached files', () => {
      const filePath = join(tempDir, 'test.intent');
      writeFileSync(filePath, 'test content');
      
      expect(compiler.getCachedOutput(filePath)).toBeNull();
    });

    it('should return cached output for unchanged files', () => {
      const filePath = join(tempDir, 'test.intent');
      writeFileSync(filePath, 'test content');
      
      const expectedOutput = 'compiled output';
      compiler.storeCache(filePath, expectedOutput, []);
      
      const cached = compiler.getCachedOutput(filePath);
      expect(cached).not.toBeNull();
      expect(cached!.output).toBe(expectedOutput);
    });
  });

  describe('getAffectedFiles', () => {
    it('should identify affected files in dependency graph', () => {
      const fileA = join(tempDir, 'a.intent');
      const fileB = join(tempDir, 'b.intent');
      const fileC = join(tempDir, 'c.intent');
      
      writeFileSync(fileA, 'content A');
      writeFileSync(fileB, 'content B');
      writeFileSync(fileC, 'content C');
      
      // Create dependency: C depends on B, B depends on A
      compiler.storeCache(fileA, 'output A', []);
      compiler.storeCache(fileB, 'output B', [fileA]);
      compiler.storeCache(fileC, 'output C', [fileB]);
      
      const affected = compiler.getAffectedFiles([fileA]);
      
      expect(affected).toContain(fileA);
      expect(affected).toContain(fileB);
      expect(affected).toContain(fileC);
    });
  });

  describe('cache persistence', () => {
    it('should save and load cache', () => {
      const filePath = join(tempDir, 'test.intent');
      writeFileSync(filePath, 'test content');
      
      compiler.storeCache(filePath, 'output', []);
      compiler.saveCache();
      
      // Create new compiler instance (should load cache)
      const newCompiler = new IncrementalCompiler(config);
      
      const cached = newCompiler.getCachedOutput(filePath);
      expect(cached).not.toBeNull();
      expect(cached!.output).toBe('output');
    });
  });
});
