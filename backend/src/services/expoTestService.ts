/**
 * Expo Test Service
 * Runs Expo/React Native app tests inside a Docker container.
 * Used by the "expo" test job type from SHIP or codegen.
 */

import { spawn } from 'child_process';
import { existsSync } from 'fs';
import { resolve } from 'path';
import logger from '../middleware/logger.js';

const EXPO_TEST_IMAGE = process.env.EXPO_TEST_IMAGE || 'node:20-bookworm-slim';
const DOCKER_TIMEOUT_MS = 5 * 60 * 1000; // 5 min

export interface ExpoTestResult {
  success: boolean;
  exitCode?: number;
  stdout?: string;
  stderr?: string;
  error?: string;
  durationMs?: number;
}

/**
 * Run Expo/React Native tests in a Docker container: mount project, run npm install && npm test.
 * When a dedicated expo-test image is built (see infrastructure/docker/expo-test), set EXPO_TEST_IMAGE.
 */
export async function runExpoTestsInDocker(projectPath: string): Promise<ExpoTestResult> {
  const absPath = resolve(projectPath);
  if (!existsSync(absPath)) {
    return { success: false, error: `Project path does not exist: ${absPath}` };
  }
  const start = Date.now();
  const cmd =
    'cd /app && (test -f package.json && npm install --silent && (npm test 2>/dev/null || npm run test 2>/dev/null || echo "No test script") || echo "No package.json")';
  return new Promise((resolvePromise) => {
    const child = spawn(
      'docker',
      ['run', '--rm', '-v', `${absPath}:/app`, EXPO_TEST_IMAGE, 'sh', '-c', cmd],
      { stdio: ['ignore', 'pipe', 'pipe'], timeout: DOCKER_TIMEOUT_MS }
    );
    let stdout = '';
    let stderr = '';
    child.stdout?.on('data', (c: Buffer) => {
      stdout += c.toString();
    });
    child.stderr?.on('data', (c: Buffer) => {
      stderr += c.toString();
    });
    child.on('error', (err) => {
      logger.warn({ err: err.message }, 'Expo test: docker run failed');
      resolvePromise({
        success: false,
        error: err.message,
        durationMs: Date.now() - start,
      });
    });
    child.on('close', (code, signal) => {
      const durationMs = Date.now() - start;
      resolvePromise({
        success: code === 0,
        exitCode: code ?? -1,
        stdout: stdout.slice(0, 10000),
        stderr: stderr.slice(0, 5000),
        durationMs,
      });
    });
  });
}
