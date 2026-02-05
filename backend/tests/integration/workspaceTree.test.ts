import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import request from 'supertest';
import express from 'express';
import fs from 'fs';
import path from 'path';
import os from 'os';

process.env.NODE_ENV = 'test';

// Import the router dynamically to avoid top-level side effects if any
const workspaceRouterPromise = import('../../src/routes/workspace.js');

describe('GET /api/workspace/tree', () => {
  let app: express.Express;
  let tempDir: string;

  beforeEach(async () => {
    // Setup temp directory
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'workspace-test-'));
    process.env.WORKSPACE_BASE = tempDir;

    // Create some files and folders
    fs.mkdirSync(path.join(tempDir, 'subdir'));
    fs.writeFileSync(path.join(tempDir, 'file1.txt'), 'content');
    fs.writeFileSync(path.join(tempDir, 'subdir', 'file2.txt'), 'content');
    fs.writeFileSync(path.join(tempDir, '.hidden'), 'content'); // Dotfile
    fs.mkdirSync(path.join(tempDir, 'node_modules')); // Skipped dir

    const workspaceRouter = (await workspaceRouterPromise).default;
    app = express();
    app.use('/api/workspace', workspaceRouter);
  });

  afterEach(() => {
    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it('should list files in the root workspace directory', async () => {
    const res = await request(app)
      .get('/api/workspace/tree')
      .expect(200);

    expect(res.body.path).toBe(tempDir);
    expect(res.body.entries).toHaveLength(2); // file1.txt, subdir

    const names = res.body.entries.map((e: any) => e.name);
    expect(names).toContain('file1.txt');
    expect(names).toContain('subdir');
    expect(names).not.toContain('.hidden');
    expect(names).not.toContain('node_modules');
  });

  it('should list files in a subdirectory', async () => {
    const res = await request(app)
      .get('/api/workspace/tree?path=subdir')
      .expect(200);

    expect(res.body.entries).toHaveLength(1);
    expect(res.body.entries[0].name).toBe('file2.txt');
  });

  it('should return 404 for non-existent directory', async () => {
    await request(app)
      .get('/api/workspace/tree?path=nonexistent')
      .expect(404);
  });

  it('should return error if path is not a directory', async () => {
    await request(app)
      .get('/api/workspace/tree?path=file1.txt')
      .expect(400); // VALIDATION_ERROR maps to 400
  });

  it('should prevent path traversal', async () => {
    await request(app)
      .get('/api/workspace/tree?path=../outside')
      .expect(403);
  });
});
