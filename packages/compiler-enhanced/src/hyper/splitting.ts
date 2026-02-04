/**
 * HyperCompiler - Advanced Code Splitting Engine
 * 
 * Provides intelligent code splitting strategies for optimal bundle sizes:
 * - Route-based splitting for micro-frontends
 * - Vendor bundle separation with heuristics
 * - Common chunk extraction using dependency analysis
 * - Dynamic import detection and handling
 * - Layer-based splitting (UI/data/logic separation)
 * - Tree-shakable ESM exports
 * - Cross-package optimization for monorepos
 * 
 * @module hyper/splitting
 */

import { createHash } from 'crypto';
import { EventEmitter } from 'events';
import type {
  CodeSplittingConfig,
  ChunkInfo,
  ModuleInfo,
  HyperOutputFile
} from './types.js';

// ============================================================================
// TYPES
// ============================================================================

export interface SplittingOptions extends CodeSplittingConfig {
  /** Base directory for module resolution */
  baseDir?: string;
  /** Custom chunk naming function */
  chunkNamer?: (modules: ModuleInfo[]) => string;
  /** External modules that should not be bundled */
  externals?: string[];
  /** Vendor detection patterns */
  vendorPatterns?: RegExp[];
  /** Route patterns for route-based splitting */
  routePatterns?: RoutePattern[];
}

export interface RoutePattern {
  pattern: string | RegExp;
  name: string;
  priority?: number;
  preload?: boolean;
  prefetch?: boolean;
}

export interface SplitResult {
  chunks: ChunkInfo[];
  manifest: ChunkManifest;
  moduleMap: Map<string, string>;  // moduleId -> chunkId
  stats: SplitStats;
}

export interface ChunkManifest {
  version: string;
  chunks: Record<string, ChunkManifestEntry>;
  entrypoints: Record<string, string[]>;
  asyncChunks: Record<string, string[]>;
  preloadChunks: string[];
  prefetchChunks: string[];
}

export interface ChunkManifestEntry {
  id: string;
  name: string;
  files: string[];
  size: number;
  contentHash: string;
  isEntry: boolean;
  isInitial: boolean;
  parents: string[];
  children: string[];
}

export interface SplitStats {
  totalModules: number;
  totalChunks: number;
  totalSize: number;
  largestChunk: { id: string; size: number };
  smallestChunk: { id: string; size: number };
  averageChunkSize: number;
  duplicatedModules: number;
  treeShakenBytes: number;
  splitDuration: number;
}

export interface ModuleGraph {
  modules: Map<string, ModuleNode>;
  entryPoints: Set<string>;
  dynamicImports: Map<string, Set<string>>;
}

export interface ModuleNode {
  id: string;
  name: string;
  path: string;
  size: number;
  content?: string;
  dependencies: Set<string>;
  dependents: Set<string>;
  exports: ExportInfo;
  sideEffects: boolean;
  isEntry: boolean;
  isDynamic: boolean;
  layer?: 'ui' | 'data' | 'logic' | 'shared';
  vendor?: string;
}

export interface ExportInfo {
  named: string[];
  default: boolean;
  namespace: boolean;
  usedBy: Map<string, Set<string>>;  // dependentId -> usedExports
}

export interface ChunkGroup {
  id: string;
  name: string;
  chunks: Set<string>;
  parents: Set<string>;
  children: Set<string>;
  isEntry: boolean;
}

// ============================================================================
// DEFAULT CONFIGURATION
// ============================================================================

const DEFAULT_OPTIONS: Partial<SplittingOptions> = {
  enabled: true,
  strategies: {
    route: true,
    vendor: true,
    common: true,
    dynamic: true,
    layer: false
  },
  optimization: {
    minSize: 20000,      // 20KB min
    maxSize: 244000,     // ~244KB max (before gzip)
    minChunks: 1,
    maxAsyncRequests: 30,
    maxInitialRequests: 30,
    automaticNameDelimiter: '~'
  },
  treeShaking: {
    enabled: true,
    sideEffects: true,
    usedExports: true,
    innerGraph: true,
    mangleExports: false
  },
  caching: {
    contentHash: true,
    runtimeChunk: 'single',
    moduleIds: 'deterministic',
    chunkIds: 'deterministic'
  },
  vendorPatterns: [
    /[\\/]node_modules[\\/]/,
    /[\\/]vendor[\\/]/
  ],
  externals: []
};

// ============================================================================
// CODE SPLITTING ENGINE
// ============================================================================

export class CodeSplittingEngine extends EventEmitter {
  private options: SplittingOptions;
  private moduleGraph: ModuleGraph;
  private chunkGroups: Map<string, ChunkGroup>;
  private moduleToChunk: Map<string, string>;
  private usedExports: Map<string, Set<string>>;
  
