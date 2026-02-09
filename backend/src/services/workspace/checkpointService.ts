/**
 * Checkpoint Service — Undo / Revert for Agent Operations
 *
 * Creates reversible checkpoints before agent operations so users can
 * "undo" changes with confidence. This builds trust in autonomous edits.
 *
 * Works by snapshotting modified files before changes are applied and
 * storing them in a commit-addressable log.
 *
 * @module services/workspace/checkpointService
 */

import fs from 'fs/promises';
import path from 'path';
import { randomUUID } from 'crypto';
import { logger } from '../../utils/logger.js';

// ============================================================================
// Types
// ============================================================================

export interface FileSnapshot {
    /** Relative path from workspace root */
    path: string;
    /** Content before the change (null if file didn't exist) */
    content: string | null;
    /** Whether the file existed before the change */
    existed: boolean;
}

export interface Checkpoint {
    /** Unique checkpoint ID */
    id: string;
    /** Human-readable description of what was about to happen */
    description: string;
    /** Session ID that created this checkpoint */
    sessionId: string;
    /** Timestamp */
    createdAt: string;
    /** Files that were snapshotted */
    files: FileSnapshot[];
    /** Whether this checkpoint has been reverted */
    reverted: boolean;
}

export interface CheckpointServiceOptions {
    /** Workspace root directory */
    workspaceRoot: string;
    /** Where to store checkpoint data. @default '.grump/checkpoints' */
    checkpointDir: string;
    /** Max number of checkpoints to retain. @default 50 */
    maxCheckpoints: number;
}

// ============================================================================
// Implementation
// ============================================================================

export class CheckpointService {
    private options: CheckpointServiceOptions;
    private checkpointBasePath: string;

    constructor(options: Partial<CheckpointServiceOptions> & { workspaceRoot: string }) {
        this.options = {
            workspaceRoot: options.workspaceRoot,
            checkpointDir: options.checkpointDir ?? '.grump/checkpoints',
            maxCheckpoints: options.maxCheckpoints ?? 50,
        };
        this.checkpointBasePath = path.join(
            this.options.workspaceRoot,
            this.options.checkpointDir,
        );
    }

    /**
     * Create a checkpoint before modifying files.
     * Call this BEFORE applying any agent-initiated changes.
     *
     * @param filePaths    Paths (relative to workspace root) that will be modified
     * @param description  What the agent is about to do (e.g., "Refactor auth module")
     * @param sessionId    Session that initiated the operation
     * @returns            Checkpoint ID that can be used to revert later
     */
    async createCheckpoint(
        filePaths: string[],
        description: string,
        sessionId: string,
    ): Promise<string> {
        const id = randomUUID();
        const snapshots: FileSnapshot[] = [];

        for (const filePath of filePaths) {
            const fullPath = path.resolve(this.options.workspaceRoot, filePath);
            try {
                const content = await fs.readFile(fullPath, 'utf8');
                snapshots.push({ path: filePath, content, existed: true });
            } catch {
                snapshots.push({ path: filePath, content: null, existed: false });
            }
        }

        const checkpoint: Checkpoint = {
            id,
            description,
            sessionId,
            createdAt: new Date().toISOString(),
            files: snapshots,
            reverted: false,
        };

        // Save checkpoint
        const cpDir = path.join(this.checkpointBasePath, id);
        await fs.mkdir(cpDir, { recursive: true });
        await fs.writeFile(
            path.join(cpDir, 'metadata.json'),
            JSON.stringify(checkpoint, null, 2),
            'utf8',
        );

        // Save file contents separately for large files
        for (let i = 0; i < snapshots.length; i++) {
            if (snapshots[i].content !== null) {
                await fs.writeFile(
                    path.join(cpDir, `file_${i}.snapshot`),
                    snapshots[i].content!,
                    'utf8',
                );
            }
        }

        logger.info(
            { checkpointId: id, files: filePaths.length, description },
            'Checkpoint created',
        );

        // Prune old checkpoints
        await this.pruneOld();

        return id;
    }

