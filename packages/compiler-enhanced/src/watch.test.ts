/**
 * Tests for Watch Mode
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { WatchCompiler, createWatchCompiler } from './watch.js';
import type { CompilerConfig } from './types.js';
import { writeFileSync, mkdirSync, rmSync, existsSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';

describe('WatchCompiler', () => {
  let tempDir: string;
  let config: CompilerConfig;
  let watchCompiler: WatchCompiler;

  beforeEach(() => {
    tempDir = join(tmpdir(), `grump-watch-test-${Date.now()}`);
    mkdirSync(tempDir, { recursive: true });
    mkdirSync(join(tempDir, 'intents'), { recursive: true });
    
    config = {
      cacheDir: join(tempDir, 'cache'),
      outDir: join(tempDir, 'dist'),
      watch: true
    };
    
    watchCompiler = createWatchCompiler(config);
  });

  afterEach(async () => {
    await watchCompiler.stop();
    
    if (existsSync(tempDir)) {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });

  describe('start and stop', () => {
    it('should start and stop watching', async () => {
      const filePath = join(tempDir, 'test.intent');
      writeFileSync(filePath, 'test content');
      
      await watchCompiler.start([join(tempDir, '*.intent')]);
      
      expect(watchCompiler.getStatus().isWatching).toBe(true);
      
      await watchCompiler.stop();
      
      expect(watchCompiler.getStatus().isWatching).toBe(false);
    });

    it('should detect file changes', async () => {
      const filePath = join(tempDir, 'test.intent');
      writeFileSync(filePath, 'initial content');
      
      const changes: string[] = [];
      watchCompiler.on('change', (event) => {
        changes.push(event.path);
      });
      
      await watchCompiler.start([join(tempDir, '*.intent')]);
      
      // Wait a bit for the watcher to be ready
      await new Promise(resolve => setTimeout(resolve, 100));
      
      // Modify file
      writeFileSync(filePath, 'modified content');
      
      // Wait for the change event
      await new Promise(resolve => setTimeout(resolve, 400));
      
      expect(changes.length).toBeGreaterThan(0);
      expect(changes[changes.length - 1]).toBe(filePath);
    });
  });

  describe('debouncing', () => {
    it('should debounce rapid changes', async () => {
      const filePath = join(tempDir, 'test.intent');
      writeFileSync(filePath, 'content');
      
      let compileCount = 0;
      watchCompiler.on('compiling', () => {
        compileCount++;
      });
      
      await watchCompiler.start([join(tempDir, '*.intent')]);
      await new Promise(resolve => setTimeout(resolve, 100));
      
      // Rapid changes
      writeFileSync(filePath, 'content 1');
      await new Promise(resolve => setTimeout(resolve, 50));
      writeFileSync(filePath, 'content 2');
      await new Promise(resolve => setTimeout(resolve, 50));
      writeFileSync(filePath, 'content 3');
      
      // Wait for debounce and compilation
      await new Promise(resolve => setTimeout(resolve, 500));
      
      // Should compile only once due to debouncing
      expect(compileCount).toBeLessThanOrEqual(1);
    });
  });

  describe('status', () => {
    it('should report correct status', async () => {
      const filePath = join(tempDir, 'test.intent');
      writeFileSync(filePath, 'content');
      
      await watchCompiler.start([join(tempDir, '*.intent')]);
      
      const status = watchCompiler.getStatus();
      expect(status.isWatching).toBe(true);
      expect(status.pendingChanges).toBe(0);
      expect(status.isCompiling).toBe(false);
      expect(status.queuedCompilations).toBe(0);
    });
  });
});
