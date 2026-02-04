/**
 * Bundle Analyzer
 * Visual breakdown of compiled output size with treemap visualization
 */

import { createHash } from 'crypto';
import type {
  CompilerConfig,
  BundleAnalysis,
  IntentAnalysis,
  DependencyAnalysis,
  TreemapNode,
  EnrichedIntent,
  OutputFile
} from './types.js';

/**
 * Bundle analyzer for intent-based compilation
 */
export class BundleAnalyzer {
  private config: CompilerConfig;
  private intentSizes: Map<string, IntentSize> = new Map();
  private dependencySizes: Map<string, DependencySize> = new Map();

  constructor(config: CompilerConfig) {
    this.config = config;
  }

  /**
   * Analyze a compiled output
   */
  analyze(outputs: OutputFile[], intents?: Map<string, EnrichedIntent>): BundleAnalysis {
    this.reset();

    // Group outputs by intent
    for (const output of outputs) {
      const intentId = this.extractIntentId(output.path);
      const size = output.size;

      // Track intent size
      if (!this.intentSizes.has(intentId)) {
        this.intentSizes.set(intentId, {
          id: intentId,
          name: intentId,
          size: 0,
          files: [],
          intent: intents?.get(intentId)
        });
      }

      const intentSize = this.intentSizes.get(intentId)!;
      intentSize.size += size;
      intentSize.files.push(output.path);

      // Track dependencies
      const deps = this.extractDependencies(output.content.toString());
      for (const dep of deps) {
        if (!this.dependencySizes.has(dep)) {
          this.dependencySizes.set(dep, {
            name: dep,
            size: 0,
            files: [],
            isDev: this.isDevDependency(dep)
          });
        }

        const depSize = this.dependencySizes.get(dep)!;
        depSize.size += size;
        depSize.files.push(output.path);
      }
    }

    // Calculate total sizes
    const totalSize = outputs.reduce((sum, o) => sum + o.size, 0);
    const gzippedSize = this.estimateGzippedSize(totalSize);

    // Build intent analysis
    const intentAnalysis: IntentAnalysis[] = Array.from(this.intentSizes.values())
      .map(intent => ({
        id: intent.id,
        name: intent.name,
        size: intent.size,
        percentage: (intent.size / totalSize) * 100,
        featureCount: intent.intent?.features?.length || intent.intent?.enriched?.features?.length || 0,
        files: intent.files
      }))
      .sort((a, b) => b.size - a.size);

    // Build dependency analysis
    const dependencyAnalysis: DependencyAnalysis[] = Array.from(this.dependencySizes.values())
      .map(dep => ({
        name: dep.name,
        size: dep.size,
        isDev: dep.isDev,
        files: dep.files
      }))
      .sort((a, b) => b.size - a.size);

    // Build treemap
    const treemap = this.buildTreemap(intentAnalysis, dependencyAnalysis);

    return {
      totalSize,
      gzippedSize,
      intents: intentAnalysis,
      dependencies: dependencyAnalysis,
      treemap
    };
  }

  /**
   * Reset analysis state
   */
  private reset(): void {
    this.intentSizes.clear();
    this.dependencySizes.clear();
  }

  /**
   * Extract intent ID from file path
   */
  private extractIntentId(filePath: string): string {
    // Extract intent ID from path patterns like:
    // - intents/login/main.js -> login
    // - dist/intents/checkout.js -> checkout
    // - output/user-auth.intent.js -> user-auth
    
    const match = filePath.match(/[\\/]([^\\/]+)(?:\.intent|\.grump)?\.(?:js|ts|json)$/i);
    if (match) {
      return match[1];
    }

    // Fallback to directory name
    const parts = filePath.split(/[\\/]/);
    if (parts.length >= 2) {
      return parts[parts.length - 2];
    }

    return 'unknown';
  }

  /**
   * Extract dependencies from content
   */
  private extractDependencies(content: string): string[] {
    const deps: string[] = [];
    
    // Match import statements
    const importRegex = /(?:import|require)\s*\(?['"]([^'"]+)['"]\)?/g;
    let match;
    while ((match = importRegex.exec(content)) !== null) {
      const dep = match[1];
      // Only include npm packages (not relative imports)
      if (!dep.startsWith('.') && !dep.startsWith('/')) {
        // Extract package name (handle scoped packages)
        const packageName = dep.startsWith('@') 
          ? dep.split('/').slice(0, 2).join('/')
          : dep.split('/')[0];
        
        if (!deps.includes(packageName)) {
          deps.push(packageName);
        }
      }
    }

    return deps;
  }

