/**
 * Dead Code Elimination
 * Tree shake unused features from intents using mark and sweep algorithm
 */

import type { CompilerConfig, DCEResult, EnrichedIntent } from './types.js';

/**
 * Node in the dependency tree
 */
interface DependencyNode {
  id: string;
  exports: Set<string>;
  imports: Map<string, Set<string>>;
  features: Set<string>;
  isEntry: boolean;
}

/**
 * Dead code elimination engine
 */
export class DeadCodeEliminator {
  private config: CompilerConfig;
  private nodes: Map<string, DependencyNode> = new Map();
  private usedExports: Map<string, Set<string>> = new Map();

  constructor(config: CompilerConfig) {
    this.config = config;
  }

  /**
   * Register a module/intent for analysis
   */
  registerIntent(intentId: string, intent: EnrichedIntent, isEntry: boolean = false): void {
    const node: DependencyNode = {
      id: intentId,
      exports: new Set(),
      imports: new Map(),
      features: new Set(),
      isEntry
    };

    // Extract exports from intent features
    if (intent.features) {
      for (const feature of intent.features) {
        node.exports.add(feature);
      }
    }

    // Extract enriched features
    if (intent.enriched?.features) {
      for (const feature of intent.enriched.features) {
        node.exports.add(feature);
        node.features.add(feature);
      }
    }

    // Extract code patterns as exports
    if (intent.enriched?.code_patterns) {
      for (const pattern of intent.enriched.code_patterns) {
        node.exports.add(pattern);
      }
    }

    this.nodes.set(intentId, node);
  }

  /**
   * Register import relationship between intents
   */
  registerImport(fromIntent: string, toIntent: string, imports: string[]): void {
    const node = this.nodes.get(fromIntent);
    if (!node) {
      throw new Error(`Intent ${fromIntent} not registered`);
    }

    if (!node.imports.has(toIntent)) {
      node.imports.set(toIntent, new Set());
    }

    const importSet = node.imports.get(toIntent)!;
    for (const imp of imports) {
      importSet.add(imp);
    }
  }

  /**
   * Perform dead code elimination using mark and sweep
   */
  eliminate(): DCEResult {
    // Phase 1: Mark - Find all used exports
    this.markUsedExports();

    // Phase 2: Sweep - Remove unused exports
    const { bytesRemoved, unusedExports, usedExports } = this.sweepUnused();

    return {
      filesProcessed: this.nodes.size,
      bytesRemoved,
      unusedExports,
      usedExports
    };
  }

  /**
   * Mark phase - traverse from entry points and mark used exports
   */
  private markUsedExports(): void {
    const visited = new Set<string>();
    const queue: Array<{ intentId: string; exports: Set<string> }> = [];

    // Start with entry points
    for (const [id, node] of this.nodes) {
      if (node.isEntry) {
        queue.push({ intentId: id, exports: new Set(node.exports) });
        visited.add(id);
      }
    }

    // BFS traversal
    while (queue.length > 0) {
      const { intentId, exports } = queue.shift()!;
      const node = this.nodes.get(intentId);
      if (!node) continue;

      // Mark exports as used
      if (!this.usedExports.has(intentId)) {
        this.usedExports.set(intentId, new Set());
      }

      for (const exp of exports) {
        this.usedExports.get(intentId)!.add(exp);
      }

      // Follow imports
      for (const [importFrom, importedItems] of node.imports) {
        const importedNode = this.nodes.get(importFrom);
        if (!importedNode) continue;

        // Find which exports of the imported intent are used
        const usedImports = new Set<string>();
        for (const item of importedItems) {
          if (importedNode.exports.has(item)) {
            usedImports.add(item);
          }
        }

        if (usedImports.size > 0 && !visited.has(importFrom)) {
          visited.add(importFrom);
          queue.push({ intentId: importFrom, exports: usedImports });
        }
      }
    }
  }

