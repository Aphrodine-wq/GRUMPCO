import { spawn } from "child_process";
import { existsSync, mkdirSync, rmSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";
import logger from "../middleware/logger.js";

const WORKSPACE_CACHE_DIR = join(tmpdir(), "grump-workspaces");

// Ensure cache dir exists
if (!existsSync(WORKSPACE_CACHE_DIR)) {
  mkdirSync(WORKSPACE_CACHE_DIR, { recursive: true });
}

export interface RemoteWorkspace {
  url: string;
  localPath: string;
}

/**
 * Executes a git command using spawn for better stream handling and security (no shell).
 */
function runGitCommand(args: string[], cwd?: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const proc = spawn("git", args, { cwd });

    let stderr = "";

    // Capture stderr for debugging if needed
    if (proc.stderr) {
      proc.stderr.on("data", (data) => {
        stderr += data.toString();
      });
    }

    proc.on("close", (code) => {
      if (code === 0) {
        resolve();
      } else {
        // Include stderr in error message for context
        reject(new Error(`Git command failed with code ${code}. Error: ${stderr}`));
      }
    });

    proc.on("error", (err) => {
      reject(err);
    });
  });
}

export async function loadRemoteWorkspace(
  repoUrl: string,
): Promise<RemoteWorkspace> {
  // 1. Sanitize URL to create a folder name
  const safeName = repoUrl.replace(/[^a-zA-Z0-9-]/g, "_");
  const targetDir = join(WORKSPACE_CACHE_DIR, safeName);

  logger.info(`Requested remote workspace: ${repoUrl} -> ${targetDir}`);

  if (existsSync(targetDir)) {
    // Already cached. Try to pull?
    try {
      logger.info("Updating existing cached workspace...");
      await runGitCommand(["pull"], targetDir);
    } catch (_e) {
      logger.warn("Failed to pull latest changes, using cached version.");
    }
    return { url: repoUrl, localPath: targetDir };
  }

  // 2. Clone
  try {
    // Clone depth 1 for speed if we just want to read.
    logger.info("Cloning new workspace...");
    // Use spawn with array arguments to avoid shell injection
    await runGitCommand(["clone", "--depth", "1", "--", repoUrl, targetDir]);
    return { url: repoUrl, localPath: targetDir };
  } catch (error) {
    logger.error(error, "Failed to clone remote workspace");
    throw new Error("Failed to clone repository. Check URL and public access.");
  }
}

export function clearWorkspaceCache(): void {
  if (existsSync(WORKSPACE_CACHE_DIR)) {
    rmSync(WORKSPACE_CACHE_DIR, { recursive: true, force: true });
    mkdirSync(WORKSPACE_CACHE_DIR);
  }
}