  constructor(options: Partial<SplittingOptions> = {}) {
    super();
    this.options = { ...DEFAULT_OPTIONS, ...options } as SplittingOptions;
    this.moduleGraph = {
      modules: new Map(),
      entryPoints: new Set(),
      dynamicImports: new Map()
    };
    this.chunkGroups = new Map();
    this.moduleToChunk = new Map();
    this.usedExports = new Map();
  }
  
  /**
   * Main entry point - split modules into optimized chunks
   */
  async split(outputs: HyperOutputFile[]): Promise<SplitResult> {
    const startTime = performance.now();
    
    this.emit('split:start', { moduleCount: outputs.length });
    
    // Phase 1: Build module graph
    this.emit('phase:start', { phase: 'buildGraph' });
    await this.buildModuleGraph(outputs);
    this.emit('phase:end', { phase: 'buildGraph', moduleCount: this.moduleGraph.modules.size });
    
    // Phase 2: Analyze usage and tree-shake
    if (this.options.treeShaking.enabled) {
      this.emit('phase:start', { phase: 'treeShake' });
      await this.analyzeUsage();
      this.emit('phase:end', { phase: 'treeShake' });
    }
    
    // Phase 3: Apply splitting strategies
    this.emit('phase:start', { phase: 'split' });
    
    // Apply strategies in order of priority
    if (this.options.strategies.route) {
      await this.applyRouteSplitting();
    }
    
    if (this.options.strategies.vendor) {
      await this.applyVendorSplitting();
    }
    
    if (this.options.strategies.common) {
      await this.applyCommonChunkExtraction();
    }
    
    if (this.options.strategies.dynamic) {
      await this.applyDynamicImportSplitting();
    }
    
    if (this.options.strategies.layer) {
      await this.applyLayerSplitting();
    }
    
    this.emit('phase:end', { phase: 'split' });
    
    // Phase 4: Optimize chunk sizes
    this.emit('phase:start', { phase: 'optimize' });
    await this.optimizeChunkSizes();
    this.emit('phase:end', { phase: 'optimize' });
    
    // Phase 5: Generate final chunks
    this.emit('phase:start', { phase: 'generate' });
    const chunks = await this.generateChunks();
    const manifest = this.generateManifest(chunks);
    this.emit('phase:end', { phase: 'generate' });
    
    const duration = performance.now() - startTime;
    const stats = this.calculateStats(chunks, duration);
    
    this.emit('split:end', { stats });
    
    return {
      chunks,
      manifest,
      moduleMap: new Map(this.moduleToChunk),
      stats
    };
  }
  
  // ==========================================================================
  // PHASE 1: BUILD MODULE GRAPH
  // ==========================================================================
  
  private async buildModuleGraph(outputs: HyperOutputFile[]): Promise<void> {
    for (const output of outputs) {
      const moduleId = this.getModuleId(output.path);
      const content = output.content.toString();
      
      // Detect if this is an entry point
      const isEntry = output.isEntry ?? false;
      
      // Detect if this module has side effects
      const sideEffects = this.detectSideEffects(content);
      
      // Extract dependencies
      const { static: staticDeps, dynamic: dynamicDeps } = this.extractDependencies(content);
      
      // Extract exports
      const exports = this.extractExports(content);
      
      // Detect layer
      const layer = this.detectLayer(output.path, content);
      
      // Detect vendor
      const vendor = this.detectVendor(output.path);
      
      const node: ModuleNode = {
        id: moduleId,
        name: this.getModuleName(output.path),
        path: output.path,
        size: output.size,
        content,
        dependencies: new Set(staticDeps),
        dependents: new Set(),
        exports,
        sideEffects,
        isEntry,
        isDynamic: false,
        layer,
        vendor
      };
      
      this.moduleGraph.modules.set(moduleId, node);
      
      if (isEntry) {
        this.moduleGraph.entryPoints.add(moduleId);
      }
      
      if (dynamicDeps.length > 0) {
        this.moduleGraph.dynamicImports.set(moduleId, new Set(dynamicDeps));
      }
    }
    
    // Build reverse dependency graph
    for (const [id, node] of this.moduleGraph.modules) {
      for (const dep of node.dependencies) {
        const depNode = this.moduleGraph.modules.get(dep);
        if (depNode) {
          depNode.dependents.add(id);
        }
      }
      
      // Mark dynamic import targets
      const dynamicImports = this.moduleGraph.dynamicImports.get(id);
      if (dynamicImports) {
        for (const target of dynamicImports) {
          const targetNode = this.moduleGraph.modules.get(target);
          if (targetNode) {
            targetNode.isDynamic = true;
          }
        }
      }
    }
  }
  
  private getModuleId(path: string): string {
    // Normalize path to consistent module ID
    return path.replace(/\\/g, '/').replace(/\.(ts|tsx|js|jsx|mjs|cjs)$/, '');
  }
  
  private getModuleName(path: string): string {
    const normalized = path.replace(/\\/g, '/');
    const parts = normalized.split('/');
    return parts[parts.length - 1].replace(/\.(ts|tsx|js|jsx|mjs|cjs)$/, '');
  }
  
