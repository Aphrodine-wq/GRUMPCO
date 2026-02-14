/**
 * Cross-File Dependency Mapper
 *
 * Parses import/require/from statements across a codebase and builds a
 * directed dependency graph. This enables the RAG system to:
 *
 * 1. Boost retrieval scores for files in the same dependency subgraph
 * 2. Identify all files affected by a change (transitive dependents)
 * 3. Prevent breaking changes during refactors
 *
 * @module dependencyMapper
 */

// ============================================================================
// Types
// ============================================================================

/** A single import relationship */
export interface ImportEdge {
    /** The file that imports */
    importer: string;
    /** The file or module being imported */
    imported: string;
    /** Specific symbols imported (empty for default/namespace imports) */
    symbols: string[];
    /** Whether this is a type-only import */
    typeOnly: boolean;
}

/** Exported symbols from a file */
export interface FileExports {
    /** Named exports */
    named: string[];
    /** Whether the file has a default export */
    hasDefault: boolean;
    /** Re-exports from other modules */
    reExports: string[];
}

/** Dependency graph for a codebase */
export interface DependencyGraph {
    /** Map of file path → files it imports from */
    imports: Map<string, ImportEdge[]>;
    /** Map of file path → exported symbols */
    exports: Map<string, FileExports>;
    /** Map of file path → files that import from it (reverse index) */
    dependents: Map<string, Set<string>>;
    /** Total number of files indexed */
    fileCount: number;
    /** Timestamp of last build */
    builtAt: string;
}

/** Options for building the dependency graph */
export interface DependencyMapperOptions {
    /** Root directory of the project (for resolving relative imports) */
    rootDir?: string;
    /** File extensions to include */
    extensions?: string[];
    /** Directories to exclude */
    excludeDirs?: string[];
}

// ============================================================================
// Import Parsers (Regex-based, fast)
// ============================================================================

/** Regex patterns for extracting imports from various languages */
const IMPORT_PATTERNS = {
    /** ES Module import: `import { Foo } from './bar'` */
    esm: /import\s+(?:type\s+)?(?:(?:\{([^}]*)\}|(\*\s+as\s+\w+)|(\w+))\s*,?\s*)*\s*from\s+['"]([^'"]+)['"]/g,

    /** ES Module re-export: `export { Foo } from './bar'` */
    reExport: /export\s+(?:type\s+)?(?:\{([^}]*)\}|\*\s*(?:as\s+\w+)?)\s*from\s+['"]([^'"]+)['"]/g,

    /** CommonJS require: `const foo = require('./bar')` */
    cjs: /(?:const|let|var)\s+(?:\{([^}]*)\}|(\w+))\s*=\s*require\s*\(\s*['"]([^'"]+)['"]\s*\)/g,

    /** Dynamic import: `import('./bar')` */
    dynamicImport: /import\s*\(\s*['"]([^'"]+)['"]\s*\)/g,

    /** Python import: `from foo import bar` or `import foo` */
    pythonFrom: /from\s+([\w.]+)\s+import\s+(.+)/g,
    pythonImport: /^import\s+([\w.]+(?:\s*,\s*[\w.]+)*)/gm,

    /** Rust use: `use foo::bar;` */
    rustUse: /use\s+([\w:]+(?:::\{[^}]+\}|::\*)?)\s*;/g,

    /** Go import: `import "fmt"` or `import ( "fmt" )` */
    goImport: /import\s+(?:\(\s*([\s\S]*?)\s*\)|"([^"]+)")/g,

    /** Export: `export function foo`, `export class Bar`, etc. */
    namedExport: /export\s+(?:async\s+)?(?:function|class|const|let|var|type|interface|enum)\s+(\w+)/g,

    /** Default export: `export default ...` */
    defaultExport: /export\s+default\s+/g,

    /** Type-only import indicator */
    typeOnly: /import\s+type\s+/,
};

// ============================================================================
// Core Implementation
// ============================================================================

