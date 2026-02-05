import { execSync } from "child_process";
import { existsSync, mkdirSync, rmSync, writeFileSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";

// MOCK LOGGER
const logger = {
  info: (msg: string) => console.log(`[INFO] ${msg}`),
  warn: (msg: string) => console.log(`[WARN] ${msg}`),
  error: (err: any, msg: string) => console.error(`[ERROR] ${msg}`, err),
};

const WORKSPACE_CACHE_DIR = join(tmpdir(), "grump-workspaces");

if (!existsSync(WORKSPACE_CACHE_DIR)) {
  mkdirSync(WORKSPACE_CACHE_DIR, { recursive: true });
}

interface RemoteWorkspace {
  url: string;
  localPath: string;
}

// COPIED FROM src/services/remoteWorkspaceService.ts
async function loadRemoteWorkspace(
  repoUrl: string,
): Promise<RemoteWorkspace> {
  const safeName = repoUrl.replace(/[^a-zA-Z0-9-]/g, "_");
  const targetDir = join(WORKSPACE_CACHE_DIR, safeName);

  logger.info(`Requested remote workspace: ${repoUrl} -> ${targetDir}`);

  if (existsSync(targetDir)) {
    try {
      logger.info("Updating existing cached workspace...");
      execSync("git pull", { cwd: targetDir, stdio: "ignore" });
    } catch (_e) {
      logger.warn("Failed to pull latest changes, using cached version.");
    }
    return { url: repoUrl, localPath: targetDir };
  }

  try {
    logger.info("Cloning new workspace...");
    execSync(`git clone --depth 1 ${repoUrl} ${targetDir}`);
    return { url: repoUrl, localPath: targetDir };
  } catch (error) {
    logger.error(error, "Failed to clone remote workspace");
    throw new Error("Failed to clone repository. Check URL and public access.");
  }
}

function clearWorkspaceCache(): void {
  if (existsSync(WORKSPACE_CACHE_DIR)) {
    rmSync(WORKSPACE_CACHE_DIR, { recursive: true, force: true });
    mkdirSync(WORKSPACE_CACHE_DIR);
  }
}

// BENCHMARK CODE
const BENCH_REPO_DIR = join(tmpdir(), "grump-bench-repo");

function setupRepo() {
  try {
    rmSync(BENCH_REPO_DIR, { recursive: true, force: true });
    mkdirSync(BENCH_REPO_DIR, { recursive: true });
    execSync("git init", { cwd: BENCH_REPO_DIR, stdio: 'ignore' });
    execSync("git config user.email 'bench@example.com'", { cwd: BENCH_REPO_DIR, stdio: 'ignore' });
    execSync("git config user.name 'Bench User'", { cwd: BENCH_REPO_DIR, stdio: 'ignore' });
    writeFileSync(join(BENCH_REPO_DIR, "README.md"), "# Bench Repo");
    const largeContent = "a".repeat(1024 * 1024 * 5); // 5MB
    writeFileSync(join(BENCH_REPO_DIR, "large.txt"), largeContent);
    execSync("git add .", { cwd: BENCH_REPO_DIR, stdio: 'ignore' });
    execSync("git commit -m 'Initial commit'", { cwd: BENCH_REPO_DIR, stdio: 'ignore' });
  } catch (e) {
    console.error("Failed to setup bench repo:", e);
  }
}

function cleanup() {
   try {
     rmSync(BENCH_REPO_DIR, { recursive: true, force: true });
     clearWorkspaceCache();
   } catch (e) {
     // ignore
   }
}

async function runBenchmark() {
  console.log("Setting up benchmark...");
  setupRepo();
  clearWorkspaceCache();

  let lastInterval = Date.now();
  let maxGap = 0;
  const intervalTimer = setInterval(() => {
    const now = Date.now();
    const diff = now - lastInterval;
    if (diff > maxGap) maxGap = diff;
    lastInterval = now;
  }, 10);

  console.log("Starting loadRemoteWorkspace (Clone)...");
  const start = Date.now();
  try {
    await loadRemoteWorkspace(`file://${BENCH_REPO_DIR}`);
  } catch (e) {
    console.error("loadRemoteWorkspace failed:", e);
  }
  const duration = Date.now() - start;

  clearInterval(intervalTimer);

  console.log("---------------------------------------------------");
  console.log(`Operation Duration: ${duration}ms`);
  console.log(`Max Event Loop Gap: ${maxGap}ms (Target: ~10ms)`);
  console.log("---------------------------------------------------");

  if (maxGap > 50) {
     console.log("CONCLUSION: Event loop WAS BLOCKED.");
  } else {
     console.log("CONCLUSION: Event loop was NOT blocked.");
  }

  cleanup();
}

runBenchmark().catch(console.error);
