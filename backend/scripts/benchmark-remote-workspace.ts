import { join } from "path";
import { tmpdir } from "os";
import { writeFileSync, mkdirSync, rmSync, existsSync } from "fs";
import { execSync } from "child_process";
import { loadRemoteWorkspace, clearWorkspaceCache } from "../src/services/remoteWorkspaceService";

// Mock logger to avoid clutter
import logger from "../src/middleware/logger";
logger.level = 'silent';

const BENCH_REPO_DIR = join(tmpdir(), "grump-bench-repo");

function setupRepo() {
  try {
    if (existsSync(BENCH_REPO_DIR)) {
        rmSync(BENCH_REPO_DIR, { recursive: true, force: true });
    }
    mkdirSync(BENCH_REPO_DIR, { recursive: true });
    execSync("git init", { cwd: BENCH_REPO_DIR, stdio: 'ignore' });
    execSync("git config user.email 'bench@example.com'", { cwd: BENCH_REPO_DIR, stdio: 'ignore' });
    execSync("git config user.name 'Bench User'", { cwd: BENCH_REPO_DIR, stdio: 'ignore' });

    // Create MANY files to stress rmSync
    console.log("Generating 5000 dummy files...");
    const subDir = join(BENCH_REPO_DIR, "subdir");
    mkdirSync(subDir);
    for (let i = 0; i < 5000; i++) {
        writeFileSync(join(subDir, `file-${i}.txt`), "x");
    }

    execSync("git add .", { cwd: BENCH_REPO_DIR, stdio: 'ignore' });
    execSync("git commit -m 'Initial commit'", { cwd: BENCH_REPO_DIR, stdio: 'ignore' });
  } catch (e) {
    console.error("Failed to setup bench repo:", e);
  }
}

async function measureLag(name: string, fn: () => Promise<void> | void) {
    let maxGap = 0;
    let last = Date.now();
    const timer = setInterval(() => {
        const now = Date.now();
        const diff = now - last;
        // Expected diff is ~10ms. If significantly larger, loop was blocked.
        // We track the gap BEYOND the interval.
        if (diff > maxGap) maxGap = diff;
        last = now;
    }, 5); // Check every 5ms

    const start = Date.now();
    try {
        await fn();
    } finally {
        clearInterval(timer);
    }
    const duration = Date.now() - start;

    // Report max gap. If > 20ms, meaningful blocking occurred.
    console.log(`[${name}] Duration: ${duration}ms, Max Loop Gap: ${maxGap}ms (Target: ~5ms)`);
    return maxGap;
}

async function run() {
    console.log("Setting up benchmark repo...");
    setupRepo();

    // Clear cache first just in case
    await clearWorkspaceCache();

    // 1. Measure loadRemoteWorkspace (should be fast/non-blocking)
    console.log("Running loadRemoteWorkspace...");
    await measureLag("loadRemoteWorkspace", async () => {
        await loadRemoteWorkspace(`file://${BENCH_REPO_DIR}`);
    });

    // 2. Measure clearWorkspaceCache (using rmSync)
    console.log("Running clearWorkspaceCache...");
    await measureLag("clearWorkspaceCache", async () => {
        await clearWorkspaceCache();
    });

    // Clean up bench repo
    if (existsSync(BENCH_REPO_DIR)) {
        rmSync(BENCH_REPO_DIR, { recursive: true, force: true });
    }
}

run().catch(console.error);
