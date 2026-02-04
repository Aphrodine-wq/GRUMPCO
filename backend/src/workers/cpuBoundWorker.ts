/**
 * CPU-Bound Worker
 * Handles CPU-intensive operations in a separate thread.
 * When thread affinity is enabled, workerData contains { workerIndex, cpuCount } for process managers.
 */

import { parentPort, workerData } from 'worker_threads';
import { runIntentCli } from '../services/intentCliRunner.js';

const _workerIndex =
  (workerData as { workerIndex?: number; cpuCount?: number } | undefined)?.workerIndex ?? -1;

interface WorkerMessage {
  type: string;
  taskId: string;
  data: unknown;
}

interface WorkerResponse {
  taskId: string;
  success: boolean;
  result?: unknown;
  error?: string;
}

/**
 * Parse intent via grump-intent CLI (CPU-bound spawn + parse).
 */
async function parseIntent(data: {
  text: string;
  constraints?: Record<string, unknown>;
}): Promise<unknown> {
  return runIntentCli(data.text, data.constraints);
}

/**
 * Generate context (CPU-intensive JSON processing)
 */
async function generateContext(data: { projectDescription: string }): Promise<unknown> {
  // Placeholder for context generation
  return {
    projectDescription: data.projectDescription,
    timestamp: Date.now(),
  };
}

/**
 * Process large JSON (CPU-intensive parsing/stringifying)
 */
async function processLargeJson(data: {
  json: string;
  operation: 'parse' | 'stringify';
}): Promise<unknown> {
  if (data.operation === 'parse') {
    return JSON.parse(data.json);
  } else {
    return JSON.stringify(data.json);
  }
}

/**
 * Main message handler
 */
if (parentPort) {
  parentPort.on('message', async (message: WorkerMessage) => {
    const response: WorkerResponse = {
      taskId: message.taskId,
      success: false,
    };

    try {
      let result: unknown;

      switch (message.type) {
        case 'parseIntent':
          result = await parseIntent(
            message.data as { text: string; constraints?: Record<string, unknown> }
          );
          break;

        case 'generateContext':
          result = await generateContext(message.data as { projectDescription: string });
          break;

        case 'processLargeJson':
          result = await processLargeJson(
            message.data as { json: string; operation: 'parse' | 'stringify' }
          );
          break;

        default:
          throw new Error(`Unknown task type: ${message.type}`);
      }

      response.success = true;
      response.result = result;
    } catch (error) {
      response.success = false;
      response.error = error instanceof Error ? error.message : String(error);
    }

    if (parentPort) {
      parentPort.postMessage(response);
    }
  });
}
