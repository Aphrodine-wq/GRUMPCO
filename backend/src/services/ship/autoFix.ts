/**
 * Auto-fix system for common errors (Docker not running, Redis, NIM auth, etc.).
 */
import { exec } from "child_process";
import { promisify } from "util";

const execAsync = promisify(exec);

const AUTO_FIXES: Record<string, () => Promise<void>> = {
  DOCKER_NOT_RUNNING: async () => {
    const platform = process.platform;
    if (platform === "darwin") {
      await execAsync("open -a Docker").catch(() => {});
    }
    // Wait for Docker to start (caller can poll)
  },
  REDIS_NOT_CONNECTED: async () => {
    await execAsync("docker run -d -p 6379:6379 redis").catch(() => {});
  },
};

export async function tryAutoFix(errorCode: string): Promise<boolean> {
  const fix = AUTO_FIXES[errorCode];
  if (!fix) return false;
  await fix();
  return true;
}

export function getAutoFixSuggestions(errorCode: string): string[] {
  switch (errorCode) {
    case "DOCKER_NOT_RUNNING":
      return ["Start Docker Desktop", "Run: docker info"];
    case "NIM_AUTH_FAILED":
      return [
        "Check NVIDIA_NIM_API_KEY in backend/.env",
        "Open Settings → API keys",
      ];
    default:
      return [];
  }
}
