/**
 * Tree-sitter AST-based Code Chunker
 *
 * Parses source code into an AST using web-tree-sitter (WASM) and extracts
 * self-contained, syntax-aware chunks (functions, classes, interfaces, etc.).
 * This prevents the RAG from retrieving broken code fragments that cross
 * function boundaries.
 *
 * Falls back to DocumentChunker for unsupported languages.
 *
 * @module treeSitterChunker
 */

import type { Document, VectorChunk } from './index.js';

// ============================================================================
// Types
// ============================================================================

/** Metadata attached to every AST-aware chunk */
export interface ASTChunkMetadata {
    /** Source language (e.g. "typescript", "python") */
    language: string;
    /** AST node type (e.g. "function_declaration", "class_declaration") */
    nodeType: string;
    /** Identifier name extracted from the AST node */
    name: string;
    /** 1-indexed start line in the original file */
    startLine: number;
    /** 1-indexed end line in the original file */
    endLine: number;
    /** Parent scope name (e.g. class name when inside a class body) */
    parentScope?: string;
    /** Whether this chunk represents a top-level or nested symbol */
    isTopLevel: boolean;
    /** Index signature for compatibility with Record<string, unknown> */
    [key: string]: unknown;
}

export interface TreeSitterChunkerOptions {
    /**
     * Maximum chunk size in characters.
     * Nodes larger than this will be split into sub-nodes or text chunks.
     * @default 4000
     */
    maxChunkSize?: number;

    /**
     * Minimum chunk size in characters.
     * Tiny nodes (e.g., one-line type aliases) are merged with adjacent chunks.
     * @default 50
     */
    minChunkSize?: number;

    /**
     * Whether to include import/export statements as a separate chunk.
     * @default true
     */
    includeImports?: boolean;

    /**
     * Whether to include top-level comments as separate chunks.
     * @default false
     */
    includeComments?: boolean;
}

// ============================================================================
// Language Configuration
// ============================================================================

/** Map file extension → Tree-sitter language name */
const EXTENSION_TO_LANGUAGE: Record<string, string> = {
    '.ts': 'typescript',
    '.tsx': 'tsx',
    '.js': 'javascript',
    '.jsx': 'javascript',
    '.mjs': 'javascript',
    '.cjs': 'javascript',
    '.py': 'python',
    '.rs': 'rust',
    '.go': 'go',
    '.rb': 'ruby',
    '.java': 'java',
    '.cs': 'c_sharp',
    '.cpp': 'cpp',
    '.cc': 'cpp',
    '.c': 'c',
    '.h': 'c',
    '.hpp': 'cpp',
    '.swift': 'swift',
    '.kt': 'kotlin',
    '.php': 'php',
    '.lua': 'lua',
    '.zig': 'zig',
};

/**
 * AST node types we extract as self-contained code chunks, per language.
 * These represent "interesting" top-level declarations the user is likely
 * to search for.
 */
const EXTRACTABLE_NODE_TYPES: Record<string, Set<string>> = {
    typescript: new Set([
        'function_declaration',
        'class_declaration',
        'interface_declaration',
        'type_alias_declaration',
        'enum_declaration',
        'export_statement',       // catches `export function ...`
        'lexical_declaration',    // `const foo = ...`
        'variable_declaration',
    ]),
    tsx: new Set([
        'function_declaration',
        'class_declaration',
        'interface_declaration',
        'type_alias_declaration',
        'enum_declaration',
        'export_statement',
        'lexical_declaration',
        'variable_declaration',
    ]),
    javascript: new Set([
        'function_declaration',
        'class_declaration',
        'export_statement',
        'lexical_declaration',
        'variable_declaration',
    ]),
    python: new Set([
        'function_definition',
        'class_definition',
        'decorated_definition',
    ]),
    rust: new Set([
        'function_item',
        'struct_item',
        'enum_item',
        'impl_item',
        'trait_item',
        'type_item',
        'mod_item',
        'macro_definition',
    ]),
    go: new Set([
        'function_declaration',
        'method_declaration',
        'type_declaration',
    ]),
    java: new Set([
        'class_declaration',
        'interface_declaration',
        'enum_declaration',
        'method_declaration',
    ]),
    c_sharp: new Set([
        'class_declaration',
        'interface_declaration',
        'enum_declaration',
        'method_declaration',
        'struct_declaration',
    ]),
    cpp: new Set([
        'function_definition',
        'class_specifier',
        'struct_specifier',
        'enum_specifier',
        'namespace_definition',
    ]),
    c: new Set([
        'function_definition',
        'struct_specifier',
        'enum_specifier',
    ]),
};