  private detectSideEffects(content: string): boolean {
    // Check for common side effect patterns
    const sideEffectPatterns = [
      /^\s*import\s+['"][^'"]+['"];?\s*$/m,  // Side-effect imports
      /\bwindow\./,
      /\bdocument\./,
      /\bglobalThis\./,
      /\bconsole\./,
      /\bfetch\(/,
      /\baddEventListener\(/,
      /\bsetTimeout\(/,
      /\bsetInterval\(/,
      /\brequire\s*\([^)]+\)\s*;?\s*$/m
    ];
    
    return sideEffectPatterns.some(pattern => pattern.test(content));
  }
  
  private extractDependencies(content: string): { static: string[]; dynamic: string[] } {
    const staticDeps: string[] = [];
    const dynamicDeps: string[] = [];
    
    // Static imports: import x from 'y'
    const staticImportRegex = /import\s+(?:(?:\{[^}]*\}|\*\s+as\s+\w+|\w+)\s+from\s+)?['"]([^'"]+)['"]/g;
    let match;
    while ((match = staticImportRegex.exec(content)) !== null) {
      staticDeps.push(this.resolveModuleId(match[1]));
    }
    
    // Dynamic imports: import('x')
    const dynamicImportRegex = /import\s*\(\s*['"]([^'"]+)['"]\s*\)/g;
    while ((match = dynamicImportRegex.exec(content)) !== null) {
      dynamicDeps.push(this.resolveModuleId(match[1]));
    }
    
    // require() calls
    const requireRegex = /require\s*\(\s*['"]([^'"]+)['"]\s*\)/g;
    while ((match = requireRegex.exec(content)) !== null) {
      staticDeps.push(this.resolveModuleId(match[1]));
    }
    
    return { static: staticDeps, dynamic: dynamicDeps };
  }
  
  private resolveModuleId(specifier: string): string {
    // Simple resolution - in practice would use Node resolution
    if (specifier.startsWith('.') || specifier.startsWith('/')) {
      return specifier.replace(/\.(ts|tsx|js|jsx|mjs|cjs)$/, '');
    }
    // Bare specifiers (packages)
    return `node_modules/${specifier}`;
  }
  
  private extractExports(content: string): ExportInfo {
    const exports: ExportInfo = {
      named: [],
      default: false,
      namespace: false,
      usedBy: new Map()
    };
    
    // Named exports: export { x, y }
    const namedExportRegex = /export\s+\{([^}]+)\}/g;
    let match;
    while ((match = namedExportRegex.exec(content)) !== null) {
      const names = match[1].split(',').map(n => {
        const parts = n.trim().split(/\s+as\s+/);
        return parts[parts.length - 1].trim();
      });
      exports.named.push(...names);
    }
    
    // Direct named exports: export const/let/function/class
    const directExportRegex = /export\s+(?:const|let|var|function|class|async\s+function)\s+(\w+)/g;
    while ((match = directExportRegex.exec(content)) !== null) {
      exports.named.push(match[1]);
    }
    
    // Default export
    if (/export\s+default\b/.test(content)) {
      exports.default = true;
    }
    
    // Namespace export: export * from
    if (/export\s+\*\s+from/.test(content)) {
      exports.namespace = true;
    }
    
    return exports;
  }
  
  private detectLayer(path: string, _content: string): ModuleNode['layer'] {
    const normalizedPath = path.toLowerCase().replace(/\\/g, '/');
    
    if (/\/(component|ui|view|page|layout)s?\//.test(normalizedPath) ||
        /\.(tsx|jsx)$/.test(normalizedPath)) {
      return 'ui';
    }
    
    if (/\/(store|redux|state|data|model)s?\//.test(normalizedPath)) {
      return 'data';
    }
    
    if (/\/(util|helper|lib|logic|service)s?\//.test(normalizedPath)) {
      return 'logic';
    }
    
    if (/\/(shared|common|core)\//.test(normalizedPath)) {
      return 'shared';
    }
    
    return undefined;
  }
  
  private detectVendor(path: string): string | undefined {
    const patterns = this.options.vendorPatterns ?? [];
    for (const pattern of patterns) {
      if (pattern.test(path)) {
        // Extract package name
        const match = path.match(/node_modules[\\/](@[^\\/]+[\\/][^\\/]+|[^\\/]+)/);
        if (match) {
          return match[1].replace(/\\/g, '/');
        }
        return 'vendor';
      }
    }
    return undefined;
  }
  
  // ==========================================================================
  // PHASE 2: USAGE ANALYSIS & TREE SHAKING
  // ==========================================================================
  
  private async analyzeUsage(): Promise<void> {
    // Track which exports are actually used
    for (const [moduleId, node] of this.moduleGraph.modules) {
      if (!node.content) continue;
      
      // Analyze import statements to track used exports
      const importRegex = /import\s+(?:(\w+)\s*,?\s*)?(?:\{([^}]+)\})?\s+from\s+['"]([^'"]+)['"]/g;
      let match;
      
      while ((match = importRegex.exec(node.content)) !== null) {
        const defaultImport = match[1];
        const namedImports = match[2];
        const source = this.resolveModuleId(match[3]);
        
        if (!this.usedExports.has(source)) {
          this.usedExports.set(source, new Set());
        }
        
        const used = this.usedExports.get(source)!;
        
        if (defaultImport) {
          used.add('default');
        }
        
        if (namedImports) {
          namedImports.split(',').forEach(name => {
            const parts = name.trim().split(/\s+as\s+/);
            used.add(parts[0].trim());
          });
        }
        
        // Update the source module's export info
        const sourceModule = this.moduleGraph.modules.get(source);
        if (sourceModule) {
          if (!sourceModule.exports.usedBy.has(moduleId)) {
            sourceModule.exports.usedBy.set(moduleId, new Set());
          }
          const usedByThisModule = sourceModule.exports.usedBy.get(moduleId)!;
          used.forEach(exp => usedByThisModule.add(exp));
        }
      }
    }
    
    // Mark unused modules for removal (if not entry point and no dependents using it)
    if (this.options.treeShaking.usedExports) {
      for (const [moduleId, node] of this.moduleGraph.modules) {
        if (node.isEntry) continue;
        if (node.sideEffects && this.options.treeShaking.sideEffects) continue;
        
        const usedExports = this.usedExports.get(moduleId);
        if (!usedExports || usedExports.size === 0) {
          // Module is not used - mark for elimination
          node.size = 0;  // Will be excluded from chunks
        }
      }
    }
  }
  