/**
 * Builds and queries a cross-file dependency graph.
 *
 * @example
 * ```ts
 * const mapper = new DependencyMapper({ rootDir: '/project/src' });
 * mapper.addFile('utils.ts', utilsCode);
 * mapper.addFile('auth.ts', authCode);
 * mapper.build();
 *
 * // What files are affected if we change utils.ts?
 * const affected = mapper.getAffectedFiles('utils.ts');
 * // → ['auth.ts', ...] (all transitive dependents)
 * ```
 */
export class DependencyMapper {
    private options: Required<DependencyMapperOptions>;
    private files: Map<string, string> = new Map(); // path → content
    private graph: DependencyGraph;

    constructor(options: DependencyMapperOptions = {}) {
        this.options = {
            rootDir: options.rootDir ?? '.',
            extensions: options.extensions ?? [
                '.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs',
                '.py', '.rs', '.go',
            ],
            excludeDirs: options.excludeDirs ?? [
                'node_modules', '.git', 'dist', 'build', '__pycache__', 'target',
            ],
        };
        this.graph = this.emptyGraph();
    }

    /**
     * Add a file's content for analysis.
     */
    addFile(filePath: string, content: string): void {
        this.files.set(this.normalizePath(filePath), content);
    }

    /**
     * Build the dependency graph from all added files.
     * Can be called incrementally as files are added.
     */
    build(): DependencyGraph {
        this.graph = this.emptyGraph();

        for (const [filePath, content] of this.files) {
            const lang = this.detectLang(filePath);

            // Parse imports
            const edges = this.parseImports(content, filePath, lang);
            this.graph.imports.set(filePath, edges);

            // Parse exports
            const exports = this.parseExports(content, lang);
            this.graph.exports.set(filePath, exports);

            // Build reverse index (dependents)
            for (const edge of edges) {
                const resolved = this.resolveImportPath(edge.imported, filePath);
                if (!this.graph.dependents.has(resolved)) {
                    this.graph.dependents.set(resolved, new Set());
                }
                this.graph.dependents.get(resolved)!.add(filePath);
            }
        }

        this.graph.fileCount = this.files.size;
        this.graph.builtAt = new Date().toISOString();
        return this.graph;
    }

    /**
     * Get all files that would be affected if the given file changes.
     * Returns transitive dependents (files that import this file, and files
     * that import those files, etc.).
     */
    getAffectedFiles(filePath: string): string[] {
        const normalized = this.normalizePath(filePath);
        const affected = new Set<string>();
        const queue = [normalized];

        while (queue.length > 0) {
            const current = queue.shift()!;
            const deps = this.graph.dependents.get(current);
            if (deps) {
                for (const dep of deps) {
                    if (!affected.has(dep)) {
                        affected.add(dep);
                        queue.push(dep);
                    }
                }
            }
        }

        return Array.from(affected);
    }

    /**
     * Get the direct dependencies of a file (what it imports).
     */
    getDependencies(filePath: string): string[] {
        const normalized = this.normalizePath(filePath);
        const edges = this.graph.imports.get(normalized) ?? [];
        return edges.map((e) => this.resolveImportPath(e.imported, normalized));
    }

    /**
     * Get files in the same dependency subgraph.
     * Useful for boosting RAG retrieval scores for related files.
     */
    getRelatedFiles(filePath: string, maxDepth = 2): string[] {
        const normalized = this.normalizePath(filePath);
        const related = new Set<string>();
        const visited = new Set<string>();

        const walk = (current: string, depth: number) => {
            if (depth > maxDepth || visited.has(current)) return;
            visited.add(current);

            // Add direct deps
            const deps = this.getDependencies(current);
            for (const dep of deps) {
                related.add(dep);
                walk(dep, depth + 1);
            }

            // Add direct dependents
            const dependents = this.graph.dependents.get(current);
            if (dependents) {
                for (const dep of dependents) {
                    related.add(dep);
                    walk(dep, depth + 1);
                }
            }
        };

        walk(normalized, 0);
        related.delete(normalized); // Don't include self
        return Array.from(related);
    }