/** Node types that contain import/require statements */
const IMPORT_NODE_TYPES = new Set([
    'import_statement',
    'import_declaration',
    'use_declaration',       // Rust
    'include_directive',     // C/C++
]);

// ============================================================================
// Tree-sitter Parser Wrapper
// ============================================================================

/**
 * Lazy-loaded Tree-sitter parser.
 * Uses web-tree-sitter (WASM) so it works in Node.js and Electron without
 * native compilation.
 */

// Types from web-tree-sitter (declared inline to avoid hard dep at type level)
interface TSParser {
    setLanguage(lang: TSLanguage): void;
    parse(input: string): TSTree;
    delete(): void;
}
interface TSLanguage { }
interface TSTree {
    rootNode: TSNode;
    delete(): void;
}
interface TSNode {
    type: string;
    text: string;
    startPosition: { row: number; column: number };
    endPosition: { row: number; column: number };
    childCount: number;
    children: TSNode[];
    namedChildCount: number;
    namedChildren: TSNode[];
    childForFieldName(name: string): TSNode | null;
    parent: TSNode | null;
}

let TreeSitterModule: {
    init: () => Promise<void>;
    Language: { load: (path: string) => Promise<TSLanguage> };
    new(): TSParser;
} | null = null;

const loadedLanguages = new Map<string, TSLanguage>();
let initialized = false;

/**
 * Initialize web-tree-sitter. Safe to call multiple times.
 */
async function ensureInitialized(): Promise<boolean> {
    if (initialized && TreeSitterModule) return true;

    try {
        // Dynamic import so the module is optional
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        const mod = await (import('web-tree-sitter') as Promise<{ default?: typeof TreeSitterModule } & Record<string, unknown>>);
        TreeSitterModule = (mod.default ?? mod) as typeof TreeSitterModule;
        await TreeSitterModule!.init();
        initialized = true;
        return true;
    } catch {
        // web-tree-sitter not installed — will fall back to text chunking
        return false;
    }
}

/**
 * Load a Tree-sitter language grammar (.wasm file).
 * Looks for grammar files in `node_modules/tree-sitter-<lang>/tree-sitter-<lang>.wasm`
 * or `node_modules/tree-sitter-wasms/out/tree-sitter-<lang>.wasm`.
 */
async function loadLanguage(language: string): Promise<TSLanguage | null> {
    if (loadedLanguages.has(language)) return loadedLanguages.get(language)!;
    if (!TreeSitterModule) return null;

    const wasmPaths = [
        // tree-sitter-wasms package (bundles all grammars)
        `tree-sitter-wasms/out/tree-sitter-${language}.wasm`,
        // Individual grammar packages
        `tree-sitter-${language}/tree-sitter-${language}.wasm`,
    ];

    for (const wasmPath of wasmPaths) {
        try {
            // Resolve from node_modules
            const { createRequire } = await import('module');
            const require = createRequire(import.meta.url);
            const resolved = require.resolve(wasmPath);
            const lang = await TreeSitterModule.Language.load(resolved);
            loadedLanguages.set(language, lang);
            return lang;
        } catch {
            // Try next path
        }
    }

    return null;
}

// ============================================================================
// Core Chunker
// ============================================================================