  // ==========================================================================
  // PHASE 3: SPLITTING STRATEGIES
  // ==========================================================================
  
  /**
   * Route-based splitting - creates chunks per route/page
   */
  private async applyRouteSplitting(): Promise<void> {
    const routePatterns = this.options.routePatterns ?? this.detectRoutePatterns();
    
    for (const pattern of routePatterns) {
      const regex = typeof pattern.pattern === 'string' 
        ? new RegExp(pattern.pattern) 
        : pattern.pattern;
      
      const matchingModules = new Set<string>();
      
      for (const [moduleId, node] of this.moduleGraph.modules) {
        if (regex.test(node.path) || regex.test(node.name)) {
          matchingModules.add(moduleId);
          
          // Include module's dependencies that are only used by this route
          this.collectRouteExclusiveDeps(moduleId, matchingModules);
        }
      }
      
      if (matchingModules.size > 0) {
        const chunkId = `route-${pattern.name}`;
        this.createChunkGroup(chunkId, pattern.name, matchingModules, false);
      }
    }
  }
  
  private detectRoutePatterns(): RoutePattern[] {
    const patterns: RoutePattern[] = [];
    const routeIndicators = ['/pages/', '/routes/', '/views/', '/screens/'];
    
    for (const [_, node] of this.moduleGraph.modules) {
      for (const indicator of routeIndicators) {
        if (node.path.includes(indicator)) {
          // Extract route name from path
          const parts = node.path.split(indicator)[1]?.split(/[\\/]/);
          if (parts && parts.length > 0) {
            const routeName = parts[0].replace(/\.(tsx?|jsx?)$/, '');
            if (routeName && !patterns.some(p => p.name === routeName)) {
              patterns.push({
                pattern: new RegExp(`${indicator}${routeName}`),
                name: routeName,
                priority: 0
              });
            }
          }
        }
      }
    }
    
    return patterns;
  }
  
  private collectRouteExclusiveDeps(moduleId: string, collected: Set<string>): void {
    const node = this.moduleGraph.modules.get(moduleId);
    if (!node) return;
    
    for (const depId of node.dependencies) {
      if (collected.has(depId)) continue;
      
      const depNode = this.moduleGraph.modules.get(depId);
      if (!depNode) continue;
      
      // Only include if all dependents are already in this route
      const allDependentsInRoute = [...depNode.dependents].every(d => collected.has(d));
      if (allDependentsInRoute && !depNode.vendor) {
        collected.add(depId);
        this.collectRouteExclusiveDeps(depId, collected);
      }
    }
  }
  
  /**
   * Vendor splitting - separates third-party modules
   */
  private async applyVendorSplitting(): Promise<void> {
    const vendorModules = new Map<string, Set<string>>();
    
    for (const [moduleId, node] of this.moduleGraph.modules) {
      if (node.vendor) {
        if (!vendorModules.has(node.vendor)) {
          vendorModules.set(node.vendor, new Set());
        }
        vendorModules.get(node.vendor)!.add(moduleId);
      }
    }
    
    // Group small vendor packages together
    const { minSize } = this.options.optimization;
    const smallVendors = new Set<string>();
    let smallVendorSize = 0;
    
    for (const [vendorName, modules] of vendorModules) {
      const totalSize = this.calculateModulesSize(modules);
      
      if (totalSize >= minSize) {
        // Large enough for its own chunk
        this.createChunkGroup(`vendor-${this.sanitizeName(vendorName)}`, vendorName, modules, false);
      } else {
        // Collect small vendors
        for (const m of modules) {
          smallVendors.add(m);
        }
        smallVendorSize += totalSize;
      }
    }
    
    // Create combined chunk for small vendors
    if (smallVendors.size > 0) {
      this.createChunkGroup('vendor-common', 'vendor-common', smallVendors, false);
    }
  }
  
