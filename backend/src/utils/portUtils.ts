import net from "net";
import logger from "../middleware/logger.js";

/**
 * Check if a port is available for use
 */
function isPortAvailable(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const server = net.createServer();
    server.once("error", (err: NodeJS.ErrnoException) => {
      if (err.code === "EADDRINUSE") {
        resolve(false);
      } else {
        resolve(false);
      }
    });
    server.once("listening", () => {
      server.close();
      resolve(true);
    });
    server.listen(port);
  });
}

/**
 * Find an available port starting from the preferred port
 */
export async function findAvailablePort(
  startPort: number = 3000,
  maxAttempts: number = 10,
): Promise<number> {
  const port = Number(startPort);
  if (isNaN(port)) {
    throw new Error(`Invalid startPort: ${startPort}`);
  }

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const testPort = port + attempt;
    const available = await isPortAvailable(testPort);
    if (available) {
      if (attempt > 0) {
        logger.warn(
          { preferredPort: port, actualPort: testPort },
          `Port ${port} busy, using fallback port ${testPort}`,
        );
      }
      return testPort;
    }
  }

  throw new Error(
    `No available ports in range ${port}-${port + maxAttempts - 1}`,
  );
}