    /**
     * Revert a checkpoint — restore all files to their pre-change state.
     */
    async revert(checkpointId: string): Promise<{
        success: boolean;
        filesRestored: number;
        filesDeleted: number;
        error?: string;
    }> {
        try {
            const checkpoint = await this.loadCheckpoint(checkpointId);
            if (!checkpoint) {
                return { success: false, filesRestored: 0, filesDeleted: 0, error: 'Checkpoint not found' };
            }
            if (checkpoint.reverted) {
                return { success: false, filesRestored: 0, filesDeleted: 0, error: 'Checkpoint already reverted' };
            }

            let filesRestored = 0;
            let filesDeleted = 0;

            for (const snapshot of checkpoint.files) {
                const fullPath = path.resolve(this.options.workspaceRoot, snapshot.path);

                if (snapshot.existed && snapshot.content !== null) {
                    // Restore original content
                    await fs.mkdir(path.dirname(fullPath), { recursive: true });
                    await fs.writeFile(fullPath, snapshot.content, 'utf8');
                    filesRestored++;
                } else if (!snapshot.existed) {
                    // File didn't exist before; delete it
                    try {
                        await fs.unlink(fullPath);
                        filesDeleted++;
                    } catch {
                        // File may have already been deleted
                    }
                }
            }

            // Mark as reverted
            checkpoint.reverted = true;
            const cpDir = path.join(this.checkpointBasePath, checkpointId);
            await fs.writeFile(
                path.join(cpDir, 'metadata.json'),
                JSON.stringify(checkpoint, null, 2),
                'utf8',
            );

            logger.info(
                { checkpointId, filesRestored, filesDeleted },
                'Checkpoint reverted',
            );

            return { success: true, filesRestored, filesDeleted };
        } catch (error) {
            logger.error({ error, checkpointId }, 'Checkpoint revert failed');
            return {
                success: false,
                filesRestored: 0,
                filesDeleted: 0,
                error: error instanceof Error ? error.message : String(error),
            };
        }
    }

    /**
     * List all checkpoints, newest first.
     */
    async list(): Promise<Omit<Checkpoint, 'files'>[]> {
        try {
            await fs.mkdir(this.checkpointBasePath, { recursive: true });
            const entries = await fs.readdir(this.checkpointBasePath, { withFileTypes: true });
            const checkpoints: Omit<Checkpoint, 'files'>[] = [];

            for (const entry of entries) {
                if (!entry.isDirectory()) continue;

                try {
                    const metaPath = path.join(this.checkpointBasePath, entry.name, 'metadata.json');
                    const raw = await fs.readFile(metaPath, 'utf8');
                    const cp = JSON.parse(raw) as Checkpoint;
                    const { files: _files, ...rest } = cp;
                    checkpoints.push({ ...rest });
                } catch {
                    // Corrupted checkpoint, skip
                }
            }

            return checkpoints.sort(
                (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
            );
        } catch {
            return [];
        }
    }

    /**
     * Get detailed checkpoint info including file list.
     */
    async getCheckpoint(checkpointId: string): Promise<Checkpoint | null> {
        return this.loadCheckpoint(checkpointId);
    }

    // --------------------------------------------------------------------------
    // Private
    // --------------------------------------------------------------------------

    private async loadCheckpoint(checkpointId: string): Promise<Checkpoint | null> {
        try {
            const metaPath = path.join(this.checkpointBasePath, checkpointId, 'metadata.json');
            const raw = await fs.readFile(metaPath, 'utf8');
            return JSON.parse(raw) as Checkpoint;
        } catch {
            return null;
        }
    }

    private async pruneOld(): Promise<void> {
        const all = await this.list();
        if (all.length <= this.options.maxCheckpoints) return;

        // Remove oldest non-reverted checkpoints
        const toRemove = all.slice(this.options.maxCheckpoints);
        for (const cp of toRemove) {
            try {
                const cpDir = path.join(this.checkpointBasePath, cp.id);
                await fs.rm(cpDir, { recursive: true, force: true });
            } catch {
                // Best-effort cleanup
            }
        }
    }
}