    /**
     * Serialize the graph to a JSON-friendly format for storage/caching.
     */
    toJSON(): {
        imports: Record<string, ImportEdge[]>;
        exports: Record<string, FileExports>;
        dependents: Record<string, string[]>;
        fileCount: number;
        builtAt: string;
    } {
        return {
            imports: Object.fromEntries(this.graph.imports),
            exports: Object.fromEntries(this.graph.exports),
            dependents: Object.fromEntries(
                Array.from(this.graph.dependents.entries()).map(([k, v]) => [k, Array.from(v)]),
            ),
            fileCount: this.graph.fileCount,
            builtAt: this.graph.builtAt,
        };
    }

    /**
     * Create the graph from a serialized JSON (for cache restore).
     */
    static fromJSON(data: ReturnType<DependencyMapper['toJSON']>): DependencyGraph {
        return {
            imports: new Map(Object.entries(data.imports)),
            exports: new Map(Object.entries(data.exports)),
            dependents: new Map(
                Object.entries(data.dependents).map(([k, v]) => [k, new Set(v)]),
            ),
            fileCount: data.fileCount,
            builtAt: data.builtAt,
        };
    }

    // --------------------------------------------------------------------------
    // Private: Import parsing
    // --------------------------------------------------------------------------

    private parseImports(content: string, filePath: string, lang: string): ImportEdge[] {
        const edges: ImportEdge[] = [];

        if (lang === 'python') {
            return this.parsePythonImports(content, filePath);
        }
        if (lang === 'rust') {
            return this.parseRustImports(content, filePath);
        }
        if (lang === 'go') {
            return this.parseGoImports(content, filePath);
        }

        // JS/TS ES modules
        const esmRegex = new RegExp(IMPORT_PATTERNS.esm.source, 'g');
        let match;
        while ((match = esmRegex.exec(content)) !== null) {
            const namedImports = match[1]
                ?.split(',')
                .map((s) => s.trim().split(/\s+as\s+/)[0].trim())
                .filter(Boolean) ?? [];
            const imported = match[4];
            const isType = IMPORT_PATTERNS.typeOnly.test(match[0]);

            edges.push({
                importer: filePath,
                imported,
                symbols: namedImports,
                typeOnly: isType,
            });
        }

        // CommonJS require
        const cjsRegex = new RegExp(IMPORT_PATTERNS.cjs.source, 'g');
        while ((match = cjsRegex.exec(content)) !== null) {
            const symbols = match[1]
                ?.split(',')
                .map((s) => s.trim())
                .filter(Boolean) ?? [];
            edges.push({
                importer: filePath,
                imported: match[3],
                symbols,
                typeOnly: false,
            });
        }

        // Dynamic imports
        const dynRegex = new RegExp(IMPORT_PATTERNS.dynamicImport.source, 'g');
        while ((match = dynRegex.exec(content)) !== null) {
            edges.push({
                importer: filePath,
                imported: match[1],
                symbols: [],
                typeOnly: false,
            });
        }

        // Re-exports
        const reExportRegex = new RegExp(IMPORT_PATTERNS.reExport.source, 'g');
        while ((match = reExportRegex.exec(content)) !== null) {
            const symbols = match[1]
                ?.split(',')
                .map((s) => s.trim().split(/\s+as\s+/)[0].trim())
                .filter(Boolean) ?? [];
            edges.push({
                importer: filePath,
                imported: match[2],
                symbols,
                typeOnly: false,
            });
        }

        return edges;
    }

    private parsePythonImports(content: string, filePath: string): ImportEdge[] {
        const edges: ImportEdge[] = [];
        let match;

        const fromRegex = new RegExp(IMPORT_PATTERNS.pythonFrom.source, 'g');
        while ((match = fromRegex.exec(content)) !== null) {
            const symbols = match[2].split(',').map((s) => s.trim()).filter(Boolean);
            edges.push({
                importer: filePath,
                imported: match[1],
                symbols,
                typeOnly: false,
            });
        }

        const importRegex = new RegExp(IMPORT_PATTERNS.pythonImport.source, 'gm');
        while ((match = importRegex.exec(content)) !== null) {
            const modules = match[1].split(',').map((s) => s.trim()).filter(Boolean);
            for (const mod of modules) {
                edges.push({
                    importer: filePath,
                    imported: mod,
                    symbols: [],
                    typeOnly: false,
                });
            }
        }

        return edges;
    }

