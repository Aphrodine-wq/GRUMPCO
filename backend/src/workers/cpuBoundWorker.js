/**
 * CPU-Bound Worker (Compiled JavaScript version)
 * This file is generated from cpuBoundWorker.ts during build
 *
 * Note: In production, this should be compiled from the TypeScript source
 * For now, this is a minimal implementation that will be replaced by the compiled version
 */

const { parentPort } = require('worker_threads');

/**
 * Parse intent (CPU-intensive regex operations)
 */
async function parseIntent(data) {
  return {
    actors: ['user'],
    features: [],
    data_flows: [],
    tech_stack_hints: [],
    constraints: data.constraints || {},
    raw: data.text,
  };
}

/**
 * Generate context (CPU-intensive JSON processing)
 */
async function generateContext(data) {
  return {
    projectDescription: data.projectDescription,
    timestamp: Date.now(),
  };
}

/**
 * Process large JSON (CPU-intensive parsing/stringifying)
 */
async function processLargeJson(data) {
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
  parentPort.on('message', async (message) => {
    const response = {
      taskId: message.taskId,
      success: false,
    };

    try {
      let result;

      switch (message.type) {
        case 'parseIntent':
          result = await parseIntent(message.data);
          break;

        case 'generateContext':
          result = await generateContext(message.data);
          break;

        case 'processLargeJson':
          result = await processLargeJson(message.data);
          break;

        default:
          throw new Error(`Unknown task type: ${message.type}`);
      }

      response.success = true;
      response.result = result;
    } catch (error) {
      response.success = false;
      response.error = error.message || String(error);
    }

    parentPort.postMessage(response);
  });
}
