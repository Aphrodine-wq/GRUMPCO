/**
 * File-based Memory Store
 *
 * Transparent, auditable memory system that stores user preferences,
 * project context, and agent "learnings" in human-readable Markdown files
 * (e.g., MEMORY.md, PROJECT_CONTEXT.md).
 *
 * Benefits:
 *  - Users can audit and edit what the AI knows about them
 *  - Persists across sessions without a database
 *  - Git-friendly (diffable, reviewable)
 *
 * @module services/workspace/fileMemoryStore
 */

import fs from 'fs/promises';
import path from 'path';
import { logger } from '../../utils/logger.js';

// ============================================================================
// Types
// ============================================================================

export interface MemoryEntry {
  /** Section header (e.g., "User Preferences", "Code Patterns") */
  section: string;
  /** Memory key within the section */
  key: string;
  /** Memory value */
  value: string;
  /** When this entry was last updated */
  updatedAt: string;
  /** Source of the memory (e.g., "user", "agent", "session:abc") */
  source: string;
}

export interface MemoryFile {
  /** Relative path from workspace root */
  path: string;
  /** File content */
  content: string;
  /** Parsed sections */
  sections: Map<string, Map<string, MemoryEntry>>;
}

export interface FileMemoryStoreOptions {
  /** Workspace root directory */
  workspaceRoot: string;
  /** Name of the memory file. @default 'MEMORY.md' */
  fileName: string;
  /** Directory to store memory files (relative to workspace). @default '.grump' */
  memoryDir: string;
  /** Max file size in bytes. @default 100_000 */
  maxFileSize: number;
}

// ============================================================================
// Constants
// ============================================================================

const MEMORY_HEADER = `# Project Memory

> This file is maintained by G-Rump AI to store project context and learnings.
> You can edit this file directly — the AI will respect your changes.
> Last updated: {{TIMESTAMP}}

---

`;

// ============================================================================
// Implementation
// ============================================================================

export class FileMemoryStore {
  private options: FileMemoryStoreOptions;
  private memoryPath: string;
  private cache: MemoryFile | null = null;

  constructor(options: Partial<FileMemoryStoreOptions> & { workspaceRoot: string }) {
    this.options = {
      workspaceRoot: options.workspaceRoot,
      fileName: options.fileName ?? 'MEMORY.md',
      memoryDir: options.memoryDir ?? '.grump',
      maxFileSize: options.maxFileSize ?? 100_000,
    };
    this.memoryPath = path.join(
      this.options.workspaceRoot,
      this.options.memoryDir,
      this.options.fileName
    );
  }

  /**
   * Remember a key-value pair in a specific section.
   */
  async remember(section: string, key: string, value: string, source = 'agent'): Promise<void> {
    const memory = await this.load();

    if (!memory.sections.has(section)) {
      memory.sections.set(section, new Map());
    }

    const sectionMap = memory.sections.get(section)!;
    sectionMap.set(key, {
      section,
      key,
      value,
      updatedAt: new Date().toISOString(),
      source,
    });

    await this.save(memory);
    this.cache = memory;
  }

  /**
   * Recall a specific memory entry.
   */
  async recall(section: string, key: string): Promise<string | null> {
    const memory = await this.load();
    return memory.sections.get(section)?.get(key)?.value ?? null;
  }

  /**
   * Recall all entries in a section.
   */
  async recallSection(section: string): Promise<MemoryEntry[]> {
    const memory = await this.load();
    const sectionMap = memory.sections.get(section);
    if (!sectionMap) return [];
    return Array.from(sectionMap.values());
  }

  /**
   * Get all sections and their keys.
   */
  async listSections(): Promise<{ section: string; keys: string[] }[]> {
    const memory = await this.load();
    return Array.from(memory.sections.entries()).map(([section, entries]) => ({
      section,
      keys: Array.from(entries.keys()),
    }));
  }

  /**
   * Forget a specific entry.
   */
  async forget(section: string, key: string): Promise<boolean> {
    const memory = await this.load();
    const sectionMap = memory.sections.get(section);
    if (!sectionMap) return false;

    const deleted = sectionMap.delete(key);
    if (deleted) {
      if (sectionMap.size === 0) memory.sections.delete(section);
      await this.save(memory);
      this.cache = memory;
    }
    return deleted;
  }