/**
 * Tree-sitter-based code chunker.
 *
 * Parses source code into an AST and extracts self-contained chunks at
 * function/class/type boundaries. This ensures the RAG system receives
 * logical, complete code units rather than arbitrarily split text.
 *
 * @example
 * ```ts
 * const chunker = new TreeSitterChunker();
 * const chunks = await chunker.chunkCode(sourceText, 'utils.ts');
 * // Each chunk is a complete function, class, or type definition
 * ```
 */
export class TreeSitterChunker {
    private maxChunkSize: number;
    private minChunkSize: number;
    private includeImports: boolean;
    private includeComments: boolean;

    constructor(options: TreeSitterChunkerOptions = {}) {
        this.maxChunkSize = options.maxChunkSize ?? 4000;
        this.minChunkSize = options.minChunkSize ?? 50;
        this.includeImports = options.includeImports ?? true;
        this.includeComments = options.includeComments ?? false;
    }

    /**
     * Detect language from file extension.
     */
    static detectLanguage(filePath: string): string | null {
        const ext = filePath.slice(filePath.lastIndexOf('.')).toLowerCase();
        return EXTENSION_TO_LANGUAGE[ext] ?? null;
    }

    /**
     * Check if Tree-sitter is available (web-tree-sitter installed + WASM grammars).
     */
    static async isAvailable(language?: string): Promise<boolean> {
        const inited = await ensureInitialized();
        if (!inited) return false;
        if (language) {
            const lang = await loadLanguage(language);
            return lang !== null;
        }
        return true;
    }

    /**
     * Chunk a source code file using AST-aware boundaries.
     *
     * @param code    The source code string
     * @param source  File path or identifier (used for chunk IDs and metadata)
     * @returns Array of chunks without embeddings (ready for embedding pipeline)
     */
    async chunkCode(
        code: string,
        source: string,
    ): Promise<Omit<VectorChunk, 'embedding'>[]> {
        const language = TreeSitterChunker.detectLanguage(source);
        if (!language) {
            return this.fallbackChunk(code, source, 'unknown');
        }

        const available = await ensureInitialized();
        if (!available || !TreeSitterModule) {
            return this.fallbackChunk(code, source, language);
        }

        const grammar = await loadLanguage(language);
        if (!grammar) {
            return this.fallbackChunk(code, source, language);
        }

        // Parse the source code
        const parser = new TreeSitterModule();
        parser.setLanguage(grammar);
        const tree = parser.parse(code);

        try {
            return this.extractChunks(tree.rootNode, code, source, language);
        } finally {
            tree.delete();
            parser.delete();
        }
    }

    /**
     * Chunk a Document object (matches DocumentChunker interface).
     */
    async chunkDocument(
        doc: Document,
    ): Promise<Omit<VectorChunk, 'embedding'>[]> {
        return this.chunkCode(doc.content, doc.source);
    }

    /**
     * Chunk multiple documents.
     */
    async chunkMany(
        docs: Document[],
    ): Promise<Omit<VectorChunk, 'embedding'>[]> {
        const results: Omit<VectorChunk, 'embedding'>[][] = [];
        for (const doc of docs) {
            results.push(await this.chunkDocument(doc));
        }
        return results.flat();
    }

    // --------------------------------------------------------------------------
    // Private: AST extraction
    // --------------------------------------------------------------------------

