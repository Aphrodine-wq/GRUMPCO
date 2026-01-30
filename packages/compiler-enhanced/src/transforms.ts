/**
 * Custom Transform Pipeline
 * Plugin system for custom compilation steps with transform hooks
 */

import type {
  CompilerConfig,
  TransformPlugin,
  TransformContext,
  TransformResult,
  EnrichedIntent
} from './types.js';

/**
 * Transform pipeline manager
 */
export class TransformPipeline {
  private config: CompilerConfig;
  private plugins: TransformPlugin[] = [];
  private hooks: {
    preParse: TransformPlugin[];
    postParse: TransformPlugin[];
    preCompile: TransformPlugin[];
    postCompile: TransformPlugin[];
  } = {
    preParse: [],
    postParse: [],
    preCompile: [],
    postCompile: []
  };

  constructor(config: CompilerConfig) {
    this.config = config;
    
    // Register plugins from config
    if (config.plugins) {
      for (const plugin of config.plugins) {
        this.register(plugin);
      }
    }
  }

  /**
   * Register a transform plugin
   */
  register(plugin: TransformPlugin): void {
    this.plugins.push(plugin);

    // Register hooks
    if (plugin.preParse) {
      this.hooks.preParse.push(plugin);
    }
    if (plugin.postParse) {
      this.hooks.postParse.push(plugin);
    }
    if (plugin.preCompile) {
      this.hooks.preCompile.push(plugin);
    }
    if (plugin.postCompile) {
      this.hooks.postCompile.push(plugin);
    }

    // Sort by plugin name for deterministic order
    this.hooks.preParse.sort((a, b) => a.name.localeCompare(b.name));
    this.hooks.postParse.sort((a, b) => a.name.localeCompare(b.name));
    this.hooks.preCompile.sort((a, b) => a.name.localeCompare(b.name));
    this.hooks.postCompile.sort((a, b) => a.name.localeCompare(b.name));
  }

  /**
   * Unregister a plugin
   */
  unregister(pluginName: string): boolean {
    const index = this.plugins.findIndex(p => p.name === pluginName);
    if (index === -1) {
      return false;
    }

    const plugin = this.plugins[index];
    this.plugins.splice(index, 1);

    // Remove from hooks
    this.hooks.preParse = this.hooks.preParse.filter(p => p.name !== pluginName);
    this.hooks.postParse = this.hooks.postParse.filter(p => p.name !== pluginName);
    this.hooks.preCompile = this.hooks.preCompile.filter(p => p.name !== pluginName);
    this.hooks.postCompile = this.hooks.postCompile.filter(p => p.name !== pluginName);

    return true;
  }

  /**
   * Execute pre-parse transforms
   */
  async transformPreParse(
    filePath: string,
    content: string,
    sourceMap?: import('./types.js').SourceMap
  ): Promise<TransformResult> {
    let currentContent = content;
    let currentSourceMap = sourceMap;
    let hasChanges = false;
    const allWarnings: string[] = [];
    const allErrors: string[] = [];

    const context: TransformContext = {
      filePath,
      content: currentContent,
      sourceMap: currentSourceMap,
      config: this.config
    };

    for (const plugin of this.hooks.preParse) {
      try {
        const result = await plugin.preParse!(context);
        
        if (result.changed) {
          currentContent = result.content;
          hasChanges = true;
          
          if (result.sourceMap) {
            currentSourceMap = result.sourceMap;
          }
        }

        if (result.warnings) {
          allWarnings.push(...result.warnings.map(w => `[${plugin.name}] ${w}`));
        }

        if (result.errors) {
          allErrors.push(...result.errors.map(e => `[${plugin.name}] ${e}`));
        }

        // Update context for next plugin
        context.content = currentContent;
        context.sourceMap = currentSourceMap;
      } catch (error) {
        allErrors.push(`[${plugin.name}] ${error instanceof Error ? error.message : String(error)}`);
      }
    }

    return {
      content: currentContent,
      sourceMap: currentSourceMap,
      changed: hasChanges,
      warnings: allWarnings.length > 0 ? allWarnings : undefined,
      errors: allErrors.length > 0 ? allErrors : undefined
    };
  }

  /**
   * Execute post-parse transforms
   */
  async transformPostParse(
    filePath: string,
    content: string,
    ast: unknown,
    sourceMap?: import('./types.js').SourceMap,
    intent?: EnrichedIntent
  ): Promise<TransformResult & { ast?: unknown }> {
    let currentContent = content;
    let currentAst = ast;
    let currentSourceMap = sourceMap;
    let hasChanges = false;
    const allWarnings: string[] = [];
    const allErrors: string[] = [];

    const context: TransformContext & { ast: unknown } = {
      filePath,
      content: currentContent,
      ast: currentAst,
      sourceMap: currentSourceMap,
      intent,
      config: this.config
    };

    for (const plugin of this.hooks.postParse) {
      try {
        const result = await plugin.postParse!(context);
        
        if (result.changed) {
          currentContent = result.content;
          hasChanges = true;
          
          if (result.sourceMap) {
            currentSourceMap = result.sourceMap;
          }
        }

        if (result.warnings) {
          allWarnings.push(...result.warnings.map(w => `[${plugin.name}] ${w}`));
        }

        if (result.errors) {
          allErrors.push(...result.errors.map(e => `[${plugin.name}] ${e}`));
        }

        // Update context for next plugin
        context.content = currentContent;
        context.sourceMap = currentSourceMap;
      } catch (error) {
        allErrors.push(`[${plugin.name}] ${error instanceof Error ? error.message : String(error)}`);
      }
    }

    return {
      content: currentContent,
      ast: currentAst,
      sourceMap: currentSourceMap,
      changed: hasChanges,
      warnings: allWarnings.length > 0 ? allWarnings : undefined,
      errors: allErrors.length > 0 ? allErrors : undefined
    };
  }