  private sanitizeName(name: string): string {
    return name.replace(/[^a-zA-Z0-9_-]/g, '-').replace(/-+/g, '-');
  }
  
  /**
   * Common chunk extraction - modules used by multiple entry points
   */
  private async applyCommonChunkExtraction(): Promise<void> {
    const { minChunks } = this.options.optimization;
    const moduleUsageCount = new Map<string, Set<string>>();
    
    // Count how many entry points use each module
    for (const entryId of this.moduleGraph.entryPoints) {
      const reachable = this.getReachableModules(entryId);
      for (const moduleId of reachable) {
        if (!moduleUsageCount.has(moduleId)) {
          moduleUsageCount.set(moduleId, new Set());
        }
        moduleUsageCount.get(moduleId)!.add(entryId);
      }
    }
    
    // Collect modules used by multiple entries
    const commonModules = new Set<string>();
    for (const [moduleId, entries] of moduleUsageCount) {
      const node = this.moduleGraph.modules.get(moduleId);
      if (!node) continue;
      
      // Skip if already assigned or is vendor
      if (this.moduleToChunk.has(moduleId) || node.vendor) continue;
      
      if (entries.size >= minChunks) {
        commonModules.add(moduleId);
      }
    }
    
    if (commonModules.size > 0) {
      this.createChunkGroup('common', 'common', commonModules, true);
    }
  }
  
  private getReachableModules(startId: string, visited = new Set<string>()): Set<string> {
    if (visited.has(startId)) return visited;
    visited.add(startId);
    
    const node = this.moduleGraph.modules.get(startId);
    if (!node) return visited;
    
    for (const depId of node.dependencies) {
      this.getReachableModules(depId, visited);
    }
    
    return visited;
  }
  
  /**
   * Dynamic import splitting - lazy-loaded modules
   */
  private async applyDynamicImportSplitting(): Promise<void> {
    for (const [importerId, targets] of this.moduleGraph.dynamicImports) {
      for (const targetId of targets) {
        const targetNode = this.moduleGraph.modules.get(targetId);
        if (!targetNode) continue;
        
        // Skip if already in a chunk
        if (this.moduleToChunk.has(targetId)) continue;
        
        // Create async chunk for dynamic import
        const chunkName = `async-${this.sanitizeName(targetNode.name)}`;
        const modules = new Set<string>([targetId]);
        
        // Include dependencies exclusive to this dynamic import
        this.collectExclusiveDeps(targetId, modules);
        
        this.createChunkGroup(chunkName, chunkName, modules, false);
        
        // Mark parent relationship
        const importerChunk = this.moduleToChunk.get(importerId);
        if (importerChunk) {
          const importerGroup = this.chunkGroups.get(importerChunk);
          const targetGroup = this.chunkGroups.get(chunkName);
          if (importerGroup && targetGroup) {
            importerGroup.children.add(chunkName);
            targetGroup.parents.add(importerChunk);
          }
        }
      }
    }
  }
  
  private collectExclusiveDeps(moduleId: string, collected: Set<string>): void {
    const node = this.moduleGraph.modules.get(moduleId);
    if (!node) return;
    
    for (const depId of node.dependencies) {
      if (collected.has(depId)) continue;
      if (this.moduleToChunk.has(depId)) continue;
      
      const depNode = this.moduleGraph.modules.get(depId);
      if (!depNode || depNode.vendor) continue;
      
      // Only include if this is the only dependent
      if (depNode.dependents.size === 1) {
        collected.add(depId);
        this.collectExclusiveDeps(depId, collected);
      }
    }
  }
  
  /**
   * Layer-based splitting - UI/data/logic separation
   */
  private async applyLayerSplitting(): Promise<void> {
    const layers: Record<string, Set<string>> = {
      ui: new Set(),
      data: new Set(),
      logic: new Set(),
      shared: new Set()
    };
    
    for (const [moduleId, node] of this.moduleGraph.modules) {
      if (this.moduleToChunk.has(moduleId)) continue;
      if (node.vendor) continue;
      
      if (node.layer && layers[node.layer]) {
        layers[node.layer].add(moduleId);
      }
    }
    
    for (const [layer, modules] of Object.entries(layers)) {
      if (modules.size > 0) {
        this.createChunkGroup(`layer-${layer}`, layer, modules, layer === 'shared');
      }
    }
  }
  
  // ==========================================================================
  // PHASE 4: CHUNK SIZE OPTIMIZATION
  // ==========================================================================
  