    /**
     * Walk the AST and extract meaningful code chunks.
     */
    private extractChunks(
        rootNode: TSNode,
        code: string,
        source: string,
        language: string,
    ): Omit<VectorChunk, 'embedding'>[] {
        const chunks: Omit<VectorChunk, 'embedding'>[] = [];
        const extractable = EXTRACTABLE_NODE_TYPES[language] ?? new Set();

        // 1) Gather imports into a single preamble chunk
        if (this.includeImports) {
            const importLines = this.collectImports(rootNode, code);
            if (importLines.trim().length >= this.minChunkSize) {
                chunks.push({
                    id: `${this.sanitizeId(source)}_imports`,
                    content: importLines.trim(),
                    source,
                    type: 'code',
                    metadata: {
                        language,
                        nodeType: 'imports',
                        name: 'imports',
                        startLine: 1,
                        endLine: importLines.split('\n').length,
                        isTopLevel: true,
                    } satisfies ASTChunkMetadata,
                });
            }
        }

        // 2) Walk top-level children and extract extractable nodes
        let chunkIndex = 0;
        for (const child of rootNode.children) {
            if (IMPORT_NODE_TYPES.has(child.type)) continue; // already handled
            if (!this.includeComments && child.type === 'comment') continue;

            if (extractable.has(child.type)) {
                const nodeChunks = this.extractNode(
                    child,
                    code,
                    source,
                    language,
                    chunkIndex,
                    undefined, // no parent scope for top-level
                );
                chunks.push(...nodeChunks);
                chunkIndex += nodeChunks.length;
            } else if (child.text.trim().length >= this.minChunkSize) {
                // Non-extractable but non-trivial: keep as a misc chunk
                chunks.push({
                    id: `${this.sanitizeId(source)}_misc_${chunkIndex}`,
                    content: child.text.trim(),
                    source,
                    type: 'code',
                    metadata: {
                        language,
                        nodeType: child.type,
                        name: child.type,
                        startLine: child.startPosition.row + 1,
                        endLine: child.endPosition.row + 1,
                        isTopLevel: true,
                    } satisfies ASTChunkMetadata,
                });
                chunkIndex++;
            }
        }

        // 3) If we got zero chunks (e.g., a very small file), treat the whole file as one chunk
        if (chunks.length === 0 && code.trim().length > 0) {
            chunks.push({
                id: `${this.sanitizeId(source)}_full`,
                content: code.trim(),
                source,
                type: 'code',
                metadata: {
                    language,
                    nodeType: 'module',
                    name: this.extractFileName(source),
                    startLine: 1,
                    endLine: code.split('\n').length,
                    isTopLevel: true,
                } satisfies ASTChunkMetadata,
            });
        }

        return chunks;
    }

    /**
     * Extract an AST node as one or more chunks.
     * If the node is too large, recursively extract its children.
     */
    private extractNode(
        node: TSNode,
        code: string,
        source: string,
        language: string,
        startIndex: number,
        parentScope: string | undefined,
    ): Omit<VectorChunk, 'embedding'>[] {
        const text = node.text.trim();
        const name = this.extractNodeName(node, language);
        const meta: ASTChunkMetadata = {
            language,
            nodeType: node.type,
            name,
            startLine: node.startPosition.row + 1,
            endLine: node.endPosition.row + 1,
            parentScope,
            isTopLevel: !parentScope,
        };

        // If it fits in a single chunk, return as-is
        if (text.length <= this.maxChunkSize) {
            return [
                {
                    id: `${this.sanitizeId(source)}_${name || startIndex}`,
                    content: text,
                    source,
                    type: 'code',
                    metadata: meta,
                },
            ];
        }

        // Too large — try to extract children (e.g., methods inside a class)
        const extractable = EXTRACTABLE_NODE_TYPES[language] ?? new Set();
        const childChunks: Omit<VectorChunk, 'embedding'>[] = [];
        let idx = startIndex;

        // Add the node's "header" (signature + opening brace) as its own chunk
        const headerEnd = this.findNodeBodyStart(node);
        if (headerEnd > 0) {
            const header = code.slice(
                node.startPosition.column + this.lineOffset(code, node.startPosition.row),
                headerEnd,
            ).trim();
            if (header.length >= this.minChunkSize) {
                childChunks.push({
                    id: `${this.sanitizeId(source)}_${name}_header`,
                    content: header,
                    source,
                    type: 'code',
                    metadata: {
                        ...meta,
                        nodeType: `${node.type}_header`,
                        name: `${name}_header`,
                    },
                });
                idx++;
            }
        }

        // Recursively extract named children
        for (const child of node.namedChildren) {
            if (extractable.has(child.type) || child.text.length > this.minChunkSize) {
                const sub = this.extractNode(child, code, source, language, idx, name);
                childChunks.push(...sub);
                idx += sub.length;
            }
        }

        // If we couldn't split into smaller pieces, just split by lines
        if (childChunks.length === 0) {
            return this.splitByLines(text, source, language, meta.name, startIndex);
        }

        return childChunks;
    }