  /**
   * Execute pre-compile transforms
   */
  async transformPreCompile(
    filePath: string,
    content: string,
    sourceMap?: import('./types.js').SourceMap,
    intent?: EnrichedIntent
  ): Promise<TransformResult> {
    let currentContent = content;
    let currentSourceMap = sourceMap;
    let hasChanges = false;
    const allWarnings: string[] = [];
    const allErrors: string[] = [];

    const context: TransformContext = {
      filePath,
      content: currentContent,
      sourceMap: currentSourceMap,
      intent,
      config: this.config
    };

    for (const plugin of this.hooks.preCompile) {
      try {
        const result = await plugin.preCompile!(context);
        
        if (result.changed) {
          currentContent = result.content;
          hasChanges = true;
          
          if (result.sourceMap) {
            currentSourceMap = result.sourceMap;
          }
        }

        if (result.warnings) {
          allWarnings.push(...result.warnings.map(w => `[${plugin.name}] ${w}`));
        }

        if (result.errors) {
          allErrors.push(...result.errors.map(e => `[${plugin.name}] ${e}`));
        }

        // Update context for next plugin
        context.content = currentContent;
        context.sourceMap = currentSourceMap;
      } catch (error) {
        allErrors.push(`[${plugin.name}] ${error instanceof Error ? error.message : String(error)}`);
      }
    }

    return {
      content: currentContent,
      sourceMap: currentSourceMap,
      changed: hasChanges,
      warnings: allWarnings.length > 0 ? allWarnings : undefined,
      errors: allErrors.length > 0 ? allErrors : undefined
    };
  }

  /**
   * Execute post-compile transforms
   */
  async transformPostCompile(
    filePath: string,
    output: string,
    sourceMap?: import('./types.js').SourceMap,
    intent?: EnrichedIntent
  ): Promise<TransformResult> {
    let currentOutput = output;
    let currentSourceMap = sourceMap;
    let hasChanges = false;
    const allWarnings: string[] = [];
    const allErrors: string[] = [];

    const context: TransformContext & { output: string } = {
      filePath,
      content: output, // Original content reference
      output: currentOutput,
      sourceMap: currentSourceMap,
      intent,
      config: this.config
    };

    for (const plugin of this.hooks.postCompile) {
      try {
        const result = await plugin.postCompile!(context);
        
        if (result.changed) {
          currentOutput = result.content;
          hasChanges = true;
          
          if (result.sourceMap) {
            currentSourceMap = result.sourceMap;
          }
        }

        if (result.warnings) {
          allWarnings.push(...result.warnings.map(w => `[${plugin.name}] ${w}`));
        }

        if (result.errors) {
          allErrors.push(...result.errors.map(e => `[${plugin.name}] ${e}`));
        }

        // Update context for next plugin
        context.output = currentOutput;
        context.sourceMap = currentSourceMap;
      } catch (error) {
        allErrors.push(`[${plugin.name}] ${error instanceof Error ? error.message : String(error)}`);
      }
    }

    return {
      content: currentOutput,
      sourceMap: currentSourceMap,
      changed: hasChanges,
      warnings: allWarnings.length > 0 ? allWarnings : undefined,
      errors: allErrors.length > 0 ? allErrors : undefined
    };
  }

  /**
   * Get registered plugins
   */
  getPlugins(): TransformPlugin[] {
    return [...this.plugins];
  }

  /**
   * Get plugin by name
   */
  getPlugin(name: string): TransformPlugin | undefined {
    return this.plugins.find(p => p.name === name);
  }

  /**
   * Check if plugin is registered
   */
  hasPlugin(name: string): boolean {
    return this.plugins.some(p => p.name === name);
  }

  /**
   * Clear all plugins
   */
  clear(): void {
    this.plugins = [];
    this.hooks.preParse = [];
    this.hooks.postParse = [];
    this.hooks.preCompile = [];
    this.hooks.postCompile = [];
  }

  /**
   * Get pipeline statistics
   */
  getStats(): {
    totalPlugins: number;
    preParsePlugins: number;
    postParsePlugins: number;
    preCompilePlugins: number;
    postCompilePlugins: number;
  } {
    return {
      totalPlugins: this.plugins.length,
      preParsePlugins: this.hooks.preParse.length,
      postParsePlugins: this.hooks.postParse.length,
      preCompilePlugins: this.hooks.preCompile.length,
      postCompilePlugins: this.hooks.postCompile.length
    };
  }
}

