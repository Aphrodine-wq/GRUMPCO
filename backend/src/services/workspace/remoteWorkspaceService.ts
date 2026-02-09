import { spawn } from "child_process";
import { promises as fs } from "fs";
import { join } from "path";
import { tmpdir } from "os";
import logger from "../../middleware/logger.js";

const WORKSPACE_CACHE_DIR = join(tmpdir(), "grump-workspaces");

// Ensure cache dir exists
async function ensureCacheDir() {
  try {
    await fs.mkdir(WORKSPACE_CACHE_DIR, { recursive: true });
  } catch (_e) {
    // Ignore if exists
  }
}

export interface RemoteWorkspace {
  url: string;
  localPath: string;
}

/**
 * Helper to spawn a child process as a promise.
 * Avoids maxBuffer issues of exec and handles output streams.
 */
function spawnAsync(command: string, args: string[], options: { cwd?: string } = {}): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { ...options, stdio: "inherit" });

    child.on("error", (err) => {
      reject(err);
    });

    child.on("close", (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`${command} ${args.join(" ")} failed with code ${code}`));
      }
    });
  });
}

export async function loadRemoteWorkspace(
  repoUrl: string,
): Promise<RemoteWorkspace> {
  await ensureCacheDir();

  // 1. Sanitize URL to create a folder name
  const safeName = repoUrl.replace(/[^a-zA-Z0-9-]/g, "_");
  const targetDir = join(WORKSPACE_CACHE_DIR, safeName);

  logger.info(`Requested remote workspace: ${repoUrl} -> ${targetDir}`);

  // Check if exists
  let exists = false;
  try {
    await fs.access(targetDir);
    exists = true;
  } catch {
    exists = false;
  }

  if (exists) {
    // Already cached. Try to pull?
    try {
      logger.info("Updating existing cached workspace...");
      await spawnAsync("git", ["pull"], { cwd: targetDir });
    } catch (_e) {
      logger.warn("Failed to pull latest changes, using cached version.");
    }
    return { url: repoUrl, localPath: targetDir };
  }

  // 2. Clone
  try {
    // Clone depth 1 for speed if we just want to read.
    logger.info("Cloning new workspace...");
    await spawnAsync("git", ["clone", "--depth", "1", repoUrl, targetDir]);
    return { url: repoUrl, localPath: targetDir };
  } catch (error) {
    logger.error(error, "Failed to clone remote workspace");
    throw new Error("Failed to clone repository. Check URL and public access.");
  }
}

export async function clearWorkspaceCache(): Promise<void> {
  try {
    await fs.rm(WORKSPACE_CACHE_DIR, { recursive: true, force: true });
    await fs.mkdir(WORKSPACE_CACHE_DIR, { recursive: true });
  } catch (_e) {
    logger.error(_e, "Failed to clear workspace cache");
  }
}