  private async optimizeChunkSizes(): Promise<void> {
    const { minSize, maxSize } = this.options.optimization;
    
    // Split oversized chunks
    for (const [chunkId, group] of this.chunkGroups) {
      const size = this.calculateChunkSize(group);
      
      if (size > maxSize) {
        await this.splitOversizedChunk(chunkId, group, maxSize);
      }
    }
    
    // Merge undersized chunks
    const undersizedChunks: string[] = [];
    for (const [chunkId, group] of this.chunkGroups) {
      const size = this.calculateChunkSize(group);
      if (size < minSize && !group.isEntry) {
        undersizedChunks.push(chunkId);
      }
    }
    
    await this.mergeUndersizedChunks(undersizedChunks, minSize, maxSize);
  }
  
  private calculateChunkSize(group: ChunkGroup): number {
    let size = 0;
    for (const moduleId of group.chunks) {
      const node = this.moduleGraph.modules.get(moduleId);
      if (node) {
        size += node.size;
      }
    }
    return size;
  }
  
  private async splitOversizedChunk(
    chunkId: string,
    group: ChunkGroup,
    maxSize: number
  ): Promise<void> {
    const modules = [...group.chunks];
    const moduleSizes = modules.map(id => ({
      id,
      size: this.moduleGraph.modules.get(id)?.size ?? 0
    }));
    
    // Sort by size descending
    moduleSizes.sort((a, b) => b.size - a.size);
    
    // Bin-packing to create sub-chunks
    const subChunks: Set<string>[] = [new Set()];
    const subChunkSizes: number[] = [0];
    
    for (const { id, size } of moduleSizes) {
      // Find a chunk with room
      let placed = false;
      for (let i = 0; i < subChunks.length; i++) {
        if (subChunkSizes[i] + size <= maxSize) {
          subChunks[i].add(id);
          subChunkSizes[i] += size;
          placed = true;
          break;
        }
      }
      
      if (!placed) {
        // Create new sub-chunk
        const newChunk = new Set<string>([id]);
        subChunks.push(newChunk);
        subChunkSizes.push(size);
      }
    }
    
    // Replace original chunk with sub-chunks
    if (subChunks.length > 1) {
      this.chunkGroups.delete(chunkId);
      
      for (let i = 0; i < subChunks.length; i++) {
        const subChunkId = `${chunkId}-${i}`;
        this.createChunkGroup(subChunkId, `${group.name}-${i}`, subChunks[i], group.isEntry && i === 0);
      }
    }
  }
  
  private async mergeUndersizedChunks(
    undersizedIds: string[],
    minSize: number,
    maxSize: number
  ): Promise<void> {
    if (undersizedIds.length < 2) return;
    
    // Group chunks that can be merged based on common parents
    const merged = new Set<string>();
    
    for (const chunkId of undersizedIds) {
      if (merged.has(chunkId)) continue;
      
      const group = this.chunkGroups.get(chunkId);
      if (!group) continue;
      
      let currentSize = this.calculateChunkSize(group);
      const toMerge: string[] = [chunkId];
      
      // Find compatible chunks to merge with
      for (const otherId of undersizedIds) {
        if (otherId === chunkId || merged.has(otherId)) continue;
        
        const otherGroup = this.chunkGroups.get(otherId);
        if (!otherGroup) continue;
        
        const otherSize = this.calculateChunkSize(otherGroup);
        
        // Check if merge would be beneficial
        if (currentSize + otherSize <= maxSize) {
          // Check compatibility (same parents)
          const sameParents = this.setsEqual(group.parents, otherGroup.parents);
          if (sameParents || group.parents.size === 0 || otherGroup.parents.size === 0) {
            toMerge.push(otherId);
            currentSize += otherSize;
            
            if (currentSize >= minSize) break;
          }
        }
      }
      
      // Perform merge
      if (toMerge.length > 1) {
        const mergedModules = new Set<string>();
        for (const id of toMerge) {
          const g = this.chunkGroups.get(id);
          if (g) {
            for (const m of g.chunks) {
              mergedModules.add(m);
            }
          }
          this.chunkGroups.delete(id);
          merged.add(id);
        }
        
        const mergedId = `merged-${toMerge[0]}`;
        this.createChunkGroup(mergedId, mergedId, mergedModules, false);
      }
    }
  }
  
  private setsEqual(a: Set<string>, b: Set<string>): boolean {
    if (a.size !== b.size) return false;
    for (const item of a) {
      if (!b.has(item)) return false;
    }
    return true;
  }
  
  // ==========================================================================
  // PHASE 5: CHUNK GENERATION
  // ==========================================================================
  
