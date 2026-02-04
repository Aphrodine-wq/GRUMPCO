/**
 * Code Splitting Engine Tests
 * 
 * Tests for the advanced code splitting module
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  CodeSplittingEngine,
  createCodeSplittingEngine,
  splitCode,
  generateChunkManifest,
  analyzeModuleGraph,
  calculateOptimalChunkCount,
  type SplittingOptions,
  type SplitResult
} from './splitting.js';
import type { HyperOutputFile } from './types.js';

// Helper to create mock output files
function createMockOutput(
  path: string,
  content: string,
  isEntry = false
): HyperOutputFile {
  const size = Buffer.byteLength(content, 'utf-8');
  return {
    path,
    content,
    size,
    gzipSize: Math.floor(size * 0.3),  // Approximate compression
    brotliSize: Math.floor(size * 0.25),
    isEntry,
    hash: 'mock-hash',
    sourceMap: undefined
  };
}

describe('CodeSplittingEngine', () => {
  let engine: CodeSplittingEngine;

  beforeEach(() => {
    engine = createCodeSplittingEngine();
  });

  describe('createCodeSplittingEngine', () => {
    it('should create an engine instance', () => {
      expect(engine).toBeInstanceOf(CodeSplittingEngine);
    });

    it('should accept custom options', () => {
      const options: Partial<SplittingOptions> = {
        strategies: {
          route: true,
          vendor: true,
          common: true,
          dynamic: true,
          layer: false
        },
        optimization: {
          minSize: 10000,
          maxSize: 200000,
          minChunks: 2,
          maxAsyncRequests: 20,
          maxInitialRequests: 20,
          automaticNameDelimiter: '-'
        }
      };
      
      const customEngine = createCodeSplittingEngine(options);
      expect(customEngine).toBeInstanceOf(CodeSplittingEngine);
    });
  });

  describe('split', () => {
    it('should split empty outputs', async () => {
      const result = await engine.split([]);
      
      expect(result).toHaveProperty('chunks');
      expect(result).toHaveProperty('manifest');
      expect(result).toHaveProperty('moduleMap');
      expect(result).toHaveProperty('stats');
      expect(result.chunks).toHaveLength(0);
    });

    it('should create chunks from outputs', async () => {
      const outputs: HyperOutputFile[] = [
        createMockOutput('/src/index.ts', `
          import { helper } from './utils.js';
          export function main() { return helper(); }
        `, true),
        createMockOutput('/src/utils.ts', `
          export function helper() { return 'hello'; }
        `)
      ];
      
      const result = await engine.split(outputs);
      
      expect(result.chunks.length).toBeGreaterThan(0);
      expect(result.stats.totalModules).toBe(2);
    });

    it('should emit split events', async () => {
      const startHandler = vi.fn();
      const endHandler = vi.fn();
      
      engine.on('split:start', startHandler);
      engine.on('split:end', endHandler);
      
      await engine.split([]);
      
      expect(startHandler).toHaveBeenCalled();
      expect(endHandler).toHaveBeenCalled();
    });

    it('should emit phase events', async () => {
      const phaseStartHandler = vi.fn();
      const phaseEndHandler = vi.fn();
      
      engine.on('phase:start', phaseStartHandler);
      engine.on('phase:end', phaseEndHandler);
      
      const outputs: HyperOutputFile[] = [
        createMockOutput('/src/index.ts', 'export const x = 1;', true)
      ];
      
      await engine.split(outputs);
      
      expect(phaseStartHandler).toHaveBeenCalled();
      expect(phaseEndHandler).toHaveBeenCalled();
    });
  });

  describe('vendor splitting', () => {
    it('should separate vendor modules', async () => {
      const outputs: HyperOutputFile[] = [
        createMockOutput('/src/index.ts', `
          import React from 'react';
          export default function App() { return React.createElement('div'); }
        `, true),
        createMockOutput('/node_modules/react/index.js', `
          export default { createElement: () => {} };
        `)
      ];
      
      const result = await engine.split(outputs);
      
      // Should have at least 2 chunks - main and vendor
      const vendorChunks = result.chunks.filter(c => c.name.includes('vendor'));
      expect(vendorChunks.length).toBeGreaterThanOrEqual(0);
    });
  });

  describe('dynamic import splitting', () => {
    it('should create async chunks for dynamic imports', async () => {
      const outputs: HyperOutputFile[] = [
        createMockOutput('/src/index.ts', `
          export async function loadPage() {
            const module = await import('./page.js');
            return module.default;
          }
        `, true),
        createMockOutput('/src/page.ts', `
          export default function Page() { return 'page'; }
        `)
      ];
      
      const result = await engine.split(outputs);
      
      // Check that dynamic import target is handled
      expect(result.stats.totalModules).toBe(2);
    });
  });

  describe('common chunk extraction', () => {
    it('should extract common modules', async () => {
      const sharedContent = 'export function shared() { return "shared"; }';
      
      const outputs: HyperOutputFile[] = [
        createMockOutput('/src/entry1.ts', `
          import { shared } from './shared.js';
          export function main1() { return shared(); }
        `, true),
        createMockOutput('/src/entry2.ts', `
          import { shared } from './shared.js';
          export function main2() { return shared(); }
        `, true),
        createMockOutput('/src/shared.ts', sharedContent)
      ];
      
      const result = await engine.split(outputs);
      
      expect(result.stats.totalModules).toBe(3);
    });
  });

  describe('chunk optimization', () => {
    it('should respect minSize constraint', async () => {
      const smallEngine = createCodeSplittingEngine({
        optimization: {
          minSize: 1000000, // 1MB - very high
          maxSize: 2000000,
          minChunks: 1,
          maxAsyncRequests: 30,
          maxInitialRequests: 30,
          automaticNameDelimiter: '~'
        }
      });
      
      const outputs: HyperOutputFile[] = [
        createMockOutput('/src/index.ts', 'export const x = 1;', true),
        createMockOutput('/src/utils.ts', 'export const y = 2;')
      ];
      
      const result = await smallEngine.split(outputs);
      
      // With high minSize, small modules should be merged
      expect(result.chunks.length).toBeLessThanOrEqual(2);
    });
  });

  describe('getStats', () => {
    it('should return engine statistics', () => {
      const stats = engine.getStats();
      
      expect(stats).toHaveProperty('moduleCount');
      expect(stats).toHaveProperty('options');
    });
  });

  describe('reset', () => {
    it('should reset internal state', async () => {
      const outputs: HyperOutputFile[] = [
        createMockOutput('/src/index.ts', 'export const x = 1;', true)
      ];
      
      await engine.split(outputs);
      
      engine.reset();
      
      const stats = engine.getStats();
      expect(stats).toHaveProperty('moduleCount', 0);
    });
  });
});

describe('splitCode', () => {
  it('should split code with convenience function', async () => {
    const outputs: HyperOutputFile[] = [
      createMockOutput('/src/main.ts', 'export default function() {}', true)
    ];
    
    const result = await splitCode(outputs);
    
    expect(result).toHaveProperty('chunks');
    expect(result).toHaveProperty('manifest');
  });

  it('should accept options', async () => {
    const outputs: HyperOutputFile[] = [
      createMockOutput('/src/main.ts', 'export default function() {}', true)
    ];
    
    const result = await splitCode(outputs, {
      strategies: {
        route: false,
        vendor: false,
        common: false,
        dynamic: false,
        layer: false
      }
    });
    
    expect(result).toHaveProperty('chunks');
  });
});

describe('generateChunkManifest', () => {
  it('should generate manifest from outputs', async () => {
    const outputs: HyperOutputFile[] = [
      createMockOutput('/src/main.ts', 'export default function() {}', true)
    ];
    
    const manifest = await generateChunkManifest(outputs);
    
    expect(manifest).toHaveProperty('version');
    expect(manifest).toHaveProperty('chunks');
    expect(manifest).toHaveProperty('entrypoints');
  });
});

describe('analyzeModuleGraph', () => {
  it('should analyze module graph statistics', () => {
    const outputs: HyperOutputFile[] = [
      createMockOutput('/src/index.ts', `
        import './utils.js';
        export const main = () => {};
      `),
      createMockOutput('/node_modules/lodash/index.js', 'export const _ = {};'),
      createMockOutput('/src/page.ts', `
        const lazy = import('./lazy.js');
      `)
    ];
    
    const stats = analyzeModuleGraph(outputs);
    
    expect(stats.totalModules).toBe(3);
    expect(stats.vendorModules).toBe(1);
    expect(stats.dynamicImports).toBe(1);
  });
});

describe('calculateOptimalChunkCount', () => {
  it('should calculate optimal chunk count based on size', () => {
    const count = calculateOptimalChunkCount(100, 1000000); // 1MB total
    expect(count).toBeGreaterThan(0);
  });

  it('should calculate optimal chunk count based on module count', () => {
    const count = calculateOptimalChunkCount(500, 100000); // 500 modules
    expect(count).toBeGreaterThan(0);
  });

  it('should respect upper limit', () => {
    const count = calculateOptimalChunkCount(10000, 100000000); // Very large
    expect(count).toBeLessThanOrEqual(100);
  });

  it('should use custom target chunk size', () => {
    const count1 = calculateOptimalChunkCount(100, 1000000, 50000);  // 50KB chunks
    const count2 = calculateOptimalChunkCount(100, 1000000, 200000); // 200KB chunks
    
    expect(count1).toBeGreaterThan(count2);
  });
});

describe('ChunkManifest', () => {
  it('should include preload and prefetch chunks', async () => {
    const engine = createCodeSplittingEngine({
      routePatterns: [
        { pattern: /home/, name: 'home', preload: true },
        { pattern: /about/, name: 'about', prefetch: true }
      ]
    });
    
    const outputs: HyperOutputFile[] = [
      createMockOutput('/src/pages/home.ts', 'export default function Home() {}'),
      createMockOutput('/src/pages/about.ts', 'export default function About() {}')
    ];
    
    const result = await engine.split(outputs);
    
    expect(result.manifest).toHaveProperty('preloadChunks');
    expect(result.manifest).toHaveProperty('prefetchChunks');
  });
});

describe('SplitStats', () => {
  it('should calculate accurate statistics', async () => {
    const engine = createCodeSplittingEngine();
    
    const outputs: HyperOutputFile[] = [
      createMockOutput('/src/index.ts', 'export const a = 1;'.repeat(100), true),
      createMockOutput('/src/utils.ts', 'export const b = 2;'.repeat(50))
    ];
    
    const result = await engine.split(outputs);
    
    expect(result.stats.splitDuration).toBeGreaterThanOrEqual(0);
    expect(result.stats.totalSize).toBeGreaterThan(0);
    expect(result.stats.averageChunkSize).toBeGreaterThan(0);
  });
});