    // --------------------------------------------------------------------------
    // Private: Helpers
    // --------------------------------------------------------------------------

    /** Collect all import statements into a single string */
    private collectImports(rootNode: TSNode, _code: string): string {
        const parts: string[] = [];
        for (const child of rootNode.children) {
            if (IMPORT_NODE_TYPES.has(child.type)) {
                parts.push(child.text);
            }
        }
        return parts.join('\n');
    }

    /** Extract the identifier name from an AST node */
    private extractNodeName(node: TSNode, _language: string): string {
        // Try common field names for identifiers
        for (const field of ['name', 'declarator', 'pattern']) {
            const child = node.childForFieldName(field);
            if (child) {
                // For declarators, drill into the name
                const innerName = child.childForFieldName('name');
                return (innerName ?? child).text.split(/[\s({<]/)[0];
            }
        }

        // For export_statement, look at the declaration inside
        if (node.type === 'export_statement') {
            for (const child of node.namedChildren) {
                if (child.type !== 'comment') {
                    return this.extractNodeName(child, _language);
                }
            }
        }

        // Last resort: use the first identifier-like token
        const match = node.text.match(/(?:function|class|interface|type|struct|enum|def|fn|impl|trait|mod)\s+(\w+)/);
        return match?.[1] ?? `anonymous_${node.startPosition.row}`;
    }

    /** Find the byte offset where the body of a node starts (after { or :) */
    private findNodeBodyStart(node: TSNode): number {
        for (const child of node.children) {
            if (child.type === 'class_body' || child.type === 'statement_block' ||
                child.type === 'block' || child.type === 'body') {
                return child.startPosition.column;
            }
        }
        return 0;
    }

    /** Calculate byte offset from line number */
    private lineOffset(code: string, line: number): number {
        let offset = 0;
        const lines = code.split('\n');
        for (let i = 0; i < line && i < lines.length; i++) {
            offset += lines[i].length + 1; // +1 for newline
        }
        return offset;
    }

    /** Split text by lines when AST decomposition doesn't work */
    private splitByLines(
        text: string,
        source: string,
        language: string,
        name: string,
        startIndex: number,
    ): Omit<VectorChunk, 'embedding'>[] {
        const lines = text.split('\n');
        const chunks: Omit<VectorChunk, 'embedding'>[] = [];
        let buffer = '';
        let bufferStart = 0;

        for (let i = 0; i < lines.length; i++) {
            buffer += (buffer ? '\n' : '') + lines[i];
            if (buffer.length >= this.maxChunkSize) {
                chunks.push({
                    id: `${this.sanitizeId(source)}_${name}_part${chunks.length + startIndex}`,
                    content: buffer.trim(),
                    source,
                    type: 'code',
                    metadata: {
                        language,
                        nodeType: 'code_fragment',
                        name: `${name}_part${chunks.length}`,
                        startLine: bufferStart + 1,
                        endLine: i + 1,
                        isTopLevel: false,
                    } satisfies ASTChunkMetadata,
                });
                buffer = '';
                bufferStart = i + 1;
            }
        }

        if (buffer.trim()) {
            chunks.push({
                id: `${this.sanitizeId(source)}_${name}_part${chunks.length + startIndex}`,
                content: buffer.trim(),
                source,
                type: 'code',
                metadata: {
                    language,
                    nodeType: 'code_fragment',
                    name: `${name}_part${chunks.length}`,
                    startLine: bufferStart + 1,
                    endLine: lines.length,
                    isTopLevel: false,
                } satisfies ASTChunkMetadata,
            });
        }

        return chunks;
    }

    /** Fallback: use line-based chunking when Tree-sitter is unavailable */
    private fallbackChunk(
        code: string,
        source: string,
        language: string,
    ): Omit<VectorChunk, 'embedding'>[] {
        // Use a simple regex-based boundary detection, similar to CodeChunker
        const patterns = [
            /^(export\s+)?(async\s+)?function\s+\w+/gm,
            /^(export\s+)?(abstract\s+)?class\s+\w+/gm,
            /^(export\s+)?interface\s+\w+/gm,
            /^(export\s+)?type\s+\w+/gm,
            /^(export\s+)?enum\s+\w+/gm,
            /^(pub\s+)?(async\s+)?fn\s+\w+/gm,
            /^(pub\s+)?(struct|enum|impl|trait|mod)\s+\w+/gm,
            /^(async\s+)?def\s+\w+/gm,
            /^class\s+\w+/gm,
        ];

        const boundaries = new Set<number>();
        boundaries.add(0);

        for (const pattern of patterns) {
            const regex = new RegExp(pattern.source, pattern.flags);
            let match;
            while ((match = regex.exec(code)) !== null) {
                boundaries.add(match.index);
            }
        }

        const sorted = Array.from(boundaries).sort((a, b) => a - b);
        const chunks: Omit<VectorChunk, 'embedding'>[] = [];

        for (let i = 0; i < sorted.length; i++) {
            const start = sorted[i];
            const end = sorted[i + 1] ?? code.length;
            const content = code.slice(start, end).trim();

            if (content.length >= this.minChunkSize) {
                const startLine = code.slice(0, start).split('\n').length;
                const endLine = startLine + content.split('\n').length - 1;

                chunks.push({
                    id: `${this.sanitizeId(source)}_fallback_${i}`,
                    content,
                    source,
                    type: 'code',
                    metadata: {
                        language,
                        nodeType: 'regex_boundary',
                        name: `chunk_${i}`,
                        startLine,
                        endLine,
                        isTopLevel: true,
                    } satisfies ASTChunkMetadata,
                });
            }
        }

        // If nothing matched, return the whole file
        if (chunks.length === 0 && code.trim().length > 0) {
            chunks.push({
                id: `${this.sanitizeId(source)}_full`,
                content: code.trim(),
                source,
                type: 'code',
                metadata: {
                    language,
                    nodeType: 'module',
                    name: this.extractFileName(source),
                    startLine: 1,
                    endLine: code.split('\n').length,
                    isTopLevel: true,
                } satisfies ASTChunkMetadata,
            });
        }

        return chunks;
    }

    /** Sanitize a file path for use as a chunk ID */
    private sanitizeId(source: string): string {
        return source.replace(/[^a-zA-Z0-9_-]/g, '_').replace(/_+/g, '_');
    }

    /** Extract just the filename from a path */
    private extractFileName(source: string): string {
        return source.split(/[/\\]/).pop() ?? source;
    }
}

// ============================================================================
// Smart Chunker Factory
// ============================================================================

/**
 * Factory that auto-selects the best chunker for a given file.
 * Uses Tree-sitter for supported code files, falls back to DocumentChunker
 * for everything else.
 */
export async function createSmartChunker(
    options?: TreeSitterChunkerOptions,
): Promise<{
    chunkFile: (code: string, source: string) => Promise<Omit<VectorChunk, 'embedding'>[]>;
    isTreeSitterAvailable: boolean;
}> {
    const tsChunker = new TreeSitterChunker(options);
    const available = await TreeSitterChunker.isAvailable();

    return {
        isTreeSitterAvailable: available,
        async chunkFile(code: string, source: string) {
            const lang = TreeSitterChunker.detectLanguage(source);
            if (lang) {
                return tsChunker.chunkCode(code, source);
            }
            // Non-code files: simple paragraph-based splitting
            const { DocumentChunker } = await import('./index.js');
            const textChunker = new DocumentChunker({ chunkSize: 2000, chunkOverlap: 200 });
            return textChunker.chunk({ content: code, source, type: 'doc' });
        },
    };
}