  /**
   * Check if dependency is a dev dependency
   */
  private isDevDependency(name: string): boolean {
    const devDeps = [
      '@types/', 'typescript', 'eslint', 'prettier', 'jest', 'vitest',
      'webpack', 'rollup', 'esbuild', 'swc', 'babel', 'husky',
      'lint-staged', 'commitlint', 'semantic-release'
    ];
    
    return devDeps.some(dev => name.includes(dev));
  }

  /**
   * Estimate gzipped size
   */
  private estimateGzippedSize(size: number): number {
    // Rough estimation: JavaScript typically compresses to 20-30% of original
    return Math.floor(size * 0.25);
  }

  /**
   * Build treemap structure
   */
  private buildTreemap(
    intents: IntentAnalysis[],
    deps: DependencyAnalysis[]
  ): TreemapNode {
    const root: TreemapNode = {
      name: 'bundle',
      children: []
    };

    // Add intents
    const intentsNode: TreemapNode = {
      name: 'intents',
      children: intents.map(intent => ({
        name: intent.name,
        value: intent.size,
        children: intent.files.map(file => ({
          name: file.split(/[\\/]/).pop() || file,
          value: Math.floor(intent.size / intent.files.length)
        }))
      }))
    };

    // Add dependencies
    const depsNode: TreemapNode = {
      name: 'dependencies',
      children: deps.map(dep => ({
        name: dep.name,
        value: dep.size
      }))
    };

    root.children = [intentsNode, depsNode];

    return root;
  }

  /**
   * Generate ASCII visualization
   */
  generateASCII(analysis: BundleAnalysis): string {
    const lines: string[] = [
      '═'.repeat(70),
      '  BUNDLE ANALYSIS',
      '═'.repeat(70),
      '',
      `  Total Size: ${this.formatSize(analysis.totalSize)}`,
      `  Gzipped:    ${this.formatSize(analysis.gzippedSize)}`,
      `  Intents:    ${analysis.intents.length}`,
      `  Dependencies: ${analysis.dependencies.length}`,
      '',
      '─'.repeat(70),
      '  INTENTS BY SIZE',
      '─'.repeat(70),
      ''
    ];

    // Top intents
    for (const intent of analysis.intents.slice(0, 10)) {
      const bar = this.renderBar(intent.percentage, 30);
      lines.push(`  ${intent.name.padEnd(20)} ${bar} ${this.formatSize(intent.size).padStart(10)} (${intent.percentage.toFixed(1)}%)`);
    }

    if (analysis.intents.length > 10) {
      lines.push(`  ... and ${analysis.intents.length - 10} more`);
    }

    lines.push('');
    lines.push('─'.repeat(70));
    lines.push('  TOP DEPENDENCIES');
    lines.push('─'.repeat(70));
    lines.push('');

    // Top dependencies
    for (const dep of analysis.dependencies.slice(0, 10)) {
      const percentage = (dep.size / analysis.totalSize) * 100;
      const bar = this.renderBar(percentage, 30);
      const devMarker = dep.isDev ? '[dev]' : '     ';
      lines.push(`  ${dep.name.padEnd(20)} ${devMarker} ${bar} ${this.formatSize(dep.size).padStart(10)}`);
    }

    lines.push('');
    lines.push('═'.repeat(70));

    return lines.join('\n');
  }

