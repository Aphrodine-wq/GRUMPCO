/**
 * RAG indexer: walk docs/code/specs, chunk, embed via NIM, save index.
 * Run from backend: npm run rag:index. Requires NVIDIA_NIM_API_KEY and RAG_INDEX_PATH (optional).
 */

import { readFile, readdir } from 'fs/promises';
import { join, relative, resolve } from 'path';
import { existsSync } from 'fs';
import dotenv from 'dotenv';
import { runIndexer, type DocType } from '../src/services/ragService.js';

dotenv.config({ path: resolve(process.cwd(), '.env') });
dotenv.config({ path: resolve(process.cwd(), 'backend/.env') });

const DOC_EXTS = new Set(['.md', '.mdx', '.mdoc']);
const CODE_EXTS = new Set([
  '.ts', '.tsx', '.js', '.jsx', '.mts', '.mjs', '.cjs', '.svelte', '.vue',
  '.py', '.rb', '.go', '.rs', '.json', '.yaml', '.yml',
]);

const IGNORE = new Set([
  'node_modules', '.git', 'dist', 'build', 'coverage', '.next', '.svelte-kit',
  'venv', '__pycache__', '.turbo', '.cache', 'playwright-report', 'test-results',
]);

async function collectFiles(
  dir: string,
  base: string,
  exts: Set<string>,
  out: { path: string; type: DocType }[]
): Promise<void> {
  if (!existsSync(dir)) return;
  const entries = await readdir(dir, { withFileTypes: true });
  for (const e of entries) {
    const full = join(dir, e.name);
    const rel = relative(base, full);
    if (IGNORE.has(e.name) || rel.includes('node_modules') || rel.includes('.git')) continue;
    if (e.isDirectory()) {
      await collectFiles(full, base, exts, out);
      continue;
    }
    const ext = extname(e.name);
    if (exts.has(ext)) {
      const type: DocType = ext === GRUMP_EXT ? 'grump' : DOC_EXTS.has(ext) ? 'doc' : 'code';
      out.push({ path: full, type });
    }
  }
}

function extname(name: string): string {
  const i = name.lastIndexOf('.');
  return i >= 0 ? name.slice(i) : '';
}

async function main(): Promise<void> {
  const base = existsSync(join(process.cwd(), 'src')) ? process.cwd() : join(process.cwd(), 'backend');
  const repoRoot = resolve(base, '..');

  const files: { path: string; type: DocType }[] = [];
  const docDirs = ['docs', 'docs-site'];
  const codeDirs = ['backend/src', 'frontend/src', 'packages'];

  for (const d of docDirs) {
    const p = join(repoRoot, d);
    await collectFiles(p, repoRoot, DOC_EXTS, files);
  }
  const codeAndGrump = new Set([...CODE_EXTS, GRUMP_EXT]);
  for (const d of codeDirs) {
    const p = join(repoRoot, d);
    await collectFiles(p, repoRoot, codeAndGrump, files);
  }

  const docs: { content: string; source: string; type: DocType }[] = [];
  for (const f of files) {
    try {
      const raw = await readFile(f.path, 'utf8');
      const content = raw.replace(/\r\n/g, '\n').trim();
      if (!content) continue;
      docs.push({
        content,
        source: relative(repoRoot, f.path).replace(/\\/g, '/'),
        type: f.type,
      });
    } catch (e) {
      console.warn(`Skip ${f.path}: ${(e as Error).message}`);
    }
  }

  if (docs.length === 0) {
    console.log('No documents to index.');
    process.exit(0);
  }

  console.log(`Indexing ${docs.length} documents...`);
  const { chunks } = await runIndexer(docs);
  console.log(`Indexed ${chunks} chunks.`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