  private async generateChunks(): Promise<ChunkInfo[]> {
    const chunks: ChunkInfo[] = [];
    
    // Assign remaining unassigned modules to main chunk
    this.assignRemainingModules();
    
    for (const [chunkId, group] of this.chunkGroups) {
      const modules = this.getChunkModules(group);
      const size = modules.reduce((sum, m) => sum + m.size, 0);
      const contentHash = this.calculateContentHash(modules);
      
      const chunk: ChunkInfo = {
        id: chunkId,
        name: group.name,
        files: [`${group.name}.${contentHash.slice(0, 8)}.js`],
        size,
        modules,
        parents: [...group.parents],
        children: [...group.children],
        isEntry: group.isEntry,
        isInitial: group.isEntry || group.parents.size === 0,
        contentHash
      };
      
      chunks.push(chunk);
    }
    
    // Sort: entries first, then by size
    chunks.sort((a, b) => {
      if (a.isEntry && !b.isEntry) return -1;
      if (!a.isEntry && b.isEntry) return 1;
      return b.size - a.size;
    });
    
    return chunks;
  }
  
  private assignRemainingModules(): void {
    const unassigned = new Set<string>();
    
    for (const moduleId of this.moduleGraph.modules.keys()) {
      if (!this.moduleToChunk.has(moduleId)) {
        unassigned.add(moduleId);
      }
    }
    
    if (unassigned.size > 0) {
      // Create main chunk for remaining modules
      this.createChunkGroup('main', 'main', unassigned, true);
    }
  }
  
  private getChunkModules(group: ChunkGroup): ModuleInfo[] {
    const modules: ModuleInfo[] = [];
    
    for (const moduleId of group.chunks) {
      const node = this.moduleGraph.modules.get(moduleId);
      if (!node || node.size === 0) continue;  // Skip tree-shaken modules
      
      const usedExports = this.usedExports.get(moduleId);
      
      modules.push({
        id: moduleId,
        name: node.name,
        size: node.size,
        chunks: [group.id],
        issuer: node.dependents.size > 0 ? [...node.dependents][0] : undefined,
        reasons: [...node.dependents],
        usedExports: usedExports ? [...usedExports] : node.exports.named,
        providedExports: [
          ...node.exports.named,
          ...(node.exports.default ? ['default'] : [])
        ]
      });
    }
    
    return modules;
  }
  
  private calculateContentHash(modules: ModuleInfo[]): string {
    const hash = createHash('sha256');
    
    for (const module of modules.sort((a, b) => a.id.localeCompare(b.id))) {
      hash.update(module.id);
      hash.update(module.size.toString());
    }
    
    return hash.digest('hex');
  }
  
  private generateManifest(chunks: ChunkInfo[]): ChunkManifest {
    const manifest: ChunkManifest = {
      version: '1.0.0',
      chunks: {},
      entrypoints: {},
      asyncChunks: {},
      preloadChunks: [],
      prefetchChunks: []
    };
    
    for (const chunk of chunks) {
      manifest.chunks[chunk.id] = {
        id: chunk.id,
        name: chunk.name,
        files: chunk.files,
        size: chunk.size,
        contentHash: chunk.contentHash,
        isEntry: chunk.isEntry,
        isInitial: chunk.isInitial,
        parents: chunk.parents,
        children: chunk.children
      };
      
      if (chunk.isEntry) {
        // Collect all initial chunks for this entry
        const initialChunks = this.collectInitialChunks(chunk.id, chunks);
        manifest.entrypoints[chunk.id] = initialChunks.flatMap(c => c.files);
      }
      
      if (chunk.children.length > 0) {
        manifest.asyncChunks[chunk.id] = chunk.children.flatMap(childId => {
          const child = chunks.find(c => c.id === childId);
          return child?.files ?? [];
        });
      }
    }
    
    // Identify preload/prefetch candidates
    for (const pattern of this.options.routePatterns ?? []) {
      const chunkId = `route-${pattern.name}`;
      const chunk = chunks.find(c => c.id === chunkId);
      if (chunk) {
        if (pattern.preload) {
          manifest.preloadChunks.push(...chunk.files);
        }
        if (pattern.prefetch) {
          manifest.prefetchChunks.push(...chunk.files);
        }
      }
    }
    
    return manifest;
  }
  
  private collectInitialChunks(entryId: string, allChunks: ChunkInfo[]): ChunkInfo[] {
    const initial: ChunkInfo[] = [];
    const visited = new Set<string>();
    
    const collect = (chunkId: string) => {
      if (visited.has(chunkId)) return;
      visited.add(chunkId);
      
      const chunk = allChunks.find(c => c.id === chunkId);
      if (!chunk) return;
      
      if (chunk.isInitial) {
        initial.push(chunk);
      }
      
      for (const parentId of chunk.parents) {
        collect(parentId);
      }
    };
    
    collect(entryId);
    return initial;
  }
  
  // ==========================================================================
  // HELPERS
  // ==========================================================================
  
  private createChunkGroup(
    id: string,
    name: string,
    modules: Set<string>,
    isEntry: boolean
  ): void {
    const group: ChunkGroup = {
      id,
      name,
      chunks: new Set(modules),
      parents: new Set(),
      children: new Set(),
      isEntry
    };
    
    this.chunkGroups.set(id, group);
    
    for (const moduleId of modules) {
      this.moduleToChunk.set(moduleId, id);
    }
  }
  
