/**
 * Source Maps
 * Generate accurate source maps for debugging compiled intents
 */

import { readFileSync } from 'fs';
import type {
  CompilerConfig,
  SourceMap,
  SourceMapInfo,
  TransformResult
} from './types.js';

/**
 * Source map generator
 */
export class SourceMapGenerator {
  private config: CompilerConfig;
  private mappings: Array<{
    generatedLine: number;
    generatedColumn: number;
    sourceLine: number;
    sourceColumn: number;
    sourceIndex: number;
    nameIndex?: number;
  }> = [];
  private sources: string[] = [];
  private sourcesContent: string[] = [];
  private names: string[] = [];

  constructor(config: CompilerConfig) {
    this.config = config;
  }

  /**
   * Add a source file
   */
  addSource(filePath: string, content?: string): number {
    const index = this.sources.indexOf(filePath);
    if (index !== -1) {
      return index;
    }

    this.sources.push(filePath);
    
    if (content !== undefined) {
      this.sourcesContent.push(content);
    } else {
      try {
        this.sourcesContent.push(readFileSync(filePath, 'utf-8'));
      } catch {
        this.sourcesContent.push('');
      }
    }

    return this.sources.length - 1;
  }

  /**
   * Add a mapping
   */
  addMapping(
    generatedLine: number,
    generatedColumn: number,
    sourceLine: number,
    sourceColumn: number,
    sourcePath: string,
    name?: string
  ): void {
    const sourceIndex = this.addSource(sourcePath);
    let nameIndex: number | undefined;

    if (name !== undefined) {
      nameIndex = this.names.indexOf(name);
      if (nameIndex === -1) {
        this.names.push(name);
        nameIndex = this.names.length - 1;
      }
    }

    this.mappings.push({
      generatedLine,
      generatedColumn,
      sourceLine,
      sourceColumn,
      sourceIndex,
      nameIndex
    });
  }

  /**
   * Generate VLQ encoded mappings string
   */
  private generateMappingsString(): string {
    // Sort mappings by generated position
    this.mappings.sort((a, b) => {
      if (a.generatedLine !== b.generatedLine) {
        return a.generatedLine - b.generatedLine;
      }
      return a.generatedColumn - b.generatedColumn;
    });

    const vlq = new VLQ();
    const groups: string[] = [];
    let currentLine = 1;
    let previousGeneratedColumn = 0;
    let previousSourceIndex = 0;
    let previousSourceLine = 0;
    let previousSourceColumn = 0;
    let previousNameIndex = 0;

    for (const mapping of this.mappings) {
      // Start new line if needed
      while (currentLine < mapping.generatedLine) {
        groups.push(';');
        currentLine++;
        previousGeneratedColumn = 0;
      }

      // Encode the mapping
      const segment: number[] = [
        mapping.generatedColumn - previousGeneratedColumn,
        mapping.sourceIndex - previousSourceIndex,
        mapping.sourceLine - previousSourceLine,
        mapping.sourceColumn - previousSourceColumn
      ];

      if (mapping.nameIndex !== undefined) {
        segment.push(mapping.nameIndex - previousNameIndex);
        previousNameIndex = mapping.nameIndex;
      }

      const encoded = segment.map(n => vlq.encode(n)).join(',');
      
      if (groups.length === 0 || groups[groups.length - 1].endsWith(';')) {
        groups.push(encoded);
      } else {
        groups.push(',' + encoded);
      }

      previousGeneratedColumn = mapping.generatedColumn;
      previousSourceIndex = mapping.sourceIndex;
      previousSourceLine = mapping.sourceLine;
      previousSourceColumn = mapping.sourceColumn;
    }

    return groups.join('');
  }

