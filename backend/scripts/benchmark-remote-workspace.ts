import { execSync } from "child_process";
import { existsSync, mkdirSync, rmSync, writeFileSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";
import { loadRemoteWorkspace, clearWorkspaceCache } from "../src/services/remoteWorkspaceService";

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

async function cleanup() {
   try {
     rmSync(BENCH_REPO_DIR, { recursive: true, force: true });
     await clearWorkspaceCache();
   } catch (e) {
     // ignore
   }
}

async function runBenchmark() {
  console.log("Setting up benchmark...");
  setupRepo();
  await clearWorkspaceCache();

  let lastInterval = Date.now();
  let maxGap = 0;
  const intervalTimer = setInterval(() => {
    const now = Date.now();
    const diff = now - lastInterval;
    // We expect ~10ms. If it's significantly more, event loop was blocked.
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

  await cleanup();
}

runBenchmark().catch(console.error);
