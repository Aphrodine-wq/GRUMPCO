/**
 * Playwright global setup.
 * In CI, wait for backend health/quick before any tests run.
 */
async function waitForBackend(baseUrl: string, maxAttempts = 60, intervalMs = 1000): Promise<void> {
  const healthUrl = `${baseUrl.replace(/\/$/, '')}/health/quick`;
  for (let i = 0; i < maxAttempts; i++) {
    try {
      const res = await fetch(healthUrl);
      if (res.ok) {
        const data = (await res.json()) as { status?: string };
        if (data?.status === 'healthy') return;
      }
    } catch {
      // ignore and retry
    }
    await new Promise((r) => setTimeout(r, intervalMs));
  }
  throw new Error(`Backend health check failed after ${maxAttempts} attempts: ${healthUrl}`);
}

export default async function globalSetup(): Promise<void> {
  // In CI, wait for backend health before starting E2E (backend is started by CI job)
  const apiUrl = process.env.VITE_API_URL || process.env.PLAYWRIGHT_API_URL;
  if (process.env.CI && apiUrl) {
    await waitForBackend(apiUrl);
  }
}