  /**
   * Sweep phase - collect unused exports
   */
  private sweepUnused(): {
    bytesRemoved: number;
    unusedExports: string[];
    usedExports: string[];
  } {
    const unusedExports: string[] = [];
    const usedExports: string[] = [];
    let bytesRemoved = 0;

    for (const [id, node] of this.nodes) {
      const used = this.usedExports.get(id) || new Set();

      for (const exp of node.exports) {
        const fullyQualified = `${id}:${exp}`;
        if (used.has(exp)) {
          usedExports.push(fullyQualified);
        } else {
          unusedExports.push(fullyQualified);
          // Estimate bytes removed (rough approximation)
          bytesRemoved += this.estimateExportSize(exp);
        }
      }
    }

    return { bytesRemoved, unusedExports, usedExports };
  }

  /**
   * Estimate size of an export
   */
  private estimateExportSize(exportName: string): number {
    // Rough estimation based on export name length
    // In a real implementation, this would analyze the actual code
    return exportName.length * 100;
  }

  /**
   * Get unused exports for a specific intent
   */
  getUnusedExports(intentId: string): string[] {
    const node = this.nodes.get(intentId);
    if (!node) return [];

    const used = this.usedExports.get(intentId) || new Set();
    return Array.from(node.exports).filter(exp => !used.has(exp));
  }

  /**
   * Get used exports for a specific intent
   */
  getUsedExports(intentId: string): string[] {
    const used = this.usedExports.get(intentId);
    return used ? Array.from(used) : [];
  }

  /**
   * Check if an export is used
   */
  isUsed(intentId: string, exportName: string): boolean {
    const used = this.usedExports.get(intentId);
    return used ? used.has(exportName) : false;
  }

  /**
   * Get dependency graph visualization
   */
  getDependencyGraph(): object {
    const graph: Record<string, { exports: string[]; imports: Record<string, string[]>; used: string[] }> = {};

    for (const [id, node] of this.nodes) {
      const used = this.usedExports.get(id) || new Set();
      graph[id] = {
        exports: Array.from(node.exports),
        imports: Object.fromEntries(
          Array.from(node.imports.entries()).map(([k, v]) => [k, Array.from(v)])
        ),
        used: Array.from(used)
      };
    }

    return graph;
  }

  /**
   * Reset the eliminator state
   */
  reset(): void {
    this.nodes.clear();
    this.usedExports.clear();
  }

  /**
   * Get statistics
   */
  getStats(): {
    totalIntents: number;
    totalExports: number;
    usedExports: number;
    unusedExports: number;
  } {
    let totalExports = 0;
    let usedCount = 0;

    for (const [id, node] of this.nodes) {
      totalExports += node.exports.size;
      const used = this.usedExports.get(id);
      if (used) {
        usedCount += used.size;
      }
    }

    return {
      totalIntents: this.nodes.size,
      totalExports,
      usedExports: usedCount,
      unusedExports: totalExports - usedCount
    };
  }
}

/**
 * Create dead code eliminator instance
 */
export function createDeadCodeEliminator(config: CompilerConfig): DeadCodeEliminator {
  return new DeadCodeEliminator(config);
}

/**
 * Perform dead code elimination (convenience function)
 */
export function eliminateDeadCode(
  intents: Map<string, EnrichedIntent>,
  entryPoints: string[],
  imports: Array<{ from: string; to: string; items: string[] }>,
  config: CompilerConfig
): DCEResult {
  const eliminator = createDeadCodeEliminator(config);

  // Register intents
  for (const [id, intent] of intents) {
    eliminator.registerIntent(id, intent, entryPoints.includes(id));
  }

  // Register imports
  for (const { from, to, items } of imports) {
    eliminator.registerImport(from, to, items);
  }

  return eliminator.eliminate();
}

/**
 * Tree shake a specific intent's features
 */
export function treeShakeIntent(
  intent: EnrichedIntent,
  usedFeatures: string[]
): EnrichedIntent {
  const allFeatures = new Set([
    ...(intent.features || []),
    ...(intent.enriched?.features || [])
  ]);

  const usedSet = new Set(usedFeatures);
  const unusedFeatures = Array.from(allFeatures).filter(f => !usedSet.has(f));

  if (unusedFeatures.length === 0) {
    return intent;
  }

  // Create new intent with only used features
  const filteredIntent: EnrichedIntent = {
    ...intent,
    features: (intent.features || []).filter(f => usedSet.has(f)),
    enriched: intent.enriched ? {
      ...intent.enriched,
      features: (intent.enriched.features || []).filter(f => usedSet.has(f))
    } : undefined
  };

  return filteredIntent;
}
