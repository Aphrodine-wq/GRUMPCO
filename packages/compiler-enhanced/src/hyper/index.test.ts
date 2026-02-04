/**
 * HyperCompiler Main Orchestrator Tests
 * 
 * Tests the main HyperCompiler class and factory functions
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { 
  HyperCompiler, 
  createHyperCompiler, 
  hyperCompile,
  createTieredCompiler,
  PERFORMANCE_TIERS 
} from './index.js';
import type { HyperCompilerOptions, HyperCompileResult } from './types.js';
import { writeFileSync, mkdirSync, rmSync, existsSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';

describe('HyperCompiler', () => {
  let tempDir: string;
  let sourceDir: string;

  beforeEach(() => {
    tempDir = join(tmpdir(), `hyper-test-${Date.now()}`);
    sourceDir = join(tempDir, 'src');
    mkdirSync(sourceDir, { recursive: true });
  });

  afterEach(() => {
    if (existsSync(tempDir)) {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });

  describe('createHyperCompiler', () => {
    it('should create a HyperCompiler instance with default options', () => {
      const compiler = createHyperCompiler();
      expect(compiler).toBeInstanceOf(HyperCompiler);
    });

    it('should create a HyperCompiler with custom options', () => {
      const options: HyperCompilerOptions = {
        performanceTier: 'aggressive',
        outDir: join(tempDir, 'dist'),
        cacheDir: join(tempDir, 'cache')
      };
      
      const compiler = createHyperCompiler(options);
      expect(compiler).toBeInstanceOf(HyperCompiler);
    });
  });

  describe('createTieredCompiler', () => {
    it('should create conservative tier compiler', () => {
      const compiler = createTieredCompiler('conservative');
      expect(compiler).toBeInstanceOf(HyperCompiler);
    });

    it('should create balanced tier compiler', () => {
      const compiler = createTieredCompiler('balanced');
      expect(compiler).toBeInstanceOf(HyperCompiler);
    });

    it('should create aggressive tier compiler', () => {
      const compiler = createTieredCompiler('aggressive');
      expect(compiler).toBeInstanceOf(HyperCompiler);
    });

    it('should create insane tier compiler', () => {
      const compiler = createTieredCompiler('insane');
      expect(compiler).toBeInstanceOf(HyperCompiler);
    });
  });

  describe('PERFORMANCE_TIERS', () => {
    it('should have all tier configurations', () => {
      expect(PERFORMANCE_TIERS).toHaveProperty('conservative');
      expect(PERFORMANCE_TIERS).toHaveProperty('balanced');
      expect(PERFORMANCE_TIERS).toHaveProperty('aggressive');
      expect(PERFORMANCE_TIERS).toHaveProperty('insane');
    });

    it('conservative tier should have GPU disabled', () => {
      expect(PERFORMANCE_TIERS.conservative.gpu?.enabled).toBe(false);
    });

    it('insane tier should have all features enabled', () => {
      expect(PERFORMANCE_TIERS.insane.gpu?.enabled).toBe(true);
      expect(PERFORMANCE_TIERS.insane.jit?.enabled).toBe(true);
      expect(PERFORMANCE_TIERS.insane.distributed?.enabled).toBe(true);
      expect(PERFORMANCE_TIERS.insane.quantum?.enabled).toBe(true);
    });

    it('balanced tier should be a middle ground', () => {
      expect(PERFORMANCE_TIERS.balanced.jit?.enabled).toBe(true);
      expect(PERFORMANCE_TIERS.balanced.distributed?.enabled).toBe(false);
    });
  });

  describe('initialize', () => {
    it('should initialize without errors', async () => {
      const compiler = createHyperCompiler({
        performanceTier: 'conservative',
        outDir: join(tempDir, 'dist'),
        cacheDir: join(tempDir, 'cache')
      });
      
      await expect(compiler.initialize()).resolves.not.toThrow();
      await compiler.shutdown();
    });

    it('should emit initialized event', async () => {
      const compiler = createHyperCompiler({
        performanceTier: 'conservative'
      });
      
      const initHandler = vi.fn();
      compiler.on('initialized', initHandler);
      
      await compiler.initialize();
      
      expect(initHandler).toHaveBeenCalled();
      await compiler.shutdown();
    });
  });

  describe('compile', () => {
    it('should compile empty entry points', async () => {
      const compiler = createHyperCompiler({
        performanceTier: 'conservative',
        outDir: join(tempDir, 'dist')
      });
      
      const result = await compiler.compile([]);
      
      expect(result).toHaveProperty('success');
      expect(result).toHaveProperty('outputs');
      expect(result).toHaveProperty('metrics');
      
      await compiler.shutdown();
    });

    it('should compile a single file', async () => {
      const testFile = join(sourceDir, 'test.intent');
      writeFileSync(testFile, `
        feature: Test Feature
        actor: User
        when: User clicks button
        then: Show message
      `);
      
      const compiler = createHyperCompiler({
        performanceTier: 'conservative',
        outDir: join(tempDir, 'dist')
      });
      
      const result = await compiler.compile([testFile]);
      
      expect(result.success).toBeDefined();
      expect(result.metrics.compilation.duration).toBeGreaterThanOrEqual(0);
      
      await compiler.shutdown();
    });

    it('should emit compile events', async () => {
      const compiler = createHyperCompiler({
        performanceTier: 'conservative'
      });
      
      const startHandler = vi.fn();
      const endHandler = vi.fn();
      
      compiler.on('compile:start', startHandler);
      compiler.on('compile:end', endHandler);
      
      await compiler.compile([]);
      
      expect(startHandler).toHaveBeenCalled();
      expect(endHandler).toHaveBeenCalled();
      
      await compiler.shutdown();
    });
  });

  describe('shutdown', () => {
    it('should shutdown cleanly', async () => {
      const compiler = createHyperCompiler({
        performanceTier: 'conservative'
      });
      
      await compiler.initialize();
      await expect(compiler.shutdown()).resolves.not.toThrow();
    });

    it('should emit shutdown event', async () => {
      const compiler = createHyperCompiler({
        performanceTier: 'conservative'
      });
      
      const shutdownHandler = vi.fn();
      compiler.on('shutdown', shutdownHandler);
      
      await compiler.initialize();
      await compiler.shutdown();
      
      expect(shutdownHandler).toHaveBeenCalled();
    });
  });

  describe('getStats', () => {
    it('should return compiler statistics', async () => {
      const compiler = createHyperCompiler({
        performanceTier: 'conservative'
      });
      
      const stats = compiler.getStats();
      
      expect(stats).toHaveProperty('compilations');
      expect(stats).toHaveProperty('subsystems');
      
      await compiler.shutdown();
    });
  });
});

describe('hyperCompile', () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = join(tmpdir(), `hyper-test-${Date.now()}`);
    mkdirSync(tempDir, { recursive: true });
  });

  afterEach(() => {
    if (existsSync(tempDir)) {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it('should compile with convenience function', async () => {
    const result = await hyperCompile([], {
      performanceTier: 'conservative',
      outDir: join(tempDir, 'dist')
    });
    
    expect(result).toHaveProperty('success');
    expect(result).toHaveProperty('outputs');
  });

  it('should accept string entry point', async () => {
    const testFile = join(tempDir, 'test.intent');
    writeFileSync(testFile, 'feature: Test');
    
    const result = await hyperCompile(testFile, {
      performanceTier: 'conservative',
      outDir: join(tempDir, 'dist')
    });
    
    expect(result.success).toBeDefined();
  });
});
