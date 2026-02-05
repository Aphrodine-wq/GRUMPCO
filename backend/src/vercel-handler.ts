/**
 * Vercel serverless entry: wait for app to be ready then forward (req, res) to Express.
 * Used by backend/api/index.ts when deploying to Vercel.
 */
import path from "path";
import { pathToFileURL } from "url";
import type { IncomingMessage, ServerResponse } from "http";

let appPromise: Promise<{
  default: (req: IncomingMessage, res: ServerResponse) => void;
  appReady: Promise<void>;
}> | null = null;

async function getApp() {
  if (!appPromise) {
    const distPath = path.join(process.cwd(), "dist", "index.js");
    appPromise = import(pathToFileURL(distPath).href) as Promise<{
      default: (req: IncomingMessage, res: ServerResponse) => void;
      appReady: Promise<void>;
    }>;
  }
  return appPromise;
}

export default async function handler(
  req: IncomingMessage,
  res: ServerResponse,
): Promise<void> {
  const { default: app, appReady } = await getApp();
  await appReady;
  app(req, res);
}