  /**
   * Generate HTML visualization
   */
  generateHTML(analysis: BundleAnalysis): string {
    return `<!DOCTYPE html>
<html>
<head>
  <title>G-Rump Bundle Analysis</title>
  <script src="https://d3js.org/d3.v7.min.js"></script>
  <style>
    body { font-family: system-ui, sans-serif; margin: 0; padding: 20px; background: #f5f5f5; }
    .header { background: white; padding: 20px; border-radius: 8px; margin-bottom: 20px; }
    .stats { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 20px; }
    .stat-card { background: white; padding: 15px; border-radius: 8px; text-align: center; }
    .stat-value { font-size: 2em; font-weight: bold; color: #2563eb; }
    .stat-label { color: #666; margin-top: 5px; }
    #treemap { width: 100%; height: 500px; background: white; border-radius: 8px; }
    table { width: 100%; background: white; border-radius: 8px; overflow: hidden; margin-top: 20px; }
    th, td { padding: 12px; text-align: left; border-bottom: 1px solid #eee; }
    th { background: #f8f9fa; font-weight: 600; }
    .bar { height: 20px; background: #2563eb; border-radius: 4px; }
    .size-col { text-align: right; }
  </style>
</head>
<body>
  <div class="header">
    <h1>📦 G-Rump Bundle Analysis</h1>
    <div class="stats">
      <div class="stat-card">
        <div class="stat-value">${this.formatSize(analysis.totalSize)}</div>
        <div class="stat-label">Total Size</div>
      </div>
      <div class="stat-card">
        <div class="stat-value">${this.formatSize(analysis.gzippedSize)}</div>
        <div class="stat-label">Gzipped</div>
      </div>
      <div class="stat-card">
        <div class="stat-value">${analysis.intents.length}</div>
        <div class="stat-label">Intents</div>
      </div>
      <div class="stat-card">
        <div class="stat-value">${analysis.dependencies.length}</div>
        <div class="stat-label">Dependencies</div>
      </div>
    </div>
  </div>

  <div id="treemap"></div>

  <h2>Intents Breakdown</h2>
  <table>
    <thead>
      <tr>
        <th>Intent</th>
        <th>Features</th>
        <th>Size</th>
        <th>Percentage</th>
        <th>Visualization</th>
      </tr>
    </thead>
    <tbody>
      ${analysis.intents.map(intent => `
        <tr>
          <td>${intent.name}</td>
          <td>${intent.featureCount}</td>
          <td class="size-col">${this.formatSize(intent.size)}</td>
          <td class="size-col">${intent.percentage.toFixed(1)}%</td>
          <td>
            <div class="bar" style="width: ${intent.percentage}%"></div>
          </td>
        </tr>
      `).join('')}
    </tbody>
  </table>

  <h2>Dependencies</h2>
  <table>
    <thead>
      <tr>
        <th>Package</th>
        <th>Type</th>
        <th>Size</th>
      </tr>
    </thead>
    <tbody>
      ${analysis.dependencies.map(dep => `
        <tr>
          <td>${dep.name}</td>
          <td>${dep.isDev ? 'dev' : 'prod'}</td>
          <td class="size-col">${this.formatSize(dep.size)}</td>
        </tr>
      `).join('')}
    </tbody>
  </table>

  <script>
    const treemapData = ${JSON.stringify(analysis.treemap)};
    
    // Simple treemap visualization using D3
    const width = document.getElementById('treemap').clientWidth;
    const height = 500;
    
    const root = d3.hierarchy(treemapData)
      .sum(d => d.value)
      .sort((a, b) => b.value - a.value);
    
    d3.treemap()
      .size([width, height])
      .padding(2)
      (root);
    
    const svg = d3.select("#treemap")
      .append("svg")
      .attr("width", width)
      .attr("height", height);
    
    const color = d3.scaleOrdinal(d3.schemeCategory10);
    
    svg.selectAll("rect")
      .data(root.leaves())
      .enter()
      .append("rect")
      .attr("x", d => d.x0)
      .attr("y", d => d.y0)
      .attr("width", d => d.x1 - d.x0)
      .attr("height", d => d.y1 - d.y0)
      .attr("fill", d => color(d.parent.data.name))
      .attr("stroke", "white");
    
    svg.selectAll("text")
      .data(root.leaves().filter(d => (d.x1 - d.x0) > 50 && (d.y1 - d.y0) > 20))
      .enter()
      .append("text")
      .attr("x", d => d.x0 + 5)
      .attr("y", d => d.y0 + 15)
      .text(d => d.data.name)
      .attr("font-size", "12px")
      .attr("fill", "white");
  </script>
</body>
</html>`;
  }

  /**
   * Format size in human readable format
   */
  private formatSize(bytes: number): string {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  /**
   * Render a bar chart
   */
  private renderBar(percentage: number, width: number): string {
    const filled = Math.floor((percentage / 100) * width);
    const empty = width - filled;
    return '█'.repeat(filled) + '░'.repeat(empty);
  }
}

/** Intent size tracking */
interface IntentSize {
  id: string;
  name: string;
  size: number;
  files: string[];
  intent?: EnrichedIntent;
}

/** Dependency size tracking */
interface DependencySize {
  name: string;
  size: number;
  files: string[];
  isDev: boolean;
}

/**
 * Create bundle analyzer instance
 */
export function createBundleAnalyzer(config: CompilerConfig): BundleAnalyzer {
  return new BundleAnalyzer(config);
}

/**
 * Analyze outputs (convenience function)
 */
export function analyze(
  outputs: OutputFile[],
  config: CompilerConfig,
  intents?: Map<string, EnrichedIntent>
): BundleAnalysis {
  const analyzer = createBundleAnalyzer(config);
  return analyzer.analyze(outputs, intents);
}