    private parseRustImports(content: string, filePath: string): ImportEdge[] {
        const edges: ImportEdge[] = [];
        const regex = new RegExp(IMPORT_PATTERNS.rustUse.source, 'g');
        let match;

        while ((match = regex.exec(content)) !== null) {
            edges.push({
                importer: filePath,
                imported: match[1],
                symbols: [],
                typeOnly: false,
            });
        }

        return edges;
    }

    private parseGoImports(content: string, filePath: string): ImportEdge[] {
        const edges: ImportEdge[] = [];
        const regex = new RegExp(IMPORT_PATTERNS.goImport.source, 'g');
        let match;

        while ((match = regex.exec(content)) !== null) {
            if (match[1]) {
                // Multi-line import block
                const imports = match[1]
                    .split('\n')
                    .map((line) => line.trim().replace(/^[\w.]+\s+/, '').replace(/["]/g, ''))
                    .filter(Boolean);
                for (const imp of imports) {
                    edges.push({
                        importer: filePath,
                        imported: imp,
                        symbols: [],
                        typeOnly: false,
                    });
                }
            } else if (match[2]) {
                edges.push({
                    importer: filePath,
                    imported: match[2],
                    symbols: [],
                    typeOnly: false,
                });
            }
        }

        return edges;
    }

    // --------------------------------------------------------------------------
    // Private: Export parsing
    // --------------------------------------------------------------------------

    private parseExports(content: string, lang: string): FileExports {
        const result: FileExports = { named: [], hasDefault: false, reExports: [] };

        if (lang === 'python' || lang === 'rust' || lang === 'go') {
            // These languages have different export semantics; return empty
            return result;
        }

        // Named exports
        const namedRegex = new RegExp(IMPORT_PATTERNS.namedExport.source, 'g');
        let match;
        while ((match = namedRegex.exec(content)) !== null) {
            result.named.push(match[1]);
        }

        // Default exports
        const defaultRegex = new RegExp(IMPORT_PATTERNS.defaultExport.source, 'g');
        if (defaultRegex.test(content)) {
            result.hasDefault = true;
        }

        // Re-exports
        const reExportRegex = new RegExp(IMPORT_PATTERNS.reExport.source, 'g');
        while ((match = reExportRegex.exec(content)) !== null) {
            result.reExports.push(match[2]);
        }

        return result;
    }

    // --------------------------------------------------------------------------
    // Private: Utilities
    // --------------------------------------------------------------------------

    private detectLang(filePath: string): string {
        const ext = filePath.slice(filePath.lastIndexOf('.')).toLowerCase();
        const map: Record<string, string> = {
            '.ts': 'ts', '.tsx': 'ts', '.js': 'ts', '.jsx': 'ts',
            '.mjs': 'ts', '.cjs': 'ts',
            '.py': 'python', '.rs': 'rust', '.go': 'go',
        };
        return map[ext] ?? 'ts';
    }

    private normalizePath(p: string): string {
        return p.replace(/\\/g, '/');
    }

    /**
     * Basic import path resolution.
     * Converts relative imports (./foo, ../bar) to absolute-ish paths relative
     * to the project root. Does not resolve node_modules — those are left as-is.
     */
    private resolveImportPath(imported: string, importer: string): string {
        if (!imported.startsWith('.')) {
            return imported; // External package, keep as-is
        }

        const importerDir = importer.split('/').slice(0, -1).join('/');
        const parts = `${importerDir}/${imported}`.split('/');
        const resolved: string[] = [];

        for (const part of parts) {
            if (part === '.') continue;
            if (part === '..') {
                resolved.pop();
            } else {
                resolved.push(part);
            }
        }

        return resolved.join('/');
    }

    private emptyGraph(): DependencyGraph {
        return {
            imports: new Map(),
            exports: new Map(),
            dependents: new Map(),
            fileCount: 0,
            builtAt: new Date().toISOString(),
        };
    }
}
