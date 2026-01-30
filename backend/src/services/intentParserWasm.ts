/**
 * WASM-based intent parser
 * Provides high-performance intent parsing using Rust WASM module
 */

import logger from '../middleware/logger.js';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

interface IntentOutput {
  actors: string[];
  features: string[];
  data_flows: string[];
  tech_stack_hints: string[];
  constraints: Record<string, unknown>;
  raw: string;
}

let wasmModule: any = null;
let wasmAvailable = false;

/**
 * Initialize WASM module
 */
async function initWasm(): Promise<void> {
  if (wasmModule) return;

  try {
    // Try to load WASM module from intent-compiler/pkg-node
    const wasmPath = join(__dirname, '../../../intent-compiler/pkg-node/grump_intent.js');
    wasmModule = await import(wasmPath);
    wasmAvailable = true;
    logger.info('WASM intent parser initialized');
  } catch (error) {
    logger.warn(
      { error: error instanceof Error ? error.message : String(error) },
      'WASM module not available, will use fallback'
    );
    wasmAvailable = false;
  }
}

/**
 * Parse intent using WASM module
 */
export async function parseIntentWasm(
  text: string,
  constraints?: Record<string, unknown>
): Promise<IntentOutput> {
  await initWasm();

  if (!wasmAvailable || !wasmModule) {
    throw new Error('WASM module not available');
  }

  try {
    const constraintsJson = JSON.stringify(constraints || {});
    const result = wasmModule.parse_intent_wasm(text, constraintsJson);
    return result as IntentOutput;
  } catch (error) {
    logger.error(
      { error: error instanceof Error ? error.message : String(error) },
      'WASM intent parsing failed'
    );
    throw error;
  }
}

/**
 * Extract actors using WASM
 */
export async function extractActorsWasm(text: string): Promise<string[]> {
  await initWasm();

  if (!wasmAvailable || !wasmModule) {
    throw new Error('WASM module not available');
  }

  return wasmModule.extract_actors_wasm(text);
}

/**
 * Extract features using WASM
 */
export async function extractFeaturesWasm(text: string): Promise<string[]> {
  await initWasm();

  if (!wasmAvailable || !wasmModule) {
    throw new Error('WASM module not available');
  }

  return wasmModule.extract_features_wasm(text);
}

/**
 * Check if WASM is available
 */
export function isWasmAvailable(): boolean {
  return wasmAvailable;
}

/**
 * Get WASM module info
 */
export function getWasmInfo(): { available: boolean; module: string | null } {
  return {
    available: wasmAvailable,
    module: wasmModule ? 'grump_intent' : null,
  };
}