  /**
   * Generate source map object
   */
  generate(): SourceMap {
    const mappings = this.generateMappingsString();

    const sourceMap: SourceMap = {
      version: 3,
      sources: this.sources,
      mappings,
      names: this.names
    };

    // Include sources content if not too large
    const totalSize = this.sourcesContent.reduce((sum, c) => sum + c.length, 0);
    if (totalSize < 1024 * 1024) { // 1MB limit
      sourceMap.sourcesContent = this.sourcesContent;
    }

    return sourceMap;
  }

  /**
   * Generate source map string
   */
  toString(): string {
    return JSON.stringify(this.generate(), null, 2);
  }

  /**
   * Generate inline source map data URL
   */
  toDataUrl(): string {
    const json = JSON.stringify(this.generate());
    const base64 = Buffer.from(json).toString('base64');
    return `data:application/json;charset=utf-8;base64,${base64}`;
  }

  /**
   * Generate source map comment for end of file
   */
  generateComment(mapPath?: string): string {
    if (this.config.sourceMaps === 'inline') {
      return `\n//# sourceMappingURL=${this.toDataUrl()}`;
    } else if (mapPath) {
      return `\n//# sourceMappingURL=${mapPath}`;
    }
    return '';
  }

  /**
   * Merge with another source map
   */
  merge(other: SourceMap): void {
    const sourceOffset = this.sources.length;
    const nameOffset = this.names.length;

    // Add sources
    for (let i = 0; i < other.sources.length; i++) {
      this.addSource(other.sources[i], other.sourcesContent?.[i]);
    }

    // Add names
    for (const name of other.names) {
      if (!this.names.includes(name)) {
        this.names.push(name);
      }
    }

    // Parse and add mappings
    const mappings = this.parseMappings(other.mappings);
    for (const m of mappings) {
      this.mappings.push({
        generatedLine: m.generatedLine,
        generatedColumn: m.generatedColumn,
        sourceLine: m.sourceLine,
        sourceColumn: m.sourceColumn,
        sourceIndex: m.sourceIndex + sourceOffset,
        nameIndex: m.nameIndex !== undefined ? m.nameIndex + nameOffset : undefined
      });
    }
  }

  /**
   * Parse mappings string
   */
  private parseMappings(mappings: string): Array<{
    generatedLine: number;
    generatedColumn: number;
    sourceLine: number;
    sourceColumn: number;
    sourceIndex: number;
    nameIndex?: number;
  }> {
    // Simplified parser - full implementation would decode VLQ
    return [];
  }

  /**
   * Reset generator state
   */
  reset(): void {
    this.mappings = [];
    this.sources = [];
    this.sourcesContent = [];
    this.names = [];
  }
}

/**
 * VLQ encoding for source maps
 */
class VLQ {
  private readonly VLQ_BASE_SHIFT = 5;
  private readonly VLQ_BASE = 1 << this.VLQ_BASE_SHIFT;
  private readonly VLQ_BASE_MASK = this.VLQ_BASE - 1;
  private readonly VLQ_CONTINUATION_BIT = this.VLQ_BASE;
  private readonly BASE64_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

  /**
   * Encode a number to VLQ
   */
  encode(value: number): string {
    let encoded = '';
    let vlq = this.toVLQSigned(value);

    do {
      let digit = vlq & this.VLQ_BASE_MASK;
      vlq >>>= this.VLQ_BASE_SHIFT;
      if (vlq > 0) {
        digit |= this.VLQ_CONTINUATION_BIT;
      }
      encoded += this.BASE64_CHARS[digit];
    } while (vlq > 0);

    return encoded;
  }

  /**
   * Convert to VLQ signed format
   */
  private toVLQSigned(value: number): number {
    return value < 0 ? ((-value) << 1) + 1 : value << 1;
  }

  /**
   * Decode VLQ string
   */
  decode(encoded: string): number[] {
    const values: number[] = [];
    let i = 0;

    while (i < encoded.length) {
      let vlq = 0;
      let shift = 0;
      let continuation = true;

      while (continuation && i < encoded.length) {
        const digit = this.BASE64_CHARS.indexOf(encoded[i++]);
        continuation = (digit & this.VLQ_CONTINUATION_BIT) !== 0;
        vlq += (digit & this.VLQ_BASE_MASK) << shift;
        shift += this.VLQ_BASE_SHIFT;
      }

      values.push(this.fromVLQSigned(vlq));
    }

    return values;
  }

