import { spawn } from "child_process";
import { promises as fs } from "fs";
import { join } from "path";
import { tmpdir } from "os";
import logger from "../middleware/logger.js";

const WORKSPACE_CACHE_DIR = join(tmpdir(), "grump-workspaces");

export interface RemoteWorkspace {
  url: string;
  localPath: string;
}

/**
 * Runs a git command using spawn to avoid buffering large outputs and blocking the event loop.
 */
async function runGit(args: string[], cwd?: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn("git", args, { cwd });

    // Capture stderr for error reporting, but limit size to avoid memory issues
    let errorOutput = "";
    if (child.stderr) {
      child.stderr.on("data", (data) => {
        if (errorOutput.length < 2048) {
          errorOutput += data.toString();
        }
      });
    }

    // Drain stdout to prevent blocking if the buffer fills up
    if (child.stdout) {
      child.stdout.resume();
    }

    child.on("error", (err) => reject(err));

    child.on("close", (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(
          new Error(
            `Git command failed with code ${code}: ${errorOutput.trim()}`
          )
        );
      }
    });
  });
}

export async function loadRemoteWorkspace(
  repoUrl: string,
): Promise<RemoteWorkspace> {
  // Ensure cache directory exists asynchronously
  await fs.mkdir(WORKSPACE_CACHE_DIR, { recursive: true });

  // 1. Sanitize URL to create a folder name
  const safeName = repoUrl.replace(/[^a-zA-Z0-9-]/g, "_");
  const targetDir = join(WORKSPACE_CACHE_DIR, safeName);

  logger.info(`Requested remote workspace: ${repoUrl} -> ${targetDir}`);

  // Check if target directory exists
  let exists = false;
  try {
    await fs.access(targetDir);
    exists = true;
  } catch {
    // Directory doesn't exist
  }

  if (exists) {
    try {
      logger.info("Updating existing cached workspace...");
      await runGit(["pull"], targetDir);
    } catch (_e) {
      logger.warn("Failed to pull latest changes, using cached version.");
    }
    return { url: repoUrl, localPath: targetDir };
  }

  // 2. Clone
  try {
    logger.info("Cloning new workspace...");
    await runGit(["clone", "--depth", "1", repoUrl, targetDir]);
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
  } catch (e) {
    logger.error(e, "Failed to clear workspace cache");
  }
}