/**
 * Create transform pipeline instance
 */
export function createTransformPipeline(config: CompilerConfig): TransformPipeline {
  return new TransformPipeline(config);
}

/**
 * Built-in transform plugins
 */
export const builtinPlugins = {
  /**
   * Minification plugin
   */
  minify(): TransformPlugin {
    return {
      name: 'minify',
      postCompile: async (context) => {
        // Simple minification (remove extra whitespace)
        const minified = context.output
          .replace(/\/\*[\s\S]*?\*\//g, '') // Remove block comments
          .replace(/\/\/.*$/gm, '') // Remove line comments
          .replace(/\n\s*/g, ' ') // Collapse whitespace
          .replace(/\s+/g, ' ') // Normalize spaces
          .trim();

        return {
          content: minified,
          changed: minified !== context.output
        };
      }
    };
  },

  /**
   * Add banner plugin
   */
  banner(text: string): TransformPlugin {
    return {
      name: 'banner',
      postCompile: async (context) => {
        const banner = `/* ${text} */\n`;
        return {
          content: banner + context.output,
          changed: true
        };
      }
    };
  },

  /**
   * Replace strings plugin
   */
  replace(replacements: Record<string, string>): TransformPlugin {
    return {
      name: 'replace',
      preCompile: async (context) => {
        let content = context.content;
        let changed = false;

        for (const [search, replace] of Object.entries(replacements)) {
          if (content.includes(search)) {
            content = content.split(search).join(replace);
            changed = true;
          }
        }

        return {
          content,
          changed
        };
      }
    };
  },

  /**
   * Strip console plugin
   */
  stripConsole(): TransformPlugin {
    return {
      name: 'stripConsole',
      preCompile: async (context) => {
        // Remove console.* calls
        const stripped = context.content
          .replace(/console\.(log|warn|error|info|debug)\([^)]*\);?\s*/g, '')
          .replace(/console\.(log|warn|error|info|debug)\s*=>\s*[^;]+;?\s*/g, '');

        return {
          content: stripped,
          changed: stripped !== context.content
        };
      }
    };
  },

  /**
   * TypeScript declaration plugin
   */
  declarations(): TransformPlugin {
    return {
      name: 'declarations',
      postCompile: async (context) => {
        // Generate .d.ts file alongside output
        // This is a placeholder - real implementation would parse TypeScript
        const dtsContent = `// Type definitions for ${context.filePath}\nexport {};\n`;
        
        return {
          content: context.output,
          changed: false
        };
      }
    };
  }
};

/**
 * Compose multiple plugins into one
 */
export function composePlugins(name: string, plugins: TransformPlugin[]): TransformPlugin {
  return {
    name,
    preParse: async (context) => {
      let result: TransformResult = { content: context.content, changed: false };
      
      for (const plugin of plugins) {
        if (plugin.preParse) {
          const r = await plugin.preParse({ ...context, content: result.content });
          result = {
            content: r.content,
            changed: result.changed || r.changed,
            sourceMap: r.sourceMap || result.sourceMap,
            warnings: [...(result.warnings || []), ...(r.warnings || [])],
            errors: [...(result.errors || []), ...(r.errors || [])]
          };
        }
      }
      
      return result;
    },
    postParse: async (context) => {
      let result: TransformResult & { ast?: unknown } = { content: context.content, ast: context.ast, changed: false };
      
      for (const plugin of plugins) {
        if (plugin.postParse) {
          const r = await plugin.postParse({ ...context, content: result.content, ast: result.ast });
          result = {
            content: r.content,
            ast: r.ast,
            changed: result.changed || r.changed,
            sourceMap: r.sourceMap || result.sourceMap,
            warnings: [...(result.warnings || []), ...(r.warnings || [])],
            errors: [...(result.errors || []), ...(r.errors || [])]
          };
        }
      }
      
      return result;
    },
    preCompile: async (context) => {
      let result: TransformResult = { content: context.content, changed: false };
      
      for (const plugin of plugins) {
        if (plugin.preCompile) {
          const r = await plugin.preCompile({ ...context, content: result.content });
          result = {
            content: r.content,
            changed: result.changed || r.changed,
            sourceMap: r.sourceMap || result.sourceMap,
            warnings: [...(result.warnings || []), ...(r.warnings || [])],
            errors: [...(result.errors || []), ...(r.errors || [])]
          };
        }
      }
      
      return result;
    },
    postCompile: async (context) => {
      let result: TransformResult = { content: context.output, changed: false };
      
      for (const plugin of plugins) {
        if (plugin.postCompile) {
          const r = await plugin.postCompile({ ...context, output: result.content });
          result = {
            content: r.content,
            changed: result.changed || r.changed,
            sourceMap: r.sourceMap || result.sourceMap,
            warnings: [...(result.warnings || []), ...(r.warnings || [])],
            errors: [...(result.errors || []), ...(r.errors || [])]
          };
        }
      }
      
      return result;
    }
  };
}
