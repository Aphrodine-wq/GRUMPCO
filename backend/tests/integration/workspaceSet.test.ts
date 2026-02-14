/**
 * Workspace Set + Current API integration tests.
 *
 * Tests the POST /api/workspace/set and GET /api/workspace/current endpoints
 * that are critical for the local sidecar architecture.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import express from 'express';
import type { Express } from 'express';
import os from 'os';
import path from 'path';
import fs from 'fs';

process.env.NODE_ENV = 'test';

const mockLoadRemoteWorkspace = vi.fn();

vi.mock('../../src/services/workspace/remoteWorkspaceService.js', () => ({
    loadRemoteWorkspace: (...args: unknown[]) => mockLoadRemoteWorkspace(...args),
}));

const workspaceModule = await import('../../src/routes/workspace.js');
const workspaceRoutes = workspaceModule.default;
const { setActiveWorkspaceRoot, getActiveWorkspaceRoot } = workspaceModule;

const app: Express = express();
app.use(express.json());
app.use('/api/workspace', workspaceRoutes);

describe('Workspace Set/Current API', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        // Reset workspace root between tests
        setActiveWorkspaceRoot(null);
    });

    describe('POST /api/workspace/set', () => {
        it('returns 400 when path is missing', async () => {
            const res = await request(app)
                .post('/api/workspace/set')
                .send({})
                .expect(400);
            expect(res.body.error).toBeDefined();
        });

        it('returns 400 when path is empty string', async () => {
            const res = await request(app)
                .post('/api/workspace/set')
                .send({ path: '' })
                .expect(400);
            expect(res.body.error).toBeDefined();
        });

        it('returns 404 when directory does not exist', async () => {
            const res = await request(app)
                .post('/api/workspace/set')
                .send({ path: '/nonexistent/fake/directory/xyz123' })
                .expect(404);
            expect(res.body.error).toBeDefined();
        });

        it('returns 200 and sets workspace root for valid directory', async () => {
            const tempDir = os.tmpdir();

            const res = await request(app)
                .post('/api/workspace/set')
                .send({ path: tempDir })
                .expect(200);

            expect(res.body.success).toBe(true);
            expect(res.body.path).toBe(path.resolve(tempDir));
            expect(getActiveWorkspaceRoot()).toBe(path.resolve(tempDir));
        });

        it('returns 400 when path points to a file', async () => {
            // Create a temp file
            const tempFile = path.join(os.tmpdir(), `grump-test-file-${Date.now()}.txt`);
            fs.writeFileSync(tempFile, 'test');

            try {
                const res = await request(app)
                    .post('/api/workspace/set')
                    .send({ path: tempFile })
                    .expect(400);
                expect(res.body.error).toBeDefined();
            } finally {
                fs.unlinkSync(tempFile);
            }
        });
    });

    describe('GET /api/workspace/current', () => {
        it('returns null when no workspace is set', async () => {
            const res = await request(app)
                .get('/api/workspace/current')
                .expect(200);
            expect(res.body.path).toBeNull();
        });

        it('returns the set workspace path', async () => {
            const tempDir = os.tmpdir();
            setActiveWorkspaceRoot(path.resolve(tempDir));

            const res = await request(app)
                .get('/api/workspace/current')
                .expect(200);
            expect(res.body.path).toBe(path.resolve(tempDir));
        });
    });

    describe('GET /api/workspace/tree', () => {
        it('returns 400 when no workspace root is set and no path query', async () => {
            const res = await request(app)
                .get('/api/workspace/tree')
                .expect(400);
            expect(res.body.error).toContain('No workspace root set');
        });

        it('returns entries when workspace root is set', async () => {
            const tempDir = os.tmpdir();
            setActiveWorkspaceRoot(path.resolve(tempDir));

            const res = await request(app)
                .get('/api/workspace/tree')
                .expect(200);

            expect(res.body.path).toBeDefined();
            expect(Array.isArray(res.body.entries)).toBe(true);
        });

        it('allows absolute path query even without workspace root', async () => {
            const tempDir = os.tmpdir();

            const res = await request(app)
                .get('/api/workspace/tree')
                .query({ path: tempDir })
                .expect(200);

            expect(res.body.path).toBeDefined();
            expect(Array.isArray(res.body.entries)).toBe(true);
        });
    });
});