  /**
   * Search memories by keyword across all sections.
   */
  async search(query: string): Promise<MemoryEntry[]> {
    const memory = await this.load();
    const results: MemoryEntry[] = [];
    const lowerQuery = query.toLowerCase();

    for (const sectionMap of memory.sections.values()) {
      for (const entry of sectionMap.values()) {
        if (
          entry.key.toLowerCase().includes(lowerQuery) ||
          entry.value.toLowerCase().includes(lowerQuery) ||
          entry.section.toLowerCase().includes(lowerQuery)
        ) {
          results.push(entry);
        }
      }
    }

    return results;
  }

  /**
   * Get raw markdown content for injection into context window.
   */
  async getContextString(): Promise<string> {
    try {
      return await fs.readFile(this.memoryPath, 'utf8');
    } catch {
      return '';
    }
  }

  // --------------------------------------------------------------------------
  // Private: File I/O
  // --------------------------------------------------------------------------

  private async load(): Promise<MemoryFile> {
    if (this.cache) return this.cache;

    try {
      const content = await fs.readFile(this.memoryPath, 'utf8');
      const sections = this.parseMarkdown(content);
      this.cache = { path: this.memoryPath, content, sections };
      return this.cache;
    } catch {
      // File doesn't exist yet — return empty
      return {
        path: this.memoryPath,
        content: '',
        sections: new Map(),
      };
    }
  }

  private async save(memory: MemoryFile): Promise<void> {
    const content = this.renderMarkdown(memory.sections);

    // Check file size limit
    if (content.length > this.options.maxFileSize) {
      logger.warn(
        { size: content.length, limit: this.options.maxFileSize },
        'Memory file exceeds size limit, pruning oldest entries'
      );
      this.prune(memory.sections);
    }

    const dir = path.dirname(this.memoryPath);
    await fs.mkdir(dir, { recursive: true });
    await fs.writeFile(this.memoryPath, this.renderMarkdown(memory.sections), 'utf8');
  }

  // --------------------------------------------------------------------------
  // Private: Markdown Parsing / Rendering
  // --------------------------------------------------------------------------

  private parseMarkdown(content: string): Map<string, Map<string, MemoryEntry>> {
    const sections = new Map<string, Map<string, MemoryEntry>>();
    let currentSection = '';

    const lines = content.split('\n');
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      // Section header: ## Section Name
      const sectionMatch = line.match(/^## (.+)/);
      if (sectionMatch) {
        currentSection = sectionMatch[1].trim();
        if (!sections.has(currentSection)) {
          sections.set(currentSection, new Map());
        }
        continue;
      }

      // Entry: - **key**: value  [source, timestamp]
      const entryMatch = line.match(/^- \*\*(.+?)\*\*:\s*(.+?)(?:\s*\[(.+?)\])?$/);
      if (entryMatch && currentSection) {
        const [, key, value, meta] = entryMatch;
        const [source, updatedAt] = (meta ?? 'agent').split(',').map((s) => s.trim());

        sections.get(currentSection)!.set(key, {
          section: currentSection,
          key,
          value: value.trim(),
          updatedAt: updatedAt ?? new Date().toISOString(),
          source: source ?? 'agent',
        });
      }
    }

    return sections;
  }

  private renderMarkdown(sections: Map<string, Map<string, MemoryEntry>>): string {
    const header = MEMORY_HEADER.replace('{{TIMESTAMP}}', new Date().toISOString());
    const parts: string[] = [header];

    for (const [sectionName, entries] of sections) {
      parts.push(`## ${sectionName}\n`);
      for (const entry of entries.values()) {
        parts.push(`- **${entry.key}**: ${entry.value} [${entry.source}, ${entry.updatedAt}]`);
      }
      parts.push('');
    }

    return parts.join('\n');
  }

  private prune(sections: Map<string, Map<string, MemoryEntry>>): void {
    // Remove oldest entries until under limit
    const allEntries: (MemoryEntry & { sectionName: string })[] = [];
    for (const [sectionName, entries] of sections) {
      for (const entry of entries.values()) {
        allEntries.push({ ...entry, sectionName });
      }
    }

    // Sort by date, oldest first
    allEntries.sort((a, b) => new Date(a.updatedAt).getTime() - new Date(b.updatedAt).getTime());

    // Remove oldest 25%
    const removeCount = Math.ceil(allEntries.length * 0.25);
    for (let i = 0; i < removeCount; i++) {
      const entry = allEntries[i];
      sections.get(entry.sectionName)?.delete(entry.key);
    }
  }
}