  /**
   * Convert from VLQ signed format
   */
  private fromVLQSigned(vlq: number): number {
    const isNegative = (vlq & 1) === 1;
    const shifted = vlq >> 1;
    return isNegative ? -shifted : shifted;
  }
}

/**
 * Source map consumer for reading mappings
 */
export class SourceMapConsumer {
  private sourceMap: SourceMap;
  private mappings: Array<{
    generatedLine: number;
    generatedColumn: number;
    sourceLine: number;
    sourceColumn: number;
    source: string;
    name?: string;
  }> = [];

  constructor(sourceMap: SourceMap | string) {
    this.sourceMap = typeof sourceMap === 'string' ? JSON.parse(sourceMap) : sourceMap;
    this.parseMappings();
  }

  /**
   * Parse mappings
   */
  private parseMappings(): void {
    // Simplified parser - full implementation would decode VLQ
    // and populate this.mappings
  }

  /**
   * Get original position for generated position
   */
  originalPositionFor(
    generatedLine: number,
    generatedColumn: number
  ): {
    source: string | null;
    line: number | null;
    column: number | null;
    name: string | null;
  } {
    // Find closest mapping
    let bestMapping = null;
    let bestDistance = Infinity;

    for (const mapping of this.mappings) {
      if (mapping.generatedLine === generatedLine) {
        const distance = Math.abs(mapping.generatedColumn - generatedColumn);
        if (distance < bestDistance) {
          bestDistance = distance;
          bestMapping = mapping;
        }
      }
    }

    if (!bestMapping) {
      return { source: null, line: null, column: null, name: null };
    }

    return {
      source: bestMapping.source,
      line: bestMapping.sourceLine,
      column: bestMapping.sourceColumn,
      name: bestMapping.name || null
    };
  }

  /**
   * Get source content
   */
  sourceContentFor(source: string): string | null {
    const index = this.sourceMap.sources.indexOf(source);
    if (index === -1 || !this.sourceMap.sourcesContent) {
      return null;
    }
    return this.sourceMap.sourcesContent[index];
  }
}

/**
 * Create source map generator
 */
export function createSourceMapGenerator(config: CompilerConfig): SourceMapGenerator {
  return new SourceMapGenerator(config);
}

/**
 * Generate source map for transformation
 */
export function generateSourceMap(
  inputFile: string,
  inputContent: string,
  outputFile: string,
  outputContent: string,
  config: CompilerConfig
): SourceMapInfo {
  const generator = createSourceMapGenerator(config);
  
  // Add input source
  generator.addSource(inputFile, inputContent);

  // Simple line-by-line mapping
  const inputLines = inputContent.split('\n');
  const outputLines = outputContent.split('\n');

  for (let i = 0; i < Math.min(inputLines.length, outputLines.length); i++) {
    generator.addMapping(i + 1, 0, i + 1, 0, inputFile);
  }

  const sourceMap = generator.generate();

  return {
    sourcePath: inputFile,
    outputPath: outputFile,
    mapPath: outputFile + '.map'
  };
}

/**
 * Apply source map from transform result
 */
export function applySourceMap(
  generator: SourceMapGenerator,
  transformResult: TransformResult,
  sourcePath: string
): void {
  if (transformResult.sourceMap) {
    generator.merge(transformResult.sourceMap);
  }
}

/**
 * Strip source map comments from code
 */
export function stripSourceMapComments(code: string): string {
  return code
    .replace(/\/\/#\s*sourceMappingURL=.+\n?/g, '')
    .replace(/\/\*#\s*sourceMappingURL=[\s\S]+?\*\//g, '');
}