  private calculateModulesSize(modules: Set<string>): number {
    let size = 0;
    for (const id of modules) {
      const node = this.moduleGraph.modules.get(id);
      if (node) size += node.size;
    }
    return size;
  }
  
  private calculateStats(chunks: ChunkInfo[], duration: number): SplitStats {
    const totalSize = chunks.reduce((sum, c) => sum + c.size, 0);
    const sizes = chunks.map(c => ({ id: c.id, size: c.size }));
    sizes.sort((a, b) => b.size - a.size);
    
    const duplicatedModules = this.countDuplicatedModules(chunks);
    const treeShakenBytes = this.calculateTreeShakenBytes();
    
    return {
      totalModules: this.moduleGraph.modules.size,
      totalChunks: chunks.length,
      totalSize,
      largestChunk: sizes[0] ?? { id: '', size: 0 },
      smallestChunk: sizes[sizes.length - 1] ?? { id: '', size: 0 },
      averageChunkSize: chunks.length > 0 ? totalSize / chunks.length : 0,
      duplicatedModules,
      treeShakenBytes,
      splitDuration: duration
    };
  }
  
  private countDuplicatedModules(chunks: ChunkInfo[]): number {
    const seenModules = new Map<string, number>();
    let duplicates = 0;
    
    for (const chunk of chunks) {
      for (const module of chunk.modules) {
        const count = (seenModules.get(module.id) ?? 0) + 1;
        seenModules.set(module.id, count);
        if (count === 2) {
          duplicates++;
        }
      }
    }
    
    return duplicates;
  }
  
  private calculateTreeShakenBytes(): number {
    let bytes = 0;
    for (const node of this.moduleGraph.modules.values()) {
      if (node.size === 0 && node.content) {
        bytes += Buffer.byteLength(node.content, 'utf-8');
      }
    }
    return bytes;
  }
  
  /**
   * Get splitting statistics
   */
  getStats(): object {
    return {
      moduleCount: this.moduleGraph.modules.size,
      entryPoints: this.moduleGraph.entryPoints.size,
      dynamicImports: this.moduleGraph.dynamicImports.size,
      chunkGroups: this.chunkGroups.size,
      options: {
        strategies: this.options.strategies,
        optimization: this.options.optimization
      }
    };
  }
  
  /**
   * Reset internal state
   */
  reset(): void {
    this.moduleGraph = {
      modules: new Map(),
      entryPoints: new Set(),
      dynamicImports: new Map()
    };
    this.chunkGroups.clear();
    this.moduleToChunk.clear();
    this.usedExports.clear();
  }
}

// ============================================================================
// FACTORY FUNCTIONS
// ============================================================================

/**
 * Create a new code splitting engine instance
 */
export function createCodeSplittingEngine(
  options?: Partial<SplittingOptions>
): CodeSplittingEngine {
  return new CodeSplittingEngine(options);
}

/**
 * Split modules into optimized chunks (convenience function)
 */
export async function splitCode(
  outputs: HyperOutputFile[],
  options?: Partial<SplittingOptions>
): Promise<SplitResult> {
  const engine = createCodeSplittingEngine(options);
  return engine.split(outputs);
}

/**
 * Generate a chunk manifest from outputs
 */
export async function generateChunkManifest(
  outputs: HyperOutputFile[],
  options?: Partial<SplittingOptions>
): Promise<ChunkManifest> {
  const result = await splitCode(outputs, options);
  return result.manifest;
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Analyze module graph and return statistics
 */
export function analyzeModuleGraph(
  outputs: HyperOutputFile[]
): { 
  totalModules: number;
  totalSize: number;
  vendorModules: number;
  dynamicImports: number;
} {
  let vendorModules = 0;
  let dynamicImports = 0;
  let totalSize = 0;
  
  const vendorPattern = /[\\/]node_modules[\\/]/;
  const dynamicPattern = /import\s*\(\s*['"]/;
  
  for (const output of outputs) {
    totalSize += output.size;
    
    if (vendorPattern.test(output.path)) {
      vendorModules++;
    }
    
    const content = output.content.toString();
    if (dynamicPattern.test(content)) {
      dynamicImports++;
    }
  }
  
  return {
    totalModules: outputs.length,
    totalSize,
    vendorModules,
    dynamicImports
  };
}

/**
 * Calculate optimal chunk count based on module graph
 */
export function calculateOptimalChunkCount(
  totalModules: number,
  totalSize: number,
  targetChunkSize = 100000  // 100KB
): number {
  const bySize = Math.ceil(totalSize / targetChunkSize);
  const byCount = Math.ceil(totalModules / 50);  // ~50 modules per chunk
  
  // Use the larger of the two estimates, capped at reasonable limits
  return Math.min(Math.max(bySize, byCount), 100);
}
